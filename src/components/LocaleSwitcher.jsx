import { Link, useLocation } from 'react-router-dom';
import { ENGLISH_LOCALE, isEnglishLocale, localizePath } from '../utils/locale';

const LocaleSwitcher = ({
  locale = 'ja',
  className = '',
  showLabel = false,
  compact = false,
}) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const currentPath = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
  const jaPath = localizePath(currentPath, 'ja');
  const enPath = localizePath(currentPath, ENGLISH_LOCALE);

  const baseItemClass = compact
    ? 'inline-flex items-center whitespace-nowrap rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors sm:rounded-lg sm:px-2.5 sm:text-xs'
    : 'inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors';
  const activeItemClass = 'bg-emerald-600 text-white shadow-sm';
  const inactiveItemClass =
    'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';
  const containerClass = compact
    ? 'inline-flex max-w-full items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white/85 p-0.5 text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-100 sm:gap-1 sm:rounded-xl sm:p-1'
    : 'inline-flex max-w-full items-center gap-1 rounded-xl border border-slate-200/80 bg-white/85 p-1 text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-100';
  const japaneseLabel = compact
    ? (
        <>
          <span className="sm:hidden">JP</span>
          <span className="hidden sm:inline">日本語</span>
        </>
      )
    : '日本語';
  const englishLabel = compact
    ? (
        <>
          <span className="sm:hidden">EN</span>
          <span className="hidden sm:inline">English</span>
        </>
      )
    : 'English';

  return (
    <div
      className={`${containerClass} ${className}`.trim()}
      aria-label={isEnglish ? 'Language switcher' : '言語切り替え'}
    >
      {showLabel && (
        <span className="hidden sm:inline px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {isEnglish ? 'Language' : '言語'}
        </span>
      )}

      {isEnglish ? (
        <Link
          to={jaPath}
          className={`${baseItemClass} ${inactiveItemClass}`}
          aria-label="Switch to Japanese"
        >
          {japaneseLabel}
        </Link>
      ) : (
        <span
          className={`${baseItemClass} ${activeItemClass}`}
          aria-current="page"
        >
          {japaneseLabel}
        </span>
      )}

      {isEnglish ? (
        <span
          className={`${baseItemClass} ${activeItemClass}`}
          aria-current="page"
        >
          {englishLabel}
        </span>
      ) : (
        <Link
          to={enPath}
          className={`${baseItemClass} ${inactiveItemClass}`}
          aria-label="Switch to English"
        >
          {englishLabel}
        </Link>
      )}
    </div>
  );
};

export default LocaleSwitcher;
