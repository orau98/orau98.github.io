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
