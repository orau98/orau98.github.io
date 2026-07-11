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
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-general-note-quality-hold-cleanup.mjs');
const COLUMNS = [
  'audit_id', 'record_id', 'insect_id', 'note_type', 'reference', 'action',
  'expected_content', 'transitional_content', 'approved_content', 'source_status',
  'evidence', 'decision', 'reviewed_on',
];

const runApply = (notesPath, auditPath) => spawnSync(process.execPath, [APPLY_SCRIPT], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    GENERAL_NOTE_QUALITY_NOTES_PATH: notesPath,
    GENERAL_NOTE_QUALITY_AUDIT_PATH: auditPath,
  },
});

const writeAudit = (filePath, rows) => fs.writeFileSync(
  filePath,
  `${Papa.unparse(rows.map((row) => ({
    note_type: '生態情報',
    source_status: 'source_pdf_not_locally_available',
    evidence: 'fixture',
    decision: 'fixture',
    reviewed_on: '2026-07-12',
    ...row,
  })), { columns: COLUMNS, newline: '\n' })}\n`,
);

test('hold cleanup deletes corrupt OCR and replaces subjective prose idempotently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'general-note-quality-hold-'));
  const notesPath = path.join(dir, 'general_notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(notesPath, [
    'record_id,insect_id,note_type,content,reference,page,year',
    'note-delete,species-a,生態情報,途中で切れたOCR,出典A,,',
    'note-replace,species-b,生態情報,♀は非常に美しい。,出典B,,',
    '',
  ].join('\r\n'));
  writeAudit(auditPath, [
    {
      audit_id: 'fixture-delete', record_id: 'note-delete', insect_id: 'species-a',
      reference: '出典A', action: 'delete', expected_content: '途中で切れたOCR',
    },
    {
      audit_id: 'fixture-replace', record_id: 'note-replace', insect_id: 'species-b',
      reference: '出典B', action: 'replace', expected_content: '♀は非常に美しい。',
      approved_content: '♀は緑色である。',
    },
  ]);

  const first = runApply(notesPath, auditPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstBytes = fs.readFileSync(notesPath);
  const rows = Papa.parse(firstBytes.toString('utf8'), { header: true, skipEmptyLines: true }).data;
  assert.equal(rows.some((row) => row.record_id === 'note-delete'), false);
  assert.equal(rows.find((row) => row.record_id === 'note-replace').content, '♀は緑色である。');

  const second = runApply(notesPath, auditPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('hold cleanup refuses an unexpected replacement without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'general-note-quality-hold-fail-'));
  const notesPath = path.join(dir, 'general_notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\nnote-a,species-a,生態情報,別の確定本文,出典A,,\r\n',
  );
  writeAudit(auditPath, [{
    audit_id: 'fixture-replace', record_id: 'note-a', insect_id: 'species-a',
    reference: '出典A', action: 'replace', expected_content: '古い本文',
    approved_content: '承認本文',
  }]);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, auditPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement content/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('hold cleanup includes note_type in target identity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'general-note-quality-hold-type-'));
  const notesPath = path.join(dir, 'general_notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\nnote-a,species-a,生態情報,古い本文,出典A,,\r\n',
  );
  writeAudit(auditPath, [{
    audit_id: 'fixture-type', record_id: 'note-a', insect_id: 'species-a',
    note_type: '出現時期', reference: '出典A', action: 'replace',
    expected_content: '古い本文', approved_content: '承認本文',
  }]);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, auditPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Target identity mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('production enforcement rejects a same-count substituted ledger', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'general-note-quality-hold-sha-'));
  const notesPath = path.join(dir, 'general_notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\n',
  );
  const productionAudit = fs.readFileSync(path.join(
    ROOT,
    'data/source_audits/general-note-quality-hold-cleanup-2026-07-12.csv',
  ), 'utf8');
  fs.writeFileSync(auditPath, productionAudit.replace('note-1005215', 'note-substitute'));
  const result = spawnSync(process.execPath, [APPLY_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      GENERAL_NOTE_QUALITY_NOTES_PATH: notesPath,
      GENERAL_NOTE_QUALITY_AUDIT_PATH: auditPath,
      GENERAL_NOTE_QUALITY_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
});

test('production hold ledger keeps unverified OCR out without pretending PDF review', (t) => {
  const audit = Papa.parse(
    fs.readFileSync(path.join(
      ROOT,
      'data/source_audits/general-note-quality-hold-cleanup-2026-07-12.csv',
    ), 'utf8'),
    { header: true, skipEmptyLines: true },
  ).data;
  assert.equal(audit.length, 5);
  assert.equal(audit.filter((row) => row.action === 'delete').length, 2);
  assert.equal(audit.filter((row) => row.action === 'replace').length, 3);
  assert.ok(audit.every((row) => row.source_status === 'source_pdf_not_locally_available'));

  const live = Papa.parse(
    fs.readFileSync(path.join(ROOT, 'normalized_data/general_notes.csv'), 'utf8'),
    { header: true, skipEmptyLines: true },
  ).data;
  const liveById = new Map(live.map((row) => [row.record_id, row]));
  const laterHamakiga3Audit = JSON.parse(fs.readFileSync(path.join(
    ROOT,
    'data/source_audits/japanese-tortricid-moths-3-general-note-all-rows-2026-07-12.json',
  ), 'utf8'));
  const laterById = new Map(laterHamakiga3Audit.rows.map((row) => [row.record_id, row]));
  for (const row of audit) {
    const later = laterById.get(row.record_id);
    const finalAction = later?.action || row.action;
    if (finalAction === 'delete' || finalAction === 'delete_note') {
      assert.equal(liveById.has(row.record_id), false, row.record_id);
    } else {
      assert.equal(
        liveById.get(row.record_id)?.content,
        later?.approved_content || row.approved_content,
        row.record_id,
      );
    }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'general-note-quality-final-state-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const notesPath = path.join(dir, 'general_notes.csv');
  fs.copyFileSync(path.join(ROOT, 'normalized_data/general_notes.csv'), notesPath);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, path.join(
    ROOT,
    'data/source_audits/general-note-quality-hold-cleanup-2026-07-12.csv',
  ));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"superseded": 1/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
