import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readCsv = (relativePath) => Papa.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^\uFEFF/, ''),
  { header: true, skipEmptyLines: true },
).data;

test('アオスジアゲハの発生時期は月別・地域別情報を保持する', () => {
  const notes = readCsv('normalized_data/general_notes.csv')
    .filter((row) => row.insect_id === 'species-20176' && row.reference === '日本産蝶類標準図鑑');

  const emergence = notes.find((row) => row.note_type === '出現時期');
  assert.equal(
    emergence?.content,
    '日本西南部の暖地：年3回（第1化4～6月、第2化7～8月、第3化8～9月）',
  );
  assert.ok(notes.some((row) => row.content.includes('静岡県西部では年4化')));
  assert.ok(notes.some((row) => row.content.includes('奄美大島付近の暖地')));
});

test('アオスジアゲハの訪花先は幼虫食草と別レコードで保持する', () => {
  const rows = readCsv('normalized_data/hostplants.csv')
    .filter((row) => (
      row.insect_id === 'species-20176'
      && row.reference === '日本産蝶類標準図鑑'
      && row.life_stage === '成虫'
      && row.plant_part === '花'
    ));

  assert.deepEqual(
    rows.map((row) => row.plant_name).sort((a, b) => a.localeCompare(b, 'ja')),
    ['ダイコン', 'オオネギ', 'トベラ', 'グミ', 'ウツギ', 'シイ', 'ミカン類', 'ヤブガラシ']
      .sort((a, b) => a.localeCompare(b, 'ja')),
  );
});

test('蝶の明示的な訪花植物一覧を複数種で保持する', () => {
  const rows = readCsv('normalized_data/hostplants.csv')
    .filter((row) => row.reference === '日本産蝶類標準図鑑' && row.life_stage === '成虫' && row.plant_part === '花');
  const keys = new Set(rows.map((row) => `${row.insect_id}:${row.plant_name}`));

  assert.ok(keys.has('species-20215:ネバリノギラン'));
  assert.ok(keys.has('species-20300:タイワンエノキ'));
  assert.ok(keys.has('species-20313:ミヤマアズマギク'));
  assert.ok(keys.has('species-20435:ムニンセンニンソウ'));
});
