import InfoPopover from "./InfoPopover";
import LocaleSwitcher from "./LocaleSwitcher";
import SearchInput from "./SearchInput";
import logger from "../utils/logger";
import { ENGLISH_NAMING_NOTICE } from "../utils/englishNaming";
import { buildResponsivePicture } from "../utils/imageSrcset";
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
  suggestions,
  theme,
  ui,
}) => (
  <div
    id="hero-section"
    className={`group relative w-full ${
      isEnglish
        ? "min-h-[34rem] sm:min-h-[34rem] md:min-h-[38rem] lg:min-h-[40rem]"
        : "min-h-[25rem] sm:min-h-[25rem] md:min-h-[27rem] lg:min-h-[29rem]"
    }`}
  >
    <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl z-0">
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

    <div className="absolute inset-0 z-30 p-4 md:p-8">
      <div
        className={`flex h-full flex-col ${
          isEnglish
            ? "justify-between"
            : "justify-start gap-4 md:gap-7 lg:gap-8"
        }`}
      >
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl pt-1 md:pt-2">
            <p
              className={`bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text font-bold tracking-tight text-transparent drop-shadow-2xl ${
                isEnglish
                  ? "text-[clamp(1.25rem,2.6vw,2.25rem)] leading-tight"
                  : "text-[clamp(1.4rem,3vw,2.8rem)] leading-tight"
              }`}
            >
              {ui.heroLead}
            </p>
            <h1
              className={`mt-2 max-w-4xl bg-gradient-to-r from-blue-100 via-teal-100 to-emerald-100 bg-clip-text font-extrabold tracking-tight text-transparent drop-shadow-2xl ${
                isEnglish
                  ? "text-[clamp(2.4rem,4.8vw,4.9rem)] leading-[0.94]"
                  : "pb-2 text-[clamp(3rem,7.5vw,6.2rem)] leading-[0.98]"
              }`}
            >
              {ui.siteTitle}
            </h1>
          </div>

          {!isStickyHeaderVisible && (
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
        </div>

        <div className={`${isEnglish ? "mt-4 sm:mt-5" : "mt-1"} space-y-3.5 md:space-y-5`}>
          <div className="flex max-w-5xl flex-wrap gap-2 sm:gap-2.5">
            {heroStats.map((item) => (
              <div
                key={item.label}
                className="rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-sm sm:px-3.5 sm:py-1.5"
              >
                <span className="text-[11px] font-medium text-white/90 sm:text-sm">
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
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 backdrop-blur-sm sm:px-3">
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
                buttonClassName="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 sm:h-7 sm:w-7"
                panelClassName="border-slate-700 bg-slate-950 text-white shadow-[0_28px_90px_-30px_rgba(2,6,23,0.9)] ring-1 ring-white/10 backdrop-blur-none"
                contentClassName="space-y-2 text-slate-100"
                titleClassName="text-white"
              >
                <p>{ui.searchShortcut1}</p>
                <p>{ui.searchShortcut2}</p>
                <p>{ui.searchShortcut3}</p>
                {isEnglish && <p className="sm:hidden">{ENGLISH_NAMING_NOTICE}</p>}
              </InfoPopover>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ExplorerHero;
