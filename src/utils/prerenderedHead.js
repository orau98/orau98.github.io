// ビルド時に生成した静的な head（title・description・canonical・hreflang・構造化データ）が
// どのURL向けに作られたかを、アプリが head を書き換える前に記録する。
//
// Google は JavaScript 実行後のページを登録に使う。静的な head と同じページを表示している
// 間にアプリが head を書き換えると、検索向けに作ったタイトルや説明文が別物になり、
// hreflang や構造化データも二重になる。そこで、静的な head が表示中のページ向けのものである
// 間はアプリから書き換えない。アプリ内のリンクで別のページへ移ったら、以後は従来どおり
// アプリが head を更新する（そのとき前のページ向けの静的な hreflang・構造化データは外す）。

const SITE_ORIGIN = 'https://orau98.github.io';

// canonical などのURLを比較用のパスにそろえる。オリジン・%エンコード・末尾スラッシュの
// 違いは同じページとみなす（GitHub Pages は /moth を /moth/ へ転送する）。
export const normalizeSeoPath = (href) => {
  if (!href) return '';
  let pathname = '';
  try {
    pathname = new URL(String(href), SITE_ORIGIN).pathname;
  } catch {
    return '';
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // 不正な%エンコードはそのまま比べる
  }
  return pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, '') || '/';
};

// 静的な head が作られたページのパス。null は未記録、'' は「表示中のページ向けの head ではない」。
let initialCanonicalPath = null;
// 静的な head の robots（検索をやめて戻ったときなどに、この値へ戻す）
let initialRobots = '';
let prerenderedHeadActive = true;

const readInitialCanonicalPath = () => {
  if (initialCanonicalPath !== null) return initialCanonicalPath;
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    initialCanonicalPath = '';
    return initialCanonicalPath;
  }
  // SPA の 404 フォールバック（404.html）は index.html の head の写しで、表示中のURL向けではない
  if (window.__IS_SPA_404__ === true) {
    initialCanonicalPath = '';
    return initialCanonicalPath;
  }
  try {
    const canonical = document.querySelector('link[rel="canonical"]');
    initialCanonicalPath = normalizeSeoPath(canonical?.getAttribute('href') || '');
    initialRobots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
  } catch {
    // head を読めない環境（テスト用の簡易 document など）では静的な head が無いものとして扱う
    initialCanonicalPath = '';
    initialRobots = '';
  }
  return initialCanonicalPath;
};

// アプリが head に触れる前（このファイルの読み込み時）に記録しておく
readInitialCanonicalPath();

// url のページを表示するとき、静的な head をそのまま使うべきなら true。
// url が未確定（データ読み込み中など）の間も、静的な head が残っていれば書き換えない。
export const isPrerenderedHeadFor = (url) => {
  if (!prerenderedHeadActive) return false;
  const initialPath = readInitialCanonicalPath();
  if (!initialPath) return false;
  if (!url) return true;
  return normalizeSeoPath(url) === initialPath;
};

// 静的な head の robots。静的な head を使っていないときは空文字。
export const getPrerenderedRobots = () => (readInitialCanonicalPath() ? initialRobots : '');

// アプリが head を書き換え始めるときに呼ぶ。静的な head は前のページ向けになるため、
// ページ固有の hreflang と構造化データ（アプリが管理していない、id のないもの）を外す。
export const releasePrerenderedHead = () => {
  if (!prerenderedHeadActive) return;
  prerenderedHeadActive = false;
  if (typeof document === 'undefined') return;
  document
    .querySelectorAll('link[rel="alternate"][hreflang]:not([data-managed-seo-alt])')
    .forEach((node) => node.remove());
  document
    .querySelectorAll('head script[type="application/ld+json"]:not([id])')
    .forEach((node) => node.remove());
};

// テスト用: 記録をリセットする
export const resetPrerenderedHeadForTest = () => {
  initialCanonicalPath = null;
  initialRobots = '';
  prerenderedHeadActive = true;
};
