import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import { normalizeHostRecord } from '../src/utils/hostRecord.js';
import { getPlantUsage, getPlantInsectUsage, uniqueInsects } from '../scripts/lib/plantUsage.mjs';

const normalizeName = (value) => String(value || '').replace(/[（(][^）)]*[）)]/g, '').trim();
const record = (plant_name, life_stage, plant_part) => normalizeHostRecord({ plant_name, life_stage, plant_part });

test('real Graphium records retain 15 host entries and 8 adult flower entries', () => {
  const rows = Papa.parse(fs.readFileSync(new URL('../normalized_data/hostplants.csv', import.meta.url), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const insect = { hostPlantsDetailed: rows.filter((row) => row.insect_id === 'species-20176').map(normalizeHostRecord) };
  const usage = getPlantUsage(insect);
  assert.equal(usage.hostPlants.length, 15);
  assert.equal(usage.flowerPlants.length, 8);
  assert.ok(usage.hostPlants.includes('クスノキ'));
  assert.ok(!usage.hostPlants.includes('ヤブガラシ'));
  assert.ok(usage.flowerPlants.includes('ヤブガラシ'));
});

test('flower-only detail must not fall back to the legacy combined plant list', () => {
  const usage = getPlantUsage({ hostPlants: ['ヤブガラシ', '不明'], hostPlantsDetailed: [record('ヤブガラシ', '成虫', '花')] });
  assert.deepEqual(usage, { hostPlants: [], flowerPlants: ['ヤブガラシ'] });
});

test('stage uncertainty, adult leaf feeding and larval flower feeding are not relabeled adult visits', () => {
  const rows = [record('ガマズミ', '', '花'), record('クヌギ', '成虫', '葉'), record('サクラ', '幼虫', '花'), record('トベラ', '成虫', '花梗')];
  assert.equal(getPlantUsage({ hostPlantsDetailed: rows }).hostPlants.length, 4);
  assert.equal(getPlantUsage({ hostPlantsDetailed: rows }).flowerPlants.length, 0);
  assert.equal(rows[0].lifeStage, '');
});

test('reverse lookup deduplicates insects but retains both plant relations', () => {
  const insect = { id: 'dual', hostPlantsDetailed: [record('サクラ', '幼虫', '葉'), record('サクラ', '成虫', '花'), record('サクラ', '成虫', '花')] };
  assert.equal(uniqueInsects([insect, insect]).length, 1);
  assert.deepEqual(getPlantInsectUsage(insect, 'サクラ(バラ科)', normalizeName), { host: true, flower: true });
  assert.deepEqual(getPlantInsectUsage(insect, 'クヌギ', normalizeName), { host: false, flower: false });
});

test('legacy-only records and existing substrate associations remain available', () => {
  assert.deepEqual(getPlantUsage({ hostPlants: 'クヌギ; コナラ; クヌギ; 不明' }).hostPlants, ['クヌギ', 'コナラ']);
  assert.deepEqual(getPlantUsage({ hostPlantsDetailed: [record('枯木', '幼虫', '材部')] }).hostPlants, ['枯木']);
});

// Existing data includes a collective family name transformed into a page key.
test('reverse lookup accepts an already normalized legacy page key', () => {
  const normalize = (value) => value === 'バラ科の木' ? '木(バラ科)' : value.replace('(バラ科)', '');
  const insect = { hostPlantsDetailed: [record('バラ科の木', '幼虫', '')] };
  assert.deepEqual(getPlantInsectUsage(insect, '木(バラ科)', normalize), { host: true, flower: false });
});
