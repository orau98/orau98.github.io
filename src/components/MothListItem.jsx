import React, { useMemo, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  formatScientificNameReact,
  renderLocalizedScientificNameListReact,
  repairScientificBinomial,
  dropSubspeciesEpithet,
} from '../utils/scientificNameFormatter.jsx';
import EmergenceTimeDisplay, { hasEmergencePeriods } from './EmergenceTimeDisplay';
import logger from '../utils/logger';
import { extractEmergenceTime, normalizeEmergenceTime } from '../utils/emergenceTimeUtils';
import ImageWithFallback from './ImageWithFallback';
import NoPhotoPlaceholder, { SubjectSilhouette, CameraGlyph, resolvePlaceholderSubject } from './ui/NoPhotoPlaceholder';
import { Card, Badge } from './ui';
import {
  buildResponsivePicture,
  buildResizedImageUrl,
} from '../utils/imageSrcset';
import {
  getAssetBase,
  getAssetVersionQuery,
  getPlaceholderImageUrl,
} from '../utils/assetPaths';
import useNearViewport from '../hooks/useNearViewport';
import {
  buildJapaneseReferenceLabel,
  getPrimaryEnglishName,
} from '../utils/englishNaming';
import { buildInsectPath, slugifyInsectName } from '../utils/insectSlug';
import { isEnglishLocale, localizePath } from '../utils/locale';
import { makeDetailLinkState } from '../utils/navState';
import { buildMoreLabel } from '../utils/hostVisitStyle';
import {
  CARD_PLANT_PREVIEW_CAP,
  buildPlantDisplayData,
  cleanPlantName,
} from '../utils/insectCardData';

// 一覧の1カード（カード/コンパクト両表示）。
// 表示用データ整形は utils/insectCardData、画像ファイル名の解決は
// 親（useInsectImageMap）が済ませたものを imageFilename として受け取る。
const MothListItem = React.memo(({ moth, baseRoute = "/moth", isPriority = false, imageFilename, plantDetails = {}, locale = 'ja', viewMode = 'cards' }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const imgRef = useRef(null);
  const assetVersionQuery = getAssetVersionQuery();
  const normalizedBase = getAssetBase();

  // 交差したら即座に可視化する。実際の帯域制御は loading=lazy に任せ、
  // ここではビューポート近傍到達で早めにマウントだけ済ませる。
  // 優先カード(isPriority)は判定を待たず初回から可視。
  const isNearViewport = useNearViewport(imgRef, {
    rootMargin: '600px 0px', // スクロール到達前に読み込みを開始する先読み幅
    disabled: isPriority,
  });
  const isVisible = isPriority || isNearViewport;
  // Determine the correct route based on insect type
  const route = baseRoute === ""
    ? buildInsectPath(moth, locale)
    : `${localizePath(baseRoute, locale).replace(/\/+$/, '')}/${slugifyInsectName(moth.routeName || moth.name) || moth.id}/`;
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
  const hasImageFilename = !!finalImageFilename;
  const responsiveImage = hasImageFilename
    ? buildResponsivePicture({
        folder: 'insects',
        filename: finalImageFilename,
        // グリッドは sm:2列 / lg:3列 / 2xl:4列。実際の表示幅に合わせて
        // 過大なサイズ候補を選ばないよう 2xl のブレークポイントも明示する
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw',
        query: assetVersionQuery,
      })
    : null;
  const imageFallbackCandidates = hasImageFilename
    ? [
        buildResizedImageUrl({
          baseUrl: normalizedBase,
          folder: imageFolder,
          filename: finalImageFilename,
          width: 640,
          query: assetVersionQuery,
          format: 'jpg',
        }),
        buildResizedImageUrl({
          baseUrl: normalizedBase,
          folder: imageFolder,
          filename: finalImageFilename,
          width: 320,
          query: assetVersionQuery,
          format: 'jpg',
        }),
      ].filter((url, index, list) => url && url !== responsiveImage?.src && list.indexOf(url) === index)
    : [];
  const placeholderFallbackSrc = getPlaceholderImageUrl();
  
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
    (value) => `${isEnglish ? ' ' : '…'}${buildMoreLabel(value, isEnglish)}`,
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
                  subject={resolvePlaceholderSubject(moth.type)}
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
                <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-500">
                  <NoPhotoPlaceholder subject={resolvePlaceholderSubject(moth.type)} size="sm" />
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
                    <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-400">
                      {isEnglish ? secondaryName : formatScientificNameReact(dropSubspeciesEpithet(repairScientificBinomial(moth.scientificName)))}
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
      <article ref={imgRef} className="group relative h-full overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-blue-500/15 dark:hover:shadow-blue-500/10 hover:-translate-y-1 transform shadow-sm list-none">
        {/* ホバー時のグラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 rounded-xl" />
        <Link
        to={route}
        state={makeDetailLinkState(location, { setFromList: true })}
        className="block relative z-0 h-full"
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
                    subject={resolvePlaceholderSubject(moth.type)}
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
                    <SubjectSilhouette subject={resolvePlaceholderSubject(moth.type)} className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>
            ) : null}
            
            {!hasImageFilename && (

              <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex flex-col items-center justify-center p-5 sm:p-6">
                {/* 被写体シルエット + カメラバッジ */}
                <div className="flex-shrink-0 mb-4 text-slate-400 dark:text-slate-500">
                  <NoPhotoPlaceholder subject={resolvePlaceholderSubject(moth.type)} size="lg" />
                </div>

                {/* No image indicator at bottom */}
                <div className="flex-shrink-0 mt-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-300/70 dark:bg-slate-600/70 text-slate-700 dark:text-slate-300 border border-slate-400/30 dark:border-slate-500/30">
                    <CameraGlyph className="w-3 h-3 mr-1" />
                    {isEnglish ? 'No image listed' : '画像未掲載'}
                  </span>
                </div>
              </div>
            )}
            
          </div>
          
          {/* Enhanced Content section */}
          <div className="flex flex-col flex-grow p-3.5 sm:p-4">
            {/* 和名・学名は各1行に固定し、min-heightで高さを揃えて食草欄の開始位置をカード間で一致させる */}
            <div className="mb-2.5 min-h-[2.75rem] sm:mb-3 sm:min-h-[3rem]">
              <h3
                className="mb-1 line-clamp-1 text-base font-bold leading-tight text-slate-800 dark:text-slate-100 sm:text-lg"
                title={isEnglish ? primaryName : moth.name}
              >
                {isEnglish ? formatScientificNameReact(primaryName) : moth.name}
              </h3>
              {secondaryName && (
                <p
                  className="line-clamp-1 text-[13px] text-slate-600 dark:text-slate-400 sm:text-sm"
                  title={isEnglish ? secondaryName : dropSubspeciesEpithet(repairScientificBinomial(moth.scientificName))}
                >
                  {isEnglish
                    ? secondaryName
                    : formatScientificNameReact(
                        dropSubspeciesEpithet(repairScientificBinomial(moth.scientificName))
                      )}
                </p>
              )}
            </div>

            {/* 食草・訪花はヘッダー直下に上詰めで配置（下詰めだと行数差で開始位置がカードごとにずれる） */}
            <div className="mb-1.5 space-y-1.5 text-[13px] sm:mb-2 sm:text-sm">
              {plantDisplay.hostNames.length > 0 && (
                <div className="flex items-start space-x-2">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0 mt-0.5"
                    role="img"
                    aria-label={isEnglish ? 'Larval host plants' : '幼虫の食草・食樹'}
                    title={isEnglish ? 'Larval host plants' : '幼虫の食草・食樹'}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
                    </svg>
                  </span>
                  <span className="line-clamp-2 leading-snug text-slate-600 dark:text-slate-300 sm:line-clamp-3">
                    {renderLocalizedScientificNameListReact(localizedPlantDisplay.hostNames.slice(0, CARD_PLANT_PREVIEW_CAP), locale)}
                    {localizedPlantDisplay.hostNames.length > CARD_PLANT_PREVIEW_CAP && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}{buildMoreLabel(localizedPlantDisplay.hostNames.length - CARD_PLANT_PREVIEW_CAP, isEnglish)}
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
                    aria-label={isEnglish ? "Flower-visit plants (adults)" : "成虫の訪花植物"}
                    title={isEnglish ? "Flower-visit plants (adults)" : "成虫の訪花植物"}
                  >
                    🌸
                  </span>
                  <span className="line-clamp-2 leading-snug text-slate-600 dark:text-slate-300 sm:line-clamp-3">
                    {renderLocalizedScientificNameListReact(localizedPlantDisplay.flowerNames.slice(0, CARD_PLANT_PREVIEW_CAP), locale)}
                    {localizedPlantDisplay.flowerNames.length > CARD_PLANT_PREVIEW_CAP && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}{buildMoreLabel(localizedPlantDisplay.flowerNames.length - CARD_PLANT_PREVIEW_CAP, isEnglish)}
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

            {/* 成虫発生時期表示（ガントチャートのみ）。mt-autoでカード下端にピン留めし、行内で位置を揃える */}
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
                  <div className="mt-auto border-t border-slate-100 pt-1.5 dark:border-slate-700/50 sm:pt-2">
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

export default MothListItem;
