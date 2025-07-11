import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';

const HostPlantListItem = ({ plant, mothNames }) => (
  <li className="group relative overflow-hidden rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 hover:border-teal-300 dark:hover:border-teal-500 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/20 hover:scale-[1.02] transform">
    <Link to={`/plant/${encodeURIComponent(plant)}`} className="block p-5">
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mb-2 line-clamp-1">
            {plant}
          </h3>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {mothNames.length}種
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
              {mothNames.slice(0, 3).join('、')}
              {mothNames.length > 3 && '...'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  </li>
);

const HostPlantList = ({ hostPlants, plantDetails, embedded = false }) => {
  console.log("HostPlantList props:", { hostPlants, plantDetails });
  const [plantSearchTerm, setPlantSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedPlantSearch = useDebounce(plantSearchTerm, 300);

  const safePlantDetails = plantDetails || {};
  const filteredHostPlants = useMemo(() => {
    console.log("Inside filteredHostPlants useMemo. hostPlants:", hostPlants, "plantDetails:", plantDetails);
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    const filtered = Object.entries(hostPlants).filter(([plantName]) => {
      console.log("Filtering plant:", plantName, "Details:", safePlantDetails[plantName]);
      const detail = safePlantDetails[plantName];
      const family = detail && detail.family ? detail.family.toLowerCase() : '';
      const genus = detail && detail.genus ? detail.genus.toLowerCase() : '';
      return plantName.toLowerCase().includes(lowerCaseSearchTerm) ||
             family.includes(lowerCaseSearchTerm) ||
             genus.includes(lowerCaseSearchTerm);
    });
    
    // Sort with "不明" at the end
    return filtered.sort(([a], [b]) => {
      if (a === '不明') return 1;
      if (b === '不明') return -1;
      return a.localeCompare(b, 'ja');
    });
  }, [hostPlants, plantDetails, debouncedPlantSearch]);

  const plantNameSuggestions = useMemo(() => {
    if (!plantSearchTerm) return [];
    const lowerCaseSearchTerm = plantSearchTerm.toLowerCase();
    const suggestions = new Set();
    Object.keys(hostPlants).forEach(plant => {
      if (plant.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(plant);
      }
      const detail = plantDetails[plant] || {};
      if (detail.family?.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(detail.family);
      }
      if (detail.genus?.toLowerCase().includes(lowerCaseSearchTerm)) {
        suggestions.add(detail.genus);
      }
    });
    return Array.from(suggestions).slice(0, 10);
  }, [hostPlants, plantDetails, plantSearchTerm]);

  const totalPages = Math.ceil(filteredHostPlants.length / itemsPerPage);
  const currentHostPlants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredHostPlants.slice(startIndex, endIndex);
  }, [filteredHostPlants, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedPlantSearch]);

  return (
    <div className={embedded ? "" : "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden"}>
      {!embedded && (
        <div className="p-6 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 dark:from-teal-500/20 dark:to-emerald-500/20 border-b border-teal-200/30 dark:border-teal-700/30">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
              食草リスト
            </h2>
          </div>
          <SearchInput 
            placeholder="食草を検索" 
            value={plantSearchTerm} 
            onChange={(e) => setPlantSearchTerm(e.target.value)} 
            suggestions={plantNameSuggestions}
            onSelectSuggestion={setPlantSearchTerm}
          />
        </div>
      )}
      
      {embedded && (
        <div className="p-6">
          <SearchInput 
            placeholder="食草を検索" 
            value={plantSearchTerm} 
            onChange={(e) => setPlantSearchTerm(e.target.value)} 
            suggestions={plantNameSuggestions}
            onSelectSuggestion={setPlantSearchTerm}
          />
        </div>
      )}
      
      <div className="p-6">
        <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-teal-300 scrollbar-track-teal-100 dark:scrollbar-thumb-teal-600 dark:scrollbar-track-teal-900/20">
          {currentHostPlants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentHostPlants.map(([plant, mothList], index) => (
                <div key={plant} className="animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                  <HostPlantListItem plant={plant} mothNames={mothList} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">結果が見つかりませんでした</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">別のキーワードで検索してみてください</p>
            </div>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-teal-200/30 dark:border-teal-700/30">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HostPlantList;