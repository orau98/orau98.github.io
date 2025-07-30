import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';

// 昆虫の画像を取得する関数（拡張子動的対応）
const getInsectImagePath = (insect, imageExtensions = {}) => {
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
  const imageFolder = insect.type === 'butterfly' ? 'butterflies' : 'insects';
  
  // 動的拡張子取得（和名優先、学名、scientificFilename順）
  const getExtension = (filename) => {
    return imageExtensions[filename] || imageExtensions[insect.name] || imageExtensions[safeFilename] || '.jpg';
  };
  
  const scientificExt = getExtension(safeFilename);
  const nameExt = getExtension(insect.name);
  
  // メインパスリスト（日本語ファイル名はURLエンコーディングしない）
  const primaryPaths = [
    `${import.meta.env.BASE_URL}images/${imageFolder}/${safeFilename}${scientificExt}`,
    `${import.meta.env.BASE_URL}images/${imageFolder}/${insect.name}${nameExt}`,
    `${import.meta.env.BASE_URL}images/${imageFolder}/${safeFilename}.jpg`,
    `${import.meta.env.BASE_URL}images/${imageFolder}/${insect.name}.jpg`,
    `${import.meta.env.BASE_URL}images/${imageFolder}/${safeFilename}.jpeg`,
    `${import.meta.env.BASE_URL}images/${imageFolder}/${insect.name}.jpeg`
  ];
  
  // すべての昆虫画像は insects ディレクトリに統一されているため、フォールバックは不要
  
  return primaryPaths;
};

// 昆虫画像コンポーネント（大きなサイズ）
const InsectImage = ({ insect, large = false }) => {
  const [imageIndex, setImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageExtensions, setImageExtensions] = useState({});
  
  // 画像拡張子データを読み込み
  useEffect(() => {
    const loadImageExtensions = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}image_extensions.json`);
        if (response.ok) {
          const extensions = await response.json();
          setImageExtensions(extensions);
        }
      } catch (error) {
        console.warn('Failed to load image extensions:', error);
        // フォールバックとして空のオブジェクトを使用
        setImageExtensions({});
      }
    };
    
    loadImageExtensions();
  }, []);
  
  const imagePaths = getInsectImagePath(insect, imageExtensions);
  const sizeClasses = large ? "w-full h-56 lg:h-64" : "w-16 h-16";
  const loadingSize = large ? "w-8 h-8" : "w-6 h-6";
  const iconSize = large ? "w-12 h-12" : "w-8 h-8";
  
  // アオマダラタマムシのデバッグ
  if (insect.name === 'アオマダラタマムシ') {
    console.log('DEBUG: アオマダラタマムシ画像パス:', {
      insect: insect,
      imageExtensions: imageExtensions,
      imagePaths: imagePaths,
      currentIndex: imageIndex
    });
  }
  
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
      <div className={`${sizeClasses} bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-lg flex items-center justify-center`}>
        <div className="text-center">
          <svg className={`${iconSize} text-slate-400 dark:text-slate-500 mx-auto mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
          </svg>
          {large && <p className="text-xs text-slate-500 dark:text-slate-400">画像なし</p>}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative ${sizeClasses} bg-emerald-50 dark:bg-emerald-900/20 rounded-lg overflow-hidden`}>
      <img 
        src={imagePaths[imageIndex]}
        alt={`${insect.name}（${insect.scientificName}）`}
        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/80 dark:bg-emerald-900/40">
          <div className="relative">
            <div className={`${loadingSize} border-2 border-emerald-200 dark:border-emerald-700 rounded-full`}></div>
            <div className={`absolute top-0 left-0 ${loadingSize} border-2 border-emerald-500 border-t-transparent rounded-full animate-spin`}></div>
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
                <div className="mb-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {insect.name}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {formatScientificNameReact(insect.scientificName)}
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
          <h3 className="text-lg font-bold mb-6 text-blue-600 dark:text-blue-400">
            {currentPlant}を食草とする昆虫
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {insectsOnThisPlant.map(insect => (
              <Link
                key={insect.id}
                to={`/${insect.type}/${insect.id}`}
                className="group bg-gradient-to-br from-white to-emerald-50 dark:from-slate-700 dark:to-emerald-900/20 rounded-xl overflow-hidden hover:shadow-xl hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30 transition-all duration-300 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-400 dark:hover:border-emerald-500 transform hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
              >
                <div className="relative w-full h-56 lg:h-64">
                  <InsectImage insect={insect} large={true} />
                  
                  {/* 画像上の半透明オーバーレイと名前表示 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h4 className="text-base lg:text-lg font-bold text-white drop-shadow-lg mb-1 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {insect.name}
                      </h4>
                      <p className="text-sm lg:text-base text-white/90 drop-shadow-md leading-relaxed overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {formatScientificNameReact(insect.scientificName)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 lg:p-6 relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
                  <div className="space-y-3">
                    {/* 和名 - より大きく目立つように */}
                    <div>
                      <h4 className="text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors overflow-hidden leading-tight" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {insect.name}
                      </h4>
                    </div>
                    
                    
                    {/* 学名 - 十分な間隔を空けて配置 */}
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-600/50">
                      <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {formatScientificNameReact(insect.scientificName)}
                      </p>
                    </div>
                  </div>
                  
                  {/* ホバー時に表示される矢印アイコン */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-emerald-500 dark:bg-emerald-600 rounded-full p-2 lg:p-2.5 shadow-lg">
                      <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
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