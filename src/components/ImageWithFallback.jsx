import React, { useState, useEffect } from 'react';

const ImageWithFallback = ({ 
  src, 
  srcSet,
  sizes,
  alt, 
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
  const [currentSrc, setCurrentSrc] = useState(src);
  const [currentCandidates, setCurrentCandidates] = useState(candidates);
  const [currentSrcSet, setCurrentSrcSet] = useState(srcSet);
  const [currentSizes, setCurrentSizes] = useState(sizes);
  const [srcSetDisabled, setSrcSetDisabled] = useState(false);
  const [status, setStatus] = useState('loading'); // loading, loaded, error

  // Reset loading state only when the primary src actually changes.
  // Changing just the candidates array (which is often recreated on every parent render)
  // should NOT force the image back to the loading skeleton, otherwise a loaded image
  // disappears after any parent state update.
  useEffect(() => {
    setCurrentSrc(src);
    setCurrentSrcSet(srcSet);
    setCurrentSizes(sizes);
    setSrcSetDisabled(false);
    setStatus('loading');
  }, [src]);

  // Keep srcset/sizes in sync without resetting the load status.
  useEffect(() => {
    setCurrentSrcSet(srcSet);
    setCurrentSizes(sizes);
  }, [srcSet, sizes]);

  // Keep the retry candidate list in sync without touching the load status.
  useEffect(() => {
    setCurrentCandidates(candidates);
  }, [candidates]);

  const handleLoad = (e) => {
    setStatus('loaded');
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
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

    if (currentCandidates && currentCandidates.length > 0) {
      const nextSrc = currentCandidates[0];
      setCurrentSrc(nextSrc);
      setCurrentCandidates(prev => prev.slice(1));
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
  };

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

  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`} style={{ width, height }}>
      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse z-10 flex items-center justify-center">
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
      <img
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
    </div>
  );
};

export default ImageWithFallback;
