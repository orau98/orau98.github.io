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
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-tamamushi-literature-audit.mjs');
const REPAIR_SCRIPT = path.join(ROOT, 'scripts', 'repair-literature-record-integrity.mjs');
const PDF_SHA256 = '7893e51f670e7a42e6d3df3bb5b224f7ef547112e6e7cdb1954b1f254a673415';
const AUDIT_COLUMNS = [
  'audit_id', 'entity', 'action', 'record_ids', 'insect_id', 'note_type',
  'match_content', 'field', 'expected_value', 'approved_value', 'plant_name',
  'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference',
  'notes', 'source_pdf_file', 'source_pdf_sha256', 'pdf_page', 'printed_page',
  'evidence', 'decision', 'reviewed_on', 'note_page', 'note_year',
];

const parse = (filePath) => Papa.parse(
  fs.readFileSync(filePath, 'utf-8'),
  { header: true, skipEmptyLines: true },
).data;

const writeAudit = (filePath, rows) => fs.writeFileSync(
  filePath,
  `${Papa.unparse(rows.map((row) => ({
    reference: '日本産タマムシ大図鑑',
    source_pdf_file: '日本産タマムシ大図鑑.pdf',
    source_pdf_sha256: PDF_SHA256,
    pdf_page: '1',
    printed_page: '1-2',
    evidence: 'fixture',
    decision: 'fixture',
    reviewed_on: '2026-07-11',
    ...row,
  })), { columns: AUDIT_COLUMNS, newline: '\n' })}\n`,
);

const runApply = ({ hostPath, notesPath, auditPath }) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT],
  {
    cwd: ROOT,
    encoding: 'utf-8',
    env: {
      ...process.env,
      TAMAMUSHI_AUDIT_HOSTPLANTS_PATH: hostPath,
      TAMAMUSHI_AUDIT_NOTES_PATH: notesPath,
      TAMAMUSHI_AUDIT_PATH: auditPath,
    },
  },
);

const runRepair = ({ insectsPath, hostPath, notesPath }) => spawnSync(
  process.execPath,
  [REPAIR_SCRIPT],
  {
    cwd: ROOT,
    encoding: 'utf-8',
    env: {
      ...process.env,
      LITERATURE_RECORD_INSECTS_PATH: insectsPath,
      LITERATURE_RECORD_HOSTPLANTS_PATH: hostPath,
      LITERATURE_RECORD_NOTES_PATH: notesPath,
    },
  },
);

test('all Tamamushi action types survive note-ID recalculation and are idempotent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tamamushi-audit-actions-'));
  const insectsPath = path.join(tmp, 'insects.csv');
  const hostPath = path.join(tmp, 'hostplants.csv');
  const notesPath = path.join(tmp, 'general_notes.csv');
  const auditPath = path.join(tmp, 'audit.csv');

  fs.writeFileSync(
    insectsPath,
    'insect_id,notes\r\nspecies-a,食草・生態情報は未入力。\r\nspecies-b,\r\n',
  );
  fs.writeFileSync(
    hostPath,
    [
      'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes',
      'host-delete,species-a,誤植物,,,,,日本産タマムシ大図鑑,',
      'host-update,species-a,植物A,科A,,,,日本産タマムシ大図鑑,',
      'host-upsert-existing,species-a,シデ,,,,,日本産タマムシ大図鑑,',
      '',
    ].join('\r\n'),
  );
  fs.writeFileSync(
    notesPath,
    [
      'record_id,insect_id,note_type,content,reference,page,year',
      'note-delete,species-a,生態情報,短い重複,日本産タマムシ大図鑑,,',
      'note-replace,species-a,生態情報,置換前,日本産タマムシ大図鑑,,',
      'note-replace-transition,species-a,生態情報,置換途中,日本産タマムシ大図鑑,,',
      'note-move,species-a,生態情報,移動本文,日本産タマムシ大図鑑,,',
      '',
    ].join('\r\n'),
  );
  writeAudit(auditPath, [
    { audit_id: 'T-DELETE-HOST', entity: 'hostplant', action: 'delete_host_records', record_ids: 'host-delete', insect_id: 'species-a' },
    { audit_id: 'T-UPDATE-HOST', entity: 'hostplant', action: 'update_host_field', record_ids: 'host-update', insect_id: 'species-a', field: 'observation_type', expected_value: '', approved_value: '後食' },
    { audit_id: 'T-UPSERT-HOST-EXISTING', entity: 'hostplant', action: 'upsert_host_relation', record_ids: 'host-upsert-existing', insect_id: 'species-a', field: 'plant_name', expected_value: 'シデ', approved_value: 'シデ類', plant_name: 'シデ類', plant_family: 'カバノキ科' },
    { audit_id: 'T-UPSERT-HOST-MISSING', entity: 'hostplant', action: 'upsert_host_relation', record_ids: 'host-upsert-missing', insect_id: 'species-b', field: 'plant_name', expected_value: 'シデ', approved_value: 'シデ類', plant_name: 'シデ類', plant_family: 'カバノキ科' },
    { audit_id: 'T-ADD-HOST', entity: 'hostplant', action: 'add_host_relation', record_ids: 'host-add', insect_id: 'species-b', plant_name: '植物B', plant_family: '科B', observation_type: '後食', plant_part: '生葉', life_stage: '成虫', notes: '幼虫寄主ではない' },
    { audit_id: 'T-DELETE-NOTE', entity: 'general_note', action: 'delete_note_content', insect_id: 'species-a', note_type: '生態情報', match_content: '短い重複' },
    { audit_id: 'T-REPLACE-NOTE', entity: 'general_note', action: 'replace_note_content', insect_id: 'species-a', note_type: '生態情報', match_content: '置換前', approved_value: '置換後' },
    { audit_id: 'T-REPLACE-TRANSITION', entity: 'general_note', action: 'replace_note_content', insect_id: 'species-a', note_type: '生態情報', match_content: '置換前の原文', expected_value: '置換途中', approved_value: '置換後の客観文' },
    { audit_id: 'T-MOVE-NOTE', entity: 'general_note', action: 'move_note_insect', insect_id: 'species-a', note_type: '生態情報', match_content: '移動本文', approved_value: 'species-b', notes: '移動後の客観文' },
    { audit_id: 'T-ADD-NOTE', entity: 'general_note', action: 'add_note', record_ids: 'note-provisional', insect_id: 'species-b', note_type: '生態情報', approved_value: '追加本文' },
  ]);

  const firstApply = runApply({ hostPath, notesPath, auditPath });
  assert.equal(firstApply.status, 0, firstApply.stderr || firstApply.stdout);
  assert.match(firstApply.stdout, /host_deleted=1/);
  assert.match(firstApply.stdout, /host_updated=2/);
  assert.match(firstApply.stdout, /host_added=2/);
  assert.match(firstApply.stdout, /note_deleted=1/);
  assert.match(firstApply.stdout, /note_updated=2/);
  assert.match(firstApply.stdout, /note_moved=1/);
  assert.match(firstApply.stdout, /note_added=1/);

  const hosts = parse(hostPath);
  assert.equal(hosts.some((row) => row.record_id === 'host-delete'), false);
  assert.equal(hosts.find((row) => row.record_id === 'host-update').observation_type, '後食');
  assert.equal(hosts.find((row) => row.record_id === 'host-upsert-existing').plant_name, 'シデ類');
  assert.equal(hosts.find((row) => row.record_id === 'host-upsert-existing').plant_family, 'カバノキ科');
  assert.equal(hosts.find((row) => row.record_id === 'host-upsert-missing').plant_name, 'シデ類');
  assert.deepEqual(hosts.find((row) => row.record_id === 'host-add'), {
    record_id: 'host-add',
    insect_id: 'species-b',
    plant_name: '植物B',
    plant_family: '科B',
    observation_type: '後食',
    plant_part: '生葉',
    life_stage: '成虫',
    reference: '日本産タマムシ大図鑑',
    notes: '幼虫寄主ではない',
  });
  const notesAfterApply = parse(notesPath);
  assert.equal(notesAfterApply.some((row) => row.content === '短い重複'), false);
  assert.equal(notesAfterApply.find((row) => row.content === '置換後').insect_id, 'species-a');
  assert.equal(notesAfterApply.find((row) => row.content === '置換後の客観文').insect_id, 'species-a');
  assert.equal(notesAfterApply.find((row) => row.content === '移動後の客観文').insect_id, 'species-b');
  assert.equal(notesAfterApply.some((row) => row.content === '移動本文'), false);
  assert.equal(notesAfterApply.find((row) => row.content === '追加本文').insect_id, 'species-b');

  const firstRepair = runRepair({ insectsPath, hostPath, notesPath });
  assert.equal(firstRepair.status, 0, firstRepair.stderr || firstRepair.stdout);
  const repairedNotes = parse(notesPath);
  assert.match(repairedNotes.find((row) => row.content === '置換後').record_id, /^note-tamamushi-a-ecology-[0-9a-f]{12}$/);
  assert.match(repairedNotes.find((row) => row.content === '移動後の客観文').record_id, /^note-tamamushi-b-ecology-[0-9a-f]{12}$/);
  assert.match(repairedNotes.find((row) => row.content === '追加本文').record_id, /^note-tamamushi-b-ecology-[0-9a-f]{12}$/);
  const firstBytes = [hostPath, notesPath, insectsPath].map((filePath) => fs.readFileSync(filePath));

  const secondApply = runApply({ hostPath, notesPath, auditPath });
  assert.equal(secondApply.status, 0, secondApply.stderr || secondApply.stdout);
  const secondRepair = runRepair({ insectsPath, hostPath, notesPath });
  assert.equal(secondRepair.status, 0, secondRepair.stderr || secondRepair.stdout);
  [hostPath, notesPath, insectsPath].forEach((filePath, index) => {
    assert.deepEqual(fs.readFileSync(filePath), firstBytes[index]);
  });
});

test('grouped host deletion fails closed when only part of the audited group remains', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tamamushi-audit-partial-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const notesPath = path.join(tmp, 'general_notes.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(
    hostPath,
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\nhost-one,species-a,植物A,,,,,日本産タマムシ大図鑑,\r\n',
  );
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\n',
  );
  writeAudit(auditPath, [
    { audit_id: 'T-PARTIAL', entity: 'hostplant', action: 'delete_host_records', record_ids: 'host-one; host-missing', insect_id: 'species-a' },
  ]);

  const result = runApply({ hostPath, notesPath, auditPath });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Partial delete state/);
  assert.equal(parse(hostPath).length, 1);
});

test('audit rows cannot substitute a different 64-hex source hash', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tamamushi-audit-hash-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const notesPath = path.join(tmp, 'general_notes.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(
    hostPath,
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\n',
  );
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\n',
  );
  writeAudit(auditPath, [
    { audit_id: 'T-HASH', entity: 'general_note', action: 'add_note', record_ids: 'note-a', insect_id: 'species-a', note_type: '生態情報', approved_value: '本文', source_pdf_sha256: '0'.repeat(64) },
  ]);

  const result = runApply({ hostPath, notesPath, auditPath });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected source_pdf_sha256/);
});

test('production enforcement rejects a same-count substituted ledger', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tamamushi-audit-ledger-sha-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const notesPath = path.join(tmp, 'general_notes.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.writeFileSync(
    hostPath,
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\n',
  );
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\n',
  );
  const productionAudit = fs.readFileSync(path.join(
    ROOT,
    'data/source_audits/japanese-jewel-beetles-grand-atlas-integrity-2026-07-11.csv',
  ), 'utf8');
  fs.writeFileSync(auditPath, productionAudit.replace('BUP-FINAL-001', 'BUP-FINAL-X01'));
  const result = spawnSync(process.execPath, [APPLY_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      TAMAMUSHI_AUDIT_HOSTPLANTS_PATH: hostPath,
      TAMAMUSHI_AUDIT_NOTES_PATH: notesPath,
      TAMAMUSHI_AUDIT_PATH: auditPath,
      TAMAMUSHI_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
});

test('production actions are idempotent after content-based note-ID repair', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tamamushi-audit-repaired-live-'));
  const hostPath = path.join(tmp, 'hostplants.csv');
  const notesPath = path.join(tmp, 'general_notes.csv');
  const auditPath = path.join(tmp, 'audit.csv');
  fs.copyFileSync(path.join(ROOT, 'normalized_data/hostplants.csv'), hostPath);
  fs.copyFileSync(path.join(ROOT, 'normalized_data/general_notes.csv'), notesPath);
  fs.copyFileSync(path.join(
    ROOT,
    'data/source_audits/japanese-jewel-beetles-grand-atlas-integrity-2026-07-11.csv',
  ), auditPath);
  const before = [hostPath, notesPath].map(filePath => fs.readFileSync(filePath));
  const result = runApply({ hostPath, notesPath, auditPath });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /host_deleted=0/);
  assert.match(result.stdout, /host_updated=0/);
  assert.match(result.stdout, /host_added=0/);
  assert.match(result.stdout, /note_deleted=0/);
  assert.match(result.stdout, /note_updated=0/);
  assert.match(result.stdout, /note_moved=0/);
  assert.match(result.stdout, /note_added=0/);
  [hostPath, notesPath].forEach((filePath, index) => {
    assert.deepEqual(fs.readFileSync(filePath), before[index]);
  });
});
