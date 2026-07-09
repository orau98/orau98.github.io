import React, { useState, useMemo, useEffect, useCallback, useRef, useId } from "react";
import { Link, useLocation, useNavigationType, useSearchParams } from "react-router-dom";
import logger from "../utils/logger";
import useSeoMeta from "../hooks/useSeoMeta";
import { absUrl } from "../utils/origin";
import useDebounce from "../hooks/useDebounce";
import {
  buildJapaneseReferenceLabel,
  EN_SITE_NAME,
  getPrimaryEnglishName,
} from "../utils/englishNaming";
import {
  comparePlantImageDisplayPriority,
  createSafePlantFilename,
  createSafeScientificPlantFilename,
  splitFilenameBase,
} from "../utils/filename";
import { hiraganaToKatakana, normalizeNFKC } from "../utils/text";
import usePlantImageFilenames from "../hooks/usePlantImageFilenames";
import { getAssetBase, getAssetVersionQuery } from "../utils/assetPaths";
import Pagination from "./Pagination";
import ListFilterPanel from "./ListFilterPanel";
import { isEnglishLocale } from "../utils/locale";
import { makeDetailLinkState } from "../utils/navState";
import { normalizePlantKey } from "../utils/plantNameUtils";
import { buildPlantPath } from "../utils/siteTaxonomy";
import {
  formatScientificNameReact,
  renderLocalizedScientificNameListReact,
} from "../utils/scientificNameFormatter.jsx";
import {
  buildResponsivePicture,
} from "../utils/imageSrcset";
import ImageWithFallback from "./ImageWithFallback";
import NoPhotoPlaceholder, { CameraGlyph } from "./ui/NoPhotoPlaceholder";
import SearchableSelect from "./SearchableSelect";
import { ListDisplayControls, PresetFilterChips } from "./ListToolbar";
import ManualAdSlot from "./ManualAdSlot";
import { Card } from "./ui";
import { buildMoreLabel } from "../utils/hostVisitStyle";

const PER_PAGE_OPTIONS = [20, 50, 100];

// Local: normalize Latin binomial spacing without italicizing
const normalizeLatinBinomialPlain = (name) => {
  if (!name || typeof name !== "string") return name;
  const t = name.trim();
  // If contains Japanese, return as-is
  if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(t)) return t;
  // Already binomial -> collapse multiple spaces to single
  const spaced = t.match(/^([A-Z][a-z]+)\s+([a-z-]{3,})(.*)$/);
  if (spaced) return `${spaced[1]} ${spaced[2]}${spaced[3] || ""}`.trim();
  return t;
};

const HostPlantListItem = React.memo(
  ({
    plant,
    mothNames,
    relatedCount,
    plantDetails = {},
    insectDisplayNameMap = null,
    imageFilename,
    hasLarvalHost = false,
    hasFlowerVisit = false,
    locale = "ja",
    viewMode = "cards",
  }) => {
    const location = useLocation();
    const isEnglish = isEnglishLocale(locale);
    const [imageError, setImageError] = useState(false);

    const safePlantName = createSafePlantFilename(plant);
    const normalizedBase = getAssetBase();
    const assetVer = getAssetVersionQuery();
    const encoded = imageFilename ? encodeURIComponent(imageFilename) : "";
    const originalBaseUrl = `${normalizedBase}images/plants/`;
    const responsiveImage = imageFilename
      ? buildResponsivePicture({
          baseUrl: normalizedBase,
          folder: "plants",
          filename: imageFilename,
          // グリッドは md:2列 / lg:3列 / 2xl:4列。実際の表示幅と一致させ、
          // 過小指定でぼやけたり過大指定で帯域を無駄にしないようにする
          sizes: "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw",
          query: assetVer,
          sourceFormats: ["webp"],
        })
      : null;
    const originalFallbackUrls = imageFilename
      ? ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG"].map(
          (ext) => `${originalBaseUrl}${encoded}.${ext}${assetVer}`,
        )
      : [];
    const primaryImageSrc = responsiveImage?.src || originalFallbackUrls[0] || "";
    const fallbackImageCandidates = imageFilename
      ? Array.from(new Set([
          responsiveImage?.src,
          ...originalFallbackUrls,
        ].filter(Boolean)))
      : [];

    React.useEffect(() => {
      setImageError(false);
    }, [imageFilename, responsiveImage?.src, responsiveImage?.srcSet]);

    const totalCount =
      Number.isFinite(relatedCount) && relatedCount >= 0
        ? relatedCount
        : mothNames.length;
    const visibleNames = mothNames.slice(0, 4);
    const visibleDisplayNames = useMemo(
      () =>
        visibleNames
          .map((name) =>
            isEnglish ? insectDisplayNameMap?.get(name) || name : name,
          )
          .filter(Boolean),
      [visibleNames, insectDisplayNameMap, isEnglish],
    );
    const extraCount = Math.max(0, totalCount - visibleNames.length);
    const detail = plantDetails[plant] || {};
    const primaryName = isEnglish
      ? getPrimaryEnglishName({
          scientificName: detail.scientificName,
          japaneseName: plant,
          fallback: plant,
        })
      : /[A-Za-z]/.test(plant) && !/[\u3040-\u30FF\u3400-\u9FFF]/.test(plant)
        ? normalizeLatinBinomialPlain(plant)
        // \u898B\u51FA\u3057\u3067\u306F\u672B\u5C3E\u306E\u300C(\u25EF\u25EF\u79D1)\u300D\u3092\u843D\u3068\u3059\uFF08\u79D1\u540D\u306F secondaryName \u306B\u5225\u9014\u8868\u793A\u3055\u308C\u4E8C\u91CD\u306B\u306A\u308B\u305F\u3081\uFF09
        : (plant.replace(/\s*[\uFF08(][^\uFF09)]*\u79D1[^\uFF09)]*[\uFF09)]\s*$/, '').trim() || plant);
    const secondaryName = isEnglish ? buildJapaneseReferenceLabel(plant) : detail.familyName;

    if (viewMode === "compact") {
      return (
        <Card as="article" interactive className="group list-none overflow-hidden hover:border-emerald-400/60 dark:hover:border-emerald-500/60">
          <Link
            to={buildPlantPath(plant, locale)}
            state={makeDetailLinkState(location, { setFromList: true })}
            className="flex gap-3 p-3"
          >
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 sm:h-24 sm:w-24">
              {imageFilename && !imageError ? (
                <ImageWithFallback
                  src={primaryImageSrc}
                  candidates={fallbackImageCandidates}
                  subject="sprout"
                  alt={isEnglish ? `${primaryName} photograph` : `${plant}の写真`}
                  width="120"
                  height="120"
                  className="h-full w-full"
                  fit="contain"
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-emerald-500/70 dark:text-emerald-300/70">
                  <NoPhotoPlaceholder subject="sprout" size="sm" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 text-base font-bold text-emerald-800 dark:text-emerald-200">
                    {isEnglish && detail.scientificName ? formatScientificNameReact(primaryName) : primaryName}
                  </h3>
                  {secondaryName && (
                    <p className="line-clamp-1 text-sm text-emerald-700 dark:text-emerald-400">
                      {secondaryName}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {isEnglish ? `${totalCount} insects` : `昆虫 ${totalCount}種`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {hasLarvalHost && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {isEnglish ? "Host plant" : "食草"}
                  </span>
                )}
                {hasFlowerVisit && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                    {isEnglish ? "Flower visit" : "訪花"}
                  </span>
                )}
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${imageFilename ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"}`}>
                  {imageFilename ? (isEnglish ? "Photo" : "写真") : (isEnglish ? "No image listed" : "画像未掲載")}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm text-slate-600 dark:text-slate-300">
                {renderLocalizedScientificNameListReact(visibleDisplayNames, locale)}
                {extraCount > 0 && `${isEnglish ? ' ' : '…'}${buildMoreLabel(extraCount, isEnglish)}`}
              </p>
            </div>
          </Link>
        </Card>
      );
    }

    return (
      <article className="group relative h-full overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400/60 dark:hover:border-emerald-500/60 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-emerald-500/15 dark:hover:shadow-emerald-500/10 hover:-translate-y-1 transform shadow-sm list-none">
        {/* ホバー時のグラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 rounded-xl" />
        <Link
          to={buildPlantPath(plant, locale)}
          state={makeDetailLinkState(location, { setFromList: true })}
          className="block relative z-0 h-full"
        >
          <div className="flex flex-col h-full">
            {/* Enhanced Plant Image/Icon section */}
            <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
              {imageFilename && !imageError ? (
                // Actual plant image
                <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-900">
                  <ImageWithFallback
                    src={primaryImageSrc}
                    candidates={fallbackImageCandidates}
                    subject="sprout"
                    alt={isEnglish ? `${primaryName} photograph` : `${plant}の写真`}
                    width="800"
                    height="600"
                    className="w-full h-full"
                    fit="contain"
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      setImageError(true);
                    }}
                  />
                </div>
              ) : (
                // Fallback: 芽生えシルエット + カメラバッジで「植物の写真が未掲載」を伝える
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-700 dark:to-emerald-800 flex flex-col items-center justify-center p-5 sm:p-6">
                  <div className="flex-shrink-0 mb-4 text-emerald-500/80 dark:text-emerald-400/80">
                    <NoPhotoPlaceholder subject="sprout" size="lg" />
                  </div>

                  {/* No image indicator at bottom */}
                  <div className="flex-shrink-0 mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-300/70 dark:bg-emerald-600/70 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 dark:border-emerald-500/30">
                      <CameraGlyph className="w-3 h-3 mr-1" />
                      {isEnglish ? "No image listed" : "画像未掲載"}
                    </span>
                  </div>
                </div>
              )}
              {/* Decorative pattern overlay for non-image cards */}
              {(!imageFilename || imageError) && (
                <div className="absolute inset-0 opacity-10">
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 100 100"
                    fill="none"
                  >
                    <pattern
                      id={`plant-pattern-${safePlantName}`}
                      x="0"
                      y="0"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M10 2L8 8L10 14L12 8Z"
                        fill="currentColor"
                        className="text-emerald-500"
                      />
                      <circle
                        cx="10"
                        cy="8"
                        r="1"
                        fill="currentColor"
                        className="text-emerald-600"
                      />
                    </pattern>
                    <rect
                      width="100"
                      height="100"
                      fill={`url(#plant-pattern-${safePlantName})`}
                    />
                  </svg>
                </div>
              )}

              {/* Species count badge */}
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/90 text-white backdrop-blur-sm shadow-sm">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  {isEnglish ? `${totalCount} insect species` : `昆虫 ${totalCount}種`}
                </span>
              </div>

              {/* Gradient overlay - Removed since name is now below */}
            </div>

            {/* Enhanced Content section */}
            <div className="flex flex-col flex-grow p-3.5 sm:p-4">
              <div className="mb-2.5 sm:mb-3">
                <h3 className="mb-1 text-base font-bold leading-tight tracking-tight text-emerald-800 dark:text-emerald-200 sm:text-lg">
                  {isEnglish && detail.scientificName
                    ? formatScientificNameReact(primaryName)
                    : primaryName}
                </h3>
                {secondaryName && (
                  <p className="line-clamp-1 text-[13px] leading-relaxed text-emerald-700 dark:text-emerald-400 sm:line-clamp-none sm:text-sm">
                    {secondaryName}
                  </p>
                )}
                {(hasLarvalHost || hasFlowerVisit) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {hasLarvalHost && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/50">
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M8 1C5.5 1 3.5 3 3.5 5.5c0 1.2.4 2.3 1.1 3.1L3 12h10l-1.6-3.4c.7-.8 1.1-1.9 1.1-3.1C12.5 3 10.5 1 8 1zm0 1.5c1.7 0 3 1.3 3 3S9.7 8.5 8 8.5 5 7.2 5 5.5s1.3-3 3-3z"/>
                        </svg>
                        {isEnglish ? "Host plant" : "食草"}
                      </span>
                    )}
                    {hasFlowerVisit && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-700/50">
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M8 2a1 1 0 0 1 .894.553l1.382 2.764 3.09.447a1 1 0 0 1 .553 1.706L11.5 9.763l.528 3.078a1 1 0 0 1-1.45 1.054L8 12.347l-2.578 1.548a1 1 0 0 1-1.45-1.054l.528-3.078-2.419-2.293a1 1 0 0 1 .553-1.706l3.09-.447L7.106 2.553A1 1 0 0 1 8 2z"/>
                        </svg>
                        {isEnglish ? "Flower visit" : "訪花"}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-auto space-y-1.5 sm:space-y-2">
                <div className="flex items-start space-x-2 text-[13px] sm:text-sm">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 512 512">
                      <path d="M243.695,179.339c0.703,4.906,5.813,7.438,7.719,1.406c1.891-6.031-4.828-17.219-22.219-36.531c-14.828-16.484-35.625-39.391-23.844-51.578c14.609-10.078,8.469-27.75-4.172-29.469c-11.313-1.516-21.609,13.578-15.031,38.703C192.711,126.964,241.695,165.292,243.695,179.339z"/>
                      <path d="M445.898,83.886c-74.469,0-160.703,89.859-174.516,111.078c-3.594-4.578-9.109-7.578-15.375-7.578c-6.281,0-11.797,3-15.391,7.578C226.805,173.73,140.57,83.886,66.102,83.886c-76.828,0-70.547,68.984-59.578,112.891c10.969,43.922,56.453,92.516,106.609,94.094c-56.438,25.078-61.141,89.375-43.891,119.156c16.359,28.25,103.266,92.016,167.156-50.296v29.141c0,10.813,8.781,19.593,19.609,19.593c10.813,0,19.594-8.781,19.594-19.593v-29.156c63.891,142.328,150.813,78.562,167.156,50.312c17.25-29.781,12.547-94.078-43.891-119.156c50.172-1.578,95.641-50.172,106.609-94.094C516.445,152.871,522.727,83.886,445.898,83.886z"/>
                      <path d="M268.305,179.339c2-14.047,50.984-52.375,57.563-77.469c6.563-25.125-3.734-40.219-15.047-38.703c-12.641,1.719-18.766,19.391-4.172,29.469c11.781,12.188-9.016,35.094-23.844,51.578c-17.391,19.313-24.109,30.5-22.219,36.531C262.492,186.777,267.602,184.246,268.305,179.339z"/>
                    </svg>
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug sm:line-clamp-3">
                    {renderLocalizedScientificNameListReact(visibleDisplayNames, locale)}
                    {extraCount > 0 && `${isEnglish ? ' ' : '…'}${buildMoreLabel(extraCount, isEnglish)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </article>
    );
  },
);

const HostPlantList = ({
  hostPlants = {},
  flowerVisitPlants = {},
  plantDetails = {},
  insectDisplayNameMap = null,
  embedded = false,
  preloadedImageFilenames = [],
  initialSearchTerm = "",
  plantInsectStats = null,
  locale = "ja",
}) => {
  const isEnglish = isEnglishLocale(locale);
  const ui = useMemo(
    () => ({
      filterTitle: isEnglish ? 'Advanced filters' : '詳細フィルタ',
      filteredBy: isEnglish ? 'Filtered by:' : '絞り込み:',
      resetAll: isEnglish ? 'Reset all' : 'すべてリセット',
      any: isEnglish ? 'Any' : '指定なし',
      order: isEnglish ? 'Order' : '目',
      family: isEnglish ? 'Family' : '科',
      flowerVisit: isEnglish ? 'Flower visit' : '訪花',
      flowerOnly: isEnglish ? 'Flower visits only' : '訪花のみ',
      photo: isEnglish ? 'Photo' : '写真',
      withPhoto: isEnglish ? 'With photos' : '写真あり',
      hostPlantsOnly: isEnglish ? 'Host plants' : '食草あり',
      presetLabel: isEnglish ? 'Quick filters:' : 'クイック絞り込み:',
      familyLabel: isEnglish ? 'Family:' : '科で絞り込み:',
      view: isEnglish ? 'View' : '表示',
      cards: isEnglish ? 'Cards' : 'カード',
      compact: isEnglish ? 'Compact' : 'コンパクト',
      perPage: isEnglish ? 'Per page' : '表示件数',
      autoPerPage: (value) => (isEnglish ? `Auto (${value})` : `自動 (${value})`),
      sort: isEnglish ? 'Sort' : '並び替え',
      sortImage: isEnglish ? 'Photos first' : '写真あり優先',
      sortName: isEnglish ? 'Name' : '名前順',
      sortFamily: isEnglish ? 'Family' : '科順',
      sortRelated: isEnglish ? 'Linked insects' : '関連昆虫数順',
      resultCount: (value) => (isEnglish ? `${value} results` : `${value} 件が見つかりました`),
      listTitle: isEnglish ? 'Plant list' : '植物リスト',
      emptyTitle: isEnglish ? 'No matching plants found' : '結果が見つかりませんでした',
      tryAnother: isEnglish ? 'Try another keyword or family.' : '別のキーワードや科名でお試しください。',
      examples: isEnglish ? 'Examples:' : '例えば:',
      exampleSearches: isEnglish
        ? ['Quercus', 'Rosaceae', 'Salix', 'Fabaceae']
        : ['サクラ', 'クヌギ', 'バラ科', 'ススキ'],
      activeFilters: isEnglish ? 'Current filters:' : '現在の条件:',
      searchOnlyClear: isEnglish ? 'Clear search only' : '検索のみクリア',
      clearSearch: isEnglish ? 'Clear search' : '検索をクリア',
      clearFilters: isEnglish ? 'Clear filters' : 'フィルター解除',
    }),
    [isEnglish],
  );
  // Canonical/OG/パンくず（フックで共通化）
  const safeHostPlants = useMemo(() => hostPlants || {}, [hostPlants]);
  const safePlantDetails = useMemo(() => plantDetails || {}, [plantDetails]);
  const aliasToCanonical = useMemo(() => {
    const map = new Map();
    Object.entries(safePlantDetails || {}).forEach(([canonical, detail]) => {
      if (!canonical || !detail) return;
      const aliasesRaw = detail.aliases || detail.aliasNames;
      const aliases = Array.isArray(aliasesRaw)
        ? aliasesRaw
        : aliasesRaw instanceof Set
          ? Array.from(aliasesRaw)
          : [];
      aliases.forEach((alias) => {
        const key = (alias || "").trim();
        if (key) map.set(key, canonical);
      });
    });
    return map;
  }, [safePlantDetails]);

  const normalizedToCanonical = useMemo(() => {
    const map = new Map();
    Object.keys(safePlantDetails || {}).forEach((name) => {
      if (!name) return;
      const normalized = normalizePlantKey(name);
      if (!normalized) return;
      if (!map.has(normalized)) {
        map.set(normalized, name);
        return;
      }
      const existing = map.get(normalized);
      if (existing === normalized) return;
      if (name === normalized) {
        map.set(normalized, name);
        return;
      }
      const existingHasParen = /[（(].*[)）]/.test(existing);
      const nameHasParen = /[（(].*[)）]/.test(name);
      if (existingHasParen && !nameHasParen) {
        map.set(normalized, name);
      }
    });
    return map;
  }, [safePlantDetails]);
  const compareLocalizedValues = useCallback(
    (a, b) =>
      String(a || "").localeCompare(String(b || ""), isEnglish ? "en" : "ja"),
    [isEnglish],
  );
  const getPlantPrimaryName = useCallback(
    (plantName) => {
      const detail = safePlantDetails[plantName] || {};
      if (isEnglish) {
        return getPrimaryEnglishName({
          scientificName: detail.scientificName,
          japaneseName: plantName,
          fallback: plantName,
        });
      }
      return /[A-Za-z]/.test(plantName) && !/[\u3040-\u30FF\u3400-\u9FFF]/.test(plantName)
        ? normalizeLatinBinomialPlain(plantName)
        : plantName;
    },
    [isEnglish, safePlantDetails],
  );
  const getFamilyDisplayValue = useCallback(
    (detail = {}) => {
      const localized = (detail.family || detail.familyName || "").trim();
      const latin = (detail.familyLatin || "").trim();
      return isEnglish ? latin || localized : localized || latin;
    },
    [isEnglish],
  );
  const getOrderDisplayValue = useCallback(
    (detail = {}) => {
      const localized = (detail.order || "").trim();
      const latin = (detail.orderLatin || "").trim();
      return isEnglish ? latin || localized : localized || latin;
    },
    [isEnglish],
  );

  const mergedHostPlants = useMemo(() => {
    const merged = new Map();
    const addEntry = (plantName, insects = []) => {
      if (!plantName || plantName === '不明') return;
      const normalized = normalizePlantKey(plantName);
      if (!normalized || normalized === '不明') return;
      const canonicalFromAlias =
        aliasToCanonical.get(plantName) ||
        aliasToCanonical.get(normalized) ||
        null;
      const canonical = canonicalFromAlias || normalizedToCanonical.get(normalized) || normalized;
      let set = merged.get(canonical);
      if (!set) {
        set = new Set();
        merged.set(canonical, set);
      }
      if (Array.isArray(insects)) {
        insects.forEach((name) => {
          if (name) set.add(name);
        });
      }
    };
    Object.entries(safeHostPlants || {}).forEach(([plant, insects]) => {
      addEntry(plant, insects);
    });
    Object.entries(flowerVisitPlants || {}).forEach(([plant, insects]) => {
      addEntry(plant, insects);
    });
    Object.entries(safePlantDetails || {}).forEach(([plant, detail]) => {
      if (detail?.profile) addEntry(plant, []);
    });
    const obj = {};
    merged.forEach((set, key) => {
      obj[key] = Array.from(set);
    });
    return obj;
  }, [safeHostPlants, flowerVisitPlants, safePlantDetails, normalizedToCanonical, aliasToCanonical]);

  const plantCount = Object.keys(mergedHostPlants).length;
  const plantCanonicalUrl = absUrl(locale === "en" ? "/en/plant" : "/plant");
  const plantPageTitle = isEnglish ? `Plant index | ${EN_SITE_NAME}` : "植物（食草）一覧 | 昆虫植物図鑑";
  const plantPageDesc = isEnglish
    ? `Browse ${plantCount} plant entries and review the insects associated with each plant. Search by scientific name, genus, family, alias, or Japanese name.`
    : `植物（食草）一覧ページ。${plantCount}種の植物から、利用する昆虫を一覧で確認。和名・別名でも検索可能。`;
  const plantBreadcrumbItems = useMemo(
    () => [
      { name: isEnglish ? EN_SITE_NAME : "昆虫植物図鑑", url: absUrl(locale === "en" ? "/en/" : "/") },
      { name: isEnglish ? "Plants" : "植物", url: plantCanonicalUrl },
    ],
    [isEnglish, locale, plantCanonicalUrl],
  );

  useSeoMeta({
    enabled: !embedded,
    title: plantPageTitle,
    description: plantPageDesc,
    ogType: "website",
    url: plantCanonicalUrl,
    locale: isEnglish ? "en_US" : "ja_JP",
    htmlLang: locale,
    siteName: isEnglish ? EN_SITE_NAME : "昆虫植物図鑑",
    breadcrumbItems: plantBreadcrumbItems,
    resetCanonicalTo: absUrl(locale === "en" ? "/en/" : "/"),
  });
  // Responsive items-per-page to avoid empty grid slots on last row
  const computeItemsPerPage = useCallback(() => {
    if (typeof window === "undefined") return 12;
    const w = window.innerWidth;
    const cols = w >= 1280 ? 4 : w >= 1024 ? 3 : w >= 768 ? 2 : 1;
    return cols * 12;
  }, []);
  const [itemsPerPage, setItemsPerPage] = useState(computeItemsPerPage());
  // 植物画像ファイル名は共有フックで取得し、親から事前供給があればそちらを優先
  const loadedPlantImageFilenames = usePlantImageFilenames();
  const plantImageFilenames =
    preloadedImageFilenames && preloadedImageFilenames.length > 0
      ? preloadedImageFilenames
      : loadedPlantImageFilenames;
  
  // State for filters
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const listTopRef = useRef(null);
  // push:true でブラウザ履歴に積む（＝「戻る」で直前の絞り込み状態に戻せる）。
  // 既定は replace（逐次検索・プログラム的リセット・表示専用の切替はエントリを増やさない）。
  const updateSearchParams = useCallback((mutate, { push = false } = {}) => {
    let next;
    try {
      next = new URLSearchParams(window.location.search || '');
    } catch {
      next = new URLSearchParams(searchParams);
    }
    try {
      mutate(next);
    } catch {}
    setSearchParams(next, { replace: !push });
  }, [searchParams, setSearchParams]);

  const currentPage = useMemo(() => {
    const raw = searchParams.get('ppage');
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [searchParams]);

  const familyFilter = useMemo(() => searchParams.get('pfamily') || '', [searchParams]);
  const orderFilter = useMemo(() => searchParams.get('porder') || '', [searchParams]);
  const visitFilter = useMemo(() => searchParams.get('pvisit') || 'all', [searchParams]);
  const hostOnlyFilter = useMemo(() => searchParams.get('phost') === 'has', [searchParams]);
  const photoFilter = useMemo(() => (searchParams.get('pphoto') === 'has' ? 'has' : 'all'), [searchParams]);
  const viewMode = useMemo(() => (searchParams.get('pview') === 'compact' ? 'compact' : 'cards'), [searchParams]);
  const sortMode = useMemo(() => {
    const v = searchParams.get('psort') || 'image';
    return ['image', 'name', 'family', 'related'].includes(v) ? v : 'image';
  }, [searchParams]);
  const requestedItemsPerPage = useMemo(() => {
    const n = parseInt(searchParams.get('pper') || '', 10);
    return PER_PAGE_OPTIONS.includes(n) ? n : null;
  }, [searchParams]);
  const effectiveItemsPerPage = requestedItemsPerPage || itemsPerPage;

  // フィルタ変更に伴う自動リセット setPPage(1) は replace、
  // ユーザーのページ送りは push（handlePageChange 側で { push: true } を渡す）。
  const setPPage = useCallback((page, opts) => {
    updateSearchParams((p) => {
      const n = parseInt(page, 10);
      if (Number.isFinite(n) && n > 1) p.set('ppage', String(n));
      else p.delete('ppage');
    }, opts);
  }, [updateSearchParams]);

  // 内容フィルタの変更はユーザーの明示的操作なので push（戻るで解除前に戻せる）
  const setPFamilyFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('pfamily', v);
      else p.delete('pfamily');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const setPOrderFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('porder', v);
      else p.delete('porder');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const setPVisitFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v && v !== 'all') p.set('pvisit', v);
      else p.delete('pvisit');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const setPHostOnlyFilter = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'has') p.set('phost', 'has');
      else p.delete('phost');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const setPPhotoFilter = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'has') p.set('pphoto', 'has');
      else p.delete('pphoto');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const setPViewMode = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'compact') p.set('pview', 'compact');
      else p.delete('pview');
    });
  }, [updateSearchParams]);

  const setPSortMode = useCallback((value) => {
    updateSearchParams((p) => {
      if (value && value !== 'image') p.set('psort', value);
      else p.delete('psort');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const setPItemsPerPage = useCallback((value) => {
    updateSearchParams((p) => {
      const n = parseInt(value, 10);
      if (PER_PAGE_OPTIONS.includes(n)) p.set('pper', String(n));
      else p.delete('pper');
      p.delete('ppage');
      // ppageを消す＝表示内容が変わる明示的操作なのでpush（戻るで復帰可能に）
    }, { push: true });
  }, [updateSearchParams]);

  const clearFilters = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('pfamily');
      p.delete('porder');
      p.delete('pvisit');
      p.delete('phost');
      p.delete('pphoto');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  // 「検索をクリア」「すべてリセット」はユーザーの明示的操作なので
  // clearFiltersと同様にpushし、戻るで直前の絞り込み状態へ復帰できるようにする
  const clearSearch = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('q');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  const resetAll = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('pfamily');
      p.delete('porder');
      p.delete('pvisit');
      p.delete('phost');
      p.delete('pphoto');
      p.delete('q');
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  // 空状態の例示チップ。q を URL に載せると親（explorer）が activeSearchTerm を
  // 同期し直し、initialSearchTerm 経由で本コンポーネントに戻ってくる。
  const applyExampleSearch = useCallback((value) => {
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    // 例示チップのクリックも明示的な検索確定なのでpush
    updateSearchParams((p) => {
      p.set('q', nextValue);
      p.delete('ppage');
    }, { push: true });
  }, [updateSearchParams]);

  // 実際の絞り込みに使う値（debouncedPlantSearch）から表示用の検索状態を導出し、
  // フィルタと検索チップ/空状態表示が常に一致するようにする（URL q との二系統ずれを解消）
  const debouncedPlantSearch = useDebounce(initialSearchTerm, 300);
  // 戻る/進む(POP)による復元をユーザーの絞り込み操作と区別するために参照する
  const navigationType = useNavigationType();
  const searchQuery = useMemo(() => (debouncedPlantSearch || '').trim(), [debouncedPlantSearch]);
  const hasSearchQuery = searchQuery.length > 0;
  const hasFilterCriteria = !!familyFilter || !!orderFilter || visitFilter !== 'all' || hostOnlyFilter || photoFilter === 'has';
  const hasAnyCriteria = hasFilterCriteria || hasSearchQuery;
  // URLパラメータの科/目は選択時のロケール表記のまま残るため、表示前に
  // 現在ロケールの表記へ解決する（照合は元々ゆれ耐性がある。表示だけの問題）
  const resolveTaxonDisplay = useCallback((rawValue, pickValues, getDisplay) => {
    const value = String(rawValue || '').trim();
    if (!value) return '';
    const target = value.toLowerCase();
    for (const detail of Object.values(safePlantDetails)) {
      const values = pickValues(detail)
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
      if (values.includes(target)) return getDisplay(detail) || value;
    }
    return value;
  }, [safePlantDetails]);
  const familyFilterDisplay = useMemo(
    () => resolveTaxonDisplay(
      familyFilter,
      (d) => [d.family, d.familyName, d.familyLatin],
      getFamilyDisplayValue,
    ),
    [familyFilter, resolveTaxonDisplay, getFamilyDisplayValue],
  );
  const orderFilterDisplay = useMemo(
    () => resolveTaxonDisplay(
      orderFilter,
      (d) => [d.order, d.orderLatin],
      getOrderDisplayValue,
    ),
    [orderFilter, resolveTaxonDisplay, getOrderDisplayValue],
  );

  const activeFilters = useMemo(() => {
    const filters = [];
    if (hasSearchQuery) filters.push({ type: isEnglish ? 'Search' : '検索', value: searchQuery, clear: clearSearch });
    if (familyFilter) filters.push({ type: ui.family, value: familyFilterDisplay, clear: () => setPFamilyFilter('') });
    if (orderFilter) filters.push({ type: ui.order, value: orderFilterDisplay, clear: () => setPOrderFilter('') });
    if (visitFilter !== 'all') filters.push({ type: ui.flowerVisit, value: isEnglish ? 'Only' : 'のみ', clear: () => setPVisitFilter('all') });
    if (hostOnlyFilter) filters.push({ type: isEnglish ? 'Host plant' : '食草', value: isEnglish ? 'Yes' : 'あり', clear: () => setPHostOnlyFilter('all') });
    if (photoFilter === 'has') filters.push({ type: ui.photo, value: ui.withPhoto, clear: () => setPPhotoFilter('all') });
    return filters;
  }, [
    hasSearchQuery,
    searchQuery,
    familyFilter,
    familyFilterDisplay,
    orderFilter,
    orderFilterDisplay,
    visitFilter,
    hostOnlyFilter,
    photoFilter,
    clearSearch,
    setPFamilyFilter,
    setPOrderFilter,
    setPVisitFilter,
    setPHostOnlyFilter,
    setPPhotoFilter,
    isEnglish,
    ui.family,
    ui.flowerVisit,
    ui.order,
    ui.photo,
    ui.withPhoto,
  ]);
  const emptyStateHint = useMemo(() => {
    if (!hasSearchQuery && !hasFilterCriteria) {
      return isEnglish
        ? 'The list is still loading. Please try again shortly.'
        : '登録データを確認中です。時間をおいて再読み込みしてください。';
    }
    if (hasSearchQuery && hasFilterCriteria) {
      return isEnglish
        ? 'The current search plus filters may be too restrictive.'
        : '検索語とフィルター条件を同時に絞り込んでいるため、結果が0件になっている可能性があります。';
    }
    if (hasSearchQuery) {
      return isEnglish
        ? 'Try searching again with a scientific name, genus, family, alias, or Japanese name.'
        : '和名・学名・別名のいずれかで再検索すると見つかる場合があります。';
    }
    return isEnglish
      ? 'Relax one or more filters to see results.'
      : 'フィルター条件を緩めると結果が表示される可能性があります。';
  }, [hasFilterCriteria, hasSearchQuery, isEnglish]);
  const activeFilterSummary = useMemo(
    () => activeFilters.map((filter) => `${filter.type}:${filter.value}`).join(' / '),
    [activeFilters],
  );
  const filterIdBase = useId();
  const orderFilterId = `${filterIdBase}-order`;
  const familyFilterId = `${filterIdBase}-family`;
  const visitFilterId = `${filterIdBase}-visit`;
  const filtersPanelId = `${filterIdBase}-filters`;

  // Update itemsPerPage on resize to keep pages filling complete rows
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => {
      const next = computeItemsPerPage();
      setItemsPerPage((prev) => {
        if (prev === next) return prev;
        // Reset pagination only when the breakpoint changes (mobile address bar resize shouldn't).
        setPPage(1);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [computeItemsPerPage, setPPage]);

  const filterCriteriaRef = useRef({
    debouncedPlantSearch,
    familyFilter,
    orderFilter,
    visitFilter,
    hostOnlyFilter,
    photoFilter,
    sortMode,
  });

  // （メタは useSeoMeta に移行）

  // ItemList JSON-LD for plant list (first 10)
  useEffect(() => {
    if (embedded) return;
    try {
      const items = Object.keys(mergedHostPlants || {})
        .slice(0, 10)
        .map((name, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: absUrl(`/meta/plant/${encodeURIComponent(name)}.html`),
        }));
      const id = "itemlist-plant";
      let s = document.querySelector("#" + id);
      if (!s) {
        s = document.createElement("script");
        s.id = id;
        s.type = "application/ld+json";
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: items,
      });
    } catch (error) {
      logger.debug("Failed to inject plant item list structured data:", error);
    }
    return () => {
      const s = document.querySelector("#itemlist-plant");
      if (s) s.remove();
    };
  }, [embedded, mergedHostPlants]);

  // Pre-calculate plant image mapping to avoid O(N^2) during sort
  const plantImageMap = useMemo(() => {
    if (!plantImageFilenames || plantImageFilenames.length === 0) return new Map();
    
    const map = new Map();
    
    // Optimize: Create a map of base filename -> array of full filenames for fast lookup
    // e.g., "Quercus_acutissima" -> ["Quercus_acutissima_leaf", "Quercus_acutissima_flower"]
    const baseToFiles = new Map();
    plantImageFilenames.forEach(filename => {
      const base = splitFilenameBase(filename);
      if (!baseToFiles.has(base)) {
        baseToFiles.set(base, []);
      }
      baseToFiles.get(base).push(filename);
    });

    Object.keys(mergedHostPlants).forEach(plantName => {
      if (!plantName || plantName === "不明" || plantName.endsWith("科")) return;

      const detail = safePlantDetails[plantName] || {};
      const normalized = normalizePlantKey(plantName);
      // 名前解決（mergedHostPlants と同じ経路）: alias だけでなく normalizedToCanonical も参照し、
      // 「別名では写真が出るが正規名では出ない」逆転を防ぐ
      const canonicalFromAlias =
        aliasToCanonical.get(plantName) ||
        aliasToCanonical.get(normalized) ||
        normalizedToCanonical.get(normalized) ||
        null;
      const aliases = Array.isArray(detail.aliases) ? detail.aliases : [];
      const synonymPairs = {
        ビナンカズラ: ["サネカズラ"],
        サネカズラ: ["ビナンカズラ"],
      };
      const extraSynonyms = synonymPairs[plantName] || [];
      const scientificBase = createSafeScientificPlantFilename(detail.scientificName || '');
      
      // Build candidate bases
      const candidates = new Set([
        plantName,
        plantName.split(" ")[0],
        normalized,
        normalized ? normalized.split(" ")[0] : null,
        createSafePlantFilename(plantName),
        createSafePlantFilename(plantName.split(" ")[0]),
        normalized ? createSafePlantFilename(normalized) : null,
        normalized ? createSafePlantFilename(normalized.split(" ")[0]) : null,
        scientificBase,
        ...(canonicalFromAlias
          ? [
              canonicalFromAlias,
              canonicalFromAlias.split(" ")[0],
              createSafePlantFilename(canonicalFromAlias),
              createSafePlantFilename(canonicalFromAlias.split(" ")[0]),
            ]
          : []),
        ...aliases.flatMap((name) => {
          const base = (name || "").split(" ")[0];
          const cleaned = createSafePlantFilename(name);
          const cleanedBase = createSafePlantFilename(base);
          return [name, base, cleaned, cleanedBase];
        }),
        ...extraSynonyms.flatMap((name) => {
          const base = (name || "").split(" ")[0];
          const cleaned = createSafePlantFilename(name);
          const cleanedBase = createSafePlantFilename(base);
          return [name, base, cleaned, cleanedBase];
        }),
      ].filter(Boolean));

      let matches = [];
      for (const candidate of candidates) {
        if (baseToFiles.has(candidate)) {
          matches.push(...baseToFiles.get(candidate));
        }
      }

      if (matches.length > 0) {
        matches.sort(comparePlantImageDisplayPriority);
        map.set(plantName, matches[0]);
      }
    });
    return map;
  }, [plantImageFilenames, mergedHostPlants, safePlantDetails, aliasToCanonical, normalizedToCanonical]);

  // Generate filter options
  // ラテン名は出典により大文字小文字がゆれる（Rosaceae/ROSACEAE）ため、
  // 大小無視で重複排除して1項目に束ねる（ビルド側でも正規化しているが防御的に）
  const dedupeCaseInsensitive = (values) => {
    const byKey = new Map();
    values.forEach((value) => {
      const key = value.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, value);
    });
    return Array.from(byKey.values());
  };

  const familyOptions = useMemo(() => {
    const list = [];
    Object.values(safePlantDetails).forEach((d) => {
      const fam = getFamilyDisplayValue(d);
      if (fam && fam !== '不明') list.push(fam);
    });
    return dedupeCaseInsensitive(list).sort(compareLocalizedValues);
  }, [safePlantDetails, getFamilyDisplayValue, compareLocalizedValues]);

  const orderOptions = useMemo(() => {
    const list = [];
    Object.values(safePlantDetails).forEach((d) => {
      const ord = getOrderDisplayValue(d);
      if (ord && ord !== '不明') list.push(ord);
    });
    return dedupeCaseInsensitive(list).sort(compareLocalizedValues);
  }, [safePlantDetails, getOrderDisplayValue, compareLocalizedValues]);

  // 出現頻度の高い科をワンタップチップにする（ドロップダウンを開かず主要な科を絞れるように）
  const topFamilies = useMemo(() => {
    const counts = new Map();
    Object.keys(mergedHostPlants || {}).forEach((plantName) => {
      const fam = getFamilyDisplayValue(safePlantDetails[plantName] || {});
      if (fam && fam !== '不明') counts.set(fam, (counts.get(fam) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || compareLocalizedValues(a[0], b[0]))
      .slice(0, 8)
      .map(([fam]) => fam);
  }, [mergedHostPlants, safePlantDetails, getFamilyDisplayValue, compareLocalizedValues]);

  const filteredHostPlants = useMemo(() => {
    logger.debug(
      "DEBUG: Filtering plants (summary only)",
      Object.keys(mergedHostPlants).length,
      "search term:",
      debouncedPlantSearch,
    );
    if (!mergedHostPlants || Object.keys(mergedHostPlants).length === 0) {
      logger.debug("DEBUG: No host plants available");
      return [];
    }
    // NFKC正規化で半角カナ・全角英数の表記ゆれを吸収（例: ﾌﾞﾅ→ブナ）
    const nfkcPlantSearch = normalizeNFKC(debouncedPlantSearch);
    const lowerCaseSearchTerm = nfkcPlantSearch.toLowerCase();
    // ひらがな入力をカタカナに変換して検索
    const katakanaSearchTerm =
      hiraganaToKatakana(nfkcPlantSearch).toLowerCase();

    const filtered = Object.entries(mergedHostPlants).filter(([plantName]) => {
      // Explicitly exclude empty, undefined, or invalid plant names
      if (
        !plantName ||
        plantName.trim() === "" ||
        plantName === "undefined" ||
        plantName === "null"
      ) {
        return false;
      }

      const detail = safePlantDetails[plantName] || {};
      
      // Apply Family Filter
      if (familyFilter) {
        // ラテン名の大小文字ゆれで同一科が分裂しないよう大小無視で照合する
        const familyValues = [
          getFamilyDisplayValue(detail),
          detail.family,
          detail.familyName,
          detail.familyLatin,
        ]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean);
        if (!familyValues.includes(familyFilter.trim().toLowerCase())) return false;
      }

      // Apply Order Filter
      if (orderFilter) {
        const orderValues = [
          getOrderDisplayValue(detail),
          detail.order,
          detail.orderLatin,
        ]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean);
        if (!orderValues.includes(orderFilter.trim().toLowerCase())) return false;
      }

      // Apply Flower Visit Filter
      if (visitFilter !== 'all') {
        const normalizedPlant = normalizePlantKey(plantName);
        const hasFlowerVisit = !!(
          flowerVisitPlants?.[plantName] ||
          (normalizedPlant && flowerVisitPlants?.[normalizedPlant])
        );
        const hasLarvalHost = !!(
          safeHostPlants?.[plantName] ||
          (normalizedPlant && safeHostPlants?.[normalizedPlant])
        );
        const isFlowerOnly = hasFlowerVisit && !hasLarvalHost;
        if (!isFlowerOnly) return false;
      }

      if (hostOnlyFilter) {
        const normalizedPlant = normalizePlantKey(plantName);
        const hasLarvalHost = !!(
          safeHostPlants?.[plantName] ||
          (normalizedPlant && safeHostPlants?.[normalizedPlant])
        );
        if (!hasLarvalHost) return false;
      }

      if (photoFilter === 'has' && !plantImageMap.has(plantName)) {
        return false;
      }

      // Apply Search Term
      if (!lowerCaseSearchTerm) {
        return true; // No search term, pass
      }

      const family = (detail.family || "").toLowerCase();
      const familyLatin = (detail.familyLatin || "").toLowerCase();
      const scientificName = normalizeLatinBinomialPlain(
        detail.scientificName || "",
      ).toLowerCase();
      const genus = (detail.genus || "").toLowerCase();
      const order = (detail.order || "").toLowerCase();
      const orderLatin = (detail.orderLatin || "").toLowerCase();
      const aliasesRaw = detail.aliases || detail.aliasNames;
      const aliases = Array.isArray(aliasesRaw)
        ? aliasesRaw
        : aliasesRaw instanceof Set
          ? Array.from(aliasesRaw)
          : [];
      const aliasHit = aliases.some((a) => {
        const aLower = (a || "").toLowerCase();
        return (
          aLower.includes(lowerCaseSearchTerm) ||
          aLower.includes(katakanaSearchTerm)
        );
      });

      // オリジナルの検索条件に加えて、カタカナ変換後の検索も追加
      return (
        plantName.toLowerCase().includes(lowerCaseSearchTerm) ||
        plantName.toLowerCase().includes(katakanaSearchTerm) ||
        family.includes(lowerCaseSearchTerm) ||
        family.includes(katakanaSearchTerm) ||
        familyLatin.includes(lowerCaseSearchTerm) ||
        scientificName.includes(lowerCaseSearchTerm) ||
        genus.includes(lowerCaseSearchTerm) ||
        genus.includes(katakanaSearchTerm) ||
        order.includes(lowerCaseSearchTerm) ||
        order.includes(katakanaSearchTerm) ||
        orderLatin.includes(lowerCaseSearchTerm) ||
        aliasHit
      );
    });

    const getRelatedCount = (plantName, insects = []) => {
      const normalizedPlant = normalizePlantKey(plantName);
      const statsCount =
        plantInsectStats?.countsByPlant?.[plantName] ??
        (normalizedPlant && plantInsectStats?.countsByPlant?.[normalizedPlant]);
      return Number.isFinite(statsCount) && statsCount >= 0 ? statsCount : insects.length;
    };

    const sorted = filtered.sort(([a], [b]) => {
      const aHasImage = plantImageMap.has(a);
      const bHasImage = plantImageMap.has(b);

      if (a === "不明") return 1;
      if (b === "不明") return -1;
      if (sortMode === "image") {
        if (aHasImage && !bHasImage) return -1;
        if (!aHasImage && bHasImage) return 1;
        // 写真あり/なしの各グループ内は名前順で整列（写真なしが集まる後半でも探しやすく）
        return compareLocalizedValues(getPlantPrimaryName(a), getPlantPrimaryName(b));
      }
      if (sortMode === "family") {
        const familyCompare = compareLocalizedValues(
          getFamilyDisplayValue(safePlantDetails[a] || {}),
          getFamilyDisplayValue(safePlantDetails[b] || {}),
        );
        if (familyCompare !== 0) return familyCompare;
      }
      if (sortMode === "related") {
        const countDiff = getRelatedCount(b, mergedHostPlants[b]) - getRelatedCount(a, mergedHostPlants[a]);
        if (countDiff !== 0) return countDiff;
      }
      return compareLocalizedValues(getPlantPrimaryName(a), getPlantPrimaryName(b));
    });

    return sorted;
  }, [
    mergedHostPlants,
    flowerVisitPlants,
    safeHostPlants,
    safePlantDetails,
    debouncedPlantSearch,
    plantImageMap,
    familyFilter,
    orderFilter,
    visitFilter,
    hostOnlyFilter,
    photoFilter,
    sortMode,
    plantInsectStats,
    compareLocalizedValues,
    getFamilyDisplayValue,
    getOrderDisplayValue,
    getPlantPrimaryName,
  ]);

  const hasImagePriority = plantImageMap.size > 0;
  const imagePriorityRef = useRef(hasImagePriority);
  useEffect(() => {
    if (!imagePriorityRef.current && hasImagePriority) {
      setPPage(1);
    }
    imagePriorityRef.current = hasImagePriority;
  }, [hasImagePriority, setPPage]);

  // Add rel=prev/next for plant list pagination
  useEffect(() => {
    if (typeof document === "undefined") return;
    try {
      const pageCount = Math.ceil(filteredHostPlants.length / effectiveItemsPerPage);
      const activePage = pageCount > 0 ? Math.min(currentPage, pageCount) : 1;
      document
        .querySelectorAll('link[rel="prev"], link[rel="next"]')
        .forEach((n) => n.remove());
      const url = new URL(window.location.href);
      url.searchParams.delete("ppage");
      if (activePage > 1) {
        const prev = document.createElement("link");
        prev.rel = "prev";
        const prevUrl = new URL(url.href);
        if (activePage - 1 > 1) {
          prevUrl.searchParams.set("ppage", String(activePage - 1));
        }
        prev.href = prevUrl.toString();
        document.head.appendChild(prev);
      }
      if (activePage < pageCount) {
        const next = document.createElement("link");
        next.rel = "next";
        const nextUrl = new URL(url.href);
        nextUrl.searchParams.set("ppage", String(activePage + 1));
        next.href = nextUrl.toString();
        document.head.appendChild(next);
      }
    } catch (error) {
      logger.debug(
        "Failed to update rel prev/next links for plant list:",
        error,
      );
    }
  }, [currentPage, effectiveItemsPerPage, filteredHostPlants.length]);
  const totalPages = Math.ceil(filteredHostPlants.length / effectiveItemsPerPage);
  // URLのppageが総ページ数を超える場合は最終ページへ丸める
  // （共有URLや表示件数変更で範囲外になっても、空の一覧を表示しない）
  const effectivePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const currentHostPlants = useMemo(() => {
    const startIndex = (effectivePage - 1) * effectiveItemsPerPage;
    const endIndex = startIndex + effectiveItemsPerPage;
    return filteredHostPlants.slice(startIndex, endIndex);
  }, [filteredHostPlants, effectivePage, effectiveItemsPerPage]);

  const handlePageChange = (page) => {
    const nextPage = parseInt(page, 10);
    if (!Number.isFinite(nextPage)) return;
    const clampedPage = Math.min(Math.max(nextPage, 1), Math.max(totalPages, 1));
    if (clampedPage === effectivePage) return;
    setPPage(clampedPage, { push: true });
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const target = listTopRef.current || document.getElementById('explorer-results');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  React.useEffect(() => {
    const prev = filterCriteriaRef.current;
    const changed =
      prev.debouncedPlantSearch !== debouncedPlantSearch ||
      prev.familyFilter !== familyFilter ||
      prev.orderFilter !== orderFilter ||
      prev.visitFilter !== visitFilter ||
      prev.hostOnlyFilter !== hostOnlyFilter ||
      prev.photoFilter !== photoFilter ||
      prev.sortMode !== sortMode;

    if (!changed) return;

    filterCriteriaRef.current = {
      debouncedPlantSearch,
      familyFilter,
      orderFilter,
      visitFilter,
      hostOnlyFilter,
      photoFilter,
      sortMode,
    };

    // 戻る/進む(POP)・初期ロードによる変化は「復元」であって新しい絞り込みでは
    // ない。ここでリセットすると、履歴から復元されたページ番号(ppage)を即座に
    // 1へ書き戻し(しかもreplaceで元エントリを恒久破壊)、復元済みのスクロール
    // 位置も先頭へ引き戻してしまう。基準値の同期だけ行い早期リターンする
    if (navigationType === 'POP') return;

    // 条件・並び順が変わったら結果の先頭を見せる
    // （下までスクロールした状態で「新しい並びの中盤」が表示される混乱を防ぐ）
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const target = listTopRef.current || document.getElementById('explorer-results');
        if (!target) return;
        if (target.getBoundingClientRect().top < 0) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    if (currentPage === 1) return;
    setPPage(1);
  }, [navigationType, debouncedPlantSearch, familyFilter, orderFilter, visitFilter, hostOnlyFilter, photoFilter, sortMode, currentPage, setPPage]);

  const renderFilters = () => {
    const presetChips = [
      { key: "host", label: ui.hostPlantsOnly, active: hostOnlyFilter, onClick: () => setPHostOnlyFilter(hostOnlyFilter ? "all" : "has") },
      { key: "flower", label: ui.flowerOnly, active: visitFilter === "flower", onClick: () => setPVisitFilter(visitFilter === "flower" ? "all" : "flower") },
      { key: "photo", label: ui.withPhoto, active: photoFilter === "has", onClick: () => setPPhotoFilter(photoFilter === "has" ? "all" : "has") },
    ];
    const familyChips = topFamilies.map((fam) => ({
      key: `fam-${fam}`,
      label: fam,
      active: familyFilter === fam,
      onClick: () => setPFamilyFilter(familyFilter === fam ? '' : fam),
    }));
    const sortOptions = [
      { value: "image", label: ui.sortImage },
      { value: "name", label: ui.sortName },
      { value: "family", label: ui.sortFamily },
      { value: "related", label: ui.sortRelated },
    ];
    const resultsLabel = ui.resultCount(filteredHostPlants?.length ?? 0);
    const mobileControlsLabel = isEnglish ? "Controls" : "条件";
    const activeControlsLabel = isEnglish ? "Active" : "条件あり";
    const renderFullControls = ({ showResultsLabel = true, mobileInline = false } = {}) => {
      const idSuffix = mobileInline ? "-mobile" : "";
      const panelId = `${filtersPanelId}${idSuffix}`;
      const orderId = `${orderFilterId}${idSuffix}`;
      const familyId = `${familyFilterId}${idSuffix}`;
      const visitId = `${visitFilterId}${idSuffix}`;

      return (
      <>
        <ListFilterPanel
          title={ui.filterTitle}
          isOpen={mobileInline || isFiltersOpen}
          onToggle={() => setIsFiltersOpen(!isFiltersOpen)}
          panelId={panelId}
          hideHeader={mobileInline}
          hasAnyCriteria={hasAnyCriteria}
          filteredByLabel={ui.filteredBy}
          activeFilters={activeFilters}
          onResetAll={resetAll}
          resetAllLabel={ui.resetAll}
          getClearFilterLabel={(type) =>
            isEnglish ? `Clear ${type} filter` : `${type}フィルターを解除`
          }
          controlsClassName={`${mobileInline ? "mt-2" : "mt-4"} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`}
          resultsLabel={showResultsLabel ? resultsLabel : ""}
        >
          <SearchableSelect
            id={orderId}
            label={ui.order}
            value={orderFilterDisplay}
            options={orderOptions}
            onChange={setPOrderFilter}
            placeholder={ui.any}
            locale={locale}
          />

          <SearchableSelect
            id={familyId}
            label={ui.family}
            value={familyFilterDisplay}
            options={familyOptions}
            onChange={setPFamilyFilter}
            placeholder={ui.any}
            locale={locale}
          />

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1" htmlFor={visitId}>{ui.flowerVisit}</label>
          <div className="relative">
            <select
              id={visitId}
              value={visitFilter}
              onChange={(e) => setPVisitFilter(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            >
              <option value="all">{ui.any}</option>
              <option value="flower">{ui.flowerOnly}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        </ListFilterPanel>
        <ListDisplayControls
          viewMode={viewMode}
          onViewModeChange={setPViewMode}
          sortMode={sortMode}
          onSortModeChange={setPSortMode}
          sortOptions={sortOptions}
          itemsPerPageValue={requestedItemsPerPage || 'auto'}
          autoItemsPerPage={itemsPerPage}
          onItemsPerPageChange={setPItemsPerPage}
          labels={{
            view: ui.view,
            cards: ui.cards,
            compact: ui.compact,
            perPage: ui.perPage,
            autoPerPage: ui.autoPerPage,
            sort: ui.sort,
          }}
        />
      </>
      );
    };
    return (
      <>
        {/* 主要な科はドロワーを開かず1タップで絞れるよう常時表示（昆虫グループチップと同じ思想） */}
        {familyChips.length > 0 && (
          <div className="mb-2 sm:mb-3">
            <PresetFilterChips label={ui.familyLabel} chips={familyChips} />
          </div>
        )}
        {/* クイック絞り込みも、初訪問者が絞り込みに気づけるよう「条件」ドロワーの外に常時表示 */}
        {presetChips.length > 0 && (
          <div className="mb-2 sm:mb-3">
            <PresetFilterChips label={ui.presetLabel} chips={presetChips} />
          </div>
        )}
        <details className="group rounded-xl border border-slate-200/70 bg-white/75 dark:border-slate-700/70 dark:bg-slate-900/55 sm:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
              {resultsLabel}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300/70 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-600/70 dark:bg-slate-800 dark:text-slate-200">
              {hasAnyCriteria && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                  {activeControlsLabel}
                </span>
              )}
              {mobileControlsLabel}
              <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </summary>
          <div className="border-t border-slate-200/70 px-3 pb-3 pt-1 dark:border-slate-700/70">
            {renderFullControls({ showResultsLabel: false, mobileInline: true })}
          </div>
        </details>
        <div className="hidden sm:block">
          {renderFullControls()}
        </div>
      </>
    );
  };

  return (
    <div
      className={
        embedded
          ? ""
          : "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden"
      }
    >
      {!embedded && (
        <div className="p-6 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-emerald-200/30 dark:border-emerald-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {ui.listTitle}
            </h2>
          </div>
          {renderFilters()}
        </div>
      )}

      {embedded && (
        <div className="p-3 sm:p-6">
          {renderFilters()}
        </div>
      )}

      <div className="p-3 pt-1 sm:p-6">
        {/* ページ送り時のscrollIntoView先。スティッキーヘッダーに先頭行が隠れないようオフセットを確保 */}
        <div ref={listTopRef} className="scroll-mt-24" />
        <div>
          {plantCount === 0 && !hasAnyCriteria ? (
            /* データ未着（検索・フィルタなしで0件はロード中）: 昆虫リストと同じスケルトンを出し、
               「結果が見つかりませんでした」との誤認を防ぐ */
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="sr-only">{isEnglish ? 'Loading plant list…' : '植物リストを読み込み中…'}</span>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  aria-hidden="true"
                  className="rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/50 overflow-hidden shadow-md animate-pulse"
                >
                  <div className="aspect-[4/3] bg-slate-200/70 dark:bg-slate-700/60" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-slate-200/70 dark:bg-slate-700/60 rounded-md" />
                    <div className="h-3 w-1/2 bg-slate-200/60 dark:bg-slate-700/50 rounded-md" />
                    <div className="h-3 w-2/3 bg-slate-200/60 dark:bg-slate-700/50 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : currentHostPlants.length > 0 ? (
            <div className={viewMode === "compact" ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"}>
              {currentHostPlants.map(([plant, mothList], index) => {
                const normalizedPlant = normalizePlantKey(plant);
                const statsNames =
                  plantInsectStats?.namesByPlant?.[plant] ||
                  (normalizedPlant && plantInsectStats?.namesByPlant?.[normalizedPlant]);
                const rawDisplayNames =
                  Array.isArray(statsNames) && statsNames.length > 0
                    ? statsNames
                    : mothList;
                // 和名を持つ種を先頭に（「Greenidea kuwanai（和名未記載）」のような
                // 学名始まりの種が要約の先頭に来て雑然とするのを避ける）
                const displayNames = [...rawDisplayNames].sort((a, b) => {
                  const isLatinA = /^[A-Za-z]/.test(String(a).trim());
                  const isLatinB = /^[A-Za-z]/.test(String(b).trim());
                  return isLatinA === isLatinB ? 0 : isLatinA ? 1 : -1;
                });
                const statsCount =
                  plantInsectStats?.countsByPlant?.[plant] ??
                  (normalizedPlant && plantInsectStats?.countsByPlant?.[normalizedPlant]);
                const relatedCount =
                  Number.isFinite(statsCount) && statsCount >= 0
                    ? statsCount
                    : displayNames.length;
                const hasLarvalHost = !!(
                  safeHostPlants?.[plant] ||
                  (normalizedPlant && safeHostPlants?.[normalizedPlant])
                );
                const hasFlowerVisit = !!(
                  flowerVisitPlants?.[plant] ||
                  (normalizedPlant && flowerVisitPlants?.[normalizedPlant])
                );
                return (
                <React.Fragment key={plant}>
                  {!hasAnyCriteria && effectivePage === 1 && index === 8 && viewMode !== "compact" && (
                    <ManualAdSlot
                      placement="inFeed"
                      locale={locale}
                      className="animate-fadeIn h-full"
                      minHeight="min-h-[220px]"
                    />
                  )}
                  {/* 行内でカード高さを揃える（短いカードの下に空白ができないように） */}
                  <div
                    className="animate-fadeIn h-full"
                    style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
                  >
                    <HostPlantListItem
                      plant={plant}
                      mothNames={displayNames}
                      relatedCount={relatedCount}
                      plantDetails={safePlantDetails}
                      insectDisplayNameMap={insectDisplayNameMap}
                      imageFilename={plantImageMap.get(plant)}
                      hasLarvalHost={hasLarvalHost}
                      hasFlowerVisit={hasFlowerVisit}
                      locale={locale}
                      viewMode={viewMode}
                    />
                  </div>
                </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              {/* Empty state イラスト（昆虫一覧と対称） */}
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-full animate-pulse" />
                <div className="absolute inset-2 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-300 font-semibold mb-2">{ui.emptyTitle}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{emptyStateHint}</p>
              {hasAnyCriteria && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  {ui.activeFilters} {activeFilterSummary}
                </p>
              )}
              {!hasAnyCriteria && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{ui.tryAnother}</p>
              )}
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                <span className="w-full text-xs text-slate-400 dark:text-slate-500 sm:w-auto">
                  {ui.examples}
                </span>
                {ui.exampleSearches.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => applyExampleSearch(example)}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                  >
                    {example}
                  </button>
                ))}
              </div>
              {hasAnyCriteria && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="ui-btn ui-btn-secondary"
                  >
                    {ui.resetAll}
                  </button>
                  {hasSearchQuery && hasFilterCriteria && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="ui-btn ui-btn-secondary"
                    >
                      {ui.searchOnlyClear}
                    </button>
                  )}
                  {hasSearchQuery && !hasFilterCriteria && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="ui-btn ui-btn-secondary"
                    >
                      {ui.clearSearch}
                    </button>
                  )}
                  {!hasSearchQuery && hasFilterCriteria && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="ui-btn ui-btn-secondary"
                    >
                      {ui.clearFilters}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30 overflow-x-hidden">
            <Pagination
              currentPage={effectivePage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              locale={locale}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HostPlantList;
