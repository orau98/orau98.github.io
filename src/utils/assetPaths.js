// ビルド資産のURL構築を一元化する。
// ベースURLの正規化と ?v= キャッシュバスタは従来10箇所以上で個別実装されており、
// DEVでの Date.now() の扱いなどが実装ごとに食い違っていた。
// Node製スクリプトから間接importされても壊れないよう import.meta.env の欠如を許容する。
const ENV = import.meta.env || {};

// DEVでは「ページロードごとに一度だけ」変わるクエリにする。
// 呼び出しごとに Date.now() を評価するとレンダーのたびにURLが変わり再取得ループになる。
const DEV_VERSION_QUERY = ENV.DEV ? `?v=${Date.now()}` : '';

export const getAssetBase = () => {
  const base = ENV.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

export const getAssetVersionQuery = () => {
  if (ENV.DEV) return DEV_VERSION_QUERY;
  return ENV.VITE_ASSET_VERSION ? `?v=${ENV.VITE_ASSET_VERSION}` : '';
};

export const getPlaceholderImageUrl = () =>
  `${getAssetBase()}images/placeholder.jpg${getAssetVersionQuery()}`;
