import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const parseCsv = (relativePath) => {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
  return Papa.parse(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), {
    header: true,
    skipEmptyLines: true,
  }).data;
};

const csvPaths = ['normalized_data/hostplants.csv', 'public/hostplants.csv'];

test('日本原色アブラムシ図鑑のクリオオアブラムシ寄主を本文断片のまま残さない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const targetRows = rows.filter((row) => row.insect_id === 'species-21538');
    const names = new Set(targetRows.map((row) => row.plant_name));

    assert.equal(names.has('クリのほかにカシ'), false, `${csvPath} should split the prose fragment`);
    assert.equal(names.has('クリ'), true, `${csvPath} should keep クリ from the source text`);
    assert.equal(names.has('カシ'), true, `${csvPath} should keep カシ from the source text`);
    assert.equal(names.has('クヌギ'), true, `${csvPath} should keep クヌギ from the source text`);

    const kuri = targetRows.find((row) => row.plant_name === 'クリ');
    const kashi = targetRows.find((row) => row.plant_name === 'カシ');
    assert.equal(kuri?.plant_family, 'ブナ科');
    assert.equal(kashi?.plant_family, 'ブナ科');
  }
});

test('日本産蛾類標準図鑑1のチャオビコバネナミシャク寄主をOCR断片名にしない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const targetRows = rows.filter((row) => row.insect_id === 'species-4098');
    const names = new Set(targetRows.map((row) => row.plant_name));

    assert.equal(names.has('卵形幼虫はアカシ'), false, `${csvPath} should not keep an OCR prose fragment`);
    assert.equal(names.has('アラカシ'), true, `${csvPath} should recover アラカシ from the source text`);
    assert.equal(names.has('シラカシ'), true, `${csvPath} should keep シラカシ from the source text`);
    assert.equal(names.has('ケヤキ'), true, `${csvPath} should keep ケヤキ from the source text`);
  }
});

test('日本産蝶類標準図鑑の欠落食草とCapparis綴りを保持する', () => {
  const expected = {
    'species-20196': ['ツゲモドキ'],
    'species-20287': ['クロヨナ'],
    'species-20340': ['シダレヤナギ'],
    'species-20391': ['キジョラン', 'フルモウリンカ', 'ホウライアオカズラ'],
    'species-20402': ['コウシュンカズラ', 'アセロラ', 'モモタマナ'],
    'species-20435': ['ムニンススキ', 'サトウキビ', 'ススキ'],
  };

  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);

    for (const [insectId, plantNames] of Object.entries(expected)) {
      const names = new Set(rows
        .filter((row) => row.insect_id === insectId && row.reference === '日本産蝶類標準図鑑')
        .map((row) => row.plant_name));

      for (const plantName of plantNames) {
        assert.equal(names.has(plantName), true, `${csvPath} should include ${plantName} for ${insectId}`);
      }
    }

    const kawakami = rows.filter((row) => row.insect_id === 'species-20197');
    const kawakamiNames = new Set(kawakami.map((row) => row.plant_name));
    assert.equal(kawakamiNames.has('Capparis heyncana'), false, `${csvPath} should not keep the OCR typo`);
    assert.equal(kawakamiNames.has('Capparis heyneana'), true, `${csvPath} should keep the corrected source spelling`);
  }
});
