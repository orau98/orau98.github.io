#!/usr/bin/env node
// ビルド結果（dist）を実際のブラウザで開き、主要な画面が壊れていないかを確かめる。
// PRチェック（ci.yml）で `npm run build` の後に実行する。見た目の細部ではなく
// 「開ける・中身が出る・エラーが出ない・スマホで横にはみ出さない」だけを見る。
//
// 使い方: npm run check:browser（事前に npm run build）
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const E = encodeURIComponent;

// 画面ごとに「表示されるまで待つ文字」を決める
export const PAGES = [
  { name: 'トップ（昆虫一覧）', path: '/', waitFor: '件が見つかりました', expectCards: true },
  { name: '植物一覧', path: '/?tab=plants', waitFor: '件が見つかりました' },
  { name: '昆虫の詳細（オオミズアオ）', path: `/moth/${E('オオミズアオ')}/`, waitFor: '食草' },
  { name: '植物の詳細（クヌギ）', path: `/plant/${E('クヌギ')}/`, waitFor: 'クヌギ' },
  { name: '検索（アゲハ）', path: `/?q=${E('アゲハ')}`, waitFor: '件が見つかりました' },
  { name: '英語トップ', path: '/en/', waitFor: 'results' },
  { name: 'クイズ', path: '/quiz', waitFor: '問を始める' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.csv': 'text/csv',
};

// GitHub Pages と同じく、ファイルが無ければ 404.html（SPAの受け皿）を返す簡易サーバー
function startServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!filePath.startsWith(DIST)) { res.writeHead(403).end(); return; }
    let status = 200;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) { filePath = path.join(DIST, '404.html'); status = 404; }
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// 外部サービス（広告・解析・Instagram・フォント）由来のエラーは対象外
const isThirdParty = (text = '') => /googlesyndication|googletagmanager|google-analytics|instagram|fonts\.g|doubleclick|adsbygoogle/i.test(text);

async function checkPage(browser, origin, page, viewport) {
  const context = await browser.newContext({ viewport, locale: page.path.startsWith('/en') ? 'en-US' : 'ja-JP', serviceWorkers: 'block' });
  // 外部への通信は遮断して、ネットワーク状況に左右されないようにする
  await context.route((url) => !url.href.startsWith(origin), (route) => route.abort());
  const tab = await context.newPage();
  const problems = [];
  tab.on('pageerror', (error) => problems.push(`画面のエラー: ${error.message}`));
  tab.on('console', (message) => {
    if (message.type() === 'error' && !isThirdParty(message.text()) && !/Failed to load resource/.test(message.text())) {
      problems.push(`コンソールのエラー: ${message.text().slice(0, 200)}`);
    }
  });
  tab.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(origin) && /\/assets\//.test(url) && response.status() >= 400) problems.push(`読み込み失敗 ${response.status()}: ${url.slice(origin.length)}`);
  });
  const startedAt = Date.now();
  await tab.goto(origin + page.path, { waitUntil: 'domcontentloaded' });
  try {
    await tab.waitForFunction((text) => document.querySelector('main')?.innerText.includes(text), page.waitFor, { timeout: 30000 });
  } catch {
    problems.push(`「${page.waitFor}」が30秒以内に表示されない`);
  }
  await tab.waitForTimeout(1500);
  const state = await tab.evaluate(() => ({
    alert: document.querySelector('[role=alert]')?.innerText || '',
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cards: document.querySelectorAll('#panel-insects article h3').length,
  }));
  if (state.alert) problems.push(`エラー表示: ${state.alert.split('\n')[0]}`);
  if (state.overflow > 2) problems.push(`横にはみ出し ${state.overflow}px`);
  if (page.expectCards && state.cards === 0) problems.push('昆虫カードが1枚も表示されない');
  await context.close();
  return { problems, ms: Date.now() - startedAt };
}

export async function runBrowserSmoke() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist がありません。先に npm run build を実行してください');
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let failures = 0;
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      for (const page of PAGES) {
        const { problems, ms } = await checkPage(browser, origin, page, viewport);
        const label = `${viewport.width < 600 ? 'スマホ' : 'PC'} ${page.name}`;
        if (problems.length) {
          failures += 1;
          console.error(`[smoke-browser] NG ${label}\n  - ${problems.join('\n  - ')}`);
        } else {
          console.log(`[smoke-browser] ok ${label} (${ms}ms)`);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBrowserSmoke()
    .then((failures) => {
      if (failures) {
        console.error(`[smoke-browser] ${failures}件の画面で問題が見つかりました`);
        process.exit(1);
      }
      console.log('[smoke-browser] すべての画面が正常に表示されました');
    })
    .catch((error) => { console.error(error); process.exit(1); });
}
