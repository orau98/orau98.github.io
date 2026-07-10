import { EN_TYPE_LABELS, EN_TYPE_PLURALS } from './englishNaming.js';
import { DEFAULT_LOCALE, localizePath, normalizeLocale, stripLocalePrefix } from './locale.js';

const insectSections = [
  {
    type: 'moth',
    collectionKey: 'moths',
    routeSegment: 'moth',
    detailParam: 'mothSlug',
    label: '蛾',
    labelEn: EN_TYPE_LABELS.moth,
    searchLabel: '蛾',
    searchLabelEn: 'Moth',
    metaIndexTitle: '蛾の食草・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.moth} (meta index)`,
    defaultFamilyName: 'ヤガ科',
    sitemapPriority: '0.8',
  },
  {
    type: 'butterfly',
    collectionKey: 'butterflies',
    routeSegment: 'butterfly',
    detailParam: 'butterflySlug',
    label: '蝶',
    labelEn: EN_TYPE_LABELS.butterfly,
    searchLabel: '蝶',
    searchLabelEn: 'Butterfly',
    metaIndexTitle: '蝶の食草・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.butterfly} (meta index)`,
    defaultFamilyName: 'タテハチョウ科',
    sitemapPriority: '0.8',
  },
  {
    type: 'beetle',
    collectionKey: 'beetles',
    routeSegment: 'beetle',
    detailParam: 'beetleSlug',
    label: 'タマムシ',
    labelEn: EN_TYPE_LABELS.beetle,
    searchLabel: '甲虫',
    searchLabelEn: 'Jewel beetle',
    metaIndexTitle: 'タマムシの食樹・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.beetle} (meta index)`,
    defaultFamilyName: 'タマムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'longhornbeetle',
    collectionKey: 'longhornbeetles',
    routeSegment: 'longhornbeetle',
    detailParam: 'longhornbeetleSlug',
    label: 'カミキリムシ',
    labelEn: EN_TYPE_LABELS.longhornbeetle,
    searchLabel: 'カミキリ',
    searchLabelEn: 'Longhorn beetle',
    metaIndexTitle: 'カミキリムシの食樹・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.longhornbeetle} (meta index)`,
    defaultFamilyName: 'カミキリムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'barkbeetle',
    collectionKey: 'barkbeetles',
    routeSegment: 'barkbeetle',
    detailParam: 'barkbeetleSlug',
    label: 'キクイムシ',
    labelEn: EN_TYPE_LABELS.barkbeetle,
    searchLabel: 'キクイムシ',
    searchLabelEn: 'Bark beetle',
    metaIndexTitle: 'キクイムシの寄主植物・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.barkbeetle} (meta index)`,
    defaultFamilyName: 'ゾウムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'leafbeetle',
    collectionKey: 'leafbeetles',
    routeSegment: 'leafbeetle',
    detailParam: 'leafbeetleSlug',
    label: 'ハムシ',
    labelEn: EN_TYPE_LABELS.leafbeetle,
    searchLabel: 'ハムシ',
    searchLabelEn: 'Leaf beetle',
    metaIndexTitle: 'ハムシの食草・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.leafbeetle} (meta index)`,
    defaultFamilyName: 'ハムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'aphid',
    collectionKey: 'aphids',
    routeSegment: 'aphid',
    detailParam: 'aphidSlug',
    label: 'アブラムシ',
    labelEn: EN_TYPE_LABELS.aphid,
    searchLabel: 'アブラムシ',
    searchLabelEn: 'Aphid',
    metaIndexTitle: 'アブラムシの寄主植物・種一覧',
    metaIndexTitleEn: `${EN_TYPE_PLURALS.aphid} (meta index)`,
    defaultFamilyName: 'アブラムシ科',
    sitemapPriority: '0.7',
  },
].map((section) => Object.freeze(section));

export const INSECT_SECTION_CONFIGS = Object.freeze(insectSections);

export const PLANT_SECTION_CONFIG = Object.freeze({
  type: 'plant',
  routeSegment: 'plant',
  detailParam: 'plantName',
  label: '植物',
  labelEn: EN_TYPE_LABELS.plant,
  searchLabel: '植物',
  searchLabelEn: 'Plant',
  metaIndexTitle: '食草・寄主植物の一覧',
  metaIndexTitleEn: `${EN_TYPE_PLURALS.plant} (meta index)`,
  sitemapPriority: '0.6',
});

export const EXPLORER_ROUTE_CONFIGS = Object.freeze([
  Object.freeze({ path: '/', initialTab: 'insects' }),
  Object.freeze({ path: '/moth', initialTab: 'insects' }),
  Object.freeze({ path: '/plant', initialTab: 'plants' }),
  Object.freeze({ path: '/en', initialTab: 'insects' }),
  Object.freeze({ path: '/en/moth', initialTab: 'insects' }),
  Object.freeze({ path: '/en/plant', initialTab: 'plants' }),
]);

export const INSECT_COLLECTION_KEYS = Object.freeze(
  INSECT_SECTION_CONFIGS.map((section) => section.collectionKey),
);

export const INSECT_DETAIL_ROUTE_PATTERNS = Object.freeze(
  [
    ...INSECT_SECTION_CONFIGS.map(
      (section) => `/${section.routeSegment}/:${section.detailParam}`,
    ),
    ...INSECT_SECTION_CONFIGS.map(
      (section) => `/en/${section.routeSegment}/:${section.detailParam}`,
    ),
  ],
);

export const META_PAGE_SECTIONS = Object.freeze([
  ...INSECT_SECTION_CONFIGS.map((section) =>
    Object.freeze({
      key: section.routeSegment,
      dir: section.routeSegment,
      title: section.metaIndexTitle,
      routePrefix: `/meta/${section.routeSegment}/`,
      priority: section.sitemapPriority,
    }),
  ),
  Object.freeze({
    key: PLANT_SECTION_CONFIG.routeSegment,
    dir: PLANT_SECTION_CONFIG.routeSegment,
    title: PLANT_SECTION_CONFIG.metaIndexTitle,
    routePrefix: `/meta/${PLANT_SECTION_CONFIG.routeSegment}/`,
    priority: PLANT_SECTION_CONFIG.sitemapPriority,
  }),
]);

const insectSectionByType = new Map(
  INSECT_SECTION_CONFIGS.map((section) => [section.type, section]),
);

const sectionByRouteSegment = new Map(
  [...INSECT_SECTION_CONFIGS, PLANT_SECTION_CONFIG].map((section) => [
    section.routeSegment,
    section,
  ]),
);

export const createEmptyInsectCollections = (factory = () => []) =>
  Object.fromEntries(
    INSECT_COLLECTION_KEYS.map((key) => [key, factory(key)]),
  );

export const getInsectSectionConfig = (type, fallbackType = 'moth') =>
  insectSectionByType.get(type) ||
  insectSectionByType.get(fallbackType) ||
  INSECT_SECTION_CONFIGS[0];

export const getSectionConfigByRouteSegment = (routeSegment) =>
  sectionByRouteSegment.get(routeSegment) || null;

export const getInsectRouteBase = (type, fallbackType = 'moth') =>
  `/${getInsectSectionConfig(type, fallbackType).routeSegment}/`;

export const getLocalizedInsectRouteBase = (
  type,
  fallbackType = 'moth',
  locale = DEFAULT_LOCALE,
) => localizePath(getInsectRouteBase(type, fallbackType), locale);

export const buildInsectMetaPagePath = (
  type,
  id,
  fallbackType = 'moth',
  locale = DEFAULT_LOCALE,
) => {
  if (!id) return '/';
  const { routeSegment } = getInsectSectionConfig(type, fallbackType);
  return localizePath(
    `/meta/${routeSegment}/${encodeURIComponent(id)}.html`,
    locale,
  );
};

export const buildPlantMetaPagePath = (
  plantName,
  locale = DEFAULT_LOCALE,
) => {
  if (!plantName) return '/';
  const safePlantName = String(plantName)
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim();
  return localizePath(
    `/meta/${PLANT_SECTION_CONFIG.routeSegment}/${encodeURIComponent(
      safePlantName,
    )}.html`,
    locale,
  );
};

export const buildPlantPath = (plantName, locale = DEFAULT_LOCALE) => {
  if (!plantName) return localizePath('/plant', locale);
  const localizedPath = localizePath(
    `/${PLANT_SECTION_CONFIG.routeSegment}/${encodeURIComponent(plantName)}`,
    locale,
  );
  // Detail pages are real directories on GitHub Pages. Requesting them
  // without `/` triggers the same mojibake-producing canonical redirect as
  // insect pages, so restore the slash removed by localizePath.
  return `${localizedPath.replace(/\/+$/, '')}/`;
};

export const getSearchTypeLabel = (type, locale = DEFAULT_LOCALE) => {
  const normalizedLocale = normalizeLocale(locale);
  if (type === PLANT_SECTION_CONFIG.type) {
    return normalizedLocale === 'en'
      ? PLANT_SECTION_CONFIG.searchLabelEn
      : PLANT_SECTION_CONFIG.searchLabel;
  }
  if (!type) return '';
  const section = getInsectSectionConfig(type);
  return normalizedLocale === 'en' ? section.searchLabelEn : section.searchLabel;
};

export const isExplorerRoutePath = (pathname = '') => {
  const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
  return EXPLORER_ROUTE_CONFIGS.some((route) => route.path === normalized);
};

export const isKnownDetailPath = (pathname = '') => {
  const strippedPath = stripLocalePrefix(pathname);
  return [...INSECT_SECTION_CONFIGS, PLANT_SECTION_CONFIG].some((section) =>
    strippedPath.startsWith(`/${section.routeSegment}/`),
  );
};
