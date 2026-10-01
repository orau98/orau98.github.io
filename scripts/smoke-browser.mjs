#!/usr/bin/env node
// ビルド結果（dist）を実際のブラウザで開き、主要な画面が壊れていないかを確かめる。
// PRチェック（ci.yml）で `npm run build` の後に実行する。見た目の細部ではなく
// 「開ける・中身が出る・エラーが出ない・スマホで横にはみ出さない」だけを見る。
// seo: true の画面は、JavaScript 実行後の title・説明文・canonical・hreflang・robots・
// 構造化データが静的HTMLと同じかも確かめる（Google は実行後のページを登録に使うため）。
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
  { name: 'トップ（昆虫一覧）', path: '/', waitFor: '件が見つかりました', expectCards: true, seo: true },
  { name: '植物一覧', path: '/?tab=plants', waitFor: '件が見つかりました' },
  { name: '昆虫一覧ページ（/moth/）', path: '/moth/', waitFor: '件が見つかりました', seo: true },
  { name: '昆虫の詳細（オオミズアオ）', path: `/moth/${E('オオミズアオ')}/`, waitFor: '食草', seo: true },
  { name: '植物の詳細（クヌギ）', path: `/plant/${E('クヌギ')}/`, waitFor: 'クヌギ', seo: true },
  { name: '検索（アゲハ）', path: `/?q=${E('アゲハ')}`, waitFor: '件が見つかりました' },
  { name: '英語トップ', path: '/en/', waitFor: 'results', seo: true },
  { name: 'クイズ', path: '/quiz', waitFor: '問を始める', seo: true },
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

const decodeEntities = (value = '') => String(value)
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// 構造化データは「種類の一覧」で比べる（@graph はまとめて1つ）
const jsonLdTypeOf = (text) => {
  try {
    const data = JSON.parse(text);
    return data['@graph'] ? 'graph' : [data['@type']].flat().join('+');
  } catch {
    return 'INVALID';
  }
};

// 静的HTML（dist のファイル）から、比べる SEO 情報を取り出す
function readStaticSeo(urlPath) {
  let filePath = path.join(DIST, decodeURIComponent(new URL(urlPath, 'http://x').pathname));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const attr = (tag, name) => decodeEntities(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || '');
  const tags = (pattern) => head.match(pattern) || [];
  const metaContent = (name) => attr(tags(new RegExp(`<meta\\b[^>]*name="${name}"[^>]*>`, 'gi'))[0] || '', 'content');
  return {
    title: decodeEntities(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''),
    description: metaContent('description'),
    robots: tags(/<meta\b[^>]*name="robots"[^>]*>/gi).map((tag) => attr(tag, 'content')).join(' | '),
    canonical: tags(/<link\b[^>]*rel="canonical"[^>]*>/gi).map((tag) => attr(tag, 'href')).join(' | '),
    hreflang: tags(/<link\b[^>]*rel="alternate"[^>]*hreflang="[^"]*"[^>]*>/gi)
      .map((tag) => `${attr(tag, 'hreflang')}=${attr(tag, 'href')}`).sort().join(' '),
    jsonLd: Array.from(html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi))
      .map((match) => jsonLdTypeOf(match[1])).sort().join(' '),
  };
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
  if (page.seo) {
    const expected = readStaticSeo(page.path);
    const rendered = await tab.evaluate(() => {
      // jsonLdTypeOf と同じ判定（ブラウザ側では外の関数を使えないため書き直している）
      const typeOf = (text) => {
        try {
          const data = JSON.parse(text);
          return data['@graph'] ? 'graph' : [data['@type']].flat().join('+');
        } catch {
          return 'INVALID';
        }
      };
      const all = (selector) => Array.from(document.querySelectorAll(selector));
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        robots: all('meta[name="robots"]').map((node) => node.getAttribute('content')).join(' | '),
        canonical: all('link[rel="canonical"]').map((node) => node.getAttribute('href')).join(' | '),
        hreflang: all('link[rel="alternate"][hreflang]')
          .map((node) => `${node.getAttribute('hreflang')}=${node.getAttribute('href')}`).sort().join(' '),
        jsonLd: all('script[type="application/ld+json"]').map((node) => typeOf(node.textContent)).sort().join(' '),
      };
    });
    for (const key of Object.keys(expected)) {
      if (expected[key] !== rendered[key]) {
        problems.push(`SEO情報（${key}）が静的HTMLと違う: 「${expected[key]}」→「${rendered[key]}」`);
      }
    }
  }
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
