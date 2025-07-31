import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';

const Header = ({ theme, setTheme, moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants, plantDetails }) => {
  const location = useLocation();
  
  // Get current moth or plant data for classification display
  const getCurrentSpeciesInfo = () => {
    const pathParts = location.pathname.split('/');
    
    if (pathParts[1] === 'moth' && pathParts[2]) {
      const mothId = pathParts[2];
      const moth = moths.find(m => m.id === mothId);
      if (moth) {
        return {
          type: 'moth',
          name: moth.name,
          scientificName: moth.scientificName,
          classification: moth.classification
        };
      }
    } else if (pathParts[1] === 'butterfly' && pathParts[2]) {
      const butterflyId = pathParts[2];
      const butterfly = butterflies.find(b => b.id === butterflyId);
      if (butterfly) {
        return {
          type: 'butterfly',
          name: butterfly.name,
          scientificName: butterfly.scientificName,
          classification: butterfly.classification
        };
      }
    } else if (pathParts[1] === 'beetle' && pathParts[2]) {
      const beetleId = pathParts[2];
      const beetle = beetles.find(b => b.id === beetleId);
      if (beetle) {
        return {
          type: 'beetle',
          name: beetle.name,
          scientificName: beetle.scientificName,
          classification: beetle.classification
        };
      }
    } else if (pathParts[1] === 'leafbeetle' && pathParts[2]) {
      const leafbeetleId = pathParts[2];
      const leafbeetle = leafbeetles.find(l => l.id === leafbeetleId);
      if (leafbeetle) {
        return {
          type: 'leafbeetle',
          name: leafbeetle.name,
          scientificName: leafbeetle.scientificName,
          classification: leafbeetle.classification
        };
      }
    } else if (pathParts[1] === 'plant' && pathParts[2]) {
      const plantName = decodeURIComponent(pathParts[2]);
      const plantDetail = plantDetails[plantName];
      if (plantDetail) {
        return {
          type: 'plant',
          name: plantName,
          family: plantDetail.family,
          genus: plantDetail.genus
        };
      }
    }
    return null;
  };

  const speciesInfo = getCurrentSpeciesInfo();

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 backdrop-blur-xl border-b border-slate-700/30 dark:border-slate-600/30 shadow-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="group flex items-center space-x-3 hover:scale-105 transition-transform duration-200">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-black bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent group-hover:from-blue-200 group-hover:to-emerald-200 transition-all duration-300">
                昆虫 食草 - "繋がり"が見える図鑑
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide -mt-1">
                Insect Host Plant Explorer
              </p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-xl font-black bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                昆虫 食草図鑑
              </h1>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            {/* Dynamic species classification info */}
            {speciesInfo && (
              <div className="hidden lg:flex items-center space-x-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
                {speciesInfo.type === 'moth' ? (
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      <span className="text-white font-medium">{speciesInfo.name}</span>
                      {speciesInfo.classification?.familyJapanese && (
                        <span className="text-slate-300 ml-2">({speciesInfo.classification.familyJapanese})</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      <span className="text-white font-medium">{speciesInfo.name}</span>
                      {speciesInfo.family && (
                        <span className="text-slate-300 ml-2">({speciesInfo.family})</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="group relative p-2.5 bg-white/10 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
              aria-label="テーマを切り替え"
            >
              <div className="relative">
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5 text-yellow-400 group-hover:text-yellow-300 transition-colors" />
                ) : (
                  <MoonIcon className="h-5 w-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                )}
                <div className="absolute inset-0 bg-blue-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;