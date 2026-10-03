import test from 'node:test';
import assert from 'node:assert/strict';
import {
  capturePrerenderedSnapshot,
  getPrerenderedSnapshot,
  getPrerenderedSnapshotFor,
  normalizeSnapshotPath,
  releasePrerenderedSnapshot,
  resetPrerenderedSnapshotForTest,
  subscribePrerenderedSnapshot,
  toSnapshotHtml,
} from '../src/utils/prerenderedSnapshot.js';

// postbuild-cleanup が個別ページの #root に入れる本文と同じ形
const SHELL_BODY = `
<header class="meta-header"><h1>オオミズアオ</h1></header><main class="meta-content"><section class="basic-info"><h3>基本情報</h3></section><aside class="manual-ad-slot" aria-label="広告" style="margin:32px 0"><div class="manual-ad-label">広告</div><ins class="adsbygoogle"
             data-ad-slot="2212346930"></ins></aside></main>
    `;

const fakeRoot = (html, profile = 'insect') => ({
  innerHTML: html,
  getAttribute: (name) => (name === 'data-static-profile' ? profile : null),
});

// 静的ページ用のスタイルシートを外したかを数える簡易 document
const withFakeDocument = async (run) => {
  const removed = [];
  const previous = globalThis.document;
  globalThis.document = {
    querySelectorAll: (selector) => (selector.includes('meta-styles.css')
      ? [{ remove: () => removed.push(selector) }]
      : []),
  };
  try {
    await run(removed);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
};

test('写しから静的ページ用の広告枠を外し、main を div にする（アプリの main と入れ子にしない）', () => {
  const html = toSnapshotHtml(SHELL_BODY);
  assert.ok(html.startsWith('<header class="meta-header"><h1>オオミズアオ</h1>'));
  assert.ok(!/adsbygoogle|manual-ad-slot|<aside/.test(html));
  assert.ok(!/<main\b|<\/main>/.test(html));
  assert.ok(html.includes('<div class="meta-content">'));
  assert.ok(html.includes('<h3>基本情報</h3>'));
});

test('パスは %エンコードと末尾スラッシュの違いを同じページとみなす', () => {
  assert.equal(
    normalizeSnapshotPath('/moth/%E3%82%AA%E3%82%AA%E3%83%9F%E3%82%BA%E3%82%A2%E3%82%AA/'),
    '/moth/オオミズアオ',
  );
  assert.equal(normalizeSnapshotPath('/moth/オオミズアオ'), '/moth/オオミズアオ');
  assert.equal(normalizeSnapshotPath('/'), '/');
});

test('最初に開いたページでだけ写しを使い、別のページでは使わない', () => {
  resetPrerenderedSnapshotForTest();
  capturePrerenderedSnapshot(fakeRoot(SHELL_BODY), '/moth/%E3%82%AA%E3%82%AA%E3%83%9F%E3%82%BA%E3%82%A2%E3%82%AA/');
  const snapshot = getPrerenderedSnapshotFor('/moth/オオミズアオ/');
  assert.ok(snapshot);
  assert.equal(snapshot.profile, 'insect');
  // React に毎回同じオブジェクトを渡し、描き直しで innerHTML を入れ直させない
  assert.equal(snapshot.markup.__html, snapshot.html);
  assert.equal(getPrerenderedSnapshotFor('/moth/オオミズアオ').markup, snapshot.markup);
  assert.equal(getPrerenderedSnapshotFor('/moth/オナガミズアオ/'), null);
  assert.equal(getPrerenderedSnapshotFor('/'), null);
  releasePrerenderedSnapshot();
  assert.equal(getPrerenderedSnapshotFor('/moth/オオミズアオ/'), null);
});

test('本文の無いページ（トップなど）では写しを取らず、静的ページ用のスタイルシートをすぐ外す', async () => {
  resetPrerenderedSnapshotForTest();
  await withFakeDocument(async (removed) => {
    assert.equal(capturePrerenderedSnapshot(fakeRoot('', ''), '/'), null);
    assert.equal(capturePrerenderedSnapshot(null, '/'), null);
    assert.equal(removed.length, 2);
  });
});

test('ページの画面を描いたら写しを片付け、表示側へ知らせ、静的ページ用のスタイルシートを外す', async () => {
  resetPrerenderedSnapshotForTest();
  await withFakeDocument(async (removed) => {
    capturePrerenderedSnapshot(fakeRoot(SHELL_BODY), '/plant/クヌギ/');
    assert.equal(removed.length, 0, '写しを出している間は静的ページ用のスタイルシートを残す');
    let notified = 0;
    const unsubscribe = subscribePrerenderedSnapshot(() => { notified += 1; });
    assert.ok(getPrerenderedSnapshot());

    releasePrerenderedSnapshot();
    assert.equal(getPrerenderedSnapshot(), null);
    assert.equal(getPrerenderedSnapshotFor('/plant/クヌギ/'), null);
    assert.equal(notified, 1);
    assert.equal(removed.length, 1);

    // 2回目以降は知らせない（スタイルシートは念のため外し直す）
    releasePrerenderedSnapshot();
    assert.equal(notified, 1);
    unsubscribe();
  });
});
