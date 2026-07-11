import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSECT_ID = 'species-0294';
const RESOURCE_NAME = '朽ち木・枯れ木の樹皮';
const SOURCE_TEXT = '朽ち木; 枯れ木の樹皮。古くなった竹の柵でも幼虫を採集';

const readCsv = (relativePath, { allowParseErrors = false } = {}) => {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (!allowParseErrors) {
    assert.equal(parsed.errors.length, 0, `${relativePath} should parse without errors`);
  }
  return parsed.data;
};

test('マダラシロツマオレガの枯死木資源は原典どおり1レコードに統合する', () => {
  const sourceRow = readCsv('archive/public-archive/legacy-data/ListMJ_hostplants_master.csv', {
    allowParseErrors: true,
  }).find((row) => row['和名'] === 'マダラシロツマオレガ');

  assert.ok(sourceRow, '旧マスターに対象種が存在する');
  assert.equal(sourceRow['食草'], SOURCE_TEXT);

  for (const relativePath of ['normalized_data/hostplants.csv', 'public/hostplants.csv']) {
    const rows = readCsv(relativePath).filter((row) => row.insect_id === INSECT_ID);
    assert.equal(rows.length, 1, `${relativePath} should contain one consolidated resource row`);
    assert.deepEqual(
      {
        record_id: rows[0].record_id,
        plant_name: rows[0].plant_name,
        plant_part: rows[0].plant_part,
        life_stage: rows[0].life_stage,
        reference: rows[0].reference,
        notes: rows[0].notes,
      },
      {
        record_id: 'hostplant-000270',
        plant_name: RESOURCE_NAME,
        plant_part: '',
        life_stage: '幼虫',
        reference: '日本産蛾類標準図鑑3',
        notes: '古くなった竹の柵でも幼虫を採集',
      },
    );
  }

  const insectRow = readCsv('normalized_data/insects.csv', { allowParseErrors: true })
    .find((row) => row.insect_id === INSECT_ID);
  const normalizedHostRows = readCsv('normalized_data/hostplants.csv')
    .filter((row) => row.insect_id === INSECT_ID);
  const converted = convertNormalizedDataToStandardFormat([insectRow], normalizedHostRows, []);
  const target = converted.moths.find((moth) => moth.id === INSECT_ID);

  assert.ok(target, '表示用の蛾データに対象種が存在する');
  assert.equal(target.hostPlantsDetailed.length, 1);
  assert.equal(target.hostPlantsDetailed[0].name, RESOURCE_NAME);
  assert.equal(target.hostPlantsDetailed[0].plantPart, '');
  assert.equal(target.hostPlantsDetailed[0].resourceType, 'substrate');
});
