import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const APPLY = path.join(ROOT, 'scripts', 'apply-japanese-winter-geometrid-note-audit.mjs');
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-winter-geometrid-all-notes-audit-2026-07-12.json',
);
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));

const oldNotesCsv = () => `${Papa.unparse(audit.rows.map(row => ({
  record_id: row.record_id,
  insect_id: row.insect_id,
  note_type: row.note_type,
  content: row.old_content,
  reference: audit.reference,
  page: row.old_page,
  year: '',
})), { newline: '\r\n' })}\r\n`;

const runApply = (notesPath, args = [], extraEnv = {}) => spawnSync(
  process.execPath,
  [APPLY, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      WINTER_GEOMETRID_NOTE_AUDIT_NOTES_PATH: notesPath,
      ...extraEnv,
    },
  },
);

test('all 70 winter-geometrid notes are restored or verified with page provenance idempotently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winter-geometrid-audit-'));
  const notesPath = path.join(dir, 'notes.csv');
  fs.writeFileSync(notesPath, oldNotesCsv());

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"content_replaced": 9/);
  assert.match(first.stdout, /"page_added": 70/);
  const afterFirst = fs.readFileSync(notesPath);
  const rows = Papa.parse(afterFirst.toString('utf8'), { header: true, skipEmptyLines: true }).data;
  assert.equal(rows.length, 70);
  const byTarget = new Map(rows.map(row => [[row.insect_id, row.note_type].join('\u0000'), row]));
  for (const expected of audit.rows) {
    const actual = byTarget.get([expected.insect_id, expected.note_type].join('\u0000'));
    assert.equal(actual?.content, expected.approved_content, expected.audit_id);
    assert.equal(actual?.page, expected.approved_page, expected.audit_id);
  }

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /"changed": 0/);
  assert.deepEqual(fs.readFileSync(notesPath), afterFirst);
});

test('check mode reports the 70 pending rows without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winter-geometrid-check-'));
  const notesPath = path.join(dir, 'notes.csv');
  fs.writeFileSync(notesPath, oldNotesCsv());
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, ['--check']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"changed": 70/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('an unexpected source note fails before any write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winter-geometrid-fail-'));
  const notesPath = path.join(dir, 'notes.csv');
  const source = oldNotesCsv().replace(audit.rows[0].old_content, '別の確定本文');
  fs.writeFileSync(notesPath, source);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected one target/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('production enforcement rejects a substituted same-count ledger', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winter-geometrid-sha-'));
  const notesPath = path.join(dir, 'notes.csv');
  const alteredAuditPath = path.join(dir, 'audit.json');
  fs.writeFileSync(notesPath, oldNotesCsv());
  fs.writeFileSync(alteredAuditPath, fs.readFileSync(AUDIT_PATH, 'utf8')
    .replace('note-000567', 'note-substitute'));
  const result = runApply(notesPath, [], {
    WINTER_GEOMETRID_NOTE_AUDIT_PATH: alteredAuditPath,
    WINTER_GEOMETRID_NOTE_AUDIT_ENFORCE_PRODUCTION: '1',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
});

test('optional PDF verification rejects the wrong source bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winter-geometrid-pdf-'));
  const notesPath = path.join(dir, 'notes.csv');
  const pdfPath = path.join(dir, 'source.pdf');
  fs.writeFileSync(notesPath, oldNotesCsv());
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const result = runApply(notesPath, ['--check'], {
    WINTER_GEOMETRID_NOTE_AUDIT_PDF_PATH: pdfPath,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
});

test('production dataset is entirely in a pending or applied audited state', () => {
  const result = spawnSync(process.execPath, [APPLY, '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"audit_rows": 70/);
});
