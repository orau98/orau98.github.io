import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPlantDisplayData } from '../src/utils/insectCardData.js';
import { buildFlowerVisitMap } from '../src/utils/flowerVisitPlants.js';

test('軽量catalogでも食草と訪花植物を分けてカード表示できる', () => {
  const insect = {
    name: 'テストガ',
    hostPlants: ['ヤナギ（ヤナギ科）'],
    flowerVisitPlants: ['フジ（マメ科）', 'フジ（マメ科）'],
  };
  assert.deepEqual(buildPlantDisplayData(insect), {
    hostNames: ['ヤナギ'],
    flowerNames: ['フジ'],
  });
});

test('軽量catalogの訪花植物から植物逆引きマップを復元できる', () => {
  assert.deepEqual(
    buildFlowerVisitMap([
      { name: 'テストガA', flowerVisitPlants: ['フジ（マメ科）'] },
      { name: 'テストガB', flowerVisitPlants: ['フジ'] },
    ]),
    { フジ: ['テストガA', 'テストガB'] },
  );
});

