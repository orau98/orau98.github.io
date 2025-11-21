import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import Pagination from './Pagination';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import EmergenceTimeDisplay from './EmergenceTimeDisplay';
import logger from '../utils/logger';
import { extractEmergenceTime, normalizeEmergenceTime } from '../utils/emergenceTimeUtils';
import { hiraganaToKatakana } from '../utils/text';
import { loadInsectImageIndexes } from '../services/imageIndex';
import { createSafeInsectFilename } from '../utils/image';
import { buildResponsiveSrcset } from '../utils/imageSrcset';
import useSeoMeta from '../hooks/useSeoMeta';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';

const MothListItem = React.memo(({ moth, baseRoute = "/moth", isPriority = false, imageFilename, imageExtensions = {}, currentPage = 1 }) => {
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef(null);
  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : '');

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
  
  // Use passed imageFilename or fallback to placeholder/safe name
  const finalImageFilename = React.useMemo(() => {
    return imageFilename || createSafeInsectFilename(moth?.scientificName || moth?.name || 'placeholder');
  }, [imageFilename, moth]);
  
  // Determine the correct file extension using the extensions mapping
  let imageExtension = '.jpg'; // default
  if (imageExtensions && imageExtensions[finalImageFilename]) {
    imageExtension = imageExtensions[finalImageFilename];
  }
  
  const imageFolder = 'insects';
  const imageUrl = `${import.meta.env.BASE_URL}images/${imageFolder}/${encodeURIComponent(finalImageFilename)}${imageExtension}${cacheBustRef.current}`;
  
  // Check if we have an actual match (passed filename implies existence)
  const hasImageFilename = !!imageFilename;
  
  
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
                  (() => {
                    const { src, srcSet, sizes } = buildResponsiveSrcset({
                      folder: 'insects', filename: finalImageFilename, ext: imageExtension,
                      widths: [320, 640, 1024],
                      sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
                    });
                    return (
                      <img
                        src={src}
                        srcSet={srcSet}
                        sizes={sizes}
                        alt={`${moth.name}（${moth.scientificName}）の写真`}
                        width="800"
                        height="600"
                        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 gpu-accelerated ${
                          imageLoaded ? 'opacity-100 loaded' : 'opacity-0 loading'
                        }`}
                        style={{ 
                          imageRendering: 'auto',
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
                            const fallbackUrl = `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(finalImageFilename)}${imageExtension}${cacheBustRef.current}`;
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
                    );
                  })()
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
                      return plant.trim();
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
              
              {/* 成虫発生時期表示（ガントチャートのみ） */}
              {(() => {
                const { emergenceTime } = extractEmergenceTime(moth.notes || '');
                const normalizedTime = normalizeEmergenceTime(emergenceTime);
                
                if (normalizedTime) {
                  return (
                    <div className="pt-1">
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

const MothList = ({ moths, title = "蛾", baseRoute = "/moth", embedded = false, initialSearchTerm = "" }) => {
  // Canonical/OG/パンくず（一覧ページ）
  const canonicalPath = baseRoute === '/' || baseRoute === '' ? '/' : baseRoute;
  const canonicalUrl = (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://orau98.github.io') + (canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`);
  const pageTitle = `${title}の一覧 | 昆虫食草図鑑`;
  const pageDesc = `${title}の一覧ページ。${moths?.length || 0}種から検索・絞り込み。和名/学名/科・亜科・属で高速検索可能。`;

  const breadcrumbItems = useMemo(() => ([
    { name: '昆虫食草図鑑', url: (typeof window !== 'undefined' ? window.location.origin : 'https://orau98.github.io') + '/' },
    { name: title, url: canonicalUrl }
  ]), [canonicalUrl, title]);

  useSeoMeta({
    enabled: !embedded,
    title: pageTitle,
    description: pageDesc,
    ogType: 'website',
    url: canonicalUrl,
    breadcrumbItems,
    resetCanonicalTo: (typeof window !== 'undefined' ? window.location.origin : 'https://orau98.github.io') + '/'
  });
  const [searchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [hostFilter, setHostFilter] = useState("all"); // all | has | none
  const [familyFilter, setFamilyFilter] = useState("");
  const [genusFilter, setGenusFilter] = useState("");
  const [emergenceFilter, setEmergenceFilter] = useState("");

  const familyOptions = useMemo(() => {
    const set = new Set();
    moths.forEach((m) => {
      const fam = (m?.classification?.familyJapanese || m?.classification?.family || '').trim();
      if (fam) set.add(fam);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [moths]);

  const genusOptions = useMemo(() => {
    const set = new Set();
    moths.forEach((m) => {
      const gen = (m?.classification?.genus || '').trim();
      if (gen) set.add(gen);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [moths]);

  const emergenceOptions = useMemo(() => {
    const set = new Set();
    moths.forEach((m) => {
      const { emergenceTime } = extractEmergenceTime(m?.notes || '');
      const n = normalizeEmergenceTime(emergenceTime);
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [moths]);
  const itemsPerPage = 52; // Changed from 50 to 52 to fill the 4-column grid completely

  const classificationFilter = searchParams.get('classification');
  const debouncedSearchTerm = useDebounce(initialSearchTerm, 300);

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

  // Sync search term with classification filter and clear when filter removed
  useEffect(() => {
    if (classificationFilter) {
      setSearchTerm(classificationFilter);
      lastAppliedClassificationRef.current = classificationFilter;
    } else if (lastAppliedClassificationRef.current) {
      setSearchTerm((prev) =>
        prev === lastAppliedClassificationRef.current ? '' : prev
      );
      lastAppliedClassificationRef.current = null;
    }
  }, [classificationFilter]);

  // （メタは useSeoMeta に移行）

  // ItemList JSON-LD for top items (first 10)
  useEffect(() => {
    if (embedded) return;
    try {
      const source = (moths || []).slice(0, 10);
      const items = source.map((m, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: ((typeof window !== 'undefined' ? window.location.origin : 'https://orau98.github.io')) + `/meta/moth/${m.id}.html`
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

  const extractEmergence = useCallback((moth) => {
    try {
      const { emergenceTime } = extractEmergenceTime(moth?.notes || '');
      return normalizeEmergenceTime(emergenceTime) || '';
    } catch {
      return '';
    }
  }, []);

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
            const famJ = normalizeText(moth.classification?.familyJapanese);
            const fam = normalizeText(moth.classification?.family);
            if (!(famJ === normalizeText(familyFilter) || fam === normalizeText(familyFilter))) return false;
          }
          
          // genus filter
          if (genusFilter) {
            if ((moth.classification?.genus || '').toLowerCase() !== genusFilter.toLowerCase()) return false;
          }
          
          // emergence filter
          if (emergenceFilter) {
            const em = extractEmergence(moth);
            if (!em.includes(emergenceFilter)) return false;
          }
          
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
  }, [moths, debouncedSearchTerm, classificationFilter, hostFilter, familyFilter, genusFilter, emergenceFilter, hasRealHost, extractEmergence, normalizeText]);

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

  // 画像インデックス（共通サービス）
  const [imageFilenames, setImageFilenames] = useState(new Set());
  const [imageFilenamesNormalized, setImageFilenamesNormalized] = useState(new Set());
  const [imageExtensions, setImageExtensions] = useState({});


  useEffect(() => {
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        const list = Array.from(names || []);
        const fileSet = new Set(list);
        setImageFilenames(fileSet);
        // Build normalized base names (Genus_species)
        const normSet = new Set();
        list.forEach(base => {
          const m1 = base.match(/^([A-Z][a-z]+)\s+([a-z]+)/);
          if (m1) { normSet.add(`${m1[1]}_${m1[2]}`); return; }
          const m2 = base.match(/^([A-Z][a-z]+)_([a-z]+)/);
          if (m2) { normSet.add(`${m2[1]}_${m2[2]}`); return; }
        });
        setImageFilenamesNormalized(normSet);
        setImageExtensions(exts || {});
        logger.debug('Loaded image index via service:', list.length, 'files');
      })
      .catch((e) => {
        logger.debug('Failed to load insect image index:', e);
        setImageFilenames(new Set());
        setImageFilenamesNormalized(new Set());
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

  // Helper to find best image filename for a moth (moved from MothListItem for performance)
  // Returns the filename (without path, but with/without extension depending on source) or null
  const getBestImageForMoth = useCallback((insect) => {
    try {
      if (!insect) return null;
      
      // If index not loaded, we can't know for sure (except optimistic mapped/scientific guesses, but safer to return null)
      // イントロ表示時に index 取得が遅れた場合でも、フィボナッチ的に試行するため
      // index 未準備時は安全なファイル名を楽観的に返し、ブラウザの 404 で判定させる
      if (!isImageIndexReady) {
        const safeFilename = createSafeInsectFilename(insect.scientificName || insect.name || '');
        return safeFilename || null;
      }

      // 0. Try mapped filename first (highest priority)
      const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
      if (mappedFilename && imageFilenames.has(mappedFilename)) {
        return mappedFilename;
      }
      
      // 1. Try scientific filename directly
      if (insect.scientificFilename && imageFilenames.has(insect.scientificFilename)) {
        return insect.scientificFilename;
      }
      
      // 2. Try generated safe filename
      const safeFilename = createSafeInsectFilename(insect.scientificName);
      if (imageFilenames.has(safeFilename)) {
        return safeFilename;
      }
      
      // 2a. Try filename variants
      // Optimize: avoid iterating entire set if possible. 
      // But here we need prefix match.
      // Check normalized set first for exact match
      if (imageFilenamesNormalized.has(safeFilename)) {
        // Find the actual original filename
        for (const fname of imageFilenames) {
           if (fname === safeFilename || fname.startsWith(`${safeFilename}_`)) return fname;
        }
      }
      
      // 2b. Check extensions map keys
      if (imageExtensions[safeFilename]) return safeFilename;
      // Check keys starting with safeFilename
      const extKey = Object.keys(imageExtensions).find(key => key === safeFilename || key.startsWith(`${safeFilename}_`));
      if (extKey) return extKey;
      
      // 3. Try Japanese name
      if (imageFilenames.has(insect.name)) return insect.name;
      
      // 4. Substring search (slowest, but necessary for some)
      // Only do this if we haven't found it yet
      // Optimize: check if any image filename contains the name
      // iterating 2000+ filenames x 7000 insects is too slow (14M ops).
      // We should skip this expensive check for the pre-calc map if possible, 
      // or optimize it.
      // For now, let's trust the specific lookups above cover 99% cases.
      // The original code did this iteration per item render. 
      // Doing it once in useEffect is better but still slow on main thread.
      // Let's skip the full scan for now to keep init fast.
      
      return null;
    } catch {
      return null;
    }
  }, [imageExtensions, imageFilenames, imageFilenamesNormalized, isImageIndexReady]);

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

  // Sort moths prioritizing those with images; render deferred until index is ready
  const sortedMoths = useMemo(() => {
    try {
      if (!filteredMoths || filteredMoths.length === 0) {
        return [];
      }
      // If image index isn't ready, return unsorted. UI will show placeholders meanwhile.
      if (!isImageIndexReady) {
        return filteredMoths;
      }

      const getHasImage = (insect) => {
        if (!insect) return false;
        return mothImageMap.has(insect.id);
      };

      const isSearching = (debouncedSearchTerm && debouncedSearchTerm.trim() !== '') || classificationFilter;
      const sorted = [...filteredMoths].sort((a, b) => {
        const hasImageA = getHasImage(a);
        const hasImageB = getHasImage(b);
        if (hasImageA && !hasImageB) return -1;
        if (!hasImageA && hasImageB) return 1;

        if (isSearching) {
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
          if (priorityA.level !== priorityB.level) return priorityA.level - priorityB.level;
          if (priorityA.name !== priorityB.name) return priorityA.name.localeCompare(priorityB.name, 'ja');
        }
        return a.name.localeCompare(b.name, 'ja');
      });

      return sorted;
    } catch (error) {
      logger.error('Error in sortedMoths calculation:', error);
      return filteredMoths || [];
    }
  }, [filteredMoths, debouncedSearchTerm, classificationFilter, isImageIndexReady, mothImageMap]);

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
    } catch (error) {
      logger.debug('Failed to update rel prev/next links for moth list:', error);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, hostFilter, familyFilter, genusFilter, emergenceFilter]);

  const renderFilters = () => (
    <div className="mt-4 flex flex-wrap gap-3 items-center text-sm text-slate-700 dark:text-slate-300">
      <div className="flex items-center gap-1">
        <span className="font-semibold">食草:</span>
        <select
          value={hostFilter}
          onChange={(e) => setHostFilter(e.target.value)}
          className="px-2 py-1 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600"
        >
          <option value="all">すべて</option>
          <option value="has">食草あり</option>
          <option value="none">未登録のみ</option>
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">科:</span>
        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="px-2 py-1 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600"
        >
          <option value="">指定なし</option>
          {familyOptions.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">属:</span>
        <select
          value={genusFilter}
          onChange={(e) => setGenusFilter(e.target.value)}
          className="px-2 py-1 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600"
        >
          <option value="">指定なし</option>
          {genusOptions.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">出現期:</span>
        <select
          value={emergenceFilter}
          onChange={(e) => setEmergenceFilter(e.target.value)}
          className="px-2 py-1 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600"
        >
          <option value="">指定なし</option>
          {emergenceOptions.map((em) => (
            <option key={em} value={em}>{em}</option>
          ))}
        </select>
      </div>
      <div className="ml-auto text-xs md:text-sm text-slate-500 dark:text-slate-400">
        {filteredMoths?.length ?? 0} 件
      </div>
    </div>
  );

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
          {renderFilters()}
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
          {renderFilters()}
        </div>
      )}
      
      <div className="p-6">
        <div className="max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100 dark:scrollbar-thumb-blue-600 dark:scrollbar-track-blue-900/20">
          {!isImageIndexReady ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white/60 dark:bg-slate-800/60 rounded-2xl h-64 animate-pulse border border-white/30 dark:border-slate-700/40" />
              ))}
            </div>
          ) : currentMoths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentMoths.map((moth, index) => {
                try {
                  return (
                    <div key={moth?.id || `moth-${index}`} className="animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                      <MothListItem 
                        moth={moth} 
                        baseRoute={baseRoute} 
                        isPriority={index < 12} 
                        imageFilename={mothImageMap.get(moth.id)}
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
