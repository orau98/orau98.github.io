import React from 'react';
import MothList from './components/MothList';
import HostPlantList from './components/HostPlantList';

const InsectsHostPlantExplorer = ({ moths, butterflies, hostPlants, plantDetails }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="space-y-8 p-4 md:p-8">
        <div className="relative w-full h-80 md:h-[32rem] lg:h-[36rem] rounded-3xl overflow-hidden shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-transparent to-slate-900/30 z-10"></div>
          
          <img 
            src={`${import.meta.env.BASE_URL}images/moths/Cucullia_argentea.jpg`} 
            alt="アオモンギンセダカモクメ" 
            className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out"
            onError={(e) => { e.target.onerror = null; e.target.src=`${import.meta.env.BASE_URL}images/placeholder.jpg`; e.target.alt='画像が見つかりません'; }}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent z-20"></div>
          
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 z-30">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white/90 backdrop-blur-sm border border-white/30">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  アオモンギンセダカモクメ
                </span>
              </div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 leading-tight">
                <span className="block bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent drop-shadow-2xl">
                  "繋がり"が見える
                </span>
                <span className="block bg-gradient-to-r from-purple-100 via-pink-100 to-teal-100 bg-clip-text text-transparent drop-shadow-2xl">
                  昆虫図鑑
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-blue-100/90 font-medium mb-6 drop-shadow-lg max-w-2xl">
                蛾と食草の美しい関係を探る、自然界の神秘的な繋がりを発見しよう
              </p>
              
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-500/20 text-blue-100 backdrop-blur-sm border border-blue-400/30">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  生態系の観察
                </span>
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-purple-500/20 text-purple-100 backdrop-blur-sm border border-purple-400/30">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  種の検索
                </span>
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-teal-500/20 text-teal-100 backdrop-blur-sm border border-teal-400/30">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  関係性の発見
                </span>
              </div>
            </div>
          </div>
          
          <div className="absolute top-6 right-6 z-30">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
              <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <MothList moths={[...moths, ...butterflies]} title="昆虫" baseRoute="" />
          <HostPlantList hostPlants={hostPlants} plantDetails={plantDetails} />
        </div>
      </div>
    </div>
  );
};

export default InsectsHostPlantExplorer;