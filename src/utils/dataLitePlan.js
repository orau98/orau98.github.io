import { buildFlowerVisitMap } from './flowerVisitPlants.js';
import {
  getImmediateInsectCollectionKeys,
  getInsectDetailCollectionKey,
  shouldLoadInsectPartitionsImmediately,
  shouldLoadPlantPartitionsImmediately,
} from './insectDataLoading.js';
import {
  INSECT_COLLECTION_KEYS,
  createEmptyInsectCollections,
} from './siteTaxonomy.js';

export const buildAppVersionSuffix = ({
  isDevelopment = false,
  buildId = '',
  now = Date.now(),
} = {}) => {
  if (isDevelopment) return `?v=${now}`;
  return buildId ? `?v=${encodeURIComponent(buildId)}` : '';
};

export const buildPartitionVersionSuffix = ({
  isDevelopment = false,
  manifestVersion = '',
  now = Date.now(),
} = {}) => {
  if (isDevelopment) return `?v=${now}`;
  return manifestVersion ? `?v=${manifestVersion}` : '';
};

export const buildDataLiteAssetUrl = (
  baseUrl = '/',
  relativePath = '',
  versionSuffix = '',
) => `${baseUrl}assets/data-lite/${relativePath}${versionSuffix}`;

export const buildLiteSummaryCounts = (lite = {}) => ({
  moths: Array.isArray(lite.moths) ? lite.moths.length : 0,
  butterflies: Array.isArray(lite.butterflies) ? lite.butterflies.length : 0,
  beetles: Array.isArray(lite.beetles) ? lite.beetles.length : 0,
  longhornbeetles: Array.isArray(lite.longhornbeetles)
    ? lite.longhornbeetles.length
    : 0,
  barkbeetles: Array.isArray(lite.barkbeetles) ? lite.barkbeetles.length : 0,
  leafbeetles: Array.isArray(lite.leafbeetles) ? lite.leafbeetles.length : 0,
  aphids: Array.isArray(lite.aphids) ? lite.aphids.length : 0,
  hostPlants:
    lite.hostPlants && typeof lite.hostPlants === 'object'
      ? Object.keys(lite.hostPlants).length
      : 0,
});

export const isLiteIndexPayload = (payload) =>
  Boolean(
    payload &&
      Array.isArray(payload.moths) &&
      Array.isArray(payload.butterflies),
  );

export const normalizeDatasetPayload = (data = {}) => {
  const collections = createEmptyInsectCollections(
    (key) => (Array.isArray(data[key]) ? data[key] : []),
  );
  const hostPlants = data.hostPlants || {};
  const flowerVisitPlants =
    data.flowerVisitPlants ||
    buildFlowerVisitMap(
      INSECT_COLLECTION_KEYS.flatMap((key) => collections[key]),
    );
  const hasAny =
    INSECT_COLLECTION_KEYS.reduce(
      (total, key) => total + collections[key].length,
      0,
    ) > 0 || Object.keys(hostPlants).length > 0;

  return {
    collections,
    hostPlants,
    flowerVisitPlants,
    plantDetails: data.plantDetails || {},
    summaryCounts: data.summaryCounts || null,
    hasAny,
  };
};

export const normalizePlantPartitions = ({
  hostMap,
  plantDetails,
  flowerVisitPlants,
} = {}) => {
  if (!hostMap || typeof hostMap !== 'object') return null;
  return {
    hostMap,
    plantDetails:
      plantDetails && typeof plantDetails === 'object' ? plantDetails : {},
    flowerVisitPlants:
      flowerVisitPlants && typeof flowerVisitPlants === 'object'
        ? flowerVisitPlants
        : {},
  };
};

export const getCollectionPartitionFile = (
  collectionKey,
  detailLevel = 'catalog',
) =>
  detailLevel === 'full'
    ? `${collectionKey}.json`
    : `catalog/${collectionKey}.json`;

export const selectCollectionKeysToLoad = (
  requestedKeys = INSECT_COLLECTION_KEYS,
  loadedLevels = new Map(),
  detailLevel = 'catalog',
) => {
  const knownKeys = new Set(INSECT_COLLECTION_KEYS);
  return requestedKeys.filter((key) => {
    if (!knownKeys.has(key)) return false;
    const currentLevel = loadedLevels.get(key);
    return !currentLevel || (detailLevel === 'full' && currentLevel !== 'full');
  });
};

export const isDatasetCacheComplete = (loadedLevels, plantPayload) =>
  loadedLevels.size === INSECT_COLLECTION_KEYS.length &&
  Boolean(plantPayload?.hostMap);

export const planInitialDataLoad = ({
  pathname = '/',
  search = '',
  cacheLoaded = false,
  cachedVersion = null,
  manifestVersion = null,
} = {}) => {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const loadPlantsImmediately = shouldLoadPlantPartitionsImmediately(
    pathname,
    params,
  );
  const cacheVersionMismatch = Boolean(
    cacheLoaded &&
      cachedVersion &&
      manifestVersion &&
      manifestVersion !== cachedVersion,
  );
  const loadTypesImmediately =
    cacheVersionMismatch ||
    shouldLoadInsectPartitionsImmediately(pathname, params);
  const immediateCollectionKeys = cacheVersionMismatch
    ? [...INSECT_COLLECTION_KEYS]
    : getImmediateInsectCollectionKeys(pathname);
  const detailCollectionKey = getInsectDetailCollectionKey(pathname);

  return {
    loadPlantsImmediately,
    loadTypesImmediately,
    cacheVersionMismatch,
    immediateCollectionKeys,
    immediateDetailLevel:
      immediateCollectionKeys.length === 1 ? 'full' : 'catalog',
    followUpFullKey:
      loadTypesImmediately &&
      detailCollectionKey &&
      immediateCollectionKeys.length > 1
        ? detailCollectionKey
        : null,
  };
};

// Readiness describes the route's requirements, never the number of nonempty arrays.
// An empty, successfully fetched partition is ready; one fetched classification is not seven.
export const isRouteDataReady = (state, pathname = '/', search = '') => {
  const plan = planInitialDataLoad({ pathname, search });
  const levels = state?.collectionLevels || {};
  return (!plan.loadPlantsImmediately || state?.plantsReady === true) &&
    (!plan.loadTypesImmediately || plan.immediateCollectionKeys.every((key) =>
      levels[key] === 'full' || (plan.immediateDetailLevel === 'catalog' && levels[key] === 'catalog')));
};

export const getRouteDataError = (state, pathname = '/') => {
  const detailKey = getInsectDetailCollectionKey(pathname);
  return Object.entries(state?.errors || {}).find(([key]) =>
    state?.errorLevels?.[key] !== 'full' || key === detailKey)?.[1] || null;
};
