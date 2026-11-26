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
  { name: '植物ごとの出典（ウスイロオナガシジミ）', path: `/butterfly/${E('ウスイロオナガシジミ')}/`, waitFor: 'ウラジロガシ', plantSources: true },
  { name: '訪花の書誌（アオスジアオリンガ）', path: `/moth/${E('アオスジアオリンガ')}/`, waitFor: 'リョウブ', flowerCitation: true },
  { name: '植物の詳細（クヌギ）', path: `/plant/${E('クヌギ')}/`, waitFor: 'クヌギ', seo: true, plantTaxonomy: true },
  { name: '観察ガイド（コナラ）', path: `/plant/${E('コナラ')}/`, waitFor: '見つけた場所から虫を調べる', seo: true, observationGuide: true },
  { name: '検索（アゲハ）', path: `/?q=${E('アゲハ')}`, waitFor: '件が見つかりました' },
  { name: '英語トップ', path: '/en/', waitFor: 'results', seo: true },
  { name: 'クイズ', path: '/quiz', waitFor: '問を始める', seo: true, quizFeedback: true },
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
    // 個別ページは、アプリの画面が描けるまで静的HTMLの本文の写し（data-prerendered-snapshot）を出す。
    // 写しにも同じ文字があるので、写しが消えてアプリの画面に切り替わるまで待つ
    await tab.waitForFunction((text) => !document.querySelector('[data-prerendered-snapshot]') &&
      document.querySelector('main')?.innerText.includes(text), page.waitFor, { timeout: 30000 });
  } catch {
    problems.push(`「${page.waitFor}」が30秒以内に表示されない`);
  }
  await tab.waitForTimeout(1500);
  const state = await tab.evaluate(() => ({
    alert: document.querySelector('[role=alert]')?.innerText || '',
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    staticStylesheet: Boolean(document.querySelector('link[href*="meta-styles.css"]')),
    cards: document.querySelectorAll('#panel-insects article h3').length,
  }));
  if (state.alert) problems.push(`エラー表示: ${state.alert.split('\n')[0]}`);
  if (state.overflow > 2) problems.push(`横にはみ出し ${state.overflow}px`);
  // 静的ページ用のスタイルシートは JavaScript 実行前の表示専用。アプリの画面に残ると見た目が崩れる
  if (state.staticStylesheet) problems.push('静的ページ用のスタイルシート（meta-styles.css）がアプリの画面に残っている');
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
  if (page.plantTaxonomy) {
    try {
      const profile = tab.getByRole('region', { name: '解説・植物情報', exact: true });
      const familyLink = { name: 'ブナ科 の植物を検索', exact: true };
      const family = profile.getByRole('link', familyLink);
      await family.waitFor({ timeout: 10000 });
      if (await family.getAttribute('href') !== `/?tab=plants&pfamily=${E('ブナ科')}` ||
          await tab.getByRole('link', familyLink).count() !== 1 ||
          await tab.getByRole('link', { name: 'ブナ科', exact: true }).count() !== 0) {
        problems.push('科名と科での絞り込みが植物情報欄に集約されていない');
      }
    } catch (error) {
      problems.push(`植物情報欄の分類を確認できない: ${error.message.split('\n')[0]}`);
    }
  }
  if (page.observationGuide) {
    const jump = tab.getByRole('link', { name: '虫の記録へ', exact: true });
    const links = tab.locator('[data-plant-observation-guide] a');
    if (await jump.getAttribute('href', { timeout: 3000 }).catch(() => null) !== `${page.path}#related-insects` ||
        !(await links.allTextContents()).includes('ヒロバクロサンカクモンヒメハマキ')) {
      problems.push('コナラの観察ガイドに記録への導線またはドングリの掲載例がない');
    } else {
      await jump.click();
      try {
        await tab.waitForFunction(() => location.hash === '#related-insects' &&
          document.querySelector('#related-insects').getBoundingClientRect().top < innerHeight,
        null, { timeout: 4000 });
      } catch {
        problems.push('虫の記録へのリンクで関連昆虫の一覧に移動できない');
      }
    }
  }
  if (page.quizFeedback) {
    try {
      await tab.getByRole('button', { name: '10問を始める' }).click({ timeout: 10000 });
      const options = tab.getByRole('group', { name: '選択肢' });
      const choices = options.getByRole('button');
      await choices.last().waitFor({ timeout: 25000 });
      if (await choices.count() !== 4) problems.push('クイズの選択肢が4つ表示されない');
      await choices.first().click();
      await options.getByRole('button', { name: /\s正解$/ }).waitFor({ timeout: 5000 });
      const redundant = tab.getByText(/^(正しいつながり|選んだ答え)[:：]/);
      if (await redundant.count() > 0) problems.push('回答済みの選択肢と同じ情報を繰り返し表示している');
      const detailsToggle = tab.getByRole('button', { name: /^(詳しい記録を見る|詳細を閉じる)$/ });
      if (await detailsToggle.count() !== 0) problems.push('クイズの回答欄に重複する詳細ボタンが表示される');
      for (const name of ['昆虫ページへ', '植物ページへ']) {
        if (await tab.getByRole('link', { name, exact: true }).count() !== 1) {
          problems.push(`クイズの回答欄に「${name}」が1件だけ表示されない`);
        }
      }
      await tab.getByRole('button', { name: '次の問題' }).click();
      await tab.getByRole('heading', { name: '2/10', exact: true }).waitFor({ timeout: 5000 });
    } catch (error) {
      problems.push(`クイズの回答後表示を確認できない: ${error.message.split('\n')[0]}`);
    }
  }

  if (page.flowerCitation) {
    try {
      const hosts = tab.getByRole('region', { name: '食草・食樹', exact: true });
      const beech = hosts.getByRole('link', { name: 'ブナ', exact: true });
      const partBadge = beech.locator('xpath=following-sibling::*[1]');
      if (await partBadge.innerText({ timeout: 5000 }) !== '葉' || /幼虫/.test(await hosts.innerText())) {
        problems.push('食草名の直後に部位バッジがない、または幼虫との重複表記が残っている');
      }
      await tab.getByRole('button', { name: /^リョウブの出典/ }).click({ timeout: 10000 });
      const citation = tab.getByRole('link', { name: '池ノ上 利幸 (2008)', exact: true });
      await citation.waitFor({ timeout: 10000 });
      if (!(await citation.getAttribute('href'))?.includes('490264908X')) {
        problems.push('訪花の出典が文献のリンクを表示していない');
      }
    } catch (error) {
      problems.push(`訪花の出典に著者と刊行年が表示されない: ${error.message.split('\n')[0]}`);
    }
  }

  if (page.plantSources) {
    const toggle = tab.getByRole('button', { name: 'ウラジロガシの出典 2件', exact: true });
    try {
      await toggle.waitFor({ timeout: 5000 });
      const row = toggle.locator('xpath=../..');
      const settings = await row.getByRole('group', { name: '観察条件' }).first().innerText();
      if (!settings.includes('野外') || !settings.includes('飼育') || await toggle.getAttribute('aria-expanded') !== 'false') {
        problems.push('植物の行に観察条件が並んでいない、または出典が初期表示で開いている');
      }
      await toggle.press('Enter');
      const sources = await row.getByRole('list', { name: '出典 2件' }).innerText();
      if (await toggle.getAttribute('aria-expanded') !== 'true' || !sources.includes('IRATSUME') || !sources.includes('日本産蝶類標準図鑑')) {
        problems.push('植物の出典を開くと2文献が表示されない');
      }
      await toggle.press('Enter');
      if (await toggle.getAttribute('aria-expanded') !== 'false') problems.push('植物の出典を閉じられない');

      const related = tab.locator('#related-insects');
      const relatedToggle = related.getByRole('button', { name: /ウラジロガシを利用する昆虫 [0-9]+種/ });
      await relatedToggle.waitFor({ timeout: 10000 });
      if (/写真あり[0-9]+種/.test(await related.innerText())) problems.push('関連昆虫に写真付きの種数が重複表示されている');
      const wasOpen = await relatedToggle.getAttribute('aria-expanded');
      await relatedToggle.click();
      if (await relatedToggle.getAttribute('aria-expanded') === wasOpen) problems.push('関連昆虫の行を開閉できない');

      const season = tab.locator('#adult-season');
      const seasonToggle = season.getByRole('button', { name: /^出典 [0-9]+件$/ });
      await seasonToggle.click();
      if (await season.getByRole('list', { name: /^出典 [0-9]+件$/ }).count() !== 1) {
        problems.push('発生時期の出典を同じ形式で開けない');
      }
    } catch (error) {
      problems.push(`植物ごとの出典を確認できない: ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
  return { problems, ms: Date.now() - startedAt };
}

// モックの広告配信で、離れた位置では読み込まず、スクロール時にだけ既存の枠へ
// リクエストすることを検証する。Google への通信や本番の広告表示は発生しない。
async function checkProfileAdLoading(browser, origin) {
  const testOrigin = 'https://ads-test.invalid';
  const scriptPrefix = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  try {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === testOrigin) {
        const response = await route.fetch({ url: origin + url.pathname + url.search });
        await route.fulfill({ response });
        return;
      }
      if (url.href.startsWith(scriptPrefix)) {
        await route.fulfill({
          contentType: 'application/javascript',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: `window.adsbygoogle = {
            push: function () {
              const slot = document.querySelector('ins.adsbygoogle:not([data-adsbygoogle-status])');
              if (slot) slot.setAttribute('data-adsbygoogle-status', 'done');
            }
          };`,
        });
        return;
      }
      await route.abort();
    });
    const tab = await context.newPage();
    await tab.goto(`${testOrigin}/plant/${E('コナラ')}/?qa=1`);
    const contentSlot = tab.locator('main [data-route-page] .manual-ad-slot');
    await contentSlot.waitFor();
    const adScripts = tab.locator(`script[src^="${scriptPrefix}"]`);
    if (await adScripts.count() !== 0 || await contentSlot.locator('ins.adsbygoogle').count() !== 0) {
      throw new Error('初期表示で画面外の広告枠がリクエストされた');
    }

    await contentSlot.scrollIntoViewIfNeeded();
    await contentSlot.locator('ins[data-adsbygoogle-status="done"]').waitFor();
    if (await adScripts.count() !== 1) throw new Error('広告スクリプトは文書につき1つ必要');
    console.log('[smoke-browser] ok スマホ 既存広告枠を表示位置に近づいてから読み込む');
  } finally {
    await context.close();
  }
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
    await checkProfileAdLoading(browser, origin);
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
