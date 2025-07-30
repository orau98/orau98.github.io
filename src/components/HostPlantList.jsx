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
    const response = await fetch(`${import.meta.env.BASE_URL}plant_image_filenames.txt`);
    if (response.ok) {
      const text = await response.text();
      plantImageFilenames = text.split('\n')
        .map(line => line.trim())
        .filter(line => line);
      plantImageFilenamesLoaded = true;
    }
  } catch (error) {
    console.error('植物画像リストの読み込みに失敗しました:', error);
  }
  
  return plantImageFilenames;
};

const HostPlantListItem = ({ plant, mothNames, plantDetails = {}, plantImageFilenames: preloadedFilenames = [] }) => {
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
        const matches = preloadedFilenames.filter(filename => {
          // Extract the base name from the filename (part before underscore)
          const filenameBase = filename.split('_')[0];
          
          // First, try exact match with safePlantName
          if (filenameBase === safePlantName) {
            return true;
          }
          // Also try with original plant name (first part before space)
          const basePlantName = plant.split(' ')[0];
          const baseNameCleaned = createSafePlantFilename(basePlantName);
          // Use exact match to avoid "タケ" matching "タケニグサ"
          return filenameBase === basePlantName || filenameBase === baseNameCleaned;
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
      
      if (matchingImage) {
        // Find the appropriate extension
        const baseUrl = `${import.meta.env.BASE_URL}images/plants/`;
        const extensions = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG'];
        
        // Try each extension to find the actual file
        for (const ext of extensions) {
          const url = `${baseUrl}${matchingImage}.${ext}`;
          const img = new Image();
          img.onload = () => {
            setImageExists(true);
            setPlantImageUrl(url);
            setImageLoaded(true);
          };
          img.onerror = () => {
            // Try next extension if current one fails
          };
          img.src = url;
          break; // Only try first matching pattern for now
        }
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
                alt={plant}
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {/* Plant name overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                <h3 className="text-white font-bold text-lg drop-shadow-lg">
                  {plant}
                </h3>
              </div>
            </div>
          ) : (
            // Fallback to beautiful plant icon with better layout
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-800 dark:to-emerald-900 flex flex-col items-center justify-center p-6">
              {/* Plant icon at top */}
              <div className="flex-shrink-0 mb-4">
                <svg className="w-16 h-16 text-emerald-600 dark:text-emerald-400 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M12,4A1,1 0 0,0 11,5V11A1,1 0 0,0 12,12A1,1 0 0,0 13,11V5A1,1 0 0,0 12,4M12,14.5L16,18.5L12,22.5L8,18.5L12,14.5Z"/>
                </svg>
              </div>
              
              {/* Plant name displayed prominently in center */}
              <div className="text-center flex-1 flex flex-col justify-center">
                <h3 className="text-emerald-800 dark:text-emerald-200 font-bold text-lg leading-tight mb-2">
                  {plant}
                </h3>
                {plantDetails[plant]?.familyName && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                    {plantDetails[plant].familyName}
                  </p>
                )}
              </div>
              
              {/* Plant indicator at bottom */}
              <div className="flex-shrink-0 mt-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-300/70 dark:bg-emerald-600/70 text-emerald-800 dark:text-emerald-200 border border-emerald-400/30 dark:border-emerald-500/30">
                  植物図鑑
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
          
          {/* Image indicator badge */}
          {imageExists && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/90 text-white backdrop-blur-sm shadow-sm">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                </svg>
                画像あり
              </span>
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
};

const HostPlantList = ({ hostPlants = {}, plantDetails = {}, embedded = false }) => {
  const [plantSearchTerm, setPlantSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [plantImageFilenames, setPlantImageFilenames] = useState([]);
  const itemsPerPage = 50;

  // Load plant image filenames on component mount
  useEffect(() => {
    loadPlantImageFilenames().then(filenames => {
      setPlantImageFilenames(filenames);
    });
  }, []);

  const debouncedPlantSearch = useDebounce(plantSearchTerm, 300);

  const safeHostPlants = hostPlants || {};
  const safePlantDetails = plantDetails || {};
  const filteredHostPlants = useMemo(() => {
    console.log('DEBUG: Filtering plants, total count:', Object.keys(safeHostPlants).length, 'search term:', debouncedPlantSearch);
    if (!safeHostPlants || Object.keys(safeHostPlants).length === 0) {
      console.log('DEBUG: No host plants available');
      return [];
    }
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    const filtered = Object.entries(safeHostPlants).filter(([plantName]) => {
      console.log("Filtering plant:", plantName, "Details:", safePlantDetails[plantName]);
      const detail = safePlantDetails[plantName] || {};
      const family = detail.family ? detail.family.toLowerCase() : '';
      const genus = detail.genus ? detail.genus.toLowerCase() : '';
      return plantName.toLowerCase().includes(lowerCaseSearchTerm) ||
             family.includes(lowerCaseSearchTerm) ||
             genus.includes(lowerCaseSearchTerm);
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
        const safeName = createSafePlantFilename(plantName);
        const baseName = plantName.split(' ')[0];
        const baseNameCleaned = createSafePlantFilename(baseName);
        return plantImageFilenames.some(filename => {
          // Extract the base name from the filename (part before underscore)
          const filenameBase = filename.split('_')[0];
          // Use exact match to avoid "タケ" matching "タケニグサ"
          return filenameBase === safeName || filenameBase === baseName || filenameBase === baseNameCleaned;
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

  const plantNameSuggestions = useMemo(() => {
    if (!plantSearchTerm) return [];
    const lowerCaseSearchTerm = plantSearchTerm.toLowerCase();
    const suggestions = new Set();
    Object.keys(safeHostPlants).forEach(plant => {
      if (plant.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(plant);
      }
      const detail = safePlantDetails[plant] || {};
      if (detail.family?.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(detail.family);
      }
      if (detail.genus?.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(detail.genus);
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
            <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
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
          <div className="mt-6 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
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