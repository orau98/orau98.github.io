import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  INITIAL_SITEMAP_LASTMOD,
  buildSitemapLastmodManifest,
  computePageContentHash,
  loadPreviousSitemapLastmodManifest,
  parseSitemapLastmodManifest,
  resolveSitemapLastmod,
  toSitemapLastmodKey,
} from '../scripts/lib/sitemapLastmod.mjs';

const page = ({ title = 'オオミズアオの食草', description = '説明', main = '<p>ハンノキ</p>', extraHead = '', extraBody = '' } = {}) => `<!DOCTYPE html>
<html lang="ja"><head><title>${title}</title><meta name="description" content="${description}">${extraHead}</head>
<body>${extraBody}<header class="meta-header"><h1>オオミズアオ</h1></header><main class="meta-content">${main}</main></body></html>`;

test('指紋は本文が同じなら、タグ・空白・スクリプト・head の他の要素が変わっても変わらない', () => {
  const base = computePageContentHash(page());
  assert.equal(computePageContentHash(page({ main: '<p class="new">\n  ハンノキ  </p>' })), base);
  assert.equal(computePageContentHash(page({ main: '<p>ハンノキ</p><script>var x = 1;</script>' })), base);
  assert.equal(computePageContentHash(page({ extraHead: '<script src="/assets/index-abc.js"></script><link rel="stylesheet" href="/x.css">' })), base);
  assert.equal(computePageContentHash(page({ extraBody: '<header class="meta-site-header">サイト共通ヘッダー</header>' })), base);
});

test('指紋は本文・見出し・title・説明文・写真の代替テキストが変わると変わる', () => {
  const base = computePageContentHash(page());
  assert.notEqual(computePageContentHash(page({ main: '<p>ハンノキ、クヌギ</p>' })), base);
  assert.notEqual(computePageContentHash(page({ title: 'オオミズアオの食草・寄主植物' })), base);
  assert.notEqual(computePageContentHash(page({ description: '新しい説明' })), base);
  assert.notEqual(computePageContentHash(page({ main: '<p>ハンノキ</p><img src="/a.webp" alt="オオミズアオの写真">' })), base);
});

test('main の無いページは body の表示文字で指紋を作る', () => {
  const html = (text) => `<html><head><title>トップ</title></head><body><div id="root"></div><noscript>${text}</noscript></body></html>`;
  assert.equal(computePageContentHash(html('静的ページ一覧')), computePageContentHash(html('静的ページ一覧')));
  assert.notEqual(computePageContentHash(html('静的ページ一覧')), computePageContentHash(html('別の一覧')));
});

test('記録のキーは %エンコードを戻した URL のパス', () => {
  assert.equal(
    toSitemapLastmodKey('https://orau98.github.io/moth/%E3%82%AA%E3%82%AA%E3%83%9F%E3%82%BA%E3%82%A2%E3%82%AA/'),
    '/moth/オオミズアオ/',
  );
  assert.equal(toSitemapLastmodKey('https://orau98.github.io/'), '/');
});

test('前回と同じ内容なら前回の日付、変わっていれば今日、新しいページは今日', () => {
  const manifest = { version: 1, entries: { '/moth/a/': ['hash-a', '2026-09-20'] } };
  const today = '2026-10-02';
  assert.equal(resolveSitemapLastmod({ manifest, key: '/moth/a/', hash: 'hash-a', today }), '2026-09-20');
  assert.equal(resolveSitemapLastmod({ manifest, key: '/moth/a/', hash: 'hash-b', today }), today);
  assert.equal(resolveSitemapLastmod({ manifest, key: '/moth/new/', hash: 'hash-c', today }), today);
});

test('前回の記録が無いときは全ページを今日にせず、初回の日付にする', () => {
  assert.equal(
    resolveSitemapLastmod({ manifest: null, key: '/moth/a/', hash: 'x', today: '2026-10-02' }),
    INITIAL_SITEMAP_LASTMOD,
  );
});

test('記録に未来の日付や壊れた日付があれば今日にする', () => {
  const today = '2026-10-02';
  const manifest = { version: 1, entries: { '/a/': ['h', '2027-01-01'], '/b/': ['h', 'yesterday'] } };
  assert.equal(resolveSitemapLastmod({ manifest, key: '/a/', hash: 'h', today }), today);
  assert.equal(resolveSitemapLastmod({ manifest, key: '/b/', hash: 'h', today }), today);
});

test('記録は書き出して読み直せる。形の崩れた記録は使わない', () => {
  const manifest = buildSitemapLastmodManifest(
    new Map([['/b/', ['h2', '2026-09-01']], ['/a/', ['h1', '2026-09-13']]]),
    '2026-10-02',
  );
  assert.deepEqual(Object.keys(manifest.entries), ['/a/', '/b/']);
  assert.deepEqual(parseSitemapLastmodManifest(JSON.stringify(manifest)), manifest);
  assert.equal(parseSitemapLastmodManifest('not json'), null);
  assert.equal(parseSitemapLastmodManifest(JSON.stringify({ version: 2, entries: {} })), null);
  assert.equal(parseSitemapLastmodManifest(JSON.stringify({ version: 1, entries: [] })), null);
});

test('公開サイトの記録を読む: 成功・初回(404)・壊れた記録・通信エラー', async () => {
  const manifest = buildSitemapLastmodManifest(new Map([['/a/', ['h', '2026-09-13']]]), '2026-10-01');
  const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, text: async () => body });
  const logs = [];
  const log = (message) => logs.push(message);
  const source = 'https://orau98.github.io/sitemap-lastmod.json';

  assert.deepEqual(
    await loadPreviousSitemapLastmodManifest({ source, fetchImpl: respond(200, JSON.stringify(manifest)), log }),
    manifest,
  );
  assert.equal(await loadPreviousSitemapLastmodManifest({ source, fetchImpl: respond(404, ''), log }), null);
  assert.equal(await loadPreviousSitemapLastmodManifest({ source, fetchImpl: respond(200, '<html>'), log }), null);

  let calls = 0;
  const failing = async () => {
    calls += 1;
    throw new Error('network down');
  };
  assert.equal(await loadPreviousSitemapLastmodManifest({ source, fetchImpl: failing, attempts: 2, log }), null);
  assert.equal(calls, 2);
  assert.equal(await loadPreviousSitemapLastmodManifest({ source: 'none', log }), null);
  assert.ok(logs.length >= 4);
});

test('手元のファイルを前回の記録として読める', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-lastmod-'));
  const file = path.join(dir, 'previous.json');
  const manifest = buildSitemapLastmodManifest(new Map([['/a/', ['h', '2026-09-13']]]), '2026-10-01');
  fs.writeFileSync(file, JSON.stringify(manifest));
  try {
    assert.deepEqual(await loadPreviousSitemapLastmodManifest({ source: file }), manifest);
    assert.equal(await loadPreviousSitemapLastmodManifest({ source: path.join(dir, 'missing.json') }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
