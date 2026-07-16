import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPageViewPath,
  syncAnalyticsPreference,
  trackCrossSearch,
  trackDetailSelection,
  trackPageView,
  trackSearch,
} from '../src/utils/analytics.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test('page_view path uses pathname only', () => {
  assert.equal(
    getPageViewPath({ pathname: '/', search: '?tab=plants&q=コナラ', hash: '#results' }),
    '/',
  );
  assert.equal(
    getPageViewPath({ pathname: '/moth/species-1', search: '?from=search' }),
    '/moth/species-1',
  );
});

test('trackPageView sends one real route path without search or hash', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const calls = [];

  globalThis.window = {
    location: { origin: 'https://orau98.github.io', search: '' },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };
  globalThis.document = { title: 'テストページ' };

  try {
    assert.equal(
      trackPageView({
        pathname: '/plant/コナラ',
        search: '?tab=plants&q=コナラ',
        hash: '#related-insects',
      }),
      true,
    );
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].slice(0, 2), ['event', 'page_view']);
    assert.equal(calls[0][2].page_path, '/plant/コナラ');
    assert.equal(calls[0][2].page_location, 'https://orau98.github.io/plant/%E3%82%B3%E3%83%8A%E3%83%A9');
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test('QA and persistent opt-out modes suppress analytics until explicitly restored', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const calls = [];
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  globalThis.window = {
    location: { origin: 'https://orau98.github.io', search: '?qa=1' },
    localStorage,
    sessionStorage,
    gtag: (...args) => calls.push(args),
  };
  globalThis.document = { title: 'QAページ' };

  try {
    assert.equal(syncAnalyticsPreference(), true);
    assert.equal(globalThis.window['ga-disable-G-MFEQF99G0H'], true);
    assert.equal(trackPageView({ pathname: '/' }), false);
    assert.equal(calls.length, 0);

    globalThis.window.location.search = '?analytics=off';
    assert.equal(syncAnalyticsPreference(), true);
    globalThis.window.location.search = '';
    assert.equal(syncAnalyticsPreference(), true);

    globalThis.window.location.search = '?analytics=on';
    assert.equal(syncAnalyticsPreference(), false);
    assert.equal(globalThis.window['ga-disable-G-MFEQF99G0H'], false);
    assert.equal(trackPageView({ pathname: '/' }), true);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test('search and navigation events expose the engagement funnel', () => {
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    location: { origin: 'https://orau98.github.io', search: '' },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };

  try {
    assert.equal(trackSearch({ query: ' アオアツバ ', scope: 'insects' }), true);
    assert.equal(
      trackDetailSelection({
        path: '/moth/アオアツバ',
        contentType: 'moth',
        source: 'search_suggestion',
      }),
      true,
    );
    assert.equal(
      trackCrossSearch({ query: 'クヌギ', fromScope: 'plants', toScope: 'insects' }),
      true,
    );
    assert.equal(trackSearch({ query: '  ' }), false);

    assert.deepEqual(calls.map((call) => call[1]), [
      'search',
      'select_content',
      'cross_search',
    ]);
    assert.equal(calls[0][2].search_term, 'アオアツバ');
    assert.equal(calls[1][2].selection_source, 'search_suggestion');
    assert.equal(calls[2][2].to_scope, 'insects');
  } finally {
    globalThis.window = previousWindow;
  }
});
