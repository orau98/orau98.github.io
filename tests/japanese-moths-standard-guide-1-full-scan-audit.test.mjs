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
  'apply-japanese-moths-standard-guide-1-full-scan-audit.mjs',
);
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-1-full-scan-note-integrity-2026-07-12.json',
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
      JMSG1_FULL_SCAN_NOTES_PATH: notesPath,
      ...env,
    },
  },
);

const makeFixtureRows = () => [
  {
    record_id: 'note-unrelated', insect_id: 'species-unrelated', note_type: '生態情報',
    content: '無関係な確定本文。', reference: '別文献', page: '10', year: '',
  },
  ...audit.entries.map((entry) => ({
    record_id: entry.record_id,
    insect_id: entry.insect_id,
    note_type: entry.note_type,
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

test('production ledger covers the 1,485-row scan with 119 repairs and one cross-species deletion', () => {
  assert.equal(audit.audit_version, '2026-07-12-full-scan');
  assert.deepEqual(audit.note_types, ['生態情報', '出現時期']);
  assert.equal(audit.source_pdf.sha256, '35e3a46b1c91a6f16a6aff7522be708ed8a94ccfc8dc39d23c3d3e9171cfd0d9');
  assert.equal(audit.source_pdf.page_count, 115);
  assert.equal(audit.scope.reviewed_reference_rows, 1485);
  assert.equal(audit.scope.prior_ledger_entries_excluded, 31);
  assert.equal(audit.scope.candidate_entries, 120);
  assert.deepEqual(audit.scope.expected_actions, { replace: 119, delete: 1, hold: 0 });
  assert.deepEqual(audit.scope.candidate_reason_counts, {
    semantic_breakdown: 90,
    symbol_corruption: 9,
    field_bleed: 40,
    page_bleed: 1,
    broken_marker: 9,
  });
  assert.deepEqual(
    audit.scope.irrecoverable_entries.map((entry) => entry.record_id),
    ['note-1001307'],
  );
  assert.deepEqual(audit.scope.hold_entries, []);
  assert.match(audit.scope.content_policy.non_corruption_rule, /Inference and relative-frequency/);
  assert.equal(audit.entries.length, 120);
  assert.equal(audit.entries.filter((entry) => entry.action === 'replace').length, 119);
  assert.equal(audit.entries.filter((entry) => entry.action === 'delete').length, 1);
  assert.equal(audit.entries.filter((entry) => entry.note_type === '生態情報').length, 101);
  assert.equal(audit.entries.filter((entry) => entry.note_type === '出現時期').length, 19);
  assert.equal(new Set(audit.entries.map((entry) => entry.audit_id)).size, 120);
  assert.equal(new Set(audit.entries.map((entry) => entry.record_id)).size, 120);
  for (const entry of audit.entries) {
    assert.ok(entry.expected_content, entry.audit_id);
    assert.equal(entry.expected_page, '', entry.audit_id);
    assert.ok(entry.source_location.pdf_pages.length > 0, entry.audit_id);
    assert.ok(entry.source_location.printed_pages.length > 0, entry.audit_id);
    assert.ok(entry.source_location.columns.length > 0, entry.audit_id);
    assert.ok(entry.candidate_reasons.length > 0, entry.audit_id);
    assert.ok(entry.decision, entry.audit_id);
    if (entry.action === 'replace') {
      assert.ok(entry.approved_content, entry.audit_id);
      assert.notEqual(entry.approved_content, entry.expected_content, entry.audit_id);
      assert.ok(entry.approved_page, entry.audit_id);
      assert.deepEqual(collectGeneralNoteIssues({
        note_type: entry.note_type,
        content: entry.approved_content,
        page: entry.approved_page,
      }), [], entry.audit_id);
    } else {
      assert.equal(entry.approved_content, '', entry.audit_id);
      assert.equal(entry.approved_page, '', entry.audit_id);
      assert.ok(entry.intermediate_content, entry.audit_id);
      assert.ok(entry.intermediate_page, entry.audit_id);
    }
  }
});

test('apply repairs 119 notes, deletes the cross-species row and is byte-idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-full-scan-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"pending_replacements": 119/);
  assert.match(first.stdout, /"pending_deletions": 1/);
  const firstBytes = fs.readFileSync(notesPath);
  assert.equal(firstBytes.subarray(0, 3).toString('hex'), 'efbbbf');
  const rows = Papa.parse(firstBytes.toString('utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const byId = new Map(rows.map((row) => [row.record_id, row]));
  assert.equal(byId.get('note-unrelated').content, '無関係な確定本文。');
  for (const entry of audit.entries) {
    if (entry.action === 'delete') {
      assert.equal(byId.has(entry.record_id), false, entry.audit_id);
    } else {
      assert.equal(byId.get(entry.record_id)?.content, entry.approved_content, entry.audit_id);
      assert.equal(byId.get(entry.record_id)?.page, entry.approved_page, entry.audit_id);
      assert.equal(byId.get(entry.record_id)?.note_type, entry.note_type, entry.audit_id);
    }
  }

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /"pending_replacements": 0/);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('--check validates the hypothetical result without changing bytes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-full-check-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"reviewed_reference_rows": 1485/);
  assert.match(result.stdout, /"pending_replacements": 119/);
  assert.match(result.stdout, /"pending_deletions": 1/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('unexpected late-row content aborts before any write', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-full-fail-'));
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

test('mixed approved content and legacy page is refused', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-full-mixed-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const target = audit.entries[0];
  rows.find((row) => row.record_id === target.record_id).content = target.approved_content;
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('source PDF hash mismatch fails closed before writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-full-pdf-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const pdfPath = path.join(directory, '日本産蛾類標準図鑑1 2.pdf');
  writeNotes(notesPath, makeFixtureRows());
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, { env: { JMSG1_FULL_SCAN_PDF_PATH: pdfPath } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('tampered ledger cannot be forced through production mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-full-ledger-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const auditPath = path.join(directory, 'audit.json');
  writeNotes(notesPath, makeFixtureRows());
  const tampered = structuredClone(audit);
  tampered.entries[0].decision += ' tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, {
    env: {
      JMSG1_FULL_SCAN_AUDIT_PATH: auditPath,
      JMSG1_FULL_SCAN_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
