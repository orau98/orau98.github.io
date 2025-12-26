import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { PlantStructuredData } from './components/StructuredData';
import logger from './utils/logger';
import useSeoMeta from './hooks/useSeoMeta';
import { absUrl } from './utils/origin';
import { loadPlantImageFilenames as loadPlantImageFilenamesService } from './services/imageIndex';
import { PLANT_IMAGE_SUFFIXES } from './utils/filename';
import EnhancedHostPlantDisplay from './components/EnhancedHostPlantDisplay';
import { globalJapaneseToScientificMapping } from './utils/insectImageMappings';
import { buildInsectPath } from './utils/insectSlug';
import { createSafeInsectFilename } from './utils/image';
import { buildResponsiveSrcset } from './utils/imageSrcset';
import DetailNavigation from './components/DetailNavigation';
import { extractEmergenceTime, normalizeEmergenceTime } from './utils/emergenceTimeUtils';
import EmergenceTimeDisplay from './components/EmergenceTimeDisplay';
import { getBackTarget, makeDetailLinkState } from './utils/navState';
const FoodWebGraph = React.lazy(() => import('./components/FoodWebGraph'));
// import { RelatedPlants } from './components/RelatedLinks';

let genusMappingPromise = null;

const fetchGenusMapping = async (baseUrl) => {
  if (genusMappingPromise) return genusMappingPromise;
  genusMappingPromise = (async () => {
    try {
      const cacheBust = import.meta?.env?.DEV ? `?v=${Date.now()}` : '';
      const res = await fetch(`${baseUrl}genus_mapping.csv${cacheBust}`);
      if (!res.ok) return {};
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const map = {};
      parsed.data.forEach(row => {
        const jp = row['属和名']?.trim();
        const family = row['科名']?.trim() || '';
        const latin = row['属学名']?.trim();
        if (!jp || !latin) return;
        map[jp] = { family, scientificName: latin };
        if (jp.endsWith('属')) {
          const base = jp.replace(/属$/, '').trim();
          if (base && !map[base]) {
            map[base] = { family, scientificName: latin };
          }
        }
      });
      return map;
    } catch {
      return {};
    }
  })();
  return genusMappingPromise;
};

const buildGenusCandidates = (name = '') => Array.from(new Set([
  name,
  name.replace(/属の一種$/, '属'),
  name.replace(/属$/, '')
].filter(Boolean)));

// DetailCard component
const DetailCard = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6">
    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{title}</h2>
    {children}
  </div>
);

// 植物の別名データ
const plantAliases = {
  'ソメイヨシノ': ['染井吉野'],  // ユーザーリクエストにより手動追加
  'リンゴ': ['セイヨウリンゴ', 'ヨーロッパリンゴ']
};

const ImageModal = ({ image, isOpen, onClose, onImageError }) => {
  if (!isOpen || !image) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-6xl max-h-[90vh] w-full">
        <img 
          src={image.finalSrc || image.src}
          alt={image.alt}
          className="w-full h-full object-contain rounded-lg shadow-2xl"
          onError={(event) => onImageError?.(image.id, event)}
          onClick={(e) => e.stopPropagation()}
        />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
          <p className="text-white font-medium">{image.label}</p>
        </div>
      </div>
    </div>
  );
};

const PlantImageGallery = ({ images }) => {
  const [availableImages, setAvailableImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainImage, setMainImage] = useState(null);

  useEffect(() => {
    if (!Array.isArray(images) || images.length === 0) {
      setAvailableImages([]);
      setMainImage(null);
      setSelectedImage(null);
      setModalOpen(false);
      setLoading(false);
      return;
    }

    const normalized = images.map((image, idx) => {
      const candidates = Array.isArray(image.candidates) && image.candidates.length
        ? image.candidates
        : [image.src, image.srcJPG].filter(Boolean);
      return {
        ...image,
        id: image.id || `${image.alt || 'plant'}-${idx}`,
        candidates,
        candidateIndex: 0,
        finalSrc: candidates[0],
      };
    });

    setAvailableImages(normalized);
    setMainImage(normalized[0]);
    setSelectedImage(normalized[0]);
    setModalOpen(false);
    setLoading(false);
  }, [images]);

  const handleImageError = (imageId, event) => {
    setAvailableImages((prev) => {
      const idx = prev.findIndex((img) => img.id === imageId);
      if (idx === -1) return prev;
      const current = prev[idx];

      const hasNextCandidate = current.candidates && current.candidateIndex + 1 < current.candidates.length;
      if (hasNextCandidate) {
        const nextIndex = current.candidateIndex + 1;
        const nextSrc = current.candidates[nextIndex];
        const updated = [...prev];
        const nextImage = { ...current, candidateIndex: nextIndex, finalSrc: nextSrc };
        updated[idx] = nextImage;
        if (mainImage?.id === imageId) setMainImage(nextImage);
        if (selectedImage?.id === imageId) setSelectedImage(nextImage);
        if (event?.currentTarget) event.currentTarget.src = nextSrc;
        return updated;
      }

      const updated = prev.filter((img) => img.id !== imageId);
      const fallbackImage = updated[0] || null;
      if (mainImage?.id === imageId) setMainImage(fallbackImage);
      if (selectedImage?.id === imageId) setSelectedImage(fallbackImage);
      if (!fallbackImage) setModalOpen(false);
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (availableImages.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <p>この植物の写真はまだ登録されていません。</p>
      </div>
    );
  }

  const handleImageClick = (image) => {
    if (!image) return;
    setSelectedImage(image);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedImage(null);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Main large image */}
        {mainImage && (
          <div className="relative">
            <div 
              className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl cursor-pointer"
              onClick={() => handleImageClick(mainImage)}
            >
              <div className="relative bg-emerald-50 dark:bg-emerald-900/20 overflow-hidden aspect-[16/10] min-h-[200px] md:min-h-[300px] lg:min-h-[400px]">
                <img 
                  src={mainImage.finalSrc}
                  alt={`${mainImage.alt}の写真`}
                  width="1600"
                  height="1000"
                  className="w-full h-full object-cover"
                  onError={(event) => handleImageError(mainImage.id, event)}
                  loading="lazy"
                />
                
                {/* Elegant gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100"></div>
                
                {/* Image label overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0">
                  <h3 className="text-white font-bold text-xl drop-shadow-lg">{mainImage.label}</h3>
                  <p className="text-white/90 text-sm drop-shadow-md mt-1">クリックで拡大表示</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Thumbnail gallery */}
        {availableImages.length > 1 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              その他の写真
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {availableImages.map((image, index) => (
                <div
                  key={index}
                  className={`group relative bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg cursor-pointer ${
                    mainImage?.finalSrc === image.finalSrc 
                      ? 'ring-3 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' 
                      : ''
                  }`}
                  onClick={() => {
                    setMainImage(image);
                    setSelectedImage(image);
                  }}
                >
                  <div className="relative aspect-square bg-emerald-50 dark:bg-emerald-900/20">
                    <img 
                      src={image.finalSrc}
                      alt={`${image.alt}の写真`}
                      width="400"
                      height="400"
                      className="w-full h-full object-cover"
                      onError={(event) => handleImageError(image.id, event)}
                      loading="lazy"
                    />
                    {mainImage?.finalSrc === image.finalSrc && (
                      <div className="absolute inset-0 bg-emerald-500/20"></div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-center text-emerald-700 dark:text-emerald-300 truncate">
                      {image.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <ImageModal 
        image={selectedImage}
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onImageError={handleImageError}
      />
    </>
  );
};

// カードコンポーネント（昆虫詳細ページのデザインに近い表現）
const InsectCard = ({ insect, idx, imageFilenames = new Set(), imageExtensions = {} }) => {
  const [imgError, setImgError] = React.useState(false);
  const location = useLocation();
  // Resolve the best image basename for this insect
  const resolveImageBase = () => {
    const nameJp = (insect.name || insect.japaneseName || '').trim();
    const mapped = globalJapaneseToScientificMapping.get(nameJp);
    const safe = createSafeInsectFilename(insect.scientificName || '');
    const safeFromMapped = createSafeInsectFilename(mapped || '');
    const safeFromExisting = createSafeInsectFilename(insect.scientificFilename || '');
    const hasImageBase = (base) => {
      if (!base) return false;
      if (imageExtensions && imageExtensions[base]) return true;
      if (imageFilenames && imageFilenames.size > 0 && imageFilenames.has(base)) return true;
      const keys = imageExtensions ? Object.keys(imageExtensions) : [];
      return keys.some((k) => k === base || k.startsWith(`${base}_`));
    };
    const candidates = [
      insect.scientificFilename,
      mapped,
      safe,
      safeFromMapped,
      safeFromExisting,
      createSafeInsectFilename(nameJp),
      nameJp
    ].filter(Boolean);
    for (const cand of candidates) {
      if (hasImageBase(cand)) return cand;
    }
    return candidates[0] || '';
  };
  const filename = resolveImageBase();
  const hasImage = Boolean(filename) && (
    (imageExtensions && imageExtensions[filename]) ||
    (imageFilenames && imageFilenames.size > 0 && imageFilenames.has(filename))
  );
  const ext = (imageExtensions && imageExtensions[filename]) || '.jpg';
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const assetVer = import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : '';
  const responsive = filename
    ? buildResponsiveSrcset({
        folder: 'insects',
        filename,
        ext,
        widths: [320, 640, 1024],
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
      })
    : {};
  const resizedSrc = filename
    ? `${normalizedBase}images/resized/insects/${encodeURIComponent(filename)}.640.jpg${assetVer}`
    : '';
  const imgSrc = resizedSrc || responsive.src || `${normalizedBase}images/insects/${encodeURIComponent(filename)}${ext}`;
  const href = insect.path || '#';
  const name = insect.name || insect.japaneseName || '（名称不明）';
  const linkState = href && href !== '#' ? makeDetailLinkState(location) : undefined;
  
  // Extract emergence time with better fallback for different insect types
  const getEmergenceSource = (i) => {
    if (i.emergenceTime && i.emergenceTime !== '不明') return i.emergenceTime;
    // For butterflies, check geographicalRemarks (mapped from remarks in CSV)
    if (i.type === 'butterfly' && i.geographicalRemarks) return extractEmergenceTime(i.geographicalRemarks).emergenceTime;
    // Fallback to notes or remarks
    return extractEmergenceTime(i.notes || i.remarks || '').emergenceTime;
  };
  const emergenceTime = getEmergenceSource(insect);
  const normalizedTime = normalizeEmergenceTime(emergenceTime);

  return (
    <Link to={href} state={linkState} className="block bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-2xl shadow-lg overflow-hidden border border-white/30 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-0.5 transition h-full flex flex-col">
      <div className="relative aspect-[4/3] bg-blue-50 dark:bg-blue-900/20 overflow-hidden flex-shrink-0">
        {!imgError && hasImage ? (
          <div className="relative h-full w-full">
            <img
              src={imgSrc}
              srcSet={responsive.srcSet}
              sizes={responsive.sizes}
              alt={name}
              width="1200"
              height="900"
              className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
              onError={(e) => {
                const triedOriginal = e.currentTarget.dataset?.orig === '1';
                if (!triedOriginal && filename) {
                  // One fallback to original画像（重いが確実）
                  e.currentTarget.dataset.orig = '1';
                  e.currentTarget.srcset = '';
                  e.currentTarget.sizes = '';
                  e.currentTarget.src = `${normalizedBase}images/insects/${encodeURIComponent(filename)}${ext}${assetVer}`;
                  return;
                }
                setImgError(true);
              }}
              loading="lazy"
              decoding="async"
            />
            {/* Hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent hidden"></div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                </svg>
              </div>
          </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-slate-800 dark:text-slate-100 font-bold text-lg mb-1 leading-tight">{name}</h3>
        {insect.scientificName && (
          <p className="text-slate-600 dark:text-slate-400 text-sm italic mb-3">{formatScientificNameReact(insect.scientificName)}</p>
        )}
        
        {normalizedTime && (
          <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
            <EmergenceTimeDisplay 
              emergenceTime={normalizedTime} 
              source={insect.source} 
              compact={true} 
            />
          </div>
        )}
      </div>
    </Link>
  );
};

const HostPlantDetail = ({ moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants, plantDetails, theme }) => {
  const { plantName } = useParams();
  const rawDecodedPlantName = decodeURIComponent(plantName);
  const sanitizePlantParam = (s) => {
    if (!s) return s;
    // Trim whitespace and common stray quote/hyphen characters from both ends
    let x = String(s).trim();
    x = x.replace(/^[\"'“”‚‘’`´\-‐‑–—−]+/, ''); // leading quotes/dashes
    x = x.replace(/[\"'“”‚‘’`´\-‐‑–—−]+$/, ''); // trailing quotes/dashes
    return x.trim();
  };
  const decodedPlantName = sanitizePlantParam(rawDecodedPlantName);

  // If URL provides Latin binomial without a space (e.g., Capparisheyncana), repair for display only
  const isLikelyLatin = (s) => /^[A-Za-z]+$/.test(s);
  // Heuristic: insert a space between genus and species when URL param has no space
  // Prefer boundaries where genus ends with common Latin endings (e.g., -is, -us, -um, -a, -os, -es, -ix, -ia)
  const repairLatinBinomial = (s) => {
    if (!isLikelyLatin(s) || s.includes(' ')) return s;
    const endings = ['ius', 'ium', 'ium', 'is', 'us', 'um', 'a', 'os', 'es', 'ix', 'ia', 'ea', 'or', 'er'];
    let best = null;
    for (let i = s.length - 3; i >= 3; i--) {
      const genus = s.slice(0, i);
      const species = s.slice(i);
      if (/^[A-Z][a-z]+$/.test(genus) && /^[a-z-]{3,}$/.test(species)) {
        if (endings.some(e => genus.endsWith(e))) {
          best = `${genus} ${species}`;
          break; // prefer the longest genus that matches an ending
        }
        // fallback candidate if no ending matched at all
        if (!best) best = `${genus} ${species}`;
      }
    }
    if (best) return best;
    // ultimate fallback: split after first capitalized-lowercase run leaving >=3 chars
    const m = s.match(/^([A-Z][a-z]{2,})([a-z-]{3,})$/);
    return m ? `${m[1]} ${m[2]}` : s;
  };
  const [imageFilenames, setImageFilenames] = useState(new Set());
  const [imageExtensions, setImageExtensions] = useState({});
  
  // Debug logging for plant detail
  logger.debug('HostPlantDetail - plantName param:', plantName);

  // Load image filenames and extension mapping for insect cards (avoid 404s)
  useEffect(() => {
    const load = async () => {
      try {
        const base = import.meta.env.BASE_URL || '/';
        const ver = (import.meta.env.DEV ? String(Date.now()) : (import.meta.env.VITE_ASSET_VERSION || ''));
        const bust = ver ? `?v=${ver}` : '';
        const [fnRes, extRes] = await Promise.allSettled([
          fetch(`${base}image_filenames.txt${bust}`),
          fetch(`${base}image_extensions.json${bust}`)
        ]);
        if (fnRes.status === 'fulfilled' && fnRes.value.ok) {
          const text = await fnRes.value.text();
          setImageFilenames(new Set(text.trim().split('\n').filter(Boolean)));
        }
        if (extRes.status === 'fulfilled' && extRes.value.ok) {
          const json = await extRes.value.json();
          setImageExtensions(json);
        }
      } catch (e) {
        // silent
      }
    };
    load();
  }, []);
  logger.debug('HostPlantDetail - decodedPlantName:', decodedPlantName);
  logger.debug('HostPlantDetail - hostPlants keys:', Object.keys(hostPlants).slice(0, 10));

  const resolvePlantDetail = (name) => {
    if (plantDetails[name]) {
      return { detail: plantDetails[name], canonical: name };
    }
    for (const [canonical, detail] of Object.entries(plantDetails)) {
      const aliasesRaw = detail.aliases || detail.aliasNames;
      const aliases = Array.isArray(aliasesRaw)
        ? aliasesRaw
        : aliasesRaw instanceof Set
          ? Array.from(aliasesRaw)
          : [];
      if (aliases.includes(name)) {
        return { detail, canonical };
      }
      if (canonical.startsWith(`${name} (`) || canonical.startsWith(`${name}（`)) {
        return { detail, canonical };
      }
    }
    return { detail: null, canonical: '' };
  };

  const { detail: resolvedPlantDetail, canonical: resolvedCanonicalName } = resolvePlantDetail(decodedPlantName);
  const details = resolvedPlantDetail || { family: '不明' };
  const [taxonomy, setTaxonomy] = useState({ familyJp: '', familyEn: '', orderJp: '', orderEn: '', genus: '', scientificName: '' });
  const [classificationMembers, setClassificationMembers] = useState([]); // 科/目/属ページ用の構成員（植物名）
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [canonicalName, setCanonicalName] = useState('');
  const [aliasNames, setAliasNames] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const familyLabel = taxonomy.familyJp || details.family || details.familyName || '';

  const displayLatin = resolvedPlantDetail ? (resolvedCanonicalName || decodedPlantName) : repairLatinBinomial(decodedPlantName);

  useEffect(() => {
    if (!canonicalName && resolvedCanonicalName) {
      setCanonicalName(resolvedCanonicalName);
    }
  }, [canonicalName, resolvedCanonicalName]);

  useEffect(() => {
    setClassificationMembers([]);
    setShowAllMembers(false);
  }, [decodedPlantName]);

  const isFamily = /科$/.test(decodedPlantName);
  const isOrder = /目$/.test(decodedPlantName);
  const isGenus = !isFamily && !isOrder && /属$/.test(decodedPlantName);

  const classificationGroups = useMemo(() => {
    if (!isOrder || !Array.isArray(classificationMembers) || classificationMembers.length === 0) return [];
    const grouped = new Map();
    classificationMembers.forEach(name => {
      const detail = plantDetails[name] || {};
      const groupFamily = detail.family || detail.familyName || taxonomy.familyJp || '不明';
      const key = groupFamily || '不明';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(name);
    });
    return Array.from(grouped.entries()).map(([groupFamily, members]) => ({
      family: groupFamily,
      members: members.slice().sort((a, b) => a.localeCompare(b, 'ja'))
    })).sort((a, b) => a.family.localeCompare(b.family, 'ja'));
  }, [isOrder, classificationMembers, plantDetails, taxonomy.familyJp]);

  // SEO（タイトル/ディスクリプション/OG/カノニカル/パンくず）
  const count = classificationMembers && classificationMembers.length ? `（${classificationMembers.length}種）` : '';
  const pageTitle = isFamily
    ? `${decodedPlantName}の植物一覧 | 昆虫食草図鑑`
    : isOrder
    ? `${decodedPlantName}の植物一覧 | 昆虫食草図鑑`
    : isGenus
    ? `${decodedPlantName}の植物一覧 | 昆虫食草図鑑`
    : `${decodedPlantName} - 食草植物の詳細 | 昆虫食草図鑑`;
  const pageDesc = isFamily
    ? `${decodedPlantName}に属する植物${count}の一覧と、各植物を利用する昆虫情報。`
    : isOrder
    ? `${decodedPlantName}に属する植物${count}の一覧と、各植物を利用する昆虫情報。`
    : isGenus
    ? `${decodedPlantName}に属する植物${count}の一覧と、各植物を利用する昆虫情報。`
    : `${decodedPlantName}を食草とする昆虫情報（${familyLabel || '植物'}）。関連する昆虫の一覧や写真ギャラリーを掲載。`;
  const canonicalPlantName = resolvedCanonicalName || decodedPlantName;
  const canonicalHref = absUrl(`/meta/plant/${encodeURIComponent(canonicalPlantName)}.html`);

  const { setOgTwitterImage } = useSeoMeta({
    title: pageTitle,
    description: pageDesc,
    ogType: 'article',
    url: canonicalHref,
    breadcrumbItems: [
      { name: '昆虫食草図鑑', url: absUrl('/') },
      { name: '植物', url: absUrl('/meta/plant/index.html') },
      { name: decodedPlantName, url: canonicalHref },
    ],
    resetCanonicalTo: absUrl('/'),
  });

  // 画像決定後にOG/Twitterの画像を更新（DOMから拾う既存挙動を維持）
  useEffect(() => {
    try {
      const mainImg = document.querySelector('section[aria-labelledby="plant-photos"] img');
      const imgUrl = mainImg?.getAttribute('src');
      if (imgUrl) setOgTwitterImage(imgUrl, `${decodedPlantName}の写真`);
    } catch {}
  }, [decodedPlantName]);

  // ItemList JSON-LD（科・目ページ）
  useEffect(() => {
    try {
      const id = 'itemlist-classification';
      let s = document.querySelector('#' + id);
      if (s) s.remove();
      if (isFamily || isOrder || isGenus) {
        const items = (classificationMembers || []).slice(0, 10).map((name, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${absUrl(`/meta/plant/${encodeURIComponent(name)}.html`)}`
        }));
        s = document.createElement('script');
        s.id = id;
        s.type = 'application/ld+json';
        s.textContent = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${decodedPlantName} 植物一覧`,
          itemListElement: items
        });
        document.head.appendChild(s);
      }
    } catch {}
    return () => {
      const s = document.querySelector('#itemlist-classification');
      if (s) s.remove();
    };
  }, [isFamily, isOrder, isGenus, classificationMembers, decodedPlantName]);
  
  // All insects for RelatedPlants component
  const allInsects = [...moths, ...butterflies, ...beetles, ...leafbeetles];
  
  // 植物名を正規化する関数（App.jsxと同じロジック）
  const normalizePlantName = (plantName) => {
    if (!plantName) return '';
    return plantName
      .replace(/（[^）]*科[^）]*）/g, '') // 全角括弧の科名
      .replace(/\([^)]*科[^)]*\)/g, '') // 半角括弧の科名
      .replace(/（[^）]*）/g, '') // その他の全角括弧
      .replace(/\([^)]*\)/g, '') // その他の半角括弧
      .trim();
  };
  
  // Debug: オニグルミを含む昆虫を探す
  if (decodedPlantName === 'オニグルミ') {
    logger.debug('DEBUG: Searching for オニグルミ in all insects...');
    logger.debug('Total insects:', allInsects.length);
    const onigurumiInsects = allInsects.filter(insect => {
      if (!insect.hostPlants) return false;
      const hostPlantsStr = String(insect.hostPlants);
      return hostPlantsStr.includes('オニグルミ');
    });
    logger.debug('Found insects with オニグルミ:', onigurumiInsects.length);
    onigurumiInsects.forEach(insect => {
      logger.debug(`- ${insect.japaneseName}: hostPlants type=${typeof insect.hostPlants}, value="${insect.hostPlants}"`);
    });
  }
  
  const isFlowerVisitRecord = (record) => {
    if (!record) return false;
    const lifeStage = (record.lifeStage || '').trim();
    const plantPart = (record.plantPart || '').trim();
    return lifeStage === '成虫' && plantPart === '花';
  };

  const targetNames = [decodedPlantName, canonicalName, ...aliasNames].filter(Boolean);
  const normalizedTargets = new Set(targetNames.map(normalizePlantName).filter(Boolean));

  const matchesTargetPlant = (plant) => {
    if (!plant) return false;
    if (targetNames.includes(plant)) return true;
    const normalizedPlant = normalizePlantName(plant);
    if (normalizedTargets.has(normalizedPlant)) return true;
    const cleanPlant = plant.replace(/[(（][^)）]*[)）]/g, '').trim();
    if (targetNames.includes(cleanPlant)) return true;
    const normalizedClean = normalizePlantName(cleanPlant);
    if (normalizedTargets.has(normalizedClean)) return true;
    return false;
  };

  const classifiedInsects = allInsects.map((insect) => {
    const insectDisplayName = (insect.name || insect.japaneseName || '').trim();
    let hasHost = false;
    let hasFlowerVisit = false;

    const hostMapHit = () => {
      if (!insectDisplayName) return false;
      return targetNames.some(target => {
        const list = hostPlants[target];
        return Array.isArray(list) && list.includes(insectDisplayName);
      });
    };

    if (hostMapHit()) hasHost = true;

    if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
      insect.hostPlantsDetailed.forEach((record) => {
        const plantName = String(record?.name || record?.displayName || record?.plant || '').trim();
        if (!plantName) return;
        if (!matchesTargetPlant(plantName)) return;
        if (isFlowerVisitRecord(record)) {
          hasFlowerVisit = true;
        } else {
          hasHost = true;
        }
      });
    } else if (!hasHost && insect.hostPlants) {
      // hostPlantsを文字列に変換（配列の場合も考慮）
      let hostPlantsStr;
      if (typeof insect.hostPlants === 'string') {
        hostPlantsStr = insect.hostPlants;
      } else if (Array.isArray(insect.hostPlants)) {
        hostPlantsStr = insect.hostPlants.join('、');
      } else {
        hostPlantsStr = String(insect.hostPlants);
      }

      const hostPlantsList = hostPlantsStr.split(/[、,；;]/).map(p => p.trim());
      if (hostPlantsList.some(matchesTargetPlant)) {
        hasHost = true;
      }
    }

    if (!hasHost && !hasFlowerVisit) return null;
    const path = buildInsectPath(insect);
    return { ...insect, path, hasHost, hasFlowerVisit };
  }).filter(Boolean);

  const hostPlantInsects = classifiedInsects.filter(i => i.hasHost);
  const flowerVisitInsects = classifiedInsects.filter(i => i.hasFlowerVisit);
  
  // Debug logging for オニグルミ
  if (decodedPlantName === 'オニグルミ') {
    logger.debug('DEBUG: Related insects found for オニグルミ:', hostPlantInsects.length);
    logger.debug('DEBUG: hostPlants[オニグルミ]:', hostPlants['オニグルミ']);
    logger.debug('DEBUG: First few related insects:', hostPlantInsects.slice(0, 5).map(i => i.name || i.japaneseName));
  }

  // ネットワーク図サイズ
  const [graphSize, setGraphSize] = useState({ width: 0, height: 520 });
  const graphRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const w = graphRef.current?.offsetWidth || 0;
      if (w && Math.abs(w - graphSize.width) > 8) {
        setGraphSize({ width: w, height: 520 });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [graphSize.width]);
  
  const [plantImageNames, setPlantImageNames] = useState([]);
  const [plantImageIndexReady, setPlantImageIndexReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPlantImageIndexReady(false);
    loadPlantImageFilenamesService()
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
  }, [decodedPlantName]);

  // Get all available images for this plant (try canonical + aliases)
  const getPlantImages = (plantName, altNames = [], nameIndex = null) => {
    const nameIndexSet = Array.isArray(nameIndex)
      ? new Set(nameIndex.filter(Boolean))
      : null;
    const bases = Array.from(new Set([plantName, ...altNames].filter(Boolean)));
    const images = [];
    const suffixes = [{ suffix: '', label: '全体' }, ...PLANT_IMAGE_SUFFIXES];

    const has = (fullName) => {
      if (!nameIndexSet) return true; // allow optimistic fetch when index missing
      return nameIndexSet.has(fullName);
    };
    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/';

    const resolveNameWithIndex = (base, suffix) => {
      if (!nameIndexSet) return `${base}${suffix}`;
      if (!suffix) return has(base) ? base : null;
      const suffixCore = suffix.startsWith('_') ? suffix.slice(1) : suffix;
      const candidates = new Set();
      if (suffix.startsWith('_')) {
        candidates.add(`${base}${suffix}`);             // ASCII underscore
        candidates.add(`${base}＿${suffixCore}`);       // Full-width underscore
        if (suffixCore) candidates.add(`${base}${suffixCore}`); // No underscore
      } else {
        candidates.add(`${base}${suffix}`);
        if (suffixCore && suffixCore !== suffix) candidates.add(`${base}${suffixCore}`);
      }
      const hit = Array.from(candidates).find(name => has(name));
      return hit || null;
    };

    const buildCandidates = (name) => {
      const encodedName = encodeURIComponent(name);
      const extensions = ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG', '.webp', '.WEBP'];
      const variations = [];
      extensions.forEach((ext) => {
        variations.push(`${baseUrl}images/plants/${encodedName}${ext}`);
      });
      extensions.forEach((ext) => {
        variations.push(`${baseUrl}images/plants/${name}${ext}`);
      });
      return Array.from(new Set(variations.filter(Boolean)));
    };

    bases.forEach((base) => {
      suffixes.forEach(({ suffix, label }) => {
        const finalName = nameIndexSet
          ? resolveNameWithIndex(base, suffix)
          : `${base}${suffix}`;
        if (finalName && has(finalName)) {
          const appliedSuffix = finalName.startsWith(base) ? finalName.slice(base.length) : '';
          images.push({
            label,
            alt: `${base}${appliedSuffix ? ` (${label})` : ''}`,
            candidates: buildCandidates(finalName)
          });
        } else if (!nameIndexSet && suffix === '') {
          // When no index is available, still attempt the base filename once
          images.push({
            label,
            alt: base,
            candidates: buildCandidates(base)
          });
        }
      });
    });
    return images;
  };

  const plantImages = useMemo(() => {
    if (!plantImageIndexReady) return [];
    return getPlantImages(decodedPlantName, aliasNames, plantImageNames);
  }, [decodedPlantName, aliasNames, plantImageNames, plantImageIndexReady]);

  // (no sticky tabs; aligns with insect page)

  // Thin-content guard: if this is a plant page with no related insects, mark as noindex
  useEffect(() => {
    try {
      const isTaxonList = isFamily || isOrder || isGenus;
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      if (!isTaxonList && Array.isArray(hostPlantInsects) && hostPlantInsects.length === 0 && Array.isArray(flowerVisitInsects) && flowerVisitInsects.length === 0) {
        robots.content = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
      } else {
        robots.content = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
      }
    } catch {}
  }, [isFamily, isOrder, isGenus, hostPlantInsects, flowerVisitInsects]);

  // Load classification: prefer lite JSON, fallback to CSV
  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    const isTaxonListPage = isFamily || isOrder || isGenus;
    const loadFromLite = async () => {
      try {
        const res = await fetch(`${base}assets/data-lite/ylist-lite.json${import.meta.env.DEV ? `?v=${Date.now()}` : ''}`, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
        if (!res.ok) return false;
        const lite = await res.json();
        const plants = lite?.plants || {};
        const aliasToCanonical = lite?.aliasToCanonical || {};
        const target = decodedPlantName;
        if (!isTaxonListPage) {
          const canonical = plants[target] ? target : (aliasToCanonical[target] || '');
          const info = canonical ? plants[canonical] : null;
          if (!info) return false;
          setTaxonomy({
            familyJp: info.familyJp || '',
            familyEn: info.familyEn || '',
            orderJp: info.orderJp || '',
            orderEn: info.orderEn || '',
            genus: '',
            scientificName: info.scientificName || ''
          });
          setCanonicalName(canonical || '');
          const aliases = Array.isArray(info.aliases) ? info.aliases.filter(a => a && a !== canonical) : [];
          setAliasNames(aliases);
          // If the URL contained stray characters or an alias, redirect to canonical clean URL
          if ((rawDecodedPlantName && rawDecodedPlantName !== target) || (canonical && canonical !== target)) {
            navigate(`/plant/${encodeURIComponent(canonical || target)}`, { replace: true, state: location.state });
          }
          return true;
        }
        // taxon pages: use familiesMap/ordersMap if available
        if (isFamily) {
          const members = (lite.familiesMap && lite.familiesMap[target]) ? lite.familiesMap[target] : [];
          if (Array.isArray(members) && members.length > 0) {
            setTaxonomy({ familyJp: target, familyEn: '', orderJp: '', orderEn: '', genus: '', scientificName: '' });
            setClassificationMembers(members.slice().sort((a,b)=> a.localeCompare(b,'ja')));
            return true;
          }
        }
        if (isOrder) {
          const members = (lite.ordersMap && lite.ordersMap[target]) ? lite.ordersMap[target] : [];
          if (Array.isArray(members) && members.length > 0) {
            setTaxonomy({ familyJp: '', familyEn: '', orderJp: target, orderEn: '', genus: '', scientificName: '' });
            setClassificationMembers(members.slice().sort((a,b)=> a.localeCompare(b,'ja')));
            return true;
          }
        }
        if (isGenus) {
          const genusMapping = await fetchGenusMapping(base);
          const candidates = buildGenusCandidates(target);
          let mappingEntry = null;
          for (const key of candidates) {
            if (genusMapping && genusMapping[key]) {
              mappingEntry = genusMapping[key];
              break;
            }
          }
          let genusLatin = mappingEntry?.scientificName || '';
          let genusFamily = mappingEntry?.family || '';
          const detailCandidates = candidates.map(key => plantDetails[key]).filter(Boolean);
          detailCandidates.forEach(detail => {
            if (!genusLatin && detail?.genusScientificName) genusLatin = detail.genusScientificName;
            if (!genusLatin && detail?.scientificName) {
              const first = String(detail.scientificName).split(' ')[0];
              if (first) genusLatin = first;
            }
            if (!genusFamily && detail?.genusFamily) genusFamily = detail.genusFamily;
            if (!genusFamily && detail?.family && detail.family !== '不明') genusFamily = detail.family;
          });
          const normalizedLatin = (genusLatin || '').trim();
          const memberSet = new Set();
          if (normalizedLatin) {
            Object.entries(plants).forEach(([name, info]) => {
              const sci = info?.scientificName || '';
              const genus = (sci.split(/\s+/)[0] || '').trim();
              if (genus === normalizedLatin) memberSet.add(name.trim());
            });
            if (memberSet.size === 0) {
              Object.entries(plantDetails || {}).forEach(([name, detail]) => {
                const genusCandidate = (detail?.genusScientificName || detail?.genus || '').trim();
                if (genusCandidate && genusCandidate === normalizedLatin) memberSet.add(name);
              });
            }
          }
          const members = Array.from(memberSet).sort((a, b) => a.localeCompare(b, 'ja'));
          if (members.length > 0) {
            const first = plants[members[0]] || {};
            setTaxonomy({
              familyJp: (genusFamily || first.familyJp || '').trim(),
              familyEn: (first.familyEn || '').trim(),
              orderJp: (first.orderJp || '').trim(),
              orderEn: (first.orderEn || '').trim(),
              genus: normalizedLatin,
              scientificName: normalizedLatin
            });
            setClassificationMembers(members);
            return true;
          }
          if (genusFamily || normalizedLatin) {
            setTaxonomy(prev => ({
              familyJp: (genusFamily || prev.familyJp || '').trim(),
              familyEn: prev.familyEn || '',
              orderJp: prev.orderJp || '',
              orderEn: prev.orderEn || '',
              genus: normalizedLatin || prev.genus || '',
              scientificName: normalizedLatin || prev.scientificName || ''
            }));
          }
        }
        return false;
      } catch {
        return false;
      }
    };

    const loadFromCsv = async () => {
      const url = `${base}20210514YList_download.csv`;
      const text = await fetch(url).then(r => r.text());
        const res = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = res.data || [];
        // Normalize column keys to trim BOM or spaces
        const normalizeKeys = (obj) => {
          const out = {};
          Object.keys(obj).forEach(k => {
            const nk = k.replace(/^\ufeff/, '').trim();
            out[nk] = obj[k];
          });
          return out;
        };

        const target = decodedPlantName;
        // Try exact match on 和名, then fallback to 別名に含む
        let hit = null;
        for (const row0 of rows) {
          const row = normalizeKeys(row0);
          if ((row['和名'] || '').trim() === target) { hit = row; break; }
        }
        if (!hit) {
          for (const row0 of rows) {
            const row = normalizeKeys(row0);
            const aliases = (row['別名'] || '').split(/[、,]/).map(s => s.trim()).filter(Boolean);
            if (aliases.includes(target)) { hit = row; break; }
          }
        }

        // Support family/order pages when no exact plant hit (e.g., アカネ科, アブラナ目)
        if (!hit) {
          const findFamilyRow = (famJp) => {
            for (const row0 of rows) {
              const row = normalizeKeys(row0);
              const fam = (row['LAPGII::LAPG科名'] || row['LAPG 科名'] || row['Cronquist 科名'] || row['Engler 科名'] || '').trim();
              if (fam && fam === famJp) return row;
            }
            return null;
          };
          const findOrderRow = (ordJp) => {
            for (const row0 of rows) {
              const row = normalizeKeys(row0);
              const ord = (row['LAPGII::LAPG 目'] || row['LAPGII::LAPG Order'] || '').trim();
              if (ord && ord === ordJp) return row;
            }
            return null;
          };
          if (/科$/.test(target)) {
            const famRow = findFamilyRow(target);
            if (famRow) {
              const familyJp = target;
              const familyEn = (famRow['LAPGII::LAPG Family狭義'] || famRow['LAPGII::LAPG Family広義'] || famRow['LAPG Family'] || famRow['Cronquist family'] || famRow['Engler family'] || '').trim();
              const orderJp  = (famRow['LAPGII::LAPG 目'] || famRow['LAPGII::LAPG Order'] || '').trim();
              const orderEn  = (famRow['LAPGII::LAPG Order'] || '').trim();
              setTaxonomy({ familyJp, familyEn, orderJp, orderEn, genus: '', scientificName: '' });

              // Collect all plants in this family
              const members = Array.from(new Set(rows
                .map(normalizeKeys)
                .filter(r => ((r['LAPGII::LAPG科名'] || r['LAPG 科名'] || r['Cronquist 科名'] || r['Engler 科名'] || '').trim()) === familyJp)
                .map(r => (r['和名'] || '').trim())
                .filter(Boolean))
              ).sort((a,b) => a.localeCompare(b, 'ja'));
              setClassificationMembers(members);
            }
          } else if (/目$/.test(target)) {
            const ordRow = findOrderRow(target);
            if (ordRow) {
              const orderJp = target;
              const orderEn = (ordRow['LAPGII::LAPG Order'] || '').trim();
              setTaxonomy({ familyJp: '', familyEn: '', orderJp, orderEn, genus: '', scientificName: '' });

              // Collect all plants in this order
              const members = Array.from(new Set(rows
                .map(normalizeKeys)
                .filter(r => ((r['LAPGII::LAPG 目'] || r['LAPGII::LAPG Order'] || '').trim()) === orderJp)
                .map(r => (r['和名'] || '').trim())
                .filter(Boolean))
              ).sort((a,b) => a.localeCompare(b, 'ja'));
              setClassificationMembers(members);
            }
          } else if (isGenus) {
            const genusMapping = await fetchGenusMapping(base);
            const candidates = buildGenusCandidates(target);
            let mappingEntry = null;
            for (const key of candidates) {
              if (genusMapping && genusMapping[key]) {
                mappingEntry = genusMapping[key];
                break;
              }
            }
            let genusLatin = mappingEntry?.scientificName || '';
            let genusFamily = mappingEntry?.family || '';
            const detailCandidates = candidates.map(key => plantDetails[key]).filter(Boolean);
            detailCandidates.forEach(detail => {
              if (!genusLatin && detail?.genusScientificName) genusLatin = detail.genusScientificName;
              if (!genusLatin && detail?.scientificName) {
                const first = String(detail.scientificName).split(' ')[0];
                if (first) genusLatin = first;
              }
              if (!genusFamily && detail?.genusFamily) genusFamily = detail.genusFamily;
              if (!genusFamily && detail?.family && detail.family !== '不明') genusFamily = detail.family;
            });
            const normalizedLatin = (genusLatin || '').trim();
            const memberSet = new Set();
            let firstRowMatch = null;
            if (normalizedLatin) {
              rows.forEach(row0 => {
                const row = normalizeKeys(row0);
                const sciRaw = (row['学名'] || row['学名 withAuthor'] || '').trim();
                if (!sciRaw) return;
                const genusPart = (sciRaw.split(/\s+/)[0] || '').trim();
                if (genusPart === normalizedLatin) {
                  const jpName = (row['和名'] || '').trim();
                  if (jpName) memberSet.add(jpName);
                  if (!firstRowMatch) firstRowMatch = row;
                }
              });
            }
            if (memberSet.size === 0 && normalizedLatin) {
              Object.entries(plantDetails || {}).forEach(([name, detail]) => {
                const genusCandidate = (detail?.genusScientificName || detail?.genus || '').trim();
                if (genusCandidate && genusCandidate === normalizedLatin) memberSet.add(name);
              });
            }
            const members = Array.from(memberSet).sort((a, b) => a.localeCompare(b, 'ja'));
            if (members.length > 0) {
              const familyFromRow = firstRowMatch
                ? (firstRowMatch['LAPGII::LAPG科名'] || firstRowMatch['LAPG 科名'] || firstRowMatch['Cronquist 科名'] || firstRowMatch['Engler 科名'] || '').trim()
                : '';
              const orderFromRow = firstRowMatch
                ? (firstRowMatch['LAPGII::LAPG 目'] || firstRowMatch['LAPGII::LAPG Order'] || '').trim()
                : '';
              setTaxonomy({
                familyJp: (genusFamily || familyFromRow || '').trim(),
                familyEn: '',
                orderJp: orderFromRow,
                orderEn: '',
                genus: normalizedLatin,
                scientificName: normalizedLatin
              });
              setClassificationMembers(members);
            } else if (genusFamily || normalizedLatin) {
              setTaxonomy(prev => ({
                familyJp: (genusFamily || prev.familyJp || '').trim(),
                familyEn: prev.familyEn || '',
                orderJp: prev.orderJp || '',
                orderEn: prev.orderEn || '',
                genus: normalizedLatin || prev.genus || '',
                scientificName: normalizedLatin || prev.scientificName || ''
              }));
            }
          }
        }
        if (hit) {
          const familyJp = hit['LAPGII::LAPG科名'] || hit['LAPG 科名'] || hit['Cronquist 科名'] || hit['Engler 科名'] || '';
          const familyEn = hit['LAPGII::LAPG Family狭義'] || hit['LAPGII::LAPG Family広義'] || hit['LAPG Family'] || hit['Cronquist family'] || hit['Engler family'] || '';
          const orderJp  = hit['LAPGII::LAPG 目'] || hit['LAPGII::LAPG Order'] || '';
          const orderEn  = hit['LAPGII::LAPG Order'] || '';
          let sci = (hit['学名'] || '').trim();
          if (!sci) sci = (hit['学名 withAuthor'] || '').trim();
          let genus = '';
          if (sci) genus = (sci.split(/\s+/)[0] || '').trim();
          setTaxonomy({ familyJp: (familyJp||'').trim(), familyEn: (familyEn||'').trim(), orderJp: (orderJp||'').trim(), orderEn: (orderEn||'').trim(), genus, scientificName: sci });

          // 別名を保持して正規化に利用
          const canonical = (hit['和名'] || '').trim();
          const aliases = (hit['別名'] || '').split(/[、,]/).map(s => s.trim()).filter(Boolean);
          setCanonicalName(canonical);
          setAliasNames(aliases);

          // もし別名で到達していたら正規の和名へリダイレクト（URL統一）
          if (canonical && canonical !== decodedPlantName && !/科$/.test(target) && !/目$/.test(target)) {
            navigate(`/plant/${encodeURIComponent(canonical)}`, { replace: true, state: location.state });
          }
        }
      };

    (async () => {
      const ok = await loadFromLite();
      if (!ok) {
        try { await loadFromCsv(); } catch {}
      }
    })();
  }, [decodedPlantName, navigate, isFamily, isOrder, isGenus, plantDetails]);

  // Fallback: if taxonomy couldn't resolve genus/scientificName (e.g., サクラ類),
  // try to use normalized plantDetails (e.g., サクラ -> Cerasus)
  useEffect(() => {
    try {
      const missingGenus = !taxonomy.genus || taxonomy.genus.trim() === '';
      const missingSci = !taxonomy.scientificName || taxonomy.scientificName.trim() === '';
      if (!missingGenus && !missingSci) return;

      const altKey = decodedPlantName.replace(/類$/, '');
      const d = plantDetails[decodedPlantName] || plantDetails[altKey];
      if (!d) return;

      const derivedGenus = d.genus || (d.scientificName ? String(d.scientificName).split(' ')[0] : '');
      const derivedSci = d.scientificName || '';
      const derivedFamily = d.family || '';

      if ((derivedGenus && missingGenus) || (derivedSci && missingSci) || derivedFamily) {
        setTaxonomy(prev => ({
          familyJp: prev.familyJp || derivedFamily || '',
          familyEn: prev.familyEn || '',
          orderJp: prev.orderJp || '',
          orderEn: prev.orderEn || '',
          genus: prev.genus || derivedGenus || '',
          scientificName: prev.scientificName || derivedSci || ''
        }));
      }
    } catch {}
  }, [decodedPlantName, plantDetails, taxonomy.genus, taxonomy.scientificName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top row: back link + classification chips (unified with insect detail) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
        <Link 
          to={getBackTarget(location, '/plant')}
          state={makeDetailLinkState(location)}
          className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-200 shadow-sm hover:shadow-md text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          一覧に戻る
        </Link>
        <div className="flex flex-wrap gap-2">
          {taxonomy.orderJp && (
            <Link
              to={`/?tab=plants&porder=${encodeURIComponent(taxonomy.orderJp)}`}
              className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:bg-emerald-200/70 dark:hover:bg-emerald-900/50"
              aria-label={`${taxonomy.orderJp} の植物を検索`}
            >
              <span className="font-medium">{taxonomy.orderJp}</span>
              {taxonomy.orderEn && (
                <span className="ml-1 text-xs italic opacity-80">{taxonomy.orderEn}</span>
              )}
            </Link>
          )}
          {familyLabel && (
            <Link
              to={`/?tab=plants&pfamily=${encodeURIComponent(familyLabel)}`}
              className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50 hover:bg-blue-200/70 dark:hover:bg-blue-900/50"
              aria-label={`${familyLabel} の植物を検索`}
            >
              <span className="font-medium">{familyLabel}</span>
              {taxonomy.familyEn && (
                <span className="ml-1 text-xs italic opacity-80">{taxonomy.familyEn}</span>
              )}
            </Link>
          )}
          {taxonomy.genus && (
            <Link
              to={`/?tab=plants&q=${encodeURIComponent(taxonomy.genus)}`}
              className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-300 transition-all duration-200 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200/70 dark:hover:bg-slate-900/50"
              aria-label={`${taxonomy.genus} の植物を検索`}
            >
              <span className="font-medium italic">{taxonomy.genus}</span>
            </Link>
          )}
        </div>
      </div>
      <nav
        aria-label="ページ内リンク"
        className="mb-8 rounded-2xl bg-white/85 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 px-4 py-3 shadow-sm"
      >
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">ページ内</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href="#basic-info"
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            概要
          </a>
          <a
            href="#plant-photos"
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/60 transition-colors"
          >
            写真
          </a>
          {classificationMembers && classificationMembers.length > 0 && (
            <a
              href="#classification-members"
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 hover:bg-blue-200/80 dark:hover:bg-blue-900/60 transition-colors"
            >
              分類内の植物
            </a>
          )}
          <a
            href="#plant-network"
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/60 transition-colors"
          >
            ネットワーク
          </a>
          <a
            href="#related-insects"
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            関連昆虫
          </a>
        </div>
      </nav>
      {/* 構造化データ */}
      <PlantStructuredData 
        plant={{
          name: decodedPlantName,
          canonicalName: canonicalPlantName,
          scientificName: isLikelyLatin(displayLatin) ? displayLatin : undefined,
          family: familyLabel,
        }} 
        relatedInsects={hostPlantInsects}
      />
      
      {/* 概要セクション（和名＋学名のみ） */}
      <div id="basic-info" className="mt-4 md:mt-6 scroll-mt-24">
      <div className="mb-6">
        {/* Breadcrumb UI removed per request */}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white text-left">
            {/^[\u3040-\u30ff\u3400-\u9fff]/.test(decodedPlantName)
              ? decodedPlantName
              : (<span className="whitespace-nowrap break-keep">{formatScientificNameReact(displayLatin)}</span>)}
          </h1>
          {aliasNames.length > 0 && (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">別名:</span> {aliasNames.join('、')}
            </div>
          )}
          {taxonomy.scientificName && (
            <div className="mt-1 text-left text-slate-600 dark:text-slate-300 text-lg">
              {formatScientificNameReact(taxonomy.scientificName)}
            </div>
          )}
        </div>
      </div>

      {/* 植物画像ギャラリー */}
      <section id="plant-photos" aria-labelledby="plant-photos" className="mb-12 md:mb-16 lg:mb-20 scroll-mt-24">
        <PlantImageGallery images={plantImages} plantName={decodedPlantName} />
      </section>

      {/* 科／目ページ用：この分類に属する植物一覧 */}
      {classificationMembers && classificationMembers.length > 0 && (
        <section id="classification-members" className="mb-12 md:mb-16 lg:mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
            {isFamily ? 'この科に属する植物一覧' : isOrder ? 'この目に属する植物一覧' : 'この属に属する植物一覧'}（{classificationMembers.length}種）
          </h2>
          {(isOrder && classificationGroups && classificationGroups.length > 0) ? (
            <div className="space-y-6">
              {classificationGroups.map(group => (
                <div key={group.family}>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">{group.family}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {group.members.map(name => (
                      <Link key={group.family + ':' + name} to={`/plant/${encodeURIComponent(name)}`} state={makeDetailLinkState(location)} className="inline-flex items-center px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                        <span className="truncate">{name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(showAllMembers ? classificationMembers : classificationMembers.slice(0, 48)).map((name) => (
                  <Link key={name} to={`/plant/${encodeURIComponent(name)}`} state={makeDetailLinkState(location)} className="inline-flex items-center px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                    <span className="truncate">{name}</span>
                  </Link>
                ))}
              </div>
              {classificationMembers.length > 48 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllMembers(s => !s)}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200/70 dark:hover:bg-emerald-800/50 transition-colors"
                  >
                    {showAllMembers ? '簡略表示' : `他${classificationMembers.length - 48}種を表示`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 食草ネットワーク（植物中心） */}
      <section id="plant-network" className="mb-12 md:mb-16 lg:mb-20 scroll-mt-24">
        <div className="bg-white/85 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 rounded-2xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/70">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/90 text-white flex items-center justify-center shadow-md">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">食草ネットワーク</p>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">この植物を利用する昆虫</h2>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950/25" ref={graphRef}>
            <div className="h-[540px]">
              <React.Suspense fallback={
                <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                  ネットワーク図を読み込み中...
                </div>
              }>
                {graphSize.width > 0 && (
                  <FoodWebGraph
                    currentPlantName={decodedPlantName}
                    allInsects={allInsects}
                    hostPlantsMap={hostPlants}
                    width={graphSize.width}
                    height={graphSize.height}
                    theme={theme}
                  />
                )}
              </React.Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* この植物を利用する昆虫一覧（カード表示） */}
      <div id="related-insects" className="mt-12 md:mt-16 mb-10 scroll-mt-24">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-8 flex items-center">
          <svg className="w-8 h-8 mr-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          関連する昆虫
        </h2>
        {hostPlantInsects.length === 0 && flowerVisitInsects.length === 0 ? (
          <div className="text-slate-500 dark:text-slate-400">関連する昆虫が見つかりませんでした。</div>
        ) : (
          <div className="space-y-10">
            {hostPlantInsects.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 mb-4">
                  幼虫の食草として利用する昆虫 ({hostPlantInsects.length}種)
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {hostPlantInsects.map((insect, idx) => (
                    <InsectCard key={`host-${insect.id || idx}`} insect={insect} idx={idx} imageFilenames={imageFilenames} imageExtensions={imageExtensions} />
                  ))}
                </div>
              </div>
            )}
            {flowerVisitInsects.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-pink-600 dark:text-pink-300 mb-4">
                  訪花で利用する昆虫 ({flowerVisitInsects.length}種)
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {flowerVisitInsects.map((insect, idx) => (
                    <InsectCard key={`flower-${insect.id || idx}`} insect={insect} idx={idx} imageFilenames={imageFilenames} imageExtensions={imageExtensions} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 前後の植物へのナビゲーション */}
      <DetailNavigation 
        allItems={useMemo(() => Object.keys(hostPlants).sort((a, b) => a.localeCompare(b, 'ja')).map(name => ({ name })), [hostPlants])} 
        currentId={decodedPlantName} 
        type="plant" 
      />

      {/* 関連する他の植物 - 一時的にコメントアウト */}
      {/* 
      <div className="mb-8">
        <RelatedPlants 
          currentPlant={decodedPlantName} 
          currentFamily={details.family}
          allInsects={allInsects}
        />
      </div>
      */}
      </div>
    </div>
  );
};

export default HostPlantDetail;
