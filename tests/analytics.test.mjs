import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPageViewPath,
  syncAnalyticsPreference,
  trackCrossSearch,
  trackDetailSelection,
  trackLegacyMetaLanding,
  trackPageView,
  trackSearch,
  trackSearchNoResults,
  trackError,
  sanitizeErrorText,
  shouldIgnoreError,
  resetTrackedErrorsForTest,
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

test('legacy meta landing records only legacy and clean paths', () => {
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    location: { origin: 'https://orau98.github.io', search: '?ref=external' },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };

  try {
    assert.equal(
      trackLegacyMetaLanding({
        sourcePath: '/meta/moth/species-6016.html',
        targetPath: '/moth/ホソバオビキリガ/',
      }),
      true,
    );
    assert.deepEqual(calls[0].slice(0, 2), ['event', 'legacy_meta_landing']);
    assert.equal(calls[0][2].legacy_path, '/meta/moth/species-6016.html');
    assert.equal(calls[0][2].clean_path, '/moth/ホソバオビキリガ/');
    assert.equal(Object.hasOwn(calls[0][2], 'query'), false);
    assert.equal(trackLegacyMetaLanding({ sourcePath: '', targetPath: '/' }), false);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('searches that found nothing are recorded for data improvements', () => {
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    location: { origin: 'https://orau98.github.io', search: '' },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };
  try {
    assert.equal(trackSearchNoResults({ query: ' ナミアゲハ ', scope: 'insects' }), true);
    assert.equal(trackSearchNoResults({ query: '   ', scope: 'plants' }), false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], 'search_no_results');
    assert.equal(calls[0][2].search_term, 'ナミアゲハ');
    assert.equal(calls[0][2].search_scope, 'insects');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('画面のエラーは exception イベントで1種類につき1回だけ送り、URLはパスだけにする', () => {
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    location: { origin: 'https://orau98.github.io', pathname: '/moth/オオミズアオ/', search: '' },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };
  resetTrackedErrorsForTest();
  try {
    const error = new Error('Dataset request failed: https://orau98.github.io/assets/data-lite/moths.json?v=abc (503)');
    assert.equal(trackError({ kind: 'data_load', error, fatal: true }), true);
    assert.equal(trackError({ kind: 'data_load', error, fatal: true }), false, 'duplicate is not sent twice');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].slice(0, 2), ['event', 'exception']);
    assert.equal(calls[0][2].fatal, true);
    assert.equal(calls[0][2].error_kind, 'data_load');
    assert.equal(calls[0][2].page_path, '/moth/オオミズアオ/');
    assert.equal(calls[0][2].description, 'data_load: Dataset request failed: /assets/data-lite/moths.json (503)');

    // 無害なもの・中断した通信は送らない
    assert.equal(trackError({ kind: 'js_error', message: 'ResizeObserver loop completed with undelivered notifications.' }), false);
    assert.equal(trackError({ kind: 'unhandled_rejection', error: new DOMException('The user aborted a request.', 'AbortError') }), false);
    assert.equal(trackError({ kind: 'js_error', message: 'Script error.' }), false);

    // 1ページあたりの上限
    for (let index = 0; index < 20; index += 1) trackError({ kind: 'js_error', message: `boom ${index}` });
    assert.equal(calls.length, 10);

    // 計測を止めたブラウザでは送らない
    resetTrackedErrorsForTest();
    globalThis.window.localStorage.setItem('orau98.analytics.optOut', '1');
    assert.equal(trackError({ kind: 'js_error', message: 'after opt out' }), false);
  } finally {
    resetTrackedErrorsForTest();
    globalThis.window = previousWindow;
  }
});

test('エラー文の整形: 外部URLはドメインだけ、長さは150文字まで', () => {
  assert.equal(
    sanitizeErrorText('Failed https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=x', 'https://orau98.github.io'),
    'Failed https://pagead2.googlesyndication.com',
  );
  assert.equal(sanitizeErrorText('x'.repeat(400)).length, 150);
  assert.equal(shouldIgnoreError(''), true);
  assert.equal(shouldIgnoreError('TypeError: Load failed'), false);
});
