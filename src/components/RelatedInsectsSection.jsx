import React from 'react';
import { Link } from 'react-router-dom';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';

const RelatedInsectsSection = ({ relatedMothsByPlant, allInsects }) => {
  // 画像パスを構築する関数
  const getImagePath = (insect) => {
    if (insect.type === 'moth') {
      return `${import.meta.env.BASE_URL}images/moths/${insect.scientificName.replace(/\s+/g, '_')}.jpg`;
    } else if (insect.type === 'butterfly') {
      return `${import.meta.env.BASE_URL}images/butterflies/${insect.scientificName.replace(/\s+/g, '_')}.jpg`;
    } else if (insect.type === 'beetle') {
      return `${import.meta.env.BASE_URL}images/beetles/${insect.scientificName.replace(/\s+/g, '_')}.jpg`;
    } else if (insect.type === 'leafbeetle') {
      return `${import.meta.env.BASE_URL}images/leafbeetles/${insect.scientificName.replace(/\s+/g, '_')}.jpg`;
    }
    return null;
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
                      className="insect-card flex-shrink-0 w-32 group"
                    >
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:border-blue-300 dark:group-hover:border-blue-600">
                        {/* 昆虫画像 */}
                        <div className="insect-icon-container mb-3 flex justify-center">
                          <div className="relative">
                            <img 
                              src={getImagePath(relatedMoth)}
                              alt={relatedMothName}
                              className="insect-icon w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 transition-transform duration-300 group-hover:border-blue-400 dark:group-hover:border-blue-500"
                              onError={(e) => {
                                // 画像が見つからない場合はデフォルトアイコンを表示
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 items-center justify-center transition-colors duration-300 group-hover:border-blue-400 dark:group-hover:border-blue-500 hidden">
                              <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        {/* 昆虫名 */}
                        <div className="text-center">
                          <h5 className="insect-name text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight mb-1 line-clamp-2">
                            {relatedMothName}
                          </h5>
                          
                          {/* 種別バッジ */}
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            relatedMoth.type === 'moth' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            relatedMoth.type === 'butterfly' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' :
                            relatedMoth.type === 'beetle' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>
                            {relatedMoth.type === 'moth' ? '🦋 蛾' : 
                             relatedMoth.type === 'butterfly' ? '🦋 蝶' : 
                             relatedMoth.type === 'beetle' ? '🪲 タマムシ' : '🐛 ハムシ'}
                          </span>
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