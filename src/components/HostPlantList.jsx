import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';

// Preload list of available plant images
let plantImageFilenames = [];
let plantImageFilenamesLoaded = false;

const loadPlantImageFilenames = async () => {
  if (plantImageFilenamesLoaded) return plantImageFilenames;
  
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}plant_image_filenames.txt?v=${Date.now()}`);
    if (response.ok) {
      const text = await response.text();
      plantImageFilenames = text.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
          // Extract filename after the arrow "→"
          if (line.includes('→')) {
            return line.split('→')[1].trim();
          }
          return line;
        })
        .filter(line => line);
      plantImageFilenamesLoaded = true;
    }
  } catch (error) {
    console.error('植物画像リストの読み込みに失敗しました:', error);
  }
  
  return plantImageFilenames;
};

const HostPlantListItem = React.memo(({ plant, mothNames, plantDetails = {}, plantImageFilenames: preloadedFilenames = [] }) => {
  const [imageExists, setImageExists] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [plantImageUrl, setPlantImageUrl] = useState('');
  
  // Create safe filename for plant image
  const createSafePlantFilename = (plantName) => {
    if (!plantName) return '';
    // Remove family annotations and special characters
    let cleanedName = plantName.replace(/（[^）]*科[^）]*）/g, '');
    cleanedName = cleanedName.replace(/\([^)]*科[^)]*\)/g, '');
    // Also remove patterns like (クルミ) without 科
    cleanedName = cleanedName.replace(/\([^)]*\)/g, '');
    cleanedName = cleanedName.replace(/科$/g, ''); // Remove trailing '科'
    cleanedName = cleanedName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
    return cleanedName;
  };
  
  const safePlantName = createSafePlantFilename(plant);
  
  React.useEffect(() => {
    // Check if plant image exists using preloaded list
    const checkPlantImage = () => {
      if (!preloadedFilenames || preloadedFilenames.length === 0) return;
      
      // Reset states
      setImageExists(false);
      setImageLoaded(false);
      setImageError(false);
      setPlantImageUrl('');
      
      // Try to find matching image in the preloaded list, prioritizing 葉表 (leaf surface)
      const getMatchingImages = () => {
        // Build candidate bases: self + aliases + manual synonyms fallback
        const aliases = Array.isArray(plantDetails[plant]?.aliases) ? plantDetails[plant].aliases : [];
        const synonymPairs = {
          'ビナンカズラ': ['サネカズラ'],
          'サネカズラ': ['ビナンカズラ']
        };
        const fallbackSyns = synonymPairs[plant] || [];
        const candidates = new Set([
          plant,
          ...aliases,
          ...fallbackSyns
        ].filter(Boolean).flatMap(name => {
          const base = (name || '').split(' ')[0];
          const cleaned = createSafePlantFilename(name);
          const cleanedBase = createSafePlantFilename(base);
          return [name, base, cleaned, cleanedBase];
        }));

        const matches = preloadedFilenames.filter(filename => {
          // Extract the base name from the filename (remove extension, then part before underscore)
          const withoutExt = filename.replace(/\.[^.]+$/, '');
          const filenameBase = withoutExt.split('_')[0];
          // Exact match against any candidate
          return candidates.has(filenameBase);
        });
        
        // Sort matches to prioritize 葉表 (leaf surface)
        return matches.sort((a, b) => {
          const aHasLeafSurface = a.includes('葉表');
          const bHasLeafSurface = b.includes('葉表');
          
          // Prioritize 葉表
          if (aHasLeafSurface && !bHasLeafSurface) return -1;
          if (!aHasLeafSurface && bHasLeafSurface) return 1;
          
          // Secondary priority order: 葉 > 花 > 実 > 樹皮 > others
          const getPriority = (filename) => {
            if (filename.includes('葉表')) return 1;
            if (filename.includes('葉')) return 2;
            if (filename.includes('花')) return 3;
            if (filename.includes('実')) return 4;
            if (filename.includes('樹皮')) return 5;
            return 6;
          };
          
          return getPriority(a) - getPriority(b);
        });
      };
      
      const matchingImages = getMatchingImages();
      const matchingImage = matchingImages[0]; // Use the highest priority match
      
      // Debug logging for オニグルミ
      if (plant === 'オニグルミ') {
        console.log('オニグルミ image matching debug:', {
          plant,
          safePlantName,
          preloadedFilenamesLength: preloadedFilenames.length,
          sampleFilenames: preloadedFilenames.slice(0, 10),
          matchingImages,
          matchingImage
        });
      }
      
      if (matchingImage) {
        // Find the appropriate extension
        const baseUrl = `${import.meta.env.BASE_URL}images/plants/`;
        const extensions = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG'];
        
        // Try extensions sequentially until one succeeds
        const tryExtension = (extensionIndex) => {
          if (extensionIndex >= extensions.length) {
            // All extensions failed
            setImageError(true);
            return;
          }
          
          const ext = extensions[extensionIndex];
          const encodedName = encodeURIComponent(matchingImage);
          const url = `${baseUrl}${encodedName}.${ext}`;
          const img = new Image();
          
          img.onload = () => {
            setImageExists(true);
            setPlantImageUrl(url);
            setImageLoaded(true);
          };
          
          img.onerror = () => {
            // This extension failed, try the next one
            tryExtension(extensionIndex + 1);
          };
          
          img.src = url;
        };
        
        // Start trying from the first extension
        tryExtension(0);
      } else {
        setImageError(true);
      }
    };
    
    checkPlantImage();
  }, [plant, safePlantName, preloadedFilenames]);

  return (
  <li className="group relative overflow-hidden rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transform shadow-md list-none">
    <Link to={`/plant/${encodeURIComponent(plant)}`} className="block">
      <div className="flex flex-col h-full">
        {/* Enhanced Plant Image/Icon section */}
        <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
          {imageExists ? (
            // Actual plant image
            <div className="relative w-full aspect-[4/3]">
              <img
                src={plantImageUrl}
                alt={`${plant}の写真`}
                width="800"
                height="600"
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {/* Plant name overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                <h3 className="text-white font-bold text-lg drop-shadow-lg tracking-tight">
                  {plant}
                </h3>
              </div>
            </div>
          ) : (
            // Fallback to beautiful plant icon with better layout
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-700 dark:to-emerald-800 flex flex-col items-center justify-center p-6">
              {/* No image icon at top */}
              <div className="flex-shrink-0 mb-4">
                <svg className="w-12 h-12 text-emerald-400 dark:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              
              {/* Names displayed prominently in center */}
              <div className="text-center flex-1 flex flex-col justify-center">
                <h3 className="text-emerald-800 dark:text-emerald-200 font-bold text-lg mb-2 leading-tight tracking-tight">
                  {plant}
                </h3>
                {plantDetails[plant]?.familyName && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm leading-relaxed">
                    {plantDetails[plant].familyName}
                  </p>
                )}
              </div>
              
              {/* No image indicator at bottom */}
              <div className="flex-shrink-0 mt-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-300/70 dark:bg-emerald-600/70 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 dark:border-emerald-500/30">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                  </svg>
                  画像準備中
                </span>
              </div>
            </div>
          )}
          
          {/* Loading state for images */}
          {!imageLoaded && imageExists && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/80 dark:bg-emerald-900/40">
              <div className="relative">
                <div className="w-8 h-8 border-3 border-emerald-200 dark:border-emerald-700 rounded-full"></div>
                <div className="absolute top-0 left-0 w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          )}
          
          
          {/* Decorative pattern overlay for non-image cards */}
          {!imageExists && (
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                <pattern id={`plant-pattern-${safePlantName}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M10 2L8 8L10 14L12 8Z" fill="currentColor" className="text-emerald-500"/>
                  <circle cx="10" cy="8" r="1" fill="currentColor" className="text-emerald-600"/>
                </pattern>
                <rect width="100" height="100" fill={`url(#plant-pattern-${safePlantName})`}/>
              </svg>
            </div>
          )}
          
          {/* Species count badge */}
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/90 text-white backdrop-blur-sm shadow-sm">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {mothNames.length}種
            </span>
          </div>
          
          {/* Gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent"></div>
        </div>
        
        {/* Enhanced Content section */}
        <div className="p-4">
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 flex-shrink-0">
                昆虫
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                {mothNames.slice(0, 4).join('、')}
                {mothNames.length > 4 && `...他${mothNames.length - 4}種`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  </li>
  );
});

const HostPlantList = ({ hostPlants = {}, plantDetails = {}, embedded = false }) => {
  const [plantSearchTerm, setPlantSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [plantImageFilenames, setPlantImageFilenames] = useState([]);
  
  // Canonical と Breadcrumb（植物一覧用）
  useEffect(() => {
    if (embedded) return;
    try {
      // canonical を /plant に固定
      let canon = document.querySelector('link[rel="canonical"]');
      if (!canon) {
        canon = document.createElement('link');
        canon.rel = 'canonical';
        document.head.appendChild(canon);
      }
      const base = new URL(window.location.origin + '/plant');
      canon.href = base.toString();

      // BreadcrumbList を注入
      const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "昆虫食草図鑑", "item": "https://orau98.github.io/" },
          { "@type": "ListItem", "position": 2, "name": "植物", "item": "https://orau98.github.io/plant" }
        ]
      };
      let breadcrumbScript = document.querySelector('#breadcrumb-list-plant');
      if (!breadcrumbScript) {
        breadcrumbScript = document.createElement('script');
        breadcrumbScript.id = 'breadcrumb-list-plant';
        breadcrumbScript.type = 'application/ld+json';
        document.head.appendChild(breadcrumbScript);
      }
      breadcrumbScript.textContent = JSON.stringify(breadcrumb);
    } catch {}
    return () => {
      const s = document.querySelector('#breadcrumb-list-plant');
      if (s) s.remove();
    };
  }, [embedded]);
  // Responsive items-per-page to avoid empty grid slots on last row
  const getCols = () => {
    if (typeof window === 'undefined') return 1;
    const w = window.innerWidth;
    if (w >= 1280) return 4; // xl
    if (w >= 1024) return 3; // lg
    if (w >= 768) return 2;  // md
    return 1;                // base
  };
  const computeItemsPerPage = () => {
    const cols = getCols();
    const rows = 12; // show 12 rows to fill grid nicely
    return cols * rows;
  };
  const [itemsPerPage, setItemsPerPage] = useState(computeItemsPerPage());

  // ひらがなをカタカナに変換する関数
  const hiraganaToKatakana = (str) => {
    return str.replace(/[\u3041-\u3096]/g, (match) => {
      const chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
    });
  };

  // Load plant image filenames on component mount
  useEffect(() => {
    loadPlantImageFilenames().then(filenames => {
      setPlantImageFilenames(filenames);
    });
  }, []);

  // Update itemsPerPage on resize to keep pages filling complete rows
  useEffect(() => {
    const onResize = () => {
      const next = computeItemsPerPage();
      setItemsPerPage(prev => (prev === next ? prev : next));
      setCurrentPage(1);
    };
    window.addEventListener('resize', onResize);
    // Ensure correct initial calculation
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const debouncedPlantSearch = useDebounce(plantSearchTerm, 300);

  const safeHostPlants = hostPlants || {};
  const safePlantDetails = plantDetails || {};

  // Meta description for plant list page
  useEffect(() => {
    try {
      if (embedded) return;
      const plantCount = Object.keys(safeHostPlants || {}).length;
      const desc = `植物（食草）一覧ページ。${plantCount}種の植物から、利用する昆虫を一覧で確認。和名・別名でも検索可能。`;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = desc;
    } catch {}
  }, [embedded, safeHostPlants]);

  // ItemList JSON-LD for plant list (first 10)
  useEffect(() => {
    if (embedded) return;
    try {
      const items = Object.keys(filteredHostPlants || {}).slice(0, 10).map((name, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `https://orau98.github.io/meta/plant/${encodeURIComponent(name)}.html`
      }));
      const id = 'itemlist-plant';
      let s = document.querySelector('#' + id);
      if (!s) {
        s = document.createElement('script');
        s.id = id;
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
      const s = document.querySelector('#itemlist-plant');
      if (s) s.remove();
    };
  }, [embedded, filteredHostPlants]);
  const filteredHostPlants = useMemo(() => {
    console.log('DEBUG: Filtering plants, total count:', Object.keys(safeHostPlants).length, 'search term:', debouncedPlantSearch);
    if (!safeHostPlants || Object.keys(safeHostPlants).length === 0) {
      console.log('DEBUG: No host plants available');
      return [];
    }
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    // ひらがな入力をカタカナに変換して検索
    const katakanaSearchTerm = hiraganaToKatakana(debouncedPlantSearch).toLowerCase();
    
    const filtered = Object.entries(safeHostPlants).filter(([plantName]) => {
      // Explicitly exclude empty, undefined, or invalid plant names
      if (!plantName || plantName.trim() === '' || plantName === 'undefined' || plantName === 'null') {
        console.log("DEBUG: Excluding invalid plant name:", JSON.stringify(plantName));
        return false;
      }
      
      console.log("Filtering plant:", plantName, "Details:", safePlantDetails[plantName]);
      const detail = safePlantDetails[plantName] || {};
      const family = detail.family ? detail.family.toLowerCase() : '';
      const genus = detail.genus ? detail.genus.toLowerCase() : '';
      const aliases = Array.isArray(detail.aliases) ? detail.aliases : [];
      const aliasHit = aliases.some(a => {
        const aLower = (a || '').toLowerCase();
        return aLower.includes(lowerCaseSearchTerm) || aLower.includes(katakanaSearchTerm);
      });
      
      // オリジナルの検索条件に加えて、カタカナ変換後の検索も追加
      return plantName.toLowerCase().includes(lowerCaseSearchTerm) ||
             plantName.toLowerCase().includes(katakanaSearchTerm) ||
             family.includes(lowerCaseSearchTerm) ||
             family.includes(katakanaSearchTerm) ||
             genus.includes(lowerCaseSearchTerm) ||
             genus.includes(katakanaSearchTerm) ||
             aliasHit;
    });
    
    // Sort with plants with images first, then "不明" at the end
    const sorted = filtered.sort(([a], [b]) => {
      // Helper function to check if plant image exists
      const createSafePlantFilename = (plantName) => {
        if (!plantName) return '';
        let cleanedName = plantName.replace(/（[^）]*科[^）]*）/g, '');
        cleanedName = cleanedName.replace(/\([^)]*科[^)]*\)/g, '');
        cleanedName = cleanedName.replace(/科$/g, '');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
        return cleanedName;
      };
      
      // Check if images exist using the preloaded image list
      const checkHasImage = (plantName) => {
        if (!plantName || plantName === '不明' || plantName.endsWith('科')) return false;
        const detail = safePlantDetails[plantName] || {};
        const aliases = Array.isArray(detail.aliases) ? detail.aliases : [];
        // Manual synonym pairs as fallback (robustness)
        const synonymPairs = {
          'ビナンカズラ': ['サネカズラ'],
          'サネカズラ': ['ビナンカズラ']
        };
        const extraSynonyms = synonymPairs[plantName] || [];
        const candidates = new Set([
          plantName,
          plantName.split(' ')[0],
          createSafePlantFilename(plantName),
          createSafePlantFilename(plantName.split(' ')[0]),
          ...aliases.flatMap(name => {
            const base = (name || '').split(' ')[0];
            const cleaned = createSafePlantFilename(name);
            const cleanedBase = createSafePlantFilename(base);
            return [name, base, cleaned, cleanedBase];
          }),
          ...extraSynonyms.flatMap(name => {
            const base = (name || '').split(' ')[0];
            const cleaned = createSafePlantFilename(name);
            const cleanedBase = createSafePlantFilename(base);
            return [name, base, cleaned, cleanedBase];
          })
        ].filter(Boolean));
        return plantImageFilenames.some(filename => {
          const withoutExt = filename.replace(/\.[^.]+$/, '');
          const filenameBase = withoutExt.split('_')[0];
          return candidates.has(filenameBase);
        });
      };
      
      const aHasImage = checkHasImage(a);
      const bHasImage = checkHasImage(b);
      
      // Debug logging for specific plants
      if (a === 'マタタビ' || b === 'マタタビ' || a === 'オニグルミ' || b === 'オニグルミ') {
        console.log(`Plant sorting: ${a} vs ${b}:`, {
          plantA: a,
          plantB: b,
          aHasImage,
          bHasImage,
          plantImageFilenamesLength: plantImageFilenames.length,
          sampleFilenames: plantImageFilenames.slice(0, 5)
        });
      }
      
      // Sort priority: images first, then regular plants, then "不明" last
      if (a === '不明') return 1;
      if (b === '不明') return -1;
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return a.localeCompare(b, 'ja');
    });
    
    // Count plants with images for debugging
    const plantsWithImages = sorted.filter(([plant]) => {
      const createSafePlantFilename = (plantName) => {
        if (!plantName) return '';
        let cleanedName = plantName.replace(/（[^）]*科[^）]*）/g, '');
        cleanedName = cleanedName.replace(/\([^)]*科[^)]*\)/g, '');
        cleanedName = cleanedName.replace(/科$/g, '');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
        return cleanedName;
      };
      
      if (!plant || plant === '不明' || plant.endsWith('科')) return false;
      const safeName = createSafePlantFilename(plant);
      const baseName = plant.split(' ')[0];
      const baseNameCleaned = createSafePlantFilename(baseName);
      return plantImageFilenames.some(filename => {
        const filenameBase = filename.split('_')[0];
        return filenameBase === safeName || filenameBase === baseName || filenameBase === baseNameCleaned;
      });
    });
    
    console.log(`Plant image prioritization: ${plantsWithImages.length} plants have images out of ${sorted.length} total`);
    console.log('First 10 sorted plants:', sorted.slice(0, 10).map(([plant]) => {
      const createSafePlantFilename = (plantName) => {
        if (!plantName) return '';
        let cleanedName = plantName.replace(/（[^）]*科[^）]*）/g, '');
        cleanedName = cleanedName.replace(/\([^)]*科[^)]*\)/g, '');
        cleanedName = cleanedName.replace(/科$/g, '');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
        return cleanedName;
      };
      
      if (!plant || plant === '不明' || plant.endsWith('科')) return { plant, hasImage: false };
      const safeName = createSafePlantFilename(plant);
      const baseName = plant.split(' ')[0];
      const baseNameCleaned = createSafePlantFilename(baseName);
      const hasImage = plantImageFilenames.some(filename => {
        const filenameBase = filename.split('_')[0];
        return filenameBase === safeName || filenameBase === baseName || filenameBase === baseNameCleaned;
      });
      
      return {
        plant,
        safeName,
        baseName,
        baseNameCleaned,
        hasImage,
        matchingFilenames: plantImageFilenames.filter(filename => {
          const filenameBase = filename.split('_')[0];
          return filenameBase === safeName || filenameBase === baseName || filenameBase === baseNameCleaned;
        })
      };
    }));
    
    return sorted;
  }, [safeHostPlants, safePlantDetails, debouncedPlantSearch, plantImageFilenames]);

  // Add rel=prev/next for plant list pagination
  useEffect(() => {
    try {
      const totalPages = Math.ceil(filteredHostPlants.length / itemsPerPage);
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
  }, [currentPage, itemsPerPage, filteredHostPlants.length]);

  const plantNameSuggestions = useMemo(() => {
    if (!plantSearchTerm) return [];
    const lowerCaseSearchTerm = plantSearchTerm.toLowerCase();
    const katakanaSearchTerm = hiraganaToKatakana(plantSearchTerm).toLowerCase();
    const suggestions = new Set();
    Object.keys(safeHostPlants).forEach(plant => {
      if (plant.toLowerCase().includes(lowerCaseSearchTerm) || 
          plant.toLowerCase().includes(katakanaSearchTerm)) {
        suggestions.add(plant);
      }
      const detail = safePlantDetails[plant] || {};
      if (detail.family?.toLowerCase().includes(lowerCaseSearchTerm) ||
          detail.family?.toLowerCase().includes(katakanaSearchTerm)) {
        suggestions.add(detail.family);
      }
      if (detail.genus?.toLowerCase().includes(lowerCaseSearchTerm) ||
          detail.genus?.toLowerCase().includes(katakanaSearchTerm)) {
        suggestions.add(detail.genus);
      }
      if (Array.isArray(detail.aliases)) {
        detail.aliases.forEach(a => {
          if (!a) return;
          const lower = a.toLowerCase();
          if (lower.includes(lowerCaseSearchTerm) || lower.includes(katakanaSearchTerm)) {
            suggestions.add(a);
          }
        });
      }
    });
    return Array.from(suggestions).slice(0, 10);
  }, [safeHostPlants, safePlantDetails, plantSearchTerm]);

  const totalPages = Math.ceil(filteredHostPlants.length / itemsPerPage);
  const currentHostPlants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredHostPlants.slice(startIndex, endIndex);
  }, [filteredHostPlants, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedPlantSearch]);

  return (
    <div className={embedded ? "" : "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden"}>
      {!embedded && (
        <div className="p-6 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-emerald-200/30 dark:border-emerald-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              食草リスト
            </h2>
          </div>
          <SearchInput 
            placeholder="食草を検索" 
            value={plantSearchTerm} 
            onChange={(e) => setPlantSearchTerm(e.target.value)} 
            suggestions={plantNameSuggestions}
            onSelectSuggestion={setPlantSearchTerm}
          />
        </div>
      )}
      
      {embedded && (
        <div className="p-6">
          <SearchInput 
            placeholder="食草を検索" 
            value={plantSearchTerm} 
            onChange={(e) => setPlantSearchTerm(e.target.value)} 
            suggestions={plantNameSuggestions}
            onSelectSuggestion={setPlantSearchTerm}
          />
        </div>
      )}
      
      <div className="p-6">
        <div className="max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-300 scrollbar-track-emerald-100 dark:scrollbar-thumb-emerald-600 dark:scrollbar-track-emerald-900/20">
          {currentHostPlants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentHostPlants.map(([plant, mothList], index) => (
                <div key={plant} className="animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                  <HostPlantListItem plant={plant} mothNames={mothList} plantDetails={safePlantDetails} plantImageFilenames={plantImageFilenames} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 font-medium">結果が見つかりませんでした</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">別のキーワードで検索してみてください</p>
            </div>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30 overflow-x-hidden">
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

export default HostPlantList;
