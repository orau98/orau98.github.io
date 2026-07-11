import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from '../scripts/lib/csvQuality.mjs';
import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const APPLY_PATH = path.join(ROOT, 'scripts/apply-leaf-beetle-canonical-merge-audit.mjs');
const AUDIT_SHA256 = '54640b5efb70df438e1629871e36f5dfb8d57a4c2bea8536c149b3e1f25898a6';
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const TABLES = {
  insects: { fileName: 'insects.csv', idColumn: 'insect_id', actions: audit.insect_actions },
  hosts: { fileName: 'hostplants.csv', idColumn: 'record_id', actions: audit.host_actions },
  notes: { fileName: 'general_notes.csv', idColumn: 'record_id', actions: audit.note_actions },
};
const DUPLICATE_IDS = new Set(audit.mappings.map(({ duplicate_id }) => duplicate_id));
const CANONICAL_IDS = new Set(audit.mappings.map(({ canonical_id }) => canonical_id));
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
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'leaf-beetle-canonical-'));
  const normalizedDir = path.join(dataRoot, 'normalized_data');
  fs.mkdirSync(normalizedDir);
  for (const { fileName, idColumn, actions } of Object.values(TABLES)) {
    const source = path.join(ROOT, 'normalized_data', fileName);
    const target = path.join(normalizedDir, fileName);
    fs.copyFileSync(source, target);
    const { parsed, rows } = readRows(target);
    const byId = new Map(rows.map((row) => [row[idColumn], row]));
    for (const action of actions) {
      const id = action.before[idColumn];
      if (byId.has(id)) Object.assign(byId.get(id), action.before);
      else {
        const restored = { ...action.before };
        rows.push(restored);
        byId.set(id, restored);
      }
    }
    writeRows(target, parsed.header, rows, Boolean(parsed.bom));
  }
  return dataRoot;
}

function makeCompatiblePredecessorFixture() {
  const dataRoot = makePendingFixture();
  const initial = runApply(dataRoot);
  assert.equal(initial.status, 0, initial.stderr || initial.stdout);
  const filePath = path.join(dataRoot, 'normalized_data/insects.csv');
  const { parsed, rows } = readRows(filePath);
  const byId = new Map(rows.map((row) => [row.insect_id, row]));
  const h032Action = audit.insect_actions.find(({ action_id }) => (
    action_id === 'LBCM-INSECT-UPDATE-species-H032'
  ));
  Object.assign(byId.get('species-H032'), h032Action.compatible_predecessor_before);
  const h033Action = audit.insect_actions.find(({ action_id }) => (
    action_id === 'LBCM-INSECT-DELETE-species-H033'
  ));
  rows.push({ ...h033Action.before });
  writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
  return dataRoot;
}

function runApply(dataRoot, ...arguments_) {
  return spawnSync(process.execPath, [APPLY_PATH, ...arguments_], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, LEAF_BEETLE_CANONICAL_DATA_ROOT: dataRoot },
  });
}

function dataHashes(dataRoot) {
  return Object.fromEntries(Object.entries(TABLES).map(([tableName, { fileName }]) => [
    tableName,
    sha256(fs.readFileSync(path.join(dataRoot, 'normalized_data', fileName))),
  ]));
}

test('the sealed ledger covers all 13 mappings and the complete H808 payload', () => {
  assert.equal(sha256(fs.readFileSync(AUDIT_PATH)), AUDIT_SHA256);
  assert.equal(audit.mappings.length, 13);
  assert.deepEqual(audit.counts, {
    mappings: 13,
    canonical_search_name_updates: 12,
    duplicate_taxon_deletions: 13,
    canonical_merge_insect_actions: 25,
    verified_name_actions: 2,
    insect_actions: 27,
    host_actions: 20,
    note_actions: 1,
    total_actions: 48,
    h808_hosts_verified: 7,
    h808_notes_verified: 1,
  });
  assert.equal(audit.insect_actions.filter(({ action }) => action === 'update_canonical_search_names').length, 12);
  assert.equal(audit.insect_actions.filter(({ action }) => action === 'delete_duplicate_taxon').length, 13);
  assert.equal(audit.insect_actions.filter(({ action }) => action === 'update_verified_japanese_name').length, 2);
  assert.equal(audit.host_actions.filter(({ action }) => action === 'move_host_relationship').length, 2);
  assert.equal(audit.host_actions.filter(({ action }) => action === 'delete_merged_host_duplicate').length, 11);
  const h089Patch = audit.insect_actions.find(({ after }) => after?.insect_id === 'species-H089');
  assert.match(h089Patch.after.other_names, /ヒゲナガマルノミハムシ/);
  assert.doesNotMatch(h089Patch.after.synonyms, /hegenagae/i);
  const h032Patches = audit.insect_actions.filter(({ after }) => after?.insect_id === 'species-H032');
  assert.equal(h032Patches.length, 1);
  assert.match(h032Patches[0].after.synonyms, /Argopistes coccinelliformis/);
  assert.match(h032Patches[0].after.synonyms, /Argopistes ryukyuensis/);
  assert.equal(h032Patches[0].after.tribe_jp, 'ノミハムシ族');
  assert.match(h032Patches[0].after.changes_since_standard, /新参異名/);
  assert.match(h032Patches[0].after.notes, /10\.3897\/zookeys\.1215\.134871/);
  assert.equal(h032Patches[0].source.doi, '10.3897/zookeys.1215.134871');
  assert.equal(
    audit.insect_actions.find(({ action_id }) => action_id === 'LBCM-INSECT-DELETE-species-H033').source.doi,
    '10.3897/zookeys.1215.134871',
  );
  assert.deepEqual(
    audit.mappings.filter(({ canonical_id }) => canonical_id === 'species-H032')
      .map(({ duplicate_id }) => duplicate_id),
    ['species-H808', 'species-H033'],
  );
});

test('48 exact actions apply atomically and become byte-idempotent', () => {
  const dataRoot = makePendingFixture();
  try {
    const first = runApply(dataRoot);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(JSON.parse(first.stdout).changed, 48);
    const insects = readRows(path.join(dataRoot, 'normalized_data/insects.csv')).rows;
    const hosts = readRows(path.join(dataRoot, 'normalized_data/hostplants.csv')).rows;
    const notes = readRows(path.join(dataRoot, 'normalized_data/general_notes.csv')).rows;
    const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
    assert.ok([...DUPLICATE_IDS].every((id) => !insectsById.has(id)));
    assert.match(insectsById.get('species-H032').synonyms, /Argopistes coccinelliformis/);
    assert.match(insectsById.get('species-H032').synonyms, /Argopistes ryukyuensis/);
    assert.match(insectsById.get('species-H032').other_names, /リュウキュウテントウノミハムシ/);
    assert.equal(insectsById.get('species-H032').tribe_jp, 'ノミハムシ族');
    assert.match(insectsById.get('species-H032').changes_since_standard, /新参異名/);
    assert.match(insectsById.get('species-H137').other_names, /ヨモギアシナガトビハムシ/);
    assert.equal(insectsById.get('species-H806').japanese_name, 'オキナワツブノミハムシ');
    assert.equal(insectsById.get('species-H933').japanese_name, 'セアカケブカハムシ');
    assert.equal(insectsById.get('species-H933').alternative_name, 'セアカケブカサルハムシ');
    assert.doesNotMatch(insectsById.get('species-H089').synonyms, /hegenagae/i);

    const h032Sayabane = hosts.filter((row) => (
      row.insect_id === 'species-H032' && row.reference.includes('さやばね ニューシリーズ No.17')
    ));
    assert.equal(h032Sayabane.length, 7);
    assert.equal(new Set(h032Sayabane.map(({ plant_name }) => plant_name)).size, 7);
    const hiragi = h032Sayabane.find(({ plant_name }) => plant_name === 'ヒイラギ');
    assert.deepEqual(new Set(hiragi.life_stage.split('; ')), new Set(['成虫', '幼虫']));
    assert.match(hiragi.reference, /ハムシハンドブック/);
    assert.match(hiragi.reference, /日本産ハムシ科生態覚書 \(6\)/);
    assert.equal(notes.find(({ record_id }) => record_id === 'note-1005195').insect_id, 'species-H032');
    assert.ok([...hosts, ...notes].every(({ insect_id }) => !DUPLICATE_IDS.has(insect_id)));

    const afterFirst = dataHashes(dataRoot);
    const second = runApply(dataRoot);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(second.stdout).changed, 0);
    assert.deepEqual(dataHashes(dataRoot), afterFirst);
    assert.doesNotMatch(fs.readFileSync(APPLY_PATH, 'utf8'), /public\//);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('the sealed 47-action predecessor upgrades through only the two declared transitions', () => {
  const dataRoot = makeCompatiblePredecessorFixture();
  try {
    const check = runApply(dataRoot, '--check');
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).pending, 2);
    assert.equal(JSON.parse(check.stdout).already_applied, 46);
    const result = runApply(dataRoot);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).changed, 2);
    const insects = readRows(path.join(dataRoot, 'normalized_data/insects.csv')).rows;
    const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
    assert.equal(insectsById.has('species-H033'), false);
    assert.equal(insectsById.get('species-H032').tribe_jp, 'ノミハムシ族');
    assert.match(insectsById.get('species-H032').changes_since_standard, /新参異名/);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('check mode validates without writing, while partial state and drift fail closed', () => {
  const checkRoot = makePendingFixture();
  try {
    const before = dataHashes(checkRoot);
    const check = runApply(checkRoot, '--check');
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).state, 'pending');
    assert.deepEqual(dataHashes(checkRoot), before);
  } finally {
    fs.rmSync(checkRoot, { recursive: true, force: true });
  }

  const partialRoot = makePendingFixture();
  try {
    const filePath = path.join(partialRoot, 'normalized_data/insects.csv');
    const { parsed, rows } = readRows(filePath);
    const patch = audit.insect_actions.find(({ action }) => action === 'update_canonical_search_names');
    Object.assign(rows.find(({ insect_id }) => insect_id === patch.after.insect_id), patch.after);
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
    const before = dataHashes(partialRoot);
    const result = runApply(partialRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Partial audit state is not allowed/);
    assert.deepEqual(dataHashes(partialRoot), before);
  } finally {
    fs.rmSync(partialRoot, { recursive: true, force: true });
  }

  const driftRoot = makePendingFixture();
  try {
    const filePath = path.join(driftRoot, 'normalized_data/general_notes.csv');
    const { parsed, rows } = readRows(filePath);
    rows.find(({ record_id }) => record_id === 'note-1005195').content += '予期しない変更';
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
    const before = dataHashes(driftRoot);
    const result = runApply(driftRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /drifted/);
    assert.deepEqual(dataHashes(driftRoot), before);
  } finally {
    fs.rmSync(driftRoot, { recursive: true, force: true });
  }
});

test('old Japanese and scientific names survive the normalized display model', () => {
  const dataRoot = makePendingFixture();
  try {
    const result = runApply(dataRoot);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const insects = readRows(path.join(dataRoot, 'normalized_data/insects.csv')).rows;
    const hosts = readRows(path.join(dataRoot, 'normalized_data/hostplants.csv')).rows;
    const notes = readRows(path.join(dataRoot, 'normalized_data/general_notes.csv')).rows;
    const converted = convertNormalizedDataToStandardFormat(insects, hosts, notes);
    const h032 = converted.leafbeetles.find(({ id }) => id === 'species-H032');
    assert.ok(h032);
    assert.match(h032.alternativeNames, /リュウキュウテントウノミハムシ/);
    assert.match(h032.synonyms, /Argopistes coccinelliformis/);
    assert.equal(h032.hostPlantsDetailed.filter(({ reference }) => reference.includes('No.17')).length, 7);
    assert.ok(h032.generalNotes.some(({ reference }) => reference.includes('No.17')));
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('production normalized data has no removed IDs, affected duplicate pairs, or orphan relationships', () => {
  const insects = readRows(path.join(ROOT, 'normalized_data/insects.csv')).rows;
  const hosts = readRows(path.join(ROOT, 'normalized_data/hostplants.csv')).rows;
  const notes = readRows(path.join(ROOT, 'normalized_data/general_notes.csv')).rows;
  const insectIds = new Set(insects.map(({ insect_id }) => insect_id));
  assert.ok([...DUPLICATE_IDS].every((id) => !insectIds.has(id)));
  assert.ok([...hosts, ...notes].every(({ insect_id }) => insectIds.has(insect_id)));
  const pairs = new Set();
  for (const row of hosts.filter(({ insect_id }) => CANONICAL_IDS.has(insect_id))) {
    const key = `${row.insect_id}\u0000${row.plant_name}`;
    assert.equal(pairs.has(key), false, key);
    pairs.add(key);
  }
});
