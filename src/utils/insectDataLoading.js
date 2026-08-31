import {
  INSECT_COLLECTION_KEYS,
  INSECT_SECTION_CONFIGS,
  isExplorerRoutePath,
} from './siteTaxonomy.js';
import { isEnglishLocale, getLocaleFromPath, stripLocalePrefix } from './locale.js';

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
