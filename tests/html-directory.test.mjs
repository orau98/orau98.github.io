import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHtmlDirectory, directoryLabel } from '../scripts/lib/htmlDirectory.mjs';
import { isStaticDocumentPath } from '../src/utils/staticDocumentPaths.js';

const section = (entries) => ({ key: 'plant', title: '植物の一覧', entries });
const entry = (label) => ({ label, loc: `https://orau98.github.io/plant/${encodeURIComponent(label)}/` });

test('全件へのリンクと全ページへの往復をJSなしで提供し、正規URLの重複を除く', () => {
  const entries = ['エノキ', 'アオキ', 'ウメ', 'イチイ', 'オニグルミ'].map(entry);
  const pages = buildHtmlDirectory([section([...entries, entries[0]])], { pageSize: 2 });
  assert.equal(pages.length, 3);
  const linked = [];
  for (const page of pages) {
    assert.ok(isStaticDocumentPath(page.route), 'SPAが一覧を検索画面に置き換えない');
    assert.ok(page.html.includes(`rel="canonical" href="https://orau98.github.io${page.route}"`));
    const data = JSON.parse(page.html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.ok(data.mainEntity.numberOfItems <= 2);
    const links = [...page.html.matchAll(/<li><a href="([^"]+)">/g)].map((match) => match[1]);
    assert.deepEqual(data.mainEntity.itemListElement.map((item) => new URL(item.url).pathname), links);
    linked.push(...links);
    for (const other of pages) {
      if (other.route !== page.route) assert.ok(page.html.includes(`href="${other.route}"`));
    }
  }
  assert.deepEqual(new Set(linked), new Set(entries.map((item) => new URL(item.loc).pathname)));
  assert.equal(linked.length, entries.length);
});

test('名前のHTML文字を安全に表示し、見出しから文字列だけを取り出す', () => {
  const label = directoryLabel('<h1>A &amp; B <em>&lt;test&gt;</em></h1>');
  assert.equal(label, 'A & B <test>');
  const [{ html }] = buildHtmlDirectory([section([entry(label)])]);
  assert.ok(html.includes('A &amp; B &lt;test&gt;'));
  assert.ok(!html.includes('<test>'));
});

test('外部・旧meta・検索条件付き・見出し欠落のURLを紛れ込ませない', () => {
  for (const loc of ['https://example.com/plant/アオキ/', 'https://orau98.github.io/meta/plant/a.html',
    'https://orau98.github.io/plant/', 'https://orau98.github.io/plant/a/?q=test']) {
    assert.throws(() => buildHtmlDirectory([section([{ label: 'a', loc }])]));
  }
  assert.throws(() => buildHtmlDirectory([section([{ ...entry('アオキ'), label: '' }])]));
});

test('入力順が変わっても出力と更新日の元になる内容が変わらない', () => {
  const entries = ['イチイ', 'エノキ', 'アオキ'].map(entry);
  assert.deepEqual(buildHtmlDirectory([section(entries)]), buildHtmlDirectory([section([...entries].reverse())]));
});
