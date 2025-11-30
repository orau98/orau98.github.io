import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { loadInsectImageIndexes } from '../services/imageIndex';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';
import { buildInsectPath } from '../utils/insectSlug';

const InsectCarousel = ({ insects, title, type = 'default' }) => {
  // 画像拡張子マッピングを読み込む（共通サービス）
  const [imageExtensions, setImageExtensions] = useState({});
  useEffect(() => {
    loadInsectImageIndexes()
      .then(({ exts }) => setImageExtensions(exts || {}))
      .catch(() => setImageExtensions({}));
  }, []);

  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : (import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : ''));

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

  // 画像パスを構築する関数
  const getImagePath = (insect) => {
    const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
    const safeFilename = insect.scientificFilename || mappedFilename || createSafeFilename(insect.scientificName);
    const ext = imageExtensions[safeFilename] || '.jpg';
    return `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(safeFilename)}${ext}${cacheBustRef.current}`;
  };

  // フォールバック画像パスを取得する関数
  const getFallbackImagePath = (insect) => {
    const japaneseName = insect.name;
    const ext = imageExtensions[japaneseName] || '.jpg';
    return `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(japaneseName)}${ext}${cacheBustRef.current}`;
  };

  if (!insects || insects.length === 0) return null;

  return (
    <div className="mt-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
      <div className="p-4 bg-indigo-500/10 dark:bg-indigo-500/20 border-b border-indigo-200/30 dark:border-indigo-700/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {title}
          </h2>
        </div>
      </div>
      
      <div className="p-4">
        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-indigo-100 dark:scrollbar-thumb-indigo-600 dark:scrollbar-track-indigo-900/20">
          <div className="flex space-x-4 min-w-max">
            {insects.map(insect => {
              return (
                <Link
                  key={insect.id}
                  to={buildInsectPath(insect)}
                  className="flex-shrink-0 w-48 group"
                >
                  <div className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02] ${
                    insect.type === 'moth' ? 'border-blue-300 dark:border-blue-600 group-hover:border-blue-500 dark:group-hover:border-blue-400' :
                    insect.type === 'butterfly' ? 'border-pink-300 dark:border-pink-600 group-hover:border-pink-500 dark:group-hover:border-pink-400' :
                    insect.type === 'beetle' ? 'border-green-300 dark:border-green-600 group-hover:border-green-500 dark:group-hover:border-green-400' :
                    'border-amber-300 dark:border-amber-600 group-hover:border-amber-500 dark:group-hover:border-amber-400'
                  }`}>
                    <div className="relative w-full aspect-[3/2] overflow-hidden">
                      <img 
                        src={getImagePath(insect)}
                        alt={`${insect.name}の写真`}
                        width="400"
                        height="300"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          if (!e.target.dataset.triedFallback) {
                            e.target.dataset.triedFallback = 'true';
                            e.target.src = getFallbackImagePath(insect);
                          } else {
                            if (e.target && e.target.style) {
                              e.target.style.display = 'none';
                            }
                            const sibling = e.target?.nextElementSibling;
                            if (sibling && sibling.style) {
                              sibling.style.display = 'flex';
                            }
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center hidden">
                        <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
                        <h5 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-lg">
                          {insect.name}
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
    </div>
  );
};

export default InsectCarousel;
