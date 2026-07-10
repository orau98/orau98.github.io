import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';
import {
  getPublicHostPlantNote,
  getPublicHostPlantSectionNote,
  getPublicHostPlantNoteSegments,
  isInternalHostPlantNoteSegment,
} from '../src/utils/publicHostPlantNotes.js';

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

test('host plant note filter removes OCR audit metadata', () => {
  assert.equal(isInternalHostPlantNoteSegment('OCR索引:19918'), true);
  assert.equal(isInternalHostPlantNoteSegment('19919-19923'), true);
  assert.equal(isInternalHostPlantNoteSegment('OCR名=イシガキトゲウスバカミキリ'), true);
  assert.equal(isInternalHostPlantNoteSegment('curated cleanup 2026-06-25'), true);
  assert.equal(isInternalHostPlantNoteSegment('curated long-block cleanup 2026-06-26'), true);

  assert.deepEqual(
    getPublicHostPlantNoteSegments('OCR索引:19918/19919-19923; OCR名=イシガキトゲウスバカミキリ'),
    [],
  );
  assert.equal(
    getPublicHostPlantNote('葉裏に潜る / OCR索引:19918/19919-19923; OCR名=テスト'),
    '葉裏に潜る',
  );
});

test('host plant note filter removes source locators and redundant structured labels', () => {
  for (const segment of [
    '図鑑4 p.155',
    '掲載頁: 31-32',
    'PDF本文で確認',
    '記録地域: 海外（韓国）',
    '地域根拠: Host trees欄に(Korea)と明記',
    '原著植物名: Picea jezoensis',
    'YList採用名: Picea jezoensis var. jezoensis',
    '寄主根拠: 原著のHost trees欄',
    '海外記録',
    '国外記録',
    'ヨーロッパ',
    'ヨーロッパの記録',
    'ヨーロッパの記録（horseshoe vetch）',
    '中国で記録、日本では未確認',
    '台湾記録',
    'ロシア記録',
    'オーストラリア記録',
    '北アメリカ',
    'マレー半島',
    'パラワン島',
    'ラオス',
    '朝鮮半島',
    '日本での寄主植物は未確認',
  ]) {
    assert.equal(isInternalHostPlantNoteSegment(segment), true, segment);
  }

  assert.equal(
    getPublicHostPlantNote('図鑑4 p.155 / 国外記録 / 葉裏に潜る'),
    '葉裏に潜る',
  );
  assert.equal(
    getPublicHostPlantNote('記録地域: 海外（韓国） / 原著植物名: Picea jezoensis / 掲載頁: 12'),
    '',
  );
});

test('host plant section notes hide source bookkeeping and no-data placeholders', () => {
  assert.equal(
    getPublicHostPlantSectionNote('日本列島の甲虫全種目録(2026)参照。食草・生態情報は未入力。'),
    '',
  );
  assert.equal(
    getPublicHostPlantSectionNote('日本列島の甲虫全種目録(2026)参照。寄主植物情報は日本産カミキリムシにもとづく。'),
    '',
  );
  assert.equal(
    getPublicHostPlantSectionNote('葉裏に潜る。日本列島の甲虫全種目録(2026)参照。'),
    '葉裏に潜る',
  );
  assert.equal(
    getPublicHostPlantSectionNote('材中で越冬。日本列島の甲虫全種目録(2026)参照。'),
    '材中で越冬',
  );
  assert.equal(
    getPublicHostPlantSectionNote(
      '日本列島の甲虫全種目録2026年版 キクイムシ亜科 No.157（2026-07-10参照）。国内分布: HOK, HON, SHI。国外分布: Korea, China。',
    ),
    '',
  );
});

test('normalized hostplant conversion does not expose OCR metadata in public records', () => {
  const converted = convertNormalizedDataToStandardFormat(
    [
      {
        insect_id: 'species-test',
        japanese_name: 'テストカミキリ',
        scientific_name: 'Testus testus',
        family: 'Cerambycidae',
        family_jp: 'カミキリムシ科',
        notes: '日本列島の甲虫全種目録(2026)参照。食草・生態情報は未入力。',
      },
    ],
    [
      {
        record_id: 'hostplant-test-1',
        insect_id: 'species-test',
        plant_name: 'クロガネモチ',
        plant_family: 'モチノキ科',
        observation_type: '文献',
        plant_part: '葉',
        life_stage: '幼虫',
        reference: '日本産カミキリムシ',
        notes: 'OCR索引:19918/19919-19923; OCR名=テストカミキリ',
      },
      {
        record_id: 'hostplant-test-2',
        insect_id: 'species-test',
        plant_name: 'モチノキ',
        plant_family: 'モチノキ科',
        observation_type: '文献',
        plant_part: '葉',
        life_stage: '幼虫',
        reference: '日本産カミキリムシ',
        notes: '葉裏に潜る / OCR索引:19895/19896-19903',
      },
    ],
    [],
  );

  const target = converted.longhornbeetles.find((item) => item.id === 'species-test');
  assert.ok(target);
  assert.equal(target.notes, '');
  assert.deepEqual(
    target.hostPlantsDetailed.map((record) => record.notes),
    ['', '葉裏に潜る'],
  );
});

test('hostplants CSV files do not contain internal OCR or cleanup notes', () => {
  ['normalized_data/hostplants.csv', 'public/hostplants.csv'].forEach((csvPath) => {
    const offenders = parseCsv(csvPath).filter((row) => {
      const notes = row.notes || '';
      return getPublicHostPlantNote(notes) !== notes;
    });
    assert.equal(
      offenders.length,
      0,
      `${csvPath} should not contain visitor-facing internal hostplant notes`,
    );
  });
});

test('overseas status is structured and is not repeated in visitor-facing notes', () => {
  const corrected = new Map([
    ['hostplant-004211', '国外'],
    ['hostplant-004212', '国外'],
    ['hostplant-004213', '国外'],
    ['hostplant-004214', '国外'],
    ['hostplant-PDFAUDIT-20260710-0120', '野外（国外）'],
    ['hostplant-PDFAUDIT-20260710-0121', '野外（国外）'],
  ]);

  for (const csvPath of ['normalized_data/hostplants.csv', 'public/hostplants.csv']) {
    const rows = parseCsv(csvPath);
    const byId = new Map(rows.map((row) => [row.record_id, row]));
    for (const [recordId, observationType] of corrected) {
      const row = byId.get(recordId);
      assert.ok(row, `${csvPath}: missing ${recordId}`);
      assert.equal(row.observation_type, observationType, `${csvPath}: ${recordId}`);
      assert.equal(getPublicHostPlantNote(row.notes || ''), row.notes || '', `${csvPath}: ${recordId}`);
    }
  }
});
