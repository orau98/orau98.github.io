import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getImmediateInsectCollectionKeys,
  getInsectDetailCollectionKey,
  shouldLoadPlantPartitionsImmediately,
} from '../src/utils/insectDataLoading.js';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';

test('個別種ページは該当する昆虫分類だけを初回取得する', () => {
  assert.equal(getInsectDetailCollectionKey('/moth/オオミズアオ/'), 'moths');
  assert.equal(getInsectDetailCollectionKey('/en/aphid/species-123/'), 'aphids');
  assert.deepEqual(
    getImmediateInsectCollectionKeys('/longhornbeetle/species-22628/'),
    ['longhornbeetles'],
  );
});

test('日本語の昆虫一覧では植物詳細を遅延し、必要な経路では即時取得する', () => {
  assert.equal(shouldLoadPlantPartitionsImmediately('/'), false);
  assert.equal(shouldLoadPlantPartitionsImmediately('/moth'), false);
  assert.equal(
    shouldLoadPlantPartitionsImmediately('/', new URLSearchParams('tab=plants')),
    true,
  );
  assert.equal(shouldLoadPlantPartitionsImmediately('/plant'), true);
  assert.equal(shouldLoadPlantPartitionsImmediately('/en'), true);
  assert.equal(shouldLoadPlantPartitionsImmediately('/moth/オオミズアオ/'), true);
});

test('一覧・クイズ・植物ページは部分取得対象として誤判定しない', () => {
  for (const pathname of ['/', '/moth', '/en/moth/', '/quiz', '/plant/キハダ/']) {
    assert.equal(getInsectDetailCollectionKey(pathname), null);
    assert.deepEqual(getImmediateInsectCollectionKeys(pathname), [...INSECT_COLLECTION_KEYS]);
  }
});
