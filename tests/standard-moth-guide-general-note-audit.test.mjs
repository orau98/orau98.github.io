import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const APPLY_SCRIPT = path.join(
  ROOT,
  'scripts',
  'apply-standard-moth-guide-general-note-audit.mjs',
);
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-standard-moth-guides-general-note-audit-2026-07-12.json',
);
const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
const audit = JSON.parse(rawAudit);
const COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

const runApply = (notesPath, { args = [], env = {} } = {}) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      STANDARD_MOTH_NOTE_AUDIT_NOTES_PATH: notesPath,
      ...env,
    },
  },
);

const makeFixtureRows = () => [
  {
    record_id: 'note-unrelated', insect_id: 'species-unrelated', note_type: '生態情報',
    content: '無関係な確定本文。', reference: '別文献', page: '10', year: '',
  },
  ...audit.rows.map(row => ({
    record_id: row.record_id,
    insect_id: row.insect_id,
    note_type: row.note_type,
    content: row.old_content,
    reference: row.reference,
    page: '',
    year: '',
  })),
];

const writeNotes = (filePath, rows) => fs.writeFileSync(
  filePath,
  `\ufeff${Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' })}\r\n`,
);

const parseNotes = filePath => Papa.parse(
  fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;

test('production ledger is an exact 17-row original-PDF audit with clean approved notes', () => {
  assert.equal(
    crypto.createHash('sha256').update(rawAudit).digest('hex'),
    'df4defc297b5ebbf3e4a25aaf657d5cc0efb8bdab4a9b67443d4f422cd367059',
  );
  assert.equal(audit.audit_version, 'standard-moth-guides-notes-v1-2026-07-12');
  assert.equal(audit.reviewed_on, '2026-07-12');
  assert.deepEqual(audit.expected_profile, {
    replace_note_content: 17,
    exclude_note: 0,
    hold_no_change: 0,
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.source_documents).map(([reference, source]) => [
      reference,
      { pdf_sha256: source.pdf_sha256, pdf_pages: source.pdf_pages },
    ])),
    {
      日本産蛾類標準図鑑2: {
        pdf_sha256: '2d24a2870a7f890cb4af8d79b55dfc7fe6215607f6d70bbdcd41ca02db8eb5f9',
        pdf_pages: 143,
      },
      日本産蛾類標準図鑑3: {
        pdf_sha256: '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850',
        pdf_pages: 138,
      },
    },
  );
  assert.equal(audit.rows.length, 17);
  assert.equal(new Set(audit.rows.map(row => row.audit_id)).size, 17);
  assert.equal(new Set(audit.rows.map(row => row.record_id)).size, 17);
  for (const row of audit.rows) {
    assert.equal(row.action, 'replace_note_content', row.audit_id);
    assert.notEqual(row.old_content, row.approved_content, row.audit_id);
    assert.ok(row.pdf_page, row.audit_id);
    assert.ok(row.printed_page, row.audit_id);
    assert.ok(row.evidence, row.audit_id);
    assert.ok(row.decision, row.audit_id);
    assert.deepEqual(collectGeneralNoteIssues({
      note_type: row.note_type,
      content: row.approved_content,
      page: row.printed_page,
    }), [], row.audit_id);
  }
});

test('apply replaces all 17 exact record IDs, fills printed pages and is byte-idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-moth-note-audit-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"pending_replacements": 17/);
  const firstBytes = fs.readFileSync(notesPath);
  assert.equal(firstBytes.subarray(0, 3).toString('hex'), 'efbbbf');
  const rows = parseNotes(notesPath);
  const byId = new Map(rows.map(row => [row.record_id, row]));
  assert.equal(byId.get('note-unrelated').content, '無関係な確定本文。');
  for (const entry of audit.rows) {
    assert.equal(byId.get(entry.record_id)?.content, entry.approved_content, entry.audit_id);
    assert.equal(byId.get(entry.record_id)?.page, entry.printed_page, entry.audit_id);
  }

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /"pending_replacements": 0/);
  assert.match(second.stdout, /"changed": false/);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('--check validates the hypothetical result without changing bytes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-moth-note-check-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"pending_replacements": 17/);
  assert.match(result.stdout, /"check_only": true/);
  assert.match(result.stdout, /"changed": false/);
  assert.match(result.stdout, /"would_change": true/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('unexpected late-row content aborts before any write', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-moth-note-late-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const lastTarget = audit.rows.at(-1);
  rows.find(row => row.record_id === lastTarget.record_id).content = '別の確定本文。';
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('content-only and page-only partial states are both refused without writing', () => {
  for (const partialState of ['content-only', 'page-only']) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `standard-moth-note-${partialState}-`));
    const notesPath = path.join(directory, 'general_notes.csv');
    const rows = makeFixtureRows();
    const target = audit.rows[0];
    const fixtureTarget = rows.find(row => row.record_id === target.record_id);
    if (partialState === 'content-only') fixtureTarget.content = target.approved_content;
    if (partialState === 'page-only') fixtureTarget.page = target.printed_page;
    writeNotes(notesPath, rows);
    const before = fs.readFileSync(notesPath);

    const result = runApply(notesPath);
    assert.notEqual(result.status, 0, partialState);
    assert.match(result.stderr, /Unexpected replacement state/, partialState);
    assert.deepEqual(fs.readFileSync(notesPath), before, partialState);
  }
});

test('a different record ID with the approved content is not treated as applied', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-moth-note-record-id-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const target = audit.rows[0];
  const fixtureTarget = rows.find(row => row.record_id === target.record_id);
  fixtureTarget.record_id = 'note-recalculated-but-unapproved';
  fixtureTarget.content = target.approved_content;
  fixtureTarget.page = target.printed_page;
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required note is missing/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('source PDF hash mismatch fails closed before writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-moth-note-pdf-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const pdfPath = path.join(directory, 'wrong.pdf');
  writeNotes(notesPath, makeFixtureRows());
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, {
    env: { STANDARD_MOTH_NOTE_AUDIT_PDF2_PATH: pdfPath },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch for 日本産蛾類標準図鑑2/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('same-count tampered ledger cannot be forced through production mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-moth-note-ledger-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const auditPath = path.join(directory, 'audit.json');
  writeNotes(notesPath, makeFixtureRows());
  const tampered = structuredClone(audit);
  tampered.rows[0].decision += '_tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, {
    env: {
      STANDARD_MOTH_NOTE_AUDIT_PATH: auditPath,
      STANDARD_MOTH_NOTE_AUDIT_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
