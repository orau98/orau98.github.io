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
import fetchWithRetryShared from './utils/fetchWithRetry';
import { getLocaleFromPath, isEnglishLocale } from './utils/locale';
import {
  buildCurrentHashHref,
  findSectionTarget,
  isVisibleSectionTarget,
  scrollElementWithOffset,
} from './utils/sectionNavigation';
import {
  EXPLORER_ROUTE_CONFIGS,
  INSECT_COLLECTION_KEYS,
  INSECT_DETAIL_ROUTE_PATTERNS,
} from './utils/siteTaxonomy';
import { isStaticDocumentPath } from './utils/staticDocumentPaths';
import { hasExplorerResultQuery } from './utils/explorerQueryParams';
import {
  getInsectDetailCollectionKey,
  shouldLoadInsectPartitionsImmediately,
} from './utils/insectDataLoading';
import {
  buildAppVersionSuffix,
  buildDataLiteAssetUrl,
  buildLiteSummaryCounts,
  buildPartitionVersionSuffix,
  getCollectionPartitionFile,
  isDatasetCacheComplete,
  isLiteIndexPayload,
  normalizeDatasetPayload,
  normalizePlantPartitions,
  planInitialDataLoad,
  selectCollectionKeysToLoad,
} from './utils/dataLitePlan';

const APP_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : '';

// 静的パス強制遷移のループ検知窓。この時間内に同じURLで再びSPAが起動したら
// 「サーバーが静的ファイルではなくSPAシェルを返している」と判断する
const STATIC_DOC_NAV_LOOP_WINDOW_MS = 10000;

function App() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locale = getLocaleFromPath(location.pathname);
  const isEnglish = isEnglishLocale(locale);
  const [moths, setMoths] = useState([]);
  const [butterflies, setButterflies] = useState([]);
  const [beetles, setBeetles] = useState([]);
  const [longhornbeetles, setLonghornbeetles] = useState([]);
  const [barkbeetles, setBarkbeetles] = useState([]);
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
  const typesFetchPromiseRef = useRef(null);
  const ensureTypesLoaderRef = useRef(null);
  const ensurePlantsLoaderRef = useRef(null);
  const plantsFetchPromiseRef = useRef(null);
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
  
  // 静的ドキュメントパス(/meta/等)のセーフティネット(location.replace)が
  // 無限フルリロードに陥らないためのガード:
  // - __IS_SPA_404__: サーバーが404フォールバックとしてSPAを配信した
  //   (=その静的ファイルは存在しない)。再遷移しても同じ404が返るだけ
  // - sessionStorageスタンプ: 直近に同じURLへ強制遷移したのに再びSPAが
  //   起動した(=devサーバー等がSPAシェルで応答する環境)。この場合も再遷移は
  //   ループにしかならないので、SPA側のNotFoundにフォールバックする
  const [staticDocNavBlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.__IS_SPA_404__ === true) return true;
    try {
      const stamp = Number(
        sessionStorage.getItem(`static-doc-nav:${window.location.pathname}`) || 0,
      );
      return Date.now() - stamp < STATIC_DOC_NAV_LOOP_WINDOW_MS;
    } catch {
      return false;
    }
  });
  const shouldForceDocumentNavigation =
    isStaticDocumentPath(location.pathname) && !staticDocNavBlocked;
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
      const hasSearch = hasExplorerResultQuery(params);
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

  // #セクションID 付きURLの直リンク・リロード・戻る/進むで該当セクションへ
  // スクロールする（目次ジャンプが書き込むハッシュURLを開き直しても先頭に
  // 留まってしまう穴を塞ぐ）。セクションは非同期データの描画後に現れるため、
  // 可視ターゲットが見つかるまでリトライして待つ。ユーザーが自分で
  // スクロールし始めたら奪わずに中止する
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const id = (location.hash || '').slice(1);
    if (!id || id === 'main-content') return undefined;
    let cancelled = false;
    let attempts = 0;
    let timer = null;
    const cancel = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchmove', cancel);
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchmove', cancel, { passive: true });
    const tryScroll = () => {
      if (cancelled) return;
      const target = findSectionTarget(id);
      if (target && isVisibleSectionTarget(target)) {
        scrollElementWithOffset(target, { behavior: 'auto', extraOffset: 16 });
        cancel();
        return;
      }
      attempts += 1;
      if (attempts < 12) {
        timer = setTimeout(tryScroll, 500);
      } else {
        cancel();
      }
    };
    timer = setTimeout(tryScroll, 100);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!shouldForceDocumentNavigation || typeof window === 'undefined') return undefined;
    const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const timerId = window.setTimeout(() => {
      try {
        // ループ検知用スタンプ: 遷移後に再びSPAが起動したらループと判定する
        sessionStorage.setItem(
          `static-doc-nav:${window.location.pathname}`,
          String(Date.now()),
        );
      } catch {}
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
    const normalized = normalizeDatasetPayload(data);
    setMoths(normalized.collections.moths);
    setButterflies(normalized.collections.butterflies);
    setBeetles(normalized.collections.beetles);
    setLonghornbeetles(normalized.collections.longhornbeetles);
    setBarkbeetles(normalized.collections.barkbeetles);
    setLeafbeetles(normalized.collections.leafbeetles);
    setAphids(normalized.collections.aphids);
    setHostPlants(normalized.hostPlants);
    setFlowerVisitPlants(normalized.flowerVisitPlants);
    setPlantDetails(normalized.plantDetails);
    if (normalized.summaryCounts) {
      setSummaryCounts(normalized.summaryCounts);
    }
    hasDatasetRef.current = normalized.hasAny;
    cacheLoadedRef.current = cacheLoadedRef.current || normalized.hasAny;
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
      plantsFetchPromiseRef.current = null;
      ensurePlantsLoaderRef.current = null;
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
      // データ取得は「レスポンスを返し呼び出し側が res.ok を見る」契約で共有utilを使う
      const fetchWithRetry = (url, opts = {}) =>
        fetchWithRetryShared(
          url,
          { ...opts, signal: externalSignal || opts.signal },
          { retries: 4, delay: 300 },
        );
      const cacheMode = import.meta.env.DEV ? 'no-store' : 'default';
      const appVersionSuffix = buildAppVersionSuffix({
        isDevelopment,
        buildId: APP_BUILD_ID,
      });
      const fallbackVersionSuffix = appVersionSuffix;
      const applyLiteIndex = (lite) => {
        if (!isLiteIndexPayload(lite)) return false;
        setLoadProgress(90);
        setMoths(lite.moths);
        setButterflies(lite.butterflies);
        setBeetles(lite.beetles || []);
        setLonghornbeetles(lite.longhornbeetles || []);
        setBarkbeetles(lite.barkbeetles || []);
        setLeafbeetles(lite.leafbeetles || []);
        setAphids(lite.aphids || []);
        setHostPlants(lite.hostPlants || {});
        setPlantDetails(lite.plantDetails || {});
        setSummaryCounts(lite.summaryCounts || buildLiteSummaryCounts(lite));
        setLoading(false);
        ensureTypesLoaderRef.current = () => {
          typesFetchPromiseRef.current = Promise.resolve(null);
        };
        return true;
      };
      const tryFullDataset = async (versionSuffix) => {
        try {
          const fullRes = await fetchWithRetry(
            buildDataLiteAssetUrl(base, 'full-dataset.json', versionSuffix),
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
          const liteUrl = buildDataLiteAssetUrl(
            base,
            'index.json',
            versionSuffix || fallbackVersionSuffix,
          );
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
        const manifestUrl = buildDataLiteAssetUrl(
          base,
          'manifest.json',
          appVersionSuffix,
        );
        // Allow HTTP cache in production (versioned URL keeps data fresh) to speed up repeats
        const manifestRes = await fetchWithRetry(manifestUrl, { cache: cacheMode });
        if (!shouldContinue()) return;
        let versionSuffix = buildPartitionVersionSuffix({ isDevelopment });
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
          versionSuffix = buildPartitionVersionSuffix({
            isDevelopment,
            manifestVersion,
          });
          const hostUrl = buildDataLiteAssetUrl(base, 'hostplants.json', versionSuffix);
          const plantDetailsUrl = buildDataLiteAssetUrl(
            base,
            'plant-details.json',
            versionSuffix,
          );
          const flowerVisitUrl = buildDataLiteAssetUrl(
            base,
            'flower-visit-plants.json',
            versionSuffix,
          );

          if (manifest && manifest.counts) {
            cachedVersionRef.current = manifestVersion;
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

            const loadPlantPartitions = async () => {
              const [hostMap, plantDetailsPayload, flowerVisitPayload] = await Promise.all([
                fetchJsonOrNull(hostUrl, 'Host plants'),
                fetchJsonOrNull(plantDetailsUrl, 'Plant details'),
                fetchJsonOrNull(flowerVisitUrl, 'Flower-visit'),
              ]);
              if (!shouldContinue()) return null;
              const plantPayload = normalizePlantPartitions({
                hostMap,
                plantDetails: plantDetailsPayload,
                flowerVisitPlants: flowerVisitPayload,
              });
              if (!plantPayload) return null;

              plantDetailsLite = plantPayload.plantDetails;
              setHostPlants(plantPayload.hostMap);
              setPlantDetails(plantDetailsLite);
              if (Object.keys(plantPayload.flowerVisitPlants).length > 0) {
                setFlowerVisitPlants(plantPayload.flowerVisitPlants);
              }
              setSummaryCounts((prev) => ({
                ...(prev || {}),
                ...manifest.counts,
                hostPlants: Object.keys(plantPayload.hostMap).length,
              }));
              return plantPayload;
            };

            const startFetchPlants = () => {
              if (plantsFetchPromiseRef.current) return plantsFetchPromiseRef.current;
              const promise = loadPlantPartitions().catch((error) => {
                logger.warn('Failed to load plant partitions:', error);
                plantsFetchPromiseRef.current = null;
                return null;
              });
              plantsFetchPromiseRef.current = promise;
              return promise;
            };

            ensurePlantsLoaderRef.current = startFetchPlants;
            let initialPathname = '/';
            let initialParams = new URLSearchParams();
            try {
              initialPathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
              initialParams = new URLSearchParams(
                typeof window !== 'undefined' ? window.location.search || '' : '',
              );
            } catch {}
            const initialLoadPlan = planInitialDataLoad({
              pathname: initialPathname,
              search: initialParams,
              cacheLoaded: cacheLoadedRef.current,
              cachedVersion,
              manifestVersion,
            });
            const initialPlantsPromise = initialLoadPlan.loadPlantsImmediately
              ? startFetchPlants()
              : null;

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
            typesFetchPromiseRef.current = null;

            const collectionConfigs = {
              moths: { setter: setMoths },
              butterflies: { setter: setButterflies },
              beetles: { setter: setBeetles },
              longhornbeetles: { setter: setLonghornbeetles },
              barkbeetles: { setter: setBarkbeetles },
              leafbeetles: { setter: setLeafbeetles },
              aphids: { setter: setAphids },
            };
            const loadedCollectionLevels = new Map();
            const loadedCollectionData = {};

            const loadTypePartitions = async (
              requestedKeys = INSECT_COLLECTION_KEYS,
              detailLevel = 'catalog',
            ) => {
              const keys = selectCollectionKeysToLoad(
                requestedKeys,
                loadedCollectionLevels,
                detailLevel,
              );
              if (keys.length === 0) return {};

              const results = await Promise.all(
                keys.map(async (key) => {
                  const file = getCollectionPartitionFile(key, detailLevel);
                  const response = await fetchWithRetry(
                    buildDataLiteAssetUrl(base, file, versionSuffix),
                    { cache: cacheMode },
                  );
                  if (!response?.ok) return [key, null];
                  const records = await response.json();
                  return [key, Array.isArray(records) ? records : null];
                }),
              );
              if (!shouldContinue()) return {};

              const loadedCollections = {};
              results.forEach(([key, records]) => {
                if (!Array.isArray(records)) return;
                collectionConfigs[key].setter(records);
                loadedCollectionLevels.set(key, detailLevel);
                loadedCollections[key] = records;
                loadedCollectionData[key] = records;
              });
              setLoadProgress((prev) => Math.max(prev, 90));
              setSummaryCounts((prev) => ({ ...(prev || {}), ...manifest.counts }));
              const plantPayload = plantsFetchPromiseRef.current
                ? await plantsFetchPromiseRef.current
                : null;
              let flowerVisitPayload = plantPayload?.flowerVisitPlants || {};
              if (Object.keys(flowerVisitPayload).length === 0) {
                flowerVisitPayload = buildFlowerVisitMap(
                  Object.values(loadedCollections).flat(),
                );
                setFlowerVisitPlants(flowerVisitPayload);
              }
              // IndexedDBへは7分類がすべて揃った時だけ保存する。
              // 個別種ページ用の部分データで完全なキャッシュを上書きしない。
              if (isDatasetCacheComplete(loadedCollectionLevels, plantPayload)) {
                scheduleDatasetCacheSave({
                  ...loadedCollectionData,
                  hostPlants: plantPayload.hostMap,
                  flowerVisitPlants: flowerVisitPayload,
                  plantDetails: plantPayload.plantDetails || {},
                  summaryCounts: {
                    ...manifest.counts,
                    hostPlants: Object.keys(plantPayload.hostMap).length,
                  },
                });
              }
              return loadedCollections;
            };

            const startFetchTypes = (
              requestedKeys = INSECT_COLLECTION_KEYS,
              detailLevel = 'catalog',
            ) => {
              // 直接個別種ページ→一覧のように要求が増えた場合も、先行取得の完了後に
              // 未取得分類だけを追加する。重複取得はloadedCollectionKeysで防ぐ。
              const previous = typesFetchPromiseRef.current || Promise.resolve(null);
              const promise = previous
                .catch(() => null)
                .then(() => loadTypePartitions(requestedKeys, detailLevel))
                .catch((error) => {
                  logger.warn('Failed to load insect partitions:', error);
                  return null;
                });
              typesFetchPromiseRef.current = promise;
              return promise;
            };

            ensureTypesLoaderRef.current = startFetchTypes;

            // 版不一致時は全分類を直ちに揃える。通常の個別種ページは該当分類の
            // fullだけ、一覧は全分類のcatalogだけを取得する。
            const {
              loadPlantsImmediately,
              loadTypesImmediately,
              immediateCollectionKeys,
              immediateDetailLevel,
              followUpFullKey,
            } = initialLoadPlan;
            let typesPromise = loadTypesImmediately
              ? startFetchTypes(
                  immediateCollectionKeys,
                  immediateDetailLevel,
                )
              : null;
            if (followUpFullKey) {
              typesPromise = startFetchTypes([followUpFullKey], 'full');
            }

            const [plantPayload] = await Promise.all([
              initialPlantsPromise || Promise.resolve(null),
              typesPromise || Promise.resolve(null),
            ]);
            if (!shouldContinue()) return;

            const requiredTypesReady =
              !loadTypesImmediately ||
              immediateCollectionKeys.every((key) => loadedCollectionLevels.has(key));
            const requiredPlantsReady = !loadPlantsImmediately || Boolean(plantPayload?.hostMap);
            if (requiredTypesReady && requiredPlantsReady) {
              setLoadProgress(100);
              setLoading(false);
              return;
            }
            // 必須パーティションを取得できなかった場合は一括データセットへフォールバック
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
        setBarkbeetles,
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
      ensurePlantsLoaderRef.current = null;
      plantsFetchPromiseRef.current = null;
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

  // 一覧は軽量catalogで表示し、個別種へ移動した時だけ該当分類の
  // 文献・詳細食草を含む完全データへ差し替える。
  useEffect(() => {
    const collectionKey = getInsectDetailCollectionKey(location.pathname || '/');
    if (!collectionKey || !ensureTypesLoaderRef.current) return;
    ensureTypesLoaderRef.current([collectionKey], 'full');
  }, [location.pathname]);

  const hasLoadedInsectPartitions =
    moths.length +
      butterflies.length +
      beetles.length +
      longhornbeetles.length +
      barkbeetles.length +
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
    try {
      ensurePlantsLoaderRef.current && ensurePlantsLoaderRef.current();
    } catch {}
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
    barkbeetles,
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
    barkbeetles,
    leafbeetles,
    aphids,
    hostPlants,
    flowerVisitPlants,
    plantDetails,
    theme,
    locale,
    // /plant系ランディングでは昆虫パーティションが遅延読み込みのため、
    // 「まだ届いていない」と「本当に関連昆虫が0」を詳細ページ側で区別できるようにする
    insectPartitionsReady: hasLoadedInsectPartitions,
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
        barkbeetles={barkbeetles}
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
