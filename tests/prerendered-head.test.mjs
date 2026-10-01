import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPrerenderedRobots,
  isPrerenderedHeadFor,
  normalizeSeoPath,
  releasePrerenderedHead,
  resetPrerenderedHeadForTest,
} from '../src/utils/prerenderedHead.js';

// head を書き換えるかどうかの判定だけを確かめるための、最小限の document の代わり
const installFakeDocument = ({ canonical, robots = '', isSpa404 = false, staticAlternates = 0, staticJsonLd = 0 } = {}) => {
  const removed = [];
  const makeNodes = (count, kind) =>
    Array.from({ length: count }, (_, index) => ({ remove: () => removed.push(`${kind}${index}`) }));
  const alternates = makeNodes(staticAlternates, 'alternate');
  const jsonLd = makeNodes(staticJsonLd, 'jsonld');
  globalThis.window = { __IS_SPA_404__: isSpa404 };
  globalThis.document = {
    querySelector: (selector) => {
      if (selector === 'link[rel="canonical"]' && canonical) return { getAttribute: (name) => (name === 'href' ? canonical : null) };
      if (selector === 'meta[name="robots"]' && robots) return { getAttribute: (name) => (name === 'content' ? robots : null) };
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector.startsWith('link[rel="alternate"]')) return alternates;
      if (selector.startsWith('head script[type="application/ld+json"]')) return jsonLd;
      return [];
    },
  };
  resetPrerenderedHeadForTest();
  return removed;
};

test.afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  resetPrerenderedHeadForTest();
});

test('normalizeSeoPath ignores origin, percent-encoding and trailing slashes', () => {
  assert.equal(normalizeSeoPath('https://orau98.github.io/'), '/');
  assert.equal(normalizeSeoPath('http://127.0.0.1:4173/en'), '/en');
  assert.equal(normalizeSeoPath('https://orau98.github.io/en/'), '/en');
  assert.equal(
    normalizeSeoPath('https://orau98.github.io/moth/%E3%82%AA%E3%82%AA%E3%83%9F%E3%82%BA%E3%82%A2%E3%82%AA/'),
    '/moth/オオミズアオ',
  );
  assert.equal(
    normalizeSeoPath('/aphid/Lutaphis%20alnifoliae%20Shinji%2C%201924/'),
    '/aphid/Lutaphis alnifoliae Shinji, 1924',
  );
  assert.equal(normalizeSeoPath('/quiz/index.html'), '/quiz');
  assert.equal(normalizeSeoPath(''), '');
});

test('keeps the static head while the same page is shown', () => {
  installFakeDocument({ canonical: 'https://orau98.github.io/moth/%E3%82%AA%E3%82%AA%E3%83%9F%E3%82%BA%E3%82%A2%E3%82%AA/' });
  assert.equal(isPrerenderedHeadFor('http://127.0.0.1:4173/moth/オオミズアオ/'), true);
  // データ読み込み中で URL が未確定の間も書き換えない
  assert.equal(isPrerenderedHeadFor(undefined), true);
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/moth/ヤママユ/'), false);
});

test('hub pages match with or without the trailing slash', () => {
  installFakeDocument({ canonical: 'https://orau98.github.io/en/' });
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/en'), true);
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/'), false);
});

test('after the app takes over the head, it keeps updating it and drops page-specific static tags', () => {
  const removed = installFakeDocument({
    canonical: 'https://orau98.github.io/plant/%E3%82%AF%E3%83%8C%E3%82%AE/',
    staticAlternates: 3,
    staticJsonLd: 2,
  });
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/plant/クヌギ/'), true);
  releasePrerenderedHead();
  assert.deepEqual(removed, ['alternate0', 'alternate1', 'alternate2', 'jsonld0', 'jsonld1']);
  // 別ページから戻ってきたときは、head が書き換え済みなのでアプリが更新する
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/plant/クヌギ/'), false);
  releasePrerenderedHead();
  assert.equal(removed.length, 5);
});

test('the SPA 404 fallback head is never treated as the page head', () => {
  installFakeDocument({ canonical: 'https://orau98.github.io/', isSpa404: true });
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/'), false);
  assert.equal(isPrerenderedHeadFor(undefined), false);
});

test('pages without a canonical link are not treated as prerendered', () => {
  installFakeDocument({ canonical: '' });
  assert.equal(isPrerenderedHeadFor('https://orau98.github.io/quiz/'), false);
});

test('remembers the static robots so it can be restored after a search is cleared', () => {
  installFakeDocument({ canonical: 'https://orau98.github.io/meta/plant/x.html', robots: 'noindex, follow' });
  assert.equal(getPrerenderedRobots(), 'noindex, follow');
  installFakeDocument({ canonical: 'https://orau98.github.io/', robots: 'index, follow', isSpa404: true });
  assert.equal(getPrerenderedRobots(), '');
});
