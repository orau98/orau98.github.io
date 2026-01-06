import React, { useState, useMemo, useEffect, useCallback, useRef, useId } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import logger from "../utils/logger";
import useSeoMeta from "../hooks/useSeoMeta";
import { absUrl } from "../utils/origin";
import useDebounce from "../hooks/useDebounce";
import { createSafePlantFilename, splitFilenameBase } from "../utils/filename";
import { hiraganaToKatakana } from "../utils/text";
import { loadPlantImageFilenames as loadPlantImageFilenamesService } from "../services/imageIndex";
import Pagination from "./Pagination";
import { makeDetailLinkState } from "../utils/navState";

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
    plantDetails = {},
    imageFilename,
  }) => {
    const location = useLocation();
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const safePlantName = createSafePlantFilename(plant);
    const baseUrl = import.meta.env.BASE_URL || "/";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const assetVer = import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : "";
    const encoded = imageFilename ? encodeURIComponent(imageFilename) : "";
    const resizedBaseUrl = `${normalizedBase}images/resized/plants/`;
    const originalBaseUrl = `${normalizedBase}images/plants/`;
    const resizedSrc = imageFilename
      ? `${resizedBaseUrl}${encoded}.640.jpg${assetVer}`
      : "";
    const resizedSrcSet = imageFilename
      ? [320, 640, 1024]
          .map((w) => `${resizedBaseUrl}${encoded}.${w}.jpg${assetVer} ${w}w`)
          .join(", ")
      : "";
    const resizedSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw";
    const originalFallbackUrls = imageFilename
      ? ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG"].map(
          (ext) => `${originalBaseUrl}${encoded}.${ext}${assetVer}`,
        )
      : [];

    React.useEffect(() => {
      setImageLoaded(false);
      setImageError(false);
    }, [imageFilename]);

    return (
      <article className="group relative overflow-hidden rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transform shadow-md list-none">
        <Link
          to={`/plant/${encodeURIComponent(plant)}`}
          state={makeDetailLinkState(location, { setFromList: true })}
          className="block"
        >
          <div className="flex flex-col h-full">
            {/* Enhanced Plant Image/Icon section */}
            <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
              {imageFilename && !imageError ? (
                // Actual plant image
                <div className="relative w-full aspect-[4/3]">
                  <img
                    src={resizedSrc}
                    srcSet={resizedSrcSet}
                    sizes={resizedSizes}
                    alt={`${plant}の写真`}
                    width="800"
                    height="600"
                    data-fallback-idx="0"
                    className={`w-full h-full object-cover transition-opacity duration-500 ${
                      imageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setImageLoaded(true)}
                    onError={(e) => {
                      const imgEl = e.currentTarget;
                      const idx = Number.parseInt(imgEl.dataset.fallbackIdx || "0", 10);
                      if (idx < originalFallbackUrls.length) {
                        imgEl.dataset.fallbackIdx = String(idx + 1);
                        imgEl.srcset = "";
                        imgEl.sizes = "";
                        imgEl.src = originalFallbackUrls[idx];
                        return;
                      }
                      setImageError(true);
                    }}
                  />
                </div>
              ) : (
                // Fallback to beautiful plant icon with better layout
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-700 dark:to-emerald-800 flex flex-col items-center justify-center p-6">
                  {/* No image icon at top */}
                  <div className="flex-shrink-0 mb-4">
                    <svg
                      className="w-12 h-12 text-emerald-400 dark:text-emerald-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  
                  {/* No image indicator at bottom */}
                  <div className="flex-shrink-0 mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-300/70 dark:bg-emerald-600/70 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 dark:border-emerald-500/30">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      画像準備中
                    </span>
                  </div>
                </div>
              )}

              {/* Loading state for images */}
              {!imageLoaded && imageFilename && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/80 dark:bg-emerald-900/40">
                  <div className="relative">
                    <div className="w-8 h-8 border-3 border-emerald-200 dark:border-emerald-700 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
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
                  {mothNames.length}種
                </span>
              </div>

              {/* Gradient overlay - Removed since name is now below */}
            </div>

            {/* Enhanced Content section */}
            <div className="p-4 flex flex-col flex-grow">
              <div className="mb-3">
                <h3 className="text-emerald-800 dark:text-emerald-200 font-bold text-lg mb-1 leading-tight tracking-tight">
                  {/[A-Za-z]/.test(plant) &&
                  !/[\u3040-\u30FF\u3400-\u9FFF]/.test(plant)
                    ? normalizeLatinBinomialPlain(plant)
                    : plant}
                </h3>
                {plantDetails[plant]?.familyName && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm leading-relaxed">
                    {plantDetails[plant].familyName}
                  </p>
                )}
              </div>

              <div className="mt-auto space-y-2">
                <div className="flex items-start space-x-2 text-sm">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 512 512">
                      <path d="M243.695,179.339c0.703,4.906,5.813,7.438,7.719,1.406c1.891-6.031-4.828-17.219-22.219-36.531c-14.828-16.484-35.625-39.391-23.844-51.578c14.609-10.078,8.469-27.75-4.172-29.469c-11.313-1.516-21.609,13.578-15.031,38.703C192.711,126.964,241.695,165.292,243.695,179.339z"/>
                      <path d="M445.898,83.886c-74.469,0-160.703,89.859-174.516,111.078c-3.594-4.578-9.109-7.578-15.375-7.578c-6.281,0-11.797,3-15.391,7.578C226.805,173.73,140.57,83.886,66.102,83.886c-76.828,0-70.547,68.984-59.578,112.891c10.969,43.922,56.453,92.516,106.609,94.094c-56.438,25.078-61.141,89.375-43.891,119.156c16.359,28.25,103.266,92.016,167.156-50.296v29.141c0,10.813,8.781,19.593,19.609,19.593c10.813,0,19.594-8.781,19.594-19.593v-29.156c63.891,142.328,150.813,78.562,167.156,50.312c17.25-29.781,12.547-94.078-43.891-119.156c50.172-1.578,95.641-50.172,106.609-94.094C516.445,152.871,522.727,83.886,445.898,83.886z"/>
                      <path d="M268.305,179.339c2-14.047,50.984-52.375,57.563-77.469c6.563-25.125-3.734-40.219-15.047-38.703c-12.641,1.719-18.766,19.391-4.172,29.469c11.781,12.188-9.016,35.094-23.844,51.578c-17.391,19.313-24.109,30.5-22.219,36.531C262.492,186.777,267.602,184.246,268.305,179.339z"/>
                    </svg>
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">
                    {mothNames.slice(0, 4).join("、")}
                    {mothNames.length > 4 && `...他${mothNames.length - 4}種`}
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
  embedded = false,
  preloadedImageFilenames = [],
  initialSearchTerm = "",
}) => {
  // Canonical/OG/パンくず（フックで共通化）
  const safeHostPlants = useMemo(() => hostPlants || {}, [hostPlants]);
  const safePlantDetails = useMemo(() => plantDetails || {}, [plantDetails]);

  const mergedHostPlants = useMemo(() => {
    const merged = { ...safeHostPlants };
    Object.entries(flowerVisitPlants || {}).forEach(([plant, insects]) => {
      if (!plant || plant === '不明') return;
      const existing = Array.isArray(merged[plant]) ? new Set(merged[plant]) : new Set();
      if (Array.isArray(insects)) {
        insects.forEach((name) => {
          if (name) existing.add(name);
        });
      }
      merged[plant] = Array.from(existing);
    });
    return merged;
  }, [safeHostPlants, flowerVisitPlants]);

  const plantCount = Object.keys(mergedHostPlants).length;
  const plantCanonicalUrl = absUrl("/plant");
  const plantPageTitle = "植物（食草）一覧 | 昆虫植物図鑑";
  const plantPageDesc = `植物（食草）一覧ページ。${plantCount}種の植物から、利用する昆虫を一覧で確認。和名・別名でも検索可能。`;
  const plantBreadcrumbItems = useMemo(
    () => [
      { name: "昆虫植物図鑑", url: absUrl("/") },
      { name: "植物", url: plantCanonicalUrl },
    ],
    [plantCanonicalUrl],
  );

  useSeoMeta({
    enabled: !embedded,
    title: plantPageTitle,
    description: plantPageDesc,
    ogType: "website",
    url: plantCanonicalUrl,
    breadcrumbItems: plantBreadcrumbItems,
    resetCanonicalTo: absUrl("/"),
  });
  // Responsive items-per-page to avoid empty grid slots on last row
  const computeItemsPerPage = useCallback(() => {
    if (typeof window === "undefined") return 12;
    const w = window.innerWidth;
    const cols = w >= 1280 ? 4 : w >= 1024 ? 3 : w >= 768 ? 2 : 1;
    return cols * 12;
  }, []);
  const [itemsPerPage, setItemsPerPage] = useState(computeItemsPerPage());
  const [plantImageFilenames, setPlantImageFilenames] = useState(
    preloadedImageFilenames,
  );
  
  // State for filters
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const listTopRef = useRef(null);
  const updateSearchParams = useCallback((mutate) => {
    const next = new URLSearchParams(searchParams);
    try {
      mutate(next);
    } catch {}
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getStickyHeaderOffset = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--app-sticky-header-height");
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed + 12;
    return 80;
  }, []);

  const scrollToListTop = useCallback(() => {
    if (typeof window === "undefined") return;
    const el = listTopRef.current;
    if (!el) return;
    const offset = getStickyHeaderOffset();
    const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [getStickyHeaderOffset]);

  const currentPage = useMemo(() => {
    const raw = searchParams.get('ppage');
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [searchParams]);

  const familyFilter = useMemo(() => searchParams.get('pfamily') || '', [searchParams]);
  const orderFilter = useMemo(() => searchParams.get('porder') || '', [searchParams]);
  const visitFilter = useMemo(() => searchParams.get('pvisit') || 'all', [searchParams]);

  const setPPage = useCallback((page) => {
    updateSearchParams((p) => {
      const n = parseInt(page, 10);
      if (Number.isFinite(n) && n > 1) p.set('ppage', String(n));
      else p.delete('ppage');
    });
  }, [updateSearchParams]);

  const setPFamilyFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('pfamily', v);
      else p.delete('pfamily');
      p.delete('ppage');
    });
  }, [updateSearchParams]);

  const setPOrderFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('porder', v);
      else p.delete('porder');
      p.delete('ppage');
    });
  }, [updateSearchParams]);

  const setPVisitFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v && v !== 'all') p.set('pvisit', v);
      else p.delete('pvisit');
      p.delete('ppage');
    });
  }, [updateSearchParams]);

  const clearFilters = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('pfamily');
      p.delete('porder');
      p.delete('pvisit');
      p.delete('ppage');
    });
  }, [updateSearchParams]);

  const clearSearch = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('q');
      p.delete('ppage');
    });
  }, [updateSearchParams]);

  const resetAll = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('pfamily');
      p.delete('porder');
      p.delete('pvisit');
      p.delete('q');
      p.delete('ppage');
    });
  }, [updateSearchParams]);

  const searchQuery = useMemo(() => (searchParams.get('q') || '').trim(), [searchParams]);
  const hasSearchQuery = searchQuery.length > 0;
  const hasFilterCriteria = !!familyFilter || !!orderFilter || visitFilter !== 'all';
  const hasAnyCriteria = hasFilterCriteria || hasSearchQuery;
  const activeFilters = useMemo(() => {
    const filters = [];
    if (hasSearchQuery) filters.push({ type: '検索', value: searchQuery, clear: clearSearch });
    if (familyFilter) filters.push({ type: '科', value: familyFilter, clear: () => setPFamilyFilter('') });
    if (orderFilter) filters.push({ type: '目', value: orderFilter, clear: () => setPOrderFilter('') });
    if (visitFilter !== 'all') filters.push({ type: '訪花', value: 'のみ', clear: () => setPVisitFilter('all') });
    return filters;
  }, [
    hasSearchQuery,
    searchQuery,
    familyFilter,
    orderFilter,
    visitFilter,
    clearSearch,
    setPFamilyFilter,
    setPOrderFilter,
    setPVisitFilter,
  ]);
  const filterIdBase = useId();
  const orderFilterId = `${filterIdBase}-order`;
  const familyFilterId = `${filterIdBase}-family`;
  const visitFilterId = `${filterIdBase}-visit`;

  // Load plant image filenames on component mount
  useEffect(() => {
    if (preloadedImageFilenames && preloadedImageFilenames.length > 0) {
      setPlantImageFilenames(preloadedImageFilenames);
      return;
    }
    let cancelled = false;
    loadPlantImageFilenamesService().then((filenames) => {
      if (!cancelled) setPlantImageFilenames(filenames);
    });
    return () => {
      cancelled = true;
    };
  }, [preloadedImageFilenames]);

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

  const debouncedPlantSearch = useDebounce(initialSearchTerm, 300);
  const filterCriteriaRef = useRef({
    debouncedPlantSearch,
    familyFilter,
    orderFilter,
    visitFilter,
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
      const aliases = Array.isArray(detail.aliases) ? detail.aliases : [];
      const synonymPairs = {
        ビナンカズラ: ["サネカズラ"],
        サネカズラ: ["ビナンカズラ"],
      };
      const extraSynonyms = synonymPairs[plantName] || [];
      
      // Build candidate bases
      const candidates = new Set([
        plantName,
        plantName.split(" ")[0],
        createSafePlantFilename(plantName),
        createSafePlantFilename(plantName.split(" ")[0]),
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
        // Sort matches to prioritize 葉表 (leaf surface)
        matches.sort((a, b) => {
          const aHasLeafSurface = a.includes("葉表");
          const bHasLeafSurface = b.includes("葉表");
          if (aHasLeafSurface && !bHasLeafSurface) return -1;
          if (!aHasLeafSurface && bHasLeafSurface) return 1;
          
          const getPriority = (filename) => {
            if (filename.includes("葉表")) return 1;
            if (filename.includes("葉")) return 2;
            if (filename.includes("花")) return 3;
            if (filename.includes("実")) return 4;
            if (filename.includes("樹皮")) return 5;
            return 6;
          };
          return getPriority(a) - getPriority(b);
        });
        map.set(plantName, matches[0]);
      }
    });
    return map;
  }, [plantImageFilenames, mergedHostPlants, safePlantDetails]);

  // Generate filter options
  const familyOptions = useMemo(() => {
    const set = new Set();
    Object.values(safePlantDetails).forEach((d) => {
      const fam = (d.family || d.familyName || '').trim();
      if (fam && fam !== '不明') set.add(fam);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [safePlantDetails]);

  const orderOptions = useMemo(() => {
    const set = new Set();
    Object.values(safePlantDetails).forEach((d) => {
      const ord = (d.order || '').trim();
      if (ord && ord !== '不明') set.add(ord);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [safePlantDetails]);

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
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    // ひらがな入力をカタカナに変換して検索
    const katakanaSearchTerm =
      hiraganaToKatakana(debouncedPlantSearch).toLowerCase();

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
        const fam = (detail.family || detail.familyName || '').trim();
        if (fam !== familyFilter) return false;
      }

      // Apply Order Filter
      if (orderFilter) {
        const ord = (detail.order || '').trim();
        if (ord !== orderFilter) return false;
      }

      // Apply Flower Visit Filter
      if (visitFilter !== 'all') {
        const normalizedPlant = plantName
          .replace(/[（(][^）)]*[）)]/g, '')
          .trim();
        const hasFlowerVisit = !!(flowerVisitPlants?.[plantName] || (normalizedPlant && flowerVisitPlants?.[normalizedPlant]));
        const hasLarvalHost = !!(safeHostPlants?.[plantName] || (normalizedPlant && safeHostPlants?.[normalizedPlant]));
        const isFlowerOnly = hasFlowerVisit && !hasLarvalHost;
        if (!isFlowerOnly) return false;
      }

      // Apply Search Term
      if (!lowerCaseSearchTerm) {
        return true; // No search term, pass
      }

      const family = (detail.family || "").toLowerCase();
      const familyLatin = (detail.familyLatin || "").toLowerCase();
      const genus = (detail.genus || "").toLowerCase();
      const order = (detail.order || "").toLowerCase();
      const orderLatin = (detail.orderLatin || "").toLowerCase();
      const aliases = Array.isArray(detail.aliases) ? detail.aliases : [];
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
        genus.includes(lowerCaseSearchTerm) ||
        genus.includes(katakanaSearchTerm) ||
        order.includes(lowerCaseSearchTerm) ||
        order.includes(katakanaSearchTerm) ||
        orderLatin.includes(lowerCaseSearchTerm) ||
        aliasHit
      );
    });

    // Sort with plants with images first, then "不明" at the end
    const sorted = filtered.sort(([a], [b]) => {
      const aHasImage = plantImageMap.has(a);
      const bHasImage = plantImageMap.has(b);

      // Sort priority: images first, then regular plants, then "不明" last
      if (a === "不明") return 1;
      if (b === "不明") return -1;
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return a.localeCompare(b, "ja");
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
    visitFilter
  ]);

  // Add rel=prev/next for plant list pagination
  useEffect(() => {
    if (typeof document === "undefined") return;
    try {
      const totalPages = Math.ceil(filteredHostPlants.length / itemsPerPage);
      document
        .querySelectorAll('link[rel="prev"], link[rel="next"]')
        .forEach((n) => n.remove());
      const url = new URL(window.location.href);
      url.searchParams.delete("page");
      if (currentPage > 1) {
        const prev = document.createElement("link");
        prev.rel = "prev";
        const prevUrl = new URL(url.href);
        prevUrl.searchParams.set("page", String(currentPage - 1));
        prev.href = prevUrl.toString();
        document.head.appendChild(prev);
      }
      if (currentPage < totalPages) {
        const next = document.createElement("link");
        next.rel = "next";
        const nextUrl = new URL(url.href);
        nextUrl.searchParams.set("page", String(currentPage + 1));
        next.href = nextUrl.toString();
        document.head.appendChild(next);
      }
    } catch (error) {
      logger.debug(
        "Failed to update rel prev/next links for plant list:",
        error,
      );
    }
  }, [currentPage, itemsPerPage, filteredHostPlants.length]);

  const plantNameSuggestions = useMemo(() => {
    if (!initialSearchTerm) return [];
    const lowerCaseSearchTerm = initialSearchTerm.toLowerCase();
    const katakanaSearchTerm =
      hiraganaToKatakana(initialSearchTerm).toLowerCase();
    const suggestions = new Set();
    Object.keys(mergedHostPlants).forEach((plant) => {
      if (
        plant.toLowerCase().includes(lowerCaseSearchTerm) ||
        plant.toLowerCase().includes(katakanaSearchTerm)
      ) {
        suggestions.add(plant);
      }
      const detail = safePlantDetails[plant] || {};
      if (
        detail.family?.toLowerCase().includes(lowerCaseSearchTerm) ||
        detail.family?.toLowerCase().includes(katakanaSearchTerm)
      ) {
        suggestions.add(detail.family);
      }
      if (
        detail.genus?.toLowerCase().includes(lowerCaseSearchTerm) ||
        detail.genus?.toLowerCase().includes(katakanaSearchTerm)
      ) {
        suggestions.add(detail.genus);
      }
      if (Array.isArray(detail.aliases)) {
        detail.aliases.forEach((a) => {
          if (!a) return;
          const lower = a.toLowerCase();
          if (
            lower.includes(lowerCaseSearchTerm) ||
            lower.includes(katakanaSearchTerm)
          ) {
            suggestions.add(a);
          }
        });
      }
    });
    return Array.from(suggestions).slice(0, 10);
  }, [mergedHostPlants, safePlantDetails, initialSearchTerm]);

  const totalPages = Math.ceil(filteredHostPlants.length / itemsPerPage);
  const currentHostPlants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredHostPlants.slice(startIndex, endIndex);
  }, [filteredHostPlants, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setPPage(page);
    scrollToListTop();
  };

  React.useEffect(() => {
    const prev = filterCriteriaRef.current;
    const changed =
      prev.debouncedPlantSearch !== debouncedPlantSearch ||
      prev.familyFilter !== familyFilter ||
      prev.orderFilter !== orderFilter ||
      prev.visitFilter !== visitFilter;

    if (!changed) return;

    filterCriteriaRef.current = {
      debouncedPlantSearch,
      familyFilter,
      orderFilter,
      visitFilter,
    };

    if (currentPage === 1) return;
    setPPage(1);
  }, [debouncedPlantSearch, familyFilter, orderFilter, currentPage, setPPage]);

  const renderFilters = () => {
    return (
      <div className="mt-4">
        <div className="sticky z-40" style={{ top: 'calc(var(--app-sticky-header-height, 0px) + 12px)' }}>
          <div className="rounded-xl bg-white/85 dark:bg-slate-900/70 backdrop-blur border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 shadow-sm">
            {/* Active Filters & Toggle */}
            <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Button */}
          <button 
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isFiltersOpen 
                ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' 
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            詳細フィルタ
            <svg className={`w-3 h-3 transition-transform duration-200 ${isFiltersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Chips */}
          <div className="flex flex-wrap gap-2 items-center flex-1">
            {hasAnyCriteria && (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">絞り込み:</span>
            )}
            {activeFilters.map((filter, idx) => (
              <span key={`${filter.type}-${idx}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 transition-all hover:bg-emerald-200 dark:hover:bg-emerald-800/50">
                {filter.type}: {filter.value}
                <button 
                  onClick={filter.clear}
                  className="ml-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 focus:outline-none"
                  aria-label={`${filter.type}フィルターを解除`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {hasAnyCriteria && (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                すべてリセット
              </button>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Collapsible Controls */}
        <div 
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 transition-all duration-300 ease-in-out overflow-hidden ${
            isFiltersOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1" htmlFor={orderFilterId}>目 (Order)</label>
            <div className="relative">
              <select
                id={orderFilterId}
                value={orderFilter}
                onChange={(e) => setPOrderFilter(e.target.value)}
                className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="">指定なし</option>
                {orderOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1" htmlFor={familyFilterId}>科 (Family)</label>
            <div className="relative">
              <select
                id={familyFilterId}
                value={familyFilter}
                onChange={(e) => setPFamilyFilter(e.target.value)}
                className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="">指定なし</option>
                {familyOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1" htmlFor={visitFilterId}>訪花</label>
            <div className="relative">
              <select
                id={visitFilterId}
                value={visitFilter}
                onChange={(e) => setPVisitFilter(e.target.value)}
                className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="all">指定なし</option>
                <option value="flower">訪花のみ</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-right text-xs text-slate-400 dark:text-slate-500" role="status" aria-live="polite">
          {filteredHostPlants?.length ?? 0} 件が見つかりました
        </div>
      </div>
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
              食草リスト
            </h2>
          </div>
          {renderFilters()}
        </div>
      )}

      {embedded && (
        <div className="p-6">
          {renderFilters()}
        </div>
      )}

      <div className="p-6">
        <div ref={listTopRef} />
        <div>
          {currentHostPlants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentHostPlants.map(([plant, mothList], index) => (
                <div
                  key={plant}
                  className="animate-fadeIn"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <HostPlantListItem
                    plant={plant}
                    mothNames={mothList}
                    plantDetails={safePlantDetails}
                    imageFilename={plantImageMap.get(plant)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                結果が見つかりませんでした
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                別のキーワードで検索してみてください
              </p>
              {hasAnyCriteria && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    すべてリセット
                  </button>
                  {hasSearchQuery && hasFilterCriteria && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 text-emerald-700 dark:text-emerald-200 dark:border-emerald-500/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      検索のみクリア
                    </button>
                  )}
                  {hasSearchQuery && !hasFilterCriteria && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 text-emerald-700 dark:text-emerald-200 dark:border-emerald-500/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      検索をクリア
                    </button>
                  )}
                  {!hasSearchQuery && hasFilterCriteria && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 text-emerald-700 dark:text-emerald-200 dark:border-emerald-500/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      フィルター解除
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
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HostPlantList;
