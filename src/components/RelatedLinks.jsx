import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// 昆虫の画像を取得する関数
const getInsectImagePath = (insect) => {
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

  const safeFilename = insect.scientificFilename || createSafeFilename(insect.scientificName);
  const imageFolder = insect.type === 'butterfly' ? 'butterflies' : 
                     insect.type === 'beetle' ? 'beetles' : 
                     insect.type === 'leafbeetle' ? 'leafbeetles' : 'moths';
  
  return [
    `${import.meta.env.BASE_URL}images/${imageFolder}/${safeFilename}.jpg`,
    `${import.meta.env.BASE_URL}images/${imageFolder}/${insect.name}.jpg`
  ];
};

// 昆虫画像コンポーネント
const InsectImage = ({ insect }) => {
  const [imageIndex, setImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const imagePaths = getInsectImagePath(insect);
  
  const handleImageError = () => {
    if (imageIndex < imagePaths.length - 1) {
      setImageIndex(imageIndex + 1);
      setImageLoaded(false);
    } else {
      setImageError(true);
    }
  };
  
  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };
  
  if (imageError) {
    return (
      <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-lg flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  
  return (
    <div className="relative w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg overflow-hidden">
      <img 
        src={imagePaths[imageIndex]}
        alt={`${insect.name}（${insect.scientificName}）`}
        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/80 dark:bg-emerald-900/40">
          <div className="relative">
            <div className="w-6 h-6 border-2 border-emerald-200 dark:border-emerald-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// 関連する昆虫のリンクコンポーネント
export const RelatedInsects = ({ currentInsect, allInsects, hostPlants }) => {
  if (!currentInsect?.hostPlants?.length) return null;

  // 同じ食草を持つ昆虫を検索
  const relatedInsects = allInsects.filter(insect => 
    insect.id !== currentInsect.id &&
    Array.isArray(insect.hostPlants) && Array.isArray(currentInsect.hostPlants) &&
    insect.hostPlants.some(plant => currentInsect.hostPlants.includes(plant))
  ).slice(0, 6); // 最大6件

  if (relatedInsects.length === 0) return null;

  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-xl shadow-xl border border-white/20 dark:border-slate-700/50">
      <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
        同じ食草を持つ昆虫
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatedInsects.map(insect => (
          <Link
            key={insect.id}
            to={`/${insect.type}/${insect.id}`}
            className="group bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-300 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg transform hover:scale-105"
          >
            <div className="flex items-start space-x-3">
              <InsectImage insect={insect} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {insect.name}
                  </h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ml-2 ${
                    insect.type === 'moth' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    insect.type === 'butterfly' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' :
                    insect.type === 'beetle' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {insect.type === 'moth' ? '蛾' : 
                     insect.type === 'butterfly' ? '蝶' : 
                     insect.type === 'beetle' ? '甲虫' : 'ハムシ'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed">
                  {insect.scientificName}
                </p>
                {/* 共通の食草を表示 */}
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(insect.hostPlants) && Array.isArray(currentInsect.hostPlants) && 
                     insect.hostPlants.filter(plant => currentInsect.hostPlants.includes(plant)).slice(0, 2).map(plant => (
                      <span key={plant} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {plant}
                      </span>
                    ))}
                    {Array.isArray(insect.hostPlants) && Array.isArray(currentInsect.hostPlants) && 
                     insect.hostPlants.filter(plant => currentInsect.hostPlants.includes(plant)).length > 2 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">+{insect.hostPlants.filter(plant => currentInsect.hostPlants.includes(plant)).length - 2}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

// 関連する植物のリンクコンポーネント
export const RelatedPlants = ({ currentPlant, allInsects, hostPlants }) => {
  if (!currentPlant) return null;

  // この植物を食べる昆虫を探す
  const insectsOnThisPlant = allInsects.filter(insect => 
    Array.isArray(insect.hostPlants) && insect.hostPlants.includes(currentPlant)
  );

  // 同じ科の植物を探す（簡易的な実装）
  const relatedPlants = Array.isArray(hostPlants) ? hostPlants.filter(plant => 
    plant.name !== currentPlant &&
    plant.name !== '不明' &&
    // 同じ文字パターンを持つ植物（例：～ノキ、～ガシなど）
    (plant.name.includes('ノキ') && currentPlant.includes('ノキ') ||
     plant.name.includes('ガシ') && currentPlant.includes('ガシ') ||
     plant.name.includes('カエデ') && currentPlant.includes('カエデ') ||
     plant.name.includes('ザクラ') && currentPlant.includes('ザクラ') ||
     plant.name.includes('ヤナギ') && currentPlant.includes('ヤナギ'))
  ).slice(0, 6) : [];

  return (
    <div className="space-y-6">
      {/* この植物を食べる昆虫 */}
      {insectsOnThisPlant.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-xl shadow-xl border border-white/20 dark:border-slate-700/50">
          <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
            {currentPlant}を食草とする昆虫
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insectsOnThisPlant.map(insect => (
              <Link
                key={insect.id}
                to={`/${insect.type}/${insect.id}`}
                className="group bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-300 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg transform hover:scale-105"
              >
                <div className="flex items-start space-x-3">
                  <InsectImage insect={insect} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {insect.name}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ml-2 ${
                        insect.type === 'moth' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        insect.type === 'butterfly' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' :
                        insect.type === 'beetle' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {insect.type === 'moth' ? '蛾' : 
                         insect.type === 'butterfly' ? '蝶' : 
                         insect.type === 'beetle' ? '甲虫' : 'ハムシ'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed">
                      {insect.scientificName}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 関連する植物 */}
      {relatedPlants.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-xl shadow-xl border border-white/20 dark:border-slate-700/50">
          <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
            関連する植物
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedPlants.map(plant => (
              <Link
                key={plant.name}
                to={`/plant/${encodeURIComponent(plant.name)}`}
                className="group bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-all duration-200 border border-teal-200/50 dark:border-teal-700/50"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full group-hover:scale-125 transition-transform"></div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-400">
                    {plant.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};