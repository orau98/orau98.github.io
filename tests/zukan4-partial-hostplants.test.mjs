import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import Papa from 'papaparse';

const ROOT = path.join(import.meta.dirname, '..');
const REFERENCE = '日本産蛾類標準図鑑4';
const CSV_PATHS = ['normalized_data/hostplants.csv', 'public/hostplants.csv'];

const parseCsv = (relativePath) => Papa.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  { header: true, skipEmptyLines: true },
).data;

const sourceRows = (relativePath) => parseCsv(relativePath)
  .filter((row) => row.reference === REFERENCE);

const rowsFor = (rows, insectId) => rows.filter((row) => row.insect_id === insectId);
const namesFor = (rows, insectId) => new Set(rowsFor(rows, insectId).map((row) => row.plant_name));

test('図鑑4 p.86–155 の監査済み寄主445件を両CSVに保持する', () => {
  for (const csvPath of CSV_PATHS) {
    const rows = sourceRows(csvPath);
    assert.equal(rows.length, 445, csvPath);
    assert.equal(new Set(rows.map((row) => row.record_id)).size, 445, `${csvPath}: record_id must be unique`);
    assert.equal(rows.every((row) => /^図鑑4 p\.\d+/.test(row.notes)), true, `${csvPath}: page provenance`);
  }
});

test('段組み・ページまたぎを正しい種へ割り当てる', () => {
  for (const csvPath of CSV_PATHS) {
    const rows = sourceRows(csvPath);

    assert.deepEqual([...namesFor(rows, 'species-0368')].sort(), ['クヌギ']);
    assert.deepEqual([...namesFor(rows, 'species-0411')].sort(), ['ダケカンバ', 'ミズメ']);
    assert.deepEqual([...namesFor(rows, 'species-0412')].sort(), ['ケヤキ', 'ハルニレ']);
    assert.deepEqual([...namesFor(rows, 'species-0429')], ['シラキ']);
    assert.deepEqual([...namesFor(rows, 'species-0537')].sort(), ['ガマズミ', 'コバノガマズミ', 'ミヤマガマズミ']);
    assert.deepEqual([...namesFor(rows, 'species-0591')], ['ハシドイ']);
  }
});

test('国内・国外記録と再確認注記を保持する', () => {
  for (const csvPath of CSV_PATHS) {
    const rows = sourceRows(csvPath);

    const strigulatella = rowsFor(rows, 'species-0518');
    assert.equal(strigulatella.some((row) => row.plant_name === 'ケヤマハンノキ' && row.observation_type === '文献'), true);
    assert.equal(strigulatella.some((row) => row.plant_name === 'ハンノキ類' && row.observation_type === '野外（国外）'), true);

    const pastorella = rowsFor(rows, 'species-0562');
    assert.equal(pastorella.some((row) => row.plant_name === 'ポプラ類' && row.observation_type === '文献'), true);
    assert.equal(pastorella.some((row) => row.plant_name === 'ヤナギ類' && row.observation_type === '野外（国外）'), true);

    assert.match(
      rows.find((row) => row.insect_id === 'species-0392' && row.plant_name === 'イロハモミジ')?.notes ?? '',
      /再確認が必要/,
    );
    assert.match(
      rows.find((row) => row.insect_id === 'species-0393' && row.plant_name === 'イタヤカエデ')?.notes ?? '',
      /再確認が必要/,
    );
  }
});

test('原典が否定・削除・推定した寄主を採用しない', () => {
  for (const csvPath of CSV_PATHS) {
    const rows = sourceRows(csvPath);

    assert.deepEqual(rowsFor(rows, 'species-0364'), [], 'コギチビガは寄主未知');
    assert.deepEqual(rowsFor(rows, 'species-0571'), [], 'オオキンモンホソガは推定のみ');

    const falseTropicalHosts = namesFor(rows, 'species-0489');
    assert.equal(falseTropicalHosts.has('ラセンソウ'), false);
    assert.equal(falseTropicalHosts.has('ジャスミン類'), false);

    assert.equal(namesFor(rows, 'species-0445').has('カカオノキ'), false);
    assert.equal(namesFor(rows, 'species-0468').has('ネジキ'), false);

    const nipponicella = namesFor(rows, 'species-0524');
    assert.deepEqual([...nipponicella].sort(), ['アベマキ', 'クヌギ']);
  }
});

test('巻末側の代表種を欠落させない', () => {
  for (const csvPath of CSV_PATHS) {
    const rows = sourceRows(csvPath);
    assert.deepEqual([...namesFor(rows, 'species-0580')].sort(), ['エゾエノキ', 'エノキ']);
    assert.deepEqual([...namesFor(rows, 'species-0581')].sort(), ['エゾエノキ', 'エノキ']);

    const citrus = namesFor(rows, 'species-0594');
    for (const name of ['Citrus属', 'ウンシュウミカン', 'ユズ', 'スダチ', 'レモン', 'キンカン', 'カラタチ']) {
      assert.equal(citrus.has(name), true, `${csvPath}: species-0594 missing ${name}`);
    }

    const grape = rowsFor(rows, 'species-0601');
    for (const name of ['エビツル', 'ノブドウ', 'サンカクヅル', '栽培ブドウ', 'ナツヅタ', 'ヤブガラシ']) {
      assert.equal(grape.some((row) => row.plant_name === name && row.observation_type === '文献'), true, `${csvPath}: species-0601 missing ${name}`);
    }
    assert.equal(grape.some((row) => row.plant_name === 'Vitis属' && row.observation_type === '野外（国外）'), true);
  }
});

test('抽出台帳とサイトCSVのレコードIDが一致する', () => {
  const report = parseCsv('reports/zukan4-partial-p086-155-hostplants.csv');
  assert.equal(report.length, 445);
  const reportIds = new Set(report.map((row) => row.record_id));
  const siteIds = new Set(sourceRows('normalized_data/hostplants.csv').map((row) => row.record_id));
  assert.deepEqual(reportIds, siteIds);
});
