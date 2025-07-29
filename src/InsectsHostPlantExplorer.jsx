import React, { useState } from 'react';
import MothList from './components/MothList';
import HostPlantList from './components/HostPlantList';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';
import { MainStructuredData } from './components/StructuredData';

const InsectsHostPlantExplorer = ({ moths, butterflies, beetles, leafbeetles, hostPlants, plantDetails, theme, setTheme }) => {
  const [activeTab, setActiveTab] = useState('insects');

  // CRITICAL DEBUG: Log props received
  console.log("CRITICAL DEBUG - InsectsHostPlantExplorer received props:", {
    mothsCount: moths?.length || 0,
    butterfliesCount: butterflies?.length || 0,
    beetlesCount: beetles?.length || 0,
    leafbeetlesCount: leafbeetles?.length || 0,
    hostPlantsCount: Object.keys(hostPlants || {}).length,
    sampleMoth: moths?.[0],
    sampleButterfly: butterflies?.[0],
    sampleBeetle: beetles?.[0],
    sampleLeafbeetle: leafbeetles?.[0]
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* 構造化データ */}
      <MainStructuredData />
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-8">
        <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-3xl overflow-hidden shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-transparent to-slate-900/30 z-10"></div>
          
          <img 
            src={`${import.meta.env.BASE_URL}images/insects/Cucullia_argentea.jpg`} 
            alt="昆虫と食草の美しい関係を探る図鑑のメインビジュアル - Cucullia argentea（ギンスジキンウワバ）" 
            className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out"
            style={{ 
              imageRendering: 'auto',
              willChange: 'transform'
            }}
            loading="eager"
            decoding="async" 
            fetchpriority="high"
            onLoad={() => console.log('Hero image loaded successfully')}
            onError={(e) => { 
              console.error('Hero image failed to load:', e.target.src);
              e.target.onerror = null; 
              e.target.src=`${import.meta.env.BASE_URL}images/placeholder.jpg`; 
              e.target.alt='画像が見つかりません';
            }}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent z-20"></div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-30">
            <div className="max-w-6xl mx-auto">
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 leading-tight">
                <span className="block bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent drop-shadow-2xl">
                  "繋がり"が見える
                </span>
                <span className="block bg-gradient-to-r from-blue-100 to-emerald-100 bg-clip-text text-transparent drop-shadow-2xl">
                  昆虫図鑑
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-blue-100/90 font-medium drop-shadow-lg max-w-2xl">
                昆虫と食草の美しい関係を探る、自然界の意外な繋がりを発見しよう
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
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
            {/* タブヘッダー */}
            <div className="flex border-b border-slate-200/30 dark:border-slate-700/30">
              <button
                onClick={() => setActiveTab('insects')}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 relative ${
                  activeTab === 'insects'
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>昆虫 ({[...moths, ...butterflies, ...beetles, ...leafbeetles].length})</span>
                </div>
                {activeTab === 'insects' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-t-lg"></div>
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
                  <span>食草 ({Object.keys(hostPlants).length})</span>
                </div>
                {activeTab === 'plants' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-lg"></div>
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
                      moths={[...moths, ...butterflies, ...beetles, ...leafbeetles]} 
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
        
        {/* Instagram セクション */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
            <div className="p-4 bg-slate-500/10 dark:bg-slate-500/20 border-b border-slate-200/30 dark:border-slate-700/30">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">
                    サイトについて
                  </h2>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* サイトポリシー */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                      サイトポリシー
                    </h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-700/50">
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <div className="text-slate-700 dark:text-slate-300">
                            <p className="font-medium mb-1">はじめに</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              当サイトは、昆虫と植物の関係を、誰もが手軽に調べられるデータベースを目指して作成しています。掲載されている情報は、管理者が既存の図鑑や学術文献などを基にまとめたものです。
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="text-slate-700 dark:text-slate-300">
                            <p className="font-medium mb-1">免責事項</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              データの正確性には細心の注意を払っておりますが、参照した文献が古かったり、解釈に誤りが含まれていたりする可能性があります。学術研究やその他重要な目的でデータを利用される場合は、必ずご自身で原典をご確認いただきますようお願いいたします。当サイトの情報を利用したことによって生じた、いかなる損害についても責任を負いかねますので、あらかじめご了承ください。
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="text-slate-700 dark:text-slate-300">
                            <p className="font-medium mb-1">写真について</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              掲載している写真は、すべて管理者自身が撮影したものです。写真の著作権は管理者に帰属します。無断での転載・利用は固くお断りいたします。写真の利用をご希望の場合は、
                              <a 
                                href="https://docs.google.com/forms/d/e/1FAIpQLSfNf5n59JWmiYpH6ImyAQsIy00PK_fMk_lHVP5nbxzfwuoA4w/viewform?usp=header" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-500 transition-colors ml-1"
                              >
                                こちらのGoogleフォーム
                              </a>
                              よりお気軽にご連絡ください。
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="text-slate-700 dark:text-slate-300">
                            <p className="font-medium mb-1">データについて</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              掲載データは、学術的引用の範囲内での利用を想定しており、元となる情報の著作権は各原典の著者・出版社に帰属します。
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="text-slate-700 dark:text-slate-300">
                            <p className="font-medium mb-1">お問い合わせ</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              誤植・情報の修正依頼は、サイトの品質向上のために大変助かります。お気づきの点がありましたら、
                              <a 
                                href="https://docs.google.com/forms/d/e/1FAIpQLSfNf5n59JWmiYpH6ImyAQsIy00PK_fMk_lHVP5nbxzfwuoA4w/viewform?usp=header" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-500 transition-colors ml-1"
                              >
                                こちらのGoogleフォーム
                              </a>
                              までお寄せください。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Instagram投稿の埋め込み - 複数の投稿を表示できます */}
                <div className="space-y-4">
                  {/* サイト管理者について */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                      サイト管理者について
                    </h3>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6 border border-emerald-200/50 dark:border-emerald-700/50">
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <p className="text-slate-700 dark:text-slate-300 font-medium">
                            フィールド好きの大学院生
                          </p>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="text-slate-700 dark:text-slate-300">
                            <p className="font-medium">専門分野：行動生態学、化学生態学</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              ※分類学は専門ではありません
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
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

                  <div className="mb-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg">
                        <InstagramIcon className="w-5 h-5 text-white" alt="Instagramアイコン" />
                      </div>
                      <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                        Instagram 最新投稿
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 ml-11">
                      徒然なるままに野生生物の観察記録をInstagramで投稿しています
                    </p>
                  </div>
                  
                  {/* Instagram埋め込み - 個別投稿表示 */}
                  <div className="space-y-4">
                    <div className="instagram-wrapper border-2 border-gradient-to-r from-purple-200/50 via-pink-200/50 to-orange-200/50 dark:border-purple-700/50 rounded-xl p-3 bg-gradient-to-r from-purple-50/30 via-pink-50/30 to-orange-50/30 dark:bg-gradient-to-r dark:from-purple-900/10 dark:via-pink-900/10 dark:to-orange-900/10">
                      <InstagramEmbed />
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
          <p>Leafbeetles: {leafbeetles.length}</p>
          <p>Combined: {[...moths, ...butterflies, ...beetles, ...leafbeetles].length}</p>
          <p>First beetle: {beetles[0]?.name || 'None'}</p>
          <p>First leafbeetle: {leafbeetles[0]?.name || 'None'}</p>
        </div>
      </div>
    </div>
  );
};

export default InsectsHostPlantExplorer;