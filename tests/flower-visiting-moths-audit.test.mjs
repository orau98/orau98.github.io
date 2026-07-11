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
  'data/source_audits/flower-visiting-moths-comprehensive-audit-2026-07-12.json',
);
const APPLY_PATH = path.join(ROOT, 'scripts/apply-flower-visiting-moths-audit.mjs');
const SOURCE_REFERENCE = '花を訪れる蛾たち　知られざる姿を求めて';
const AUDIT_SHA256 = 'bad54f975389bef5db313beca0f1114156781c36faec99ebcd9e082ec90b9f87';
const HOST_COLUMNS = [
  'record_id',
  'insect_id',
  'plant_name',
  'plant_family',
  'observation_type',
  'plant_part',
  'life_stage',
  'reference',
  'notes',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readRows = (filePath) => toObjects(parseCsv(fs.readFileSync(filePath, 'utf8')));
const serializeRows = (rows) => `${HOST_COLUMNS.join(',')}\n${rows.map((row) => (
  HOST_COLUMNS.map((column) => serializeField(row[column] ?? '')).join(',')
)).join('\n')}\n`;
const relationshipKey = (row) => `${row.insect_id}\u0000${row.plant_name}`;

function makeDataRoot() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flower-moths-audit-'));
  fs.mkdirSync(path.join(dataRoot, 'normalized_data'));
  for (const fileName of ['hostplants.csv', 'insects.csv']) {
    fs.copyFileSync(
      path.join(ROOT, 'normalized_data', fileName),
      path.join(dataRoot, 'normalized_data', fileName),
    );
  }
  return dataRoot;
}

function restorePreAuditState(dataRoot, ledger) {
  const hostPath = path.join(dataRoot, 'normalized_data/hostplants.csv');
  const addIds = new Set(
    ledger.actions.filter((action) => action.action === 'add_relationship')
      .map((action) => action.record_id),
  );
  const rows = readRows(hostPath).filter((row) => !addIds.has(row.record_id));
  const byId = new Map(rows.map((row) => [row.record_id, row]));

  for (const action of ledger.actions) {
    if (action.action === 'add_relationship') continue;
    if (action.action === 'delete_invalid_placeholder') {
      if (!byId.has(action.record_id)) {
        const row = {
          record_id: action.record_id,
          ...action.expected_before,
          plant_family: '',
          observation_type: '野外（国内）',
          plant_part: '花',
          life_stage: '成虫',
          reference: SOURCE_REFERENCE,
          notes: '',
        };
        rows.push(row);
        byId.set(row.record_id, row);
      }
      continue;
    }
    const row = byId.get(action.record_id);
    assert.ok(row, `pre-audit fixture target is missing: ${action.record_id}`);
    Object.assign(row, action.expected_before);
  }
  fs.writeFileSync(hostPath, serializeRows(rows), 'utf8');
  return hostPath;
}

function runApply(dataRoot, ...arguments_) {
  return spawnSync(process.execPath, [APPLY_PATH, ...arguments_], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FLOWER_MOTHS_DATA_ROOT: dataRoot },
  });
}

test('original-PDF audit ledger seals the complete 614-account review', () => {
  const bytes = fs.readFileSync(AUDIT_PATH);
  assert.equal(sha256(bytes), AUDIT_SHA256);
  const ledger = JSON.parse(bytes);
  assert.equal(
    ledger.source.sha256,
    '59d32259aac9041d2d5497133dc33c7f1a220c148d2ce6a2ebe9e5c877540c6b',
  );
  assert.equal(ledger.source.source_taxon_accounts_audited, 614);
  assert.deepEqual(ledger.coverage, {
    existing_source_rows_screened: 2616,
    source_taxon_accounts_screened: 614,
    wholly_missing_source_taxa_found: 70,
    page_break_taxa_recovered: 1,
    misattributed_rows_found: 3,
    spelling_or_family_repairs_found: 2,
    unresolved_holds: 0,
  });
  assert.equal(ledger.source_taxa_recovered.length, 70);
  assert.equal(ledger.verified_existing_relationships.length, 9);
  assert.equal(ledger.actions.length, 363);
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(ledger.actions, ({ action }) => action))
      .map(([action, rows]) => [action, rows.length])),
    {
      reassign_insect: 3,
      delete_invalid_placeholder: 1,
      replace_plant_name: 1,
      set_plant_family: 1,
      add_relationship: 357,
    },
  );
  assert.ok(ledger.actions.every((action) => (
    action.source_ordinal && action.printed_page && action.pdf_page && action.evidence
  )));
});

test('all verified flower relationships apply atomically and remain idempotent', () => {
  const ledger = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const dataRoot = makeDataRoot();
  try {
    const hostPath = restorePreAuditState(dataRoot, ledger);
    const before = fs.readFileSync(hostPath);
    const first = runApply(dataRoot);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.match(first.stdout, /"changed": 363/);
    assert.match(first.stdout, /"additions": 357/);
    assert.match(first.stdout, /"reassignments": 3/);
    assert.match(first.stdout, /"deletions": 1/);
    assert.match(first.stdout, /"cell_repairs": 2/);
    const after = fs.readFileSync(hostPath);
    assert.notDeepEqual(after, before);
    assert.equal(
      new Set(parseCsv(after.toString('utf8')).records.map((record) => record.eol).filter(Boolean)).size,
      1,
    );

    const rows = readRows(hostPath);
    const sourceRows = rows.filter((row) => row.reference === SOURCE_REFERENCE);
    const byId = new Map(rows.map((row) => [row.record_id, row]));
    const relationCounts = new Map();
    for (const row of rows) {
      const key = relationshipKey(row);
      relationCounts.set(key, (relationCounts.get(key) || 0) + 1);
    }
    assert.equal(sourceRows.length, 2972);
    assert.equal(sourceRows.some((row) => row.plant_name === '（リスト無し）'), false);
    assert.equal(sourceRows.some((row) => !row.plant_family), false);
    assert.equal(sourceRows.some((row) => row.plant_name === 'ヤマタケタケアザミ'), false);
    for (const recordId of ['hostplant-902802', 'hostplant-902803', 'hostplant-902804']) {
      assert.equal(byId.get(recordId)?.insect_id, 'species-2897');
    }
    assert.equal(byId.get('hostplant-902809')?.plant_family, 'キキョウ科');
    assert.equal(byId.get('hostplant-903065')?.plant_name, 'ヤツガタケアザミ');

    for (const action of ledger.actions.filter(({ action }) => action === 'add_relationship')) {
      const row = byId.get(action.record_id);
      assert.deepEqual(
        Object.fromEntries(HOST_COLUMNS.map((column) => [column, row?.[column] ?? ''])),
        { record_id: action.record_id, ...action.after },
      );
      assert.equal(relationCounts.get(relationshipKey(row)), 1);
    }
    for (const taxon of ledger.source_taxa_recovered) {
      for (const plantName of taxon.plants) {
        assert.ok(
          relationCounts.has(`${taxon.insect_id}\u0000${plantName}`),
          `${taxon.source_japanese_name}: missing ${plantName}`,
        );
      }
    }

    const insects = new Map(
      readRows(path.join(dataRoot, 'normalized_data/insects.csv'))
        .map((row) => [row.insect_id, row]),
    );
    for (const taxon of ledger.source_taxa_recovered) {
      assert.equal(insects.get(taxon.insect_id)?.japanese_name, taxon.current_japanese_name);
      assert.equal(insects.get(taxon.insect_id)?.scientific_name, taxon.current_scientific_name);
    }

    const check = runApply(dataRoot, '--check');
    assert.equal(check.status, 0, check.stderr || check.stdout);
    const second = runApply(dataRoot);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /"changed": 0/);
    assert.deepEqual(fs.readFileSync(hostPath), after);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('a partially applied audit fails before changing the CSV', () => {
  const ledger = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const dataRoot = makeDataRoot();
  try {
    const hostPath = restorePreAuditState(dataRoot, ledger);
    const rows = readRows(hostPath);
    const partiallyApplied = rows.find((row) => row.record_id === 'hostplant-902802');
    partiallyApplied.insect_id = 'species-2897';
    fs.writeFileSync(hostPath, serializeRows(rows), 'utf8');
    const before = fs.readFileSync(hostPath);
    const result = runApply(dataRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Partial audit state is not allowed/);
    assert.deepEqual(fs.readFileSync(hostPath), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
