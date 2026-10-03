// 個別ページ（昆虫・植物）の静的HTMLには、JavaScript 実行前の表示用に本文（見出し＋main）が入っている。
// 以前はアプリの起動時にこの本文を消し、データがそろうまでスケルトン（骨組み）を出していたため、
// 遅い回線では一度見えた本文が数秒間消えていた。起動時に本文の写しを取っておき、
// そのページの画面が描けるまでは写しを表示し続ける（components/PrerenderedSnapshot）。
//
// 写しの見た目は静的ページ用のスタイルシート（meta-styles.css）が担う。このスタイルシートは
// h2・section・dl などの要素全体に効くため、ページの画面を描いたら外す
// （外さないと、直接開いたときだけアプリの画面に二重の枠や見出しの縦線が付いていた）。

const STATIC_STYLESHEET_SELECTOR = 'link[rel="stylesheet"][href*="meta-styles.css"]';

// 写しを使ってよいかの判定用にパスをそろえる（%エンコード・末尾スラッシュの違いは同じページ）
export const normalizeSnapshotPath = (pathname = '') => {
  let value = String(pathname || '').split(/[?#]/, 1)[0] || '/';
  try {
    value = decodeURIComponent(value);
  } catch {
    // 不正な%エンコードはそのまま比べる
  }
  return value.replace(/\/+$/, '') || '/';
};

// 静的HTMLの本文を、アプリの画面内に置ける形にする。
// - 静的ページ用の広告枠（中身の入っていない ins）は外す。残すとアプリの広告枠より先に
//   こちらへ広告が入り、本文と一緒に消えてしまう
// - アプリ側に main があるので、main の入れ子（ランドマークの重複）にならないよう div にする
export const toSnapshotHtml = (html = '') => String(html || '')
  .replace(/<aside\b[^>]*\bclass="[^"]*\bmanual-ad-slot\b[^"]*"[^>]*>[\s\S]*?<\/aside>/gi, '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<main\b/gi, '<div')
  .replace(/<\/main>/gi, '</div>')
  .trim();

let snapshot = null;
const listeners = new Set();

// 静的ページ用のスタイルシートを外す（写しを片付けるときにも外す）
export const removeStaticStylesheet = () => {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  try {
    document.querySelectorAll(STATIC_STYLESHEET_SELECTOR).forEach((node) => node.remove());
  } catch {
    // スタイルシートを外せなくても表示は続ける
  }
};

/**
 * React が #root を描き換える前に呼び、静的HTMLの本文の写しを取る。
 * 写しが無いページ（トップなど）では、静的ページ用のスタイルシートが残っていればすぐ外す。
 */
export const capturePrerenderedSnapshot = (rootElement, pathname = '') => {
  snapshot = null;
  try {
    const profile = rootElement?.getAttribute?.('data-static-profile') || '';
    const html = profile ? toSnapshotHtml(rootElement.innerHTML) : '';
    // markup は React の dangerouslySetInnerHTML にそのまま渡す。毎回新しいオブジェクトを渡すと
    // React が描き直しのたびに innerHTML を入れ直し、大きな本文の再レイアウトが繰り返される
    if (html) snapshot = { profile, html, markup: { __html: html }, path: normalizeSnapshotPath(pathname) };
  } catch {
    snapshot = null;
  }
  if (!snapshot) removeStaticStylesheet();
  return snapshot;
};

export const getPrerenderedSnapshot = () => snapshot;

// 表示中のページ向けの写しがあれば返す（アプリ内で別のページへ移った後は使わない）
export const getPrerenderedSnapshotFor = (pathname = '') =>
  (snapshot && normalizeSnapshotPath(pathname) === snapshot.path ? snapshot : null);

// React の useSyncExternalStore 用
export const subscribePrerenderedSnapshot = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// ページの画面を描いたとき・別のページへ移ったときに、写しと静的ページ用のスタイルシートを片付ける
export const releasePrerenderedSnapshot = () => {
  removeStaticStylesheet();
  if (!snapshot) return;
  snapshot = null;
  listeners.forEach((listener) => listener());
};

// テスト用: 状態を初期化する
export const resetPrerenderedSnapshotForTest = () => {
  snapshot = null;
  listeners.clear();
};
