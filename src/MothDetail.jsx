import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';

const MothDetail = ({ moths, hostPlants }) => {
  const { mothId } = useParams();
  const moth = moths.find(m => m.id === mothId);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!moth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-red-400 to-pink-400 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">蛾が見つかりません</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">指定されたIDの蛾は存在しません。</p>
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
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
  const staticImagePath = `${import.meta.env.BASE_URL}images/moths/${safeFilename}.jpg`;
  
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
    setImageLoaded(false);
    setImageError(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link 
          to="/" 
          className="inline-flex items-center px-4 py-2 mb-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-200 shadow-sm hover:shadow-md text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          蛾のリストに戻る
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 画像セクション */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-white/20 dark:border-slate-700/50">
                {hasInstagramPost ? (
                  <div className="p-3">
                    <InstagramEmbed url={moth.instagramUrl} />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 group">
                    {!imageError ? (
                      <img 
                        src={staticImagePath} 
                        alt={moth.name}
                        className={`w-full h-full object-cover transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img 
                          src={`${import.meta.env.BASE_URL}images/placeholder.jpg`} 
                          alt="画像が見つかりません"
                          className="w-full h-full object-cover opacity-50"
                        />
                      </div>
                    )}
                    
                    {!imageLoaded && !imageError && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    )}
                    
                    {imageError && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-6">
                          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">画像が見つかりません</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 dark:from-purple-900/30 dark:to-pink-900/30 dark:text-purple-300">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      蛾の標本
                    </span>
                    
                    {hasInstagramPost && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-pink-100 to-rose-100 text-pink-800 dark:from-pink-900/30 dark:to-rose-900/30 dark:text-pink-300">
                        <InstagramIcon className="w-4 h-4 mr-2" />
                        Instagram
                      </span>
                    )}
                  </div>
                  
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {moth.name}
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 italic font-medium">
                    {moth.scientificName}
                  </p>
                  
                  {moth.source && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-medium">出典:</span> {moth.source}
                      </p>
                    </div>
                  )}
                  
                  {hasInstagramPost && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <InstagramIcon className="w-4 h-4 text-pink-500" />
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Instagram投稿
                          </span>
                        </div>
                        <a 
                          href={moth.instagramUrl} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 font-medium hover:underline"
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
          <div className="lg:col-span-2 space-y-4">
            {/* 分類情報 */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border-b border-blue-200/30 dark:border-blue-700/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    分類
                  </h2>
                </div>
              </div>
              
              <div className="p-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {moth.classification.familyJapanese && (
                    <div className="bg-slate-50/50 dark:bg-slate-700/30 rounded-xl p-4">
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">科</dt>
                      <dd className="text-slate-800 dark:text-slate-200 font-semibold">
                        {moth.classification.familyJapanese}
                        {moth.classification.family && (
                          <span className="block text-sm text-slate-600 dark:text-slate-400 italic">
                            {moth.classification.family}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  
                  {moth.classification.subfamilyJapanese && (
                    <div className="bg-slate-50/50 dark:bg-slate-700/30 rounded-xl p-4">
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">亜科</dt>
                      <dd className="text-slate-800 dark:text-slate-200 font-semibold">
                        {moth.classification.subfamilyJapanese}
                        {moth.classification.subfamily && (
                          <span className="block text-sm text-slate-600 dark:text-slate-400 italic">
                            {moth.classification.subfamily}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  
                  {moth.classification.tribeJapanese && (
                    <div className="bg-slate-50/50 dark:bg-slate-700/30 rounded-xl p-4">
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">族</dt>
                      <dd className="text-slate-800 dark:text-slate-200 font-semibold">
                        {moth.classification.tribeJapanese}
                        {moth.classification.tribe && (
                          <span className="block text-sm text-slate-600 dark:text-slate-400 italic">
                            {moth.classification.tribe}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  
                  {moth.classification.genus && (
                    <div className="bg-slate-50/50 dark:bg-slate-700/30 rounded-xl p-4">
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">属</dt>
                      <dd className="text-slate-800 dark:text-slate-200 font-semibold italic">
                        {moth.classification.genus}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* 食草情報 */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-b border-emerald-200/30 dark:border-emerald-700/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                    食草
                  </h2>
                </div>
              </div>
              
              <div className="p-4">
                {moth.hostPlants.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {moth.hostPlants.map((plant, index) => (
                      <Link
                        key={plant}
                        to={`/plant/${encodeURIComponent(plant)}`}
                        className="group bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-3 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full group-hover:scale-125 transition-transform"></div>
                          <span className="text-slate-800 dark:text-slate-200 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {plant}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">食草情報が不明です</p>
                  </div>
                )}
              </div>
            </div>

            {/* 関連種情報 */}
            {relatedMoths.size > 0 && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border-b border-purple-200/30 dark:border-purple-700/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                      同じ食草を持つ蛾
                    </h2>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex flex-wrap gap-3">
                    {[...relatedMoths].map(relatedMothName => {
                      const relatedMoth = moths.find(m => m.name === relatedMothName);
                      return relatedMoth ? (
                        <Link
                          key={relatedMoth.id}
                          to={`/moth/${relatedMoth.id}`}
                          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full text-sm font-medium text-purple-800 dark:text-purple-300 hover:from-purple-200 hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 transition-all duration-200 border border-purple-200/50 dark:border-purple-700/50 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transform hover:scale-105"
                        >
                          <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          {relatedMothName}
                        </Link>
                      ) : null;
                    })}
                  </div>
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