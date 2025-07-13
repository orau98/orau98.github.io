import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';

const HostPlantListItem = ({ plant, mothNames }) => {
  // Check if plant image exists
  const [imageExists, setImageExists] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Create safe filename for plant image
  const createSafePlantFilename = (plantName) => {
    if (!plantName) return '';
    // Remove family annotations and special characters
    let cleanedName = plantName.replace(/（[^）]*科[^）]*）/g, '');
    cleanedName = cleanedName.replace(/\([^)]*科[^)]*\)/g, '');
    cleanedName = cleanedName.replace(/科$/g, ''); // Remove trailing '科'
    cleanedName = cleanedName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
    return cleanedName;
  };
  
  const safePlantName = createSafePlantFilename(plant);
  const [plantImageUrl, setPlantImageUrl] = React.useState('');
  
  React.useEffect(() => {
    // Check for plant images with various naming patterns
    const checkImageExists = async (urls) => {
      for (const url of urls) {
        try {
          const img = new Image();
          const imageExists = await new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
          });
          
          if (imageExists) {
            setPlantImageUrl(url);
            setImageExists(true);
            setImageLoaded(true);
            return;
          }
        } catch (error) {
          console.log(`Failed to load image: ${url}`);
        }
      }
      
      // No images found
      setImageExists(false);
      setImageError(true);
    };

    // Try multiple filename patterns
    const baseUrl = `${import.meta.env.BASE_URL}images/plants/${safePlantName}`;
    const extensions = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG'];
    const descriptiveSuffixes = ['', '_実', '_葉', '_樹皮', '_花', '_果実', '_葉表', '_葉裏', '_羽状複葉', '_枝', '_全体'];
    
    const urlsToTry = [];
    
    // Generate all possible combinations
    for (const suffix of descriptiveSuffixes) {
      for (const ext of extensions) {
        urlsToTry.push(`${baseUrl}${suffix}.${ext}`);
      }
    }
    
    checkImageExists(urlsToTry);
  }, [safePlantName]);

  return (
  <li className="group relative overflow-hidden rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 hover:border-teal-300 dark:hover:border-teal-500 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/20 hover:scale-[1.02] transform">
    <Link to={`/plant/${encodeURIComponent(plant)}`} className="block">
      <div className="flex flex-col">
        {/* Enhanced Plant Image/Icon section */}
        <div className="w-full h-40 relative overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-800 dark:to-teal-800">
          {imageExists ? (
            // Actual plant image
            <img
              src={plantImageUrl}
              alt={plant}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            // Fallback to beautiful plant icon
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                {/* Beautiful plant icon */}
                <svg className="w-20 h-20 text-emerald-600 dark:text-emerald-400 mx-auto mb-2 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M12,4A1,1 0 0,0 11,5V11A1,1 0 0,0 12,12A1,1 0 0,0 13,11V5A1,1 0 0,0 12,4M12,14.5L16,18.5L12,22.5L8,18.5L12,14.5Z"/>
                </svg>
                <div className="px-3 py-1 bg-emerald-500/20 rounded-full backdrop-blur-sm">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">植物</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading state for images */}
          {!imageLoaded && imageExists && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-900/40 dark:to-teal-900/40">
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
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-500/90 text-white backdrop-blur-sm shadow-sm">
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
          <div className="mb-3">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2 leading-tight">
              {plant}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 flex-shrink-0">
                🐛 昆虫
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

const HostPlantList = ({ hostPlants, plantDetails, embedded = false }) => {
  console.log("HostPlantList props:", { hostPlants, plantDetails });
  const [plantSearchTerm, setPlantSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedPlantSearch = useDebounce(plantSearchTerm, 300);

  const safePlantDetails = plantDetails || {};
  const filteredHostPlants = useMemo(() => {
    console.log("Inside filteredHostPlants useMemo. hostPlants:", hostPlants, "plantDetails:", plantDetails);
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    const filtered = Object.entries(hostPlants).filter(([plantName]) => {
      console.log("Filtering plant:", plantName, "Details:", safePlantDetails[plantName]);
      const detail = safePlantDetails[plantName];
      const family = detail && detail.family ? detail.family.toLowerCase() : '';
      const genus = detail && detail.genus ? detail.genus.toLowerCase() : '';
      return plantName.toLowerCase().includes(lowerCaseSearchTerm) ||
             family.includes(lowerCaseSearchTerm) ||
             genus.includes(lowerCaseSearchTerm);
    });
    
    // Sort with plants with images first, then "不明" at the end
    return filtered.sort(([a], [b]) => {
      // Helper function to check if plant image exists
      const createSafePlantFilename = (plantName) => {
        if (!plantName) return '';
        let cleanedName = plantName.replace(/（[^）]*科[^）]*）/g, '');
        cleanedName = cleanedName.replace(/\([^)]*科[^)]*\)/g, '');
        cleanedName = cleanedName.replace(/科$/g, '');
        cleanedName = cleanedName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
        return cleanedName;
      };
      
      // Check if images exist (this is a simple heuristic, actual check happens in component)
      const aHasImage = createSafePlantFilename(a) && a !== '不明' && !a.endsWith('科');
      const bHasImage = createSafePlantFilename(b) && b !== '不明' && !b.endsWith('科');
      
      // Sort priority: images first, then regular plants, then "不明" last
      if (a === '不明') return 1;
      if (b === '不明') return -1;
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return a.localeCompare(b, 'ja');
    });
  }, [hostPlants, plantDetails, debouncedPlantSearch]);

  const plantNameSuggestions = useMemo(() => {
    if (!plantSearchTerm) return [];
    const lowerCaseSearchTerm = plantSearchTerm.toLowerCase();
    const suggestions = new Set();
    Object.keys(hostPlants).forEach(plant => {
      if (plant.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(plant);
      }
      const detail = plantDetails[plant] || {};
      if (detail.family?.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(detail.family);
      }
      if (detail.genus?.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(detail.genus);
      }
    });
    return Array.from(suggestions).slice(0, 10);
  }, [hostPlants, plantDetails, plantSearchTerm]);

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
        <div className="p-6 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 dark:from-teal-500/20 dark:to-emerald-500/20 border-b border-teal-200/30 dark:border-teal-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
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
        <div className="max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-teal-300 scrollbar-track-teal-100 dark:scrollbar-thumb-teal-600 dark:scrollbar-track-teal-900/20">
          {currentHostPlants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentHostPlants.map(([plant, mothList], index) => (
                <div key={plant} className="animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                  <HostPlantListItem plant={plant} mothNames={mothList} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">結果が見つかりませんでした</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">別のキーワードで検索してみてください</p>
            </div>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-teal-200/30 dark:border-teal-700/30">
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