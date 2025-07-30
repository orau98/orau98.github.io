import React from 'react';
import { Link } from 'react-router-dom';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';

const RelatedInsectsSection = ({ relatedMothsByPlant, allInsects }) => {
  // MothDetailと同じ画像パス構築ロジックを使用
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

  // 画像パスを構築する関数（MothDetailと同じロジック）
  const getImagePath = (insect) => {
    const safeFilename = insect.scientificFilename || createSafeFilename(insect.scientificName);
    const japaneseName = insect.name;
    
    // MothDetailと同じ画像フォルダとパス構築を使用
    return `${import.meta.env.BASE_URL}images/insects/${safeFilename}.jpg`;
  };

  // フォールバック画像パスを取得する関数
  const getFallbackImagePath = (insect) => {
    const japaneseName = insect.name;
    return `${import.meta.env.BASE_URL}images/insects/${japaneseName}.jpg`;
  };

  if (Object.keys(relatedMothsByPlant).length === 0) {
    return null;
  }

  return (
    <div className="related-insects-section bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 border-b border-blue-200/30 dark:border-blue-700/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            同じ食草の昆虫
          </h2>
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        {Object.entries(relatedMothsByPlant).map(([plant, relatedMothNames]) => (
          <div key={plant} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Link
                to={`/plant/${encodeURIComponent(plant)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600"
              >
                🌿 {plant}
              </Link>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({relatedMothNames.length}種)
              </span>
            </div>
            
            {/* 横スクロールコンテナ */}
            <div className="horizontal-scroll-container overflow-x-auto pb-2">
              <div className="flex space-x-4 min-w-max">
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
                      className="insect-card flex-shrink-0 w-48 group"
                    >
                      <div className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02] ${
                        relatedMoth.type === 'moth' ? 'border-blue-300 dark:border-blue-600 group-hover:border-blue-500 dark:group-hover:border-blue-400' :
                        relatedMoth.type === 'butterfly' ? 'border-pink-300 dark:border-pink-600 group-hover:border-pink-500 dark:group-hover:border-pink-400' :
                        relatedMoth.type === 'beetle' ? 'border-green-300 dark:border-green-600 group-hover:border-green-500 dark:group-hover:border-green-400' :
                        'border-amber-300 dark:border-amber-600 group-hover:border-amber-500 dark:group-hover:border-amber-400'
                      }`}>
                        {/* 昆虫画像 - 大きくしてカードの大部分を占める */}
                        <div className="relative w-full aspect-[4/3] overflow-hidden">
                          <img 
                            src={getImagePath(relatedMoth)}
                            alt={relatedMothName}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              // 最初の画像パス（学名）が失敗した場合、和名で試行
                              if (!e.target.dataset.triedFallback) {
                                e.target.dataset.triedFallback = 'true';
                                e.target.src = getFallbackImagePath(relatedMoth);
                              } else {
                                // 両方失敗した場合はデフォルトアイコンを表示
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                          {/* フォールバック用のアイコン表示エリア */}
                          <div className="absolute inset-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center hidden">
                            <svg className="w-12 h-12 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          
                          {/* 画像上に昆虫名をオーバーレイ表示 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
                            <h5 className="text-white font-medium text-sm leading-tight line-clamp-2 drop-shadow-lg">
                              {relatedMothName}
                            </h5>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RelatedInsectsSection;