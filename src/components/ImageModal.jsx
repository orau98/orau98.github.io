import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isEnglishLocale } from '../utils/locale';

const ImageModal = ({ image, isOpen, onClose, onImageError, images = [], currentIndex = 0, onNavigate, locale = 'ja' }) => {
  const isActive = Boolean(isOpen && image);
  const isEnglish = isEnglishLocale(locale);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastActiveElementRef = useRef(null);
  const labelId = useId();
  const hasLabel = Boolean(image?.label);
  const dialogLabel = image?.label || image?.alt || (isEnglish ? 'Image preview' : '画像表示');
  const modalCandidates = useMemo(() => {
    const originals = Array.isArray(image?.originalCandidates) ? image.originalCandidates : [];
    return Array.from(new Set([
      ...originals,
      image?.modalSrc,
      image?.finalSrc,
      image?.src,
    ].filter(Boolean)));
  }, [image]);
  const [modalSrc, setModalSrc] = useState(modalCandidates[0] || '');
  const [modalCandidateIndex, setModalCandidateIndex] = useState(0);

  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex > 0 && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1 && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, images.length, onNavigate]);

  // キーボードナビゲーション + フォーカストラップ
  useEffect(() => {
    if (!isActive) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        handlePrev(e);
        return;
      }
      if (e.key === 'ArrowRight') {
        handleNext(e);
        return;
      }
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

        if (focusable.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement;

        if (e.shiftKey) {
          if (activeEl === first || activeEl === dialog) {
            e.preventDefault();
            last.focus();
          }
        } else if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handlePrev, handleNext, onClose]);

  // Open/close focus management
  useEffect(() => {
    if (!isActive) return undefined;
    if (typeof document !== 'undefined') {
      lastActiveElementRef.current = document.activeElement;
    }
    const focusTarget = closeButtonRef.current || dialogRef.current;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    return () => {
      const prev = lastActiveElementRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isActive]);

  useEffect(() => {
    setModalCandidateIndex(0);
    setModalSrc(modalCandidates[0] || '');
  }, [modalCandidates]);

  const handleModalImageError = (event) => {
    const nextIndex = modalCandidateIndex + 1;
    const nextSrc = modalCandidates[nextIndex];
    if (nextSrc) {
      setModalCandidateIndex(nextIndex);
      setModalSrc(nextSrc);
      if (event?.currentTarget) event.currentTarget.src = nextSrc;
      return;
    }
    onImageError?.(image?.id, event);
  };

  const hasMultiple = images.length > 1;

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-label={!hasLabel ? dialogLabel : undefined}
        tabIndex={-1}
        className="relative max-w-6xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* メイン画像 */}
        <img
          src={modalSrc}
          alt={image.alt}
          className="w-full h-full object-contain rounded-lg shadow-2xl"
          onError={handleModalImageError}
        />

        {/* 閉じるボタン */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
          aria-label={isEnglish ? 'Close' : '閉じる'}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 前へボタン */}
        {hasMultiple && currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
            aria-label={isEnglish ? 'Previous image' : '前の画像'}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* 次へボタン */}
        {hasMultiple && currentIndex < images.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
            aria-label={isEnglish ? 'Next image' : '次の画像'}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* 下部情報バー */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2">
            <p id={hasLabel ? labelId : undefined} className="text-white font-medium">
              {image.label}
            </p>
          </div>

          {/* 画像カウンター */}
          {hasMultiple && (
            <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-white font-medium tabular-nums">
                {currentIndex + 1} / {images.length}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
