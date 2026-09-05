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
import { createDataPartitionLoader, isCompleteDatasetPayload } from './services/dataPartitionLoader';
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
  planInitialDataLoad,
  isRouteDataReady,
  getRouteDataError,
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
  const partitionLoaderRef = useRef(null);
  const [partitionState, setPartitionState] = useState({ collectionLevels: {}, plantsReady: false, errors: {} });
  const [loaderGeneration, setLoaderGeneration] = useState(0);
  const routeLocationRef = useRef(location);
  routeLocationRef.current = location;
  const ensureTypesLoaderRef = useRef(null);
  const ensurePlantsLoaderRef = useRef(null);
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
    let cancelled = false;
    let installedLoaderId = 0;
    const setters = { moths: setMoths, butterflies: setButterflies, beetles: setBeetles,
      longhornbeetles: setLonghornbeetles, barkbeetles: setBarkbeetles,
      leafbeetles: setLeafbeetles, aphids: setAphids };
    const fetchData = async (cached = null) => {
      const fetchId = ++fetchSeqRef.current;
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      const isCurrent = () => !cancelled && !controller.signal.aborted && fetchId === fetchSeqRef.current;
      const base = import.meta.env.BASE_URL || '/';
      const appSuffix = buildAppVersionSuffix({ isDevelopment: import.meta.env.DEV, buildId: APP_BUILD_ID });
      const cacheMode = import.meta.env.DEV ? 'no-store' : 'default';
      setLoadError(null);
      setLoading(true);
      setLoadProgress(10);
      const readJson = async (file, suffix) => {
        const response = await fetchWithRetryShared(
          buildDataLiteAssetUrl(base, file, suffix),
          { cache: cacheMode, signal: controller.signal },
          { retries: 4, delay: 300 },
        );
        if (!response?.ok) throw new Error(`Dataset request failed: ${file} (${response?.status})`);
        return response.json();
      };
      const installLoader = (suffix, version, counts, initialPayload = null) => {
        const loaderId = ++installedLoaderId;
        const isActive = () => isCurrent() && loaderId === installedLoaderId;
        const loader = createDataPartitionLoader({
          readJson: (file) => readJson(file, suffix),
          initialPayload,
          summaryCounts: counts,
          isActive,
          onCollection: (key, records) => setters[key](records),
          onPlants: (plants) => {
            if (plants.hostPlants) setHostPlants(plants.hostPlants);
            if (plants.plantDetails) setPlantDetails(plants.plantDetails);
            if (plants.flowerVisitPlants) setFlowerVisitPlants(plants.flowerVisitPlants);
          },
          onState: (state) => {
            setPartitionState(state);
          },
          onComplete: (payload) => {
            if (shouldDeferHeavyWork()) return;
            const save = () => {
              // A superseded bootstrap/manifest must never write a stale cache.
              if (isActive()) saveDatasetToCache(version, payload).catch(() => {});
            };
            if ('requestIdleCallback' in window) window.requestIdleCallback(save, { timeout: 10000 });
            else window.setTimeout(save, 3000);
          },
        });
        partitionLoaderRef.current = loader;
        ensureTypesLoaderRef.current = loader.ensureTypes;
        ensurePlantsLoaderRef.current = loader.ensurePlants;
        setSummaryCounts(counts);
        setLoaderGeneration((value) => value + 1);
        setLoading(false);
        return loader;
      };
      let suffix = appSuffix;
      let manifestVersion = null;
      try {
        const manifest = await readJson('manifest.json', appSuffix);
        if (!isCurrent()) return;
        if (!manifest?.counts || !manifest.version) throw new Error('Invalid dataset manifest');
        manifestVersion = manifest.version;
        suffix = buildPartitionVersionSuffix({ isDevelopment: import.meta.env.DEV, manifestVersion: manifest.version });
        // Only a complete cache from this exact dataset version may seed readiness.
        const seed = cached?.version === manifest.version && isCompleteDatasetPayload(cached?.payload)
          ? cached.payload : null;
        const loader = installLoader(suffix, manifest.version, manifest.counts, seed);
        setLoadProgress(35);
        const { pathname, search } = routeLocationRef.current;
        await loader.ensurePlan(planInitialDataLoad({ pathname, search }));
        if (!isCurrent()) return;
        if (isRouteDataReady(loader.getState(), pathname, search)) {
          setLoadProgress(100);
          return;
        }
      } catch (error) {
        if (!isCurrent()) return;
        logger.debug('Split dataset unavailable:', error);
      }
      // Identical normalization/readiness rules for split files, cache and fallback.
      for (const file of ['full-dataset.json', 'index.json']) {
        try {
          const payload = await readJson(file, suffix);
          if (!isCurrent()) return;
          if (!isCompleteDatasetPayload(payload)) throw new Error(`Incomplete dataset: ${file}`);
          if (payload.version && manifestVersion && payload.version !== manifestVersion) {
            throw new Error('Combined dataset version mismatch');
          }
          // A user retry/navigation may have recovered while the fallback was
          // in flight. Keep that loader and its successful full upgrades.
          const recoveredRoute = routeLocationRef.current;
          if (partitionLoaderRef.current && isRouteDataReady(partitionLoaderRef.current.getState(),
            recoveredRoute.pathname, recoveredRoute.search)) {
            setLoadError(null);
            setLoadProgress(100);
            return;
          }
          const loader = installLoader(suffix, payload.version || null,
            payload.summaryCounts || buildLiteSummaryCounts(payload), payload);
          const { pathname, search } = routeLocationRef.current;
          await loader.ensurePlan(planInitialDataLoad({ pathname, search }));
          if (!isCurrent()) return;
          if (isRouteDataReady(loader.getState(), pathname, search)) {
            setLoadProgress(100);
            return;
          }
        } catch (error) {
          if (!isCurrent()) return;
          logger.debug('Combined dataset unavailable:', error);
        }
      }
      if (isCurrent()) {
        setLoading(false);
        const currentRoute = routeLocationRef.current;
        if (partitionLoaderRef.current && isRouteDataReady(partitionLoaderRef.current.getState(),
          currentRoute.pathname, currentRoute.search)) setLoadError(null);
        else setLoadError(new Error('Required dataset partitions unavailable'));
      }
    };
    fetchDataRef.current = fetchData;
    // A broken IndexedDB connection must not block network loading indefinitely.
    let cacheTimer;
    const cacheTimeout = new Promise((resolve) => { cacheTimer = window.setTimeout(() => resolve(null), 1500); });
    Promise.race([loadDatasetFromCache().catch(() => null), cacheTimeout])
      .then((cached) => {
        window.clearTimeout(cacheTimer);
        if (!cancelled) return fetchData(cached);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(cacheTimer);
      fetchAbortRef.current?.abort();
      fetchDataRef.current = null;
      partitionLoaderRef.current = null;
      ensureTypesLoaderRef.current = null;
      ensurePlantsLoaderRef.current = null;
      if (insectDataLoadTimerRef.current) window.clearTimeout(insectDataLoadTimerRef.current);
      insectDataInteractionCleanupRef.current?.();
      insectDataInteractionCleanupRef.current = null;
    };
  }, []);

  // Reconcile every route, including plant/quiz links and navigation during bootstrap.
  useEffect(() => {
    const loader = partitionLoaderRef.current;
    let cancelled = false;
    loader?.ensurePlan(planInitialDataLoad({
      pathname: location.pathname, search: location.search,
    })).then(() => {
      // The main species account needs only its full partition, but related
      // species and the network require catalogs from every classification.
      if (!cancelled && getInsectDetailCollectionKey(location.pathname) &&
          isRouteDataReady(loader.getState(), location.pathname, location.search)) loader.ensureTypes();
    });
    return () => { cancelled = true; };
  }, [location.pathname, location.search, loaderGeneration]);

  const routeDataReady = isRouteDataReady(partitionState, location.pathname, location.search);
  const visibleLoadError = loadError || getRouteDataError(partitionState, location.pathname);
  const hasLoadedInsectPartitions = INSECT_COLLECTION_KEYS.every(
    (key) => Boolean(partitionState.collectionLevels[key]),
  );

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
    relatedDataError: visibleLoadError,
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
      <LoadingBar isLoading={loading || (!routeDataReady && !visibleLoadError)} progress={routeDataReady ? 100 : Math.min(loadProgress, 90)} />
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

      {visibleLoadError && (
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
              onClick={async () => {
                if (fetchDataRef.current) {
                  if (partitionLoaderRef.current) {
                    setLoadError(null);
                    const loader = partitionLoaderRef.current;
                    await loader.retryFailures(planInitialDataLoad({
                      pathname: location.pathname, search: location.search,
                    }));
                    const currentRoute = routeLocationRef.current;
                    loader.ensurePlan(planInitialDataLoad({
                      pathname: currentRoute.pathname, search: currentRoute.search,
                    }));
                  } else fetchDataRef.current();
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
        {(loading || !routeDataReady) ? (visibleLoadError ? null : (
          routeConfigs.some(({ path, fallback }) => fallback && matchPath({ path, end: true }, location.pathname))
            ? <DetailSkeleton />
            : <SkeletonLoader />
        )) : (
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
