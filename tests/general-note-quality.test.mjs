import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalizeEcologyNoteType,
  collectGeneralNoteIssues,
  collectLiteratureSourceTaxonIssues,
  normalizeOcrLayoutWhitespace,
} from '../scripts/lib/generalNoteQuality.mjs';

test('normalizeOcrLayoutWhitespace removes OCR line-wrap gaps without collapsing Latin spacing', () => {
  assert.equal(
    normalizeOcrLayoutWhitespace('飛来のピークは19～ 20時頃。気温は5 ℃。♀ の飛来数と♂ 成虫。Sugilania 3種。'),
    '飛来のピークは19～20時頃。気温は5℃。♀の飛来数と♂成虫。Sugilania 3種。',
  );
});

test('canonicalizeEcologyNoteType replaces the legacy ecology label', () => {
  assert.equal(canonicalizeEcologyNoteType('生態'), '生態情報');
  assert.equal(canonicalizeEcologyNoteType('出現時期'), '出現時期');
});

test('collectGeneralNoteIssues rejects subjective prose and source-column bleed', () => {
  const issues = collectGeneralNoteIssues({
    note_type: '生態',
    content: '幸福感に包まれる。日本固有種にふさわしい美しさである。分布図 --- ページ 3 ---',
    page: '',
  });
  assert.ok(issues.includes('subjective_aesthetic'));
  assert.ok(issues.includes('subjective_emotion'));
  assert.ok(issues.includes('page_or_column_bleed'));
  assert.ok(issues.includes('legacy_note_type'));
});

test('quality checks do not misclassify taxon names or ordinary collection prose', () => {
  const issues = collectGeneralNoteIssues({
    note_type: '生態情報',
    content: 'オトシブミの揺籃や変形葉から飼育されている。採集例は多くない。',
    page: '10',
  });
  assert.equal(issues.includes('subjective_aesthetic'), false);
  assert.equal(issues.includes('page_or_column_bleed'), false);

  const headingIssues = collectGeneralNoteIssues({
    note_type: '生態情報',
    content: '［採集例］北海道で1個体。',
    page: '10',
  });
  assert.ok(headingIssues.includes('page_or_column_bleed'));
});

test('quality checks catch source-column prefixes, editorial guidance, and semantic OCR corruption', () => {
  const prefixIssues = collectGeneralNoteIssues({
    note_type: '生態情報',
    content: '寄生: し、害虫と',
    reference: '日本原色アブラムシ図鑑',
    page: '10',
  });
  assert.ok(prefixIssues.includes('source_column_prefix'));

  const editorialIssues = collectGeneralNoteIssues({
    note_type: '生態情報',
    content: '幼虫は葉を綴る．幼生期については，駒井ら(2011)に詳しい',
    reference: '日本のハマキガ1',
    page: '10',
  });
  assert.ok(editorialIssues.includes('editorial_guidance'));

  const semanticIssues = collectGeneralNoteIssues({
    note_type: '出現時期',
    content: '成虫は6～9月に出現するが、おそらく年1化。止山治水にはなり得ない',
    reference: '日本産蛾類標準図鑑3',
    page: '10',
  });
  assert.ok(semanticIssues.includes('known_ocr_semantic_corruption'));
});

test('quality checks catch corrupt longhorn emergence ranges and source-page bleed', () => {
  const reversed = collectGeneralNoteIssues({
    note_type: '出現時期',
    content: '4〜3月',
    reference: '日本産カミキリムシ',
    page: '10',
  });
  assert.ok(reversed.includes('reversed_longhorn_month_range'));

  const monthBleed = collectGeneralNoteIssues({
    note_type: '出現時期',
    content: '5〜8月.［p.75.327］',
    reference: '日本産カミキリムシ',
    page: '10',
  });
  assert.ok(monthBleed.includes('page_or_column_bleed'));
  assert.ok(monthBleed.includes('broken_month_or_column_bleed'));

  const normalWinterRange = collectGeneralNoteIssues({
    note_type: '出現時期',
    content: '11〜3月',
    reference: '日本の冬夜蛾',
    page: '10',
  });
  assert.equal(normalWinterRange.includes('reversed_longhorn_month_range'), false);
});

test('source taxonomy checks catch a moth mislabeled as butterfly literature', () => {
  assert.deepEqual(
    collectLiteratureSourceTaxonIssues('日本産蝶類標準図鑑', { family: 'Oecophoridae' }),
    ['source_target_family_mismatch'],
  );
  assert.deepEqual(
    collectLiteratureSourceTaxonIssues('日本産蝶類標準図鑑', { family: 'Nymphalidae' }),
    [],
  );
  assert.deepEqual(
    collectLiteratureSourceTaxonIssues('日本産カミキリムシ', { family: 'Cerambycidae' }),
    [],
  );
});
