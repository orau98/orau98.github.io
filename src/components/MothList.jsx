import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import EmergenceTimeDisplay from './EmergenceTimeDisplay';
import { extractEmergenceTime, normalizeEmergenceTime } from '../utils/emergenceTimeUtils';

const MothListItem = ({ moth, baseRoute = "/moth", isPriority = false, imageFilenames = new Set(), imageExtensions = {} }) => {
  const [isVisible, setIsVisible] = useState(isPriority);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef(null);

  const handleIntersection = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && !isVisible) {
      setIsVisible(true);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isPriority) return; // Skip observer for priority images
    
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
      rootMargin: '200px' // Increased preload distance for better perceived performance
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
    // Debug log for specific species
    const isDebugTarget = moth.name === 'ルイスヒラタチビタマムシ';
    
    if (isDebugTarget) {
      console.log('DEBUG: ルイスヒラタチビタマムシ image filename detection:', {
        mothName: moth.name,
        scientificName: moth.scientificName,
        scientificFilename: moth.scientificFilename,
        imageFilenamesSize: imageFilenames.size,
        imageFilenamesLoaded: imageFilenames.size > 0
      });
    }
    
    // If imageFilenames is not loaded yet, use default
    if (!imageFilenames || imageFilenames.size === 0) {
      if (isDebugTarget) {
        console.log('DEBUG: ルイスヒラタチビタマムシ - imageFilenames not loaded, using default');
      }
      return moth.scientificFilename || createSafeFilename(moth.scientificName);
    }
    
    // 1. Try scientific filename directly
    if (moth.scientificFilename && imageFilenames.has(moth.scientificFilename)) {
      if (isDebugTarget) {
        console.log('DEBUG: ルイスヒラタチビタマムシ - found with scientificFilename:', moth.scientificFilename);
      }
      return moth.scientificFilename;
    }
    
    // 2. Try generated safe filename
    const safeFilename = createSafeFilename(moth.scientificName);
    if (isDebugTarget) {
      console.log('DEBUG: ルイスヒラタチビタマムシ - generated safeFilename:', safeFilename);
    }
    if (imageFilenames.has(safeFilename)) {
      if (isDebugTarget) {
        console.log('DEBUG: ルイスヒラタチビタマムシ - found with safeFilename:', safeFilename);
      }
      return safeFilename;
    }
    
    // 3. Try Japanese name directly
    if (isDebugTarget) {
      console.log('DEBUG: ルイスヒラタチビタマムシ - checking Japanese name directly:', moth.name);
      console.log('DEBUG: ルイスヒラタチビタマムシ - imageFilenames.has(moth.name):', imageFilenames.has(moth.name));
    }
    if (imageFilenames.has(moth.name)) {
      if (isDebugTarget) {
        console.log('DEBUG: ルイスヒラタチビタマムシ - found with Japanese name:', moth.name);
      }
      return moth.name;
    }
    
    // 4. Try to find any filename containing the Japanese name
    if (isDebugTarget) {
      console.log('DEBUG: ルイスヒラタチビタマムシ - searching for filenames containing:', moth.name);
      console.log('DEBUG: ルイスヒラタチビタマムシ - first 10 imageFilenames:', Array.from(imageFilenames).slice(0, 10));
      console.log('DEBUG: ルイスヒラタチビタマムシ - last 10 imageFilenames:', Array.from(imageFilenames).slice(-10));
      console.log('DEBUG: ルイスヒラタチビタマムシ - target string chars:', moth.name.split('').map(c => `${c}(${c.charCodeAt(0)})`));
      
      // Check if the specific filename exists
      const targetFilename = 'ルイスヒラタチビタマムシ (3)';
      console.log('DEBUG: ルイスヒラタチビタマムシ - target filename exists:', imageFilenames.has(targetFilename));
      console.log('DEBUG: ルイスヒラタチビタマムシ - target filename chars:', targetFilename.split('').map(c => `${c}(${c.charCodeAt(0)})`));
      
      // Manual search for debugging
      let foundMatches = [];
      for (const filename of imageFilenames) {
        if (filename.includes('ルイス')) {
          foundMatches.push(filename);
        }
      }
      console.log('DEBUG: ルイスヒラタチビタマムシ - files containing "ルイス":', foundMatches);
    }
    for (const filename of imageFilenames) {
      if (filename.includes(moth.name)) {
        if (isDebugTarget) {
          console.log('DEBUG: ルイスヒラタチビタマムシ - found containing filename:', filename);
        }
        return filename;
      }
    }
    
    // 5. Try to find any filename containing the scientific name parts
    if (moth.scientificName) {
      const scientificParts = moth.scientificName.split(' ').slice(0, 2).join(' ');
      if (isDebugTarget) {
        console.log('DEBUG: ルイスヒラタチビタマムシ - searching for scientific parts:', scientificParts);
      }
      for (const filename of imageFilenames) {
        if (filename.includes(scientificParts)) {
          if (isDebugTarget) {
            console.log('DEBUG: ルイスヒラタチビタマムシ - found with scientific parts:', filename);
          }
          return filename;
        }
      }
    }
    
    // Default to safe filename
    if (isDebugTarget) {
      console.log('DEBUG: ルイスヒラタチビタマムシ - no match found, using default safeFilename:', safeFilename);
    }
    return safeFilename;
  };
  
  const imageFilename = getImageFilename();
  
  // Determine the correct file extension using the extensions mapping
  let imageExtension = '.jpg'; // default
  if (imageExtensions && imageExtensions[imageFilename]) {
    imageExtension = imageExtensions[imageFilename];
  }
  
  // Determine the correct image folder based on insect type
  const imageFolder = moth.type === 'butterfly' ? 'butterflies' : 
                     moth.type === 'beetle' ? 'beetles' : 
                     moth.type === 'leafbeetle' ? 'leafbeetles' : 'insects';
  
  const imageUrl = `${import.meta.env.BASE_URL}images/${imageFolder}/${encodeURIComponent(imageFilename)}${imageExtension}`;
  
  // Check if we have an actual match in imageFilenames
  const hasImageFilename = imageFilenames.size > 0 ? imageFilenames.has(imageFilename) : true;
  
  // Debug log for specific species
  if (moth.name === 'ルイスヒラタチビタマムシ' || moth.name === 'アオマダラタマムシ') {
    console.log(`DEBUG: ${moth.name} final image check:`, {
      selectedImageFilename: imageFilename,
      imageUrl: imageUrl,
      hasImageFilename: hasImageFilename,
      imageFilenamesContainsSelectedFilename: imageFilenames.has(imageFilename),
      encodedImageFilename: encodeURIComponent(imageFilename),
      type: moth.type,
      imageFolder: imageFolder,
      imageExtension: imageExtension
    });
  }
  
  // Preload priority images
  useEffect(() => {
    if (isPriority && hasImageFilename) {
      const img = new Image();
      img.src = imageUrl;
    }
  }, [isPriority, hasImageFilename, imageUrl]);
    
  return (
    <li ref={imgRef} className="group relative overflow-hidden rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] transform shadow-md list-none">
      <Link to={route} className="block">
        <div className="flex flex-col h-full">
          {/* Enhanced Image section - full card width */}
          <div className="w-full relative overflow-hidden rounded-t-[10px] -mx-[2px] -mt-[2px]">
            {hasImageFilename ? (
              <div className="relative w-full aspect-[4/3]">
                {isVisible ? (
                  <img
                    src={imageUrl}
                    alt={`${moth.name}（${moth.scientificName}）の写真`}
                    className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ 
                      imageRendering: 'crisp-edges',
                      willChange: imageLoaded ? 'auto' : 'opacity'
                    }}
                    loading={isPriority ? "eager" : "lazy"}
                    decoding="async"
                    fetchpriority={isPriority ? "high" : "auto"}
                    onLoad={() => setImageLoaded(true)}
                    onError={(e) => {
                      // Try fallback paths for beetles in insects directory
                      if ((moth.type === 'beetle' || moth.type === 'leafbeetle') && !e.target.dataset.fallbackAttempted) {
                        e.target.dataset.fallbackAttempted = 'true';
                        const fallbackUrl = `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(imageFilename)}${imageExtension}`;
                        e.target.src = fallbackUrl;
                      } else {
                        e.target.style.display = 'none';
                        e.target.parentElement.nextSibling.style.display = 'flex';
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
                  <h3 className="text-white font-bold text-lg mb-1 drop-shadow-lg">
                    {moth.name}
                  </h3>
                  <p className="text-white/90 text-sm drop-shadow-md">
                    {formatScientificNameReact(moth.scientificName)}
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
                  <h3 className="text-slate-800 dark:text-slate-200 font-bold text-lg mb-2 leading-tight">
                    {moth.name}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    {formatScientificNameReact(moth.scientificName)}
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
              <div className="flex items-start space-x-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 flex-shrink-0">
                  食草
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {moth.hostPlants.length > 0 ? moth.hostPlants.join(', ') : '不明'}
                </span>
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

  const filteredMoths = useMemo(() => {
    console.log('DEBUG: Filtering moths, total count:', moths.length, 'search term:', debouncedSearchTerm);
    return moths.filter(moth => {
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
    });
  }, [moths, debouncedSearchTerm, classificationFilter]);

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

  // Load image filenames list for lightweight sorting
  const [imageFilenames, setImageFilenames] = useState(new Set());
  const [imageExtensions, setImageExtensions] = useState({});
  
  useEffect(() => {
    const loadImageData = async () => {
      try {
        // Load filenames
        const filenamesResponse = await fetch(`${import.meta.env.BASE_URL}image_filenames.txt`);
        const filenamesText = await filenamesResponse.text();
        const filenames = new Set(filenamesText.trim().split('\n').filter(Boolean));
        setImageFilenames(filenames);
        
        // Load extension mapping
        try {
          const extensionsResponse = await fetch(`${import.meta.env.BASE_URL}image_extensions.json`);
          const extensionsData = await extensionsResponse.json();
          setImageExtensions(extensionsData);
          console.log('Loaded image extensions:', Object.keys(extensionsData).length, 'files');
        } catch (extError) {
          console.debug('Could not load image extensions mapping:', extError);
        }
        
        console.log('Loaded image filenames:', filenames.size, 'files');
        console.log('Has Cryphia_mitsuhashi:', filenames.has('Cryphia_mitsuhashi'));
        console.log('First 10 filenames:', Array.from(filenames).slice(0, 10));
      } catch (error) {
        console.debug('Could not load image filenames:', error);
      }
    };
    loadImageData();
  }, []);

  // Sort moths to prioritize those with images (lightweight)
  const sortedMoths = useMemo(() => {
    if (imageFilenames.size === 0) {
      console.log('No image filenames loaded yet, returning unsorted');
      return filteredMoths;
    }
    
    const sorted = [...filteredMoths].sort((a, b) => {
      // Create safe filename check function - must match the logic in generate-meta-pages.js
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
      const filenameA = a.scientificFilename || createSafeFilename(a.scientificName);
      const filenameB = b.scientificFilename || createSafeFilename(b.scientificName);
      
      const hasImageA = imageFilenames.has(filenameA);
      const hasImageB = imageFilenames.has(filenameB);
      
      // Debug logging for specific moths
      const debugMoths = ['キノコヨトウ', 'キグチヨトウ', 'アズサキリガ', 'イセキリガ', 'クモガタキリガ', 'ヒロバモクメキリガ', 'ベニモントガリホソガ'];
      if (debugMoths.includes(a.name) || debugMoths.includes(b.name)) {
        const targetMoth = debugMoths.find(moth => a.name === moth || b.name === moth);
        console.log(`Sorting ${targetMoth}:`, {
          mothA: a.name,
          mothB: b.name,
          filenameA,
          filenameB,
          hasImageA,
          hasImageB,
          scientificFilenameA: a.scientificFilename,
          scientificFilenameB: b.scientificFilename,
          scientificNameA: a.scientificName,
          scientificNameB: b.scientificName,
          imageFilenamesSize: imageFilenames.size,
          imageFilenamesHasPseudopanolis: imageFilenames.has('Pseudopanolis_azusa'),
          imageFilenamesHasAgrochola: imageFilenames.has('Agrochola_sakabei'),
          imageFilenamesHasLabdia: imageFilenames.has('Labdia_semicoccinea')
        });
      }
      
      // Priority: Images first, then others
      if (hasImageA && !hasImageB) return -1;
      if (!hasImageA && hasImageB) return 1;
      
      // If both have images or both don't, sort alphabetically by name
      return a.name.localeCompare(b.name, 'ja');
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
      return imageFilenames.has(m.scientificFilename || createSafeFilename(m.scientificName));
    });
    
    // Log the first few sorted moths to see if images are prioritized
    console.log(`Image prioritization: ${mothsWithImages.length} moths have images out of ${sorted.length} total`);
    console.log('First 20 sorted moths:', sorted.slice(0, 20).map(m => {
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
  }, [filteredMoths, imageFilenames]);

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
                  <MothListItem 
                    moth={moth} 
                    baseRoute={baseRoute} 
                    isPriority={index < 12} 
                    imageFilenames={imageFilenames}
                    imageExtensions={imageExtensions}
                  />
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