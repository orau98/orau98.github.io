import React, { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import InstagramIcon from "./components/InstagramIcon";
import InstagramEmbed from "./components/InstagramEmbed";
import InstagramTimeline from "./components/InstagramTimeline";
import SearchInput from "./components/SearchInput";
import StickyHeader from "./components/StickyHeader";
import { MainStructuredData } from "./components/StructuredData";
import logger from "./utils/logger";
import { bibliography as rawBibliography } from "./utils/bibliography";
import { getSourceLink } from "./utils/sourceLinks";
import useSeoMeta from "./hooks/useSeoMeta";
import { loadPlantImageFilenames as loadPlantImageFilenamesService } from "./services/imageIndex";
import lazyWithRetry from "./utils/lazyWithRetry";
import { hiraganaToKatakana } from "./utils/text";

const MothList = lazyWithRetry(() => import("./components/MothList"));
const HostPlantList = lazyWithRetry(() => import("./components/HostPlantList"));

const normalizePlantKey = (plantName) => {
  if (!plantName || typeof plantName !== "string") {
    return plantName || "";
  }
  if (plantName.match(/^[^（(]+科$/)) {
    return plantName.trim();
  }
  let normalized = plantName;
  normalized = normalized.replace(/^([^（(科]+科)([のに]?)([^（(].+)$/, "$3");
  normalized = normalized.replace(/^([^（(]+)（[^）]*科[^）]*）(.*)$/g, "$1$2");
  normalized = normalized.replace(/^([^（(]+)\([^)]*科[^)]*\)(.*)$/g, "$1$2");
  normalized = normalized.replace(/\(以上[^)]*科\)/g, "");
  normalized = normalized.replace(/（以上[^）]*科）/g, "");
  normalized = normalized.replace(/（[^）]*$/g, "");
  normalized = normalized.replace(/\([^)]*$/g, "");
  normalized = normalized.replace(/^[^（(]*[）)]/g, "");
  return normalized.trim();
};

const buildAliasMap = (plantDetails = {}) => {
  const map = new Map();
  const canonicalByNormalized = new Map();
  const preferCanonical = (normalized, name) => {
    if (!normalized || !name) return;
    if (!canonicalByNormalized.has(normalized)) {
      canonicalByNormalized.set(normalized, name);
      return;
    }
    const existing = canonicalByNormalized.get(normalized);
    if (existing === normalized) return;
    if (name === normalized) {
      canonicalByNormalized.set(normalized, name);
      return;
    }
    const existingHasParen = /[（(].*[)）]/.test(existing);
    const nameHasParen = /[（(].*[)）]/.test(name);
    if (existingHasParen && !nameHasParen) {
      canonicalByNormalized.set(normalized, name);
    }
  };

  Object.keys(plantDetails || {}).forEach((name) => {
    const normalized = normalizePlantKey(name);
    preferCanonical(normalized, name);
  });

  Object.entries(plantDetails || {}).forEach(([canonical, detail]) => {
    if (!canonical) return;
    const normalizedCanonical = normalizePlantKey(canonical);
    const pickedCanonical =
      canonicalByNormalized.get(normalizedCanonical) || canonical;
    map.set(canonical, pickedCanonical);
    if (normalizedCanonical && !map.has(normalizedCanonical)) {
      map.set(normalizedCanonical, pickedCanonical);
    }
    const aliasesRaw = detail?.aliases || detail?.aliasNames;
    const aliases = Array.isArray(aliasesRaw)
      ? aliasesRaw
      : aliasesRaw instanceof Set
        ? Array.from(aliasesRaw)
        : [];
    aliases.forEach((alias) => {
      const cleaned = (alias || "").trim();
      if (!cleaned) return;
      map.set(cleaned, pickedCanonical);
      const normalizedAlias = normalizePlantKey(cleaned);
      if (normalizedAlias && !map.has(normalizedAlias)) {
        map.set(normalizedAlias, pickedCanonical);
      }
    });
  });
  return map;
};

const buildPlantInsectStats = (insects = [], plantDetails = {}) => {
  if (!Array.isArray(insects) || insects.length === 0) {
    return { countsByPlant: {}, namesByPlant: {} };
  }
  const aliasMap = buildAliasMap(plantDetails);
  const idsByPlant = new Map();
  const namesByPlant = new Map();

  const canonicalize = (plantName) => {
    if (!plantName) return "";
    const normalized = normalizePlantKey(plantName);
    return (
      aliasMap.get(plantName) ||
      (normalized ? aliasMap.get(normalized) : "") ||
      normalized ||
      plantName
    );
  };

  const addToPlant = (plantName, insectId, insectName) => {
    const canonical = canonicalize(plantName);
    if (!canonical || canonical === "不明") return;
    let idSet = idsByPlant.get(canonical);
    if (!idSet) {
      idSet = new Set();
      idsByPlant.set(canonical, idSet);
    }
    if (insectId) idSet.add(insectId);
    let nameSet = namesByPlant.get(canonical);
    if (!nameSet) {
      nameSet = new Set();
      namesByPlant.set(canonical, nameSet);
    }
    if (insectName) nameSet.add(insectName);
  };

  const addPlantVariants = (rawPlant, insectId, insectName) => {
    const raw = String(rawPlant || "").trim();
    if (!raw || raw === "不明") return;
    const cleaned = raw.replace(/[(（][^)）]*[)）]/g, "").trim();
    const normalizedRaw = normalizePlantKey(raw);
    const normalizedClean = normalizePlantKey(cleaned);
    const candidates = new Set(
      [raw, cleaned, normalizedRaw, normalizedClean].filter(Boolean),
    );
    candidates.forEach((candidate) =>
      addToPlant(candidate, insectId, insectName),
    );
  };

  insects.forEach((insect) => {
    if (!insect) return;
    const insectName = (insect.name || insect.japaneseName || "").trim();
    const insectId = String(
      insect.id || insect.name || insect.japaneseName || "",
    ).trim();
    if (!insectId) return;
    const records = insect.hostPlantsDetailed;
    if (Array.isArray(records) && records.length > 0) {
      records.forEach((record) => {
        const plantName =
          record?.name || record?.displayName || record?.plant || "";
        addPlantVariants(plantName, insectId, insectName);
      });
      return;
    }
    const hostPlants = insect.hostPlants;
    if (Array.isArray(hostPlants)) {
      hostPlants.forEach((plant) =>
        addPlantVariants(plant, insectId, insectName),
      );
      return;
    }
    if (typeof hostPlants === "string") {
      hostPlants
        .split(/[;；、，,]/)
        .forEach((plant) => addPlantVariants(plant, insectId, insectName));
      return;
    }
    if (hostPlants) {
      addPlantVariants(String(hostPlants), insectId, insectName);
    }
  });

  const countsByPlant = {};
  const namesByPlantObj = {};
  idsByPlant.forEach((set, plant) => {
    countsByPlant[plant] = set.size;
  });
  namesByPlant.forEach((set, plant) => {
    namesByPlantObj[plant] = Array.from(set).sort((a, b) =>
      a.localeCompare(b, "ja"),
    );
  });
  return { countsByPlant, namesByPlant: namesByPlantObj };
};



const InsectsHostPlantExplorer = React.memo(
  ({
    moths,
    butterflies,
    beetles,
    longhornbeetles,
    leafbeetles,
    hostPlants,
    flowerVisitPlants: flowerVisitPlantsProp = {},
    plantDetails,
    theme,
    setTheme,
    summaryCounts,
    onNeedInsectsData,
    onNeedPlantsData,
    initialTab = "insects",
  }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const normalizeTab = (value, fallback) => {
      if (value === "plants" || value === "insects") return value;
      return fallback;
    };
    const initialTabFromParams = normalizeTab(searchParams.get("tab"), initialTab);
    const initialQuery = searchParams.get("q") || "";
    const [activeTab, setActiveTab] = useState(() => initialTabFromParams);
    const [heroImageLoaded, setHeroImageLoaded] = useState(false);
    const [instagramUrl, setInstagramUrl] = useState("");
    const [instagramPosts, setInstagramPosts] = useState([]);
    const [instagramWidgetHtml, setInstagramWidgetHtml] = useState("");
    const [showBibliography, setShowBibliography] = useState(false);
    const [plantImageFilenames, setPlantImageFilenames] = useState([]);
    const [searchByTab, setSearchByTab] = useState(() => ({
      insects: initialTabFromParams === "insects" ? initialQuery : "",
      plants: initialTabFromParams === "plants" ? initialQuery : "",
    }));
    const activeSearchTerm = searchByTab[activeTab] || "";
    const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false);
    const searchTimeoutRef = useRef(null);
    const plantInsectStats = useMemo(() => {
      const allInsects = [
        ...moths,
        ...butterflies,
        ...beetles,
        ...longhornbeetles,
        ...leafbeetles,
      ];
      if (allInsects.length === 0) return null;
      return buildPlantInsectStats(allInsects, plantDetails);
    }, [moths, butterflies, beetles, longhornbeetles, leafbeetles, plantDetails]);

    // Sync search term with URL (active tab only)
    useEffect(() => {
      const tabParam = normalizeTab(searchParams.get("tab"), activeTab);
      const q = searchParams.get("q") || "";
      setSearchByTab((prev) => {
        if ((prev[tabParam] || "") === q) return prev;
        return { ...prev, [tabParam]: q };
      });
    }, [searchParams, activeTab]);

    const handleGlobalSearch = (e) => {
      const val = e.target.value;
      setSearchByTab((prev) => ({ ...prev, [activeTab]: val }));

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("tab", activeTab);
        if (val) {
          newParams.set("q", val);
        } else {
          newParams.delete("q");
        }
        setSearchParams(newParams, { replace: true });
      }, 300);
    };

    const setActiveTabWithUrl = (tab) => {
      setActiveTab(tab);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const newParams = new URLSearchParams(searchParams);
      if (tab) newParams.set("tab", tab);
      else newParams.delete("tab");
      const nextSearch = (searchByTab[tab] || "").trim();
      if (nextSearch) newParams.set("q", nextSearch);
      else newParams.delete("q");
      setSearchParams(newParams, { replace: true });
    };

    // Cleanup timeout
    useEffect(() => {
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, []);

    // Helper: detect profile URL (not a single post permalink)
    const isInstagramProfileUrl = (url) => {
      if (!url) return false;
      return (
        /^https?:\/\/(www\.)?instagram\.com\//.test(url) &&
        !/\/(p|reel|tv)\//.test(url)
      );
    };
    const didRestoreScrollRef = useRef(false);
    const SCROLL_RESTORE_KEY = "explorerScrollRestore";

    // DEBUG: Log the actual data received (dev only)
    if (import.meta && import.meta.env && import.meta.env.DEV)
      logger.debug("DEBUG InsectsHostPlantExplorer received:", {
        moths: moths.length,
        butterflies: butterflies.length,
        beetles: beetles.length,
        longhornbeetles: longhornbeetles.length,
        leafbeetles: leafbeetles.length,
        total:
          moths.length +
          butterflies.length +
          beetles.length +
          longhornbeetles.length +
          leafbeetles.length,
      });

    // Save scroll position before navigating away (single source of truth)
    useEffect(() => {
      // Save scroll position on click of any link that navigates to detail page
      const handleClick = (e) => {
        const target = e.target.closest("a");
        if (!target) return;
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (target.target === "_blank") return;
        if (target.hasAttribute("download")) return;

        let url;
        try {
          url = new URL(target.href, window.location.origin);
        } catch {
          return;
        }
        if (url.origin !== window.location.origin) return;
        if (!/^\/(moth|butterfly|beetle|longhornbeetle|leafbeetle|plant)\//.test(url.pathname)) return;

        try {
          sessionStorage.setItem(
            SCROLL_RESTORE_KEY,
            JSON.stringify({
              y: window.scrollY,
              tab: activeTab,
              from: window.location.pathname + window.location.search,
              to: url.pathname + url.search,
              ts: Date.now(),
            }),
          );
        } catch {}
      };

      document.addEventListener("click", handleClick, true);

      return () => {
        document.removeEventListener("click", handleClick, true);
      };
    }, [activeTab, SCROLL_RESTORE_KEY]);

    // Restore scroll position when returning to the page (retry until layout is ready)
    useEffect(() => {
      if (didRestoreScrollRef.current) return;

      let saved = null;
      const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
      if (raw) {
        try {
          saved = JSON.parse(raw);
        } catch {
          saved = null;
        }
      } else {
        // Backward-compat fallback
        const legacy = sessionStorage.getItem("insectExplorerScrollPosition");
        if (legacy) saved = { y: parseInt(legacy, 10), legacy: true };
      }

      const currentPath = window.location.pathname + window.location.search;
      if (saved?.from && saved.from !== currentPath) {
        sessionStorage.removeItem(SCROLL_RESTORE_KEY);
        sessionStorage.removeItem("insectExplorerScrollPosition");
        return;
      }

      const y = Number(saved?.y);
      if (!Number.isFinite(y)) {
        sessionStorage.removeItem(SCROLL_RESTORE_KEY);
        sessionStorage.removeItem("insectExplorerScrollPosition");
        return;
      }

      const startedAt = Date.now();
      const maxWaitMs = 1800;

      const tryRestore = () => {
        const resultsEl = document.getElementById("explorer-results");
        const maxScroll =
          Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const targetY = Math.min(y, maxScroll);

        if (resultsEl) {
          window.scrollTo(0, targetY);
        }

        const done =
          resultsEl &&
          (Math.abs(window.scrollY - targetY) < 2 ||
            Date.now() - startedAt > maxWaitMs);
        if (done) {
          didRestoreScrollRef.current = true;
          sessionStorage.removeItem(SCROLL_RESTORE_KEY);
          sessionStorage.removeItem("insectExplorerScrollPosition");
          return;
        }

        if (Date.now() - startedAt > maxWaitMs) {
          didRestoreScrollRef.current = true;
          sessionStorage.removeItem(SCROLL_RESTORE_KEY);
          sessionStorage.removeItem("insectExplorerScrollPosition");
          return;
        }

        setTimeout(tryRestore, 60);
      };

      setTimeout(tryRestore, 0);
    }, [SCROLL_RESTORE_KEY, activeTab]);

    // Initialize tab from URL, fallback to prop when absent
    useEffect(() => {
      const tabParam = searchParams.get("tab");
      const normalizedTab = normalizeTab(tabParam, "");
      if (normalizedTab) {
        if (normalizedTab !== activeTab) {
          setActiveTab(normalizedTab);
        }
        return;
      }
      // Ensure URL reflects requested initial tab so戻る/共有で維持される
      if (initialTab && !tabParam) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("tab", initialTab);
        const initSearch = (searchByTab[initialTab] || "").trim();
        if (initSearch) newParams.set("q", initSearch);
        setSearchParams(newParams, { replace: true });
        setActiveTab(initialTab);
      }
    }, [searchParams, initialTab, setSearchParams, activeTab, searchByTab]);

    useEffect(() => {
      if (activeTab === "insects" && typeof onNeedInsectsData === "function") {
        onNeedInsectsData();
      }
      if (activeTab === "plants" && typeof onNeedPlantsData === "function") {
        onNeedPlantsData();
      }
    }, [activeTab, onNeedInsectsData, onNeedPlantsData]);

    const computedFlowerVisitPlants = useMemo(() => {
      const map = {};
      const allInsects = [
        ...moths,
        ...butterflies,
        ...beetles,
        ...longhornbeetles,
        ...leafbeetles,
      ];
      const normalizePlant = (value) => {
        if (!value || typeof value !== "string") return "";
        return value
          .replace(/[（(][^）)]*科[^）)]*[）)]/g, "")
          .replace(/[（(][^）)]*[）)]/g, "")
          .trim();
      };
      allInsects.forEach((insect) => {
        const insectName = (insect?.name || insect?.japaneseName || "").trim();
        if (!insectName) return;
        const records = insect?.hostPlantsDetailed;
        if (!Array.isArray(records) || records.length === 0) return;
        records.forEach((record) => {
          const lifeStage = (record?.lifeStage || "").trim();
          const plantPart = (record?.plantPart || "").trim();
          if (lifeStage !== "成虫" || plantPart !== "花") return;
          const rawPlant = record?.name || record?.displayName || record?.plant || "";
          const plantName = normalizePlant(String(rawPlant || "").trim());
          if (!plantName || plantName === "不明") return;
          if (!map[plantName]) map[plantName] = [];
          if (!map[plantName].includes(insectName)) {
            map[plantName].push(insectName);
          }
        });
      });
      return map;
    }, [moths, butterflies, beetles, longhornbeetles, leafbeetles]);
    const flowerVisitPlants = useMemo(() => {
      const merged = { ...(flowerVisitPlantsProp || {}) };
      Object.entries(computedFlowerVisitPlants || {}).forEach(([plant, insects]) => {
        if (!plant) return;
        const existing = Array.isArray(merged[plant]) ? new Set(merged[plant]) : new Set();
        if (Array.isArray(insects)) {
          insects.forEach((name) => {
            if (name) existing.add(name);
          });
        }
        merged[plant] = Array.from(existing);
      });
      return merged;
    }, [flowerVisitPlantsProp, computedFlowerVisitPlants]);
    const mergedHostPlantCount = useMemo(() => {
      const names = new Set(Object.keys(hostPlants || {}));
      Object.keys(flowerVisitPlants || {}).forEach((name) => {
        if (name) names.add(name);
      });
      return names.size;
    }, [hostPlants, flowerVisitPlants]);
    const aphidCount = useMemo(() => {
      const allInsects = [
        ...moths,
        ...butterflies,
        ...beetles,
        ...longhornbeetles,
        ...leafbeetles,
      ];
      const seen = new Set();
      allInsects.forEach((insect) => {
        if (!insect) return;
        const familyJp = (
          insect.classification?.familyJapanese ||
          insect.family ||
          ""
        ).toString();
        const familyLatin = (
          insect.classification?.family ||
          ""
        ).toString();
        const isAphid =
          familyJp.includes("アブラムシ") || familyLatin === "Aphididae";
        if (!isAphid) return;
        const key = insect.id || insect.name;
        if (key) seen.add(key);
      });
      return seen.size;
    }, [moths, butterflies, beetles, longhornbeetles, leafbeetles]);

    // SEO for Home (トップページ)
    const title = "昆虫植物図鑑 — 蛾・蝶・タマムシ・カミキリムシ・ハムシと食草の繋がりを探索";
    const counts = summaryCounts
      ? {
          moths: summaryCounts.moths ?? moths.length,
          butterflies: summaryCounts.butterflies ?? butterflies.length,
          beetles: summaryCounts.beetles ?? beetles.length,
          longhornbeetles: summaryCounts.longhornbeetles ?? longhornbeetles.length,
          leafbeetles: summaryCounts.leafbeetles ?? leafbeetles.length,
          hostPlants: mergedHostPlantCount,
        }
      : {
          moths: moths.length,
          butterflies: butterflies.length,
          beetles: beetles.length,
          longhornbeetles: longhornbeetles.length,
          leafbeetles: leafbeetles.length,
          hostPlants: mergedHostPlantCount,
        };
    const desc = `掲載: 蛾・蝶 ${counts.moths + counts.butterflies}種、タマムシ ${counts.beetles}種、カミキリムシ ${counts.longhornbeetles}種、ハムシ ${counts.leafbeetles}種、食草 ${counts.hostPlants}種。和名/学名/分類から高速検索。昆虫植物図鑑（昆虫食草図鑑）。`;
    const { setOgTwitterImage } = useSeoMeta({
      title,
      description: desc,
      ogType: "website",
      url:
        (typeof window !== "undefined"
          ? window.location.origin
          : "https://orau98.github.io/") + "/",
    });

    // Preload hero image on component mount (base-aware for subpath deployments)
    React.useEffect(() => {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      const heroImageUrl = `${normalizedBase}images/resized/insects/Cucullia_argentea.640.jpg`;
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "high";
      img.onload = () => setHeroImageLoaded(true);
      img.onerror = () => setHeroImageLoaded(true);
      img.src = heroImageUrl;
    }, []);

    // Use hero image as OG/Twitter image when loaded
    useEffect(() => {
      if (heroImageLoaded) {
        try {
          const hero = document.querySelector('img[alt*="メインビジュアル"]');
          // Prefer resolved absolute URL from currentSrc/src
          const src =
            hero?.currentSrc ||
            hero?.src ||
            "images/insects/Cucullia_argentea.jpg";
          setOgTwitterImage(src, "昆虫植物図鑑 メインビジュアル");
        } catch {}
      }
    }, [heroImageLoaded, setOgTwitterImage]);

    const instagramSectionRef = useRef(null);
    const [instagramInView, setInstagramInView] = useState(false);
    const instagramFetchedRef = useRef(false);

    useEffect(() => {
      if (!instagramSectionRef.current) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setInstagramInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: "200px 0px" },
      );
      observer.observe(instagramSectionRef.current);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!instagramInView || instagramFetchedRef.current) return;
      instagramFetchedRef.current = true;

      const loadInstagramResources = async () => {
        const base = import.meta.env.BASE_URL || "/";
        const cacheMode = import.meta.env.DEV ? "no-store" : "default";

        // Latest profile/post
        try {
          const res = await fetch(`${base}instagram_latest.txt`, {
            cache: cacheMode,
          });
          if (res.ok) {
            const text = (await res.text()).trim();
            if (/^https?:\/\/(www\.)?instagram\.com\//.test(text)) {
              setInstagramUrl(text);
            } else if (import.meta.env.VITE_INSTAGRAM_URL) {
              setInstagramUrl(import.meta.env.VITE_INSTAGRAM_URL);
            }
          }
        } catch {
          if (import.meta.env.VITE_INSTAGRAM_URL) {
            setInstagramUrl(import.meta.env.VITE_INSTAGRAM_URL);
          }
        }

        // Timeline posts
        try {
          const res = await fetch(`${base}instagram_posts.txt`, {
            cache: cacheMode,
          });
          if (res.ok) {
            const text = await res.text();
            const urls = text
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((s) =>
                /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(s),
              );
            if (urls.length > 0) {
              setInstagramPosts(urls.slice(0, 24));
            }
          }
        } catch {
          // ignore
        }

        // Optional widget
        try {
          const res = await fetch(`${base}instagram_widget.html`, {
            cache: cacheMode,
          });
          if (res.ok) {
            const html = (await res.text()).trim();
            if (html) {
              setInstagramWidgetHtml(html);
            }
          }
        } catch {
          // ignore
        }
      };

      loadInstagramResources();
    }, [instagramInView]);

    const suggestions = useMemo(() => {
      if (!activeSearchTerm || activeSearchTerm.trim() === "") return [];
      const term = activeSearchTerm.toLowerCase();
      const katakanaTerm = hiraganaToKatakana(activeSearchTerm).toLowerCase();
      const results = new Set();

      if (activeTab === "insects") {
        const allInsects = [
          ...moths,
          ...butterflies,
          ...beetles,
          ...longhornbeetles,
          ...leafbeetles,
        ];
        for (const insect of allInsects) {
          if (results.size >= 10) break;
          // Name match
          if (insect.name && (insect.name.includes(term) || insect.name.includes(katakanaTerm))) {
            results.add(insect.name);
            continue;
          }
          // Scientific name match
          if (
            insect.scientificName &&
            insect.scientificName.toLowerCase().includes(term)
          ) {
            results.add(insect.scientificName);
            continue;
          }
          // Family match
          if (
            insect.classification?.familyJapanese &&
            (insect.classification.familyJapanese.includes(term) || insect.classification.familyJapanese.includes(katakanaTerm))
          ) {
            results.add(insect.classification.familyJapanese);
            continue;
          }
        }
      } else {
        // plants
        const plantNameSet = new Set(Object.keys(hostPlants));
        Object.keys(flowerVisitPlants || {}).forEach((name) => {
          if (name) plantNameSet.add(name);
        });
        const plantNames = Array.from(plantNameSet);
        const matches = (value) => {
          if (!value) return false;
          const lower = String(value).toLowerCase();
          return lower.includes(term) || lower.includes(katakanaTerm);
        };
        for (const plant of plantNames) {
          if (results.size >= 10) break;
          if (matches(plant)) {
            results.add(plant);
          }
          const detail = plantDetails?.[plant] || {};
          const candidates = [
            detail.family,
            detail.familyName,
            detail.familyLatin,
            detail.order,
            detail.orderLatin,
            detail.genus,
          ].filter(Boolean);
          if (Array.isArray(detail.aliases)) {
            candidates.push(...detail.aliases.filter(Boolean));
          }
          for (const candidate of candidates) {
            if (results.size >= 10) break;
            if (matches(candidate)) results.add(candidate);
          }
        }
      }
      return Array.from(results);
    }, [
      activeSearchTerm,
      activeTab,
      moths,
      butterflies,
      beetles,
      longhornbeetles,
      leafbeetles,
      hostPlants,
      flowerVisitPlants,
      plantDetails,
    ]);

    const handleSelectSuggestion = (value) => {
      setSearchByTab((prev) => ({ ...prev, [activeTab]: value }));
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", activeTab);
      if (value) {
        newParams.set("q", value);
      } else {
        newParams.delete("q");
      }
      setSearchParams(newParams, { replace: true });
    };

    useEffect(() => {
      let cancelled = false;
      loadPlantImageFilenamesService()
        .then((filenames) => {
          if (!cancelled) {
            setPlantImageFilenames(filenames);
          }
        })
        .catch((err) => logger.debug("plant image preload failed:", err));
      return () => {
        cancelled = true;
      };
    }, []);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <StickyHeader 
          activeTab={activeTab} 
          setActiveTab={setActiveTabWithUrl} 
          searchTerm={activeSearchTerm} 
          onSearchChange={handleGlobalSearch}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
          onNeedInsectsData={onNeedInsectsData}
          onNeedPlantsData={onNeedPlantsData}
          theme={theme}
          setTheme={setTheme}
          onVisibilityChange={setIsStickyHeaderVisible}
        />
        {/* 構造化データ */}
        <MainStructuredData />
        <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-8">
          <div id="hero-section" className="relative w-full h-[25rem] md:h-96 lg:h-[28rem] group">
            {/* Background Container - Handles clipping for image and gradients */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-blue-900/40 z-10"></div>

              {/* Show skeleton while loading */}
              {!heroImageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse z-5" />
              )}

              {(() => {
                const base = "Cucullia_argentea";
                // Use relative paths so it works under any base path
                const baseUrl = import.meta.env.BASE_URL || "/";
                const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
                const src = `${normalizedBase}images/insects/${base}.jpg`;
                // Use only sizes that actually exist to avoid 404s
                const srcSet = [
                  `${normalizedBase}images/resized/insects/${base}.320.jpg 320w`,
                  `${normalizedBase}images/resized/insects/${base}.640.jpg 640w`,
                  `${normalizedBase}images/resized/insects/${base}.1024.jpg 1024w`,
                ].join(", ");
                const sizes = "100vw";
                return (
                  <img
                    src={src}
                    srcSet={srcSet}
                    sizes={sizes}
                    alt="昆虫植物図鑑のメインビジュアル - Cucullia argentea（ギンスジキンウワバ）"
                    width="1600"
                    height="900"
                    className={`w-full h-full object-cover object-center transform group-hover:scale-105 transition-all duration-700 ease-out ${
                      heroImageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    style={{
                      imageRendering: "auto",
                      willChange: heroImageLoaded ? "auto" : "opacity, transform",
                      contain: "layout style paint",
                    }}
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                    onLoad={() => setHeroImageLoaded(true)}
                    onError={(e) => {
                      try {
                        const imgEl = e.target;
                        logger.warn("Hero image failed to load:", imgEl?.src);
                        // Try relative path first (works under subpath deployments)
                        if (!imgEl.dataset.fallbackTried) {
                          imgEl.dataset.fallbackTried = "1";
                          imgEl.onerror = null; // prevent loop
                          imgEl.src = `${normalizedBase}images/insects/Cucullia_argentea.jpg`;
                        } else {
                          imgEl.onerror = null; // prevent loop
                          // Final fallback to a local placeholder (relative path)
                          imgEl.src = `${normalizedBase}images/placeholder.jpg`;
                          imgEl.alt = "画像が見つかりません";
                        }
                      } catch {}
                      setHeroImageLoaded(true);
                    }}
                  />
                );
              })()}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent z-20"></div>
            </div>

            {/* Content Container - Allows overflow for search suggestions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-30">
              <div className="max-w-6xl mx-auto">
                <h1 className="font-extrabold text-white mb-2 md:mb-4 leading-tight tracking-tight">
                  <span className="block bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-transparent drop-shadow-2xl animate-gradient-x font-bold text-[6vw] sm:text-3xl md:text-5xl lg:text-6xl">
                    "繋がり"が見える
                  </span>
                  <span className="block bg-gradient-to-r from-blue-100 via-teal-100 to-emerald-100 bg-clip-text text-transparent drop-shadow-2xl mt-2 font-extrabold text-[10vw] sm:text-5xl md:text-6xl lg:text-7xl">
                    昆虫植物図鑑
                  </span>
                </h1>

                <div className="flex flex-wrap gap-3 mt-3 md:mt-6">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      蝶・蛾 {counts.moths + counts.butterflies}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      タマムシ {counts.beetles}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      カミキリムシ {counts.longhornbeetles}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      ハムシ {counts.leafbeetles}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      アブラムシ {aphidCount}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      食草 {counts.hostPlants}種
                    </span>
                  </div>
                </div>

                {/* ヒーローセクション内の検索バー */}
                <div className="max-w-2xl w-full mt-4 md:mt-8 mx-auto md:mx-0">
                  <SearchInput
                    placeholder={`${activeTab === "plants" ? "植物" : "昆虫"}を検索 (和名・学名・分類)`}
                    value={activeSearchTerm}
                    onChange={handleGlobalSearch}
                    suggestions={suggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    ariaLabel={`${activeTab === "plants" ? "植物" : "昆虫"}を検索`}
                  />
                  <p className="mt-2 text-xs md:text-sm text-white/80">
                    検索対象: {activeTab === "plants" ? "植物" : "昆虫"}（タブで切り替え）
                  </p>
                </div>
              </div>
            </div>

            {!isStickyHeaderVisible && (
              <div className="absolute top-6 right-6 z-30">
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 backdrop-blur-md rounded-2xl p-3.5 border border-white/30 hover:from-emerald-500/30 hover:to-blue-500/30 transition-all duration-300 hover:scale-110 shadow-xl"
                  aria-label="テーマを切り替え"
                >
                  {theme === "dark" ? (
                    <svg
                      className="w-6 h-6 text-white/80"
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
                      className="w-6 h-6 text-white/80"
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

          {/* 主要カテゴリ導線セクションは不要のため削除 */}

          {/* タブナビゲーション */}
          <div id="explorer-results" className="scroll-mt-24 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-emerald-200/30 dark:border-emerald-700/30 overflow-hidden">
            {/* タブヘッダー */}
            <div className="flex border-b border-slate-200/70 dark:border-slate-700/70" role="tablist" aria-label="昆虫/植物の切り替え">
              <button
                id="tab-insects"
                role="tab"
                aria-selected={activeTab === "insects"}
                aria-controls="panel-insects"
                type="button"
                onClick={() => {
                  setActiveTabWithUrl("insects");
                }}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium tracking-tight transition-colors relative ${
                  activeTab === "insects"
                    ? "text-emerald-600 dark:text-emerald-300 bg-white/70 dark:bg-slate-900/40"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-300 hover:bg-white/40 dark:hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {/* Beautiful butterfly icon */}
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="currentColor"
                    viewBox="0 0 512 512"
                  >
                    <path
                      d="M243.695,179.339c0.703,4.906,5.813,7.438,7.719,1.406c1.891-6.031-4.828-17.219-22.219-36.531
                      c-14.828-16.484-35.625-39.391-23.844-51.578c14.609-10.078,8.469-27.75-4.172-29.469c-11.313-1.516-21.609,13.578-15.031,38.703
                      C192.711,126.964,241.695,165.292,243.695,179.339z"
                    />
                    <path
                      d="M445.898,83.886c-74.469,0-160.703,89.859-174.516,111.078c-3.594-4.578-9.109-7.578-15.375-7.578
                      c-6.281,0-11.797,3-15.391,7.578C226.805,173.73,140.57,83.886,66.102,83.886c-76.828,0-70.547,68.984-59.578,112.891
                      c10.969,43.922,56.453,92.516,106.609,94.094c-56.438,25.078-61.141,89.375-43.891,119.156
                      c16.359,28.25,103.266,92.016,167.156-50.296v29.141c0,10.813,8.781,19.593,19.609,19.593c10.813,0,19.594-8.781,19.594-19.593
                      v-29.156c63.891,142.328,150.813,78.562,167.156,50.312c17.25-29.781,12.547-94.078-43.891-119.156
                      c50.172-1.578,95.641-50.172,106.609-94.094C516.445,152.871,522.727,83.886,445.898,83.886z"
                    />
                    <path
                      d="M268.305,179.339c2-14.047,50.984-52.375,57.563-77.469c6.563-25.125-3.734-40.219-15.047-38.703
                      c-12.641,1.719-18.766,19.391-4.172,29.469c11.781,12.188-9.016,35.094-23.844,51.578c-17.391,19.313-24.109,30.5-22.219,36.531
                      C262.492,186.777,267.602,184.246,268.305,179.339z"
                    />
                  </svg>
                  <span className="flex items-center gap-1">
                    <span>昆虫</span>
                    <span className="hidden sm:inline">
                      (
                      {moths.length +
                        butterflies.length +
                        beetles.length +
                        longhornbeetles.length +
                        leafbeetles.length}
                      )
                    </span>
                  </span>
                </div>
                {activeTab === "insects" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500/80"></div>
                )}
              </button>

              <button
                id="tab-plants"
                role="tab"
                aria-selected={activeTab === "plants"}
                aria-controls="panel-plants"
                type="button"
                onClick={() => setActiveTabWithUrl("plants")}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium tracking-tight transition-colors relative ${
                  activeTab === "plants"
                    ? "text-blue-600 dark:text-blue-300 bg-white/70 dark:bg-slate-900/40"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-300 hover:bg-white/40 dark:hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {/* Beautiful leaf icon */}
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="currentColor"
                    viewBox="0 0 512 512"
                  >
                    <path
                      d="M377.478,0.174c-34.179-3.423-37.602,44.438-119.644,78.618c-83.543,34.808-166.39,80.55-167.693,254.14
                      c-0.155,18.807-1.314,51.296-1.513,65.056c-0.276,19.691,0.287,40.872-8.69,51.738c-7.311,8.857-20.176,18.818-32.866,27.531
                      L81.87,512c31.032-24.306,39.834-26.493,46.35-26.35c15.549,0.342,31.33,0.496,47.155-0.762
                      c100.318-7.995,202.137-56.718,253.379-149.714C521.042,167.679,411.657,3.598,377.478,0.174z M368.81,109.802
                      c-6.184,20.817-26.957,51.826-91.925,128.445c-33.517,39.535-72.158,107.672-99.743,168.344
                      c-8.361,18.388-36.432,4.925-26.405-13.473c13.042-19.403,43.08-104.117,86.558-160.968
                      c43.489-56.862,101.411-105.685,110.378-133.801C351.857,79.112,377.048,82.116,368.81,109.802z"
                    />
                  </svg>
                  <span className="flex items-center gap-1">
                    <span>植物</span>
                    <span className="hidden sm:inline">({mergedHostPlantCount})</span>
                  </span>
                </div>
                {activeTab === "plants" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500/80"></div>
                )}
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="relative">
              <div
                id="panel-insects"
                role="tabpanel"
                aria-labelledby="tab-insects"
                aria-hidden={activeTab !== "insects"}
                inert={activeTab !== "insects"}
                className={`transition-all duration-300 ease-in-out ${
                  activeTab === "insects"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 absolute inset-0 pointer-events-none"
                }`}
              >
                {activeTab === "insects" && (
                  <div className="p-0">
                    <Suspense
                      fallback={
                        <div className="p-6 text-center text-slate-500 dark:text-slate-300">
                          昆虫データを読み込んでいます…
                        </div>
                      }
                    >
                      <MothList
                        moths={[
                          ...moths,
                          ...butterflies,
                          ...beetles,
                          ...longhornbeetles,
                          ...leafbeetles,
                        ]}
                        title="昆虫"
                        baseRoute=""
                        embedded={true}
                        initialSearchTerm={activeSearchTerm}
                      />
                    </Suspense>
                  </div>
                )}
              </div>

              <div
                id="panel-plants"
                role="tabpanel"
                aria-labelledby="tab-plants"
                aria-hidden={activeTab !== "plants"}
                inert={activeTab !== "plants"}
                className={`transition-all duration-300 ease-in-out ${
                  activeTab === "plants"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-4 absolute inset-0 pointer-events-none"
                }`}
              >
                {activeTab === "plants" && (
                  <div className="p-0">
                    <Suspense
                      fallback={
                        <div className="p-6 text-center text-slate-500 dark:text-slate-300">
                          植物データを読み込んでいます…
                        </div>
                      }
                    >
                      <HostPlantList
                        hostPlants={hostPlants}
                        flowerVisitPlants={flowerVisitPlants}
                        plantDetails={plantDetails}
                        embedded={true}
                        preloadedImageFilenames={plantImageFilenames}
                        initialSearchTerm={activeSearchTerm}
                        plantInsectStats={plantInsectStats}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* サイトについて / Instagram セクション */}
          <div
            ref={instagramSectionRef}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden"
          >
            <div className="p-4 bg-slate-500/10 dark:bg-slate-500/20 border-b border-slate-200/30 dark:border-slate-700/30">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-600 rounded-lg">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">
                    サイトについて
                  </h2>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                {/* 左側：サイトポリシーと出典一覧 (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                  {/* サイトポリシー */}
                  <section>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="bg-slate-200 dark:bg-slate-700 w-1 h-6 mr-3 rounded-full"></span>
                      サイトポリシー
                    </h3>
                    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                          はじめに
                        </p>
                        <p>
                          当サイトは、昆虫と植物の関係を、誰もが手軽に調べられるデータベースを目指して作成しています。掲載されている情報は、管理者が既存の図鑑や学術文献などを基にまとめたものです。
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                          免責事項
                        </p>
                        <p>
                          データの正確性には細心の注意を払っておりますが、参照した文献が古かったり、解釈に誤りが含まれていたりする可能性があります。学術研究やその他重要な目的でデータを利用される場合は、必ずご自身で原典をご確認いただきますようお願いいたします。
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                          写真について
                        </p>
                        <p>
                          掲載している写真は、すべて管理者自身が撮影したものです。写真の著作権は管理者に帰属します。無断での転載・利用は固くお断りいたします。写真の利用をご希望の場合は、
                          <a
                            href="https://docs.google.com/forms/d/e/1FAIpQLSfNf5n59JWmiYpH6ImyAQsIy00PK_fMk_lHVP5nbxzfwuoA4w/viewform?usp=header"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-500 transition-colors ml-1"
                          >
                            こちらのGoogleフォーム
                          </a>
                          よりお気軽にご連絡ください。
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                          お問い合わせ
                        </p>
                        <p>
                          誤植・情報の修正依頼は、サイトの品質向上のために大変助かります。お気づきの点がありましたら、
                          <a
                            href="https://docs.google.com/forms/d/e/1FAIpQLSfNf5n59JWmiYpH6ImyAQsIy00PK_fMk_lHVP5nbxzfwuoA4w/viewform?usp=header"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-500 transition-colors ml-1"
                          >
                            こちらのGoogleフォーム
                          </a>
                          までお寄せください。
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* 出典一覧 */}
                  <section>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="bg-slate-200 dark:bg-slate-700 w-1 h-6 mr-3 rounded-full"></span>
                      出典一覧
                    </h3>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowBibliography((v) => !v)}
                        aria-expanded={showBibliography}
                        aria-controls="bibliography-list"
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span>主要引用文献リストを表示</span>
                        <span
                          className={`ml-3 transform transition-transform duration-300 ${showBibliography ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                      </button>
                      {showBibliography && (
                        <div className="mt-3 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                          <ul
                            id="bibliography-list"
                            className="space-y-2 text-xs text-slate-600 dark:text-slate-400"
                          >
                            {(() => {
                              const normalize = (s) =>
                                (s || "").toString().trim().toLowerCase();
                              const authorKey = (b) => {
                                const names = Array.isArray(b.authors)
                                  ? b.authors
                                  : Array.isArray(b.editors)
                                    ? b.editors
                                    : [];
                                return normalize(
                                  names && names.length > 0 ? names[0] : "",
                                );
                              };
                              const bibliography = rawBibliography
                                .slice()
                                .sort((a, b) =>
                                  authorKey(a).localeCompare(
                                    authorKey(b),
                                    "en",
                                    { sensitivity: "base" },
                                  ),
                                );
                              return bibliography.map((b) => {
                                const href =
                                  b.url || getSourceLink(b.title) || undefined;
                                const joinNames = (arr) =>
                                  Array.isArray(arr)
                                    ? arr.filter(Boolean).join(", ")
                                    : typeof arr === "string"
                                      ? arr
                                      : "";
                                const authorStr =
                                  joinNames(b.authors) ||
                                  (b.editors
                                    ? `${joinNames(b.editors)}（編）`
                                    : "");
                                const titlePlain = b.title
                                  ? `${b.title}${b.note ? " " + b.note : ""}`
                                  : "";
                                const publisherStr = b.publisher || "";
                                const yearStr = b.year || "";
                                const isArticle =
                                  b.type === "article" || !!b.journal;
                                const journalStr = b.journal || "";
                                const volStr = b.volume || "";
                                const issueStr = b.issue || "";
                                const pagesStr = b.pages || "";

                                // Books: 著者名. 図書名. 出版社, 出版年.
                                // Articles: 著者名(年)論文名. 誌名, 巻(号): 頁.
                                return (
                                  <li key={b.key} className="flex items-start leading-normal">
                                    <span className="text-slate-400 mr-2 mt-0.5">
                                      •
                                    </span>
                                    <div className="text-slate-700 dark:text-slate-300">
                                      {isArticle ? (
                                        // 著者名(年)論文名. 誌名, 巻(号): 頁.
                                        <>
                                          {authorStr && (
                                            <span>{authorStr}</span>
                                          )}
                                          {yearStr && (
                                            <span>（{yearStr}）</span>
                                          )}{" "}
                                          {titlePlain ? (
                                            href ? (
                                              <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline decoration-slate-300 hover:decoration-slate-500 hover:text-emerald-600 transition-colors"
                                              >
                                                {titlePlain}
                                              </a>
                                            ) : (
                                              <span>{titlePlain}</span>
                                            )
                                          ) : null}
                                          {". "}
                                          {journalStr && (
                                            <span>{journalStr}</span>
                                          )}
                                          {(volStr || issueStr) && (
                                            <span>{", "}</span>
                                          )}
                                          {volStr && <span>{volStr}</span>}
                                          {issueStr && (
                                            <span>
                                              {volStr
                                                ? `(${issueStr})`
                                                : `(${issueStr})`}
                                            </span>
                                          )}
                                          {pagesStr && (
                                            <span>{`: ${pagesStr}`}</span>
                                          )}
                                          {"."}
                                        </>
                                      ) : (
                                        // 著者名. 図書名. 出版社, 出版年.
                                        <>
                                          {authorStr && (
                                            <>
                                              <span>{authorStr}</span>
                                              {". "}
                                            </>
                                          )}
                                          {titlePlain && (
                                            <>
                                              {href ? (
                                                <a
                                                  href={href}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="underline decoration-slate-300 hover:decoration-slate-500 hover:text-emerald-600 transition-colors"
                                                >
                                                  {titlePlain}
                                                </a>
                                              ) : (
                                                <span>{titlePlain}</span>
                                              )}
                                              {". "}
                                            </>
                                          )}
                                          {publisherStr && (
                                            <span>{publisherStr}</span>
                                          )}
                                          {publisherStr && yearStr && (
                                            <span>{", "}</span>
                                          )}
                                          {yearStr && <span>{yearStr}</span>}
                                          {(publisherStr || yearStr) && "."}
                                        </>
                                      )}
                                    </div>
                                  </li>
                                );
                              });
                            })()}
                          </ul>
                          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/50">
                            <p className="font-medium text-xs mb-2 text-slate-500 dark:text-slate-400">
                              その他
                            </p>
                            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                              <li className="flex items-start">
                                <span className="text-slate-400 mr-2">
                                  •
                                </span>
                                <span>各種学術論文等</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* 右側：Instagram (1/3 width) */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24 space-y-6">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-700/50 dark:to-slate-700/30 rounded-xl p-5 border border-purple-100 dark:border-slate-600">
                      {/* Instagram最新投稿 */}
                      <div className="flex flex-col">
                        <div className="mb-4">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="p-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg flex-shrink-0 shadow-sm">
                              <InstagramIcon
                                className="w-4 h-4 text-white"
                                alt="Instagramアイコン"
                              />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                              Official Instagram
                            </h3>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                            野生生物の観察記録を投稿しています
                          </p>
                        </div>

                        {/* Instagram埋め込み */}
                        <div className="overflow-hidden rounded-lg shadow-sm">
                          <div className="instagram-wrapper w-full bg-white dark:bg-slate-800">
                            {(() => {
                              // 1) timeline from file
                              if (instagramPosts && instagramPosts.length > 0) {
                                return (
                                  <InstagramTimeline urls={instagramPosts} />
                                );
                              }
                              // 2) third-party widget
                              if (instagramWidgetHtml) {
                                return (
                                  <div
                                    className="bg-white dark:bg-slate-800 overflow-hidden p-0"
                                    dangerouslySetInnerHTML={{
                                      __html: instagramWidgetHtml,
                                    }}
                                  />
                                );
                              }
                              // 3) single post permalink
                              if (instagramUrl) {
                                const isPostPermalink =
                                  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(
                                    instagramUrl,
                                  );
                                if (isPostPermalink)
                                  return <InstagramEmbed url={instagramUrl} />;
                                // Profile URL fallback: show a nice link card
                                return (
                                  <a
                                    href={instagramUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full group"
                                  >
                                    <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-600 group-hover:border-purple-300 transition-colors">
                                      <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                                          <InstagramIcon className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-purple-600 transition-colors">
                                            プロフィールを表示
                                          </p>
                                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                            {instagramUrl.replace(
                                              /^https?:\/\//,
                                              "",
                                            )}
                                          </p>
                                        </div>
                                        <span className="text-slate-400 group-hover:translate-x-1 transition-transform">
                                          →
                                        </span>
                                      </div>
                                    </div>
                                  </a>
                                );
                              }
                              // 4) nothing configured
                              return (
                                <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 py-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                  Instagramの投稿を表示できません
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* アカウントリンク */}
                        {isInstagramProfileUrl(instagramUrl) && (
                          <div className="mt-4 text-center">
                            <a
                              href={instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-purple-600 dark:hover:text-purple-400 transition-all shadow-sm"
                            >
                              <InstagramIcon className="w-4 h-4" />
                              <span>プロフィールへ移動</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default InsectsHostPlantExplorer;
