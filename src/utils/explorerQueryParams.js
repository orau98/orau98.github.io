// 検索・絞り込み・ページングされた一覧を表すURLパラメータ。
// SEOのnoindex判定と、トップ向け発見導線の表示条件で共用する。
// tab / iview / pview / sort / per-page は表示方法だけを変えるため含めない。
export const EXPLORER_RESULT_QUERY_KEYS = Object.freeze([
  'q',
  'search',
  'term',
  'classification',
  'page',
  'redirect',
  'ipage',
  'ihost',
  'ifamily',
  'igenus',
  'igroup',
  'imonth',
  'iseason',
  'iphoto',
  'ppage',
  'pfamily',
  'porder',
  'pvisit',
  'phost',
  'pphoto',
]);

export const hasExplorerResultQuery = (query = '') => {
  const params = query instanceof URLSearchParams
    ? query
    : new URLSearchParams(String(query || '').replace(/^\?/, ''));
  return EXPLORER_RESULT_QUERY_KEYS.some((key) => params.has(key));
};
