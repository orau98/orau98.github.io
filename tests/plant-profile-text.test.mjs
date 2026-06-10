import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlantProfileSummary,
  normalizePlantProfileText,
} from '../src/utils/plantProfileText.js';

test('normalizePlantProfileText removes OCR spaces inside Japanese words', () => {
  assert.equal(
    normalizePlantProfileText('本州（宮 城県・新潟県以南）・四 国・九州'),
    '本州（宮城県・新潟県以南）・四国・九州',
  );
});

test('buildPlantProfileSummary uses only supplied profile facts', () => {
  const summary = buildPlantProfileSummary({
    name: 'アカガシ',
    family: 'ブナ科',
    genus: 'Quercus',
    scientificName: 'Quercus acuta',
    profile: {
      source: '日本の野生植物 第1巻',
      page: '282',
      habit: '常緑高木',
      height: '20m',
      distribution: '本州（宮 城県・新潟県以南）・四国・九州に産し、朝鮮半島南部・中国に分布する',
    },
  });

  assert.match(summary, /アカガシはブナ科の常緑高木です。/);
  assert.match(summary, /学名はQuercus acuta。/);
  assert.match(summary, /属はQuercus。/);
  assert.match(summary, /大きさは20m。/);
  assert.match(summary, /本州（宮城県・新潟県以南）/);
  // 出典は要約文には含めず、SourceCitation コンポーネントで別途表示する仕様に変更
  assert.doesNotMatch(summary, /出典/);
});

test('buildPlantProfileSummary returns an empty string without a profile', () => {
  assert.equal(buildPlantProfileSummary({ name: 'アカガシ' }), '');
});
