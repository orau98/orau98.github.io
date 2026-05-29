import { useEffect, useState } from 'react';
import { isEnglishLocale } from '../utils/locale';

const Pagination = ({ currentPage, totalPages, onPageChange, locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const pageNumbers = [];
  const maxVisiblePages = 5;
  const maxVisiblePagesMobile = 5; // Increased from 3 to 5 for better mobile navigation
  
  // スマホでは表示ページ数を減らす（リサイズ追従）
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 639px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
    } else {
      media.addListener(update);
    }
    return () => {
      if (media.addEventListener) {
        media.removeEventListener('change', update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);
  const visiblePages = isMobile ? maxVisiblePagesMobile : maxVisiblePages;
  const [jumpPage, setJumpPage] = useState('');
  
  let startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
  let endPage = Math.min(totalPages, startPage + visiblePages - 1);
  
  if (endPage - startPage + 1 < visiblePages) {
    startPage = Math.max(1, endPage - visiblePages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const handleJumpSubmit = (event) => {
    event.preventDefault();
    const nextPage = parseInt(jumpPage, 10);
    if (!Number.isFinite(nextPage)) return;
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
    setJumpPage('');
  };

  return (
    <nav className="flex w-full flex-col items-center justify-center gap-3 px-2 sm:px-0" aria-label={isEnglish ? 'Pagination' : 'ページネーション'}>
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="group relative inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md disabled:hover:shadow-none"
          aria-label={isEnglish ? 'Previous page' : '前のページ'}
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="ml-1 sm:ml-0">{isEnglish ? 'Prev' : '前へ'}</span>
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:shadow-md"
              aria-label={isEnglish ? 'Go to page 1' : '1ページへ移動'}
            >
              1
            </button>
            {startPage > 2 && (
              <span className="hidden sm:inline px-2 py-2 text-slate-500 dark:text-slate-400">...</span>
            )}
          </>
        )}

        {pageNumbers.map(number => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            className={`inline-flex items-center px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 min-w-[32px] sm:min-w-[40px] justify-center ${
              number === currentPage
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 transform scale-105'
                : 'text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 hover:bg-blue-50 dark:hover:bg-slate-700/50 hover:shadow-md'
            }`}
            aria-current={number === currentPage ? 'page' : undefined}
            aria-label={
              number === currentPage
                ? isEnglish
                  ? `Current page ${number}`
                  : `現在のページ ${number}`
                : isEnglish
                  ? `Go to page ${number}`
                  : `${number}ページへ移動`
            }
          >
            {number}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="hidden sm:inline px-2 py-2 text-slate-500 dark:text-slate-400">...</span>
            )}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:shadow-md"
              aria-label={isEnglish ? `Go to page ${totalPages}` : `${totalPages}ページへ移動`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="group relative inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md disabled:hover:shadow-none"
          aria-label={isEnglish ? 'Next page' : '次のページ'}
        >
          <span>{isEnglish ? 'Next' : '次へ'}</span>
          <svg className="w-3 h-3 sm:w-4 sm:h-4 sm:ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {totalPages > 8 && (
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <span>/ {totalPages}</span>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isEnglish ? 'Go' : '移動'}
          </button>
        </form>
      )}
    </nav>
  );
};

export default Pagination;
