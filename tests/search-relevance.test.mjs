import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SEARCH_MATCH_TIER,
  getSearchMatchTier,
  splitNameList,
} from '../src/utils/searchRelevance.js';

const { EXACT, PREFIX, PARTIAL, OTHER } = SEARCH_MATCH_TIER;

test('和名は完全一致 → 前方一致 → 部分一致 → それ以外の順に段階づける', () => {
  assert.equal(getSearchMatchTier({ names: ['アゲハ'] }, 'アゲハ'), EXACT);
  assert.equal(getSearchMatchTier({ names: ['アゲハモドキ本土亜種'] }, 'アゲハ'), PREFIX);
  assert.equal(getSearchMatchTier({ names: ['アオスジアゲハ'] }, 'アゲハ'), PARTIAL);
  // 科名（アゲハモドキガ科）だけで一致した種は名前一致より後ろ
  assert.equal(getSearchMatchTier({ names: ['キンモンガ'] }, 'アゲハ'), OTHER);
});

test('ひらがな・半角カナ・大文字小文字の表記ゆれを吸収する', () => {
  assert.equal(getSearchMatchTier({ names: ['アゲハ'] }, 'あげは'), EXACT);
  assert.equal(getSearchMatchTier({ names: ['ハンノキ'] }, 'ﾊﾝﾉｷ'), EXACT);
  assert.equal(getSearchMatchTier({ names: ['クヌギ'] }, ' くぬぎ '), EXACT);
});

test('別名（旧和名など）での一致も名前一致として扱う', () => {
  const names = ['ウスバアゲハ', ...splitNameList('ウスバシロチョウ')];
  assert.equal(getSearchMatchTier({ names }, 'ウスバシロチョウ'), EXACT);
  assert.deepEqual(splitNameList('アゲハモドキ、オナガアゲハモドキ,キンモンガ'), [
    'アゲハモドキ',
    'オナガアゲハモドキ',
    'キンモンガ',
  ]);
  assert.deepEqual(splitNameList('A b; C d', /[;；]/), ['A b', 'C d']);
});

test('学名は属名＋種小名の入力なら著者名付きでも完全一致、属名だけなら前方一致', () => {
  const scientificNames = ['Papilio xuthus Linnaeus, 1767'];
  assert.equal(getSearchMatchTier({ scientificNames }, 'Papilio xuthus'), EXACT);
  assert.equal(getSearchMatchTier({ scientificNames }, 'papilio  xuthus'), EXACT);
  assert.equal(getSearchMatchTier({ scientificNames }, 'Papilio'), PREFIX);
  assert.equal(getSearchMatchTier({ scientificNames }, 'Papilio x'), PREFIX);
  // 種小名の一部に属名が含まれるだけ（Geometra papilionaria）は部分一致
  assert.equal(
    getSearchMatchTier({ scientificNames: ['Geometra papilionaria (Linnaeus, 1758)'] }, 'Papilio'),
    PARTIAL,
  );
});

test('検索語が空なら全件同じ段階（並び替えに影響しない）', () => {
  assert.equal(getSearchMatchTier({ names: ['アゲハ'] }, ''), OTHER);
  assert.equal(getSearchMatchTier({ names: ['アゲハ'] }, '   '), OTHER);
  assert.equal(getSearchMatchTier({}, 'アゲハ'), OTHER);
});

test('一致度で並べると、実データで埋もれていた本命が先頭に来る', () => {
  const insects = [
    { name: 'アオスジアゲハ', scientificName: 'Graphium sarpedon Linnaeus, 1758' },
    { name: 'ウスバアゲハ', scientificName: 'Parnassius citrinarius Motschulsky, 1866' },
    { name: 'キンモンガ', scientificName: 'Psychostrophia melanargia Butler, 1877' },
    { name: 'アゲハ', scientificName: 'Papilio xuthus Linnaeus, 1767' },
    { name: 'アゲハモドキ本土亜種', alternativeNames: 'アゲハモドキ', scientificName: 'Epicopeia hainesii hainesii Holland, 1889' },
  ];
  const tierOf = (insect) => getSearchMatchTier({
    names: [insect.name, ...splitNameList(insect.alternativeNames)],
    scientificNames: [insect.scientificName],
  }, 'アゲハ');
  const ordered = [...insects].sort((a, b) => tierOf(a) - tierOf(b)).map((insect) => insect.name);
  assert.deepEqual(ordered.slice(0, 2), ['アゲハ', 'アゲハモドキ本土亜種']);
  assert.equal(ordered.at(-1), 'キンモンガ');
});
