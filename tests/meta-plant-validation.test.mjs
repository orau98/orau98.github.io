import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidPlantName } from '../scripts/lib/dataLiteBuilders.mjs';

test('valid Japanese plant names remain indexable', () => {
  const valid = [
    'オニグルミ',
    'オニグルミ(クルミ科)',
    'ソメイヨシノ',
    'コナラ(ブナ科)',
    'ヤマザクラ',
    'イロハモミジ',
    'ススキ',
    'クヌギ(ブナ科)',
    'ハシバミ属',
  ];

  for (const name of valid) {
    assert.equal(isValidPlantName(name), true, `expected valid: ${name}`);
  }
});

test('known malformed plant-name fragments remain non-indexable', () => {
  const invalid = [
    'キョウチクトウ科が',
    'アブラナ科(オオアラセイトウ',
    '記録',
    '記録）',
    'が記録',
    'が記録）',
    '）本州',
    '（オオアラセイトウ',
    ',コウマゴヤシ',
    '、ススキ',
    '-ドクダミ',
    'ーススキ',
    '(本州のみ)',
  ];

  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `expected invalid: ${name}`);
  }
});

test('descriptions are not treated as plant names', () => {
  const invalid = [
    'ススキを好む',
    'コナラの幼虫が食べる',
    '野外でクヌギに産卵',
    '日本では珍しい',
    'ヨーロッパでは害虫',
    'クワ科植物で。',
    'ヤナギで飼育した個体',
    'アブラムシによる被害',
    '5月上旬に発生',
    '6月頃に羽化',
  ];

  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `expected invalid: ${name}`);
  }
});

test('taxonomic tokens and Latin-only fragments are not plant names', () => {
  const invalid = [
    'sp.',
    'spp.',
    'var.',
    'subsp.',
    'comb. nov.',
    'nom. nud.',
    'cf.',
    'aff.',
    'Butler, 1878',
    'Motschulsky, 1866',
    'Carex sp',
    'Corylus',
    'Salix',
    '2020',
    '1878',
  ];

  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `expected invalid: ${name}`);
  }
});

test('empty and unsupported values are not plant names', () => {
  assert.equal(isValidPlantName(''), false);
  assert.equal(isValidPlantName('   '), false);
  assert.equal(isValidPlantName('不明'), false);
  assert.equal(isValidPlantName('ア'), false);
  assert.equal(isValidPlantName('あ'.repeat(51)), false);
  assert.equal(isValidPlantName(null), false);
  assert.equal(isValidPlantName(undefined), false);
  assert.equal(isValidPlantName(12345), false);
});
