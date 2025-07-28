import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';
import { getSourceLink } from './utils/sourceLinks';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { MothStructuredData, ButterflyStructuredData, LeafBeetleStructuredData, BeetleStructuredData } from './components/StructuredData';
import EmergenceTimeDisplay from './components/EmergenceTimeDisplay';
import { extractEmergenceTime, normalizeEmergenceTime } from './utils/emergenceTimeUtils';

const MothDetail = ({ moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants }) => {
  const { mothId, butterflyId, beetleId, leafbeetleId } = useParams();
  const insectId = mothId || butterflyId || beetleId || leafbeetleId;
  
  // Combine all insects for searching
  const allInsects = [...moths, ...butterflies, ...beetles, ...leafbeetles];
  const moth = allInsects.find(m => m.id === insectId);
  
  // Debug logging for catalog-6065 (スミレモンキリガ)
  if (insectId === 'catalog-6065') {
    console.log('DEBUG catalog-6065: Found moth:', moth);
    if (moth) {
      console.log('DEBUG catalog-6065: hostPlants:', moth.hostPlants);
      console.log('DEBUG catalog-6065: hostPlantDetails:', moth.hostPlantDetails);
      // Log the actual plant names
      if (moth.hostPlants && moth.hostPlants.length > 0) {
        moth.hostPlants.forEach((plant, index) => {
          console.log(`DEBUG catalog-6065: hostPlant[${index}] = "${plant}"`);
        });
      }
      if (moth.hostPlantDetails && moth.hostPlantDetails.length > 0) {
        moth.hostPlantDetails.forEach((detail, index) => {
          console.log(`DEBUG catalog-6065: hostPlantDetail[${index}] = `, detail);
        });
      }
    }
  }
  
  // Debug logging for センモンヤガ
  if (insectId === 'catalog-3489' || insectId === 'main-6519') {
    console.log('DEBUG: Looking for センモンヤガ with ID:', insectId);
    console.log('DEBUG: Found moth:', moth);
    if (moth) {
      console.log('DEBUG: センモンヤガ hostPlants:', moth.hostPlants);
      console.log('DEBUG: センモンヤガ hostPlantDetails:', moth.hostPlantDetails);
    }
  }
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // SEO optimization: Update page title and meta tags
  useEffect(() => {
    if (moth) {
      const insectType = moth.type === 'butterfly' ? '蝶' : moth.type === 'beetle' ? 'タマムシ' : moth.type === 'leafbeetle' ? 'ハムシ' : '蛾';
      const title = `${moth.name} (${moth.scientificName}) | ${insectType}の詳細 - 昆虫食草図鑑`;
      const description = `${moth.name}（${moth.scientificName}）の詳細情報。食草: ${moth.hostPlants.join('、') || '不明'}。昆虫食草図鑑で${insectType}と植物の関係を詳しく学ぼう。`;
      
      document.title = title;
      
      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = description;
      
      // Update OG tags
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.content = title;
      
      let ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) ogDescription.content = description;
      
      // Add structured data for the specific insect
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": moth.name,
        "description": description,
        "author": {
          "@type": "Organization",
          "name": "昆虫食草図鑑"
        },
        "publisher": {
          "@type": "Organization",
          "name": "昆虫食草図鑑"
        },
        "mainEntity": {
          "@type": "Animal",
          "name": moth.name,
          "scientificName": moth.scientificName,
          "classification": moth.classification?.familyJapanese || '不明'
        }
      };
      
      let structuredDataScript = document.querySelector('#insect-structured-data');
      if (!structuredDataScript) {
        structuredDataScript = document.createElement('script');
        structuredDataScript.id = 'insect-structured-data';
        structuredDataScript.type = 'application/ld+json';
        document.head.appendChild(structuredDataScript);
      }
      structuredDataScript.textContent = JSON.stringify(structuredData);
    }
    
    // Cleanup function to restore original title
    return () => {
      document.title = '昆虫食草図鑑 - 蛾と食草の繋がりを探る | 7000種以上の昆虫データベース';
      const structuredDataScript = document.querySelector('#insect-structured-data');
      if (structuredDataScript) {
        structuredDataScript.remove();
      }
    };
  }, [moth]);

  if (!moth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-400 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">昆虫が見つかりません</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">指定されたIDの昆虫は存在しません。</p>
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            リストに戻る
          </Link>
        </div>
      </div>
    );
  }

  // Group related moths by host plant
  const relatedMothsByPlant = {};
  moth.hostPlants.forEach(plant => {
    if (hostPlants[plant]) {
      const relatedMoths = hostPlants[plant].filter(mothName => mothName !== moth.name);
      if (relatedMoths.length > 0) {
        relatedMothsByPlant[plant] = relatedMoths;
      }
    }
  });

  // Also keep the old format for backward compatibility
  const relatedMoths = new Set();
  moth.hostPlants.forEach(plant => {
    if (hostPlants[plant]) {
      hostPlants[plant].forEach(mothName => {
        if (mothName !== moth.name) {
          relatedMoths.add(mothName);
        }
      });
    }
  });

  // Check if Instagram post is available
  const hasInstagramPost = moth.instagramUrl && moth.instagramUrl.trim();
  
  // Create safe filename for static image fallback
  const createSafeFilename = (scientificName) => {
    if (!scientificName) return '';
    let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
    cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
    cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
    // More specific pattern to remove author names - only remove if it's after a binomial name
    cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
    cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
    cleanedName = cleanedName.replace(/\s+/g, '_');
    return cleanedName;
  };

  const safeFilename = moth.scientificFilename || createSafeFilename(moth.scientificName);
  const japaneseName = moth.name;
  
  // Try multiple image paths: scientific name, japanese name
  const possibleImagePaths = [
    `${import.meta.env.BASE_URL}images/moths/${safeFilename}.jpg`,
    `${import.meta.env.BASE_URL}images/moths/${japaneseName}.jpg`
  ];
  
  const staticImagePath = possibleImagePaths[0]; // Default to scientific name
  
  // Debug logging
  console.log('Moth ID:', moth.id);
  console.log('Instagram URL:', moth.instagramUrl);
  console.log('Has Instagram Post:', hasInstagramPost);
  console.log('Static Image Path:', staticImagePath);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    if (currentImageIndex < possibleImagePaths.length - 1) {
      // Try next image path
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      // All paths failed
      setImageLoaded(false);
      setImageError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* 構造化データ */}
      {mothId && moth && <MothStructuredData moth={moth} />}
      {butterflyId && moth && <ButterflyStructuredData butterfly={moth} />}
      {(beetleId || leafbeetleId) && moth && <LeafBeetleStructuredData leafbeetle={moth} />}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-200 shadow-sm hover:shadow-md text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
ホームに戻る
          </Link>
          
          {/* 分類情報をヘッダーに表示 */}
          <div className="flex flex-wrap gap-2">
            {moth.classification.familyJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.familyJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
              >
                <span className="font-medium">{moth.classification.familyJapanese}</span>
                {moth.classification.family && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.family}</span>
                )}
              </Link>
            )}
            {moth.classification.subfamilyJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.subfamilyJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50"
              >
                <span className="font-medium">{moth.classification.subfamilyJapanese}</span>
                {moth.classification.subfamily && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.subfamily}</span>
                )}
              </Link>
            )}
            {moth.classification.tribeJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.tribeJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
              >
                <span className="font-medium">{moth.classification.tribeJapanese}</span>
                {moth.classification.tribe && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.tribe}</span>
                )}
              </Link>
            )}
            {moth.classification.genus && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.genus)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200/50 dark:border-slate-700/50"
              >
                <span className="font-medium italic">{moth.classification.genus}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 画像セクション */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-white/20 dark:border-slate-700/50">
                {hasInstagramPost ? (
                  <div className="p-3">
                    <InstagramEmbed url={moth.instagramUrl} />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] bg-blue-50 dark:bg-blue-900/20 group overflow-hidden">
                    {!imageError ? (
                      <div className="relative h-full w-full">
                        <img 
                          src={possibleImagePaths[currentImageIndex]} 
                          alt={`${moth.name}（${moth.scientificName}）の写真 - ${moth.classification?.familyJapanese || '蛾科'}に属する昆虫`}
                          className={`w-full h-full object-contain transition-all duration-700 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                          onLoad={handleImageLoad}
                          onError={handleImageError}
                        />
                        {/* Elegant gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        {/* Moth name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                          <h3 className="text-white font-bold text-lg drop-shadow-lg">{moth.name}</h3>
                          <p className="text-white/90 text-sm drop-shadow-md">{formatScientificNameReact(moth.scientificName)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <div className="text-center p-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">画像が見つかりません</p>
                          <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">写真をお持ちの場合はご提供ください</p>
                        </div>
                      </div>
                    )}
                    
                    {!imageLoaded && !imageError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 dark:bg-blue-900/40">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-700 rounded-full"></div>
                          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="p-4">
                  {hasInstagramPost && (
                    <div className="flex items-center justify-end mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <InstagramIcon className="w-4 h-4 mr-2" />
                        Instagram
                      </span>
                    </div>
                  )}
                  
                  {hasInstagramPost && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <InstagramIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Instagram投稿
                          </span>
                        </div>
                        <a 
                          href={moth.instagramUrl} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                        >
                          投稿を見る →
                        </a>
                      </div>
                      {moth.instagramDate && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          <span className="font-medium">投稿日:</span> {moth.instagramDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 情報セクション */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* 種名情報 */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden p-6">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
                {moth.name}
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">
                {formatScientificNameReact(moth.scientificName)}
              </p>
            </div>

            {/* 食草情報 */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
              <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-emerald-200/30 dark:border-emerald-700/30">
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    食草
                    {moth.isMonophagous && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        単食性
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              
              <div className="p-4">
                {moth.hostPlants.length > 0 ? (
                  <div className="space-y-4">
                    {/* Display detailed host plant info if available */}
                    {moth.hostPlantDetails && moth.hostPlantDetails.length > 0 ? (
                      <div>
                        {/* Group by condition */}
                        {['自然状態', '飼育条件下', ''].map(condition => {
                          const plantsForCondition = moth.hostPlantDetails.filter(detail => detail.condition === condition);
                          if (plantsForCondition.length === 0) return null;
                          
                          return (
                            <div key={condition} className="mb-4">
                              {condition && (
                                <div className="mb-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    condition === '自然状態' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                  }`}>
                                    {condition}での観察
                                  </span>
                                </div>
                              )}
                              <div className="grid grid-cols-1 gap-2">
                                {plantsForCondition.map((detail, index) => (
                                  <Link
                                    key={`${condition}-${detail.plant}-${index}`}
                                    to={`/plant/${encodeURIComponent(detail.plant)}`}
                                    className="group bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                          {/* Extract plant name and parts from integrated format like "ツバキ（花）" */}
                                          {(() => {
                                            const plantPartsMatch = detail.plant.match(/^(.+?)（([^）]+)）$/);
                                            if (plantPartsMatch) {
                                              const [, plantName, parts] = plantPartsMatch;
                                              return (
                                                <>
                                                  <span className="text-slate-800 dark:text-slate-200 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                                    {plantName}
                                                  </span>
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 ml-2">
                                                    {parts}
                                                  </span>
                                                </>
                                              );
                                            } else {
                                              return (
                                                <span className="text-slate-800 dark:text-slate-200 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                                  {detail.plant}
                                                </span>
                                              );
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Fallback to simple display */
                      <div className="grid grid-cols-1 gap-2">
                        {moth.hostPlants.map((plant, index) => (
                          <Link
                            key={plant}
                            to={`/plant/${encodeURIComponent(plant)}`}
                            className="group bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-3 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  {/* Extract plant name and parts from integrated format like "ツバキ（花）" */}
                                  {(() => {
                                    const plantPartsMatch = plant.match(/^(.+?)（([^）]+)）$/);
                                    if (plantPartsMatch) {
                                      const [, plantName, parts] = plantPartsMatch;
                                      return (
                                        <>
                                          <span className="text-slate-800 dark:text-slate-200 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                            {plantName}
                                          </span>
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 ml-2">
                                            {parts}
                                          </span>
                                        </>
                                      );
                                    } else {
                                      return (
                                        <span className="text-slate-800 dark:text-slate-200 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                          {plant}
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">食草情報未登録</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">情報をお持ちの方はご連絡ください</p>
                  </div>
                )}
                
                {/* 食草備考情報 - 植物固有でない汎用的な備考のみ（成虫発生時期も除去） */}
                {moth.hostPlantNotes && (() => {
                  const filteredNotes = moth.hostPlantNotes
                    .map(note => {
                      // 成虫発生時期を除去
                      const { notes: filteredNote } = extractEmergenceTime(note);
                      return filteredNote.trim();
                    })
                    .filter(note => 
                      note && // 空でない
                      !note.includes('花・若い翼果') && 
                      !note.includes('実') && 
                      !note.includes('葉') && 
                      !note.includes('茎') && 
                      !note.includes('根') && 
                      !note.includes('果実')
                    );
                  return filteredNotes.length > 0;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">備考:</span>
                      {moth.hostPlantNotes
                        .map(note => {
                          // 成虫発生時期を除去
                          const { notes: filteredNote } = extractEmergenceTime(note);
                          return filteredNote.trim();
                        })
                        .filter(note => 
                          note && // 空でない
                          !note.includes('花・若い翼果') && 
                          !note.includes('実') && 
                          !note.includes('葉') && 
                          !note.includes('茎') && 
                          !note.includes('根') && 
                          !note.includes('果実')
                        ).map((note, noteIndex) => (
                        <span key={noteIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 地理的備考・生態学的特徴 */}
                {moth.geographicalRemarks && typeof moth.geographicalRemarks === 'string' && moth.geographicalRemarks.trim() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex flex-wrap gap-2">
                      {/* 生態学的特徴（単食性、多食性など）か地域情報かを判断 */}
                      {moth.geographicalRemarks.trim().match(/^(単食性|多食性|広食性|狭食性)$/) ? (
                        <>
                          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">食性:</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            {moth.geographicalRemarks.trim()}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">備考:</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            {moth.geographicalRemarks.trim()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 詳細備考情報（キリガデータ統合対応） */}
                {moth.remarks && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="space-y-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">詳細情報:</span>
                      {moth.remarks.split(' | ').map((remark, remarkIndex) => {
                        // 成虫発生時期を含む備考は除外
                        const { notes: filteredRemark } = extractEmergenceTime(remark);
                        if (!filteredRemark.trim()) return null;
                        // 食草備考の場合 - 本来の食草情報として扱う
                        if (remark.startsWith('食草: ')) {
                          const content = remark.substring(3);
                          // 食草データが空の場合、備考の食草情報を主要食草として表示
                          if (moth.hostPlants.length === 0) {
                            const foodPlants = content.split(/[、，,;；]/).map(p => p.trim()).filter(p => p.length > 0);
                            return (
                              <div key={remarkIndex} className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700/50">
                                <div className="flex items-start space-x-2">
                                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">食草情報（文献記録）:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {foodPlants.map((plant, plantIndex) => (
                                        <span key={plantIndex} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                          {plant}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{content}</p>
                            </div>
                          );
                        }
                        // 発生時期の場合
                        else if (remark.startsWith('発生時期: ')) {
                          const content = remark.substring(5);
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{content}</p>
                            </div>
                          );
                        }
                        // 旧備考の場合
                        else if (remark.startsWith('旧備考: ')) {
                          const content = remark.substring(4);
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-600 dark:text-slate-400 italic">{content}</p>
                            </div>
                          );
                        }
                        // その他の備考
                        else {
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{remark}</p>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                )}

                {/* 出典情報 */}
                {moth.source && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-medium">出典:</span>{' '}
                        {getSourceLink(moth.source) ? (
                          <a 
                            href={getSourceLink(moth.source)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline hover:no-underline transition-colors duration-200 font-medium"
                          >
                            {moth.source}
                            <svg className="w-3 h-3 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="font-medium">{moth.source}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 成虫発生時期を除去した備考情報 */}
                {moth.notes && (() => {
                  const { notes: remainingNotes } = extractEmergenceTime(moth.notes);
                  return remainingNotes.trim();
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-medium">備考:</span>{' '}
                        {(() => {
                          const { notes: remainingNotes } = extractEmergenceTime(moth.notes);
                          return remainingNotes.trim();
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 成虫発生時期情報 - ハムシと蛾で表示 */}
            {(moth.type === 'leafbeetle' || moth.type === 'moth') && (() => {
              const hasExistingTime = moth.emergenceTime && moth.emergenceTime !== '不明';
              const { emergenceTime } = extractEmergenceTime(moth.notes || '');
              const normalizedTime = normalizeEmergenceTime(emergenceTime);
              const hasExtractedTime = normalizedTime && normalizedTime !== '不明';
              return hasExistingTime || hasExtractedTime;
            })() && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
                <div className="p-4 bg-orange-500/10 dark:bg-orange-500/20 border-b border-orange-200/30 dark:border-orange-700/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      発生時期
                    </h2>
                  </div>
                </div>
                
                <div className="p-4">
                  {(() => {
                    // 既存のemergenceTimeがある場合はそれを使用
                    if (moth.emergenceTime && moth.emergenceTime !== '不明') {
                      return <EmergenceTimeDisplay emergenceTime={moth.emergenceTime} source={moth.emergenceTimeSource} />;
                    }
                    
                    // 備考欄から成虫発生時期を抽出
                    const { emergenceTime } = extractEmergenceTime(moth.notes || '');
                    const normalizedTime = normalizeEmergenceTime(emergenceTime);
                    
                    if (normalizedTime) {
                      return <EmergenceTimeDisplay emergenceTime={normalizedTime} source={moth.source} />;
                    }
                    
                    // デフォルトの不明表示
                    return <EmergenceTimeDisplay emergenceTime="不明" source={moth.emergenceTimeSource} />;
                  })()}
                  
                  {(() => {
                    // 成虫発生時期がある場合の条件判定
                    const hasExistingTime = moth.emergenceTime && moth.emergenceTime !== '不明';
                    const { emergenceTime } = extractEmergenceTime(moth.notes || '');
                    const normalizedTime = normalizeEmergenceTime(emergenceTime);
                    const hasExtractedTime = normalizedTime && normalizedTime !== '不明';
                    
                    return (hasExistingTime || hasExtractedTime);
                  })() && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                      <div className="flex items-start space-x-2">
                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          <span className="font-medium">出典:</span> {moth.emergenceTimeSource || (moth.type === 'leafbeetle' ? 'ハムシハンドブック' : moth.type === 'beetle' ? (
                            <a 
                              href="https://amzn.to/4m2vPWp" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
                            >
                              日本産タマムシ大図鑑
                            </a>
                          ) : '日本のキリガ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 関連種情報 - 食草ごとに表示 */}
            {Object.keys(relatedMothsByPlant).length > 0 && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
                <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 border-b border-blue-200/30 dark:border-blue-700/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      同じ食草を持つ昆虫
                    </h2>
                  </div>
                </div>
                
                <div className="p-4 space-y-6">
                  {Object.entries(relatedMothsByPlant).map(([plant, relatedMothNames]) => (
                    <div key={plant} className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/plant/${encodeURIComponent(plant)}`}
                          className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600"
                        >
                          {plant}
                        </Link>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          ({relatedMothNames.length}種)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {relatedMothNames.map(relatedMothName => {
                          const relatedMoth = allInsects.find(m => m.name === relatedMothName);
                          if (!relatedMoth) return null;
                          
                          const baseUrl = relatedMoth.type === 'butterfly' ? '/butterfly/' : 
                                         relatedMoth.type === 'beetle' ? '/beetle/' : 
                                         relatedMoth.type === 'leafbeetle' ? '/leafbeetle/' : '/moth/';
                          
                          return (
                            <Link
                              key={relatedMoth.id}
                              to={`${baseUrl}${relatedMoth.id}`}
                              className="flex items-center space-x-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                            >
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {relatedMothName}
                                  </h5>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ml-2 ${
                                    relatedMoth.type === 'moth' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                    relatedMoth.type === 'butterfly' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' :
                                    relatedMoth.type === 'beetle' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  }`}>
                                    {relatedMoth.type === 'moth' ? '蛾' : 
                                     relatedMoth.type === 'butterfly' ? '蝶' : 
                                     relatedMoth.type === 'beetle' ? 'タマムシ' : 'ハムシ'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                                  {formatScientificNameReact(relatedMoth.scientificName)}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MothDetail;