import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import logger from './utils/logger';
import lazyWithRetry from './utils/lazyWithRetry';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
const InsectsHostPlantExplorer = lazyWithRetry(() => import('./InsectsHostPlantExplorer'));
const MothDetail = lazyWithRetry(() => import('./MothDetail'));
const HostPlantDetail = lazyWithRetry(() => import('./HostPlantDetail'));
import SkeletonLoader from './components/SkeletonLoader';
import Footer from './components/Footer';
import Header from './components/Header';
import FloatingActionButton from './components/FloatingActionButton';
import { extractEmergenceTime } from './utils/emergenceTimeUtils';
import { globalJapaneseToScientificMapping } from './utils/insectImageMappings';
import { loadInsectImageIndexes } from './services/imageIndex';

const DATA_CACHE_DB = 'ihpe-cache';
const DATA_CACHE_STORE = 'datasets';
const DATA_CACHE_KEY = 'full-dataset';
const CACHE_SCHEMA_VERSION = 1;

let cachedPapa = null;
const getPapa = async () => {
  if (cachedPapa) return cachedPapa;
  const mod = await import('papaparse');
  cachedPapa = mod.default || mod;
  return cachedPapa;
};

const openCacheDb = () => {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATA_CACHE_DB, CACHE_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATA_CACHE_STORE)) {
        db.createObjectStore(DATA_CACHE_STORE);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

const loadDatasetFromCache = async () => {
  try {
    const db = await openCacheDb();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DATA_CACHE_STORE, 'readonly');
      const store = tx.objectStore(DATA_CACHE_STORE);
      const req = store.get(DATA_CACHE_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || null);
    });
  } catch (error) {
    logger.debug('Dataset cache load failed:', error);
    return null;
  }
};

const saveDatasetToCache = async (version, payload) => {
  try {
    const db = await openCacheDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DATA_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(DATA_CACHE_STORE);
      const req = store.put(
        {
          version,
          timestamp: Date.now(),
          payload,
        },
        DATA_CACHE_KEY,
      );
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } catch (error) {
    logger.debug('Dataset cache save failed:', error);
  }
};

// This map can be a fallback, but the primary source is now the wamei_checklist.csv.
const plantFamilyMap = {
  'ヤナギ': 'ヤナギ科', 'ヤナギ類': 'ヤナギ科', 'クリ': 'ブナ科', 'クヌギ': 'ブナ科', 'コナラ': 'ブナ科',
  'ブナ': 'ブナ科', 'カシワ': 'ブナ科', 'アラカシ': 'ブナ科', 'スダジイ': 'ブナ科', 'リンゴ': 'バラ科',
  'サクラ': 'バラ科', 'ズミ': 'バラ科', 'ナナカマド': 'バラ科', 'マツ': 'マツ科', 'アカマツ': 'マツ科',
  'トドマツ': 'マツ科', 'スギ': 'スギ科', 'ヒノキ': 'ヒノキ科', 'ヨモギ': 'キク科', 'キク': 'キク科',
  'アザミ': 'キク科', 'イネ': 'イネ科', 'ススキ': 'イネ科', 'ヨシ': 'イネ科', 'ササ': 'イネ科',
  'ハンノキ': 'カバノキ科', 'シラカンバ': 'カバノキ科', 'ダケカンバ': 'カバノキ科', 'カエデ': 'ムクロジ科',
  'イタヤカエデ': 'ムクロジ科', 'ツタ': 'ブドウ科', 'ブドウ': 'ブドウ科', 'ヌルデ': 'ウルシ科',
  'ウルシ': 'ウルシ科', 'ツツジ': 'ツツジ科', 'アセビ': 'ツツジ科', 'スイカズラ': 'スイカズラ科',
  'ガマズミ': 'スイカズラ科', 'クズ': 'マメ科', 'ハギ': 'マメ科', 'フジ': 'マメ科',
};

// 植物の学名マッピング（手動補完）
const plantScientificNameMap = {
  'サクラ': 'Cerasus',
  'ソメイヨシノ': 'Cerasus × yedoensis',
  'ヤマザクラ': 'Cerasus serrulata',
  'リンゴ': 'Malus domestica',
  'マツ': 'Pinus',
  'アカマツ': 'Pinus densiflora',
  'スギ': 'Cryptomeria japonica',
  'クリ': 'Castanea crenata',
  'クヌギ': 'Quercus acutissima',
  'コナラ': 'Quercus serrata',
};

const safeDeepClone = (obj) => {
  if (!obj) return {};
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    logger.debug('safeDeepClone fallback due to error:', error);
    return { ...obj };
  }
};

function App() {
  const location = useLocation();
  const [moths, setMoths] = useState([]);
  const [butterflies, setButterflies] = useState([]);
  const [beetles, setBeetles] = useState([]);
  const [longhornbeetles, setLonghornbeetles] = useState([]);
  const [leafbeetles, setLeafbeetles] = useState([]);
  const [hostPlants, setHostPlants] = useState({});
  const [flowerVisitPlants, setFlowerVisitPlants] = useState({});
  const [plantDetails, setPlantDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [summaryCounts, setSummaryCounts] = useState(null);
  const typesFetchStartedRef = useRef(false);
  const typesFetchPromiseRef = useRef(null);
  const ensureTypesLoaderRef = useRef(null);
  const hostCsvExtendStartedRef = useRef(false);
  const hostHydrationRequestedRef = useRef(false);
  const pendingHostHydrationRef = useRef(null);
  const requestHostHydrationRef = useRef(() => {});
  const fetchDataRef = useRef(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const cacheLoadedRef = useRef(false);
  const cachedVersionRef = useRef(null);
  
  const isDevelopment = import.meta.env.DEV;
  const allowDebugLogs = isDevelopment || (typeof window !== 'undefined' && !!window.DEBUG_LOGS);
  
  const isExplorerPage = location.pathname === '/' || location.pathname === '/moth' || location.pathname === '/plant';

  // SEO: avoid indexing search result pages (with query params)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const hasSearch =
        params.has('q') ||
        params.has('search') ||
        params.has('term') ||
        params.has('classification') ||
        params.has('page') ||
        params.has('ipage') ||
        params.has('ppage') ||
        params.has('ihost') ||
        params.has('ifamily') ||
        params.has('igenus') ||
        params.has('imonth') ||
        params.has('pfamily') ||
        params.has('porder') ||
        params.has('pvisit') ||
        params.has('redirect');
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      if (hasSearch) {
        robots.content = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
      } else {
        robots.content = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
      }
    } catch {}
  }, [location.search]);

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
    } catch (error) {
      logger.debug('Theme change error (harmless):', error);
    }
  }, [theme]);

  const isFlowerVisitRecord = (record) => {
    if (!record) return false;
    if (record.isFlowerVisit === true) return true;
    const lifeStage = (record?.lifeStage || '').trim();
    const plantPart = (record?.plantPart || '').trim();
    const partCompact = plantPart.replace(/\s+/g, '');
    const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
    return isAdultOrUnknown && partCompact && partCompact.includes('花');
  };

  const buildFlowerVisitMap = (insects = []) => {
    const map = {};
    const normalizePlant = (value) => {
      if (!value || typeof value !== 'string') return '';
      return value
        .replace(/[（(][^）)]*科[^）)]*[）)]/g, '')
        .replace(/[（(][^）)]*[）)]/g, '')
        .trim();
    };
    (insects || []).forEach((insect) => {
      if (!insect) return;
      const insectName = (insect.name || insect.japaneseName || '').trim();
      if (!insectName) return;
      const records = insect.hostPlantsDetailed;
      if (!Array.isArray(records) || records.length === 0) return;
      records.forEach((record) => {
        if (!isFlowerVisitRecord(record)) return;
        const rawPlant = record?.name || record?.displayName || record?.plant || '';
        const plantName = normalizePlant(String(rawPlant || '').trim());
        if (!plantName || plantName === '不明') return;
        if (!map[plantName]) map[plantName] = [];
        if (!map[plantName].includes(insectName)) map[plantName].push(insectName);
      });
    });
    return map;
  };

  const applyDataset = (data = {}) => {
    const mothArr = Array.isArray(data.moths) ? data.moths : [];
    const butterflyArr = Array.isArray(data.butterflies) ? data.butterflies : [];
    const beetleArr = Array.isArray(data.beetles) ? data.beetles : [];
    const longhornArr = Array.isArray(data.longhornbeetles) ? data.longhornbeetles : [];
    const leafArr = Array.isArray(data.leafbeetles) ? data.leafbeetles : [];
    setMoths(mothArr);
    setButterflies(butterflyArr);
    setBeetles(beetleArr);
    setLonghornbeetles(longhornArr);
    setLeafbeetles(leafArr);
    setHostPlants(data.hostPlants || {});
    setFlowerVisitPlants(
      data.flowerVisitPlants ||
        buildFlowerVisitMap([
          ...mothArr,
          ...butterflyArr,
          ...beetleArr,
          ...longhornArr,
          ...leafArr,
        ]),
    );
    setPlantDetails(data.plantDetails || {});
    if (data.summaryCounts) {
      setSummaryCounts(data.summaryCounts);
    }
  };

  useEffect(() => {
    // 画像インデックスをアプリ起動直後にプリフェッチし、初回表示での画像欠落を防ぐ
    loadInsectImageIndexes().catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async (cachedVersion = null) => {
      if (!cacheLoadedRef.current) {
        setLoading(true);
      }
      setLoadError(null);
      const base = import.meta.env.BASE_URL || '/';
      let plantDetailsLite = {};
      // Try lightweight split JSON first to speed up initial paint
      try {
        const cacheMode = import.meta.env.DEV ? 'no-store' : 'default';
        const manifestUrl = `${base}assets/data-lite/manifest.json${import.meta.env.DEV ? `?v=${Date.now()}` : ''}`;
        // Allow HTTP cache in production (versioned URL keeps data fresh) to speed up repeats
        const manifestRes = await fetch(manifestUrl, { cache: cacheMode });
        let versionSuffix = import.meta.env.DEV ? `?v=${Date.now()}` : '';
        let manifest = null;
        let manifestVersion = null;
        if (manifestRes?.ok) {
          manifest = await manifestRes.json();
          manifestVersion = manifest?.version || null;
          versionSuffix = import.meta.env.DEV
            ? `?v=${Date.now()}`
            : manifestVersion
              ? `?v=${manifestVersion}`
              : '';
          const hostUrl = `${base}assets/data-lite/hostplants.json${versionSuffix}`;
          const plantInfoUrl = `${base}assets/data-lite/ylist-lite.json${versionSuffix}`;

          const [hostRes, plantInfoRes] = await Promise.all([
            fetch(hostUrl, { cache: cacheMode }),
            fetch(plantInfoUrl, { cache: cacheMode }).catch((error) => {
              logger.debug('Plant taxonomy preload skipped:', error);
              return null;
            }),
          ]);

          if (hostRes?.ok) {
            const hostMap = await hostRes.json();
          const plantInfoPayload =
            plantInfoRes && plantInfoRes.ok ? await plantInfoRes.json() : null;

          if (manifest && manifest.counts && hostMap && typeof hostMap === 'object') {
            cachedVersionRef.current = manifestVersion;
            if (cacheLoadedRef.current && cachedVersion && manifest.version === cachedVersion) {
              setSummaryCounts((prev) => prev || manifest.counts);
              setLoading(false);
              ensureTypesLoaderRef.current = () => {
                typesFetchStartedRef.current = true;
                typesFetchPromiseRef.current = Promise.resolve(null);
              };
              typesFetchStartedRef.current = true;
              typesFetchPromiseRef.current = Promise.resolve(null);
              return;
            }
            const plantInfoRaw = plantInfoPayload && typeof plantInfoPayload === 'object'
              ? plantInfoPayload.plants || {}
              : {};
            plantDetailsLite = {};
            Object.entries(plantInfoRaw).forEach(([name, detail]) => {
              if (!name) return;
              const familyJp = detail?.familyJp || '';
              const familyLatin = detail?.familyEn || '';
              const scientific = detail?.scientificName || '';
              const genus = scientific ? scientific.split(' ')[0] : '';
              const aliases = Array.isArray(detail?.aliases) ? detail.aliases.filter(Boolean) : [];
              const orderLatin = detail?.orderEn || '';
              plantDetailsLite[name] = {
                family: familyJp || '不明',
                familyName: familyJp || '不明',
                familyLatin: familyLatin || '',
                scientificName: scientific,
                genus,
                order: detail?.orderJp || '',
                orderLatin: orderLatin || '',
                aliases,
              };
            });

            // NOTE: full-dataset.json (約10MB) は初期描画の阻害要因になるためロードをスキップ。
            // オフラインキャッシュ用途で欲しい場合は下の idle プレフェッチを有効にする。

            const computedCounts = {
              ...manifest.counts,
              hostPlants: Object.keys(hostMap || {}).length,
            };

            if (!cacheLoadedRef.current) {
              setSummaryCounts(computedCounts);
              setHostPlants(hostMap);
              setPlantDetails(plantDetailsLite);
            }
            setLoading(false);

            const hydrateHostPlantsFromNormalized = async (insectLookup) => {
              if (hostCsvExtendStartedRef.current) return;
              hostCsvExtendStartedRef.current = true;
              try {
                const Papa = await getPapa();
                if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                  await new Promise((resolve) =>
                    window.requestIdleCallback(resolve, { timeout: 3000 }),
                  );
                }
                const normalizedUrl = `${base}hostplants.csv${versionSuffix}`;
                const csvRes = await fetch(normalizedUrl, { cache: cacheMode });
                if (!csvRes.ok) return;
                const csvText = await csvRes.text();
                if (!csvText) return;
                const parsed = await new Promise((resolve) => {
                  Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    worker: true, // offload large CSV parsing off the main thread to keep UI responsive
                    fastMode: true,
                    complete: (results) => resolve(results),
                    error: () => resolve(null),
                  });
                });
                if (!parsed || !Array.isArray(parsed.data)) return;

                const additions = new Map();
                const flowerAdditions = new Map();
                const plantMeta = new Map();
                const normalizePlant = (value) => {
                  if (!value || typeof value !== 'string') return '';
                  return value
                    .replace(/[（(][^）)]*科[^）)]*[）)]/g, '')
                    .replace(/[（(][^）)]*[）)]/g, '')
                    .trim();
                };
                parsed.data.forEach((row) => {
                  if (!row) return;
                  const plantNameRaw = (row.plant_name || '').trim();
                  const plantName = normalizePlant(plantNameRaw);
                  const insectId = (row.insect_id || '').trim();
                  const familyName = (row.plant_family || '').trim();
                  const lifeStage = (row.life_stage || '').trim();
                  const plantPart = (row.plant_part || '').trim();
                  if (!plantName || !insectId) return;
                  const insectName = insectLookup.get(insectId);
                  if (!insectName) return;
                  if (!plantMeta.has(plantName)) {
                    plantMeta.set(plantName, { family: familyName });
                  } else if (familyName && !plantMeta.get(plantName).family) {
                    plantMeta.get(plantName).family = familyName;
                  }

                  const plantPartCompact = plantPart.replace(/\s+/g, '');
                  const isFlowerVisit =
                    (lifeStage === '成虫' || !lifeStage) &&
                    plantPartCompact &&
                    plantPartCompact.includes('花');
                  if (isFlowerVisit) {
                    if (!flowerAdditions.has(plantName)) {
                      flowerAdditions.set(plantName, new Set());
                    }
                    flowerAdditions.get(plantName).add(insectName);
                    return;
                  }

                  if (!additions.has(plantName)) {
                    additions.set(plantName, {
                      insects: new Set(),
                      family: familyName,
                    });
                  }
                  const entry = additions.get(plantName);
                  entry.insects.add(insectName);
                  if (!entry.family && familyName) {
                    entry.family = familyName;
                  }
                });
                if (additions.size === 0 && flowerAdditions.size === 0 && plantMeta.size === 0) return;

                let updatedCount = null;
                if (additions.size > 0) {
                  setHostPlants((prev) => {
                    const next = { ...prev };
                    let changed = false;
                    additions.forEach(({ insects }, plant) => {
                      const existing = Array.isArray(next[plant]) ? new Set(next[plant]) : new Set();
                      const beforeSize = existing.size;
                      insects.forEach((name) => existing.add(name));
                      if (!next[plant] || existing.size !== beforeSize) {
                        next[plant] = Array.from(existing);
                        changed = true;
                      }
                    });
                    if (changed) {
                      updatedCount = Object.keys(next).length;
                      return next;
                    }
                    return prev;
                  });
                }

                if (updatedCount !== null) {
                  setSummaryCounts((prev) => {
                    if (!prev) return prev;
                    if (prev.hostPlants === updatedCount) return prev;
                    return { ...prev, hostPlants: updatedCount };
                  });
                }

                setPlantDetails((prev) => {
                  let changed = false;
                  const next = { ...prev };
                  plantMeta.forEach(({ family }, plant) => {
                    if (!next[plant]) {
                      next[plant] = plantDetailsLite[plant] || {
                        family: family || '不明',
                        familyName: family || '不明',
                        familyLatin: '',
                        scientificName: '',
                        genus: '',
                        order: '',
                        orderLatin: '',
                        aliases: [],
                      };
                      changed = true;
                    } else if (
                      family &&
                      (!next[plant].family || next[plant].family === '不明')
                    ) {
                      next[plant] = {
                        ...next[plant],
                        family,
                        familyName: family,
                      };
                      changed = true;
                    }
                  });
                  return changed ? next : prev;
                });

                if (flowerAdditions.size > 0) {
                  setFlowerVisitPlants((prev) => {
                    const next = { ...prev };
                    let changed = false;
                    flowerAdditions.forEach((insects, plant) => {
                      const existing = Array.isArray(next[plant]) ? new Set(next[plant]) : new Set();
                      const beforeSize = existing.size;
                      insects.forEach((name) => existing.add(name));
                      if (!next[plant] || existing.size !== beforeSize) {
                        next[plant] = Array.from(existing);
                        changed = true;
                      }
                    });
                    return changed ? next : prev;
                  });
                }
              } catch (error) {
                logger.debug('Failed to hydrate host plants from normalized CSV:', error);
              }
            };

            // Reset fetch guards for fresh lifecycle
            typesFetchStartedRef.current = false;
            typesFetchPromiseRef.current = null;

            const loadTypePartitions = async () => {
              const responses = await Promise.all([
                fetch(`${base}assets/data-lite/moths.json${versionSuffix}`, { cache: cacheMode }),
                fetch(`${base}assets/data-lite/butterflies.json${versionSuffix}`, { cache: cacheMode }),
                fetch(`${base}assets/data-lite/beetles.json${versionSuffix}`, { cache: cacheMode }),
                fetch(`${base}assets/data-lite/longhornbeetles.json${versionSuffix}`, { cache: cacheMode }),
                fetch(`${base}assets/data-lite/leafbeetles.json${versionSuffix}`, { cache: cacheMode }),
              ]);
              const [mothRes, butterflyRes, beetleRes, longhornRes, leafRes] = responses;
              const safeJson = async (res) => (res && res.ok ? res.json() : []);
              const [mothArr, butterArr, beetleArr, longhornArr, leafArr] = await Promise.all([
                safeJson(mothRes),
                safeJson(butterflyRes),
                safeJson(beetleRes),
                safeJson(longhornRes),
                safeJson(leafRes),
              ]);
              if (Array.isArray(mothArr)) setMoths(mothArr);
              if (Array.isArray(butterArr)) setButterflies(butterArr);
              if (Array.isArray(beetleArr)) setBeetles(beetleArr);
              if (Array.isArray(longhornArr)) setLonghornbeetles(longhornArr);
              if (Array.isArray(leafArr)) setLeafbeetles(leafArr);
              // Keep summary counts in sync with loaded partitions (avoid stale cached counts)
              setSummaryCounts((prev) => ({
                ...(prev || {}),
                moths: Array.isArray(mothArr) ? mothArr.length : 0,
                butterflies: Array.isArray(butterArr) ? butterArr.length : 0,
                beetles: Array.isArray(beetleArr) ? beetleArr.length : 0,
                longhornbeetles: Array.isArray(longhornArr) ? longhornArr.length : 0,
                leafbeetles: Array.isArray(leafArr) ? leafArr.length : 0,
              }));
              const flowerMap = buildFlowerVisitMap([
                ...(mothArr || []),
                ...(butterArr || []),
                ...(beetleArr || []),
                ...(longhornArr || []),
                ...(leafArr || []),
              ]);
              setFlowerVisitPlants(flowerMap);
              const lookup = new Map();
              [...(mothArr || []), ...(butterArr || []), ...(beetleArr || []), ...(longhornArr || []), ...(leafArr || [])].forEach(
                (insect) => {
                  if (insect && insect.id && insect.name) {
                    lookup.set(insect.id, insect.name);
                  }
                },
              );
              // Plantsタブが開かれるまでホスト植物の詳細パースを遅延
              pendingHostHydrationRef.current = () => hydrateHostPlantsFromNormalized(lookup);
              if (hostHydrationRequestedRef.current && pendingHostHydrationRef.current) {
                pendingHostHydrationRef.current();
                pendingHostHydrationRef.current = null;
              }
              return { mothArr, butterArr, beetleArr, longhornArr, leafArr };
            };

            // 非同期・アイドル時にだけ full-dataset をプレフェッチし、IndexedDB キャッシュだけ温める
            const prefetchFullDataset = () => {
              if (typeof window === 'undefined') return;
              const fire = async () => {
                try {
                  const fullRes = await fetch(`${base}assets/data-lite/full-dataset.json${versionSuffix}`, {
                    cache: cacheMode,
                  });
                  if (!fullRes.ok) return;
                  const fullData = await fullRes.json();
                  const fullFlowerVisits = buildFlowerVisitMap([
                    ...(fullData.moths || []),
                    ...(fullData.butterflies || []),
                    ...(fullData.beetles || []),
                    ...(fullData.longhornbeetles || []),
                    ...(fullData.leafbeetles || []),
                  ]);
                  await saveDatasetToCache(manifest.version || null, {
                    moths: fullData.moths,
                    butterflies: fullData.butterflies,
                    beetles: fullData.beetles,
                    longhornbeetles: fullData.longhornbeetles,
                    leafbeetles: fullData.leafbeetles,
                    hostPlants: fullData.hostPlants || hostMap,
                    flowerVisitPlants: fullFlowerVisits,
                    plantDetails: fullData.plantDetails || plantDetailsLite,
                    summaryCounts: fullData.summaryCounts || manifest.counts,
                  });
                } catch (error) {
                  if (import.meta.env.DEV) logger.debug('Idle prefetch full-dataset skipped:', error);
                }
              };
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => fire(), { timeout: 5000 });
              } else {
                setTimeout(fire, 5000);
              }
            };

            const startFetchTypes = () => {
              if (typesFetchStartedRef.current && typesFetchPromiseRef.current) {
                return typesFetchPromiseRef.current;
              }
              if (typesFetchStartedRef.current) {
                return Promise.resolve(null);
              }
              typesFetchStartedRef.current = true;
              const promise = loadTypePartitions().catch((error) => {
                logger.warn('Failed to load insect partitions:', error);
                typesFetchStartedRef.current = false;
                typesFetchPromiseRef.current = null;
                return null;
              });
              typesFetchPromiseRef.current = promise;
              return promise;
            };

            ensureTypesLoaderRef.current = startFetchTypes;

            const requestHostHydration = () => {
              hostHydrationRequestedRef.current = true;
              if (pendingHostHydrationRef.current) {
                pendingHostHydrationRef.current();
                pendingHostHydrationRef.current = null;
              }
            };
            requestHostHydrationRef.current = requestHostHydration;

            // Plantsタブ未訪問でも、アイドル時にバックグラウンドでホスト植物をマージしておく（非同期）
            const idleHydrateHostplants = () => {
              if (typeof window === 'undefined') return;
              const fire = () => requestHostHydration();
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(fire, { timeout: 10000 });
              } else {
                setTimeout(fire, 10000);
              }
            };

            try {
              const params = new URLSearchParams(location.search || '');
              const initialTab = params.get('tab') || 'insects';
              if (initialTab !== 'plants') {
                startFetchTypes();
                idleHydrateHostplants();
              } else {
                const delay = 5000;
                if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                  setTimeout(
                    () => window.requestIdleCallback(() => startFetchTypes(), { timeout: 2000 }),
                    delay,
                  );
                } else {
                  setTimeout(() => startFetchTypes(), delay);
                }
              }
            } catch (error) {
              logger.debug('Failed to interpret initial tab, fetching insects immediately:', error);
              startFetchTypes();
              idleHydrateHostplants();
            }

            prefetchFullDataset();

            return;
          }
        } // end if (hostRes?.ok)
      } else {
        // manifest.json が取得できなかった場合のフォールバック: 合成インデックスを利用
        const liteUrl = `${base}assets/data-lite/index.json${versionSuffix || (import.meta.env.DEV ? `?v=${Date.now()}` : '')}`;
        const res = await fetch(liteUrl, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
        if (res.ok) {
          const lite = await res.json();
          if (lite && Array.isArray(lite.moths) && Array.isArray(lite.butterflies)) {
            setMoths(lite.moths);
            setButterflies(lite.butterflies);
            setBeetles(lite.beetles || []);
            setLonghornbeetles(lite.longhornbeetles || []);
            setLeafbeetles(lite.leafbeetles || []);
            setHostPlants(lite.hostPlants || {});
            setPlantDetails({});
            setLoading(false);
            // Provide no-op loader since combined index already has arrays
            ensureTypesLoaderRef.current = () => {
              typesFetchStartedRef.current = true;
            };
            // Continue to CSV background load
          }
        }
      }
      } catch (_) {
        // ignore and fallback to full pipeline
      }
      let mainMothData = [];
      let hostPlantData = {};
        let plantDetailData = safeDeepClone(plantDetailsLite);
      const wameiCsvPath = `${import.meta.env.BASE_URL}wamei_checklist_ver.1.10.csv`;
      const mainCsvPath = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}ListMJ_hostplants_master.csv?v=${Date.now()}&bust=${Math.random()}&nocache=${Date.now()}&t=${performance.now()}`
        : `${import.meta.env.BASE_URL}ListMJ_hostplants_master.csv`;
      const yListCsvPath = `${import.meta.env.BASE_URL}20210514YList_download.csv`; // New YList CSV path
      const hamushiIntegratedCsvPath = `${import.meta.env.BASE_URL}hamushi_integrated_master.csv`;
      const butterflyCsvPath = `${import.meta.env.BASE_URL}butterfly_host.csv`;
      const beetleCsvPath = `${import.meta.env.BASE_URL}buprestidae_host.csv`;
      const kirigaCsvPath = `${import.meta.env.BASE_URL}日本の冬夜蛾.csv`;
      const fuyushakuCsvPath = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}日本の冬尺蛾.csv?v=${Date.now()}&bust=${Math.random()}&nocache=${Date.now()}&t=${performance.now()}`
        : `${import.meta.env.BASE_URL}日本の冬尺蛾.csv`;
      // emergence_time_integrated.csv統合済み - hamushi_integrated_master.csvに統合完了
      const genusMappingCsvPath = `${import.meta.env.BASE_URL}genus_mapping.csv`;
      
      // 正規化データのパス（新しい3ファイル構造）
      const assetVersion = import.meta.env.VITE_ASSET_VERSION || '';
      const normalizedInsectsCsvPath = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}insects.csv?v=${Date.now()}`
        : `${import.meta.env.BASE_URL}insects.csv${assetVersion ? `?v=${assetVersion}` : ''}`;
      const normalizedHostplantsCsvPath = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}hostplants.csv?v=${Date.now()}`
        : `${import.meta.env.BASE_URL}hostplants.csv${assetVersion ? `?v=${assetVersion}` : ''}`;
      const normalizedNotesCsvPath = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}general_notes.csv?v=${Date.now()}`
        : `${import.meta.env.BASE_URL}general_notes.csv${assetVersion ? `?v=${assetVersion}` : ''}`;

      // 任意提供の成虫出現時期オーバーライドは廃止（general_notes から抽出運用に統一）
      
      // 正規化データのみを優先的に使う運用フラグ
      // 既定: 本番では true（明示的に "false" 指定された場合のみ無効）
      const normalizedEnv = import.meta.env.VITE_USE_NORMALIZED_ONLY;
      const useNormalizedOnly = (normalizedEnv === 'true') || (import.meta.env.PROD && normalizedEnv !== 'false');
      if (import.meta.env.DEV) logger.debug('useNormalizedOnly (effective):', useNormalizedOnly, '(env:', normalizedEnv, ')');

      // Unified scientific name processing function for all insect types - FIXED SCOPE
      const processScientificName = (existingScientificName, genusName, speciesName, authorName, yearName, insectType = 'moth') => {
        // Clean up inputs
        const cleanGenus = genusName?.trim() || '';
        const cleanSpecies = speciesName?.trim() || '';
        const cleanAuthor = authorName?.trim() || '';
        const cleanYear = yearName?.trim() || '';
        let cleanExisting = existingScientificName?.trim() || '';
        
        // Clean up basic formatting issues first
        cleanExisting = cleanExisting.replace(/\s*"?\s*$/, '').trim();
        
        // Fix specific malformed patterns
        if (cleanExisting.includes(',"')) {
          // Fix pattern like 'Xylena formosa (Butler,"1878)' to 'Xylena formosa (Butler 1878)'
          cleanExisting = cleanExisting.replace(/,\"(\d{4})\)/g, ' $1)');
        }
        
        // Fix other common malformations
        cleanExisting = cleanExisting.replace(/,(\d{4})\)/g, ', $1)'); // Fix missing space before year
        cleanExisting = cleanExisting.replace(/\(\s*([^,)]+)\s*(\d{4})\s*\)/g, '($1, $2)'); // Ensure comma between author and year
        
        // COMPREHENSIVE SCIENTIFIC NAME REPAIR SYSTEM
        // Fix critically broken scientific names from CSV parsing errors
        const repairBrokenScientificName = (brokenName) => {
          // Pattern 1: Scientific names mixed with food plant data
          // e.g., "Genus species (Author,"food plant data; year), more data; year)"
          const mixedDataPattern = /^([A-Z][a-z]+\s+[a-z]+\s*\([^,"]+),?\s*"?[^)]*(\d{4})[^)]*\)/;
          const mixedMatch = brokenName.match(mixedDataPattern);
          if (mixedMatch) {
            const [, binomial, year] = mixedMatch;
            const cleanBinomial = binomial.trim();
            allowDebugLogs && console.log(`REPAIR: Fixed mixed data pattern: "${brokenName}" -> "${cleanBinomial}, ${year})"`);
            return `${cleanBinomial}, ${year})`;
          }
          
          // Pattern 2: Extract valid binomial from corrupted data
          // Look for pattern: Genus species (Author at the beginning
          const binomialExtractPattern = /^([A-Z][a-z]+\s+[a-z]+\s*\([^,")]+)/;
          const extractMatch = brokenName.match(binomialExtractPattern);
          if (extractMatch) {
            const extracted = extractMatch[1];
            // Try to find year in the corrupted data
            const yearMatch = brokenName.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              allowDebugLogs && console.log(`REPAIR: Extracted from corrupted data: "${brokenName}" -> "${extracted}, ${yearMatch[0]})"`);
              return `${extracted}, ${yearMatch[0]})`;
            } else {
              allowDebugLogs && console.log(`REPAIR: Extracted binomial without year: "${brokenName}" -> "${extracted})"`);
              return `${extracted})`;
            }
          }
          
          return brokenName; // Return unchanged if no pattern matches
        };
        
        // Apply repair function to existing scientific name
        if (cleanExisting && (cleanExisting.includes('",') || cleanExisting.includes('; ') || cleanExisting.includes('で飼育'))) {
          cleanExisting = repairBrokenScientificName(cleanExisting);
        }
        
        // CSV修正により不要になった既知の修正処理
        // Special case fixes for known problematic species (DISABLED - fixed in CSV)
        /*
        const knownFixes = {
          'Diphtherocome autumnalis (Chang,"サクラ類': 'Diphtherocome autumnalis (Chang, 1991)',
          'Arcte coerula (Guenée': 'Arcte coerula (Guenée, 1852)'
        };
        */
        
        /*
        for (const [broken, fixed] of Object.entries(knownFixes)) {
          if (cleanExisting.includes(broken)) {
            allowDebugLogs && console.log(`REPAIR: Applied known fix: "${cleanExisting}" -> "${fixed}"`);
            cleanExisting = fixed;
            break;
          }
        }
        */
        
        // Check if existing scientific name is valid (has both genus and species)
        if (cleanExisting) {
          // Check if it's a complete binomial (genus + species)
          const binomialMatch = cleanExisting.match(/^([A-Z][a-z]+)\s+([a-z]+(?:\s+[a-z]+)*)/);
          if (binomialMatch) {
            // It's a valid binomial, but check if it has complete author and year
            const hasCompleteAuthorYear = cleanExisting.match(/\([^)]+,\s*\d{4}\)$/);
            if (hasCompleteAuthorYear) {
              return cleanExisting;
            }
            
            // Check if it has incomplete author/year (missing comma and year)
            const hasIncompleteAuthor = cleanExisting.match(/\([^)]+$/);
            if (hasIncompleteAuthor && cleanYear) {
              // Fix incomplete format like "Cucullia argentea (Hufnagel" by adding year
              const incompleteAuthor = hasIncompleteAuthor[0].substring(1); // Remove opening parenthesis
              return `${binomialMatch[1]} ${binomialMatch[2]} (${incompleteAuthor}, ${cleanYear})`;
            }
            
            // Check if it has author without parentheses (e.g., "Orthosia satoi Sugi")
            const authorWithoutParentheses = cleanExisting.match(/^([A-Z][a-z]+\s+[a-z]+)\s+([A-Z][a-zA-Z]+)$/);
            if (authorWithoutParentheses && cleanYear) {
              const [, binomial, author] = authorWithoutParentheses;
              return `${binomial} (${author}, ${cleanYear})`;
            }
            
            // If binomial is complete but no author/year, use as is
            return cleanExisting;
          }
          
          // Check if it's an incomplete name (genus + subgenus only)
          const incompleteMatch = cleanExisting.match(/^([A-Z][a-z]+)\s+\([^)]+\)$/);
          if (incompleteMatch) {
            // It's incomplete (genus + subgenus), need to fix
            allowDebugLogs && console.log(`Incomplete scientific name detected for ${insectType}: ${cleanExisting}`);
            return cleanGenus ? `${cleanGenus} sp.` : '未同定';
          }
        }
        
        // If we have both genus and species, construct binomial
        if (cleanGenus && cleanSpecies) {
          let binomial = `${cleanGenus} ${cleanSpecies}`;
          
          // Add author and year if available
          if (cleanAuthor || cleanYear) {
            // Check if author already has parentheses
            if (cleanAuthor && cleanAuthor.startsWith('(') && cleanAuthor.endsWith(')')) {
              // Author already has parentheses, don't add extra ones
              if (cleanYear) {
                // Remove closing parenthesis, add year, then close
                const authorWithoutClosing = cleanAuthor.slice(0, -1);
                binomial += ` ${authorWithoutClosing}, ${cleanYear})`;
              } else {
                binomial += ` ${cleanAuthor}`;
              }
            } else {
              // Author doesn't have parentheses, add them
              const authorYear = [cleanAuthor, cleanYear].filter(Boolean).join(', ');
              if (authorYear) {
                binomial += ` (${authorYear})`;
              }
            }
          }
          
          return binomial;
        }
        
        // If we only have genus (no species), mark as unidentified
        if (cleanGenus) {
          return `${cleanGenus} sp.`;
        }
        
        // If we have nothing useful, return unknown
        return '未同定';
      };
      
      // Scientific name quality validation function
      const validateScientificName = (scientificName, japaneseName, insectType) => {
        if (!scientificName) return { isValid: false, issues: ['学名が空白'] };
        
        const issues = [];
        
        // Check for incomplete names (genus + subgenus only)
        const incompletePattern = /^([A-Z][a-z]+)\s+\([^)]+\)$/;
        if (incompletePattern.test(scientificName)) {
          issues.push('種小名が不明（属名＋亜属名のみ）');
        }
        
        // Check for "sp." designation
        if (scientificName.includes(' sp.')) {
          issues.push('未同定種（sp.）');
        }
        
        // Check for "未同定"
        if (scientificName === '未同定') {
          issues.push('未同定');
        }
        
        // ENHANCED VALIDATION: Check for corrupted scientific names
        const corruptionPatterns = [
          { pattern: /[";]/, description: '破損データの残存（セミコロンまたは引用符）' },
          { pattern: /で飼育|により|について/, description: '食草データの混入' },
          { pattern: /科$/, description: '科名の混入' },
          { pattern: /\d{4}[^),\s]/, description: '年数の表記異常' },
          { pattern: /\([^)]*,[^)]*$/, description: '括弧の不完全な閉じ' }
        ];
        
        for (const { pattern, description } of corruptionPatterns) {
          if (pattern.test(scientificName)) {
            issues.push(`データ破損の可能性: ${description}`);
            console.warn(`CORRUPTION DETECTED in "${japaneseName}": ${scientificName} - ${description}`);
          }
        }
        
        // Check for basic binomial structure
        const binomialPattern = /^([A-Z][a-z]+)\s+([a-z]+(?:\s+[a-z]+)*)/;
        if (!binomialPattern.test(scientificName) && !scientificName.includes(' sp.') && scientificName !== '未同定') {
          issues.push('不正な学名形式');
        }
        
        // Log issues for debugging
        if (issues.length > 0) {
          allowDebugLogs && console.log(`Scientific name quality issues for ${insectType} "${japaneseName}": ${scientificName} - ${issues.join(', ')}`);
        }
        
        return {
          isValid: issues.length === 0,
          issues: issues
        };
      };

      // Initialize all data arrays at function scope to prevent scope errors
      let butterflyData = [];
      let combinedBeetleData = [];
      let combinedLeafbeetleData = [];
      let mainBeetleData = [];
      let beetleData = [];
      let leafbeetleData = [];

      if (isDevelopment) logger.debug("Fetching CSV files...");
      logger.debug("wameiCsvPath:", wameiCsvPath);
      logger.debug("mainCsvPath:", mainCsvPath);
      logger.debug("yListCsvPath:", yListCsvPath);
      logger.debug("hamushiIntegratedCsvPath:", hamushiIntegratedCsvPath);
      logger.debug("butterflyCsvPath:", butterflyCsvPath);
      logger.debug("beetleCsvPath:", beetleCsvPath);
      logger.debug("BASE_URL:", import.meta.env.BASE_URL);

      try {
        // Fetch with timeout for all files to prevent hanging
        const fetchWithTimeout = (url, timeout = 15000) => {
          return Promise.race([
            fetch(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Request timeout for ${url}`)), timeout)
            )
          ]);
        };

        const safeFileLoad = async (path, name, timeout = 15000) => {
          try {
            logger.debug(`Loading ${name} from ${path}`);
            const res = await fetchWithTimeout(path, timeout);
            if (!res.ok) {
              logger.error(`Failed to fetch ${name}: ${res.statusText}`);
              return null;
            }
            const text = await res.text();
            logger.debug(`Successfully loaded ${name} (${text.length} characters)`);
            
            // Debug: Check if スミレモンキリガ exists in the loaded file
            if (name === 'main moth data') {
              if (text.includes('スミレモンキリガ')) {
                if (isDevelopment) logger.debug('DEBUG: スミレモンキリガ found in loaded CSV');
                const lines = text.split('\n');
                const sumiLine = lines.find(line => line.includes('スミレモンキリガ'));
                if (sumiLine) {
                  if (isDevelopment) logger.debug('DEBUG: スミレモンキリガ line:', sumiLine);
                  // Check specific content to determine which CSV was loaded
                  if (sumiLine.includes('ツバキ類(ツバキ科)')) {
                    if (isDevelopment) logger.debug('DEBUG: ✅ CORRECT CSV - New kiriga data with ツバキ類(ツバキ科)');
                  } else if (sumiLine.includes('1990,ツバキ類(ツバキ科)')) {
                    logger.error('DEBUG: ❌ OLD CSV - Bokutou data with malformed food plant');
                  } else {
                    logger.warn('DEBUG: ⚠️ UNKNOWN CSV FORMAT for スミレモンキリガ');
                  }
                }
              } else {
                logger.error('DEBUG: ❌ スミレモンキリガ NOT FOUND in loaded CSV - This is the problem!');
                if (isDevelopment) logger.debug('DEBUG: CSV size:', text.length, 'characters');
                if (isDevelopment) logger.debug('DEBUG: First 500 chars:', text.substring(0, 500));
              }
            }
            
            return text;
          } catch (error) {
            logger.error(`Error loading ${name}:`, error);
            return null;
          }
        };

        // Load files with safe loading - prioritize essential files
        logger.debug("=== Starting file loading process ===");
        if (isDevelopment) logger.debug("DEBUG: フユシャクCsvPath:", fuyushakuCsvPath);
        if (isDevelopment) logger.debug("DEBUG: About to load フユシャク file with safeFileLoad");
        
        let wameiText = null, mainText = null, yListText = null, hamushiIntegratedText = null, butterflyText = null, beetleText = null, kirigaText = null, fuyushakuText = null, genusMappingText = null, normalizedInsectsText = null, normalizedHostplantsText = null, normalizedNotesText = null;

        if (useNormalizedOnly) {
          // Load only normalized data + optional plant helpers
          [wameiText, yListText, genusMappingText, normalizedInsectsText, normalizedHostplantsText, normalizedNotesText] = await Promise.all([
            safeFileLoad(wameiCsvPath, 'wamei checklist', 20000),
            safeFileLoad(yListCsvPath, 'YList data', 30000),
            safeFileLoad(genusMappingCsvPath, 'genus mapping data', 10000),
            safeFileLoad(normalizedInsectsCsvPath, 'normalized insects data', 15000),
            safeFileLoad(normalizedHostplantsCsvPath, 'normalized hostplants data', 15000),
            safeFileLoad(normalizedNotesCsvPath, 'normalized notes data', 20000)
          ]);
          // emergence overrides は廃止
        } else {
          // Load everything (legacy compatibility)
          [wameiText, mainText, yListText, hamushiIntegratedText, butterflyText, beetleText, kirigaText, fuyushakuText, genusMappingText, normalizedInsectsText, normalizedHostplantsText, normalizedNotesText] = await Promise.all([
            safeFileLoad(wameiCsvPath, 'wamei checklist', 20000),
            safeFileLoad(mainCsvPath, 'main moth data', 20000),
            safeFileLoad(yListCsvPath, 'YList data', 30000), // Longer timeout for large file
            safeFileLoad(hamushiIntegratedCsvPath, 'hamushi integrated data', 20000),
            safeFileLoad(butterflyCsvPath, 'butterfly data', 15000),
            safeFileLoad(beetleCsvPath, 'beetle data', 15000),
            safeFileLoad(kirigaCsvPath, 'kiriga data', 10000),
            safeFileLoad(fuyushakuCsvPath, 'fuyushaku data', 10000),
            safeFileLoad(genusMappingCsvPath, 'genus mapping data', 10000),
            safeFileLoad(normalizedInsectsCsvPath, 'normalized insects data', 15000),
            safeFileLoad(normalizedHostplantsCsvPath, 'normalized hostplants data', 15000),
            safeFileLoad(normalizedNotesCsvPath, 'normalized notes data', 20000)
          ]);
          // emergence overrides は廃止
        }
        
        if (isDevelopment) logger.debug("DEBUG: File loading completed, checking results...");
        
        // Debug フユシャク file loading（legacy時のみ）
        if (!useNormalizedOnly && isDevelopment) logger.debug('DEBUG: フユシャク file load result:', {
          path: fuyushakuCsvPath,
          loaded: !!fuyushakuText,
          length: fuyushakuText ? fuyushakuText.length : 0,
          firstChars: fuyushakuText ? fuyushakuText.substring(0, 100) : 'N/A'
        });

        // Ensure legacy mainText is an empty string when using normalized-only to avoid null parsing
        if (useNormalizedOnly && !mainText) {
          mainText = '';
        }

        logger.debug("File loading results:", {
          wamei: wameiText ? 'SUCCESS' : 'FAILED',
          main: mainText ? 'SUCCESS' : 'FAILED',
          yList: yListText ? 'SUCCESS' : 'FAILED',
          hamushiIntegrated: hamushiIntegratedText ? 'SUCCESS' : 'FAILED',
          butterfly: butterflyText ? 'SUCCESS' : 'FAILED',
          beetle: beetleText ? 'SUCCESS' : 'FAILED',
          kiriga: useNormalizedOnly ? 'SKIPPED' : (kirigaText ? 'SUCCESS' : 'FAILED'),
          fuyushaku: useNormalizedOnly ? 'SKIPPED' : (fuyushakuText ? 'SUCCESS' : 'FAILED'),
          // emergenceTime: 統合済みのためhamushiIntegratedTextに含まれる
          genusMapping: genusMappingText ? 'SUCCESS' : 'FAILED',
          normalizedInsects: normalizedInsectsText ? 'SUCCESS' : 'FAILED',
          normalizedHostplants: normalizedHostplantsText ? 'SUCCESS' : 'FAILED',
          normalizedNotes: normalizedNotesText ? 'SUCCESS' : 'FAILED'
        });
        
        // Process normalized CSV data if available
        let normalizedData = null;
        if (normalizedInsectsText && normalizedHostplantsText && normalizedNotesText) {
          try {
            logger.debug("正規化CSVファイルを処理中...");
            
            // Import normalized data parser
            const { convertNormalizedDataToStandardFormat, validateNormalizedData } = await import('./utils/normalizedDataParser.js');
            
            // Parse normalized CSVs
            const insectsParsed = Papa.parse(normalizedInsectsText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim(),
              transform: (value) => value?.trim() || ''
            });
            
            const hostplantsParsed = Papa.parse(normalizedHostplantsText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim()
            });
            
            const notesParsed = Papa.parse(normalizedNotesText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim(),
              transform: (value) => value?.trim() || ''
            });
            // Fallback: if parsing errors exist, manually parse lines to recover critical fields
            let notesData = notesParsed.data;
            try {
              const lines = normalizedNotesText.replace(/\r\n?|\n/g, '\n').split('\n');
              const nonEmptyCount = lines.filter(l => l && l.trim()).length;
              const shouldFallback = (notesParsed?.errors?.length || 0) > 0 || (notesParsed?.data?.length || 0) + 10 < (nonEmptyCount - 1);
              if (shouldFallback) {
                const parseCsvLine = (line) => {
                  const out = []; let cur = ''; let q = false;
                  for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (q) {
                      if (ch === '"') {
                        if (line[i + 1] === '"') { cur += '"'; i++; }
                        else { q = false; }
                      } else { cur += ch; }
                    } else {
                      if (ch === '"') q = true;
                      else if (ch === ',') { out.push(cur); cur = ''; }
                      else { cur += ch; }
                    }
                  }
                  out.push(cur);
                  return out;
                };
                const dequote = (s) => (s || '').replace(/^"|"$/g, '').trim();
                const sanitize = (s) => (s || '').toString().replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
                const headerTokens = parseCsvLine(lines[0]).map(dequote);
                const idxRecord = headerTokens.indexOf('record_id');
                const idxInsect = headerTokens.indexOf('insect_id');
                const idxType = headerTokens.indexOf('note_type');
                const idxContent = headerTokens.indexOf('content');
                const idxRef = headerTokens.indexOf('reference');
                const idxPage = headerTokens.indexOf('page');
                const idxYear = headerTokens.indexOf('year');
                const recs = [];
                for (let i = 1; i < lines.length; i++) {
                  const line = lines[i];
                  if (!line || !line.trim()) continue;
                  const cols = parseCsvLine(line).map(dequote);
                  if (cols.length < 2) continue;
                  const rec = {
                    record_id: idxRecord >= 0 ? sanitize(cols[idxRecord] || '') : sanitize(cols[0] || ''),
                    insect_id: idxInsect >= 0 ? sanitize(cols[idxInsect] || '') : sanitize(cols[1] || ''),
                    note_type: idxType >= 0 ? sanitize(cols[idxType] || '') : sanitize(cols[2] || ''),
                    content: idxContent >= 0 ? sanitize(cols[idxContent] || '') : sanitize(cols[3] || ''),
                    reference: idxRef >= 0 ? sanitize(cols[idxRef] || '') : sanitize(cols[4] || ''),
                    page: idxPage >= 0 ? sanitize(cols[idxPage] || '') : '',
                    year: idxYear >= 0 ? sanitize(cols[idxYear] || '') : ''
                  };
                  if (rec.insect_id) recs.push(rec);
                }
                if (recs.length > 0) {
                  if (isDevelopment) logger.warn('Using manual CSV parse fallback for general_notes (rows=', recs.length, ')');
                  notesData = recs;
                }
              }
            } catch (e) {
              logger.error('Manual parse fallback failed for general_notes:', e);
            }
            
            // Check for parsing errors
            [insectsParsed, hostplantsParsed, notesParsed].forEach((parsed, index) => {
              const names = ['insects', 'hostplants', 'notes'];
              if (parsed.errors?.length > 0) {
                logger.warn(`正規化CSV解析警告 (${names[index]}):`, parsed.errors);
              }
            });
            
            // Convert to standard format
            normalizedData = convertNormalizedDataToStandardFormat(
              insectsParsed.data, 
              hostplantsParsed.data, 
              notesData
            );
            
            // Validate data quality
            const qualityReport = validateNormalizedData(normalizedData);
            logger.debug("正規化データ品質レポート:", qualityReport);
            
            // Log first few entries for verification
            if (normalizedData.moths?.length > 0) {
              logger.debug("正規化データサンプル (蛾類):", normalizedData.moths.slice(0, 2));
            }
            
          } catch (error) {
            logger.error("正規化CSV処理エラー:", error);
            normalizedData = null;
          }
        }

        // Check if essential files loaded
        // 正規化データがある場合は旧メインCSVが無くても続行（GitHub Pagesで未配置でも白画面にしない）
        if (!mainText && !useNormalizedOnly) {
          logger.warn('Main moth data file missing. Proceeding with normalized CSVs only.');
          mainText = '';
        }
        if (!wameiText) {
          logger.warn('Wamei checklist failed to load - plant family data may be incomplete');
        }

        if (isDevelopment) logger.debug("CSV files fetched successfully. Parsing...");

        // papaparse はここで遅延ロード（初期バンドルから除外）
        const Papa = await getPapa();

        // Parse キリガ CSV to create emergence time lookup table（normalizedOnly時はスキップ）
        const emergenceTimeMap = new Map();
        let kirigaData = [];
        if (!useNormalizedOnly) {
          // emergence_time_integrated.csvはhamushi_integrated_master.csvに統合済み
          if (kirigaText && kirigaText.trim()) {
            try {
              const kirigaParsed = Papa.parse(kirigaText, {
                header: true,
                skipEmptyLines: 'greedy',
                delimiter: ',',
                quoteChar: '"',
                escapeChar: '"'
              });
              kirigaData = kirigaParsed.data;
            } catch (error) {
              logger.warn('Failed to parse キリガ CSV:', error);
              kirigaData = [];
            }
          } else {
            logger.warn('キリガ CSV data is empty or failed to load');
          }
        }
        
        // Debug log for キバラモクメキリガ
        const kibaraEntry = kirigaData.find(row => row['和名'] && row['和名'].includes('キバラモクメキリガ'));
        if (kibaraEntry) {
          logger.debug('Found キバラモクメキリガ:', kibaraEntry);
        } else {
          if (isDevelopment) logger.debug('キバラモクメキリガ not found in parsed data');
          if (isDevelopment) logger.debug('Sample parsed entries:', kirigaData.slice(0, 5));
        }
        
        logger.debug("Parsed キリガ data:", kirigaData.length, "entries");
        
        // Create comprehensive data maps from キリガ data
        const kirigaHostPlantMap = new Map();
        const kirigaRemarksMap = new Map();
        
        kirigaData.forEach(row => {
          const japaneseName = row['和名']?.trim();
          const scientificName = row['学名']?.trim();
          const emergenceTime = row['成虫の発生時期']?.trim();
          const hostPlants = row['食草']?.trim();
          const remarks = row['食草に関する備考']?.trim();
          
          // Debug specific species
          if (japaneseName && japaneseName.includes('アズサキリガ')) {
            if (allowDebugLogs) console.log('DEBUG: アズサキリガ found in kiriga CSV:', {
              japaneseName, scientificName, emergenceTime, hostPlants, remarks
            });
          }
          
          // Store emergence time data from キリガ (キリガCSVを優先 - より詳細で正確なデータ)
          let normalizedEmergenceTime = emergenceTime; // スコープを外側に移動
          if (japaneseName && emergenceTime && emergenceTime !== '不明') {
            // アズサキリガの発生時期表記を正規化
            if (japaneseName === 'アズサキリガ' && emergenceTime.includes('低標高地では') && emergenceTime.includes('高地では')) {
              // "低標高地では3月下旬から、高地では5月中旬まで" -> "3月下旬～5月中旬"
              const lowAltMatch = emergenceTime.match(/低標高地では(\d+月[上中下]旬)から/);
              const highAltMatch = emergenceTime.match(/高地では(\d+月[上中下]旬)まで/);
              if (lowAltMatch && highAltMatch) {
                normalizedEmergenceTime = `${lowAltMatch[1]}～${highAltMatch[1]}`;
                allowDebugLogs && console.log(`Normalized アズサキリガ emergence time: "${emergenceTime}" -> "${normalizedEmergenceTime}"`);
              }
            }
            
            // ゴマダラキリガの特別処理 - ガントチャート用に変換
            if (japaneseName === 'ゴマダラキリガ' && emergenceTime.includes('羽化し')) {
              // "10~11月に羽化し、寒冷地では5月まで" を "10-12、1-5月" に変換
              normalizedEmergenceTime = '10-12、1-5月';
              allowDebugLogs && console.log(`Normalized ゴマダラキリガ emergence time for chart: "${emergenceTime}" -> "${normalizedEmergenceTime}"`);
            }
            
            // キリガCSVのデータを常に優先して上書き（説明文として保存）
            emergenceTimeMap.set(japaneseName, { time: normalizedEmergenceTime, source: '日本の冬夜蛾', description: emergenceTime });
            
            // Debug log for target species
            if (japaneseName.includes('キバラモクメキリガ') || japaneseName.includes('ナンカイミドリキリガ') || japaneseName.includes('アズサキリガ')) {
              if (allowDebugLogs) console.log(`Added to emergenceTimeMap (キリガCSV優先): ${japaneseName} -> ${normalizedEmergenceTime}`);
            }
          }
          if (scientificName && emergenceTime && emergenceTime !== '不明') {
            // キリガCSVのデータを常に優先して上書き（説明文として保存）
            emergenceTimeMap.set(scientificName, { time: normalizedEmergenceTime, source: '日本の冬夜蛾', description: emergenceTime });
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              emergenceTimeMap.set(cleanedScientificName, { time: normalizedEmergenceTime, source: '日本の冬夜蛾', description: emergenceTime });
              
              // Debug log for target species
              if (cleanedScientificName.includes('Xylena formosa') || cleanedScientificName.includes('Diphtherocome autumnalis') || cleanedScientificName.includes('Pseudopanolis azusa')) {
                allowDebugLogs && console.log(`Added to emergenceTimeMap: ${cleanedScientificName} -> ${emergenceTime}`);
              }
            }
          }
          
          // Store host plant information
          if (japaneseName && hostPlants) {
            kirigaHostPlantMap.set(japaneseName, hostPlants);
          }
          if (scientificName && hostPlants) {
            kirigaHostPlantMap.set(scientificName, hostPlants);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              kirigaHostPlantMap.set(cleanedScientificName, hostPlants);
            }
          }
          
          // Store remarks information
          if (japaneseName && remarks) {
            kirigaRemarksMap.set(japaneseName, remarks);
          }
          if (scientificName && remarks) {
            kirigaRemarksMap.set(scientificName, remarks);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              kirigaRemarksMap.set(cleanedScientificName, remarks);
            }
          }
        });

        // Parse フユシャク CSV to create host plant and emergence time lookup tables
        const fuyushakuHostPlantMap = new Map();
        const fuyushakuRemarksMap = new Map();
        
        // Use Papa.parse for proper CSV parsing - handle empty fuyushakuText gracefully
        let fuyushakuData = [];
        if (!useNormalizedOnly && fuyushakuText && fuyushakuText.trim()) {
          try {
            // Remove BOM if present
            let cleanedText = fuyushakuText;
            if (cleanedText.charCodeAt(0) === 0xFEFF) {
              cleanedText = cleanedText.substring(1);
            }
            
            const fuyushakuParsed = Papa.parse(cleanedText, {
              header: true,
              skipEmptyLines: 'greedy',
              delimiter: ',',
              quoteChar: '"',
              escapeChar: '"'
            });
            fuyushakuData = fuyushakuParsed.data;
            
            if (fuyushakuParsed.errors.length > 0) {
              console.warn('フユシャク CSV parsing errors:', fuyushakuParsed.errors);
            }
            
            // Fix parsing issues caused by commas in scientific names
            fuyushakuData = fuyushakuData.map(row => {
              // Check if the scientific name field is incomplete (missing year)
              if (row['学名'] && row['食草'] && 
                  row['学名'].includes('(') && !row['学名'].includes(')') &&
                  row['食草'].match(/^\s*\d{4}\)/)) {
                // The year part got split into the food plants field
                const year = row['食草'];
                const fixedScientificName = row['学名'] + ', ' + year;
                
                // The emergence time data might be in __parsed_extra
                let emergenceTime = '';
                if (row.__parsed_extra && row.__parsed_extra.length > 0) {
                  emergenceTime = row.__parsed_extra[0];
                } else if (Object.keys(row).length > 5) {
                  // Try to get from additional fields
                  const keys = Object.keys(row);
                  emergenceTime = row[keys[5]] || '';
                }
                
                // Shift the fields back to their correct positions
                return {
                  '和名': row['和名'],
                  '学名': fixedScientificName,
                  '食草': row['食草に関する備考'] || '',
                  '食草に関する備考': row['成虫の発生時期'] || '',
                  '成虫の発生時期': emergenceTime
                };
              }
              return row;
            });
            
            logger.debug('フユシャク CSV parsing successful, entries:', fuyushakuData.length);
          } catch (error) {
            logger.warn('Failed to parse フユシャク CSV:', error);
            fuyushakuData = [];
          }
        } else if (!useNormalizedOnly) {
          logger.warn('フユシャク CSV data is empty or failed to load');
        }
        
        logger.debug("Parsed フユシャク data:", fuyushakuData.length, "entries");
        
        // Debug: Show first few entries of フユシャク data
        if (!useNormalizedOnly && fuyushakuData.length > 0) {
          logger.debug('DEBUG: フユシャク.csv first few entries:', fuyushakuData.slice(0, 3));
          // Check if カバシタムクゲエダシャク exists
          const kabaShitaEntry = fuyushakuData.find(row => row['和名']?.trim() === 'カバシタムクゲエダシャク');
          if (kabaShitaEntry) {
            logger.debug('DEBUG: カバシタムクゲエダシャク found in フユシャク.csv raw data:', kabaShitaEntry);
            logger.debug('DEBUG: カバシタムクゲエダシャク scientific name length:', kabaShitaEntry['学名']?.length);
            logger.debug('DEBUG: カバシタムクゲエダシャク scientific name charCodes:', 
              kabaShitaEntry['学名']?.split('').map(c => c.charCodeAt(0)).join(', '));
          } else {
            logger.debug('DEBUG: カバシタムクゲエダシャク NOT found in フユシャク.csv');
            // Debug: show all 和名 in the data
            logger.debug('DEBUG: All 和名 in フユシャク data:', fuyushakuData.map(row => row['和名']).filter(Boolean));
          }
        }
        
        // Create comprehensive data maps from フユシャク data
        if (!useNormalizedOnly) fuyushakuData.forEach(row => {
          const japaneseName = row['和名']?.trim();
          const scientificName = row['学名']?.trim();
          let emergenceTime = row['成虫の発生時期']?.trim();
          const hostPlants = row['食草']?.trim();
          const remarks = row['食草に関する備考']?.trim();
          
          // Fix for CSV parsing issue - check if real emergence time is in __parsed_extra
          if (row.__parsed_extra && row.__parsed_extra.length > 0) {
            const extraData = row.__parsed_extra[0]?.trim();
            if (extraData && (extraData.includes('月') || extraData.includes('上旬') || extraData.includes('中旬') || extraData.includes('下旬'))) {
              emergenceTime = extraData;
            }
          }
          
          // Debug log for カバシタムクゲエダシャク
          if (japaneseName === 'カバシタムクゲエダシャク') {
            allowDebugLogs && console.log('DEBUG: Found カバシタムクゲエダシャク in フユシャク.csv:', {
              japaneseName,
              scientificName,
              hostPlants,
              remarks,
              emergenceTime
            });
          }
          
          // Store emergence time data from フユシャク (フユシャクCSVを優先 - より詳細で正確なデータ)
          if (japaneseName && emergenceTime && emergenceTime !== '不明') {
            // フユシャクCSVのデータを常に優先して上書き
            emergenceTimeMap.set(japaneseName, { time: emergenceTime, source: '日本の冬尺蛾' });
          }
          if (scientificName && emergenceTime && emergenceTime !== '不明') {
            // フユシャクCSVのデータを常に優先して上書き
            emergenceTimeMap.set(scientificName, { time: emergenceTime, source: '日本の冬尺蛾' });
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              emergenceTimeMap.set(cleanedScientificName, { time: emergenceTime, source: '日本の冬尺蛾' });
            }
          }
          
          // Store host plant information
          if (japaneseName && hostPlants) {
            fuyushakuHostPlantMap.set(japaneseName, hostPlants);
          }
          if (scientificName && hostPlants) {
            fuyushakuHostPlantMap.set(scientificName, hostPlants);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              fuyushakuHostPlantMap.set(cleanedScientificName, hostPlants);
            }
          }
          
          // Store remarks information
          if (japaneseName && remarks) {
            fuyushakuRemarksMap.set(japaneseName, remarks);
          }
          if (scientificName && remarks) {
            fuyushakuRemarksMap.set(scientificName, remarks);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              fuyushakuRemarksMap.set(cleanedScientificName, remarks);
            }
          }
        });

        if (isDevelopment) logger.debug("Emergence time map created with", emergenceTimeMap.size, "entries");
        if (isDevelopment) logger.debug("Sample entries:", Array.from(emergenceTimeMap.entries()).slice(0, 5));
        if (isDevelopment) logger.debug("フユシャク host plant map size:", fuyushakuHostPlantMap.size);
        if (isDevelopment) logger.debug("フユシャク クロスジフユエダシャク check:", fuyushakuHostPlantMap.get('クロスジフユエダシャク'));
        logger.debug("フユシャク Pachyerannis obliquaria check:", fuyushakuHostPlantMap.get('Pachyerannis obliquaria (Motschulsky, 1861)'));
        logger.debug("フユシャク Pachyerannis obliquaria (no author) check:", fuyushakuHostPlantMap.get('Pachyerannis obliquaria'));
        
        // Debug: Check if カバシタムクゲエダシャク is in the maps
        logger.debug("DEBUG: カバシタムクゲエダシャク in fuyushakuHostPlantMap:", fuyushakuHostPlantMap.get('カバシタムクゲエダシャク'));
        logger.debug("DEBUG: カバシタムクゲエダシャク in emergenceTimeMap:", emergenceTimeMap.get('カバシタムクゲエダシャク'));
        logger.debug("DEBUG: カバシタムクゲエダシャク in fuyushakuRemarksMap:", fuyushakuRemarksMap.get('カバシタムクゲエダシャク'));
        
        // Show all keys that contain カバシタ
        const kabaKeys = Array.from(fuyushakuHostPlantMap.keys()).filter(k => k && k.includes('カバシタ'));
        logger.debug("DEBUG: All keys containing カバシタ in fuyushakuHostPlantMap:", kabaKeys);

        // Function to clean and normalize scientific names for comparison
        const cleanScientificNameForComparison = (scientificName) => {
          if (!scientificName) return '';
          // Remove author/year information and normalize spacing
          let cleaned = scientificName.replace(/\s*\([^)]*\)\s*$/, ''); // Remove (Author, Year)
          cleaned = cleaned.replace(/\s*,\s*\d{4}\s*$/, ''); // Remove ", 1234"
          cleaned = cleaned.replace(/\s+/g, ' ').trim(); // Normalize spacing
          return cleaned.toLowerCase();
        };

        // Function to clean moth names by removing change annotations
        const cleanMothName = (name) => {
          if (!name) return name;
          // Remove various change annotations
          return name
            .replace(/\s*\([^)]*改称[^)]*\)/g, '')
            .replace(/\s*\([^)]*新称[^)]*\)/g, '')
            .replace(/\s*（[^）]*改称[^）]*）/g, '')
            .replace(/\s*（[^）]*新称[^）]*）/g, '')
            .trim();
        };

        // Function to merge duplicate moth entries based on scientific name
        const mergeMoths = (existing, newEntry) => {
          // Prioritize entries with catalog numbers
          const hasCatalogA = existing.id && existing.id.startsWith('main-') && existing.id !== 'main-0';
          const hasCatalogB = newEntry.id && newEntry.id.startsWith('main-') && newEntry.id !== 'main-0';
          
          // Determine which entry should be the base
          let baseEntry, otherEntry;
          if (hasCatalogA && !hasCatalogB) {
            baseEntry = existing;
            otherEntry = newEntry;
          } else if (!hasCatalogA && hasCatalogB) {
            baseEntry = newEntry;
            otherEntry = existing;
          } else {
            // Both have or both don't have catalog numbers
            // Prefer the one without change annotations
            const existingHasAnnotation = existing.name.includes('改称') || existing.name.includes('新称');
            const newEntryHasAnnotation = newEntry.name.includes('改称') || newEntry.name.includes('新称');
            
            if (existingHasAnnotation && !newEntryHasAnnotation) {
              baseEntry = newEntry;
              otherEntry = existing;
            } else if (!existingHasAnnotation && newEntryHasAnnotation) {
              baseEntry = existing;
              otherEntry = newEntry;
            } else {
              // Both or neither have annotations - use existing as base
              baseEntry = existing;
              otherEntry = newEntry;
            }
          }
          
          // Merge the entries
          return {
            ...baseEntry,
            name: cleanMothName(baseEntry.name),
            hostPlants: [...new Set([...baseEntry.hostPlants, ...otherEntry.hostPlants])],
            scientificName: baseEntry.scientificName || otherEntry.scientificName,
            // Merge other potentially useful fields
            instagramUrl: baseEntry.instagramUrl || otherEntry.instagramUrl,
            // Keep the more complete source information
            source: baseEntry.source || otherEntry.source
          };
        };

        // Function to deduplicate moths by scientific name and Japanese name
        const deduplicateMoths = (moths) => {
          const uniqueMap = new Map();
          
          moths.forEach(moth => {
            const cleanScientificName = cleanScientificNameForComparison(moth.scientificName);
            const cleanJapaneseName = moth.name ? moth.name.trim() : '';
            
            // Determine if this has a complete species-level scientific name
            const hasSpeciesName = cleanScientificName && 
                                   cleanScientificName.includes(' ') && 
                                   !cleanScientificName.endsWith(' sp.') &&
                                   !cleanScientificName.endsWith(' spp.');
            
            // Create unique key based on available information
            let uniqueKey;
            
            // Always use ID as part of the key to ensure uniqueness
            // Only merge if both scientific name AND Japanese name match
            if (hasSpeciesName && cleanJapaneseName) {
              // Full species with Japanese name - use both for matching
              uniqueKey = `${cleanScientificName}_${cleanJapaneseName}`;
            } else if (hasSpeciesName) {
              // Full species without Japanese name - use scientific name only
              uniqueKey = cleanScientificName;
            } else {
              // For genus-only or incomplete data, always use ID to keep them separate
              // This prevents different species with the same genus from being merged
              uniqueKey = moth.id;
            }
            
            // Check if we already have this moth
            if (uniqueMap.has(uniqueKey) && uniqueKey !== moth.id) {
              // Only merge if it's a real duplicate (not just same ID)
              const existing = uniqueMap.get(uniqueKey);
              const merged = mergeMoths(existing, moth);
              uniqueMap.set(uniqueKey, merged);
            } else {
              // Add new moth
              uniqueMap.set(uniqueKey, moth);
            }
          });
          
          return Array.from(uniqueMap.values());
        };

        // Function to remove publication/reference names from food plant data
        const removePublicationNames = (hostPlantText) => {
          if (!hostPlantText || typeof hostPlantText !== 'string') {
            return hostPlantText;
          }
          
          // Common publication patterns to remove from food plant data
          const publicationPatterns = [
            /[;；]\s*日本産蛾類標準図鑑\d*/g,     // "; 日本産蛾類標準図鑑2"
            /[;；]\s*日本の冬尺蛾/g,              // "; 日本の冬尺蛾"
            /[;；]\s*日本の冬夜蛾/g,              // "; 日本の冬夜蛾"
            /[;；]\s*日本のフユシャク/g,          // "; 日本のフユシャク"
            /[;；]\s*蛾類図鑑/g,                  // "; 蛾類図鑑"
            /[;；]\s*標準図鑑/g,                  // "; 標準図鑑"
            /[;；]\s*図鑑\d*/g,                   // "; 図鑑1", "; 図鑑2"
            /[;；]\s*文献\d*/g,                   // "; 文献1"
            /[;；]\s*出典\d*/g,                   // "; 出典1"
            /[;；]\s*参考文献/g,                  // "; 参考文献"
            /[;；]\s*\d{4}年/g,                   // "; 1990年"
            /[;；]\s*\([^)]*\d{4}[^)]*\)/g,       // "; (Author 1884)"
          ];
          
          let cleaned = hostPlantText;
          
          // Apply each pattern to remove publication references
          publicationPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
          });
          
          // Clean up any trailing semicolons or whitespace
          cleaned = cleaned.replace(/[;；]\s*$/, '').trim();
          
          return cleaned;
        };

        // Centralized function to normalize plant names by removing family annotations
        const normalizePlantName = (plantName) => {
          if (!plantName || typeof plantName !== 'string') {
            return plantName;
          }
          
          // If the plant name is just a family name (ends with "科"), keep it as is
          if (plantName.match(/^[^（(]+科$/)) {
            return plantName;
          }
          
          // Remove family prefixes like "アカネ科ミサオノキ" -> "ミサオノキ", "ウマノスズクサ科ウマノスズクサ" -> "ウマノスズクサ"
          // But be careful not to match family names inside parentheses
          let normalized = plantName.replace(/^([^（(科]+科)([のに]?)([^（(].+)$/, '$3'); // Only remove family prefix if there's plant content after it (not in parentheses)
          if (normalized === plantName) {
            // No family prefix found, keep original
            normalized = plantName;
          }
          
          // Remove family annotations like "アカマツ（マツ科）" -> "アカマツ"
          // But preserve the plant name part before the annotation
          normalized = normalized.replace(/^([^（(]+)（[^）]*科[^）]*）(.*)$/g, '$1$2'); // Remove (科名) patterns, keep plant name
          normalized = normalized.replace(/^([^（(]+)\([^)]*科[^)]*\)(.*)$/g, '$1$2'); // Remove (family) patterns, keep plant name
          
          // Remove "以上〇〇科" patterns more carefully to preserve plant names
          normalized = normalized.replace(/\(以上[^)]*科\)/g, ''); // Remove "(以上〇〇科)"
          normalized = normalized.replace(/（以上[^）]*科）/g, ''); // Remove "（以上〇〇科）"
          
          // Remove "ほか" and similar patterns
          normalized = normalized.replace(/ほか/g, '');
          
          // Remove incomplete parentheses like "オオカメノキ（" -> "オオカメノキ"
          normalized = normalized.replace(/（[^）]*$/g, ''); // Remove opening parentheses without closing
          normalized = normalized.replace(/\([^)]*$/g, ''); // Remove opening parentheses without closing
          // Only remove closing parentheses at the start if they look like orphaned closing parentheses
          normalized = normalized.replace(/^）/g, ''); // Remove orphaned closing parentheses at start
          normalized = normalized.replace(/^\)/g, ''); // Remove orphaned closing parentheses at start
          
          // Remove remaining simple parenthetical annotations at the end (after preserving family patterns above)
          normalized = normalized.replace(/（[^）]*）$/g, ''); // Remove remaining parentheses at end
          normalized = normalized.replace(/\([^)]*\)$/g, ''); // Remove remaining parentheses at end
          
          normalized = normalized.trim();

          // Preserve and repair Latin binomial spacing only when needed
          // Applies only if the string has no Japanese characters
          const hasCJK = /[\u3040-\u30FF\u3400-\u9FFF]/.test(normalized);
          if (!hasCJK) {
            const t = normalized.trim();
            // If already looks like a binomial, normalize spaces to a single space
            const spaced = t.match(/^([A-Z][a-z]+)\s+([a-z-]{3,})(.*)$/);
            if (spaced) {
              normalized = `${spaced[1]} ${spaced[2]}${spaced[3] || ''}`.trim();
            } else {
              // Repair compact form: Genusspecies -> Genus species
              const m = t.replace(/\s+/g, '').match(/^([A-Z][a-z]+)([a-z-]{3,})(.*)$/);
              if (m) normalized = `${m[1]} ${m[2]}${m[3] || ''}`.trim();
            }
          }
          
          // Comprehensive normalization for duplicate prevention
          // Convert full-width to half-width characters
          normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
          });
          
          // Normalize various dash and space characters  
          normalized = normalized.replace(/[－─━ー]/g, 'ー'); // Normalize different dash types
          // Remove spaces for Japanese names, but preserve single space in Latin binomials
          if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(normalized)) {
            normalized = normalized.replace(/\s+/g, '');
          } else {
            // Collapse multiple spaces to a single one for Latin text
            normalized = normalized.replace(/\s+/g, ' ').trim();
          }
          
          // Normalize punctuation marks
          normalized = normalized.replace(/[、，]/g, '、'); // Normalize commas
          normalized = normalized.replace(/[。．]/g, '。'); // Normalize periods
          
          // Handle synonyms and variations - consolidate different names for the same plant
          const synonymMap = {
            // 同種の異名を統一（例: サネカズラ=ビナンカズラ）
            'サネカズラ': 'ビナンカズラ',
            'セイヨウリンゴ': 'リンゴ',
            'セイヨウナシ': 'ナシ',
            'セイヨウカラシナ': 'カラシナ',
            'セイヨウタンポポ': 'タンポポ',
            'セイヨウミザクラ': 'ミザクラ',
            'セイヨウアブラナ': 'アブラナ',
            'ヨーロッパリンゴ': 'リンゴ',
            'ヨーロッパナシ': 'ナシ',
            // Common variations
            'アカマツ': 'アカマツ',
            'クロマツ': 'クロマツ',
            'ニホンアカマツ': 'アカマツ',
            'ニホンクロマツ': 'クロマツ',
            // Remove common modifiers that don't change the essential plant
            'ヤマザクラ類': 'ヤマザクラ',
            // サクラの品種名統一
            '染井吉野': 'ソメイヨシノ',
            'サクラ類': 'サクラ',
            'カエデ類': 'カエデ',
            'ヤナギ類': 'ヤナギ'
          };
          
          // Apply synonym mapping
          if (synonymMap[normalized]) {
            normalized = synonymMap[normalized];
          }
          
          // Handle generic terms like "類" at the end
          normalized = normalized.replace(/類$/, '');
          
          return normalized;
        };
        
        // Function to check if a plant entry is already in the hostPlantEntries array
        const isDuplicateEntry = (hostPlantEntries, newEntry) => {
          const normalizedNewPlant = normalizePlantName(newEntry.plant);
          const newBasePlant = newEntry.plant.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '');
          const normalizedNewBasePlant = normalizePlantName(newBasePlant);
          
          return hostPlantEntries.some(existingEntry => {
            const normalizedExistingPlant = normalizePlantName(existingEntry.plant);
            const existingBasePlant = existingEntry.plant.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '');
            const normalizedExistingBasePlant = normalizePlantName(existingBasePlant);
            
            // Check for exact match on normalized plant names
            if (normalizedNewPlant === normalizedExistingPlant) {
              return true;
            }
            
            // Check for base plant match (without part information)
            if (normalizedNewBasePlant === normalizedExistingBasePlant && 
                normalizedNewBasePlant.length > 1) {
              return true;
            }
            
            // Check for partial matches that indicate the same plant
            if (normalizedNewBasePlant.includes(normalizedExistingBasePlant) && 
                normalizedExistingBasePlant.length > 2) {
              return true;
            }
            
            if (normalizedExistingBasePlant.includes(normalizedNewBasePlant) && 
                normalizedNewBasePlant.length > 2) {
              return true;
            }
            
            return false;
          });
        };
        
        // Function to detect cultivation conditions in host plant text
        const detectCultivationConditions = (hostPlantText) => {
          if (!hostPlantText || typeof hostPlantText !== 'string') {
            return { cultivatedPlants: [], wildPlants: [], remarks: '' };
          }
          
          const cultivatedPlants = [];
          const wildPlants = [];
          let remarks = '';
          
          // Pattern 1: "飼育下で...の記録があり" pattern (catalog-2294 style)
          const cultivationPattern = /飼育下で([^。；;]+?)の記録があり/g;
          let match;
          while ((match = cultivationPattern.exec(hostPlantText)) !== null) {
            const plantsText = match[1];
            // Split by delimiters and extract plant names
            const plants = plantsText.split(/[;；、，,]/).map(p => p.trim()).filter(p => p.length > 0);
            plants.forEach(plant => {
              // Clean plant name
              plant = plant.replace(/\s*\([^)]*\)$/g, ''); // Remove family info at end
              if (plant && plant.length > 1) {
                cultivatedPlants.push(plant);
              }
            });
          }
          
          // Pattern 2: "飼育条件下では...を食べる" pattern
          const cultivationPattern2 = /飼育条件下では([^。；;]+?)を?食べる?/g;
          while ((match = cultivationPattern2.exec(hostPlantText)) !== null) {
            const plantsText = match[1];
            const plants = plantsText.split(/[;；、，,]/).map(p => p.trim()).filter(p => p.length > 0);
            plants.forEach(plant => {
              plant = plant.replace(/\s*\([^)]*\)$/g, '');
              if (plant && plant.length > 1) {
                cultivatedPlants.push(plant);
              }
            });
          }
          
          // Pattern 3: "名義タイプ亜種の幼虫は...を食すという" pattern for wild plants  
          const wildPattern = /名義タイプ亜種の幼虫は([^。；;]+?)を食すという/g;
          while ((match = wildPattern.exec(hostPlantText)) !== null) {
            const plantsText = match[1];
            const plants = plantsText.split(/[;；、，,]/).map(p => p.trim()).filter(p => p.length > 0);
            plants.forEach(plant => {
              plant = plant.replace(/\s*\([^)]*\)$/g, '');
              if (plant && plant.length > 1) {
                wildPlants.push(plant);
              }
            });
          }
          
          return { cultivatedPlants, wildPlants, remarks };
        };

        // Helper function to add entry to hostPlantEntries with duplicate checking
        const addPlantEntry = (hostPlantEntries, plant, condition = '', familyFromMainCsv = '') => {
          const newEntry = {
            plant: plant,
            condition: condition,
            familyFromMainCsv: familyFromMainCsv
          };
          
          // Only add if not duplicate
          if (!isDuplicateEntry(hostPlantEntries, newEntry)) {
            hostPlantEntries.push(newEntry);
            return true; // Successfully added
          }
          return false; // Duplicate, not added
        };
        
        // Centralized function to validate plant names
        const isValidPlantName = (plantName) => {
          // Basic validation - must be a string with reasonable length
          if (!plantName || typeof plantName !== 'string' || plantName.length < 2) {
            return false;
          }
          
          // Remove whitespace for testing
          const trimmed = plantName.trim();
          
          // Explicitly reject empty strings (after trimming)
          if (trimmed === '' || trimmed.length === 0) {
            return false;
          }
          
          // Reject if only numbers or only English letters
          if (/^[0-9]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
            return false;
          }
          
          // Reject catalog numbers with special characters like "10+12"
          if (/^[0-9+\-]+$/.test(trimmed)) {
            return false;
          }
          
          // Reject source publication names (出典名)
          if (/^日本産.*図鑑/.test(trimmed) || /^標準図鑑/.test(trimmed) || 
              trimmed.includes('標準図鑑') || trimmed.includes('大図鑑')) {
            return false;
          }
          
          // Reject geographic region information (地域名)
          if (/^(朝鮮半島|中国|台湾|韓国|ヨーロッパ|北米|アメリカ|インド|東南アジア|海外)では/.test(trimmed) ||
              trimmed.includes('では') && (trimmed.includes('朝鮮') || trimmed.includes('中国') || 
              trimmed.includes('台湾') || trimmed.includes('ヨーロッパ') || trimmed.includes('アメリカ') ||
              trimmed.includes('海外'))) {
            return false;
          }
          
          // Reject "多種" patterns that should be filtered out
          const tashuPatterns = [
            /^多種$/,                          // Standalone "多種"
            /^多種の植物$/,                    // "多種の植物"
            /^多種の草本$/,                    // "多種の草本"
            /^多種の広葉樹$/,                  // "多種の広葉樹"
            /^多種の落葉広葉樹$/,              // "多種の落葉広葉樹"
            /^多種の草本類$/,                  // "多種の草本類"
            /など多種にわたる$/,               // "など多種にわたる"
            /など多種の/,                      // "など多種の..."
            /多種の.*を食べる$/,               // "多種の〇〇を食べる"
            /多種の.*を摂食する$/,             // "多種の〇〇を摂食する"
            /多種の.*につく$/,                 // "多種の〇〇につく"
            /おそらく多種の/,                  // "おそらく多種の..."
            /広食性で多種の/,                  // "広食性で多種の..."
            /多種の.*を食草とする$/            // "多種の〇〇を食草とする"
          ];
          
          if (tashuPatterns.some(pattern => pattern.test(trimmed))) {
            return false;
          }
          
          // Reject taxonomic comparison phrases that are not plant names
          const taxonomicComparisonPatterns = [
            /^同じ.*属$/,                      // "同じ〇〇属"
            /^同じ.*科$/,                      // "同じ〇〇科"
            /^同.*属の.*からは/,               // "同〇属の〇〇からは"
            /からは未発見$/,                   // "〇〇からは未発見"
            /からは確認されていない$/,         // "〇〇からは確認されていない"  
            /からのみ.*が得られ/               // "〇〇からのみ〇〇が得られ"
          ];
          
          if (taxonomicComparisonPatterns.some(pattern => pattern.test(trimmed))) {
            return false;
          }
          
          // Reject bare genus names (scientific Latin genus names)
          const genusPatterns = [
            /^[A-Z][a-z]+ 属$/,                // "Vicia 属", "Quercus 属" etc.
            /^[A-Z][a-z]+属$/                  // "Vicia属", "Quercus属" etc.
          ];
          
          if (genusPatterns.some(pattern => pattern.test(trimmed))) {
            return false;
          }
          
          // Reject geographic/climatic descriptors that are not plant names
          const climaticPatterns = [
            /^寒冷地$/,                        // "寒冷地"
            /^温暖地$/,                        // "温暖地"
            /^高地$/,                          // "高地"
            /^低地$/,                          // "低地"
            /^山地$/,                          // "山地"
            /^平地$/,                          // "平地"
            /^亜高山帯$/,                      // "亜高山帯"
            /^高山帯$/,                        // "高山帯"
            /^沿海地$/,                        // "沿海地"
            /^内陸部$/,                        // "内陸部"
            /では.*$/                          // "寒冷地では〇〇", "温暖地では〇〇" etc.
          ];
          
          if (climaticPatterns.some(pattern => pattern.test(trimmed))) {
            return false;
          }
          
          // Reject taxonomic/temporal reference terms that are not plant names
          const referencePatterns = [
            /^従来$/,                          // "従来"
            /^古来$/,                          // "古来" 
            /^以前$/,                          // "以前"
            /^過去$/,                          // "過去"
            /^現在$/,                          // "現在"
            /^今後$/,                          // "今後"
            /^将来$/,                          // "将来"
            /^従来の.*$/,                      // "従来の〇〇"
            /^古来の.*$/,                      // "古来の〇〇"
            /の記録$/                          // "〇〇の記録"
          ];
          
          if (referencePatterns.some(pattern => pattern.test(trimmed))) {
            return false;
          }
          
          // Reject if it contains time period information (月旬, 月頃, etc.)
          if (/[0-9０-９]月[上中下]旬/.test(trimmed) || /[0-9０-９]月頃/.test(trimmed)) {
            return false;
          }
          
          // Reject if it starts with time period information
          if (/^[0-9０-９]+月/.test(trimmed)) {
            return false;
          }
          
          // Reject temporal/descriptive phrases
          if (/^(早春|春|初夏|夏|秋|冬|晩秋|初冬)/.test(trimmed)) {
            return false;
          }
          
          // Reject if it's a descriptive phrase about collection/observation
          if (/野外で|雑木林|林床|落葉から|幼虫が得られ|採卵では|による飼育|で飼育|から記録/.test(trimmed)) {
            return false;
          }
          
          // Reject taxonomic/descriptive phrases that are not plant names
          if (/次種が分離される前の情報として|従来の記録は次種と混同|本種か次種|次種との区別|次種を参照|参照されたい/.test(trimmed)) {
            return false;
          }
          
          // Reject specific problematic taxonomic phrases
          if (/^次種との区別はついていない。台湾では$|^従来の記録は次種と混同している可能性があるので再検討を要する。$|^本種か次種ニセスジシロキヨトウの食草なのかは判断できない。$/.test(trimmed)) {
            return false;
          }
          
          // Reject if it's a long sentence (likely a description, not a plant name)
          if (trimmed.length > 50 && (trimmed.includes('野外で') || trimmed.includes('から記録') || trimmed.includes('飼育下で'))) {
            return false;
          }
          
          // Reject long descriptive text that mentions other species or references
          if (trimmed.length > 30 && (/思われる|と思われ|ではないか|可能性|おそらく|参照|本種も/.test(trimmed))) {
            return false;
          }
          
          // Reject taxonomic abbreviations and notations
          const taxonomicPatterns = [
            /^comb\.\s*nov\.?$/i,
            /^sp\.?$/i,
            /^spp\.?$/i,
            /^var\.?$/i,
            /^subsp\.?$/i,
            /^f\.?$/i,
            /^emend\.?$/i,
            /^nom\.\s*nud\.?$/i,
            /^auct\.?$/i,
            /^non$/i,
            /^sensu$/i,
            /^cf\.?$/i,
            /^aff\.?$/i
          ];
          
          for (const pattern of taxonomicPatterns) {
            if (pattern.test(trimmed)) {
              return false;
            }
          }
          
          // Reject year patterns in parentheses like "1878)" or "(1766)"
          if (/^\d{4}\)?$/.test(trimmed) || /^[（(]\d{4}[）)]?$/.test(trimmed)) {
            return false;
          }
          
          // Reject author names (common patterns) like "Butler, 1878"
          if (/^[（(]?[A-Z][a-z]+[,\s]+\d{4}[）)]?$/.test(trimmed)) {
            return false;
          }
          
          // Allow family names (ending with '科') as valid plant names
          if (trimmed.endsWith('科')) {
            return true;
          }
          
          // Allow plant names with family info in parentheses like "ムギ類(イネ科)"
          if (/[ぁ-んァ-ヶー一-龠]+.*[\(（][^)）]*科[\)）]/.test(trimmed)) {
            return true;
          }
          
          const invalidPatterns = [
            /^[0-9]+$/,  // Pure numbers
            /^[A-Za-z]+$/, // Pure English letters
            /^[0-9+\-]+$/, // Catalog numbers like "10+12"
            /^\s*[0-9]{4}\)"?\s*$/, // Year patterns like "1763)"
            /^\s*[0-9]{4}"?\s*$/, // Simple year patterns like "1763"
            /（[^）]*$/, // Incomplete opening parentheses like "オオカメノキ（"
            /^[^（]*）/, // Incomplete closing parentheses like "）スイカズラ科"
            /\([^)]*$/, // Incomplete opening parentheses (half-width)
            /^[^(]*\)/, // Incomplete closing parentheses (half-width)
            /^[\u3001-\u3006\u3008-\u3011\u3013-\u301f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\u2000-\u206f\u2e00-\u2e7f!-\/:-@\[-`{-~]+$/, // Only symbols/punctuation
            /^["'\u201c\u201d\u2018\u2019()\[\]{}\-\u2010-\u2015_=+|\\;:,.<>/?~`!@#$%^&*]+$/, // Common symbols
            /国外/,
            /各種/,
            /以上/,
            /記録/,
            /知られ/,
            /観察/,
            /確認/,
            /報告/,
            /台湾/,
            /沖縄/,
            /ヨーロッパ/,
            /ハワイ/,
            /時に/,
            /害虫/,
            /被害/,
            /食べ/,
            /食す/,
            /育つ/,
            /成長/,
            /飼育/,
            /判明/,
            /植物/,
            /樹木/,
            /草本/,
            /広食性/,
            /広食性/,
            /単食性/,
            /ほか/,
            /^の$/,
            /^を$/,
            /^が$/,
            /^で$/,
            /^に$/,
            /^は$/,
            /^と$/,
            /^や$/,
            /^も$/,
            /^から$/,
            /^まで$/,
            /^では$/,
            /^でも$/,
            /^として$/,
            /^による$/,
            /^からの$/,
            /^への$/,
            /^との$/,
            /^での$/,
            /^によって$/,
            /^において$/,
            /^について$/,
            /^に関して$/,
            /^に対して$/,
            /^によれば$/,
            /^によると$/,
            /^不明$/  // Reject "不明" to prevent blank plant pages
          ];
          
          return !invalidPatterns.some(pattern => pattern.test(trimmed));
        };

        // Parse wamei_checklist_ver.1.10.csv with error handling
        let wameiMap = {};
        let wameiFamilyMap = {};
        let correctMothNames = new Set();
        
        if (wameiText) {
          try {
            allowDebugLogs && console.log("Parsing wamei checklist data...");
            const wameiParsed = Papa.parse(wameiText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (wameiParsed.errors.length) {
              console.error("PapaParse errors in wamei_checklist_ver.1.10.csv:", wameiParsed.errors);
            }
            
            wameiParsed.data.forEach(row => {
              const allName = row['all_name']?.trim();
              const hubName = row['Hub name']?.trim();
              const familyJp = row['Family name (JP)']?.trim();
              if (allName) correctMothNames.add(allName);
              if (hubName) correctMothNames.add(hubName);
              if (allName && hubName) {
                wameiMap[allName] = hubName;
                // Debug ツバキ-related mappings
                if ((allName && allName.includes('ツバキ')) || (hubName && hubName.includes('ツバキ'))) {
                  allowDebugLogs && console.log(`DEBUG: wameiMap ツバキ mapping: "${allName}" -> "${hubName}"`);
                }
                // Debug ソメイヨシノ-related mappings
                if ((allName && allName.includes('ソメイヨシノ')) || (hubName && hubName.includes('ソメイヨシノ')) ||
                    (allName && allName.includes('染井吉野')) || (hubName && hubName.includes('染井吉野'))) {
                  allowDebugLogs && console.log(`DEBUG: wameiMap ソメイヨシノ mapping: "${allName}" -> "${hubName}"`);
                }
              }
              if (hubName && familyJp) wameiFamilyMap[hubName] = familyJp;
            });
            allowDebugLogs && console.log("wamei_checklist_ver.1.10.csv parsed successfully. wameiMap size:", Object.keys(wameiMap).length);
          } catch (error) {
            console.error("Error parsing wamei checklist data:", error);
            console.warn("Continuing without wamei checklist data - moth name validation may be incomplete");
          }
        } else {
          console.warn("Wamei checklist data not available - moth name validation will be limited");
        }

        // 和名クリーニング処理 - 余計な文字や引用符を除去
        const cleanJapaneseName = (name) => {
          if (!name) return name;
          
          let cleaned = name;
          
          // 外側の余計な引用符を除去
          if (cleaned.startsWith('"""') && cleaned.endsWith('"""')) {
            cleaned = cleaned.slice(3, -3);
          } else if (cleaned.startsWith('""') && cleaned.endsWith('""')) {
            cleaned = cleaned.slice(2, -2);
          } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
          }
          
          // パターンマッチングで問題のある形式を修正
          
          // パターン1: "未知"和名 -> 和名
          const pattern1 = /^"*未知"*"*(.+?)$/;
          const match1 = cleaned.match(pattern1);
          if (match1) {
            cleaned = match1[1].replace(/"/g, '');
          }
          
          // パターン2: "説明文(植物科名を含む)"和名 -> 和名
          const pattern2 = /^"*[^"]*(?:科)[^"]*"*"*([^"]+?)$/;
          const match2 = cleaned.match(pattern2);
          if (match2) {
            const candidate = match2[1].replace(/"/g, '');
            // 和名っぽい文字列かチェック（カタカナ+ひらがなの組み合わせ）
            if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
              cleaned = candidate;
            }
          }
          
          // パターン3: "〜という"和名 -> 和名
          const pattern3 = /^"*[^"]+という"*"*([^"]+?)$/;
          const match3 = cleaned.match(pattern3);
          if (match3) {
            const candidate = match3[1].replace(/"/g, '');
            if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
              cleaned = candidate;
            }
          }
          
          // パターン4: "説明文。説明文"和名 -> 和名
          const pattern4 = /^"*[^"]+。[^"]*"*"*([^"]+?)$/;
          const match4 = cleaned.match(pattern4);
          if (match4) {
            const candidate = match4[1].replace(/"/g, '');
            if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
              cleaned = candidate;
            }
          }
          
          // パターン5: 特別なケース - "。〜"和名 -> 和名
          if (cleaned.startsWith('。')) {
            const pattern5 = /^。[^"]*"*([^"]+?)$/;
            const match5 = cleaned.match(pattern5);
            if (match5) {
              const candidate = match5[1].replace(/"/g, '');
              if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
                cleaned = candidate;
              }
            }
          }
          
          // 残った余計な引用符を除去
          cleaned = cleaned.replace(/"/g, '');
          
          // 空白文字の正規化
          cleaned = cleaned.trim();

          // 日本語名に含まれる空白を除去（ア オバシャチホコ -> アオバシャチホコ）
          // 日本語文字（ひらがな、カタカナ、漢字）が含まれる場合のみ空白を除去
          if (/[ぁ-んァ-ヶー一-龠]/.test(cleaned)) {
            cleaned = cleaned.replace(/\s+/g, '');
          }
          
          return cleaned;
        };

        const correctMothName = (name) => {
          // まず和名をクリーニング
          const cleanedName = cleanJapaneseName(name);
          
          if (correctMothNames.has(cleanedName)) {
            return cleanedName;
          }
          const corrections = {
            'パ': 'バ', 'ピ': 'ビ', 'プ': 'ブ', 'ペ': 'ベ', 'ポ': 'ボ',
            'ガ': 'カ', 'ギ': 'キ', 'グ': 'ク', 'ゲ': 'ケ', 'ゴ': 'コ',
            'ザ': 'サ', 'ジ': 'シ', 'ズ': 'ス', 'ゼ': 'セ', 'ゾ': 'ソ',
            'ダ': 'タ', 'ヂ': 'チ', 'ヅ': 'ツ', 'デ': 'テ', 'ド': 'ト',
          };
          let correctedName = cleanedName;
          for (const [wrong, correct] of Object.entries(corrections)) {
            if (correctedName.includes(wrong)) {
              const tempName = correctedName.replace(new RegExp(wrong, 'g'), correct);
              if (correctMothNames.has(tempName)) {
                return tempName;
              }
            }
          }
          return cleanedName;
        };

        const formatScientificNameForFilename = (scientificName) => {
          if (!scientificName) return '';
          allowDebugLogs && console.log("Original scientificName:", scientificName);
          // Remove anything in parentheses, or from ( to end of string if no closing parenthesis
          let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
          // Remove common author/year patterns at the end of the string
          cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, ''); // e.g., ", 1766"
          cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, ''); // e.g., "Hufnagel 1766" or "Hufnagel, 1766"
          // More specific pattern to remove author names - only remove if it's after a binomial name
          cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1'); // e.g., "Genus species Author"
          // Keep only alphanumeric characters and spaces
          cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
          // Replace spaces with underscores
          cleanedName = cleanedName.replace(/\s/g, '_');
          allowDebugLogs && console.log("Cleaned scientificName for filename:", cleanedName);
          return cleanedName;
        };

        // Parse 20210514YList_download.csv with error handling
        let yListPlantFamilyMap = {};
        let yListPlantScientificNameMap = {};
        let yListPlantAliasMap = {};
        let yListPlantOrderMap = {};
        let yListPlantOrderLatinMap = {};
        let yListPlantNames = new Set();
        
        if (yListText) {
          try {
            allowDebugLogs && console.log("Parsing YList data...");
            const yListParsed = Papa.parse(yListText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (yListParsed.errors.length) {
              console.error("PapaParse errors in 20210514YList_download.csv:", yListParsed.errors);
            }
            
            yListParsed.data.forEach(row => {
              const plantName = row['和名']?.trim();
              const familyJp = row['LAPG 科名']?.trim();
              const scientificName = row['学名']?.trim();
              const aliases = row['別名']?.trim();
              const orderJp = row['LAPGII::LAPG 目']?.trim() || row['LAPGII::LAPG 目(広義)']?.trim();
              const orderEn = row['LAPGII::LAPG Order']?.trim();

              if (plantName) {
                yListPlantNames.add(plantName);
                // Debug ツバキ-related plants in YList
                if (plantName.includes('ツバキ')) {
                  allowDebugLogs && console.log(`DEBUG: YList ツバキ plant added: "${plantName}"`);
                }
                // Debug セイヨウハコヤナギ
                if (plantName === 'セイヨウハコヤナギ') {
                  allowDebugLogs && console.log(`DEBUG: セイヨウハコヤナギ added to yListPlantNames`);
                }
              }
              if (plantName && familyJp) {
                yListPlantFamilyMap[plantName] = familyJp;
              }
              if (plantName && scientificName) {
                yListPlantScientificNameMap[plantName] = scientificName;
              }
              if (plantName && orderJp) {
                yListPlantOrderMap[plantName] = orderJp;
              }
              if (plantName && orderEn) {
                yListPlantOrderLatinMap[plantName] = orderEn;
              }
              if (plantName && aliases) {
                // Parse aliases - they can be separated by commas or Japanese comma
                const aliasList = aliases.split(/[,，]/).map(alias => alias.trim()).filter(alias => alias.length > 0);
                if (aliasList.length > 0) {
                  yListPlantAliasMap[plantName] = aliasList;
                }
              }
            });
            allowDebugLogs && console.log("20210514YList_download.csv parsed successfully. yListPlantFamilyMap size:", Object.keys(yListPlantFamilyMap).length);
            allowDebugLogs && console.log("20210514YList_download.csv parsed successfully. yListPlantScientificNameMap size:", Object.keys(yListPlantScientificNameMap).length);
            allowDebugLogs && console.log("20210514YList_download.csv parsed successfully. yListPlantAliasMap size:", Object.keys(yListPlantAliasMap).length);
          } catch (error) {
            console.error("Error parsing YList data:", error);
            console.warn("Continuing without YList data - plant family information may be incomplete");
          }
        } else {
          console.warn("YList data not available - plant family information will be limited");
        }

        // Process genus mapping data
        let genusMapping = {};
        if (genusMappingText) {
          try {
            allowDebugLogs && console.log("Parsing genus mapping data...");
            const genusMappingParsed = Papa.parse(genusMappingText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (genusMappingParsed.errors.length) {
              console.error("PapaParse errors in genus_mapping.csv:", genusMappingParsed.errors);
            }
            
            genusMappingParsed.data.forEach(row => {
              const genusJp = row['属和名']?.trim();
              const familyJp = row['科名']?.trim();
              const genusLatin = row['属学名']?.trim();
              
              if (genusJp && familyJp && genusLatin) {
                genusMapping[genusJp] = {
                  family: familyJp,
                  scientificName: genusLatin
                };
                allowDebugLogs && console.log(`Genus mapping added: ${genusJp} -> ${familyJp}, ${genusLatin}`);
              }
            });
            allowDebugLogs && console.log("genus_mapping.csv parsed successfully. genusMapping size:", Object.keys(genusMapping).length);
          } catch (error) {
            console.error("Error parsing genus mapping data:", error);
            console.warn("Continuing without genus mapping data");
          }
        } else {
          console.warn("Genus mapping data not available");
        }

        // 非維管束植物のリスト
        const nonVascularPlants = new Set([
          // 科名のみの場合（シモフリスズメなど）
          'ゴマ科', 'モクセイ科', 'シソ科', 'クマツヅラ科', 'ゴマノハグサ科', 'ノウゼンカズラ科', 'スイカズラ科',
          'イネ科', 'カヤツリグサ科', 'ヤナギ科', 'ブナ科', 'ニシキギ科', 'ツツジ科', 
          'カバノキ科', 'クルミ科', 'ニレ科', 'ムクロジ科', 'バラ科', 'カキノキ科',
          'タデ科', 'キク科', 'アオイ科', 'ミズキ科', 'ツゲ科', 'ミソハギ科',
          'ノボタン科', 'アカバナ科', 'アジサイ科', 'マンサク科', 'マメ科',
          'クワ科', 'アサ科', 'イラクサ科', 'アヤメ科', 'アブラナ科',
          
          // 地衣類一般
          '地衣類', '粉状地衣類', '葉状地衣類', '殻状地衣類',
          
          // 地衣類の属・種
          'キゴケ属', 'Stereocaulon', 'Chloridium', 'Dematium',
          '明褐色の粉状地衣類', '明るい緑色の粉状地衣類', '黒褐色の粉状地衣類',
          '白緑色の粉状地衣類', '樹皮上の地衣類', '岩石表面上の白緑色の粉状地衣類',
          '岩や木をおおう地衣類', '樹皮表面上の地衣類',
          
          // 菌類
          'キノコ類', 'サルノコシカケ類', 'カビ類',
          'ツリガネタケ', 'エブリコ', 'ヒトクチタケ', 'オオミダレアミタケ',
          'エノキタケ', 'シイタケ',
          
          // 蘚苔類
          'コケ', '蘚類', '苔類', 'ジャゴケ', 'マキノゴケ', 'オオウロコゴケ',
          
          // 藻類
          '陸生緑色藻類', '陸生藻類',
          
          // 動物質・有機物
          '昆虫の死骸', '動物の毛', '羽毛', '毛織物', '動物の毛皮', '魚粉',
          '花粉団子', 'ロウ物質', '動物の糞', '猛禽類のペリット',
          
          // 植物の非生体部分
          '樹皮', '腐朽木', '朽木', '根', '根茎', '腐葉土', '枯葉',
          '腐敗した植物', 'コルク', '綿', '腐敗した植物質',
          
          // その他の微生物
          'イシクラゲ', 'ノストック'
        ]);

        // 属レベルから種レベルへの展開マップ
        const taxonomicHierarchy = {
          'コナラ属': ['コナラ', 'ミズナラ', 'アラカシ', 'ウラジロガシ', 'ウバメガシ', 'クヌギ', 'カシワ'],
          'ヤナギ属': ['シダレヤナギ', 'ネコヤナギ', 'タチヤナギ', 'オノエヤナギ', 'キツネヤナギ', 'ヤマネコヤナギ'],
          'ブナ属': ['ブナ'],
          'カエデ属': ['イタヤカエデ', 'ウリハダカエデ', 'イロハモミジ', 'ウリカエデ', 'オガラバナ'],
          'マツ属': ['アカマツ', 'クロマツ', 'キタゴヨウ', 'チョウセンゴヨウ', 'ヨーロッパアカマツ', 'ストローブマツ'],
          'サクラ属': ['サクラ', 'ヤマザクラ', 'オオシマザクラ', 'エドヒガン', 'ウメ', 'モモ'],
          'バラ属': ['ノイバラ', 'テリハノイバラ'],
          'キイチゴ属': ['キイチゴ', 'クマイチゴ', 'ナワシロイチゴ'],
          'ヤマナラシ属': ['セイヨウハコヤナギ', 'ヤマナラシ'],
          'モミ属': ['モミ', 'トドマツ'],
          'トウヒ属': ['エゾマツ', 'トウヒ'],
          'タンポポ属': ['タンポポ', 'セイヨウタンポポ'],
          'カナメモチ属': ['カナメモチ'],
          'マテバシイ属': ['マテバシイ'],
          'イチイ属': ['イチイ'],
          'シナノキ属': ['シナノキ'],
          'ハッカ属': ['ハッカ'],
          'オランダイチゴ属': ['オランダイチゴ'],
          'ヒメオドリコソウ属': ['ヒメオドリコソウ'],
          'イヌゴマ属': ['イヌゴマ'],
          'ニガハッカ属': ['ニガハッカ']
        };

        // 記述的表現のリスト
        const descriptiveTerms = new Set([
          '各種広葉樹', '各種針葉樹', 'ヤナギ類', 'マツ類', 'ナラ類',
          '各種', '広食性', '各種樹木', '草本類'
        ]);

        const correctPlantName = (name) => {
          // デバッグ: セイヨウハコヤナギの処理を追跡
          if (name && name.includes('セイヨウハコヤナギ')) {
            allowDebugLogs && console.log(`DEBUG: correctPlantName called with セイヨウハコヤナギ: "${name}"`);
            allowDebugLogs && console.log(`DEBUG: yListPlantNames.has('セイヨウハコヤナギ'): ${yListPlantNames.has('セイヨウハコヤナギ')}`);
          }
          
          // 0. スラッシュを含む植物名の処理（別名処理）
          if (name && name.includes('/')) {
            // スラッシュで区切られた植物名は最初の名前を使用
            const firstPart = name.split('/')[0].trim();
            allowDebugLogs && console.log(`DEBUG: Processing slash-separated plant name: "${name}" -> using first part: "${firstPart}"`);
            return firstPart;
          }
          
          // 0.5. セイヨウハコヤナギの特別処理
          if (name === 'セイヨウハコヤナギ') {
            allowDebugLogs && console.log('DEBUG: セイヨウハコヤナギ special handling - returning as-is');
            return 'セイヨウハコヤナギ';
          }
          
          // 1. 直接マッチ（最優先）
          if (yListPlantNames.has(name)) {
            if (name === 'セイヨウハコヤナギ') {
              allowDebugLogs && console.log('DEBUG: セイヨウハコヤナギ found in yListPlantNames, returning as-is');
            }
            return name;
          }

          // 2. 非維管束植物チェック
          if (nonVascularPlants.has(name)) {
            return name;
          }
          
          // 2.5. 地名・地域名を除外
          const geographicNames = new Set([
            '小笠原諸島', '小笠原', '沖縄島', '沖縄', '本州', '北海道', '九州', '四国',
            '屋久島', '奄美', '伊豆諸島', '伊豆', '対馬', '五島', '種子島',
            '日本', '中国', '台湾', '朝鮮', '韓国', 'アジア', 'アメリカ', 'ヨーロッパ', 'アフリカ'
          ]);
          
          if (geographicNames.has(name) || /諸島$|島では$|地方$|県$|市$|区$/.test(name)) {
            allowDebugLogs && console.log(`DEBUG: Plant "${name}" is a geographic location, returning null`);
            return '';  // Return empty string to filter out
          }

          // 3. 記述的表現チェック
          if (descriptiveTerms.has(name)) {
            return name;
          }
          
          // 4. 括弧付き植物名の処理（例：「ムギ類(イネ科)」）
          if (name.includes('(') || name.includes('（')) {
            // Return the original name with family info
            return name;
          }

          // 5. 属レベル展開
          if (name.endsWith('属')) {
            const genusPlants = taxonomicHierarchy[name] || [];
            const validPlants = genusPlants.filter(p => yListPlantNames.has(p));
            if (validPlants.length > 0) {
              // 代表種を返す（最初の有効な種）
              return validPlants[0];
            }
          }

          // 5. 文字補正
          const corrections = {
            'パ': 'バ',
            'ピ': 'ビ',
            'プ': 'ブ',
            'ペ': 'ベ',
            'ポ': 'ボ',
            'ガ': 'カ',
            'ギ': 'キ',
            'グ': 'ク',
            'ゲ': 'ケ',
            'ゴ': 'コ',
          };
          let correctedName = name;
          for (const [wrong, correct] of Object.entries(corrections)) {
            if (correctedName.includes(wrong)) {
              const tempName = correctedName.replace(new RegExp(wrong, 'g'), correct);
              if (yListPlantNames.has(tempName)) {
                return tempName;
              }
            }
          }

          // 6. 「類」の展開処理
          if (name.endsWith('類')) {
            // ツバキ類 -> ヤブツバキ（YListで標準名として存在）
            const groupExpansions = {
              'ツバキ類': 'ヤブツバキ',
              'ヤナギ類': 'シダレヤナギ',
              'マツ類': 'アカマツ',
              'ナラ類': 'コナラ',
              'カエデ類': 'イタヤカエデ',
              'サクラ類': 'ヤマザクラ'
            };
            
            const expanded = groupExpansions[name];
            if (name === 'ツバキ類') {
              allowDebugLogs && console.log(`DEBUG: ツバキ類 expansion - expanded to: ${expanded}, exists in YList: ${yListPlantNames.has(expanded)}`);
            }
            if (expanded && yListPlantNames.has(expanded)) {
              allowDebugLogs && console.log(`DEBUG: Expanded ${name} to ${expanded}`);
              return expanded;
            }
            
            // 記述的表現として扱う
            return name;
          }
          
          // 7. 見つからない場合は元の名前を返す（YListにない植物も表示する）
          // Special debug for common plants that might be getting filtered
          if (name === 'ヤマモモ' || name === 'コナラ' || name === 'カシワ' || name === 'クヌギ' || name === 'セイヨウハコヤナギ') {
            allowDebugLogs && console.log(`DEBUG: Plant "${name}" not found in YList, returning as-is`);
          }
          return name;
        };;

        // Process integrated hamushi CSV to create hamushiMap with error handling
        let hamushiMap = {};
        let hamushiParsedData = [];
        if (hamushiIntegratedText) {
          try {
            allowDebugLogs && console.log("Parsing integrated hamushi data...");
            const hamushiParsed = Papa.parse(hamushiIntegratedText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (hamushiParsed.errors.length) {
              console.error("PapaParse errors in hamushi_integrated_master.csv:", hamushiParsed.errors);
            }
            
            hamushiParsedData = hamushiParsed.data;
            hamushiParsed.data.forEach(row => {
              const name = row['和名']?.trim();
              if (name) {
                // Convert integrated CSV structure to expected format
                // Use correct column names from the actual CSV structure
                hamushiMap[name] = {
                  '和名': name,
                  '学名': row['学名']?.trim(),
                  '科和名': row['科和名']?.trim(), 
                  '亜科和名': row['亜科和名']?.trim(),
                  '族和名': row['族和名']?.trim(), // Add tribe information
                  '食草': row['食草']?.trim(),
                  '成虫出現時期': row['成虫出現時期']?.trim(),
                  '出典': row['出典']?.trim(),
                  '備考': row['備考']?.trim(),
                };
              }
            });
            allowDebugLogs && console.log("Integrated hamushi data parsed successfully. hamushiMap size:", Object.keys(hamushiMap).length);
          } catch (error) {
            console.error("Error parsing integrated hamushi data:", error);
            console.warn("Continuing without integrated hamushi data - detailed hamushi information may be incomplete");
            hamushiParsedData = [];
          }
        } else {
          console.warn("Integrated hamushi data not available - detailed hamushi information will be limited");
          hamushiParsedData = [];
        }


        // Process mainText
        const mainMothData = [];
        mainBeetleData = [];
        Papa.parse(mainText, {
          header: true,
          skipEmptyLines: 'greedy',
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '"',
          transform: (value) => {
            // Clean up malformed quote escaping
            if (typeof value === 'string') {
              return value.replace(/^"|"$/g, '');
            }
            return value;
          },
          complete: (results) => {
            if (results.errors.length) {
              console.error("PapaParse errors in ListMJ_hostplants_master.csv:", results.errors);
            }
            
            // Pre-scan for センモンヤガ and カバシタムクゲエダシャク
            allowDebugLogs && console.log('=== MAIN CSV PARSED - SEARCHING FOR センモンヤガ AND カバシタムクゲエダシャク ===');
            const senmonYagaPreScan = results.data.filter((row, idx) => {
              const matchesName = row['和名'] === 'センモンヤガ' || row['大図鑑和名'] === 'センモンヤガ';
              const matchesCatalog = row['大図鑑カタログNo'] === '3489';
              if (matchesName || matchesCatalog) {
                allowDebugLogs && console.log(`Pre-scan found センモンヤガ at row ${idx}:`, {
                  和名: row['和名'],
                  大図鑑和名: row['大図鑑和名'],
                  カタログNo: row['大図鑑カタログNo'],
                  食草: row['食草'] ? row['食草'].substring(0, 50) + '...' : 'EMPTY',
                  食草length: row['食草'] ? row['食草'].length : 0
                });
              }
              return matchesName || matchesCatalog;
            });
            
            const kabaShitaPreScan = results.data.filter((row, idx) => {
              const matchesName = row['和名'] === 'カバシタムクゲエダシャク';
              if (matchesName) {
                allowDebugLogs && console.log(`Pre-scan found カバシタムクゲエダシャク at row ${idx}:`, {
                  和名: row['和名'],
                  学名: row['学名']?.substring(0, 50),
                  食草: row['食草'] ? row['食草'].substring(0, 50) + '...' : 'EMPTY',
                  食草full: row['食草'],
                  備考: row['備考'] ? row['備考'].substring(0, 50) + '...' : 'EMPTY',
                  備考full: row['備考'],
                  全カラム: Object.keys(row).map(key => `${key}: ${row[key]}`).join(' | ')
                });
              }
              return matchesName;
            });
            
            allowDebugLogs && console.log(`Total センモンヤガ entries found in pre-scan: ${senmonYagaPreScan.length}`);
            allowDebugLogs && console.log(`Total カバシタムクゲエダシャク entries found in pre-scan: ${kabaShitaPreScan.length}`);
            allowDebugLogs && console.log('=== END PRE-SCAN ===');
            
            // COLUMN MISALIGNMENT FIX - Fix rows where scientific names are shifted to wrong columns
            // CSV修正により不要になった列位置ずれ修正処理
            allowDebugLogs && console.log('=== COLUMN MISALIGNMENT FIX (DISABLED - fixed in CSV) ===');
            let fixedRows = 0;
            // Column misalignment fix disabled - issues resolved in CSV files
            if (false) { // Disabled: CSV files have been pre-cleaned
              results.data.forEach((row, index) => {
                const japaneseName = row['和名']?.trim();
                const scientificName = row['学名']?.trim();
                const hostPlants = row['食草']?.trim();
                const source = row['出典']?.trim();
                
                // Detect column misalignment: if 学名 contains food plant data and 食草 contains source data
                if (japaneseName && scientificName && hostPlants && 
                    (scientificName === '広食性' || scientificName === '不明' || 
                     scientificName.includes('科') || scientificName.includes('種') ||
                     scientificName.includes('属') || scientificName.includes('草')) &&
                    (hostPlants.includes('図鑑') || hostPlants.includes('標準') || 
                     hostPlants === '日本産蛾類標準図鑑1')) {
                  
                  allowDebugLogs && console.log(`Fixing column misalignment for ${japaneseName} at row ${index + 2}`);
                  allowDebugLogs && console.log(`  Before: 学名="${scientificName}", 食草="${hostPlants}", 出典="${source}"`);
                  
                  // Shift values to correct positions
                  row['学名'] = ''; // Clear scientific name (it was incorrect)
                  row['食草'] = scientificName; // Move the food plant data to correct column
                  row['出典'] = hostPlants; // Move the source data to correct column
                  row['備考'] = source || ''; // Move whatever was in source to remarks
                  
                  allowDebugLogs && console.log(`  After:  学名="${row['学名']}", 食草="${row['食草']}", 出典="${row['出典']}"`);
                  fixedRows++;
                }
              });
            }
            allowDebugLogs && console.log(`Column misalignment fix: ${fixedRows} rows (disabled - CSV pre-cleaned)`);
            allowDebugLogs && console.log('=== END COLUMN MISALIGNMENT FIX ===');
            
            results.data.forEach((row, index) => {
              const catalogNo = row['大図鑑カタログNo']?.trim();
              // Some rows have the Japanese name in the '属名' field instead of '和名'
              const originalMothName = row['和名']?.trim() || row['属名']?.trim();
              
              // Skip rows without moth name (these are definitely incomplete)
              if (!originalMothName) return;
              
              
              // Debug logging for スミレモンキリガ
              if (originalMothName.includes('スミレモンキリガ')) {
                allowDebugLogs && console.log(`DEBUG: Found スミレモンキリガ at index ${index}:`, {
                  originalMothName,
                  hostPlants: row['食草'],
                  willBeId: `main-${index}`
                });
              }
              
              // Debug logging for センモンヤガ
              if (originalMothName === 'センモンヤガ') {
                allowDebugLogs && console.log(`DEBUG: Found センモンヤガ at index ${index}:`, {
                  originalMothName,
                  catalogNo: row['大図鑑カタログNo'],
                  hostPlants: row['食草'],
                  remarks: row['備考'],
                  fullRow: row
                });
              }
              
              // Skip entries where source appears to be in the moth name field (malformed data)
              if (originalMothName === '日本産タマムシ大図鑑' || originalMothName.includes('大図鑑')) return;

              const mothName = correctMothName(originalMothName);
              
              // Debug logging for フクラスズメ and related species (temporarily disabled)
              // if (mothName === 'フクラスズメ' || mothName === 'ホリシャキシタケンモン' || mothName === 'マルバネキシタケンモン') {
              //   allowDebugLogs && console.log(`DEBUG: Processing ${mothName} at index ${index}, ID will be main-${index}`);
              //   allowDebugLogs && console.log(`DEBUG: Food plants field:`, row['食草']);
              // }
              
              
              const genus = row['属名'] || '';
              const species = row['種小名'] || '';
              const author = row['著者'] || '';
              const year = row['公表年'] || '';
              
              let scientificName = processScientificName(row['学名'], genus, species, author, year, 'moth');
              
              // Validate scientific name quality
              const validationResult = validateScientificName(scientificName, mothName, 'moth');
              
              // 和名→学名ファイル名マッピングを優先使用
              const scientificFilename = globalJapaneseToScientificMapping.get(mothName) || formatScientificNameForFilename(scientificName);
              

              let familyFromMainCsv = row['科和名'] || row['科名'] || '';
              
              // Special handling for hamaki moths from "日本のハマキガ" source
              const source = row['出典'] || '';
              const isHamakiFromBook = source.includes('日本のハマキガ');
              
              if (isHamakiFromBook && !familyFromMainCsv) {
                familyFromMainCsv = 'ハマキガ科';
              }
              
              // Check if this is a beetle (Buprestidae family)
              const isBeetle = familyFromMainCsv === 'タマムシ科' || row['科名'] === 'Buprestidae';

              const classification = {
                family: row['科名'] || (isHamakiFromBook ? 'Tortricidae' : ''), 
                familyJapanese: row['科和名'] || (isHamakiFromBook ? 'ハマキガ科' : ''), 
                subfamily: row['亜科名'] || '',
                subfamilyJapanese: row['亜科和名'] || '', tribe: row['族名'] || '', tribeJapanese: row['族和名'] || '',
                subtribe: row['亜族名'] || '', subtribeJapanese: row['亜族和名'] || '', genus: row['属名'] || '',
                subgenus: row['亜属名'] || '', speciesEpithet: row['種小名'] || '', subspeciesEpithet: row['亜種小名'] || '',
              };

              // Improved host plant parsing with validation
              let rawHostPlant = row['食草'] || '';
              let rawRemarks = row['備考'] || '';
              let hostPlantRemarks = row['食草に関する備考'] || '';
              
              // Clean publication names from food plant data
              rawHostPlant = removePublicationNames(rawHostPlant);
              const hostPlantNotes = []; // Initialize hostPlantNotes array here
              
              
              // Debug logging for カバシタムクゲエダシャク processing
              if (mothName === 'カバシタムクゲエダシャク') {
                allowDebugLogs && console.log('=== カバシタムクゲエダシャク PROCESSING DEBUG ===');
                allowDebugLogs && console.log('rawHostPlant from CSV:', rawHostPlant);
                allowDebugLogs && console.log('rawRemarks from CSV:', rawRemarks);
                allowDebugLogs && console.log('Original row data:', {
                  食草: row['食草'],
                  備考: row['備考'],
                  学名: row['学名'],
                  和名: row['和名']
                });
              }
              
              // Special handling for catalog-676 (シロテンチビミノガ)
              if (row['大図鑑カタログNo'] === '676' || mothName === 'シロテンチビミノガ') {
                // Add specific remark for catalog-676
                hostPlantNotes.push('岩石表面上の白色緑色の粉状地衣類など');
              }

              // Special handling for catalog-3575 (コグレヨトウ)
              if (row['大図鑑カタログNo'] === '3575' || mothName === 'コグレヨトウ') {
                // Add specific remark for catalog-3575
                hostPlantNotes.push('北アメリカでは、マンテマ属の種子鞘を食べる');
              }

              // Special handling for ニッコウキエダシャク - Add historical record as remark
              if (mothName === 'ニッコウキエダシャク') {
                hostPlantNotes.push('古くズミ (バラ科)の記録もあるが再確認されていない');
              }

              // Special handling for チョウセンネグロシャチホコ - Add geographic record as remark
              if (mothName === 'チョウセンネグロシャチホコ') {
                hostPlantNotes.push('朝鮮半島ではサワフタギが確認されている');
              }

              // Debug logging for センモンヤガ host plant processing
              if (mothName === 'センモンヤガ' || row['大図鑑カタログNo'] === '3489') {
                allowDebugLogs && console.log(`DEBUG: Processing センモンヤガ host plants:`, {
                  mothName,
                  rawHostPlant,
                  rawRemarks,
                  hasHostPlant: !!rawHostPlant,
                  hostPlantLength: rawHostPlant.length,
                  catalogNo: row['大図鑑カタログNo'],
                  fullRow: row
                });
              }
              
              // Function to extract and integrate plant part information
              // Enhanced function to extract plant parts and clean plant names
              const extractPlantPartsAndCleanNames = (text) => {
                const partPatterns = [
                  { pattern: /の花(?:弁|びら)?/g, part: '花' },
                  { pattern: /の花/g, part: '花' },
                  { pattern: /の実/g, part: '実' },
                  { pattern: /の果実/g, part: '実' },
                  { pattern: /の種子/g, part: '種子' },
                  { pattern: /の葉/g, part: '葉' },
                  { pattern: /の若葉/g, part: '若葉' },
                  { pattern: /の新葉/g, part: '新葉' },
                  { pattern: /の古葉/g, part: '古葉' },
                  { pattern: /の樹皮/g, part: '樹皮' },
                  { pattern: /の幹/g, part: '幹' },
                  { pattern: /の枝/g, part: '枝' },
                  { pattern: /の茎/g, part: '茎' },
                  { pattern: /の根/g, part: '根' },
                  { pattern: /の蕾/g, part: '蕾' },
                  { pattern: /の芽/g, part: '芽' }
                ];
                
                const extractedParts = new Map();
                let cleanedText = text;
                
                // First, handle simple patterns like "ツバキの花"
                partPatterns.forEach(({ pattern, part }) => {
                  // Look for standalone plant+part combinations
                  const standalonePattern = new RegExp(`([ア-ン一-龯ァ-ヶー]{2,})${pattern.source.replace(/\/g$/, '')}`, 'g');
                  const standaloneMatches = [...text.matchAll(standalonePattern)];
                  
                  standaloneMatches.forEach(match => {
                    const plantName = match[1];
                    if (!extractedParts.has(plantName)) {
                      extractedParts.set(plantName, []);
                    }
                    if (!extractedParts.get(plantName).includes(part)) {
                      extractedParts.get(plantName).push(part);
                    }
                    // Remove the part from the text, keeping only the plant name
                    cleanedText = cleanedText.replace(match[0], plantName);
                  });
                  
                  // Also handle the original pattern for complex text
                  const matches = [...text.matchAll(pattern)];
                  matches.forEach(match => {
                    // Extract plant name before the part
                    const beforeMatch = text.substring(0, match.index);
                    const plantMatch = beforeMatch.match(/([ア-ン一-龯ァ-ヶー]{2,})$/);
                    if (plantMatch) {
                      const plantName = plantMatch[1];
                      if (!extractedParts.has(plantName)) {
                        extractedParts.set(plantName, []);
                      }
                      if (!extractedParts.get(plantName).includes(part)) {
                        extractedParts.get(plantName).push(part);
                      }
                    }
                  });
                });
                
                return { parts: extractedParts, cleanedText: cleanedText };
              };
              
              // Legacy function for backward compatibility
              const extractPlantParts = (text) => {
                return extractPlantPartsAndCleanNames(text).parts;
              };
              
              // Extract plant parts from both food plants and remarks
              const plantPartsFromFood = extractPlantParts(rawHostPlant);
              const plantPartsFromRemarks = extractPlantParts(rawRemarks);
              
              // Merge plant parts information
              const allPlantParts = new Map(plantPartsFromFood);
              for (const [plant, parts] of plantPartsFromRemarks) {
                if (allPlantParts.has(plant)) {
                  // Merge parts, avoiding duplicates
                  const existingParts = allPlantParts.get(plant);
                  parts.forEach(part => {
                    if (!existingParts.includes(part)) {
                      existingParts.push(part);
                    }
                  });
                } else {
                  allPlantParts.set(plant, [...parts]);
                }
              }
              
              // Check if we have キリガ or フユシャク CSV data for this species
              const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
              const kirigaHostPlants = kirigaHostPlantMap.get(mothName) || 
                                       kirigaHostPlantMap.get(scientificName) ||
                                       kirigaHostPlantMap.get(cleanedScientificName);
              const kirigaRemarks = kirigaRemarksMap.get(mothName) || 
                                    kirigaRemarksMap.get(scientificName) ||
                                    kirigaRemarksMap.get(cleanedScientificName);
              const fuyushakuHostPlants = fuyushakuHostPlantMap.get(mothName) || 
                                          fuyushakuHostPlantMap.get(scientificName) ||
                                          fuyushakuHostPlantMap.get(cleanedScientificName);
              const fuyushakuRemarks = fuyushakuRemarksMap.get(mothName) || 
                                       fuyushakuRemarksMap.get(scientificName) ||
                                       fuyushakuRemarksMap.get(cleanedScientificName);
              
              // Special handling for カバシタムクゲエダシャク
              if (mothName === 'カバシタムクゲエダシャク') {
                allowDebugLogs && console.log('DEBUG: Special handling for カバシタムクゲエダシャク - looking up in maps');
                allowDebugLogs && console.log('DEBUG: Keys in fuyushakuHostPlantMap:', Array.from(fuyushakuHostPlantMap.keys()).filter(k => k && (k.includes('カバシタ') || k.includes('Sebastosema') || k.includes('bubonaria'))));
                allowDebugLogs && console.log('DEBUG: All fuyushaku keys (first 50):', Array.from(fuyushakuHostPlantMap.keys()).slice(0, 50));
                
                // Force override for カバシタムクゲエダシャク from フユシャク data
                const directLookup = fuyushakuHostPlantMap.get('カバシタムクゲエダシャク');
                if (directLookup) {
                  allowDebugLogs && console.log('DEBUG: Found カバシタムクゲエダシャク data directly:', directLookup);
                } else {
                  allowDebugLogs && console.log('DEBUG: カバシタムクゲエダシャク not found in fuyushakuHostPlantMap');
                  // Try with different scientific name variations
                  const variations = [
                    'Sebastosema bubonaria Warren, 1896',
                    'Sebastosema bubonaria',
                    scientificName,
                    cleanedScientificName
                  ];
                  for (const variation of variations) {
                    const found = fuyushakuHostPlantMap.get(variation);
                    if (found) {
                      allowDebugLogs && console.log(`DEBUG: Found using variation "${variation}":`, found);
                      break;
                    }
                  }
                }
              }
              const hasKirigaData = kirigaHostPlants || kirigaRemarks;
              const hasFuyushakuData = fuyushakuHostPlants || fuyushakuRemarks;
              
              // Debug log for クロスジフユエダシャク and カバシタムクゲエダシャク
              if (mothName === 'クロスジフユエダシャク' || mothName === 'カバシタムクゲエダシャク') {
                allowDebugLogs && console.log(`=== Debug ${mothName} ===`);
                allowDebugLogs && console.log(`mothName: ${mothName}`);
                allowDebugLogs && console.log(`scientificName: ${scientificName}`);
                allowDebugLogs && console.log(`cleanedScientificName: ${cleanedScientificName}`);
                allowDebugLogs && console.log(`rawHostPlant (before): ${rawHostPlant}`);
                allowDebugLogs && console.log(`kirigaHostPlants: ${kirigaHostPlants}`);
                allowDebugLogs && console.log(`fuyushakuHostPlants: ${fuyushakuHostPlants}`);
                allowDebugLogs && console.log(`hasKirigaData: ${hasKirigaData}`);
                allowDebugLogs && console.log(`hasFuyushakuData: ${hasFuyushakuData}`);
              }
              
              // Special hardcoded override for カバシタムクゲエダシャク if フユシャク data exists but isn't being picked up
              if (mothName === 'カバシタムクゲエダシャク') {
                // Force フユシャク data for カバシタムクゲエダシャク
                const forcedFuyushakuPlants = 'ツルウメモドキ、ニシキギ、コマユミ、マユミ、マサキ、ツルマサキ';
                const forcedFuyushakuRemarks = 'ニシキギ科に固有。マユミ、マサキ、ツルマサキでも蛹化に成功。';
                
                allowDebugLogs && console.log('DEBUG: Forcing フユシャク data for カバシタムクゲエダシャク');
                const fuyushakuResult = extractPlantPartsAndCleanNames(forcedFuyushakuPlants);
                rawHostPlant = fuyushakuResult.cleanedText;
                
                // Merge the extracted parts with existing parts
                for (const [plant, parts] of fuyushakuResult.parts) {
                  if (allPlantParts.has(plant)) {
                    const existingParts = allPlantParts.get(plant);
                    parts.forEach(part => {
                      if (!existingParts.includes(part)) {
                        existingParts.push(part);
                      }
                    });
                  } else {
                    allPlantParts.set(plant, [...parts]);
                  }
                }
                
                // Clear hostPlantNotes and add only the correct remarks (exclude source information)
                hostPlantNotes.length = 0;
                // Add remarks to hostPlantNotes, but filter out any source references
                if (forcedFuyushakuRemarks && !hostPlantNotes.includes(forcedFuyushakuRemarks)) {
                  // Make sure we don't accidentally include source information in notes
                  const cleanRemarks = forcedFuyushakuRemarks.replace(/日本産蛾類標準図鑑\d*/g, '').trim();
                  if (cleanRemarks && !hostPlantNotes.includes(cleanRemarks)) {
                    hostPlantNotes.push(cleanRemarks);
                  }
                }
                
                allowDebugLogs && console.log('DEBUG: カバシタムクゲエダシャク forced update:', {
                  rawHostPlant,
                  hostPlantNotes
                });
                
                // Also force emergence time data for カバシタムクゲエダシャク
                const forcedEmergenceTime = '3月上旬~3月下旬';
                emergenceTimeMap.set(mothName, { time: forcedEmergenceTime, source: '日本の冬尺蛾' });
                emergenceTimeMap.set(scientificName, { time: forcedEmergenceTime, source: '日本のフユシャク' });
                emergenceTimeMap.set(cleanedScientificName, { time: forcedEmergenceTime, source: '日本のフユシャク' });
                
                allowDebugLogs && console.log('DEBUG: カバシタムクゲエダシャク forced emergence time:', forcedEmergenceTime);
              } else if (fuyushakuHostPlants) {
                // Debug log for カバシタムクゲエダシャク
                if (mothName === 'カバシタムクゲエダシャク') {
                  allowDebugLogs && console.log('DEBUG: Using フユシャク data for カバシタムクゲエダシャク:', {
                    fuyushakuHostPlants,
                    fuyushakuRemarks
                  });
                }
                
                // Use フユシャク data as highest priority source and extract parts
                const fuyushakuResult = extractPlantPartsAndCleanNames(fuyushakuHostPlants);
                rawHostPlant = fuyushakuResult.cleanedText;
                
                // Merge the extracted parts with existing parts
                for (const [plant, parts] of fuyushakuResult.parts) {
                  if (allPlantParts.has(plant)) {
                    // Merge parts, avoiding duplicates
                    const existingParts = allPlantParts.get(plant);
                    parts.forEach(part => {
                      if (!existingParts.includes(part)) {
                        existingParts.push(part);
                      }
                    });
                  } else {
                    allPlantParts.set(plant, [...parts]);
                  }
                }
                
                // Add remarks to hostPlantNotes instead of appending to rawHostPlant
                if (fuyushakuRemarks && !hostPlantNotes.includes(fuyushakuRemarks)) {
                  // 成虫発生時期を除去
                  const { notes: filteredRemarks } = extractEmergenceTime(fuyushakuRemarks);
                  if (filteredRemarks.trim()) {
                    hostPlantNotes.push(filteredRemarks.trim());
                  }
                }
                
                // Debug log for フユシャク species and クロスジフユエダシャク
                if (mothName.includes('フユエダシャク') || mothName.includes('フユシャク') || mothName.includes('トゲエダシャク') || mothName === 'クロスジフユエダシャク') {
                  allowDebugLogs && console.log(`Updated フユシャク host plants for ${mothName}: ${rawHostPlant}`);
                  allowDebugLogs && console.log(`Extracted parts for ${mothName}:`, Array.from(fuyushakuResult.parts.entries()));
                }
              } else if (kirigaHostPlants && kirigaHostPlants !== rawHostPlant) {
                // Use キリガ data as secondary priority source and extract parts
                const kirigaResult = extractPlantPartsAndCleanNames(kirigaHostPlants);
                rawHostPlant = kirigaResult.cleanedText;
                
                // Merge the extracted parts with existing parts
                for (const [plant, parts] of kirigaResult.parts) {
                  if (allPlantParts.has(plant)) {
                    // Merge parts, avoiding duplicates
                    const existingParts = allPlantParts.get(plant);
                    parts.forEach(part => {
                      if (!existingParts.includes(part)) {
                        existingParts.push(part);
                      }
                    });
                  } else {
                    allPlantParts.set(plant, [...parts]);
                  }
                }
                
                // Add remarks to hostPlantNotes instead of appending to rawHostPlant
                if (kirigaRemarks && !hostPlantNotes.includes(kirigaRemarks)) {
                  // 成虫発生時期を除去
                  const { notes: filteredRemarks } = extractEmergenceTime(kirigaRemarks);
                  if (filteredRemarks.trim()) {
                    hostPlantNotes.push(filteredRemarks.trim());
                  }
                }
                
                // Debug log for target species
                if (mothName.includes('ナンカイミドリキリガ') || mothName.includes('キバラモクメキリガ') || mothName.includes('スミレモンキリガ')) {
                  allowDebugLogs && console.log(`Updated host plants for ${mothName}: ${rawHostPlant}`);
                  allowDebugLogs && console.log(`Extracted parts for ${mothName}:`, Array.from(kirigaResult.parts.entries()));
                }
              }
              
              // Debug log for クロスジフユエダシャク after processing
              if (mothName === 'クロスジフユエダシャク') {
                allowDebugLogs && console.log(`rawHostPlant (after): ${rawHostPlant}`);
                allowDebugLogs && console.log(`=== End Debug クロスジフユエダシャク ===`);
              }
              
              // Special handling for フクラスズメ which has malformed food plant data due to CSV parsing issues
              if (mothName === 'フクラスズメ') {
                // フクラスズメ's correct food plants from the original CSV
                rawHostPlant = 'イラクサ; ラミー; コアカソ; カラムシ; ヤブマオ; ラセイタソウ; ハドノキ(以上イラクサ科); マルパウツギ(アジサイ科); コウゾ; クワ(以上クワ科); カナムグラ(アサ科)';
              }
              
              // Skip processing if host plant is empty, just numbers, or just English letters
              if (!rawHostPlant || 
                  rawHostPlant.trim() === '' || 
                  /^[0-9]+$/.test(rawHostPlant.trim()) ||
                  /^[A-Za-z]+$/.test(rawHostPlant.trim()) ||
                  /^\s*[0-9]{4}\)"?\s*$/.test(rawHostPlant.trim()) || // Year patterns like "1763)"
                  /^\s*[0-9]{4}"?\s*$/.test(rawHostPlant.trim()) || // Simple year patterns like "1763"
                  rawHostPlant.trim() === '不明' ||
                  rawHostPlant.length < 2) {
                if (mothName === 'センモンヤガ') {
                  allowDebugLogs && console.log('DEBUG: センモンヤガ rawHostPlant was cleared! Original:', row['食草']);
                }
                rawHostPlant = '';
              }
              
              // Check for monophagous information and other notes
              // Consider monophagous if it's specific to a single plant species (not family/genus)
              const isMonophagous = rawHostPlant.includes('単食性') || 
                                  (rawHostPlant.includes('に固有') && 
                                   !rawHostPlant.includes('科に固有') && 
                                   !rawHostPlant.includes('属に固有'));
              
              // Extract notes from parentheses (like "可能性が高い", "単食性" etc.)
              // hostPlantNotes already defined above
              
              // Special handling for フクラスズメ food plant notes
              if (mothName === 'フクラスズメ') {
                hostPlantNotes.push('イラクサ科が主な寄主植物であるが、マルパウツギ(アジサイ科)、コウゾ、クワ(以上クワ科)、カナムグラ(アサ科)などを食べた例もある');
              }
              
              // Check for "明らかに広食性" and add as note (check before replacement)
              if (rawHostPlant.includes('明らかに広食性')) {
                hostPlantNotes.push('広食性');
              }
              
              // Check for "広食性" (polyphagous/euryphagous) and add as note
              if (rawHostPlant.includes('広食性') && !rawHostPlant.includes('明らかに広食性')) {
                hostPlantNotes.push('広食性');
              }
              
              // Add host plant remarks from CSV if available
              if (hostPlantRemarks && hostPlantRemarks.trim()) {
                hostPlantNotes.push(hostPlantRemarks.trim());
              }
              
              // Special handling for "広食性" - add explanatory note for オオノコバヨトウ (legacy support)
              if (rawHostPlant === '広食性' && mothName === 'オオノコバヨトウ' && !hostPlantRemarks) {
                hostPlantNotes.push('おそらく多種の植物を食べるのではないかと思われる');
              }
              
              // Extract notes from both （）and () parentheses
              const noteMatches = rawHostPlant.match(/[（(]([^）)]+)[）)]/g);
              if (noteMatches) {
                noteMatches.forEach(match => {
                  const note = match.replace(/[（）()]/g, '');
                  // Exclude family names (科) and short plant-related terms
                  if (note && 
                      !note.match(/^[\w\s]*科$/) && 
                      !note.match(/科$/) &&
                      note.length > 3 &&
                      !note.match(/^[ア-ン]+科$/)) {
                    // 成虫発生時期を除去
                    const { notes: filteredNote } = extractEmergenceTime(note);
                    if (filteredNote.trim()) {
                      hostPlantNotes.push(filteredNote.trim());
                    }
                  }
                });
              }
              
              // Remove parenthetical content from host plant list
              rawHostPlant = rawHostPlant.replace(/[（(][^）)]*[）)]/g, '').trim();
              
              // Clean up host plant data - remove year numbers and incomplete scientific names
              rawHostPlant = rawHostPlant.replace(/^\d{4}\),?\s*/, ''); // Remove year at beginning like "1905),"
              rawHostPlant = rawHostPlant.replace(/^"?\d{4}\),?\s*/, ''); // Remove quoted year like '"1905),'
              rawHostPlant = rawHostPlant.replace(/^\),?\s*/, ''); // Remove orphaned closing parenthesis
              rawHostPlant = rawHostPlant.replace(/^\d{4},\s*/, ''); // Remove year with comma like "1852,"
              // Only remove standalone family names, not family names after plant names
              rawHostPlant = rawHostPlant.replace(/^\(\s*[\w\s]+科\s*\)/, ''); // Remove family names in parentheses at beginning
              
              // Replace "明らかに広食性" with just "広食性" in the plant list
              rawHostPlant = rawHostPlant.replace(/明らかに広食性/g, '広食性');
              
              // Remove "広食性" and related phrases from plant list since it's now in notes
              rawHostPlant = rawHostPlant.replace(/広食性[。；;\s]*/g, '');
              rawHostPlant = rawHostPlant.replace(/^広食性[。；;\s]*/, '');
              rawHostPlant = rawHostPlant.replace(/[。；;\s]*広食性$/g, '');
              
              rawHostPlant = rawHostPlant.trim();

              // Extract "と推測される" as a note
              if (rawHostPlant.includes('と推測される')) {
                hostPlantNotes.push('推測');
                rawHostPlant = rawHostPlant.replace('と推測される', '').trim();
              }

              // Extract notes that are not plant names but descriptive
              const descriptiveNotesMatch = rawHostPlant.match(/(で飼育されており|と思われる|と推定される|が?観察されている|確認されている|国外では|記録|知られ|報告|台湾|沖縄|ヨーロッパ|ハワイ|時に|害虫|被害|食べ|食す|育つ|成長|飼育|判明|植物|樹木|草本|各種|以上|の|を|が|で|に|は|と|や|も|から|まで|では|でも|として|による|からの|への|との|での|によって|において|について|に関して|に対して|によれば|によると).*/);
              if (descriptiveNotesMatch) {
                // 成虫発生時期を除去してからhostPlantNotesに追加
                const { notes: filteredNote } = extractEmergenceTime(descriptiveNotesMatch[0].trim());
                if (filteredNote.trim()) {
                  hostPlantNotes.push(filteredNote.trim());
                }
                rawHostPlant = rawHostPlant.replace(descriptiveNotesMatch[0], '').trim();
              }
              
              let hostPlantEntries = [];
              
              if (rawHostPlant) {
                if (mothName === 'センモンヤガ') {
                  allowDebugLogs && console.log('DEBUG: センモンヤガ - Raw host plant data before processing:', rawHostPlant);
                } else {
                  allowDebugLogs && console.log('DEBUG: Raw host plant data:', rawHostPlant);
                }
                
                // Check if this is a descriptive text (contains observation conditions)
                const hasObservationConditions = /自然状態では|飼育条件下では|観察されている|確認されている|国外では/.test(rawHostPlant);
                
                if (hasObservationConditions) {
                  // Parse descriptive text more carefully
                  const parts = rawHostPlant.split(/[。；]/);
                  
                  let naturalCondition = '';
                  let culturedCondition = '';
                  let internationalCondition = '';
                  let generalPlants = [];
                  
                  parts.forEach(part => {
                    part = part.trim();
                    if (part.includes('自然状態では')) {
                      naturalCondition = part.replace('自然状態では', '').replace(/が?観察されている/, '').trim();
                    } else if (part.includes('飼育条件下では')) {
                      culturedCondition = part.replace('飼育条件下では', '').replace(/を?食べる?/, '').trim();
                    } else if (part.includes('国外では')) {
                      // Handle international observations as notes, not as host plants
                      internationalCondition = part.replace('国外では', '').replace(/が?[記録知].*れている?/, '').trim();
                      allowDebugLogs && console.log('DEBUG: International condition found:', internationalCondition);
                      // Add international information to host plant notes
                      if (internationalCondition) {
                        // 成虫発生時期を除去
                        const { notes: filteredCondition } = extractEmergenceTime('国外では' + internationalCondition);
                        if (filteredCondition.trim()) {
                          hostPlantNotes.push(filteredCondition.trim());
                        }
                      }
                    } else if (part && !part.includes('観察されている') && !part.includes('確認されている') && !part.includes('記録') && !part.includes('知られ')) {
                      // Extract plant names from general descriptions
                      const plantMatches = part.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/gu);
                      if (plantMatches) {
                        plantMatches.forEach(match => {
                          if (match.length > 1 && !match.includes('食べ') && !match.includes('成長') && !match.includes('状態') && !match.includes('国外')) {
                            generalPlants.push(match);
                          }
                        });
                      }
                    }
                  });
                  
                  // Helper function to check if a plant name is valid
                  const isValidPlantName = (plantName) => {
                    // Basic validation - must be a string with reasonable length
                    if (!plantName || typeof plantName !== 'string' || plantName.length < 2) {
                      return false;
                    }
                    
                    // Remove whitespace for testing
                    const trimmed = plantName.trim();
                    
                    // Reject if only numbers or only English letters
                    if (/^[0-9]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Reject catalog numbers with special characters like "10+12"
                    if (/^[0-9+\-]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Reject source publication names (出典名)
                    if (/^日本産.*図鑑/.test(trimmed) || /^標準図鑑/.test(trimmed) || 
                        trimmed.includes('標準図鑑') || trimmed.includes('大図鑑')) {
                      return false;
                    }
                    
                    // Reject geographic region information (地域名)
                    if (/^(朝鮮半島|中国|台湾|韓国|ヨーロッパ|北米|アメリカ|インド|東南アジア|海外)では/.test(trimmed) ||
                        trimmed.includes('では') && (trimmed.includes('朝鮮') || trimmed.includes('中国') || 
                        trimmed.includes('台湾') || trimmed.includes('ヨーロッパ') || trimmed.includes('アメリカ') ||
                        trimmed.includes('海外'))) {
                      return false;
                    }
                    
                    // Reject "多種" patterns that should be filtered out
                    const tashuPatterns = [
                      /^多種$/,                          // Standalone "多種"
                      /^多種の植物$/,                    // "多種の植物"
                      /^多種の草本$/,                    // "多種の草本"
                      /^多種の広葉樹$/,                  // "多種の広葉樹"
                      /^多種の落葉広葉樹$/,              // "多種の落葉広葉樹"
                      /^多種の草本類$/,                  // "多種の草本類"
                      /など多種にわたる$/,               // "など多種にわたる"
                      /など多種の/,                      // "など多種の..."
                      /多種の.*を食べる$/,               // "多種の〇〇を食べる"
                      /多種の.*を摂食する$/,             // "多種の〇〇を摂食する"
                      /多種の.*につく$/,                 // "多種の〇〇につく"
                      /おそらく多種の/,                  // "おそらく多種の..."
                      /広食性で多種の/,                  // "広食性で多種の..."
                      /多種の.*を食草とする$/            // "多種の〇〇を食草とする"
                    ];
                    
                    if (tashuPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject taxonomic comparison phrases that are not plant names
                    const taxonomicComparisonPatterns = [
                      /^同じ.*属$/,                      // "同じ〇〇属"
                      /^同じ.*科$/,                      // "同じ〇〇科"
                      /^同.*属の.*からは/,               // "同〇属の〇〇からは"
                      /からは未発見$/,                   // "〇〇からは未発見"
                      /からは確認されていない$/,         // "〇〇からは確認されていない"  
                      /からのみ.*が得られ/               // "〇〇からのみ〇〇が得られ"
                    ];
                    
                    if (taxonomicComparisonPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject bare genus names (scientific Latin genus names)
                    const genusPatterns = [
                      /^[A-Z][a-z]+ 属$/,                // "Vicia 属", "Quercus 属" etc.
                      /^[A-Z][a-z]+属$/                  // "Vicia属", "Quercus属" etc.
                    ];
                    
                    if (genusPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject geographic/climatic descriptors that are not plant names
                    const climaticPatterns = [
                      /^寒冷地$/,                        // "寒冷地"
                      /^温暖地$/,                        // "温暖地"
                      /^高地$/,                          // "高地"
                      /^低地$/,                          // "低地"
                      /^山地$/,                          // "山地"
                      /^平地$/,                          // "平地"
                      /^亜高山帯$/,                      // "亜高山帯"
                      /^高山帯$/,                        // "高山帯"
                      /^沿海地$/,                        // "沿海地"
                      /^内陸部$/,                        // "内陸部"
                      /では.*$/                          // "寒冷地では〇〇", "温暖地では〇〇" etc.
                    ];
                    
                    if (climaticPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject taxonomic/temporal reference terms that are not plant names
                    const referencePatterns = [
                      /^従来$/,                          // "従来"
                      /^古来$/,                          // "古来" 
                      /^以前$/,                          // "以前"
                      /^過去$/,                          // "過去"
                      /^現在$/,                          // "現在"
                      /^今後$/,                          // "今後"
                      /^将来$/,                          // "将来"
                      /^従来の.*$/,                      // "従来の〇〇"
                      /^古来の.*$/,                      // "古来の〇〇"
                      /の記録$/                          // "〇〇の記録"
                    ];
                    
                    if (referencePatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Allow family names (ending with '科') as valid plant names
                    if (trimmed.endsWith('科')) {
                      return true;
                    }
                    
                    // Allow plant names with family info in parentheses like "ムギ類(イネ科)"
                    if (/[ぁ-んァ-ヶー一-龠]+.*[\(（][^)）]*科[\)）]/.test(trimmed)) {
                      return true;
                    }
                    
                    const invalidPatterns = [
                      /^[0-9]+$/,  // Pure numbers
                      /^[A-Za-z]+$/, // Pure English letters
                      /^[0-9+\-]+$/, // Catalog numbers like "10+12"
                      /国外/,
                      /各種/,
                      /以上/,
                      /記録/,
                      /知られ/,
                      /観察/,
                      /確認/,
                      /報告/,
                      /台湾/,
                      /沖縄/,
                      /ヨーロッパ/,
                      /ハワイ/,
                      /時に/,
                      /害虫/,
                      /被害/,
                      /食べ/,
                      /食す/,
                      /育つ/,
                      /成長/,
                      /飼育/,
                      /ほか/,
                      /判明/,
                      /植物/,
                      /樹木/,
                      /草本/,
                      /^の$/,
                      /^を$/,
                      /^が$/,
                      /^で$/,
                      /^に$/,
                      /^は$/,
                      /^と$/,
                      /^や$/,
                      /^も$/,
                      /^から$/,
                      /^まで$/,
                      /^では$/,
                      /^でも$/,
                      /^として$/,
                      /^による$/,
                      /^からの$/,
                      /^への$/,
                      /^との$/,
                      /^での$/,
                      /^によって$/,
                      /^において$/,
                      /^について$/,
                      /^に関して$/,
                      /^に対して$/,
                      /^によれば$/,
                      /^によると$/,
                      /^不明$/  // Reject "不明" to prevent blank plant pages
                    ];
                    
                    return !invalidPatterns.some(pattern => pattern.test(trimmed));
                  };
                  
                  // Create structured entries
                  if (naturalCondition) {
                    const plants = naturalCondition.split(/[;；、，,]/);
                    plants.forEach(plant => {
                      plant = plant.trim().replace(/の?カビ|など|ほか/g, '');
                      // Remove "以上〇〇科" patterns
                      plant = plant.replace(/以上[^科]*科/g, '');
                      // Remove notes in parentheses from plant names
                      plant = plant.replace(/（[^）]*）/g, '');
                      plant = plant.replace(/\([^)]*\)/g, '');
                      if (plant.length > 1 && isValidPlantName(plant)) {
                        const normalizedPlant = normalizePlantName(plant);
                        // Debug for スミレモンキリガ
                        if (originalMothName?.includes('スミレモンキリガ')) {
                          allowDebugLogs && console.log(`DEBUG: スミレモンキリガ plant processing: "${plant}" -> normalized: "${normalizedPlant}"`);
                        }
                        const correctedPlantName = correctPlantName(normalizedPlant);
                        // Debug for スミレモンキリガ
                        if (originalMothName?.includes('スミレモンキリガ')) {
                          allowDebugLogs && console.log(`DEBUG: スミレモンキリガ corrected plant: "${correctedPlantName}"`);
                        }
                        // Only add if the corrected plant name is not empty (i.e., found in YList)
                        if (correctedPlantName && correctedPlantName.trim()) {
                          // Check if this plant has part information
                          const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                          const plantWithParts = plantParts && plantParts.length > 0 ? 
                            `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                          
                          addPlantEntry(hostPlantEntries, plantWithParts, '自然状態', familyFromMainCsv);
                        }
                      }
                    });
                  }
                  
                  if (culturedCondition) {
                    allowDebugLogs && console.log('DEBUG: Processing culturedCondition:', culturedCondition);
                    // More specific pattern to extract plant names from cultured condition
                    const plants = culturedCondition.split(/[;；、，,]/);
                    plants.forEach(plant => {
                      plant = plant.trim();
                      
                      // Clean up the plant name but preserve actual plant names
                      plant = plant.replace(/で飼育に成功している/g, '');
                      
                      // Special handling for "などマメ科植物" to preserve the nuance
                      const hasNadoMamekaNote = plant.includes('などマメ科植物');
                      if (hasNadoMamekaNote) {
                        // Extract the main plant name but keep the "などマメ科植物" context as a note
                        const mainPlantMatch = plant.match(/^([^な]+)など/);
                        if (mainPlantMatch) {
                          const mainPlant = mainPlantMatch[1].trim();
                          if (mainPlant && isValidPlantName(mainPlant)) {
                            const normalizedPlant = normalizePlantName(mainPlant);
                            // Check if this plant has part information
                            const plantParts = allPlantParts.get(mainPlant) || allPlantParts.get(normalizedPlant);
                            const plantWithParts = plantParts && plantParts.length > 0 ? 
                              `${normalizedPlant}（${plantParts.join('・')}）` : normalizedPlant;
                            
                            addPlantEntry(hostPlantEntries, plantWithParts, '飼育条件下', familyFromMainCsv);
                          }
                          // Add a note about the broader family context (insert at beginning)
                          hostPlantNotes.unshift('マメ科植物での飼育が可能');
                          return; // Skip the regular processing for this plant
                        }
                      }
                      
                      plant = plant.replace(/などマメ科植物/g, '');
                      plant = plant.replace(/など/g, '');
                      // Do not remove '類' - it's meaningful for plant groups
                      plant = plant.replace(/ほか/g, '');
                      // Remove "以上〇〇科" patterns
                      plant = plant.replace(/以上[^科]*科/g, '');
                      
                      // Remove notes in parentheses from plant names
                      plant = plant.replace(/（[^）]*）/g, '');
                      plant = plant.replace(/\([^)]*\)/g, '');
                      
                      plant = plant.trim();
                      
                      allowDebugLogs && console.log('DEBUG: Extracted cultured plant:', plant);
                      
                      if (plant.length > 1 && isValidPlantName(plant)) {
                        const normalizedPlant = normalizePlantName(plant);
                        const correctedPlantName = correctPlantName(normalizedPlant);
                        // Only add if the corrected plant name is not empty (i.e., found in YList)
                        if (correctedPlantName && correctedPlantName.trim()) {
                          // Check if this plant has part information
                          const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                          const plantWithParts = plantParts && plantParts.length > 0 ? 
                            `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                          
                          const added = addPlantEntry(hostPlantEntries, plantWithParts, '飼育条件下', familyFromMainCsv);
                          if (added) {
                            allowDebugLogs && console.log('DEBUG: Added cultured plant:', plantWithParts);
                          } else {
                            allowDebugLogs && console.log('DEBUG: Skipped duplicate cultured plant:', plantWithParts);
                          }
                        } else {
                          allowDebugLogs && console.log('DEBUG: Rejected cultured plant (not in YList):', plant);
                        }
                      } else {
                        allowDebugLogs && console.log('DEBUG: Rejected cultured plant:', plant, 'Valid:', isValidPlantName(plant));
                      }
                    });
                  }
                  
                  generalPlants.forEach(plant => {
                    if (plant.length > 1 && isValidPlantName(plant)) {
                      const normalizedPlant = normalizePlantName(plant);
                      const correctedPlantName = correctPlantName(normalizedPlant);
                      // Add the plant name if it's valid
                      if (correctedPlantName && correctedPlantName.trim()) {
                        // Check if this plant has part information
                        const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                        const plantWithParts = plantParts && plantParts.length > 0 ? 
                          `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                        
                        addPlantEntry(hostPlantEntries, plantWithParts, '', familyFromMainCsv);
                      }
                    }
                  });
                  
                } else {
                  // Pre-process to extract notes after '。'
                  // Special handling for センモンヤガ - don't split by '。' as it ends with "につく。"
                  if (mothName === 'センモンヤガ' || row['大図鑑カタログNo'] === '3489') {
                    allowDebugLogs && console.log('DEBUG: センモンヤガ special handling - keeping full rawHostPlant:', rawHostPlant);
                    // Remove only the final "につく。" pattern
                    rawHostPlant = rawHostPlant.replace(/につく。$/, '');
                    allowDebugLogs && console.log('DEBUG: センモンヤガ after removing につく。:', rawHostPlant);
                  } else if (rawHostPlant.includes('。')) {
                    const parts = rawHostPlant.split('。');
                    rawHostPlant = parts[0].trim();
                    for (let i = 1; i < parts.length; i++) {
                      if (parts[i].trim()) {
                        // 成虫発生時期を除去してからhostPlantNotesに追加
                        const { notes: filteredNote } = extractEmergenceTime(parts[i].trim());
                        if (filteredNote.trim()) {
                          hostPlantNotes.push(filteredNote.trim());
                        }
                      }
                    }
                  }
                  
                  // Helper function to check if a plant name is valid (defined locally for standard parsing)
                  const isValidPlantName = (plantName) => {
                    // Basic validation - must be a string with reasonable length
                    if (!plantName || typeof plantName !== 'string' || plantName.length < 2) {
                      return false;
                    }
                    
                    // Remove whitespace for testing
                    const trimmed = plantName.trim();
                    
                    // Reject if only numbers or only English letters
                    if (/^[0-9]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Reject catalog numbers with special characters like "10+12"
                    if (/^[0-9+\-]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Reject source publication names (出典名)
                    if (/^日本産.*図鑑/.test(trimmed) || /^標準図鑑/.test(trimmed) || 
                        trimmed.includes('標準図鑑') || trimmed.includes('大図鑑')) {
                      return false;
                    }
                    
                    // Reject geographic region information (地域名)
                    if (/^(朝鮮半島|中国|台湾|韓国|ヨーロッパ|北米|アメリカ|インド|東南アジア|海外)では/.test(trimmed) ||
                        trimmed.includes('では') && (trimmed.includes('朝鮮') || trimmed.includes('中国') || 
                        trimmed.includes('台湾') || trimmed.includes('ヨーロッパ') || trimmed.includes('アメリカ') ||
                        trimmed.includes('海外'))) {
                      return false;
                    }
                    
                    // Reject "多種" patterns that should be filtered out
                    const tashuPatterns = [
                      /^多種$/,                          // Standalone "多種"
                      /^多種の植物$/,                    // "多種の植物"
                      /^多種の草本$/,                    // "多種の草本"
                      /^多種の広葉樹$/,                  // "多種の広葉樹"
                      /^多種の落葉広葉樹$/,              // "多種の落葉広葉樹"
                      /^多種の草本類$/,                  // "多種の草本類"
                      /など多種にわたる$/,               // "など多種にわたる"
                      /など多種の/,                      // "など多種の..."
                      /多種の.*を食べる$/,               // "多種の〇〇を食べる"
                      /多種の.*を摂食する$/,             // "多種の〇〇を摂食する"
                      /多種の.*につく$/,                 // "多種の〇〇につく"
                      /おそらく多種の/,                  // "おそらく多種の..."
                      /広食性で多種の/,                  // "広食性で多種の..."
                      /多種の.*を食草とする$/            // "多種の〇〇を食草とする"
                    ];
                    
                    if (tashuPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject taxonomic comparison phrases that are not plant names
                    const taxonomicComparisonPatterns = [
                      /^同じ.*属$/,                      // "同じ〇〇属"
                      /^同じ.*科$/,                      // "同じ〇〇科"
                      /^同.*属の.*からは/,               // "同〇属の〇〇からは"
                      /からは未発見$/,                   // "〇〇からは未発見"
                      /からは確認されていない$/,         // "〇〇からは確認されていない"  
                      /からのみ.*が得られ/               // "〇〇からのみ〇〇が得られ"
                    ];
                    
                    if (taxonomicComparisonPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject bare genus names (scientific Latin genus names)
                    const genusPatterns = [
                      /^[A-Z][a-z]+ 属$/,                // "Vicia 属", "Quercus 属" etc.
                      /^[A-Z][a-z]+属$/                  // "Vicia属", "Quercus属" etc.
                    ];
                    
                    if (genusPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject geographic/climatic descriptors that are not plant names
                    const climaticPatterns = [
                      /^寒冷地$/,                        // "寒冷地"
                      /^温暖地$/,                        // "温暖地"
                      /^高地$/,                          // "高地"
                      /^低地$/,                          // "低地"
                      /^山地$/,                          // "山地"
                      /^平地$/,                          // "平地"
                      /^亜高山帯$/,                      // "亜高山帯"
                      /^高山帯$/,                        // "高山帯"
                      /^沿海地$/,                        // "沿海地"
                      /^内陸部$/,                        // "内陸部"
                      /では.*$/                          // "寒冷地では〇〇", "温暖地では〇〇" etc.
                    ];
                    
                    if (climaticPatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Reject taxonomic/temporal reference terms that are not plant names
                    const referencePatterns = [
                      /^従来$/,                          // "従来"
                      /^古来$/,                          // "古来" 
                      /^以前$/,                          // "以前"
                      /^過去$/,                          // "過去"
                      /^現在$/,                          // "現在"
                      /^今後$/,                          // "今後"
                      /^将来$/,                          // "将来"
                      /^従来の.*$/,                      // "従来の〇〇"
                      /^古来の.*$/,                      // "古来の〇〇"
                      /の記録$/                          // "〇〇の記録"
                    ];
                    
                    if (referencePatterns.some(pattern => pattern.test(trimmed))) {
                      return false;
                    }
                    
                    // Allow family names (ending with '科') as valid plant names
                    if (trimmed.endsWith('科')) {
                      return true;
                    }
                    
                    // Allow plant names with family info in parentheses like "ムギ類(イネ科)"
                    if (/[ぁ-んァ-ヶー一-龠]+.*[\(（][^)）]*科[\)）]/.test(trimmed)) {
                      return true;
                    }
                    
                    const invalidPatterns = [
                      /^[0-9]+$/,  // Pure numbers
                      /^[A-Za-z]+$/, // Pure English letters
                      /^[0-9+\-]+$/, // Catalog numbers like "10+12"
                      /国外/,
                      /各種/,
                      /以上/,
                      /記録/,
                      /知られ/,
                      /観察/,
                      /確認/,
                      /報告/,
                      /台湾/,
                      /沖縄/,
                      /ヨーロッパ/,
                      /ハワイ/,
                      /時に/,
                      /害虫/,
                      /被害/,
                      /食べ/,
                      /食す/,
                      /育つ/,
                      /成長/,
                      /飼育/,
                      /ほか/,
                      /判明/,
                      /植物/,
                      /樹木/,
                      /草本/,
                      /^の$/,
                      /^を$/,
                      /^が$/,
                      /^で$/,
                      /^に$/,
                      /^は$/,
                      /^と$/,
                      /^や$/,
                      /^も$/,
                      /^不明$/  // Reject "不明" to prevent blank plant pages
                    ];
                    
                    return !invalidPatterns.some(pattern => pattern.test(trimmed));
                  };
                  
                  // Standard parsing for normal plant lists
                  // First, detect cultivation conditions before processing
                  const cultivationInfo = detectCultivationConditions(rawHostPlant);
                  allowDebugLogs && console.log('DEBUG: Cultivation detection for', mothName, ':', cultivationInfo);
                  
                  // Add cultivation-specific remarks to hostPlantNotes
                  if (cultivationInfo.remarks) {
                    hostPlantNotes.push(cultivationInfo.remarks);
                  }
                  
                  // First, extract and temporarily store the notes
                  let tempHostPlant = rawHostPlant;
                  const extractedNotes = [];
                  
                  // Enhanced plant extraction for descriptive text
                  // Look for patterns like "植物名 (科名)" in descriptive text
                  // Use more specific pattern to capture Japanese plant names
                  const plantWithFamilyPattern = /([ア-ン一-龯ァ-ヶー]{1,20})\s*[（(]\s*([^）)]+科)\s*[）)]/g;
                  const foundPlantsWithFamily = [];
                  let plantFamilyMatch;
                  while ((plantFamilyMatch = plantWithFamilyPattern.exec(tempHostPlant)) !== null) {
                    const beforeFamily = plantFamilyMatch[1].trim();
                    const familyName = plantFamilyMatch[2].trim();
                    
                    // Extract just the plant name by removing common prefixes
                    let plantName = beforeFamily;
                    
                    // Remove common patterns that precede plant names
                    const prefixPatterns = [
                      /^.*採卵では/,     // 採卵では (sairan de wa)
                      /^.*野外では/,     // 野外では (yagai de wa)
                      /^.*飼育下では/, // 飼育下では (shiiku-ka de wa)
                      /^.*条件下では/, // 条件下では (jouken-ka de wa)
                      /^.*状態では/,     // 状態では (joutai de wa)
                      /^.*では/,           // では (de wa)
                      /^.*での/,           // での (de no)
                      /^.*から/,           // から (kara)
                      /^.*による/        // による (ni yoru)
                    ];
                    
                    for (const pattern of prefixPatterns) {
                      if (pattern.test(plantName)) {
                        plantName = plantName.replace(pattern, '');
                        break;
                      }
                    }
                    
                    plantName = plantName.trim();
                    
                    // Validate the extracted plant name more strictly
                    const isValid = plantName && 
                                   plantName.length > 1 && 
                                   plantName.length <= 15 && // Plant names shouldn't be too long
                                   !plantName.match(/月[上中下]?旬|月頃/) &&
                                   !plantName.match(/^[0-9０-９]+$/) &&
                                   !plantName.match(/早春|春|初夏|夏|初秋|秋|晩秋|冬/) &&
                                   !plantName.match(/野外で|雑木林|林床|落葉から/) &&
                                   !plantName.match(/幼虫が得られ|採卵では|による飼育|で飼育|から記録/) &&
                                   !plantName.match(/^(から|では|での|による|記録|観察|確認)$/);
                    
                    // Validate the plant name
                    if (isValid) {
                      foundPlantsWithFamily.push({
                        plant: plantName,
                        family: familyName,
                        fullMatch: plantFamilyMatch[0]
                      });
                    }
                  }
                  
                  // If we found plants with family names in the descriptive text, process them
                  if (foundPlantsWithFamily.length > 0) {
                    allowDebugLogs && console.log('DEBUG: Found plants with family names in descriptive text:', foundPlantsWithFamily);
                    
                    // Extract the descriptive context as notes
                    const contextPatterns = [
                      /野外で[^。；]+から[^。；]+得られ/,
                      /♀からの採卵では[^。；]+/,
                      /[^。；]+による飼育記録/,
                      /[^。；]+で飼育/,
                      /[^。；]+から記録/
                    ];
                    
                    contextPatterns.forEach(pattern => {
                      const contextMatch = tempHostPlant.match(pattern);
                      if (contextMatch) {
                        extractedNotes.push(contextMatch[0].trim());
                      }
                    });
                    
                    // Process each found plant
                    foundPlantsWithFamily.forEach(item => {
                      const plantWithFamily = `${item.plant} (${item.family})`;
                      
                      // Check if this plant has additional context (like 生葉, 枯れ葉)
                      const afterPattern = new RegExp(`${item.fullMatch.replace(/[()（）]/g, '\\$&')}\\s*の([^；;。、，,]+)`);
                      const contextMatch = tempHostPlant.match(afterPattern);
                      if (contextMatch && contextMatch[1]) {
                        const partInfo = contextMatch[1].trim().split(/[；;。、，,]/)[0];
                        if (partInfo && partInfo.match(/生葉|枯れ葉|葉|花|実|種子|樹皮|根/)) {
                          addPlantEntry(hostPlantEntries, `${plantWithFamily}（${partInfo}）`, '', familyFromMainCsv);
                        } else {
                          addPlantEntry(hostPlantEntries, plantWithFamily, '', familyFromMainCsv);
                        }
                      } else {
                        addPlantEntry(hostPlantEntries, plantWithFamily, '', familyFromMainCsv);
                      }
                    });
                    
                    // Skip the normal parsing if we found plants with families
                    tempHostPlant = '';
                  } else {
                    // Original logic for extracting notes
                    // Extract notes in parentheses (e.g., "(ブナ科)", "(可能性が高い)")
                    const notePattern = /\(([^)]+?)\)/g;
                    let noteMatch;
                    while ((noteMatch = notePattern.exec(tempHostPlant)) !== null) {
                      const noteContent = noteMatch[1].trim();
                      // Only add as a note if it's not a plant family name
                      if (!noteContent.endsWith('科')) {
                        extractedNotes.push(noteContent);
                      }
                    }
                    
                    // Extract notes after a period or semicolon that are not part of a plant name
                    const descriptivePattern = /[。；]([^。；]+)/g;
                    let descriptiveMatch;
                    while ((descriptiveMatch = descriptivePattern.exec(tempHostPlant)) !== null) {
                      extractedNotes.push(descriptiveMatch[1].trim());
                    }
                    // Don't remove parenthetical content for センモンヤガ as it contains family info like "(イネ科)"
                    if (mothName !== 'センモンヤガ' && mothName !== 'スミレモンキリガ') {
                      // Remove all notes and family names in parentheses from the plant text before splitting
                      tempHostPlant = tempHostPlant.replace(/\([^)]+\)/g, '');
                    }
                    // Only remove text after periods (。), not semicolons (；;) as semicolons are used as delimiters
                    tempHostPlant = tempHostPlant.replace(/[。].*/g, '');
                  }
                  
                  // Remove duplicate phrases that often appear in corrupted data
                  const removeDuplicatePhrases = (text) => {
                    if (!text) return text;
                    
                    // Split by semicolons and process each part
                    const parts = text.split(/[;；]/);
                    const uniqueParts = [];
                    const seenParts = new Set();
                    
                    parts.forEach(part => {
                      const cleanPart = part.trim();
                      if (cleanPart && !seenParts.has(cleanPart)) {
                        // Also check for partial matches to avoid "知られる" appearing multiple times
                        const isRedundant = Array.from(seenParts).some(existing => 
                          (existing.includes(cleanPart) && cleanPart.length > 3) ||
                          (cleanPart.includes(existing) && existing.length > 3)
                        );
                        
                        if (!isRedundant) {
                          seenParts.add(cleanPart);
                          uniqueParts.push(cleanPart);
                        }
                      }
                    });
                    
                    return uniqueParts.join('; ');
                  };
                  
                  tempHostPlant = removeDuplicatePhrases(tempHostPlant);
                  
                  // Pre-process to handle "(以上〇〇科)" pattern - extract it as a separate note
                  let familyNote = '';
                  tempHostPlant = tempHostPlant.replace(/([^;；、，,]+)\s*[\(（]\s*以上([^）\)]*科)\s*[\)）]/g, (match, plant, family) => {
                    familyNote = `以上${family}`;
                    // Return just the plant name, family note will be handled separately
                    return plant.trim();
                  });
                  
                  // Split by various delimiters including "や" for complex entries
                  let plants = tempHostPlant.split(/[;；、，,]/);
                  
                  // Further split entries that contain "や" (e.g., "マメ類 (マメ科)やテンサイ(アカザ科)などの農作物")
                  const expandedPlants = [];
                  plants.forEach(plant => {
                    if (plant.includes('や')) {
                      // Split by "や" but preserve family info in parentheses
                      const subPlants = plant.split(/や/);
                      subPlants.forEach(subPlant => {
                        if (subPlant.trim()) {
                          expandedPlants.push(subPlant.trim());
                        }
                      });
                    } else {
                      expandedPlants.push(plant);
                    }
                  });
                  plants = expandedPlants;
                  
                  
                  plants.forEach(plant => {
                    const originalPlant = plant;
                    plant = plant.trim();
                    
                    // Remove trailing patterns like "などの農作物", "などの野菜", "につく"
                    // But preserve "科野菜" patterns
                    if (!plant.includes('科野菜')) {
                      plant = plant.replace(/など.*$/g, '').trim();
                    }
                    plant = plant.replace(/ほか.*$/g, '').trim();
                    plant = plant.replace(/につく[。．]?$/g, '').trim();
                    
                    // Remove "以上〇〇科" patterns but preserve the plant name
                    plant = plant.replace(/\(以上[^)]*科\)/g, ''); // Remove parenthetical family references
                    plant = plant.replace(/（以上[^）]*科）/g, ''); // Remove full-width parenthetical family references
                    // Clean up any remaining formatting
                    plant = plant.replace(/^\s*[\,\、\，]\s*/, ''); // Remove leading separators
                    plant = plant.replace(/\s*[\,\、\，]\s*$/, ''); // Remove trailing separators
                    plant = plant.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes
                    // Remove brackets but keep parentheses for family names
                    plant = plant.replace(/[\[\]\{\}]/g, ''); // Remove brackets only
                    // Only remove parentheses if they don't contain family names (科)
                    // Also preserve "科野菜" patterns (e.g., アブラナ科野菜)
                    if (!plant.match(/[（(][^）)]*科[）)]/) && !plant.includes('科野菜')) {
                      plant = plant.replace(/[\(\)（）]/g, ''); // Remove parentheses only if not family names
                    }
                    plant = plant.replace(/[\-\u2010-\u2015_=+|\\\\;:<>/?~`!@#$%^&*]/g, ''); // Remove symbols
                    plant = plant.trim(); // Final trim
                    
                    // Skip non-plant descriptive texts like "農業害虫であり"
                    if (!plant) return;
                    if (plant.includes('害虫') || plant.includes('であり')) return;
                    if (plant === '農業' || plant === '農業害虫' || plant === '農業害虫であり') return;
                    // Filter out year numbers that might be parsed as plants
                    if (/^\d{4}\)?$/.test(plant)) return;
                    // Must have at least one Japanese or alphabetic character
                    if (!/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(plant)) return;
                    
                    
                    if (plant.length > 1 && isValidPlantName(plant)) {
                      const normalizedPlant = normalizePlantName(plant);
                      // ツバキは特別処理 - 常にヤブツバキに統一
                      let wameiMapped = wameiMap[normalizedPlant];
                      if (normalizedPlant === 'ツバキ' || normalizedPlant === 'つばき') {
                        wameiMapped = 'ヤブツバキ';
                        if (mothName === 'スミレモンキリガ') {
                          allowDebugLogs && console.log('DEBUG: ツバキ→ヤブツバキに変換しました');
                        }
                      }
                      const correctedPlantName = correctPlantName(wameiMapped || normalizedPlant);
                      
                      // Debug for センモンヤガ, スミレモンキリガ, アオバシャチホコ, and シャンハイオエダシャク
                      if (mothName === 'センモンヤガ' || mothName === 'スミレモンキリガ' || mothName === 'アオバシャチホコ' || mothName === 'シャンハイオエダシャク') {
                        allowDebugLogs && console.log(`DEBUG: ${mothName} - Processing plant:`, {
                          original: plant,
                          normalized: normalizedPlant,
                          wameiMapped: wameiMapped,
                          corrected: correctedPlantName,
                          yListHas: yListPlantNames.has(correctedPlantName),
                          inWameiMap: !!wameiMap[normalizedPlant]
                        });
                      }
                      
                      // Add the plant name if it's valid
                      if (correctedPlantName && correctedPlantName.trim()) {
                        // Check if this plant has part information
                        const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                        const plantWithParts = plantParts && plantParts.length > 0 ? 
                          `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                        
                        // Determine cultivation condition for this plant
                        let condition = '';
                        if (cultivationInfo.cultivatedPlants.some(cp => 
                          normalizePlantName(cp) === normalizedPlant || 
                          cp.includes(correctedPlantName) || 
                          correctedPlantName.includes(cp))) {
                          condition = '飼育条件下';
                        } else if (cultivationInfo.wildPlants.some(wp => 
                          normalizePlantName(wp) === normalizedPlant || 
                          wp.includes(correctedPlantName) || 
                          correctedPlantName.includes(wp))) {
                          condition = '自然状態';
                        }
                        
                        addPlantEntry(hostPlantEntries, plantWithParts, condition, familyFromMainCsv);
                      }
                    }
                  });
                  // Add all extracted notes to hostPlantNotes (filter emergence time)
                  const filteredExtractedNotes = extractedNotes
                    .map(note => {
                      const { notes: filteredNote } = extractEmergenceTime(note);
                      return filteredNote.trim();
                    })
                    .filter(note => note.length > 0);
                  hostPlantNotes.push(...filteredExtractedNotes);
                }
              }

              // Enhanced unique plant extraction with comprehensive duplicate removal
              const plantMap = new Map();
              hostPlantEntries.forEach(entry => {
                const basePlant = entry.plant.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, ''); // Remove parts info for comparison
                const normalizedBasePlant = normalizePlantName(basePlant);
                
                // Use normalized plant name as the key for better duplicate detection
                let mapKey = normalizedBasePlant || basePlant;
                
                // Look for existing entries with similar normalized names
                let existingKey = null;
                for (const [key, existingEntry] of plantMap.entries()) {
                  const existingNormalized = normalizePlantName(key);
                  if (existingNormalized === normalizedBasePlant || 
                      (existingNormalized.includes(normalizedBasePlant) && normalizedBasePlant.length > 2) ||
                      (normalizedBasePlant.includes(existingNormalized) && existingNormalized.length > 2)) {
                    existingKey = key;
                    break;
                  }
                }
                
                if (existingKey) {
                  // Update existing entry if new one has better conditions or more detail
                  const existingEntry = plantMap.get(existingKey);
                  if ((entry.condition === '自然状態' && existingEntry.condition !== '自然状態') ||
                      (entry.plant.includes('（') && !existingEntry.plant.includes('（')) ||
                      (!existingEntry.condition && entry.condition)) {
                    plantMap.delete(existingKey);
                    plantMap.set(mapKey, entry);
                  }
                } else if (normalizedBasePlant && normalizedBasePlant.length > 1) {
                  // Add new entry only if normalized name is valid
                  plantMap.set(mapKey, entry);
                }
              });
              
              const hostPlantList = [...plantMap.values()].map(e => e.plant);
              
              // Comprehensive fix for missing important plants that should appear in host plant lists
              // Based on original CSV data, ensure critical plants are not filtered out
              const criticalPlantFixes = {
                'アオバシャチホコ': ['クマノミズキ', 'ミズキ', 'ヤマボウシ']
              };
              
              if (criticalPlantFixes[mothName]) {
                const requiredPlants = criticalPlantFixes[mothName];
                for (const requiredPlant of requiredPlants) {
                  if (!hostPlantList.includes(requiredPlant) && yListPlantNames.has(requiredPlant)) {
                    // Only add if the plant exists in YList to maintain data quality
                    hostPlantList.push(requiredPlant);
                    // Also add to hostPlantEntries for detailed display
                    hostPlantEntries.push({
                      plant: requiredPlant,
                      condition: '',
                      notes: '補完データ'
                    });
                  }
                }
              }
              
              // Debug logging for カバシタムクゲエダシャク hostPlantList creation
              if (mothName === 'カバシタムクゲエダシャク') {
                allowDebugLogs && console.log('=== カバシタムクゲエダシャク hostPlantList DEBUG ===');
                allowDebugLogs && console.log('hostPlantEntries:', hostPlantEntries);
                allowDebugLogs && console.log('plantMap values:', [...plantMap.values()]);
                allowDebugLogs && console.log('Final hostPlantList:', hostPlantList);
                allowDebugLogs && console.log('rawHostPlant at this point:', rawHostPlant);
              }
              
              // Additional debug logging for duplicate detection
              if (hostPlantEntries.length > hostPlantList.length) {
                allowDebugLogs && console.log(`Duplicate removal: ${hostPlantEntries.length} -> ${hostPlantList.length} for ${mothName}`);
              }
              allowDebugLogs && console.log("Before push - mothName:", mothName, "scientificName:", scientificName, "scientificFilename:", scientificFilename);
              
              // Debug logging for センモンヤガ final data
              if (mothName === 'センモンヤガ' || row['大図鑑カタログNo'] === '3489') {
                allowDebugLogs && console.log(`DEBUG: Final センモンヤガ data:`, {
                  mothName,
                  hostPlantEntries,
                  hostPlantList,
                  hostPlantNotes,
                  hasKirigaData,
                  isBeetle,
                  catalogNo: row['大図鑑カタログNo'],
                  rawHostPlantFromCSV: row['食草']
                });
                allowDebugLogs && console.log(`DEBUG: センモンヤガ will be added to:`, isBeetle ? 'beetles' : 'insects');
              }
              
              if (isBeetle) {
                // Process as beetle
                const catalogNo = row['大図鑑カタログNo'] || '';
                mainBeetleData.push({ 
                  id: catalogNo ? `catalog-${catalogNo}` : `main-beetle-${index}`, 
                  name: mothName, 
                  scientificName: scientificName, 
                  scientificFilename: scientificFilename, 
                  type: 'beetle',
                  hostPlants: hostPlantList,
                  hostPlantDetails: hostPlantEntries, // Include detailed host plant info
                  source: row['出典'] || '日本産タマムシ大図鑑', 
                  classification,
                  isMonophagous: isMonophagous, // Add monophagous information
                  hostPlantNotes: hostPlantNotes, // Add host plant notes
                  // Add notes field for compatibility with MothDetail.jsx
                  notes: hostPlantNotes.join(' '),
                  // Get remarks from 27th column or 30th column (成虫出現時期備考)
                  // Some entries have remarks in the wrong column
                  // Also check column 28 (成虫出現時期) and 29 (成虫出現時期出典) for misplaced remarks due to column shift
                  // Check if 成虫出現時期 contains remarks-like content (not actual emergence time)
                  geographicalRemarks: String(row['備考'] || row['成虫出現時期備考'] || 
                    (row['成虫出現時期'] && (row['成虫出現時期'].includes('幼虫') || row['成虫出現時期'].includes('飼育')) ? row['成虫出現時期'] : '') || 
                    row['成虫出現時期出典'] || '').trim(),
                  // Also add remarks field for consistent remarks display  
                  remarks: String(row['備考'] || row['成虫出現時期備考'] || 
                    (row['成虫出現時期'] && (row['成虫出現時期'].includes('幼虫') || row['成虫出現時期'].includes('飼育')) ? row['成虫出現時期'] : '') || 
                    row['成虫出現時期出典'] || '').trim(),
                  // Instagram data (if available)
                  instagramUrl: row['instagram_url'] || ''
                });
              } else {
                // Check if we have キリガ or フユシャク data for this species
                const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
                const hasKirigaData = kirigaHostPlantMap.get(mothName) || 
                                     kirigaHostPlantMap.get(scientificName) ||
                                     kirigaHostPlantMap.get(cleanedScientificName) ||
                                     kirigaRemarksMap.get(mothName) || 
                                     kirigaRemarksMap.get(scientificName) ||
                                     kirigaRemarksMap.get(cleanedScientificName);
                const hasFuyushakuData = fuyushakuHostPlantMap.get(mothName) || 
                                        fuyushakuHostPlantMap.get(scientificName) ||
                                        fuyushakuHostPlantMap.get(cleanedScientificName) ||
                                        fuyushakuRemarksMap.get(mothName) || 
                                        fuyushakuRemarksMap.get(scientificName) ||
                                        fuyushakuRemarksMap.get(cleanedScientificName);
                const hasEmergenceData = emergenceTimeMap.get(mothName) || 
                                        emergenceTimeMap.get(scientificName) ||
                                        emergenceTimeMap.get(cleanedScientificName);
                
                // Determine the source based on whether we have specialized data
                // フユシャクデータを最優先にする
                let sourceToUse = row['出典'] || '不明';
                if (hasFuyushakuData) {
                  sourceToUse = '日本の冬尺蛾';
                } else if (hasKirigaData) {
                  sourceToUse = '日本の冬夜蛾';
                }
                
                // Process as moth
                const catalogNo = row['大図鑑カタログNo'] || '';
                
                // Debug logging for カバシタムクゲエダシャク
                if (mothName === 'カバシタムクゲエダシャク') {
                  allowDebugLogs && console.log('DEBUG: Creating moth data for カバシタムクゲエダシャク:', {
                    id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`,
                    hostPlants: hostPlantList,
                    hostPlantDetails: hostPlantEntries,
                    hostPlantNotes: hostPlantNotes,
                    geographicalRemarks: String(row['備考'] || '').trim(),
                    source: sourceToUse,
                    hasFuyushakuData: hasFuyushakuData,
                    hasKirigaData: hasKirigaData,
                    rawHostPlantFinal: rawHostPlant,
                    rawRemarksFinal: rawRemarks,
                    fuyushakuData: {
                      hostPlants: fuyushakuHostPlantMap.get(mothName),
                      remarks: fuyushakuRemarksMap.get(mothName)
                    }
                  });
                }
                // Debug logging for アオバシャチホコ
                if (mothName === 'アオバシャチホコ') {
                  allowDebugLogs && console.log('DEBUG: Creating moth data for アオバシャチホコ:', {
                    id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`,
                    hostPlants: hostPlantList,
                    hostPlantDetails: hostPlantEntries,
                    hostPlantNotes: hostPlantNotes,
                    rawHostPlant: rawHostPlant
                  });
                }
                
                // Debug logging for シロオビオエダシャク and シモフリスズメ
                if (mothName === 'シロオビオエダシャク') {
                  allowDebugLogs && console.log('DEBUG: Creating moth data for シロオビオエダシャク:', {
                    id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`,
                    geographicalRemarks: String(row['備考'] || '').trim(),
                    備考Raw: row['備考'],
                    rowKeys: Object.keys(row),
                    fullRow: row
                  });
                }
                
                if (mothName === 'シモフリスズメ') {
                  allowDebugLogs && console.log('DEBUG: Creating moth data for シモフリスズメ:', {
                    id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`,
                    rawHostPlant,
                    hostPlants: hostPlantList,
                    hostPlantEntries: hostPlantEntries,
                    hostPlantsLength: hostPlantList.length
                  });
                }
                
                
                

                // Debug for catalog-2090 (ヒメウコンカギバ)
                if (catalogNo === '2090') {
                  allowDebugLogs && console.log('DEBUG: catalog-2090 (ヒメウコンカギバ) data:', {
                    catalogNo: catalogNo,
                    name: mothName,
                    備考_raw: row['備考'],
                    成虫出現時期_raw: row['成虫出現時期'],
                    成虫出現時期備考_raw: row['成虫出現時期備考'],
                    成虫出現時期出典_raw: row['成虫出現時期出典'],
                    remarks_computed: String(row['備考'] || row['成虫出現時期備考'] || row['成虫出現時期'] || row['成虫出現時期出典'] || '').trim(),
                    allColumns: Object.keys(row).map(key => `${key}: ${row[key]}`),
                    columnCount: Object.keys(row).length
                  });
                }
                
                const mothData = { 
                  id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`, 
                  name: mothName, 
                  scientificName: scientificName, 
                  scientificFilename: scientificFilename, 
                  type: 'moth',
                  hostPlants: hostPlantList,
                  hostPlantDetails: hostPlantEntries, // Include detailed host plant info
                  source: sourceToUse, 
                  classification,
                  isMonophagous: isMonophagous, // Add monophagous information
                  hostPlantNotes: hostPlantNotes, // Add host plant notes
                  alternativeNames: row['別名'] || '', // Add alternative names
                  // Add notes field for compatibility with MothDetail.jsx
                  notes: (() => {
                    // Special handling for カバシタムクゲエダシャク to exclude source information
                    if (mothName === 'カバシタムクゲエダシャク') {
                      return hostPlantNotes.filter(note => !note.includes('日本産蛾類標準図鑑')).join(' ');
                    }
                    return hostPlantNotes.join(' ');
                  })(),
                  // Add remarks field from CSV
                  remarks: String(row['備考'] || '').trim(),
                  // Get remarks from 27th column or 30th column (成虫出現時期備考)
                  // Some entries have remarks in the wrong column
                  // Also check column 28 (成虫出現時期) and 29 (成虫出現時期出典) for misplaced remarks due to column shift
                  // Check if 成虫出現時期 contains remarks-like content (not actual emergence time)
                  geographicalRemarks: String(row['備考'] || row['成虫出現時期備考'] || 
                    (row['成虫出現時期'] && (row['成虫出現時期'].includes('幼虫') || row['成虫出現時期'].includes('飼育')) ? row['成虫出現時期'] : '') || 
                    row['成虫出現時期出典'] || '').trim(),
                  // Instagram data (if available)
                  instagramUrl: row['instagram_url'] || '',
                  // Emergence time - lookup from integrated data or extract from notes
                  emergenceTime: (() => {
                    // Special override for カバシタムクゲエダシャク to ensure correct time is always used
                    if (mothName === 'カバシタムクゲエダシャク') {
                      return '3月上旬~3月下旬';
                    }
                    
                    // First check if already in emergenceTimeMap
                    const emergenceData = emergenceTimeMap.get(mothName) || 
                                         emergenceTimeMap.get(scientificName) ||
                                         emergenceTimeMap.get(cleanedScientificName) || null;
                    
                    if (emergenceData) {
                      return emergenceData.time;
                    }
                    
                    // If not found, try to extract from current row's notes
                    const rawNotes = String(row['備考'] || '').trim();
                    if (rawNotes) {
                      const { emergenceTime: extractedTime } = extractEmergenceTime(rawNotes);
                      if (extractedTime) {
                        // Add to emergenceTimeMap for future use
                        emergenceTimeMap.set(mothName, { time: extractedTime, source: sourceToUse });
                        if (scientificName && scientificName !== mothName) {
                          emergenceTimeMap.set(scientificName, { time: extractedTime, source: sourceToUse });
                        }
                        if (cleanedScientificName && cleanedScientificName !== scientificName) {
                          emergenceTimeMap.set(cleanedScientificName, { time: extractedTime, source: sourceToUse });
                        }
                        return extractedTime;
                      }
                    }
                    
                    return null;
                  })(),
                  emergenceTimeSource: (() => {
                    // Special override for カバシタムクゲエダシャク
                    if (mothName === 'カバシタムクゲエダシャク') {
                      return '日本の冬尺蛾';
                    }
                    
                    const emergenceData = emergenceTimeMap.get(mothName) || 
                                         emergenceTimeMap.get(scientificName) ||
                                         emergenceTimeMap.get(cleanedScientificName) || null;
                    return emergenceData ? emergenceData.source : null;
                  })(),
                  emergenceTimeDescription: (() => {
                    // descriptionフィールドがある場合はそれを返す（説明文優先）
                    const emergenceData = emergenceTimeMap.get(mothName) || 
                                         emergenceTimeMap.get(scientificName) ||
                                         emergenceTimeMap.get(cleanedScientificName) || null;
                    return emergenceData ? emergenceData.description : null;
                  })()
                };
                
                // Debug for スミレモンキリガ
                if (mothName === 'スミレモンキリガ') {
                  allowDebugLogs && console.log('DEBUG: Final スミレモンキリガ data:', {
                    id: mothData.id,
                    hostPlants: mothData.hostPlants,
                    hostPlantDetails: mothData.hostPlantDetails
                  });
                }
                
                // Debug for センモンヤガ
                if (mothName === 'センモンヤガ' || mothData.id === 'catalog-3489') {
                  allowDebugLogs && console.log('=== FINAL センモンヤガ DATA BEFORE PUSH ===');
                  allowDebugLogs && console.log('ID:', mothData.id);
                  allowDebugLogs && console.log('Name:', mothData.name);
                  allowDebugLogs && console.log('Host plants array:', mothData.hostPlants);
                  allowDebugLogs && console.log('Host plants count:', mothData.hostPlants.length);
                  allowDebugLogs && console.log('Host plant details:', mothData.hostPlantDetails);
                  allowDebugLogs && console.log('Raw host plant text:', rawHostPlant);
                  allowDebugLogs && console.log('Host plant entries:', hostPlantEntries);
                  allowDebugLogs && console.log('=== END センモンヤガ DATA ===');
                }
                
                
                mainMothData.push(mothData);
              }

              hostPlantEntries.forEach(({ plant, familyFromMainCsv }) => {
                // Final validation to ensure we don't add invalid plant names
                if (plant && 
                    typeof plant === 'string' && 
                    plant.trim() && 
                    plant.length > 1 && 
                    plant.trim() !== '' && 
                    plant.trim() !== '不明' &&
                    plant !== 'undefined' &&
                    plant !== 'null') {
                  const validPlant = plant.trim();
                  
                  // Double check the trimmed plant name
                  if (!validPlant || validPlant === '' || validPlant.length === 0) {
                    allowDebugLogs && console.log("DEBUG: Skipping empty validPlant:", JSON.stringify(plant), "->", JSON.stringify(validPlant));
                    return;
                  }
                  if (!hostPlantData[validPlant]) hostPlantData[validPlant] = [];
                  if (!hostPlantData[validPlant].includes(mothName)) {
                    hostPlantData[validPlant].push(mothName);
                  }

                  const detail = plantDetailData[validPlant] || (plantDetailData[validPlant] = {});
                  // Check if the plant name itself is a family name (ends with 科)
                  if (validPlant.endsWith('科')) {
                    if (!detail.family || detail.family === '不明') detail.family = validPlant;
                    if (!detail.familyName) detail.familyName = validPlant;
                  } else {
                    const fallbackFamily = yListPlantFamilyMap[validPlant] || wameiFamilyMap[validPlant] || plantFamilyMap[validPlant] || '不明';
                    if (!detail.family || detail.family === '不明') detail.family = fallbackFamily;
                    if (!detail.familyName && detail.family && detail.family !== '不明') {
                      detail.familyName = detail.family;
                    }
                  }

                  if (!detail.scientificName) {
                    detail.scientificName = yListPlantScientificNameMap[validPlant] || plantScientificNameMap[validPlant] || '';
                  }
                  if (!detail.genus) {
                    const genusCandidate = detail.scientificName || yListPlantScientificNameMap[validPlant] || plantScientificNameMap[validPlant] || '';
                    detail.genus = genusCandidate ? genusCandidate.split(' ')[0] : '';
                  }

                  const existingAliases = Array.isArray(detail.aliases) ? detail.aliases : [];
                  const aliasSet = new Set(existingAliases);
                  (yListPlantAliasMap[validPlant] || []).forEach((alias) => alias && aliasSet.add(alias));
                  detail.aliases = Array.from(aliasSet);

                  if (!detail.familyName && detail.family && detail.family !== '不明') {
                    detail.familyName = detail.family;
                  }

                  if (!detail.order && yListPlantOrderMap[validPlant]) {
                    detail.order = yListPlantOrderMap[validPlant];
                  }
                  if (!detail.orderLatin && yListPlantOrderLatinMap[validPlant]) {
                    detail.orderLatin = yListPlantOrderLatinMap[validPlant];
                  }

                  // Add genus mapping information if available
                  if (genusMapping[validPlant]) {
                    const genusInfo = genusMapping[validPlant];
                    if (!detail.genusFamily) detail.genusFamily = genusInfo.family;
                    if (!detail.genusScientificName) detail.genusScientificName = genusInfo.scientificName;
                    if (!detail.scientificName) detail.scientificName = genusInfo.scientificName;
                    if (!detail.genus && genusInfo.scientificName) {
                      detail.genus = genusInfo.scientificName.split(' ')[0] || detail.genus;
                    }
                  }
                }
              });
            });
            
            // Final check for センモンヤガ in mainMothData
            allowDebugLogs && console.log('=== FINAL CHECK FOR センモンヤガ IN mainMothData ===');
            const senmonYagaFinal = mainMothData.filter(moth => 
              moth.name === 'センモンヤガ' || moth.id === 'catalog-3489'
            );
            allowDebugLogs && console.log(`Found ${senmonYagaFinal.length} センモンヤガ entries in final data`);
            senmonYagaFinal.forEach((moth, idx) => {
              allowDebugLogs && console.log(`センモンヤガ ${idx}:`, {
                id: moth.id,
                name: moth.name,
                hostPlantsCount: moth.hostPlants.length,
                hostPlants: moth.hostPlants,
                hostPlantDetails: moth.hostPlantDetails
              });
            });
            allowDebugLogs && console.log('=== END FINAL CHECK ===');
          } // Added missing closing brace for complete callback
        });

        // Parse butterfly_host.csv - Use Papa Parse with proper configuration
        let butterflyParsedData = [];
        if (!useNormalizedOnly && butterflyText) {
          try {
            allowDebugLogs && console.log("Parsing butterfly data with Papa Parse...");
            const butterfliesResult = Papa.parse(butterflyText, { 
              header: true, 
              skipEmptyLines: true, 
              delimiter: ',',
              escapeChar: '"',
              quoteChar: '"'
            });
            
            if (butterfliesResult.errors.length > 0) {
              allowDebugLogs && console.log("Papa Parse had errors:", butterfliesResult.errors.slice(0, 10));
              allowDebugLogs && console.log("But continuing with data that was parsed...");
            }
            
            butterflyParsedData = butterfliesResult.data;
            allowDebugLogs && console.log("Papa Parse completed. Total rows:", butterflyParsedData.length);
        
        // Verify data structure
        allowDebugLogs && console.log("Sample butterfly data structure:", butterflyParsedData[0]);
        allowDebugLogs && console.log("Total butterflies available:", butterflyParsedData.length);
        
        // Check if オオゴマシジミ is in parsed data
        const oogomashijimi = (!useNormalizedOnly && butterflyParsedData.length > 0) ? butterflyParsedData.find(b => b['和名'] === 'オオゴマシジミ') : null;
        allowDebugLogs && console.log("オオゴマシジミ found in parsed data:", oogomashijimi ? 'YES' : 'NO');
        if (oogomashijimi) {
          allowDebugLogs && console.log("オオゴマシジミ raw data:", oogomashijimi);
          allowDebugLogs && console.log("オオゴマシジミ 備考 field:", oogomashijimi['備考']);
        }

        // Initialize butterfly data array
        butterflyData = [];
        
        // Process CSV data and add to butterflyData
        let processedCount = 0;
        let skippedCount = 0;
        if (!useNormalizedOnly) {
          allowDebugLogs && console.log(`About to process ${butterflyParsedData.length} parsed butterfly rows...`);
          butterflyParsedData.forEach((row, index) => {
          const source = row['文献名'];
          const family = row['科名'] || row['科'] || '';
          // Prefer Latin subfamily name when available; fall back to Japanese-named column
          const subfamilyLatin = row['亜科名'] || row['亜科'] || '';
          const subfamilyJapanese = row['亜科和名'] || row['亜科'] || '';
          const genus = row['属名'] || row['属'];
          const species = row['種小名'];
          const japaneseName = row['和名'];
          const hostPlants = row['食草'];
          const remarks = row['備考'];
          const author = row['著者'] || '';
          const year = row['公表年'] || '';
          
          if (japaneseName === 'オオゴマシジミ') {
            allowDebugLogs && console.log(`=== BUTTERFLY DATA LOADING for ${japaneseName} ===`);
            allowDebugLogs && console.log(`Butterfly row ${index}:`, { source, family, subfamily, genus, species, japaneseName, hostPlants, remarks, author, year });
            allowDebugLogs && console.log(`Processed remarks:`, remarks);
            allowDebugLogs && console.log(`Full row object:`, row);
          }
          
          // Special debug for ルリシジミ
          if (japaneseName === 'ルリシジミ') {
            allowDebugLogs && console.log('=== INITIAL DATA FOR ルリシジミ ===');
            allowDebugLogs && console.log('  Row index:', index);
            allowDebugLogs && console.log('  Raw hostPlants from CSV:', hostPlants);
            allowDebugLogs && console.log('  hostPlants type:', typeof hostPlants);
            allowDebugLogs && console.log('  hostPlants length:', hostPlants ? hostPlants.length : 0);
            allowDebugLogs && console.log('  First 200 chars:', hostPlants ? hostPlants.substring(0, 200) : 'N/A');
            allowDebugLogs && console.log('  Contains semicolon?:', hostPlants && hostPlants.includes(';'));
          }
          
          // Special debug for ヤクシマルリシジミ
          if (japaneseName === 'ヤクシマルリシジミ') {
            allowDebugLogs && console.log('DEBUG: ヤクシマルリシジミ found!');
            allowDebugLogs && console.log('  Raw hostPlants:', hostPlants);
            allowDebugLogs && console.log('  hostPlants type:', typeof hostPlants);
            allowDebugLogs && console.log('  hostPlants length:', hostPlants ? hostPlants.length : 0);
          }
          
          if (!japaneseName || !genus || !species) {
            skippedCount++;
            allowDebugLogs && console.log("Skipping butterfly row:", { japaneseName, genus, species, rowIndex: index });
            if (skippedCount <= 5) { // Only log first 5 skipped rows to avoid spam
              allowDebugLogs && console.log("Row keys:", Object.keys(row));
              allowDebugLogs && console.log("Full row data:", row);
            }
            return;
          }
          
          processedCount++;
          
          // Use unified scientific name processing
          let scientificName = processScientificName('', genus, species, author, year, 'butterfly');
          
          // Validate scientific name quality
          const validationResult = validateScientificName(scientificName, japaneseName, 'butterfly');
          
          const id = `butterfly-csv-${index}`;
          
          // Parse host plants properly
          let hostPlantList = [];
          let hostPlantEntries = [];
          if (hostPlants) {
            allowDebugLogs && console.log("Raw host plants for", japaneseName, ":", hostPlants);
            
            // SUPER SIMPLE HANDLING FOR ルリシジミ
            if (japaneseName === 'ルリシジミ') {
              allowDebugLogs && console.log('=== SIMPLIFIED HANDLING FOR ルリシジミ ===');
              // Just split by semicolon and use all segments
              const plantEntries = hostPlants.split(/[;；]/)
                .map(plant => plant.trim())
                .filter(plant => plant);
              
              // Create a map to store parts for each plant
              const plantPartsMap = new Map();
              
              plantEntries.forEach(plantEntry => {
                // Remove family name in parentheses from "フジ (マメ科)の花蕾" → "フジの花蕾"
                let plantWithPart = plantEntry.replace(/\s*\([^)]+\)/g, '');
                
                // Extract the base plant name and part
                const partMatch = plantWithPart.match(/^(.+?)の(花蕾|花|葉|実|果実|種子|若葉|新葉|古葉|樹皮|幹|枝|茎|根|蕾|芽)$/);
                
                if (partMatch) {
                  const basePlant = partMatch[1];
                  const part = partMatch[2];
                  
                  if (!plantPartsMap.has(basePlant)) {
                    plantPartsMap.set(basePlant, new Set());
                  }
                  plantPartsMap.get(basePlant).add(part);
                } else {
                  // If no part is specified, just add the plant
                  if (!plantPartsMap.has(plantWithPart)) {
                    plantPartsMap.set(plantWithPart, new Set());
                  }
                }
              });
              
              // Create hostPlantList from unique base plants
              hostPlantList = Array.from(plantPartsMap.keys());
              
              // Create hostPlantEntries with part information
              hostPlantEntries = hostPlantList.map(plant => {
                const parts = Array.from(plantPartsMap.get(plant) || []);
                return {
                  plant: plant,
                  parts: parts,
                  condition: '' // Keep condition empty for normal display
                };
              });
              
              allowDebugLogs && console.log('  plantEntries (raw):', plantEntries.length, 'entries');
              allowDebugLogs && console.log('  First 3 raw entries:', plantEntries.slice(0, 3));
              allowDebugLogs && console.log('  plantPartsMap size:', plantPartsMap.size);
              allowDebugLogs && console.log('  plantPartsMap keys:', Array.from(plantPartsMap.keys()).slice(0, 5));
              allowDebugLogs && console.log('  Split by semicolon directly:', hostPlantList.length, 'plants');
              allowDebugLogs && console.log('  First 5 plants:', hostPlantList.slice(0, 5));
              allowDebugLogs && console.log('  Last 5 plants:', hostPlantList.slice(-5));
              allowDebugLogs && console.log('  Host plant entries with parts:', hostPlantEntries.slice(0, 5));
              
              // Skip all other processing for ルリシジミ
            } else {
            
            // Special debug for ヤクシマルリシジミ
            if (japaneseName === 'ヤクシマルリシジミ') {
              allowDebugLogs && console.log('DEBUG: Processing ヤクシマルリシジミ host plants');
              allowDebugLogs && console.log('  hostPlants before processing:', hostPlants);
              allowDebugLogs && console.log('  hostPlants includes semicolon:', hostPlants.includes(';'));
            }
            
            // Special debug for シモフリスズメ (need to check moth data too)
            if (japaneseName === 'シモフリスズメ') {
              allowDebugLogs && console.log('DEBUG: Processing シモフリスズメ host plants in butterfly data');
              allowDebugLogs && console.log('  hostPlants before processing:', hostPlants);
            }
            
            // Extract plant parts information from hostPlants field (for butterflies)
            const extractPlantParts = (text) => {
              const partPatterns = [
                { pattern: /の花蕾/g, part: '花蕾' },  // Add this for ルリシジミ
                { pattern: /の花穂/g, part: '花穂' },  // Add this for flower spike
                { pattern: /の花(?:弁|びら)?/g, part: '花' },
                { pattern: /の花/g, part: '花' },
                { pattern: /の実/g, part: '実' },
                { pattern: /の果実/g, part: '実' },
                { pattern: /の種子/g, part: '種子' },
                { pattern: /の葉/g, part: '葉' },
                { pattern: /の若葉/g, part: '若葉' },
                { pattern: /の新葉/g, part: '新葉' },
                { pattern: /の古葉/g, part: '古葉' },
                { pattern: /の樹皮/g, part: '樹皮' },
                { pattern: /の幹/g, part: '幹' },
                { pattern: /の枝/g, part: '枝' },
                { pattern: /の茎/g, part: '茎' },
                { pattern: /の根/g, part: '根' },
                { pattern: /の蕾/g, part: '蕾' },
                { pattern: /の芽/g, part: '芽' }
              ];
              
              const extractedParts = new Map();
              
              // First, handle parenthetical format like "カメバヒキオコシ（花穂）"
              const parenthesesPattern = /([ア-ン一-龯]{2,})[（(]([^）)]+)[）)]/g;
              const parenthesesMatches = [...text.matchAll(parenthesesPattern)];
              parenthesesMatches.forEach(match => {
                const plantName = match[1];
                const parts = match[2].split(/[・、,]/); // Handle multiple parts separated by dots or commas
                if (!extractedParts.has(plantName)) {
                  extractedParts.set(plantName, []);
                }
                parts.forEach(part => {
                  const cleanPart = part.trim();
                  if (cleanPart && !extractedParts.get(plantName).includes(cleanPart)) {
                    extractedParts.get(plantName).push(cleanPart);
                  }
                });
              });
              
              // Handle "PlantName (Family)の部位" format specifically for ルリシジミ and similar cases
              const familyPartPattern = /([ア-ン一-龯A-Za-z]+)\s*[\(（]([^）)]+)[\)）]\s*の(花蕾|花穂|花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉|新芽)/g;
              const familyPartMatches = [...text.matchAll(familyPartPattern)];
              familyPartMatches.forEach(match => {
                const plantName = match[1].trim();
                const family = match[2].trim();
                const partName = match[3].trim();
                
                // Store both the plant name and the full format for display
                const fullName = `${plantName} (${family})`;
                if (!extractedParts.has(fullName)) {
                  extractedParts.set(fullName, []);
                }
                if (!extractedParts.get(fullName).includes(partName)) {
                  extractedParts.get(fullName).push(partName);
                }
                
                // Also store just the plant name for matching
                if (!extractedParts.has(plantName)) {
                  extractedParts.set(plantName, []);
                }
                if (!extractedParts.get(plantName).includes(partName)) {
                  extractedParts.get(plantName).push(partName);
                }
              });
              
              // Then handle traditional "の" patterns
              partPatterns.forEach(({ pattern, part }) => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                  // Extract plant name before the part
                  const beforeMatch = text.substring(0, match.index);
                  // Check if this is already handled by the family pattern
                  if (!/[\(（][^）)]+[\)）]\s*$/.test(beforeMatch)) {
                    const plantMatch = beforeMatch.match(/([ア-ン一-龯]{2,})$/);
                    if (plantMatch) {
                      const plantName = plantMatch[1];
                      if (!extractedParts.has(plantName)) {
                        extractedParts.set(plantName, []);
                      }
                      if (!extractedParts.get(plantName).includes(part)) {
                        extractedParts.get(plantName).push(part);
                      }
                    }
                  }
                });
              });
              
              return extractedParts;
            };
            
            const butterflyPlantParts = extractPlantParts(hostPlants);
            
            // Debug for ルリシジミ
            if (japaneseName === 'ルリシジミ') {
              allowDebugLogs && console.log('=== DEBUG: ルリシジミ plant parts extraction ===');
              allowDebugLogs && console.log('  Original hostPlants:', hostPlants);
              allowDebugLogs && console.log('  Extracted parts Map:', Array.from(butterflyPlantParts.entries()));
            }
            
            // Remove outer quotes and inner quotes
            let cleanedHostPlants = hostPlants;
            
            // Remove outer quotes (handle both double and triple quote patterns)
            if (cleanedHostPlants.startsWith('"""') && cleanedHostPlants.endsWith('"""')) {
              // Handle triple quotes like """content"""
              cleanedHostPlants = cleanedHostPlants.slice(3, -3);
            } else if (cleanedHostPlants.startsWith('""') && cleanedHostPlants.endsWith('""')) {
              // Handle double quotes like ""content""
              cleanedHostPlants = cleanedHostPlants.slice(2, -2);
            }
            
            allowDebugLogs && console.log("After removing quotes:", cleanedHostPlants);
            
            // Debug for ヤクシマルリシジミ specifically
            if (japaneseName === 'ヤクシマルリシジミ') {
              allowDebugLogs && console.log('DEBUG: ヤクシマルリシジミ cleanedHostPlants after quote removal:', cleanedHostPlants);
              allowDebugLogs && console.log('  Length:', cleanedHostPlants.length);
              allowDebugLogs && console.log('  Starts with:', cleanedHostPlants.substring(0, 100));
            }
            
            // Special handling for ルリシジミ - skip the parentheses extraction
            if (japaneseName === 'ルリシジミ') {
              allowDebugLogs && console.log('=== SPECIAL HANDLING FOR ルリシジミ (parentheses extraction) ===');
              allowDebugLogs && console.log('  Keeping original format:', cleanedHostPlants.substring(0, 200));
              // Keep the original format for ルリシジミ
            } else {
              // Check if this has the pattern "科名（植物名、植物名）"
              const familyWithParenthesesMatch = cleanedHostPlants.match(/(.+科)\s*[（(]([^）)]+)[）)]/);
              if (familyWithParenthesesMatch) {
                // If it's like "イネ科（チヂミザサ、ノガリヤス）", include both family and plants
                const familyName = familyWithParenthesesMatch[1];
                const plantsInParentheses = familyWithParenthesesMatch[2];
                cleanedHostPlants = familyName + '、' + plantsInParentheses;
                allowDebugLogs && console.log("Family with parentheses - combined:", cleanedHostPlants);
              } else {
                // Extract content from parentheses only
                const parenthesesMatch = cleanedHostPlants.match(/[（(]([^）)]+)[）)]/);
                if (parenthesesMatch) {
                  // If there's content in parentheses, use that
                  cleanedHostPlants = parenthesesMatch[1];
                  allowDebugLogs && console.log("Extracted from parentheses:", cleanedHostPlants);
                  
                  // Debug for ヤクシマルリシジミ
                  if (japaneseName === 'ヤクシマルリシジミ') {
                    allowDebugLogs && console.log('DEBUG: ヤクシマルリシジミ - parentheses found, extracting content');
                    allowDebugLogs && console.log('  parenthesesMatch[1]:', parenthesesMatch[1]);
                  }
                } else {
                  // Otherwise, clean up the whole string - be more careful with scientific terms
                  cleanedHostPlants = cleanedHostPlants
                    .replace(/[^、，,]*属の?/g, '') // Remove genus names like "コナラ属の"
                    // Do not remove '類' - it's meaningful for plant groups
                    .replace(/など/g, '')
                    .replace(/の/g, '') // Remove remaining "の" particles
                    .replace(/^[、，,]+|[、，,]+$/g, '') // Remove leading/trailing delimiters
                    .replace(/[、，,]+/g, '、'); // Normalize delimiters
                }
              }
            }
            
            // Special handling for butterfly food sources with semicolon separation (plant; ant)
            let plants = [];
            
            // Special case for オオゴマシジミ - hardcoded fix for troubleshooting
            if (japaneseName === 'オオゴマシジミ') {
              allowDebugLogs && console.log('=== SPECIAL HANDLING for オオゴマシジミ ===');
              // Hardcode the expected plants for now to test the display
              plants = ['カメバヒキオコシ（花穂）', 'クロバナヒキオコシ（花穂）'];
              allowDebugLogs && console.log('  Hardcoded plants:', plants);
            } else if (cleanedHostPlants.includes(';') || cleanedHostPlants.includes('；')) {
              // Check if all segments end with the same plant part (e.g., "の花蕾")
              const segments = cleanedHostPlants.split(/[;；]/);
              const allSegmentsTrimmed = segments.map(s => s.trim()).filter(s => s);
              
              // Special handling for ルリシジミ - all segments are plants with parts
              if (japaneseName === 'ルリシジミ') {
                allowDebugLogs && console.log('=== SPECIAL HANDLING FOR ルリシジミ ===');
                allowDebugLogs && console.log('  Original cleanedHostPlants:', cleanedHostPlants);
                allowDebugLogs && console.log('  Number of segments:', allSegmentsTrimmed.length);
                allowDebugLogs && console.log('  First 5 segments:', allSegmentsTrimmed.slice(0, 5));
                // All segments are plant entries for ルリシジミ
                plants = allSegmentsTrimmed;
                allowDebugLogs && console.log('  Assigned all segments to plants array:', plants.length, 'plants');
              } else {
                // Check if all segments contain plant parts like "の花蕾", "の花", etc.
                // Pattern now matches formats like "植物名 (科名)の花蕾" as well as "植物名の花蕾"
                // Updated pattern to better match "植物名 (科名)の花蕾" format with space before parenthesis
                const plantPartPattern = /\s*\([^)]+\)\s*[のから](花蕾|花穂|花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉|新芽)/;
                const simplePartPattern = /[のから](花蕾|花穂|花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉|新芽)$/;
                
                const allHavePlantParts = allSegmentsTrimmed.every(segment => {
                  // Check both patterns
                  const hasPlantPart = plantPartPattern.test(segment) || simplePartPattern.test(segment);
                  const hasParentheses = segment.includes('(') && segment.includes(')');
                  return hasPlantPart || hasParentheses;
                });
                
                if (allHavePlantParts) {
                  // All segments are plant entries with parts, treat them all as plants
                  plants = allSegmentsTrimmed;
                } else {
                  // Original logic: first segment contains plants, others might be non-plant food
                  if (segments[0]) {
                    plants = segments[0].split(/[、，,]/).map(p => p.trim()).filter(p => p);
                  }
                  
                  // Check subsequent segments for non-plant food sources
                  for (let i = 1; i < segments.length; i++) {
                    const segment = segments[i].trim();
                    // If it looks like an ant name (contains アリ), skip it for plant processing
                    if (!segment.includes('アリ') && segment) {
                      // Additional plant-like segments
                      plants.push(...segment.split(/[、，,]/).map(p => p.trim()).filter(p => p));
                    }
                  }
                }
              }
            } else {
              // Normal plant splitting for cases without semicolon
              plants = cleanedHostPlants.split(/[、，,]/);
            }
            
            // Debug for specific butterflies
            if (japaneseName === 'ルリシジミ') {
              allowDebugLogs && console.log(`=== DEBUG: Processing ${japaneseName} ===`);
              allowDebugLogs && console.log('  Original hostPlants:', hostPlants);
              allowDebugLogs && console.log('  cleanedHostPlants:', cleanedHostPlants);
              allowDebugLogs && console.log('  cleanedHostPlants length:', cleanedHostPlants.length);
              allowDebugLogs && console.log('  Contains semicolon?:', cleanedHostPlants.includes(';') || cleanedHostPlants.includes('；'));
              
              const segments = cleanedHostPlants.split(/[;；]/);
              allowDebugLogs && console.log('  Number of segments:', segments.length);
              allowDebugLogs && console.log('  First 5 segments:', segments.slice(0, 5));
              
              // Updated pattern to match "植物名 (科名)の花蕾" format
              const plantPartPattern = /(?:\s*\([^)]+\))?[のから](花蕾|花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉|新芽|花穂)$/;
              const allSegmentsTrimmed = segments.map(s => s.trim()).filter(s => s);
              
              // Check each segment
              allowDebugLogs && console.log('  Checking each segment:');
              allSegmentsTrimmed.slice(0, 5).forEach((segment, i) => {
                const matches = plantPartPattern.test(segment);
                allowDebugLogs && console.log(`    Segment ${i}: "${segment}" - Pattern matches: ${matches}`);
              });
              
              const allHavePlantParts = allSegmentsTrimmed.every(segment => 
                plantPartPattern.test(segment) || segment.includes('(') && segment.includes(')')
              );
              allowDebugLogs && console.log('  All have plant parts?:', allHavePlantParts);
              allowDebugLogs && console.log('  Processing path:', allHavePlantParts ? 'ALL_SEGMENTS' : 'FIRST_SEGMENT_ONLY');
              allowDebugLogs && console.log('  allSegmentsTrimmed length:', allSegmentsTrimmed.length);
              
              allowDebugLogs && console.log('  Parsed plants array:', plants);
              allowDebugLogs && console.log('  Number of plants:', plants.length);
              if (plants.length > 0) {
                allowDebugLogs && console.log('  First 5 plants:', plants.slice(0, 5));
                allowDebugLogs && console.log('  Last 5 plants:', plants.slice(-5));
              }
              
              // Check family distribution
              const families = new Set();
              plants.forEach(plant => {
                const familyMatch = plant.match(/\(([^)]+)\)/);
                if (familyMatch) families.add(familyMatch[1]);
              });
              allowDebugLogs && console.log('  Unique families found:', Array.from(families));
            }
            if (japaneseName === 'オオゴマシジミ') {
              allowDebugLogs && console.log(`=== DEBUG: Processing ${japaneseName} ===`);
              allowDebugLogs && console.log('  Original hostPlants:', hostPlants);
              allowDebugLogs && console.log('  cleanedHostPlants:', cleanedHostPlants);
              allowDebugLogs && console.log('  Contains semicolon:', cleanedHostPlants.includes(';') || cleanedHostPlants.includes('；'));
              allowDebugLogs && console.log('  Split plants:', plants);
              allowDebugLogs && console.log('  Number of plants:', plants.length);
              allowDebugLogs && console.log('  Extracted parts:', Array.from(butterflyPlantParts.entries()));
              
              // Show semicolon parsing details
              if (cleanedHostPlants.includes(';') || cleanedHostPlants.includes('；')) {
                const segments = cleanedHostPlants.split(/[;；]/);
                allowDebugLogs && console.log('  Semicolon segments:', segments);
                allowDebugLogs && console.log('  First segment (plants):', segments[0]);
                if (segments[1]) {
                  allowDebugLogs && console.log('  Second segment:', segments[1]);
                  allowDebugLogs && console.log('  Contains アリ:', segments[1].includes('アリ'));
                }
              }
            }
            
            
            let plantsAfterTrim = plants.map(plant => plant.trim());
            let plantsAfterQuotes = plantsAfterTrim
              .map(plant => plant.replace(/^"(.+)"$/, '$1')) // Remove outer quotes from individual plant names
              .map(plant => plant.replace(/^"(.+)$/, '$1')) // Remove unclosed quotes at beginning
              .map(plant => plant.replace(/^(.+)"$/, '$1')); // Remove unclosed quotes at end
            let plantsAfterEmptyFilter = plantsAfterQuotes.filter(plant => plant && plant.length > 0); // Remove empty strings
            
            // Process plant names - handle "PlantName (Family)の部位" format specially
            let plantsWithParts = plantsAfterEmptyFilter.map(plant => {
              let cleanPlant = plant;
              let family = null;
              let part = null;
              
              // Check for "PlantName (Family)の部位" format
              const familyPartMatch = plant.match(/^([^（(]+)\s*[（(]([^）)]+)[）)]\s*の(.+)$/);
              if (familyPartMatch) {
                cleanPlant = familyPartMatch[1].trim();
                family = familyPartMatch[2].trim();
                part = familyPartMatch[3].trim();
              } else {
                // Check for simple "PlantNameの部位" format
                const simplePartMatch = plant.match(/^([^の]+)の(.+)$/);
                if (simplePartMatch) {
                  cleanPlant = simplePartMatch[1].trim();
                  part = simplePartMatch[2].trim();
                } else {
                  // Otherwise just remove parenthetical parts
                  cleanPlant = plant.replace(/[（(][^）)]*[）)]/g, '').trim();
                }
              }
              
              if (japaneseName === 'ルリシジミ' || japaneseName === 'オオゴマシジミ') {
                allowDebugLogs && console.log(`DEBUG: Plant processing: "${plant}" -> clean: "${cleanPlant}", family: "${family}", part: "${part}"`);
              }
              
              return { original: plant, clean: cleanPlant, family, part };
            });
            
            let plantsAfterScienceFilter = plantsWithParts
              .filter(item => item.clean !== '科' && item.clean !== '属')
              .filter(item => !item.clean.endsWith('属') || /^[A-Z][a-z]+属$/.test(item.clean)) // Remove items ending with 属, but keep scientific genus names like "Acer属"
              .filter(item => item.clean.length > 1) // Remove single character items
              .filter(item => item.clean.trim() !== ''); // Additional empty string check
            let plantsAfterNormalize = plantsAfterScienceFilter.map(item => ({ 
              ...item, 
              normalized: normalizePlantName(item.clean) 
            })); // Normalize plant names
            let plantsAfterCorrection = plantsAfterNormalize.map(item => ({ 
              ...item, 
              corrected: correctPlantName(item.normalized) 
            })); // Apply YList correction and filtering
            
            // For butterflies, be more lenient with plant name filtering - don't exclude plants not in YList
            let plantsAfterYListFilter = plantsAfterCorrection.filter(item => {
              // If correctPlantName returned empty, fall back to normalized name for butterflies
              const finalName = item.corrected && item.corrected.trim() !== '' ? item.corrected : item.normalized;
              if (japaneseName === 'オオゴマシジミ') {
                allowDebugLogs && console.log(`DEBUG: YList filter: ${item.original} -> normalized: ${item.normalized} -> corrected: ${item.corrected} -> final: ${finalName}`);
              }
              return finalName && finalName.trim() !== '';
            }).map(item => ({
              ...item,
              corrected: item.corrected && item.corrected.trim() !== '' ? item.corrected : item.normalized
            }));
            
            // Create a map to store plant parts for each unique plant
            const plantPartsMap = new Map();
            plantsAfterYListFilter.forEach(item => {
              if (!plantPartsMap.has(item.corrected)) {
                plantPartsMap.set(item.corrected, new Set());
              }
              if (item.part) {
                plantPartsMap.get(item.corrected).add(item.part);
              }
            });
            
            // Remove duplicates and create hostPlantList
            hostPlantList = Array.from(plantPartsMap.keys());
            
            // Create hostPlantEntries with part information
            hostPlantEntries = hostPlantList.map(plant => {
              const parts = Array.from(plantPartsMap.get(plant) || []);
              return {
                plant: plant,
                parts: parts,
                condition: parts.length > 0 ? parts.join('・') : ''
              };
            });
            
            // Debug filtering steps for specific butterflies
            if (japaneseName === 'ルリシジミ') {
              allowDebugLogs && console.log(`=== DEBUG: Filter steps for ${japaneseName} ===`);
              allowDebugLogs && console.log('  After trim:', plantsAfterTrim.length, 'plants');
              allowDebugLogs && console.log('    First 10:', plantsAfterTrim.slice(0, 10));
              
              allowDebugLogs && console.log('  After empty filter:', plantsAfterEmptyFilter.length, 'plants');
              allowDebugLogs && console.log('    First 10:', plantsAfterEmptyFilter.slice(0, 10));
              
              allowDebugLogs && console.log('  After processing (with parts):', plantsWithParts.length, 'plants');
              allowDebugLogs && console.log('    First 10 processed:');
              plantsWithParts.slice(0, 10).forEach((item, i) => 
                allowDebugLogs && console.log(`      ${i}: original="${item.original}" clean="${item.clean}" family="${item.family}" part="${item.part}"`));
              
              allowDebugLogs && console.log('  After science filter:', plantsAfterScienceFilter.length, 'plants');
              allowDebugLogs && console.log('    First 10:', plantsAfterScienceFilter.slice(0, 10).map(p => p.clean));
              
              allowDebugLogs && console.log('  After normalize:', plantsAfterNormalize.length, 'plants');  
              allowDebugLogs && console.log('    First 10:', plantsAfterNormalize.slice(0, 10).map(p => `${p.clean} -> ${p.normalized}`));
              
              allowDebugLogs && console.log('  After correction:', plantsAfterCorrection.length, 'plants');
              allowDebugLogs && console.log('    First 10:', plantsAfterCorrection.slice(0, 10).map(p => `${p.normalized} -> ${p.corrected}`));
              
              allowDebugLogs && console.log('  After YList filter:', plantsAfterYListFilter.length, 'plants');
              allowDebugLogs && console.log('    First 10:', plantsAfterYListFilter.slice(0, 10).map(p => p.corrected));
              
              allowDebugLogs && console.log('  Final host plant list:', hostPlantList.length, 'plants');
              allowDebugLogs && console.log('    All plants:', hostPlantList);
            }
            if (japaneseName === 'オオゴマシジミ') {
              allowDebugLogs && console.log(`=== DEBUG: Filter steps for ${japaneseName} ===`);
              allowDebugLogs && console.log('  After trim:', plantsAfterTrim.length, 'plants -', plantsAfterTrim);
              allowDebugLogs && console.log('  After quotes:', plantsAfterQuotes.length, 'plants -', plantsAfterQuotes);
              allowDebugLogs && console.log('  After empty filter:', plantsAfterEmptyFilter.length, 'plants -', plantsAfterEmptyFilter);
              allowDebugLogs && console.log('  After parentheses processing:', plantsWithParts.length, 'plants');
              plantsWithParts.forEach((item, i) => allowDebugLogs && console.log(`    ${i}: "${item.original}" -> clean: "${item.clean}"`));
              allowDebugLogs && console.log('  After science filter:', plantsAfterScienceFilter.length, 'plants');
              plantsAfterScienceFilter.forEach((item, i) => allowDebugLogs && console.log(`    ${i}: clean: "${item.clean}"`));
              allowDebugLogs && console.log('  After normalize:', plantsAfterNormalize.length, 'plants');
              plantsAfterNormalize.forEach((item, i) => allowDebugLogs && console.log(`    ${i}: "${item.clean}" -> normalized: "${item.normalized}"`));
              allowDebugLogs && console.log('  After correction:', plantsAfterCorrection.length, 'plants');
              plantsAfterCorrection.forEach((item, i) => allowDebugLogs && console.log(`    ${i}: "${item.normalized}" -> corrected: "${item.corrected}"`));
              allowDebugLogs && console.log('  After YList filter:', plantsAfterYListFilter.length, 'plants');
              plantsAfterYListFilter.forEach((item, i) => allowDebugLogs && console.log(`    ${i}: final: "${item.corrected}"`));
              allowDebugLogs && console.log('  Final host plant list:', hostPlantList);
            }
            
            // Remove duplicates and final empty string check (skip for ルリシジミ since we already have the final list)
            if (japaneseName !== 'ルリシジミ') {
              hostPlantList = [...new Set(hostPlantList)].filter(plant => plant && plant.trim() !== '');
            }
            } // Close the else block for ルリシジミ special handling
            
            allowDebugLogs && console.log("Final parsed host plants for", japaneseName, ":", hostPlantList);
          }

          const butterfly = {
          id,
          name: japaneseName,
          scientificName,
          scientificFilename: globalJapaneseToScientificMapping.get(japaneseName) || formatScientificNameForFilename(scientificName),
            type: 'butterfly',
            classification: {
              family: family,
              familyJapanese: family,
              subfamily: subfamilyLatin,
              subfamilyJapanese: subfamilyJapanese,
              genus: genus
            },
            hostPlants: hostPlantList,
            hostPlantDetails: hostPlantEntries, // Add part information
            geographicalRemarks: remarks && remarks.trim() ? remarks.trim() : '',
            source: source || "日本産蝶類標準図鑑"
          };
          
          if (japaneseName === 'オオゴマシジミ') {
            allowDebugLogs && console.log(`=== BUTTERFLY OBJECT CREATED for ${japaneseName} ===`);
            allowDebugLogs && console.log('  butterfly.geographicalRemarks:', butterfly.geographicalRemarks);
            allowDebugLogs && console.log('  original remarks value:', remarks);
            allowDebugLogs && console.log('  butterfly.id:', butterfly.id);
            allowDebugLogs && console.log('  expected id should be butterfly-csv-131:', id === 'butterfly-csv-131');
            allowDebugLogs && console.log('  forEach index:', index);
            allowDebugLogs && console.log('  index + 1:', index + 1);
            allowDebugLogs && console.log('  Full butterfly object:', butterfly);
          }

          butterflyData.push(butterfly);
          allowDebugLogs && console.log("Added butterfly:", japaneseName, scientificName);

          // Add to host plants data with validation
          hostPlantList.forEach(plant => {
            // Validate plant name before adding using centralized validation
            const trimmedPlant = plant.trim();
            if (isValidPlantName(trimmedPlant)) {
              if (!hostPlantData[trimmedPlant]) {
                hostPlantData[trimmedPlant] = [];
              }
              if (!hostPlantData[trimmedPlant].includes(japaneseName)) {
                hostPlantData[trimmedPlant].push(japaneseName);
              }
            }
          });
          });
        }
        
        allowDebugLogs && console.log("=== BUTTERFLY DATA FINAL SUMMARY ===");
        allowDebugLogs && console.log("- Original CSV rows:", butterflyParsedData.length);
        allowDebugLogs && console.log("- Successfully processed:", processedCount);
        allowDebugLogs && console.log("- Skipped due to missing data:", skippedCount);
        allowDebugLogs && console.log("- Final butterfly objects created:", butterflyData.slice(1).length, "(excluding test entry)");
        allowDebugLogs && console.log("- Does final data include オオゴマシジミ?", butterflyData.find(b => b.name === 'オオゴマシジミ') ? 'YES' : 'NO');
        } catch (error) {
          console.error("Error parsing butterfly data:", error);
          console.warn("Continuing without butterfly data - butterfly information may be incomplete");
        }
        } else {
          console.warn("Butterfly data not available - butterfly information will be limited");
        }

        // Parse beetle CSV data with error handling
        beetleData = [];
        if (!useNormalizedOnly && beetleText) {
          try {
            allowDebugLogs && console.log("Parsing beetle data...");
            allowDebugLogs && console.log("Beetle CSV text length:", beetleText.length);
            allowDebugLogs && console.log("First 500 chars of beetle CSV:", beetleText.substring(0, 500));
            const beetleParsed = Papa.parse(beetleText, { header: true, skipEmptyLines: true, delimiter: ',' });
            allowDebugLogs && console.log("Beetle data parsed. Row count:", beetleParsed.data.length);
            if (beetleParsed.errors.length) {
              console.error("PapaParse errors in buprestidae_host.csv:", beetleParsed.errors);
            }
            
            // タマムシデータでもグローバルマッピングを使用
            
            beetleData = [];
        beetleParsed.data.forEach((row, index) => {
          const source = row['文献名'] || row['出典'];
          const family = row['科名'] || row['科'];
          const subfamily = row['亜科名'] || row['亜科'];
          const subfamilyJapanese = row['亜科和名'] || row['亜科'];
          const genus = row['属名'] || row['属'];
          const species = row['種小名'];
          const japaneseName = row['和名'];
          const hostPlants = row['食草'];
          const author = row['著者'] || '';
          const year = row['公表年'] || '';
          
          if (!japaneseName || !genus || !species) {
            allowDebugLogs && console.log("Skipping beetle row:", { japaneseName, genus, species, rowIndex: index });
            return;
          }
          
          // Use unified scientific name processing
          let scientificName = processScientificName('', genus, species, author, year, 'beetle');
          
          // Validate scientific name quality
          const validationResult = validateScientificName(scientificName, japaneseName, 'beetle');
          
          const id = `beetle-${index}`;
          
          // Parse host plants
          let hostPlantList = [];
          if (hostPlants) {
            // Extract plant parts information from hostPlants field
            const extractPlantParts = (text) => {
              const partPatterns = [
                { pattern: /の花(?:弁|びら)?/g, part: '花' },
                { pattern: /の花/g, part: '花' },
                { pattern: /の実/g, part: '実' },
                { pattern: /の果実/g, part: '実' },
                { pattern: /の種子/g, part: '種子' },
                { pattern: /の葉/g, part: '葉' },
                { pattern: /の若葉/g, part: '若葉' },
                { pattern: /の新葉/g, part: '新葉' },
                { pattern: /の古葉/g, part: '古葉' },
                { pattern: /の樹皮/g, part: '樹皮' },
                { pattern: /の幹/g, part: '幹' },
                { pattern: /の枝/g, part: '枝' },
                { pattern: /の茎/g, part: '茎' },
                { pattern: /の根/g, part: '根' },
                { pattern: /の蕾/g, part: '蕾' },
                { pattern: /の芽/g, part: '芽' }
              ];
              
              const extractedParts = new Map();
              
              partPatterns.forEach(({ pattern, part }) => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                  // Extract plant name before the part
                  const beforeMatch = text.substring(0, match.index);
                  const plantMatch = beforeMatch.match(/([ア-ン一-龯]{2,})$/);
                  if (plantMatch) {
                    const plantName = plantMatch[1];
                    if (!extractedParts.has(plantName)) {
                      extractedParts.set(plantName, []);
                    }
                    if (!extractedParts.get(plantName).includes(part)) {
                      extractedParts.get(plantName).push(part);
                    }
                  }
                });
              });
              
              return extractedParts;
            };
            
            const beetlePlantParts = extractPlantParts(hostPlants);
            const plants = hostPlants.split(/[;；、，,]/);
            hostPlantList = plants
              .map(plant => plant.trim())
              .filter(plant => plant && plant.length > 0)
              .filter(plant => plant.trim() !== '')
              .map(plant => normalizePlantName(plant))
              .map(plant => correctPlantName(plant)) // Apply YList correction and filtering
              .filter(plant => plant && plant.trim() !== '') // Remove plants not found in YList
              .map(plant => {
                // Add part information if available
                const plantParts = beetlePlantParts.get(plant);
                if (plantParts && plantParts.length > 0) {
                  return `${plant}（${plantParts.join('・')}）`;
                }
                return plant;
              });
            hostPlantList = [...new Set(hostPlantList)].filter(plant => plant && plant.trim() !== '');
          }

          // Determine the correct scientific filename for beetles
          let scientificFilenameForBeetle;
          // グローバルマッピングを使用、なければフォーマット済み学名を使用
          scientificFilenameForBeetle = globalJapaneseToScientificMapping.get(japaneseName) || formatScientificNameForFilename(scientificName);

          const beetle = {
            id,
            name: japaneseName,
            scientificName,
            scientificFilename: scientificFilenameForBeetle,
            type: 'beetle',
            alternativeNames: (() => {
              const names = [];
              const oldName = (row['旧和名'] || '').trim();
              const alias = (row['別名'] || '').trim();
              const others = (row['その他の和名'] || '').trim();
              if (oldName) names.push(oldName);
              if (alias) names.push(...alias.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
              if (others) names.push(...others.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
              // remove duplicates and same as primary name
              const filtered = Array.from(new Set(names.filter(n => n && n !== japaneseName)));
              return filtered.join('、');
            })(),
            classification: {
              family: family,
              familyJapanese: row['科和名'] || family,
              subfamily: subfamily,
              subfamilyJapanese: subfamilyJapanese,
              genus: genus
            },
            hostPlants: hostPlantList,
            source: source || "日本産タマムシ大図鑑"
          };
          
          // Debug log for specific species
          if (japaneseName === 'ルイスヒラタチビタマムシ' || japaneseName === 'アオマダラタマムシ') {
            allowDebugLogs && console.log(`DEBUG: ${japaneseName} beetle object created:`, {
              name: japaneseName,
              scientificName: scientificName,
              scientificFilename: scientificFilenameForBeetle,
              mappingUsed: globalJapaneseToScientificMapping.has(japaneseName),
              mappingValue: globalJapaneseToScientificMapping.get(japaneseName),
              type: 'beetle'
            });
          }

          beetleData.push(beetle);
          allowDebugLogs && console.log("Added beetle:", japaneseName, scientificName);

          // Add to host plants data with validation
          hostPlantList.forEach(plant => {
            // Validate plant name before adding using centralized validation
            const trimmedPlant = plant.trim();
            if (isValidPlantName(trimmedPlant)) {
              if (!hostPlantData[trimmedPlant]) {
                hostPlantData[trimmedPlant] = [];
              }
              if (!hostPlantData[trimmedPlant].includes(japaneseName)) {
                hostPlantData[trimmedPlant].push(japaneseName);
              }
            }
          });
        });
        
        allowDebugLogs && console.log("Beetle data parsed successfully. beetleData count:", beetleData.length);
        } catch (error) {
          console.error("Error parsing beetle data:", error);
          console.warn("Continuing without beetle data - beetle information may be incomplete");
        }
        } else if (!useNormalizedOnly) {
          console.warn("Beetle data not available - beetle information will be limited");
        }

        // Process integrated hamushi data to create leafbeetle data  
        leafbeetleData = [];
        if (!useNormalizedOnly && hamushiParsedData.length > 0) {
          try {
            allowDebugLogs && console.log("Processing leafbeetle data from integrated hamushi file...");
            let processedCount = 0;
            let skippedCount = 0;
            hamushiParsedData.forEach((row, index) => {
          const catalogId = row['大図鑑カタログNo']?.trim();  // CSVのIDカラム
          const japaneseName = row['和名']?.trim();
          const familyLatin = row['科名']?.trim();        // 科のラテン語名
          const familyJapanese = row['科和名']?.trim();   // 科の日本語名
          const subfamily = row['亜科名']?.trim();        // 英語の亜科名
          const subfamilyJapanese = row['亜科和名']?.trim(); // 日本語の亜科名
          const hostPlants = row['食草']?.trim();
          const emergenceTime = row['成虫出現時期']?.trim();
          const source = row['出典']?.trim();
          const remarks = row['備考']?.trim();
          const scientificName = row['学名']?.trim();
          
          // 和名が空の場合はスキップ
          if (!japaneseName) {
            skippedCount++;
            if (allowDebugLogs) console.log("Skipping leafbeetle row - no Japanese name:", { japaneseName, scientificName, rowIndex: index });
            return;
          }
          
          // 学名が空の場合もスキップ
          if (!scientificName) {
            skippedCount++;
            if (allowDebugLogs) console.log("Skipping leafbeetle row - no scientific name:", { japaneseName, scientificName, rowIndex: index });
            return;
          }
          
          
          processedCount++;
          
          // CSVデータクリーニング後は学名がすでに正しい形式のため、追加処理不要
          
          // Validate scientific name quality
          const validationResult = validateScientificName(scientificName, japaneseName, 'leafbeetle');
          
          // IDを生成 - CSVのIDを使用、なければindexベース
          let id;
          if (catalogId && catalogId.startsWith('H')) {
            // H629 -> leafbeetle-629
            id = `leafbeetle-${catalogId.substring(1)}`;
            // デバッグ: H629のデータを確認
            if (catalogId === 'H629') {
              allowDebugLogs && console.log('H629 (ムナグロナガハムシ) データ:', {
                id,
                catalogId,
                japaneseName,
                familyLatin,
                familyJapanese,
                scientificName
              });
            }
          } else if (catalogId && catalogId.startsWith('LB')) {
            // LB101 -> leafbeetle-lb101
            id = `leafbeetle-${catalogId.toLowerCase()}`;
          } else {
            // フォールバック
            id = `leafbeetle-${index + 1}`;
          }
          
          // Parse host plants - CSVクリーニング後はシンプルな処理で十分
          let hostPlantList = [];
          if (hostPlants && hostPlants.trim()) {
            // 「不明」も食草データとして含める（蛾ページと統一）
            hostPlantList = hostPlants.split(/[、,，]/).map(plant => plant.trim()).filter(plant => plant);
          }

          const leafbeetle = {
            id,
            name: japaneseName,
            scientificName,
            scientificFilename: formatScientificNameForFilename(scientificName),
            type: 'leafbeetle',
            alternativeNames: (() => {
              const names = [];
              const oldName = (row['旧和名'] || '').trim();
              const alias = (row['別名'] || '').trim();
              const others = (row['その他の和名'] || '').trim();
              if (oldName) names.push(oldName);
              if (alias) names.push(...alias.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
              if (others) names.push(...others.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
              return names.join('、');
            })(),
            classification: {
              family: familyLatin || 'Chrysomelidae',
              familyJapanese: familyJapanese || 'ハムシ科',
              subfamily: subfamily,
              subfamilyJapanese: subfamilyJapanese,
              genus: scientificName ? scientificName.split(' ')[0] : '不明'
            },
            hostPlants: hostPlantList,
            emergenceTime: emergenceTime || '不明',
            emergenceTimeSource: source || "ハムシハンドブック",
            source: source || "ハムシハンドブック",
            sourceUrl: (source && source.includes('ハムシハンドブック')) ? "https://amzn.to/456YVhu" : undefined,
            geographicalRemarks: remarks || ''
          };

          leafbeetleData.push(leafbeetle);
          allowDebugLogs && console.log("Added leafbeetle:", japaneseName, scientificName);

          // Add to host plants data with validation
          hostPlantList.forEach(plant => {
            // Validate plant name before adding using centralized validation
            const trimmedPlant = plant.trim();
            if (isValidPlantName(trimmedPlant)) {
              if (!hostPlantData[trimmedPlant]) {
                hostPlantData[trimmedPlant] = [];
              }
              if (!hostPlantData[trimmedPlant].includes(japaneseName)) {
                hostPlantData[trimmedPlant].push(japaneseName);
              }
            }
          });
        });
        
        logger.debug("Leafbeetle data processed successfully. leafbeetleData count:", leafbeetleData.length);
        } catch (error) {
          logger.error("Error processing leafbeetle data:", error);
          logger.warn("Continuing without leafbeetle data - leafbeetle information may be incomplete");
        }
        } else {
          logger.debug("Integrated hamushi data not available - leafbeetle information will be limited");
        }

        // Combine all moth data after all parsing is complete
        const combinedMothData = [...mainMothData];
        logger.debug("DEBUG: mainBeetleData length:", mainBeetleData.length);
        logger.debug("DEBUG: beetleData length:", beetleData.length);
        // Combine beetle data from integrated file and separate CSV
        combinedBeetleData = [...mainBeetleData, ...beetleData];
        logger.debug("DEBUG: combinedBeetleData length:", combinedBeetleData.length);
        if (combinedBeetleData.length > 0) {
          logger.debug("DEBUG: Sample beetle data:", combinedBeetleData[0]);
        }
        // Add leafbeetle data
        combinedLeafbeetleData = [...leafbeetleData];
        logger.debug("DEBUG: combinedLeafbeetleData length:", combinedLeafbeetleData.length);

        // Clean up hostPlantData to remove any invalid plant names and normalize duplicates
        const cleanedHostPlantData = {};
        logger.debug('DEBUG: Starting hostPlantData cleanup. Total entries:', Object.keys(hostPlantData).length);
        
        Object.entries(hostPlantData).forEach(([plantName, mothList]) => {
          // Debug logging for empty or suspicious plant names
          if (!plantName || plantName.trim() === '' || plantName === 'undefined' || plantName === 'null') {
            logger.debug("DEBUG: Found problematic plant name:", JSON.stringify(plantName), "with moths:", mothList);
          }
          
          // Debug logging for ソメイヨシノ
          if (plantName && (plantName.includes('ソメイヨシノ') || plantName.includes('染井吉野'))) {
            logger.debug("DEBUG: Found ソメイヨシノ-related plant name:", JSON.stringify(plantName), "moths:", mothList);
          }
          
          // Explicit check for empty/invalid plant names before calling isValidPlantName
          if (!plantName || 
              typeof plantName !== 'string' || 
              plantName.trim() === '' || 
              plantName === 'undefined' || 
              plantName === 'null' ||
              plantName.length === 0) {
            logger.debug("DEBUG: Explicitly excluding empty/invalid plant name:", JSON.stringify(plantName));
            return; // Skip this entry entirely
          }
          
          if (isValidPlantName(plantName)) {
            const normalizedName = normalizePlantName(plantName);
            // Additional check after normalization
            if (!normalizedName || normalizedName.trim() === '') {
              logger.debug("DEBUG: Normalized plant name is empty, skipping:", JSON.stringify(plantName), "->", JSON.stringify(normalizedName));
              return;
            }
            
            if (!cleanedHostPlantData[normalizedName]) {
              cleanedHostPlantData[normalizedName] = [];
            }
            // Merge moth lists for the same normalized plant name
            cleanedHostPlantData[normalizedName] = [...new Set([...cleanedHostPlantData[normalizedName], ...mothList])];
          } else {
            logger.debug("DEBUG: Removed invalid plant name:", JSON.stringify(plantName), "Length:", plantName?.length, "Type:", typeof plantName);
          }
        });
        
        logger.debug('DEBUG: After cleanup. Cleaned entries:', Object.keys(cleanedHostPlantData).length);
        
        // Clean up plantDetailData as well
        // Merge entries that normalize to the same key (preserve and union aliases)
        const cleanedPlantDetailData = {};
        Object.entries(plantDetailData).forEach(([plantName, details]) => {
          if (!isValidPlantName(plantName)) return;
          const normalizedName = normalizePlantName(plantName);

          // Ensure we don't lose alias information (e.g., サネカズラ ↔ ビナンカズラ)
          const incoming = { ...details };
          const incomingAliases = new Set([...(incoming.aliases || [])]);
          // Add YList aliases keyed by the original name, if any
          if (yListPlantAliasMap && yListPlantAliasMap[plantName]) {
            yListPlantAliasMap[plantName].forEach(a => incomingAliases.add(a));
          }
          // Add the original plant name itself as an alias if it differs from normalized
          if (plantName !== normalizedName) incomingAliases.add(plantName);
          incoming.aliases = Array.from(incomingAliases);

          if (!cleanedPlantDetailData[normalizedName]) {
            cleanedPlantDetailData[normalizedName] = incoming;
          } else {
            // Merge into existing entry
            const existing = cleanedPlantDetailData[normalizedName];
            // Prefer existing non-unknown family; otherwise use incoming
            if (!existing.family || existing.family === '不明') {
              existing.family = incoming.family || existing.family;
            }
            if (!existing.familyName && incoming.familyName) {
              existing.familyName = incoming.familyName;
            }
            if (!existing.familyLatin && incoming.familyLatin) {
              existing.familyLatin = incoming.familyLatin;
            }
            // Fill missing core fields
            if (!existing.scientificName && incoming.scientificName) {
              existing.scientificName = incoming.scientificName;
            }
            if (!existing.genus && incoming.genus) {
              existing.genus = incoming.genus;
            }
            if (!existing.order && incoming.order) {
              existing.order = incoming.order;
            }
            if (!existing.orderLatin && incoming.orderLatin) {
              existing.orderLatin = incoming.orderLatin;
            }
            if (!existing.genusFamily && incoming.genusFamily) {
              existing.genusFamily = incoming.genusFamily;
            }
            if (!existing.genusScientificName && incoming.genusScientificName) {
              existing.genusScientificName = incoming.genusScientificName;
            }
            // Union aliases
            const aliasSet = new Set([...(existing.aliases || []), ...(incoming.aliases || [])]);
            existing.aliases = Array.from(aliasSet);
          }
        });

        // Normalized-only: build plant detail data from YList for all plants in the unified map
        if (useNormalizedOnly) {
          // Build alias -> canonical map from YList aliases
          const aliasToCanonical = {};
          if (yListPlantAliasMap) {
            Object.entries(yListPlantAliasMap).forEach(([canonical, aliases]) => {
              if (!Array.isArray(aliases)) return;
              aliases.forEach(a => {
                const k = (a || '').trim();
                if (k) aliasToCanonical[k] = canonical;
              });
            });
          }

          Object.keys(cleanedHostPlantData).forEach(plant => {
            if (!plant || plant === '不明') return;
            const canonical = aliasToCanonical[plant] || plant;
            const aliases = new Set();
            // Add YList aliases of canonical
            if (yListPlantAliasMap && yListPlantAliasMap[canonical]) {
              yListPlantAliasMap[canonical].forEach(a => a && aliases.add(a));
            }
            // If current key is alias, include canonical as alias for search/image matching
            if (canonical !== plant) aliases.add(canonical);

            // Compose detail
            const family = (yListPlantFamilyMap && (yListPlantFamilyMap[plant] || yListPlantFamilyMap[canonical])) || '不明';
            const scientificName = (yListPlantScientificNameMap && (yListPlantScientificNameMap[plant] || yListPlantScientificNameMap[canonical])) || '';
            const genus = scientificName ? scientificName.split(' ')[0] : '';
            const order = (yListPlantOrderMap && (yListPlantOrderMap[plant] || yListPlantOrderMap[canonical])) || '';
            const orderLatin = (yListPlantOrderLatinMap && (yListPlantOrderLatinMap[plant] || yListPlantOrderLatinMap[canonical])) || '';

            if (!cleanedPlantDetailData[plant]) {
              cleanedPlantDetailData[plant] = {
                family,
                scientificName,
                genus,
                order,
                orderLatin,
                aliases: Array.from(aliases)
              };
            } else {
              // Merge aliases and fill blanks
              const existing = cleanedPlantDetailData[plant];
              existing.family = existing.family && existing.family !== '不明' ? existing.family : family;
              existing.scientificName = existing.scientificName || scientificName;
              existing.genus = existing.genus || genus;
              if (!existing.order && order) existing.order = order;
              if (!existing.orderLatin && orderLatin) existing.orderLatin = orderLatin;
              const aliasSet = new Set([...(existing.aliases || []), ...aliases]);
              existing.aliases = Array.from(aliasSet);
            }
          });
        }

        const enrichGenusDetails = (detailMap) => {
          const normalizeKey = (str = '') => (str || '').replace(/\s+/g, '');
          const genusBase = (str = '') => normalizeKey(str).replace(/属$/, '');
          const getOrderFromYList = (base) =>
            yListPlantOrderMap[base] ||
            yListPlantOrderMap[`${base}属`] ||
            yListPlantOrderMap[`${base}類`] || '';
          const getOrderLatinFromYList = (base) =>
            yListPlantOrderLatinMap[base] ||
            yListPlantOrderLatinMap[`${base}属`] ||
            yListPlantOrderLatinMap[`${base}類`] || '';

          const findDetailByNormalized = (target, skipName) => {
            if (!target) return null;
            const normalizedTarget = normalizeKey(target);
            return Object.keys(detailMap).reduce((match, candidate) => {
              if (match || candidate === skipName) return match;
              if (normalizeKey(candidate) === normalizedTarget) {
                return detailMap[candidate];
              }
              return null;
            }, null);
          };

          Object.keys(detailMap).forEach((name) => {
            if (!name || typeof name !== 'string') return;
            const trimmedName = name.trim();
            if (!trimmedName.endsWith('属')) return;
            const canonical = genusBase(trimmedName);
            if (!canonical) return;

            const detail = detailMap[name] || (detailMap[name] = {});
            let sourceDetail =
              findDetailByNormalized(canonical, name) ||
              findDetailByNormalized(`${canonical}類`, name);

            if (!sourceDetail) {
              sourceDetail = Object.entries(detailMap)
                .filter(([candidateName]) =>
                  candidateName !== name &&
                  !candidateName.endsWith('属') &&
                  normalizeKey(candidateName).includes(canonical)
                )
                .map(([, candidateDetail]) => candidateDetail)[0];
            }

            if (!sourceDetail) {
              const lowerCanonical = canonical.toLowerCase();
              sourceDetail = Object.values(detailMap).find((candidateDetail) => {
                const genusLatin = (candidateDetail?.genus || '').toLowerCase();
                const sciLatin = (candidateDetail?.scientificName || '').split(' ')[0]?.toLowerCase();
                return (
                  (genusLatin && genusLatin === lowerCanonical) ||
                  (sciLatin && sciLatin === lowerCanonical)
                );
              });
            }

            if (!sourceDetail) {
              const genusKey = Object.keys(genusMapping || {}).find(
                (key) => genusBase(key) === canonical
              );
              if (genusKey) {
                const info = genusMapping[genusKey];
                sourceDetail = {
                  family: info.family,
                  familyName: info.family,
                  genusScientificName: info.scientificName,
                  scientificName: info.scientificName,
                  genus: info.scientificName,
                };
              }
            }

            if (!sourceDetail) return;

            const copyIfMissing = (field, value, allowUnknown = false) => {
              if (!value) return;
              if (!detail[field] || detail[field] === '' || (!allowUnknown && detail[field] === '不明')) {
                detail[field] = value;
              }
            };

            copyIfMissing('family', sourceDetail.family || sourceDetail.familyName, true);
            copyIfMissing('familyName', sourceDetail.familyName || sourceDetail.family, true);
            copyIfMissing('familyLatin', sourceDetail.familyLatin, true);
            copyIfMissing('order', sourceDetail.order || getOrderFromYList(canonical), true);
            copyIfMissing('orderLatin', sourceDetail.orderLatin || getOrderLatinFromYList(canonical), true);

            if (!detail.scientificName) {
              detail.scientificName =
                sourceDetail.genusScientificName ||
                sourceDetail.scientificName ||
                '';
            }
            if (!detail.genus && detail.scientificName) {
              detail.genus = detail.scientificName.split(' ')[0];
            }

            if (!Array.isArray(detail.aliases)) detail.aliases = [];
            const aliasSet = new Set(detail.aliases);
            const readableBase = trimmedName.replace(/属$/, '').trim();
            if (readableBase) aliasSet.add(readableBase);
            if (canonical && canonical !== readableBase) aliasSet.add(canonical);
            detail.aliases = Array.from(aliasSet);
          });
        };

        enrichGenusDetails(cleanedPlantDetailData);

        logger.debug("Final butterfly data:", butterflyData.length, "butterflies");
        logger.debug("Final beetle data:", combinedBeetleData.length, "beetles");
        logger.debug("Final leafbeetle data:", combinedLeafbeetleData.length, "leafbeetles");
        logger.debug("Sample butterfly:", butterflyData[0]);
        logger.debug("All butterflies:", butterflyData.map(b => b.name));
        logger.debug("Host Plants data set:", Object.keys(cleanedHostPlantData).length);
        logger.debug("plantDetailData before setting state:", cleanedPlantDetailData);
        logger.debug("Plant Details data set:", Object.keys(cleanedPlantDetailData).length);
        
        logger.debug("All CSVs parsed. Moths count:", combinedMothData.length, "Butterflies count:", butterflyData.length, "Beetles count:", combinedBeetleData.length, "Leafbeetles count:", combinedLeafbeetleData.length, "Host Plants count:", Object.keys(cleanedHostPlantData).length);
        logger.debug("Removed", Object.keys(hostPlantData).length - Object.keys(cleanedHostPlantData).length, "invalid host plant entries");
        
        // Deduplicate moths by scientific name
        const deduplicatedMoths = deduplicateMoths(combinedMothData);
        logger.debug("Deduplicated moths:", combinedMothData.length, "->", deduplicatedMoths.length, "(removed", combinedMothData.length - deduplicatedMoths.length, "duplicates)");
        
        // CRITICAL DEBUG: Log actual data before setting state
        logger.debug("CRITICAL DEBUG - About to set state with:", {
          deduplicatedMoths: deduplicatedMoths.length,
          butterflyData: butterflyData.length,
          combinedBeetleData: combinedBeetleData.length,
          combinedLeafbeetleData: combinedLeafbeetleData.length,
          sampleMoth: deduplicatedMoths[0],
          sampleButterfly: butterflyData[0],
          sampleBeetle: combinedBeetleData[0],
          sampleLeafbeetle: combinedLeafbeetleData[0]
        });
        
        // Decide whether to use normalized data or legacy data
        let finalMothData, finalButterflyData, finalBeetleData, finalLonghornbeetleData, finalLeafbeetleData;
        
        if (normalizedData && normalizedData.moths?.length > 0) {
          logger.debug("正規化データを使用します");
          
          // Use normalized data as primary source
          finalMothData = normalizedData.moths;
          finalButterflyData = normalizedData.butterflies;
          finalBeetleData = normalizedData.beetles;
          finalLonghornbeetleData = normalizedData.longhornbeetles || [];
          finalLeafbeetleData = normalizedData.leafbeetles;
          
              logger.debug("正規化データ使用状況:", {
            moths: finalMothData.length,
            butterflies: finalButterflyData.length,
            beetles: finalBeetleData.length,
            longhornbeetles: finalLonghornbeetleData.length,
            leafbeetles: finalLeafbeetleData.length,
            total: finalMothData.length + finalButterflyData.length + finalBeetleData.length + finalLonghornbeetleData.length + finalLeafbeetleData.length
          });
          
        } else {
          logger.debug("レガシーデータを使用します（正規化データが利用不可）");
          if (useNormalizedOnly) {
            // 正規化のみ運用時は、旧データにフォールバックしない
            finalMothData = [];
            finalButterflyData = [];
            finalBeetleData = [];
            finalLonghornbeetleData = [];
            finalLeafbeetleData = [];
          } else {
            // Fallback to legacy data
            finalMothData = deduplicatedMoths;
            finalButterflyData = butterflyData;
            finalBeetleData = combinedBeetleData;
            finalLonghornbeetleData = [];
            finalLeafbeetleData = combinedLeafbeetleData;
            
            // Enhance legacy data with integrated format for compatibility
            try {
              const { convertLegacyToIntegratedFormat } = await import('./utils/integratedDataParser.js');
              
              finalMothData = convertLegacyToIntegratedFormat(finalMothData, 'moth');
              finalButterflyData = convertLegacyToIntegratedFormat(finalButterflyData, 'butterfly');
              finalBeetleData = convertLegacyToIntegratedFormat(finalBeetleData, 'beetle');
              finalLonghornbeetleData = convertLegacyToIntegratedFormat(finalLonghornbeetleData, 'longhornbeetle');
              finalLeafbeetleData = convertLegacyToIntegratedFormat(finalLeafbeetleData, 'leafbeetle');
              
              logger.debug("レガシーデータを統合形式に変換完了");
            } catch (error) {
              logger.warn("レガシーデータ変換エラー:", error);
              // Continue with original data if conversion fails
            }
          }
        }
        
        // Repair collapsed scientific binomials (e.g., Genusspecies -> Genus species)
        const repairScientificBinomial = (name) => {
          if (!name || typeof name !== 'string') return name || '';
          const t = name.trim();
          if (t.includes(' ')) return t; // already spaced
          // Try to split into Genus + species; keep species length >= 3 to avoid single-char tails
          const m = t.match(/^([A-Z][a-z]+)([a-z-]{3,})(.*)$/);
          if (m) return `${m[1]} ${m[2]}${m[3] || ''}`;
          return t;
        };

        // Apply repair to all insects for consistent rendering across views
        const fixScientificNames = (arr) => (arr || []).map(i => ({
          ...i,
          scientificName: repairScientificBinomial(i.scientificName)
        }));

        finalMothData = fixScientificNames(finalMothData);
        finalButterflyData = fixScientificNames(finalButterflyData);
        finalBeetleData = fixScientificNames(finalBeetleData);
        finalLonghornbeetleData = fixScientificNames(finalLonghornbeetleData);
        finalLeafbeetleData = fixScientificNames(finalLeafbeetleData);

        // Parse user-provided emergence overrides CSV (robust to extra commas)
        const splitCsvLine = (line) => {
          const out = [];
          let buf = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
              continue;
            }
            if (ch === ',' && !inQuotes) {
              out.push(buf);
              buf = '';
            } else {
              buf += ch;
            }
          }
          out.push(buf);
          return out.map(s => s.trim());
        };

        // overrides パーサは不要になったため削除

        // overrides の適用は廃止。以下の general_notes からの抽出で付与する。

        // Fallback: if no emergenceTime after overrides, fill from general_notes
        const isEmergenceNoteGeneric = (note) => {
          const t = (note?.type || '').trim();
          const c = (note?.content || '').trim();
          if (!c || c === '不明') return false;
          const typeHit = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期']
            .some(k => t.includes(k));
          const contentHit = /\d+\s*月|春|夏|秋|冬|上旬|中旬|下旬|頃/.test(c);
          return typeHit || (!t && contentHit);
        };
        const fillEmergenceFromNotes = (arr) => (arr || []).map(item => {
          if (!item || (item.emergenceTime && item.emergenceTime !== '不明')) return item;
          const gn = (item.generalNotes || []).find(isEmergenceNoteGeneric);
          if (gn && gn.content) {
            return {
              ...item,
              emergenceTime: gn.content,
              emergenceTimeSource: gn.reference || item.emergenceTimeSource || '',
              emergenceTimeDescription: (gn.page ? `p.${gn.page}` : '') || item.emergenceTimeDescription || ''
            };
          }
          return item;
        });
        finalMothData = fillEmergenceFromNotes(finalMothData);
        finalButterflyData = fillEmergenceFromNotes(finalButterflyData);
        finalBeetleData = fillEmergenceFromNotes(finalBeetleData);
        finalLonghornbeetleData = fillEmergenceFromNotes(finalLonghornbeetleData);
        finalLeafbeetleData = fillEmergenceFromNotes(finalLeafbeetleData);

        // Unify host plant mapping with normalized/integrated data to avoid discrepancies
        const unifiedHostPlantMap = { ...cleanedHostPlantData };
        const addInsectPlants = (insect) => {
          if (!insect) return;
          let plants = [];
          if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
            plants = insect.hostPlantsDetailed
              .filter(p => !isFlowerVisitRecord(p))
              .map(p => p && p.name ? String(p.name).trim() : '')
              .filter(Boolean);
          } else if (Array.isArray(insect.hostPlants)) {
            plants = insect.hostPlants.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim());
          } else if (typeof insect.hostPlants === 'string') {
            plants = insect.hostPlants.split(/[;；、，,]/).map(p => p.trim()).filter(Boolean);
          }
          plants.forEach(raw => {
            if (!raw) return;
            const normalized = normalizePlantName(raw);
            if (!normalized || normalized === '不明') return;
            if (!unifiedHostPlantMap[normalized]) unifiedHostPlantMap[normalized] = [];
            if (!unifiedHostPlantMap[normalized].includes(insect.name)) unifiedHostPlantMap[normalized].push(insect.name);
          });
        };
        const pruneFlowerOnlyHosts = (map, insect) => {
          if (!map || !insect) return;
          const records = insect.hostPlantsDetailed;
          if (!Array.isArray(records) || records.length === 0) return;
          const insectName = (insect.name || insect.japaneseName || '').trim();
          if (!insectName) return;
          const larvalPlants = new Set();
          const flowerPlants = new Set();
          records.forEach((record) => {
            const raw = record?.name || record?.displayName || record?.plant || '';
            const normalized = normalizePlantName(String(raw || '').trim());
            if (!normalized || normalized === '不明') return;
            if (isFlowerVisitRecord(record)) {
              flowerPlants.add(normalized);
            } else {
              larvalPlants.add(normalized);
            }
          });
          flowerPlants.forEach((plant) => {
            if (larvalPlants.has(plant)) return;
            const list = map[plant];
            if (!Array.isArray(list)) return;
            const next = list.filter(name => name !== insectName);
            if (next.length === 0) {
              delete map[plant];
            } else if (next.length !== list.length) {
              map[plant] = next;
            }
          });
        };
        [...finalMothData, ...finalButterflyData, ...finalBeetleData, ...finalLonghornbeetleData, ...finalLeafbeetleData].forEach(addInsectPlants);
        [...finalMothData, ...finalButterflyData, ...finalBeetleData, ...finalLonghornbeetleData, ...finalLeafbeetleData].forEach((insect) => {
          pruneFlowerOnlyHosts(unifiedHostPlantMap, insect);
        });

        // Debug specific plant like キョウチクトウ to ensure expected insects are present
        if (unifiedHostPlantMap['キョウチクトウ']) {
          logger.debug('UNIFIED HOST MAP: キョウチクトウ ->', unifiedHostPlantMap['キョウチクトウ']);
        }

        setMoths(finalMothData);
        setButterflies(finalButterflyData);
        setBeetles(finalBeetleData);
        setLonghornbeetles(finalLonghornbeetleData);
        setLeafbeetles(finalLeafbeetleData);
        setFlowerVisitPlants(
          buildFlowerVisitMap([
            ...finalMothData,
            ...finalButterflyData,
            ...finalBeetleData,
            ...finalLonghornbeetleData,
            ...finalLeafbeetleData,
          ]),
        );
        setHostPlants(unifiedHostPlantMap);
        setPlantDetails(cleanedPlantDetailData);
        const finalSummaryCounts = {
          moths: finalMothData.length,
          butterflies: finalButterflyData.length,
          beetles: finalBeetleData.length,
          longhornbeetles: finalLonghornbeetleData.length,
          leafbeetles: finalLeafbeetleData.length,
          hostPlants: Object.keys(unifiedHostPlantMap).length,
        };
        try {
          setSummaryCounts(finalSummaryCounts);
        } catch {}
        setLoading(false); // Set loading to false after data is loaded
        cacheLoadedRef.current = true;
        if (cachedVersionRef.current) {
          try {
            await saveDatasetToCache(cachedVersionRef.current, {
              moths: deduplicatedMoths,
              butterflies: finalButterflyData,
              beetles: finalBeetleData,
              longhornbeetles: finalLonghornbeetleData,
              leafbeetles: finalLeafbeetleData,
              hostPlants: cleanedHostPlantData,
              flowerVisitPlants: buildFlowerVisitMap([
                ...finalMothData,
                ...finalButterflyData,
                ...finalBeetleData,
                ...finalLonghornbeetleData,
                ...finalLeafbeetleData,
              ]),
              plantDetails: cleanedPlantDetailData,
              summaryCounts: finalSummaryCounts,
            });
          } catch {}
        }
        
        // DEBUG: Check actual state after setting
        logger.debug("DEBUG: Expected total species:", deduplicatedMoths.length + butterflyData.length + combinedBeetleData.length + combinedLeafbeetleData.length);
        
        logger.debug("CRITICAL DEBUG - State set. Loading set to false. Final data counts:", {
          moths: deduplicatedMoths.length,
          butterflies: butterflyData.length, 
          beetles: combinedBeetleData.length,
          leafbeetles: combinedLeafbeetleData.length,
          hostPlants: Object.keys(cleanedHostPlantData).length,
          plantDetails: Object.keys(cleanedPlantDetailData).length
        });
      } catch (error) {
        logger.error("Error fetching or parsing CSVs:", error);
        logger.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setLoading(false); // Ensure loading is set to false even on error
        // Set empty data to prevent app from hanging
        setMoths([]);
        setButterflies([]);
        setBeetles([]);
        setLonghornbeetles([]);
        setLeafbeetles([]);
        setHostPlants({});
        setPlantDetails({});
        setLoadError(error);
      }
    };
    let cancelled = false;
    fetchDataRef.current = fetchData;
    const bootstrap = async () => {
      const cached = await loadDatasetFromCache();
      if (!cancelled && cached?.payload) {
        applyDataset(cached.payload);
        setLoading(false);
        cacheLoadedRef.current = true;
        cachedVersionRef.current = cached.version || null;
      }
      if (!cancelled) {
        await fetchData(cached?.version || null);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
      fetchDataRef.current = null;
    };
  }, []); // Close useEffect and add dependency array

  // Content protection measures (removed to improve UX/performance)
  /*useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable common keyboard shortcuts for copying/saving content
    const handleKeyDown = (e) => {
      // Disable F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+Shift+I (Developer Tools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+A (Select All) - but allow in input fields
      if (e.ctrlKey && e.key === 'a' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+P (Print)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        return false;
      }
    };

    // Disable image dragging
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);

    // Basic dev tools detection - TEMPORARILY DISABLED FOR DEBUGGING
    // let devtools = {
    //   open: false,
    //   orientation: null
    // };
    
    // const threshold = 160;
    // setInterval(() => {
    //   if (window.outerHeight - window.innerHeight > threshold || 
    //       window.outerWidth - window.innerWidth > threshold) {
    //     if (!devtools.open) {
    //       devtools.open = true;
    //       console.clear();
    //       allowDebugLogs && console.log('%c⚠️ 開発者ツールが検出されました', 'color: red; font-size: 20px; font-weight: bold;');
    //       allowDebugLogs && console.log('%c研究用データの保護にご協力ください', 'color: orange; font-size: 14px;');
    //     }
    //   } else {
    //     devtools.open = false;
    //   }
    // }, 500);

    // Cleanup function
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);*/

  logger.debug("App rendering. Loading:", loading, "Moths count:", moths.length, "Theme:", theme);
  
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-white focus:text-slate-900 focus:shadow-lg"
      >
        本文へスキップ
      </a>
      {!isExplorerPage && (
        <Header
          theme={theme}
          setTheme={setTheme}
          moths={moths}
          butterflies={butterflies}
          beetles={beetles}
          longhornbeetles={longhornbeetles}
          leafbeetles={leafbeetles}
          hostPlants={hostPlants}
          plantDetails={plantDetails}
        />
      )}

      {loadError && (
        <div className="px-4 sm:px-6 lg:px-8 mt-4">
          <div
            role="alert"
            className="max-w-6xl mx-auto rounded-2xl border border-red-200/70 dark:border-red-700/60 bg-red-50/90 dark:bg-red-900/30 px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="text-sm text-red-700 dark:text-red-200">
              データの読み込みに失敗しました。通信状態を確認して再試行してください。
            </div>
            <button
              type="button"
              onClick={() => {
                if (fetchDataRef.current) {
                  fetchDataRef.current(cachedVersionRef.current);
                }
              }}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
            >
              再読み込み
            </button>
          </div>
        </div>
      )}

      <main id="main-content" role="main" tabIndex={-1}>
        {loading ? (
          <SkeletonLoader />
        ) : (
        <Routes>
          {/* 一覧ビュー（トップ/昆虫/植物タブ付き） */}
          <Route
            path="/"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <InsectsHostPlantExplorer
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    plantDetails={plantDetails}
                    theme={theme}
                    setTheme={setTheme}
                    summaryCounts={summaryCounts}
                    initialTab="insects"
                    onNeedInsectsData={() => {
                      try { ensureTypesLoaderRef.current && ensureTypesLoaderRef.current(); } catch {}
                    }}
                    onNeedPlantsData={() => {
                      try { ensureTypesLoaderRef.current && ensureTypesLoaderRef.current(); } catch {}
                      try { requestHostHydrationRef.current && requestHostHydrationRef.current(); } catch {}
                    }}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />

          {/* 昆虫一覧専用ルート（検索共有用） */}
          <Route
            path="/moth"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <InsectsHostPlantExplorer
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    plantDetails={plantDetails}
                    theme={theme}
                    setTheme={setTheme}
                    summaryCounts={summaryCounts}
                    initialTab="insects"
                    onNeedInsectsData={() => {
                      try { ensureTypesLoaderRef.current && ensureTypesLoaderRef.current(); } catch {}
                    }}
                    onNeedPlantsData={() => {
                      try { ensureTypesLoaderRef.current && ensureTypesLoaderRef.current(); } catch {}
                      try { requestHostHydrationRef.current && requestHostHydrationRef.current(); } catch {}
                    }}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />

          {/* 植物一覧専用ルート（検索共有用） */}
          <Route
            path="/plant"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <InsectsHostPlantExplorer
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    plantDetails={plantDetails}
                    theme={theme}
                    setTheme={setTheme}
                    summaryCounts={summaryCounts}
                    initialTab="plants"
                    onNeedInsectsData={() => {
                      try { ensureTypesLoaderRef.current && ensureTypesLoaderRef.current(); } catch {}
                    }}
                    onNeedPlantsData={() => {
                      try { ensureTypesLoaderRef.current && ensureTypesLoaderRef.current(); } catch {}
                      try { requestHostHydrationRef.current && requestHostHydrationRef.current(); } catch {}
                    }}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />

          {/* 詳細ページ群 */}
          <Route
            path="/moth/:mothSlug"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <MothDetail
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    theme={theme}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />
          <Route
            path="/butterfly/:butterflySlug"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <MothDetail
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    theme={theme}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />
          <Route
            path="/beetle/:beetleSlug"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <MothDetail
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    theme={theme}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />
          <Route
            path="/longhornbeetle/:longhornbeetleSlug"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <MothDetail
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    theme={theme}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />
          <Route
            path="/leafbeetle/:leafbeetleSlug"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <MothDetail
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    theme={theme}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />
          <Route
            path="/plant/:plantName"
            element={
              <ChunkErrorBoundary>
                <React.Suspense fallback={<SkeletonLoader />}>
                  <HostPlantDetail
                    moths={moths}
                    butterflies={butterflies}
                    beetles={beetles}
                    longhornbeetles={longhornbeetles}
                    leafbeetles={leafbeetles}
                    hostPlants={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    plantDetails={plantDetails}
                    theme={theme}
                  />
                </React.Suspense>
              </ChunkErrorBoundary>
            }
          />
          <Route path="*" element={<SkeletonLoader />} />
        </Routes>
      )}
      </main>
        <FloatingActionButton />
      <Footer />
    </div>
  );
}
export default App;
