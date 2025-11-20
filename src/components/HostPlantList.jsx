import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import logger from "../utils/logger";
import useSeoMeta from "../hooks/useSeoMeta";
import { absUrl } from "../utils/origin";
import { Link } from "react-router-dom";
import useDebounce from "../hooks/useDebounce";
import SearchInput from "./SearchInput";
import { createSafePlantFilename, splitFilenameBase } from "../utils/filename";
import { hiraganaToKatakana } from "../utils/text";
import { loadPlantImageFilenames as loadPlantImageFilenamesService } from "../services/imageIndex";
import Pagination from "./Pagination";

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
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [plantImageUrl, setPlantImageUrl] = useState("");

    const safePlantName = createSafePlantFilename(plant);

    React.useEffect(() => {
      if (imageFilename) {
        const baseUrl = `${import.meta.env.BASE_URL}images/plants/`;
        // Since imageFilename usually comes without extension from the index logic (or with?),
        // actually loadPlantImageFilenamesService returns names *without* extension usually?
        // Let's check imageIndex.js again. It says "array of strings without extension".
        // So we need to try extensions.
        
        const extensions = ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG"];
        const tryExtension = (extensionIndex) => {
          if (extensionIndex >= extensions.length) {
            setImageError(true);
            return;
          }
          const ext = extensions[extensionIndex];
          const encodedName = encodeURIComponent(imageFilename);
          // Check if imageFilename already has extension
          const hasExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(imageFilename);
          const url = hasExt ? `${baseUrl}${encodedName}` : `${baseUrl}${encodedName}.${ext}`;
          
          if (hasExt) {
             setPlantImageUrl(url);
             setImageLoaded(true);
             return;
          }

          const img = new Image();
          img.onload = () => {
            setPlantImageUrl(url);
            setImageLoaded(true);
          };
          img.onerror = () => tryExtension(extensionIndex + 1);
          img.src = url;
        };
        
        // If filename already has an extension (rare but possible), just use it
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(imageFilename)) {
           setPlantImageUrl(`${baseUrl}${encodeURIComponent(imageFilename)}`);
           setImageLoaded(true);
        } else {
           tryExtension(0);
        }
      } else {
        setImageError(true);
      }
    }, [imageFilename]);

    return (
      <li className="group relative overflow-hidden rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transform shadow-md list-none">
        <Link to={`/plant/${encodeURIComponent(plant)}`} className="block">
          <div className="flex flex-col h-full">
            {/* Enhanced Plant Image/Icon section */}
            <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
              {imageFilename && !imageError ? (
                // Actual plant image
                <div className="relative w-full aspect-[4/3]">
                  <img
                    src={plantImageUrl}
                    alt={`${plant}の写真`}
                    width="800"
                    height="600"
                    className={`w-full h-full object-cover transition-opacity duration-500 ${
                      imageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                  {/* Plant name overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                    <h3 className="text-white font-bold text-lg drop-shadow-lg tracking-tight">
                      {/[A-Za-z]/.test(plant) &&
                      !/[\u3040-\u30FF\u3400-\u9FFF]/.test(plant)
                        ? normalizeLatinBinomialPlain(plant)
                        : plant}
                    </h3>
                  </div>
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

                  {/* Names displayed prominently in center */}
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <h3 className="text-emerald-800 dark:text-emerald-200 font-bold text-lg mb-2 leading-tight tracking-tight">
                      {/[A-Za-z]/.test(plant) &&
                      !/[\u3040-\u30FF\u3400-\u9FFF]/.test(plant)
                        ? normalizeLatinBinomialPlain(plant)
                        : plant}
                    </h3>
                    {imageError && (
                      <p className="text-emerald-700 dark:text-emerald-300 text-sm mb-2">
                        画像を読み込めませんでした。
                      </p>
                    )}
                    {plantDetails[plant]?.familyName && (
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm leading-relaxed">
                        {plantDetails[plant].familyName}
                      </p>
                    )}
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

              {/* Gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent"></div>
            </div>

            {/* Enhanced Content section */}
            <div className="p-4">
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 flex-shrink-0">
                    昆虫
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {mothNames.slice(0, 4).join("、")}
                    {mothNames.length > 4 && `...他${mothNames.length - 4}種`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </li>
    );
  },
);

const HostPlantList = ({
  hostPlants = {},
  plantDetails = {},
  embedded = false,
  preloadedImageFilenames = [],
}) => {
  const [plantSearchTerm, setPlantSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [plantImageFilenames, setPlantImageFilenames] = useState(
    preloadedImageFilenames,
  );

  // Canonical/OG/パンくず（フックで共通化）
  const safeHostPlants = useMemo(() => hostPlants || {}, [hostPlants]);
  const safePlantDetails = useMemo(() => plantDetails || {}, [plantDetails]);

  const plantCount = Object.keys(safeHostPlants).length;
  const plantCanonicalUrl = absUrl("/plant");
  const plantPageTitle = "植物（食草）一覧 | 昆虫食草図鑑";
  const plantPageDesc = `植物（食草）一覧ページ。${plantCount}種の植物から、利用する昆虫を一覧で確認。和名・別名でも検索可能。`;
  const plantBreadcrumbItems = useMemo(
    () => [
      { name: "昆虫食草図鑑", url: absUrl("/") },
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
      setItemsPerPage((prev) => (prev === next ? prev : next));
      setCurrentPage(1);
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [computeItemsPerPage]);

  const debouncedPlantSearch = useDebounce(plantSearchTerm, 300);
  const [searchParams] = useSearchParams();
  const classificationFilter = searchParams.get("classification");
  const lastAppliedClassificationRef = useRef(null);

  // Initialize plant search term from URL (classification=...)
  useEffect(() => {
    if (classificationFilter) {
      setPlantSearchTerm(classificationFilter);
      lastAppliedClassificationRef.current = classificationFilter;
    } else if (lastAppliedClassificationRef.current) {
      setPlantSearchTerm((prev) =>
        prev === lastAppliedClassificationRef.current ? "" : prev,
      );
      lastAppliedClassificationRef.current = null;
    }
  }, [classificationFilter]);

  // （メタは useSeoMeta に移行）

  // ItemList JSON-LD for plant list (first 10)
  useEffect(() => {
    if (embedded) return;
    try {
      const items = Object.keys(safeHostPlants || {})
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
  }, [embedded, safeHostPlants]);

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

    Object.keys(safeHostPlants).forEach(plantName => {
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
  }, [plantImageFilenames, safeHostPlants, safePlantDetails]);

  const filteredHostPlants = useMemo(() => {
    logger.debug(
      "DEBUG: Filtering plants (summary only)",
      Object.keys(safeHostPlants).length,
      "search term:",
      debouncedPlantSearch,
    );
    if (!safeHostPlants || Object.keys(safeHostPlants).length === 0) {
      logger.debug("DEBUG: No host plants available");
      return [];
    }
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    // ひらがな入力をカタカナに変換して検索
    const katakanaSearchTerm =
      hiraganaToKatakana(debouncedPlantSearch).toLowerCase();

    const filtered = Object.entries(safeHostPlants).filter(([plantName]) => {
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
    safeHostPlants,
    safePlantDetails,
    debouncedPlantSearch,
    plantImageMap,
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
    if (!plantSearchTerm) return [];
    const lowerCaseSearchTerm = plantSearchTerm.toLowerCase();
    const katakanaSearchTerm =
      hiraganaToKatakana(plantSearchTerm).toLowerCase();
    const suggestions = new Set();
    Object.keys(safeHostPlants).forEach((plant) => {
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
  }, [safeHostPlants, safePlantDetails, plantSearchTerm]);

  const totalPages = Math.ceil(filteredHostPlants.length / itemsPerPage);
  const currentHostPlants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredHostPlants.slice(startIndex, endIndex);
  }, [filteredHostPlants, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedPlantSearch]);

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
          <SearchInput
            placeholder="食草を検索"
            value={plantSearchTerm}
            onChange={(e) => setPlantSearchTerm(e.target.value)}
            suggestions={plantNameSuggestions}
            onSelectSuggestion={setPlantSearchTerm}
          />
        </div>
      )}

      {embedded && (
        <div className="p-6">
          <SearchInput
            placeholder="食草を検索"
            value={plantSearchTerm}
            onChange={(e) => setPlantSearchTerm(e.target.value)}
            suggestions={plantNameSuggestions}
            onSelectSuggestion={setPlantSearchTerm}
          />
        </div>
      )}

      <div className="p-6">
        <div className="max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-300 scrollbar-track-emerald-100 dark:scrollbar-thumb-emerald-600 dark:scrollbar-track-emerald-900/20">
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
