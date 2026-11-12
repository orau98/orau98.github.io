import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isEnglishLocale } from '../utils/locale';

const formatCount = (value, isEnglish) =>
  Number(value || 0).toLocaleString(isEnglish ? 'en-US' : 'ja-JP');

/**
 * スマホの「絞り込み」。以前は一覧の上で開き、約1.3画面分だけ結果を押し下げていた。
 * 画面の下から出るシートにして、条件を選びながら件数を確かめ、「◯件を表示」で閉じて結果へ戻る。
 * sm以上は従来どおり一覧の上の絞り込み欄を使う（このコンポーネントは sm:hidden）。
 */
export default function MobileFilterSheet({
  locale = 'ja',
  resultsLabel = '',
  resultCount = 0,
  activeCount = 0,
  buttonLabel = '',
  children,
}) {
  const isEnglish = isEnglishLocale(locale);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const sheetRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    // 開いたらシートの中へフォーカスを移す（読み上げでもシートが開いたことが分かる）
    sheetRef.current?.focus({ preventScroll: true });
    const trigger = triggerRef.current;
    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  const showLabel = isEnglish
    ? `Show ${formatCount(resultCount, true)} results`
    : `${formatCount(resultCount, false)}件を表示`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/75 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/55 sm:hidden">
      <span className="min-w-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
        {resultsLabel}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300/70 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-600/70 dark:bg-slate-800 dark:text-slate-200"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {buttonLabel}
        {activeCount > 0 && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] tabular-nums text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            {activeCount}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] sm:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl outline-none dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
              <h2 id={titleId} className="text-base font-bold text-slate-800 dark:text-slate-100">
                {buttonLabel}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={isEnglish ? 'Close filters' : '絞り込みを閉じる'}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {children}
            </div>
            <div className="border-t border-slate-200 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
              >
                {showLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
