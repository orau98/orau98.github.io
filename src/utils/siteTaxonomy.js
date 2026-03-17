const insectSections = [
  {
    type: 'moth',
    collectionKey: 'moths',
    routeSegment: 'moth',
    detailParam: 'mothSlug',
    label: '蛾',
    searchLabel: '蛾',
    metaIndexTitle: '蛾（メタページ一覧）',
    defaultFamilyName: 'ヤガ科',
    sitemapPriority: '0.8',
  },
  {
    type: 'butterfly',
    collectionKey: 'butterflies',
    routeSegment: 'butterfly',
    detailParam: 'butterflySlug',
    label: '蝶',
    searchLabel: '蝶',
    metaIndexTitle: '蝶（メタページ一覧）',
    defaultFamilyName: 'タテハチョウ科',
    sitemapPriority: '0.8',
  },
  {
    type: 'beetle',
    collectionKey: 'beetles',
    routeSegment: 'beetle',
    detailParam: 'beetleSlug',
    label: 'タマムシ',
    searchLabel: '甲虫',
    metaIndexTitle: 'タマムシ（メタページ一覧）',
    defaultFamilyName: 'タマムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'longhornbeetle',
    collectionKey: 'longhornbeetles',
    routeSegment: 'longhornbeetle',
    detailParam: 'longhornbeetleSlug',
    label: 'カミキリムシ',
    searchLabel: 'カミキリ',
    metaIndexTitle: 'カミキリムシ（メタページ一覧）',
    defaultFamilyName: 'カミキリムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'leafbeetle',
    collectionKey: 'leafbeetles',
    routeSegment: 'leafbeetle',
    detailParam: 'leafbeetleSlug',
    label: 'ハムシ',
    searchLabel: 'ハムシ',
    metaIndexTitle: 'ハムシ（メタページ一覧）',
    defaultFamilyName: 'ハムシ科',
    sitemapPriority: '0.7',
  },
  {
    type: 'aphid',
    collectionKey: 'aphids',
    routeSegment: 'aphid',
    detailParam: 'aphidSlug',
    label: 'アブラムシ',
    searchLabel: 'アブラムシ',
    metaIndexTitle: 'アブラムシ（メタページ一覧）',
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
  searchLabel: '植物',
  metaIndexTitle: '植物（メタページ一覧）',
  sitemapPriority: '0.6',
});

export const EXPLORER_ROUTE_CONFIGS = Object.freeze([
  Object.freeze({ path: '/', initialTab: 'insects' }),
  Object.freeze({ path: '/moth', initialTab: 'insects' }),
  Object.freeze({ path: '/plant', initialTab: 'plants' }),
]);

export const INSECT_COLLECTION_KEYS = Object.freeze(
  INSECT_SECTION_CONFIGS.map((section) => section.collectionKey),
);

export const INSECT_DETAIL_ROUTE_PATTERNS = Object.freeze(
  INSECT_SECTION_CONFIGS.map(
    (section) => `/${section.routeSegment}/:${section.detailParam}`,
  ),
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

export const buildInsectMetaPagePath = (
  type,
  id,
  fallbackType = 'moth',
) => {
  if (!id) return '/';
  const { routeSegment } = getInsectSectionConfig(type, fallbackType);
  return `/meta/${routeSegment}/${encodeURIComponent(id)}.html`;
};

export const buildPlantMetaPagePath = (plantName) => {
  if (!plantName) return '/';
  return `/meta/${PLANT_SECTION_CONFIG.routeSegment}/${encodeURIComponent(
    plantName,
  )}.html`;
};

export const getSearchTypeLabel = (type) => {
  if (type === PLANT_SECTION_CONFIG.type) {
    return PLANT_SECTION_CONFIG.searchLabel;
  }
  if (!type) return '';
  return getInsectSectionConfig(type).searchLabel;
};

export const isExplorerRoutePath = (pathname = '') =>
  EXPLORER_ROUTE_CONFIGS.some((route) => route.path === pathname);

export const isKnownDetailPath = (pathname = '') =>
  [...INSECT_SECTION_CONFIGS, PLANT_SECTION_CONFIG].some((section) =>
    pathname.startsWith(`/${section.routeSegment}/`),
  );
