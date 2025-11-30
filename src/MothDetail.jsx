import React, { useState, useEffect, useRef } from 'react';
import logger from './utils/logger';
import { useParams, Link } from 'react-router-dom';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';
import { getSourceLink, normalizeReference } from './utils/sourceLinks';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { MothStructuredData, ButterflyStructuredData, LeafBeetleStructuredData, BeetleStructuredData } from './components/StructuredData';
import useSeoMeta from './hooks/useSeoMeta';
import { absUrl } from './utils/origin';
import { buildInsectPath, decodeSlug, slugifyInsectName } from './utils/insectSlug';
import { loadInsectImageIndexes, loadPlantImageFilenames } from './services/imageIndex';
import { createSafeInsectFilename } from './utils/image';
import { buildResponsiveSrcset } from './utils/imageSrcset';
import { getMappedScientificFilename } from './utils/insectImageMappings';
import EmergenceTimeDisplay from './components/EmergenceTimeDisplay';
// import EnhancedEmergenceTimeDisplay from './components/EnhancedEmergenceTimeDisplay';
import RelatedInsectsSection from './components/RelatedInsectsSection';
import DetailNavigation from './components/DetailNavigation';
import { extractEmergenceTime, normalizeEmergenceTime } from './utils/emergenceTimeUtils';
// SupportEngagementSection is test-only and not used in SPA detail

const MothDetail = ({ moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants }) => {
  // 🔍 デバッグ：コンポーネント呼び出し確認
  logger.debug('🔍 MothDetail component called');
  
  const { mothSlug, butterflySlug, beetleSlug, leafbeetleSlug } = useParams();
  const routeType = mothSlug ? 'moth' : butterflySlug ? 'butterfly' : beetleSlug ? 'beetle' : leafbeetleSlug ? 'leafbeetle' : '';
  const rawRouteParam = mothSlug || butterflySlug || beetleSlug || leafbeetleSlug || '';
  const decodedRouteParam = decodeSlug(rawRouteParam);
  const normalizedRouteSlug = slugifyInsectName(decodedRouteParam);
  const isLeafbeetleRoute = routeType === 'leafbeetle';
  const [fallbackHostPlants, setFallbackHostPlants] = useState([]);
  const [plantImageNames, setPlantImageNames] = useState([]);
  const [plantImageIndexReady, setPlantImageIndexReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPlantImageFilenames()
      .then((names) => {
        if (cancelled) return;
        setPlantImageNames(Array.isArray(names) ? names : []);
        setPlantImageIndexReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPlantImageNames([]);
        setPlantImageIndexReady(true);
      });
    return () => { cancelled = true; };
  }, []);
  
  // 🔍 デバッグ：URLパラメータ確認
  logger.debug('🔍 URL params:', { mothSlug, butterflySlug, beetleSlug, leafbeetleSlug, rawRouteParam, decodedRouteParam });
  
  // ID mapping for compatibility between different data sources
  // Since moths array is built from insects.csv (species-XXX format)
  // We need to map catalog-XXX to species-XXX, not the other way around
  const idMapping = {
    'catalog-3123': 'species-4601', // アオバシャチホコ (Zaranga permagna)
    'catalog-3586': 'species-6115', // アズサキリガ (Pseudopanolis azusa)
    // Add more mappings as needed
  };
  
  // Helper: determine whether the parameter looks like an internal ID (species-XXXX etc.)
  const isLikelyInsectId = (value = '') => /^(species|catalog|moth|butterfly|butterfly-csv|beetle|leafbeetle)[-_]?\d+/i.test(value);
  
  // Apply ID mapping only when the route param looks like an ID
  const mappedInsectId = isLikelyInsectId(decodedRouteParam) ? (idMapping[decodedRouteParam] || decodedRouteParam) : decodedRouteParam;

  // Resolve non-standard suffix IDs like `species-6131m` -> `species-6131`
  const resolveInsectId = (id) => {
    if (!id) return id;
    // strip trailing single-letter suffixes commonly used (e.g., m/f variants)
    const m = String(id).match(/^(species|catalog)-(\d+)[a-z]$/i);
    if (m) return `${m[1]}-${m[2]}`;
    return id;
  };

  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : '');
  
  // 🔍 デバッグ：データ配列の状況確認
  logger.debug('🔍 Data arrays status:', {
    mothsLength: moths.length,
    butterfliesLength: butterflies.length,
    beetlesLength: beetles.length,
    leafbeetlesLength: leafbeetles.length,
    totalDataLoaded: moths.length + butterflies.length + beetles.length + leafbeetles.length
  });
  
  // Check if data is still loading
  const totalDataLoaded = moths.length + butterflies.length + beetles.length + leafbeetles.length;
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
  const allInsects = React.useMemo(() => [...moths, ...butterflies, ...beetles, ...leafbeetles], [moths, butterflies, beetles, leafbeetles]);
  
  // Sort for navigation
  const sortedInsects = React.useMemo(() => {
    return [...allInsects].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
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

  const resolvedInsectId = moth?.id || resolveInsectId(mappedInsectId);

  // Fallback: if no host plants are available (e.g., data-lite initial state),
  // lazily load from normalized CSV (public/hostplants.csv) and synthesize minimal records.
  useEffect(() => {
    const needFallback = isLeafbeetleRoute && moth && (
      (!Array.isArray(moth.hostPlantsDetailed) || moth.hostPlantsDetailed.length === 0) &&
      (!Array.isArray(moth.hostPlants) || moth.hostPlants.length === 0)
    );
    if (!needFallback) return;
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
  }, [isLeafbeetleRoute, moth, resolvedInsectId, mappedInsectId]);
  
  // Debug logging for ID mapping
  if (decodedRouteParam !== mappedInsectId) {
    logger.debug(`ID mapped: ${decodedRouteParam} -> ${mappedInsectId}`);
  }
  
  // Add specific debug for アオバシャチホコ search
  if (decodedRouteParam === 'species-4601' || decodedRouteParam === 'catalog-3123' || mappedInsectId === 'species-4601') {
    logger.debug('🔍 DEBUG アオバシャチホコ search:', {
      originalId: decodedRouteParam,
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
    logger.debug('  routeParam:', decodedRouteParam);
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
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageExtensions, setImageExtensions] = useState({});
  const [imageBases, setImageBases] = useState([]);

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
    ? (moth.scientificFilename || mappedScientificFilename || createSafeInsectFilename(moth.scientificName))
    : '';
  const japaneseName = moth?.name || '';

  const possibleImagePaths = React.useMemo(() => {
    if (!moth) return [];

    const exts = imageExtensions || {};
    const build = (name, ext) => `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(name)}${ext}${cacheBustRef.current}`;
    const uniq = new Set();
    const push = (url) => { if (url && !uniq.has(url)) uniq.add(url); };
    const tryExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (safeFilename && exts[safeFilename]) push(build(safeFilename, exts[safeFilename]));
    if (japaneseName && exts[japaneseName]) push(build(japaneseName, exts[japaneseName]));

    if (safeFilename) {
      tryExts.forEach(ext => push(build(safeFilename, ext)));
    }
    if (japaneseName) {
      tryExts.forEach(ext => push(build(japaneseName, ext)));
    }

    try {
      if (imageBases && imageBases.length > 0 && moth.scientificName) {
        const sci = moth.scientificName.replace(/\s*\(.*$/, '').trim();
        const [genus, species] = sci.split(/\s+/);
        if (genus && species) {
          const candidates = imageBases.filter(base => base.includes(genus) && base.includes(species));
          candidates.sort((a, b) => a.length - b.length);
          for (const base of candidates) {
            if (exts[base]) {
              push(build(base, exts[base]));
            } else {
              tryExts.forEach(ext => push(build(base, ext)));
            }
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to derive additional image candidates:', error);
    }

    return Array.from(uniq);
  }, [imageExtensions, imageBases, safeFilename, japaneseName, moth]);

  const staticImagePath = possibleImagePaths[0] || '';
  const hasInstagramPost = Boolean(moth?.instagramUrl && moth.instagramUrl.trim());

  useEffect(() => {
    if (!moth) return;
    if (staticImagePath) {
      setOgTwitterImage(staticImagePath, `${moth.name}（${moth.scientificName}）の写真`);
      return;
    }
    if (typeof document === 'undefined') return;
    const ogImageEl = document.querySelector('img[alt*="写真"]');
    const imageUrl = ogImageEl?.getAttribute('src');
    if (imageUrl) {
      setOgTwitterImage(imageUrl, `${moth.name}（${moth.scientificName}）の写真`);
    }
  }, [moth, staticImagePath]);

  // Filter alternative names to exclude duplicates of the primary name
  const alternativeNamesFiltered = React.useMemo(() => {
    const raw = (moth?.alternativeNames || '').trim();
    if (!raw) return '';
    const items = raw.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    const filtered = Array.from(new Set(items.filter(n => n !== moth?.name)));
    return filtered.join('、');
  }, [moth?.alternativeNames, moth?.name]);

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

  // SEO（メタ/カノニカル/パンくず）を共通フックで設定
  const insectTypeLabel = moth?.type === 'butterfly' ? '蝶' : moth?.type === 'beetle' ? 'タマムシ' : moth?.type === 'leafbeetle' ? 'ハムシ' : '蛾';
  const hostPlantsText = Array.isArray(moth?.hostPlants)
    ? (moth.hostPlants.length ? moth.hostPlants.join('、') : '不明')
    : (typeof moth?.hostPlants === 'string' && moth?.hostPlants.trim() ? moth.hostPlants : '不明');
  const canonicalHref = moth
    ? absUrl(buildInsectPath(moth))
    : undefined;
  const pageTitle = moth
    ? `${moth.name} (${moth.scientificName}) | ${insectTypeLabel}の詳細 - 昆虫食草図鑑`
    : '昆虫詳細 - 昆虫食草図鑑';
  const pageDesc = moth
    ? `${moth.name}（${moth.scientificName}）の詳細情報。食草: ${hostPlantsText}。昆虫食草図鑑で${insectTypeLabel}と植物の関係を詳しく学ぼう。`
    : '昆虫の詳細情報。';

  const { setOgTwitterImage } = useSeoMeta({
    title: pageTitle,
    description: pageDesc,
    ogType: 'article',
    url: canonicalHref,
    breadcrumbItems: moth ? [
      { name: '昆虫食草図鑑', url: absUrl('/') },
      { name: insectTypeLabel, url: absUrl(`/${moth.type === 'butterfly' ? 'butterfly' : moth.type === 'beetle' ? 'beetle' : moth.type === 'leafbeetle' ? 'leafbeetle' : 'moth'}`) },
      { name: moth.name, url: canonicalHref }
    ] : undefined,
    resetCanonicalTo: absUrl('/')
  });

  // PlantCard Component
  const PlantCard = ({ plant, imageNames = [] }) => {
    const [imgError, setImgError] = useState(false);
    
    const resolvePlantImage = () => {
      const candidates = [plant.name, plant.displayName, plant.name.replace(/（.*）$/, '')];
      // Try exact match first
      for (const c of candidates) {
        if (imageNames.includes(c)) return c;
      }
      return null;
    };
    
    const imageName = resolvePlantImage();
    const imgSrc = imageName 
      ? `${import.meta.env.BASE_URL}images/plants/${encodeURIComponent(imageName)}.jpg` 
      : null;

    // Badge styles
    const getObservationStyle = (type) => {
      if (type?.includes('野外')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      if (type?.includes('飼育')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
    };

    return (
      <Link 
        to={`/plant/${encodeURIComponent(plant.name)}`}
        className="block bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-2xl shadow-lg overflow-hidden border border-white/30 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-0.5 transition h-full flex flex-col"
      >
        <div className="relative aspect-[4/3] bg-emerald-50 dark:bg-emerald-900/20 overflow-hidden flex-shrink-0">
          {!imgError && imgSrc ? (
            <img
              src={imgSrc}
              alt={plant.name}
              width="400"
              height="300"
              className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-emerald-200 dark:text-emerald-800" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
              </svg>
            </div>
          )}
          {/* Badge overlay */}
          {plant.observationType && (
            <div className="absolute top-2 right-2">
               <span className={`text-xs font-medium px-2 py-1 rounded-full shadow-sm border border-white/20 ${getObservationStyle(plant.observationType)}`}>
                 {plant.observationType}
               </span>
            </div>
          )}
        </div>
        
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="text-slate-800 dark:text-slate-100 font-bold text-lg mb-1 leading-tight">{plant.name}</h3>
          {plant.family && (
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">{plant.family}</p>
          )}
          
          <div className="mt-auto flex flex-wrap gap-1">
             {plant.lifeStage && (
               <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                 {plant.lifeStage}
               </span>
             )}
             {plant.plantPart && (
               <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                 {plant.plantPart}
               </span>
             )}
          </div>
        </div>
      </Link>
    );
  };

  const processHostPlantsForCards = () => {
    if (!moth) return [];
    
    const plants = (moth.hostPlantsDetailed && moth.hostPlantsDetailed.length > 0)
      ? [...moth.hostPlantsDetailed]
      : (fallbackHostPlants.length > 0 ? [...fallbackHostPlants] : []);
      
    if (plants.length === 0 && moth.hostPlants && moth.hostPlants.length > 0) {
       // Convert string array to objects
       const list = Array.isArray(moth.hostPlants) ? moth.hostPlants : [moth.hostPlants];
       list.forEach(p => {
         if (typeof p === 'string' && p !== '不明') {
           plants.push({
             name: p.replace(/（.*）$/, ''),
             displayName: p,
             family: '',
             observationType: '文献', // Default
             lifeStage: '',
             plantPart: ''
           });
         }
       });
    }

    // Deduplicate by name, prioritizing "Wild" observation
    const map = new Map();
    plants.forEach(p => {
       if (p.name === '不明') return;
       const existing = map.get(p.name);
       if (!existing) {
         map.set(p.name, p);
       } else {
         // Priority: Wild > Rearing > Literature
         const score = (type) => {
            if (type?.includes('野外')) return 3;
            if (type?.includes('飼育')) return 2;
            return 1;
         };
         if (score(p.observationType) > score(existing.observationType)) {
           map.set(p.name, p);
         }
       }
    });
    
    return Array.from(map.values()).sort((a, b) => {
       // Sort by priority then name
       const score = (type) => {
          if (type?.includes('野外')) return 3;
          if (type?.includes('飼育')) return 2;
          return 1;
       };
       const sa = score(a.observationType);
       const sb = score(b.observationType);
       if (sa !== sb) return sb - sa;
       return a.name.localeCompare(b.name, 'ja');
    });
  };

  const plantCardsData = processHostPlantsForCards();

  // Section Header Component
  const SectionHeader = ({ title, iconPath, count, colorClass = "text-slate-800 dark:text-white" }) => (
    <h2 className={`text-2xl font-bold ${colorClass} mb-8 flex items-center`}>
      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {iconPath}
      </svg>
      {title}
      {count !== undefined && <span className="ml-2 text-lg font-normal text-slate-500 dark:text-slate-400">({count})</span>}
    </h2>
  );

  // Show loading state if data is still loading
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-400 rounded-full flex items-center justify-center animate-pulse">
            <svg className="w-10 h-10 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">データを読み込んでいます...</h1>
          <p className="text-slate-600 dark:text-slate-400">昆虫データベースを読み込んでいます。しばらくお待ちください。</p>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">昆虫が見つかりません</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">指定されたIDの昆虫は存在しません。</p>
          <Link 
            to="/"
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            リストに戻る
          </Link>
        </div>
      </div>
    );
  }

  // Group related moths by host plant
  const relatedMothsByPlant = {};
  
  // Get plant names from current moth - handle both string and array formats
  let currentMothPlants = [];
  if (moth.hostPlantsDetailed && moth.hostPlantsDetailed.length > 0) {
    // Use new detailed format
    currentMothPlants = moth.hostPlantsDetailed.map(plant => plant.name).filter(name => name);
  } else if (moth.hostPlants) {
    // Handle old format - could be string or array
    if (typeof moth.hostPlants === 'string') {
      // Split by common delimiters and clean up
      currentMothPlants = moth.hostPlants.split(/[;；、,]/)
        .map(plant => plant.trim())
        .filter(plant => plant && plant !== '不明')
        .map(plant => {
          // Remove family annotations like （〇〇科）
          return plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
        })
        .filter(plant => plant);
    } else if (Array.isArray(moth.hostPlants)) {
      currentMothPlants = moth.hostPlants.filter(plant => plant && plant !== '不明');
    }
  }

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
  logger.debug('Static Image Path:', staticImagePath);
  
  if (moth?.type === 'beetle') {
    console.log('DEBUG: Beetle detail view:', {
      name: moth.name,
      scientificName: moth.scientificName,
      scientificFilename: moth.scientificFilename,
      safeFilename,
      japaneseName,
      imageExtensions,
      possibleImagePaths
    });
  }

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    if (currentImageIndex < possibleImagePaths.length - 1) {
      // Try next image path
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      // All paths failed
      setImageLoaded(false);
      setImageError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto px-4 pt-6"></div>
      {/* 構造化データ */}
      {moth && moth.type === 'moth' && <MothStructuredData moth={moth} />}
      {moth && moth.type === 'butterfly' && <ButterflyStructuredData butterfly={moth} />}
      {moth && moth.type === 'beetle' && <BeetleStructuredData beetle={moth} />}
      {moth && moth.type === 'leafbeetle' && <LeafBeetleStructuredData leafbeetle={moth} />}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <Link 
            to="/"
            className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-200 shadow-sm hover:shadow-md text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
ホームに戻る
          </Link>
          
          {/* 分類情報をヘッダーに表示 */}
          <div className="flex flex-wrap gap-2">
            {moth.classification.familyJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.familyJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
              >
                <span className="font-medium">{moth.classification.familyJapanese}</span>
                {moth.classification.family && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.family}</span>
                )}
              </Link>
            )}
            {moth.classification.subfamilyJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.subfamilyJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50"
              >
                <span className="font-medium">{moth.classification.subfamilyJapanese}</span>
                {moth.classification.subfamily && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.subfamily}</span>
                )}
              </Link>
            )}
            {moth.classification.tribeJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.tribeJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
              >
                <span className="font-medium">{moth.classification.tribeJapanese}</span>
                {moth.classification.tribe && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.tribe}</span>
                )}
              </Link>
            )}
            {moth.classification.genus && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.genus)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200/50 dark:border-slate-700/50"
              >
                <span className="font-medium italic">{moth.classification.genus}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* 画像セクション */}
          <div id="plant-photos" className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-white/20 dark:border-slate-700/50">
                {hasInstagramPost ? (
                  <div className="p-3">
                    <InstagramEmbed url={moth.instagramUrl} />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] bg-blue-50 dark:bg-blue-900/20 group overflow-hidden">
                    {!imageError && possibleImagePaths.length > 0 ? (
                      <div className="relative h-full w-full">
                        {(() => {
                          const srcUrl = possibleImagePaths[currentImageIndex];
                          // Try to build responsive srcset when we can infer filename and extension
                          const m = srcUrl && srcUrl.match(/\/images\/insects\/([^/?#]+)\.(jpg|jpeg|png|webp|JPG|PNG|WEBP)/);
                          if (m) {
                            const base = decodeURIComponent(m[1]);
                            const ext = '.' + m[2].toLowerCase();
                            const { src, srcSet, sizes } = buildResponsiveSrcset({ folder: 'insects', filename: base, ext, widths: [320, 640, 1024], sizes: '100vw' });
                            return (
                              <img
                                src={src}
                                srcSet={srcSet}
                                sizes={sizes}
                                alt={`${moth.name}（${moth.scientificName}）の写真 - ${moth.classification?.familyJapanese || '蛾科'}に属する昆虫`}
                                width="1200"
                                height="900"
                                className={`w-full h-full object-contain transition-all duration-700 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                onLoad={handleImageLoad}
                                onError={handleImageError}
                                loading="eager"
                                decoding="async"
                                fetchpriority="high"
                              />
                            );
                          }
                          // Fallback to direct URL
                          return (
                            <img 
                              src={srcUrl}
                              alt={`${moth.name}（${moth.scientificName}）の写真 - ${moth.classification?.familyJapanese || '蛾科'}に属する昆虫`}
                              width="1200"
                              height="900"
                              className={`w-full h-full object-contain transition-all duration-700 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                              onLoad={handleImageLoad}
                              onError={handleImageError}
                              decoding="async"
                            />
                          );
                        })()}
                        {/* Elegant gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        {/* Moth name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                          <h3 className="text-white font-bold text-lg drop-shadow-lg">{moth.name}</h3>
                          <p className="text-white/90 text-sm drop-shadow-md">{formatScientificNameReact(moth.scientificName)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <div className="text-center p-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">画像が見つかりません</p>
                        </div>
                      </div>
                    )}
                    
                    {!imageLoaded && !imageError && possibleImagePaths.length > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 dark:bg-blue-900/40">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-700 rounded-full"></div>
                          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </div>
                    )}
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
                            Instagram投稿
                          </span>
                        </div>
                        <a 
                          href={moth.instagramUrl} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                        >
                          投稿を見る →
                        </a>
                      </div>
                      {moth.instagramDate && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          <span className="font-medium">投稿日:</span> {moth.instagramDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 情報セクション（Basic Infoのみ） */}
          <div className="lg:col-span-1 space-y-4">
            {/* 種名情報 */}
            <div id="basic-info" className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden p-6">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
                {moth.name}
              </h1>
              {alternativeNamesFiltered && (
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-2">
                  別名: {alternativeNamesFiltered}
                </p>
              )}
              <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">
                {formatScientificNameReact(moth.scientificName)}
              </p>
            </div>
            
            {/* 備考（シンプル版） */}
            {(() => {
                  // geographicalRemarksと同じ内容の場合は表示しない（重複を避ける）
                  if (!((moth.type === 'moth' || moth.type === 'beetle') && 
                         moth.remarks && moth.remarks.trim() && 
                         !moth.remarks.includes('|') &&
                         moth.remarks !== moth.geographicalRemarks)) return null;
                  return (
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden p-6">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">備考</h3>
                      {moth.remarks.includes(';') ? (
                          <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                            {moth.remarks.split(';').map((item, idx) => (
                              <li key={idx}>{item.trim()}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-700 dark:text-slate-300">{moth.remarks.trim()}</p>
                        )}
                    </div>
                  );
            })()}
          </div>
        </div>
        
        {/* Host Plants Section (Full Width) */}
        <div id="host-plants" className="mb-16">
          <SectionHeader 
            title="食草・食樹"
            iconPath={<path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>}
            colorClass="text-emerald-700 dark:text-emerald-300"
            count={plantCardsData.length}
          />
          
          {plantCardsData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {plantCardsData.map((plant, idx) => (
                <PlantCard key={idx} plant={plant} imageNames={plantImageNames} />
              ))}
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400 italic">食草情報は登録されていません。</div>
          )}
          
          {/* Host Plant Notes (Displayed below grid if any) */}
          {/* Filter logic from previous version */}
           {moth.hostPlantNotes && moth.hostPlantNotes.length > 0 && (() => {
             // Simplified note rendering for full width section
             // Reuse filtering logic?
             // Let's just render distinct notes that are not pure plant parts
             const distinctNotes = Array.from(new Set(moth.hostPlantNotes)).filter(note => {
               if (!note) return false;
               // Basic filter for pure parts
               if (/^[^、]*?(の|から|で)(花|実|葉)[^、]*$/.test(note)) return false;
               return true;
             });
             
             if (distinctNotes.length === 0) return null;
             
             return (
               <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6 border border-emerald-100 dark:border-emerald-800">
                 <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">食草に関する備考</h4>
                 <div className="flex flex-wrap gap-2">
                   {distinctNotes.map((note, i) => (
                     <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-white dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50">
                       {note}
                     </span>
                   ))}
                 </div>
               </div>
             );
           })()}
        </div>

        {/* Emergence Period Section (Full Width) */}
        {(moth.type === 'leafbeetle' || moth.type === 'moth') && (
            <div id="emergence-time" className="mb-16">
             <SectionHeader 
                title="発生時期"
                iconPath={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
                colorClass="text-orange-700 dark:text-orange-300"
              />
              
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden p-6">
                  {(() => {
                    // Logic from previous version...
                    const { emergenceTime: extractedTime } = extractEmergenceTime(moth.notes || '');
                    const normalizedTime = normalizeEmergenceTime(extractedTime);
                    let allEmergenceTimeData = [];
                    if (moth.emergenceTimeDetailed && moth.emergenceTimeDetailed.length > 0) {
                      allEmergenceTimeData = [...moth.emergenceTimeDetailed];
                    }
                    if (moth.emergenceTime && moth.emergenceTime !== '不明') {
                      allEmergenceTimeData.push({
                        period: moth.emergenceTime,
                        source: moth.emergenceTimeSource || '',
                        region: '',
                        notes: moth.emergenceTimeDescription || ''
                      });
                    }
                    if (normalizedTime && normalizedTime !== '不明') {
                      allEmergenceTimeData.push({
                        period: normalizedTime,
                        source: moth.source || '',
                        region: '',
                        notes: '備考欄から抽出'
                      });
                    }
                    const emergenceFromGeneralNotes = moth.generalNotes && moth.generalNotes.find(isEmergenceNote);
                    if (emergenceFromGeneralNotes && emergenceFromGeneralNotes.content !== '不明') {
                      allEmergenceTimeData.push({
                        period: emergenceFromGeneralNotes.content,
                        source: emergenceFromGeneralNotes.reference || '',
                        region: '',
                        notes: 'general_notes.csvから抽出'
                      });
                    }

                    // Logic to find best period
                    const scorePeriod = (s = '') => {
                      if (!s) return 0;
                      let score = 0;
                      if (/翌年/.test(s)) score += 100;
                      if (/[~〜～\-]|から|まで/.test(s)) score += 10;
                      const months = (s.match(/(\d{1,2})月/g) || []).map(m => parseInt(m));
                      const uniq = Array.from(new Set(months));
                      score += uniq.length;
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
                    let primarySource = (best && best.source) ? best.source : '';
                    if (!primarySource) {
                      const withSource = allEmergenceTimeData.find(i => i.source && i.source.trim());
                      if (withSource) primarySource = withSource.source;
                    }
                    
                    return (
                      <EmergenceTimeDisplay
                        emergenceTime={primaryEmergenceTime}
                        source={primarySource}
                        compact={false}
                      />
                    );
                  })()}
              </div>
            </div>
        )}

        {/* Related Insects Section */}
        <div id="related-insects" className="mb-16">
            {/* Section Header inside RelatedInsectsSection? No, it has its own header style?
                Let's check RelatedInsectsSection component.
                If it doesn't match the style, we might want to wrap it or modify it.
                But for now, let's just render it.
            */}
            <RelatedInsectsSection 
              relatedMothsByPlant={relatedMothsByPlant} 
              allInsects={allInsects} 
            />
        </div>

        {/* 前後の種へのナビゲーション */}
        <DetailNavigation allItems={sortedInsects} currentId={moth.id} type="insect" />
      </div>
    </div>
  );
};

export default MothDetail;
