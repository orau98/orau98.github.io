import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import logger from './utils/logger';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';
import ImageWithFallback from './components/ImageWithFallback';
import ImageModal from './components/ImageModal';
import { DetailSkeleton } from './components/SkeletonLoader';
import SourceCitation from './components/ui/SourceCitation';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { MothStructuredData, ButterflyStructuredData, LeafBeetleStructuredData, BeetleStructuredData, LonghornBeetleStructuredData, AphidStructuredData } from './components/StructuredData';
import useSeoMeta from './hooks/useSeoMeta';
import useSeoRouteMap from './hooks/useSeoRouteMap';
import useNearViewport from './hooks/useNearViewport';
import {
  EN_SITE_NAME,
  buildLocalizedTaxonomyChip,
  buildJapaneseReferenceLabel,
  getPrimaryEnglishName,
} from './utils/englishNaming';
import { isEnglishLocale, localizePath } from './utils/locale';
import { absUrl } from './utils/origin';
import { buildInsectPath, decodeSlug, slugifyInsectName } from './utils/insectSlug';
import { loadInsectImageIndexes } from './services/imageIndex';
import { createSafeInsectFilename } from './utils/image';
import { buildResponsivePicture, buildResizedImageUrl } from './utils/imageSrcset';
import { getMappedScientificFilename } from './utils/insectImageMappings';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from './utils/insectImageResolver';
import { splitJapaneseNameAliases } from './utils/insectNameAliases';
import { buildInsectMetaPagePath, buildPlantPath, getInsectSectionConfig } from './utils/siteTaxonomy';
import EmergenceTimeDisplay from './components/EmergenceTimeDisplay';
import EnhancedHostPlantDisplay from './components/EnhancedHostPlantDisplay';
import RelatedInsectsSection from './components/RelatedInsectsSection';
import NativeShareButton from './components/NativeShareButton';
import DetailNavigation from './components/DetailNavigation';
import ManualAdSlot from './components/ManualAdSlot';
import { extractEmergenceTime, normalizeEmergenceTime } from './utils/emergenceTimeUtils';
import { getBackTarget, makeDetailLinkState } from './utils/navState';
import { isPlantHostRecord } from './utils/hostResource';
import { sortInsectsTaxonomically } from './utils/taxonomicOrder';
import {
  INDEX_FOLLOW_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  setRobotsMetaContent,
} from './utils/robotsMeta';
import Breadcrumb from './components/Breadcrumb';
const FoodWebGraph = React.lazy(() => import('./components/FoodWebGraph'));

const PLANT_PART_KEYWORDS = ['花', '実', '果実', '葉', '茎', '根', '枝', '樹皮', '蕾', '若葉'];
const INSECT_ORDER_LABELS = Object.freeze({
  moth: { ja: 'チョウ目', en: 'Lepidoptera' },
  butterfly: { ja: 'チョウ目', en: 'Lepidoptera' },
  beetle: { ja: 'コウチュウ目', en: 'Coleoptera' },
  longhornbeetle: { ja: 'コウチュウ目', en: 'Coleoptera' },
  leafbeetle: { ja: 'コウチュウ目', en: 'Coleoptera' },
  aphid: { ja: 'カメムシ目', en: 'Hemiptera' },
});
const RESIZED_INSECT_IMAGE_RE = /\/images\/resized\/insects\/([^/?#]+)\.(320|640|1024)\.jpg/i;

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getImageBaseFromResizedUrl = (url = '') => {
  const match = String(url).match(RESIZED_INSECT_IMAGE_RE);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const extractPlantPartsFromNotes = (notes) => {
  if (!Array.isArray(notes) || notes.length === 0) return {};

  const plantParts = {};
  notes.forEach((note) => {
    if (!note) return;

    PLANT_PART_KEYWORDS.forEach((part) => {
      if (note.includes(part)) {
        const plantMatch = note.match(/(\S+?)(?:の|から|で)?\s*(?:花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)/);
        if (plantMatch) {
          const plantName = plantMatch[1];
          if (!plantParts[plantName]) plantParts[plantName] = new Set();
          plantParts[plantName].add(part);
        }

        if (!plantParts['*']) plantParts['*'] = new Set();
        plantParts['*'].add(part);
      }

      const extendedPattern = new RegExp(`(など|等)の?${part}`, 'g');
      if (extendedPattern.test(note)) {
        if (!plantParts['*']) plantParts['*'] = new Set();
        plantParts['*'].add(part);
      }
    });
  });

  return Object.fromEntries(
    Object.entries(plantParts).map(([key, parts]) => [key, Array.from(parts)])
  );
};

const MothDetail = ({ moths, butterflies = [], beetles = [], longhornbeetles = [], leafbeetles = [], aphids = [], hostPlants, flowerVisitPlants = {}, plantDetails = {}, theme, locale = 'ja' }) => {
  // 🔍 デバッグ：コンポーネント呼び出し確認
  logger.debug('🔍 MothDetail component called');
  const isEnglish = isEnglishLocale(locale);
  const englishInsectRouteMap = useSeoRouteMap('insects');

  const isDevelopment = typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV;
  const allowDebugLogs = isDevelopment || (typeof window !== 'undefined' && !!window.DEBUG_LOGS);
  
  const { mothSlug, butterflySlug, beetleSlug, longhornbeetleSlug, leafbeetleSlug, aphidSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeType = mothSlug ? 'moth' : butterflySlug ? 'butterfly' : beetleSlug ? 'beetle' : longhornbeetleSlug ? 'longhornbeetle' : leafbeetleSlug ? 'leafbeetle' : aphidSlug ? 'aphid' : '';
  const rawRouteParam = mothSlug || butterflySlug || beetleSlug || longhornbeetleSlug || leafbeetleSlug || aphidSlug || '';
  const decodedRouteParam = decodeSlug(rawRouteParam);
  const normalizedRouteSlug = slugifyInsectName(decodedRouteParam);
  const [fallbackHostPlants, setFallbackHostPlants] = useState([]);

  // 🔍 デバッグ：URLパラメータ確認
  logger.debug('🔍 URL params:', { mothSlug, butterflySlug, beetleSlug, longhornbeetleSlug, leafbeetleSlug, aphidSlug, rawRouteParam, decodedRouteParam });
  
  // ID mapping for compatibility between different data sources
  // Since moths array is built from insects.csv (species-XXX format)
  // We need to map catalog-XXX to species-XXX, not the other way around
  const idMapping = {
    'catalog-3123': 'species-4601', // アオバシャチホコ (Zaranga permagna)
    'catalog-3586': 'species-6115', // アズサキリガ (Pseudopanolis azusa)
    // Add more mappings as needed
  };
  
  // Helper: determine whether the parameter looks like an internal ID (species-XXXX etc.)
  const isLikelyInsectId = (value = '') => /^(species|catalog|moth|butterfly|butterfly-csv|beetle|longhornbeetle|leafbeetle|aphid)[-_]?\d+/i.test(value);
  
  // Apply ID mapping only when the route param looks like an ID
  const mappedInsectId = isLikelyInsectId(decodedRouteParam) ? (idMapping[decodedRouteParam] || decodedRouteParam) : decodedRouteParam;
  const insectId = decodedRouteParam; // original (decoded) route param for logging/compatibility

  // Resolve non-standard suffix IDs like `species-6131m` -> `species-6131`
  const resolveInsectId = (id) => {
    if (!id) return id;
    // strip trailing single-letter suffixes commonly used (e.g., m/f variants)
    const m = String(id).match(/^(species|catalog)-(\d+)[a-z]$/i);
    if (m) return `${m[1]}-${m[2]}`;
    return id;
  };

  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : (import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : ''));
  
  // 🔍 デバッグ：データ配列の状況確認
  logger.debug('🔍 Data arrays status:', {
    mothsLength: moths.length,
    butterfliesLength: butterflies.length,
    beetlesLength: beetles.length,
    longhornbeetlesLength: longhornbeetles.length,
    leafbeetlesLength: leafbeetles.length,
    aphidsLength: aphids.length,
    totalDataLoaded: moths.length + butterflies.length + beetles.length + longhornbeetles.length + leafbeetles.length + aphids.length
  });
  
  // Check if data is still loading
  const totalDataLoaded = moths.length + butterflies.length + beetles.length + longhornbeetles.length + leafbeetles.length + aphids.length;
  const isDataLoading = totalDataLoaded === 0;
  
  // Add debug logging for アオバシャチホコ
  if (decodedRouteParam === 'species-4601' || decodedRouteParam === 'catalog-3123' || mappedInsectId === 'species-4601') {
    logger.debug('🔍 DEBUG アオバシャチホコ ID mapping:', {
      originalId: decodedRouteParam,
      mappedId: mappedInsectId,
      hasMapping: !!idMapping[decodedRouteParam],
      idMappingTable: idMapping,
      isDataLoading: isDataLoading,
      totalDataLoaded: totalDataLoaded
    });
  }
  
  // species-6115のIDマッピングデバッグ
  if (decodedRouteParam === 'species-6115' || mappedInsectId === 'species-6115') {
    logger.debug('DEBUG species-6115 ID mapping:', {
      originalId: decodedRouteParam,
      mappedId: mappedInsectId,
      hasMapping: !!idMapping[decodedRouteParam]
    });
  }
  
  // Combine all insects for searching
  const allInsects = React.useMemo(() => [...moths, ...butterflies, ...beetles, ...longhornbeetles, ...leafbeetles, ...aphids], [moths, butterflies, beetles, longhornbeetles, leafbeetles, aphids]);
  
  // 前後ナビ用の並び順。五十音順ではなく分類順（グループ→科→亜科→族→属→種）にして、
  // 「次の種」で近縁種へ移動できるようにする
  const sortedInsects = React.useMemo(() => {
    return sortInsectsTaxonomically(allInsects);
  }, [allInsects]);

  // Utility: find by slugified Japanese name (URL-safe)
  const findBySlugOrName = (value) => {
    if (!value) return null;
    const normalized = slugifyInsectName(value);
    return allInsects.find((m) => slugifyInsectName(m.name) === normalized || m.name === value);
  };

  let moth = null;

  // 1) Try ID search when the param looks like an ID
  if (isLikelyInsectId(mappedInsectId)) {
    moth = allInsects.find(m => m.id === mappedInsectId);
    if (!moth) {
      const fallbackId = resolveInsectId(mappedInsectId);
      if (fallbackId !== mappedInsectId) {
        moth = allInsects.find(m => m.id === fallbackId);
      }
    }
  }

  // 2) Try slug/name search
  if (!moth) {
    moth = findBySlugOrName(decodedRouteParam) || findBySlugOrName(mappedInsectId);
  }

  // 3) Try alternativeNames for slug match
  if (!moth) {
    moth = allInsects.find((m) => {
      const alts = (m.alternativeNames || '')
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return alts.some((alt) => slugifyInsectName(alt) === normalizedRouteSlug);
    }) || null;
  }

  // 4) If route param contains alias-style parentheses, try the cleaned base name
  if (!moth) {
    const parsed = splitJapaneseNameAliases(decodedRouteParam);
    if (parsed?.name && parsed.name !== decodedRouteParam) {
      moth = findBySlugOrName(parsed.name);
    }
  }

  const resolvedInsectId = moth?.id || resolveInsectId(mappedInsectId);
  // 各分類ごとのID（構造化データ用）
  const mothId = routeType === 'moth' ? resolvedInsectId : '';
  const butterflyId = routeType === 'butterfly' ? resolvedInsectId : '';
  const beetleId = routeType === 'beetle' ? resolvedInsectId : '';
  const longhornbeetleId = routeType === 'longhornbeetle' ? resolvedInsectId : '';
  const leafbeetleId = routeType === 'leafbeetle' ? resolvedInsectId : '';
  const aphidId = routeType === 'aphid' ? resolvedInsectId : '';

  // URL を和名スラグに正規化（idでアクセスされた場合でも置き換え）
  useEffect(() => {
    if (!moth || !rawRouteParam) return;
    const expectedPath = buildInsectPath(moth, locale);
    if (expectedPath && location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true, state: location.state });
    }
  }, [locale, moth, rawRouteParam, navigate, location.pathname, location.state]);

  // Fallback: if no host plants are available (e.g., data-lite initial state),
  // lazily load from normalized CSV (public/hostplants.csv) and synthesize minimal records.
  useEffect(() => {
    if (!moth) {
      setFallbackHostPlants([]);
      return;
    }
    const hasHostPlants =
      (Array.isArray(moth.hostPlantsDetailed) && moth.hostPlantsDetailed.length > 0) ||
      (Array.isArray(moth.hostPlants) && moth.hostPlants.length > 0);
    if (hasHostPlants) {
      setFallbackHostPlants([]);
      return;
    }
    let aborted = false;
    const v = import.meta.env.DEV ? `?v=${Date.now()}` : '';
    fetch(`${import.meta.env.BASE_URL}hostplants.csv${v}`)
      .then(res => res.ok ? res.text() : '')
      .then(text => {
        if (aborted || !text) return;
        const lines = text.replace(/\r\n?|\n/g, '\n').split('\n');
        if (lines.length < 2) return;
        const header = lines[0].split(',').map(h => h.trim());
        const iInsect = header.indexOf('insect_id');
        const iPlant = header.indexOf('plant_name');
        const iFamily = header.indexOf('plant_family');
        const iObs = header.indexOf('observation_type');
        const iPart = header.indexOf('plant_part');
        const iStage = header.indexOf('life_stage');
        const iRef = header.indexOf('reference');
        const iNotes = header.indexOf('notes');
        if (iInsect < 0 || iPlant < 0) return;
        const out = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line || !line.trim()) continue;
          // simple CSV split (publicは安全に整形済み)
          const cols = [];
          let buf = '', q = false;
          for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            if (q) {
              if (ch === '"') {
                if (line[j + 1] === '"') { buf += '"'; j++; } 
                else { q = false; }
              } else { buf += ch; }
            } else {
              if (ch === '"') q = true;
              else if (ch === ',') { cols.push(buf); buf = ''; }
              else { buf += ch; }
            }
          }
          cols.push(buf);
          const insect = (cols[iInsect] || '').trim();
          if (insect !== resolvedInsectId) continue;
          const plant = (cols[iPlant] || '').trim();
          if (!plant || plant === '不明' || /^(\d{3,4})$/.test(plant)) continue;
          out.push({
            name: plant,
            family: (cols[iFamily] || '').trim(),
            displayName: (cols[iFamily] || '').trim() ? `${plant}（${(cols[iFamily] || '').trim()}）` : plant,
            observationType: (cols[iObs] || '').trim() || '文献',
            plantPart: (cols[iPart] || '').trim() || '',
            lifeStage: (cols[iStage] || '').trim() || '',
            reference: (cols[iRef] || '').trim() || '',
            notes: (cols[iNotes] || '').trim() || '',
            isDetailed: true
          });
        }
        if (!aborted && out.length > 0) setFallbackHostPlants(out);
      })
      .catch(() => {})
    return () => { aborted = true; };
  }, [moth, resolvedInsectId]);
  
  const [graphDimensions, setGraphDimensions] = useState({ width: 0, height: 500 });
  const graphContainerRef = useRef(null);
  // 重い力学グラフはスクロールで近づくまでダウンロード・マウントしない
  const graphNearViewport = useNearViewport(graphContainerRef);

  useLayoutEffect(() => {
    const updateSize = () => {
      const width = graphContainerRef.current?.offsetWidth || 0;
      if (width > 0) {
        setGraphDimensions({
          width,
          height: 500
        });
      }
    };
    
    window.addEventListener('resize', updateSize);
    updateSize();
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Debug logging for ID mapping
  if (insectId !== mappedInsectId) {
    logger.debug(`ID mapped: ${insectId} -> ${mappedInsectId}`);
  }
  
  // Add specific debug for アオバシャチホコ search
  if (insectId === 'species-4601' || insectId === 'catalog-3123' || mappedInsectId === 'species-4601') {
    logger.debug('🔍 DEBUG アオバシャチホコ search:', {
      originalId: insectId,
      mappedId: mappedInsectId,
      allInsectsLength: allInsects.length,
      mothsLength: moths.length,
      foundMoth: moth,
      foundMothId: moth?.id,
      foundMothName: moth?.name,
      isDataLoading: isDataLoading
    });
    
    // Search manually to see if species-4601 exists
    const manualSearch = allInsects.find(m => m.id === 'species-4601');
    logger.debug('🔍 Manual search for species-4601:', manualSearch);
    
    // Show first few moths for debugging
    logger.debug('🔍 First 5 moths:', moths.slice(0, 5).map(m => ({ id: m.id, name: m.name })));
  }
  
  // Debug for catalog-2090 (ヒメウコンカギバ)
  if (mappedInsectId === 'catalog-2090') {
    logger.debug('DEBUG MothDetail: catalog-2090 (ヒメウコンカギバ) display:', {
      id: moth?.id,
      name: moth?.name,
      remarks: moth?.remarks,
      geographicalRemarks: moth?.geographicalRemarks,
      type: moth?.type,
      hostPlants: moth?.hostPlants,
      hasRemarks: !!(moth?.remarks && moth?.remarks.trim()),
      remarksIncludesPipe: moth?.remarks?.includes('|')
    });
  }
  
  // Breadcrumb UI removed per request

  // Debug logging for オオゴマシジミ
  if (mappedInsectId === 'butterfly-csv-131' || (moth && moth.name === 'オオゴマシジミ')) {
    logger.debug('=== DEBUG オオゴマシジミ SEARCH ===');
    logger.debug('  insectId:', insectId);
    logger.debug('  mappedInsectId:', mappedInsectId);
    logger.debug('  found moth:', moth);
    if (moth) {
      logger.debug('  moth.name:', moth.name);
      logger.debug('  moth.geographicalRemarks:', moth.geographicalRemarks);
      logger.debug('  moth.type:', moth.type);
    }
    logger.debug('  butterflies array length:', butterflies.length);
    const ogomaButterfly = butterflies.find(b => b.name === 'オオゴマシジミ');
    logger.debug('  direct search for オオゴマシジミ in butterflies:', ogomaButterfly);
  }
  
  // Debug logging for catalog-6065 (スミレモンキリガ)
  if (mappedInsectId === 'catalog-6065') {
    logger.debug('DEBUG catalog-6065: Found moth:', moth);
    if (moth) {
      logger.debug('DEBUG catalog-6065: hostPlants:', moth.hostPlants);
      logger.debug('DEBUG catalog-6065: hostPlantDetails:', moth.hostPlantDetails);
      // Log the actual plant names
      if (Array.isArray(moth.hostPlants) && moth.hostPlants.length > 0) {
        moth.hostPlants.forEach((plant, index) => {
          logger.debug(`DEBUG catalog-6065: hostPlant[${index}] = "${plant}"`);
        });
      }
      if (moth.hostPlantDetails && moth.hostPlantDetails.length > 0) {
        moth.hostPlantDetails.forEach((detail, index) => {
          logger.debug(`DEBUG catalog-6065: hostPlantDetail[${index}] = `, detail);
        });
      }
    }
  }
  

  // Debug logging for センモンヤガ
  if (mappedInsectId === 'catalog-3489' || mappedInsectId === 'main-6519') {
    logger.debug('DEBUG: Looking for センモンヤガ with ID:', mappedInsectId);
    logger.debug('DEBUG: Found moth:', moth);
    if (moth) {
      logger.debug('DEBUG: センモンヤガ hostPlants:', moth.hostPlants);
      logger.debug('DEBUG: センモンヤガ hostPlantDetails:', moth.hostPlantDetails);
    }
  }
  
  const [imageExtensions, setImageExtensions] = useState({});
  const [imageBases, setImageBases] = useState([]);
  const imageBaseSet = React.useMemo(() => new Set(imageBases || []), [imageBases]);
  const isImageIndexReady = imageBases.length > 0 || Object.keys(imageExtensions || {}).length > 0;
  const normalizedImageEntries = React.useMemo(
    () => buildNormalizedEntries(imageBaseSet, imageExtensions),
    [imageBaseSet, imageExtensions],
  );

  useEffect(() => {
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        setImageExtensions(exts || {});
        setImageBases(Array.from(names || []));
      })
      .catch((error) => {
        logger.debug('Failed to load insect image indexes:', error);
        setImageExtensions({});
        setImageBases([]);
      });
  }, []);

  const mappedScientificFilename = moth ? getMappedScientificFilename(moth.name) : '';
  const safeFilename = moth
    ? (mappedScientificFilename || moth.scientificFilename || createSafeInsectFilename(moth.scientificName))
    : '';
  const japaneseName = moth?.name || '';

  const possibleImagePaths = React.useMemo(() => {
    if (!moth) return [];

    const exts = imageExtensions || {};
    const ready = isImageIndexReady;
    const build = (name, width = 1024) => buildResizedImageUrl({
      baseUrl: import.meta.env.BASE_URL || '/',
      folder: 'insects',
      filename: name,
      width,
      query: cacheBustRef.current,
    });
    const uniq = new Set();
    const push = (url) => { if (url && !uniq.has(url)) uniq.add(url); };
    const pushResizedSet = (name) => {
      push(build(name, 1024));
      push(build(name, 640));
      push(build(name, 320));
    };

    const rawBaseCandidates = buildInsectImageBaseCandidates(moth, mappedScientificFilename);
    const baseNameCandidates = ready
      ? resolveImageBaseCandidates(rawBaseCandidates, {
          imageExtensions: exts,
          imageNames: imageBaseSet,
          normalizedEntries: normalizedImageEntries,
          includeUnresolved: false,
        })
      : rawBaseCandidates;
    baseNameCandidates.forEach(pushResizedSet);

    try {
      if (imageBases && imageBases.length > 0 && moth.scientificName) {
        const sci = moth.scientificName.replace(/\s*\(.*$/, '').trim();
        const [genus, species] = sci.split(/\s+/);
        if (genus && species) {
          const candidates = imageBases.filter(base => base.includes(genus) && base.includes(species));
          candidates.sort((a, b) => a.length - b.length);
          for (const base of candidates) {
            if (exts[base] || imageBaseSet.has(base)) {
              pushResizedSet(base);
            }
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to derive additional image candidates:', error);
    }

    if (uniq.size === 0) {
      push(`${import.meta.env.BASE_URL}images/placeholder.jpg`);
    }

    return Array.from(uniq);
  }, [
    imageExtensions,
    imageBases,
    moth,
    isImageIndexReady,
    imageBaseSet,
    mappedScientificFilename,
    normalizedImageEntries,
  ]);

  const fallbackImageCandidates = React.useMemo(
    () => possibleImagePaths.slice(1),
    [possibleImagePaths],
  );

  const mainImageProps = React.useMemo(() => {
    const firstUrl = possibleImagePaths[0];
    if (!firstUrl) return { base: '', src: null, sources: [] };
    
    const base = getImageBaseFromResizedUrl(firstUrl);
    if (base && imageBaseSet.has(base)) {
      const { src, srcSet, sizes, sources } = buildResponsivePicture({ folder: 'insects', filename: base, widths: [320, 640, 1024], sizes: '100vw' });
      return { base, src, srcSet, sizes, sources };
    }
    return { base: '', src: firstUrl, sources: [] };
  }, [possibleImagePaths, imageBaseSet]);

  const additionalImageProps = React.useMemo(() => {
    const primaryBase = mainImageProps.base;
    if (!primaryBase || !Array.isArray(imageBases) || imageBases.length === 0) {
      return [];
    }
    const variantPattern = new RegExp(`^${escapeRegExp(primaryBase)}_(\\d+)$`);
    return imageBases
      .map((base) => {
        const match = String(base).match(variantPattern);
        if (!match) return null;
        return {
          base,
          order: Number.parseInt(match[1], 10) || Number.MAX_SAFE_INTEGER,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order || a.base.localeCompare(b.base))
      .map(({ base }) => ({
        base,
        ...buildResponsivePicture({
          folder: 'insects',
          filename: base,
          widths: [320, 640, 1024],
          sizes: '(max-width: 640px) 50vw, 33vw',
        }),
      }));
  }, [imageBases, mainImageProps.base]);

  const hasInstagramPost = Boolean(moth?.instagramUrl && moth.instagramUrl.trim());

  // 実写真が解決できたか（候補ゼロでプレースホルダーだけの場合はfalse）
  const hasRealPhoto =
    Boolean(mainImageProps.base) ||
    (typeof mainImageProps.src === 'string' && !mainImageProps.src.includes('placeholder.jpg'));

  // 写真ライトボックスの開閉状態（画像リストはprimaryName確定後にlightboxImagesとして構築）
  const [lightboxState, setLightboxState] = useState({ open: false, index: 0 });
  const openLightbox = useCallback((index) => {
    setLightboxState({ open: true, index });
  }, []);
  const closeLightbox = useCallback(() => {
    setLightboxState((prev) => ({ ...prev, open: false }));
  }, []);
  // 写真パネルを出すか。画像インデックス読み込み中は写真がある前提で枠を維持し、
  // 写真ゼロと確定したら巨大な空箱を出さずコンパクトな通知に切り替える
  const showPhotoPanel = hasInstagramPost || hasRealPhoto || !isImageIndexReady;

  const nameAliasInfo = React.useMemo(() => {
    return splitJapaneseNameAliases(moth?.name || '');
  }, [moth?.name]);

  const displayName = nameAliasInfo?.name || moth?.name || '';

  // Filter alternative names to exclude duplicates of the primary name
  const alternativeNamesFiltered = React.useMemo(() => {
    const raw = (moth?.alternativeNames || '').trim();
    const items = raw
      ? raw.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
      : [];
    const combined = new Set([...(nameAliasInfo?.aliases || []), ...items]);
    if (displayName) combined.delete(displayName);
    if (moth?.name) combined.delete(moth.name);
    return Array.from(combined).join('、');
  }, [moth?.alternativeNames, moth?.name, nameAliasInfo?.aliases, displayName]);

  // General-notes emergence-time detector (type is not fixed)
  const isEmergenceNote = (note) => {
    const t = (note?.type || '').trim();
    const c = (note?.content || '').trim();
    if (!c) return false;
    const typeHit = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期']
      .some(k => t.includes(k));
    const contentHit = /\d+\s*月|成虫|発生/.test(c);
    return typeHit || (!t && contentHit);
  };

  const cleanPlantName = (plant = '') => {
    if (!plant) return '';
    return String(plant).replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
  };

  const isFlowerVisitRecord = (record) => {
    if (!record || typeof record !== 'object') return false;
    if (record.isFlowerVisit === true) return true;
    const lifeStage = (record.lifeStage || '').trim();
    const plantPart = (record.plantPart || '').trim();
    const partCompact = plantPart.replace(/\s+/g, '');
    const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
    return isAdultOrUnknown && partCompact && partCompact.includes('花');
  };

  const extractLarvalHostPlants = (insect) => {
    if (!insect) return [];
    if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
      const detailedPlants = insect.hostPlantsDetailed
        .filter(isPlantHostRecord)
        .filter(record => !isFlowerVisitRecord(record))
        .map(record => cleanPlantName(record?.name ? String(record.name).trim() : ''))
        .filter(name => name && name !== '不明');
      if (detailedPlants.length > 0) {
        return Array.from(new Set(detailedPlants));
      }
    }
    if (Array.isArray(insect.hostPlants)) {
      const plants = insect.hostPlants
        .map(plant => cleanPlantName(plant))
        .filter(name => name && name !== '不明');
      return Array.from(new Set(plants));
    }
    if (typeof insect.hostPlants === 'string') {
      const plants = insect.hostPlants.split(/[;；、,]/)
        .map(plant => cleanPlantName(plant))
        .filter(name => name && name !== '不明');
      return Array.from(new Set(plants));
    }
    return [];
  };

  // SEO（メタ/カノニカル/パンくず）を共通フックで設定
  const insectTypeLabel = moth
    ? (isEnglish
      ? getInsectSectionConfig(moth.type, routeType || 'moth').labelEn
      : getInsectSectionConfig(moth.type, routeType || 'moth').label)
    : isEnglish
      ? 'Insect'
      : '昆虫';
  const larvalHostPlants = extractLarvalHostPlants(moth);
  const hostPlantsText = larvalHostPlants.length > 0
    ? larvalHostPlants.join(isEnglish ? ', ' : '、')
    : (isEnglish ? 'not recorded' : '不明');
  const primaryName = moth
    ? (isEnglish
      ? getPrimaryEnglishName({
          scientificName: moth.scientificName,
          japaneseName: displayName || moth.name,
          fallback: moth.id,
        })
      : displayName || moth.name)
    : '';
  const japaneseReference = isEnglish
    ? buildJapaneseReferenceLabel(displayName || moth?.name || '')
    : '';

  // 写真ライトボックス用の画像リスト（植物詳細と同じImageModalを共用）
  const lightboxImages = React.useMemo(() => {
    if (!moth || !hasRealPhoto || hasInstagramPost) return [];
    const speciesLabel = isEnglish ? primaryName : moth.name;
    const main = {
      id: 'main',
      src: mainImageProps.src,
      originalCandidates: [mainImageProps.src, ...fallbackImageCandidates].filter(Boolean),
      alt: isEnglish
        ? `${primaryName} photograph`
        : `${moth.name}（${moth.scientificName}）の写真`,
      label: speciesLabel,
    };
    const extras = additionalImageProps.map((image, index) => ({
      id: image.base,
      src: image.src,
      alt: isEnglish
        ? `${primaryName} photograph ${index + 2}`
        : `${moth.name}（${moth.scientificName}）の写真 ${index + 2}`,
      label: isEnglish ? `${speciesLabel} (${index + 2})` : `${speciesLabel}（${index + 2}枚目）`,
    }));
    return [main, ...extras];
  }, [moth, hasRealPhoto, hasInstagramPost, isEnglish, primaryName, mainImageProps.src, fallbackImageCandidates, additionalImageProps]);
  const familyChip = buildLocalizedTaxonomyChip({
    locale,
    japaneseName: moth?.classification?.familyJapanese,
    scientificName: moth?.classification?.family,
    fallback: moth?.family,
  });
  const orderChip = buildLocalizedTaxonomyChip({
    locale,
    japaneseName: INSECT_ORDER_LABELS[moth?.type || routeType]?.ja,
    scientificName: INSECT_ORDER_LABELS[moth?.type || routeType]?.en,
  });
  const genusChipLabel = String(
    moth?.classification?.genus ||
      moth?.scientificName?.trim().split(/\s+/)[0] ||
      '',
  ).trim();
  const subfamilyChip = buildLocalizedTaxonomyChip({
    locale,
    japaneseName: moth?.classification?.subfamilyJapanese,
    scientificName: moth?.classification?.subfamily,
  });
  const tribeChip = buildLocalizedTaxonomyChip({
    locale,
    japaneseName: moth?.classification?.tribeJapanese,
    scientificName: moth?.classification?.tribe,
  });
  const canonicalHref = moth
    ? absUrl(
      isEnglish
        ? (
          englishInsectRouteMap[moth.id] ||
          localizePath(location.pathname || buildInsectPath(moth, locale), locale)
        )
        : buildInsectMetaPagePath(moth.type, moth.id, routeType || 'moth')
    )
    : undefined;
  const alternateJaHref = moth
    ? absUrl(buildInsectMetaPagePath(moth.type, moth.id, routeType || 'moth', 'ja'))
    : absUrl(localizePath(location.pathname, 'ja'));
  const alternateEnHref = moth
    ? absUrl(
      englishInsectRouteMap[moth.id] ||
      localizePath(location.pathname, 'en')
    )
    : absUrl(localizePath(location.pathname, 'en'));
  const pageTitle = moth
    ? (isEnglish
      ? `${primaryName} | ${insectTypeLabel} profile from Japan`
      : `${displayName || moth.name} (${moth.scientificName}) | ${insectTypeLabel}の詳細 - 昆虫植物図鑑`)
    : isEnglish
      ? `Insect profile | ${EN_SITE_NAME}`
      : '昆虫詳細 - 昆虫植物図鑑';
  const pageDesc = moth
    ? (isEnglish
      ? `${primaryName}. ${japaneseReference || 'Japanese common names are shown only as local references.'} Recorded host plants: ${hostPlantsText}.`
      : `${displayName || moth.name}（${moth.scientificName}）の詳細情報。食草: ${hostPlantsText}。昆虫植物図鑑で${insectTypeLabel}と植物の関係を詳しく学ぼう。`)
    : isEnglish
      ? 'Detailed profile for an insect recorded in Japan.'
      : '昆虫の詳細情報。';
  const shareUrl =
    canonicalHref ||
    (typeof window !== 'undefined' && window.location?.href) ||
    '';
  const shareTitle = moth
    ? (isEnglish ? primaryName : `${displayName || moth.name}（${moth.scientificName}）`)
    : isEnglish ? EN_SITE_NAME : '昆虫植物図鑑';
  const shareText = isEnglish ? `${shareTitle} | ${EN_SITE_NAME}` : `${shareTitle}｜昆虫植物図鑑`;
  const quizFocusHref = moth && (moth.type === 'moth' || moth.type === 'butterfly')
    ? `${localizePath('/quiz', locale)}?mode=insect-to-plant&style=photo&focusInsect=${encodeURIComponent(moth.id || moth.name)}`
    : '';
  const detailUi = {
    noteLabel: isEnglish ? 'Notes:' : '備考:',
    sourceLabel: isEnglish ? 'Source:' : '出典:',
    ecologyLabel: isEnglish ? 'Ecology' : '生態情報',
    feedingHabitLabel: isEnglish ? 'Feeding habit:' : '食性:',
    detailsLabel: isEnglish ? 'Details:' : '詳細情報:',
    adultSeasonLabel: isEnglish ? 'Adult season' : '発生時期',
    extractedFromNotes: isEnglish ? 'Extracted from notes' : '備考欄から抽出',
    extractedFromGeneralNotes: isEnglish ? 'Extracted from general_notes.csv' : 'general_notes.csvから抽出',
    literatureHostPlantLabel: isEnglish ? 'Host-plant record from literature:' : '食草情報（文献記録）:',
  };
  const translateFeedingHabit = (value = '') => {
    if (!isEnglish) return value;
    return ({
      単食性: 'Monophagous',
      広食性: 'Polyphagous',
      狭食性: 'Oligophagous',
    })[value] || value;
  };
  const ecologyNotes = React.useMemo(() => {
    const notes = Array.isArray(moth?.generalNotes) ? moth.generalNotes : [];
    const seen = new Set();
    return notes
      .filter((note) => {
        const type = (note?.type || '').trim();
        const content = (note?.content || '').trim();
        return (type === '生態情報' || type === '生態') && content && content !== '不明';
      })
      .map((note) => ({
        content: String(note.content || '').trim(),
        reference: note.reference || '',
      }))
      .filter((note) => {
        if (seen.has(note.content)) return false;
        seen.add(note.content);
        return true;
      });
  }, [moth?.generalNotes]);
  const shareXUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const shareLineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;
  const [copyFeedback, setCopyFeedback] = useState('idle');
  const copyFeedbackTimeoutRef = useRef(null);
  const plantPartsInfo = React.useMemo(() => {
    const extracted = extractPlantPartsFromNotes(moth?.hostPlantNotes);

    if (moth?.id === 'catalog-6065') {
      allowDebugLogs && console.log('DEBUG catalog-6065 plant parts extraction:', {
        hostPlantNotes: moth.hostPlantNotes,
        extractedParts: extracted
      });
    }

    return extracted;
  }, [allowDebugLogs, moth?.hostPlantNotes, moth?.id]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;

    const setFeedbackWithReset = (nextStatus) => {
      setCopyFeedback(nextStatus);
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setCopyFeedback('idle');
        copyFeedbackTimeoutRef.current = null;
      }, 2000);
    };

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setFeedbackWithReset('success');
        return;
      }

      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        setFeedbackWithReset(copied ? 'success' : 'error');
        return;
      }

      setFeedbackWithReset('error');
    } catch {
      setFeedbackWithReset('error');
    }
  }, [shareUrl]);

  const { setOgTwitterImage } = useSeoMeta({
    title: pageTitle,
    description: pageDesc,
    ogType: 'article',
    url: canonicalHref,
    locale: isEnglish ? 'en_US' : 'ja_JP',
    htmlLang: locale,
    siteName: isEnglish ? EN_SITE_NAME : '昆虫植物図鑑',
    alternates: [
      { hreflang: 'ja', href: alternateJaHref },
      { hreflang: 'en', href: alternateEnHref },
      { hreflang: 'x-default', href: alternateEnHref },
    ],
    breadcrumbItems: moth ? [
      { name: isEnglish ? EN_SITE_NAME : '昆虫植物図鑑', url: absUrl(localizePath('/', locale)) },
      { name: insectTypeLabel, url: absUrl(localizePath(`/?tab=insects`, locale)) },
      { name: primaryName || displayName || moth.name, url: canonicalHref }
    ] : undefined,
    resetCanonicalTo: absUrl(localizePath('/', locale))
  });

  useEffect(() => {
    if (!moth) return;
    if (mainImageProps.src) {
      setOgTwitterImage(
        mainImageProps.src,
        isEnglish
          ? `${moth.scientificName || moth.name} photograph`
          : `${moth.name}（${moth.scientificName}）の写真`,
      );
    }
  }, [isEnglish, mainImageProps.src, moth, setOgTwitterImage]);

  // ソフト404対策: 存在しない種のURLは検索エンジンにインデックスさせない
  // （データ読み込み完了後に判定。植物詳細のthin-contentガードと同じ方式）
  useEffect(() => {
    try {
      if (isDataLoading) return;
      setRobotsMetaContent(moth ? INDEX_FOLLOW_ROBOTS : NOINDEX_FOLLOW_ROBOTS);
    } catch {}
  }, [isDataLoading, moth]);

  // Show loading state if data is still loading
  // （スピナー1個の全画面ではなく、実レイアウトに合わせたスケルトンでシフトを抑える）
  if (isDataLoading) {
    return <DetailSkeleton />;
  }

  if (!moth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-400 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            {isEnglish ? 'Insect not found' : '昆虫が見つかりません'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {isEnglish
              ? 'No insect matched the requested path.'
              : '指定されたIDの昆虫は存在しません。'}
          </p>
          <Link 
            to={localizePath('/?tab=insects', locale)} 
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {isEnglish ? 'Back to list' : 'リストに戻る'}
          </Link>
        </div>
      </div>
    );
  }

  // Group related moths by host plant
  const relatedMothsByPlant = {};
  
  // Use larval host plants only (exclude adult flower visits)
  const currentMothPlants = extractLarvalHostPlants(moth);

  currentMothPlants.forEach(plant => {
    // Extract base plant name for matching (e.g., "フジの花蕾" -> "フジ")
    let basePlantName = plant;
    const partMatch = plant.match(/^([^の]+)の/);
    if (partMatch) {
      basePlantName = partMatch[1];
    }
    
    // Try both full plant name and base plant name
    const plantsToCheck = [plant, basePlantName];
    
    plantsToCheck.forEach(checkPlant => {
      if (hostPlants[checkPlant]) {
        const relatedMoths = hostPlants[checkPlant].filter(mothName => mothName !== moth.name);
        if (relatedMoths.length > 0) {
          // Use base plant name for display (without parts like "の花蕾")
          if (!relatedMothsByPlant[basePlantName]) {
            relatedMothsByPlant[basePlantName] = [];
          }
          // Add unique moths only
          relatedMoths.forEach(mothName => {
            if (!relatedMothsByPlant[basePlantName].includes(mothName)) {
              relatedMothsByPlant[basePlantName].push(mothName);
            }
          });
        }
      }
    });
  });

  // Debug logging for アオバシャチホコ
  if (moth.name === 'アオバシャチホコ') {
    logger.debug('DEBUG アオバシャチホコ関連昆虫:', {
      currentMothPlants,
      relatedMothsByPlant,
      hostPlantsKeys: Object.keys(hostPlants),
      hostPlantsForヤマボウシ: hostPlants['ヤマボウシ'],
      hostPlantsForミズキ: hostPlants['ミズキ'],
      hostPlantsForクマノミズキ: hostPlants['クマノミズキ']
    });
  }

  // Also keep the old format for backward compatibility
  const relatedMoths = new Set();
  currentMothPlants.forEach(plant => {
    // Extract base plant name for matching (e.g., "フジの花蕾" -> "フジ")
    let basePlantName = plant;
    const partMatch = plant.match(/^([^の]+)の/);
    if (partMatch) {
      basePlantName = partMatch[1];
    }
    
    // Try both full plant name and base plant name
    const plantsToCheck = [plant, basePlantName];
    
    plantsToCheck.forEach(checkPlant => {
      if (hostPlants[checkPlant]) {
        hostPlants[checkPlant].forEach(mothName => {
          if (mothName !== moth.name) {
            relatedMoths.add(mothName);
          }
        });
      }
    });
  });

  // Debug logging
  logger.debug('Moth ID:', moth?.id);
  logger.debug('Instagram URL:', moth?.instagramUrl);
  logger.debug('Has Instagram Post:', hasInstagramPost);

  const renderFoodWebCard = (containerRef, className, id) => (
    <div id={id} data-section-id={id} className={`${className} scroll-mt-28`} ref={containerRef}>
      <div className="bg-white/85 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/90 text-white flex items-center justify-center shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isEnglish ? 'Plant relationships' : '食草・食樹'}
              </p>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isEnglish ? 'Plants used by this species' : '食草ネットワーク'}
              </h2>
            </div>
          </div>
        </div>

        {/* 凡例はグラフ内ツールバーの表示（絞り込みに追従する）に一本化し、二重表示を避ける */}
        <div className="h-[560px] lg:h-[820px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950/25">
          {graphDimensions.width === 0 || !graphNearViewport ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-sm animate-pulse">
              <div className="w-24 h-24 mb-4 rounded-full bg-emerald-200/60 dark:bg-emerald-900/40"></div>
              <div className="h-3 w-40 rounded-full bg-slate-200 dark:bg-slate-700 mb-2"></div>
              <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-700"></div>
            </div>
          ) : (
            <React.Suspense fallback={
              <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                {isEnglish ? 'Loading network graph...' : 'ネットワーク図を読み込み中...'}
              </div>
            }>
              <FoodWebGraph
                currentInsect={moth}
                allInsects={allInsects}
                plantDetails={plantDetails}
                hostPlantsMap={hostPlants}
                flowerVisitPlants={flowerVisitPlants}
                width={graphDimensions.width}
                height={graphDimensions.height}
                imageExtensions={imageExtensions}
                theme={theme}
                locale={locale}
              />
            </React.Suspense>
          )}
        </div>
      </div>
    </div>
  );
  
  if (moth?.type === 'beetle' || moth?.type === 'longhornbeetle') {
    allowDebugLogs && console.log('DEBUG: Beetle detail view:', {
      name: moth.name,
      scientificName: moth.scientificName,
      scientificFilename: moth.scientificFilename,
      safeFilename,
      japaneseName,
      imageExtensions,
      possibleImagePaths
    });
  }

  const displayedRemarks = new Set();
  const markRemarkAsDisplayed = (content) => {
    const normalized = typeof content === 'string' ? content.trim() : '';
    if (!normalized || displayedRemarks.has(normalized)) {
      return false;
    }
    displayedRemarks.add(normalized);
    return true;
  };

  // 文献記録などに現れる植物名が植物ページを持つ場合だけリンク先を返す
  // （辞書に無い名前・「不明」はリンクにしない）
  const resolveLinkablePlantName = (rawName) => {
    const name = String(rawName || '').trim();
    if (!name || name === '不明') return null;
    const withoutParens = name.replace(/[（(][^（()）]*[）)]/g, '').trim();
    const candidates = name === withoutParens ? [name] : [name, withoutParens];
    for (const candidate of candidates) {
      if (
        (hostPlants && Object.prototype.hasOwnProperty.call(hostPlants, candidate)) ||
        (plantDetails && Object.prototype.hasOwnProperty.call(plantDetails, candidate))
      ) {
        return candidate;
      }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 sm:pt-6">
      {/* 構造化データ */}
      {mothId && moth && <MothStructuredData moth={moth} />}
      {butterflyId && moth && <ButterflyStructuredData butterfly={moth} />}
      {beetleId && moth && <BeetleStructuredData beetle={moth} />}
      {longhornbeetleId && moth && <LonghornBeetleStructuredData longhornbeetle={moth} />}
      {leafbeetleId && moth && <LeafBeetleStructuredData leafbeetle={moth} />}
      {aphidId && moth && <AphidStructuredData aphid={moth} />}
      {/* モバイルはヘッダー直下の余白を詰める（pt-3）。sm以上は従来の余白 */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-8 sm:pt-8">
        {/* パンくずリスト */}
        <div className="hidden md:block">
          <Breadcrumb
            locale={locale}
            items={[
              { label: isEnglish ? 'Home' : 'ホーム', path: localizePath('/', locale) },
              { label: insectTypeLabel, path: localizePath(`/?tab=insects`, locale) },
              ...(familyChip.label && familyChip.queryValue
                ? [{
                    label: familyChip.label,
                    path: localizePath(`/?classification=${encodeURIComponent(familyChip.queryValue)}`, locale),
                  }]
                : []),
              {
                label: isEnglish && moth.scientificName
                  ? <span className="whitespace-nowrap break-keep">{formatScientificNameReact(primaryName)}</span>
                  : (primaryName || moth.name),
              }
            ]}
          />
        </div>
        {/* モバイルは1行横スクロールにして冒頭の折り返しゴチャつきを防ぐ */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scroll-fade-right sm-scroll-fade-none [&>*]:shrink-0 sm:mb-6 sm:flex-wrap sm:overflow-visible sm:pb-0 lg:mb-8">
          <Link
            to={getBackTarget(location, localizePath('/?tab=insects', locale))}
            state={makeDetailLinkState(location)}
            className="ui-btn ui-btn-secondary whitespace-nowrap px-3 py-2 text-xs shadow-sm transition-transform hover:shadow-md active:scale-95 sm:text-sm"
          >
            <svg className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="sm:hidden">{isEnglish ? 'Back' : '一覧へ'}</span>
            <span className="hidden sm:inline">{isEnglish ? 'Back to list' : '一覧に戻る'}</span>
          </Link>
          {orderChip.label && (
            <span className="inline-flex items-center rounded-lg border border-emerald-200/60 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300 sm:px-3 sm:text-sm">
              <span className="font-medium">{orderChip.label}</span>
              {orderChip.referenceLabel && (
                <span className="ml-1 hidden text-[11px] opacity-80 sm:inline">{orderChip.referenceLabel}</span>
              )}
            </span>
          )}
          {familyChip.label && familyChip.queryValue && (
            <Link
              to={localizePath(`/?classification=${encodeURIComponent(familyChip.queryValue)}`, locale)}
              className="inline-flex items-center rounded-lg border border-blue-200/60 bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 transition-all duration-200 hover:bg-blue-200 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 sm:px-3 sm:text-sm"
            >
              <span className="font-medium">{familyChip.label}</span>
              {familyChip.referenceLabel && (
                <span className="ml-1 hidden text-[11px] opacity-80 sm:inline">{familyChip.referenceLabel}</span>
              )}
            </Link>
          )}
          {genusChipLabel && (
            <Link
              to={localizePath(`/?tab=insects&q=${encodeURIComponent(genusChipLabel)}`, locale)}
              className="inline-flex items-center rounded-lg border border-slate-200/60 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 transition-all duration-200 hover:bg-slate-200 dark:border-slate-700/50 dark:bg-slate-900/30 dark:text-slate-300 dark:hover:bg-slate-900/50 sm:px-3 sm:text-sm"
            >
              <span className="font-medium italic">{genusChipLabel}</span>
            </Link>
          )}
          {subfamilyChip.label && subfamilyChip.queryValue && (
            <Link
              to={localizePath(`/?classification=${encodeURIComponent(subfamilyChip.queryValue)}`, locale)}
              className="hidden items-center rounded-lg border border-emerald-200/50 bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 transition-all duration-200 hover:bg-emerald-200 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 lg:inline-flex"
            >
              <span className="font-medium">{subfamilyChip.label}</span>
              {subfamilyChip.referenceLabel && (
                <span className="ml-1 text-xs opacity-80">{subfamilyChip.referenceLabel}</span>
              )}
            </Link>
          )}
          {tribeChip.label && tribeChip.queryValue && (
            <Link
              to={localizePath(`/?classification=${encodeURIComponent(tribeChip.queryValue)}`, locale)}
              className="hidden items-center rounded-lg border border-blue-200/50 bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 transition-all duration-200 hover:bg-blue-200 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 xl:inline-flex"
            >
              <span className="font-medium">{tribeChip.label}</span>
              {tribeChip.referenceLabel && (
                <span className="ml-1 text-xs opacity-80">{tribeChip.referenceLabel}</span>
              )}
            </Link>
          )}
        </div>


        {/* モバイルは写真ファーストの1カラム。lg以上は写真を左に固定した2カラムにして、
            初期表示で種名・食草情報が写真と同時に見えるようにする。
            写真が無い種では2カラムをやめ、種名を先頭にした1カラムに畳む */}
        <div className={showPhotoPanel ? 'space-y-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0' : 'space-y-6'}>
          {!showPhotoPanel && (
            <div className="rounded-card border border-line bg-surface shadow-e1 flex items-center gap-2.5 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>
                {isEnglish
                  ? 'No photographs of this species are registered yet.'
                  : 'この種の写真はまだ登録されていません。'}
              </span>
            </div>
          )}
          {showPhotoPanel && (
          <div id="plant-photos" className="lg:sticky lg:top-24 lg:col-span-3">
            <div>
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-white/20 dark:border-slate-700/50">
                {hasInstagramPost ? (
                  <div className="p-3">
                    <InstagramEmbed url={moth.instagramUrl} />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] bg-blue-50 dark:bg-blue-900/20 group overflow-hidden">
                    <ImageWithFallback
                      src={mainImageProps.src}
                      srcSet={mainImageProps.srcSet}
                      sizes={mainImageProps.sizes}
                      sources={mainImageProps.sources}
                      alt={isEnglish
                        ? `${primaryName} photograph`
                        : `${moth.name}（${moth.scientificName}）の写真 - ${moth.classification?.familyJapanese || '蛾科'}に属する昆虫`}
                      width="1200"
                      height="900"
                      className="w-full h-full"
                      imgClassName="transition-all duration-700 group-hover:scale-105"
                      candidates={fallbackImageCandidates}
                      fallbackSrc={null}
                      loading="eager"
                      fetchPriority="high"
                    />
                    
                    {/* Elegant gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                    {/* Moth name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 pointer-events-none">
                      <h3 className="text-white font-bold text-lg drop-shadow-lg">
                        {isEnglish ? primaryName : moth.name}
                      </h3>
                      <p className="text-white/90 text-sm drop-shadow-md">
                        {isEnglish
                          ? (japaneseReference || moth.scientificName)
                          : formatScientificNameReact(moth.scientificName)}
                      </p>
                    </div>

                    {/* タップ/クリックで拡大（植物ページと同じライトボックス） */}
                    {lightboxImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openLightbox(0)}
                        className="absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset"
                        aria-label={isEnglish ? 'Enlarge photo' : '写真を拡大表示'}
                      >
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm sm:opacity-0 sm:transition-opacity sm:duration-300 sm:group-hover:opacity-100">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 7v6m-3-3h6m4 0a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          {isEnglish ? 'Zoom' : '拡大'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {!hasInstagramPost && additionalImageProps.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-white/80 dark:bg-slate-800/80 sm:grid-cols-3">
                    {additionalImageProps.map((image, index) => (
                      <button
                        key={image.base}
                        type="button"
                        onClick={() => openLightbox(index + 1)}
                        className="cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        aria-label={isEnglish
                          ? `Enlarge photograph ${index + 2}`
                          : `写真${index + 2}を拡大表示`}
                      >
                        <ImageWithFallback
                          src={image.src}
                          srcSet={image.srcSet}
                          sizes={image.sizes}
                          sources={image.sources}
                          alt={isEnglish
                            ? `${primaryName} photograph ${index + 2}`
                            : `${moth.name}（${moth.scientificName}）の写真 ${index + 2}`}
                          className="aspect-[4/3] w-full rounded-xl"
                          imgClassName="transition-transform duration-500 hover:scale-105"
                          fit="cover"
                          fallbackSrc={null}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="p-4">
                  {hasInstagramPost && (
                    <div className="flex items-center justify-end mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <InstagramIcon className="w-4 h-4 mr-2" />
                        Instagram
                      </span>
                    </div>
                  )}
                  
                  {hasInstagramPost && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <InstagramIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            {isEnglish ? 'Instagram post' : 'Instagram投稿'}
                          </span>
                        </div>
                        <a 
                          href={moth.instagramUrl} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                        >
                          {isEnglish ? 'Open post ->' : '投稿を見る →'}
                        </a>
                      </div>
                      {moth.instagramDate && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          <span className="font-medium">{isEnglish ? 'Posted:' : '投稿日:'}</span> {moth.instagramDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* 写真ライトボックス */}
          <ImageModal
            image={lightboxImages[lightboxState.index] || null}
            isOpen={lightboxState.open}
            onClose={closeLightbox}
            images={lightboxImages}
            currentIndex={lightboxState.index}
            onNavigate={(nextIndex) => setLightboxState({ open: true, index: nextIndex })}
            locale={locale}
          />

          {/* 情報セクション */}
          <div className={`space-y-4 ${showPhotoPanel ? 'lg:col-span-2' : ''}`}>
            
            {/* 種名情報 */}
            <div id="basic-info" className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden p-6">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
                {isEnglish ? formatScientificNameReact(primaryName) : displayName || moth.name}
              </h1>
              {isEnglish && japaneseReference && (
                <p className="text-base text-slate-600 dark:text-slate-400 mb-2">
                  {japaneseReference}
                </p>
              )}
              {!isEnglish && alternativeNamesFiltered && (
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-2">
                  別名: {alternativeNamesFiltered}
                </p>
              )}
              {!isEnglish && (
                <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">
                  {formatScientificNameReact(moth.scientificName)}
                </p>
              )}
              {/* クイズ導線は種名カード内に1つだけ置く
                  （冒頭チップ行に置くとヘッダーのクイズボタンと二重に見える。植物詳細と同じ配置） */}
              {quizFocusHref && (
                <Link
                  to={quizFocusHref}
                  className="mt-4 inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950"
                >
                  {isEnglish ? 'Review this insect in quiz' : 'この昆虫をクイズで復習'}
                </Link>
              )}
            </div>

            {/* 食草情報 */}
            <div id="host-plants" className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden">
              <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-emerald-200/30 dark:border-emerald-700/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {isEnglish ? 'Host plants and flower visits' : '食草・食樹 / 訪花'}
                    {moth.isMonophagous && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        {isEnglish ? 'Monophagous' : '単食性'}
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              
              <div className="p-4">
                {(() => {
                  const hostPlantsArray = Array.isArray(moth.hostPlants)
                    ? moth.hostPlants
                    : (typeof moth.hostPlants === 'string' && moth.hostPlants.trim()
                        ? moth.hostPlants.split(/[;；、,]/).map(p => p.trim()).filter(Boolean)
                        : []);
                  const hostPlantsDetailedArray = Array.isArray(moth.hostPlantsDetailed)
                    ? moth.hostPlantsDetailed
                    : (Array.isArray(moth.hostPlantDetails) ? moth.hostPlantDetails : []);
                  const mergedDetailed = (hostPlantsDetailedArray && hostPlantsDetailedArray.length > 0)
                    ? hostPlantsDetailedArray
                    : (fallbackHostPlants || []);
                  return (
                    <EnhancedHostPlantDisplay 
                      hostPlants={hostPlantsArray}
                      hostPlantsDetailed={mergedDetailed}
                      showDetailsByDefault={false}
                      maxDisplayCount={10}
                      locale={locale}
                      plantDetails={plantDetails}
                    />
                  );
                })()}

                {/* 食草備考表示 */}
                {moth.hostPlantNotes && moth.hostPlantNotes.length > 0 && (() => {
                  const hasStructuredHostPlantDetails =
                    (Array.isArray(moth.hostPlantsDetailed) && moth.hostPlantsDetailed.length > 0) ||
                    (Array.isArray(moth.hostPlantDetails) && moth.hostPlantDetails.length > 0) ||
                    (Array.isArray(fallbackHostPlants) && fallbackHostPlants.length > 0);
                  if (hasStructuredHostPlantDetails) return null;

                  const filteredNotes = moth.hostPlantNotes.filter(note => {
                      if (!note) return false; // 空の場合は除外
                      const normalizedNote = String(note).trim();
                      const isEmergenceFragment =
                        /^[0-9０-９]+[〜～~－-]\s*$/.test(normalizedNote) ||
                        /^[A-Za-z]\.?\s*(?:翌年|[0-9０-９]+月|羽化|出現|発生)/.test(normalizedNote) ||
                        /^(?:し、?|、|，|,)?(?:翌年|[0-9０-９]+月|[0-9０-９]+[〜～~－-]|羽化|出現|発生)/.test(normalizedNote) ||
                        (/(?:羽化|出現|発生|翌年[0-9０-９]+月頃まで)/.test(normalizedNote) &&
                          !/(?:寄主|食草|植物|葉|花|飼育)/.test(normalizedNote));
                      if (isEmergenceFragment) return false;
                      
                      // 既存の食草データから部位情報を抽出
                      const existingParts = new Set();
                      
                      // hostPlants から既存の部位情報を抽出
                      Array.isArray(moth.hostPlants) && moth.hostPlants.forEach(plant => {
                        // 括弧内の部位情報
                        const match = plant.match(/（([^）]+)）$/);
                        if (match) {
                          match[1].split('・').forEach(part => existingParts.add(part.trim()));
                        }
                        
                        // 「などの花」「など花」形式の部位情報
                        PLANT_PART_KEYWORDS.forEach(part => {
                          const extendedPattern = new RegExp(`(など|等)の?${part}`, 'g');
                          if (extendedPattern.test(plant)) {
                            existingParts.add(part);
                          }
                        });
                      });
                      
                      // hostPlantDetails から既存の部位情報を抽出
                      if (moth.hostPlantDetails) {
                        moth.hostPlantDetails.forEach(detail => {
                          // 括弧内の部位情報
                          const match = detail.plant.match(/（([^）]+)）$/);
                          if (match) {
                            match[1].split('・').forEach(part => existingParts.add(part.trim()));
                          }
                          
                          // 「などの花」「など花」形式の部位情報
                          PLANT_PART_KEYWORDS.forEach(part => {
                            const extendedPattern = new RegExp(`(など|等)の?${part}`, 'g');
                            if (extendedPattern.test(detail.plant)) {
                              existingParts.add(part);
                            }
                          });
                        });
                      }
                      
                      // 新たに抽出された部位情報も追加
                      const plantParts = plantPartsInfo || {};
                      Object.values(plantParts).flat().forEach(part => existingParts.add(part));
                      
                      // catalog-2604特別対応：「などの花」「の花」を含む備考は完全除去
                      if (moth.id === 'catalog-2604') {
                        allowDebugLogs && console.log('DEBUG catalog-2604 filtering note:', note);
                        // 「の花」「などの花」が含まれる場合は無条件で除去
                        if (note.includes('の花') || note.includes('など花') || note.includes('などの花')) {
                          allowDebugLogs && console.log('DEBUG catalog-2604: Filtering out flower note:', note);
                          return false;
                        }
                      }
                      
                      // 既に統合済みの部位情報を含む備考は除去
                      const hasExistingPart = Array.from(existingParts).some(part => note.includes(part));
                      if (hasExistingPart) {
                        // 部位情報のみの備考は除去（強化版）
                        // パターン1: 「の花」「の実」「から花」「で花」など
                        const simplePartPattern = /^[^、；;]*?(の|から|で)(花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)[^、；;]*?[。．]?$/;
                        // パターン2: 「などの花」「など花」「等の花」「等花」など
                        const extendedPartPattern = /^[^、；;]*?(など|等)(の)?(花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)[^、；;]*?[。．]?$/;
                        // パターン3: 単純な部位のみ「花」「実」など
                        const singlePartPattern = /^[^、；;]*?(花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)[^、；;]*?[。．]?$/;
                        
                        if (simplePartPattern.test(note) || extendedPartPattern.test(note) || singlePartPattern.test(note)) {
                          return false; // 部位情報のみの場合は除去
                        }
                        
                        // その他の重要な情報が含まれている場合のみ残す
                        const hasOtherImportantInfo = note.match(/生態|習性|時期|条件|環境|地域|分布/);
                        return hasOtherImportantInfo;
                      }
                      
                      // その他の一般的なフィルタリング
                      return !note.includes('花・若い翼果');
                    });
                  
                  // Debug logging for catalog-2604
                  if (moth.id === 'catalog-2604') {
                    allowDebugLogs && console.log('DEBUG catalog-2604 hostPlantNotes section:', {
                      original: moth.hostPlantNotes,
                      filtered: filteredNotes
                    });
                  }
                  
                  // 重複チェック - 既に表示された内容をスキップ
                  const uniqueNotes = filteredNotes.filter(note => markRemarkAsDisplayed(note));
                  
                  if (uniqueNotes.length === 0) return null;
                  
                  return (
                    <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{detailUi.noteLabel}</span>
                        {uniqueNotes.map((note, noteIndex) => (
                          <span key={noteIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* 地理的備考・生態学的特徴 - moth.remarksも考慮 */}
                {((moth.geographicalRemarks && typeof moth.geographicalRemarks === 'string' && moth.geographicalRemarks.trim()) || 
                  (moth.remarks && typeof moth.remarks === 'string' && moth.remarks.trim() && moth.type === 'moth')) && (() => {
                  // Debug logging for オオゴマシジミ
                  if (moth.name === 'オオゴマシジミ') {
                    allowDebugLogs && console.log('=== DEBUG オオゴマシジミ geographicalRemarks section ===');
                    allowDebugLogs && console.log('  moth.geographicalRemarks:', moth.geographicalRemarks);
                    allowDebugLogs && console.log('  moth.geographicalRemarks type:', typeof moth.geographicalRemarks);
                    allowDebugLogs && console.log('  moth.geographicalRemarks length:', moth.geographicalRemarks ? moth.geographicalRemarks.length : 0);
                    allowDebugLogs && console.log('  moth.geographicalRemarks.trim():', moth.geographicalRemarks ? moth.geographicalRemarks.trim() : 'N/A');
                    allowDebugLogs && console.log('  moth.id:', moth.id);
                    allowDebugLogs && console.log('  moth.name:', moth.name);
                    allowDebugLogs && console.log('  moth.type:', moth.type);
                    allowDebugLogs && console.log('  Full moth object:', moth);
                  }
                  
                  // Debug logging for catalog-2604
                  if (moth.id === 'catalog-2604') {
                    allowDebugLogs && console.log('DEBUG catalog-2604 geographicalRemarks section:', {
                      content: moth.geographicalRemarks,
                      isEcological: moth.geographicalRemarks.trim().match(/^(単食性|広食性|狭食性)$/)
                    });
                  }
                  
                  // 重複チェック - 生態情報（単食性等）でない場合のみチェック
                  // moth.remarksがある場合は優先して使用
                  const remarksContent = (moth.type === 'moth' && moth.remarks && moth.remarks.trim()) ? 
                                        moth.remarks.trim() : 
                                        (moth.geographicalRemarks ? moth.geographicalRemarks.trim() : '');
                  if (!remarksContent) return false;
                  
                  const isEcological = remarksContent.match(/^(単食性|広食性|狭食性)$/);
                  
                  if (!isEcological && !markRemarkAsDisplayed(remarksContent)) {
                    return false; // 既に表示済みの場合はスキップ
                  }
                  
                  return true;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex flex-wrap gap-2">
                      {/* 生態学的特徴（単食性、広食性など）か地域情報かを判断 */}
                      {(() => {
                        // moth.remarksがある場合は優先して使用
                        const displayRemarks = (moth.type === 'moth' && moth.remarks && moth.remarks.trim()) ? 
                                              moth.remarks.trim() : 
                                              (moth.geographicalRemarks ? moth.geographicalRemarks.trim() : '');
                        
                        if (displayRemarks.match(/^(単食性|広食性|狭食性)$/)) {
                          return (
                            <>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{detailUi.feedingHabitLabel}</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                {translateFeedingHabit(displayRemarks)}
                              </span>
                            </>
                          );
                        } else if ((moth.name === 'ルリシジミ' || moth.japaneseName === 'ルリシジミ') && displayRemarks.includes('。')) {
                          return (
                            <>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{detailUi.noteLabel}</span>
                              <div className="flex flex-col gap-2 mt-2 w-full">
                                {displayRemarks.split('。').filter(s => s.trim()).map((sentence, idx) => (
                                  <div key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                    <span className="mr-2">•</span>
                                    <span>{sentence.trim()}。</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{detailUi.noteLabel}</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                {displayRemarks}
                              </span>
                            </>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* シンプルな備考表示 - 蛾とタマムシの場合（重複を避ける） */}
                {(() => {
                  // Debug logging for remarks
                  if (moth.id && (moth.id.includes('2090') || moth.id.includes('2102'))) {
                    allowDebugLogs && console.log('DEBUG moth remarks:', {
                      id: moth.id,
                      name: moth.name,
                      remarks: moth.remarks,
                      geographicalRemarks: moth.geographicalRemarks,
                      type: moth.type
                    });
                  }
                  // geographicalRemarksと同じ内容の場合は表示しない（重複を避ける）
                  return (moth.type === 'moth' || moth.type === 'beetle' || moth.type === 'longhornbeetle') && 
                         moth.remarks && moth.remarks.trim() && 
                         !moth.remarks.includes('|') &&
                         moth.remarks !== moth.geographicalRemarks;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{detailUi.noteLabel}</span>
                      {(() => {
                        // セミコロン(;)で区切られている場合は箇条書きにする
                        if (moth.remarks.includes(';')) {
                          const remarkItems = moth.remarks.split(';').map(item => item.trim()).filter(item => item);
                          return (
                            <div className="flex-1 space-y-2">
                              {remarkItems.map((item, index) => (
                                <div key={index} className="flex items-start space-x-2">
                                  <span className="text-orange-600 dark:text-orange-400 mt-0.5">•</span>
                                  <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {item}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                              {moth.remarks.trim()}
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* 詳細備考情報（キリガデータ統合対応） - ルリシジミや既に備考表示済みの蝶は除外 */}
                {(moth.remarks && moth.remarks.includes('|') && !(moth.name === 'ルリシジミ' || moth.japaneseName === 'ルリシジミ')) && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="space-y-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{detailUi.detailsLabel}</span>
                      {(() => {
                        // butterflyの場合、geographicalRemarksをremarksとして扱う
                        const actualRemarks = moth.remarks || (moth.type === 'butterfly' && moth.geographicalRemarks ? moth.geographicalRemarks : '');
                        
                        if (!actualRemarks) return null;
                        
                        return actualRemarks.split(' | ').map((remark, remarkIndex) => {
                        // 成虫発生時期を含む備考は除外
                        const { notes: filteredRemark } = extractEmergenceTime(remark);
                        if (!filteredRemark.trim()) return null;
                        // 食草備考の場合 - 本来の食草情報として扱う
                        if (remark.startsWith('食草: ')) {
                          const content = remark.substring(3);
                          // 食草データが空の場合、備考の食草情報を主要食草として表示
                          if (moth.hostPlants.length === 0) {
                            const foodPlants = content.split(/[、，,;；]/).map(p => p.trim()).filter(p => p.length > 0);
                            return (
                              <div key={remarkIndex} className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700/50">
                                <div className="flex items-start space-x-2">
                                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">{detailUi.literatureHostPlantLabel}</p>
                                    <div className="flex flex-wrap gap-1">
                                      {foodPlants.map((plant, plantIndex) => {
                                        const linkTarget = resolveLinkablePlantName(plant);
                                        return linkTarget ? (
                                          <Link
                                            key={plantIndex}
                                            to={buildPlantPath(linkTarget, locale)}
                                            state={makeDetailLinkState(location)}
                                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800 underline-offset-2 hover:underline hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                                          >
                                            {plant}
                                          </Link>
                                        ) : (
                                          <span key={plantIndex} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                            {plant}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{content}</p>
                            </div>
                          );
                        }
                        // 発生時期の場合
                        else if (remark.startsWith('発生時期: ')) {
                          const content = remark.substring(5);
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{content}</p>
                            </div>
                          );
                        }
                        // 旧備考の場合
                        else if (remark.startsWith('旧備考: ')) {
                          const content = remark.substring(4);
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-600 dark:text-slate-400 italic">{content}</p>
                            </div>
                          );
                        }
                        // その他の備考
                        else {
                          // ルリシジミの場合、文章を箇条書きにする
                          if ((moth.name === 'ルリシジミ' || moth.japaneseName === 'ルリシジミ') && remark.includes('。')) {
                            const sentences = remark.split('。').filter(s => s.trim());
                            return (
                              <div key={remarkIndex} className="space-y-2">
                                <div className="flex items-start space-x-2">
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="space-y-1">
                                    {sentences.map((sentence, idx) => (
                                      <div key={idx} className="flex items-start">
                                        <span className="text-blue-500 dark:text-blue-400 mr-2">•</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{sentence.trim()}。</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          // 通常の備考
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{remark}</p>
                            </div>
                          );
                        }
                      });
                      })()}
                    </div>
                  </div>
                )}

                {/* 成虫発生時期を除去した備考情報 */}
                {moth.notes && (() => {
                  let { notes: remainingNotes } = extractEmergenceTime(moth.notes);
                  
                  // catalog-2604特別対応：「などの花」「の花」を含む備考は完全除去
                  if (moth.id === 'catalog-2604') {
                    allowDebugLogs && console.log('DEBUG catalog-2604 notes section:', {
                      original: moth.notes,
                      remaining: remainingNotes
                    });
                    if (remainingNotes.includes('の花') || remainingNotes.includes('など花') || remainingNotes.includes('などの花')) {
                      allowDebugLogs && console.log('DEBUG catalog-2604: Filtering out flower note in condition check:', remainingNotes);
                      remainingNotes = '';
                    }
                  }
                  
                  // 重複チェック
                  const trimmedNotes = remainingNotes.trim();
                  if (!markRemarkAsDisplayed(trimmedNotes)) {
                    return false; // 既に表示済みの場合はスキップ
                  }

                  return trimmedNotes;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{detailUi.noteLabel}</span>{' '}
                        {(() => {
                          let { notes: remainingNotes } = extractEmergenceTime(moth.notes);
                          
                          // catalog-2604特別対応：「などの花」「の花」を含む備考は完全除去
                          if (moth.id === 'catalog-2604') {
                            allowDebugLogs && console.log('DEBUG catalog-2604 filtering remainingNotes:', remainingNotes);
                            if (remainingNotes.includes('の花') || remainingNotes.includes('など花') || remainingNotes.includes('などの花')) {
                              allowDebugLogs && console.log('DEBUG catalog-2604: Filtering out flower note in remaining notes:', remainingNotes);
                              remainingNotes = '';
                            }
                          }
                          
                          return remainingNotes.trim();
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* 出典情報（サイト共通の控えめ表記） */}
                {moth.source && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <SourceCitation sources={moth.source} isEnglish={isEnglish} />
                  </div>
                )}
              </div>
            </div>

        {/* Food Web Network Graph */}
        {/* 食草ネットワーク */}
        

        {/* Emergence Period Section (Full Width) */}
            {(moth.type === 'leafbeetle' || moth.type === 'moth' || moth.type === 'butterfly') && (() => {
              const hasDetailedTime = moth.emergenceTimeDetailed && moth.emergenceTimeDetailed.length > 0;
              const hasExistingTime = moth.emergenceTime && moth.emergenceTime !== '不明';
              // チョウは発生時期がgeographicalRemarksに入る（HostPlantDetailのInsectCardと同じ扱い）
              const emergenceSourceText = [
                moth.notes,
                moth.type === 'butterfly' ? moth.geographicalRemarks : '',
              ].map((text) => String(text || '').trim()).filter(Boolean).join('\n');
              const { emergenceTime } = extractEmergenceTime(emergenceSourceText);
              const normalizedTime = normalizeEmergenceTime(emergenceTime);
              const hasExtractedTime = normalizedTime && normalizedTime !== '不明';
              const supplementalEmergenceTexts = Array.from(new Set([
                emergenceSourceText,
                ...(Array.isArray(moth.generalNotes) ? moth.generalNotes.filter(isEmergenceNote).map((note) => note?.content || '') : [])
              ].map((text) => String(text || '').trim()).filter(Boolean)));
              const hasSupplementalEmergenceHint = supplementalEmergenceTexts.some((text) =>
                /(成虫|出現|羽化|発生|得られ|見られ|採れ|採集|越冬|越年|春の蛾|夏の蛾|秋の蛾|冬の蛾|周年|通年|年中|翌春|翌夏|翌秋|翌冬)/.test(text)
              );
              
              // generalNotesから出現時期を抽出（共通関数で柔軟に判定）
              const emergenceFromGeneralNotes = moth.generalNotes && moth.generalNotes.find(isEmergenceNote);
              const hasGeneralNotesTime = emergenceFromGeneralNotes && emergenceFromGeneralNotes.content !== '不明';
              // 出現時期タイプのノートが存在するか（内容が不明でもセクションを表示）
              const hasEmergenceTypeNote = Array.isArray(moth.generalNotes) && moth.generalNotes.some(n => {
                const t = (n?.type || '').trim();
                return t.includes('出現時期') || t.includes('成虫発生時期') || t.includes('発生時期') || t.includes('出現');
              });
              
              return hasDetailedTime || hasExistingTime || hasExtractedTime || hasGeneralNotesTime || hasEmergenceTypeNote || hasSupplementalEmergenceHint;
            })() && (
              <div id="adult-season" className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden scroll-mt-28">
                <div className="p-4 bg-orange-500/10 dark:bg-orange-500/20 border-b border-orange-200/30 dark:border-orange-700/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {detailUi.adultSeasonLabel}
                    </h2>
                  </div>
                </div>
                
                <div className="p-4">
                  {(() => {
                    // まず備考欄から発生時期を抽出（チョウはgeographicalRemarksも対象）
                    const emergenceSourceText = [
                      moth.notes,
                      moth.type === 'butterfly' ? moth.geographicalRemarks : '',
                    ].map((text) => String(text || '').trim()).filter(Boolean).join('\n');
                    const { emergenceTime: extractedTime } = extractEmergenceTime(emergenceSourceText);
                    const normalizedTime = normalizeEmergenceTime(extractedTime);
                    
                    // 統合された発生時期データを作成
                    let allEmergenceTimeData = [];
                    
                    // 詳細データがある場合はそれを追加
                    if (moth.emergenceTimeDetailed && moth.emergenceTimeDetailed.length > 0) {
                      allEmergenceTimeData = [...moth.emergenceTimeDetailed];
                    }
                    
                    // 既存のemergenceTimeがある場合は追加
                    if (moth.emergenceTime && moth.emergenceTime !== '不明') {
                      allEmergenceTimeData.push({
                        period: moth.emergenceTime,
                        source: moth.emergenceTimeSource || '',
                        region: '',
                        notes: moth.emergenceTimeDescription || ''
                      });
                    }
                    
                    // 備考欄から抽出した発生時期がある場合は追加
                    if (normalizedTime && normalizedTime !== '不明') {
                      allEmergenceTimeData.push({
                        period: normalizedTime,
                        source: moth.source || '',
                        region: '',
                        notes: detailUi.extractedFromNotes
                      });
                    }
                    
                    // generalNotesから出現時期を追加（柔軟判定）
                    const emergenceFromGeneralNotes = moth.generalNotes && moth.generalNotes.find(isEmergenceNote);
                    if (emergenceFromGeneralNotes && emergenceFromGeneralNotes.content !== '不明') {
                      allEmergenceTimeData.push({
                        period: emergenceFromGeneralNotes.content,
                        source: emergenceFromGeneralNotes.reference || '',
                        region: '',
                        notes: detailUi.extractedFromGeneralNotes
                      });
                    }
                    
                    // 最適な発生時期データを選択（年越しや範囲の広い表現を優先）
                    const scorePeriod = (s = '') => {
                      if (!s) return 0;
                      let score = 0;
                      if (/翌年/.test(s)) score += 100; // 年越しを最優先
                      if (/[~〜～\-]|から|まで/.test(s)) score += 10; // 範囲表現
                      const months = (s.match(/(\d{1,2})月/g) || []).map(m => parseInt(m));
                      const uniq = Array.from(new Set(months));
                      score += uniq.length; // 含まれる月数を加点
                      return score;
                    };

                    let best = null;
                    let bestScore = -1;
                    allEmergenceTimeData.forEach(item => {
                      const sc = scorePeriod(item.period || '');
                      if (sc > bestScore) {
                        bestScore = sc;
                        best = item;
                      }
                    });

                    const primaryEmergenceTime = best ? best.period : '不明';
                    // 出典は選択アイテムのsource。空なら他の候補から最初の非空を補う
                    let primarySource = (best && best.source) ? best.source : '';
                    if (!primarySource) {
                      const withSource = allEmergenceTimeData.find(i => i.source && i.source.trim());
                      if (withSource) primarySource = withSource.source;
                    }
                    if (!primarySource) {
                      const noteWithSource = Array.isArray(moth.generalNotes)
                        ? moth.generalNotes.find((note) => note?.reference && String(note.reference).trim())
                        : null;
                      if (noteWithSource) primarySource = noteWithSource.reference;
                    }
                    if (!primarySource) {
                      primarySource = moth.source || '';
                    }

                    const emergenceOriginalTextCandidates = Array.from(new Set([
                      best?.notes || '',
                      moth.emergenceTimeDescription || '',
                      ...(Array.isArray(moth.emergenceTimeDetailed) ? moth.emergenceTimeDetailed.map((item) => item?.notes || '') : []),
                      ...(Array.isArray(moth.generalNotes) ? moth.generalNotes.filter(isEmergenceNote).map((note) => note?.content || '') : []),
                    ].map((text) => String(text || '').trim()).filter(Boolean)));
                    const originalEmergenceText = emergenceOriginalTextCandidates.find((text) => {
                      if (!text || text === primaryEmergenceTime || text === '不明') return false;
                      if (text === detailUi.extractedFromNotes || text === detailUi.extractedFromGeneralNotes) return false;
                      if (/^p\.\s*\d+/i.test(text)) return false;
                      return /\d+\s*月|春|夏|秋|冬|羽化|出現|発生|得られ|見られ|採れ|採集|越冬|越年|から|まで|頃/.test(text);
                    }) || '';

                    const supplementalEmergenceTexts = Array.from(new Set([
                      emergenceSourceText,
                      ...(Array.isArray(moth.generalNotes) ? moth.generalNotes.filter(isEmergenceNote).map((note) => note?.content || '') : []),
                      ...allEmergenceTimeData.map((item) => item?.period || ''),
                      ...allEmergenceTimeData.map((item) => item?.notes || ''),
                    ].map((text) => String(text || '').trim()).filter(Boolean)));
                    
                    return (
                      <EmergenceTimeDisplay
                        emergenceTime={primaryEmergenceTime}
                        source={primarySource}
                        compact={false}
                        supplementalTexts={supplementalEmergenceTexts}
                        originalText={originalEmergenceText}
                        locale={locale}
                      />
                    );
                  })()}

                </div>
              </div>
            )}

            {/* 生態情報（general_notes.csv） */}
            {ecologyNotes.length > 0 && (
              <div id="ecology" className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden scroll-mt-28">
                <div className="p-4 bg-orange-500/10 dark:bg-orange-500/20 border-b border-orange-200/30 dark:border-orange-700/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6c-1.657 0-3 1.343-3 3 0 2.25 3 6 3 6s3-3.75 3-6c0-1.657-1.343-3-3-3z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {detailUi.ecologyLabel}
                    </h2>
                  </div>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {ecologyNotes.map((note, index) => (
                      <li key={index} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        • {note.content}
                        {note.reference && (
                          <SourceCitation
                            sources={note.reference}
                            isEnglish={isEnglish}
                            className="mt-1"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 保全応援セクション（テストページ専用のためSPAには含めない） */}

            {/* 関連種情報 - 横スクロール式カードデザイン
                （アンカーで包み、関連ゼロで非表示のときは目次からも消えるようにする） */}
            <div id="related-insects">
              <RelatedInsectsSection
                relatedMothsByPlant={relatedMothsByPlant}
                allInsects={allInsects}
                locale={locale}
              />
            </div>

            <ManualAdSlot
              placement="detail"
              locale={locale}
              className="mt-10"
              minHeight="min-h-[120px]"
            />

          </div>
        </div>

        {/* 食草ネットワーク（全幅） */}
        {renderFoodWebCard(graphContainerRef, "mt-6", "food-web")}

        {/* 前後の種へのナビゲーション */}
        <DetailNavigation allItems={sortedInsects} currentId={moth.id} type="insect" locale={locale} />

        <div id="share" className="mt-8">
          <div className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-100/70 to-slate-50/70 dark:from-slate-700/40 dark:to-slate-800/40 border-b border-slate-200/40 dark:border-slate-600/40">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {isEnglish ? 'Share this page' : 'このページを共有'}
              </h2>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {/* OS標準の共有シート（対応環境のみ表示） */}
              <NativeShareButton
                url={shareUrl}
                title={shareTitle}
                text={shareText}
                isEnglish={isEnglish}
              />

              {/* X (Twitter) シェアボタン */}
              <a
                href={shareXUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-sm"
                aria-label={isEnglish ? `Share ${primaryName} on X` : `${moth.name}をXで共有`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                {isEnglish ? 'Share on X' : 'Xで共有'}
              </a>

              {/* LINE シェアボタン */}
              <a
                href={shareLineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#06C755] text-white hover:bg-[#05b04c] transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-sm"
                aria-label={isEnglish ? `Share ${primaryName} on LINE` : `${moth.name}をLINEで共有`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                {isEnglish ? 'Share on LINE' : 'LINEで共有'}
              </a>

              {/* リンクコピーボタン */}
              <button
                type="button"
                onClick={handleCopyShareLink}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-sm ${
                  copyFeedback === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : copyFeedback === 'error'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-slate-600 hover:bg-slate-500'
                }`}
                aria-label={
                  copyFeedback === 'success'
                    ? isEnglish
                      ? 'Link copied'
                      : 'リンクをコピーしました'
                    : isEnglish
                      ? 'Copy link to clipboard'
                      : 'リンクをクリップボードにコピー'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                {copyFeedback === 'success'
                  ? isEnglish
                    ? 'Copied!'
                    : 'コピーしました！'
                  : copyFeedback === 'error'
                    ? isEnglish
                      ? 'Copy failed'
                      : 'コピー失敗'
                    : isEnglish
                      ? 'Copy link'
                      : 'リンクをコピー'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MothDetail;
