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
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-hamakiga1-literature-audit.mjs');
const PDF_SHA256 = '78f75fd532ace774cff181d573c96c04052e1c65dd77a352ec520d7cd33de646';
const SOURCE = '日本のハマキガ1';

const parse = filePath => Papa.parse(
  fs.readFileSync(filePath, 'utf8'),
  { header: true, skipEmptyLines: true },
).data;

const writeAccounts = (filePath, count = 216) => {
  const rows = Array.from({ length: count }, (_, index) => ({
    audit_version: 'hamakiga1-v1-2026-07-12',
    reviewed_on: '2026-07-12',
    reference: SOURCE,
    account_no: String(index + 1),
    insect_id: `species-${index + 1}`,
    source_pdf_sha256: PDF_SHA256,
  }));
  fs.writeFileSync(filePath, `${Papa.unparse(rows, { newline: '\n' })}\n`);
};

const auditDefaults = {
  reference: SOURCE,
  source_pdf_file: 'source.pdf',
  source_pdf_sha256: PDF_SHA256,
  pdf_page: '18',
  printed_page: '17',
  evidence: 'fixture',
  decision: 'fixture',
  reviewed_on: '2026-07-12',
};

const writeAudit = (filePath, rows) => {
  const columns = [
    'audit_id', 'entity', 'action', 'record_ids', 'insect_id', 'note_type',
    'match_content', 'field', 'expected_value', 'approved_value', 'plant_name',
    'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference',
    'notes', 'source_pdf_file', 'source_pdf_sha256', 'pdf_page', 'printed_page',
    'evidence', 'decision', 'reviewed_on', 'note_page', 'note_year',
  ];
  fs.writeFileSync(
    filePath,
    `${Papa.unparse(rows.map(row => ({ ...auditDefaults, ...row })), { columns, newline: '\n' })}\n`,
  );
};

const runApply = ({ hostPath, notePath, auditPath, accountsPath }) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      HAMAKIGA1_AUDIT_HOSTPLANTS_PATH: hostPath,
      HAMAKIGA1_AUDIT_NOTES_PATH: notePath,
      HAMAKIGA1_AUDIT_PATH: auditPath,
      HAMAKIGA1_ACCOUNTS_PATH: accountsPath,
    },
  },
);

const makeFixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga1-audit-'));
  const hostPath = path.join(dir, 'hostplants.csv');
  const notePath = path.join(dir, 'general_notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  const accountsPath = path.join(dir, 'accounts.csv');
  writeAccounts(accountsPath);
  return { dir, hostPath, notePath, auditPath, accountsPath };
};

test('all Hamakiga1 action types are fail-closed and idempotent', () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.hostPath, [
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes',
    `host-delete-one,species-1,重複A,科A,野外（国内）,葉,幼虫,${SOURCE},`,
    `host-delete-two,species-1,重複B,科B,野外（国内）,葉,幼虫,${SOURCE},`,
    `host-update,species-2,植物C,科C,野外（国内）,葉,幼虫,${SOURCE},`,
    '',
  ].join('\r\n'));
  fs.writeFileSync(fixture.notePath, [
    'record_id,insect_id,note_type,content,reference,page,year',
    `note-replace,species-3,生態情報,途中で切れた,${SOURCE},,`,
    `note-delete,species-6,生態情報,推論だけ,${SOURCE},,`,
    '',
  ].join('\r\n'));
  writeAudit(fixture.auditPath, [
    {
      audit_id: 'F-DELETE', entity: 'hostplant', action: 'delete_host_records',
      record_ids: 'host-delete-one; host-delete-two', insect_id: 'species-1',
    },
    {
      audit_id: 'F-UPDATE', entity: 'hostplant', action: 'update_host_field',
      record_ids: 'host-update', insect_id: 'species-2', field: 'plant_part',
      expected_value: '葉', approved_value: '茎',
    },
    {
      audit_id: 'F-ADD-HOST', entity: 'hostplant', action: 'add_host_relation',
      record_ids: 'host-add', insect_id: 'species-4', plant_name: '植物D',
      plant_family: '科D', observation_type: '野外（国外）', life_stage: '幼虫',
      notes: '国外記録',
    },
    {
      audit_id: 'F-REPLACE-NOTE', entity: 'general_note', action: 'replace_note_content',
      insect_id: 'species-3', note_type: '生態情報', match_content: '途中で切れた',
      approved_value: '復元済みの全文',
    },
    {
      audit_id: 'F-DELETE-NOTE', entity: 'general_note', action: 'delete_note',
      record_ids: 'note-delete', insect_id: 'species-6', note_type: '生態情報',
      match_content: '推論だけ',
    },
    {
      audit_id: 'F-ADD-NOTE', entity: 'general_note', action: 'add_note',
      record_ids: 'note-add', insect_id: 'species-5', note_type: '出現時期',
      approved_value: '6-7月',
    },
  ]);

  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const summary = JSON.parse(first.stdout);
  assert.deepEqual(
    {
      host_deleted: summary.host_deleted,
      host_updated: summary.host_updated,
      host_added: summary.host_added,
      note_updated: summary.note_updated,
      note_deleted: summary.note_deleted,
      note_added: summary.note_added,
    },
    {
      host_deleted: 2, host_updated: 1, host_added: 1,
      note_updated: 1, note_deleted: 1, note_added: 1,
    },
  );
  const hosts = parse(fixture.hostPath);
  assert.equal(hosts.some(row => row.record_id.startsWith('host-delete')), false);
  assert.equal(hosts.find(row => row.record_id === 'host-update').plant_part, '茎');
  assert.deepEqual(hosts.find(row => row.record_id === 'host-add'), {
    record_id: 'host-add', insect_id: 'species-4', plant_name: '植物D', plant_family: '科D',
    observation_type: '野外（国外）', plant_part: '', life_stage: '幼虫',
    reference: SOURCE, notes: '国外記録',
  });
  const notes = parse(fixture.notePath);
  assert.equal(notes.find(row => row.record_id === 'note-replace').content, '復元済みの全文');
  assert.equal(notes.some(row => row.record_id === 'note-delete'), false);
  assert.equal(notes.find(row => row.record_id === 'note-add').content, '6-7月');

  const firstBytes = [fixture.hostPath, fixture.notePath]
    .map(filePath => fs.readFileSync(filePath));
  const second = runApply(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const secondSummary = JSON.parse(second.stdout);
  assert.equal(secondSummary.host_deleted, 0);
  assert.equal(secondSummary.host_updated, 0);
  assert.equal(secondSummary.host_added, 0);
  assert.equal(secondSummary.note_updated, 0);
  assert.equal(secondSummary.note_deleted, 0);
  assert.equal(secondSummary.note_added, 0);
  [fixture.hostPath, fixture.notePath].forEach((filePath, index) => {
    assert.deepEqual(fs.readFileSync(filePath), firstBytes[index]);
  });
});

test('note deletion rejects unexpected content without writing', () => {
  const fixture = makeFixture();
  fs.writeFileSync(
    fixture.hostPath,
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\n',
  );
  fs.writeFileSync(fixture.notePath, [
    'record_id,insect_id,note_type,content,reference,page,year',
    `note-delete,species-1,生態情報,別の確定本文,${SOURCE},,`,
    '',
  ].join('\r\n'));
  writeAudit(fixture.auditPath, [{
    audit_id: 'F-DELETE-NOTE', entity: 'general_note', action: 'delete_note',
    record_ids: 'note-delete', insect_id: 'species-1', note_type: '生態情報',
    match_content: '推論だけ',
  }]);
  const before = fs.readFileSync(fixture.notePath);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected note delete content/);
  assert.deepEqual(fs.readFileSync(fixture.notePath), before);
});

test('grouped deletion rejects a partial state', () => {
  const fixture = makeFixture();
  fs.writeFileSync(
    fixture.hostPath,
    `record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\nhost-one,species-1,植物A,科A,,,,${SOURCE},\r\n`,
  );
  fs.writeFileSync(
    fixture.notePath,
    'record_id,insect_id,note_type,content,reference,page,year\r\n',
  );
  writeAudit(fixture.auditPath, [{
    audit_id: 'F-PARTIAL', entity: 'hostplant', action: 'delete_host_records',
    record_ids: 'host-one; host-missing', insect_id: 'species-1',
  }]);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Partial delete state/);
  assert.equal(parse(fixture.hostPath).length, 1);
});

test('source hash substitution and incomplete account ledgers are rejected', () => {
  for (const mode of ['hash', 'accounts']) {
    const fixture = makeFixture();
    fs.writeFileSync(
      fixture.hostPath,
      'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\n',
    );
    fs.writeFileSync(
      fixture.notePath,
      'record_id,insect_id,note_type,content,reference,page,year\r\n',
    );
    if (mode === 'accounts') writeAccounts(fixture.accountsPath, 215);
    writeAudit(fixture.auditPath, [{
      audit_id: 'F-IDENTITY', entity: 'hostplant', action: 'add_host_relation',
      record_ids: 'host-add', insect_id: 'species-1', plant_name: '植物A',
      source_pdf_sha256: mode === 'hash' ? '0'.repeat(64) : PDF_SHA256,
    }]);
    const result = runApply(fixture);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      mode === 'hash' ? /Unexpected source_pdf_sha256/ : /must contain 216 rows/,
    );
  }
});

test('semantic duplicates block a second foreign-host insertion', () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.hostPath, [
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes',
    `existing,species-1,カバノキ属,カバノキ科,野外（国外）,幼虫,幼虫,${SOURCE},`,
    '',
  ].join('\r\n'));
  fs.writeFileSync(
    fixture.notePath,
    'record_id,insect_id,note_type,content,reference,page,year\r\n',
  );
  writeAudit(fixture.auditPath, [{
    audit_id: 'F-DUPLICATE', entity: 'hostplant', action: 'add_host_relation',
    record_ids: 'new-id', insect_id: 'species-1', plant_name: 'カバノキ属',
    plant_family: 'カバノキ科', observation_type: '野外（国外）', life_stage: '幼虫',
  }]);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Semantic duplicate blocks/);
  assert.equal(parse(fixture.hostPath).length, 1);
});

test('production final state accepts the later editorial audit without reverting it', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga1-final-state-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const hostPath = path.join(dir, 'hostplants.csv');
  const notePath = path.join(dir, 'general_notes.csv');
  fs.copyFileSync(path.join(ROOT, 'normalized_data/hostplants.csv'), hostPath);
  fs.copyFileSync(path.join(ROOT, 'normalized_data/general_notes.csv'), notePath);
  const before = [hostPath, notePath].map((filePath) => fs.readFileSync(filePath));
  const result = runApply({
    hostPath,
    notePath,
    auditPath: path.join(
      ROOT,
      'data/source_audits/japanese-tortricid-moths-1-integrity-2026-07-12.csv',
    ),
    accountsPath: path.join(
      ROOT,
      'data/source_audits/japanese-tortricid-moths-1-all-accounts-2026-07-12.csv',
    ),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.note_superseded, 9);
  assert.equal(summary.host_file_changed, false);
  assert.equal(summary.note_file_changed, false);
  [hostPath, notePath].forEach((filePath, index) => {
    assert.deepEqual(fs.readFileSync(filePath), before[index]);
  });
});
