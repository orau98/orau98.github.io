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
  'apply-japanese-moths-standard-guide-1-note-audit.mjs',
);
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-1-note-integrity-2026-07-12.json',
);
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

const runApply = (notesPath, { args = [], env = {} } = {}) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      JMSG1_NOTES_PATH: notesPath,
      ...env,
    },
  },
);

const makeFixtureRows = () => [
  {
    record_id: 'note-unrelated', insect_id: 'species-unrelated', note_type: '生態情報',
    content: '無関係な確定本文。', reference: '別文献', page: '10', year: '',
  },
  {
    record_id: 'note-900401', insect_id: 'species-4023', note_type: '生態情報',
    content: 'まれな種だが、河川敷や海岸での採集例が多い。',
    reference: audit.reference, page: '', year: '',
  },
  ...audit.entries.map((entry) => ({
    record_id: entry.record_id,
    insect_id: entry.insect_id,
    note_type: audit.note_type,
    content: entry.expected_content,
    reference: audit.reference,
    page: entry.expected_page,
    year: '',
  })),
];

const writeNotes = (filePath, rows) => fs.writeFileSync(
  filePath,
  `\ufeff${Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' })}\r\n`,
);

test('production ledger is a 31-entry original-PDF audit with exact action guards', () => {
  assert.equal(audit.audit_version, '2026-07-12');
  assert.equal(audit.source_pdf.sha256, '35e3a46b1c91a6f16a6aff7522be708ed8a94ccfc8dc39d23c3d3e9171cfd0d9');
  assert.equal(audit.source_pdf.page_count, 115);
  assert.equal(audit.entries.length, 31);
  assert.equal(audit.entries.filter((entry) => entry.action === 'replace').length, 29);
  assert.equal(audit.entries.filter((entry) => entry.action === 'delete').length, 2);
  assert.deepEqual(
    [...audit.scope.excluded_false_positives].sort(),
    ['note-900401'],
  );
  assert.equal(new Set(audit.entries.map((entry) => entry.audit_id)).size, 31);
  assert.equal(new Set(audit.entries.map((entry) => entry.record_id)).size, 31);
  for (const entry of audit.entries) {
    assert.ok(entry.expected_content, entry.audit_id);
    assert.equal(entry.expected_page, '', entry.audit_id);
    assert.ok(entry.source_location.pdf_pages.length > 0, entry.audit_id);
    assert.ok(entry.source_location.printed_pages.length > 0, entry.audit_id);
    assert.ok(entry.decision, entry.audit_id);
    if (entry.action === 'replace') {
      assert.ok(entry.approved_content, entry.audit_id);
      assert.ok(entry.approved_page, entry.audit_id);
      assert.deepEqual(collectGeneralNoteIssues({
        note_type: audit.note_type,
        content: entry.approved_content,
        page: entry.approved_page,
      }), [], entry.audit_id);
    } else {
      assert.equal(entry.approved_content, '');
      assert.equal(entry.approved_page, '');
    }
  }
});

test('apply replaces 29 notes, deletes two non-public notes, fills pages and is byte-idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-note-audit-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstBytes = fs.readFileSync(notesPath);
  assert.equal(firstBytes.subarray(0, 3).toString('hex'), 'efbbbf');
  const rows = Papa.parse(firstBytes.toString('utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const byId = new Map(rows.map((row) => [row.record_id, row]));
  assert.equal(byId.get('note-unrelated').content, '無関係な確定本文。');
  assert.equal(byId.get('note-900401').content.includes('採集例'), true);
  for (const entry of audit.entries) {
    if (entry.action === 'delete') {
      assert.equal(byId.has(entry.record_id), false, entry.audit_id);
    } else {
      assert.equal(byId.get(entry.record_id)?.content, entry.approved_content, entry.audit_id);
      assert.equal(byId.get(entry.record_id)?.page, entry.approved_page, entry.audit_id);
    }
  }

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('--check validates the hypothetical result without changing bytes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-note-check-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"pending_replacements": 29/);
  assert.match(result.stdout, /"pending_deletions": 2/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('unexpected late-row content aborts before any write', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-note-fail-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const lastTarget = audit.entries.at(-1);
  rows.find((row) => row.record_id === lastTarget.record_id).content = '別の確定本文。';
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('mixed content/page state is refused rather than treated as applied', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-note-mixed-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const target = audit.entries.find((entry) => entry.action === 'replace');
  rows.find((row) => row.record_id === target.record_id).content = target.approved_content;
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('source PDF hash mismatch fails closed before writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-note-pdf-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const pdfPath = path.join(directory, '日本産蛾類標準図鑑1 2.pdf');
  writeNotes(notesPath, makeFixtureRows());
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, { env: { JMSG1_PDF_PATH: pdfPath } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('tampered ledger cannot be forced through production mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-note-ledger-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const auditPath = path.join(directory, 'audit.json');
  writeNotes(notesPath, makeFixtureRows());
  const tampered = structuredClone(audit);
  tampered.entries[0].decision += ' tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, {
    env: {
      JMSG1_AUDIT_PATH: auditPath,
      JMSG1_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
