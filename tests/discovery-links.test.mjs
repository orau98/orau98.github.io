import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISCOVERY_HUB_LINKS,
  getDiscoveryHubLinks,
  JAPANESE_PLANT_DISCOVERY_LINKS,
  shouldShowDiscoveryLinks,
} from '../src/utils/discoveryLinks.js';

test('discovery hubs point directly to the three canonical static indexes', () => {
  assert.deepEqual(getDiscoveryHubLinks('ja'), DISCOVERY_HUB_LINKS.ja);
  assert.deepEqual(getDiscoveryHubLinks('en'), DISCOVERY_HUB_LINKS.en);
  assert.deepEqual(
    DISCOVERY_HUB_LINKS.ja.map(({ path }) => path),
    [
      '/meta/butterfly/index.html',
      '/meta/moth/index.html',
      '/meta/plant/index.html',
    ],
  );
  assert.deepEqual(
    DISCOVERY_HUB_LINKS.en.map(({ path }) => path),
    [
      '/en/meta/butterfly/index.html',
      '/en/meta/moth/index.html',
      '/en/meta/plant/index.html',
    ],
  );

  for (const [locale, links] of Object.entries(DISCOVERY_HUB_LINKS)) {
    assert.equal(links.length, 3);
    assert.equal(new Set(links.map(({ path }) => path)).size, links.length);
    for (const link of links) {
      assert.match(link.path, locale === 'en' ? /^\/en\/meta\// : /^\/meta\//);
      assert.match(link.path, /\/index\.html$/);
      assert.ok(link.label);
      assert.ok(link.description);
    }
  }
});

test('Japanese discovery links keep the reviewed 12 plant targets unique and canonical', () => {
  const expectedLinks = [
    ['クヌギ', 'クヌギにつく虫'],
    ['コナラ', 'コナラにつく虫'],
    ['アカメガシワ', 'アカメガシワにつく虫'],
    ['ヨモギ', 'ヨモギを食べる虫'],
    ['ケヤキ', 'ケヤキにつく虫'],
    ['エゴノキ', 'エゴノキにつく虫'],
    ['サクラ', 'サクラにつく虫・毛虫'],
    ['カエデ', 'カエデにつく虫・毛虫'],
    ['サンショウ', 'サンショウにつく幼虫'],
    ['クチナシ', 'クチナシにつく幼虫'],
    ['ウンシュウミカン', 'ミカンの木につく幼虫'],
    ['ツワブキ', 'ツワブキを食べる虫'],
  ];

  assert.deepEqual(
    JAPANESE_PLANT_DISCOVERY_LINKS.map(({ plantName, label }) => [plantName, label]),
    expectedLinks,
  );
  assert.equal(
    new Set(JAPANESE_PLANT_DISCOVERY_LINKS.map(({ path }) => path)).size,
    JAPANESE_PLANT_DISCOVERY_LINKS.length,
  );
  for (const { plantName, label, path } of JAPANESE_PLANT_DISCOVERY_LINKS) {
    assert.equal(path, `/meta/plant/${encodeURIComponent(plantName)}.html`);
    assert.match(label, /虫|幼虫/);
  }
});

test('discovery links appear only on an unfiltered Japanese or English home route', () => {
  assert.equal(shouldShowDiscoveryLinks('/', ''), true);
  assert.equal(shouldShowDiscoveryLinks('/en', '   '), true);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?tab=insects'), true);
  assert.equal(shouldShowDiscoveryLinks('/en/', '', '?tab=plants&utm_source=search'), true);
  assert.equal(shouldShowDiscoveryLinks('/', 'クヌギ'), false);
  assert.equal(shouldShowDiscoveryLinks('/en', 'Quercus'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?tab=plants&pfamily=ブナ科'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?tab=insects&ifamily=ヤガ科'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?tab=insects&ipage=2'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?classification=チョウ目'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?search=クヌギ'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?term=クヌギ'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?page=2'), false);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?tab=insects&iview=compact&isort=name&iper=48'), true);
  assert.equal(shouldShowDiscoveryLinks('/', '', '?tab=plants&pview=compact&psort=name&pper=48'), true);
  assert.equal(shouldShowDiscoveryLinks('/moth', ''), false);
  assert.equal(shouldShowDiscoveryLinks('/plant', ''), false);
  assert.equal(shouldShowDiscoveryLinks('/en/moth', ''), false);
  assert.equal(shouldShowDiscoveryLinks('/en/plant', ''), false);
});
