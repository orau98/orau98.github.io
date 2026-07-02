import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import { isEnglishLocale } from '../utils/locale';

// テーマ切替ボタンの共通実装。
// 従来はHeader / StickyHeader / ExplorerHeroが別スタイル・別アイコンで三重実装しており、
// aria情報も「テーマを切り替え」固定だったため、1コンポーネントに集約した。
// variantで配置先ごとの見た目だけを切り替える。
const VARIANT_CLASSES = {
  // グローバルヘッダー（ダーク面の上に置くグラデーションボタン）
  header:
    'group relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 p-2.5 shadow-xl transition-all duration-300 hover:scale-110 hover:from-emerald-500/30 hover:to-blue-500/30 hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-emerald-400/20 dark:from-emerald-500/10 dark:to-blue-500/10 dark:hover:from-emerald-500/20 dark:hover:to-blue-500/20 sm:p-3',
  // スクロール追従ヘッダー（省スペース。タッチ領域は44px確保）
  compact:
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
  // ヒーローカード右上（ガラス面の上に置く半透明ボタン）
  hero:
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 p-2.5 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:from-emerald-500/30 hover:to-blue-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
};

const ICON_CLASSES = {
  header: {
    sun: 'h-5 w-5 text-yellow-400 transition-all duration-300 group-hover:rotate-180 group-hover:text-yellow-300 sm:h-6 sm:w-6',
    moon: 'h-5 w-5 text-blue-400 transition-all duration-300 group-hover:-rotate-12 group-hover:text-blue-300 sm:h-6 sm:w-6',
  },
  compact: {
    sun: 'h-4 w-4 text-yellow-400',
    moon: 'h-4 w-4 text-slate-700 dark:text-slate-200',
  },
  hero: {
    sun: 'h-5 w-5 text-white/80',
    moon: 'h-5 w-5 text-white/80',
  },
};

const ThemeToggle = ({ theme, setTheme, locale = 'ja', variant = 'compact' }) => {
  if (!theme || !setTheme) return null;
  const isEnglish = isEnglishLocale(locale);
  const isDark = theme === 'dark';
  const label = isDark
    ? (isEnglish ? 'Switch to light theme' : 'ライトテーマに切り替え')
    : (isEnglish ? 'Switch to dark theme' : 'ダークテーマに切り替え');
  const icons = ICON_CLASSES[variant] || ICON_CLASSES.compact;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={VARIANT_CLASSES[variant] || VARIANT_CLASSES.compact}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      {isDark ? (
        <SunIcon className={icons.sun} aria-hidden="true" />
      ) : (
        <MoonIcon className={icons.moon} aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
