import { useEffect, useState } from 'react';
import { isEnglishLocale } from '../utils/locale';
import { buildPageItems } from '../utils/pagination';

const MOBILE_QUERY = '(max-width: 639px)';

const baseButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 sm:text-sm';
const idleButton =
  'border border-slate-200/50 bg-white/80 text-slate-600 backdrop-blur-sm hover:bg-emerald-50 hover:shadow-md dark:border-slate-600/50 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/50';

const Pagination = ({ currentPage, totalPages, onPageChange, locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);

  // スマホでは現在のページの前後を減らし、「前へ・番号・次へ」を1行に収める
  // （以前は「次へ」だけが2行目に落ち、最後のページへ直接行く手段も無かった）
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const [jumpPage, setJumpPage] = useState('');
  const items = buildPageItems(currentPage, totalPages, isMobile ? 3 : 5);

  const handleJumpSubmit = (event) => {
    event.preventDefault();
    const nextPage = parseInt(jumpPage, 10);
    if (!Number.isFinite(nextPage)) return;
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
    setJumpPage('');
  };

  return (
    <nav className="flex w-full flex-col items-center justify-center gap-3 px-1 sm:px-0" aria-label={isEnglish ? 'Pagination' : 'ページネーション'}>
      <div className="flex max-w-full flex-nowrap items-center justify-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${baseButton} ${idleButton} min-w-[36px] px-1.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none sm:px-3`}
          aria-label={isEnglish ? 'Previous page' : '前のページ'}
        >
          <svg className="h-4 w-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{isEnglish ? 'Prev' : '前へ'}</span>
        </button>

        {items.map((item) => {
          if (typeof item !== 'number') {
            return (
              <span key={item} aria-hidden="true" className="w-4 text-center text-slate-500 dark:text-slate-400 sm:w-6">
                …
              </span>
            );
          }
          const isCurrent = item === currentPage;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`${baseButton} min-w-[36px] px-1.5 tabular-nums sm:min-w-[44px] sm:px-3 ${
                isCurrent
                  ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-700/25'
                  : idleButton
              }`}
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={
                isCurrent
                  ? (isEnglish ? `Current page ${item}` : `現在のページ ${item}`)
                  : (isEnglish ? `Go to page ${item}` : `${item}ページへ移動`)
              }
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${baseButton} ${idleButton} min-w-[36px] px-1.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none sm:px-3`}
          aria-label={isEnglish ? 'Next page' : '次のページ'}
        >
          <span className="hidden sm:inline">{isEnglish ? 'Next' : '次へ'}</span>
          <svg className="h-4 w-4 sm:ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {totalPages > 8 && (
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <label htmlFor="page-jump-input">{isEnglish ? 'Go to page' : 'ページ指定'}</label>
          <input
            id="page-jump-input"
            type="number"
            inputMode="numeric"
            min="1"
            max={totalPages}
            value={jumpPage}
            onChange={(event) => setJumpPage(event.target.value)}
            placeholder={String(currentPage)}
            className="min-h-[40px] w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:border-transparent focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <span>/ {totalPages}</span>
          <button
            type="submit"
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isEnglish ? 'Go' : '移動'}
          </button>
        </form>
      )}
    </nav>
  );
};

export default Pagination;
