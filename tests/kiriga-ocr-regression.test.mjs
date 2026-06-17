import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';

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

test('コケイロホソキリガ does not expose OCR-only hostplant note fragments', () => {
  ['normalized_data/hostplants.csv', 'public/hostplants.csv'].forEach((csvPath) => {
    const rows = parseCsv(csvPath);
    const targetRows = rows.filter((row) => row.insect_id === 'species-6031');
    assert.ok(targetRows.length > 0, `${csvPath} should include species-6031 hostplants`);
    assert.equal(
      targetRows.some((row) => ['音', 'し'].includes((row.notes || '').trim())),
      false,
      `${csvPath} should not include OCR note fragments for species-6031`,
    );
    assert.equal(
      targetRows.some((row) => row.record_id === 'hostplant-909482' || row.record_id === 'hostplant-909483'),
      false,
      `${csvPath} should not keep duplicate 日本のキリガ OCR rows for species-6031`,
    );
  });
});

test('コケイロホソキリガ emergence time uses the standard-zukan 10-1 month range', () => {
  ['normalized_data/general_notes.csv', 'public/general_notes.csv'].forEach((csvPath) => {
    const rows = parseCsv(csvPath);
    const targetRows = rows.filter((row) => row.insect_id === 'species-6031');
    assert.equal(
      targetRows.some((row) => (row.content || '').includes('翌年5月')),
      false,
      `${csvPath} should not include the blocked 翌年5月 emergence note for species-6031`,
    );
    assert.equal(
      targetRows.some((row) => row.note_type === '出現時期' && row.content === '10～1月'),
      true,
      `${csvPath} should keep the standard-zukan 10～1月 emergence note`,
    );
  });

  const normalized = convertNormalizedDataToStandardFormat(
    parseCsv('normalized_data/insects.csv'),
    parseCsv('normalized_data/hostplants.csv'),
    parseCsv('normalized_data/general_notes.csv'),
  );
  const target = normalized.moths.find((moth) => moth.id === 'species-6031');
  assert.ok(target, 'normalized moth data should include species-6031');
  assert.equal(target.name, 'コケイロホソキリガ');
  assert.equal(target.emergenceTime, '10～1月');
  assert.equal(
    target.hostPlantsDetailed.some((row) => ['音', 'し'].includes((row.notes || '').trim())),
    false,
  );
});

test('日本のキリガ OCR hostplant rows do not keep short note fragments', () => {
  const blockedNoteTokens = new Set([
    '有',
    '別',
    '例',
    '例T',
    'Mf',
    'M11',
    'N',
    '創',
    '創省',
    '国省',
    '国有',
    '割付',
    '音',
    'し',
  ]);

  ['normalized_data/hostplants.csv', 'public/hostplants.csv'].forEach((csvPath) => {
    const rows = parseCsv(csvPath);
    const kirigaRows = rows.filter((row) => row.reference === '日本のキリガ');
    assert.equal(
      kirigaRows.some((row) => blockedNoteTokens.has((row.notes || '').trim())),
      false,
      `${csvPath} should not keep OCR-only short hostplant notes from 日本のキリガ`,
    );
    assert.equal(
      kirigaRows.some((row) => /（(?:有|別|例|例T|Mf|M11|N|創|創省|国省|国有|割付|音|し)）/.test(row.plant_name || '')),
      false,
      `${csvPath} should not keep OCR-only note parentheses in plant names`,
    );
    assert.equal(
      kirigaRows.some((row) => row.plant_name === '冬規美'),
      false,
      `${csvPath} should not keep fake plant names from OCR text`,
    );

    const mizuki = kirigaRows.find((row) => row.record_id === 'hostplant-909552');
    assert.ok(mizuki, `${csvPath} should keep the テンスジキリガ ミズキ hostplant row`);
    assert.equal(mizuki.plant_name, 'ミズキ');
    assert.equal(mizuki.plant_family, 'ミズキ科');
  });
});
