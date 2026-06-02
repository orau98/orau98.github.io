import { Link } from "react-router-dom";
import InfoPopover from "./InfoPopover";
import LocaleSwitcher from "./LocaleSwitcher";
import SearchInput from "./SearchInput";
import logger from "../utils/logger";
import { ENGLISH_NAMING_NOTICE } from "../utils/englishNaming";
import { buildResponsivePicture } from "../utils/imageSrcset";
import { localizePath } from "../utils/locale";
import ImageWithFallback from "./ImageWithFallback";

const ExplorerHero = ({
  activeSearchTerm,
  activeTab,
  commitSearchValue,
  handleGlobalSearch,
  handleSelectSuggestion,
  heroImageLoaded,
  heroSearchInputRef,
  heroStats,
  isEnglish,
  isStickyHeaderVisible,
  locale,
  setHeroImageLoaded,
  setTheme,
  showHeaderControls = true,
  suggestions,
  theme,
  ui,
}) => (
  <div
    id="hero-section"
    className={`group relative w-full ${
      isEnglish
        ? "min-h-[12rem] sm:min-h-[15rem] md:min-h-[17rem] lg:min-h-[18rem]"
        : "min-h-[11.5rem] sm:min-h-[14rem] md:min-h-[16rem] lg:min-h-[17rem]"
    }`}
  >
    <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl z-0 sm:rounded-3xl">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-blue-900/40 z-10"></div>

      {!heroImageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse z-5" />
      )}

      {(() => {
        const base = "Cucullia_argentea";
        const baseUrl = import.meta.env.BASE_URL || "/";
        const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
        const { src, srcSet, sizes, sources } = buildResponsivePicture({
          baseUrl: normalizedBase,
          folder: "insects",
          filename: base,
          widths: [320, 640, 1024],
          sizes: "100vw",
        });
        const placeholderSrc = `${normalizedBase}images/placeholder.jpg`;

        return (
          <ImageWithFallback
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            sources={sources}
            fallbackSrc={placeholderSrc}
            alt={
              isEnglish
                ? "Hero image for Insects and Host Plants of Japan - Cucullia argentea"
                : "昆虫植物図鑑のメインビジュアル - Cucullia argentea（ギンスジキンウワバ）"
            }
            width="1600"
            height="900"
            className="w-full h-full"
            imgClassName={`object-center transform group-hover:scale-105 ease-out ${
              heroImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            fit="cover"
            style={{
              imageRendering: "auto",
              willChange: heroImageLoaded ? "auto" : "opacity, transform",
              contain: "layout style paint",
            }}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onLoad={() => setHeroImageLoaded(true)}
            onError={(event) => {
              logger.warn("Hero image failed to load:", event?.currentTarget?.src || src);
              setHeroImageLoaded(true);
            }}
          />
        );
      })()}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent z-20"></div>
    </div>

    <div className="relative z-30 p-3 sm:absolute sm:inset-0 sm:p-4 md:p-8">
      <div
        className={`flex flex-col justify-center sm:h-full ${
          isEnglish
            ? "gap-3 md:gap-4"
            : "gap-2 sm:gap-3 md:gap-4"
        }`}
      >
        {showHeaderControls && !isStickyHeaderVisible && (
          <div className="flex w-full items-center justify-between gap-2 self-start sm:w-auto sm:justify-start lg:pt-1">
            <LocaleSwitcher locale={locale} compact />
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-2xl border border-white/30 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 p-3 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:from-emerald-500/30 hover:to-blue-500/30 sm:p-3.5"
              aria-label={ui.themeAria}
            >
              {theme === "dark" ? (
                <svg
                  className="h-5 w-5 text-white/80 sm:h-6 sm:w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-white/80 sm:h-6 sm:w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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

        <div className="w-full space-y-2 sm:space-y-3.5 md:space-y-4">
          <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 sm:max-w-5xl sm:flex-wrap sm:gap-2.5 sm:overflow-visible sm:pb-0">
            {heroStats.map((item) => (
              <div
                key={item.label}
                className="shrink-0 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-sm sm:shrink sm:px-3.5 sm:py-1.5"
              >
                <span className="whitespace-nowrap text-[11px] font-medium text-white/90 sm:text-sm">
                  {item.label} {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="max-w-2xl w-full">
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
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/85 sm:gap-2 sm:text-sm">
              <span className="hidden items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 backdrop-blur-sm sm:inline-flex sm:px-3">
                {isEnglish ? "Search target:" : "検索対象:"} {ui.searchTargetLabel}
              </span>
              {isEnglish && (
                <span className="hidden max-w-2xl items-center rounded-[1.4rem] border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-sm sm:inline-flex">
                  <span className="text-pretty">{ENGLISH_NAMING_NOTICE}</span>
                </span>
              )}
              <InfoPopover
                title={ui.searchHelpTitle}
                align="left"
                buttonAriaLabel={ui.searchHelpAria}
                buttonClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-white/20 sm:h-7 sm:w-7 sm:px-0 sm:text-sm"
                buttonContent={
                  <>
                    <span aria-hidden="true">?</span>
                    <span className="ml-1 sm:hidden">{isEnglish ? "Tips" : "使い方"}</span>
                  </>
                }
                panelClassName="border-slate-700 bg-slate-950 text-white shadow-[0_28px_90px_-30px_rgba(2,6,23,0.9)] ring-1 ring-white/10 backdrop-blur-none"
                contentClassName="space-y-2 text-slate-100"
                titleClassName="text-white"
              >
                <p>{ui.searchShortcut1}</p>
                <p>{ui.searchShortcut2}</p>
                <p>{ui.searchShortcut3}</p>
                {isEnglish && <p className="sm:hidden">{ENGLISH_NAMING_NOTICE}</p>}
              </InfoPopover>
              <Link
                to={localizePath("/quiz", locale)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/40 bg-amber-300/20 px-3 py-1 font-semibold text-white shadow-sm backdrop-blur-sm transition hover:bg-amber-300/30"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 4h3m-7 8h14a2 2 0 002-2V5a2 2 0 00-2-2H7L3 7v12a2 2 0 002 2z" />
                </svg>
                {isEnglish ? "Quiz" : "4択図鑑"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ExplorerHero;
