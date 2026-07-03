import { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import { isEnglishLocale } from '../utils/locale';

// 全画面画像ライトボックス（植物・昆虫詳細ページ共通）
// キーボード操作（Escape/←/→）・フォーカストラップ・前後ナビ・カウンタ付き。
// z-indexはFAB(z-[70])やスティッキーヘッダー(z-[60])より上のモーダル層に置く。
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
  // ズーム表示（等倍fit ⇔ 2倍・スクロールでパン）。画像切替・閉時にリセット
  const [zoomed, setZoomed] = useState(false);
  const touchStartRef = useRef(null);

  // 端に到達してボタンがdisabledになる際、そのボタンにフォーカスが残っていると
  // フォーカスがbodyへ落ちるため、フォーカス中のボタン操作時のみ閉じるボタンへ退避する
  const escapeFocusIfNeeded = (event) => {
    if (event?.currentTarget && document.activeElement === event.currentTarget) {
      closeButtonRef.current?.focus({ preventScroll: true });
    }
  };

  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex > 0 && onNavigate) {
      onNavigate(currentIndex - 1);
      if (currentIndex - 1 <= 0) escapeFocusIfNeeded(e);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1 && onNavigate) {
      onNavigate(currentIndex + 1);
      if (currentIndex + 1 >= images.length - 1) escapeFocusIfNeeded(e);
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

  // モーダル表示中は背景ページのスクロールを止める（閉じたら元の値へ戻す）
  useEffect(() => {
    if (!isActive || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isActive]);

  useEffect(() => {
    setModalCandidateIndex(0);
    setModalSrc(modalCandidates[0] || '');
    setZoomed(false);
  }, [modalCandidates]);

  useEffect(() => {
    if (!isActive) setZoomed(false);
  }, [isActive]);

  // スワイプで前後の画像へ（ズーム中はパン操作と衝突するため無効）
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      touchStartRef.current = null;
    }
  };
  const handleTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || zoomed || !hasMultiple || !onNavigate) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    } else if (dx > 0 && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

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
    // touch-action: pan-y pinch-zoom で横スワイプをJSに確保する。
    // 指定しないとブラウザの「スワイプで戻る」ジェスチャに奪われてページ遷移してしまう。
    // ズーム中はコンテナ内の横パンが必要なので制限を外す（overscroll-containが遷移を抑止）
    <div
      className={`fixed inset-0 bg-black/90 backdrop-blur-sm z-[90] flex items-center justify-center p-4 overscroll-contain ${zoomed ? '' : '[touch-action:pan-y_pinch-zoom]'}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-label={!hasLabel ? dialogLabel : undefined}
        tabIndex={-1}
        className="relative max-w-6xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* メイン画像: クリック/ズームボタンで等倍fit⇔2倍を切り替え。
            ズーム中はコンテナ内スクロールでパンできる */}
        <div className={zoomed ? 'overflow-auto max-h-[90vh] rounded-lg overscroll-contain' : ''}>
          <img
            src={modalSrc}
            alt={image.alt}
            className={zoomed
              ? 'max-w-none w-[200%] cursor-zoom-out rounded-lg shadow-2xl'
              : 'w-full h-full object-contain cursor-zoom-in rounded-lg shadow-2xl'}
            onError={handleModalImageError}
            onClick={() => setZoomed((z) => !z)}
          />
        </div>

        {/* ズーム切替ボタン（画像クリックと等価。キーボード・SR向けの明示的な操作） */}
        <button
          onClick={() => setZoomed((z) => !z)}
          className="absolute top-4 right-20 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
          aria-label={zoomed ? (isEnglish ? 'Fit to screen' : '全体表示に戻す') : (isEnglish ? 'Zoom in' : '拡大する')}
          aria-pressed={zoomed}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {zoomed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M13 10H7m10 0a7 7 0 11-14 0 7 7 0 0114 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 7v6m-3-3h6m4 0a7 7 0 11-14 0 7 7 0 0114 0z" />
            )}
          </svg>
        </button>

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

        {/* 前へ/次へボタン: 端でもアンマウントせずdisabledにする。
            端到達時にフォーカス中のボタンが消えるとフォーカスがbodyへ落ちるため */}
        {hasMultiple && (
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:hover:bg-white/20 disabled:hover:scale-100 disabled:cursor-default"
            aria-label={isEnglish ? 'Previous image' : '前の画像'}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {hasMultiple && (
          <button
            onClick={handleNext}
            disabled={currentIndex >= images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:hover:bg-white/20 disabled:hover:scale-100 disabled:cursor-default"
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
