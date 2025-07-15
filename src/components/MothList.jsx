import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';
import { formatScientificName } from '../utils/scientificNameFormatter.jsx';

const MothListItem = ({ moth, baseRoute = "/moth" }) => {
  // Determine the correct route based on insect type
  const route = baseRoute === "" ? 
    (moth.type === 'butterfly' ? `/butterfly/${moth.id}` : 
     moth.type === 'beetle' ? `/beetle/${moth.id}` : 
     moth.type === 'leafbeetle' ? `/leafbeetle/${moth.id}` : `/moth/${moth.id}`) : 
    `${baseRoute}/${moth.id}`;
  
  // Check if image exists for this moth
  const [imageExists, setImageExists] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
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
  
  const safeFilename = moth.scientificFilename || createSafeFilename(moth.scientificName);
  const imageUrl = `${import.meta.env.BASE_URL}images/moths/${safeFilename}.jpg`;
  
  React.useEffect(() => {
    // Check if image exists
    const img = new Image();
    img.onload = () => {
      setImageExists(true);
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageExists(false);
      setImageError(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);
    
  return (
    <li className="group relative overflow-hidden rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] transform">
      <Link to={route} className="block">
        <div className="flex flex-col">
          {/* Enhanced Image section - much larger and more prominent */}
          <div className="w-full h-48 relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
            {imageExists ? (
              <img
                src={imageUrl}
                alt={`${moth.name}（${moth.scientificName}）の写真`}
                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-slate-500 dark:text-slate-400">画像なし</p>
                </div>
              </div>
            )}
            {!imageLoaded && imageExists && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 dark:bg-blue-900/40">
                <div className="relative">
                  <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-700 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            )}
            {imageExists && (
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/90 text-white backdrop-blur-sm shadow-sm">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                  </svg>
                  画像あり
                </span>
              </div>
            )}
            
            {/* Gradient overlay for better text readability */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/50 to-transparent"></div>
            
            {/* Type badge on image */}
            <div className="absolute bottom-2 left-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm shadow-sm ${
                moth.type === 'butterfly' ? 'bg-orange-500/90 text-white' : 
                moth.type === 'beetle' ? 'bg-emerald-500/90 text-white' :
                moth.type === 'leafbeetle' ? 'bg-amber-500/90 text-white' :
                'bg-blue-500/90 text-white'
              }`}>
                {moth.type === 'butterfly' ? '🦋 蝶' : 
                 moth.type === 'beetle' ? '🪲 甲虫' : 
                 moth.type === 'leafbeetle' ? '🐛 ハムシ' : '🦋 蛾'}
              </span>
            </div>
          </div>
          
          {/* Enhanced Content section */}
          <div className="p-4">
            <div className="mb-2">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                {moth.name}
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-1 italic">
              {formatScientificName(moth.scientificName)}
            </p>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 flex-shrink-0">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  食草
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {moth.hostPlants.length > 0 ? moth.hostPlants.join(', ') : '不明'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
};

const MothList = ({ moths, title = "蛾", baseRoute = "/moth", embedded = false }) => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const classificationFilter = searchParams.get('classification');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Set initial search term from URL parameter
  useEffect(() => {
    if (classificationFilter && !searchTerm) {
      setSearchTerm(classificationFilter);
    }
  }, [classificationFilter, searchTerm]);

  const filteredMoths = useMemo(() => moths.filter(moth => {
    const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
    
    // If there's a classification filter from URL, prioritize that
    if (classificationFilter && !debouncedSearchTerm) {
      const lowerClassification = classificationFilter.toLowerCase();
      return (moth.classification.familyJapanese?.toLowerCase().includes(lowerClassification)) ||
             (moth.classification.subfamilyJapanese?.toLowerCase().includes(lowerClassification)) ||
             (moth.classification.tribeJapanese?.toLowerCase().includes(lowerClassification)) ||
             (moth.classification.genus?.toLowerCase().includes(lowerClassification)) ||
             (moth.classification.family?.toLowerCase().includes(lowerClassification)) ||
             (moth.classification.subfamily?.toLowerCase().includes(lowerClassification)) ||
             (moth.classification.tribe?.toLowerCase().includes(lowerClassification));
    }
    
    // Regular search filtering
    return moth.name.toLowerCase().includes(lowerCaseSearchTerm) ||
           (moth.scientificName?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.familyJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.subfamilyJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.tribeJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.genus?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.family?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.subfamily?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.tribe?.toLowerCase().includes(lowerCaseSearchTerm));
  }), [moths, debouncedSearchTerm, classificationFilter]);

  const allSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const uniqueSuggestions = new Set();

    moths.forEach(moth => {
      if (moth.name.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.name);
      if (moth.scientificName && moth.scientificName.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.scientificName);
      if (moth.classification.familyJapanese && moth.classification.familyJapanese.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.familyJapanese);
      if (moth.classification.subfamilyJapanese && moth.classification.subfamilyJapanese.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.subfamilyJapanese);
      if (moth.classification.tribeJapanese && moth.classification.tribeJapanese.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.tribeJapanese);
      if (moth.classification.genus && moth.classification.genus.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.genus);
    });
    return Array.from(uniqueSuggestions).slice(0, 10);
  }, [moths, searchTerm]);

  // Keep track of which images actually exist
  const [imageExistenceCache, setImageExistenceCache] = useState({});
  
  // Create safe filename function
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
  
  // Function to check if an image actually exists
  const checkImageExists = React.useCallback((moth) => {
    return new Promise((resolve) => {
      const safeFilename = moth.scientificFilename || createSafeFilename(moth.scientificName);
      const imageUrl = `${import.meta.env.BASE_URL}images/moths/${safeFilename}.jpg`;
      
      // Check cache first
      if (imageExistenceCache[imageUrl] !== undefined) {
        resolve(imageExistenceCache[imageUrl]);
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        setImageExistenceCache(prev => ({ ...prev, [imageUrl]: true }));
        resolve(true);
      };
      img.onerror = () => {
        setImageExistenceCache(prev => ({ ...prev, [imageUrl]: false }));
        resolve(false);
      };
      img.src = imageUrl;
    });
  }, [imageExistenceCache]);

  // Sort moths to prioritize those with images
  const sortedMoths = useMemo(() => {
    return [...filteredMoths].sort((a, b) => {
      // Check if species has an Instagram post (considered as having image)
      const hasInstagramA = a.instagramUrl && a.instagramUrl.trim();
      const hasInstagramB = b.instagramUrl && b.instagramUrl.trim();
      
      // Check if species has a static image file that actually exists
      const safeFilenameA = a.scientificFilename || createSafeFilename(a.scientificName);
      const safeFilenameB = b.scientificFilename || createSafeFilename(b.scientificName);
      const imageUrlA = `${import.meta.env.BASE_URL}images/moths/${safeFilenameA}.jpg`;
      const imageUrlB = `${import.meta.env.BASE_URL}images/moths/${safeFilenameB}.jpg`;
      
      const hasStaticImageA = imageExistenceCache[imageUrlA] === true;
      const hasStaticImageB = imageExistenceCache[imageUrlB] === true;
      
      // Priority: Instagram posts first, then static images, then others
      const scoreA = (hasInstagramA ? 100 : 0) + (hasStaticImageA ? 10 : 0);
      const scoreB = (hasInstagramB ? 100 : 0) + (hasStaticImageB ? 10 : 0);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }
      
      // If scores are equal, sort alphabetically by name
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [filteredMoths, imageExistenceCache]);

  const totalPages = Math.ceil(sortedMoths.length / itemsPerPage);
  const currentMoths = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedMoths.slice(startIndex, endIndex);
  }, [sortedMoths, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Pre-load image existence for visible moths
  React.useEffect(() => {
    const checkImagesForMoths = async () => {
      const promises = currentMoths.map(moth => checkImageExists(moth));
      await Promise.all(promises);
    };
    
    if (currentMoths.length > 0) {
      checkImagesForMoths();
    }
  }, [currentMoths, checkImageExists]);

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
              <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
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
              {currentMoths.map((moth, index) => (
                <div key={moth.id} className="animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                  <MothListItem moth={moth} baseRoute={baseRoute} />
                </div>
              ))}
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
          <div className="mt-6 pt-4 border-t border-blue-200/30 dark:border-blue-700/30">
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