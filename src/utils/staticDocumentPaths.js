// 静的HTML（SPAルーター外）として配信されるパスの判定。
// App.jsx のセーフティネット（静的パスに入ったら location.replace）と
// main.jsx のクリックハンドラ（静的パスへのリンクだけフル遷移）で共有する。
const STATIC_DOCUMENT_PATHS = new Set(['/sitemap.html']);
const STATIC_DOCUMENT_PREFIXES = ['/meta/', '/en/meta/'];

export const isStaticDocumentPath = (pathname = '') => {
  const value = String(pathname || '').trim();
  if (!value) return false;
  if (STATIC_DOCUMENT_PATHS.has(value)) return true;
  return STATIC_DOCUMENT_PREFIXES.some((prefix) => value.startsWith(prefix));
};
