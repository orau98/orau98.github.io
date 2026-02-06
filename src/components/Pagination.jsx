import React, { useEffect, useState } from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
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
  
  let startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
  let endPage = Math.min(totalPages, startPage + visiblePages - 1);
  
  if (endPage - startPage + 1 < visiblePages) {
    startPage = Math.max(1, endPage - visiblePages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <nav className="flex items-center justify-center w-full px-2 sm:px-0" aria-label="ページネーション">
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="group relative inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md disabled:hover:shadow-none"
          aria-label="前のページ"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">前へ</span>
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:shadow-md"
              aria-label="1ページへ移動"
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
            aria-label={number === currentPage ? `現在のページ ${number}` : `${number}ページへ移動`}
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
              aria-label={`${totalPages}ページへ移動`}
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
          aria-label="次のページ"
        >
          <span className="hidden sm:inline">次へ</span>
          <svg className="w-3 h-3 sm:w-4 sm:h-4 sm:ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
