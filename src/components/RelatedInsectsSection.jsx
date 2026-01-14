import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loadInsectImageIndexes } from '../services/imageIndex';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';
import { buildInsectPath } from '../utils/insectSlug';
import { makeDetailLinkState } from '../utils/navState';
import ImageWithFallback from './ImageWithFallback';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from '../utils/insectImageResolver';

const RelatedInsectsSection = ({ relatedMothsByPlant, allInsects }) => {
  const location = useLocation();
  // 各植物の展開状態を管理
  const [expandedPlants, setExpandedPlants] = useState(new Set());
  
  // 植物の展開状態をトグル
  const togglePlantExpansion = (plant) => {
    const newExpanded = new Set(expandedPlants);
    if (newExpanded.has(plant)) {
      newExpanded.delete(plant);
    } else {
      newExpanded.add(plant);
    }
    setExpandedPlants(newExpanded);
  };
  
  // 種数に応じた表示レイアウトを決定
  const getDisplayLayout = (count, isExpanded) => {
    if (count <= 6) {
      return 'horizontal'; // 横スクロール
    } else if (count <= 12) {
      return isExpanded ? 'grid-2rows' : 'horizontal-limited'; // 2行グリッドまたは制限付き横スクロール
    } else {
      return isExpanded ? 'grid-3rows' : 'horizontal-limited'; // 3行グリッドまたは制限付き横スクロール
    }
  };
  
  // 表示する昆虫数を決定
  const getDisplayCount = (count, layout, isExpanded) => {
    if (layout === 'horizontal') return count; // 全て表示
    if (layout === 'horizontal-limited' && !isExpanded) return 6; // 制限表示
    return count; // グリッド表示では全て表示
  };

  // 画像拡張子マッピングを読み込む（共通サービス）
  const [imageExtensions, setImageExtensions] = useState({});
  const [imageBases, setImageBases] = useState(new Set());
  useEffect(() => {
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        setImageExtensions(exts || {});
        setImageBases(new Set(names || []));
      })
      .catch(() => {
        setImageExtensions({});
        setImageBases(new Set());
      });
  }, []);

  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : '');
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const placeholderSrc = `${normalizedBase}images/placeholder.jpg${cacheBustRef.current}`;

  const normalizedEntries = useMemo(
    () => buildNormalizedEntries(imageBases, imageExtensions),
    [imageBases, imageExtensions],
  );

  const buildImageUrl = useCallback((base) => {
    if (!base) return '';
    const ext = imageExtensions[base] || '.jpg';
    return `${normalizedBase}images/insects/${encodeURIComponent(base)}${ext}${cacheBustRef.current}`;
  }, [imageExtensions, normalizedBase]);

  const getImageCandidates = useCallback((insect) => {
    if (!insect) return [];
    const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
    const candidateBases = buildInsectImageBaseCandidates(insect, mappedFilename);
    const resolvedBases = resolveImageBaseCandidates(candidateBases, {
      imageExtensions,
      imageNames: imageBases,
      normalizedEntries,
    });
    if (resolvedBases.length === 0 && candidateBases.length > 0) {
      resolvedBases.push(candidateBases[0]);
    }
    const urls = [];
    const seen = new Set();
    resolvedBases.forEach((base) => {
      const url = buildImageUrl(base);
      if (url && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    });
    return urls;
  }, [buildImageUrl, imageBases, imageExtensions, normalizedEntries]);

  if (Object.keys(relatedMothsByPlant).length === 0) {
    return null;
  }

  return (
    <div className="related-insects-section bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 border-b border-blue-200/30 dark:border-blue-700/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            同じ食草の昆虫
          </h2>
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        {Object.entries(relatedMothsByPlant).map(([plant, relatedMothNames]) => {
          const isExpanded = expandedPlants.has(plant);
          const layout = getDisplayLayout(relatedMothNames.length, isExpanded);
          const displayCount = getDisplayCount(relatedMothNames.length, layout, isExpanded);
          const showExpandButton = relatedMothNames.length > 6;
          
          return (
            <div key={plant} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/plant/${encodeURIComponent(plant)}`}
                    state={makeDetailLinkState(location)}
                    className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600"
                  >
                    {plant}
                  </Link>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    ({relatedMothNames.length}種)
                  </span>
                </div>
                
                {/* 展開/折りたたみボタン */}
                {showExpandButton && (
                  <button
                    onClick={() => togglePlantExpansion(plant)}
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200"
                  >
                    <span>{isExpanded ? '少なく表示' : 'もっと見る'}</span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            
            {/* 動的レイアウトコンテナ */}
            <div className={`${
              layout === 'horizontal' ? 'overflow-x-auto pb-2' :
              layout === 'horizontal-limited' ? 'overflow-x-auto pb-2' :
              'overflow-hidden'
            }`}>
              <div className={`transition-all duration-300 ${
                layout === 'horizontal' ? 'flex space-x-4 min-w-max' :
                layout === 'horizontal-limited' ? 'flex space-x-4 min-w-max' :
                layout === 'grid-2rows' ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-6' :
                layout === 'grid-3rows' ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-6' :
                'flex space-x-4 min-w-max'
              }`}>
                {relatedMothNames.slice(0, displayCount).map(relatedMothName => {
                  let relatedMoth = allInsects.find(m => m.name === relatedMothName);
                  // Fallback: try trimming common suffixes like '類' (e.g., name mismatches)
                  if (!relatedMoth) {
                    const alt = relatedMothName.replace(/類$/, '');
                    relatedMoth = allInsects.find(m => m.name === alt);
                  }
                  if (!relatedMoth) return null;
                  
                  return (
                    <Link
                      key={relatedMoth.id}
                      to={buildInsectPath(relatedMoth)}
                      state={makeDetailLinkState(location)}
                      className={`insect-card group ${
                        layout.startsWith('grid') ? 'w-full' : 'flex-shrink-0 w-56'
                      }`}
                    >
                      <div className={`relative bg-white dark:bg-slate-800 rounded-xl overflow-hidden border shadow-sm transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 ${
                        relatedMoth.type === 'moth' ? 'border-blue-200/60 dark:border-blue-700/60 hover:border-blue-400/80 dark:hover:border-blue-500/80 hover:shadow-blue-500/20' :
                        relatedMoth.type === 'butterfly' ? 'border-pink-200/60 dark:border-pink-700/60 hover:border-pink-400/80 dark:hover:border-pink-500/80 hover:shadow-pink-500/20' :
                        relatedMoth.type === 'beetle' ? 'border-emerald-200/60 dark:border-emerald-700/60 hover:border-emerald-400/80 dark:hover:border-emerald-500/80 hover:shadow-emerald-500/20' :
                        relatedMoth.type === 'longhornbeetle' ? 'border-teal-200/60 dark:border-teal-700/60 hover:border-teal-400/80 dark:hover:border-teal-500/80 hover:shadow-teal-500/20' :
                        'border-amber-200/60 dark:border-amber-700/60 hover:border-amber-400/80 dark:hover:border-amber-500/80 hover:shadow-amber-500/20'
                      }`}>
                        {/* 昆虫画像 - 大きくしてカードの大部分を占める */}
                        <div className="relative w-full aspect-[3/2] overflow-hidden">
                          {(() => {
                            const candidates = getImageCandidates(relatedMoth);
                            const primarySrc = candidates[0] || placeholderSrc;
                            return (
                              <ImageWithFallback
                                src={primarySrc}
                                candidates={candidates.slice(1)}
                                fallbackSrc={placeholderSrc}
                                alt={`${relatedMothName}（${relatedMoth.scientificName}）の写真`}
                                width="600"
                                height="400"
                                className="w-full h-full"
                                imgClassName="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                                fit="cover"
                                loading="lazy"
                                decoding="async"
                              />
                            );
                          })()}

                          
                          {/* 画像上に昆虫名をオーバーレイ表示 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
                            <h5 className="text-white font-medium text-xs leading-tight line-clamp-3 drop-shadow-lg">
                              {relatedMothName}
                            </h5>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedInsectsSection;
