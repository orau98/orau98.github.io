import {
  EXPLORER_ROUTE_CONFIGS,
  INSECT_COLLECTION_KEYS,
  INSECT_SECTION_CONFIGS,
  isExplorerRoutePath,
} from './siteTaxonomy.js';
import { isEnglishLocale, getLocaleFromPath, stripLocalePrefix } from './locale.js';
import { decodeRouteParam } from './urlEncoding.js';
import { normalizeRecordKey } from './speciesRecordKey.js';

const INSECT_DATA_IMMEDIATE_QUERY_PARAMS = Object.freeze([
  'q',
  'search',
  'term',
  'classification',
  'page',
  'ipage',
  'ihost',
  'ifamily',
  'igenus',
  'imonth',
  'pfamily',
  'porder',
  'pvisit',
]);

const normalizePathname = (pathname = '/') => {
  const stripped = stripLocalePrefix(String(pathname || '/').split(/[?#]/, 1)[0] || '/');
  return stripped.length > 1 ? stripped.replace(/\/+$/, '') : stripped;
};

export const getInsectDetailCollectionKey = (pathname = '/') => {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const segment = segments[0] || '';
  return (
    INSECT_SECTION_CONFIGS.find((section) => section.routeSegment === segment)
      ?.collectionKey || null
  );
};

/**
 * 昆虫の詳細ページで「どの種か」を表すキー（URLの種名またはID）。
 * 1種ずつのデータ（species/<分類>/<バケット>.json）を引くのに使う。
 */
export const getInsectDetailRecordRequest = (pathname = '/') => {
  const collectionKey = getInsectDetailCollectionKey(pathname);
  if (!collectionKey) return null;
  const segments = normalizePathname(pathname).split('/').filter(Boolean);
  if (segments.length !== 2) return null;
  let routeKey = '';
  try {
    routeKey = normalizeRecordKey(decodeRouteParam(segments[1]));
  } catch {
    routeKey = '';
  }
  return routeKey ? { collectionKey, routeKey } : null;
};

// クイズの出題（utils/quiz.js の buildQuizQuestions）は蛾・蝶の詳細な食草記録
// (hostPlantsDetailed) を使う。一覧用の軽量データ(catalog)には含まれないため、
// クイズではこの2分類だけ完全データ(full)を必須にする（catalogだと0問になり開始できない）
export const QUIZ_COLLECTION_KEYS = Object.freeze(['moths', 'butterflies']);

export const getRequiredFullCollectionKeys = (pathname = '/') =>
  normalizePathname(pathname) === '/quiz' ? [...QUIZ_COLLECTION_KEYS] : [];

export const getImmediateInsectCollectionKeys = (pathname = '/') => {
  const detailCollectionKey = getInsectDetailCollectionKey(pathname);
  return detailCollectionKey
    ? [detailCollectionKey]
    : [...INSECT_COLLECTION_KEYS];
};

export const shouldLoadPlantPartitionsImmediately = (
  pathname = '/',
  params = new URLSearchParams(),
) => {
  if (!isExplorerRoutePath(pathname)) return true;
  if (params.get('tab') === 'plants') return true;
  if (isEnglishLocale(getLocaleFromPath(pathname))) return true;
  return normalizePathname(pathname) === '/plant';
};

const normalizeExplorerPath = (pathname = '') => {
  const value = String(pathname || '/').split(/[?#]/)[0] || '/';
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
};

const getExplorerInitialTabForPath = (pathname = '') => {
  const normalizedPath = normalizeExplorerPath(pathname);
  const config = EXPLORER_ROUTE_CONFIGS.find(
    ({ path }) => normalizeExplorerPath(path) === normalizedPath,
  );
  return config?.initialTab || null;
};

const hasImmediateInsectDataParams = (params) =>
  INSECT_DATA_IMMEDIATE_QUERY_PARAMS.some((name) => params.has(name));

export const shouldLoadInsectPartitionsImmediately = (
  pathname = '/',
  params = new URLSearchParams(),
) => {
  if (!isExplorerRoutePath(pathname)) return true;
  if (hasImmediateInsectDataParams(params)) return true;
  return getExplorerInitialTabForPath(pathname) === 'insects';
};

/**
 * トップ（日本語・昆虫タブ・検索や絞り込みなし）かどうか。
 * このときだけ、全分類のデータを待たずに先読みの最初の48件（catalog/home-preview.json）を先に表示する。
 */
export const isHomePreviewRoute = (pathname = '/', params = new URLSearchParams()) => {
  const search = params instanceof URLSearchParams
    ? params
    : new URLSearchParams(String(params || '').replace(/^\?/, ''));
  if (isEnglishLocale(getLocaleFromPath(pathname))) return false;
  if (normalizePathname(pathname) !== '/') return false;
  if (search.get('tab') === 'plants') return false;
  return !hasImmediateInsectDataParams(search) &&
    !['iphoto', 'igroup', 'isort', 'iview', 'iper', 'iseason'].some((name) => search.has(name));
};
