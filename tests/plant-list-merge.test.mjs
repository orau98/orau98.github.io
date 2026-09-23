import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlantCanonicalMaps, countInsectLinkedPlants, mergePlantEntries } from '../src/utils/plantListMerge.js';

const plantDetails = {
  クヌギ: { aliases: ['クヌギ（ブナ科）'], profile: { text: '落葉高木' } },
  ハルニレ: { profile: { text: '説明のみ' } },
  コナラ: { aliases: new Set(['ナラ']) },
};

test('aliases and parenthesised spellings merge into one canonical plant', () => {
  const merged = mergePlantEntries({
    hostPlants: { クヌギ: ['オオミズアオ'], 'クヌギ（ブナ科）': ['ヤママユ'], ナラ: ['アカシジミ'] },
    flowerVisitPlants: { クヌギ: ['オオミズアオ', 'キンケハラナガツチバチ'] },
    plantDetails,
  });
  assert.deepEqual(merged.クヌギ.sort(), ['オオミズアオ', 'キンケハラナガツチバチ', 'ヤママユ'].sort());
  assert.deepEqual(merged.コナラ, ['アカシジミ']);
});

test('plants that only have a profile are kept but not counted as insect-linked', () => {
  const merged = mergePlantEntries({ hostPlants: { クヌギ: ['ヤママユ'] }, plantDetails });
  assert.deepEqual(merged.ハルニレ, []);
  assert.equal(Object.keys(merged).length, 2);
  // タブの件数と植物一覧の既定表示は、昆虫の記録がある植物だけを数える
  assert.equal(countInsectLinkedPlants(merged), 1);
});

test('canonical maps accept array and Set aliases and ignore empty input', () => {
  const { aliasToCanonical } = buildPlantCanonicalMaps(plantDetails);
  assert.equal(aliasToCanonical.get('ナラ'), 'コナラ');
  assert.equal(aliasToCanonical.get('クヌギ（ブナ科）'), 'クヌギ');
  assert.deepEqual(mergePlantEntries(), {});
  assert.equal(countInsectLinkedPlants(), 0);
});
