import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';
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

test('モンハイイロキリガ and ウスアオキリガ emergence use standard-zukan timing', () => {
  const expected = new Map([
    ['species-6026', { name: 'モンハイイロキリガ', emergenceTime: '9〜11月' }],
    ['species-6027', { name: 'ウスアオキリガ', emergenceTime: '9〜11月' }],
  ]);

  ['normalized_data/general_notes.csv', 'public/general_notes.csv'].forEach((csvPath) => {
    const rows = parseCsv(csvPath);
    expected.forEach((meta, insectId) => {
      const emergenceRows = rows.filter((row) => row.insect_id === insectId && row.note_type === '出現時期');
      assert.equal(
        emergenceRows.some((row) => (row.content || '').includes('翌年5月')),
        false,
        `${csvPath} should not include an OCR-derived 翌年5月 emergence row for ${meta.name}`,
      );
      assert.equal(
        emergenceRows.some((row) => row.content === meta.emergenceTime && row.reference === '日本産蛾類標準図鑑2'),
        true,
        `${csvPath} should keep the standard-zukan emergence row for ${meta.name}`,
      );
    });
  });

  const normalized = convertNormalizedDataToStandardFormat(
    parseCsv('normalized_data/insects.csv'),
    parseCsv('normalized_data/hostplants.csv'),
    parseCsv('normalized_data/general_notes.csv'),
  );
  expected.forEach((meta, insectId) => {
    const target = normalized.moths.find((moth) => moth.id === insectId);
    assert.ok(target, `normalized moth data should include ${meta.name}`);
    assert.equal(target.name, meta.name);
    assert.equal(target.emergenceTime, meta.emergenceTime);
  });
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

test('日本の冬夜蛾 ecology notes exactly match the species-by-species PDF audit', () => {
  const auditRows = parseCsv('data/source_audits/japan-winter-noctuid-ecology.csv');
  const includedAuditRows = auditRows.filter((row) => row.decision === 'include');
  const insectNames = new Map(
    parseCsv('normalized_data/insects.csv').map((row) => [row.insect_id, row.japanese_name]),
  );
  assert.equal(auditRows.length, 83, 'the PDF audit should cover all 83 legacy ecology rows');
  assert.equal(new Set(auditRows.map((row) => row.record_id)).size, 83);
  assert.equal(new Set(auditRows.map((row) => row.insect_id)).size, 83);
  assert.equal(includedAuditRows.length, 83, 'all audited rows should have approved objective content');
  includedAuditRows.forEach((audit) => {
    assert.equal(insectNames.get(audit.insect_id), audit.japanese_name);
  });

  ['normalized_data/general_notes.csv', 'public/general_notes.csv'].forEach((csvPath) => {
    const rows = parseCsv(csvPath);
    const legacyRows = rows.filter(
      (row) => row.reference === '日本のキリガ' && ['生態', '生態情報'].includes(row.note_type),
    );
    assert.equal(legacyRows.length, 0, `${csvPath} should not keep legacy unaudited ecology rows`);

    const actualRows = rows.filter(
      (row) => row.reference === '日本の冬夜蛾' && row.note_type === '生態情報',
    );
    assert.equal(actualRows.length, includedAuditRows.length, `${csvPath} should match the audit row count`);
    const actualById = new Map(actualRows.map((row) => [row.record_id, row]));

    includedAuditRows.forEach((audit) => {
      const actual = actualById.get(audit.record_id);
      assert.ok(actual, `${csvPath} should include ${audit.record_id} (${audit.japanese_name})`);
      assert.equal(actual.insect_id, audit.insect_id);
      assert.equal(actual.content, audit.approved_content);
      assert.equal(actual.page, audit.printed_page);
      assert.deepEqual(
        collectGeneralNoteIssues(actual),
        [],
        `${csvPath} should keep only publishable objective content for ${audit.japanese_name}`,
      );
    });

    const allContent = actualRows.map((row) => row.content).join('\n');
    assert.doesNotMatch(allContent, /条件に恵まれると|幸福感|美しさである/);
    const tanigawa = actualById.get('note-1004752');
    assert.equal(
      tanigawa.content,
      '灯火採集で得られる。飛来のピークは19～20時頃。気温が5℃を下回るような寒い日でもライトに飛来する。♀の飛来数は少ない。山地のブナやカツラ、イタヤカエデなどが生える林で採れている。',
    );
    assert.equal(tanigawa.page, '54');
  });
});
