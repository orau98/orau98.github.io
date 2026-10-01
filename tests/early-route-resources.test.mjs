import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEarlyRouteResourceTags,
  stripHomeOnlyPreloads,
} from '../scripts/lib/earlyRouteResources.mjs';
import {
  buildAppVersionSuffix,
  buildDataLiteAssetUrl,
  buildPartitionVersionSuffix,
} from '../src/utils/dataLitePlan.js';

test('先読みの URL はアプリが実際に取りに行く URL と同じ', () => {
  const tags = buildEarlyRouteResourceTags({
    base: '/',
    appBuildId: 'abc 123',
    manifestVersion: '70b2c44d67d493f3',
  });
  const hrefs = tags.map((tag) => tag.attrs.href);
  assert.deepEqual(hrefs, [
    buildDataLiteAssetUrl('/', 'manifest.json', buildAppVersionSuffix({ buildId: 'abc 123' })),
    buildDataLiteAssetUrl('/', 'catalog/home-preview.json', buildPartitionVersionSuffix({ manifestVersion: '70b2c44d67d493f3' })),
  ]);
  assert.ok(tags.every((tag) => tag.attrs.crossorigin === true && tag.attrs.as === 'fetch' && tag.injectTo === 'head'));
  assert.equal(tags[0].attrs['data-route-preload'], undefined);
  assert.equal(tags[1].attrs['data-route-preload'], 'home');
});

test('版が分からないデータは先読みしない', () => {
  assert.deepEqual(buildEarlyRouteResourceTags({ appBuildId: '', manifestVersion: '' }), []);
});

test('トップ以外のページからは最初の48件の先読みだけを外す', () => {
  const html = [
    '<head>',
    '    <link rel="preload" as="fetch" href="/assets/data-lite/manifest.json?v=1" crossorigin>',
    '    <link rel="preload" as="fetch" href="/assets/data-lite/catalog/home-preview.json?v=2" crossorigin data-route-preload="home">',
    '</head>',
  ].join('\n');
  const stripped = stripHomeOnlyPreloads(html);
  assert.ok(stripped.includes('manifest.json'));
  assert.ok(!stripped.includes('home-preview.json'));
});
