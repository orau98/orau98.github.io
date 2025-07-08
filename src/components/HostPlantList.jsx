import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';

const HostPlantListItem = ({ plant, mothCount }) => (
  <li className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-200">
    <Link to={`/plant/${encodeURIComponent(plant)}`} className="block group">
      <strong className="text-lg text-neutral-800 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">{plant}</strong><br />
      <span className="text-sm text-neutral-600 dark:text-neutral-300">この植物を食べる蛾: {mothCount}種</span>
    </Link>
  </li>
);

const HostPlantList = ({ hostPlants, plantDetails }) => {
  const [plantSearchTerm, setPlantSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedPlantSearch = useDebounce(plantSearchTerm, 300);

  const filteredHostPlants = useMemo(() => {
    const lowerCaseSearchTerm = debouncedPlantSearch.toLowerCase();
    return Object.entries(hostPlants).filter(([plantName]) => {
      const detail = plantDetails[plantName] || {};
      const family = detail.family?.toLowerCase() || '';
      const genus = detail.genus?.toLowerCase() || '';
      return plantName.toLowerCase().includes(lowerCaseSearchTerm) ||
             family.includes(lowerCaseSearchTerm) ||
             genus.includes(lowerCaseSearchTerm);
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

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedPlantSearch]);

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-primary-600 dark:text-primary-400">食草リスト</h2>
      <div className="mb-6">
        <SearchInput 
          placeholder="食草を検索" 
          value={plantSearchTerm} 
          onChange={(e) => setPlantSearchTerm(e.target.value)} 
          suggestions={plantNameSuggestions}
          onSelectSuggestion={setPlantSearchTerm}
        />
      </div>
      <ul className="space-y-4 h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-400 scrollbar-track-neutral-200 dark:scrollbar-thumb-neutral-600 dark:scrollbar-track-neutral-800">
        {currentHostPlants.length > 0 ? (
          currentHostPlants.map(([plant, mothList]) => (
            <HostPlantListItem key={plant} plant={plant} mothCount={mothList.length} />
          ))
        ) : (
          <p className="text-center text-neutral-500 dark:text-neutral-400">結果が見つかりませんでした。</p>
        )}
      </ul>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

export default HostPlantList;
