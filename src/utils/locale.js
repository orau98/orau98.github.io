export const DEFAULT_LOCALE = 'ja';
export const ENGLISH_LOCALE = 'en';

export const normalizeLocale = (locale = DEFAULT_LOCALE) =>
  String(locale || '').trim().toLowerCase() === ENGLISH_LOCALE
    ? ENGLISH_LOCALE
    : DEFAULT_LOCALE;

export const isEnglishLocale = (locale = DEFAULT_LOCALE) =>
  normalizeLocale(locale) === ENGLISH_LOCALE;

export const getLocaleFromPath = (pathname = '') => {
  // React Routerのルート照合は大文字小文字を区別しない（/EN/mothも英語ルートに
  // マッチする）ため、ロケール判定も同じ基準に揃える。ずれると英語ルートに
  // 日本語UI・誤ったcanonicalが出る
  const value = String(pathname || '').trim().toLowerCase();
  return value === '/en' || value.startsWith('/en/')
    ? ENGLISH_LOCALE
    : DEFAULT_LOCALE;
};

export const getCurrentLocale = () => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return getLocaleFromPath(window.location.pathname || '/');
};

export const stripLocalePrefix = (pathname = '') => {
  const value = String(pathname || '').trim();
  if (!value) return '/';
  const lower = value.toLowerCase();
  if (lower === '/en') return '/';
  if (lower.startsWith('/en/')) {
    const stripped = value.slice(3);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return value.startsWith('/') ? value : `/${value}`;
};

const splitPathSuffix = (input = '') => {
  const value = String(input || '').trim() || '/';
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');
  const cutIndex =
    queryIndex === -1
      ? hashIndex
      : hashIndex === -1
        ? queryIndex
        : Math.min(queryIndex, hashIndex);
  if (cutIndex === -1) {
    return { pathname: value, suffix: '' };
  }
  return {
    pathname: value.slice(0, cutIndex) || '/',
    suffix: value.slice(cutIndex),
  };
};

export const localizePath = (input = '/', locale = DEFAULT_LOCALE) => {
  const normalizedLocale = normalizeLocale(locale);
  const { pathname, suffix } = splitPathSuffix(input);
  const strippedPath = stripLocalePrefix(pathname);
  const normalizedPath = strippedPath === '/' ? '/' : strippedPath.replace(/\/+$/, '');
  const localizedPath =
    normalizedLocale === ENGLISH_LOCALE
      ? normalizedPath === '/'
        ? '/en'
        : `/en${normalizedPath}`
      : normalizedPath;
  return `${localizedPath}${suffix}`;
};

export const getAlternateLocale = (locale = DEFAULT_LOCALE) =>
  isEnglishLocale(locale) ? DEFAULT_LOCALE : ENGLISH_LOCALE;

export const getAlternateLocalePath = (input = '/', locale = DEFAULT_LOCALE) =>
  localizePath(input, getAlternateLocale(locale));
