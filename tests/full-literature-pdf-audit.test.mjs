import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const csvPaths = ['normalized_data/hostplants.csv', 'public/hostplants.csv'];

const parseCsv = (relativePath) => Papa.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n|\r|\n/g, '\n'),
  { header: true, skipEmptyLines: true },
).data;

const namesFor = (rows, insectId, reference) => new Set(rows
  .filter((row) => row.insect_id === insectId && (!reference || row.reference === reference))
  .map((row) => row.plant_name));

const expectNames = (actual, expected, context) => {
  for (const name of expected) assert.equal(actual.has(name), true, `${context}: missing ${name}`);
};

test('PDF再監査で確認した未収録寄主を保持する', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);

    expectNames(namesFor(rows, 'species-21131', '日本原色アブラムシ図鑑'), ['コナラ', 'カシワ', 'ミズナラ'], csvPath);
    expectNames(namesFor(rows, 'species-4208', '日本産蛾類標準図鑑1'), ['ツタ'], csvPath);
    expectNames(namesFor(rows, 'species-20684', '日本産蛾類標準図鑑2'), ['ヌマガヤ', 'ネズミガヤ', 'コムギ', 'オオムギ', 'カラスムギ', 'クサヨシ', 'メヒシバ', 'カモジグサ'], csvPath);
    expectNames(namesFor(rows, 'species-0809', '日本産蛾類標準図鑑3'), ['フキ', 'ヨブスマソウ', 'キオン', 'エゾオグルマ', 'メタカラコウ属', 'イヌエンジュ'], csvPath);
    expectNames(namesFor(rows, 'species-1048', 'Oku & Kusunoki (2018)'), ['ヤチヤナギ'], csvPath);
    expectNames(namesFor(rows, 'species-1120', 'Oku & Kusunoki (2018)'), ['イグサ'], csvPath);
    expectNames(namesFor(rows, 'species-3638', '竹中英雄 (1959)'), ['ハコネウツギ'], csvPath);
    expectNames(namesFor(rows, 'species-4650', '中村正直 (1958)'), ['アベマキ', 'イタジイ', 'クリ', 'カエデ'], csvPath);
  }
});

test('段組みOCRの寄主欄を隣接種へ割り当てない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);

    const sugiura = namesFor(rows, 'species-21791', '日本産タマムシ大図鑑');
    const hirashima = namesFor(rows, 'species-21759', '日本産タマムシ大図鑑');
    assert.equal(sugiura.has('スダジイ'), false, `${csvPath}: A. sugiurai is explicitly host-unknown`);
    assert.equal(hirashima.has('スダジイ'), true, `${csvPath}: スダジイ belongs to A. hirashimai`);

    const tsushima = namesFor(rows, 'species-10045', '日本産タマムシ大図鑑');
    assert.equal(tsushima.has('クリ'), true);
    assert.equal(tsushima.has('アベマキ'), true);
    assert.equal(tsushima.has('マテバシイ'), false, `${csvPath}: next-species host must not shift to C. samurai`);

    const tsushimaScopula = namesFor(rows, 'species-4000', '日本産蛾類標準図鑑1');
    assert.equal(tsushimaScopula.has('イボタノキ'), false, `${csvPath}: source says host unknown`);

    const kihada = namesFor(rows, 'species-5725', '日本産蛾類標準図鑑2');
    const usuzumi = namesFor(rows, 'species-5728', '日本産蛾類標準図鑑2');
    assert.equal(kihada.has('ハンノキ'), true);
    assert.equal(kihada.has('クヌギ'), false);
    assert.equal(usuzumi.has('クヌギ'), true);
    assert.equal(usuzumi.has('ハンノキ'), false);
  }
});

test('明白なOCR断片と隣接種由来の植物名を除去する', () => {
  const forbidden = new Map([
    ['species-0680', ['ヤマノイモ', 'テナチコ', 'オトドロバ']],
    ['species-0809', ['マユミ', 'キマユミ', 'ツリバナ', 'ヒロハツリバナ', 'サワダ', 'ウメバチソウ', 'マサキ', 'ニシキギ']],
    ['species-0827', ['キンショウ']],
    ['species-0853', ['オオイトヨモギ']],
    ['species-0866', ['クラスステキ翅面さ']],
    ['species-1235', ['ミヤマグミ3', 'ツルグミ']],
    ['species-1442', ['コヤマゴヒラ', 'ムラサキマゴヒラ']],
    ['species-1458', ['エゾマツ', 'トベマ', 'モミジバフウ']],
    ['species-1569', ['キャツメ']],
  ]);

  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    for (const [insectId, plantNames] of forbidden) {
      const actual = namesFor(rows, insectId, '日本産蛾類標準図鑑3');
      for (const plantName of plantNames) {
        assert.equal(actual.has(plantName), false, `${csvPath}: ${insectId} should not keep ${plantName}`);
      }
    }
  }
});

test('hostplant CSVに完全重複行を残さない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const seen = new Set();
    const duplicates = [];
    for (const row of rows) {
      const key = [
        row.insect_id, row.plant_name, row.plant_family, row.observation_type,
        row.plant_part, row.life_stage, row.reference, row.notes,
      ].join('\u0000');
      if (seen.has(key)) duplicates.push(`${row.insect_id}:${row.plant_name}:${row.reference}`);
      seen.add(key);
    }
    assert.deepEqual(duplicates, [], `${csvPath}: exact duplicate host rows`);
  }
});
