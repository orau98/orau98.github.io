import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from '../scripts/lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-butterfly-guide-integrity-actions-2026-07-12.json',
);
const APPLY_PATH = path.join(ROOT, 'scripts/apply-japanese-butterfly-guide-full-audit.mjs');
const AUDIT_SHA256 = '86f9795212cb5eee4c32cd6d9d7932691647158e47aaedf5cfbeec420def0bd9';
const SOURCE = '日本産蝶類標準図鑑';
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));

const TABLES = {
  insects: {
    fileName: 'insects.csv',
    idColumn: 'insect_id',
    actions: [...audit.name_actions, ...audit.new_taxon_actions],
  },
  hosts: { fileName: 'hostplants.csv', idColumn: 'record_id', actions: audit.host_actions },
  notes: { fileName: 'general_notes.csv', idColumn: 'record_id', actions: audit.note_actions },
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readRows = (filePath) => {
  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  return { parsed, rows: toObjects(parsed) };
};
const writeRows = (filePath, columns, rows, bom = true) => fs.writeFileSync(
  filePath,
  `${bom ? '\ufeff' : ''}${columns.join(',')}\r\n${rows.map((row) => (
    columns.map((column) => serializeField(row[column] ?? '')).join(',')
  )).join('\r\n')}\r\n`,
  'utf8',
);

function makePendingFixture() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'butterfly-guide-full-'));
  const normalizedDir = path.join(dataRoot, 'normalized_data');
  fs.mkdirSync(normalizedDir);
  for (const { fileName } of Object.values(TABLES)) {
    fs.copyFileSync(
      path.join(ROOT, 'normalized_data', fileName),
      path.join(normalizedDir, fileName),
    );
  }

  for (const { fileName, idColumn, actions } of Object.values(TABLES)) {
    const filePath = path.join(normalizedDir, fileName);
    const { parsed, rows: originalRows } = readRows(filePath);
    let rows = originalRows.map((row) => ({ ...row }));
    let byId = new Map(rows.map((row) => [row[idColumn], row]));
    for (const action of actions) {
      const id = action.before?.[idColumn] ?? action.after?.[idColumn];
      if (!action.before) {
        rows = rows.filter((row) => row[idColumn] !== id);
        byId = new Map(rows.map((row) => [row[idColumn], row]));
        continue;
      }
      let row = byId.get(id);
      if (!row) {
        row = { ...action.before };
        rows.push(row);
        byId.set(id, row);
      } else {
        Object.assign(row, action.before);
      }
    }
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
  }
  return dataRoot;
}

function runApply(dataRoot, ...arguments_) {
  return spawnSync(process.execPath, [APPLY_PATH, ...arguments_], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, BUTTERFLY_GUIDE_DATA_ROOT: dataRoot },
  });
}

function dataHashes(dataRoot) {
  return Object.fromEntries(Object.entries(TABLES).map(([tableName, { fileName }]) => [
    tableName,
    sha256(fs.readFileSync(path.join(dataRoot, 'normalized_data', fileName))),
  ]));
}

test('the original-image ledger seals all 274 source accounts and approved mutations', () => {
  assert.equal(sha256(fs.readFileSync(AUDIT_PATH)), AUDIT_SHA256);
  assert.equal(audit.source.pdf_sha256, '910e84199b94a18ab81071d5c7019655b20c03589eb1e8fbd7d668414eba0c5c');
  assert.equal(audit.source.pdf_pages, 170);
  assert.equal(audit.counts.source_accounts, 274);
  assert.equal(audit.counts.current_taxa, 270);
  assert.equal(audit.name_actions.length, 21);
  assert.equal(audit.new_taxon_actions.length, 4);
  assert.equal(audit.host_actions.length, 49);
  assert.equal(audit.note_actions.length, 38);
  assert.ok([
    ...audit.name_actions,
    ...audit.new_taxon_actions,
    ...audit.host_actions,
    ...audit.note_actions,
  ].every((action) => action.verification_status === 'original_image_verified'));
  assert.equal(audit.host_actions.filter(({ action }) => action === 'add_hostplant').length, 43);
  assert.ok(audit.host_actions.filter(({ action }) => action === 'add_hostplant')
    .every(({ after }) => after.plant_name && after.plant_family));
  assert.equal(audit.note_actions.filter(({ action }) => action === 'delete_unsupported_hold').length, 6);
  assert.equal(audit.note_actions.some(({ action }) => action.startsWith('hold_')), false);

  const movedRange = audit.note_actions.find(({ before }) => before?.record_id === 'note-1005098');
  assert.equal(movedRange.after.insect_id, 'species-20332');
  assert.match(movedRange.after.content, /11月下旬/);
  assert.equal(
    audit.note_actions.find(({ before }) => before?.record_id === 'note-1005175').after.content,
    '1月～11月',
  );
  assert.equal(
    audit.note_actions.find(({ before }) => before?.record_id === 'note-000248').after.page,
    '78',
  );
  assert.ok(audit.note_actions.some(({ after }) => (
    after?.insect_id === 'species-20232' && after.content === '6月中旬～下旬、7月'
  )));
});

test('112 exact actions apply across three tables and become byte-idempotent', () => {
  const dataRoot = makePendingFixture();
  try {
    const first = runApply(dataRoot);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const summary = JSON.parse(first.stdout);
    assert.equal(summary.changed, 112);
    assert.deepEqual(summary.action_counts, { insects: 25, hosts: 49, notes: 38 });

    const insectRows = readRows(path.join(dataRoot, 'normalized_data/insects.csv')).rows;
    const hostRows = readRows(path.join(dataRoot, 'normalized_data/hostplants.csv')).rows;
    const noteRows = readRows(path.join(dataRoot, 'normalized_data/general_notes.csv')).rows;
    const insects = new Map(insectRows.map((row) => [row.insect_id, row]));
    const hosts = new Map(hostRows.map((row) => [row.record_id, row]));
    const notes = new Map(noteRows.map((row) => [row.record_id, row]));
    assert.equal(insects.get('species-20344').japanese_name, 'ホシミスジ');
    assert.equal(insects.get('species-BTG-001').japanese_name, 'ヤエヤマイチモンジ');
    assert.equal(insects.get('species-BTG-004').scientific_name, 'Suastus gremius (Fabricius, 1798)');
    assert.equal(hosts.get('hostplant-btg-full-audit-20260712-0001').plant_family, 'バラ科');
    assert.equal(hosts.get('hostplant-btg-full-audit-20260712-0043').plant_family, 'ヤシ科');
    assert.equal(hosts.has('hostplant-006120'), false);
    assert.equal(hosts.get('hostplant-006354').insect_id, 'species-20432');
    assert.equal(notes.get('note-1005098').content, '6月下旬、7月上旬～11月下旬、7月上旬～9月、10月');
    assert.equal(notes.get('note-1005175').content, '1月～11月');
    assert.equal(notes.get('note-000248').page, '78');
    assert.equal(notes.has('note-1005003'), false);
    assert.equal(
      noteRows.filter((row) => row.reference === SOURCE).length,
      249,
    );
    assert.equal(
      hostRows.filter((row) => row.reference === SOURCE).length,
      1711,
    );
    assert.equal(insects.has('species-20436'), false);
    assert.equal(hostRows.some((row) => row.insect_id === 'species-20436'), false);
    assert.equal(noteRows.some((row) => row.insect_id === 'species-20436'), false);

    const afterFirst = dataHashes(dataRoot);
    const check = runApply(dataRoot, '--check');
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).state, 'applied');
    const second = runApply(dataRoot);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(second.stdout).changed, 0);
    assert.deepEqual(dataHashes(dataRoot), afterFirst);
    assert.doesNotMatch(fs.readFileSync(APPLY_PATH, 'utf8'), /public\//);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('check mode validates the prospective result without writing pending data', () => {
  const dataRoot = makePendingFixture();
  try {
    const before = dataHashes(dataRoot);
    const result = runApply(dataRoot, '--check');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.state, 'pending');
    assert.equal(summary.would_change, true);
    assert.equal(summary.changed, 0);
    assert.deepEqual(dataHashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('partial application is rejected before any target table is written', () => {
  const dataRoot = makePendingFixture();
  try {
    const filePath = path.join(dataRoot, 'normalized_data/insects.csv');
    const { parsed, rows } = readRows(filePath);
    const action = audit.name_actions[0];
    Object.assign(rows.find((row) => row.insect_id === action.after.insect_id), action.after);
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
    const before = dataHashes(dataRoot);
    const result = runApply(dataRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Partial audit state is not allowed/);
    assert.deepEqual(dataHashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('unexpected before-state drift is rejected without cross-table writes', () => {
  const dataRoot = makePendingFixture();
  try {
    const filePath = path.join(dataRoot, 'normalized_data/general_notes.csv');
    const { parsed, rows } = readRows(filePath);
    rows.find((row) => row.record_id === 'note-1005098').content += '予期しない変更';
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
    const before = dataHashes(dataRoot);
    const result = runApply(dataRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /drifted/);
    assert.deepEqual(dataHashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
