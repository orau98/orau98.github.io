import React, { useState, useMemo, useEffect, useRef, useCallback, useId } from 'react';
import { useNavigationType } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import useInsectImageMap from '../hooks/useInsectImageMap';
import useInsectListParams from '../hooks/useInsectListParams';
import MothListItem from './MothListItem';
import { buildPlantDisplayData } from '../utils/insectCardData';
import Pagination from './Pagination';
import ListFilterPanel from './ListFilterPanel';
import logger from '../utils/logger';
import { extractEmergenceTime, normalizeEmergenceTime, getEmergenceMonths } from '../utils/emergenceTimeUtils';
import { hiraganaToKatakana, normalizeNFKC } from '../utils/text';
import SearchableSelect from './SearchableSelect';
import { ListDisplayControls, PresetFilterChips } from './ListToolbar';
import ManualAdSlot from './ManualAdSlot';
import useSeoMeta from '../hooks/useSeoMeta';
import {
  EN_SITE_NAME,
  getPrimaryEnglishName,
  getLocalizedTaxonomyLabel,
} from '../utils/englishNaming';
import { buildInsectPath } from '../utils/insectSlug';
import { INSECT_SECTION_CONFIGS } from '../utils/siteTaxonomy';
import { isEnglishLocale, localizePath } from '../utils/locale';

// 食草欄でプレースホルダー扱いにする文字列
const HOST_PLACEHOLDERS = ['不明', '未知', '不詳', '未確認', '未記載', 'なし', '未登録', '不詳種', '不明種'];
const PER_PAGE_OPTIONS = [20, 50, 100];

const MothList = ({ moths, title = "蛾", baseRoute = "/moth", embedded = false, initialSearchTerm = "", plantDetails = {}, locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const ui = useMemo(
    () => ({
      filterTitle: isEnglish ? 'Advanced filters' : '詳細フィルタ',
      filteredBy: isEnglish ? 'Filtered by:' : '絞り込み:',
      resetAll: isEnglish ? 'Reset all' : 'すべてリセット',
      hostPlantFilter: isEnglish ? 'Host plant record' : '食草の有無',
      all: isEnglish ? 'All' : 'すべて',
      hasHostPlant: isEnglish ? 'Has host plant' : '食草あり',
      unregisteredOnly: isEnglish ? 'No host plant data' : '食草情報なし',
      any: isEnglish ? 'Any' : '指定なし',
      family: isEnglish ? 'Family' : '科',
      genus: isEnglish ? 'Genus' : '属',
      emergence: isEnglish ? 'Adult season' : '出現期',
      season: isEnglish ? 'Season' : '季節',
      photo: isEnglish ? 'Photo' : '写真',
      withPhoto: isEnglish ? 'With photos' : '写真あり',
      presetLabel: isEnglish ? 'Quick filters:' : 'クイック絞り込み:',
      groupLabel: isEnglish ? 'Insect group:' : '昆虫グループ:',
      group: isEnglish ? 'Group' : 'グループ',
      spring: isEnglish ? 'Spring' : '春',
      summer: isEnglish ? 'Summer' : '夏',
      autumn: isEnglish ? 'Autumn' : '秋',
      winter: isEnglish ? 'Winter' : '冬',
      view: isEnglish ? 'View' : '表示',
      cards: isEnglish ? 'Cards' : 'カード',
      compact: isEnglish ? 'Compact' : 'コンパクト',
      perPage: isEnglish ? 'Per page' : '表示件数',
      autoPerPage: (value) => (isEnglish ? `Auto (${value})` : `自動 (${value})`),
      sort: isEnglish ? 'Sort' : '並び替え',
      sortImage: isEnglish ? 'Photos first' : '写真あり優先',
      sortName: isEnglish ? 'Name' : '名前順',
      sortFamily: isEnglish ? 'Family' : '科順',
      sortPlantCount: isEnglish ? 'Plant links' : '植物数順',
      sortSeason: isEnglish ? 'Adult season' : '出現期順',
      resultCount: (value) =>
        isEnglish ? `${value} results` : `${value} 件が見つかりました`,
      listTitle: isEnglish ? `${title} list` : `${title}のリスト`,
      renderError: (name) =>
        isEnglish ? `Render error: ${name}` : `表示エラー: ${name}`,
      emptyTitle: isEnglish ? `No matching ${title.toLowerCase()} found` : `該当する${title}が見つかりません`,
      activeFilters: isEnglish ? 'Current filters:' : '現在の条件:',
      tryAnother: isEnglish ? 'Try another keyword.' : '別のキーワードで検索してみてください',
      searchOnlyClear: isEnglish ? 'Clear search only' : '検索のみクリア',
      clearSearch: isEnglish ? 'Clear search' : '検索をクリア',
      clearFilters: isEnglish ? 'Clear filters' : 'フィルター解除',
      examples: isEnglish
        ? 'Examples: scientific name, family, host plant, or Japanese name'
        : '例：「オオミズアオ」「ヤナギ」「ヤガ科」など',
      exampleSearches: isEnglish
        ? ['Quercus', 'Prunus', 'Noctuidae', 'Papilionidae']
        : ['オオミズアオ', 'ヤナギ', 'ヤガ科', 'アゲハチョウ科'],
      listPageTitle: isEnglish ? `${title} index | ${EN_SITE_NAME}` : `${title}の一覧 | 昆虫植物図鑑`,
      listPageDesc: isEnglish
        ? `${moths?.length || 0} entries. Search by scientific name, family, subfamily, genus, host plant, or Japanese name.`
        : `${title}の一覧ページ。${moths?.length || 0}種から検索・絞り込み。和名/学名/科・亜科・属で高速検索可能。`,
    }),
    [isEnglish, moths?.length, title],
  );
  // Canonical/OG/パンくず（一覧ページ）
  const canonicalPath = baseRoute === '/' || baseRoute === '' ? localizePath('/', locale) : localizePath(baseRoute, locale);
  const canonicalUrl = (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://orau98.github.io') + (canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`);
  const pageTitle = ui.listPageTitle;
  const pageDesc = ui.listPageDesc;

  const breadcrumbItems = useMemo(() => ([
    { name: isEnglish ? EN_SITE_NAME : '昆虫植物図鑑', url: (typeof window !== 'undefined' ? window.location.origin : 'https://orau98.github.io') + localizePath('/', locale) },
    { name: title, url: canonicalUrl }
  ]), [canonicalUrl, isEnglish, locale, title]);

  useSeoMeta({
    enabled: !embedded,
    title: pageTitle,
    description: pageDesc,
    ogType: 'website',
    url: canonicalUrl,
    locale: isEnglish ? 'en_US' : 'ja_JP',
    htmlLang: locale,
    siteName: isEnglish ? EN_SITE_NAME : '昆虫植物図鑑',
    breadcrumbItems,
    resetCanonicalTo: (typeof window !== 'undefined' ? window.location.origin : 'https://orau98.github.io') + localizePath('/', locale)
  });
  // URLクエリ（i*系・q・classification）の読み書きはフックに集約
  const {
    updateSearchParams,
    currentPage,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
    groupFilter,
    viewMode,
    sortMode,
    requestedItemsPerPage,
    classificationFilter,
    searchQuery,
    setIPage,
    setIHostFilter,
    setIFamilyFilter,
    setIGenusFilter,
    setIEmergenceFilter,
    setISeasonFilter,
    setIPhotoFilter,
    setIGroupFilter,
    setIViewMode,
    setISortMode,
    setIItemsPerPage,
    clearClassification,
    clearFilters,
    clearSearch,
    resetAll,
  } = useInsectListParams({ perPageOptions: PER_PAGE_OPTIONS });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const compareLocalizedValues = useCallback(
    (a, b) =>
      String(a || '').localeCompare(String(b || ''), isEnglish ? 'en' : 'ja'),
    [isEnglish],
  );
  const getVisibleName = useCallback(
    (insect) =>
      isEnglish
        ? getPrimaryEnglishName({
            scientificName: insect?.scientificName,
            japaneseName: insect?.name,
            fallback: insect?.id,
          })
        : insect?.name || insect?.scientificName || insect?.id || '',
    [isEnglish],
  );
  const getFamilyLabel = useCallback(
    (insect) =>
      getLocalizedTaxonomyLabel({
        locale,
        japaneseName: insect?.classification?.familyJapanese || insect?.family,
        scientificName: insect?.classification?.family,
      }),
    [locale],
  );
  const getSubfamilyLabel = useCallback(
    (insect) =>
      getLocalizedTaxonomyLabel({
        locale,
        japaneseName: insect?.classification?.subfamilyJapanese,
        scientificName: insect?.classification?.subfamily,
      }),
    [locale],
  );
  const getTribeLabel = useCallback(
    (insect) =>
      getLocalizedTaxonomyLabel({
        locale,
        japaneseName: insect?.classification?.tribeJapanese,
        scientificName: insect?.classification?.tribe,
      }),
    [locale],
  );

  const applyExampleSearch = useCallback((value) => {
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    setSearchTerm(nextValue);
    // 例示チップのクリックも明示的な検索確定なのでpush
    updateSearchParams((p) => {
      p.set('q', nextValue);
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const allowDebugLogs = (import.meta.env?.DEV || (typeof window !== 'undefined' && !!window.DEBUG_LOGS));

  // Debug log
  useEffect(() => {
    if (allowDebugLogs && moths && moths.length > 0) {
      const sample = moths[0];
      const genus = sample.genus || sample.classification?.genus;
      if (!genus && sample.scientificName) {
        console.log('DEBUG: Moth missing genus, will fallback to scientificName:', sample.name, sample.scientificName);
      }
    }
  }, [allowDebugLogs, moths]);

  const familyOptions = useMemo(() => {
    const set = new Set();
    moths.forEach((m) => {
      const fam = getFamilyLabel(m);
      if (fam && fam !== '不明') set.add(fam);
    });
    return Array.from(set).sort(compareLocalizedValues);
  }, [moths, getFamilyLabel, compareLocalizedValues]);

  const genusOptions = useMemo(() => {
    const set = new Set();
    moths.forEach((m) => {
      let gen = (m?.genus || m?.classification?.genus || '').trim();
      
      // Fallback: extract from scientificName if genus is empty
      if (!gen && m?.scientificName) {
        const parts = m.scientificName.trim().split(/\s+/);
        if (parts.length > 0 && /^[A-Z]/.test(parts[0])) {
          gen = parts[0];
        }
      }
      
      if (gen) set.add(gen);
    });
    return Array.from(set).sort(compareLocalizedValues);
  }, [moths, compareLocalizedValues]);

  const emergenceOptions = useMemo(
    () =>
      isEnglish
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    [isEnglish],
  );

  // Helper to check if a moth appears in a specific month
  const checkEmergenceMatch = useCallback((moth, monthFilter) => {
    if (!monthFilter) return true;
    // Use emergenceTime property if available (priority over re-extraction)
    const emergenceTime = moth.emergenceTime || extractEmergenceTime(moth?.notes || '').emergenceTime;
    const normalized = normalizeEmergenceTime(emergenceTime);
    if (!normalized) return false;

    const months = getEmergenceMonths(normalized);
    if (!months || months.length === 0) return false;

    const monthMap = {
      Jan: 1,
      Feb: 2,
      Mar: 3,
      Apr: 4,
      May: 5,
      Jun: 6,
      Jul: 7,
      Aug: 8,
      Sep: 9,
      Oct: 10,
      Nov: 11,
      Dec: 12,
    };
    const targetMonth =
      parseInt(monthFilter.replace('月', ''), 10) || monthMap[monthFilter] || 0;
    if (!targetMonth) return false;

    return months.includes(targetMonth);
  }, []);

  const getEmergenceMonthList = useCallback((insect) => {
    const emergenceTime = insect?.emergenceTime || extractEmergenceTime(insect?.notes || '').emergenceTime;
    const normalized = normalizeEmergenceTime(emergenceTime);
    if (!normalized) return [];
    return getEmergenceMonths(normalized) || [];
  }, []);

  const checkSeasonMatch = useCallback((insect, season) => {
    if (!season) return true;
    const months = getEmergenceMonthList(insect);
    if (!months.length) return false;
    const seasonMonths = {
      spring: [3, 4, 5],
      summer: [6, 7, 8],
      autumn: [9, 10, 11],
      winter: [12, 1, 2],
    }[season] || [];
    return months.some((month) => seasonMonths.includes(month));
  }, [getEmergenceMonthList]);
  
  const computeItemsPerPage = useCallback(() => {
    if (typeof window === 'undefined') return 48;
    const w = window.innerWidth;
    const cols = w >= 1536 ? 4 : w >= 1024 ? 3 : w >= 640 ? 2 : 1;
    return cols * 12;
  }, []);
  const [itemsPerPage, setItemsPerPage] = useState(computeItemsPerPage());
  const effectiveItemsPerPage = requestedItemsPerPage || itemsPerPage;
  const filterIdBase = useId();
  const hostFilterId = `${filterIdBase}-host`;
  const familyFilterId = `${filterIdBase}-family`;
  const genusFilterId = `${filterIdBase}-genus`;
  const emergenceFilterId = `${filterIdBase}-emergence`;
  const filtersPanelId = `${filterIdBase}-filters`;

  const hasSearchQuery = searchQuery.length > 0;
  const hasFilterCriteria = hostFilter !== 'all' || !!familyFilter || !!genusFilter || !!emergenceFilter || !!seasonFilter || photoFilter === 'has' || !!classificationFilter || !!groupFilter;
  const hasAnyCriteria = hasFilterCriteria || hasSearchQuery;
  const seasonLabels = useMemo(() => ({
    spring: ui.spring,
    summer: ui.summer,
    autumn: ui.autumn,
    winter: ui.winter,
  }), [ui.autumn, ui.spring, ui.summer, ui.winter]);
  const groupLabelMap = useMemo(() => {
    const map = {};
    INSECT_SECTION_CONFIGS.forEach((section) => {
      map[section.type] = isEnglish ? section.labelEn : section.label;
    });
    return map;
  }, [isEnglish]);
  // 一覧に複数グループが混在している場合のみグループ切替チップを出す
  const availableGroups = useMemo(() => {
    const present = new Set((moths || []).map((m) => m?.type || 'moth'));
    return INSECT_SECTION_CONFIGS.filter((section) => present.has(section.type));
  }, [moths]);
  const activeFilters = useMemo(() => {
    const filters = [];
    if (hasSearchQuery) filters.push({ type: isEnglish ? 'Search' : '検索', value: searchQuery, clear: clearSearch });
    if (groupFilter) filters.push({ type: ui.group, value: groupLabelMap[groupFilter] || groupFilter, clear: () => setIGroupFilter('') });
    if (hostFilter !== 'all') filters.push({ type: isEnglish ? 'Host plant' : '食草', value: hostFilter === 'has' ? ui.hasHostPlant : ui.unregisteredOnly, clear: () => setIHostFilter('all') });
    if (familyFilter) filters.push({ type: isEnglish ? 'Family' : '科', value: familyFilter, clear: () => setIFamilyFilter('') });
    if (genusFilter) filters.push({ type: isEnglish ? 'Genus' : '属', value: genusFilter, clear: () => setIGenusFilter('') });
    if (emergenceFilter) filters.push({ type: isEnglish ? 'Season' : '出現期', value: emergenceFilter, clear: () => setIEmergenceFilter('') });
    if (seasonFilter) filters.push({ type: ui.season, value: seasonLabels[seasonFilter] || seasonFilter, clear: () => setISeasonFilter('') });
    if (photoFilter === 'has') filters.push({ type: ui.photo, value: ui.withPhoto, clear: () => setIPhotoFilter('all') });
    if (classificationFilter) filters.push({ type: isEnglish ? 'Taxonomy' : '分類', value: classificationFilter, clear: clearClassification });
    return filters;
  }, [
    hasSearchQuery,
    searchQuery,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
    classificationFilter,
    groupFilter,
    groupLabelMap,
    clearSearch,
    clearClassification,
    setIGroupFilter,
    setIHostFilter,
    setIFamilyFilter,
    setIGenusFilter,
    setIEmergenceFilter,
    setISeasonFilter,
    setIPhotoFilter,
    isEnglish,
    ui.group,
    ui.hasHostPlant,
    ui.photo,
    ui.season,
    ui.unregisteredOnly,
    ui.withPhoto,
    seasonLabels,
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
        : '検索語とフィルターの組み合わせが絞り込みすぎている可能性があります。';
    }
    if (hasSearchQuery) {
      return isEnglish
        ? 'Try a shorter query or search again with a scientific name, family, host plant, or Japanese name.'
        : '検索語を短くするか、別の表記（和名/学名）で再検索してください。';
    }
    return isEnglish
      ? 'Relax one or more filters to see results.'
      : 'フィルター条件を緩めると結果が表示される可能性があります。';
  }, [hasFilterCriteria, hasSearchQuery, isEnglish]);
  const activeFilterSummary = useMemo(
    () => activeFilters.map((filter) => `${filter.type}:${filter.value}`).join(' / '),
    [activeFilters],
  );
  // classification指定でマウントした場合も最初から適用する。
  // effect経由の後追い同期だけだと、デバウンス着弾(約300ms後)が
  // 「ユーザーの新規検索」と誤検知されてページリセットの原因になる
  const [searchTerm, setSearchTerm] = useState(
    () => classificationFilter || initialSearchTerm || '',
  );
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  // 戻る/進む(POP)による復元をユーザーの絞り込み操作と区別するために参照する
  const navigationType = useNavigationType();
  const filterCriteriaRef = useRef({
    debouncedSearchTerm,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
    sortMode,
  });
  const listTopRef = useRef(null);
  const resizeInitializedRef = useRef(false);

  // Scroll restoration is handled centrally by InsectsHostPlantExplorer

  // Sync search term with classification filter and clear when filter removed
  useEffect(() => {
    if (classificationFilter) {
      setSearchTerm(classificationFilter);
    } else {
      setSearchTerm(initialSearchTerm || '');
    }
  }, [classificationFilter, initialSearchTerm]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      const next = computeItemsPerPage();
      setItemsPerPage((prev) => {
        if (prev === next) return prev;
        if (resizeInitializedRef.current) {
          setIPage(1);
        }
        return next;
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    onResize();
    resizeInitializedRef.current = true;
    return () => window.removeEventListener('resize', onResize);
  }, [computeItemsPerPage, setIPage]);

  // （メタは useSeoMeta に移行）

  // ItemList JSON-LD for top items (first 10)
  useEffect(() => {
    if (embedded) return;
    try {
      const source = (moths || []).slice(0, 10);
      const origin = (typeof window !== 'undefined' ? window.location.origin : 'https://orau98.github.io');
      const items = source.map((m, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: origin + buildInsectPath(m)
      }));
      const scriptElId = 'itemlist-moth';
      let s = document.querySelector('#' + scriptElId);
      if (!s) {
        s = document.createElement('script');
        s.id = scriptElId;
        s.type = 'application/ld+json';
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: items
      });
    } catch (error) {
      logger.debug('Failed to inject moth item list structured data:', error);
    }
    return () => {
      const s = document.querySelector('#itemlist-moth');
      if (s) s.remove();
    };
  }, [embedded, moths]);

  // ひらがな→カタカナは共通ユーティリティを使用

  const normalizeText = useCallback((v) => (v || '').trim().toLowerCase(), []);

  const isPlaceholderHost = useCallback((name) => {
    if (!name) return true;
    const base = name.replace(/[．。]/g, '.').trim();
    const stripped = base.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
    if (!stripped) return true;
    return HOST_PLACEHOLDERS.some(h => stripped === h || stripped.startsWith(h)) ||
      /^unknown/i.test(stripped);
  }, []);

  const hasRealHost = useCallback((moth) => {
    if (!moth || !moth.hostPlants) return false;
    const splitPlants = (value) => {
      if (typeof value === 'string') {
        return value.split(/[;；、,]/).map((p) => p.trim());
      }
      if (Array.isArray(value)) {
        return value.map((p) => (p || '').trim());
      }
      return [];
    };

    const plantNames = [];
    splitPlants(moth.hostPlants)
      .filter(Boolean)
      .forEach((p) => {
        const cleaned = p.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
        if (cleaned) plantNames.push(cleaned);
      });

    // 「不明」「未知」などのプレースホルダーだけの場合は false
    return plantNames.some((p) => p && !isPlaceholderHost(p));
  }, [isPlaceholderHost]);

  // 食草名での検索用インデックス。UI（プレースホルダ・検索例）は食草検索を
  // 案内しているのに実装が未対応で「サクラ/ヤナギ/Quercus」等が0件になる
  // 行き止まりを解消するため、各昆虫の食草・訪花植物名を小文字連結して事前計算する。
  // データロード時に1度だけ構築し、毎打鍵の再計算を避ける（キーは安定した moth.id）。
  const hostSearchIndex = useMemo(() => {
    const map = new Map();
    (moths || []).forEach((moth) => {
      if (!moth || moth.id == null) return;
      const { hostNames, flowerNames } = buildPlantDisplayData(moth);
      const joined = [...hostNames, ...flowerNames].join(' ').toLowerCase();
      if (joined) map.set(moth.id, joined);
    });
    return map;
  }, [moths]);

  const filteredMoths = useMemo(() => {
    try {
      logger.debug('DEBUG: Filtering moths, total count:', moths.length, 'search term:', debouncedSearchTerm);
      
      if (!moths || moths.length === 0) {
        return [];
      }
      
      return moths.filter(moth => {
        try {
          if (!moth) return false;
          
          // host filter
          const hasHost = hasRealHost(moth);
          if (hostFilter === 'has' && !hasHost) return false;
          if (hostFilter === 'none' && hasHost) return false;
          
          // family filter
          if (familyFilter) {
            const targets = [
              moth.family,
              moth.classification?.familyJapanese,
              moth.classification?.family
            ].map(normalizeText);
            const filterVal = normalizeText(familyFilter);
            if (!targets.includes(filterVal)) return false;
          }
          
          // genus filter
          if (genusFilter) {
            let g = (moth.genus || moth.classification?.genus || '').trim();
            // Fallback to scientific name
            if (!g && moth.scientificName) {
               const parts = moth.scientificName.trim().split(/\s+/);
               if (parts.length > 0 && /^[A-Z]/.test(parts[0])) {
                 g = parts[0];
               }
            }
            if (g.toLowerCase() !== genusFilter.toLowerCase()) return false;
          }
          
          // emergence filter
          if (emergenceFilter) {
            if (!checkEmergenceMatch(moth, emergenceFilter)) return false;
          }

          if (seasonFilter) {
            if (!checkSeasonMatch(moth, seasonFilter)) return false;
          }

          if (groupFilter && (moth.type || 'moth') !== groupFilter) return false;

          // NFKC正規化で半角カナ・全角英数の表記ゆれを吸収（例: ﾌﾞﾅ→ブナ）
          const nfkcSearchTerm = normalizeNFKC(debouncedSearchTerm);
          const lowerCaseSearchTerm = nfkcSearchTerm.toLowerCase();
          // ひらがなをカタカナに変換した検索語も用意
          const katakanaSearchTerm = hiraganaToKatakana(nfkcSearchTerm).toLowerCase();

          // If there's a classification filter from URL, prioritize that
          if (classificationFilter && !debouncedSearchTerm) {
            const nfkcClassification = normalizeNFKC(classificationFilter);
            const lowerClassification = nfkcClassification.toLowerCase();
            const katakanaClassification = hiraganaToKatakana(nfkcClassification).toLowerCase();
            return (moth.classification?.familyJapanese?.toLowerCase().includes(lowerClassification)) ||
                   (moth.classification?.familyJapanese?.toLowerCase().includes(katakanaClassification)) ||
                   (moth.classification?.subfamilyJapanese?.toLowerCase().includes(lowerClassification)) ||
                   (moth.classification?.subfamilyJapanese?.toLowerCase().includes(katakanaClassification)) ||
                   (moth.classification?.tribeJapanese?.toLowerCase().includes(lowerClassification)) ||
                   (moth.classification?.tribeJapanese?.toLowerCase().includes(katakanaClassification)) ||
                   (moth.classification?.genus?.toLowerCase().includes(lowerClassification)) ||
                   (moth.classification?.family?.toLowerCase().includes(lowerClassification)) ||
                   (moth.classification?.subfamily?.toLowerCase().includes(lowerClassification)) ||
                   (moth.classification?.tribe?.toLowerCase().includes(lowerClassification)) ||
                   (moth.scientificName?.toLowerCase().includes(lowerClassification));
          }
          
          // If no search term, include all moths
          if (!lowerCaseSearchTerm) {
            return true;
          }
          
          // Regular search filtering - check both original and katakana converted search terms
          const alt = (moth.alternativeNames || '').toLowerCase();
          // 食草・訪花植物名も検索対象に含める（UIの案内どおり「サクラ/ヤナギ/Quercus」等で
          // その植物を食べる昆虫がヒットするようにする）
          const hostSearch = hostSearchIndex.get(moth.id) || '';
          return (moth.name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.name?.toLowerCase().includes(katakanaSearchTerm)) ||
                 (alt && (alt.includes(lowerCaseSearchTerm) || alt.includes(katakanaSearchTerm))) ||
                 (moth.scientificName?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.familyJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.familyJapanese?.toLowerCase().includes(katakanaSearchTerm)) ||
                 (moth.classification?.subfamilyJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.subfamilyJapanese?.toLowerCase().includes(katakanaSearchTerm)) ||
                 (moth.classification?.tribeJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.tribeJapanese?.toLowerCase().includes(katakanaSearchTerm)) ||
                 (moth.classification?.genus?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.family?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.subfamily?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (moth.classification?.tribe?.toLowerCase().includes(lowerCaseSearchTerm)) ||
                 (hostSearch && (hostSearch.includes(lowerCaseSearchTerm) || hostSearch.includes(katakanaSearchTerm)));
        } catch (error) {
          logger.error('Error filtering moth:', moth, error);
          return false;
        }
      });
    } catch (error) {
      logger.error('Error in filteredMoths calculation:', error);
      return [];
    }
  }, [moths, debouncedSearchTerm, classificationFilter, hostFilter, familyFilter, genusFilter, emergenceFilter, seasonFilter, groupFilter, hasRealHost, hostSearchIndex, checkEmergenceMatch, checkSeasonMatch, normalizeText]);

  // 画像ファイル名の解決は useInsectImageMap に集約
  // （インデックス取得・全種の事前解決・再マウント間キャッシュ込み）
  const {
    insectImageMap: mothImageMap,
    isImageIndexReady,
    imageIndexResolved,
  } = useInsectImageMap(moths);

  // インデックス到着で「写真あり優先」の並びが確定するため、
  // 未準備→準備完了の遷移時のみ1ページ目へ戻す（同期初期化時は遷移しない）
  const imageIndexReadyRef = useRef(isImageIndexReady);
  useEffect(() => {
    if (!imageIndexReadyRef.current && isImageIndexReady) {
      setIPage(1);
    }
    imageIndexReadyRef.current = isImageIndexReady;
  }, [isImageIndexReady, setIPage]);

  // Sort moths prioritizing those with images; render deferred until index is ready
  const sortedMoths = useMemo(() => {
    try {
      if (!filteredMoths || filteredMoths.length === 0) {
        return [];
      }
      const getHasImage = (insect) => {
        if (!insect) return false;
        return mothImageMap.has(insect.id);
      };

      // ソート比較のたびに植物名パース/出現期抽出を再実行すると
      // 全件ソートでO(n log n)回の重い処理になるため、種IDでメモ化する
      const plantCountCache = new Map();
      const getPlantLinkCount = (insect) => {
        const key = insect?.id ?? insect;
        if (plantCountCache.has(key)) return plantCountCache.get(key);
        const data = buildPlantDisplayData(insect);
        const count = data.hostNames.length + data.flowerNames.length;
        plantCountCache.set(key, count);
        return count;
      };
      const firstMonthCache = new Map();
      const getFirstMonth = (insect) => {
        const key = insect?.id ?? insect;
        if (firstMonthCache.has(key)) return firstMonthCache.get(key);
        const months = getEmergenceMonthList(insect);
        const first = months.length ? Math.min(...months) : 99;
        firstMonthCache.set(key, first);
        return first;
      };
      const getFamilySortKey = (insect) => getFamilyLabel(insect) || '';
      const isSearching = (debouncedSearchTerm && debouncedSearchTerm.trim() !== '') || classificationFilter;
      const pool =
        photoFilter === 'has' && isImageIndexReady
          ? filteredMoths.filter((insect) => getHasImage(insect))
          : filteredMoths;
      const sorted = [...pool].sort((a, b) => {
        const hasImageA = getHasImage(a);
        const hasImageB = getHasImage(b);
        if (sortMode === 'image') {
          if (hasImageA && !hasImageB) return -1;
          if (!hasImageA && hasImageB) return 1;
        }
        if (sortMode === 'family') {
          const familyCompare = compareLocalizedValues(getFamilySortKey(a), getFamilySortKey(b));
          if (familyCompare !== 0) return familyCompare;
          return compareLocalizedValues(getVisibleName(a), getVisibleName(b));
        }
        if (sortMode === 'plantCount') {
          const countDiff = getPlantLinkCount(b) - getPlantLinkCount(a);
          if (countDiff !== 0) return countDiff;
          return compareLocalizedValues(getVisibleName(a), getVisibleName(b));
        }
        if (sortMode === 'season') {
          const monthDiff = getFirstMonth(a) - getFirstMonth(b);
          if (monthDiff !== 0) return monthDiff;
          return compareLocalizedValues(getVisibleName(a), getVisibleName(b));
        }
        if (sortMode === 'name') {
          return compareLocalizedValues(getVisibleName(a), getVisibleName(b));
        }

        if (isSearching) {
          const getClassificationPriority = (insect) => {
            const classification = insect.classification;
            if (!classification) return { level: 5, name: getVisibleName(insect) };
            const familyLabel = getFamilyLabel(insect);
            if (familyLabel) return { level: 1, name: familyLabel };
            const subfamilyLabel = getSubfamilyLabel(insect);
            if (subfamilyLabel) return { level: 2, name: subfamilyLabel };
            const tribeLabel = getTribeLabel(insect);
            if (tribeLabel) return { level: 3, name: tribeLabel };
            if (classification.genus) return { level: 4, name: classification.genus };
            return { level: 5, name: getVisibleName(insect) };
          };
          const priorityA = getClassificationPriority(a);
          const priorityB = getClassificationPriority(b);
          if (priorityA.level !== priorityB.level) return priorityA.level - priorityB.level;
          if (priorityA.name !== priorityB.name) {
            return compareLocalizedValues(priorityA.name, priorityB.name);
          }
        }
        return compareLocalizedValues(getVisibleName(a), getVisibleName(b));
      });

      return sorted;
    } catch (error) {
      logger.error('Error in sortedMoths calculation:', error);
      return filteredMoths || [];
    }
  }, [
    filteredMoths,
    debouncedSearchTerm,
    classificationFilter,
    photoFilter,
    sortMode,
    isImageIndexReady,
    mothImageMap,
    compareLocalizedValues,
    getFamilyLabel,
    getSubfamilyLabel,
    getTribeLabel,
    getEmergenceMonthList,
    getVisibleName,
  ]);

  const totalPages = Math.ceil((sortedMoths?.length || 0) / effectiveItemsPerPage);
  // URLのipageが総ページ数を超える場合は最終ページへ丸める
  // （共有URLや表示件数変更で範囲外になっても、空の一覧を表示しない）
  const effectivePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const currentMoths = useMemo(() => {
    try {
      if (!sortedMoths || sortedMoths.length === 0) {
        return [];
      }

      const startIndex = (effectivePage - 1) * effectiveItemsPerPage;
      const endIndex = startIndex + effectiveItemsPerPage;
      return sortedMoths.slice(startIndex, endIndex);
    } catch (error) {
      logger.error('Error calculating currentMoths:', error);
      return [];
    }
  }, [sortedMoths, effectivePage, effectiveItemsPerPage]);

  const handlePageChange = (page) => {
    const nextPage = parseInt(page, 10);
    if (!Number.isFinite(nextPage)) return;
    const clampedPage = Math.min(Math.max(nextPage, 1), Math.max(totalPages, 1));
    if (clampedPage === effectivePage) return;
    setIPage(clampedPage, { push: true });
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const target = listTopRef.current || document.getElementById('explorer-results');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  // Add rel=prev/next for crawlers (hint)
  useEffect(() => {
    try {
      document.querySelectorAll('link[rel="prev"], link[rel="next"]').forEach(n => n.remove());
      const url = new URL(window.location.href);
      url.searchParams.delete('ipage');
      if (effectivePage > 1) {
        const prev = document.createElement('link');
        prev.rel = 'prev';
        const prevUrl = new URL(url.href);
        const prevPage = effectivePage - 1;
        if (prevPage > 1) prevUrl.searchParams.set('ipage', String(prevPage));
        prev.href = prevUrl.toString();
        document.head.appendChild(prev);
      }
      if (effectivePage < totalPages) {
        const next = document.createElement('link');
        next.rel = 'next';
        const nextUrl = new URL(url.href);
        nextUrl.searchParams.set('ipage', String(effectivePage + 1));
        next.href = nextUrl.toString();
        document.head.appendChild(next);
      }
    } catch (error) {
      logger.debug('Failed to update rel prev/next links for moth list:', error);
    }
  }, [effectivePage, totalPages]);

  React.useEffect(() => {
    const prev = filterCriteriaRef.current;
    const changed =
      prev.debouncedSearchTerm !== debouncedSearchTerm ||
      prev.hostFilter !== hostFilter ||
      prev.familyFilter !== familyFilter ||
      prev.genusFilter !== genusFilter ||
      prev.emergenceFilter !== emergenceFilter ||
      prev.seasonFilter !== seasonFilter ||
      prev.photoFilter !== photoFilter ||
      prev.sortMode !== sortMode;

    if (!changed) return;

    filterCriteriaRef.current = {
      debouncedSearchTerm,
      hostFilter,
      familyFilter,
      genusFilter,
      emergenceFilter,
      seasonFilter,
      photoFilter,
      sortMode,
    };

    // 戻る/進む(POP)・初期ロードによる変化は「復元」であって新しい絞り込みでは
    // ない。ここでリセットすると、履歴から復元されたページ番号(ipage)を即座に
    // 1へ書き戻し(しかもreplaceで元エントリを恒久破壊)、復元済みのスクロール
    // 位置も先頭へ引き戻してしまう。基準値の同期だけ行い早期リターンする
    if (navigationType === 'POP') return;

    // 条件・並び順が変わったら結果の先頭を見せる
    // （下までスクロールした状態で「新しい並びの中盤」が表示される混乱を防ぐ）
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const target = listTopRef.current || document.getElementById('explorer-results');
        if (!target) return;
        if (target.getBoundingClientRect().top < 0) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    if (currentPage === 1) return;
    setIPage(1);
  }, [
    navigationType,
    debouncedSearchTerm,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
    sortMode,
    currentPage,
    setIPage,
  ]);

  const renderFilters = () => {
    const groupChips = availableGroups.length > 1
      ? availableGroups.map((section) => ({
          key: section.type,
          label: groupLabelMap[section.type] || section.label,
          active: groupFilter === section.type,
          onClick: () => setIGroupFilter(groupFilter === section.type ? '' : section.type),
        }))
      : [];
    const presetChips = [
      { key: 'host', label: ui.hasHostPlant, active: hostFilter === 'has', onClick: () => setIHostFilter(hostFilter === 'has' ? 'all' : 'has') },
      { key: 'photo', label: ui.withPhoto, active: photoFilter === 'has', onClick: () => setIPhotoFilter(photoFilter === 'has' ? 'all' : 'has') },
      { key: 'spring', label: ui.spring, active: seasonFilter === 'spring', onClick: () => setISeasonFilter(seasonFilter === 'spring' ? '' : 'spring') },
      { key: 'summer', label: ui.summer, active: seasonFilter === 'summer', onClick: () => setISeasonFilter(seasonFilter === 'summer' ? '' : 'summer') },
      { key: 'autumn', label: ui.autumn, active: seasonFilter === 'autumn', onClick: () => setISeasonFilter(seasonFilter === 'autumn' ? '' : 'autumn') },
      { key: 'winter', label: ui.winter, active: seasonFilter === 'winter', onClick: () => setISeasonFilter(seasonFilter === 'winter' ? '' : 'winter') },
      { key: 'unknown', label: ui.unregisteredOnly, active: hostFilter === 'none', onClick: () => setIHostFilter(hostFilter === 'none' ? 'all' : 'none') },
    ];
    const sortOptions = [
      { value: 'image', label: ui.sortImage },
      { value: 'name', label: ui.sortName },
      { value: 'family', label: ui.sortFamily },
      { value: 'plantCount', label: ui.sortPlantCount },
      { value: 'season', label: ui.sortSeason },
    ];
    const resultsLabel = ui.resultCount(sortedMoths?.length ?? filteredMoths?.length ?? 0);
    const mobileControlsLabel = isEnglish ? 'Controls' : '条件';
    const activeControlsLabel = isEnglish ? `${activeFilters.length} active` : `条件${activeFilters.length}`;
    const renderFullControls = ({ showResultsLabel = true, mobileInline = false } = {}) => {
      const idSuffix = mobileInline ? '-mobile' : '';
      const panelId = `${filtersPanelId}${idSuffix}`;
      const hostId = `${hostFilterId}${idSuffix}`;
      const familyId = `${familyFilterId}${idSuffix}`;
      const genusId = `${genusFilterId}${idSuffix}`;
      const emergenceId = `${emergenceFilterId}${idSuffix}`;

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
          controlsClassName={`${mobileInline ? 'mt-2' : 'mt-4'} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`}
          resultsLabel={showResultsLabel ? resultsLabel : ''}
        >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1" htmlFor={hostId}>{ui.hostPlantFilter}</label>
              <div className="relative">
                <select
                  id={hostId}
                  value={hostFilter}
                  onChange={(e) => setIHostFilter(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">{ui.all}</option>
                  <option value="has">{ui.hasHostPlant}</option>
                  <option value="none">{ui.unregisteredOnly}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

          <SearchableSelect
            id={familyId}
            label={ui.family}
            value={familyFilter}
            options={familyOptions}
            onChange={setIFamilyFilter}
            placeholder={ui.any}
            locale={locale}
          />

          <SearchableSelect
            id={genusId}
            label={ui.genus}
            value={genusFilter}
            options={genusOptions}
            onChange={setIGenusFilter}
            placeholder={ui.any}
            locale={locale}
          />

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1" htmlFor={emergenceId}>{ui.emergence}</label>
          <div className="relative">
            <select
              id={emergenceId}
              value={emergenceFilter}
              onChange={(e) => setIEmergenceFilter(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">{ui.any}</option>
              {emergenceOptions.map((em) => (
                <option key={em} value={em}>{em}</option>
              ))}
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
          onViewModeChange={setIViewMode}
          sortMode={sortMode}
          onSortModeChange={setISortMode}
          sortOptions={sortOptions}
          itemsPerPageValue={requestedItemsPerPage || 'auto'}
          autoItemsPerPage={itemsPerPage}
          onItemsPerPageChange={setIItemsPerPage}
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
        {/* グループ切替は主要導線なので、モバイルでも「条件」ドロワーの外に常時表示する */}
        {groupChips.length > 0 && (
          <div className="mb-2 sm:mb-3">
            <PresetFilterChips label={ui.groupLabel} chips={groupChips} />
          </div>
        )}
        {/* クイック絞り込み（食草あり/写真あり/季節）も、初訪問者が絞り込みに気づけるよう
            「条件」ドロワーの外に常時表示する（グループ切替と同じ扱い） */}
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
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
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
    <div className={embedded ? "" : "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden"}>
      {!embedded && (
        <div className="p-6 bg-blue-500/10 dark:bg-blue-500/20 border-b border-blue-200/30 dark:border-blue-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                {ui.listTitle}
              </h2>
            </div>
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
          {/* データ未着(moths=[])かつ条件なしのときも、空状態ではなくスケルトンを出す。
              画像インデックスは即時解決するため、これが無いと初回ロード中に一瞬
              「該当する昆虫が見つかりません」「昆虫(0)」が出てしまう（植物一覧と対称化）。 */}
          {(!isImageIndexReady && !imageIndexResolved) || ((moths?.length ?? 0) === 0 && !hasAnyCriteria) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
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
          ) : currentMoths.length > 0 ? (
            <div className={viewMode === 'compact' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4'}>
              {currentMoths.map((moth, index) => {
                try {
                  return (
                    <React.Fragment key={moth?.id || `moth-${index}`}>
                      {!hasAnyCriteria && effectivePage === 1 && index === 8 && viewMode !== 'compact' && (
                        <ManualAdSlot
                          placement="inFeed"
                          locale={locale}
                          className="animate-fadeIn h-full"
                          minHeight="min-h-[220px]"
                        />
                      )}
                      {/* 行内でカード高さを揃える（短いカードの下に空白ができないように） */}
                      <div className="animate-fadeIn h-full" style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}>
                        <MothListItem
                          moth={moth} 
                          baseRoute={baseRoute} 
                          isPriority={index < 12} 
                          imageFilename={mothImageMap.get(moth.id)}
                          plantDetails={plantDetails}
                          locale={locale}
                          viewMode={viewMode}
                        />
                      </div>
                    </React.Fragment>
                  );
                } catch (error) {
                  logger.error('Error rendering moth item:', error, moth);
                  return (
                    <div key={`error-${index}`} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-600">
                      <div className="text-red-600 dark:text-red-400 text-sm">
                        {ui.renderError(moth?.name || (isEnglish ? `Insect #${index}` : `昆虫 #${index}`))}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              {/* Empty state イラスト */}
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-emerald-100 dark:from-blue-900/30 dark:to-emerald-900/30 rounded-full animate-pulse" />
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
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50"
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
          <div className="mt-6 pt-4 border-t border-blue-200/30 dark:border-blue-700/30 overflow-x-hidden">
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

export default MothList;
