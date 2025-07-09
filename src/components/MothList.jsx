import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import SearchInput from './SearchInput';
import Pagination from './Pagination';

const MothListItem = ({ moth }) => (
  <li className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-200">
    <Link to={`/moth/${moth.id}`} className="block group">
      <strong className="text-lg text-neutral-800 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">{moth.name}</strong><br />
      <span className="text-neutral-500 dark:text-neutral-400 italic">{moth.scientificName}</span><br />
      <span className="text-sm text-neutral-600 dark:text-neutral-300">食草: {moth.hostPlants.join(', ') || '不明'}</span>
    </Link>
  </li>
);

const MothList = ({ moths }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredMoths = useMemo(() => moths.filter(moth => {
    const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
    return moth.name.toLowerCase().includes(lowerCaseSearchTerm) ||
           (moth.scientificName?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.familyJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.subfamilyJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.tribeJapanese?.toLowerCase().includes(lowerCaseSearchTerm)) ||
           (moth.classification.genus?.toLowerCase().includes(lowerCaseSearchTerm));
  }), [moths, debouncedSearchTerm]);

  const allSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const uniqueSuggestions = new Set();

    moths.forEach(moth => {
      if (moth.name.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.name);
      if (moth.scientificName && moth.scientificName.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.scientificName);
      if (moth.classification.familyJapanese && moth.classification.familyJapanese.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.familyJapanese);
      if (moth.classification.subfamilyJapanese && moth.classification.subfamilyJapanese.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.subfamilyJapanese);
      if (moth.classification.tribeJapanese && moth.classification.tribeJapanese.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.tribeJapanese);
      if (moth.classification.genus && moth.classification.genus.toLowerCase().includes(lowerCaseSearchTerm)) uniqueSuggestions.add(moth.classification.genus);
    });
    return Array.from(uniqueSuggestions).slice(0, 10);
  }, [moths, searchTerm]);

  const totalPages = Math.ceil(filteredMoths.length / itemsPerPage);
  const currentMoths = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMoths.slice(startIndex, endIndex);
  }, [filteredMoths, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-primary-600 dark:text-primary-400">蛾のリスト</h2>
      <div className="space-y-4 mb-6">
        <SearchInput 
          placeholder="蛾を検索 (和名・学名・分類)" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          suggestions={allSuggestions}
          onSelectSuggestion={setSearchTerm}
        />
      </div>
      <ul className="space-y-4 h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-400 scrollbar-track-neutral-200 dark:scrollbar-thumb-neutral-600 dark:scrollbar-track-neutral-800">
        {currentMoths.length > 0 ? (
          currentMoths.map(moth => <MothListItem key={moth.id} moth={moth} />)
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

export default MothList;
