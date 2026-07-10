import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const explorerSource = fs.readFileSync(
  new URL('../src/InsectsHostPlantExplorer.jsx', import.meta.url),
  'utf8',
);

test('homepage keeps the search hero directly adjacent to the results tabs', () => {
  const heroStart = explorerSource.indexOf('<ExplorerHero');
  const heroEnd = explorerSource.indexOf('/>', heroStart);
  const resultsStart = explorerSource.indexOf(
    '<div id="explorer-results"',
    heroEnd,
  );

  assert.notEqual(heroStart, -1, 'ExplorerHero render was not found');
  assert.notEqual(heroEnd, -1, 'ExplorerHero closing tag was not found');
  assert.notEqual(resultsStart, -1, 'explorer results container was not found');

  const betweenHeroAndResults = explorerSource
    .slice(heroEnd + 2, resultsStart)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .trim();

  assert.equal(
    betweenHeroAndResults,
    '',
    'do not insert cards, banners, SEO hubs, or other competing content between search and results',
  );
});

test('homepage does not reintroduce the removed static discovery block', () => {
  assert.doesNotMatch(
    explorerSource,
    /DiscoveryLinks|shouldShowDiscoveryLinks|data-home-discovery-links|目的から探す|Browse by topic/,
  );
});
