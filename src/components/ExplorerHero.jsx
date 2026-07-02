import { useEffect, useRef, useState } from "react";
import LocaleSwitcher from "./LocaleSwitcher";
import SearchInput from "./SearchInput";

/**
 * 種数チップの行。モバイルは横スクロール1行、sm以上は折り返し。
 * 端のフェードで「横スクロールできる」ことを明示し、
 * 端に達したらフェードを消す（最後の「食草」が常時隠れないように）。
 */
const HeroStatChips = ({ heroStats }) => {
  const scrollRef = useRef(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  };

  useEffect(() => {
    updateFades();
    window.addEventListener("resize", updateFades);
    return () => window.removeEventListener("resize", updateFades);
  }, [heroStats]);

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={scrollRef}
        onScroll={updateFades}
        className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 sm:max-w-5xl sm:flex-wrap sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {heroStats.map((item) => (
          <div
            key={item.label}
            className="inline-flex shrink-0 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-sm sm:px-3.5 sm:py-1.5"
          >
            <span className="whitespace-nowrap text-xs font-medium text-white/90 sm:text-sm">
              {item.label} {item.value}
            </span>
          </div>
        ))}
      </div>
      {/* 左端フェード（右にスクロール済みのとき） */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-900 to-transparent transition-opacity duration-200 dark:from-slate-950 sm:hidden ${
          showLeftFade ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* 右端フェード（まだ続きがあるとき＝スクロール可能の合図） */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-900 to-transparent transition-opacity duration-200 dark:from-slate-950 sm:hidden ${
          showRightFade ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};

/**
 * トップのヒーロー。大きな写真バナーは UI を妨げる装飾だったため廃止し、
 * 検索ファーストのコンパクトなヘッダーにした（ブランド名はグローバルヘッダーが担う）。
 * 高さは内容ベース（固定 min-height なし）。
 */
const ExplorerHero = ({
  activeSearchTerm,
  activeTab,
  commitSearchValue,
  handleGlobalSearch,
  handleSelectSuggestion,
  heroSearchInputRef,
  heroStats,
  isEnglish,
  isStickyHeaderVisible,
  locale,
  setTheme,
  showHeaderControls = true,
  suggestions,
  theme,
  ui,
}) => (
  <div
    id="hero-section"
    className="relative w-full rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-900/70 to-slate-900 shadow-xl sm:rounded-3xl dark:from-slate-950 dark:via-emerald-950/70 dark:to-slate-950"
  >
    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_55%)] sm:rounded-3xl" />

    <div className="relative z-10 flex flex-col gap-3 p-4 sm:gap-3.5 sm:p-5 md:p-6">
      {showHeaderControls && !isStickyHeaderVisible && (
        <div className="flex w-full items-center justify-between gap-2 sm:justify-end">
          <LocaleSwitcher locale={locale} compact />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-2xl border border-white/30 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 p-2.5 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:from-emerald-500/30 hover:to-blue-500/30"
            aria-label={ui.themeAria}
          >
            {theme === "dark" ? (
              <svg className="h-5 w-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* 種数チップ（モバイル横スクロール＋スクロール可能の視覚ヒント） */}
      <HeroStatChips heroStats={heroStats} />

      <div className="w-full max-w-2xl">
        <SearchInput
          ref={heroSearchInputRef}
          placeholder={ui.searchPlaceholder}
          value={activeSearchTerm}
          onChange={handleGlobalSearch}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
          onSubmit={commitSearchValue}
          ariaLabel={isEnglish ? `Search ${ui.searchTargetLabel.toLowerCase()}` : `${ui.searchTargetLabel}を検索`}
          historyScope={activeTab}
          locale={locale}
        />
      </div>
    </div>
  </div>
);

export default ExplorerHero;
