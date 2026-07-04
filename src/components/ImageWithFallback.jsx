import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const IMAGE_LOAD_TIMEOUT_MS = 12000;
// loading=lazy でまだフェッチが始まらない距離（ブラウザのlazyマージンより十分内側）
const LAZY_NEAR_VIEWPORT_MARGIN_PX = 1200;

const normalizeCandidates = (list) => {
  if (!Array.isArray(list) || list.length === 0) return [];
  const uniq = new Set();
  const out = [];
  for (const item of list) {
    if (!item || uniq.has(item)) continue;
    uniq.add(item);
    out.push(item);
  }
  return out;
};

const normalizeSources = (list) => {
  if (!Array.isArray(list) || list.length === 0) return [];
  const uniq = new Set();
  const out = [];
  for (const item of list) {
    if (!item?.srcSet) continue;
    const key = `${item.type || ''}::${item.srcSet}`;
    if (uniq.has(key)) continue;
    uniq.add(key);
    out.push({
      type: item.type || '',
      srcSet: item.srcSet,
      sizes: item.sizes,
    });
  }
  return out;
};

const buildSourceSignature = (list) =>
  Array.isArray(list) && list.length > 0
    ? list
        .map((item) => `${item.type || ''}::${item.srcSet || ''}::${item.sizes || ''}`)
        .join('\u0001')
    : '';

const ImageWithFallback = ({ 
  src, 
  srcSet,
  sizes,
  sources = [],
  alt = '', // alt未指定でもSRがファイル名を読み上げないよう空文字を既定にする

  className = '', 
  imgClassName = '',
  fit = 'contain', // contain | cover | fill | none | scale-down
  errorLabel = '画像なし',
  width, 
  height, 
  loading = 'lazy',
  candidates = [], // Optional: array of URLs to try if src fails
  fallbackSrc, // Optional: specific fallback image URL
  onLoad,
  onError,
  ...props 
}) => {
  const normalizedCandidates = useMemo(
    () => normalizeCandidates(candidates),
    [candidates],
  );
  const normalizedSources = useMemo(
    () => normalizeSources(sources),
    [sources],
  );
  const candidatesSignature = useMemo(
    () => normalizedCandidates.join('\u0001'),
    [normalizedCandidates],
  );
  const sourcesSignature = useMemo(
    () => buildSourceSignature(normalizedSources),
    [normalizedSources],
  );
  const initialSrc = src || normalizedCandidates[0] || fallbackSrc || '';
  const lastResetSignatureRef = useRef('');
  const imgElRef = useRef(null);
  // 低速回線で進行中のダウンロードをタイムアウトで打ち切らないための猶予フラグ
  const stallGraceUsedRef = useRef(false);

  const [currentSrc, setCurrentSrc] = useState(initialSrc || src);
  const [currentCandidates, setCurrentCandidates] = useState(
    normalizedCandidates.filter((candidate) => candidate !== initialSrc),
  );
  const [currentSrcSet, setCurrentSrcSet] = useState(srcSet);
  const [currentSizes, setCurrentSizes] = useState(sizes);
  const [currentSources, setCurrentSources] = useState(normalizedSources);
  const [pictureSourcesDisabled, setPictureSourcesDisabled] = useState(false);
  const [srcSetDisabled, setSrcSetDisabled] = useState(false);
  const [status, setStatus] = useState(initialSrc ? 'loading' : 'error'); // loading, loaded, error

  // Reset loading state only when the primary src actually changes.
  // Changing only array identities from parent rerenders should NOT force the image
  // back to the loading skeleton, otherwise already-loaded images can disappear.
  useEffect(() => {
    const nextCandidates = normalizedCandidates;
    const nextSrc = src || nextCandidates[0] || fallbackSrc || '';
    const nextResetSignature = [
      nextSrc,
      srcSet || '',
      sizes || '',
      fallbackSrc || '',
      candidatesSignature,
      sourcesSignature,
    ].join('\u0002');

    if (lastResetSignatureRef.current === nextResetSignature) {
      return;
    }
    lastResetSignatureRef.current = nextResetSignature;

    setCurrentSrc(nextSrc);
    setCurrentCandidates(nextCandidates.filter((candidate) => candidate !== nextSrc));
    setCurrentSrcSet(srcSet);
    setCurrentSizes(sizes);
    setCurrentSources(normalizedSources);
    setPictureSourcesDisabled(false);
    setSrcSetDisabled(false);
    setStatus(nextSrc ? 'loading' : 'error');
  }, [
    src,
    normalizedCandidates,
    fallbackSrc,
    srcSet,
    sizes,
    normalizedSources,
    candidatesSignature,
    sourcesSignature,
  ]);

  // Keep srcset/sizes in sync without resetting the load status.
  useEffect(() => {
    setCurrentSrcSet(srcSet);
    setCurrentSizes(sizes);
  }, [srcSet, sizes]);

  const handleLoad = (e) => {
    setStatus('loaded');
    if (onLoad) onLoad(e);
  };

  const handleError = useCallback((e) => {
    if (!pictureSourcesDisabled && currentSources.length > 0) {
      setCurrentSources([]);
      setPictureSourcesDisabled(true);
      if (currentSrc) {
        const separator = currentSrc.includes('?') ? '&' : '?';
        const retrySrc = currentSrc.includes('fallback=1')
          ? currentSrc
          : `${currentSrc}${separator}fallback=1`;
        setCurrentSrc(retrySrc);
      }
      setStatus('loading');
      return;
    }

    // If a responsive srcset is present, drop it once and retry the same src.
    if (!srcSetDisabled && currentSrcSet) {
      setSrcSetDisabled(true);
      setCurrentSrcSet(undefined);
      setCurrentSizes(undefined);
      if (currentSrc) {
        const separator = currentSrc.includes('?') ? '&' : '?';
        const retrySrc = currentSrc.includes('fallback=1')
          ? currentSrc
          : `${currentSrc}${separator}fallback=1`;
        setCurrentSrc(retrySrc);
      }
      setStatus('loading');
      return;
    }

    const nextCandidates = Array.isArray(currentCandidates) ? currentCandidates : [];
    if (nextCandidates.length > 0) {
      const nextSrc = nextCandidates[0];
      setCurrentSrc(nextSrc);
      setCurrentCandidates(nextCandidates.slice(1));
      setCurrentSrcSet(undefined);
      setCurrentSizes(undefined);
      setSrcSetDisabled(true);
      setStatus('loading');
      // The browser will try to load the new src.
    } else if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setCurrentSrcSet(undefined);
      setCurrentSizes(undefined);
      setSrcSetDisabled(true);
      setStatus('loading');
      // fallbackSrc is the last resort
    } else {
      setStatus('error');
      if (onError) onError(e);
    }
  }, [
    currentCandidates,
    currentSrc,
    currentSources,
    currentSrcSet,
    fallbackSrc,
    onError,
    pictureSourcesDisabled,
    srcSetDisabled,
  ]);

  // キャッシュ済み画像などで load イベントを取りこぼした場合の即時回収。
  // complete かつ実寸が取れていればスケルトンを出し続けずに表示へ切り替える。
  useEffect(() => {
    if (status !== 'loading') return;
    const el = imgElRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setStatus('loaded');
    }
  }, [status, currentSrc]);

  useEffect(() => {
    if (status !== 'loading' || !currentSrc) return undefined;
    stallGraceUsedRef.current = false;
    let timer = null;
    const check = () => {
      const el = imgElRef.current;
      if (el && el.complete) {
        if (el.naturalWidth > 0) {
          // loadイベントを取りこぼしていても読み込み自体は完了している
          setStatus('loaded');
          return;
        }
        // 完了済みだがデコード不能（壊れた画像/404）はフォールバックへ
        handleError();
        return;
      }
      // 非表示タブではブラウザが読み込みを保留するため、エラー扱いにせず待つ
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(check, IMAGE_LOAD_TIMEOUT_MS);
        return;
      }
      // loading=lazy でフェッチ未開始の画面外画像を誤ってエラー扱いにしない
      if (el && typeof el.getBoundingClientRect === 'function') {
        try {
          const rect = el.getBoundingClientRect();
          const viewportHeight =
            window.innerHeight || document.documentElement.clientHeight || 0;
          if (
            rect.top > viewportHeight + LAZY_NEAR_VIEWPORT_MARGIN_PX ||
            rect.bottom < -LAZY_NEAR_VIEWPORT_MARGIN_PX
          ) {
            timer = setTimeout(check, IMAGE_LOAD_TIMEOUT_MS);
            return;
          }
        } catch {}
      }
      // タイムアウト時に即座に別URLへ切り替えると進行中のダウンロードが破棄され、
      // 低速回線では毎回最初からやり直しになる。1回だけ猶予を延長する。
      if (!stallGraceUsedRef.current) {
        stallGraceUsedRef.current = true;
        timer = setTimeout(check, IMAGE_LOAD_TIMEOUT_MS);
        return;
      }
      handleError();
    };
    timer = setTimeout(check, IMAGE_LOAD_TIMEOUT_MS);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, currentSrc, handleError]);

  const fitClass =
    fit === 'cover'
      ? 'object-cover'
      : fit === 'fill'
        ? 'object-fill'
        : fit === 'none'
          ? 'object-none'
          : fit === 'scale-down'
            ? 'object-scale-down'
            : 'object-contain';

  const imageElement = (
    <img
      ref={imgElRef}
      src={currentSrc}
      srcSet={status !== 'error' && !srcSetDisabled ? currentSrcSet : undefined}
      sizes={!srcSetDisabled ? currentSizes : undefined}
      alt={alt}
      className={`w-full h-full ${fitClass} transition-opacity duration-700 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      onLoad={handleLoad}
      onError={handleError}
      loading={loading}
      {...props}
    />
  );

  return (
    <div className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800 ${className}`} style={{ width, height }}>
      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse z-10 flex items-center justify-center">
           <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
        </div>
      )}
      
      {/* Error State (Icon) */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10 bg-slate-100 dark:bg-slate-800">
          <div className="text-center p-4">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-slate-500 dark:text-slate-400">{errorLabel}</span>
          </div>
        </div>
      )}

      {/* Image */}
      {!pictureSourcesDisabled && currentSources.length > 0 ? (
        <picture className="block w-full h-full">
          {currentSources.map((source) => (
            <source
              key={`${source.type}:${source.srcSet}`}
              type={source.type}
              srcSet={source.srcSet}
              sizes={source.sizes}
            />
          ))}
          {imageElement}
        </picture>
      ) : (
        imageElement
      )}
    </div>
  );
};

export default ImageWithFallback;
