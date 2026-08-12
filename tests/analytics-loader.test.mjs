import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const postbuildSource = fs.readFileSync(
  path.join(ROOT, 'scripts', 'postbuild-cleanup.mjs'),
  'utf8',
);
const sharedLoaderSource = fs.readFileSync(
  path.join(ROOT, 'public', 'assets', 'analytics-loader.js'),
  'utf8',
);

// GA4 は config より先に届いた page_view を破棄し得るため、公式スニペットと
// 同じく js/config をライブラリロード前にキューへ積む順序を固定する。
// この順序が崩れると、検索流入の大半を占める直帰セッションのPVが消える。
test('index.html queues gtag js/config before the deferred analytics loader', () => {
  const stubPosition = indexHtml.indexOf('window.gtag = window.gtag ||');
  const jsPosition = indexHtml.indexOf("window.gtag('js', new Date())");
  const configPosition = indexHtml.indexOf("window.gtag('config', 'G-MFEQF99G0H'");
  const loaderPosition = indexHtml.indexOf('var loadAnalytics');

  assert.ok(stubPosition !== -1, 'gtag stub definition is missing');
  assert.ok(jsPosition !== -1, "gtag('js') queueing is missing");
  assert.ok(configPosition !== -1, "gtag('config') queueing is missing");
  assert.ok(loaderPosition !== -1, 'deferred analytics loader is missing');
  assert.ok(
    stubPosition < jsPosition && jsPosition < configPosition && configPosition < loaderPosition,
    'gtag stub -> js -> config must all be queued before the deferred loader definition',
  );
});

test('index.html config keeps page_view unified in the SPA PageViewTracker', () => {
  assert.match(
    indexHtml,
    /window\.gtag\('config', 'G-MFEQF99G0H', \{ send_page_view: false \}\)/,
    'config must disable automatic page_view so PageViewTracker stays the single sender',
  );
});

// 種・植物のルートシェルは index.html を継承しない独自テンプレートのため、
// GAローダの抽出・注入が消えると詳細URL直リンクのセッションが丸ごと未計測になる。
test('postbuild route shell templates inject the extracted analytics loader', () => {
  assert.ok(
    postbuildSource.includes('const extractAnalyticsLoaderScript'),
    'extractAnalyticsLoaderScript must exist in postbuild-cleanup.mjs',
  );
  const injectionCount = (postbuildSource.match(/\$\{analyticsScript\}/g) || []).length;
  assert.ok(
    injectionCount >= 2,
    `both insect and plant route shell templates must interpolate analyticsScript (found ${injectionCount})`,
  );
  const throwCount = (postbuildSource.match(/Analytics loader script is missing/g) || []).length;
  assert.ok(
    throwCount >= 2,
    'both shell builders must fail loudly when the analytics loader cannot be extracted',
  );
  assert.match(postbuildSource, /data-send-page-view="false"/);
  assert.match(sharedLoaderSource, /send_page_view: sendPageView/);
});
