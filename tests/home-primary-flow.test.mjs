import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const explorerSource = fs.readFileSync(
  new URL('../src/InsectsHostPlantExplorer.jsx', import.meta.url),
  'utf8',
);
const heroSource = fs.readFileSync(
  new URL('../src/components/ExplorerHero.jsx', import.meta.url),
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

test('insect/plant tabs live in the search hero next to the search box', () => {
  const tablist = heroSource.indexOf('role="tablist"');
  const search = heroSource.indexOf('<SearchInput');
  assert.notEqual(tablist, -1, 'the insect/plant tablist should be rendered inside ExplorerHero');
  assert.notEqual(search, -1, 'ExplorerHero should render the search input');
  assert.match(heroSource, /aria-controls=\{panelId\}/, 'tabs must keep controlling the result panels');
  assert.doesNotMatch(
    explorerSource,
    /role="tablist"/,
    'do not add a second tab row between the hero and the results',
  );
  assert.match(explorerSource, /id="panel-insects"/);
  assert.match(explorerSource, /id="panel-plants"/);
});
