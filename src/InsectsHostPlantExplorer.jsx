import { Suspense, memo, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import InstagramIcon from "./components/InstagramIcon";
import InstagramGallery from "./components/InstagramGallery";
import InstagramTimeline from "./components/InstagramTimeline";
import ExplorerHero from "./components/ExplorerHero";
import DiscoveryLinks from "./components/DiscoveryLinks";
import StickyHeader from "./components/StickyHeader";
import { ExplorerStructuredData } from "./components/StructuredData";
import logger from "./utils/logger";
import { bibliography as rawBibliography } from "./utils/bibliography";
import { getSourceLink, normalizeReference } from "./utils/sourceLinks";
import useSeoMeta from "./hooks/useSeoMeta";
import useDebounce from "./hooks/useDebounce";
import useInsectImageIndex from "./hooks/useInsectImageIndex";
import usePlantImageFilenames from "./hooks/usePlantImageFilenames";
import lazyWithRetry from "./utils/lazyWithRetry";
import { hiraganaToKatakana } from "./utils/text";
import { normalizePlantKey } from "./utils/plantNameUtils";
import { isPlantHostRecord } from "./utils/hostResource";
import {
  comparePlantImageDisplayPriority,
  createSafePlantFilename,
  createSafeScientificPlantFilename,
  splitFilenameBase,
} from "./utils/filename";
import { buildResizedImageUrl } from "./utils/imageSrcset";
import { globalJapaneseToScientificMapping } from "./utils/insectImageMappings";
import {
  buildInsectImageBaseCandidates,
  resolveImageBaseCandidates,
} from "./utils/insectImageResolver";
import { getAssetBase } from "./utils/assetPaths";
import { absUrl } from "./utils/origin";
import { buildPlantPath, isKnownDetailPath, isExplorerRoutePath } from "./utils/siteTaxonomy";
import { buildInsectPath } from "./utils/insectSlug";
import { shouldShowDiscoveryLinks } from "./utils/discoveryLinks";
import {
  EN_SITE_NAME,
  buildJapaneseReferenceLabel,
  getPrimaryEnglishName,
} from "./utils/englishNaming";
import {
  isEnglishLocale,
  localizePath,
  stripLocalePrefix,
} from "./utils/locale";

const MothList = lazyWithRetry(() => import("./components/MothList"));
const HostPlantList = lazyWithRetry(() => import("./components/HostPlantList"));

// 全昆虫の結合配列を再マウントをまたいで参照安定化するキャッシュ。
// useMemoだけだと詳細ページから戻った再マウントで参照が変わり、
// MothList側の画像解決マップやフィルタのキャッシュが全て無効化されてしまう。
let lastCombinedInsectParts = null;
let lastCombinedInsects = [];
const combineInsectsStable = (parts) => {
  if (
    lastCombinedInsectParts &&
    lastCombinedInsectParts.length === parts.length &&
    lastCombinedInsectParts.every((part, index) => part === parts[index])
  ) {
    return lastCombinedInsects;
  }
  lastCombinedInsectParts = parts;
  lastCombinedInsects = parts.flat();
  return lastCombinedInsects;
};

const buildInstagramWidgetSrcDoc = (html, baseHref = "/") => {
  const trimmed = String(html || "").trim();
  if (!trimmed) return "";
  const normalizedBase = baseHref.endsWith("/") ? baseHref : `${baseHref}/`;
  const safeBase = normalizedBase.replace(/"/g, "&quot;");
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    `<base href=\"${safeBase}\">`,
    "</head>",
    "<body style=\"margin:0\">",
    trimmed,
    "</body>",
    "</html>",
  ].join("");
};

const isEditableElement = (element) => {
  if (!element) return false;
  if (typeof HTMLElement !== "undefined" && !(element instanceof HTMLElement)) {
    return false;
  }
  const tagName = element.tagName || "";
  return (
    element.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

const parseInstagramTimestampValue = (value) => {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e12) return Math.trunc(value);
    if (value > 1e9) return Math.trunc(value * 1000);
    return 0;
  }
  const text = String(value).trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      if (numeric > 1e12) return Math.trunc(numeric);
      if (numeric > 1e9) return Math.trunc(numeric * 1000);
    }
    return 0;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoFromTimestamp = (value) => {
  const ms = parseInstagramTimestampValue(value);
  if (!ms) return "";
  try {
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
};

const getInstagramTimestampValue = (post) => {
  if (!post) return 0;
  return (
    parseInstagramTimestampValue(post.timestamp) ||
    parseInstagramTimestampValue(post.taken_at) ||
    parseInstagramTimestampValue(post.takenAt) ||
    parseInstagramTimestampValue(post.taken_at_timestamp) ||
    parseInstagramTimestampValue(post.takenAtTimestamp) ||
    0
  );
};

const normalizeInstagramPostCard = (post) => {
  if (!post || typeof post !== "object") return null;
  const permalink = typeof post.permalink === "string" ? post.permalink.trim() : "";
  if (!/^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(permalink)) {
    return null;
  }
  const normalizedTimestamp =
    toIsoFromTimestamp(post.timestamp) ||
    toIsoFromTimestamp(post.taken_at) ||
    toIsoFromTimestamp(post.takenAt) ||
    toIsoFromTimestamp(post.taken_at_timestamp) ||
    toIsoFromTimestamp(post.takenAtTimestamp);
  return {
    ...post,
    permalink,
    media_type: post.media_type || post.mediaType || null,
    media_url: post.media_url || post.mediaUrl || null,
    thumbnail_url: post.thumbnail_url || post.thumbnailUrl || null,
    local_url: post.local_url || post.localUrl || null,
    timestamp: normalizedTimestamp || post.timestamp || null,
  };
};

const dedupeInstagramPostsByPermalink = (posts = []) => {
  const map = new Map();
  posts.forEach((post) => {
    if (!post?.permalink) return;
    if (!map.has(post.permalink)) {
      map.set(post.permalink, post);
      return;
    }
    const existing = map.get(post.permalink);
    if (getInstagramTimestampValue(post) > getInstagramTimestampValue(existing)) {
      map.set(post.permalink, post);
    }
  });
  return Array.from(map.values());
};

const sortInstagramPostsByLatest = (posts = []) =>
  dedupeInstagramPostsByPermalink(posts)
    .slice()
    .sort((a, b) => getInstagramTimestampValue(b) - getInstagramTimestampValue(a));

const joinBibliographyNames = (arr) =>
  Array.isArray(arr)
    ? arr.filter(Boolean).join(", ")
    : typeof arr === "string"
      ? arr
      : "";

const renderBibliographyTitle = (titlePlain, href) => {
  if (!titlePlain) return null;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-slate-300 hover:decoration-slate-500 hover:text-emerald-600 transition-colors"
      >
        {titlePlain}
      </a>
    );
  }
  return <span>{titlePlain}</span>;
};

const renderEnglishBibliographyEntry = (entry, href) => {
  const authorStr =
    joinBibliographyNames(entry.authors) ||
    (entry.editors ? `${joinBibliographyNames(entry.editors)} (ed.)` : "");
  const titlePlain = entry.title
    ? `${entry.title}${entry.note ? ` ${entry.note}` : ""}`
    : "";
  const publisherStr = entry.publisher || "";
  const yearStr = entry.year || "";
  const isArticle = entry.type === "article" || !!entry.journal;
  const journalStr = entry.journal || "";
  const volumeStr = entry.volume || "";
  const issueStr = entry.issue || "";
  const pagesStr = entry.pages || "";
  const issueDisplay = issueStr
    ? volumeStr
      ? `(${issueStr})`
      : `No. ${issueStr}`
    : "";

  if (isArticle) {
    const lead = `${authorStr ? `${authorStr}. ` : ""}${yearStr ? `(${yearStr}). ` : ""}`;
    const tailParts = [];
    if (journalStr) tailParts.push(journalStr);
    if (volumeStr || issueDisplay) tailParts.push(`${volumeStr}${issueDisplay}`.trim());
    if (pagesStr) tailParts.push(`pp. ${pagesStr}`);

    return (
      <>
        {lead && <span>{lead}</span>}
        {renderBibliographyTitle(titlePlain, href)}
        {tailParts.length > 0 ? <span>{`. ${tailParts.join(", ")}.`}</span> : <span>.</span>}
      </>
    );
  }

  const lead = authorStr ? `${authorStr}. ` : "";
  const tail = [publisherStr, yearStr].filter(Boolean).join(", ");
  return (
    <>
      {lead && <span>{lead}</span>}
      {renderBibliographyTitle(titlePlain, href)}
      {tail ? <span>{`. ${tail}.`}</span> : <span>.</span>}
    </>
  );
};

// 投稿リストの更新頻度は低いため、定期リフェッチは30分間隔で十分
// （タブ復帰時は focus/visibilitychange で即時再取得される）
const DEFAULT_INSTAGRAM_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const MIN_INSTAGRAM_REFRESH_INTERVAL_MS = 60 * 1000;

const buildPlantInsectStats = (
  insects = [],
  plantDetails = {},
  hostPlantsMap = {},
  flowerVisitPlantsMap = {},
) => {
  if (!Array.isArray(insects) || insects.length === 0) {
    return { countsByPlant: {}, namesByPlant: {} };
  }
  const insectNameToIds = new Map();
  const insectIdToName = new Map();
  insects.forEach((insect) => {
    if (!insect) return;
    const insectName = (insect.name || insect.japaneseName || "").trim();
    const insectId = String(
      insect.id || insect.name || insect.japaneseName || "",
    ).trim();
    if (!insectId) return;
    if (insectName) {
      if (!insectNameToIds.has(insectName)) {
        insectNameToIds.set(insectName, new Set());
      }
      insectNameToIds.get(insectName).add(insectId);
      if (!insectIdToName.has(insectId)) {
        insectIdToName.set(insectId, insectName);
      }
    }
  });

  const idsByNormalizedPlant = new Map();
  const addIdsToPlant = (rawPlant, ids = []) => {
    const raw = String(rawPlant || "").trim();
    if (!raw || raw === "不明") return;
    const cleaned = raw.replace(/[(（][^)）]*[)）]/g, "").trim();
    const normalizedRaw = normalizePlantKey(raw);
    const normalizedClean = normalizePlantKey(cleaned);
    const normalizedPlants = [normalizedRaw, normalizedClean].filter(
      (name) => name && name !== "不明",
    );
    normalizedPlants.forEach((plantName) => {
      if (!idsByNormalizedPlant.has(plantName)) {
        idsByNormalizedPlant.set(plantName, new Set());
      }
      const set = idsByNormalizedPlant.get(plantName);
      ids.forEach((id) => {
        if (id) set.add(id);
      });
    });
  };
  const addPlantByInsectName = (plantName, insectName) => {
    const ids = insectNameToIds.get(String(insectName || "").trim());
    if (!ids || ids.size === 0) return;
    addIdsToPlant(plantName, Array.from(ids));
  };
  const addPlantByInsectId = (plantName, insectId) => {
    if (!insectId) return;
    addIdsToPlant(plantName, [insectId]);
  };

  Object.entries(hostPlantsMap || {}).forEach(([plantName, insectNames]) => {
    if (!Array.isArray(insectNames)) return;
    insectNames.forEach((insectName) =>
      addPlantByInsectName(plantName, insectName),
    );
  });
  Object.entries(flowerVisitPlantsMap || {}).forEach(
    ([plantName, insectNames]) => {
      if (!Array.isArray(insectNames)) return;
      insectNames.forEach((insectName) =>
        addPlantByInsectName(plantName, insectName),
      );
    },
  );

  insects.forEach((insect) => {
    if (!insect) return;
    const insectId = String(
      insect.id || insect.name || insect.japaneseName || "",
    ).trim();
    if (!insectId) return;
    const records = insect.hostPlantsDetailed;
    if (Array.isArray(records) && records.length > 0) {
      records.forEach((record) => {
        if (!isPlantHostRecord(record)) return;
        const plantName =
          record?.name || record?.displayName || record?.plant || "";
        addPlantByInsectId(plantName, insectId);
      });
      return;
    }
    const hostPlantsRaw = insect.hostPlants;
    if (Array.isArray(hostPlantsRaw)) {
      hostPlantsRaw.forEach((plant) =>
        addPlantByInsectId(plant, insectId),
      );
      return;
    }
    if (typeof hostPlantsRaw === "string") {
      hostPlantsRaw
        .split(/[;；、，,]/)
        .forEach((plant) => addPlantByInsectId(plant, insectId));
      return;
    }
    if (hostPlantsRaw) {
      addPlantByInsectId(String(hostPlantsRaw), insectId);
    }
  });

  const candidatePlants = new Set([
    ...Object.keys(plantDetails || {}),
    ...Object.keys(hostPlantsMap || {}),
    ...Object.keys(flowerVisitPlantsMap || {}),
  ]);

  const countsByPlant = {};
  const namesByPlantObj = {};
  candidatePlants.forEach((plantName) => {
    const canonical = String(plantName || "").trim();
    if (!canonical || canonical === "不明") return;
    const detail = plantDetails?.[canonical] || {};
    const aliasesRaw = detail.aliases || detail.aliasNames;
    const aliases = Array.isArray(aliasesRaw)
      ? aliasesRaw
      : aliasesRaw instanceof Set
        ? Array.from(aliasesRaw)
        : [];
    const targetNames = [canonical, ...aliases].filter(Boolean);
    const relatedIds = new Set();
    targetNames.forEach((targetName) => {
      const normalized = normalizePlantKey(targetName);
      if (!normalized || normalized === "不明") return;
      const ids = idsByNormalizedPlant.get(normalized);
      if (!ids) return;
      ids.forEach((id) => relatedIds.add(id));
    });
    countsByPlant[canonical] = relatedIds.size;
    if (relatedIds.size === 0) {
      namesByPlantObj[canonical] = [];
      return;
    }
    const relatedNames = new Set();
    relatedIds.forEach((id) => {
      const name = insectIdToName.get(id);
      if (name) relatedNames.add(name);
    });
    namesByPlantObj[canonical] = Array.from(relatedNames).sort((a, b) =>
      a.localeCompare(b, "ja"),
    );
  });
  return { countsByPlant, namesByPlant: namesByPlantObj };
};



const InsectsHostPlantExplorer = memo(
  ({
    moths,
    butterflies,
    beetles,
    longhornbeetles,
    leafbeetles,
    aphids = [],
    hostPlants,
    flowerVisitPlants: flowerVisitPlantsProp = {},
    plantDetails,
    theme,
    setTheme,
    summaryCounts,
    locale = "ja",
    onNeedInsectsData,
    onNeedPlantsData,
    initialTab = "insects",
  }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isEnglish = isEnglishLocale(locale);
    const strippedPathname = stripLocalePrefix(location.pathname || "/");
    const countLabel = useCallback(
      (value) =>
        isEnglish
          ? `${Number(value || 0).toLocaleString("en-US")} species`
          : `${value}種`,
      [isEnglish],
    );
    const getCurrentParams = useCallback(() => {
      try {
        if (typeof window !== "undefined" && window.location?.search != null) {
          return new URLSearchParams(window.location.search);
        }
      } catch {}
      return new URLSearchParams(searchParams);
    }, [searchParams]);
    const normalizeTab = (value, fallback) => {
      if (value === "plants" || value === "insects") return value;
      return fallback;
    };
    const initialTabFromParams = normalizeTab(searchParams.get("tab"), initialTab);
    const initialQuery = searchParams.get("q") || "";
    const [activeTab, setActiveTab] = useState(() => initialTabFromParams);
    const [instagramUrl, setInstagramUrl] = useState("");
    const [instagramPosts, setInstagramPosts] = useState([]);
    const [instagramPostCards, setInstagramPostCards] = useState([]);
    const [instagramWidgetHtml, setInstagramWidgetHtml] = useState("");
    const [instagramGalleryFailed, setInstagramGalleryFailed] = useState(false);
    const normalizedBaseUrl = getAssetBase();
    const instagramWidgetSrcDoc = useMemo(
      () => buildInstagramWidgetSrcDoc(instagramWidgetHtml, normalizedBaseUrl),
      [instagramWidgetHtml, normalizedBaseUrl],
    );
    const [showBibliography, setShowBibliography] = useState(false);
    // 画像インデックスは共有フックから取得（再マウント時も同期初期化される）
    const plantImageFilenames = usePlantImageFilenames();
    const {
      imageNames: insectImageFilenames,
      imageExtensions: insectImageExtensions,
      normalizedEntries: normalizedInsectImageEntries,
    } = useInsectImageIndex();
    const [searchByTab, setSearchByTab] = useState(() => ({
      insects: initialTabFromParams === "insects" ? initialQuery : "",
      plants: initialTabFromParams === "plants" ? initialQuery : "",
    }));
    const activeSearchTerm = searchByTab[activeTab] || "";
    // サジェスト計算は毎打鍵ではなくdebounce後に行う（IME入力中のカクつき防止）
    const debouncedSuggestionTerm = useDebounce(activeSearchTerm, 150);
    const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false);
    const [showAboutDetails, setShowAboutDetails] = useState(false);
    const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
      if (typeof window === "undefined") return false;
      return window.matchMedia("(min-width: 1024px)").matches;
    });
    const [isInstagramExpanded, setIsInstagramExpanded] = useState(() => {
      return true;
    });
    const searchTimeoutRef = useRef(null);
    const heroSearchInputRef = useRef(null);
    const stickySearchInputRef = useRef(null);
    const ui = useMemo(
      () => ({
        siteTitle: isEnglish
          ? "Insects and Host Plants of Japan"
          : "昆虫植物図鑑",
        searchPlaceholder:
          activeTab === "plants"
            ? isEnglish
              ? "Search plants by scientific name, family, genus, or Japanese name"
              : "植物を検索 (和名・学名・分類)"
            : isEnglish
              ? "Search insects by scientific name, family, host plant, or Japanese name"
              : "昆虫を検索 (和名・学名・分類)",
        searchTargetLabel:
          activeTab === "plants"
            ? isEnglish
              ? "Plants"
              : "植物"
            : isEnglish
              ? "Insects"
              : "昆虫",
        searchHelpTitle: isEnglish ? "Search tips" : "検索の使い方",
        searchHelpAria: isEnglish ? "Show search tips" : "検索の使い方を表示",
        searchShortcut1: isEnglish
          ? 'Press "/" or Ctrl/Cmd + K to focus the search box.'
          : "「/」または Ctrl/Cmd + K で検索欄にフォーカスします。",
        searchShortcut2: isEnglish
          ? "Try a scientific name, family, genus, or host plant first."
          : "Esc を 1 回押すと候補を閉じ、続けて押すと入力をクリアします。",
        searchShortcut3: isEnglish
          ? "Use the tabs above to switch between insects and plants."
          : "検索対象は上のタブで、昆虫と植物を切り替えできます。",
        themeAria: isEnglish ? "Toggle theme" : "テーマを切り替え",
        insectsTab: isEnglish ? "Insects" : "昆虫",
        plantsTab: isEnglish ? "Plants" : "植物",
        loadingInsects: isEnglish ? "Loading insect data..." : "昆虫データを読み込んでいます…",
        loadingPlants: isEnglish ? "Loading plant data..." : "植物データを読み込んでいます…",
      }),
      [activeTab, isEnglish],
    );
    const infoUi = useMemo(
      () => ({
        sectionTitle: isEnglish ? "Site information" : "サイトについて",
        policyTitle: isEnglish ? "Site policy" : "サイトポリシー",
        policySummary: isEnglish
          ? "This site publishes curated insect-plant relationship data compiled from field guides and academic literature. Please verify the original references for academic use."
          : "図鑑・文献ベースで整理した「昆虫と植物の関係データ」を公開しています。学術利用時は必ず原典をご確認ください。",
        policyToggle: (open) => (isEnglish ? (open ? "Hide details" : "Show full policy") : (open ? "詳細を閉じる" : "詳細ポリシーを表示")),
        introTitle: isEnglish ? "Introduction" : "はじめに",
        introBody: isEnglish
          ? "This site aims to make insect-plant relationships easier to browse. The published records are compiled by the site owner from existing field guides and academic references."
          : "当サイトは、昆虫と植物の関係を、誰もが手軽に調べられるデータベースを目指して作成しています。掲載されている情報は、管理者が既存の図鑑や学術文献などを基にまとめたものです。",
        disclaimerTitle: isEnglish ? "Disclaimer" : "免責事項",
        disclaimerBody: isEnglish
          ? "The data is curated carefully, but some cited literature may be old and some interpretations may still be imperfect. Please confirm the original references before using the data for research or other critical purposes."
          : "データの正確性には細心の注意を払っておりますが、参照した文献が古かったり、解釈に誤りが含まれていたりする可能性があります。学術研究やその他重要な目的でデータを利用される場合は、必ずご自身で原典をご確認いただきますようお願いいたします。",
        photosTitle: isEnglish ? "Photos" : "写真について",
        photosBodyBeforeLink: isEnglish
          ? "All photos on this site were taken by the site owner. Copyright remains with the owner. Reuse without permission is not allowed. For reuse requests, please contact us through"
          : "掲載している写真は、すべて管理者自身が撮影したものです。写真の著作権は管理者に帰属します。無断での転載・利用は固くお断りいたします。写真の利用をご希望の場合は、",
        photosBodyAfterLink: isEnglish ? "." : "よりお気軽にご連絡ください。",
        contactTitle: isEnglish ? "Contact" : "お問い合わせ",
        contactBodyBeforeLink: isEnglish
          ? "Corrections and typo reports help improve the quality of the site. If you notice an issue, please send it through"
          : "誤植・情報の修正依頼は、サイトの品質向上のために大変助かります。お気づきの点がありましたら、",
        contactBodyAfterLink: isEnglish ? "." : "までお寄せください。",
        formLinkLabel: isEnglish ? "this Google Form" : "こちらのGoogleフォーム",
        referencesTitle: isEnglish ? "Bibliography" : "出典一覧",
        bibliographyToggle: (open) => (isEnglish ? (open ? "Hide bibliography" : "Show selected bibliography") : "主要引用文献リストを表示"),
        otherTitle: isEnglish ? "Other" : "その他",
        otherItem: isEnglish ? "Additional academic papers and references" : "各種学術論文等",
        instagramTagline: isEnglish ? "Field notes and wildlife observation posts" : "野生生物の観察記録を投稿しています",
        instagramToggle: (open) => (isEnglish ? (open ? "Close Instagram" : "Open Instagram") : (open ? "Instagramを閉じる" : "Instagramを開く")),
        instagramUnavailable: isEnglish ? "Instagram posts are unavailable right now" : "Instagramの投稿を表示できません",
        instagramProfile: isEnglish ? "Open profile" : "プロフィールへ移動",
        instagramCollapsedHint: isEnglish
          ? 'Instagram is hidden. Use "Open Instagram" to expand it.'
          : 'Instagramは現在非表示です。「Instagramを開く」から表示できます。',
        instagramIconAlt: isEnglish ? "Instagram icon" : "Instagramアイコン",
      }),
      [isEnglish],
    );

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
        // 入力から300ms以内に候補クリック等で別ページへ遷移した場合、
        // このタイマーが遅れて発火すると詳細ページのURLをreplaceで上書きして
        // 一覧へ引き戻してしまう。Explorerルートを離れていたら何もしない
        if (
          typeof window !== "undefined" &&
          !isExplorerRoutePath(window.location.pathname)
        ) {
          return;
        }
        const newParams = getCurrentParams();
        newParams.set("tab", activeTab);
        if (val) {
          newParams.set("q", val);
        } else {
          newParams.delete("q");
        }
        setSearchParams(newParams, { replace: true });
      }, 300);
    };

    const commitSearchValue = useCallback((value) => {
      const nextValue = String(value || "");
      setSearchByTab((prev) => ({ ...prev, [activeTab]: nextValue }));
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const newParams = getCurrentParams();
      newParams.set("tab", activeTab);
      if (nextValue) {
        newParams.set("q", nextValue);
      } else {
        newParams.delete("q");
      }
      // 明示的な検索確定は履歴に残し、戻るで1つ前の状態に戻れるようにする。
      // ただしデバウンスのreplace反映後などURLが既に同一の場合は、重複エントリを
      // 積むと「戻る」1回が無反応になるためスキップする
      if (newParams.toString() === getCurrentParams().toString()) return;
      setSearchParams(newParams);
    }, [activeTab, getCurrentParams, setSearchParams]);

    const setActiveTabWithUrl = (tab) => {
      setActiveTab(tab);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const newParams = getCurrentParams();
      if (tab) newParams.set("tab", tab);
      else newParams.delete("tab");
      const nextSearch = (searchByTab[tab] || "").trim();
      if (nextSearch) newParams.set("q", nextSearch);
      else newParams.delete("q");
      // タブ切替は履歴に残す（戻るでタブごと離脱しないように）。
      // 既に同じURLなら重複pushしない（同じタブの再クリック等）
      if (newParams.toString() === getCurrentParams().toString()) return;
      setSearchParams(newParams);
    };

    // 逆引き動線: 現在の検索語を保持したまま反対のタブ（昆虫⇄植物）へ切り替える
    const crossSearchOtherTab = useCallback(() => {
      const term = (searchByTab[activeTab] || "").trim();
      const otherTab = activeTab === "insects" ? "plants" : "insects";
      setSearchByTab((prev) => ({ ...prev, [otherTab]: term }));
      setActiveTab(otherTab);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const newParams = getCurrentParams();
      newParams.set("tab", otherTab);
      if (term) newParams.set("q", term);
      else newParams.delete("q");
      setSearchParams(newParams);
      const resultsEl = typeof document !== "undefined" && document.getElementById("explorer-results");
      if (resultsEl) resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [activeTab, searchByTab, setActiveTab, getCurrentParams, setSearchParams]);

    // Cleanup timeout
    useEffect(() => {
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return undefined;
      const mediaQuery = window.matchMedia("(min-width: 1024px)");
      const updateLayout = (event) => {
        const desktop = Boolean(event?.matches);
        setIsDesktopLayout(desktop);
        if (desktop) {
          setIsInstagramExpanded(true);
        }
      };
      updateLayout(mediaQuery);
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateLayout);
        return () => mediaQuery.removeEventListener("change", updateLayout);
      }
      mediaQuery.addListener(updateLayout);
      return () => mediaQuery.removeListener(updateLayout);
    }, []);

    // Helper: detect profile URL (not a single post permalink)
    const isInstagramProfileUrl = (url) => {
      if (!url) return false;
      return (
        /^https?:\/\/(www\.)?instagram\.com\//.test(url) &&
        !/\/(p|reel|tv)\//.test(url)
      );
    };
    const isInstagramPostUrl = useCallback(
      (url) => /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(url || ""),
      [],
    );
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
        aphids: aphids.length,
        total:
          moths.length +
          butterflies.length +
          beetles.length +
          longhornbeetles.length +
          leafbeetles.length +
          aphids.length,
      });

    const safeSessionGet = (key) => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const safeSessionSet = (key, value) => {
      try {
        sessionStorage.setItem(key, value);
      } catch {}
    };

    const safeSessionRemove = (key) => {
      try {
        sessionStorage.removeItem(key);
      } catch {}
    };

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
        if (!isKnownDetailPath(url.pathname)) return;

        safeSessionSet(
          SCROLL_RESTORE_KEY,
          JSON.stringify({
            y: window.scrollY,
            tab: activeTab,
            from: window.location.pathname + window.location.search,
            to: url.pathname + url.search,
            ts: Date.now(),
          }),
        );
      };

      document.addEventListener("click", handleClick, true);

      return () => {
        document.removeEventListener("click", handleClick, true);
      };
    }, [activeTab, SCROLL_RESTORE_KEY]);

    // Restore scroll position when returning to the page (retry until layout is ready)
    useEffect(() => {
      if (didRestoreScrollRef.current) return;

      let timeoutId = null;
      let cancelled = false;
      const schedule = (fn, delay) => {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(fn, delay);
      };

      let saved = null;
      const raw = safeSessionGet(SCROLL_RESTORE_KEY);
      if (raw) {
        try {
          saved = JSON.parse(raw);
        } catch {
          saved = null;
        }
      } else {
        // Backward-compat fallback
        const legacy = safeSessionGet("insectExplorerScrollPosition");
        if (legacy) saved = { y: parseInt(legacy, 10), legacy: true };
      }

      const currentPath = window.location.pathname + window.location.search;
      if (saved?.from && saved.from !== currentPath) {
        safeSessionRemove(SCROLL_RESTORE_KEY);
        safeSessionRemove("insectExplorerScrollPosition");
        return;
      }

      const y = Number(saved?.y);
      if (!Number.isFinite(y)) {
        safeSessionRemove(SCROLL_RESTORE_KEY);
        safeSessionRemove("insectExplorerScrollPosition");
        return;
      }

      const startedAt = Date.now();
      const maxWaitMs = 4000;

      const finish = () => {
        didRestoreScrollRef.current = true;
        safeSessionRemove(SCROLL_RESTORE_KEY);
        safeSessionRemove("insectExplorerScrollPosition");
        removeUserScrollListeners();
      };

      // ユーザーが自分でスクロールし始めたら復元で奪い合わない
      const onUserScroll = () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
        finish();
      };
      const removeUserScrollListeners = () => {
        window.removeEventListener("wheel", onUserScroll);
        window.removeEventListener("touchmove", onUserScroll);
      };
      window.addEventListener("wheel", onUserScroll, { passive: true });
      window.addEventListener("touchmove", onUserScroll, { passive: true });

      const tryRestore = () => {
        if (cancelled) return;
        const resultsEl = document.getElementById("explorer-results");
        const maxScroll =
          Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const targetY = Math.min(y, maxScroll);

        if (resultsEl) {
          window.scrollTo(0, targetY);
        }

        // 注意: 「クランプ後のtargetYに到達した」だけで完了にしない。
        // カード・ページネーションの描画途中はページがまだ低く、そこで
        // 打ち切ると本来の位置より手前で復元が終わってしまう。
        // 保存した本来のyに到達するまで(またはタイムアウトまで)待つ
        const reachedSavedY = resultsEl && Math.abs(window.scrollY - y) < 2;
        if (reachedSavedY || Date.now() - startedAt > maxWaitMs) {
          finish();
          return;
        }

        schedule(tryRestore, 60);
      };

      schedule(tryRestore, 0);
      return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
        removeUserScrollListeners();
      };
    }, [SCROLL_RESTORE_KEY, activeTab]);

    // Initialize tab from URL, fallback to current tab (or prop) when absent
    useEffect(() => {
      const tabParam = searchParams.get("tab");
      const normalizedTab = normalizeTab(tabParam, "");
      if (normalizedTab) {
        if (normalizedTab !== activeTab) {
          setActiveTab(normalizedTab);
        }
        return;
      }
      // Ensure URL reflects current tab so戻る/共有で維持される
      const fallbackTab = normalizeTab(activeTab, "") || normalizeTab(initialTab, "") || "insects";
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", fallbackTab);
      const initSearch = (searchByTab[fallbackTab] || "").trim();
      if (initSearch) newParams.set("q", initSearch);
      else newParams.delete("q");
      setSearchParams(newParams, { replace: true });
      if (fallbackTab !== activeTab) {
        setActiveTab(fallbackTab);
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
        ...aphids,
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
          if (!isPlantHostRecord(record)) return;
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
    }, [moths, butterflies, beetles, longhornbeetles, leafbeetles, aphids]);
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
    const plantInsectStats = useMemo(() => {
      const allInsects = [
        ...moths,
        ...butterflies,
        ...beetles,
        ...longhornbeetles,
        ...leafbeetles,
        ...aphids,
      ];
      if (allInsects.length === 0) return null;
      return buildPlantInsectStats(
        allInsects,
        plantDetails,
        hostPlants,
        flowerVisitPlants,
      );
    }, [
      moths,
      butterflies,
      beetles,
      longhornbeetles,
      leafbeetles,
      aphids,
      plantDetails,
      hostPlants,
      flowerVisitPlants,
    ]);
    const mergedHostPlantCount = useMemo(() => {
      const names = new Set(Object.keys(hostPlants || {}));
      Object.keys(flowerVisitPlants || {}).forEach((name) => {
        if (name) names.add(name);
      });
      return names.size;
    }, [hostPlants, flowerVisitPlants]);
    // 逆引き動線のラベル: 検索語を保持して反対カテゴリへ誘導する。
    // 件数は親側では正確に算出できない（各リストが内部に独自フィルタ＋別名正規化マージを持ち、
    // 植物詳細は遅延ロード）ため、誤った数字を出さないよう数字なしの行動リンクにしている。
    const crossLinkLabel = useMemo(() => {
      const term = (activeSearchTerm || "").trim();
      if (!term) return "";
      const shortTerm = term.length > 12 ? `${term.slice(0, 12)}…` : term;
      const other =
        activeTab === "insects"
          ? isEnglish
            ? "plants"
            : "植物"
          : isEnglish
            ? "insects"
            : "昆虫";
      return isEnglish
        ? `Search ${other} for "${shortTerm}"`
        : `${other}でも「${shortTerm}」を探す`;
    }, [activeSearchTerm, activeTab, isEnglish]);
    // SEO for list pages (トップ/昆虫/植物)
    const counts = useMemo(
      () => ({
        moths: summaryCounts?.moths ?? moths.length,
        butterflies: summaryCounts?.butterflies ?? butterflies.length,
        beetles: summaryCounts?.beetles ?? beetles.length,
        longhornbeetles: summaryCounts?.longhornbeetles ?? longhornbeetles.length,
        leafbeetles: summaryCounts?.leafbeetles ?? leafbeetles.length,
        aphids: summaryCounts?.aphids ?? aphids.length,
        hostPlants: mergedHostPlantCount,
      }),
      [
        summaryCounts,
        moths.length,
        butterflies.length,
        beetles.length,
        longhornbeetles.length,
        leafbeetles.length,
        aphids.length,
        mergedHostPlantCount,
      ],
    );
    const insectDisplayNameMap = useMemo(() => {
      const map = new Map();
      [
        ...moths,
        ...butterflies,
        ...beetles,
        ...longhornbeetles,
        ...leafbeetles,
        ...aphids,
      ].forEach((insect) => {
        const japaneseName = String(insect?.name || "").trim();
        if (!japaneseName) return;
        map.set(
          japaneseName,
          getPrimaryEnglishName({
            scientificName: insect?.scientificName,
            japaneseName,
            fallback: japaneseName,
          }),
        );
      });
      return map;
    }, [moths, butterflies, beetles, longhornbeetles, leafbeetles, aphids]);
    const heroStats = useMemo(
      () => [
        {
          label: isEnglish ? "Butterflies & moths" : "蝶・蛾",
          value: countLabel(counts.moths + counts.butterflies),
        },
        {
          label: isEnglish ? "Jewel beetles" : "タマムシ",
          value: countLabel(counts.beetles),
        },
        {
          label: isEnglish ? "Longhorn beetles" : "カミキリムシ",
          value: countLabel(counts.longhornbeetles),
        },
        {
          label: isEnglish ? "Leaf beetles" : "ハムシ",
          value: countLabel(counts.leafbeetles),
        },
        {
          label: isEnglish ? "Aphids" : "アブラムシ",
          value: countLabel(counts.aphids),
        },
        {
          label: isEnglish ? "Host plants" : "食草",
          value: countLabel(counts.hostPlants),
        },
      ],
      [countLabel, counts, isEnglish],
    );
    const featuredInsects = useMemo(
      () =>
        [
          ...moths,
          ...butterflies,
          ...beetles,
          ...longhornbeetles,
          ...leafbeetles,
          ...aphids,
        ]
          .filter(Boolean)
          .slice(0, 10),
      [moths, butterflies, beetles, longhornbeetles, leafbeetles, aphids],
    );
    const featuredPlants = useMemo(() => {
      const merged = new Map();
      Object.entries(hostPlants || {}).forEach(([name, relatedInsects]) => {
        if (!name) return;
        const count =
          plantInsectStats?.countsByPlant?.[name] ??
          (Array.isArray(relatedInsects) ? relatedInsects.length : 0);
        merged.set(name, count);
      });
      Object.entries(flowerVisitPlants || {}).forEach(([name, relatedInsects]) => {
        if (!name) return;
        const fallbackCount = Array.isArray(relatedInsects) ? relatedInsects.length : 0;
        const count = plantInsectStats?.countsByPlant?.[name] ?? fallbackCount;
        merged.set(name, Math.max(merged.get(name) || 0, count));
      });
      return Array.from(merged.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name, "ja");
        })
        .slice(0, 10);
    }, [hostPlants, flowerVisitPlants, plantInsectStats]);

    const listSeo = useMemo(() => {
      if (strippedPathname === "/moth") {
        return {
          title: isEnglish
            ? "Insect index | Insects and Host Plants of Japan"
            : "昆虫一覧（蛾・蝶・甲虫・アブラムシ）| 昆虫植物図鑑",
          description: isEnglish
            ? `Browse insects from Japan. Search ${countLabel(
                counts.moths + counts.butterflies,
              )} of butterflies and moths, ${countLabel(
                counts.beetles,
              )} of jewel beetles, ${countLabel(
                counts.longhornbeetles,
              )} of longhorn beetles, ${countLabel(
                counts.leafbeetles,
              )} of leaf beetles, and ${countLabel(
                counts.aphids,
              )} of aphids by Japanese name, scientific name, or taxonomy.`
            : `昆虫一覧ページ。蛾・蝶 ${counts.moths + counts.butterflies}種、タマムシ ${counts.beetles}種、カミキリムシ ${counts.longhornbeetles}種、ハムシ ${counts.leafbeetles}種、アブラムシ ${counts.aphids}種を和名/学名/分類で検索できます。`,
          canonical: absUrl(localizePath("/meta/moth/index.html", locale)),
          breadcrumbItems: [
            { name: isEnglish ? EN_SITE_NAME : "昆虫植物図鑑", url: absUrl(localizePath("/", locale)) },
            {
              name: isEnglish ? "Insects" : "昆虫",
              url: absUrl(localizePath("/meta/moth/index.html", locale)),
            },
          ],
        };
      }
      if (strippedPathname === "/plant") {
        return {
          title: isEnglish
            ? "Plant index | Insects and Host Plants of Japan"
            : "植物一覧（食草・訪花）| 昆虫植物図鑑",
          description: isEnglish
            ? `Browse ${countLabel(
                counts.hostPlants,
              )} of host plants and flower-visit plants recorded in Japan, then review the related insects for each plant.`
            : `植物一覧ページ。食草・訪花植物 ${counts.hostPlants}種を和名/学名/分類で検索し、関連昆虫を確認できます。`,
          canonical: absUrl(localizePath("/meta/plant/index.html", locale)),
          breadcrumbItems: [
            { name: isEnglish ? EN_SITE_NAME : "昆虫植物図鑑", url: absUrl(localizePath("/", locale)) },
            {
              name: isEnglish ? "Plants" : "植物",
              url: absUrl(localizePath("/meta/plant/index.html", locale)),
            },
          ],
        };
      }
      return {
        title: isEnglish
          ? "Insects and Host Plants of Japan"
          : "昆虫植物図鑑｜9700種超の昆虫と食草を検索",
        description: isEnglish
          ? `Explore insects and host plants recorded in Japan. Includes ${countLabel(
              counts.moths + counts.butterflies,
            )} of butterflies and moths, ${countLabel(
              counts.beetles,
            )} of jewel beetles, ${countLabel(
              counts.longhornbeetles,
            )} of longhorn beetles, ${countLabel(
              counts.leafbeetles,
            )} of leaf beetles, ${countLabel(
              counts.aphids,
            )} of aphids, and ${countLabel(
              counts.hostPlants,
            )} of plants.`
          : `蛾・蝶 ${counts.moths + counts.butterflies}種、タマムシ ${counts.beetles}種、カミキリムシ ${counts.longhornbeetles}種、ハムシ ${counts.leafbeetles}種、アブラムシ ${counts.aphids}種、食草 ${counts.hostPlants}種を掲載。和名・学名・植物名から検索できる昆虫食草データベース。`,
        canonical: absUrl(localizePath("/", locale)),
        breadcrumbItems: [
          { name: isEnglish ? EN_SITE_NAME : "昆虫植物図鑑", url: absUrl(localizePath("/", locale)) },
        ],
      };
    }, [countLabel, counts, isEnglish, locale, strippedPathname]);

    const { setOgTwitterImage } = useSeoMeta({
      title: listSeo.title,
      description: listSeo.description,
      ogType: "website",
      url: listSeo.canonical,
      locale: isEnglish ? "en_US" : "ja_JP",
      htmlLang: locale,
      siteName: isEnglish ? EN_SITE_NAME : "昆虫植物図鑑",
      alternates: [
        { hreflang: "ja", href: absUrl(localizePath(strippedPathname, "ja")) },
        { hreflang: "en", href: absUrl(localizePath(strippedPathname, "en")) },
        { hreflang: "x-default", href: absUrl(localizePath(strippedPathname, "en")) },
      ],
      breadcrumbItems: listSeo.breadcrumbItems,
      resetCanonicalTo: absUrl("/"),
    });

    useEffect(() => {
      if (typeof window === "undefined") return undefined;

      const handleShortcut = (event) => {
        if (event.defaultPrevented || event.isComposing) return;
        const key = String(event.key || "");
        const isSlashShortcut =
          key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
        const isCommandShortcut =
          !event.altKey &&
          (event.metaKey || event.ctrlKey) &&
          key.toLowerCase() === "k";
        if (!isSlashShortcut && !isCommandShortcut) return;
        if (isEditableElement(event.target)) return;

        const targetInput = isStickyHeaderVisible
          ? stickySearchInputRef.current || heroSearchInputRef.current
          : heroSearchInputRef.current || stickySearchInputRef.current;
        if (!targetInput) return;

        event.preventDefault();
        targetInput.focus();
        if (typeof targetInput.select === "function") {
          targetInput.select();
        }
      };

      window.addEventListener("keydown", handleShortcut);
      return () => window.removeEventListener("keydown", handleShortcut);
    }, [isStickyHeaderVisible]);

    // ヒーローからインライン写真は撤去したが、OG/Twitter の共有画像には署名の蛾写真を維持する
    useEffect(() => {
      try {
        setOgTwitterImage(
          "images/resized/insects/Cucullia_argentea.1024.jpg",
          isEnglish
            ? "Hero image for Insects and Host Plants of Japan"
            : "昆虫植物図鑑 メインビジュアル",
        );
      } catch {}
    }, [isEnglish, setOgTwitterImage]);

    const instagramSectionRef = useRef(null);
    const [instagramInView, setInstagramInView] = useState(false);
    const instagramRefreshInFlightRef = useRef(false);

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
      if (!instagramInView) return;
      if (typeof window === "undefined") return;

      let active = true;
      const base = import.meta.env.BASE_URL || "/";
      const cacheMode = "no-store";
      const fallbackInstagramUrl = import.meta.env.VITE_INSTAGRAM_URL || "";
      const rawInterval = Number(import.meta.env.VITE_INSTAGRAM_REFRESH_INTERVAL_MS);
      const refreshIntervalMs =
        Number.isFinite(rawInterval) && rawInterval >= MIN_INSTAGRAM_REFRESH_INTERVAL_MS
          ? rawInterval
          : DEFAULT_INSTAGRAM_REFRESH_INTERVAL_MS;

      const loadInstagramResources = async () => {
        if (instagramRefreshInFlightRef.current) return;
        instagramRefreshInFlightRef.current = true;
        try {
          const cacheBust = Date.now();
          const withCacheBust = (path) => `${base}${path}?t=${cacheBust}`;

          // Latest profile/post
          try {
            const res = await fetch(withCacheBust("instagram_latest.txt"), {
              cache: cacheMode,
            });
            if (res.ok) {
              const text = (await res.text()).trim();
              if (!active) return;
              if (/^https?:\/\/(www\.)?instagram\.com\//.test(text)) {
                setInstagramUrl(text);
              } else if (fallbackInstagramUrl) {
                setInstagramUrl(fallbackInstagramUrl);
              }
            }
          } catch {
            if (active && fallbackInstagramUrl) {
              setInstagramUrl(fallbackInstagramUrl);
            }
          }

          // Timeline posts (JSON preferred)
          try {
            const res = await fetch(withCacheBust("instagram_posts.json"), {
              cache: cacheMode,
            });
            if (res.ok) {
              const data = await res.json();
              if (!active) return;
              const posts = Array.isArray(data) ? data : data?.posts;
              if (Array.isArray(posts) && posts.length > 0) {
                const normalized = posts
                  .map(normalizeInstagramPostCard)
                  .filter(Boolean);
                if (normalized.length > 0) {
                  const sorted = sortInstagramPostsByLatest(normalized);
                  setInstagramPostCards(sorted.slice(0, 12));
                }
              }
            }
          } catch {
            // ignore
          }

          // Timeline posts (URL list fallback)
          try {
            const res = await fetch(withCacheBust("instagram_posts.txt"), {
              cache: cacheMode,
            });
            if (res.ok) {
              const text = await res.text();
              if (!active) return;
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
            const res = await fetch(withCacheBust("instagram_widget.html"), {
              cache: cacheMode,
            });
            if (res.ok) {
              const html = (await res.text()).trim();
              if (active && html) {
                setInstagramWidgetHtml(html);
              }
            }
          } catch {
            // ignore
          }
        } finally {
          instagramRefreshInFlightRef.current = false;
        }
      };

      const handleResumeFetch = () => {
        if (document.visibilityState === "visible") {
          loadInstagramResources();
        }
      };

      loadInstagramResources();
      const intervalId = window.setInterval(() => {
        // 非表示タブでは通信しない（復帰時に visibilitychange で再取得される）
        if (document.visibilityState !== "visible") return;
        loadInstagramResources();
      }, refreshIntervalMs);
      window.addEventListener("focus", handleResumeFetch);
      document.addEventListener("visibilitychange", handleResumeFetch);

      return () => {
        active = false;
        window.clearInterval(intervalId);
        window.removeEventListener("focus", handleResumeFetch);
        document.removeEventListener("visibilitychange", handleResumeFetch);
        instagramRefreshInFlightRef.current = false;
      };
    }, [instagramInView]);

    const instagramTimelinePosts = useMemo(() => {
      if (!Array.isArray(instagramPostCards)) return [];
      return sortInstagramPostsByLatest(instagramPostCards).filter((post) => {
        if (!isInstagramPostUrl(post?.permalink)) return false;
        return Boolean(
          post?.local_url ||
            post?.localUrl ||
            post?.media_url ||
            post?.mediaUrl ||
            post?.thumbnail_url ||
            post?.thumbnailUrl,
        );
      });
    }, [instagramPostCards, isInstagramPostUrl]);

    useEffect(() => {
      setInstagramGalleryFailed(false);
    }, [instagramTimelinePosts]);

    const instagramEmbedUrls = useMemo(() => {
      const fromCards = Array.isArray(instagramTimelinePosts)
        ? instagramTimelinePosts
            .map((post) => post?.permalink)
            .filter((url) => isInstagramPostUrl(url))
        : [];
      const fromList = Array.isArray(instagramPosts)
        ? instagramPosts.filter((url) => isInstagramPostUrl(url))
        : [];
      const base = fromCards.length > 0 ? fromCards : fromList;
      return Array.from(new Set(base)).slice(0, 4);
    }, [instagramTimelinePosts, instagramPosts, isInstagramPostUrl]);

    // 全昆虫の結合配列。inline spreadだと毎レンダーで参照が変わり、
    // MothList側のフィルタ再計算やサジェスト計算が毎打鍵で走ってしまう。
    // さらにモジュールレベルのキャッシュを併用し、詳細ページから戻った
    // 再マウントでも同一データなら同一参照を返す（画像解決キャッシュが効く）
    const allInsects = useMemo(
      () =>
        combineInsectsStable([
          moths,
          butterflies,
          beetles,
          longhornbeetles,
          leafbeetles,
          aphids,
        ]),
      [moths, butterflies, beetles, longhornbeetles, leafbeetles, aphids],
    );

    const baseToPlantFiles = useMemo(() => {
      const map = new Map();
      const plantImageIndex = Array.isArray(plantImageFilenames)
        ? plantImageFilenames
        : [];
      plantImageIndex.forEach((filename) => {
        const base = splitFilenameBase(filename);
        if (!map.has(base)) {
          map.set(base, []);
        }
        map.get(base).push(filename);
      });
      return map;
    }, [plantImageFilenames]);

    const suggestions = useMemo(() => {
      if (!debouncedSuggestionTerm || debouncedSuggestionTerm.trim() === "") return [];
      const term = debouncedSuggestionTerm.toLowerCase();
      const katakanaTerm = hiraganaToKatakana(debouncedSuggestionTerm).toLowerCase();
      const suggestionsByKey = new Map();
      let sequence = 0;

      // ベースURL計算
      const normalizedBase = getAssetBase();

      const getMatchScore = (value) => {
        if (!value) return 0;
        const lower = String(value).toLowerCase();
        if (!lower) return 0;
        if (lower === term || lower === katakanaTerm) return 500;
        if (lower.startsWith(term) || lower.startsWith(katakanaTerm)) return 350;
        if (lower.includes(term) || lower.includes(katakanaTerm)) return 200;
        return 0;
      };

      const registerSuggestion = (item, dedupeKey = item?.name, score = 0) => {
        const key = String(dedupeKey || "").trim();
        if (!key || score <= 0) return false;
        const existing = suggestionsByKey.get(key);
        if (!existing || score > existing.score) {
          suggestionsByKey.set(key, {
            item,
            score,
            order: sequence++,
          });
        }
        return true;
      };

      // 昆虫タイプを判定するヘルパー
      const getInsectType = (insect) => {
        if (
          insect?.type === 'moth' ||
          insect?.type === 'butterfly' ||
          insect?.type === 'beetle' ||
          insect?.type === 'longhornbeetle' ||
          insect?.type === 'leafbeetle' ||
          insect?.type === 'aphid'
        ) {
          return insect.type;
        }
        if (butterflies.includes(insect)) return 'butterfly';
        if (beetles.includes(insect)) return 'beetle';
        if (longhornbeetles.includes(insect)) return 'longhornbeetle';
        if (leafbeetles.includes(insect)) return 'leafbeetle';
        if (aphids.includes(insect)) return 'aphid';
        return 'moth';
      };

      // 昆虫画像URLを生成するヘルパー
      const getInsectImageUrl = (insect) => {
        const mappedFilename = globalJapaneseToScientificMapping.get(insect?.name);
        const [filename] = resolveImageBaseCandidates(
          buildInsectImageBaseCandidates(insect, mappedFilename),
          {
            imageExtensions: insectImageExtensions,
            imageNames: insectImageFilenames,
            normalizedEntries: normalizedInsectImageEntries,
            includeUnresolved: false,
          },
        );
        if (!filename) return null;
        return buildResizedImageUrl({
          baseUrl: normalizedBase,
          folder: 'insects',
          filename,
          width: 320,
        });
      };

      if (activeTab === "insects") {
        for (const insect of allInsects) {
          const alternativeNames = String(insect.alternativeNames || '')
            .split(/[、,，]/)
            .map((name) => name.trim())
            .filter(Boolean);
          const insectScore = Math.max(
            getMatchScore(insect.name),
            getMatchScore(insect.scientificName),
            ...alternativeNames.map((name) => getMatchScore(name)),
          );

          // 画像URL解決・パス生成はマッチした候補に対してのみ行う
          // （全件で先に実行すると1打鍵ごとに全昆虫の画像照合が走る）
          let insectType = null;
          if (insectScore > 0) {
            insectType = getInsectType(insect);
            const insectPrimaryName = isEnglish
              ? getPrimaryEnglishName({
                  scientificName: insect.scientificName,
                  japaneseName: insect.name,
                  fallback: insect.name,
                })
              : insect.name;
            const insectSecondaryName = isEnglish
              ? buildJapaneseReferenceLabel(insect.name)
              : insect.scientificName;
            const insectSuggestion = {
              name: insectPrimaryName,
              value:
                isEnglish && insect.scientificName
                  ? insect.scientificName
                  : insect.name,
              type: insectType,
              subText: insectSecondaryName,
              nameIsScientific: isEnglish && Boolean(insect.scientificName),
              subTextIsScientific: !isEnglish && Boolean(insect.scientificName),
              image: getInsectImageUrl(insect),
              detailPath: buildInsectPath(insect, locale),
            };
            registerSuggestion(insectSuggestion, `insect:${insect.name}`, insectScore);
          }

          const classificationSuggestions = isEnglish
            ? [
                { value: insect.classification?.family, label: 'Search family' },
                { value: insect.classification?.subfamily, label: 'Search subfamily' },
                { value: insect.classification?.tribe, label: 'Search tribe' },
                { value: insect.classification?.genus, label: 'Search genus', nameIsScientific: true },
                { value: insect.classification?.familyJapanese, label: 'Search family (Japanese)' },
                { value: insect.classification?.subfamilyJapanese, label: 'Search subfamily (Japanese)' },
                { value: insect.classification?.tribeJapanese, label: 'Search tribe (Japanese)' },
              ]
            : [
                { value: insect.classification?.familyJapanese, label: '科で検索' },
                { value: insect.classification?.subfamilyJapanese, label: '亜科で検索' },
                { value: insect.classification?.tribeJapanese, label: '族で検索' },
                { value: insect.classification?.genus, label: '属で検索', nameIsScientific: true },
                { value: insect.classification?.family, label: '科名(学名)で検索' },
                { value: insect.classification?.subfamily, label: '亜科名(学名)で検索' },
                { value: insect.classification?.tribe, label: '族名(学名)で検索' },
              ];
          for (const candidate of classificationSuggestions) {
            const candidateScore = getMatchScore(candidate.value);
            if (candidateScore <= 0) continue;
            if (insectType === null) insectType = getInsectType(insect);
            registerSuggestion(
              {
                name: candidate.value,
                value: candidate.value,
                type: insectType,
                subText: candidate.label,
                nameIsScientific: Boolean(candidate.nameIsScientific),
              },
              `${insectType}:${candidate.value}`,
              candidateScore,
            );
          }
        }
      } else {
        // plants
        const plantNameSet = new Set(Object.keys(hostPlants));
        Object.keys(flowerVisitPlants || {}).forEach((name) => {
          if (name) plantNameSet.add(name);
        });
        Object.entries(plantDetails || {}).forEach(([name, detail]) => {
          if (name && detail?.profile) plantNameSet.add(name);
        });
        const plantNames = Array.from(plantNameSet);

        // 植物画像URLを生成するヘルパー
        const getPlantImageUrl = (plantName) => {
          if (!plantName || baseToPlantFiles.size === 0) return null;
          const detail = plantDetails?.[plantName] || {};
          const aliasesRaw = detail.aliases || detail.aliasNames;
          const aliases = Array.isArray(aliasesRaw)
            ? aliasesRaw
            : aliasesRaw instanceof Set
              ? Array.from(aliasesRaw)
              : [];
          const baseName = plantName.replace(/[（(].*[）)]/g, '').trim();
          const scientificBase = createSafeScientificPlantFilename(detail.scientificName || '');
          const candidates = new Set([
            plantName,
            baseName,
            createSafePlantFilename(plantName),
            createSafePlantFilename(baseName),
            scientificBase,
            ...aliases.flatMap((name) => {
              const trimmed = (name || '').trim();
              const base = trimmed.split(" ")[0];
              const cleaned = createSafePlantFilename(trimmed);
              const cleanedBase = createSafePlantFilename(base);
              return [trimmed, base, cleaned, cleanedBase];
            }),
          ].filter(Boolean));
          let matches = [];
          for (const candidate of candidates) {
            if (baseToPlantFiles.has(candidate)) {
              matches.push(...baseToPlantFiles.get(candidate));
            }
          }
          if (matches.length === 0) return null;
          matches.sort(comparePlantImageDisplayPriority);
          const filename = matches[0];
          return `${normalizedBase}images/resized/plants/${encodeURIComponent(filename)}.1024.jpg`;
        };

        for (const plant of plantNames) {
          const detail = plantDetails?.[plant] || {};
          const aliasesRaw = detail.aliases || detail.aliasNames;
          const aliases = Array.isArray(aliasesRaw)
            ? aliasesRaw
            : aliasesRaw instanceof Set
              ? Array.from(aliasesRaw)
              : [];
          const plantScore = Math.max(
            getMatchScore(plant),
            getMatchScore(detail.scientificName),
            ...aliases.map((alias) => getMatchScore(alias)),
          );

          // 画像URL解決・パス生成はマッチした候補に対してのみ行う
          if (plantScore > 0) {
            const plantPrimaryName = isEnglish
              ? getPrimaryEnglishName({
                  scientificName: detail.scientificName,
                  japaneseName: plant,
                  fallback: plant,
                })
              : plant;
            const canonicalSuggestion = {
              name: plantPrimaryName,
              value:
                isEnglish && detail.scientificName
                  ? detail.scientificName
                  : plant,
              type: 'plant',
              subText: isEnglish
                ? buildJapaneseReferenceLabel(plant)
                : detail.scientificName || detail.family || detail.familyName,
              nameIsScientific: isEnglish && Boolean(detail.scientificName),
              subTextIsScientific: !isEnglish && Boolean(detail.scientificName),
              image: getPlantImageUrl(plant),
              detailPath: buildPlantPath(plant, locale),
            };
            registerSuggestion(canonicalSuggestion, `plant:${plant}`, plantScore);
          }

          const candidates = (
            isEnglish
              ? [
                  { value: detail.familyLatin, label: 'Search family' },
                  { value: detail.orderLatin, label: 'Search order' },
                  { value: detail.genus, label: 'Search genus', nameIsScientific: true },
                  { value: detail.family, label: 'Search family (Japanese)' },
                  { value: detail.familyName, label: 'Search family (Japanese)' },
                  { value: detail.order, label: 'Search order (Japanese)' },
                ]
              : [
                  { value: detail.family, label: '科で検索' },
                  { value: detail.familyName, label: '科で検索' },
                  { value: detail.familyLatin, label: '科名(学名)で検索' },
                  { value: detail.order, label: '目で検索' },
                  { value: detail.orderLatin, label: '目名(学名)で検索' },
                  { value: detail.genus, label: '属で検索', nameIsScientific: true },
                ]
          ).filter(c => c.value);
          for (const candidate of candidates) {
            const candidateScore = getMatchScore(candidate.value);
            if (candidateScore > 0) {
              registerSuggestion({
                name: candidate.value,
                value: candidate.value,
                type: 'plant',
                subText: candidate.label,
                nameIsScientific: Boolean(candidate.nameIsScientific),
              }, `plant:${candidate.value}`, candidateScore);
            }
          }
        }
      }
      return Array.from(suggestionsByKey.values())
        .sort((a, b) =>
          b.score - a.score ||
          a.order - b.order ||
          String(a.item?.name || '').localeCompare(String(b.item?.name || ''), isEnglish ? 'en' : 'ja')
        )
        .slice(0, 10)
        .map((entry) => entry.item);
    }, [
      debouncedSuggestionTerm,
      activeTab,
      allInsects,
      butterflies,
      beetles,
      longhornbeetles,
      leafbeetles,
      aphids,
      hostPlants,
      flowerVisitPlants,
      plantDetails,
      baseToPlantFiles,
      insectImageExtensions,
      insectImageFilenames,
      normalizedInsectImageEntries,
      isEnglish,
      locale,
    ]);

    const handleSelectSuggestion = (selection) => {
      // 特定の種・植物の候補（detailPath あり）は詳細ページへ直接遷移。
      // 「科で検索」などの集合候補は従来どおり検索を確定して一覧を絞り込む。
      if (selection && typeof selection === "object" && selection.detailPath) {
        // 遷移後に検索デバウンスが発火して一覧へ引き戻さないよう先にクリアする
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        navigate(selection.detailPath);
        return;
      }
      const value =
        selection && typeof selection === "object"
          ? selection.value || selection.name || ""
          : selection;
      commitSearchValue(value);
    };

    // ARIA Tabsパターン: 矢印キーでタブを移動し、フォーカスも追従させる
    const handleTabListKeyDown = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const nextTab = activeTab === 'insects' ? 'plants' : 'insects';
      setActiveTabWithUrl(nextTab);
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          document.getElementById(nextTab === 'insects' ? 'tab-insects' : 'tab-plants')?.focus();
        });
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <StickyHeader 
          activeTab={activeTab} 
          setActiveTab={setActiveTabWithUrl} 
          searchTerm={activeSearchTerm} 
          onSearchChange={handleGlobalSearch}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
          onSubmitSearch={commitSearchValue}
          onNeedInsectsData={onNeedInsectsData}
          onNeedPlantsData={onNeedPlantsData}
          theme={theme}
          setTheme={setTheme}
          inputRef={stickySearchInputRef}
          locale={locale}
          onVisibilityChange={setIsStickyHeaderVisible}
        />
        {/* 構造化データ */}
        <ExplorerStructuredData
          pathname={location.pathname}
          pageTitle={listSeo.title}
          pageDescription={listSeo.description}
          counts={counts}
          featuredInsects={featuredInsects}
          featuredPlants={featuredPlants}
        />
        <div className="max-w-6xl mx-auto space-y-2 p-2 sm:space-y-6 sm:p-4 md:p-8">
          <ExplorerHero
            activeSearchTerm={activeSearchTerm}
            activeTab={activeTab}
            commitSearchValue={commitSearchValue}
            handleGlobalSearch={handleGlobalSearch}
            handleSelectSuggestion={handleSelectSuggestion}
            heroSearchInputRef={heroSearchInputRef}
            heroStats={heroStats}
            isEnglish={isEnglish}
            isStickyHeaderVisible={isStickyHeaderVisible}
            locale={locale}
            setTheme={setTheme}
            showHeaderControls={false}
            suggestions={suggestions}
            theme={theme}
            ui={ui}
          />

          {shouldShowDiscoveryLinks(location.pathname, activeSearchTerm, location.search) && (
            <DiscoveryLinks locale={locale} />
          )}

          {/* タブナビゲーション */}
          <div id="explorer-results" className="scroll-mt-24 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-200/30 dark:border-emerald-700/30 overflow-hidden sm:rounded-3xl">
            {/* タブヘッダー */}
            <div className="flex border-b border-slate-200/70 dark:border-slate-700/70" role="tablist" aria-label={isEnglish ? "Switch between insects and plants" : "昆虫/植物の切り替え"} onKeyDown={handleTabListKeyDown}>
              <button
                id="tab-insects"
                role="tab"
                aria-selected={activeTab === "insects"}
                aria-controls="panel-insects"
                tabIndex={activeTab === "insects" ? 0 : -1}
                type="button"
                onClick={() => {
                  setActiveTabWithUrl("insects");
                }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium tracking-tight transition-colors relative sm:px-6 sm:py-4 sm:text-base ${
                  activeTab === "insects"
                    ? "text-emerald-600 dark:text-emerald-300 bg-white/70 dark:bg-slate-900/40"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-300 hover:bg-white/40 dark:hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {/* Beautiful butterfly icon */}
                  <svg
                    className="h-[18px] w-[18px] sm:h-6 sm:w-6"
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
                    <span>{ui.insectsTab}</span>
                    <span className="text-xs sm:text-sm">
                      {/* summaryCounts フォールバック込みの counts を使い、データ未着でも
                          「(0)」にならずヒーローの種数と一致させる */}
                      (
                      {counts.moths +
                        counts.butterflies +
                        counts.beetles +
                        counts.longhornbeetles +
                        counts.leafbeetles +
                        counts.aphids}
                      )
                    </span>
                  </span>
                </div>
                {activeTab === "insects" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50"></div>
                )}
              </button>

              <button
                id="tab-plants"
                role="tab"
                aria-selected={activeTab === "plants"}
                aria-controls="panel-plants"
                tabIndex={activeTab === "plants" ? 0 : -1}
                type="button"
                onClick={() => setActiveTabWithUrl("plants")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium tracking-tight transition-colors relative sm:px-6 sm:py-4 sm:text-base ${
                  activeTab === "plants"
                    ? "text-blue-600 dark:text-blue-300 bg-white/70 dark:bg-slate-900/40"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-300 hover:bg-white/40 dark:hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {/* Beautiful leaf icon */}
                  <svg
                    className="h-[18px] w-[18px] sm:h-6 sm:w-6"
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
                    <span>{ui.plantsTab}</span>
                    <span className="text-xs sm:text-sm">({mergedHostPlantCount})</span>
                  </span>
                </div>
                {activeTab === "plants" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>
                )}
              </button>
            </div>

            {/* 逆引き動線: 検索語があるとき、反対カテゴリの概算一致件数つきリンクを1本だけ出す。
                説明文（「○○を表示中」）は冗長なので撤去し、行動リンクに集約。 */}
            {activeSearchTerm.trim() && (
              <div className="flex justify-center border-b border-line bg-surface-raised px-4 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={crossSearchOtherTab}
                  className="inline-flex items-center gap-1 font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 transition-colors hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  {crossLinkLabel}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            {/* タブコンテンツ */}
            <div className="relative">
              <div
                id="panel-insects"
                role="tabpanel"
                aria-labelledby="tab-insects"
                aria-hidden={activeTab !== "insects"}
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
                          {ui.loadingInsects}
                        </div>
                      }
                    >
                      <MothList
                        moths={allInsects}
                        title={ui.insectsTab}
                        baseRoute=""
                        embedded={true}
                        initialSearchTerm={activeSearchTerm}
                        plantDetails={plantDetails}
                        locale={locale}
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
                          {ui.loadingPlants}
                        </div>
                      }
                    >
                      <HostPlantList
                        hostPlants={hostPlants}
                        flowerVisitPlants={flowerVisitPlants}
                        plantDetails={plantDetails}
                        insectDisplayNameMap={insectDisplayNameMap}
                        embedded={true}
                        preloadedImageFilenames={plantImageFilenames}
                        initialSearchTerm={activeSearchTerm}
                        plantInsectStats={plantInsectStats}
                        locale={locale}
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
                    {infoUi.sectionTitle}
                  </h2>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
                {/* 左側：サイトポリシーと出典一覧 (wider on desktop) */}
                <div className="lg:col-span-3 space-y-8">
                  {/* サイトポリシー */}
                  <section>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="bg-slate-200 dark:bg-slate-700 w-1 h-6 mr-3 rounded-full"></span>
                      {infoUi.policyTitle}
                    </h3>
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {infoUi.policySummary}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAboutDetails((v) => !v)}
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                        aria-expanded={showAboutDetails}
                      >
                        <span>{infoUi.policyToggle(showAboutDetails)}</span>
                        <span className={`transition-transform duration-200 ${showAboutDetails ? "rotate-180" : ""}`}>⌄</span>
                      </button>
                    </div>
                    {showAboutDetails && (
                      <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {infoUi.introTitle}
                          </p>
                          <p>
                            {infoUi.introBody}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {infoUi.disclaimerTitle}
                          </p>
                          <p>
                            {infoUi.disclaimerBody}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {infoUi.photosTitle}
                          </p>
                          <p>
                            {infoUi.photosBodyBeforeLink}{' '}
                            <a
                              href="https://docs.google.com/forms/d/e/1FAIpQLSfNf5n59JWmiYpH6ImyAQsIy00PK_fMk_lHVP5nbxzfwuoA4w/viewform?usp=header"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-500 transition-colors ml-1"
                            >
                              {infoUi.formLinkLabel}
                            </a>
                            {infoUi.photosBodyAfterLink}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {infoUi.contactTitle}
                          </p>
                          <p>
                            {infoUi.contactBodyBeforeLink}{' '}
                            <a
                              href="https://docs.google.com/forms/d/e/1FAIpQLSfNf5n59JWmiYpH6ImyAQsIy00PK_fMk_lHVP5nbxzfwuoA4w/viewform?usp=header"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-500 transition-colors ml-1"
                            >
                              {infoUi.formLinkLabel}
                            </a>
                            {infoUi.contactBodyAfterLink}
                          </p>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* 出典一覧 */}
                  <section>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="bg-slate-200 dark:bg-slate-700 w-1 h-6 mr-3 rounded-full"></span>
                      {infoUi.referencesTitle}
                    </h3>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowBibliography((v) => !v)}
                        aria-expanded={showBibliography}
                        aria-controls="bibliography-list"
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span>{infoUi.bibliographyToggle(showBibliography)}</span>
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
                              const bibliography = Array.from(
                                rawBibliography.reduce((map, entry) => {
                                  const title = (entry?.title || "").trim();
                                  const canonicalTitle = normalizeReference(title) || title;
                                  if (!canonicalTitle) return map;
                                  if (!map.has(canonicalTitle)) {
                                    map.set(canonicalTitle, entry);
                                  }
                                  return map;
                                }, new Map()).values(),
                              ).sort((a, b) =>
                                authorKey(a).localeCompare(
                                  authorKey(b),
                                  "en",
                                  { sensitivity: "base" },
                                ),
                              );
                              return bibliography.map((b) => {
                                const href =
                                  b.url || getSourceLink(normalizeReference(b.title)) || undefined;
                                const authorStr =
                                  joinBibliographyNames(b.authors) ||
                                  (b.editors
                                    ? isEnglish
                                      ? `${joinBibliographyNames(b.editors)} (ed.)`
                                      : `${joinBibliographyNames(b.editors)}（編）`
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
                                      {isEnglish ? (
                                        renderEnglishBibliographyEntry(b, href)
                                      ) : isArticle ? (
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
                              {infoUi.otherTitle}
                            </p>
                            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                              <li className="flex items-start">
                                <span className="text-slate-400 mr-2">
                                  •
                                </span>
                                <span>{infoUi.otherItem}</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* 右側：Instagram (give it more room on desktop) */}
                <div className="lg:col-span-2">
                  <div className="space-y-6 lg:sticky lg:top-24">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-700/50 dark:to-slate-700/30 rounded-xl p-5 border border-purple-100 dark:border-slate-600">
                      {/* Instagram最新投稿 */}
                      <div className="flex flex-col">
                        <div className="mb-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center space-x-3">
                              <div className="p-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg flex-shrink-0 shadow-sm">
                                <InstagramIcon
                                  className="w-4 h-4 text-white"
                                  alt={infoUi.instagramIconAlt}
                                />
                              </div>
                              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                Official Instagram
                              </h3>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                            {infoUi.instagramTagline}
                          </p>
                          {!isDesktopLayout && (
                            <button
                              type="button"
                              onClick={() => setIsInstagramExpanded((v) => !v)}
                              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                              aria-expanded={isInstagramExpanded}
                            >
                              <span>{infoUi.instagramToggle(isInstagramExpanded)}</span>
                              <span className={`transition-transform duration-200 ${isInstagramExpanded ? "rotate-180" : ""}`}>⌄</span>
                            </button>
                          )}
                        </div>

                        {(isDesktopLayout || isInstagramExpanded) ? (
                          <>
                            {/* Instagram埋め込み */}
                            <div className="overflow-hidden rounded-lg shadow-sm">
                              <div className="instagram-wrapper w-full bg-white dark:bg-slate-800 max-h-[55vh] lg:max-h-[60vh] overflow-y-auto overscroll-contain scrollbar-thin">
                                {(() => {
                                  // 1) timeline from JSON (custom gallery)
                                  if (
                                    instagramTimelinePosts &&
                                    instagramTimelinePosts.length > 0 &&
                                    !instagramGalleryFailed
                                  ) {
                                    return (
                                      <InstagramGallery
                                        posts={instagramTimelinePosts}
                                        className="p-3 lg:grid-cols-3"
                                        onAllFailed={() => setInstagramGalleryFailed(true)}
                                      />
                                    );
                                  }
                                  // 2) Embed timeline (when image gallery is unavailable)
                                  if (instagramEmbedUrls && instagramEmbedUrls.length > 0) {
                                    return (
                                      <InstagramTimeline
                                        urls={instagramEmbedUrls}
                                        className="p-3"
                                      />
                                    );
                                  }
                                  // 3) third-party widget
                                  if (instagramWidgetSrcDoc) {
                                    return (
                                      <iframe
                                        title="Instagram widget"
                                        className="bg-white dark:bg-slate-800 w-full min-h-[360px] h-[60vh] border-0"
                                        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        loading="lazy"
                                        srcDoc={instagramWidgetSrcDoc}
                                      />
                                    );
                                  }
                                  // 4) single URL fallback
                                  if (instagramUrl) {
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
                                  // 5) nothing configured
                                  return (
                                    <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 py-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                      {infoUi.instagramUnavailable}
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
                                  <span>{infoUi.instagramProfile}</span>
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-lg border border-slate-200/80 dark:border-slate-600 bg-white/80 dark:bg-slate-800/70 p-3 text-xs text-slate-500 dark:text-slate-400">
                            {infoUi.instagramCollapsedHint}
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
