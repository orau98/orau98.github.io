import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import InstagramIcon from "./components/InstagramIcon";
import InstagramEmbed from "./components/InstagramEmbed";
import InstagramTimeline from "./components/InstagramTimeline";
import SearchInput from "./components/SearchInput";
import { MainStructuredData } from "./components/StructuredData";
import logger from "./utils/logger";
import { bibliography as rawBibliography } from "./utils/bibliography";
import { getSourceLink } from "./utils/sourceLinks";
import useSeoMeta from "./hooks/useSeoMeta";
import { loadPlantImageFilenames as loadPlantImageFilenamesService } from "./services/imageIndex";

const MothList = React.lazy(() => import("./components/MothList"));
const HostPlantList = React.lazy(() => import("./components/HostPlantList"));



const InsectsHostPlantExplorer = React.memo(
  ({
    moths,
    butterflies,
    beetles,
    leafbeetles,
    hostPlants,
    plantDetails,
    theme,
    setTheme,
    summaryCounts,
    onNeedInsectsData,
  }) => {
    const [activeTab, setActiveTab] = useState("insects");
    const [searchParams, setSearchParams] = useSearchParams();
    const [heroImageLoaded, setHeroImageLoaded] = useState(false);
    const [instagramUrl, setInstagramUrl] = useState("");
    const [instagramPosts, setInstagramPosts] = useState([]);
    const [instagramWidgetHtml, setInstagramWidgetHtml] = useState("");
    const [showBibliography, setShowBibliography] = useState(false);
    const [plantImageFilenames, setPlantImageFilenames] = useState([]);
    const [globalSearchTerm, setGlobalSearchTerm] = useState(
      searchParams.get("q") || "",
    );

    // Sync global search term with URL
    useEffect(() => {
      const q = searchParams.get("q");
      if (q !== null && q !== globalSearchTerm) {
        setGlobalSearchTerm(q);
      }
    }, [searchParams, globalSearchTerm]);

    const handleGlobalSearch = (e) => {
      const val = e.target.value;
      setGlobalSearchTerm(val);

      // Update URL param
      const newParams = new URLSearchParams(searchParams);
      if (val) {
        newParams.set("q", val);
      } else {
        newParams.delete("q");
      }
      setSearchParams(newParams, { replace: true });
    };

    // Helper: detect profile URL (not a single post permalink)
    const isInstagramProfileUrl = (url) => {
      if (!url) return false;
      return (
        /^https?:\/\/(www\.)?instagram\.com\//.test(url) &&
        !/\/(p|reel|tv)\//.test(url)
      );
    };
    const scrollPositionRef = useRef(0);

    // DEBUG: Log the actual data received (dev only)
    if (import.meta && import.meta.env && import.meta.env.DEV)
      logger.debug("DEBUG InsectsHostPlantExplorer received:", {
        moths: moths.length,
        butterflies: butterflies.length,
        beetles: beetles.length,
        leafbeetles: leafbeetles.length,
        total:
          moths.length +
          butterflies.length +
          beetles.length +
          leafbeetles.length,
      });

    // Save scroll position before navigating away
    useEffect(() => {
      const saveScrollPosition = () => {
        scrollPositionRef.current = window.scrollY;
        sessionStorage.setItem(
          "insectExplorerScrollPosition",
          window.scrollY.toString(),
        );
      };

      // Save scroll position on click of any link that navigates to detail page
      const handleClick = (e) => {
        const target = e.target.closest("a");
        if (
          target &&
          (target.href.includes("/moth/") ||
            target.href.includes("/butterfly/") ||
            target.href.includes("/beetle/") ||
            target.href.includes("/leafbeetle/") ||
            target.href.includes("/host-plant/"))
        ) {
          saveScrollPosition();
        }
      };

      document.addEventListener("click", handleClick);

      return () => {
        document.removeEventListener("click", handleClick);
      };
    }, []);

    // Restore scroll position when returning to the page
    useEffect(() => {
      const savedPosition = sessionStorage.getItem(
        "insectExplorerScrollPosition",
      );
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        // Use setTimeout to ensure DOM is fully rendered before scrolling
        setTimeout(() => {
          window.scrollTo(0, position);
        }, 100);
        // Clear the saved position after restoring
        sessionStorage.removeItem("insectExplorerScrollPosition");
      }
    }, []);

    // Initialize tab from URL (e.g., tab=plants to open plant list)
    useEffect(() => {
      const tab = searchParams.get("tab");
      if (tab === "plants") setActiveTab("plants");
      else if (tab === "insects") setActiveTab("insects");
    }, [searchParams]);

    useEffect(() => {
      if (activeTab === "insects" && typeof onNeedInsectsData === "function") {
        onNeedInsectsData();
      }
    }, [activeTab, onNeedInsectsData]);

    // SEO for Home (トップページ)
    const title = "昆虫食草図鑑 — 蛾・蝶・甲虫と食草の繋がりを探索";
    const counts = summaryCounts || {
      moths: moths.length,
      butterflies: butterflies.length,
      beetles: beetles.length,
      leafbeetles: leafbeetles.length,
      hostPlants: Object.keys(hostPlants).length,
    };
    const desc = `掲載: 蛾・蝶 ${counts.moths + counts.butterflies}種、甲虫 ${counts.beetles + counts.leafbeetles}種、食草 ${counts.hostPlants}種。和名/学名/分類から高速検索。`;
    const { setOgTwitterImage } = useSeoMeta({
      title,
      description: desc,
      ogType: "website",
      url:
        (typeof window !== "undefined"
          ? window.location.origin
          : "https://orau98.github.io/") + "/",
    });

    // Preload hero image on component mount (use relative path for subpath-safe resolution)
    React.useEffect(() => {
      const heroImageUrl = "images/insects/Cucullia_argentea.jpg";
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "high";
      img.onload = () => setHeroImageLoaded(true);
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
          setOgTwitterImage(src, "昆虫食草図鑑 メインビジュアル");
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
              setInstagramPosts(urls.slice(0, 10));
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
        {/* 構造化データ */}
        <MainStructuredData />
        <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-8">
          <div className="relative w-full h-72 md:h-96 lg:h-[28rem] rounded-3xl overflow-hidden shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-blue-900/40 z-10"></div>

            {/* Show skeleton while loading */}
            {!heroImageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse z-5" />
            )}

            {(() => {
              const base = "Cucullia_argentea";
              // Use relative paths so it works under any base path
              const src = `images/insects/${base}.jpg`;
              // Use only sizes that actually exist to avoid 404s
              const srcSet = [
                `images/resized/insects/${base}.320.jpg 320w`,
                `images/resized/insects/${base}.640.jpg 640w`,
                `images/resized/insects/${base}.1024.jpg 1024w`,
              ].join(", ");
              const sizes = "100vw";
              return (
                <img
                  src={src}
                  srcSet={srcSet}
                  sizes={sizes}
                  alt="昆虫と食草の美しい関係を探る図鑑のメインビジュアル - Cucullia argentea（ギンスジキンウワバ）"
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
                        imgEl.src = "images/insects/Cucullia_argentea.jpg";
                      } else {
                        imgEl.onerror = null; // prevent loop
                        // Final fallback to a local placeholder (relative path)
                        imgEl.src = "images/placeholder.jpg";
                        imgEl.alt = "画像が見つかりません";
                      }
                    } catch {}
                    setHeroImageLoaded(true);
                  }}
                />
              );
            })()}

            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent z-20"></div>

            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-30">
              <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                  <span className="block bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-transparent drop-shadow-2xl animate-gradient-x font-bold">
                    "繋がり"が見える
                  </span>
                  <span className="block bg-gradient-to-r from-blue-100 via-teal-100 to-emerald-100 bg-clip-text text-transparent drop-shadow-2xl text-4xl md:text-6xl lg:text-7xl mt-2 font-extrabold">
                    昆虫食草図鑑
                  </span>
                </h1>

                <div className="flex flex-wrap gap-3 mt-6">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      蝶・蛾 {counts.moths + counts.butterflies}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      甲虫 {counts.beetles + counts.leafbeetles}種
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                    <span className="text-white/90 text-sm font-medium">
                      食草 {counts.hostPlants}種
                    </span>
                  </div>
                </div>

                {/* ヒーローセクション内の検索バー */}
                <div className="max-w-2xl w-full mt-8 mx-auto md:mx-0">
                  <SearchInput
                    placeholder={`${activeTab === "plants" ? "食草" : "昆虫"}を検索 (和名・学名・分類)`}
                    value={globalSearchTerm}
                    onChange={handleGlobalSearch}
                    onSelectSuggestion={(val) => {
                      setGlobalSearchTerm(val);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set("q", val);
                      setSearchParams(newParams);
                    }}
                  />
                </div>
              </div>
            </div>

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
          </div>

          {/* 主要カテゴリ導線セクションは不要のため削除 */}

          {/* タブナビゲーション */}
          <div className="bg-gradient-to-br from-white/90 to-white/80 dark:from-slate-800/90 dark:to-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-emerald-200/30 dark:border-emerald-700/30 overflow-hidden">
            {/* タブヘッダー */}
            <div className="flex border-b-2 border-gradient-to-r from-emerald-200/50 via-blue-200/50 to-emerald-200/50 dark:from-emerald-700/50 dark:via-blue-700/50 dark:to-emerald-700/50">
              <button
                onClick={() => {
                  setActiveTab("insects");
                  if (typeof onNeedInsectsData === "function")
                    onNeedInsectsData();
                }}
                className={`flex-1 px-6 py-5 text-base font-medium tracking-tight transition-all duration-300 relative ${
                  activeTab === "insects"
                    ? "text-emerald-600 dark:text-emerald-400 bg-gradient-to-br from-emerald-50/70 to-blue-50/70 dark:from-emerald-900/30 dark:to-blue-900/30"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gradient-to-br hover:from-emerald-50/40 hover:to-blue-50/40 dark:hover:from-emerald-900/20 dark:hover:to-blue-900/20"
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {/* Beautiful butterfly icon */}
                  <svg
                    className="w-6 h-6"
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
                  <span>
                    昆虫 (
                    {moths.length +
                      butterflies.length +
                      beetles.length +
                      leafbeetles.length}
                    )
                  </span>
                </div>
                {activeTab === "insects" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-t-lg shadow-lg"></div>
                )}
              </button>

              <button
                onClick={() => setActiveTab("plants")}
                className={`flex-1 px-6 py-5 text-base font-medium tracking-tight transition-all duration-300 relative ${
                  activeTab === "plants"
                    ? "text-blue-600 dark:text-blue-400 bg-gradient-to-br from-blue-50/70 to-emerald-50/70 dark:from-blue-900/30 dark:to-emerald-900/30"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gradient-to-br hover:from-blue-50/40 hover:to-emerald-50/40 dark:hover:from-blue-900/20 dark:hover:to-emerald-900/20"
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {/* Beautiful leaf icon */}
                  <svg
                    className="w-6 h-6"
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
                  <span>食草 ({Object.keys(hostPlants).length})</span>
                </div>
                {activeTab === "plants" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-lg"></div>
                )}
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="relative">
              <div
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
                          ...leafbeetles,
                        ]}
                        title="昆虫"
                        baseRoute=""
                        embedded={true}
                        initialSearchTerm={globalSearchTerm}
                      />
                    </Suspense>
                  </div>
                )}
              </div>

              <div
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
                        plantDetails={plantDetails}
                        embedded={true}
                        preloadedImageFilenames={plantImageFilenames}
                        initialSearchTerm={globalSearchTerm}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instagram セクション */}
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

            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* 左側：サイトポリシーと出典一覧 */}
                <div className="lg:flex lg:flex-col space-y-4">
                  {/* サイトポリシー */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                      サイトポリシー
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="space-y-2.5">
                        <div>
                          <p className="font-medium text-xs mb-1 text-slate-700 dark:text-slate-300">
                            はじめに
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            当サイトは、昆虫と植物の関係を、誰もが手軽に調べられるデータベースを目指して作成しています。掲載されている情報は、管理者が既存の図鑑や学術文献などを基にまとめたものです。
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-xs mb-1 text-slate-700 dark:text-slate-300">
                            免責事項
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            データの正確性には細心の注意を払っておりますが、参照した文献が古かったり、解釈に誤りが含まれていたりする可能性があります。学術研究やその他重要な目的でデータを利用される場合は、必ずご自身で原典をご確認いただきますようお願いいたします。
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-xs mb-1 text-slate-700 dark:text-slate-300">
                            写真について
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
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
                          <p className="font-medium text-xs mb-1 text-slate-700 dark:text-slate-300">
                            お問い合わせ
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
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
                    </div>
                  </div>

                  {/* 出典一覧 */}
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                      出典一覧
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowBibliography((v) => !v)}
                          aria-expanded={showBibliography}
                          aria-controls="bibliography-list"
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
                        >
                          <span>主要引用文献</span>
                          <span
                            className={`ml-3 transform transition-transform ${showBibliography ? "rotate-90" : ""}`}
                          >
                            ▶
                          </span>
                        </button>
                        {showBibliography && (
                          <ul
                            id="bibliography-list"
                            className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400"
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
                                  <li key={b.key} className="flex items-start">
                                    <span className="text-gray-600 dark:text-gray-400 mr-2">
                                      •
                                    </span>
                                    <div className="text-slate-700 dark:text-slate-200">
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
                                                className="underline decoration-blue-300 hover:decoration-blue-500"
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
                                                  className="underline decoration-blue-300 hover:decoration-blue-500"
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
                        )}
                        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                          <p className="font-medium text-xs mb-2 text-slate-700 dark:text-slate-300">
                            その他
                          </p>
                          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <li className="flex items-start">
                              <span className="text-gray-600 dark:text-gray-400 mr-2">
                                •
                              </span>
                              <span>学術論文等</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右側：Instagram */}
                <div className="lg:flex lg:flex-col space-y-4">
                  <div className="flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    {/* Instagram最新投稿 */}
                    <div className="flex flex-col">
                      <div className="mb-4 lg:mb-5">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="p-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg flex-shrink-0">
                            <InstagramIcon
                              className="w-4 h-4 text-white"
                              alt="Instagramアイコン"
                            />
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                            Instagram 最新投稿
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 ml-0 sm:ml-9 px-1 sm:px-0">
                          徒然なるままに野生生物の観察記録をInstagramで投稿しています
                        </p>
                      </div>

                      {/* Instagram埋め込み */}
                      <div className="overflow-hidden">
                        <div className="instagram-wrapper w-full border border-gradient-to-r from-purple-200/50 via-pink-200/50 to-orange-200/50 dark:border-purple-700/50 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 bg-gradient-to-r from-purple-50/30 via-pink-50/30 to-orange-50/30 dark:bg-gradient-to-r dark:from-purple-900/10 dark:via-pink-900/10 dark:to-orange-900/10">
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
                                  className="bg-white/70 dark:bg-slate-800/70 rounded-xl overflow-hidden p-0"
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
                                  className="block w-full"
                                >
                                  <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-xl p-4 sm:p-6 border border-white/30 dark:border-slate-700/50 shadow">
                                    <div className="flex items-center space-x-3">
                                      <div className="p-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg">
                                        <InstagramIcon className="w-5 h-5 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                          Instagramプロフィール
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                          {instagramUrl.replace(
                                            /^https?:\/\//,
                                            "",
                                          )}
                                        </p>
                                      </div>
                                      <span className="text-xs text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 px-2 py-1 rounded">
                                        Open
                                      </span>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                                      最近の投稿は `public/instagram_posts.txt`
                                      にパーマリンクを列挙するとタイムライン表示されます。
                                    </p>
                                  </div>
                                </a>
                              );
                            }
                            // 4) nothing configured
                            return (
                              <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 py-8">
                                Instagramの最新投稿が未設定です（public/instagram_posts.txt、instagram_widget.html、instagram_latest.txt
                                のいずれかを設定）。
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* アカウントリンク（プロフィールURLがある場合は下部に配置） */}
                      {isInstagramProfileUrl(instagramUrl) && (
                        <div className="mt-2 flex justify-end">
                          <a
                            href={instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors shadow-sm"
                            aria-label="Instagramプロフィールへ"
                          >
                            <span className="p-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded">
                              <InstagramIcon className="w-3.5 h-3.5 text-white" />
                            </span>
                            <span className="font-medium">
                              Instagramプロフィールへ
                            </span>
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
    );
  },
);

export default InsectsHostPlantExplorer;
