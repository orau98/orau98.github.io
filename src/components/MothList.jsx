import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import EmergenceTimeDisplay from './EmergenceTimeDisplay';
import logger from '../utils/logger';
import { extractEmergenceTime, normalizeEmergenceTime } from '../utils/emergenceTimeUtils';

const MothListItem = React.memo(({ moth, baseRoute = "/moth", isPriority = false, imageFilenames = new Set(), imageExtensions = {}, currentPage = 1 }) => {
  // Heuristic: insert a space between genus and species if missing
  const repairScientificBinomial = (name) => {
    if (!name || typeof name !== 'string') return name;
    const t = name.trim();
    if (t.includes(' ')) return t;
    const m = t.match(/^([A-Z][a-z]+)([a-z-][a-z-]{2,})(.*)$/);
    if (m) return `${m[1]} ${m[2]}${m[3] || ''}`;
    return t;
  };
  const [isVisible, setIsVisible] = useState(isPriority);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef(null);

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
  const route = baseRoute === "" ? 
    (moth.type === 'butterfly' ? `/butterfly/${moth.id}` : 
     moth.type === 'beetle' ? `/beetle/${moth.id}` : 
     moth.type === 'leafbeetle' ? `/leafbeetle/${moth.id}` : `/moth/${moth.id}`) : 
    `${baseRoute}/${moth.id}`;
  
  // 和名→学名ファイル名マッピング（App.jsxと同期）
  const globalJapaneseToScientificMapping = new Map([
    // 蛾類
    ['ウスムラサキケンモン', 'Acronicta_subpurpurea_Matsumura'],
    ['オオマエベニトガリバ', 'Tethea_consimilis'],
    ['ショウブオオヨトウ', 'Helotropha_leucostigma'],
    ['シラオビキリガ', 'Cosmia_camptostigma'],
    ['シラホシキリガ', 'Cosmia_pyralina'],
    ['タカオキリガ', 'Pseudopanolis_takao'],
    ['ツマベニヒメハマキ', 'Phaecasiophora_roseana_2'],
    ['ナシキリガ', 'Cosmia_restituta_Walker_1857'],
    ['ニッコウケンモン', 'Craniophora_praeclara'],
    ['ニッコウシャチホコ', 'Shachia_circumscripta'],
    ['ノコメセダカヨトウ', 'Orthogonia_sera'],
    ['ハスモンヨトウ', 'Spodoptera_litura'],
    ['マエジロシャチホコ', 'Notodonta_albicosta'],
    ['クロハナコヤガ', 'Aventiola_pusilla'],
    ['フタスジエグリアツバ', 'Gonepatica_opalina'],
    ['ベニスズメ', 'Deilephila_elpenor'],
    ['ヒメスズメ', 'Deilephila_askoldensis'],
    ['マダラキボシキリガ', 'Dimorphicosmia_variegata'],
    ['ナシイラガ', 'Narosoideus_flavidorsalis'],
    ['ヨモギオオホソハマキ', 'Phtheochroides_clandestina'],
    ['ノコメキシタバ', 'Catocala_bella'],
    ['ハマオモトヨトウ', 'Brithys_crini'],
    // タマムシ科
    ['アオマダラタマムシ', 'Nipponobuprestis_amabilis'],
    ['ルイスヒラタチビタマムシ', 'Habroloma_lewisii'],
    // シジミチョウ科
    ['クロマダラソテツシジミ', 'Chilades_pandava'],
    
    // New Japanese names mapped to scientific filenames
    ['ムラサキシジミ', 'Narathura_japonica'],
    ['ウスクロスジツトガ', 'Chrysoteuchia diplogramma Zeller'],
    ['ゴマダラキリガ', 'Conistra castaneofasciata Motschulsky'],
    ['イシガケチョウ', 'Cyrestis thyodamas'],
    ['ヤエヤマコブヒゲアツバ', 'Zanclognatha yaeyamalis Owada'],
    ['ヤエヤマカラスアゲハ', 'Papilio bianor okinawensis'],
    ['クロスジツトガ', 'Flavocrambus striatellus Leech'],
    ['シロスジツトガ', 'Crambus argyrophorus Butler'],
    ['アマギシャチホコ', 'Eriodonta amagisana Marumo'],
    ['ギンボシスズメ', 'Parum colligata Walker'],
    ['イボタケンモン', 'Craniophora ligustri'],
    ['キボシミスジトガリバ本州亜種', 'Achlya longipennis longipennis Inoue'],
    ['クロスジコブガ', 'Meganola_fumosa'],
    ['ウスベリケンモン', 'Anacronicta_nitida'],
    ['カバイロキバガ', 'Dichomeris_heriguronis'],
    ['オオバトガリバ', 'Tethea_ampliata_ampliata'],
    ['カクモンキシタバ', 'Chrysorithrum_amatum'],
    ['アトヘリヒトホシアツバ', 'Hemipsectra_fallax'],
    ['カギバアオシャク', 'Tanaorhinus_reciprocata_confuciaria'],
    ['アカハラゴマダラヒトリ', 'Spilosoma_punctarium'],
    ['カクバネヒゲナガキバガ', 'Lecitholaxa_thiodora'],
    ['クビワウスグロホソバ', 'Macrobrochis_staudingeri_staudingeri'],
    ['ウスイロオオエダシャク', 'Amraica_superans_superans'],
    ['キマダラアツバ', 'Lophomilia_polybapta'],
    ['ツマオビアツバ', 'Zanclognatha_griselda'],
    
    // Add the main moth that should be showing
    ['アオモンギンセダカモクメ', 'Cucullia_argentea']
  ]);;

  // Create safe filename for image checking
  const createSafeFilename = (scientificName) => {
    if (!scientificName) return '';
    let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
    cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
    cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
    cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
    cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
    cleanedName = cleanedName.replace(/\s+/g, '_');
    return cleanedName;
  };
  
  // Try to find the actual image file that exists
  const getImageFilename = () => {
    try {
      // If imageFilenames is not loaded yet, use default
      if (!imageFilenames || imageFilenames.size === 0) {
        const mappedFilename = globalJapaneseToScientificMapping.get(moth?.name);
        return mappedFilename || moth?.scientificFilename || createSafeFilename(moth?.scientificName);
      }
    
    // 0. Try mapped filename first (highest priority)
    const mappedFilename = globalJapaneseToScientificMapping.get(moth.name);
    if (mappedFilename && imageFilenames.has(mappedFilename)) {
      return mappedFilename;
    }
    
    // 1. Try scientific filename directly
    if (moth.scientificFilename && imageFilenames.has(moth.scientificFilename)) {
      return moth.scientificFilename;
    }
    
    // 2. Try generated safe filename
    const safeFilename = createSafeFilename(moth.scientificName);
    if (imageFilenames.has(safeFilename)) {
      return safeFilename;
    }
    // 2a. Try filename variants that start with the safe binomial (e.g., Genus_species_2)
    for (const filename of imageFilenames) {
      if (filename === safeFilename || filename.startsWith(`${safeFilename}_`)) {
        return filename;
      }
    }
    // 2b. If we only have the extensions map, try to find a key that starts with the safe binomial
    if (imageExtensions && Object.keys(imageExtensions).length > 0) {
      const extKey = Object.keys(imageExtensions).find(key => key === safeFilename || key.startsWith(`${safeFilename}_`));
      if (extKey) {
        return extKey;
      }
    }
    
    // 3. Try Japanese name directly
    if (imageFilenames.has(moth.name)) {
      return moth.name;
    }
    
    // 4. Try to find any filename containing the Japanese name
    for (const filename of imageFilenames) {
      if (filename.includes(moth.name)) {
        return filename;
      }
    }
    
    // 5. Try to find any filename containing the scientific name parts
    if (moth.scientificName) {
      const scientificParts = moth.scientificName.split(' ').slice(0, 2).join(' ');
      const scientificUnderscore = scientificParts.replace(/\s+/g, '_');
      for (const filename of imageFilenames) {
        if (filename.includes(scientificParts) || filename.includes(scientificUnderscore)) {
          return filename;
        }
      }
    }
    
    // Default to mapped filename, then scientific filename, then safe filename
    return mappedFilename || moth?.scientificFilename || safeFilename;
    } catch (error) {
      logger.error('Error in getImageFilename:', error, moth);
      return createSafeFilename(moth?.scientificName || moth?.name || 'placeholder');
    }
  };
  
  const imageFilename = getImageFilename();
  
  // Determine the correct file extension using the extensions mapping
  let imageExtension = '.jpg'; // default
  if (imageExtensions && imageExtensions[imageFilename]) {
    imageExtension = imageExtensions[imageFilename];
  }
  
  // Determine the correct image folder based on insect type
  // Special handling for Japanese-named insects that have images in the insects folder
  // These insects have mappings and their images are stored in the insects folder regardless of their type
  const japaneseNamedInsects = ['アオマダラタマムシ', 'ルイスヒラタチビタマムシ', 'ウスムラサキケンモン', 'オオマエベニトガリバ', 'ショウブオオヨトウ', 'シラオビキリガ', 'シラホシキリガ', 'タカオキリガ', 'ツマベニヒメハマキ', 'ナシキリガ', 'ニッコウケンモン', 'ニッコウシャチホコ', 'ノコメセダカヨトウ', 'ハスモンヨトウ', 'マエジロシャチホコ', 'クロハナコヤガ', 'フタスジエグリアツバ', 'ベニスズメ', 'ヒメスズメ', 'マダラキボシキリガ', 'ナシイラガ', 'ヨモギオオホソハマキ',
    // New Japanese-named insects from recent GitHub additions
    'ムラサキシジミ', 'ウスクロスジツトガ', 'ゴマダラキリガ', 'イシガケチョウ', 'ヤエヤマコブヒゲアツバ', 'ヤエヤマカラスアゲハ', 'クロスジツトガ', 'シロスジツトガ', 'アマギシャチホコ', 'ギンボシスズメ', 'イボタケンモン', 'キボシミスジトガリバ本州亜種', 'クロスジコブガ', 'ウスベリケンモン', 'カバイロキバガ', 'オオバトガリバ', 'カクモンキシタバ', 'アトヘリヒトホシアツバ', 'カギバアオシャク', 'アカハラゴマダラヒトリ', 'カクバネヒゲナガキバガ', 'クビワウスグロホソバ', 'ウスイロオオエダシャク', 'キマダラアツバ', 'ツマオビアツバ'];
  // All insect images are in the insects folder
  const imageFolder = 'insects';
  
  const imageUrl = `${import.meta.env.BASE_URL}images/${imageFolder}/${encodeURIComponent(imageFilename)}${imageExtension}?v=${Date.now()}`;
  
  // Check if we have an actual match in imageFilenames
  // Do not request image until filenames mapping is loaded
  // Consider image present if:
  // - filenames list contains it, or
  // - extensions mapping contains it (we know exact extension), or
  // - filenames list is not loaded (optimistic render; onError hides)
  const hasImageFilename = (
    (imageFilenames && imageFilenames.size > 0 && imageFilenames.has(imageFilename)) ||
    (imageExtensions && !!imageExtensions[imageFilename]) ||
    (imageFilenames && imageFilenames.size === 0)
  );
  
  
  // Preload priority images with better performance
  useEffect(() => {
    if (isPriority && hasImageFilename) {
      // Create link preload for priority images
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = imageUrl;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
      
      // Also preload via Image object for immediate caching
      const img = new Image();
      img.decoding = 'async';
      img.fetchPriority = 'high';
      img.src = imageUrl;
      
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [isPriority, hasImageFilename, imageUrl]);
  
  // Error boundary for individual moth items
  if (!moth) {
    return null;
  }
  
  try {
    return (
      <li ref={imgRef} className="group relative overflow-hidden rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] transform shadow-md list-none">
            <Link 
        to={route} 
        className="block"
        onClick={() => {
          // Save scroll position before navigation
          sessionStorage.setItem('mothListScrollPosition', window.scrollY.toString());
          sessionStorage.setItem('mothListPage', currentPage.toString());
        }}
      >
        <div className="flex flex-col h-full">
          {/* Enhanced Image section - full card width */}
          <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
            {hasImageFilename ? (
              <div className="relative w-full aspect-[4/3]">
                {isVisible ? (
                  <img
                    src={imageUrl}
                    alt={`${moth.name}（${moth.scientificName}）の写真`}
                    width="800"
                    height="600"
                    className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 gpu-accelerated ${
                      imageLoaded ? 'opacity-100 loaded' : 'opacity-0 loading'
                    }`}
                    style={{ 
                      imageRendering: 'auto', // Better for photos
                      willChange: imageLoaded ? 'auto' : 'opacity, transform',
                      contain: 'layout style paint'
                    }}
                    loading={isPriority ? "eager" : "lazy"}
                    decoding="async"
                    fetchpriority={isPriority ? "high" : "auto"}
                    onLoad={() => setImageLoaded(true)}
                    onError={(e) => {
                      // Try fallback paths for beetles in insects directory
                      if ((moth.type === 'beetle' || moth.type === 'leafbeetle') && !e.target.dataset.fallbackAttempted) {
                        e.target.dataset.fallbackAttempted = 'true';
                        const fallbackUrl = `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(imageFilename)}${imageExtension}?v=${Date.now()}`;
                        e.target.src = fallbackUrl;
                      } else {
                        // Safely hide the image and show fallback
                        if (e.target && e.target.style) {
                          e.target.style.display = 'none';
                        }
                        // Only access nextSibling if parentElement exists and has a nextSibling
                        const parent = e.target?.parentElement;
                        const sibling = parent?.nextSibling;
                        if (sibling && sibling.style) {
                          sibling.style.display = 'flex';
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-700 animate-pulse flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Names overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                  <h3 className="text-white font-bold text-lg mb-1 drop-shadow-lg tracking-tight">
                    {moth.name}
                  </h3>
                  <p className="text-white/90 text-sm drop-shadow-md">
                  {formatScientificNameReact(repairScientificBinomial(moth.scientificName))}
                  </p>
                </div>
              </div>
            ) : null}
            
            {!hasImageFilename && (
              <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex flex-col items-center justify-center p-6">
                {/* No image icon at top */}
                <div className="flex-shrink-0 mb-4">
                  <svg className="w-12 h-12 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                
                {/* Names displayed prominently in center */}
                <div className="text-center flex-1 flex flex-col justify-center">
                  <h3 className="text-slate-800 dark:text-slate-200 font-bold text-lg mb-2 leading-tight tracking-tight">
                    {moth.name}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    {formatScientificNameReact(repairScientificBinomial(moth.scientificName))}
                  </p>
                </div>
                
                {/* No image indicator at bottom */}
                <div className="flex-shrink-0 mt-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-300/70 dark:bg-slate-600/70 text-slate-700 dark:text-slate-300 border border-slate-400/30 dark:border-slate-500/30">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                    </svg>
                    画像準備中
                  </span>
                </div>
              </div>
            )}
            
          </div>
          
          {/* Enhanced Content section */}
          <div className="p-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 flex-shrink-0">
                    食草
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {(() => {
                    if (!moth.hostPlants) return '情報なし';
                    
                    // Repair function for collapsed Latin binomials in plant names
                    const repairPlantLatinBinomial = (plant) => {
                      if (!plant || typeof plant !== 'string') return plant;
                      const t = plant.trim();
                      // Only attempt when no spaces and looks like Latin
                      if (t.includes(' ') || !/^[A-Z][a-z]+[a-z-]+$/.test(t)) return t;
                      const m = t.match(/^([A-Z][a-z]+)([a-z-]{3,})$/);
                      return m ? `${m[1]} ${m[2]}` : t;
                    };

                    // hostPlants が文字列の場合と配列の場合を処理
                    let plantNames;
                    if (typeof moth.hostPlants === 'string') {
                      // セミコロン、カンマで分割して各食草を取得
                      plantNames = moth.hostPlants.split(/[;；、,]/)
                        .map(plant => plant.trim())
                        .filter(plant => plant)
                        .map(plant => {
                          // 不明の場合はそのまま返す
                          if (plant === '不明') return '不明';
                          // 科名を除去: （○○科）や (○○科) のパターンを削除
                          const cleaned = plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
                          return repairPlantLatinBinomial(cleaned);
                        })
                        .filter(plant => plant && !plant.includes('以上'));
                    } else if (Array.isArray(moth.hostPlants)) {
                      plantNames = moth.hostPlants
                        .filter(plant => plant)
                        .map(plant => {
                          // 不明の場合はそのまま返す
                          if (plant === '不明') return '不明';
                          // 科名を除去
                          const cleaned = plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
                          return repairPlantLatinBinomial(cleaned);
                        })
                        .filter(plant => plant);
                    } else {
                      return '情報なし';
                    }
                    
                    // 「不明」植物のフィルタリング：具体的な食草情報がある場合は「不明」を除外
                    const hasSpecificPlants = plantNames.some(plant => 
                      plant && plant !== '不明'
                    );
                    
                    if (hasSpecificPlants) {
                      plantNames = plantNames.filter(plant => plant !== '不明');
                    }
                    
                    // 重複を除去
                    const uniquePlantNames = [...new Set(plantNames)];
                    return uniquePlantNames.length > 0 ? uniquePlantNames.join('、') : '情報なし';
                  })()}
                </div>
              </div>
              
              {/* 成虫発生時期表示 */}
              {(() => {
                const { emergenceTime } = extractEmergenceTime(moth.notes || '');
                const normalizedTime = normalizeEmergenceTime(emergenceTime);
                
                if (normalizedTime) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex-shrink-0">
                          発生時期
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {normalizedTime}
                        </span>
                      </div>
                      <EmergenceTimeDisplay 
                        emergenceTime={normalizedTime} 
                        source={moth.source}
                        compact={true}
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
    </li>
    );
  } catch (error) {
    logger.error('Error rendering MothListItem:', error, moth);
    return (
      <li className="group relative overflow-hidden rounded-xl bg-red-50 dark:bg-red-900/20 backdrop-blur-sm border-2 border-red-200 dark:border-red-600 p-4">
        <div className="text-red-600 dark:text-red-400 text-sm">
          表示エラーが発生しました: {moth?.name || '不明な昆虫'}
        </div>
      </li>
    );
  }
});

const MothList = ({ moths, title = "蛾", baseRoute = "/moth", embedded = false }) => {
  // Canonical と Breadcrumb（一覧ページ用）
  useEffect(() => {
    if (embedded) return;
    try {
      // canonical を /moth に固定し、クエリ付きURLの重複を回避
      let canon = document.querySelector('link[rel="canonical"]');
      if (!canon) {
        canon = document.createElement('link');
        canon.rel = 'canonical';
        document.head.appendChild(canon);
      }
      const base = new URL(window.location.origin + '/moth');
      canon.href = base.toString();

      // BreadcrumbList を注入
      const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "昆虫食草図鑑", "item": "https://orau98.github.io/" },
          { "@type": "ListItem", "position": 2, "name": "蛾", "item": "https://orau98.github.io/moth" }
        ]
      };
      let breadcrumbScript = document.querySelector('#breadcrumb-list-moth');
      if (!breadcrumbScript) {
        breadcrumbScript = document.createElement('script');
        breadcrumbScript.id = 'breadcrumb-list-moth';
        breadcrumbScript.type = 'application/ld+json';
        document.head.appendChild(breadcrumbScript);
      }
      breadcrumbScript.textContent = JSON.stringify(breadcrumb);
    } catch {}
    return () => {
      const s = document.querySelector('#breadcrumb-list-moth');
      if (s) s.remove();
    };
  }, [embedded]);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 52; // Changed from 50 to 52 to fill the 4-column grid completely

  const classificationFilter = searchParams.get('classification');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Restore scroll position and page when returning from detail page
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('mothListScrollPosition');
    const savedPage = sessionStorage.getItem('mothListPage');
    
    if (savedPosition && savedPage) {
      // Restore the page
      const pageNum = parseInt(savedPage, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
      }
      
      // Restore scroll position after a small delay to ensure content is rendered
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
        // Clear the saved position after restoring
        sessionStorage.removeItem('mothListScrollPosition');
        sessionStorage.removeItem('mothListPage');
      }, 100);
    }
  }, []);

  // Set initial search term from URL parameter
  useEffect(() => {
    if (classificationFilter && !searchTerm) {
      setSearchTerm(classificationFilter);
    }
  }, [classificationFilter, searchTerm]);

  // Meta description for list page (CTR向上の短文)
  useEffect(() => {
    try {
      if (embedded) return;
      const desc = `蛾の一覧ページ。${moths?.length || 0}種から検索・絞り込み。和名/学名/科・亜科・属で高速検索可能。`;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = desc;
      // OG/Twitter for list page
      const ensureMeta = (selector, attrs) => {
        let el = document.querySelector(selector);
        if (!el) {
          el = document.createElement('meta');
          Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
          document.head.appendChild(el);
        }
        return el;
      };
      const setMeta = (selector, content) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute('content', content);
      };
      ensureMeta('meta[property="og:title"]', { property: 'og:title' });
      setMeta('meta[property="og:title"]', `${title}の一覧 | 昆虫食草図鑑`);
      ensureMeta('meta[property="og:description"]', { property: 'og:description' });
      setMeta('meta[property="og:description"]', desc);
      ensureMeta('meta[property="og:type"]', { property: 'og:type' });
      setMeta('meta[property="og:type"]', 'website');
      ensureMeta('meta[property="og:url"]', { property: 'og:url' });
      setMeta('meta[property="og:url"]', 'https://orau98.github.io/moth');
      ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card' });
      setMeta('meta[name="twitter:card"]', 'summary');
    } catch {}
  }, [embedded, moths?.length]);

  // ItemList JSON-LD for top items (first 10)
  useEffect(() => {
    if (embedded) return;
    try {
      const source = (moths || []).slice(0, 10);
      const items = source.map((m, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `https://orau98.github.io/meta/moth/${m.id}.html`
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
    } catch {}
    return () => {
      const s = document.querySelector('#itemlist-moth');
      if (s) s.remove();
    };
  }, [embedded, moths]);

  // ひらがなをカタカナに変換する関数
  const hiraganaToKatakana = (str) => {
    if (!str) return '';
    return str.replace(/[\u3041-\u3096]/g, (match) => {
      const code = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(code);
    });
  };

  const filteredMoths = useMemo(() => {
    try {
      logger.debug('DEBUG: Filtering moths, total count:', moths.length, 'search term:', debouncedSearchTerm);
      
      if (!moths || moths.length === 0) {
        return [];
      }
      
      return moths.filter(moth => {
        try {
          if (!moth) return false;
          
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
                   (moth.classification?.tribe?.toLowerCase().includes(lowerClassification));
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
  }, [moths, debouncedSearchTerm, classificationFilter]);

  const allSuggestions = useMemo(() => {
    try {
      if (!searchTerm || !moths || moths.length === 0) return [];
      
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      // ひらがなをカタカナに変換した検索語も用意
      const katakanaSearchTerm = hiraganaToKatakana(searchTerm).toLowerCase();
      const uniqueSuggestions = new Set();

      moths.forEach(moth => {
        try {
          if (!moth) return;
          
          // Check both original and katakana converted search terms
          if (moth.name?.toLowerCase().includes(lowerCaseSearchTerm) || 
              moth.name?.toLowerCase().includes(katakanaSearchTerm)) {
            uniqueSuggestions.add(moth.name);
          }
          const alt = (moth.alternativeNames || '').toLowerCase();
          if (moth.scientificName?.toLowerCase().includes(lowerCaseSearchTerm)) {
            uniqueSuggestions.add(moth.scientificName);
          }
          if (alt && (alt.includes(lowerCaseSearchTerm) || alt.includes(katakanaSearchTerm))) {
            // 別名は「、」区切りで複数含む可能性
            (moth.alternativeNames.split(/[、,，]/).map(s => s.trim()).filter(Boolean)).forEach(a => uniqueSuggestions.add(a));
          }
          if (moth.classification?.familyJapanese?.toLowerCase().includes(lowerCaseSearchTerm) ||
              moth.classification?.familyJapanese?.toLowerCase().includes(katakanaSearchTerm)) {
            uniqueSuggestions.add(moth.classification.familyJapanese);
          }
          if (moth.classification?.subfamilyJapanese?.toLowerCase().includes(lowerCaseSearchTerm) ||
              moth.classification?.subfamilyJapanese?.toLowerCase().includes(katakanaSearchTerm)) {
            uniqueSuggestions.add(moth.classification.subfamilyJapanese);
          }
          if (moth.classification?.tribeJapanese?.toLowerCase().includes(lowerCaseSearchTerm) ||
              moth.classification?.tribeJapanese?.toLowerCase().includes(katakanaSearchTerm)) {
            uniqueSuggestions.add(moth.classification.tribeJapanese);
          }
          if (moth.classification?.genus?.toLowerCase().includes(lowerCaseSearchTerm)) {
            uniqueSuggestions.add(moth.classification.genus);
          }
        } catch (error) {
          logger.error('Error processing moth for suggestions:', moth, error);
        }
      });
      
      return Array.from(uniqueSuggestions).slice(0, 10);
    } catch (error) {
      logger.error('Error in allSuggestions calculation:', error);
      return [];
    }
  }, [moths, searchTerm]);

  // Load image filenames list for lightweight sorting
  const [imageFilenames, setImageFilenames] = useState(new Set());
  const [imageFilenamesNormalized, setImageFilenamesNormalized] = useState(new Set());
  const [imageExtensions, setImageExtensions] = useState({});
  
  useEffect(() => {
    const loadImageData = async () => {
      try {
        // Load filenames
        const filenamesResponse = await fetch(`${import.meta.env.BASE_URL}image_filenames.txt?v=${Date.now()}`);
        const filenamesText = await filenamesResponse.text();
        const rawList = filenamesText.trim().split('\n').filter(Boolean);
        const filenames = new Set(rawList);
        setImageFilenames(filenames);
        // Build normalized base names (Genus_species)
        const normSet = new Set();
        rawList.forEach(base => {
          const m1 = base.match(/^([A-Z][a-z]+)\s+([a-z]+)/);
          if (m1) {
            normSet.add(`${m1[1]}_${m1[2]}`);
            return;
          }
          const m2 = base.match(/^([A-Z][a-z]+)_([a-z]+)/);
          if (m2) {
            normSet.add(`${m2[1]}_${m2[2]}`);
            return;
          }
        });
        setImageFilenamesNormalized(normSet);
        
        // Load extension mapping
        try {
          const extensionsResponse = await fetch(`${import.meta.env.BASE_URL}image_extensions.json?v=${Date.now()}`);
          const extensionsData = await extensionsResponse.json();
          setImageExtensions(extensionsData);
          logger.debug('Loaded image extensions:', Object.keys(extensionsData).length, 'files');
        } catch (extError) {
          logger.debug('Could not load image extensions mapping:', extError);
        }
        
        logger.debug('Loaded image filenames:', filenames.size, 'files');
        logger.debug('Has Cryphia_mitsuhashi:', filenames.has('Cryphia_mitsuhashi'));
        logger.debug('First 10 filenames:', Array.from(filenames).slice(0, 10));
      } catch (error) {
        logger.debug('Could not load image filenames:', error);
      }
    };
    loadImageData();
  }, []);

  // Helper to check if any image exists for a moth (JP or scientific filenames)
  const hasAnyImageForMoth = useCallback((insect) => {
    try {
      if (!insect) return false;
      const createSafeFilename = (scientificName) => {
        if (!scientificName) return '';
        let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
        cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
        cleanedName = cleanedName.replace(/\s+/g, '_');
        return cleanedName;
      };

      const sciFile = insect.scientificFilename || createSafeFilename(insect.scientificName);
      if (sciFile) {
        if (imageFilenames.has(sciFile) || imageFilenamesNormalized.has(sciFile) || !!imageExtensions[sciFile]) return true;
        // Genus_species_* variants
        for (const fname of imageFilenames) {
          if (fname === sciFile || fname.startsWith(`${sciFile}_`)) return true;
        }
        if (Object.keys(imageExtensions).some(k => k === sciFile || k.startsWith(`${sciFile}_`))) return true;
      }

      // Japanese name file
      if (insect.name) {
        if (imageFilenames.has(insect.name) || !!imageExtensions[insect.name]) return true;
      }

      // Scientific parts containment (space and underscore versions)
      if (insect.scientificName) {
        const parts = insect.scientificName.split(' ').slice(0, 2).join(' ');
        const partsUS = parts.replace(/\s+/g, '_');
        for (const fname of imageFilenames) {
          if (fname.includes(parts) || fname.includes(partsUS)) return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }, [imageExtensions, imageFilenames, imageFilenamesNormalized]);

  // Sort moths to prioritize those with images (lightweight)
  const sortedMoths = useMemo(() => {
    try {
      if (!filteredMoths || filteredMoths.length === 0) {
        return [];
      }
      
      // Wait for imageFilenames to load before sorting - return unsorted on first render
      // This is better than showing wrong order initially
      const hasAnyImageIndex = (imageFilenames && imageFilenames.size > 0) || (imageExtensions && Object.keys(imageExtensions).length > 0);
      if (!hasAnyImageIndex) {
        logger.debug('No image index loaded yet, returning unsorted');
        return filteredMoths;
      }
      
      // Determine if we're in search mode
      const isSearching = (debouncedSearchTerm && debouncedSearchTerm.trim() !== '') || classificationFilter;
      
      const sorted = [...filteredMoths].sort((a, b) => {
        if (isSearching) {
          // 検索時でも「画像あり」を優先。その上で分類優先の並びにする。
          const createSafeFilename = (scientificName) => {
        if (!scientificName) return '';
        // Extract genus and species only
        let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
        cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
        cleanedName = cleanedName.replace(/\s+/g, '_');
        return cleanedName;
      };
          const hasImageA = hasAnyImageForMoth(a);
          const hasImageB = hasAnyImageForMoth(b);
          if (hasImageA && !hasImageB) return -1;
          if (!hasImageA && hasImageB) return 1;

          // 検索時：分類階層順（科→亜科→族→属→種）+ あいうえお順
          const getClassificationPriority = (insect) => {
            const classification = insect.classification;
            if (!classification) return { level: 5, name: insect.name };
            
            if (classification.familyJapanese) return { level: 1, name: classification.familyJapanese };
            if (classification.subfamilyJapanese) return { level: 2, name: classification.subfamilyJapanese };
            if (classification.tribeJapanese) return { level: 3, name: classification.tribeJapanese };
            if (classification.genus) return { level: 4, name: classification.genus };
            return { level: 5, name: insect.name };
          };
          
          const priorityA = getClassificationPriority(a);
          const priorityB = getClassificationPriority(b);
          
          // 階層レベルで比較
          if (priorityA.level !== priorityB.level) {
            return priorityA.level - priorityB.level;
          }
          
          // 同じ階層レベル内では分類名であいうえお順
          if (priorityA.name !== priorityB.name) {
            return priorityA.name.localeCompare(priorityB.name, 'ja');
          }
          
          // 分類名も同じ場合は種名であいうえお順
          return a.name.localeCompare(b.name, 'ja');
        } else {
          // デフォルト表示時：画像優先 + あいうえお順
          const createSafeFilename = (scientificName) => {
        if (!scientificName) return '';
        // Extract genus and species only
        let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
        cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
        cleanedName = cleanedName.replace(/\s+/g, '_');
        return cleanedName;
      };
      
          // Check if species has a static image file (based on preloaded filename list)
          const hasImageA = hasAnyImageForMoth(a);
          const hasImageB = hasAnyImageForMoth(b);
      
          // (debug logging removed to avoid runtime ReferenceError in production)
          
          // Priority: Images first, then others
          if (hasImageA && !hasImageB) return -1;
          if (!hasImageA && hasImageB) return 1;
          
          // If both have images or both don't, sort alphabetically by name
          return a.name.localeCompare(b.name, 'ja');
        }
      });
    
    // Count moths with images
    const mothsWithImages = sorted.filter(m => {
      const createSafeFilename = (scientificName) => {
        if (!scientificName) return '';
        let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
        cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
        cleanedName = cleanedName.replace(/\s+/g, '_');
        return cleanedName;
      };
      const fn = m.scientificFilename || createSafeFilename(m.scientificName);
      return imageFilenames.has(fn) || imageFilenamesNormalized.has(fn) || !!imageExtensions[fn];
    });
    
    // Log the first few sorted moths to see if images are prioritized
    logger.debug(`Image prioritization: ${mothsWithImages.length} moths have images out of ${sorted.length} total`);
    logger.debug('First 20 sorted moths:', sorted.slice(0, 20).map(m => {
      const createSafeFilename = (scientificName) => {
        if (!scientificName) return '';
        let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
        cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
        cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
        cleanedName = cleanedName.replace(/\s+/g, '_');
        return cleanedName;
      };
      
      const filename = m.scientificFilename || createSafeFilename(m.scientificName);
      return {
        name: m.name,
        scientificName: m.scientificName,
        scientificFilename: m.scientificFilename,
        generatedFilename: filename,
        hasImage: imageFilenames.has(filename)
      };
    }));
    
    return sorted;
    } catch (error) {
      logger.error('Error in sortedMoths calculation:', error);
      return filteredMoths || [];
    }
  }, [filteredMoths, imageFilenames, imageFilenamesNormalized, imageExtensions, hasAnyImageForMoth, debouncedSearchTerm, classificationFilter]);

  const totalPages = Math.ceil((sortedMoths?.length || 0) / itemsPerPage);
  const currentMoths = useMemo(() => {
    try {
      if (!sortedMoths || sortedMoths.length === 0) {
        return [];
      }
      
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return sortedMoths.slice(startIndex, endIndex);
    } catch (error) {
      logger.error('Error calculating currentMoths:', error);
      return [];
    }
  }, [sortedMoths, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Add rel=prev/next for crawlers (hint)
  useEffect(() => {
    try {
      // Remove existing
      document.querySelectorAll('link[rel="prev"], link[rel="next"]').forEach(n => n.remove());
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      if (currentPage > 1) {
        const prev = document.createElement('link');
        prev.rel = 'prev';
        const prevUrl = new URL(url.href);
        prevUrl.searchParams.set('page', String(currentPage - 1));
        prev.href = prevUrl.toString();
        document.head.appendChild(prev);
      }
      if (currentPage < totalPages) {
        const next = document.createElement('link');
        next.rel = 'next';
        const nextUrl = new URL(url.href);
        nextUrl.searchParams.set('page', String(currentPage + 1));
        next.href = nextUrl.toString();
        document.head.appendChild(next);
      }
    } catch {}
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

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
                {title}のリスト
              </h2>
              {classificationFilter && (
                <div className="flex items-center mt-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400 mr-2">フィルター:</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50">
                    {classificationFilter}
                  </span>
                  <Link
                    to="/"
                    className="ml-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
                  >
                    クリア
                  </Link>
                </div>
              )}
            </div>
          </div>
          <SearchInput 
            placeholder={`${title}を検索 (和名・学名・分類)`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            suggestions={allSuggestions}
            onSelectSuggestion={setSearchTerm}
          />
        </div>
      )}
      
      {embedded && (
        <div className="p-6">
          {classificationFilter && (
            <div className="flex items-center mb-4">
              <span className="text-sm text-slate-600 dark:text-slate-400 mr-2">フィルター:</span>
              <span className="inline-flex items-center px-2 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50">
                {classificationFilter}
              </span>
              <Link
                to="/"
                className="ml-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
              >
                クリア
              </Link>
            </div>
          )}
          <SearchInput 
            placeholder={`${title}を検索 (和名・学名・分類)`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            suggestions={allSuggestions}
            onSelectSuggestion={setSearchTerm}
          />
        </div>
      )}
      
      <div className="p-6">
        <div className="max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100 dark:scrollbar-thumb-blue-600 dark:scrollbar-track-blue-900/20">
          {currentMoths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentMoths.map((moth, index) => {
                try {
                  return (
                    <div key={moth?.id || `moth-${index}`} className="animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                      <MothListItem 
                        moth={moth} 
                        baseRoute={baseRoute} 
                        isPriority={index < 12} 
                        imageFilenames={imageFilenames}
                        imageExtensions={imageExtensions}
                        currentPage={currentPage}
                      />
                    </div>
                  );
                } catch (error) {
                  logger.error('Error rendering moth item:', error, moth);
                  return (
                    <div key={`error-${index}`} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-600">
                      <div className="text-red-600 dark:text-red-400 text-sm">
                        表示エラー: {moth?.name || `昆虫 #${index}`}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-400 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">該当する{title}が見つかりません</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">別のキーワードで検索してみてください</p>
            </div>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-blue-200/30 dark:border-blue-700/30 overflow-x-hidden">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MothList;
