import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAppVersionSuffix,
  buildDataLiteAssetUrl,
  buildLiteSummaryCounts,
  buildPartitionVersionSuffix,
  getCollectionPartitionFile,
  isDatasetCacheComplete,
  isLiteIndexPayload,
  normalizeDatasetPayload,
  normalizePlantPartitions,
  planInitialDataLoad,
  selectCollectionKeysToLoad,
} from '../src/utils/dataLitePlan.js';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';

test('data-lite URLは既存のbuild・manifest版規則を保つ', () => {
  assert.equal(
    buildAppVersionSuffix({ isDevelopment: true, now: 123 }),
    '?v=123',
  );
  assert.equal(
    buildAppVersionSuffix({ buildId: 'build id/1' }),
    '?v=build%20id%2F1',
  );
  assert.equal(buildAppVersionSuffix(), '');
  assert.equal(
    buildPartitionVersionSuffix({ isDevelopment: true, now: 456 }),
    '?v=456',
  );
  assert.equal(
    buildPartitionVersionSuffix({ manifestVersion: 'manifest-abc' }),
    '?v=manifest-abc',
  );
  assert.equal(
    buildDataLiteAssetUrl('/base/', 'catalog/moths.json', '?v=1'),
    '/base/assets/data-lite/catalog/moths.json?v=1',
  );
});

test('一括data-liteの妥当性・件数・キャッシュ復元形を純粋に正規化する', () => {
  const payload = {
    moths: [{ name: 'テストガ', flowerVisitPlants: ['フジ（マメ科）'] }],
    butterflies: [],
    hostPlants: { クヌギ: ['テストガ'] },
    plantDetails: { クヌギ: { family: 'ブナ科' } },
  };

  assert.equal(isLiteIndexPayload(payload), true);
  assert.equal(isLiteIndexPayload({ moths: [] }), false);
  assert.deepEqual(buildLiteSummaryCounts(payload), {
    moths: 1,
    butterflies: 0,
    beetles: 0,
    longhornbeetles: 0,
    barkbeetles: 0,
    leafbeetles: 0,
    aphids: 0,
    hostPlants: 1,
  });

  const normalized = normalizeDatasetPayload(payload);
  assert.equal(normalized.collections.moths, payload.moths);
  assert.deepEqual(normalized.collections.aphids, []);
  assert.deepEqual(normalized.flowerVisitPlants, { フジ: ['テストガ'] });
  assert.equal(normalized.plantDetails, payload.plantDetails);
  assert.equal(normalized.summaryCounts, null);
  assert.equal(normalized.hasAny, true);
});

test('植物パーティションはhost mapを必須にし、補助JSON欠落を空objectへ正規化する', () => {
  assert.equal(normalizePlantPartitions({ hostMap: null }), null);
  assert.deepEqual(
    normalizePlantPartitions({ hostMap: { フジ: ['テストガ'] } }),
    {
      hostMap: { フジ: ['テストガ'] },
      plantDetails: {},
      flowerVisitPlants: {},
    },
  );
});

test('分類パーティションはcatalogからfullへの昇格だけを再取得する', () => {
  const loadedLevels = new Map([
    ['moths', 'catalog'],
    ['butterflies', 'full'],
  ]);
  assert.deepEqual(
    selectCollectionKeysToLoad(
      ['moths', 'butterflies', 'aphids', 'unknown'],
      loadedLevels,
      'catalog',
    ),
    ['aphids'],
  );
  assert.deepEqual(
    selectCollectionKeysToLoad(
      ['moths', 'butterflies', 'aphids'],
      loadedLevels,
      'full',
    ),
    ['moths', 'aphids'],
  );
  assert.equal(getCollectionPartitionFile('moths', 'catalog'), 'catalog/moths.json');
  assert.equal(getCollectionPartitionFile('moths', 'full'), 'moths.json');
});

test('キャッシュ保存は全分類と植物パーティションが揃った時だけ許可する', () => {
  const completeLevels = new Map(
    INSECT_COLLECTION_KEYS.map((key) => [key, 'catalog']),
  );
  assert.equal(isDatasetCacheComplete(completeLevels, { hostMap: {} }), true);
  completeLevels.delete('aphids');
  assert.equal(isDatasetCacheComplete(completeLevels, { hostMap: {} }), false);
  completeLevels.set('aphids', 'catalog');
  assert.equal(isDatasetCacheComplete(completeLevels, null), false);
});

test('初回取得計画はルート、検索、キャッシュ版不一致を一箇所で判定する', () => {
  assert.deepEqual(planInitialDataLoad({ pathname: '/' }), {
    loadPlantsImmediately: false,
    loadTypesImmediately: true,
    cacheVersionMismatch: false,
    immediateCollectionKeys: [...INSECT_COLLECTION_KEYS],
    immediateDetailLevel: 'catalog',
    followUpFullKey: null,
  });

  assert.deepEqual(planInitialDataLoad({ pathname: '/plant' }), {
    loadPlantsImmediately: true,
    loadTypesImmediately: false,
    cacheVersionMismatch: false,
    immediateCollectionKeys: [...INSECT_COLLECTION_KEYS],
    immediateDetailLevel: 'catalog',
    followUpFullKey: null,
  });

  assert.deepEqual(planInitialDataLoad({ pathname: '/moth/オオミズアオ/' }), {
    loadPlantsImmediately: true,
    loadTypesImmediately: true,
    cacheVersionMismatch: false,
    immediateCollectionKeys: ['moths'],
    immediateDetailLevel: 'full',
    followUpFullKey: null,
  });

  const mismatch = planInitialDataLoad({
    pathname: '/moth/オオミズアオ/',
    cacheLoaded: true,
    cachedVersion: 'old',
    manifestVersion: 'new',
  });
  assert.equal(mismatch.cacheVersionMismatch, true);
  assert.equal(mismatch.loadTypesImmediately, true);
  assert.deepEqual(mismatch.immediateCollectionKeys, [...INSECT_COLLECTION_KEYS]);
  assert.equal(mismatch.immediateDetailLevel, 'catalog');
  assert.equal(mismatch.followUpFullKey, 'moths');

  assert.equal(
    planInitialDataLoad({ pathname: '/plant', search: '?q=フジ' })
      .loadTypesImmediately,
    true,
  );
  assert.deepEqual(planInitialDataLoad({ pathname: '/en' }), {
    loadPlantsImmediately: true,
    loadTypesImmediately: true,
    cacheVersionMismatch: false,
    immediateCollectionKeys: [...INSECT_COLLECTION_KEYS],
    immediateDetailLevel: 'catalog',
    followUpFullKey: null,
  });
});
