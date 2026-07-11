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

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-standard-guide3-note-integrity-audit.mjs');
const NOTES_PATH = path.join(ROOT, 'normalized_data', 'general_notes.csv');
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-3-general-note-integrity-2026-07-12.json',
);
const ALL_ROWS_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-3-general-note-all-rows-2026-07-12.csv',
);
const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
const audit = JSON.parse(rawAudit);
const reviewedRows = Papa.parse(
  fs.readFileSync(ALL_ROWS_PATH, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;
const COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

const makeFixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-guide3-note-audit-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = Papa.parse(
    fs.readFileSync(NOTES_PATH, 'utf8').replace(/^\ufeff/, ''),
    { header: true, skipEmptyLines: true },
  ).data;
  const byId = new Map(rows.map(row => [row.record_id, row]));
  for (const entry of audit.rows) {
    let row = byId.get(entry.record_id);
    if (!row) {
      row = {
        record_id: entry.record_id,
        insect_id: entry.insect_id,
        note_type: entry.note_type,
        content: entry.old_content,
        reference: entry.old_reference,
        page: entry.old_page,
        year: '',
      };
      rows.push(row);
      byId.set(row.record_id, row);
    } else {
      row.content = entry.old_content;
      row.reference = entry.old_reference;
      row.page = entry.old_page;
    }
  }
  fs.writeFileSync(
    notesPath,
    `\ufeff${Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' })}\r\n`,
  );
  return { directory, notesPath };
};

const parseNotes = filePath => Papa.parse(
  fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;

const writeNotes = (filePath, rows) => fs.writeFileSync(
  filePath,
  `\ufeff${Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' })}\r\n`,
);

const runApply = (notesPath, { args = [], env = {} } = {}) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      STANDARD_GUIDE3_AUDIT_NOTES_PATH: notesPath,
      ...env,
    },
  },
);

test('production ledger covers every reviewed row and pins source/scope evidence', () => {
  assert.equal(
    crypto.createHash('sha256').update(rawAudit).digest('hex'),
    '1e4e66fa14c78d22d9a51c6ddd888ec1cb22ca9827cbb8941751e3e59c384a30',
  );
  assert.equal(audit.source_pdf.sha256, '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850');
  assert.equal(audit.source_pdf.page_count, 138);
  assert.equal(audit.source_pdf.role, 'original_full_pdf_image_review');
  assert.deepEqual(audit.expected_profile, {
    action_rows: 263,
    update_note: 101,
    delete_note: 162,
    source_reference_mislabel_rows: 20,
    reviewed_rows: 1323,
  });
  assert.equal(audit.scan_scope.source_rows_before, 1303);
  assert.equal(audit.scan_scope.reviewed_rows, 1323);
  assert.equal(audit.scan_scope.source_rows_after, 1161);
  assert.equal(audit.rows.length, 263);
  assert.equal(new Set(audit.rows.map(row => row.audit_id)).size, 263);
  assert.equal(new Set(audit.rows.map(row => row.record_id)).size, 263);
  assert.equal(audit.rows.filter(row => row.old_reference === '日本産蝶類標準図鑑').length, 20);
  assert.equal(reviewedRows.length, 1323);
  assert.equal(new Set(reviewedRows.map(row => row.record_id)).size, 1323);
  assert.equal(reviewedRows.filter(row => row.review_decision === 'update_note').length, 101);
  assert.equal(reviewedRows.filter(row => row.review_decision === 'delete_note').length, 162);
  assert.equal(
    reviewedRows.filter(row => row.review_decision === 'retain_no_clear_ocr_semantic_collapse_field_spill_or_truncation').length,
    1060,
  );
  assert.ok(reviewedRows.every(row => row.source_scope && row.application_targets && row.scope_decision_reason));
  assert.match(audit.subspecies_sharing_rule.rule, /亜種名が明記されない種レベル記述/);
  assert.equal(audit.rows.filter(row => row.application_targets.length > 1).length, 0);
  for (const row of audit.rows) {
    assert.ok(row.pdf_page >= 1 && row.pdf_page <= 138, row.audit_id);
    assert.ok(row.printed_page >= 1, row.audit_id);
    assert.ok(row.evidence, row.audit_id);
    assert.ok(row.scope_decision_reason, row.audit_id);
    assert.deepEqual(row.application_targets, [row.insect_id], row.audit_id);
    assert.deepEqual(row.excluded_targets, [], row.audit_id);
    if (row.action === 'update_note') {
      assert.deepEqual(collectGeneralNoteIssues({
        note_type: row.note_type,
        content: row.approved_content,
        page: row.approved_page,
      }), [], row.audit_id);
    }
  }
});

test('--check validates the complete hypothetical result without writing', () => {
  const { notesPath } = makeFixture();
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.note_updated, 101);
  assert.equal(summary.note_deleted, 162);
  assert.equal(summary.source_rows_after, 1161);
  assert.equal(summary.would_change, true);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('apply performs exact updates/deletions and is byte-idempotent', () => {
  const { notesPath } = makeFixture();
  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstSummary = JSON.parse(first.stdout);
  assert.equal(firstSummary.note_updated, 101);
  assert.equal(firstSummary.note_deleted, 162);
  assert.equal(firstSummary.changed, true);
  const firstBytes = fs.readFileSync(notesPath);
  const byId = new Map(parseNotes(notesPath).map(row => [row.record_id, row]));
  for (const entry of audit.rows) {
    if (entry.action === 'delete_note') {
      assert.equal(byId.has(entry.record_id), false, entry.audit_id);
    } else {
      assert.equal(byId.get(entry.record_id)?.content, entry.approved_content, entry.audit_id);
      assert.equal(byId.get(entry.record_id)?.reference, '日本産蛾類標準図鑑3', entry.audit_id);
      assert.equal(byId.get(entry.record_id)?.page, entry.approved_page, entry.audit_id);
    }
  }

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const secondSummary = JSON.parse(second.stdout);
  assert.equal(secondSummary.note_updated, 0);
  assert.equal(secondSummary.note_deleted, 0);
  assert.equal(secondSummary.changed, false);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('tampered production ledger fails closed before any write', () => {
  const { directory, notesPath } = makeFixture();
  const auditPath = path.join(directory, 'audit.json');
  const tampered = structuredClone(audit);
  tampered.rows[0].decision += ' tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, { env: {
    STANDARD_GUIDE3_AUDIT_PATH: auditPath,
    STANDARD_GUIDE3_AUDIT_ENFORCE_PRODUCTION: '1',
  } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('missing or extra ledger rows are rejected before any write', () => {
  for (const change of ['missing', 'extra']) {
    const { directory, notesPath } = makeFixture();
    const auditPath = path.join(directory, `${change}.json`);
    const altered = structuredClone(audit);
    if (change === 'missing') altered.rows.pop();
    else altered.rows.push(structuredClone(altered.rows.at(-1)));
    fs.writeFileSync(auditPath, `${JSON.stringify(altered, null, 2)}\n`);
    const before = fs.readFileSync(notesPath);
    const result = runApply(notesPath, { env: { STANDARD_GUIDE3_AUDIT_PATH: auditPath } });
    assert.notEqual(result.status, 0, change);
    assert.match(result.stderr, /Expected 263 audit rows/, change);
    assert.deepEqual(fs.readFileSync(notesPath), before, change);
  }
});

test('changed target record ID is rejected without writing', () => {
  const { notesPath } = makeFixture();
  const rows = parseNotes(notesPath);
  const target = audit.rows.find(row => row.action === 'update_note');
  rows.find(row => row.record_id === target.record_id).record_id = `${target.record_id}-changed`;
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Target record_id changed/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('unexpected late target state is rejected without writing', () => {
  const { notesPath } = makeFixture();
  const rows = parseNotes(notesPath);
  const target = audit.rows.at(-1);
  rows.find(row => row.record_id === target.record_id).content = '別の本文。';
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected (update|delete) state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('partially applied state is rejected without writing', () => {
  const { notesPath } = makeFixture();
  const rows = parseNotes(notesPath);
  const target = audit.rows.find(row => row.action === 'update_note');
  const row = rows.find(candidate => candidate.record_id === target.record_id);
  row.content = target.approved_content;
  row.reference = target.approved_reference;
  row.page = target.approved_page;
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Partial audit state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('retained-row drift is caught by the complete population hash', () => {
  const { notesPath } = makeFixture();
  const rows = parseNotes(notesPath);
  const actionIds = new Set(audit.rows.map(row => row.record_id));
  const retained = rows.find(row => row.reference === '日本産蛾類標準図鑑3' && !actionIds.has(row.record_id));
  retained.content += '改変';
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Reviewed population SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('wrong source PDF hash fails closed before writing', () => {
  const { directory, notesPath } = makeFixture();
  const pdfPath = path.join(directory, 'wrong.pdf');
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, { env: { STANDARD_GUIDE3_AUDIT_PDF_PATH: pdfPath } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
