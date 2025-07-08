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
  const [mothSearchTerm, setMothSearchTerm] = useState('');
  const [familySearchTerm, setFamilySearchTerm] = useState('');
  const [subfamilySearchTerm, setSubfamilySearchTerm] = useState('');
  const [tribeSearchTerm, setTribeSearchTerm] = useState('');
  const [genusSearchTerm, setGenusSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedMothSearch = useDebounce(mothSearchTerm, 300);
  const debouncedFamilySearch = useDebounce(familySearchTerm, 300);
  const debouncedSubfamilySearch = useDebounce(subfamilySearchTerm, 300);
  const debouncedTribeSearch = useDebounce(tribeSearchTerm, 300);
  const debouncedGenusSearch = useDebounce(genusSearchTerm, 300);

  const filteredMoths = useMemo(() => moths.filter(moth => {
    const matchesName = moth.name.toLowerCase().includes(debouncedMothSearch.toLowerCase()) ||
                        (moth.scientificName && moth.scientificName.toLowerCase().includes(debouncedMothSearch.toLowerCase()));
    const matchesFamily = moth.classification.familyJapanese.toLowerCase().includes(debouncedFamilySearch.toLowerCase());
    const matchesSubfamily = moth.classification.subfamilyJapanese.toLowerCase().includes(debouncedSubfamilySearch.toLowerCase());
    const matchesTribe = moth.classification.tribeJapanese.toLowerCase().includes(debouncedTribeSearch.toLowerCase());
    const matchesGenus = moth.classification.genus.toLowerCase().includes(debouncedGenusSearch.toLowerCase());
    return matchesName && matchesFamily && matchesSubfamily && matchesTribe && matchesGenus;
  }), [moths, debouncedMothSearch, debouncedFamilySearch, debouncedSubfamilySearch, debouncedTribeSearch, debouncedGenusSearch]);

  const mothNameSuggestions = useMemo(() => {
    if (!mothSearchTerm) return [];
    const lowerCaseSearchTerm = mothSearchTerm.toLowerCase();
    return moths
      .filter(moth => moth.name.toLowerCase().includes(lowerCaseSearchTerm) || (moth.scientificName && moth.scientificName.toLowerCase().includes(lowerCaseSearchTerm)))
      .map(moth => moth.name)
      .slice(0, 10); // Limit suggestions to 10
  }, [moths, mothSearchTerm]);

  const familySuggestions = useMemo(() => {
    if (!familySearchTerm) return [];
    const lowerCaseSearchTerm = familySearchTerm.toLowerCase();
    const uniqueFamilies = new Set();
    moths.forEach(moth => {
      if (moth.classification.familyJapanese && moth.classification.familyJapanese.toLowerCase().includes(lowerCaseSearchTerm)) {
        uniqueFamilies.add(moth.classification.familyJapanese);
      }
    });
    return Array.from(uniqueFamilies).slice(0, 10);
  }, [moths, familySearchTerm]);

  const subfamilySuggestions = useMemo(() => {
    if (!subfamilySearchTerm) return [];
    const lowerCaseSearchTerm = subfamilySearchTerm.toLowerCase();
    const uniqueSubfamilies = new Set();
    moths.forEach(moth => {
      if (moth.classification.subfamilyJapanese && moth.classification.subfamilyJapanese.toLowerCase().includes(lowerCaseSearchTerm)) {
        uniqueSubfamilies.add(moth.classification.subfamilyJapanese);
      }
    });
    return Array.from(uniqueSubfamilies).slice(0, 10);
  }, [moths, subfamilySearchTerm]);

  const tribeSuggestions = useMemo(() => {
    if (!tribeSearchTerm) return [];
    const lowerCaseSearchTerm = tribeSearchTerm.toLowerCase();
    const uniqueTribes = new Set();
    moths.forEach(moth => {
      if (moth.classification.tribeJapanese && moth.classification.tribeJapanese.toLowerCase().includes(lowerCaseSearchTerm)) {
        uniqueTribes.add(moth.classification.tribeJapanese);
      }
    });
    return Array.from(uniqueTribes).slice(0, 10);
  }, [moths, tribeSearchTerm]);

  const genusSuggestions = useMemo(() => {
    if (!genusSearchTerm) return [];
    const lowerCaseSearchTerm = genusSearchTerm.toLowerCase();
    const uniqueGenera = new Set();
    moths.forEach(moth => {
      if (moth.classification.genus && moth.classification.genus.toLowerCase().includes(lowerCaseSearchTerm)) {
        uniqueGenera.add(moth.classification.genus);
      }
    });
    return Array.from(uniqueGenera).slice(0, 10);
  }, [moths, genusSearchTerm]);

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
  }, [debouncedMothSearch, debouncedFamilySearch, debouncedSubfamilySearch, debouncedTribeSearch, debouncedGenusSearch]);

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-primary-600 dark:text-primary-400">蛾のリスト</h2>
      <div className="space-y-4 mb-6">
        <SearchInput 
          placeholder="蛾を検索 (和名・学名)" 
          value={mothSearchTerm} 
          onChange={(e) => setMothSearchTerm(e.target.value)} 
          suggestions={mothNameSuggestions}
          onSelectSuggestion={setMothSearchTerm}
        />
        <SearchInput 
          placeholder="科和名で検索" 
          value={familySearchTerm} 
          onChange={(e) => setFamilySearchTerm(e.target.value)} 
          suggestions={familySuggestions}
          onSelectSuggestion={setFamilySearchTerm}
        />
        <SearchInput 
          placeholder="亜科和名で検索" 
          value={subfamilySearchTerm} 
          onChange={(e) => setSubfamilySearchTerm(e.target.value)} 
          suggestions={subfamilySuggestions}
          onSelectSuggestion={setSubfamilySearchTerm}
        />
        <SearchInput 
          placeholder="族和名で検索" 
          value={tribeSearchTerm} 
          onChange={(e) => setTribeSearchTerm(e.target.value)} 
          suggestions={tribeSuggestions}
          onSelectSuggestion={setTribeSearchTerm}
        />
        <SearchInput 
          placeholder="属名で検索" 
          value={genusSearchTerm} 
          onChange={(e) => setGenusSearchTerm(e.target.value)} 
          suggestions={genusSuggestions}
          onSelectSuggestion={setGenusSearchTerm}
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
