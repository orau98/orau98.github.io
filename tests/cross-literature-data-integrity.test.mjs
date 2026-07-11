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
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-cross-literature-data-integrity.mjs');

const hostHeader = 'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\n';
const auditColumns = ['audit_id', 'entity', 'record_id', 'insect_id', 'action', 'field', 'approved_value', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes', 'source_pdf_file', 'source_pdf_sha256', 'pdf_page', 'printed_page', 'evidence', 'decision', 'reviewed_on'];

const writeAudit = (auditPath, rows) => fs.writeFileSync(
  auditPath,
  `${Papa.unparse(rows, { columns: auditColumns, newline: '\n' })}\n`,
);

const runApply = (hostPath, auditPath) => spawnSync(process.execPath, [APPLY_SCRIPT], {
  cwd: ROOT,
  encoding: 'utf-8',
  env: {
    ...process.env,
    LITERATURE_INTEGRITY_HOSTPLANTS_PATH: hostPath,
    LITERATURE_INTEGRITY_AUDIT_PATH: auditPath,
  },
});

test('cross-literature audit updates, deletes and adds rows idempotently', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-literature-integrity-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(
    hostPath,
    `${hostHeader}host-1,species-a,植物A,科A,,,,,\r\nhost-2,species-b,OCR断片,,文献,,幼虫,日本産蛾類標準図鑑3,\r\n`,
  );
  writeAudit(auditPath, [
    { audit_id: 'a1', entity: 'hostplant', record_id: 'host-1', insect_id: 'species-a', action: 'update_field', field: 'reference', approved_value: '出典A', reference: '出典A', evidence: 'batch context', decision: 'include', reviewed_on: '2026-07-11' },
    { audit_id: 'a2', entity: 'hostplant', record_id: 'host-2', insect_id: 'species-b', action: 'delete', reference: '日本産蛾類標準図鑑3', source_pdf_file: 'book.pdf', source_pdf_sha256: 'abc', pdf_page: '1', printed_page: '1', evidence: 'PDF checked', decision: 'exclude_ocr_fragment', reviewed_on: '2026-07-11' },
    { audit_id: 'a3', entity: 'hostplant', record_id: 'host-3', insect_id: 'species-b', action: 'add', plant_name: '植物B', plant_family: '科B', observation_type: '野外（国外）', life_stage: '幼虫', reference: '日本産蛾類標準図鑑3', notes: '国外記録', source_pdf_file: 'book.pdf', source_pdf_sha256: 'abc', pdf_page: '1', printed_page: '1', evidence: 'PDF checked', decision: 'include', reviewed_on: '2026-07-11' },
  ]);

  const first = runApply(hostPath, auditPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstBytes = fs.readFileSync(hostPath);
  const rows = Papa.parse(firstBytes.toString('utf-8'), { header: true, skipEmptyLines: true }).data;
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.record_id === 'host-1').reference, '出典A');
  assert.equal(rows.some((row) => row.record_id === 'host-2'), false);
  assert.deepEqual(rows.find((row) => row.record_id === 'host-3'), {
    record_id: 'host-3',
    insect_id: 'species-b',
    plant_name: '植物B',
    plant_family: '科B',
    observation_type: '野外（国外）',
    plant_part: '',
    life_stage: '幼虫',
    reference: '日本産蛾類標準図鑑3',
    notes: '国外記録',
  });

  const second = runApply(hostPath, auditPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(hostPath), firstBytes);
});

test('cross-literature audit rejects an insect mismatch', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-literature-integrity-mismatch-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(hostPath, `${hostHeader}host-1,species-a,植物A,科A,,,,,\r\n`);
  writeAudit(auditPath, [
    { audit_id: 'a1', entity: 'hostplant', record_id: 'host-1', insect_id: 'species-other', action: 'update_field', field: 'reference', approved_value: '出典A', reference: '出典A', evidence: 'batch context', decision: 'include', reviewed_on: '2026-07-11' },
  ]);

  const result = runApply(hostPath, auditPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /insect_id mismatch/);
});

test('cross-literature audit refuses to overwrite a later nonblank correction', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-literature-integrity-value-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(hostPath, `${hostHeader}host-1,species-a,植物A,科A,,,,別の確定出典,\r\n`);
  writeAudit(auditPath, [
    { audit_id: 'a1', entity: 'hostplant', record_id: 'host-1', insect_id: 'species-a', action: 'update_field', field: 'reference', approved_value: '出典A', reference: '出典A', evidence: 'batch context', decision: 'include', reviewed_on: '2026-07-11' },
  ]);

  const before = fs.readFileSync(hostPath);
  const result = runApply(hostPath, auditPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected existing value/);
  assert.deepEqual(fs.readFileSync(hostPath), before);
});

test('a provenance fill retired by a later full-source audit is a no-op even after deletion', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-literature-integrity-retired-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(hostPath, hostHeader);
  writeAudit(auditPath, [
    {
      audit_id: 'a-retired',
      entity: 'hostplant',
      record_id: 'host-removed-by-later-audit',
      insect_id: 'species-a',
      action: 'retire',
      field: 'reference',
      approved_value: '旧補完出典',
      reference: '旧補完出典',
      evidence: 'later full-source audit removed the semantic duplicate',
      decision: 'retired_by_later_full_source_audit',
      reviewed_on: '2026-07-11',
    },
  ]);

  const before = fs.readFileSync(hostPath);
  const result = runApply(hostPath, auditPath);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readFileSync(hostPath), before);
});
