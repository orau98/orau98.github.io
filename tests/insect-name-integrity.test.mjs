import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { loadInsectNameIntegrityRedirects } from '../scripts/lib/mergedTaxonRedirects.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY_SCRIPT = path.join(ROOT, 'scripts/apply-insect-name-integrity-audit.mjs');
const AUDIT_PATH = path.join(ROOT, 'data/source_audits/insect-name-integrity-2026-10-02.json');
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const TABLES = [
  { key: 'insects', file: 'insects.csv', idColumn: 'insect_id', actions: audit.insect_actions, bom: true },
  { key: 'hosts', file: 'hostplants.csv', idColumn: 'record_id', actions: audit.host_actions, bom: false },
  { key: 'notes', file: 'general_notes.csv', idColumn: 'record_id', actions: audit.note_actions, bom: true },
];

const readCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(parsed.errors, [], filePath);
  return { rows: parsed.data, columns: parsed.meta.fields };
};
const runApply = (dataRoot, args = []) => spawnSync(process.execPath, [APPLY_SCRIPT, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, INSECT_NAME_INTEGRITY_DATA_ROOT: dataRoot },
});

// 現在のCSVから台帳の操作を巻き戻し、適用前の状態を作る
function makeBeforeFixture() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'insect-name-integrity-'));
  fs.mkdirSync(path.join(dataRoot, 'normalized_data'));
  for (const table of TABLES) {
    const { rows, columns } = readCsv(path.join(ROOT, 'normalized_data', table.file));
    const byId = new Map(rows.map((row) => [row[table.idColumn], row]));
    for (const action of table.actions) {
      const id = action.before[table.idColumn];
      if (action.after === null) {
        assert.equal(byId.has(id), false, `${id} should already be deleted`);
        rows.push({ ...action.before });
      } else {
        Object.assign(byId.get(id), action.before);
      }
    }
    fs.writeFileSync(
      path.join(dataRoot, 'normalized_data', table.file),
      `${table.bom ? '﻿' : ''}${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`,
    );
  }
  return dataRoot;
}

test('台帳は統合13件・和名欄の修復211件を、操作と件数が一致する形で持つ', () => {
  assert.equal(audit.schema_version, 1);
  assert.equal(audit.audit_name, '昆虫の重複ID統合と和名欄の修復');
  assert.deepEqual(audit.counts, {
    merges: 13,
    renames: 211,
    insect_actions: 224,
    host_actions: 63,
    note_actions: 5,
  });
  assert.deepEqual(
    audit.merges.map(({ duplicate_id: duplicateId, canonical_id: canonicalId }) => [duplicateId, canonicalId]),
    [
      ['species-21574', 'species-3593'],
      ['species-21575', 'species-3592'],
      ['species-21578', 'species-3761'],
      ['species-21591', 'species-3809'],
      ['species-21594', 'species-3823'],
      ['species-21601', 'species-3845'],
      ['species-21695', 'species-6023'],
      ['species-21729', 'species-5929'],
      ['species-20545', 'species-3688'],
      ['species-23137', 'species-21251'],
      ['species-23142', 'species-21000'],
      ['species-23150', 'species-21038'],
      ['species-23151', 'species-21065'],
    ],
  );
  for (const entry of [...audit.merges, ...audit.renames]) assert.ok(entry.evidence, JSON.stringify(entry));
  const restored = audit.renames.filter(({ reason }) => reason === 'restore_verified_japanese_name');
  assert.equal(restored.length, 42);
  for (const entry of restored) {
    assert.equal(entry.source.ledger, 'data/source_audits/japanese-aphid-guide-all-accounts-2026-07-12.csv');
    assert.equal(entry.after_japanese_name, entry.source.source_japanese_name);
  }
});

test('本番のCSVには台帳が適用済みで、--check は何も変えない', () => {
  const result = runApply(ROOT, ['--check']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.state, 'applied');
  assert.equal(summary.would_change, false);
});

test('重複IDは消え、食草・備考は正規IDへ移り、public のCSVも同じ', () => {
  for (const base of ['normalized_data', 'public']) {
    const insects = new Map(readCsv(path.join(ROOT, base, 'insects.csv')).rows.map((row) => [row.insect_id, row]));
    const hosts = readCsv(path.join(ROOT, base, 'hostplants.csv')).rows;
    const notes = readCsv(path.join(ROOT, base, 'general_notes.csv')).rows;
    for (const { duplicate_id: duplicateId, canonical_id: canonicalId } of audit.merges) {
      assert.equal(insects.has(duplicateId), false, `${base}: ${duplicateId}`);
      assert.ok(insects.has(canonicalId), `${base}: ${canonicalId}`);
      assert.equal(hosts.some(({ insect_id: insectId }) => insectId === duplicateId), false);
      assert.equal(notes.some(({ insect_id: insectId }) => insectId === duplicateId), false);
    }
    // スジハグルマエダシャクの訪花記録は正規ID（List-MJ の学名）へ移っている
    assert.equal(hosts.filter((row) => row.insect_id === 'species-3593' && row.plant_part === '花').length, 7);
    assert.equal(insects.get('species-3593').japanese_name, 'スジハグルマエダシャク');
    assert.equal(insects.get('species-3593').scientific_name, 'Synegia limitatoides Inoue, 1982');
    // 暫定IDの原典の和名は、正規IDの別名として残る
    assert.equal(insects.get('species-21038').other_names, 'ヌルデノオオミミフシアブラムシ');
    assert.equal(insects.get('species-21065').other_names, 'ニレナガフシヨスジメンチュウ');
  }
});

test('和名欄に学名の著者年の断片・学名・「(新称)」が残らない', () => {
  const { rows } = readCsv(path.join(ROOT, 'normalized_data/insects.csv'));
  const byId = new Map(rows.map((row) => [row.insect_id, row]));
  const aphids = rows.filter((row) => row.family === 'Aphididae' || row.family_jp.includes('アブラムシ'));
  assert.deepEqual(aphids.filter((row) => /^\d{4}\)$/.test(row.japanese_name)).map((row) => row.insect_id), []);
  assert.deepEqual(
    aphids.filter((row) => row.japanese_name && !/[ぁ-んァ-ヶ一-龠]/.test(row.japanese_name)).map((row) => row.insect_id),
    [],
  );
  // 外すと別属と同名になる1件だけ、原本で確かめるまで「(新称)」を残す
  assert.deepEqual(rows.filter((row) => row.japanese_name.includes('新称')).map((row) => row.insect_id), ['species-21076']);
  assert.equal(byId.get('species-20983').japanese_name, 'クロネコアシアブラムシ');
  assert.equal(byId.get('species-20983').changes_since_standard, '和名は新称');
  assert.equal(byId.get('species-21179').japanese_name, 'モミジニタイケアブラムシ');
  assert.equal(byId.get('species-21368').japanese_name, 'ヤナギフタオアブラムシ');
  assert.equal(byId.get('species-21251').japanese_name, 'キツネノマゴアブラムシ');
  // 原典の和名が現行目録では別種に付いているもの・異名の和名は入れない
  assert.equal(byId.get('species-21150').japanese_name, '');
  assert.equal(byId.get('species-21219').japanese_name, '');
  assert.equal(byId.get('species-H021').japanese_name, 'キタツブノミハムシ');
  assert.equal(byId.get('species-H021').old_japanese_name, '');
  assert.equal(byId.get('species-H027').japanese_name, 'キアシツブノミハムシ');
  assert.equal(byId.get('species-H027').old_japanese_name, '');
});

test('旧URLの転送先一覧: 統合した重複IDと、名前が変わった115種', () => {
  const { merges, renames } = loadInsectNameIntegrityRedirects(AUDIT_PATH);
  assert.equal(merges.length, 13);
  assert.equal(renames.length, 115);
  const byDuplicate = new Map(merges.map((merge) => [merge.duplicateId, merge]));
  // 同名の重複があった間は、正規ID側も ID のURL を使っていた
  assert.deepEqual(byDuplicate.get('species-21574').legacyRouteNames, ['species-21574']);
  assert.deepEqual(byDuplicate.get('species-21574').canonicalLegacyRouteNames, ['species-3593']);
  assert.equal(byDuplicate.get('species-21574').legacyEnglishMetaSlug, 'synegia-limitatoidea');
  // 同じ学名の暫定IDは英語ページのファイル名に -2 が付いていた
  assert.equal(byDuplicate.get('species-23150').legacyEnglishMetaSlug, 'schlechtendalia-chinensis-2');
  // 統合後に正規IDの名前になったURLは転送しない
  assert.deepEqual(byDuplicate.get('species-23137').legacyRouteNames, []);
  const byInsect = new Map(renames.map((rename) => [rename.insectId, rename]));
  assert.deepEqual(byInsect.get('species-H021').legacyRouteNames, ['species-H021']);
  assert.deepEqual(byInsect.get('species-21179').legacyRouteNames, ['Periphyllus californiensis']);
  assert.deepEqual(byInsect.get('species-20983').legacyRouteNames, ['クロネコアシアブラムシ (新称)']);
});

test('適用前の状態からの適用は一度で完了し、再適用してもバイト列が変わらない', () => {
  const dataRoot = makeBeforeFixture();
  try {
    const check = runApply(dataRoot, ['--check']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).state, 'pending');
    const first = runApply(dataRoot);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(JSON.parse(first.stdout).changed, 292);
    const bytes = TABLES.map(({ file }) => fs.readFileSync(path.join(dataRoot, 'normalized_data', file)));
    const second = runApply(dataRoot);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(second.stdout).would_change, false);
    TABLES.forEach(({ file }, index) => {
      assert.deepEqual(fs.readFileSync(path.join(dataRoot, 'normalized_data', file)), bytes[index]);
    });
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('想定外に書き換わった行があれば、何も書かずに止まる', () => {
  const dataRoot = makeBeforeFixture();
  try {
    const insectsPath = path.join(dataRoot, 'normalized_data/insects.csv');
    const { rows, columns } = readCsv(insectsPath);
    rows.find((row) => row.insect_id === 'species-21179').japanese_name = '意図しない変更';
    fs.writeFileSync(insectsPath, `﻿${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`);
    const before = fs.readFileSync(insectsPath);
    const result = runApply(dataRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /precondition mismatch/);
    assert.deepEqual(fs.readFileSync(insectsPath), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
