import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "./ThemeToggle";
import SearchInput from "./SearchInput";

/**
 * 種数チップの行。モバイルでも横スクロールにせず折り返しで全チップを表示する
 * （横スクロールは操作しづらく、最後の「食草」種数が初期状態で隠れてしまうため）。
 * チップは短く数も少ないので、狭い画面では2〜3行に自然に折り返る。
 */
const HeroStatChips = ({ heroStats }) => {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 sm:max-w-5xl sm:gap-2.5">
      {heroStats.map((item) => (
        <div
          key={item.label}
          className="inline-flex rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-sm sm:px-3.5 sm:py-1.5"
        >
          <span className="whitespace-nowrap text-xs font-medium text-white/90 sm:text-sm">
            {item.label} {item.value}
          </span>
        </div>
      ))}
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
      <h1 className="sr-only" data-explorer-heading>
        {isEnglish
          ? activeTab === 'plants'
            ? 'Find insects by host plant'
            : 'Find host plants by insect'
          : activeTab === 'plants'
            ? '食草・寄主植物から昆虫を探す'
            : '昆虫から食草・寄主植物を探す'}
      </h1>

      {showHeaderControls && !isStickyHeaderVisible && (
        <div className="flex w-full items-center justify-between gap-2 sm:justify-end">
          <LocaleSwitcher locale={locale} compact />
          <ThemeToggle theme={theme} setTheme={setTheme} locale={locale} variant="hero" />
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
