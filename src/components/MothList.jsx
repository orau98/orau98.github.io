import React, { useState, useMemo, useEffect, useRef, useCallback, useId } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import Pagination from './Pagination';
import {
  formatScientificNameReact,
  renderLocalizedScientificNameListReact,
} from '../utils/scientificNameFormatter.jsx';
import EmergenceTimeDisplay, { hasEmergencePeriods } from './EmergenceTimeDisplay';
import ListFilterPanel from './ListFilterPanel';
import logger from '../utils/logger';
import { extractEmergenceTime, normalizeEmergenceTime, getEmergenceMonths } from '../utils/emergenceTimeUtils';
import { hiraganaToKatakana } from '../utils/text';
import { loadInsectImageIndexes } from '../services/imageIndex';
import ImageWithFallback from './ImageWithFallback';
import SearchableSelect from './SearchableSelect';
import { ListDisplayControls, PresetFilterChips } from './ListToolbar';
import ManualAdSlot from './ManualAdSlot';
import { Card, Badge } from './ui';
import {
  buildResponsivePicture,
  buildResizedImageUrl,
} from '../utils/imageSrcset';
import useSeoMeta from '../hooks/useSeoMeta';
import {
  buildJapaneseReferenceLabel,
  EN_SITE_NAME,
  getPrimaryEnglishName,
  getLocalizedTaxonomyLabel,
} from '../utils/englishNaming';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from '../utils/insectImageResolver';
import { buildInsectPath, slugifyInsectName } from '../utils/insectSlug';
import { INSECT_SECTION_CONFIGS } from '../utils/siteTaxonomy';
import { isEnglishLocale, localizePath } from '../utils/locale';
import { makeDetailLinkState } from '../utils/navState';
import { isPlantHostRecord } from '../utils/hostResource';

// 食草欄でプレースホルダー扱いにする文字列
const HOST_PLACEHOLDERS = ['不明', '未知', '不詳', '未確認', '未記載', 'なし', '未登録', '不詳種', '不明種'];
// カード上で食草/訪花名を何件まで出すか（超過分は「他N種」に集約してカード高を揃える）
const CARD_PLANT_PREVIEW_CAP = 6;
const PER_PAGE_OPTIONS = [20, 50, 100];

const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = (record.lifeStage || '').trim();
  const plantPart = (record.plantPart || '').trim();
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

const cleanPlantName = (plant) => {
  if (!plant || typeof plant !== 'string') return '';
  if (plant === '不明') return '不明';
  return plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
};

const filterUnknownPlantNames = (names = []) => {
  const hasSpecific = names.some((name) => name && name !== '不明');
  return hasSpecific ? names.filter((name) => name !== '不明') : names;
};

const buildPlantDisplayData = (moth) => {
  let hostNames = [];
  let flowerNames = [];

  if (Array.isArray(moth?.hostPlantsDetailed) && moth.hostPlantsDetailed.length > 0) {
    moth.hostPlantsDetailed.forEach((record) => {
      if (!isPlantHostRecord(record)) return;
      const raw = record.displayName || record.name || '';
      const cleaned = cleanPlantName(String(raw).trim());
      if (!cleaned) return;
      if (isFlowerVisitRecord(record)) {
        flowerNames.push(cleaned);
      } else {
        hostNames.push(cleaned);
      }
    });
  } else if (moth?.hostPlants) {
    if (typeof moth.hostPlants === 'string') {
      hostNames = moth.hostPlants
        .split(/[;；、,]/)
        .map((plant) => cleanPlantName(plant.trim()))
        .filter(Boolean);
    } else if (Array.isArray(moth.hostPlants)) {
      hostNames = moth.hostPlants
        .map((plant) => cleanPlantName(String(plant || '').trim()))
        .filter(Boolean);
    }
  }

  return {
    hostNames: [...new Set(filterUnknownPlantNames(hostNames))],
    flowerNames: [...new Set(filterUnknownPlantNames(flowerNames))],
  };
};

const MothListItem = React.memo(({ moth, baseRoute = "/moth", isPriority = false, imageFilename, plantDetails = {}, locale = 'ja', viewMode = 'cards' }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  // Heuristic: insert a space between genus and species if missing
  const repairScientificBinomial = (name) => {
    if (!name || typeof name !== 'string') return name;
    const t = name.trim();
    if (!t) return t;
    if (t.includes(' ')) return t;
    // From filename pattern Genus_species
    if (t.includes('_')) {
      const mU = t.match(/^([A-Z][a-z]+)_([a-z-]{2,})(.*)$/);
      if (mU) return `${mU[1]} ${mU[2]}${mU[3] || ''}`;
    }
    const m = t.match(/^([A-Z][a-z]+)([a-z-]{3,})(.*)$/);
    if (m) return `${m[1]} ${m[2]}${m[3] || ''}`;
    return t;
  };
  const [isVisible, setIsVisible] = useState(isPriority);
  const imgRef = useRef(null);
  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : (import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : ''));

  // Remove subspecies epithet from display (keep author/year if present)
  // 学名から亜種小名だけを落とし、種小名は必ず保持する
  const dropSubspecies = useCallback((name) => {
    if (!name || typeof name !== 'string') return name;

    const tokens = name.trim().split(/\s+/).filter(Boolean);
    if (tokens.length <= 2) return name; // もともと亜種がない

    const genus = tokens[0];
    if (!genus) return name;

    // 亜属 (Subgenus) を飛ばしつつ最初の小文字トークンを種小名とみなす
    let speciesIdx = -1;
    for (let i = 1; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (/^\(.*\)$/.test(t)) continue; // (Subgenus) をスキップ
      if (/^[a-z][a-z-]*$/.test(t)) { // 純小文字（ハイフン含む）は種小名候補
        speciesIdx = i;
        break;
      }
    }
    if (speciesIdx === -1) return name; // 種が見つからない場合はそのまま

    const species = tokens[speciesIdx];

    const output = [genus, species];
    let skippingInfraspecific = true; // 種直後の純小文字を亜種扱いで除外

    for (let i = speciesIdx + 1; i < tokens.length; i += 1) {
      const t = tokens[i];

      // 亜属など括弧付きはそのまま残す（ただし subspecies とは無関係）
      if (/^\(.*\)$/.test(t)) {
        output.push(t);
        skippingInfraspecific = false;
        continue;
      }

      // 変種/品種などの階級表記（var., f., ssp., subsp. など）は表示しない
      if (/^(subsp\.?|ssp\.?|var\.?|f\.?|forma)$/i.test(t)) {
        skippingInfraspecific = true;
        continue;
      }

      // 種の後に続く純小文字は亜種小名としてスキップ（著者名など大文字開始は残す）
      if (skippingInfraspecific && /^[a-z][a-z-]*$/.test(t)) {
        continue;
      }

      // ここまで来たら著者名・年などなので残す
      output.push(t);
      skippingInfraspecific = false;
    }

    return output.join(' ').replace(/\s+/g, ' ').trim();
  }, []);

  const handleIntersection = useCallback((entries) => {
    if (!(entries && entries[0])) return;
    if (entries[0].isIntersecting && !isVisible) {
      // Use requestIdleCallback for non-critical image loading
      if ('requestIdleCallback' in window && !isPriority) {
        requestIdleCallback(() => setIsVisible(true), { timeout: 100 });
      } else {
        setIsVisible(true);
      }
    }
  }, [isVisible, isPriority]);

  useEffect(() => {
    if (isPriority) return; // Skip observer for priority images
    
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.01, // Lower threshold for earlier loading
      rootMargin: '400px 0px', // Increased vertical margin for better preloading
      // Use native lazy loading hints
      trackVisibility: true,
      delay: 100
    });
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, [handleIntersection, isPriority]);
  // Determine the correct route based on insect type
  const route = baseRoute === ""
    ? buildInsectPath(moth, locale)
    : `${localizePath(baseRoute, locale)}/${slugifyInsectName(moth.name) || moth.id}`;
  const primaryName = isEnglish
    ? getPrimaryEnglishName({
        scientificName: moth.scientificName,
        japaneseName: moth.name,
        fallback: moth.id,
      })
    : moth.name;
  const secondaryName = isEnglish
    ? buildJapaneseReferenceLabel(moth.name)
    : moth.scientificName;
  
  // 画像ファイル名を動的に解決（学名表記ゆれ・著者名付きファイル名にも対応）
  const finalImageFilename = React.useMemo(() => imageFilename || null, [imageFilename]);
  
  const imageFolder = 'insects';
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  const hasImageFilename = !!finalImageFilename;
  const responsiveImage = hasImageFilename
    ? buildResponsivePicture({
        folder: 'insects',
        filename: finalImageFilename,
        widths: [320, 640, 1024],
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
        query: cacheBustRef.current,
      })
    : null;
  const imageFallbackCandidates = hasImageFilename
    ? [
        buildResizedImageUrl({
          baseUrl: normalizedBase,
          folder: imageFolder,
          filename: finalImageFilename,
          width: 640,
          query: cacheBustRef.current,
          format: 'jpg',
        }),
        buildResizedImageUrl({
          baseUrl: normalizedBase,
          folder: imageFolder,
          filename: finalImageFilename,
          width: 320,
          query: cacheBustRef.current,
          format: 'jpg',
        }),
      ].filter((url, index, list) => url && url !== responsiveImage?.src && list.indexOf(url) === index)
    : [];
  const placeholderFallbackSrc = `${normalizedBase}images/placeholder.jpg${cacheBustRef.current}`;
  
  const plantDisplay = useMemo(() => buildPlantDisplayData(moth), [moth]);
  const localizedPlantDisplay = useMemo(() => {
    const toDisplayName = (name) => {
      const normalized = cleanPlantName(name);
      const detail = plantDetails[normalized] || plantDetails[name] || {};
      if (!isEnglish) return normalized;
      return getPrimaryEnglishName({
        scientificName: detail.scientificName,
        japaneseName: normalized,
        fallback: normalized,
      });
    };
    return {
      hostNames: plantDisplay.hostNames.map(toDisplayName).filter(Boolean),
      flowerNames: plantDisplay.flowerNames.map(toDisplayName).filter(Boolean),
    };
  }, [plantDetails, plantDisplay.flowerNames, plantDisplay.hostNames, isEnglish]);
  const emergenceTime = moth.emergenceTime || extractEmergenceTime(moth.notes || '').emergenceTime;
  const normalizedTime = normalizeEmergenceTime(emergenceTime);
  const linkedPlantCount = plantDisplay.hostNames.length + plantDisplay.flowerNames.length;
  const visibleHostNames = localizedPlantDisplay.hostNames.slice(0, 3);
  const visibleFlowerNames = localizedPlantDisplay.flowerNames.slice(0, 2);
  const extraHostCount = Math.max(0, localizedPlantDisplay.hostNames.length - visibleHostNames.length);
  const extraFlowerCount = Math.max(0, localizedPlantDisplay.flowerNames.length - visibleFlowerNames.length);
  const moreLabel = useCallback(
    (value) => (isEnglish ? ` and ${value} more` : `...他${value}`),
    [isEnglish],
  );

  // Error boundary for individual moth items
  if (!moth) {
    return null;
  }
  
  try {
    if (viewMode === 'compact') {
      return (
        <Card as="article" ref={imgRef} interactive className="group list-none overflow-hidden hover:border-blue-400/60 dark:hover:border-blue-500/60">
          <Link
            to={route}
            state={makeDetailLinkState(location, { setFromList: true })}
            className="flex gap-3 p-3"
          >
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700 sm:h-24 sm:w-24">
              {hasImageFilename && isVisible ? (
                <ImageWithFallback
                  src={responsiveImage?.src}
                  srcSet={responsiveImage?.srcSet}
                  sizes="96px"
                  sources={responsiveImage?.sources}
                  candidates={imageFallbackCandidates}
                  fallbackSrc={placeholderFallbackSrc}
                  alt={isEnglish ? `${primaryName} photograph` : `${moth.name}（${moth.scientificName}）の写真`}
                  width="120"
                  height="120"
                  className="h-full w-full"
                  imgClassName="transition duration-300 group-hover:scale-105"
                  fit="cover"
                  loading={isPriority ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={isPriority ? 'high' : 'auto'}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 text-base font-bold text-slate-800 dark:text-slate-100">
                    {isEnglish ? formatScientificNameReact(primaryName) : moth.name}
                  </h3>
                  {secondaryName && (
                    <p className={`line-clamp-1 text-sm text-slate-600 dark:text-slate-400 ${isEnglish ? '' : 'italic'}`}>
                      {isEnglish ? secondaryName : formatScientificNameReact(dropSubspecies(repairScientificBinomial(moth.scientificName)))}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge tone={hasImageFilename ? 'info' : 'neutral'}>
                    {hasImageFilename ? (isEnglish ? 'Photo' : '写真') : (isEnglish ? 'No image listed' : '画像未掲載')}
                  </Badge>
                  <Badge tone="brand">
                    {isEnglish ? `${linkedPlantCount} plants` : `植物 ${linkedPlantCount}`}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {localizedPlantDisplay.hostNames.length > 0 && (
                  <p className="line-clamp-1">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{isEnglish ? 'Host:' : '食草:'}</span>{' '}
                    {renderLocalizedScientificNameListReact(visibleHostNames, locale)}
                    {extraHostCount > 0 && moreLabel(extraHostCount)}
                  </p>
                )}
                {localizedPlantDisplay.flowerNames.length > 0 && (
                  <p className="line-clamp-1">
                    <span className="font-semibold text-rose-700 dark:text-rose-300">{isEnglish ? 'Flower:' : '訪花:'}</span>{' '}
                    {renderLocalizedScientificNameListReact(visibleFlowerNames, locale)}
                    {extraFlowerCount > 0 && moreLabel(extraFlowerCount)}
                  </p>
                )}
                {normalizedTime && (
                  <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                    {isEnglish ? 'Season:' : '出現期:'} {normalizedTime}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </Card>
      );
    }

    return (
      <article ref={imgRef} className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-blue-500/15 dark:hover:shadow-blue-500/10 hover:-translate-y-1 transform shadow-sm list-none">
        {/* ホバー時のグラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 rounded-xl" />
        <Link
        to={route}
        state={makeDetailLinkState(location, { setFromList: true })}
        className="block relative z-0"
      >
        <div className="flex flex-col h-full">
          {/* Enhanced Image section - full card width */}
          <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
            {hasImageFilename ? (
              <div className="relative w-full aspect-[4/3]">
                {isVisible ? (
                  <ImageWithFallback
                    src={responsiveImage?.src}
                    srcSet={responsiveImage?.srcSet}
                    sizes={responsiveImage?.sizes}
                    sources={responsiveImage?.sources}
                    candidates={imageFallbackCandidates}
                    fallbackSrc={placeholderFallbackSrc}
                    alt={
                      isEnglish
                        ? `${primaryName} photograph`
                        : `${moth.name}（${moth.scientificName}）の写真`
                    }
                    width="800"
                    height="600"
                    className="w-full h-full"
                    imgClassName="transition-all duration-500 ease-out group-hover:scale-110 gpu-accelerated"
                    fit="cover"
                    style={{
                      imageRendering: 'auto',
                      contain: 'layout style paint',
                    }}
                    loading={isPriority ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={isPriority ? "high" : "auto"}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-700 animate-pulse flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            ) : null}
            
            {!hasImageFilename && (

              <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex flex-col items-center justify-center p-5 sm:p-6">
                {/* No image icon at top */}
                <div className="flex-shrink-0 mb-4">
                  <svg className="w-12 h-12 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                
                {/* No image indicator at bottom */}
                <div className="flex-shrink-0 mt-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-300/70 dark:bg-slate-600/70 text-slate-700 dark:text-slate-300 border border-slate-400/30 dark:border-slate-500/30">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                    </svg>
                    {isEnglish ? 'No image listed' : '画像未掲載'}
                  </span>
                </div>
              </div>
            )}
            
          </div>
          
          {/* Enhanced Content section */}
          <div className="flex flex-col flex-grow p-3.5 sm:p-4">
            <div className="mb-2.5 sm:mb-3">
              <h3 className="mb-1 text-base font-bold leading-tight text-slate-800 dark:text-slate-100 sm:text-lg">
                {isEnglish ? formatScientificNameReact(primaryName) : moth.name}
              </h3>
              {secondaryName && (
                <p className={`text-[13px] text-slate-600 dark:text-slate-400 sm:text-sm ${isEnglish ? 'line-clamp-1 sm:line-clamp-none' : 'italic line-clamp-1 sm:line-clamp-none'}`}>
                  {isEnglish
                    ? secondaryName
                    : formatScientificNameReact(
                        dropSubspecies(repairScientificBinomial(moth.scientificName))
                      )}
                </p>
              )}
            </div>

            <div className="mt-auto space-y-1.5 sm:space-y-2">
              <div>
                <div className="space-y-1.5 text-[13px] sm:text-sm">
                  {plantDisplay.hostNames.length > 0 && (
                    <div className="flex items-start space-x-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
                        </svg>
                      </span>
                      <span className="line-clamp-2 leading-snug text-slate-600 dark:text-slate-300 sm:line-clamp-3">
                        {renderLocalizedScientificNameListReact(localizedPlantDisplay.hostNames.slice(0, CARD_PLANT_PREVIEW_CAP), locale)}
                        {localizedPlantDisplay.hostNames.length > CARD_PLANT_PREVIEW_CAP && (
                          <span className="text-slate-500 dark:text-slate-400">
                            {isEnglish
                              ? ` +${localizedPlantDisplay.hostNames.length - CARD_PLANT_PREVIEW_CAP} more`
                              : ` 他${localizedPlantDisplay.hostNames.length - CARD_PLANT_PREVIEW_CAP}種`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {plantDisplay.flowerNames.length > 0 && (
                    <div className="flex items-start space-x-2">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-[13px] dark:bg-rose-900/30 flex-shrink-0 mt-0.5"
                        role="img"
                        aria-label={isEnglish ? "Flower visit" : "訪花"}
                      >
                        🌸
                      </span>
                      <span className="line-clamp-2 leading-snug text-slate-600 dark:text-slate-300 sm:line-clamp-3">
                        {renderLocalizedScientificNameListReact(localizedPlantDisplay.flowerNames.slice(0, CARD_PLANT_PREVIEW_CAP), locale)}
                        {localizedPlantDisplay.flowerNames.length > CARD_PLANT_PREVIEW_CAP && (
                          <span className="text-slate-500 dark:text-slate-400">
                            {isEnglish
                              ? ` +${localizedPlantDisplay.flowerNames.length - CARD_PLANT_PREVIEW_CAP} more`
                              : ` 他${localizedPlantDisplay.flowerNames.length - CARD_PLANT_PREVIEW_CAP}種`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {localizedPlantDisplay.hostNames.length === 0 && localizedPlantDisplay.flowerNames.length === 0 && (
                    <div className="flex items-start space-x-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
                        </svg>
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 leading-snug">
                        {isEnglish ? 'No plant record' : '情報なし'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 成虫発生時期表示（ガントチャートのみ） */}
              {(() => {
                // Use emergenceTime property if available (priority over re-extraction)
                const emergenceTime = moth.emergenceTime || extractEmergenceTime(moth.notes || '').emergenceTime;
                const normalizedTime = normalizeEmergenceTime(emergenceTime);
                const supplementalEmergenceTexts = Array.from(new Set([
                  moth.notes || '',
                  ...(Array.isArray(moth.generalNotes) ? moth.generalNotes.map((note) => note?.content || '') : [])
                ].map((text) => String(text || '').trim()).filter(Boolean)));
                const hasSupplementalEmergenceHint = supplementalEmergenceTexts.some((text) =>
                  /(成虫|出現|羽化|発生|得られ|見られ|採れ|採集|越冬|越年|春の蛾|夏の蛾|秋の蛾|冬の蛾|周年|通年|年中)/.test(text)
                );
                
                // 月データを導出できない種では空のバー（＋区切り線）を出さない
                if ((normalizedTime || hasSupplementalEmergenceHint) &&
                    hasEmergencePeriods(normalizedTime || '', supplementalEmergenceTexts)) {
                  return (
                    <div className="border-t border-slate-100 pt-1.5 dark:border-slate-700/50 sm:pt-2">
                      <EmergenceTimeDisplay 
                        emergenceTime={normalizedTime || ''}
                        source={moth.source}
                        compact={true}
                        supplementalTexts={supplementalEmergenceTexts}
                      />
                    </div>
                  );
                }
                return null;
              })()}
              
            </div>
          </div>
        </div>
      </Link>
    </article>
    );
  } catch (error) {
    logger.error('Error rendering MothListItem:', error, moth);
    return (
      <article className="group relative overflow-hidden rounded-xl bg-red-50 dark:bg-red-900/20 backdrop-blur-sm border-2 border-red-200 dark:border-red-600 p-4">
        <div className="text-red-600 dark:text-red-400 text-sm">
          {isEnglish
            ? `Render error: ${moth?.name || 'Unknown insect'}`
            : `表示エラーが発生しました: ${moth?.name || '不明な昆虫'}`}
        </div>
      </article>
    );
  }
});

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const updateSearchParams = useCallback((mutate) => {
    let next;
    try {
      next = new URLSearchParams(window.location.search || '');
    } catch {
      next = new URLSearchParams(searchParams);
    }
    try {
      mutate(next);
    } catch {}
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
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

  const currentPage = useMemo(() => {
    const raw = searchParams.get('ipage');
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [searchParams]);

  const hostFilter = useMemo(() => {
    const v = (searchParams.get('ihost') || '').toLowerCase();
    return v === 'has' || v === 'none' ? v : 'all';
  }, [searchParams]);
  const familyFilter = useMemo(() => searchParams.get('ifamily') || '', [searchParams]);
  const genusFilter = useMemo(() => searchParams.get('igenus') || '', [searchParams]);
  const emergenceFilter = useMemo(() => searchParams.get('imonth') || '', [searchParams]);
  const seasonFilter = useMemo(() => {
    const v = (searchParams.get('iseason') || '').toLowerCase();
    return ['spring', 'summer', 'autumn', 'winter'].includes(v) ? v : '';
  }, [searchParams]);
  const photoFilter = useMemo(() => (searchParams.get('iphoto') === 'has' ? 'has' : 'all'), [searchParams]);
  // 昆虫グループ（蛾/蝶/タマムシ/カミキリムシ/ハムシ/アブラムシ）のワンタップ絞り込み
  const groupFilter = useMemo(() => {
    const v = (searchParams.get('igroup') || '').toLowerCase();
    return INSECT_SECTION_CONFIGS.some((section) => section.type === v) ? v : '';
  }, [searchParams]);
  const viewMode = useMemo(() => (searchParams.get('iview') === 'compact' ? 'compact' : 'cards'), [searchParams]);
  const sortMode = useMemo(() => {
    const v = searchParams.get('isort') || 'image';
    return ['image', 'name', 'family', 'plantCount', 'season'].includes(v) ? v : 'image';
  }, [searchParams]);
  const requestedItemsPerPage = useMemo(() => {
    const n = parseInt(searchParams.get('iper') || '', 10);
    return PER_PAGE_OPTIONS.includes(n) ? n : null;
  }, [searchParams]);

  const setIPage = useCallback((page) => {
    updateSearchParams((p) => {
      const n = parseInt(page, 10);
      if (Number.isFinite(n) && n > 1) p.set('ipage', String(n));
      else p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIHostFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').toLowerCase();
      if (v === 'has' || v === 'none') p.set('ihost', v);
      else p.delete('ihost');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIFamilyFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('ifamily', v);
      else p.delete('ifamily');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIGenusFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('igenus', v);
      else p.delete('igenus');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIEmergenceFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('imonth', v);
      else p.delete('imonth');
      p.delete('iseason');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setISeasonFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (['spring', 'summer', 'autumn', 'winter'].includes(v)) p.set('iseason', v);
      else p.delete('iseason');
      p.delete('imonth');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIPhotoFilter = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'has') p.set('iphoto', 'has');
      else p.delete('iphoto');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIGroupFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').toLowerCase();
      if (INSECT_SECTION_CONFIGS.some((section) => section.type === v)) p.set('igroup', v);
      else p.delete('igroup');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIViewMode = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'compact') p.set('iview', 'compact');
      else p.delete('iview');
    });
  }, [updateSearchParams]);

  const setISortMode = useCallback((value) => {
    updateSearchParams((p) => {
      if (value && value !== 'image') p.set('isort', value);
      else p.delete('isort');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const setIItemsPerPage = useCallback((value) => {
    updateSearchParams((p) => {
      const n = parseInt(value, 10);
      if (PER_PAGE_OPTIONS.includes(n)) p.set('iper', String(n));
      else p.delete('iper');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const clearClassification = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('classification');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const clearFilters = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('ihost');
      p.delete('ifamily');
      p.delete('igenus');
      p.delete('imonth');
      p.delete('iseason');
      p.delete('iphoto');
      p.delete('classification');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const clearSearch = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('q');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const resetAll = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('ihost');
      p.delete('ifamily');
      p.delete('igenus');
      p.delete('imonth');
      p.delete('iseason');
      p.delete('iphoto');
      p.delete('igroup');
      p.delete('classification');
      p.delete('q');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const applyExampleSearch = useCallback((value) => {
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    setSearchTerm(nextValue);
    updateSearchParams((p) => {
      p.set('q', nextValue);
      p.delete('ipage');
    });
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

  const classificationFilter = searchParams.get('classification');
  const searchQuery = useMemo(() => (searchParams.get('q') || '').trim(), [searchParams]);
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
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const filterCriteriaRef = useRef({
    debouncedSearchTerm,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
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

          const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
          // ひらがなをカタカナに変換した検索語も用意
          const katakanaSearchTerm = hiraganaToKatakana(debouncedSearchTerm).toLowerCase();
          
          // If there's a classification filter from URL, prioritize that
          if (classificationFilter && !debouncedSearchTerm) {
            const lowerClassification = classificationFilter.toLowerCase();
            const katakanaClassification = hiraganaToKatakana(classificationFilter).toLowerCase();
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
                 (moth.classification?.tribe?.toLowerCase().includes(lowerCaseSearchTerm));
        } catch (error) {
          logger.error('Error filtering moth:', moth, error);
          return false;
        }
      });
    } catch (error) {
      logger.error('Error in filteredMoths calculation:', error);
      return [];
    }
  }, [moths, debouncedSearchTerm, classificationFilter, hostFilter, familyFilter, genusFilter, emergenceFilter, seasonFilter, groupFilter, hasRealHost, checkEmergenceMatch, checkSeasonMatch, normalizeText]);

  // 画像インデックス（共通サービス）
  const [imageFilenames, setImageFilenames] = useState(new Set());
  const [imageExtensions, setImageExtensions] = useState({});
  const normalizedImageEntries = useMemo(
    () => buildNormalizedEntries(imageFilenames, imageExtensions),
    [imageFilenames, imageExtensions],
  );

  // 重要種の画像を必ず拾うための強制マッピング（ID -> 画像ベース名）
  const IMAGE_OVERRIDES = useMemo(() => new Map([
    ['species-20176', 'Graphium_sarpedon'], // アオスジアゲハ
    ['species-4601', 'Zaranga_permagna'],   // アオバシャチホコ
  ]), []);


  useEffect(() => {
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        const list = Array.from(names || []);
        const fileSet = new Set(list);
        setImageFilenames(fileSet);
        setImageExtensions(exts || {});
        logger.debug('Loaded image index via service:', list.length, 'files');
      })
      .catch((e) => {
        logger.debug('Failed to load insect image index:', e);
        setImageFilenames(new Set());
        setImageExtensions({});
      });
  }, []);

  // Image index readiness (avoid reordering after first paint by waiting for index)
  const isImageIndexReady = useMemo(() => {
    try {
      return (imageFilenames && imageFilenames.size > 0) || (imageExtensions && Object.keys(imageExtensions).length > 0);
    } catch {
      return false;
    }
  }, [imageFilenames, imageExtensions]);

  const imageIndexReadyRef = useRef(isImageIndexReady);
  useEffect(() => {
    if (!imageIndexReadyRef.current && isImageIndexReady) {
      setIPage(1);
    }
    imageIndexReadyRef.current = isImageIndexReady;
  }, [isImageIndexReady, setIPage]);

  // Helper to find best image filename for a moth (moved from MothListItem for performance)
  // Returns the filename (without path, but with/without extension depending on source) or null
  const getBestImageForMoth = useCallback((insect) => {
    try {
      if (!insect) return null;
      
      // Index未準備でも重要種は即座にファイル名を返して表示を試みる
      const override = IMAGE_OVERRIDES.get(insect.id);
      if (!isImageIndexReady) return override || null;

      if (override && (imageFilenames.has(override) || imageExtensions[override])) {
        return override;
      }

      const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
      const candidates = [
        override,
        ...buildInsectImageBaseCandidates(insect, mappedFilename),
      ].filter(Boolean);
      const resolvedBases = resolveImageBaseCandidates(candidates, {
        imageExtensions,
        imageNames: imageFilenames,
        normalizedEntries: normalizedImageEntries,
        includeUnresolved: false,
      });
      return resolvedBases[0] || null;
    } catch {
      return null;
    }
  }, [
    IMAGE_OVERRIDES,
    imageExtensions,
    imageFilenames,
    isImageIndexReady,
    normalizedImageEntries,
  ]);

  // Precompute image filename per insect to avoid O(n) lookups during sort/render
  const [mothImageMap, setMothImageMap] = useState(new Map());

  useEffect(() => {
    if (!isImageIndexReady || !moths || moths.length === 0) {
      setMothImageMap(new Map());
      return;
    }
    
    // Use a timeout to avoid blocking main thread if list is huge
    const timeoutId = setTimeout(() => {
      const nextMap = new Map();
      moths.forEach((insect) => {
        if (!insect || !insect.id) return;
        const best = getBestImageForMoth(insect);
        if (best) nextMap.set(insect.id, best);
      });
      setMothImageMap(nextMap);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [getBestImageForMoth, isImageIndexReady, moths]);

  // 重要種はインデックス未準備でもあらかじめ画像ベース名を埋めておく
  useEffect(() => {
    const next = new Map();
    moths?.forEach((insect) => {
      if (!insect || !insect.id) return;
      const override = IMAGE_OVERRIDES.get(insect.id);
      if (override) {
        next.set(insect.id, override);
      }
    });
    if (next.size > 0) {
      setMothImageMap((prev) => {
        const merged = new Map(prev);
        next.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }
  }, [IMAGE_OVERRIDES, moths]);

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

      const getPlantLinkCount = (insect) => {
        const data = buildPlantDisplayData(insect);
        return data.hostNames.length + data.flowerNames.length;
      };
      const getFirstMonth = (insect) => {
        const months = getEmergenceMonthList(insect);
        return months.length ? Math.min(...months) : 99;
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
  const currentMoths = useMemo(() => {
    try {
      if (!sortedMoths || sortedMoths.length === 0) {
        return [];
      }
      
      const startIndex = (currentPage - 1) * effectiveItemsPerPage;
      const endIndex = startIndex + effectiveItemsPerPage;
      return sortedMoths.slice(startIndex, endIndex);
    } catch (error) {
      logger.error('Error calculating currentMoths:', error);
      return [];
    }
  }, [sortedMoths, currentPage, effectiveItemsPerPage]);

  const handlePageChange = (page) => {
    const nextPage = parseInt(page, 10);
    if (!Number.isFinite(nextPage)) return;
    const clampedPage = Math.min(Math.max(nextPage, 1), Math.max(totalPages, 1));
    if (clampedPage === currentPage) return;
    setIPage(clampedPage);
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
      if (currentPage > 1) {
        const prev = document.createElement('link');
        prev.rel = 'prev';
        const prevUrl = new URL(url.href);
        const prevPage = currentPage - 1;
        if (prevPage > 1) prevUrl.searchParams.set('ipage', String(prevPage));
        prev.href = prevUrl.toString();
        document.head.appendChild(prev);
      }
      if (currentPage < totalPages) {
        const next = document.createElement('link');
        next.rel = 'next';
        const nextUrl = new URL(url.href);
        nextUrl.searchParams.set('ipage', String(currentPage + 1));
        next.href = nextUrl.toString();
        document.head.appendChild(next);
      }
    } catch (error) {
      logger.debug('Failed to update rel prev/next links for moth list:', error);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    const prev = filterCriteriaRef.current;
    const changed =
      prev.debouncedSearchTerm !== debouncedSearchTerm ||
      prev.hostFilter !== hostFilter ||
      prev.familyFilter !== familyFilter ||
      prev.genusFilter !== genusFilter ||
      prev.emergenceFilter !== emergenceFilter ||
      prev.seasonFilter !== seasonFilter ||
      prev.photoFilter !== photoFilter;

    if (!changed) return;

    filterCriteriaRef.current = {
      debouncedSearchTerm,
      hostFilter,
      familyFilter,
      genusFilter,
      emergenceFilter,
      seasonFilter,
      photoFilter,
    };

    if (currentPage === 1) return;
    setIPage(1);
  }, [
    debouncedSearchTerm,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
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
        <PresetFilterChips label={ui.presetLabel} chips={presetChips} />
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
        <div ref={listTopRef} />
        <div>
          {!isImageIndexReady ? (
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
                      {!hasAnyCriteria && currentPage === 1 && index === 8 && viewMode !== 'compact' && (
                        <ManualAdSlot
                          placement="inFeed"
                          locale={locale}
                          className="animate-fadeIn self-start"
                          minHeight="min-h-[220px]"
                        />
                      )}
                      <div className="animate-fadeIn" style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}>
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
              currentPage={currentPage}
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
