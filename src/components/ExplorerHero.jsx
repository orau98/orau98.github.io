import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "./ThemeToggle";
import SearchInput from "./SearchInput";

const formatCount = (value, isEnglish) =>
  Number(value || 0).toLocaleString(isEnglish ? "en-US" : "ja-JP");

// 昆虫タブのアイコン（蝶）
const InsectIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 512 512" aria-hidden="true">
    <path d="M243.695,179.339c0.703,4.906,5.813,7.438,7.719,1.406c1.891-6.031-4.828-17.219-22.219-36.531c-14.828-16.484-35.625-39.391-23.844-51.578c14.609-10.078,8.469-27.75-4.172-29.469c-11.313-1.516-21.609,13.578-15.031,38.703C192.711,126.964,241.695,165.292,243.695,179.339z" />
    <path d="M445.898,83.886c-74.469,0-160.703,89.859-174.516,111.078c-3.594-4.578-9.109-7.578-15.375-7.578c-6.281,0-11.797,3-15.391,7.578C226.805,173.73,140.57,83.886,66.102,83.886c-76.828,0-70.547,68.984-59.578,112.891c10.969,43.922,56.453,92.516,106.609,94.094c-56.438,25.078-61.141,89.375-43.891,119.156c16.359,28.25,103.266,92.016,167.156-50.296v29.141c0,10.813,8.781,19.593,19.609,19.593c10.813,0,19.594-8.781,19.594-19.593v-29.156c63.891,142.328,150.813,78.562,167.156,50.312c17.25-29.781,12.547-94.078-43.891-119.156c50.172-1.578,95.641-50.172,106.609-94.094C516.445,152.871,522.727,83.886,445.898,83.886z" />
    <path d="M268.305,179.339c2-14.047,50.984-52.375,57.563-77.469c6.563-25.125-3.734-40.219-15.047-38.703c-12.641,1.719-18.766,19.391-4.172,29.469c11.781,12.188-9.016,35.094-23.844,51.578c-17.391,19.313-24.109,30.5-22.219,36.531C262.492,186.777,267.602,184.246,268.305,179.339z" />
  </svg>
);

// 植物タブのアイコン（葉）
const PlantIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 512 512" aria-hidden="true">
    <path d="M377.478,0.174c-34.179-3.423-37.602,44.438-119.644,78.618c-83.543,34.808-166.39,80.55-167.693,254.14c-0.155,18.807-1.314,51.296-1.513,65.056c-0.276,19.691,0.287,40.872-8.69,51.738c-7.311,8.857-20.176,18.818-32.866,27.531L81.87,512c31.032-24.306,39.834-26.493,46.35-26.35c15.549,0.342,31.33,0.496,47.155-0.762c100.318-7.995,202.137-56.718,253.379-149.714C521.042,167.679,411.657,3.598,377.478,0.174z M368.81,109.802c-6.184,20.817-26.957,51.826-91.925,128.445c-33.517,39.535-72.158,107.672-99.743,168.344c-8.361,18.388-36.432,4.925-26.405-13.473c13.042-19.403,43.08-104.117,86.558-160.968c43.489-56.862,101.411-105.685,110.378-133.801C351.857,79.112,377.048,82.116,368.81,109.802z" />
  </svg>
);

/**
 * トップのヒーロー（検索ファースト）。
 * 「何ができるサイトか」を1行で示し、昆虫／植物の切り替え（タブ）を検索窓の横に置く。
 * 切り替えと検索対象が同じ場所にあるので、どちらを検索しているかが分かりやすく、
 * 一覧側のタブ行が不要になって結果が初期画面の上寄りに来る。
 * タブの操作（ARIA Tabs パターン）は従来どおりで、対応するパネルは一覧側にある。
 */
const ExplorerHero = ({
  activeSearchTerm,
  activeTab,
  commitSearchValue,
  handleGlobalSearch,
  handleSelectSuggestion,
  heroSearchInputRef,
  isEnglish,
  isStickyHeaderVisible,
  locale,
  onTabChange,
  onTabListKeyDown,
  plantCount = 0,
  insectCount = 0,
  setTheme,
  showHeaderControls = true,
  suggestions,
  theme,
  ui,
}) => {
  const tabs = [
    {
      key: "insects",
      id: "tab-insects",
      panelId: "panel-insects",
      Icon: InsectIcon,
      label: isEnglish ? "Insects" : "昆虫",
      longLabel: isEnglish ? "Find by insect" : "昆虫から探す",
      count: insectCount,
    },
    {
      key: "plants",
      id: "tab-plants",
      panelId: "panel-plants",
      Icon: PlantIcon,
      label: isEnglish ? "Plants" : "植物",
      longLabel: isEnglish ? "Find by plant" : "植物から探す",
      count: plantCount,
    },
  ];

  return (
    <div
      id="hero-section"
      className="relative w-full rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-900/70 to-slate-900 shadow-xl sm:rounded-3xl dark:from-slate-950 dark:via-emerald-950/70 dark:to-slate-950"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_55%)] sm:rounded-3xl" />

      <div className="relative z-10 flex flex-col gap-2.5 p-3.5 sm:gap-3.5 sm:p-5 md:p-6">
        <h1 className="sr-only" data-explorer-heading>
          {isEnglish
            ? activeTab === "plants"
              ? "Find insects by host plant"
              : "Find host plants by insect"
            : activeTab === "plants"
              ? "食草・寄主植物から昆虫を探す"
              : "昆虫から食草・寄主植物を探す"}
        </h1>

        {showHeaderControls && !isStickyHeaderVisible && (
          <div className="flex w-full items-center justify-between gap-2 sm:justify-end">
            <LocaleSwitcher locale={locale} compact />
            <ThemeToggle theme={theme} setTheme={setTheme} locale={locale} variant="hero" />
          </div>
        )}

        {/* 初めて来た人にもサイトの目的が伝わる1行の説明 */}
        <p className="text-[13px] font-semibold leading-snug text-emerald-50/90 sm:text-[15px]">
          {isEnglish ? (
            <>
              <span className="sm:hidden">Explore how insects and their host plants connect</span>
              <span className="hidden sm:inline">
                {`Explore the links between ${formatCount(insectCount, true)} insect species and ${formatCount(plantCount, true)} host plants in Japan`}
              </span>
            </>
          ) : (
            <>
              <span className="sm:hidden">昆虫と食草・寄主植物の「つながり」を調べる図鑑</span>
              <span className="hidden sm:inline">
                {`日本の昆虫 ${formatCount(insectCount, false)}種と、食草・寄主植物 ${formatCount(plantCount, false)}種の「つながり」を調べられる図鑑です`}
              </span>
            </>
          )}
        </p>

        <div className="flex flex-col gap-2.5 md:flex-row md:items-stretch">
          <div
            role="tablist"
            aria-label={isEnglish ? "Switch between insects and plants" : "昆虫/植物の切り替え"}
            onKeyDown={onTabListKeyDown}
            className="flex shrink-0 rounded-2xl border border-white/20 bg-white/10 p-1"
          >
            {tabs.map(({ key, id, panelId, Icon, label, longLabel, count }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  id={id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={panelId}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onTabChange?.(key)}
                  className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 md:min-h-[46px] md:flex-none md:px-4 ${
                    active
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-100 dark:text-emerald-800"
                      : "text-emerald-50/90 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="md:hidden">{label}</span>
                  <span className="hidden md:inline">{longLabel}</span>
                  <span className={`text-xs font-medium tabular-nums ${active ? "text-emerald-700/70" : "text-emerald-50/70"}`}>
                    {formatCount(count, isEnglish)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
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
    </div>
  );
};

export default ExplorerHero;
