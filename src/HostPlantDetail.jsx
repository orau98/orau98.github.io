import React, { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import Papa from 'papaparse';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { PlantStructuredData } from './components/StructuredData';
import logger from './utils/logger';
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
import { loadPlantImageFilenames as loadPlantImageFilenamesService } from './services/imageIndex';
import {
  createSafePlantFilename,
  createSafeScientificPlantFilename,
  PLANT_IMAGE_SUFFIXES,
} from './utils/filename';
import { globalJapaneseToScientificMapping } from './utils/insectImageMappings';
import { buildInsectPath } from './utils/insectSlug';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from './utils/insectImageResolver';
import ImageWithFallback from './components/ImageWithFallback';
import {
  buildResponsivePicture,
  buildResizedImageUrl,
} from './utils/imageSrcset';
import DetailNavigation from './components/DetailNavigation';
import { sortPlantNamesTaxonomically } from './utils/taxonomicOrder';
import DetailSectionNav from './components/DetailSectionNav';
import NativeShareButton from './components/NativeShareButton';
import ManualAdSlot from './components/ManualAdSlot';
import { extractEmergenceTime, normalizeEmergenceTime } from './utils/emergenceTimeUtils';
import EmergenceTimeDisplay from './components/EmergenceTimeDisplay';
import { getBackTarget, makeDetailLinkState } from './utils/navState';
import { normalizePlantKey as normalizePlantName } from './utils/plantNameUtils';
import { buildPlantProfileSummary, buildSourceLabel, normalizePlantProfileText } from './utils/plantProfileText';
import SourceCitation from './components/ui/SourceCitation';
import InfoPopover from './components/InfoPopover';
import {
  INDEX_FOLLOW_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  setRobotsMetaContent,
} from './utils/robotsMeta';
import { buildPlantMetaPagePath, buildPlantPath } from './utils/siteTaxonomy';
import Breadcrumb from './components/Breadcrumb';
const FoodWebGraph = React.lazy(() => import('./components/FoodWebGraph'));

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

const ImageModal = ({ image, isOpen, onClose, onImageError, images = [], currentIndex = 0, onNavigate, locale = 'ja' }) => {
  const isActive = Boolean(isOpen && image);
  const isEnglish = isEnglishLocale(locale);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastActiveElementRef = useRef(null);
  const labelId = useId();
  const hasLabel = Boolean(image?.label);
  const dialogLabel = image?.label || image?.alt || (isEnglish ? 'Image preview' : '画像表示');
  const modalCandidates = useMemo(() => {
    const originals = Array.isArray(image?.originalCandidates) ? image.originalCandidates : [];
    return Array.from(new Set([
      ...originals,
      image?.modalSrc,
      image?.finalSrc,
      image?.src,
    ].filter(Boolean)));
  }, [image]);
  const [modalSrc, setModalSrc] = useState(modalCandidates[0] || '');
  const [modalCandidateIndex, setModalCandidateIndex] = useState(0);

  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex > 0 && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1 && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, images.length, onNavigate]);

  // キーボードナビゲーション + フォーカストラップ
  useEffect(() => {
    if (!isActive) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        handlePrev(e);
        return;
      }
      if (e.key === 'ArrowRight') {
        handleNext(e);
        return;
      }
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

        if (focusable.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement;

        if (e.shiftKey) {
          if (activeEl === first || activeEl === dialog) {
            e.preventDefault();
            last.focus();
          }
        } else if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handlePrev, handleNext, onClose]);

  // Open/close focus management
  useEffect(() => {
    if (!isActive) return undefined;
    if (typeof document !== 'undefined') {
      lastActiveElementRef.current = document.activeElement;
    }
    const focusTarget = closeButtonRef.current || dialogRef.current;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    return () => {
      const prev = lastActiveElementRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isActive]);

  useEffect(() => {
    setModalCandidateIndex(0);
    setModalSrc(modalCandidates[0] || '');
  }, [modalCandidates]);

  const handleModalImageError = (event) => {
    const nextIndex = modalCandidateIndex + 1;
    const nextSrc = modalCandidates[nextIndex];
    if (nextSrc) {
      setModalCandidateIndex(nextIndex);
      setModalSrc(nextSrc);
      if (event?.currentTarget) event.currentTarget.src = nextSrc;
      return;
    }
    onImageError?.(image?.id, event);
  };

  const hasMultiple = images.length > 1;

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-label={!hasLabel ? dialogLabel : undefined}
        tabIndex={-1}
        className="relative max-w-6xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* メイン画像 */}
        <img
          src={modalSrc}
          alt={image.alt}
          className="w-full h-full object-contain rounded-lg shadow-2xl"
          onError={handleModalImageError}
        />

        {/* 閉じるボタン */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
          aria-label={isEnglish ? 'Close' : '閉じる'}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 前へボタン */}
        {hasMultiple && currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
            aria-label={isEnglish ? 'Previous image' : '前の画像'}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* 次へボタン */}
        {hasMultiple && currentIndex < images.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110"
            aria-label={isEnglish ? 'Next image' : '次の画像'}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* 下部情報バー */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2">
            <p id={hasLabel ? labelId : undefined} className="text-white font-medium">
              {image.label}
            </p>
          </div>

          {/* 画像カウンター */}
          {hasMultiple && (
            <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-white font-medium tabular-nums">
                {currentIndex + 1} / {images.length}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlantImageGallery = ({ images, plantName = '', locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
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

    const seenSlotKeys = new Set();
    const normalized = images.flatMap((image, idx) => {
      const candidates = Array.isArray(image.candidates) && image.candidates.length
        ? image.candidates
        : [image.src, image.srcJPG].filter(Boolean);
      const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
      const slotKey =
        String(image.slotKey || `${plantName || ''}::${image.label || image.alt || idx}`).trim();
      if (seenSlotKeys.has(slotKey)) {
        return [];
      }
      seenSlotKeys.add(slotKey);
      return [{
        ...image,
        id: image.id || `${image.alt || 'plant'}-${idx}`,
        slotKey,
        candidates: uniqueCandidates,
        modalSrc: Array.isArray(image.originalCandidates) && image.originalCandidates.length
          ? image.originalCandidates[0]
          : uniqueCandidates[0],
        candidateIndex: 0,
        finalSrc: uniqueCandidates[0],
      }];
    });

    setAvailableImages(normalized);
    setMainImage(normalized[0] || null);
    setSelectedImage(normalized[0] || null);
    setModalOpen(false);
    setLoading(false);
  }, [images, plantName]);

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
    // 昆虫詳細の「写真未登録」通知と同じコンパクトなスタイルに揃える
    return (
      <div className="rounded-card border border-line bg-surface shadow-e1 flex items-center gap-2.5 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{isEnglish ? 'No photographs are registered for this plant yet.' : 'この植物の写真はまだ登録されていません。'}</span>
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
            <button
              type="button"
              className="group relative block w-full text-left bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
              onClick={() => handleImageClick(mainImage)}
              aria-label={isEnglish ? `Open enlarged photo of ${plantName || mainImage.label || mainImage.alt}` : `${plantName || mainImage.alt}の写真を拡大表示`}
            >
              <div className="relative bg-slate-100 dark:bg-slate-900 overflow-hidden aspect-[16/10] min-h-[200px] md:min-h-[300px] lg:min-h-[400px]">
                <img 
                  src={mainImage.finalSrc}
                  alt={isEnglish ? `${plantName || mainImage.label || mainImage.alt} photograph` : `${mainImage.alt}の写真`}
                  width="1600"
                  height="1000"
                  className="w-full h-full object-contain"
                  onError={(event) => handleImageError(mainImage.id, event)}
                  loading="lazy"
                />
                
                {/* Elegant gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100"></div>
                
                {/* Image label overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0">
                  <h3 className="text-white font-bold text-xl drop-shadow-lg">{mainImage.label}</h3>
                  <p className="text-white/90 text-sm drop-shadow-md mt-1">{isEnglish ? 'Click to enlarge' : 'クリックで拡大表示'}</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Thumbnail gallery */}
        {availableImages.length > 1 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              {isEnglish ? 'More photos' : 'その他の写真'}
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {availableImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={`group relative w-full text-left bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    mainImage?.finalSrc === image.finalSrc 
                      ? 'ring-3 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' 
                      : ''
                  }`}
                  onClick={() => {
                    setMainImage(image);
                    setSelectedImage(image);
                  }}
                  aria-label={isEnglish ? `Show ${image.label} as the main image` : `${image.label}をメイン画像に表示`}
                >
                  <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
                    <img 
                      src={image.finalSrc}
                      alt={isEnglish ? `${image.label || plantName || image.alt} photograph` : `${image.alt}の写真`}
                      width="400"
                      height="400"
                      className="w-full h-full object-contain"
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
                </button>
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
        images={availableImages}
        currentIndex={availableImages.findIndex(img => img.id === selectedImage?.id)}
        locale={locale}
        onNavigate={(newIndex) => {
          const newImage = availableImages[newIndex];
          if (newImage) {
            setSelectedImage(newImage);
            setMainImage(newImage);
          }
        }}
      />
    </>
  );
};

// カードコンポーネント（昆虫詳細ページのデザインに近い表現）
const InsectCard = React.memo(({ insect, imageFilenames = new Set(), imageExtensions = {}, locale = 'ja' }) => {
  const [imgError, setImgError] = React.useState(false);
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const normalizedImageEntries = React.useMemo(
    () => buildNormalizedEntries(imageFilenames, imageExtensions),
    [imageFilenames, imageExtensions],
  );
  // Resolve the best image basename for this insect
  const filename = React.useMemo(() => {
    const nameJp = (insect?.name || insect?.japaneseName || '').trim();
    const mapped = globalJapaneseToScientificMapping.get(nameJp);
    const resolvedBases = resolveImageBaseCandidates(
      buildInsectImageBaseCandidates(insect, mapped),
      {
        imageExtensions,
        imageNames: imageFilenames,
        normalizedEntries: normalizedImageEntries,
        includeUnresolved: false,
      },
    );
    return resolvedBases[0] || '';
  }, [imageExtensions, imageFilenames, insect, normalizedImageEntries]);
  const hasImage = Boolean(filename);
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const assetVer = import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : '';
  const responsive = filename
    ? buildResponsivePicture({
        folder: 'insects',
        filename,
        widths: [320, 640, 1024],
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
      })
    : {};
  const resizedSrc = filename
    ? buildResizedImageUrl({
        baseUrl: normalizedBase,
        folder: 'insects',
        filename,
        width: 640,
        query: assetVer,
      })
    : '';
  const imgSrc = responsive.src || resizedSrc;
  const href = insect.path || '#';
  const name = insect.name || insect.japaneseName || '（名称不明）';
  const primaryName = isEnglish
    ? getPrimaryEnglishName({
        scientificName: insect.scientificName,
        japaneseName: name,
        fallback: name,
      })
    : name;
  const secondaryName = isEnglish ? buildJapaneseReferenceLabel(name) : '';
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
            <ImageWithFallback
              src={imgSrc}
              srcSet={responsive.srcSet}
              sizes={responsive.sizes}
              sources={responsive.sources}
              alt={isEnglish ? `${primaryName} photograph` : name}
              width="1200"
              height="900"
              className="w-full h-full"
              imgClassName="transition-all duration-700 hover:scale-105"
              fit="cover"
              onError={() => {
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
        <h3 className="text-slate-800 dark:text-slate-100 font-bold text-lg mb-1 leading-tight">
          {isEnglish && insect.scientificName
            ? formatScientificNameReact(primaryName)
            : primaryName}
        </h3>
        {isEnglish ? (
          secondaryName && (
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{secondaryName}</p>
          )
        ) : insect.scientificName && (
          <p className="text-slate-600 dark:text-slate-400 text-sm italic mb-3">{formatScientificNameReact(insect.scientificName)}</p>
        )}
        
        {(() => {
          const supplementalEmergenceTexts = Array.from(new Set([
            insect.notes || '',
            ...(Array.isArray(insect.generalNotes) ? insect.generalNotes.map((note) => note?.content || '') : [])
          ].map((text) => String(text || '').trim()).filter(Boolean)));
          const hasSupplementalEmergenceHint = supplementalEmergenceTexts.some((text) =>
            /(成虫|出現|羽化|発生|得られ|見られ|採れ|採集|越冬|越年|春の蛾|夏の蛾|秋の蛾|冬の蛾|周年|通年|年中)/.test(text)
          );

          if (!normalizedTime && !hasSupplementalEmergenceHint) {
            return null;
          }

          return (
          <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
            <EmergenceTimeDisplay 
              emergenceTime={normalizedTime || ''}
              source={insect.source} 
              compact={true}
              supplementalTexts={supplementalEmergenceTexts}
              locale={locale}
            />
          </div>
          );
        })()}
      </div>
    </Link>
  );
});

// 写真の無い関連昆虫はカードではなくコンパクトな名前チップで一覧する
// （大きな空カードの羅列を避ける。RelatedInsectsSectionのチップと同スタイル）
const InsectNameChip = React.memo(({ insect, locale = 'ja' }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const href = insect.path || '#';
  const name = insect.name || insect.japaneseName || '（名称不明）';
  const primaryName = isEnglish
    ? getPrimaryEnglishName({
        scientificName: insect.scientificName,
        japaneseName: name,
        fallback: name,
      })
    : name;
  return (
    <Link
      to={href}
      state={href && href !== '#' ? makeDetailLinkState(location) : undefined}
      className="inline-flex items-center rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
    >
      {isEnglish && insect.scientificName
        ? formatScientificNameReact(primaryName)
        : primaryName}
    </Link>
  );
});

const HostPlantDetail = ({ moths, butterflies = [], beetles = [], longhornbeetles = [], leafbeetles = [], aphids = [], hostPlants, plantDetails, theme, flowerVisitPlants = {}, locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const englishPlantRouteMap = useSeoRouteMap('plants');
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
      } catch (_e) {
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

  const normalizedDecodedPlantName = normalizePlantName(decodedPlantName);
  const primaryResolvedPlant = resolvePlantDetail(decodedPlantName);
  const fallbackResolvedPlant = (
    primaryResolvedPlant.detail ||
    !normalizedDecodedPlantName ||
    normalizedDecodedPlantName === decodedPlantName
  )
    ? { detail: null, canonical: '' }
    : resolvePlantDetail(normalizedDecodedPlantName);
  const { detail: resolvedPlantDetail, canonical: resolvedCanonicalName } = primaryResolvedPlant.detail
    ? primaryResolvedPlant
    : fallbackResolvedPlant;
  const details = useMemo(
    () => resolvedPlantDetail || { family: '不明' },
    [resolvedPlantDetail],
  );
  const [taxonomy, setTaxonomy] = useState({ familyJp: '', familyEn: '', orderJp: '', orderEn: '', genus: '', scientificName: '' });
  const [classificationMembers, setClassificationMembers] = useState([]); // 科/目/属ページ用の構成員（植物名）
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [canonicalName, setCanonicalName] = useState('');
  const [aliasNames, setAliasNames] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const familyLabel = taxonomy.familyJp || details.family || details.familyName || '';
  const orderChip = buildLocalizedTaxonomyChip({
    locale,
    japaneseName: taxonomy.orderJp,
    scientificName: taxonomy.orderEn,
  });
  const familyChip = buildLocalizedTaxonomyChip({
    locale,
    japaneseName: familyLabel,
    scientificName: taxonomy.familyEn,
  });

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
  const plantProfile = (!isFamily && !isOrder && !isGenus && details?.profile)
    ? details.profile
    : null;
  const plantProfileFacts = useMemo(() => {
    if (!plantProfile) return [];
    const labels = isEnglish
      ? {
          family: 'Family',
          genus: 'Genus',
          habit: 'Habit',
          height: 'Size',
          flowerPeriod: 'Flowering',
          distribution: 'Distribution',
          habitat: 'Habitat',
          source: 'Source',
        }
      : {
          family: '科',
          genus: '属',
          habit: '生活型',
          height: '大きさ',
          flowerPeriod: '花期',
          distribution: '分布',
          habitat: '生育環境',
          source: '出典',
        };
    const genusValue = [
      plantProfile.genusJp,
      details?.genus,
    ]
      .map((value) => String(value || '').trim())
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(' / ');
    const rows = [
      // 見出しチップ（familyLabel）と科名の参照元を揃え、解説とチップで食い違わないようにする
      ['family', familyLabel],
      ['genus', genusValue],
      ['habit', plantProfile.habit],
      ['height', plantProfile.height],
      ['flowerPeriod', plantProfile.flowerPeriod],
      ['distribution', plantProfile.distribution],
      ['habitat', plantProfile.habitat],
    ]
      .map(([key, value]) => ({ key, label: labels[key], value: normalizePlantProfileText(value) }))
      .filter((row) => row.value);
    // 出典は facts グリッドに混ぜず、プロフィール末尾の SourceCitation に集約（サイト共通の控えめ表記）
    return rows;
  }, [plantProfile, details, isEnglish, familyLabel]);

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
  const primaryPlantName = isEnglish
    ? getPrimaryEnglishName({
        scientificName: displayLatin,
        japaneseName: decodedPlantName,
        fallback: decodedPlantName,
      })
    : decodedPlantName;
  const plantProfileSummary = useMemo(() => buildPlantProfileSummary({
    name: primaryPlantName,
    profile: plantProfile,
    family: familyLabel,
    genus: details?.genus || taxonomy.genus,
    scientificName: details?.scientificName || taxonomy.scientificName,
    isEnglish,
  }), [
    primaryPlantName,
    plantProfile,
    details,
    taxonomy.genus,
    taxonomy.scientificName,
    isEnglish,
    familyLabel,
  ]);
  const japaneseReference = isEnglish ? buildJapaneseReferenceLabel(decodedPlantName) : '';
  const pageTitle = isFamily
    ? (isEnglish ? `${primaryPlantName} plant index | ${EN_SITE_NAME}` : `${decodedPlantName}の植物一覧 | 昆虫植物図鑑`)
    : isOrder
    ? (isEnglish ? `${primaryPlantName} plant index | ${EN_SITE_NAME}` : `${decodedPlantName}の植物一覧 | 昆虫植物図鑑`)
    : isGenus
    ? (isEnglish ? `${primaryPlantName} plant index | ${EN_SITE_NAME}` : `${decodedPlantName}の植物一覧 | 昆虫植物図鑑`)
    : isEnglish
      ? `${primaryPlantName} | Plant profile from Japan`
      : `${decodedPlantName} - 食草植物の詳細 | 昆虫植物図鑑`;
  const pageDesc = isFamily
    ? (isEnglish ? `${primaryPlantName}. Browse plants in this group and the insects linked to them.` : `${decodedPlantName}に属する植物${count}の一覧と、各植物を利用する昆虫情報。`)
    : isOrder
    ? (isEnglish ? `${primaryPlantName}. Browse plants in this group and the insects linked to them.` : `${decodedPlantName}に属する植物${count}の一覧と、各植物を利用する昆虫情報。`)
    : isGenus
    ? (isEnglish ? `${primaryPlantName}. Browse plants in this group and the insects linked to them.` : `${decodedPlantName}に属する植物${count}の一覧と、各植物を利用する昆虫情報。`)
    : isEnglish
      ? `${primaryPlantName}. ${japaneseReference || 'Japanese names are shown only as local references.'} Review the related insects, photos, and network links for this plant.`
      : `${decodedPlantName}を食草とする昆虫情報（${familyLabel || '植物'}）。関連する昆虫の一覧や写真ギャラリーを掲載。`;
  const canonicalPlantName = resolvedCanonicalName || decodedPlantName;
  const quizFocusHref = canonicalPlantName
    ? `${localizePath('/quiz', locale)}?mode=plant-to-insect&style=photo&focusPlant=${encodeURIComponent(canonicalPlantName)}`
    : '';
  const plantMetaPath = buildPlantMetaPagePath(canonicalPlantName, 'ja');
  const englishPlantMetaPath =
    !isFamily && !isOrder && !isGenus && canonicalPlantName
      ? englishPlantRouteMap[canonicalPlantName]
      : null;
  const canonicalHref = absUrl(
    isEnglish
      ? (
        englishPlantMetaPath ||
        localizePath(location.pathname || buildPlantPath(canonicalPlantName, locale), locale)
      )
      : plantMetaPath
  );
  const alternateJaHref = absUrl(plantMetaPath);
  const alternateEnHref = absUrl(
    englishPlantMetaPath ||
    localizePath(location.pathname, 'en')
  );
  const shareUrl =
    canonicalHref ||
    (typeof window !== 'undefined' && window.location?.href) ||
    '';
  const shareText = isEnglish
    ? `${primaryPlantName} | ${EN_SITE_NAME}`
    : `${decodedPlantName}｜昆虫植物図鑑`;
  const shareXUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const shareLineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;
  const [copyFeedback, setCopyFeedback] = useState('idle');
  const copyFeedbackTimeoutRef = useRef(null);

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
    breadcrumbItems: [
      { name: isEnglish ? EN_SITE_NAME : '昆虫植物図鑑', url: absUrl(localizePath('/', locale)) },
      { name: isEnglish ? 'Plants' : '植物', url: absUrl(localizePath('/?tab=plants', locale)) },
      { name: primaryPlantName, url: canonicalHref },
    ],
    resetCanonicalTo: absUrl(localizePath('/', locale)),
  });

  // 画像決定後にOG/Twitterの画像を更新（DOMから拾う既存挙動を維持）
  useEffect(() => {
    try {
      const mainImg = document.querySelector('section[aria-labelledby="plant-photos"] img');
      const imgUrl = mainImg?.getAttribute('src');
      if (imgUrl) {
        setOgTwitterImage(
          imgUrl,
          isEnglish ? `${primaryPlantName} photograph` : `${decodedPlantName}の写真`,
        );
      }
    } catch {}
  }, [decodedPlantName, isEnglish, primaryPlantName, setOgTwitterImage]);

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
  const allInsects = [...moths, ...butterflies, ...beetles, ...longhornbeetles, ...leafbeetles, ...aphids];
  
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
    if (record.isFlowerVisit === true) return true;
    const lifeStage = (record.lifeStage || '').trim();
    const plantPart = (record.plantPart || '').trim();
    const partCompact = plantPart.replace(/\s+/g, '');
    const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
    return isAdultOrUnknown && partCompact && partCompact.includes('花');
  };

  const detailAliasNames = useMemo(() => {
    const aliasesRaw = resolvedPlantDetail?.aliases || resolvedPlantDetail?.aliasNames;
    const aliases = Array.isArray(aliasesRaw)
      ? aliasesRaw
      : aliasesRaw instanceof Set
        ? Array.from(aliasesRaw)
        : [];
    return aliases
      .map((name) => String(name || '').trim())
      .filter(Boolean);
  }, [resolvedPlantDetail]);
  const relatedAliasNames = useMemo(
    () => Array.from(new Set([...aliasNames, ...detailAliasNames].filter(Boolean))),
    [aliasNames, detailAliasNames],
  );
  const targetNames = useMemo(
    () => Array.from(new Set([decodedPlantName, canonicalName, ...relatedAliasNames].filter(Boolean))),
    [decodedPlantName, canonicalName, relatedAliasNames],
  );
  const normalizedTargets = useMemo(
    () => new Set(targetNames.map(normalizePlantName).filter(Boolean)),
    [targetNames],
  );
  const normalizedFlowerVisitPlants = useMemo(() => {
    const map = {};
    Object.entries(flowerVisitPlants || {}).forEach(([plant, insects]) => {
      const normalized = normalizePlantName(plant);
      if (!normalized || normalized === '不明') return;
      if (!map[normalized]) map[normalized] = new Set();
      if (Array.isArray(insects)) {
        insects.forEach((name) => {
          if (name) map[normalized].add(name);
        });
      }
    });
    const obj = {};
    Object.entries(map).forEach(([key, set]) => {
      obj[key] = Array.from(set);
    });
    return obj;
  }, [flowerVisitPlants]);
  const flowerVisitInsectSet = useMemo(() => {
    const set = new Set();
    const addList = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach((name) => {
        if (name) set.add(name);
      });
    };
    const keys = new Set([...targetNames, ...normalizedTargets]);
    keys.forEach((key) => {
      if (!key) return;
      const normalizedKey = normalizePlantName(key);
      addList(normalizedFlowerVisitPlants?.[normalizedKey] || normalizedFlowerVisitPlants?.[key]);
    });
    return set;
  }, [normalizedFlowerVisitPlants, targetNames, normalizedTargets]);

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
    let matchedTarget = false;
    let matchedLarval = false;

    const hostMapHit = () => {
      if (!insectDisplayName) return false;
      return targetNames.some(target => {
        const normalizedTarget = normalizePlantName(target);
        const list = hostPlants[target] || (normalizedTarget && hostPlants[normalizedTarget]);
        return Array.isArray(list) && list.includes(insectDisplayName);
      });
    };
    const flowerMapHit = () => {
      if (!insectDisplayName) return false;
      return flowerVisitInsectSet.has(insectDisplayName);
    };

    if (hostMapHit()) hasHost = true;
    if (flowerMapHit()) hasFlowerVisit = true;

    if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
      insect.hostPlantsDetailed.forEach((record) => {
        const plantName = String(record?.name || record?.displayName || record?.plant || '').trim();
        if (!plantName) return;
        if (!matchesTargetPlant(plantName)) return;
        matchedTarget = true;
        if (isFlowerVisitRecord(record)) {
          hasFlowerVisit = true;
        } else {
          hasHost = true;
          matchedLarval = true;
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

    // If detailed records show only flower visits for this plant, avoid classifying as host
    if (matchedTarget && !matchedLarval && hasFlowerVisit) {
      hasHost = false;
    }

    if (!hasHost && !hasFlowerVisit) return null;
    const path = buildInsectPath(insect, locale);
    return { ...insect, path, hasHost, hasFlowerVisit };
  }).filter(Boolean);

  const hostPlantInsects = classifiedInsects.filter(i => i.hasHost);
  const flowerVisitInsects = classifiedInsects.filter(i => i.hasFlowerVisit);

  // 関連昆虫を「写真あり（カード表示）」と「写真なし（チップ表示）」に分ける
  const relatedImageEntries = useMemo(
    () => buildNormalizedEntries(imageFilenames, imageExtensions),
    [imageFilenames, imageExtensions],
  );
  const partitionInsectsByPhoto = (list) => {
    const withPhoto = [];
    const withoutPhoto = [];
    (list || []).forEach((insect) => {
      const nameJp = (insect?.name || insect?.japaneseName || '').trim();
      const mapped = globalJapaneseToScientificMapping.get(nameJp);
      const resolved = resolveImageBaseCandidates(
        buildInsectImageBaseCandidates(insect, mapped),
        {
          imageExtensions,
          imageNames: imageFilenames,
          normalizedEntries: relatedImageEntries,
          includeUnresolved: false,
        },
      );
      (resolved[0] ? withPhoto : withoutPhoto).push(insect);
    });
    return { withPhoto, withoutPhoto };
  };
  const hostInsectGroups = partitionInsectsByPhoto(hostPlantInsects);
  const flowerInsectGroups = partitionInsectsByPhoto(flowerVisitInsects);

  const hostInsectKeys = useMemo(() => {
    const set = new Set();
    hostPlantInsects.forEach((insect) => {
      const key = String(insect?.id || insect?.name || insect?.japaneseName || '').trim();
      if (key) set.add(key);
    });
    return set;
  }, [hostPlantInsects]);
  const flowerInsectKeys = useMemo(() => {
    const set = new Set();
    flowerVisitInsects.forEach((insect) => {
      const key = String(insect?.id || insect?.name || insect?.japaneseName || '').trim();
      if (key) set.add(key);
    });
    return set;
  }, [flowerVisitInsects]);
  const bothInsectCount = useMemo(() => {
    let count = 0;
    hostInsectKeys.forEach((key) => {
      if (flowerInsectKeys.has(key)) count += 1;
    });
    return count;
  }, [hostInsectKeys, flowerInsectKeys]);
  const totalInsectCount = useMemo(() => {
    const set = new Set();
    hostInsectKeys.forEach((key) => set.add(key));
    flowerInsectKeys.forEach((key) => set.add(key));
    return set.size;
  }, [hostInsectKeys, flowerInsectKeys]);
  
  // Debug logging for オニグルミ
  if (decodedPlantName === 'オニグルミ') {
    logger.debug('DEBUG: Related insects found for オニグルミ:', hostPlantInsects.length);
    logger.debug('DEBUG: hostPlants[オニグルミ]:', hostPlants['オニグルミ']);
    logger.debug('DEBUG: First few related insects:', hostPlantInsects.slice(0, 5).map(i => i.name || i.japaneseName));
  }

  // ネットワーク図サイズ
  const [graphSize, setGraphSize] = useState({ width: 0, height: 520 });
  const graphRef = useRef(null);
  // 重い力学グラフはスクロールで近づくまでダウンロード・マウントしない
  const graphNearViewport = useNearViewport(graphRef);

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
  const getPlantImages = (plantName, altNames = [], nameIndex = null, scientificName = '') => {
    const nameIndexSet = Array.isArray(nameIndex)
      ? new Set(nameIndex.filter(Boolean))
      : null;
    const hasUsableIndex = Boolean(nameIndexSet && nameIndexSet.size > 0);
    if (!hasUsableIndex) return [];

    const scientificBase = createSafeScientificPlantFilename(scientificName);
    const addBaseEntry = (map, lookupBase, displayBase) => {
      const normalizedBase = String(lookupBase || '').trim();
      if (!normalizedBase) return;
      if (!map.has(normalizedBase)) {
        map.set(normalizedBase, { lookupBase: normalizedBase, displayBase });
      }
    };
    const baseEntryMap = new Map();
    [plantName, ...altNames].filter(Boolean).forEach((name) => {
      const displayBase = plantName || name;
      const firstToken = String(name).split(/\s+/)[0];
      [
        name,
        firstToken,
        createSafePlantFilename(name),
        createSafePlantFilename(firstToken),
      ].forEach((candidate) => addBaseEntry(baseEntryMap, candidate, displayBase));
    });
    if (scientificBase) {
      addBaseEntry(baseEntryMap, scientificBase, plantName || scientificName || scientificBase);
    }
    const baseEntries = Array.from(baseEntryMap.values());
    const images = [];
    const flowerSuffixes = PLANT_IMAGE_SUFFIXES.filter(({ label }) => label === '花');
    const otherSuffixes = PLANT_IMAGE_SUFFIXES.filter(({ label }) => label !== '花');
    const suffixes = [...flowerSuffixes, { suffix: '', label: '全体' }, ...otherSuffixes];
    const addedNames = new Set();
    const addedSlots = new Set();

    const has = (fullName) => nameIndexSet.has(fullName);
    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/';

    const resolveNameWithIndex = (base, suffix) => {
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
      const originalCandidates = extensions.map((ext) => `${baseUrl}images/plants/${encodedName}${ext}`);
      const variations = [
        `${baseUrl}images/resized/plants/${encodedName}.1024.jpg`,
        `${baseUrl}images/resized/plants/${encodedName}.1024.webp`,
        `${baseUrl}images/resized/plants/${encodedName}.1024.avif`,
        `${baseUrl}images/resized/plants/${encodedName}.640.jpg`,
        `${baseUrl}images/resized/plants/${encodedName}.640.webp`,
        ...originalCandidates,
      ];
      return Array.from(new Set(variations.filter(Boolean)));
    };

    const buildOriginalCandidates = (name) => {
      const encodedName = encodeURIComponent(name);
      const extensions = ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG', '.webp', '.WEBP'];
      return [
        `${baseUrl}images/resized/plants/${encodedName}.1024.jpg`,
        `${baseUrl}images/resized/plants/${encodedName}.1024.webp`,
        `${baseUrl}images/resized/plants/${encodedName}.1024.avif`,
        ...extensions.map((ext) => `${baseUrl}images/plants/${encodedName}${ext}`),
      ];
    };

    const buildLabelFromSuffix = (suffix, fallback = '画像') => {
      if (!suffix) return '全体';
      const trimmed = String(suffix).replace(/^[_＿]+/, '');
      if (!trimmed) return '全体';
      return trimmed.replace(/[_＿]+/g, '・') || fallback;
    };

    const nameMatchesBase = (name, base) => {
      if (!name || !base) return false;
      if (name === base) return true;
      if (name.startsWith(`${base}_`) || name.startsWith(`${base}＿`)) return true;
      if (!name.startsWith(base)) return false;
      const tail = name.slice(base.length);
      return PLANT_IMAGE_SUFFIXES.some(({ suffix, label }) => {
        const suffixCore = String(suffix || '').replace(/^[_＿]+/, '');
        return tail === label || tail === suffixCore;
      });
    };

    const buildSlotKey = (base, label, appliedSuffix = '') => {
      const baseKey = String(base || plantName || '').trim();
      const slotLabel = String(label || buildLabelFromSuffix(appliedSuffix || '') || '全体')
        .replace(/[_＿]+/g, '・')
        .trim();
      return `${baseKey}::${slotLabel}`;
    };

    const pushImage = (finalName, base, label, appliedSuffix = '', customCandidates = null) => {
      if (!finalName || addedNames.has(finalName)) return;
      const resolvedLabel = label || buildLabelFromSuffix(appliedSuffix || '');
      const slotKey = buildSlotKey(base, resolvedLabel, appliedSuffix);
      if (addedSlots.has(slotKey)) return;
      addedNames.add(finalName);
      addedSlots.add(slotKey);
      const candidateList = Array.isArray(customCandidates) && customCandidates.length
        ? customCandidates
        : buildCandidates(finalName);
      images.push({
        label: resolvedLabel,
        alt: `${base}${appliedSuffix ? ` (${label || buildLabelFromSuffix(appliedSuffix || '')})` : ''}`,
        slotKey,
        candidates: candidateList.slice(0, 12),
        originalCandidates: buildOriginalCandidates(finalName).slice(0, 8),
      });
    };

    baseEntries.forEach(({ lookupBase, displayBase }) => {
      suffixes.forEach(({ suffix, label }) => {
        const finalName = resolveNameWithIndex(lookupBase, suffix);
        if (finalName && has(finalName)) {
          const appliedSuffix = finalName.startsWith(lookupBase) ? finalName.slice(lookupBase.length) : '';
          pushImage(finalName, displayBase, label, appliedSuffix);
        }
      });
      // Include additional suffix variants present in the index (e.g., _紅葉)
      nameIndex
        .filter((name) => nameMatchesBase(name, lookupBase))
        .forEach((name) => {
          if (addedNames.has(name)) return;
          const suffixPart = name.startsWith(lookupBase) ? name.slice(lookupBase.length) : '';
          const label = buildLabelFromSuffix(suffixPart, '画像');
          pushImage(name, displayBase, label, suffixPart);
        });
    });
    return images;
  };

  const plantScientificName =
    resolvedPlantDetail?.scientificName ||
    details?.scientificName ||
    taxonomy.scientificName ||
    '';

  const plantImages = useMemo(() => {
    if (!plantImageIndexReady) return [];
    return getPlantImages(canonicalPlantName, relatedAliasNames, plantImageNames, plantScientificName);
  }, [canonicalPlantName, relatedAliasNames, plantImageNames, plantImageIndexReady, plantScientificName]);

  // 写真があるときだけ2カラム化する。写真が無い場合は情報カラムを全幅にして
  // 「空の写真枠が左に居座って情報が右に押し込まれる」不格好さを避ける。
  const hasPlantPhotos = plantImages.length > 0;

  // (no sticky tabs; aligns with insect page)

  // Thin-content guard: if this is a plant page with no related insects, mark as noindex
  useEffect(() => {
    try {
      const isTaxonList = isFamily || isOrder || isGenus;
      const shouldIndex =
        isTaxonList ||
        (Array.isArray(hostPlantInsects) && hostPlantInsects.length > 0) ||
        (Array.isArray(flowerVisitInsects) && flowerVisitInsects.length > 0);
      setRobotsMetaContent(shouldIndex ? INDEX_FOLLOW_ROBOTS : NOINDEX_FOLLOW_ROBOTS);
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
        const normalizedTarget = normalizePlantName(target);
        if (!isTaxonListPage) {
          const detailName = plantDetails[target]
            ? target
            : (normalizedTarget && plantDetails[normalizedTarget] ? normalizedTarget : '');
          const exactDetail = detailName ? plantDetails[detailName] : null;
          if (exactDetail) {
            setTaxonomy({
              familyJp: exactDetail.familyName || exactDetail.family || '',
              familyEn: exactDetail.familyLatin || '',
              orderJp: exactDetail.order || '',
              orderEn: exactDetail.orderLatin || '',
              genus: exactDetail.genusScientificName || exactDetail.genus || '',
              scientificName: exactDetail.scientificName || ''
            });
            setCanonicalName(detailName);
            const aliasesRaw = exactDetail.aliases || exactDetail.aliasNames;
            const aliases = Array.isArray(aliasesRaw)
              ? aliasesRaw.filter(a => a && a !== detailName)
              : [];
            setAliasNames(aliases);
            if (
              (rawDecodedPlantName && rawDecodedPlantName !== target) ||
              (detailName && detailName !== target)
            ) {
              navigate(buildPlantPath(detailName || target, locale), { replace: true, state: location.state });
            }
            return true;
          }

          const lookupCandidates = Array.from(new Set([target, normalizedTarget].filter(Boolean)));
          let canonical = '';
          for (const candidate of lookupCandidates) {
            if (plants[candidate]) {
              canonical = candidate;
              break;
            }
            if (aliasToCanonical[candidate]) {
              canonical = aliasToCanonical[candidate];
              break;
            }
          }
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
          if (
            (rawDecodedPlantName && rawDecodedPlantName !== target) ||
            (normalizedTarget && normalizedTarget !== target) ||
            (canonical && canonical !== target)
          ) {
            navigate(buildPlantPath(canonical || target, locale), { replace: true, state: location.state });
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
            navigate(buildPlantPath(canonical, locale), { replace: true, state: location.state });
          }
        }
      };

    (async () => {
      const ok = await loadFromLite();
      if (!ok) {
        try { await loadFromCsv(); } catch {}
      }
    })();
  }, [decodedPlantName, navigate, isFamily, isOrder, isGenus, locale, location.state, plantDetails, rawDecodedPlantName]);

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
      {/* パンくずリスト（昆虫詳細と同じく最上部に配置） */}
      <div className="hidden md:block mb-4">
        <Breadcrumb
          locale={locale}
          items={[
            { label: isEnglish ? 'Home' : 'ホーム', path: localizePath('/', locale) },
            { label: isEnglish ? 'Plants' : '植物', path: localizePath('/?tab=plants', locale) },
            ...(familyLabel && !isFamily && !isOrder ? [{ label: familyLabel, path: buildPlantPath(familyLabel, locale) }] : []),
            {
              label: isEnglish && !isFamily && !isOrder && /[A-Za-z]/.test(primaryPlantName)
                ? <span className="whitespace-nowrap break-keep">{formatScientificNameReact(primaryPlantName)}</span>
                : primaryPlantName,
            },
          ]}
        />
      </div>
      {/* Top row: back link + quiz link + classification chips（昆虫詳細と統一）。
          モバイルは1行横スクロールにして冒頭の折り返しゴチャつきを防ぐ */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 [&>*]:shrink-0 sm:flex-wrap sm:overflow-visible sm:pb-0 lg:mb-8">
        <Link
          to={getBackTarget(location, localizePath('/?tab=plants', locale))}
          state={makeDetailLinkState(location)}
          className="ui-btn ui-btn-secondary whitespace-nowrap px-3 py-2 text-xs shadow-sm transition-transform hover:shadow-md active:scale-95 sm:text-sm"
        >
          <svg className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="sm:hidden">{isEnglish ? 'Back' : '一覧へ'}</span>
          <span className="hidden sm:inline">{isEnglish ? 'Back to list' : '一覧に戻る'}</span>
        </Link>
        {quizFocusHref && (
          <Link
            to={quizFocusHref}
            className="inline-flex items-center whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950 sm:text-sm"
          >
            <span className="sm:hidden">{isEnglish ? 'Review' : 'クイズ'}</span>
            <span className="hidden sm:inline">{isEnglish ? 'Review in quiz' : 'この植物をクイズで復習'}</span>
          </Link>
        )}
        {orderChip.label && orderChip.queryValue && (
          <Link
            to={localizePath(`/?tab=plants&porder=${encodeURIComponent(orderChip.queryValue)}`, locale)}
            className={`${isFamily ? 'inline-flex' : 'hidden sm:inline-flex'} items-center rounded-lg border border-emerald-200/60 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-all duration-200 hover:bg-emerald-200/70 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 sm:px-3 sm:text-sm`}
            aria-label={isEnglish ? `Search plants in ${orderChip.label}` : `${orderChip.label} の植物を検索`}
          >
            <span className="font-medium">{orderChip.label}</span>
            {orderChip.referenceLabel && (
              <span className="ml-1 hidden text-[11px] opacity-80 sm:inline">{orderChip.referenceLabel}</span>
            )}
          </Link>
        )}
        {familyChip.label && familyChip.queryValue && (
          <Link
            to={localizePath(`/?tab=plants&pfamily=${encodeURIComponent(familyChip.queryValue)}`, locale)}
            className={`${isFamily ? 'hidden md:inline-flex' : 'inline-flex'} items-center rounded-lg border border-blue-200/60 bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 transition-all duration-200 hover:bg-blue-200/70 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 sm:px-3 sm:text-sm`}
            aria-label={isEnglish ? `Search plants in ${familyChip.label}` : `${familyChip.label} の植物を検索`}
          >
            <span className="font-medium">{familyChip.label}</span>
            {familyChip.referenceLabel && (
              <span className="ml-1 hidden text-[11px] opacity-80 sm:inline">{familyChip.referenceLabel}</span>
            )}
          </Link>
        )}
        {taxonomy.genus && (
          <Link
            to={localizePath(`/?tab=plants&q=${encodeURIComponent(taxonomy.genus)}`, locale)}
            className="hidden items-center rounded-lg border border-slate-200/60 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 transition-all duration-200 hover:bg-slate-200/70 dark:border-slate-700/50 dark:bg-slate-900/30 dark:text-slate-300 dark:hover:bg-slate-900/50 sm:px-3 sm:text-sm md:inline-flex"
            aria-label={isEnglish ? `Search plants in genus ${taxonomy.genus}` : `${taxonomy.genus} の植物を検索`}
          >
            <span className="font-medium italic">{taxonomy.genus}</span>
          </Link>
        )}
      </div>
      <DetailSectionNav
        label={isEnglish ? 'Plant detail sections' : '植物詳細のセクション'}
        items={[
          { id: 'plant-photos', label: isEnglish ? 'Photo' : '写真' },
          ...(plantProfileFacts.length > 0 ? [{ id: 'plant-profile', label: isEnglish ? 'Profile' : '解説' }] : []),
          { id: 'classification-members', label: isEnglish ? 'Relatives' : '同じ分類' },
          { id: 'plant-network', label: isEnglish ? 'Network' : 'ネットワーク' },
          { id: 'related-insects', label: isEnglish ? 'Related' : '関連昆虫' },
          { id: 'share', label: isEnglish ? 'Share' : '共有' },
        ]}
      />
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
      
      {/* モバイルは写真ファーストの1カラム。lg以上は写真を左に固定した2カラムにして、
          初期表示で種名・解説が写真と同時に見えるようにする（昆虫詳細と統一） */}
      <div className={`mt-4 md:mt-6 mb-12 md:mb-16 lg:mb-20 ${hasPlantPhotos ? 'space-y-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0' : 'space-y-6'}`}>
        {/* 植物画像ギャラリー（昆虫ページと同様、写真を解説より先に出す） */}
        <section
          id="plant-photos"
          aria-label={isEnglish ? 'Plant photographs' : '植物の写真'}
          className={`scroll-mt-24 ${hasPlantPhotos ? 'lg:sticky lg:top-24 lg:col-span-3' : ''}`}
        >
          <PlantImageGallery images={plantImages} plantName={decodedPlantName} locale={locale} />
        </section>

        {/* 情報セクション */}
        <div className="space-y-4 lg:col-span-2">
          {/* 概要セクション（和名＋学名のみ） */}
          <div id="basic-info" className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden p-6 scroll-mt-24">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 text-left">
            {isEnglish
              ? <span className="whitespace-nowrap break-keep">{formatScientificNameReact(primaryPlantName)}</span>
              : /^[\u3040-\u30ff\u3400-\u9fff]/.test(decodedPlantName)
                ? decodedPlantName
                : (<span className="whitespace-nowrap break-keep">{formatScientificNameReact(displayLatin)}</span>)}
          </h1>
          {isEnglish && japaneseReference && (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {japaneseReference}
            </div>
          )}
          {!isEnglish && aliasNames.length > 0 && (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">別名:</span> {aliasNames.join('、')}
            </div>
          )}
          {!isEnglish && taxonomy.scientificName && (
            <div className="mt-1 text-left text-slate-600 dark:text-slate-300 text-lg">
              {formatScientificNameReact(taxonomy.scientificName)}
            </div>
          )}
          </div>

          {plantProfileFacts.length > 0 && (
            <section id="plant-profile" className="scroll-mt-24">
              <div className="rounded-card border border-line bg-surface p-5 shadow-e1">
                <h2 className="mb-4 text-xl font-bold text-slate-800 dark:text-slate-100">
              {isEnglish ? 'Plant Profile' : '解説・植物情報'}
            </h2>
            {plantProfileSummary && (
              <div className="mb-5 border-b border-slate-200/70 pb-5 dark:border-slate-800">
                <h3 className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {isEnglish ? 'Summary' : '解説'}
                </h3>
                <p className="text-sm leading-7 text-slate-800 dark:text-slate-100">
                  {plantProfileSummary}
                </p>
              </div>
            )}
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {plantProfileFacts.map((item) => (
                <div key={item.key} className="border-b border-slate-200/70 pb-3 dark:border-slate-800">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-800 dark:text-slate-100">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <SourceCitation
              sources={buildSourceLabel(plantProfile)}
              isEnglish={isEnglish}
              resolveLinks={false}
                  className="mt-5 border-t border-slate-200/70 pt-4 dark:border-slate-800"
                />
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 科／目ページ用：この分類に属する植物一覧 */}
      {classificationMembers && classificationMembers.length > 0 && (
        <section id="classification-members" className="mb-12 md:mb-16 lg:mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
            {isEnglish
              ? (
                  <>
                    {(!isFamily && !isOrder && /[A-Za-z]/.test(primaryPlantName))
                      ? formatScientificNameReact(primaryPlantName)
                      : primaryPlantName}
                    {` group plants (${classificationMembers.length})`}
                  </>
                )
              : `${isFamily ? 'この科に属する植物一覧' : isOrder ? 'この目に属する植物一覧' : 'この属に属する植物一覧'}（${classificationMembers.length}種）`}
          </h2>
          {(isOrder && classificationGroups && classificationGroups.length > 0) ? (
            <div className="space-y-6">
              {classificationGroups.map(group => (
                <div key={group.family}>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">{group.family}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {group.members.map(name => (
                      <Link key={group.family + ':' + name} to={buildPlantPath(name, locale)} state={makeDetailLinkState(location)} className="inline-flex items-center px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
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
                  <Link key={name} to={buildPlantPath(name, locale)} state={makeDetailLinkState(location)} className="inline-flex items-center px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
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
                    {showAllMembers
                      ? isEnglish
                        ? 'Show less'
                        : '簡略表示'
                      : isEnglish
                        ? `Show ${classificationMembers.length - 48} more`
                        : `他${classificationMembers.length - 48}種を表示`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 食草・訪花ネットワーク（植物中心） */}
      <section id="plant-network" className="mb-12 md:mb-16 lg:mb-20 scroll-mt-24">
        <div className="rounded-card border border-line bg-surface shadow-e1 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/70">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/90 text-white flex items-center justify-center shadow-md">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isEnglish ? 'Plant relationships' : '食草・訪花ネットワーク'}
                </p>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {isEnglish ? 'Insects associated with this plant' : 'この植物に関わる昆虫'}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                    {isEnglish ? `${totalInsectCount} species` : `関連 ${totalInsectCount}種`}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                    {isEnglish ? `Larval hosts ${hostPlantInsects.length}` : `食草 ${hostPlantInsects.length}種`}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                    {isEnglish ? `Flower visitors ${flowerVisitInsects.length}` : `訪花 ${flowerVisitInsects.length}種`}
                  </span>
                  {bothInsectCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                      {isEnglish ? `Both ${bothInsectCount}` : `両方 ${bothInsectCount}種`}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{isEnglish ? 'Legend' : '凡例の使い方'}</span>
                  <InfoPopover
                    title={isEnglish ? 'Legend' : '凡例'}
                    align="center"
                    buttonAriaLabel={isEnglish ? 'Show legend description' : '凡例の説明を表示'}
                    buttonClassName="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 text-[11px] font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-white dark:border-slate-600/80 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-800"
                    panelClassName="w-[min(18rem,calc(100vw-1.5rem))]"
                    contentClassName="text-[11px] leading-5"
                  >
                    {isEnglish
                      ? 'Node colors and line styles indicate host-plant and flower-visit relationships.'
                      : 'ノード色と線のスタイルで、食草・訪花の関係を表示します。'}
                  </InfoPopover>
                </div>
              </div>
            </div>
          </div>
          {/* 凡例はグラフ内ツールバーの表示（絞り込みに追従する）に一本化し、二重表示を避ける */}
          <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950/25" ref={graphRef}>
            <div className="h-[560px] lg:h-[820px]">
              {graphSize.width === 0 || !graphNearViewport ? (
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
                    currentPlantName={decodedPlantName}
                    plantInsects={classifiedInsects}
                    allInsects={allInsects}
                    plantDetails={plantDetails}
                    hostPlantsMap={hostPlants}
                    flowerVisitPlants={flowerVisitPlants}
                    width={graphSize.width}
                    height={graphSize.height}
                    theme={theme}
                    locale={locale}
                  />
                </React.Suspense>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* この植物を利用する昆虫一覧（カード表示） */}
      <div id="related-insects" className="mt-12 md:mt-16 mb-10 scroll-mt-24">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8 flex items-center">
          <svg className="w-8 h-8 mr-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {isEnglish ? 'Related insects' : '関連する昆虫'}
        </h2>
        {hostPlantInsects.length === 0 && flowerVisitInsects.length === 0 ? (
          <div className="text-slate-500 dark:text-slate-400">
            {isEnglish ? 'No related insects were found.' : '関連する昆虫が見つかりませんでした。'}
          </div>
        ) : (
          <div className="space-y-10">
            {hostPlantInsects.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 mb-4">
                  {isEnglish ? `Insects using this plant as a larval host (${hostPlantInsects.length})` : `幼虫の食草として利用する昆虫 (${hostPlantInsects.length}種)`}
                </h3>
                {hostInsectGroups.withPhoto.length > 0 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {hostInsectGroups.withPhoto.map((insect, idx) => (
                      <InsectCard key={`host-${insect.id || idx}`} insect={insect} imageFilenames={imageFilenames} imageExtensions={imageExtensions} locale={locale} />
                    ))}
                  </div>
                )}
                {hostInsectGroups.withoutPhoto.length > 0 && (
                  <div className={hostInsectGroups.withPhoto.length > 0 ? 'mt-5' : ''}>
                    {hostInsectGroups.withPhoto.length > 0 && (
                      <p className="mb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {isEnglish ? 'No photo yet:' : '写真未登録:'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {hostInsectGroups.withoutPhoto.map((insect, idx) => (
                        <InsectNameChip key={`host-chip-${insect.id || idx}`} insect={insect} locale={locale} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {flowerVisitInsects.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-rose-600 dark:text-rose-300 mb-4">
                  {isEnglish ? `Insects recorded as flower visitors (${flowerVisitInsects.length})` : `訪花で利用する昆虫 (${flowerVisitInsects.length}種)`}
                </h3>
                {flowerInsectGroups.withPhoto.length > 0 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {flowerInsectGroups.withPhoto.map((insect, idx) => (
                      <InsectCard key={`flower-${insect.id || idx}`} insect={insect} imageFilenames={imageFilenames} imageExtensions={imageExtensions} locale={locale} />
                    ))}
                  </div>
                )}
                {flowerInsectGroups.withoutPhoto.length > 0 && (
                  <div className={flowerInsectGroups.withPhoto.length > 0 ? 'mt-5' : ''}>
                    {flowerInsectGroups.withPhoto.length > 0 && (
                      <p className="mb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {isEnglish ? 'No photo yet:' : '写真未登録:'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {flowerInsectGroups.withoutPhoto.map((insect, idx) => (
                        <InsectNameChip key={`flower-chip-${insect.id || idx}`} insect={insect} locale={locale} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ManualAdSlot
        placement="detail"
        locale={locale}
        className="mt-10"
        minHeight="min-h-[120px]"
      />

      {/* 前後の植物へのナビゲーション（五十音順ではなく分類順で近縁植物へ移動できる） */}
      <DetailNavigation
        allItems={useMemo(() => sortPlantNamesTaxonomically(Object.keys(hostPlants), plantDetails).map(name => ({ name })), [hostPlants, plantDetails])}
        currentId={decodedPlantName}
        type="plant"
        locale={locale}
      />

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
              title={shareText}
              text={shareText}
              isEnglish={isEnglish}
            />

            {/* X (Twitter) シェアボタン */}
            <a
              href={shareXUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-sm"
              aria-label={isEnglish ? `Share ${primaryPlantName} on X` : `${decodedPlantName}をXで共有`}
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
              aria-label={isEnglish ? `Share ${primaryPlantName} on LINE` : `${decodedPlantName}をLINEで共有`}
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
