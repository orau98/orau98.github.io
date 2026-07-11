import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'apply-kiriga-emergence-audit.mjs');
const AUDIT_PATH = path.join(ROOT, 'data', 'source_audits', 'japan-winter-noctuid-emergence.csv');
const COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

const read = (filePath) => Papa.parse(
  fs.readFileSync(filePath, 'utf-8').replace(/\r\n|\r|\n/g, '\n'),
  { header: true, skipEmptyLines: true },
).data;

const replacedRecordIds = (audit) => (audit.replaced_record_ids || '')
  .split(';')
  .map((value) => value.trim())
  .filter(Boolean);

const legacyRows = (auditRows) => auditRows.flatMap((audit) => replacedRecordIds(audit)
  .map((recordId) => ({
    record_id: recordId,
    insect_id: audit.insect_id,
    note_type: '出現時期',
    content: recordId.startsWith('note-000')
      ? (audit.previous_canonical_content || '旧canonical')
      : (audit.legacy_content || '旧legacy'),
    reference: recordId.startsWith('note-000') ? '日本の冬夜蛾' : '日本のキリガ',
    page: '',
    year: '',
  })));

const appliedRow = (audit) => ({
  record_id: `note-${audit.audit_id}`,
  insect_id: audit.insect_id,
  note_type: '出現時期',
  content: audit.approved_content,
  reference: '日本の冬夜蛾',
  page: audit.printed_page,
  year: '',
});

const writeRows = (notesPath, rows) => fs.writeFileSync(
  notesPath,
  `${Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' })}\r\n`,
);

const runApply = (notesPath, { args = [], env = {} } = {}) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: ROOT,
  encoding: 'utf-8',
  env: {
    ...process.env,
    KIRIGA_EMERGENCE_NOTES_PATH: notesPath,
    KIRIGA_EMERGENCE_AUDIT_PATH: AUDIT_PATH,
    ...env,
  },
});

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

test('winter-noctuid emergence audit replaces every legacy/canonical row with 103 PDF-approved rows', () => {
  const auditRows = read(AUDIT_PATH);
  assert.equal(auditRows.length, 103);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-emergence-audit-'));
  const notesPath = path.join(tmp, 'general_notes.csv');
  const sourceRows = legacyRows(auditRows);
  sourceRows.push({ record_id: 'note-unrelated', insect_id: 'species-other', note_type: '生態情報', content: '保持', reference: '別出典', page: '', year: '' });
  writeRows(notesPath, sourceRows);

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstBytes = fs.readFileSync(notesPath);
  const rows = read(notesPath);
  const emergence = rows.filter((row) => row.reference === '日本の冬夜蛾' && row.note_type === '出現時期');
  assert.equal(emergence.length, 103);
  assert.equal(rows.some((row) => row.reference === '日本のキリガ' && row.note_type === '出現時期'), false);
  assert.equal(rows.find((row) => row.insect_id === 'species-5794').content, '11月下旬〜翌年1月');
  assert.equal(rows.find((row) => row.insect_id === 'species-6026').content, '10月頃羽化〜翌年5月');
  assert.equal(rows.find((row) => row.insect_id === 'species-6031').content, '10月羽化〜翌年5月');
  assert.equal(rows.find((row) => row.insect_id === 'species-6027').content, '10月羽化〜翌年5月');
  assert.equal(rows.find((row) => row.record_id === 'note-unrelated').content, '保持');

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('an applied row may coexist with one lingering legacy row from the same audit and remains idempotent', () => {
  const auditRows = read(AUDIT_PATH);
  const partialAudit = auditRows.find((audit) => replacedRecordIds(audit).length > 1);
  assert.ok(partialAudit);
  const expectedLegacyIds = replacedRecordIds(partialAudit);
  const rows = legacyRows(auditRows)
    .filter((row) => row.insect_id !== partialAudit.insect_id || row.record_id === expectedLegacyIds[0]);
  rows.push(appliedRow(partialAudit));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-emergence-partial-'));
  const notesPath = path.join(tmp, 'general_notes.csv');
  writeRows(notesPath, rows);

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstBytes = fs.readFileSync(notesPath);
  const output = read(notesPath);
  assert.equal(output.filter((row) => row.record_id === `note-${partialAudit.audit_id}`).length, 1);
  assert.equal(output.some((row) => expectedLegacyIds.includes(row.record_id)), false);
  assert.equal(output.filter((row) => row.reference === '日本の冬夜蛾' && row.note_type === '出現時期').length, 103);

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('an applied audit row does not mask a missing replacement row from another audit and late failure does not write', () => {
  const auditRows = read(AUDIT_PATH);
  const appliedAudit = auditRows.find((audit) => replacedRecordIds(audit).length > 0);
  const missingAudit = auditRows.findLast((audit) => replacedRecordIds(audit).length > 0);
  assert.ok(appliedAudit);
  assert.ok(missingAudit);
  assert.notEqual(appliedAudit.insect_id, missingAudit.insect_id);
  const missingRecordId = replacedRecordIds(missingAudit).at(-1);
  const rows = legacyRows(auditRows).filter((row) => (
    row.insect_id !== appliedAudit.insect_id && row.record_id !== missingRecordId
  ));
  rows.push(appliedRow(appliedAudit));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-emergence-late-fail-'));
  const notesPath = path.join(tmp, 'general_notes.csv');
  writeRows(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`Expected replacement row is missing: ${missingRecordId}`));
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('--check validates the full transformation without writing', () => {
  const auditRows = read(AUDIT_PATH);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-emergence-check-'));
  const notesPath = path.join(tmp, 'general_notes.csv');
  writeRows(notesPath, legacyRows(auditRows));
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /check_only=true/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('same-count production-ledger tampering is rejected without writing notes', () => {
  const auditRows = read(AUDIT_PATH);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-emergence-ledger-'));
  const notesPath = path.join(tmp, 'general_notes.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  writeRows(notesPath, legacyRows(auditRows));
  const tampered = auditRows.map((row) => ({ ...row }));
  tampered[0].approved_content += '改変';
  fs.writeFileSync(auditPath, `${Papa.unparse(tampered, { columns: Object.keys(tampered[0]), newline: '\n' })}\n`);
  const before = sha256(notesPath);
  const result = runApply(notesPath, {
    env: {
      KIRIGA_EMERGENCE_AUDIT_PATH: auditPath,
      KIRIGA_EMERGENCE_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production emergence audit SHA-256 mismatch/);
  assert.equal(sha256(notesPath), before);
});

test('an unrelated row cannot occupy an approved record ID', () => {
  const auditRows = read(AUDIT_PATH);
  const target = auditRows[0];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-emergence-id-collision-'));
  const notesPath = path.join(tmp, 'general_notes.csv');
  const rows = legacyRows(auditRows);
  rows.push({
    record_id: `note-${target.audit_id}`, insect_id: 'species-unrelated', note_type: '生態情報',
    content: '別レコード', reference: '別出典', page: '', year: '',
  });
  writeRows(notesPath, rows);
  const before = sha256(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Approved record_id is occupied/);
  assert.equal(sha256(notesPath), before);
});
