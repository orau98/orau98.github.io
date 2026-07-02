import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, matchPath, useLocation, useNavigationType } from 'react-router-dom';
import logger from './utils/logger';
import lazyWithRetry from './utils/lazyWithRetry';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
const InsectsHostPlantExplorer = lazyWithRetry(() => import('./InsectsHostPlantExplorer'));
const MothDetail = lazyWithRetry(() => import('./MothDetail'));
const HostPlantDetail = lazyWithRetry(() => import('./HostPlantDetail'));
const QuizPage = lazyWithRetry(() => import('./QuizPage'));
import SkeletonLoader, { DetailSkeleton } from './components/SkeletonLoader';
import Footer from './components/Footer';
import Header from './components/Header';
import FloatingActionButton from './components/FloatingActionButton';
import LoadingBar from './components/LoadingBar';
import NotFoundPage from './components/NotFoundPage';
import ManualAdSlot from './components/ManualAdSlot';
import { loadDatasetFromCache, saveDatasetToCache } from './services/datasetCache';
import { buildFlowerVisitMap } from './utils/flowerVisitPlants';
import {
  INDEX_FOLLOW_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  setRobotsMetaContent,
} from './utils/robotsMeta';
import { shouldDeferHeavyWork } from './utils/plantMetadata';
import { loadInsectImageIndexes } from './services/imageIndex';
import { getLocaleFromPath, isEnglishLocale } from './utils/locale';
import {
  buildCurrentHashHref,
  scrollElementWithOffset,
} from './utils/sectionNavigation';
import {
  EXPLORER_ROUTE_CONFIGS,
  INSECT_DETAIL_ROUTE_PATTERNS,
  isExplorerRoutePath,
} from './utils/siteTaxonomy';
import { isStaticDocumentPath } from './utils/staticDocumentPaths';

const APP_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : '';

const INSECT_DATA_IMMEDIATE_QUERY_PARAMS = [
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
];

const hasImmediateInsectDataParams = (params) =>
  INSECT_DATA_IMMEDIATE_QUERY_PARAMS.some((name) => params.has(name));

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

const shouldLoadInsectPartitionsImmediately = (pathname = '/', params = new URLSearchParams()) => {
  if (!isExplorerRoutePath(pathname)) return true;
  if (hasImmediateInsectDataParams(params)) return true;
  return getExplorerInitialTabForPath(pathname) === 'insects';
};

function App() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locale = getLocaleFromPath(location.pathname);
  const isEnglish = isEnglishLocale(locale);
  const [moths, setMoths] = useState([]);
  const [butterflies, setButterflies] = useState([]);
  const [beetles, setBeetles] = useState([]);
  const [longhornbeetles, setLonghornbeetles] = useState([]);
  const [leafbeetles, setLeafbeetles] = useState([]);
  const [aphids, setAphids] = useState([]);
  const [hostPlants, setHostPlants] = useState({});
  const [flowerVisitPlants, setFlowerVisitPlants] = useState({});
  const [plantDetails, setPlantDetails] = useState({});
  const [loading, setLoading] = useState(true);
  // 初回データ読み込みの実進捗（LoadingBarに渡す。0-100）
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [summaryCounts, setSummaryCounts] = useState(null);
  const typesFetchStartedRef = useRef(false);
  const typesFetchPromiseRef = useRef(null);
  const ensureTypesLoaderRef = useRef(null);
  const fetchDataRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const fetchAbortRef = useRef(null);
  const insectDataLoadTimerRef = useRef(null);
  const insectDataLoadScheduledRef = useRef(false);
  const insectDataInteractionCleanupRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    try {
      // 1. 保存された設定があればそれを使用
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
      // 2. OS設定を確認
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    } catch {
      return 'light';
    }
  });
  const cacheLoadedRef = useRef(false);
  const cachedVersionRef = useRef(null);
  
  const isExplorerPage = isExplorerRoutePath(location.pathname);
  const shouldForceDocumentNavigation = isStaticDocumentPath(location.pathname);
  const skipToMainHref = buildCurrentHashHref(location, 'main-content');

  const handleSkipToMainContent = (event) => {
    if (typeof document === 'undefined') return;
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    event.preventDefault();
    try {
      mainContent.focus({ preventScroll: true });
    } catch {}
    scrollElementWithOffset(mainContent, {
      behavior: 'auto',
      extraOffset: 0,
      updateHashId: 'main-content',
    });
  };

  // パフォーマンス: スクロール中は body.is-scrolling を付与し、CSS 側で backdrop-blur を一時無効化する
  // （重なったブラーのGPU負荷でローエンド端末がジャンクするのを防ぐ。静止時の見た目は不変）
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let timer = null;
    const onScroll = () => {
      document.body.classList.add('is-scrolling');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.remove('is-scrolling'), 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
      document.body.classList.remove('is-scrolling');
    };
  }, []);

  // SEO: avoid indexing search result pages (with query params)
  useEffect(() => {
    try {
      const isSpa404Fallback =
        typeof window !== 'undefined' &&
        (window.__SEO_FORCE_NOINDEX__ === true || location.pathname === '/404.html');
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
        params.has('igroup') ||
        params.has('imonth') ||
        params.has('pfamily') ||
        params.has('porder') ||
        params.has('pvisit') ||
        params.has('redirect');
      setRobotsMetaContent(
        isSpa404Fallback || hasSearch ? NOINDEX_FOLLOW_ROBOTS : INDEX_FOLLOW_ROBOTS,
      );
    } catch {}
  }, [location.pathname, location.search]);

  // SPA遷移（リンククリック等のPUSH）でページが変わったら先頭から表示する。
  // POP（戻る/進む）は除外: Explorerが一覧のスクロール位置を復元するのを妨げない。
  // REPLACE（URL正規化リダイレクト）も除外: 表示中の位置を動かさない。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigationType !== 'PUSH') return;
    if (location.hash) return;
    window.scrollTo(0, 0);
    // スクリーンリーダー・キーボード利用者にページ遷移を伝えるため本文へフォーカスを移す
    // （フォーカスが前ページのリンク位置に残ったままにならないように）
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      try {
        mainContent.focus({ preventScroll: true });
      } catch {
        mainContent.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!shouldForceDocumentNavigation || typeof window === 'undefined') return undefined;
    const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const timerId = window.setTimeout(() => {
      window.location.replace(target);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [
    shouldForceDocumentNavigation,
    location.hash,
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // index.html のFOUC防止スクリプトが設定したインラインcolor-schemeを追従させる
      document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
    } catch (error) {
      logger.debug('Theme change error (harmless):', error);
    }
  }, [theme]);

  // OS設定変更の監視（ユーザーが手動設定していない場合のみ）
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      try {
        // 手動設定がない場合のみOS設定に追従
        const saved = localStorage.getItem('theme');
        if (!saved) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      } catch {}
    };

    // 新しいイベントリスナーAPI（Safari 14+対応）
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // 古いAPI（Safari 13以前）
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const hasDatasetRef = useRef(false);
  const applyDataset = (data = {}) => {
    const mothArr = Array.isArray(data.moths) ? data.moths : [];
    const butterflyArr = Array.isArray(data.butterflies) ? data.butterflies : [];
    const beetleArr = Array.isArray(data.beetles) ? data.beetles : [];
    const longhornArr = Array.isArray(data.longhornbeetles) ? data.longhornbeetles : [];
    const leafArr = Array.isArray(data.leafbeetles) ? data.leafbeetles : [];
    const aphidArr = Array.isArray(data.aphids) ? data.aphids : [];
    setMoths(mothArr);
    setButterflies(butterflyArr);
    setBeetles(beetleArr);
    setLonghornbeetles(longhornArr);
    setLeafbeetles(leafArr);
    setAphids(aphidArr);
    setHostPlants(data.hostPlants || {});
    setFlowerVisitPlants(
      data.flowerVisitPlants ||
        buildFlowerVisitMap([
          ...mothArr,
          ...butterflyArr,
          ...beetleArr,
          ...longhornArr,
          ...leafArr,
          ...aphidArr,
        ]),
    );
    setPlantDetails(data.plantDetails || {});
    if (data.summaryCounts) {
      setSummaryCounts(data.summaryCounts);
    }
    const hasAny =
      mothArr.length +
        butterflyArr.length +
        beetleArr.length +
        longhornArr.length +
        leafArr.length +
        aphidArr.length >
        0 ||
      Object.keys(data.hostPlants || {}).length > 0;
    hasDatasetRef.current = hasAny;
    cacheLoadedRef.current = cacheLoadedRef.current || hasAny;
  };

  useEffect(() => {
    const loadIndexes = () => loadInsectImageIndexes().catch(() => {});
    let timerId = null;
    let idleId = null;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(loadIndexes, { timeout: 2500 });
    } else if (typeof window !== 'undefined') {
      timerId = window.setTimeout(loadIndexes, 1800);
    } else {
      loadIndexes();
    }

    return () => {
      if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timerId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    const fetchData = async (cachedVersion = null) => {
      const isDevelopment = import.meta.env.DEV;
      const allowDebugLogs =
        isDevelopment || (typeof window !== 'undefined' && !!window.DEBUG_LOGS);
      const fetchId = ++fetchSeqRef.current;
      if (fetchAbortRef.current) {
        try {
          fetchAbortRef.current.abort();
        } catch {}
      }
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      fetchAbortRef.current = controller;
      const externalSignal = controller?.signal || null;
      const isCurrent = () => fetchId === fetchSeqRef.current;
      const shouldContinue = () => (!externalSignal || !externalSignal.aborted) && isCurrent();

      if (!cacheLoadedRef.current) {
        setLoading(true);
      }
      setLoadError(null);
      const base = import.meta.env.BASE_URL || '/';
      let plantDetailsLite = {};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const fetchWithRetry = async (url, opts = {}, retries = 4, delay = 300) => {
        let lastErr = null;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            const res = await fetch(url, { ...opts, signal: externalSignal || opts.signal });
            if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
              await sleep(delay * Math.pow(2, attempt));
              continue;
            }
            return res;
          } catch (error) {
            lastErr = error;
            if (externalSignal?.aborted) throw error;
            if (attempt < retries) {
              await sleep(delay * Math.pow(2, attempt));
              continue;
            }
            throw error;
          }
        }
        throw lastErr || new Error('fetch failed');
      };
      const cacheMode = import.meta.env.DEV ? 'no-store' : 'default';
      const appVersionSuffix = import.meta.env.DEV
        ? `?v=${Date.now()}`
        : APP_BUILD_ID
          ? `?v=${encodeURIComponent(APP_BUILD_ID)}`
          : '';
      const fallbackVersionSuffix = appVersionSuffix;
      const buildLiteSummaryCounts = (lite = {}) => ({
        moths: Array.isArray(lite.moths) ? lite.moths.length : 0,
        butterflies: Array.isArray(lite.butterflies) ? lite.butterflies.length : 0,
        beetles: Array.isArray(lite.beetles) ? lite.beetles.length : 0,
        longhornbeetles: Array.isArray(lite.longhornbeetles) ? lite.longhornbeetles.length : 0,
        leafbeetles: Array.isArray(lite.leafbeetles) ? lite.leafbeetles.length : 0,
        aphids: Array.isArray(lite.aphids) ? lite.aphids.length : 0,
        hostPlants:
          lite.hostPlants && typeof lite.hostPlants === 'object'
            ? Object.keys(lite.hostPlants).length
            : 0,
      });
      const applyLiteIndex = (lite) => {
        if (!lite || !Array.isArray(lite.moths) || !Array.isArray(lite.butterflies)) return false;
        setLoadProgress(90);
        setMoths(lite.moths);
        setButterflies(lite.butterflies);
        setBeetles(lite.beetles || []);
        setLonghornbeetles(lite.longhornbeetles || []);
        setLeafbeetles(lite.leafbeetles || []);
        setAphids(lite.aphids || []);
        setHostPlants(lite.hostPlants || {});
        setPlantDetails(lite.plantDetails || {});
        setSummaryCounts(lite.summaryCounts || buildLiteSummaryCounts(lite));
        setLoading(false);
        ensureTypesLoaderRef.current = () => {
          typesFetchStartedRef.current = true;
          typesFetchPromiseRef.current = Promise.resolve(null);
        };
        return true;
      };
      const tryFullDataset = async (versionSuffix) => {
        try {
          const fullRes = await fetchWithRetry(
            `${base}assets/data-lite/full-dataset.json${versionSuffix}`,
            { cache: cacheMode },
          );
          if (!shouldContinue()) return false;
          if (!fullRes.ok) return false;
          const fullData = await fullRes.json();
          if (!shouldContinue()) return false;
          return applyLiteIndex(fullData);
        } catch {
          return false;
        }
      };
      const tryLiteIndex = async (versionSuffix) => {
        try {
          const liteUrl = `${base}assets/data-lite/index.json${versionSuffix || fallbackVersionSuffix}`;
          const res = await fetchWithRetry(liteUrl, { cache: cacheMode });
          if (!shouldContinue()) return false;
          if (!res.ok) return false;
          const lite = await res.json();
          if (!shouldContinue()) return false;
          return applyLiteIndex(lite);
        } catch {
          return false;
        }
      };
      // Prefer split JSON in production and fall back to the combined index only if needed.
      try {
        setLoadProgress(10);
        const manifestUrl = `${base}assets/data-lite/manifest.json${appVersionSuffix}`;
        // Allow HTTP cache in production (versioned URL keeps data fresh) to speed up repeats
        const manifestRes = await fetchWithRetry(manifestUrl, { cache: cacheMode });
        if (!shouldContinue()) return;
        let versionSuffix = import.meta.env.DEV ? `?v=${Date.now()}` : '';
        let manifest = null;
        let manifestVersion = null;
        if (manifestRes?.ok) {
          manifest = await manifestRes.json();
          if (!shouldContinue()) return;
          setLoadProgress(35);
          manifestVersion = manifest?.version || null;
          if (manifest?.counts && !cacheLoadedRef.current) {
            setSummaryCounts((prev) => prev || manifest.counts);
            setLoading(false);
          }
          versionSuffix = import.meta.env.DEV
            ? `?v=${Date.now()}`
            : manifestVersion
              ? `?v=${manifestVersion}`
              : '';
          const hostUrl = `${base}assets/data-lite/hostplants.json${versionSuffix}`;
          const plantDetailsUrl = `${base}assets/data-lite/plant-details.json${versionSuffix}`;
          const flowerVisitUrl = `${base}assets/data-lite/flower-visit-plants.json${versionSuffix}`;

          if (manifest && manifest.counts) {
            cachedVersionRef.current = manifestVersion;
            // 再訪高速化: IndexedDBキャッシュが最新版なら重いデータの再取得をすべてスキップ
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

            const fetchJsonOrNull = async (url, label) => {
              try {
                const res = await fetchWithRetry(url, { cache: cacheMode });
                if (!shouldContinue() || !res?.ok) return null;
                return await res.json();
              } catch (error) {
                logger.debug(`${label} preload skipped:`, error);
                return null;
              }
            };

            // 植物系JSONと昆虫パーティションを並列で取得する
            // （従来は植物系の完了を待ってから昆虫パーティションを開始する直列2波だった）
            const hostMapPromise = fetchJsonOrNull(hostUrl, 'Host plants');
            const plantDetailsPromise = fetchJsonOrNull(plantDetailsUrl, 'Plant details');
            const flowerVisitPromise = fetchJsonOrNull(flowerVisitUrl, 'Flower-visit');

            // 再訪時に即時復元できるよう、取得済みデータをアイドル時にIndexedDBへ保存する
            const scheduleDatasetCacheSave = (payload) => {
              if (typeof window === 'undefined' || !payload) return;
              if (shouldDeferHeavyWork()) return;
              const fire = () => {
                saveDatasetToCache(manifestVersion || null, payload).catch(() => {});
              };
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(fire, { timeout: 10000 });
              } else {
                window.setTimeout(fire, 3000);
              }
            };

            // Reset fetch guards for fresh lifecycle
            typesFetchStartedRef.current = false;
            typesFetchPromiseRef.current = null;

            const loadTypePartitions = async () => {
              const responses = await Promise.all([
                fetchWithRetry(`${base}assets/data-lite/moths.json${versionSuffix}`, { cache: cacheMode }),
                fetchWithRetry(`${base}assets/data-lite/butterflies.json${versionSuffix}`, { cache: cacheMode }),
                fetchWithRetry(`${base}assets/data-lite/beetles.json${versionSuffix}`, { cache: cacheMode }),
                fetchWithRetry(`${base}assets/data-lite/longhornbeetles.json${versionSuffix}`, { cache: cacheMode }),
                fetchWithRetry(`${base}assets/data-lite/leafbeetles.json${versionSuffix}`, { cache: cacheMode }),
                fetchWithRetry(`${base}assets/data-lite/aphids.json${versionSuffix}`, { cache: cacheMode }),
              ]);
              if (!shouldContinue()) {
                return { mothArr: [], butterArr: [], beetleArr: [], longhornArr: [], leafArr: [], aphidArr: [] };
              }
              const [mothRes, butterflyRes, beetleRes, longhornRes, leafRes, aphidRes] = responses;
              const safeJson = async (res) => (res && res.ok ? res.json() : []);
              const [mothArr, butterArr, beetleArr, longhornArr, leafArr, aphidArr] = await Promise.all([
                safeJson(mothRes),
                safeJson(butterflyRes),
                safeJson(beetleRes),
                safeJson(longhornRes),
                safeJson(leafRes),
                safeJson(aphidRes),
              ]);
              if (!shouldContinue()) {
                return { mothArr: [], butterArr: [], beetleArr: [], longhornArr: [], leafArr: [], aphidArr: [] };
              }
              if (Array.isArray(mothArr)) setMoths(mothArr);
              if (Array.isArray(butterArr)) setButterflies(butterArr);
              if (Array.isArray(beetleArr)) setBeetles(beetleArr);
              if (Array.isArray(longhornArr)) setLonghornbeetles(longhornArr);
              if (Array.isArray(leafArr)) setLeafbeetles(leafArr);
              if (Array.isArray(aphidArr)) setAphids(aphidArr);
              setLoadProgress((prev) => Math.max(prev, 90));
              setSummaryCounts((prev) => ({
                ...(prev || {}),
                moths: Array.isArray(mothArr) ? mothArr.length : 0,
                butterflies: Array.isArray(butterArr) ? butterArr.length : 0,
                beetles: Array.isArray(beetleArr) ? beetleArr.length : 0,
                longhornbeetles: Array.isArray(longhornArr) ? longhornArr.length : 0,
                leafbeetles: Array.isArray(leafArr) ? leafArr.length : 0,
                aphids: Array.isArray(aphidArr) ? aphidArr.length : 0,
              }));
              let flowerVisitPayload = await flowerVisitPromise;
              if (!flowerVisitPayload || typeof flowerVisitPayload !== 'object') {
                flowerVisitPayload = {};
              }
              if (Object.keys(flowerVisitPayload).length === 0) {
                flowerVisitPayload = buildFlowerVisitMap([
                  ...(mothArr || []),
                  ...(butterArr || []),
                  ...(beetleArr || []),
                  ...(longhornArr || []),
                  ...(leafArr || []),
                  ...(aphidArr || []),
                ]);
                setFlowerVisitPlants(flowerVisitPayload);
              }
              // 全パーティションと植物系データが揃ったら、再訪用キャッシュの保存を予約
              const [hostMapForCache, plantDetailsForCache] = await Promise.all([
                hostMapPromise,
                plantDetailsPromise,
              ]);
              if (shouldContinue() && hostMapForCache && typeof hostMapForCache === 'object') {
                scheduleDatasetCacheSave({
                  moths: mothArr || [],
                  butterflies: butterArr || [],
                  beetles: beetleArr || [],
                  longhornbeetles: longhornArr || [],
                  leafbeetles: leafArr || [],
                  aphids: aphidArr || [],
                  hostPlants: hostMapForCache,
                  flowerVisitPlants: flowerVisitPayload,
                  plantDetails:
                    plantDetailsForCache && typeof plantDetailsForCache === 'object'
                      ? plantDetailsForCache
                      : {},
                  summaryCounts: {
                    ...manifest.counts,
                    moths: Array.isArray(mothArr) ? mothArr.length : 0,
                    butterflies: Array.isArray(butterArr) ? butterArr.length : 0,
                    beetles: Array.isArray(beetleArr) ? beetleArr.length : 0,
                    longhornbeetles: Array.isArray(longhornArr) ? longhornArr.length : 0,
                    leafbeetles: Array.isArray(leafArr) ? leafArr.length : 0,
                    aphids: Array.isArray(aphidArr) ? aphidArr.length : 0,
                    hostPlants: Object.keys(hostMapForCache).length,
                  },
                });
              }
              return { mothArr, butterArr, beetleArr, longhornArr, leafArr, aphidArr };
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

            let loadTypesImmediately = false;
            try {
              const params = new URLSearchParams(
                typeof window !== 'undefined' ? window.location.search || '' : '',
              );
              const pathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
              loadTypesImmediately = shouldLoadInsectPartitionsImmediately(pathname, params);
            } catch (error) {
              logger.debug('Failed to interpret route data need, fetching insects immediately:', error);
              loadTypesImmediately = true;
            }

            // 昆虫パーティションのダウンロードを植物系JSONと同時に開始する
            const typesPromise = loadTypesImmediately ? startFetchTypes() : null;

            const hostMap = await hostMapPromise;
            if (!shouldContinue()) return;
            if (hostMap && typeof hostMap === 'object') {
              setLoadProgress((prev) => Math.max(prev, 65));
              const plantDetailsPayload = await plantDetailsPromise;
              if (!shouldContinue()) return;
              plantDetailsLite =
                plantDetailsPayload && typeof plantDetailsPayload === 'object'
                  ? plantDetailsPayload
                  : {};
              const flowerVisitPayload = await flowerVisitPromise;
              const preloadedFlowerVisitPlants =
                flowerVisitPayload && typeof flowerVisitPayload === 'object'
                  ? flowerVisitPayload
                  : {};

              const computedCounts = {
                ...manifest.counts,
                hostPlants: Object.keys(hostMap || {}).length,
              };

              // 版が更新されている場合はキャッシュ由来の状態も置き換える（新旧データの混在防止）
              setSummaryCounts(computedCounts);
              setHostPlants(hostMap);
              setPlantDetails(plantDetailsLite);
              if (Object.keys(preloadedFlowerVisitPlants).length > 0) {
                setFlowerVisitPlants(preloadedFlowerVisitPlants);
              }

              if (typesPromise) {
                await typesPromise;
                if (!shouldContinue()) return;
              }
              setLoading(false);

              return;
            }
            // hostplants.json が取得できなかった場合は一括データセットへフォールバック
          }
          if (await tryFullDataset(versionSuffix)) return;
          if (await tryLiteIndex(versionSuffix)) return;
        } else {
        // manifest.json が取得できなかった場合のフォールバック
        if (await tryFullDataset(versionSuffix)) return;
        if (await tryLiteIndex(versionSuffix)) return;
      }
      } catch (_) {
        if (await tryFullDataset(fallbackVersionSuffix)) return;
        if (await tryLiteIndex(fallbackVersionSuffix)) return;
        // ignore and fallback to full pipeline
      }
      if (import.meta.env.PROD) {
        if (shouldContinue() && !(cacheLoadedRef.current || hasDatasetRef.current)) {
          setLoading(false);
          setLoadError(new Error('Lite dataset unavailable'));
        }
        return;
      }
      // ここから先はDEV専用のレガシーCSVパイプライン。
      // 本番は上のdata-lite経路で完結する（PRODは直前で早期return済み）ため、
      // 動的importで分離してメインバンドルに含めない。
      const { runLegacyCsvPipeline } = await import('./services/legacyCsvPipeline');
      await runLegacyCsvPipeline({
        shouldContinue,
        externalSignal,
        allowDebugLogs,
        isDevelopment,
        plantDetailsLite,
        sleep,
        cachedVersionRef,
        cacheLoadedRef,
        hasDatasetRef,
        setMoths,
        setButterflies,
        setBeetles,
        setLonghornbeetles,
        setLeafbeetles,
        setAphids,
        setHostPlants,
        setPlantDetails,
        setFlowerVisitPlants,
        setSummaryCounts,
        setLoading,
        setLoadError,
      });
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
      if (fetchAbortRef.current) {
        try {
          fetchAbortRef.current.abort();
        } catch {}
      }
      if (insectDataLoadTimerRef.current) {
        window.clearTimeout(insectDataLoadTimerRef.current);
        insectDataLoadTimerRef.current = null;
      }
      insectDataInteractionCleanupRef.current && insectDataInteractionCleanupRef.current();
      insectDataInteractionCleanupRef.current = null;
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

  const hasLoadedInsectPartitions =
    moths.length +
      butterflies.length +
      beetles.length +
      longhornbeetles.length +
      leafbeetles.length +
      aphids.length >
    0;

  const clearScheduledInsectDataLoad = () => {
    if (insectDataLoadTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(insectDataLoadTimerRef.current);
      insectDataLoadTimerRef.current = null;
    }
    insectDataInteractionCleanupRef.current && insectDataInteractionCleanupRef.current();
    insectDataInteractionCleanupRef.current = null;
    insectDataLoadScheduledRef.current = false;
  };

  const runInsectDataLoad = () => {
    clearScheduledInsectDataLoad();
    try {
      ensureTypesLoaderRef.current && ensureTypesLoaderRef.current();
    } catch {}
  };

  const currentRouteNeedsInsectsImmediately = () => {
    try {
      const params = new URLSearchParams(location.search || '');
      return shouldLoadInsectPartitionsImmediately(location.pathname || '/', params);
    } catch {
      return true;
    }
  };

  const triggerInsectsDataLoad = ({ immediate = false } = {}) => {
    if (hasLoadedInsectPartitions) return;
    if (immediate || currentRouteNeedsInsectsImmediately()) {
      runInsectDataLoad();
      return;
    }
    if (insectDataLoadScheduledRef.current || typeof window === 'undefined') return;
    insectDataLoadScheduledRef.current = true;

    const handleInteraction = () => runInsectDataLoad();
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, handleInteraction, { once: true, passive: true });
    });
    insectDataInteractionCleanupRef.current = () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleInteraction);
      });
    };
    insectDataLoadTimerRef.current = window.setTimeout(runInsectDataLoad, 1800);
  };

  const triggerPlantsDataLoad = () => {
    triggerInsectsDataLoad();
  };

  // fallbackはルートのレイアウトに合わせて出し分ける
  // （詳細ページに一覧用スケルトンを出すと、実レイアウトとの差でシフトが大きい）
  const renderWithChunkBoundary = (element, fallback = <SkeletonLoader />) => (
    <ChunkErrorBoundary>
      <React.Suspense fallback={fallback}>
        {element}
      </React.Suspense>
    </ChunkErrorBoundary>
  );

  const explorerBaseProps = {
    moths,
    butterflies,
    beetles,
    longhornbeetles,
    leafbeetles,
    aphids,
    hostPlants,
    flowerVisitPlants,
    plantDetails,
    theme,
    setTheme,
    summaryCounts,
    locale,
    onNeedInsectsData: triggerInsectsDataLoad,
    onNeedPlantsData: triggerPlantsDataLoad,
  };

  const detailBaseProps = {
    moths,
    butterflies,
    beetles,
    longhornbeetles,
    leafbeetles,
    aphids,
    hostPlants,
    flowerVisitPlants,
    plantDetails,
    theme,
    locale,
  };

  const routeConfigs = [
    ...EXPLORER_ROUTE_CONFIGS.map(({ path, initialTab }) => ({
      path,
      element: (
        <InsectsHostPlantExplorer
          {...explorerBaseProps}
          initialTab={initialTab}
        />
      ),
    })),
    {
      path: '/quiz',
      element: <QuizPage {...detailBaseProps} />,
    },
    {
      path: '/en/quiz',
      element: <QuizPage {...detailBaseProps} />,
    },
    ...INSECT_DETAIL_ROUTE_PATTERNS.map((path) => ({
      path,
      element: <MothDetail {...detailBaseProps} />,
      fallback: <DetailSkeleton />,
    })),
    {
      path: '/plant/:plantName',
      element: <HostPlantDetail {...detailBaseProps} />,
      fallback: <DetailSkeleton />,
    },
    {
      path: '/en/plant/:plantName',
      element: <HostPlantDetail {...detailBaseProps} />,
      fallback: <DetailSkeleton />,
    },
    {
      path: '*',
      element: <NotFoundPage locale={locale} />,
    },
  ];

  if (shouldForceDocumentNavigation) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <LoadingBar isLoading={true} />
        <main
          id="main-content"
          role="main"
          className="min-h-[40vh] px-4 py-16 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200/80 bg-white/85 px-6 py-8 text-center shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isEnglish
                ? 'Opening the requested page...'
                : 'ページを開いています...'}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {isEnglish
                ? 'Switching from the app view to the standalone page.'
                : 'アプリ画面から個別ページへ切り替えています。'}
            </p>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {/* グローバルローディングバー */}
      <LoadingBar isLoading={loading} progress={loadProgress} />
      <a
        href={skipToMainHref}
        onClick={handleSkipToMainContent}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-white focus:text-slate-900 focus:shadow-lg"
      >
        {isEnglish ? 'Skip to main content' : '本文へスキップ'}
      </a>
      <Header
        locale={locale}
        theme={theme}
        setTheme={setTheme}
        moths={moths}
        butterflies={butterflies}
        beetles={beetles}
        longhornbeetles={longhornbeetles}
        leafbeetles={leafbeetles}
        aphids={aphids}
        hostPlants={hostPlants}
        plantDetails={plantDetails}
      />

      {loadError && (
        <div className="px-4 sm:px-6 lg:px-8 mt-4">
          <div
            role="alert"
            className="max-w-6xl mx-auto rounded-2xl border border-red-200/70 dark:border-red-700/60 bg-red-50/90 dark:bg-red-900/30 px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="text-sm text-red-700 dark:text-red-200">
              {isEnglish
                ? 'Failed to load the dataset. Check the network connection and retry.'
                : 'データの読み込みに失敗しました。通信状態を確認して再試行してください。'}
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
              {isEnglish ? 'Retry' : '再読み込み'}
            </button>
          </div>
        </div>
      )}

      <main id="main-content" role="main" tabIndex={-1}>
        {loading ? (
          routeConfigs.some(({ path, fallback }) => fallback && matchPath({ path, end: true }, location.pathname))
            ? <DetailSkeleton />
            : <SkeletonLoader />
        ) : (
        <Routes>
          {routeConfigs.map(({ path, element, fallback }) => (
            <Route
              key={path}
              path={path}
              element={renderWithChunkBoundary(element, fallback)}
            />
          ))}
        </Routes>
      )}
      </main>
        <FloatingActionButton />
      {/* 404（キャッチオール）では広告を出さない: 低価値ページへの広告はポリシー上も体験上も避ける */}
      {routeConfigs.some(({ path }) => path !== '*' && matchPath({ path, end: true }, location.pathname)) && (
        <ManualAdSlot
          placement="footer"
          locale={locale}
          className="mx-auto mt-10 w-[min(100%-1rem,64rem)] sm:mt-12"
          minHeight="min-h-[96px]"
        />
      )}
      <Footer locale={locale} />
    </div>
  );
}
export default App;
