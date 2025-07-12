import React, { useState } from 'react';
import MothList from './components/MothList';
import HostPlantList from './components/HostPlantList';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';

const InsectsHostPlantExplorer = ({ moths, butterflies, beetles, hostPlants, plantDetails, theme, setTheme }) => {
  const [activeTab, setActiveTab] = useState('insects');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="space-y-6 p-4 md:p-8">
        <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-3xl overflow-hidden shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-transparent to-slate-900/30 z-10"></div>
          
          <img 
            src={`${import.meta.env.BASE_URL}images/moths/Cucullia_argentea.jpg`} 
            alt="蛾と食草の繋がりを示す美しい昆虫図鑑のメインビジュアル" 
            className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out"
            onError={(e) => { e.target.onerror = null; e.target.src=`${import.meta.env.BASE_URL}images/placeholder.jpg`; e.target.alt='画像が見つかりません'; }}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent z-20"></div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-30">
            <div className="max-w-4xl mx-auto">
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 leading-tight">
                <span className="block bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent drop-shadow-2xl">
                  "繋がり"が見える
                </span>
                <span className="block bg-gradient-to-r from-purple-100 via-pink-100 to-teal-100 bg-clip-text text-transparent drop-shadow-2xl">
                  昆虫図鑑
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-blue-100/90 font-medium drop-shadow-lg max-w-2xl">
                蛾と食草の美しい関係を探る、自然界の神秘的な繋がりを発見しよう
              </p>
              
            </div>
          </div>
          
          <div className="absolute top-6 right-6 z-30">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 hover:bg-white/20 transition-all duration-200"
              aria-label="テーマを切り替え"
            >
              {theme === 'dark' ? (
                <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {/* タブナビゲーション */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
            {/* タブヘッダー */}
            <div className="flex border-b border-slate-200/30 dark:border-slate-700/30">
              <button
                onClick={() => setActiveTab('insects')}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 relative ${
                  activeTab === 'insects'
                    ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-900/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>昆虫 ({[...moths, ...butterflies, ...beetles].length})</span>
                </div>
                {activeTab === 'insects' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-lg"></div>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('plants')}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 relative ${
                  activeTab === 'plants'
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span>食草 ({Object.keys(hostPlants).length})</span>
                </div>
                {activeTab === 'plants' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-lg"></div>
                )}
              </button>
            </div>
            
            {/* タブコンテンツ */}
            <div className="relative">
              <div className={`transition-all duration-300 ease-in-out ${
                activeTab === 'insects' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 absolute inset-0 pointer-events-none'
              }`}>
                {activeTab === 'insects' && (
                  <div className="p-0">
                    <MothList 
                      moths={[...moths, ...butterflies, ...beetles]} 
                      title="昆虫" 
                      baseRoute="" 
                      embedded={true}
                    />
                  </div>
                )}
              </div>
              
              <div className={`transition-all duration-300 ease-in-out ${
                activeTab === 'plants' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute inset-0 pointer-events-none'
              }`}>
                {activeTab === 'plants' && (
                  <div className="p-0">
                    <HostPlantList 
                      hostPlants={hostPlants} 
                      plantDetails={plantDetails}
                      embedded={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Instagram セクション */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-pink-500/10 to-rose-500/10 dark:from-pink-500/20 dark:to-rose-500/20 border-b border-pink-200/30 dark:border-pink-700/30">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg">
                  <InstagramIcon className="w-5 h-5 text-white" alt="Instagramアイコン" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 dark:from-pink-400 dark:to-rose-400 bg-clip-text text-transparent">
                    管理者のInstagram
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    徒然なるままに野生生物の観察記録をInstagramで投稿しています
                  </p>
                </div>
                <a 
                  href="https://www.instagram.com/onychodactylus_nipponoborealis/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <InstagramIcon className="w-4 h-4 mr-2" />
                  フォローする
                </a>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Instagram投稿の埋め込み - 複数の投稿を表示できます */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                    最新の投稿
                  </h3>
                  
                  {/* Instagram埋め込み - タイムライン表示 */}
                  <div className="space-y-4">
                    <div className="instagram-wrapper">
                      <InstagramEmbed username="onychodactylus_nipponoborealis" />
                    </div>
                  </div>
                  
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                    サイト管理者について
                  </h3>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200/50 dark:border-emerald-700/50">
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">
                          フィールド好きの大学院生
                        </p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="text-slate-700 dark:text-slate-300">
                          <p className="font-medium">専門分野：行動生態学、化学生態学</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            ※分類学は専門ではありません
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-slate-700 dark:text-slate-300">
                          詳しいプロフィールは
                          <a 
                            href="https://researchmap.jp/HAkimoto" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline decoration-emerald-300 hover:decoration-emerald-500 transition-colors ml-1"
                          >
                            こちら
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Debug info */}
        <div style={{display: 'none'}}>
          <p>Moths: {moths.length}</p>
          <p>Butterflies: {butterflies.length}</p>
          <p>Beetles: {beetles.length}</p>
          <p>Combined: {[...moths, ...butterflies, ...beetles].length}</p>
          <p>First beetle: {beetles[0]?.name || 'None'}</p>
        </div>
      </div>
    </div>
  );
};

export default InsectsHostPlantExplorer;