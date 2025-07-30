import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Papa from 'papaparse';
import InsectsHostPlantExplorer from './InsectsHostPlantExplorer';
import MothDetail from './MothDetail';
import HostPlantDetail from './HostPlantDetail';
import SkeletonLoader from './components/SkeletonLoader';
import Footer from './components/Footer';
import Header from './components/Header';
import { extractEmergenceTime } from './utils/emergenceTimeUtils';

// This map can be a fallback, but the primary source is now the wamei_checklist.csv.
const plantFamilyMap = {
  'ヤナギ': 'ヤナギ科', 'ヤナギ類': 'ヤナギ科', 'クリ': 'ブナ科', 'クヌギ': 'ブナ科', 'コナラ': 'ブナ科',
  'ブナ': 'ブナ科', 'カシワ': 'ブナ科', 'アラカシ': 'ブナ科', 'スダジイ': 'ブナ科', 'リンゴ': 'バラ科',
  'サクラ': 'バラ科', 'ズミ': 'バラ科', 'ナナカマド': 'バラ科', 'マツ': 'マツ科', 'アカマツ': 'マツ科',
  'トドマツ': 'マツ科', 'スギ': 'スギ科', 'ヒノキ': 'ヒノキ科', 'ヨモギ': 'キク科', 'キク': 'キク科',
  'アザミ': 'キク科', 'イネ': 'イネ科', 'ススキ': 'イネ科', 'ヨシ': 'イネ科', 'ササ': 'イネ科',
  'ハンノキ': 'カバノキ科', 'シラカンバ': 'カバノキ科', 'ダケカンバ': 'カバノキ科', 'カエデ': 'ムクロジ科',
  'イタヤカエデ': 'ムクロジ科', 'ツタ': 'ブドウ科', 'ブドウ': 'ブドウ科', 'ヌルデ': 'ウルシ科',
  'ウルシ': 'ウルシ科', 'ツツジ': 'ツツジ科', 'アセビ': 'ツツジ科', 'スイカズラ': 'スイカズラ科',
  'ガマズミ': 'スイカズラ科', 'クズ': 'マメ科', 'ハギ': 'マメ科', 'フジ': 'マメ科',
};

function App() {
  const location = useLocation();
  const [moths, setMoths] = useState([]);
  const [butterflies, setButterflies] = useState([]);
  const [beetles, setBeetles] = useState([]);
  const [leafbeetles, setLeafbeetles] = useState([]);
  const [hostPlants, setHostPlants] = useState({});
  const [plantDetails, setPlantDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.debug('Theme change error (harmless):', error);
    }
  }, [theme]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let mainMothData = [];
      let hostPlantData = {};
      let plantDetailData = {};
      const wameiCsvPath = `${import.meta.env.BASE_URL}wamei_checklist_ver.1.10.csv`;
      const mainCsvPath = `${import.meta.env.BASE_URL}ListMJ_hostplants_master.csv?v=${Date.now()}&bust=${Math.random()}&nocache=${Date.now()}&t=${performance.now()}`;
      const yListCsvPath = `${import.meta.env.BASE_URL}20210514YList_download.csv`; // New YList CSV path
      const hamushiSpeciesCsvPath = `${import.meta.env.BASE_URL}hamushi_species_integrated.csv`;
      const butterflyCsvPath = `${import.meta.env.BASE_URL}butterfly_host.csv`;
      const beetleCsvPath = `${import.meta.env.BASE_URL}buprestidae_host.csv`;
      const kirigaCsvPath = `${import.meta.env.BASE_URL}日本のキリガ.csv`;
      const fuyushakuCsvPath = `${import.meta.env.BASE_URL}日本のフユシャク.csv?v=${Date.now()}&bust=${Math.random()}&nocache=${Date.now()}&t=${performance.now()}`;
      const emergenceTimeCsvPath = `${import.meta.env.BASE_URL}emergence_time_integrated.csv`;

      // Unified scientific name processing function for all insect types - FIXED SCOPE
      const processScientificName = (existingScientificName, genusName, speciesName, authorName, yearName, insectType = 'moth') => {
        // Clean up inputs
        const cleanGenus = genusName?.trim() || '';
        const cleanSpecies = speciesName?.trim() || '';
        const cleanAuthor = authorName?.trim() || '';
        const cleanYear = yearName?.trim() || '';
        let cleanExisting = existingScientificName?.trim() || '';
        
        // Clean up basic formatting issues first
        cleanExisting = cleanExisting.replace(/\s*"?\s*$/, '').trim();
        
        // Fix specific malformed patterns
        if (cleanExisting.includes(',"')) {
          // Fix pattern like 'Xylena formosa (Butler,"1878)' to 'Xylena formosa (Butler 1878)'
          cleanExisting = cleanExisting.replace(/,\"(\d{4})\)/g, ' $1)');
        }
        
        // Fix other common malformations
        cleanExisting = cleanExisting.replace(/,(\d{4})\)/g, ', $1)'); // Fix missing space before year
        cleanExisting = cleanExisting.replace(/\(\s*([^,)]+)\s*(\d{4})\s*\)/g, '($1, $2)'); // Ensure comma between author and year
        
        // COMPREHENSIVE SCIENTIFIC NAME REPAIR SYSTEM
        // Fix critically broken scientific names from CSV parsing errors
        const repairBrokenScientificName = (brokenName) => {
          // Pattern 1: Scientific names mixed with food plant data
          // e.g., "Genus species (Author,"food plant data; year), more data; year)"
          const mixedDataPattern = /^([A-Z][a-z]+\s+[a-z]+\s*\([^,"]+),?\s*"?[^)]*(\d{4})[^)]*\)/;
          const mixedMatch = brokenName.match(mixedDataPattern);
          if (mixedMatch) {
            const [, binomial, year] = mixedMatch;
            const cleanBinomial = binomial.trim();
            console.log(`REPAIR: Fixed mixed data pattern: "${brokenName}" -> "${cleanBinomial}, ${year})"`);
            return `${cleanBinomial}, ${year})`;
          }
          
          // Pattern 2: Extract valid binomial from corrupted data
          // Look for pattern: Genus species (Author at the beginning
          const binomialExtractPattern = /^([A-Z][a-z]+\s+[a-z]+\s*\([^,")]+)/;
          const extractMatch = brokenName.match(binomialExtractPattern);
          if (extractMatch) {
            const extracted = extractMatch[1];
            // Try to find year in the corrupted data
            const yearMatch = brokenName.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              console.log(`REPAIR: Extracted from corrupted data: "${brokenName}" -> "${extracted}, ${yearMatch[0]})"`);
              return `${extracted}, ${yearMatch[0]})`;
            } else {
              console.log(`REPAIR: Extracted binomial without year: "${brokenName}" -> "${extracted})"`);
              return `${extracted})`;
            }
          }
          
          return brokenName; // Return unchanged if no pattern matches
        };
        
        // Apply repair function to existing scientific name
        if (cleanExisting && (cleanExisting.includes('",') || cleanExisting.includes('; ') || cleanExisting.includes('で飼育'))) {
          cleanExisting = repairBrokenScientificName(cleanExisting);
        }
        
        // Special case fixes for known problematic species
        const knownFixes = {
          'Diphtherocome autumnalis (Chang,"サクラ類': 'Diphtherocome autumnalis (Chang, 1991)',
          'Arcte coerula (Guenée': 'Arcte coerula (Guenée, 1852)'
        };
        
        for (const [broken, fixed] of Object.entries(knownFixes)) {
          if (cleanExisting.includes(broken)) {
            console.log(`REPAIR: Applied known fix: "${cleanExisting}" -> "${fixed}"`);
            cleanExisting = fixed;
            break;
          }
        }
        
        // Check if existing scientific name is valid (has both genus and species)
        if (cleanExisting) {
          // Check if it's a complete binomial (genus + species)
          const binomialMatch = cleanExisting.match(/^([A-Z][a-z]+)\s+([a-z]+(?:\s+[a-z]+)*)/);
          if (binomialMatch) {
            // It's a valid binomial, but check if it has complete author and year
            const hasCompleteAuthorYear = cleanExisting.match(/\([^)]+,\s*\d{4}\)$/);
            if (hasCompleteAuthorYear) {
              return cleanExisting;
            }
            
            // Check if it has incomplete author/year (missing comma and year)
            const hasIncompleteAuthor = cleanExisting.match(/\([^)]+$/);
            if (hasIncompleteAuthor && cleanYear) {
              // Fix incomplete format like "Cucullia argentea (Hufnagel" by adding year
              const incompleteAuthor = hasIncompleteAuthor[0].substring(1); // Remove opening parenthesis
              return `${binomialMatch[1]} ${binomialMatch[2]} (${incompleteAuthor}, ${cleanYear})`;
            }
            
            // Check if it has author without parentheses (e.g., "Orthosia satoi Sugi")
            const authorWithoutParentheses = cleanExisting.match(/^([A-Z][a-z]+\s+[a-z]+)\s+([A-Z][a-zA-Z]+)$/);
            if (authorWithoutParentheses && cleanYear) {
              const [, binomial, author] = authorWithoutParentheses;
              return `${binomial} (${author}, ${cleanYear})`;
            }
            
            // If binomial is complete but no author/year, use as is
            return cleanExisting;
          }
          
          // Check if it's an incomplete name (genus + subgenus only)
          const incompleteMatch = cleanExisting.match(/^([A-Z][a-z]+)\s+\([^)]+\)$/);
          if (incompleteMatch) {
            // It's incomplete (genus + subgenus), need to fix
            console.log(`Incomplete scientific name detected for ${insectType}: ${cleanExisting}`);
            return cleanGenus ? `${cleanGenus} sp.` : '未同定';
          }
        }
        
        // If we have both genus and species, construct binomial
        if (cleanGenus && cleanSpecies) {
          let binomial = `${cleanGenus} ${cleanSpecies}`;
          
          // Add author and year if available
          if (cleanAuthor || cleanYear) {
            const authorYear = [cleanAuthor, cleanYear].filter(Boolean).join(', ');
            binomial += ` (${authorYear})`;
          }
          
          return binomial;
        }
        
        // If we only have genus (no species), mark as unidentified
        if (cleanGenus) {
          return `${cleanGenus} sp.`;
        }
        
        // If we have nothing useful, return unknown
        return '未同定';
      };
      
      // Scientific name quality validation function
      const validateScientificName = (scientificName, japaneseName, insectType) => {
        if (!scientificName) return { isValid: false, issues: ['学名が空白'] };
        
        const issues = [];
        
        // Check for incomplete names (genus + subgenus only)
        const incompletePattern = /^([A-Z][a-z]+)\s+\([^)]+\)$/;
        if (incompletePattern.test(scientificName)) {
          issues.push('種小名が不明（属名＋亜属名のみ）');
        }
        
        // Check for "sp." designation
        if (scientificName.includes(' sp.')) {
          issues.push('未同定種（sp.）');
        }
        
        // Check for "未同定"
        if (scientificName === '未同定') {
          issues.push('未同定');
        }
        
        // ENHANCED VALIDATION: Check for corrupted scientific names
        const corruptionPatterns = [
          { pattern: /[";]/, description: '破損データの残存（セミコロンまたは引用符）' },
          { pattern: /で飼育|により|について/, description: '食草データの混入' },
          { pattern: /科$/, description: '科名の混入' },
          { pattern: /\d{4}[^)]/, description: '年数の表記異常' },
          { pattern: /\([^)]*,.*[^)]/, description: '括弧の不完全な閉じ' }
        ];
        
        for (const { pattern, description } of corruptionPatterns) {
          if (pattern.test(scientificName)) {
            issues.push(`データ破損の可能性: ${description}`);
            console.warn(`CORRUPTION DETECTED in "${japaneseName}": ${scientificName} - ${description}`);
          }
        }
        
        // Check for basic binomial structure
        const binomialPattern = /^([A-Z][a-z]+)\s+([a-z]+(?:\s+[a-z]+)*)/;
        if (!binomialPattern.test(scientificName) && !scientificName.includes(' sp.') && scientificName !== '未同定') {
          issues.push('不正な学名形式');
        }
        
        // Log issues for debugging
        if (issues.length > 0) {
          console.log(`Scientific name quality issues for ${insectType} "${japaneseName}": ${scientificName} - ${issues.join(', ')}`);
        }
        
        return {
          isValid: issues.length === 0,
          issues: issues
        };
      };

      // Initialize all data arrays at function scope to prevent scope errors
      let butterflyData = [];
      let combinedBeetleData = [];
      let combinedLeafbeetleData = [];
      let mainBeetleData = [];
      let beetleData = [];
      let leafbeetleData = [];

      console.log("Fetching CSV files...");
      console.log("wameiCsvPath:", wameiCsvPath);
      console.log("mainCsvPath:", mainCsvPath);
      console.log("yListCsvPath:", yListCsvPath);
      console.log("hamushiSpeciesCsvPath:", hamushiSpeciesCsvPath);
      console.log("butterflyCsvPath:", butterflyCsvPath);
      console.log("beetleCsvPath:", beetleCsvPath);
      console.log("BASE_URL:", import.meta.env.BASE_URL);

      try {
        // Fetch with timeout for all files to prevent hanging
        const fetchWithTimeout = (url, timeout = 15000) => {
          return Promise.race([
            fetch(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Request timeout for ${url}`)), timeout)
            )
          ]);
        };

        const safeFileLoad = async (path, name, timeout = 15000) => {
          try {
            console.log(`Loading ${name} from ${path}`);
            const res = await fetchWithTimeout(path, timeout);
            if (!res.ok) {
              console.error(`Failed to fetch ${name}: ${res.statusText}`);
              return null;
            }
            const text = await res.text();
            console.log(`Successfully loaded ${name} (${text.length} characters)`);
            
            // Debug: Check if スミレモンキリガ exists in the loaded file
            if (name === 'main moth data') {
              if (text.includes('スミレモンキリガ')) {
                console.log('DEBUG: スミレモンキリガ found in loaded CSV');
                const lines = text.split('\n');
                const sumiLine = lines.find(line => line.includes('スミレモンキリガ'));
                if (sumiLine) {
                  console.log('DEBUG: スミレモンキリガ line:', sumiLine);
                  // Check specific content to determine which CSV was loaded
                  if (sumiLine.includes('ツバキ類(ツバキ科)')) {
                    console.log('DEBUG: ✅ CORRECT CSV - New kiriga data with ツバキ類(ツバキ科)');
                  } else if (sumiLine.includes('1990,ツバキ類(ツバキ科)')) {
                    console.error('DEBUG: ❌ OLD CSV - Bokutou data with malformed food plant');
                  } else {
                    console.warn('DEBUG: ⚠️ UNKNOWN CSV FORMAT for スミレモンキリガ');
                  }
                }
              } else {
                console.error('DEBUG: ❌ スミレモンキリガ NOT FOUND in loaded CSV - This is the problem!');
                console.log('DEBUG: CSV size:', text.length, 'characters');
                console.log('DEBUG: First 500 chars:', text.substring(0, 500));
              }
            }
            
            return text;
          } catch (error) {
            console.error(`Error loading ${name}:`, error);
            return null;
          }
        };

        // Load files with safe loading - prioritize essential files
        console.log("=== Starting file loading process ===");
        console.log("DEBUG: フユシャクCsvPath:", fuyushakuCsvPath);
        console.log("DEBUG: About to load フユシャク file with safeFileLoad");
        
        const [wameiText, mainText, yListText, hamushiSpeciesText, butterflyText, beetleText, kirigaText, fuyushakuText, emergenceTimeText] = await Promise.all([
          safeFileLoad(wameiCsvPath, 'wamei checklist', 20000),
          safeFileLoad(mainCsvPath, 'main moth data', 20000),
          safeFileLoad(yListCsvPath, 'YList data', 30000), // Longer timeout for large file
          safeFileLoad(hamushiSpeciesCsvPath, 'hamushi species', 20000),
          safeFileLoad(butterflyCsvPath, 'butterfly data', 15000),
          safeFileLoad(beetleCsvPath, 'beetle data', 15000),
          safeFileLoad(kirigaCsvPath, 'kiriga data', 10000),
          safeFileLoad(fuyushakuCsvPath, 'fuyushaku data', 10000),
          safeFileLoad(emergenceTimeCsvPath, 'emergence time data', 10000)
        ]);
        
        console.log("DEBUG: File loading completed, checking results...");
        
        // Debug フユシャク file loading
        console.log('DEBUG: フユシャク file load result:', {
          path: fuyushakuCsvPath,
          loaded: !!fuyushakuText,
          length: fuyushakuText ? fuyushakuText.length : 0,
          firstChars: fuyushakuText ? fuyushakuText.substring(0, 100) : 'N/A'
        });

        console.log("File loading results:", {
          wamei: wameiText ? 'SUCCESS' : 'FAILED',
          main: mainText ? 'SUCCESS' : 'FAILED',
          yList: yListText ? 'SUCCESS' : 'FAILED',
          hamushi: hamushiSpeciesText ? 'SUCCESS' : 'FAILED',
          butterfly: butterflyText ? 'SUCCESS' : 'FAILED',
          beetle: beetleText ? 'SUCCESS' : 'FAILED',
          kiriga: kirigaText ? 'SUCCESS' : 'FAILED',
          fuyushaku: fuyushakuText ? 'SUCCESS' : 'FAILED',
          emergenceTime: emergenceTimeText ? 'SUCCESS' : 'FAILED'
        });

        // Check if essential files loaded
        if (!mainText) {
          throw new Error('Main moth data file failed to load - cannot continue');
        }
        if (!wameiText) {
          console.warn('Wamei checklist failed to load - plant family data may be incomplete');
        }

        console.log("CSV files fetched successfully. Parsing...");

        // Parse キリガ CSV to create emergence time lookup table
        const emergenceTimeMap = new Map();
        
        // First, parse the integrated emergence time CSV
        if (emergenceTimeText && emergenceTimeText.trim()) {
          try {
            console.log("Parsing integrated emergence time data...");
            const emergenceTimeParsed = Papa.parse(emergenceTimeText, {
              header: true,
              skipEmptyLines: 'greedy',
              delimiter: ',',
              encoding: 'UTF-8'
            });
            
            emergenceTimeParsed.data.forEach(row => {
              const japaneseName = row['和名']?.trim();
              const scientificName = row['学名']?.trim();
              const emergenceTime = row['成虫出現時期']?.trim();
              const source = row['出典']?.trim();
              
              if (japaneseName && emergenceTime && emergenceTime !== '不明') {
                emergenceTimeMap.set(japaneseName, { time: emergenceTime, source: source });
              }
              if (scientificName && emergenceTime && emergenceTime !== '不明') {
                emergenceTimeMap.set(scientificName, { time: emergenceTime, source: source });
              }
            });
            
            console.log(`Loaded ${emergenceTimeParsed.data.length} emergence time records from integrated CSV`);
          } catch (error) {
            console.error("Error parsing integrated emergence time data:", error);
          }
        }
        
        // Use Papa.parse for proper CSV parsing - handle empty kirigaText gracefully
        let kirigaData = [];
        if (kirigaText && kirigaText.trim()) {
          try {
            const kirigaParsed = Papa.parse(kirigaText, {
              header: true,
              skipEmptyLines: 'greedy',
              delimiter: ',',
              quoteChar: '"',
              escapeChar: '"'
            });
            kirigaData = kirigaParsed.data;
          } catch (error) {
            console.warn('Failed to parse キリガ CSV:', error);
            kirigaData = [];
          }
        } else {
          console.warn('キリガ CSV data is empty or failed to load');
        }
        
        // Debug log for キバラモクメキリガ
        const kibaraEntry = kirigaData.find(row => row['和名'] && row['和名'].includes('キバラモクメキリガ'));
        if (kibaraEntry) {
          console.log('Found キバラモクメキリガ:', kibaraEntry);
        } else {
          console.log('キバラモクメキリガ not found in parsed data');
          console.log('Sample parsed entries:', kirigaData.slice(0, 5));
        }
        
        console.log("Parsed キリガ data:", kirigaData.length, "entries");
        
        // Create comprehensive data maps from キリガ data
        const kirigaHostPlantMap = new Map();
        const kirigaRemarksMap = new Map();
        
        kirigaData.forEach(row => {
          const japaneseName = row['和名']?.trim();
          const scientificName = row['学名']?.trim();
          const emergenceTime = row['成虫の発生時期']?.trim();
          const hostPlants = row['食草']?.trim();
          const remarks = row['食草に関する備考']?.trim();
          
          // Debug specific species
          if (japaneseName && japaneseName.includes('アズサキリガ')) {
            console.log('DEBUG: アズサキリガ found in kiriga CSV:', {
              japaneseName, scientificName, emergenceTime, hostPlants, remarks
            });
          }
          
          // Store emergence time data from キリガ (キリガCSVを優先 - より詳細で正確なデータ)
          if (japaneseName && emergenceTime && emergenceTime !== '不明') {
            // アズサキリガの発生時期表記を正規化
            let normalizedEmergenceTime = emergenceTime;
            if (japaneseName === 'アズサキリガ' && emergenceTime.includes('低標高地では') && emergenceTime.includes('高地では')) {
              // "低標高地では3月下旬から、高地では5月中旬まで" -> "3月下旬～5月中旬"
              const lowAltMatch = emergenceTime.match(/低標高地では(\d+月[上中下]旬)から/);
              const highAltMatch = emergenceTime.match(/高地では(\d+月[上中下]旬)まで/);
              if (lowAltMatch && highAltMatch) {
                normalizedEmergenceTime = `${lowAltMatch[1]}～${highAltMatch[1]}`;
                console.log(`Normalized アズサキリガ emergence time: "${emergenceTime}" -> "${normalizedEmergenceTime}"`);
              }
            }
            
            // キリガCSVのデータを常に優先して上書き
            emergenceTimeMap.set(japaneseName, { time: normalizedEmergenceTime, source: '日本のキリガ' });
            
            // Debug log for target species
            if (japaneseName.includes('キバラモクメキリガ') || japaneseName.includes('ナンカイミドリキリガ') || japaneseName.includes('アズサキリガ')) {
              console.log(`Added to emergenceTimeMap (キリガCSV優先): ${japaneseName} -> ${normalizedEmergenceTime}`);
            }
          }
          if (scientificName && emergenceTime && emergenceTime !== '不明') {
            // キリガCSVのデータを常に優先して上書き
            emergenceTimeMap.set(scientificName, { time: emergenceTime, source: '日本のキリガ' });
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              emergenceTimeMap.set(cleanedScientificName, { time: emergenceTime, source: '日本のキリガ' });
              
              // Debug log for target species
              if (cleanedScientificName.includes('Xylena formosa') || cleanedScientificName.includes('Diphtherocome autumnalis') || cleanedScientificName.includes('Pseudopanolis azusa')) {
                console.log(`Added to emergenceTimeMap: ${cleanedScientificName} -> ${emergenceTime}`);
              }
            }
          }
          
          // Store host plant information
          if (japaneseName && hostPlants) {
            kirigaHostPlantMap.set(japaneseName, hostPlants);
          }
          if (scientificName && hostPlants) {
            kirigaHostPlantMap.set(scientificName, hostPlants);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              kirigaHostPlantMap.set(cleanedScientificName, hostPlants);
            }
          }
          
          // Store remarks information
          if (japaneseName && remarks) {
            kirigaRemarksMap.set(japaneseName, remarks);
          }
          if (scientificName && remarks) {
            kirigaRemarksMap.set(scientificName, remarks);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              kirigaRemarksMap.set(cleanedScientificName, remarks);
            }
          }
        });

        // Parse フユシャク CSV to create host plant and emergence time lookup tables
        const fuyushakuHostPlantMap = new Map();
        const fuyushakuRemarksMap = new Map();
        
        // Use Papa.parse for proper CSV parsing - handle empty fuyushakuText gracefully
        let fuyushakuData = [];
        if (fuyushakuText && fuyushakuText.trim()) {
          try {
            // Remove BOM if present
            let cleanedText = fuyushakuText;
            if (cleanedText.charCodeAt(0) === 0xFEFF) {
              cleanedText = cleanedText.substring(1);
            }
            
            const fuyushakuParsed = Papa.parse(cleanedText, {
              header: true,
              skipEmptyLines: 'greedy',
              delimiter: ',',
              quoteChar: '"',
              escapeChar: '"'
            });
            fuyushakuData = fuyushakuParsed.data;
            
            if (fuyushakuParsed.errors.length > 0) {
              console.warn('フユシャク CSV parsing errors:', fuyushakuParsed.errors);
            }
            
            // Fix parsing issues caused by commas in scientific names
            fuyushakuData = fuyushakuData.map(row => {
              // Check if the scientific name field is incomplete (missing year)
              if (row['学名'] && row['食草'] && 
                  row['学名'].includes('(') && !row['学名'].includes(')') &&
                  row['食草'].match(/^\s*\d{4}\)/)) {
                // The year part got split into the food plants field
                const year = row['食草'];
                const fixedScientificName = row['学名'] + ', ' + year;
                
                // The emergence time data might be in __parsed_extra
                let emergenceTime = '';
                if (row.__parsed_extra && row.__parsed_extra.length > 0) {
                  emergenceTime = row.__parsed_extra[0];
                } else if (Object.keys(row).length > 5) {
                  // Try to get from additional fields
                  const keys = Object.keys(row);
                  emergenceTime = row[keys[5]] || '';
                }
                
                // Shift the fields back to their correct positions
                return {
                  '和名': row['和名'],
                  '学名': fixedScientificName,
                  '食草': row['食草に関する備考'] || '',
                  '食草に関する備考': row['成虫の発生時期'] || '',
                  '成虫の発生時期': emergenceTime
                };
              }
              return row;
            });
            
            console.log('フユシャク CSV parsing successful, entries:', fuyushakuData.length);
          } catch (error) {
            console.warn('Failed to parse フユシャク CSV:', error);
            fuyushakuData = [];
          }
        } else {
          console.warn('フユシャク CSV data is empty or failed to load');
        }
        
        console.log("Parsed フユシャク data:", fuyushakuData.length, "entries");
        
        // Debug: Show first few entries of フユシャク data
        if (fuyushakuData.length > 0) {
          console.log('DEBUG: フユシャク.csv first few entries:', fuyushakuData.slice(0, 3));
          // Check if カバシタムクゲエダシャク exists
          const kabaShitaEntry = fuyushakuData.find(row => row['和名']?.trim() === 'カバシタムクゲエダシャク');
          if (kabaShitaEntry) {
            console.log('DEBUG: カバシタムクゲエダシャク found in フユシャク.csv raw data:', kabaShitaEntry);
            console.log('DEBUG: カバシタムクゲエダシャク scientific name length:', kabaShitaEntry['学名']?.length);
            console.log('DEBUG: カバシタムクゲエダシャク scientific name charCodes:', 
              kabaShitaEntry['学名']?.split('').map(c => c.charCodeAt(0)).join(', '));
          } else {
            console.log('DEBUG: カバシタムクゲエダシャク NOT found in フユシャク.csv');
            // Debug: show all 和名 in the data
            console.log('DEBUG: All 和名 in フユシャク data:', fuyushakuData.map(row => row['和名']).filter(Boolean));
          }
        }
        
        // Create comprehensive data maps from フユシャク data
        fuyushakuData.forEach(row => {
          const japaneseName = row['和名']?.trim();
          const scientificName = row['学名']?.trim();
          let emergenceTime = row['成虫の発生時期']?.trim();
          const hostPlants = row['食草']?.trim();
          const remarks = row['食草に関する備考']?.trim();
          
          // Fix for CSV parsing issue - check if real emergence time is in __parsed_extra
          if (row.__parsed_extra && row.__parsed_extra.length > 0) {
            const extraData = row.__parsed_extra[0]?.trim();
            if (extraData && (extraData.includes('月') || extraData.includes('上旬') || extraData.includes('中旬') || extraData.includes('下旬'))) {
              emergenceTime = extraData;
            }
          }
          
          // Debug log for カバシタムクゲエダシャク
          if (japaneseName === 'カバシタムクゲエダシャク') {
            console.log('DEBUG: Found カバシタムクゲエダシャク in フユシャク.csv:', {
              japaneseName,
              scientificName,
              hostPlants,
              remarks,
              emergenceTime
            });
          }
          
          // Store emergence time data from フユシャク (フユシャクCSVを優先 - より詳細で正確なデータ)
          if (japaneseName && emergenceTime && emergenceTime !== '不明') {
            // フユシャクCSVのデータを常に優先して上書き
            emergenceTimeMap.set(japaneseName, { time: emergenceTime, source: '日本のフユシャク' });
          }
          if (scientificName && emergenceTime && emergenceTime !== '不明') {
            // フユシャクCSVのデータを常に優先して上書き
            emergenceTimeMap.set(scientificName, { time: emergenceTime, source: '日本のフユシャク' });
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              emergenceTimeMap.set(cleanedScientificName, { time: emergenceTime, source: '日本のフユシャク' });
            }
          }
          
          // Store host plant information
          if (japaneseName && hostPlants) {
            fuyushakuHostPlantMap.set(japaneseName, hostPlants);
          }
          if (scientificName && hostPlants) {
            fuyushakuHostPlantMap.set(scientificName, hostPlants);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              fuyushakuHostPlantMap.set(cleanedScientificName, hostPlants);
            }
          }
          
          // Store remarks information
          if (japaneseName && remarks) {
            fuyushakuRemarksMap.set(japaneseName, remarks);
          }
          if (scientificName && remarks) {
            fuyushakuRemarksMap.set(scientificName, remarks);
            
            // Also store with author/year removed for better matching
            const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanedScientificName !== scientificName) {
              fuyushakuRemarksMap.set(cleanedScientificName, remarks);
            }
          }
        });

        console.log("Emergence time map created with", emergenceTimeMap.size, "entries");
        console.log("Sample entries:", Array.from(emergenceTimeMap.entries()).slice(0, 5));
        console.log("フユシャク host plant map size:", fuyushakuHostPlantMap.size);
        console.log("フユシャク クロスジフユエダシャク check:", fuyushakuHostPlantMap.get('クロスジフユエダシャク'));
        console.log("フユシャク Pachyerannis obliquaria check:", fuyushakuHostPlantMap.get('Pachyerannis obliquaria (Motschulsky, 1861)'));
        console.log("フユシャク Pachyerannis obliquaria (no author) check:", fuyushakuHostPlantMap.get('Pachyerannis obliquaria'));
        
        // Debug: Check if カバシタムクゲエダシャク is in the maps
        console.log("DEBUG: カバシタムクゲエダシャク in fuyushakuHostPlantMap:", fuyushakuHostPlantMap.get('カバシタムクゲエダシャク'));
        console.log("DEBUG: カバシタムクゲエダシャク in emergenceTimeMap:", emergenceTimeMap.get('カバシタムクゲエダシャク'));
        console.log("DEBUG: カバシタムクゲエダシャク in fuyushakuRemarksMap:", fuyushakuRemarksMap.get('カバシタムクゲエダシャク'));
        
        // Show all keys that contain カバシタ
        const kabaKeys = Array.from(fuyushakuHostPlantMap.keys()).filter(k => k && k.includes('カバシタ'));
        console.log("DEBUG: All keys containing カバシタ in fuyushakuHostPlantMap:", kabaKeys);

        // Function to clean and normalize scientific names for comparison
        const cleanScientificNameForComparison = (scientificName) => {
          if (!scientificName) return '';
          // Remove author/year information and normalize spacing
          let cleaned = scientificName.replace(/\s*\([^)]*\)\s*$/, ''); // Remove (Author, Year)
          cleaned = cleaned.replace(/\s*,\s*\d{4}\s*$/, ''); // Remove ", 1234"
          cleaned = cleaned.replace(/\s+/g, ' ').trim(); // Normalize spacing
          return cleaned.toLowerCase();
        };

        // Function to clean moth names by removing change annotations
        const cleanMothName = (name) => {
          if (!name) return name;
          // Remove various change annotations
          return name
            .replace(/\s*\([^)]*改称[^)]*\)/g, '')
            .replace(/\s*\([^)]*新称[^)]*\)/g, '')
            .replace(/\s*（[^）]*改称[^）]*）/g, '')
            .replace(/\s*（[^）]*新称[^）]*）/g, '')
            .trim();
        };

        // Function to merge duplicate moth entries based on scientific name
        const mergeMoths = (existing, newEntry) => {
          // Prioritize entries with catalog numbers
          const hasCatalogA = existing.id && existing.id.startsWith('main-') && existing.id !== 'main-0';
          const hasCatalogB = newEntry.id && newEntry.id.startsWith('main-') && newEntry.id !== 'main-0';
          
          // Determine which entry should be the base
          let baseEntry, otherEntry;
          if (hasCatalogA && !hasCatalogB) {
            baseEntry = existing;
            otherEntry = newEntry;
          } else if (!hasCatalogA && hasCatalogB) {
            baseEntry = newEntry;
            otherEntry = existing;
          } else {
            // Both have or both don't have catalog numbers
            // Prefer the one without change annotations
            const existingHasAnnotation = existing.name.includes('改称') || existing.name.includes('新称');
            const newEntryHasAnnotation = newEntry.name.includes('改称') || newEntry.name.includes('新称');
            
            if (existingHasAnnotation && !newEntryHasAnnotation) {
              baseEntry = newEntry;
              otherEntry = existing;
            } else if (!existingHasAnnotation && newEntryHasAnnotation) {
              baseEntry = existing;
              otherEntry = newEntry;
            } else {
              // Both or neither have annotations - use existing as base
              baseEntry = existing;
              otherEntry = newEntry;
            }
          }
          
          // Merge the entries
          return {
            ...baseEntry,
            name: cleanMothName(baseEntry.name),
            hostPlants: [...new Set([...baseEntry.hostPlants, ...otherEntry.hostPlants])],
            scientificName: baseEntry.scientificName || otherEntry.scientificName,
            // Merge other potentially useful fields
            instagramUrl: baseEntry.instagramUrl || otherEntry.instagramUrl,
            // Keep the more complete source information
            source: baseEntry.source || otherEntry.source
          };
        };

        // Function to deduplicate moths by scientific name
        const deduplicateMoths = (moths) => {
          const scientificNameMap = new Map();
          
          moths.forEach(moth => {
            const cleanScientificName = cleanScientificNameForComparison(moth.scientificName);
            if (!cleanScientificName) {
              // Keep entries without scientific names as-is
              scientificNameMap.set(moth.id, moth);
            } else if (scientificNameMap.has(cleanScientificName)) {
              // Merge with existing entry
              const existing = scientificNameMap.get(cleanScientificName);
              const merged = mergeMoths(existing, moth);
              scientificNameMap.set(cleanScientificName, merged);
            } else {
              scientificNameMap.set(cleanScientificName, moth);
            }
          });
          
          return Array.from(scientificNameMap.values());
        };

        // Centralized function to normalize plant names by removing family annotations
        const normalizePlantName = (plantName) => {
          if (!plantName || typeof plantName !== 'string') {
            return plantName;
          }
          
          // Remove family prefixes like "アカネ科ミサオノキ" -> "ミサオノキ", "ウマノスズクサ科ウマノスズクサ" -> "ウマノスズクサ"
          let normalized = plantName.replace(/^[^科]*科([のに]?)/g, ''); // Remove family prefixes like "科名の", "科名に", or just "科名"
          
          // Remove family annotations like "アカマツ（マツ科）" -> "アカマツ"
          normalized = normalized.replace(/（[^）]*科[^）]*）/g, ''); // Remove (科名) patterns
          normalized = normalized.replace(/\([^)]*科[^)]*\)/g, ''); // Remove (family) patterns
          
          // Remove "以上〇〇科" patterns more carefully to preserve plant names
          normalized = normalized.replace(/\(以上[^)]*科\)/g, ''); // Remove "(以上〇〇科)"
          normalized = normalized.replace(/（以上[^）]*科）/g, ''); // Remove "（以上〇〇科）"
          
          // Remove "ほか" and similar patterns
          normalized = normalized.replace(/ほか/g, '');
          
          // Remove incomplete parentheses like "オオカメノキ（" -> "オオカメノキ"
          normalized = normalized.replace(/（[^）]*$/g, ''); // Remove opening parentheses without closing
          normalized = normalized.replace(/\([^)]*$/g, ''); // Remove opening parentheses without closing
          // Only remove closing parentheses at the start if they look like orphaned closing parentheses
          normalized = normalized.replace(/^）/g, ''); // Remove orphaned closing parentheses at start
          normalized = normalized.replace(/^\)/g, ''); // Remove orphaned closing parentheses at start
          
          // Remove other common annotations
          normalized = normalized.replace(/（[^）]*）/g, ''); // Remove remaining parentheses
          normalized = normalized.replace(/\([^)]*\)/g, ''); // Remove remaining parentheses
          
          normalized = normalized.trim();
          
          // Comprehensive normalization for duplicate prevention
          // Convert full-width to half-width characters
          normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
          });
          
          // Normalize various dash and space characters  
          normalized = normalized.replace(/[－─━ー]/g, 'ー'); // Normalize different dash types
          normalized = normalized.replace(/\s+/g, ''); // Remove all spaces
          
          // Normalize punctuation marks
          normalized = normalized.replace(/[、，]/g, '、'); // Normalize commas
          normalized = normalized.replace(/[。．]/g, '。'); // Normalize periods
          
          // Handle synonyms and variations - consolidate different names for the same plant
          const synonymMap = {
            'セイヨウリンゴ': 'リンゴ',
            'セイヨウナシ': 'ナシ',
            'セイヨウカラシナ': 'カラシナ',
            'セイヨウタンポポ': 'タンポポ',
            'セイヨウミザクラ': 'ミザクラ',
            'セイヨウアブラナ': 'アブラナ',
            'セイヨウハコヤナギ': 'ハコヤナギ',
            'ヨーロッパリンゴ': 'リンゴ',
            'ヨーロッパナシ': 'ナシ',
            // Common variations
            'アカマツ': 'アカマツ',
            'クロマツ': 'クロマツ',
            'ニホンアカマツ': 'アカマツ',
            'ニホンクロマツ': 'クロマツ',
            // Remove common modifiers that don't change the essential plant
            'ヤマザクラ類': 'ヤマザクラ',
            'サクラ類': 'サクラ',
            'カエデ類': 'カエデ',
            'ヤナギ類': 'ヤナギ'
          };
          
          // Apply synonym mapping
          if (synonymMap[normalized]) {
            normalized = synonymMap[normalized];
          }
          
          // Handle generic terms like "類" at the end
          normalized = normalized.replace(/類$/, '');
          
          return normalized;
        };
        
        // Function to check if a plant entry is already in the hostPlantEntries array
        const isDuplicateEntry = (hostPlantEntries, newEntry) => {
          const normalizedNewPlant = normalizePlantName(newEntry.plant);
          const newBasePlant = newEntry.plant.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '');
          const normalizedNewBasePlant = normalizePlantName(newBasePlant);
          
          return hostPlantEntries.some(existingEntry => {
            const normalizedExistingPlant = normalizePlantName(existingEntry.plant);
            const existingBasePlant = existingEntry.plant.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '');
            const normalizedExistingBasePlant = normalizePlantName(existingBasePlant);
            
            // Check for exact match on normalized plant names
            if (normalizedNewPlant === normalizedExistingPlant) {
              return true;
            }
            
            // Check for base plant match (without part information)
            if (normalizedNewBasePlant === normalizedExistingBasePlant && 
                normalizedNewBasePlant.length > 1) {
              return true;
            }
            
            // Check for partial matches that indicate the same plant
            if (normalizedNewBasePlant.includes(normalizedExistingBasePlant) && 
                normalizedExistingBasePlant.length > 2) {
              return true;
            }
            
            if (normalizedExistingBasePlant.includes(normalizedNewBasePlant) && 
                normalizedNewBasePlant.length > 2) {
              return true;
            }
            
            return false;
          });
        };
        
        // Helper function to add entry to hostPlantEntries with duplicate checking
        const addPlantEntry = (hostPlantEntries, plant, condition = '', familyFromMainCsv = '') => {
          const newEntry = {
            plant: plant,
            condition: condition,
            familyFromMainCsv: familyFromMainCsv
          };
          
          // Only add if not duplicate
          if (!isDuplicateEntry(hostPlantEntries, newEntry)) {
            hostPlantEntries.push(newEntry);
            return true; // Successfully added
          }
          return false; // Duplicate, not added
        };
        
        // Centralized function to validate plant names
        const isValidPlantName = (plantName) => {
          // Basic validation - must be a string with reasonable length
          if (!plantName || typeof plantName !== 'string' || plantName.length < 2) {
            return false;
          }
          
          // Remove whitespace for testing
          const trimmed = plantName.trim();
          
          // Reject if only numbers or only English letters
          if (/^[0-9]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
            return false;
          }
          
          // Reject catalog numbers with special characters like "10+12"
          if (/^[0-9+\-]+$/.test(trimmed)) {
            return false;
          }
          
          // Reject if it contains time period information (月旬, 月頃, etc.)
          if (/[0-9０-９]月[上中下]旬/.test(trimmed) || /[0-9０-９]月頃/.test(trimmed)) {
            return false;
          }
          
          // Reject if it starts with time period information
          if (/^[0-9０-９]+月/.test(trimmed)) {
            return false;
          }
          
          // Reject temporal/descriptive phrases
          if (/^(早春|春|初夏|夏|秋|冬|晩秋|初冬)/.test(trimmed)) {
            return false;
          }
          
          // Reject if it's a descriptive phrase about collection/observation
          if (/野外で|雑木林|林床|落葉から|幼虫が得られ|採卵では|による飼育|で飼育|から記録/.test(trimmed)) {
            return false;
          }
          
          // Reject taxonomic/descriptive phrases that are not plant names
          if (/次種が分離される前の情報として|従来の記録は次種と混同|本種か次種|次種との区別/.test(trimmed)) {
            return false;
          }
          
          // Reject specific problematic taxonomic phrases
          if (/^次種との区別はついていない。台湾では$|^従来の記録は次種と混同している可能性があるので再検討を要する。$|^本種か次種ニセスジシロキヨトウの食草なのかは判断できない。$/.test(trimmed)) {
            return false;
          }
          
          // Reject if it's a long sentence (likely a description, not a plant name)
          if (trimmed.length > 50 && (trimmed.includes('野外で') || trimmed.includes('から記録') || trimmed.includes('飼育下で'))) {
            return false;
          }
          
          // Reject taxonomic abbreviations and notations
          const taxonomicPatterns = [
            /^comb\.\s*nov\.?$/i,
            /^sp\.?$/i,
            /^spp\.?$/i,
            /^var\.?$/i,
            /^subsp\.?$/i,
            /^f\.?$/i,
            /^emend\.?$/i,
            /^nom\.\s*nud\.?$/i,
            /^auct\.?$/i,
            /^non$/i,
            /^sensu$/i,
            /^cf\.?$/i,
            /^aff\.?$/i
          ];
          
          for (const pattern of taxonomicPatterns) {
            if (pattern.test(trimmed)) {
              return false;
            }
          }
          
          // Reject year patterns in parentheses like "1878)" or "(1766)"
          if (/^\d{4}\)?$/.test(trimmed) || /^[（(]\d{4}[）)]?$/.test(trimmed)) {
            return false;
          }
          
          // Reject author names (common patterns) like "Butler, 1878"
          if (/^[（(]?[A-Z][a-z]+[,\s]+\d{4}[）)]?$/.test(trimmed)) {
            return false;
          }
          
          // Allow family names (ending with '科') as valid plant names
          if (trimmed.endsWith('科')) {
            return true;
          }
          
          // Allow plant names with family info in parentheses like "ムギ類(イネ科)"
          if (/[ぁ-んァ-ヶー一-龠]+.*[\(（][^)）]*科[\)）]/.test(trimmed)) {
            return true;
          }
          
          const invalidPatterns = [
            /^[0-9]+$/,  // Pure numbers
            /^[A-Za-z]+$/, // Pure English letters
            /^[0-9+\-]+$/, // Catalog numbers like "10+12"
            /^\s*[0-9]{4}\)"?\s*$/, // Year patterns like "1763)"
            /^\s*[0-9]{4}"?\s*$/, // Simple year patterns like "1763"
            /（[^）]*$/, // Incomplete opening parentheses like "オオカメノキ（"
            /^[^（]*）/, // Incomplete closing parentheses like "）スイカズラ科"
            /\([^)]*$/, // Incomplete opening parentheses (half-width)
            /^[^(]*\)/, // Incomplete closing parentheses (half-width)
            /^[\u3001-\u3006\u3008-\u3011\u3013-\u301f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\u2000-\u206f\u2e00-\u2e7f!-\/:-@\[-`{-~]+$/, // Only symbols/punctuation
            /^["'\u201c\u201d\u2018\u2019()\[\]{}\-\u2010-\u2015_=+|\\;:,.<>/?~`!@#$%^&*]+$/, // Common symbols
            /国外/,
            /各種/,
            /以上/,
            /記録/,
            /知られ/,
            /観察/,
            /確認/,
            /報告/,
            /台湾/,
            /沖縄/,
            /ヨーロッパ/,
            /ハワイ/,
            /時に/,
            /害虫/,
            /被害/,
            /食べ/,
            /食す/,
            /育つ/,
            /成長/,
            /飼育/,
            /判明/,
            /植物/,
            /樹木/,
            /草本/,
            /広食性/,
            /多食性/,
            /単食性/,
            /ほか/,
            /^の$/,
            /^を$/,
            /^が$/,
            /^で$/,
            /^に$/,
            /^は$/,
            /^と$/,
            /^や$/,
            /^も$/,
            /^から$/,
            /^まで$/,
            /^では$/,
            /^でも$/,
            /^として$/,
            /^による$/,
            /^からの$/,
            /^への$/,
            /^との$/,
            /^での$/,
            /^によって$/,
            /^において$/,
            /^について$/,
            /^に関して$/,
            /^に対して$/,
            /^によれば$/,
            /^によると$/
          ];
          
          return !invalidPatterns.some(pattern => pattern.test(trimmed));
        };

        // Parse wamei_checklist_ver.1.10.csv with error handling
        let wameiMap = {};
        let wameiFamilyMap = {};
        let correctMothNames = new Set();
        
        if (wameiText) {
          try {
            console.log("Parsing wamei checklist data...");
            const wameiParsed = Papa.parse(wameiText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (wameiParsed.errors.length) {
              console.error("PapaParse errors in wamei_checklist_ver.1.10.csv:", wameiParsed.errors);
            }
            
            wameiParsed.data.forEach(row => {
              const allName = row['all_name']?.trim();
              const hubName = row['Hub name']?.trim();
              const familyJp = row['Family name (JP)']?.trim();
              if (allName) correctMothNames.add(allName);
              if (hubName) correctMothNames.add(hubName);
              if (allName && hubName) {
                wameiMap[allName] = hubName;
                // Debug ツバキ-related mappings
                if ((allName && allName.includes('ツバキ')) || (hubName && hubName.includes('ツバキ'))) {
                  console.log(`DEBUG: wameiMap ツバキ mapping: "${allName}" -> "${hubName}"`);
                }
              }
              if (hubName && familyJp) wameiFamilyMap[hubName] = familyJp;
            });
            console.log("wamei_checklist_ver.1.10.csv parsed successfully. wameiMap size:", Object.keys(wameiMap).length);
          } catch (error) {
            console.error("Error parsing wamei checklist data:", error);
            console.warn("Continuing without wamei checklist data - moth name validation may be incomplete");
          }
        } else {
          console.warn("Wamei checklist data not available - moth name validation will be limited");
        }

        // 和名クリーニング処理 - 余計な文字や引用符を除去
        const cleanJapaneseName = (name) => {
          if (!name) return name;
          
          let cleaned = name;
          
          // 外側の余計な引用符を除去
          if (cleaned.startsWith('"""') && cleaned.endsWith('"""')) {
            cleaned = cleaned.slice(3, -3);
          } else if (cleaned.startsWith('""') && cleaned.endsWith('""')) {
            cleaned = cleaned.slice(2, -2);
          } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
          }
          
          // パターンマッチングで問題のある形式を修正
          
          // パターン1: "未知"和名 -> 和名
          const pattern1 = /^"*未知"*"*(.+?)$/;
          const match1 = cleaned.match(pattern1);
          if (match1) {
            cleaned = match1[1].replace(/"/g, '');
          }
          
          // パターン2: "説明文(植物科名を含む)"和名 -> 和名
          const pattern2 = /^"*[^"]*(?:科)[^"]*"*"*([^"]+?)$/;
          const match2 = cleaned.match(pattern2);
          if (match2) {
            const candidate = match2[1].replace(/"/g, '');
            // 和名っぽい文字列かチェック（カタカナ+ひらがなの組み合わせ）
            if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
              cleaned = candidate;
            }
          }
          
          // パターン3: "〜という"和名 -> 和名
          const pattern3 = /^"*[^"]+という"*"*([^"]+?)$/;
          const match3 = cleaned.match(pattern3);
          if (match3) {
            const candidate = match3[1].replace(/"/g, '');
            if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
              cleaned = candidate;
            }
          }
          
          // パターン4: "説明文。説明文"和名 -> 和名
          const pattern4 = /^"*[^"]+。[^"]*"*"*([^"]+?)$/;
          const match4 = cleaned.match(pattern4);
          if (match4) {
            const candidate = match4[1].replace(/"/g, '');
            if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
              cleaned = candidate;
            }
          }
          
          // パターン5: 特別なケース - "。〜"和名 -> 和名
          if (cleaned.startsWith('。')) {
            const pattern5 = /^。[^"]*"*([^"]+?)$/;
            const match5 = cleaned.match(pattern5);
            if (match5) {
              const candidate = match5[1].replace(/"/g, '');
              if (/^[ァ-ヶあ-ん]+$/.test(candidate)) {
                cleaned = candidate;
              }
            }
          }
          
          // 残った余計な引用符を除去
          cleaned = cleaned.replace(/"/g, '');
          
          // 空白文字の正規化
          cleaned = cleaned.trim();
          
          return cleaned;
        };

        const correctMothName = (name) => {
          // まず和名をクリーニング
          const cleanedName = cleanJapaneseName(name);
          
          if (correctMothNames.has(cleanedName)) {
            return cleanedName;
          }
          const corrections = {
            'パ': 'バ', 'ピ': 'ビ', 'プ': 'ブ', 'ペ': 'ベ', 'ポ': 'ボ',
            'ガ': 'カ', 'ギ': 'キ', 'グ': 'ク', 'ゲ': 'ケ', 'ゴ': 'コ',
            'ザ': 'サ', 'ジ': 'シ', 'ズ': 'ス', 'ゼ': 'セ', 'ゾ': 'ソ',
            'ダ': 'タ', 'ヂ': 'チ', 'ヅ': 'ツ', 'デ': 'テ', 'ド': 'ト',
          };
          let correctedName = cleanedName;
          for (const [wrong, correct] of Object.entries(corrections)) {
            if (correctedName.includes(wrong)) {
              const tempName = correctedName.replace(new RegExp(wrong, 'g'), correct);
              if (correctMothNames.has(tempName)) {
                return tempName;
              }
            }
          }
          return cleanedName;
        };

        const formatScientificNameForFilename = (scientificName) => {
          if (!scientificName) return '';
          console.log("Original scientificName:", scientificName);
          // Remove anything in parentheses, or from ( to end of string if no closing parenthesis
          let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
          // Remove common author/year patterns at the end of the string
          cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, ''); // e.g., ", 1766"
          cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, ''); // e.g., "Hufnagel 1766" or "Hufnagel, 1766"
          // More specific pattern to remove author names - only remove if it's after a binomial name
          cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1'); // e.g., "Genus species Author"
          // Keep only alphanumeric characters and spaces
          cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
          // Replace spaces with underscores
          cleanedName = cleanedName.replace(/\s/g, '_');
          console.log("Cleaned scientificName for filename:", cleanedName);
          return cleanedName;
        };

        // Parse 20210514YList_download.csv with error handling
        let yListPlantFamilyMap = {};
        let yListPlantScientificNameMap = {};
        let yListPlantAliasMap = {};
        let yListPlantNames = new Set();
        
        if (yListText) {
          try {
            console.log("Parsing YList data...");
            const yListParsed = Papa.parse(yListText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (yListParsed.errors.length) {
              console.error("PapaParse errors in 20210514YList_download.csv:", yListParsed.errors);
            }
            
            yListParsed.data.forEach(row => {
              const plantName = row['和名']?.trim();
              const familyJp = row['LAPG 科名']?.trim();
              const scientificName = row['学名']?.trim();
              const aliases = row['別名']?.trim();

              if (plantName) {
                yListPlantNames.add(plantName);
                // Debug ツバキ-related plants in YList
                if (plantName.includes('ツバキ')) {
                  console.log(`DEBUG: YList ツバキ plant added: "${plantName}"`);
                }
              }
              if (plantName && familyJp) {
                yListPlantFamilyMap[plantName] = familyJp;
              }
              if (plantName && scientificName) {
                yListPlantScientificNameMap[plantName] = scientificName;
              }
              if (plantName && aliases) {
                // Parse aliases - they can be separated by commas or Japanese comma
                const aliasList = aliases.split(/[,，]/).map(alias => alias.trim()).filter(alias => alias.length > 0);
                if (aliasList.length > 0) {
                  yListPlantAliasMap[plantName] = aliasList;
                }
              }
            });
            console.log("20210514YList_download.csv parsed successfully. yListPlantFamilyMap size:", Object.keys(yListPlantFamilyMap).length);
            console.log("20210514YList_download.csv parsed successfully. yListPlantScientificNameMap size:", Object.keys(yListPlantScientificNameMap).length);
            console.log("20210514YList_download.csv parsed successfully. yListPlantAliasMap size:", Object.keys(yListPlantAliasMap).length);
          } catch (error) {
            console.error("Error parsing YList data:", error);
            console.warn("Continuing without YList data - plant family information may be incomplete");
          }
        } else {
          console.warn("YList data not available - plant family information will be limited");
        }

        // 非維管束植物のリスト
        const nonVascularPlants = new Set([
          // 地衣類一般
          '地衣類', '粉状地衣類', '葉状地衣類', '殻状地衣類',
          
          // 地衣類の属・種
          'キゴケ属', 'Stereocaulon', 'Chloridium', 'Dematium',
          '明褐色の粉状地衣類', '明るい緑色の粉状地衣類', '黒褐色の粉状地衣類',
          '白緑色の粉状地衣類', '樹皮上の地衣類', '岩石表面上の白緑色の粉状地衣類',
          '岩や木をおおう地衣類', '樹皮表面上の地衣類',
          
          // 菌類
          'キノコ類', 'サルノコシカケ類', 'カビ類',
          'ツリガネタケ', 'エブリコ', 'ヒトクチタケ', 'オオミダレアミタケ',
          'エノキタケ', 'シイタケ',
          
          // 蘚苔類
          'コケ', '蘚類', '苔類', 'ジャゴケ', 'マキノゴケ', 'オオウロコゴケ',
          
          // 藻類
          '陸生緑色藻類', '陸生藻類',
          
          // 動物質・有機物
          '昆虫の死骸', '動物の毛', '羽毛', '毛織物', '動物の毛皮', '魚粉',
          '花粉団子', 'ロウ物質', '動物の糞', '猛禽類のペリット',
          
          // 植物の非生体部分
          '樹皮', '腐朽木', '朽木', '根', '根茎', '腐葉土', '枯葉',
          '腐敗した植物', 'コルク', '綿', '腐敗した植物質',
          
          // その他の微生物
          'イシクラゲ', 'ノストック'
        ]);

        // 属レベルから種レベルへの展開マップ
        const taxonomicHierarchy = {
          'コナラ属': ['コナラ', 'ミズナラ', 'アラカシ', 'ウラジロガシ', 'ウバメガシ', 'クヌギ', 'カシワ'],
          'ヤナギ属': ['シダレヤナギ', 'ネコヤナギ', 'タチヤナギ', 'オノエヤナギ', 'キツネヤナギ', 'ヤマネコヤナギ'],
          'ブナ属': ['ブナ'],
          'カエデ属': ['イタヤカエデ', 'ウリハダカエデ', 'イロハモミジ', 'ウリカエデ', 'オガラバナ'],
          'マツ属': ['アカマツ', 'クロマツ', 'キタゴヨウ', 'チョウセンゴヨウ', 'ヨーロッパアカマツ', 'ストローブマツ'],
          'サクラ属': ['サクラ', 'ヤマザクラ', 'オオシマザクラ', 'エドヒガン', 'ウメ', 'モモ'],
          'バラ属': ['ノイバラ', 'テリハノイバラ'],
          'キイチゴ属': ['キイチゴ', 'クマイチゴ', 'ナワシロイチゴ'],
          'ヤマナラシ属': ['ヤマナラシ', 'セイヨウハコヤナギ'],
          'モミ属': ['モミ', 'トドマツ'],
          'トウヒ属': ['エゾマツ', 'トウヒ'],
          'タンポポ属': ['タンポポ', 'セイヨウタンポポ'],
          'カナメモチ属': ['カナメモチ'],
          'マテバシイ属': ['マテバシイ'],
          'イチイ属': ['イチイ'],
          'シナノキ属': ['シナノキ'],
          'ハッカ属': ['ハッカ'],
          'オランダイチゴ属': ['オランダイチゴ'],
          'ヒメオドリコソウ属': ['ヒメオドリコソウ'],
          'イヌゴマ属': ['イヌゴマ'],
          'ニガハッカ属': ['ニガハッカ']
        };

        // 記述的表現のリスト
        const descriptiveTerms = new Set([
          '各種広葉樹', '各種針葉樹', 'ヤナギ類', 'マツ類', 'ナラ類',
          '各種', '広食性', '多食性', '各種樹木', '草本類'
        ]);

        const correctPlantName = (name) => {
          // Special debug for ツバキ-related plants
          if (name && (name.includes('ツバキ') || name.includes('ヤブツバキ') || name.includes('ユキツバキ'))) {
            console.log(`DEBUG: ツバキ-related plant correction: input="${name}"`);
          }
          
          // 1. 直接マッチ（最優先）
          if (yListPlantNames.has(name)) {
            if (name && name.includes('ツバキ')) {
              console.log(`DEBUG: ツバキ plant found directly in YList: "${name}"`);
            }
            return name;
          }

          // 2. 非維管束植物チェック
          if (nonVascularPlants.has(name)) {
            return name;
          }
          
          // 2.5. 地名・地域名を除外
          const geographicNames = new Set([
            '小笠原諸島', '小笠原', '沖縄島', '沖縄', '本州', '北海道', '九州', '四国',
            '屋久島', '奄美', '伊豆諸島', '伊豆', '対馬', '五島', '種子島',
            '日本', '中国', '台湾', '朝鮮', '韓国', 'アジア', 'アメリカ', 'ヨーロッパ', 'アフリカ'
          ]);
          
          if (geographicNames.has(name) || /諸島$|島では$|地方$|県$|市$|区$/.test(name)) {
            console.log(`DEBUG: Plant "${name}" is a geographic location, returning null`);
            return '';  // Return empty string to filter out
          }

          // 3. 記述的表現チェック
          if (descriptiveTerms.has(name)) {
            return name;
          }
          
          // 4. 括弧付き植物名の処理（例：「ムギ類(イネ科)」）
          if (name.includes('(') || name.includes('（')) {
            // Return the original name with family info
            return name;
          }

          // 5. 属レベル展開
          if (name.endsWith('属')) {
            const genusPlants = taxonomicHierarchy[name] || [];
            const validPlants = genusPlants.filter(p => yListPlantNames.has(p));
            if (validPlants.length > 0) {
              // 代表種を返す（最初の有効な種）
              return validPlants[0];
            }
          }

          // 5. 文字補正
          const corrections = {
            'パ': 'バ',
            'ピ': 'ビ',
            'プ': 'ブ',
            'ペ': 'ベ',
            'ポ': 'ボ',
            'ガ': 'カ',
            'ギ': 'キ',
            'グ': 'ク',
            'ゲ': 'ケ',
            'ゴ': 'コ',
          };
          let correctedName = name;
          for (const [wrong, correct] of Object.entries(corrections)) {
            if (correctedName.includes(wrong)) {
              const tempName = correctedName.replace(new RegExp(wrong, 'g'), correct);
              if (yListPlantNames.has(tempName)) {
                return tempName;
              }
            }
          }

          // 6. 「類」の展開処理
          if (name.endsWith('類')) {
            // ツバキ類 -> ヤブツバキ（YListで標準名として存在）
            const groupExpansions = {
              'ツバキ類': 'ヤブツバキ',
              'ヤナギ類': 'シダレヤナギ',
              'マツ類': 'アカマツ',
              'ナラ類': 'コナラ',
              'カエデ類': 'イタヤカエデ',
              'サクラ類': 'ヤマザクラ'
            };
            
            const expanded = groupExpansions[name];
            if (name === 'ツバキ類') {
              console.log(`DEBUG: ツバキ類 expansion - expanded to: ${expanded}, exists in YList: ${yListPlantNames.has(expanded)}`);
            }
            if (expanded && yListPlantNames.has(expanded)) {
              console.log(`DEBUG: Expanded ${name} to ${expanded}`);
              return expanded;
            }
            
            // 記述的表現として扱う
            return name;
          }
          
          // 7. 見つからない場合は元の名前を返す（YListにない植物も表示する）
          console.log(`DEBUG: Plant "${name}" not found in YList, keeping original name`);
          return name;
        };

        // Process hamushi_species.csv first to create hamushiMap with error handling
        let hamushiMap = {};
        if (hamushiSpeciesText) {
          try {
            console.log("Parsing hamushi species data...");
            const hamushiParsed = Papa.parse(hamushiSpeciesText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (hamushiParsed.errors.length) {
              console.error("PapaParse errors in hamushi_species.csv:", hamushiParsed.errors);
            }
            
            hamushiParsed.data.forEach(row => {
              const name = row['和名']?.trim();
              if (name) {
                hamushiMap[name] = row;
              }
            });
            console.log("Hamushi species data parsed successfully. hamushiMap size:", Object.keys(hamushiMap).length);
          } catch (error) {
            console.error("Error parsing hamushi species data:", error);
            console.warn("Continuing without hamushi species data - detailed hamushi information may be incomplete");
          }
        } else {
          console.warn("Hamushi species data not available - detailed hamushi information will be limited");
        }


        // Process mainText
        const mainMothData = [];
        mainBeetleData = [];
        Papa.parse(mainText, {
          header: true,
          skipEmptyLines: 'greedy',
          delimiter: ',',
          quoteChar: '"',
          escapeChar: '"',
          transform: (value) => {
            // Clean up malformed quote escaping
            if (typeof value === 'string') {
              return value.replace(/^"|"$/g, '');
            }
            return value;
          },
          complete: (results) => {
            if (results.errors.length) {
              console.error("PapaParse errors in ListMJ_hostplants_master.csv:", results.errors);
            }
            
            // Pre-scan for センモンヤガ and カバシタムクゲエダシャク
            console.log('=== MAIN CSV PARSED - SEARCHING FOR センモンヤガ AND カバシタムクゲエダシャク ===');
            const senmonYagaPreScan = results.data.filter((row, idx) => {
              const matchesName = row['和名'] === 'センモンヤガ' || row['大図鑑和名'] === 'センモンヤガ';
              const matchesCatalog = row['大図鑑カタログNo'] === '3489';
              if (matchesName || matchesCatalog) {
                console.log(`Pre-scan found センモンヤガ at row ${idx}:`, {
                  和名: row['和名'],
                  大図鑑和名: row['大図鑑和名'],
                  カタログNo: row['大図鑑カタログNo'],
                  食草: row['食草'] ? row['食草'].substring(0, 50) + '...' : 'EMPTY',
                  食草length: row['食草'] ? row['食草'].length : 0
                });
              }
              return matchesName || matchesCatalog;
            });
            
            const kabaShitaPreScan = results.data.filter((row, idx) => {
              const matchesName = row['和名'] === 'カバシタムクゲエダシャク';
              if (matchesName) {
                console.log(`Pre-scan found カバシタムクゲエダシャク at row ${idx}:`, {
                  和名: row['和名'],
                  学名: row['学名']?.substring(0, 50),
                  食草: row['食草'] ? row['食草'].substring(0, 50) + '...' : 'EMPTY',
                  食草full: row['食草'],
                  備考: row['備考'] ? row['備考'].substring(0, 50) + '...' : 'EMPTY',
                  備考full: row['備考'],
                  全カラム: Object.keys(row).map(key => `${key}: ${row[key]}`).join(' | ')
                });
              }
              return matchesName;
            });
            
            console.log(`Total センモンヤガ entries found in pre-scan: ${senmonYagaPreScan.length}`);
            console.log(`Total カバシタムクゲエダシャク entries found in pre-scan: ${kabaShitaPreScan.length}`);
            console.log('=== END PRE-SCAN ===');
            
            // COLUMN MISALIGNMENT FIX - Fix rows where scientific names are shifted to wrong columns
            console.log('=== FIXING COLUMN MISALIGNMENT ===');
            let fixedRows = 0;
            results.data.forEach((row, index) => {
              const japaneseName = row['和名']?.trim();
              const scientificName = row['学名']?.trim();
              const hostPlants = row['食草']?.trim();
              const source = row['出典']?.trim();
              
              // Detect column misalignment: if 学名 contains food plant data and 食草 contains source data
              if (japaneseName && scientificName && hostPlants && 
                  (scientificName === '広食性' || scientificName === '不明' || 
                   scientificName.includes('科') || scientificName.includes('種') ||
                   scientificName.includes('属') || scientificName.includes('草')) &&
                  (hostPlants.includes('図鑑') || hostPlants.includes('標準') || 
                   hostPlants === '日本産蛾類標準図鑑1')) {
                
                console.log(`Fixing column misalignment for ${japaneseName} at row ${index + 2}`);
                console.log(`  Before: 学名="${scientificName}", 食草="${hostPlants}", 出典="${source}"`);
                
                // Shift values to correct positions
                row['学名'] = ''; // Clear scientific name (it was incorrect)
                row['食草'] = scientificName; // Move the food plant data to correct column
                row['出典'] = hostPlants; // Move the source data to correct column
                row['備考'] = source || ''; // Move whatever was in source to remarks
                
                console.log(`  After:  学名="${row['学名']}", 食草="${row['食草']}", 出典="${row['出典']}"`);
                fixedRows++;
              }
            });
            console.log(`Fixed ${fixedRows} rows with column misalignment`);
            console.log('=== END COLUMN MISALIGNMENT FIX ===');
            
            results.data.forEach((row, index) => {
              const originalMothName = row['和名']?.trim();
              if (!originalMothName) return;
              
              // Debug logging for スミレモンキリガ
              if (originalMothName.includes('スミレモンキリガ')) {
                console.log(`DEBUG: Found スミレモンキリガ at index ${index}:`, {
                  originalMothName,
                  hostPlants: row['食草'],
                  willBeId: `main-${index}`
                });
              }
              
              // Debug logging for センモンヤガ
              if (originalMothName === 'センモンヤガ') {
                console.log(`DEBUG: Found センモンヤガ at index ${index}:`, {
                  originalMothName,
                  catalogNo: row['大図鑑カタログNo'],
                  hostPlants: row['食草'],
                  remarks: row['備考'],
                  fullRow: row
                });
              }
              
              // Skip entries where source appears to be in the moth name field (malformed data)
              if (originalMothName === '日本産タマムシ大図鑑' || originalMothName.includes('大図鑑')) return;

              const mothName = correctMothName(originalMothName);
              
              // Debug for アオバシャチホコ CSV読み込み
              if (mothName === 'アオバシャチホコ') {
                console.log('=== アオバシャチホコ CSV読み込み ===');
                console.log('行番号:', index);
                console.log('元の食草データ:', row['食草']);
                console.log('科情報:', row['科']);
                console.log('大図鑑カタログNo:', row['大図鑑カタログNo']);
              }
              
              // Debug logging for フクラスズメ and related species (temporarily disabled)
              // if (mothName === 'フクラスズメ' || mothName === 'ホリシャキシタケンモン' || mothName === 'マルバネキシタケンモン') {
              //   console.log(`DEBUG: Processing ${mothName} at index ${index}, ID will be main-${index}`);
              //   console.log(`DEBUG: Food plants field:`, row['食草']);
              // }
              
              
              const genus = row['属名'] || '';
              const species = row['種小名'] || '';
              const author = row['著者'] || '';
              const year = row['公表年'] || '';
              
              let scientificName = processScientificName(row['学名'], genus, species, author, year, 'moth');
              
              // Validate scientific name quality
              const validationResult = validateScientificName(scientificName, mothName, 'moth');
              
              const scientificFilename = formatScientificNameForFilename(scientificName);
              

              let familyFromMainCsv = row['科和名'] || row['科名'] || '';
              
              // Special handling for hamaki moths from "日本のハマキガ" source
              const source = row['出典'] || '';
              const isHamakiFromBook = source.includes('日本のハマキガ');
              
              if (isHamakiFromBook && !familyFromMainCsv) {
                familyFromMainCsv = 'ハマキガ科';
              }
              
              // Check if this is a beetle (Buprestidae family)
              const isBeetle = familyFromMainCsv === 'タマムシ科' || row['科名'] === 'Buprestidae';

              const classification = {
                family: row['科名'] || (isHamakiFromBook ? 'Tortricidae' : ''), 
                familyJapanese: row['科和名'] || (isHamakiFromBook ? 'ハマキガ科' : ''), 
                subfamily: row['亜科名'] || '',
                subfamilyJapanese: row['亜科和名'] || '', tribe: row['族名'] || '', tribeJapanese: row['族和名'] || '',
                subtribe: row['亜族名'] || '', subtribeJapanese: row['亜族和名'] || '', genus: row['属名'] || '',
                subgenus: row['亜属名'] || '', speciesEpithet: row['種小名'] || '', subspeciesEpithet: row['亜種小名'] || '',
              };

              // Improved host plant parsing with validation
              let rawHostPlant = row['食草'] || '';
              let rawRemarks = row['備考'] || '';
              const hostPlantNotes = []; // Initialize hostPlantNotes array here
              
              
              // Debug logging for カバシタムクゲエダシャク processing
              if (mothName === 'カバシタムクゲエダシャク') {
                console.log('=== カバシタムクゲエダシャク PROCESSING DEBUG ===');
                console.log('rawHostPlant from CSV:', rawHostPlant);
                console.log('rawRemarks from CSV:', rawRemarks);
                console.log('Original row data:', {
                  食草: row['食草'],
                  備考: row['備考'],
                  学名: row['学名'],
                  和名: row['和名']
                });
              }
              
              // Debug logging for センモンヤガ host plant processing
              if (mothName === 'センモンヤガ' || row['大図鑑カタログNo'] === '3489') {
                console.log(`DEBUG: Processing センモンヤガ host plants:`, {
                  mothName,
                  rawHostPlant,
                  rawRemarks,
                  hasHostPlant: !!rawHostPlant,
                  hostPlantLength: rawHostPlant.length,
                  catalogNo: row['大図鑑カタログNo'],
                  fullRow: row
                });
              }
              
              // Function to extract and integrate plant part information
              // Enhanced function to extract plant parts and clean plant names
              const extractPlantPartsAndCleanNames = (text) => {
                const partPatterns = [
                  { pattern: /の花(?:弁|びら)?/g, part: '花' },
                  { pattern: /の花/g, part: '花' },
                  { pattern: /の実/g, part: '実' },
                  { pattern: /の果実/g, part: '実' },
                  { pattern: /の種子/g, part: '種子' },
                  { pattern: /の葉/g, part: '葉' },
                  { pattern: /の若葉/g, part: '若葉' },
                  { pattern: /の新葉/g, part: '新葉' },
                  { pattern: /の古葉/g, part: '古葉' },
                  { pattern: /の樹皮/g, part: '樹皮' },
                  { pattern: /の幹/g, part: '幹' },
                  { pattern: /の枝/g, part: '枝' },
                  { pattern: /の茎/g, part: '茎' },
                  { pattern: /の根/g, part: '根' },
                  { pattern: /の蕾/g, part: '蕾' },
                  { pattern: /の芽/g, part: '芽' }
                ];
                
                const extractedParts = new Map();
                let cleanedText = text;
                
                // First, handle simple patterns like "ツバキの花"
                partPatterns.forEach(({ pattern, part }) => {
                  // Look for standalone plant+part combinations
                  const standalonePattern = new RegExp(`([ア-ン一-龯ァ-ヶー]{2,})${pattern.source.replace(/\/g$/, '')}`, 'g');
                  const standaloneMatches = [...text.matchAll(standalonePattern)];
                  
                  standaloneMatches.forEach(match => {
                    const plantName = match[1];
                    if (!extractedParts.has(plantName)) {
                      extractedParts.set(plantName, []);
                    }
                    if (!extractedParts.get(plantName).includes(part)) {
                      extractedParts.get(plantName).push(part);
                    }
                    // Remove the part from the text, keeping only the plant name
                    cleanedText = cleanedText.replace(match[0], plantName);
                  });
                  
                  // Also handle the original pattern for complex text
                  const matches = [...text.matchAll(pattern)];
                  matches.forEach(match => {
                    // Extract plant name before the part
                    const beforeMatch = text.substring(0, match.index);
                    const plantMatch = beforeMatch.match(/([ア-ン一-龯ァ-ヶー]{2,})$/);
                    if (plantMatch) {
                      const plantName = plantMatch[1];
                      if (!extractedParts.has(plantName)) {
                        extractedParts.set(plantName, []);
                      }
                      if (!extractedParts.get(plantName).includes(part)) {
                        extractedParts.get(plantName).push(part);
                      }
                    }
                  });
                });
                
                return { parts: extractedParts, cleanedText: cleanedText };
              };
              
              // Legacy function for backward compatibility
              const extractPlantParts = (text) => {
                return extractPlantPartsAndCleanNames(text).parts;
              };
              
              // Extract plant parts from both food plants and remarks
              const plantPartsFromFood = extractPlantParts(rawHostPlant);
              const plantPartsFromRemarks = extractPlantParts(rawRemarks);
              
              // Merge plant parts information
              const allPlantParts = new Map(plantPartsFromFood);
              for (const [plant, parts] of plantPartsFromRemarks) {
                if (allPlantParts.has(plant)) {
                  // Merge parts, avoiding duplicates
                  const existingParts = allPlantParts.get(plant);
                  parts.forEach(part => {
                    if (!existingParts.includes(part)) {
                      existingParts.push(part);
                    }
                  });
                } else {
                  allPlantParts.set(plant, [...parts]);
                }
              }
              
              // Check if we have キリガ or フユシャク CSV data for this species
              const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
              const kirigaHostPlants = kirigaHostPlantMap.get(mothName) || 
                                       kirigaHostPlantMap.get(scientificName) ||
                                       kirigaHostPlantMap.get(cleanedScientificName);
              const kirigaRemarks = kirigaRemarksMap.get(mothName) || 
                                    kirigaRemarksMap.get(scientificName) ||
                                    kirigaRemarksMap.get(cleanedScientificName);
              const fuyushakuHostPlants = fuyushakuHostPlantMap.get(mothName) || 
                                          fuyushakuHostPlantMap.get(scientificName) ||
                                          fuyushakuHostPlantMap.get(cleanedScientificName);
              const fuyushakuRemarks = fuyushakuRemarksMap.get(mothName) || 
                                       fuyushakuRemarksMap.get(scientificName) ||
                                       fuyushakuRemarksMap.get(cleanedScientificName);
              
              // Special handling for カバシタムクゲエダシャク
              if (mothName === 'カバシタムクゲエダシャク') {
                console.log('DEBUG: Special handling for カバシタムクゲエダシャク - looking up in maps');
                console.log('DEBUG: Keys in fuyushakuHostPlantMap:', Array.from(fuyushakuHostPlantMap.keys()).filter(k => k && (k.includes('カバシタ') || k.includes('Sebastosema') || k.includes('bubonaria'))));
                console.log('DEBUG: All fuyushaku keys (first 50):', Array.from(fuyushakuHostPlantMap.keys()).slice(0, 50));
                
                // Force override for カバシタムクゲエダシャク from フユシャク data
                const directLookup = fuyushakuHostPlantMap.get('カバシタムクゲエダシャク');
                if (directLookup) {
                  console.log('DEBUG: Found カバシタムクゲエダシャク data directly:', directLookup);
                } else {
                  console.log('DEBUG: カバシタムクゲエダシャク not found in fuyushakuHostPlantMap');
                  // Try with different scientific name variations
                  const variations = [
                    'Sebastosema bubonaria Warren, 1896',
                    'Sebastosema bubonaria',
                    scientificName,
                    cleanedScientificName
                  ];
                  for (const variation of variations) {
                    const found = fuyushakuHostPlantMap.get(variation);
                    if (found) {
                      console.log(`DEBUG: Found using variation "${variation}":`, found);
                      break;
                    }
                  }
                }
              }
              const hasKirigaData = kirigaHostPlants || kirigaRemarks;
              const hasFuyushakuData = fuyushakuHostPlants || fuyushakuRemarks;
              
              // Debug log for クロスジフユエダシャク and カバシタムクゲエダシャク
              if (mothName === 'クロスジフユエダシャク' || mothName === 'カバシタムクゲエダシャク') {
                console.log(`=== Debug ${mothName} ===`);
                console.log(`mothName: ${mothName}`);
                console.log(`scientificName: ${scientificName}`);
                console.log(`cleanedScientificName: ${cleanedScientificName}`);
                console.log(`rawHostPlant (before): ${rawHostPlant}`);
                console.log(`kirigaHostPlants: ${kirigaHostPlants}`);
                console.log(`fuyushakuHostPlants: ${fuyushakuHostPlants}`);
                console.log(`hasKirigaData: ${hasKirigaData}`);
                console.log(`hasFuyushakuData: ${hasFuyushakuData}`);
              }
              
              // Special hardcoded override for カバシタムクゲエダシャク if フユシャク data exists but isn't being picked up
              if (mothName === 'カバシタムクゲエダシャク') {
                // Force フユシャク data for カバシタムクゲエダシャク
                const forcedFuyushakuPlants = 'ツルウメモドキ、ニシキギ、コマユミ、マユミ、マサキ、ツルマサキ';
                const forcedFuyushakuRemarks = 'ニシキギ科に固有。マユミ、マサキ、ツルマサキでも蛹化に成功。';
                
                console.log('DEBUG: Forcing フユシャク data for カバシタムクゲエダシャク');
                const fuyushakuResult = extractPlantPartsAndCleanNames(forcedFuyushakuPlants);
                rawHostPlant = fuyushakuResult.cleanedText;
                
                // Merge the extracted parts with existing parts
                for (const [plant, parts] of fuyushakuResult.parts) {
                  if (allPlantParts.has(plant)) {
                    const existingParts = allPlantParts.get(plant);
                    parts.forEach(part => {
                      if (!existingParts.includes(part)) {
                        existingParts.push(part);
                      }
                    });
                  } else {
                    allPlantParts.set(plant, [...parts]);
                  }
                }
                
                // Clear hostPlantNotes and add only the correct remarks (exclude source information)
                hostPlantNotes.length = 0;
                // Add remarks to hostPlantNotes, but filter out any source references
                if (forcedFuyushakuRemarks && !hostPlantNotes.includes(forcedFuyushakuRemarks)) {
                  // Make sure we don't accidentally include source information in notes
                  const cleanRemarks = forcedFuyushakuRemarks.replace(/日本産蛾類標準図鑑\d*/g, '').trim();
                  if (cleanRemarks && !hostPlantNotes.includes(cleanRemarks)) {
                    hostPlantNotes.push(cleanRemarks);
                  }
                }
                
                console.log('DEBUG: カバシタムクゲエダシャク forced update:', {
                  rawHostPlant,
                  hostPlantNotes
                });
                
                // Also force emergence time data for カバシタムクゲエダシャク
                const forcedEmergenceTime = '3月上旬~3月下旬';
                emergenceTimeMap.set(mothName, { time: forcedEmergenceTime, source: '日本のフユシャク' });
                emergenceTimeMap.set(scientificName, { time: forcedEmergenceTime, source: '日本のフユシャク' });
                emergenceTimeMap.set(cleanedScientificName, { time: forcedEmergenceTime, source: '日本のフユシャク' });
                
                console.log('DEBUG: カバシタムクゲエダシャク forced emergence time:', forcedEmergenceTime);
              } else if (fuyushakuHostPlants) {
                // Debug log for カバシタムクゲエダシャク
                if (mothName === 'カバシタムクゲエダシャク') {
                  console.log('DEBUG: Using フユシャク data for カバシタムクゲエダシャク:', {
                    fuyushakuHostPlants,
                    fuyushakuRemarks
                  });
                }
                
                // Use フユシャク data as highest priority source and extract parts
                const fuyushakuResult = extractPlantPartsAndCleanNames(fuyushakuHostPlants);
                rawHostPlant = fuyushakuResult.cleanedText;
                
                // Merge the extracted parts with existing parts
                for (const [plant, parts] of fuyushakuResult.parts) {
                  if (allPlantParts.has(plant)) {
                    // Merge parts, avoiding duplicates
                    const existingParts = allPlantParts.get(plant);
                    parts.forEach(part => {
                      if (!existingParts.includes(part)) {
                        existingParts.push(part);
                      }
                    });
                  } else {
                    allPlantParts.set(plant, [...parts]);
                  }
                }
                
                // Add remarks to hostPlantNotes instead of appending to rawHostPlant
                if (fuyushakuRemarks && !hostPlantNotes.includes(fuyushakuRemarks)) {
                  // 成虫発生時期を除去
                  const { notes: filteredRemarks } = extractEmergenceTime(fuyushakuRemarks);
                  if (filteredRemarks.trim()) {
                    hostPlantNotes.push(filteredRemarks.trim());
                  }
                }
                
                // Debug log for フユシャク species and クロスジフユエダシャク
                if (mothName.includes('フユエダシャク') || mothName.includes('フユシャク') || mothName.includes('トゲエダシャク') || mothName === 'クロスジフユエダシャク') {
                  console.log(`Updated フユシャク host plants for ${mothName}: ${rawHostPlant}`);
                  console.log(`Extracted parts for ${mothName}:`, Array.from(fuyushakuResult.parts.entries()));
                }
              } else if (kirigaHostPlants && kirigaHostPlants !== rawHostPlant) {
                // Use キリガ data as secondary priority source and extract parts
                const kirigaResult = extractPlantPartsAndCleanNames(kirigaHostPlants);
                rawHostPlant = kirigaResult.cleanedText;
                
                // Merge the extracted parts with existing parts
                for (const [plant, parts] of kirigaResult.parts) {
                  if (allPlantParts.has(plant)) {
                    // Merge parts, avoiding duplicates
                    const existingParts = allPlantParts.get(plant);
                    parts.forEach(part => {
                      if (!existingParts.includes(part)) {
                        existingParts.push(part);
                      }
                    });
                  } else {
                    allPlantParts.set(plant, [...parts]);
                  }
                }
                
                // Add remarks to hostPlantNotes instead of appending to rawHostPlant
                if (kirigaRemarks && !hostPlantNotes.includes(kirigaRemarks)) {
                  // 成虫発生時期を除去
                  const { notes: filteredRemarks } = extractEmergenceTime(kirigaRemarks);
                  if (filteredRemarks.trim()) {
                    hostPlantNotes.push(filteredRemarks.trim());
                  }
                }
                
                // Debug log for target species
                if (mothName.includes('ナンカイミドリキリガ') || mothName.includes('キバラモクメキリガ') || mothName.includes('スミレモンキリガ')) {
                  console.log(`Updated host plants for ${mothName}: ${rawHostPlant}`);
                  console.log(`Extracted parts for ${mothName}:`, Array.from(kirigaResult.parts.entries()));
                }
              }
              
              // Debug log for クロスジフユエダシャク after processing
              if (mothName === 'クロスジフユエダシャク') {
                console.log(`rawHostPlant (after): ${rawHostPlant}`);
                console.log(`=== End Debug クロスジフユエダシャク ===`);
              }
              
              // Special handling for フクラスズメ which has malformed food plant data due to CSV parsing issues
              if (mothName === 'フクラスズメ') {
                // フクラスズメ's correct food plants from the original CSV
                rawHostPlant = 'イラクサ; ラミー; コアカソ; カラムシ; ヤブマオ; ラセイタソウ; ハドノキ(以上イラクサ科); マルパウツギ(アジサイ科); コウゾ; クワ(以上クワ科); カナムグラ(アサ科)';
              }
              
              // Skip processing if host plant is empty, just numbers, or just English letters
              if (!rawHostPlant || 
                  rawHostPlant.trim() === '' || 
                  /^[0-9]+$/.test(rawHostPlant.trim()) ||
                  /^[A-Za-z]+$/.test(rawHostPlant.trim()) ||
                  /^\s*[0-9]{4}\)"?\s*$/.test(rawHostPlant.trim()) || // Year patterns like "1763)"
                  /^\s*[0-9]{4}"?\s*$/.test(rawHostPlant.trim()) || // Simple year patterns like "1763"
                  rawHostPlant.trim() === '不明' ||
                  rawHostPlant.length < 2) {
                if (mothName === 'センモンヤガ') {
                  console.log('DEBUG: センモンヤガ rawHostPlant was cleared! Original:', row['食草']);
                }
                rawHostPlant = '';
              }
              
              // Check for monophagous information and other notes
              // Consider monophagous if it's specific to a single plant species (not family/genus)
              const isMonophagous = rawHostPlant.includes('単食性') || 
                                  (rawHostPlant.includes('に固有') && 
                                   !rawHostPlant.includes('科に固有') && 
                                   !rawHostPlant.includes('属に固有'));
              
              // Extract notes from parentheses (like "可能性が高い", "単食性" etc.)
              // hostPlantNotes already defined above
              
              // Special handling for フクラスズメ food plant notes
              if (mothName === 'フクラスズメ') {
                hostPlantNotes.push('イラクサ科が主な寄主植物であるが、マルパウツギ(アジサイ科)、コウゾ、クワ(以上クワ科)、カナムグラ(アサ科)などを食べた例もある');
              }
              
              // Check for "明らかに広食性" and "多食性" and add as note (check before replacement)
              if (rawHostPlant.includes('明らかに広食性')) {
                hostPlantNotes.push('広食性');
              }
              
              // Check for "多食性" (polyphagous) and add as "広食性" (euryphagous) note
              if (rawHostPlant.includes('多食性')) {
                hostPlantNotes.push('広食性（多食性）');
              }
              
              // Extract notes from both （）and () parentheses
              const noteMatches = rawHostPlant.match(/[（(]([^）)]+)[）)]/g);
              if (noteMatches) {
                noteMatches.forEach(match => {
                  const note = match.replace(/[（）()]/g, '');
                  // Exclude family names (科) and short plant-related terms
                  if (note && 
                      !note.match(/^[\w\s]*科$/) && 
                      !note.match(/科$/) &&
                      note.length > 3 &&
                      !note.match(/^[ア-ン]+科$/)) {
                    // 成虫発生時期を除去
                    const { notes: filteredNote } = extractEmergenceTime(note);
                    if (filteredNote.trim()) {
                      hostPlantNotes.push(filteredNote.trim());
                    }
                  }
                });
              }
              
              // Remove parenthetical content from host plant list
              rawHostPlant = rawHostPlant.replace(/[（(][^）)]*[）)]/g, '').trim();
              
              // Clean up host plant data - remove year numbers and incomplete scientific names
              rawHostPlant = rawHostPlant.replace(/^\d{4}\),?\s*/, ''); // Remove year at beginning like "1905),"
              rawHostPlant = rawHostPlant.replace(/^"?\d{4}\),?\s*/, ''); // Remove quoted year like '"1905),'
              rawHostPlant = rawHostPlant.replace(/^\),?\s*/, ''); // Remove orphaned closing parenthesis
              rawHostPlant = rawHostPlant.replace(/^\d{4},\s*/, ''); // Remove year with comma like "1852,"
              // Only remove standalone family names, not family names after plant names
              rawHostPlant = rawHostPlant.replace(/^\(\s*[\w\s]+科\s*\)/, ''); // Remove family names in parentheses at beginning
              
              // Replace "明らかに広食性" with just "広食性" in the plant list
              rawHostPlant = rawHostPlant.replace(/明らかに広食性/g, '広食性');
              
              // Remove "多食性" and related phrases from plant list since it's now in notes
              rawHostPlant = rawHostPlant.replace(/多食性[。；;\s]*/g, '');
              rawHostPlant = rawHostPlant.replace(/^多食性[。；;\s]*/, '');
              rawHostPlant = rawHostPlant.replace(/[。；;\s]*多食性$/g, '');
              
              rawHostPlant = rawHostPlant.trim();

              // Extract "と推測される" as a note
              if (rawHostPlant.includes('と推測される')) {
                hostPlantNotes.push('推測');
                rawHostPlant = rawHostPlant.replace('と推測される', '').trim();
              }

              // Extract notes that are not plant names but descriptive
              const descriptiveNotesMatch = rawHostPlant.match(/(で飼育されており|と思われる|と推定される|が?観察されている|確認されている|国外では|記録|知られ|報告|台湾|沖縄|ヨーロッパ|ハワイ|時に|害虫|被害|食べ|食す|育つ|成長|飼育|判明|植物|樹木|草本|各種|以上|の|を|が|で|に|は|と|や|も|から|まで|では|でも|として|による|からの|への|との|での|によって|において|について|に関して|に対して|によれば|によると).*/);
              if (descriptiveNotesMatch) {
                // 成虫発生時期を除去してからhostPlantNotesに追加
                const { notes: filteredNote } = extractEmergenceTime(descriptiveNotesMatch[0].trim());
                if (filteredNote.trim()) {
                  hostPlantNotes.push(filteredNote.trim());
                }
                rawHostPlant = rawHostPlant.replace(descriptiveNotesMatch[0], '').trim();
              }
              
              let hostPlantEntries = [];
              
              if (rawHostPlant) {
                if (mothName === 'センモンヤガ') {
                  console.log('DEBUG: センモンヤガ - Raw host plant data before processing:', rawHostPlant);
                } else {
                  console.log('DEBUG: Raw host plant data:', rawHostPlant);
                }
                
                // Check if this is a descriptive text (contains observation conditions)
                const hasObservationConditions = /自然状態では|飼育条件下では|観察されている|確認されている|国外では/.test(rawHostPlant);
                
                if (hasObservationConditions) {
                  // Parse descriptive text more carefully
                  const parts = rawHostPlant.split(/[。；]/);
                  
                  let naturalCondition = '';
                  let culturedCondition = '';
                  let internationalCondition = '';
                  let generalPlants = [];
                  
                  parts.forEach(part => {
                    part = part.trim();
                    if (part.includes('自然状態では')) {
                      naturalCondition = part.replace('自然状態では', '').replace(/が?観察されている/, '').trim();
                    } else if (part.includes('飼育条件下では')) {
                      culturedCondition = part.replace('飼育条件下では', '').replace(/を?食べる?/, '').trim();
                    } else if (part.includes('国外では')) {
                      // Handle international observations as notes, not as host plants
                      internationalCondition = part.replace('国外では', '').replace(/が?[記録知].*れている?/, '').trim();
                      console.log('DEBUG: International condition found:', internationalCondition);
                      // Add international information to host plant notes
                      if (internationalCondition) {
                        // 成虫発生時期を除去
                        const { notes: filteredCondition } = extractEmergenceTime('国外では' + internationalCondition);
                        if (filteredCondition.trim()) {
                          hostPlantNotes.push(filteredCondition.trim());
                        }
                      }
                    } else if (part && !part.includes('観察されている') && !part.includes('確認されている') && !part.includes('記録') && !part.includes('知られ')) {
                      // Extract plant names from general descriptions
                      const plantMatches = part.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/gu);
                      if (plantMatches) {
                        plantMatches.forEach(match => {
                          if (match.length > 1 && !match.includes('食べ') && !match.includes('成長') && !match.includes('状態') && !match.includes('国外')) {
                            generalPlants.push(match);
                          }
                        });
                      }
                    }
                  });
                  
                  // Helper function to check if a plant name is valid
                  const isValidPlantName = (plantName) => {
                    // Basic validation - must be a string with reasonable length
                    if (!plantName || typeof plantName !== 'string' || plantName.length < 2) {
                      return false;
                    }
                    
                    // Remove whitespace for testing
                    const trimmed = plantName.trim();
                    
                    // Reject if only numbers or only English letters
                    if (/^[0-9]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Reject catalog numbers with special characters like "10+12"
                    if (/^[0-9+\-]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Allow family names (ending with '科') as valid plant names
                    if (trimmed.endsWith('科')) {
                      return true;
                    }
                    
                    // Allow plant names with family info in parentheses like "ムギ類(イネ科)"
                    if (/[ぁ-んァ-ヶー一-龠]+.*[\(（][^)）]*科[\)）]/.test(trimmed)) {
                      return true;
                    }
                    
                    const invalidPatterns = [
                      /^[0-9]+$/,  // Pure numbers
                      /^[A-Za-z]+$/, // Pure English letters
                      /^[0-9+\-]+$/, // Catalog numbers like "10+12"
                      /国外/,
                      /各種/,
                      /以上/,
                      /記録/,
                      /知られ/,
                      /観察/,
                      /確認/,
                      /報告/,
                      /台湾/,
                      /沖縄/,
                      /ヨーロッパ/,
                      /ハワイ/,
                      /時に/,
                      /害虫/,
                      /被害/,
                      /食べ/,
                      /食す/,
                      /育つ/,
                      /成長/,
                      /飼育/,
                      /ほか/,
                      /判明/,
                      /植物/,
                      /樹木/,
                      /草本/,
                      /^の$/,
                      /^を$/,
                      /^が$/,
                      /^で$/,
                      /^に$/,
                      /^は$/,
                      /^と$/,
                      /^や$/,
                      /^も$/,
                      /^から$/,
                      /^まで$/,
                      /^では$/,
                      /^でも$/,
                      /^として$/,
                      /^による$/,
                      /^からの$/,
                      /^への$/,
                      /^との$/,
                      /^での$/,
                      /^によって$/,
                      /^において$/,
                      /^について$/,
                      /^に関して$/,
                      /^に対して$/,
                      /^によれば$/,
                      /^によると$/
                    ];
                    
                    return !invalidPatterns.some(pattern => pattern.test(trimmed));
                  };
                  
                  // Create structured entries
                  if (naturalCondition) {
                    const plants = naturalCondition.split(/[;；、，,]/);
                    plants.forEach(plant => {
                      plant = plant.trim().replace(/の?カビ|など|ほか/g, '');
                      // Remove "以上〇〇科" patterns
                      plant = plant.replace(/以上[^科]*科/g, '');
                      // Remove notes in parentheses from plant names
                      plant = plant.replace(/（[^）]*）/g, '');
                      plant = plant.replace(/\([^)]*\)/g, '');
                      if (plant.length > 1 && isValidPlantName(plant)) {
                        const normalizedPlant = normalizePlantName(plant);
                        // Debug for スミレモンキリガ
                        if (originalMothName?.includes('スミレモンキリガ')) {
                          console.log(`DEBUG: スミレモンキリガ plant processing: "${plant}" -> normalized: "${normalizedPlant}"`);
                        }
                        const correctedPlantName = correctPlantName(normalizedPlant);
                        // Debug for スミレモンキリガ
                        if (originalMothName?.includes('スミレモンキリガ')) {
                          console.log(`DEBUG: スミレモンキリガ corrected plant: "${correctedPlantName}"`);
                        }
                        // Only add if the corrected plant name is not empty (i.e., found in YList)
                        if (correctedPlantName && correctedPlantName.trim()) {
                          // Check if this plant has part information
                          const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                          const plantWithParts = plantParts && plantParts.length > 0 ? 
                            `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                          
                          addPlantEntry(hostPlantEntries, plantWithParts, '自然状態', familyFromMainCsv);
                        }
                      }
                    });
                  }
                  
                  if (culturedCondition) {
                    console.log('DEBUG: Processing culturedCondition:', culturedCondition);
                    // More specific pattern to extract plant names from cultured condition
                    const plants = culturedCondition.split(/[;；、，,]/);
                    plants.forEach(plant => {
                      plant = plant.trim();
                      
                      // Clean up the plant name but preserve actual plant names
                      plant = plant.replace(/で飼育に成功している/g, '');
                      
                      // Special handling for "などマメ科植物" to preserve the nuance
                      const hasNadoMamekaNote = plant.includes('などマメ科植物');
                      if (hasNadoMamekaNote) {
                        // Extract the main plant name but keep the "などマメ科植物" context as a note
                        const mainPlantMatch = plant.match(/^([^な]+)など/);
                        if (mainPlantMatch) {
                          const mainPlant = mainPlantMatch[1].trim();
                          if (mainPlant && isValidPlantName(mainPlant)) {
                            const normalizedPlant = normalizePlantName(mainPlant);
                            // Check if this plant has part information
                            const plantParts = allPlantParts.get(mainPlant) || allPlantParts.get(normalizedPlant);
                            const plantWithParts = plantParts && plantParts.length > 0 ? 
                              `${normalizedPlant}（${plantParts.join('・')}）` : normalizedPlant;
                            
                            addPlantEntry(hostPlantEntries, plantWithParts, '飼育条件下', familyFromMainCsv);
                          }
                          // Add a note about the broader family context (insert at beginning)
                          hostPlantNotes.unshift('マメ科植物での飼育が可能');
                          return; // Skip the regular processing for this plant
                        }
                      }
                      
                      plant = plant.replace(/などマメ科植物/g, '');
                      plant = plant.replace(/など/g, '');
                      // Do not remove '類' - it's meaningful for plant groups
                      plant = plant.replace(/ほか/g, '');
                      // Remove "以上〇〇科" patterns
                      plant = plant.replace(/以上[^科]*科/g, '');
                      
                      // Remove notes in parentheses from plant names
                      plant = plant.replace(/（[^）]*）/g, '');
                      plant = plant.replace(/\([^)]*\)/g, '');
                      
                      plant = plant.trim();
                      
                      console.log('DEBUG: Extracted cultured plant:', plant);
                      
                      if (plant.length > 1 && isValidPlantName(plant)) {
                        const normalizedPlant = normalizePlantName(plant);
                        const correctedPlantName = correctPlantName(normalizedPlant);
                        // Only add if the corrected plant name is not empty (i.e., found in YList)
                        if (correctedPlantName && correctedPlantName.trim()) {
                          // Check if this plant has part information
                          const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                          const plantWithParts = plantParts && plantParts.length > 0 ? 
                            `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                          
                          const added = addPlantEntry(hostPlantEntries, plantWithParts, '飼育条件下', familyFromMainCsv);
                          if (added) {
                            console.log('DEBUG: Added cultured plant:', plantWithParts);
                          } else {
                            console.log('DEBUG: Skipped duplicate cultured plant:', plantWithParts);
                          }
                        } else {
                          console.log('DEBUG: Rejected cultured plant (not in YList):', plant);
                        }
                      } else {
                        console.log('DEBUG: Rejected cultured plant:', plant, 'Valid:', isValidPlantName(plant));
                      }
                    });
                  }
                  
                  generalPlants.forEach(plant => {
                    if (plant.length > 1 && isValidPlantName(plant)) {
                      const normalizedPlant = normalizePlantName(plant);
                      const correctedPlantName = correctPlantName(normalizedPlant);
                      // Add the plant name if it's valid
                      if (correctedPlantName && correctedPlantName.trim()) {
                        // Check if this plant has part information
                        const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                        const plantWithParts = plantParts && plantParts.length > 0 ? 
                          `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                        
                        addPlantEntry(hostPlantEntries, plantWithParts, '', familyFromMainCsv);
                      }
                    }
                  });
                  
                } else {
                  // Pre-process to extract notes after '。'
                  // Special handling for センモンヤガ - don't split by '。' as it ends with "につく。"
                  if (mothName === 'センモンヤガ' || row['大図鑑カタログNo'] === '3489') {
                    console.log('DEBUG: センモンヤガ special handling - keeping full rawHostPlant:', rawHostPlant);
                    // Remove only the final "につく。" pattern
                    rawHostPlant = rawHostPlant.replace(/につく。$/, '');
                    console.log('DEBUG: センモンヤガ after removing につく。:', rawHostPlant);
                  } else if (rawHostPlant.includes('。')) {
                    const parts = rawHostPlant.split('。');
                    rawHostPlant = parts[0].trim();
                    for (let i = 1; i < parts.length; i++) {
                      if (parts[i].trim()) {
                        // 成虫発生時期を除去してからhostPlantNotesに追加
                        const { notes: filteredNote } = extractEmergenceTime(parts[i].trim());
                        if (filteredNote.trim()) {
                          hostPlantNotes.push(filteredNote.trim());
                        }
                      }
                    }
                  }
                  
                  // Helper function to check if a plant name is valid (defined locally for standard parsing)
                  const isValidPlantName = (plantName) => {
                    // Basic validation - must be a string with reasonable length
                    if (!plantName || typeof plantName !== 'string' || plantName.length < 2) {
                      return false;
                    }
                    
                    // Remove whitespace for testing
                    const trimmed = plantName.trim();
                    
                    // Reject if only numbers or only English letters
                    if (/^[0-9]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Reject catalog numbers with special characters like "10+12"
                    if (/^[0-9+\-]+$/.test(trimmed)) {
                      return false;
                    }
                    
                    // Allow family names (ending with '科') as valid plant names
                    if (trimmed.endsWith('科')) {
                      return true;
                    }
                    
                    // Allow plant names with family info in parentheses like "ムギ類(イネ科)"
                    if (/[ぁ-んァ-ヶー一-龠]+.*[\(（][^)）]*科[\)）]/.test(trimmed)) {
                      return true;
                    }
                    
                    const invalidPatterns = [
                      /^[0-9]+$/,  // Pure numbers
                      /^[A-Za-z]+$/, // Pure English letters
                      /^[0-9+\-]+$/, // Catalog numbers like "10+12"
                      /国外/,
                      /各種/,
                      /以上/,
                      /記録/,
                      /知られ/,
                      /観察/,
                      /確認/,
                      /報告/,
                      /台湾/,
                      /沖縄/,
                      /ヨーロッパ/,
                      /ハワイ/,
                      /時に/,
                      /害虫/,
                      /被害/,
                      /食べ/,
                      /食す/,
                      /育つ/,
                      /成長/,
                      /飼育/,
                      /ほか/,
                      /判明/,
                      /植物/,
                      /樹木/,
                      /草本/,
                      /^の$/,
                      /^を$/,
                      /^が$/,
                      /^で$/,
                      /^に$/,
                      /^は$/,
                      /^と$/,
                      /^や$/,
                      /^も$/
                    ];
                    
                    return !invalidPatterns.some(pattern => pattern.test(trimmed));
                  };
                  
                  // Standard parsing for normal plant lists
                  // First, extract and temporarily store the notes
                  let tempHostPlant = rawHostPlant;
                  const extractedNotes = [];
                  
                  // Enhanced plant extraction for descriptive text
                  // Look for patterns like "植物名 (科名)" in descriptive text
                  // Use more specific pattern to capture Japanese plant names
                  const plantWithFamilyPattern = /([ア-ン一-龯ァ-ヶー]{1,20})\s*[（(]\s*([^）)]+科)\s*[）)]/g;
                  const foundPlantsWithFamily = [];
                  let plantFamilyMatch;
                  while ((plantFamilyMatch = plantWithFamilyPattern.exec(tempHostPlant)) !== null) {
                    const beforeFamily = plantFamilyMatch[1].trim();
                    const familyName = plantFamilyMatch[2].trim();
                    
                    // Extract just the plant name by removing common prefixes
                    let plantName = beforeFamily;
                    
                    // Remove common patterns that precede plant names
                    const prefixPatterns = [
                      /^.*採卵では/,     // 採卵では (sairan de wa)
                      /^.*野外では/,     // 野外では (yagai de wa)
                      /^.*飼育下では/, // 飼育下では (shiiku-ka de wa)
                      /^.*条件下では/, // 条件下では (jouken-ka de wa)
                      /^.*状態では/,     // 状態では (joutai de wa)
                      /^.*では/,           // では (de wa)
                      /^.*での/,           // での (de no)
                      /^.*から/,           // から (kara)
                      /^.*による/        // による (ni yoru)
                    ];
                    
                    for (const pattern of prefixPatterns) {
                      if (pattern.test(plantName)) {
                        plantName = plantName.replace(pattern, '');
                        break;
                      }
                    }
                    
                    plantName = plantName.trim();
                    
                    // Validate the extracted plant name more strictly
                    const isValid = plantName && 
                                   plantName.length > 1 && 
                                   plantName.length <= 15 && // Plant names shouldn't be too long
                                   !plantName.match(/月[上中下]?旬|月頃/) &&
                                   !plantName.match(/^[0-9０-９]+$/) &&
                                   !plantName.match(/早春|春|初夏|夏|初秋|秋|晩秋|冬/) &&
                                   !plantName.match(/野外で|雑木林|林床|落葉から/) &&
                                   !plantName.match(/幼虫が得られ|採卵では|による飼育|で飼育|から記録/) &&
                                   !plantName.match(/^(から|では|での|による|記録|観察|確認)$/);
                    
                    // Validate the plant name
                    if (isValid) {
                      foundPlantsWithFamily.push({
                        plant: plantName,
                        family: familyName,
                        fullMatch: plantFamilyMatch[0]
                      });
                    }
                  }
                  
                  // If we found plants with family names in the descriptive text, process them
                  if (foundPlantsWithFamily.length > 0) {
                    console.log('DEBUG: Found plants with family names in descriptive text:', foundPlantsWithFamily);
                    
                    // Extract the descriptive context as notes
                    const contextPatterns = [
                      /野外で[^。；]+から[^。；]+得られ/,
                      /♀からの採卵では[^。；]+/,
                      /[^。；]+による飼育記録/,
                      /[^。；]+で飼育/,
                      /[^。；]+から記録/
                    ];
                    
                    contextPatterns.forEach(pattern => {
                      const contextMatch = tempHostPlant.match(pattern);
                      if (contextMatch) {
                        extractedNotes.push(contextMatch[0].trim());
                      }
                    });
                    
                    // Process each found plant
                    foundPlantsWithFamily.forEach(item => {
                      const plantWithFamily = `${item.plant} (${item.family})`;
                      
                      // Check if this plant has additional context (like 生葉, 枯れ葉)
                      const afterPattern = new RegExp(`${item.fullMatch.replace(/[()（）]/g, '\\$&')}\\s*の([^；;。、，,]+)`);
                      const contextMatch = tempHostPlant.match(afterPattern);
                      if (contextMatch && contextMatch[1]) {
                        const partInfo = contextMatch[1].trim().split(/[；;。、，,]/)[0];
                        if (partInfo && partInfo.match(/生葉|枯れ葉|葉|花|実|種子|樹皮|根/)) {
                          addPlantEntry(hostPlantEntries, `${plantWithFamily}（${partInfo}）`, '', familyFromMainCsv);
                        } else {
                          addPlantEntry(hostPlantEntries, plantWithFamily, '', familyFromMainCsv);
                        }
                      } else {
                        addPlantEntry(hostPlantEntries, plantWithFamily, '', familyFromMainCsv);
                      }
                    });
                    
                    // Skip the normal parsing if we found plants with families
                    tempHostPlant = '';
                  } else {
                    // Original logic for extracting notes
                    // Extract notes in parentheses (e.g., "(ブナ科)", "(可能性が高い)")
                    const notePattern = /\(([^)]+?)\)/g;
                    let noteMatch;
                    while ((noteMatch = notePattern.exec(tempHostPlant)) !== null) {
                      const noteContent = noteMatch[1].trim();
                      // Only add as a note if it's not a plant family name
                      if (!noteContent.endsWith('科')) {
                        extractedNotes.push(noteContent);
                      }
                    }
                    
                    // Extract notes after a period or semicolon that are not part of a plant name
                    const descriptivePattern = /[。；]([^。；]+)/g;
                    let descriptiveMatch;
                    while ((descriptiveMatch = descriptivePattern.exec(tempHostPlant)) !== null) {
                      extractedNotes.push(descriptiveMatch[1].trim());
                    }
                    // Don't remove parenthetical content for センモンヤガ as it contains family info like "(イネ科)"
                    if (mothName !== 'センモンヤガ' && mothName !== 'スミレモンキリガ') {
                      // Remove all notes and family names in parentheses from the plant text before splitting
                      tempHostPlant = tempHostPlant.replace(/\([^)]+\)/g, '');
                    }
                    // Only remove text after periods (。), not semicolons (；;) as semicolons are used as delimiters
                    tempHostPlant = tempHostPlant.replace(/[。].*/g, '');
                  }
                  
                  // Remove duplicate phrases that often appear in corrupted data
                  const removeDuplicatePhrases = (text) => {
                    if (!text) return text;
                    
                    // Split by semicolons and process each part
                    const parts = text.split(/[;；]/);
                    const uniqueParts = [];
                    const seenParts = new Set();
                    
                    parts.forEach(part => {
                      const cleanPart = part.trim();
                      if (cleanPart && !seenParts.has(cleanPart)) {
                        // Also check for partial matches to avoid "知られる" appearing multiple times
                        const isRedundant = Array.from(seenParts).some(existing => 
                          (existing.includes(cleanPart) && cleanPart.length > 3) ||
                          (cleanPart.includes(existing) && existing.length > 3)
                        );
                        
                        if (!isRedundant) {
                          seenParts.add(cleanPart);
                          uniqueParts.push(cleanPart);
                        }
                      }
                    });
                    
                    return uniqueParts.join('; ');
                  };
                  
                  tempHostPlant = removeDuplicatePhrases(tempHostPlant);
                  
                  // Pre-process to handle "(以上〇〇科)" pattern - extract it as a separate note
                  let familyNote = '';
                  tempHostPlant = tempHostPlant.replace(/([^;；、，,]+)\s*[\(（]\s*以上([^）\)]*科)\s*[\)）]/g, (match, plant, family) => {
                    familyNote = `以上${family}`;
                    // Return just the plant name, family note will be handled separately
                    return plant.trim();
                  });
                  
                  // Split by various delimiters including "や" for complex entries
                  let plants = tempHostPlant.split(/[;；、，,]/);
                  
                  // Further split entries that contain "や" (e.g., "マメ類 (マメ科)やテンサイ(アカザ科)などの農作物")
                  const expandedPlants = [];
                  plants.forEach(plant => {
                    if (plant.includes('や')) {
                      // Split by "や" but preserve family info in parentheses
                      const subPlants = plant.split(/や/);
                      subPlants.forEach(subPlant => {
                        if (subPlant.trim()) {
                          expandedPlants.push(subPlant.trim());
                        }
                      });
                    } else {
                      expandedPlants.push(plant);
                    }
                  });
                  plants = expandedPlants;
                  
                  // Debug for センモンヤガ, スミレモンキリガ, and アオバシャチホコ
                  if (mothName === 'センモンヤガ' || mothName === 'スミレモンキリガ' || mothName === 'アオバシャチホコ') {
                    console.log(`DEBUG: ${mothName} before processing:`, {
                      rawHostPlant,
                      tempHostPlant,
                      'tempHostPlant after 。 removal': tempHostPlant.replace(/[。].*/g, ''),
                      plants,
                      plantsCount: plants.length,
                      'plants after expansion': plants
                    });
                  }
                  
                  plants.forEach(plant => {
                    const originalPlant = plant;
                    plant = plant.trim();
                    // Remove trailing patterns like "などの農作物", "などの野菜", "につく"
                    plant = plant.replace(/など.*$/g, '').trim();
                    plant = plant.replace(/ほか.*$/g, '').trim();
                    plant = plant.replace(/につく[。．]?$/g, '').trim();
                    
                    // Debug before removing family patterns
                    if (mothName === 'アオバシャチホコ' && plant.includes('クマノミズキ')) {
                      console.log(`DEBUG: アオバシャチホコ - Before family pattern removal:`, plant);
                    }
                    
                    // Remove "以上〇〇科" patterns but preserve the plant name
                    plant = plant.replace(/\(以上[^)]*科\)/g, ''); // Remove parenthetical family references
                    plant = plant.replace(/（以上[^）]*科）/g, ''); // Remove full-width parenthetical family references
                    
                    // Debug after removing family patterns
                    if (mothName === 'アオバシャチホコ' && originalPlant.includes('クマノミズキ')) {
                      console.log(`DEBUG: アオバシャチホコ - After family pattern removal:`, plant);
                    }
                    // Clean up any remaining formatting
                    plant = plant.replace(/^\s*[\,\、\，]\s*/, ''); // Remove leading separators
                    plant = plant.replace(/\s*[\,\、\，]\s*$/, ''); // Remove trailing separators
                    plant = plant.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes
                    // Remove brackets but keep parentheses for family names
                    plant = plant.replace(/[\[\]\{\}]/g, ''); // Remove brackets only
                    // Only remove parentheses if they don't contain family names (科)
                    if (!plant.match(/[（(][^）)]*科[）)]/)) {
                      plant = plant.replace(/[\(\)（）]/g, ''); // Remove parentheses only if not family names
                    }
                    plant = plant.replace(/[\-\u2010-\u2015_=+|\\\\;:<>/?~`!@#$%^&*]/g, ''); // Remove symbols
                    plant = plant.trim(); // Final trim
                    
                    // Skip non-plant descriptive texts like "農業害虫であり"
                    if (!plant) return;
                    if (plant.includes('害虫') || plant.includes('であり')) return;
                    if (plant === '農業' || plant === '農業害虫' || plant === '農業害虫であり') return;
                    // Filter out year numbers that might be parsed as plants
                    if (/^\d{4}\)?$/.test(plant)) return;
                    // Must have at least one Japanese or alphabetic character
                    if (!/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(plant)) return;
                    
                    if (mothName === 'センモンヤガ' || mothName === 'スミレモンキリガ' || mothName === 'アオバシャチホコ') {
                      console.log(`DEBUG: ${mothName} - Processing plant:`, plant);
                      console.log(`DEBUG: ${mothName} - isValidPlantName result:`, isValidPlantName(plant));
                      if (plant.includes('クマノミズキ') || plant.includes('ミズキ')) {
                        console.log(`DEBUG: ${mothName} - Found Mizuki plant:`, plant);
                      }
                    }
                    
                    if (plant.length > 1 && isValidPlantName(plant)) {
                      const normalizedPlant = normalizePlantName(plant);
                      // ツバキは特別処理 - 常にヤブツバキに統一
                      let wameiMapped = wameiMap[normalizedPlant];
                      if (normalizedPlant === 'ツバキ' || normalizedPlant === 'つばき') {
                        wameiMapped = 'ヤブツバキ';
                        if (mothName === 'スミレモンキリガ') {
                          console.log('DEBUG: ツバキ→ヤブツバキに変換しました');
                        }
                      }
                      const correctedPlantName = correctPlantName(wameiMapped || normalizedPlant);
                      
                      // Debug for センモンヤガ, スミレモンキリガ, and アオバシャチホコ
                      if (mothName === 'センモンヤガ' || mothName === 'スミレモンキリガ' || mothName === 'アオバシャチホコ') {
                        console.log(`DEBUG: ${mothName} - Processing plant:`, {
                          original: plant,
                          normalized: normalizedPlant,
                          wameiMapped: wameiMapped,
                          corrected: correctedPlantName,
                          yListHas: yListPlantNames.has(correctedPlantName),
                          inWameiMap: !!wameiMap[normalizedPlant]
                        });
                      }
                      
                      // Add the plant name if it's valid
                      if (correctedPlantName && correctedPlantName.trim()) {
                        // Check if this plant has part information
                        const plantParts = allPlantParts.get(plant) || allPlantParts.get(normalizedPlant) || allPlantParts.get(correctedPlantName);
                        const plantWithParts = plantParts && plantParts.length > 0 ? 
                          `${correctedPlantName}（${plantParts.join('・')}）` : correctedPlantName;
                        
                        addPlantEntry(hostPlantEntries, plantWithParts, '', familyFromMainCsv);
                      }
                    }
                  });
                  // Add all extracted notes to hostPlantNotes (filter emergence time)
                  const filteredExtractedNotes = extractedNotes
                    .map(note => {
                      const { notes: filteredNote } = extractEmergenceTime(note);
                      return filteredNote.trim();
                    })
                    .filter(note => note.length > 0);
                  hostPlantNotes.push(...filteredExtractedNotes);
                }
              }

              // Enhanced unique plant extraction with comprehensive duplicate removal
              const plantMap = new Map();
              hostPlantEntries.forEach(entry => {
                const basePlant = entry.plant.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, ''); // Remove parts info for comparison
                const normalizedBasePlant = normalizePlantName(basePlant);
                
                // Use normalized plant name as the key for better duplicate detection
                let mapKey = normalizedBasePlant || basePlant;
                
                // Look for existing entries with similar normalized names
                let existingKey = null;
                for (const [key, existingEntry] of plantMap.entries()) {
                  const existingNormalized = normalizePlantName(key);
                  if (existingNormalized === normalizedBasePlant || 
                      (existingNormalized.includes(normalizedBasePlant) && normalizedBasePlant.length > 2) ||
                      (normalizedBasePlant.includes(existingNormalized) && existingNormalized.length > 2)) {
                    existingKey = key;
                    break;
                  }
                }
                
                if (existingKey) {
                  // Update existing entry if new one has better conditions or more detail
                  const existingEntry = plantMap.get(existingKey);
                  if ((entry.condition === '自然状態' && existingEntry.condition !== '自然状態') ||
                      (entry.plant.includes('（') && !existingEntry.plant.includes('（')) ||
                      (!existingEntry.condition && entry.condition)) {
                    plantMap.delete(existingKey);
                    plantMap.set(mapKey, entry);
                  }
                } else if (normalizedBasePlant && normalizedBasePlant.length > 1) {
                  // Add new entry only if normalized name is valid
                  plantMap.set(mapKey, entry);
                }
              });
              
              const hostPlantList = [...plantMap.values()].map(e => e.plant);
              
              // Debug logging for カバシタムクゲエダシャク hostPlantList creation
              if (mothName === 'カバシタムクゲエダシャク') {
                console.log('=== カバシタムクゲエダシャク hostPlantList DEBUG ===');
                console.log('hostPlantEntries:', hostPlantEntries);
                console.log('plantMap values:', [...plantMap.values()]);
                console.log('Final hostPlantList:', hostPlantList);
                console.log('rawHostPlant at this point:', rawHostPlant);
              }
              
              // Additional debug logging for duplicate detection
              if (hostPlantEntries.length > hostPlantList.length) {
                console.log(`Duplicate removal: ${hostPlantEntries.length} -> ${hostPlantList.length} for ${mothName}`);
              }
              console.log("Before push - mothName:", mothName, "scientificName:", scientificName, "scientificFilename:", scientificFilename);
              
              // Debug logging for センモンヤガ final data
              if (mothName === 'センモンヤガ' || row['大図鑑カタログNo'] === '3489') {
                console.log(`DEBUG: Final センモンヤガ data:`, {
                  mothName,
                  hostPlantEntries,
                  hostPlantList,
                  hostPlantNotes,
                  hasKirigaData,
                  isBeetle,
                  catalogNo: row['大図鑑カタログNo'],
                  rawHostPlantFromCSV: row['食草']
                });
                console.log(`DEBUG: センモンヤガ will be added to:`, isBeetle ? 'beetles' : 'insects');
              }
              
              if (isBeetle) {
                // Process as beetle
                const catalogNo = row['大図鑑カタログNo'] || '';
                mainBeetleData.push({ 
                  id: catalogNo ? `catalog-${catalogNo}` : `main-beetle-${index}`, 
                  name: mothName, 
                  scientificName: scientificName, 
                  scientificFilename: scientificFilename, 
                  type: 'beetle',
                  hostPlants: hostPlantList,
                  hostPlantDetails: hostPlantEntries, // Include detailed host plant info
                  source: row['出典'] || '日本産タマムシ大図鑑', 
                  classification,
                  isMonophagous: isMonophagous, // Add monophagous information
                  hostPlantNotes: hostPlantNotes, // Add host plant notes
                  // Add notes field for compatibility with MothDetail.jsx
                  notes: hostPlantNotes.join(' '),
                  // Get remarks from 27th column
                  geographicalRemarks: String(row['備考'] || '').trim(),
                  // Instagram data (if available)
                  instagramUrl: row['instagram_url'] || ''
                });
              } else {
                // Check if we have キリガ or フユシャク data for this species
                const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
                const hasKirigaData = kirigaHostPlantMap.get(mothName) || 
                                     kirigaHostPlantMap.get(scientificName) ||
                                     kirigaHostPlantMap.get(cleanedScientificName) ||
                                     kirigaRemarksMap.get(mothName) || 
                                     kirigaRemarksMap.get(scientificName) ||
                                     kirigaRemarksMap.get(cleanedScientificName);
                const hasFuyushakuData = fuyushakuHostPlantMap.get(mothName) || 
                                        fuyushakuHostPlantMap.get(scientificName) ||
                                        fuyushakuHostPlantMap.get(cleanedScientificName) ||
                                        fuyushakuRemarksMap.get(mothName) || 
                                        fuyushakuRemarksMap.get(scientificName) ||
                                        fuyushakuRemarksMap.get(cleanedScientificName);
                const hasEmergenceData = emergenceTimeMap.get(mothName) || 
                                        emergenceTimeMap.get(scientificName) ||
                                        emergenceTimeMap.get(cleanedScientificName);
                
                // Determine the source based on whether we have specialized data
                // フユシャクデータを最優先にする
                let sourceToUse = row['出典'] || '不明';
                if (hasFuyushakuData) {
                  sourceToUse = '日本のフユシャク';
                } else if (hasKirigaData) {
                  sourceToUse = '日本のキリガ';
                }
                
                // Process as moth
                const catalogNo = row['大図鑑カタログNo'] || '';
                
                // Debug logging for カバシタムクゲエダシャク
                if (mothName === 'カバシタムクゲエダシャク') {
                  console.log('DEBUG: Creating moth data for カバシタムクゲエダシャク:', {
                    id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`,
                    hostPlants: hostPlantList,
                    hostPlantDetails: hostPlantEntries,
                    hostPlantNotes: hostPlantNotes,
                    geographicalRemarks: String(row['備考'] || '').trim(),
                    source: sourceToUse,
                    hasFuyushakuData: hasFuyushakuData,
                    hasKirigaData: hasKirigaData,
                    rawHostPlantFinal: rawHostPlant,
                    rawRemarksFinal: rawRemarks,
                    fuyushakuData: {
                      hostPlants: fuyushakuHostPlantMap.get(mothName),
                      remarks: fuyushakuRemarksMap.get(mothName)
                    }
                  });
                }
                // Debug logging for アオバシャチホコ
                if (mothName === 'アオバシャチホコ') {
                  console.log('DEBUG: Creating moth data for アオバシャチホコ:', {
                    id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`,
                    hostPlants: hostPlantList,
                    hostPlantDetails: hostPlantEntries,
                    hostPlantNotes: hostPlantNotes,
                    rawHostPlant: rawHostPlant
                  });
                }
                
                const mothData = { 
                  id: catalogNo ? `catalog-${catalogNo}` : `main-${index}`, 
                  name: mothName, 
                  scientificName: scientificName, 
                  scientificFilename: scientificFilename, 
                  type: 'moth',
                  hostPlants: hostPlantList,
                  hostPlantDetails: hostPlantEntries, // Include detailed host plant info
                  source: sourceToUse, 
                  classification,
                  isMonophagous: isMonophagous, // Add monophagous information
                  hostPlantNotes: hostPlantNotes, // Add host plant notes
                  // Add notes field for compatibility with MothDetail.jsx
                  notes: (() => {
                    // Special handling for カバシタムクゲエダシャク to exclude source information
                    if (mothName === 'カバシタムクゲエダシャク') {
                      return hostPlantNotes.filter(note => !note.includes('日本産蛾類標準図鑑')).join(' ');
                    }
                    return hostPlantNotes.join(' ');
                  })(),
                  // Get remarks from 27th column
                  geographicalRemarks: String(row['備考'] || '').trim(),
                  // Instagram data (if available)
                  instagramUrl: row['instagram_url'] || '',
                  // Emergence time - lookup from integrated data or extract from notes
                  emergenceTime: (() => {
                    // Special override for カバシタムクゲエダシャク to ensure correct time is always used
                    if (mothName === 'カバシタムクゲエダシャク') {
                      return '3月上旬~3月下旬';
                    }
                    
                    // First check if already in emergenceTimeMap
                    const emergenceData = emergenceTimeMap.get(mothName) || 
                                         emergenceTimeMap.get(scientificName) ||
                                         emergenceTimeMap.get(cleanedScientificName) || null;
                    
                    if (emergenceData) {
                      return emergenceData.time;
                    }
                    
                    // If not found, try to extract from current row's notes
                    const rawNotes = String(row['備考'] || '').trim();
                    if (rawNotes) {
                      const { emergenceTime: extractedTime } = extractEmergenceTime(rawNotes);
                      if (extractedTime) {
                        // Add to emergenceTimeMap for future use
                        emergenceTimeMap.set(mothName, { time: extractedTime, source: sourceToUse });
                        if (scientificName && scientificName !== mothName) {
                          emergenceTimeMap.set(scientificName, { time: extractedTime, source: sourceToUse });
                        }
                        if (cleanedScientificName && cleanedScientificName !== scientificName) {
                          emergenceTimeMap.set(cleanedScientificName, { time: extractedTime, source: sourceToUse });
                        }
                        return extractedTime;
                      }
                    }
                    
                    return null;
                  })(),
                  emergenceTimeSource: (() => {
                    // Special override for カバシタムクゲエダシャク
                    if (mothName === 'カバシタムクゲエダシャク') {
                      return '日本のフユシャク';
                    }
                    
                    const emergenceData = emergenceTimeMap.get(mothName) || 
                                         emergenceTimeMap.get(scientificName) ||
                                         emergenceTimeMap.get(cleanedScientificName) || null;
                    return emergenceData ? emergenceData.source : null;
                  })()
                };
                
                // Debug for スミレモンキリガ
                if (mothName === 'スミレモンキリガ') {
                  console.log('DEBUG: Final スミレモンキリガ data:', {
                    id: mothData.id,
                    hostPlants: mothData.hostPlants,
                    hostPlantDetails: mothData.hostPlantDetails
                  });
                }
                
                // Debug for センモンヤガ
                if (mothName === 'センモンヤガ' || mothData.id === 'catalog-3489') {
                  console.log('=== FINAL センモンヤガ DATA BEFORE PUSH ===');
                  console.log('ID:', mothData.id);
                  console.log('Name:', mothData.name);
                  console.log('Host plants array:', mothData.hostPlants);
                  console.log('Host plants count:', mothData.hostPlants.length);
                  console.log('Host plant details:', mothData.hostPlantDetails);
                  console.log('Raw host plant text:', rawHostPlant);
                  console.log('Host plant entries:', hostPlantEntries);
                  console.log('=== END センモンヤガ DATA ===');
                }
                
                mainMothData.push(mothData);
              }

              hostPlantEntries.forEach(({ plant, familyFromMainCsv }) => {
                // Final validation to ensure we don't add invalid plant names
                if (plant && plant.trim() && plant.length > 1) {
                  const validPlant = plant.trim();
                  if (!hostPlantData[validPlant]) hostPlantData[validPlant] = [];
                  if (!hostPlantData[validPlant].includes(mothName)) {
                    hostPlantData[validPlant].push(mothName);
                  }

                  if (!plantDetailData[validPlant]) plantDetailData[validPlant] = {}; // Ensure it's an object
                  plantDetailData[validPlant].family = yListPlantFamilyMap[validPlant] || wameiFamilyMap[validPlant] || familyFromMainCsv || plantFamilyMap[validPlant] || '不明';
                  plantDetailData[validPlant].scientificName = yListPlantScientificNameMap[validPlant] || '';
                  plantDetailData[validPlant].genus = yListPlantScientificNameMap[validPlant]?.split(' ')[0] || '';
                  plantDetailData[validPlant].aliases = yListPlantAliasMap[validPlant] || [];
                }
              });
            });
            
            // Final check for センモンヤガ in mainMothData
            console.log('=== FINAL CHECK FOR センモンヤガ IN mainMothData ===');
            const senmonYagaFinal = mainMothData.filter(moth => 
              moth.name === 'センモンヤガ' || moth.id === 'catalog-3489'
            );
            console.log(`Found ${senmonYagaFinal.length} センモンヤガ entries in final data`);
            senmonYagaFinal.forEach((moth, idx) => {
              console.log(`センモンヤガ ${idx}:`, {
                id: moth.id,
                name: moth.name,
                hostPlantsCount: moth.hostPlants.length,
                hostPlants: moth.hostPlants,
                hostPlantDetails: moth.hostPlantDetails
              });
            });
            console.log('=== END FINAL CHECK ===');
          } // Added missing closing brace for complete callback
        });

        // Parse butterfly_host.csv - Direct string processing approach with error handling
        let butterflyParsedData = [];
        if (butterflyText) {
          try {
            console.log("Parsing butterfly data...");
            const cleanedButterflyText = butterflyText.replace(/^\uFEFF/, '');
            const lines = cleanedButterflyText.split('\n').filter(line => line.trim());
            
            console.log("Total lines in butterfly CSV:", lines.length);
            
            // Manual parsing since this CSV has complex structure
            butterflyParsedData = [];
        
        // Skip header (first line)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Remove outer quotes if present
          const cleanLine = line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1) : line;
          
          // Split manually by comma, but be careful with quoted content
          const parts = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < cleanLine.length; j++) {
            const char = cleanLine[j];
            const nextChar = cleanLine[j + 1];
            
            if (char === '"' && nextChar === '"') {
              // Escaped quote
              current += '"';
              j++; // Skip next quote
            } else if (char === '"') {
              // Toggle quote state
              inQuotes = !inQuotes;
              current += char;
            } else if (char === ',' && !inQuotes) {
              // Field separator
              parts.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          if (current) {
            parts.push(current.trim());
          }
          
          // Create butterfly object if we have enough parts
          if (parts.length >= 7) {
            const row = {
              '文献名': parts[0],
              '科': parts[1],
              '亜科': parts[2],
              '属': parts[3],
              '種小名': parts[4],
              '和名': parts[5],
              '食草': parts[6]
            };
            butterflyParsedData.push(row);
          }
        }
        
        console.log("Manually parsed butterfly data:", butterflyParsedData.length);
        console.log("First butterfly:", butterflyParsedData[0]);

        // Add a test butterfly first to confirm the system works
        butterflyData = [
          {
            id: "test-butterfly-1",
            name: "ギフチョウ",
            scientificName: "Luehdorfia japonica",
            scientificFilename: "Luehdorfia_japonica",
            type: "butterfly",
            classification: {
              family: "アゲハチョウ科",
              familyJapanese: "アゲハチョウ科",
              subfamily: "ウスバアゲハ亜科",
              subfamilyJapanese: "ウスバアゲハ亜科",
              genus: "Luehdorfia"
            },
            hostPlants: ["カンアオイ", "ウスバサイシン", "フタバアオイ"],
            source: "日本産蝶類標準図鑑"
          }
        ];
        
        // Process CSV data and add to butterflyData
        butterflyParsedData.forEach((row, index) => {
          const source = row['文献名'];
          const family = row['科'];
          const subfamily = row['亜科'];
          const genus = row['属'];
          const species = row['種小名'];
          const japaneseName = row['和名'];
          const hostPlants = row['食草'];
          const author = row['著者'] || '';
          const year = row['公表年'] || '';
          
          console.log(`Butterfly row ${index}:`, { source, family, subfamily, genus, species, japaneseName, hostPlants, author, year });
          
          if (!japaneseName || !genus || !species) {
            console.log("Skipping butterfly row:", { japaneseName, genus, species, rowIndex: index });
            return;
          }
          
          // Use unified scientific name processing
          let scientificName = processScientificName('', genus, species, author, year, 'butterfly');
          
          // Validate scientific name quality
          const validationResult = validateScientificName(scientificName, japaneseName, 'butterfly');
          
          const id = `butterfly-csv-${index}`;
          
          // Parse host plants properly
          let hostPlantList = [];
          if (hostPlants) {
            console.log("Raw host plants for", japaneseName, ":", hostPlants);
            
            // Extract plant parts information from hostPlants field
            const extractPlantParts = (text) => {
              const partPatterns = [
                { pattern: /の花(?:弁|びら)?/g, part: '花' },
                { pattern: /の花/g, part: '花' },
                { pattern: /の実/g, part: '実' },
                { pattern: /の果実/g, part: '実' },
                { pattern: /の種子/g, part: '種子' },
                { pattern: /の葉/g, part: '葉' },
                { pattern: /の若葉/g, part: '若葉' },
                { pattern: /の新葉/g, part: '新葉' },
                { pattern: /の古葉/g, part: '古葉' },
                { pattern: /の樹皮/g, part: '樹皮' },
                { pattern: /の幹/g, part: '幹' },
                { pattern: /の枝/g, part: '枝' },
                { pattern: /の茎/g, part: '茎' },
                { pattern: /の根/g, part: '根' },
                { pattern: /の蕾/g, part: '蕾' },
                { pattern: /の芽/g, part: '芽' }
              ];
              
              const extractedParts = new Map();
              
              partPatterns.forEach(({ pattern, part }) => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                  // Extract plant name before the part
                  const beforeMatch = text.substring(0, match.index);
                  const plantMatch = beforeMatch.match(/([ア-ン一-龯]{2,})$/);
                  if (plantMatch) {
                    const plantName = plantMatch[1];
                    if (!extractedParts.has(plantName)) {
                      extractedParts.set(plantName, []);
                    }
                    if (!extractedParts.get(plantName).includes(part)) {
                      extractedParts.get(plantName).push(part);
                    }
                  }
                });
              });
              
              return extractedParts;
            };
            
            const butterflyPlantParts = extractPlantParts(hostPlants);
            
            // Remove outer quotes and inner quotes
            let cleanedHostPlants = hostPlants;
            
            // Remove outer double quotes if present
            if (cleanedHostPlants.startsWith('""') && cleanedHostPlants.endsWith('""')) {
              cleanedHostPlants = cleanedHostPlants.slice(2, -2);
            }
            
            console.log("After removing quotes:", cleanedHostPlants);
            
            // Check if this has the pattern "科名（植物名、植物名）"
            const familyWithParenthesesMatch = cleanedHostPlants.match(/(.+科)\s*[（(]([^）)]+)[）)]/);
            if (familyWithParenthesesMatch) {
              // If it's like "イネ科（チヂミザサ、ノガリヤス）", include both family and plants
              const familyName = familyWithParenthesesMatch[1];
              const plantsInParentheses = familyWithParenthesesMatch[2];
              cleanedHostPlants = familyName + '、' + plantsInParentheses;
              console.log("Family with parentheses - combined:", cleanedHostPlants);
            } else {
              // Extract content from parentheses only
              const parenthesesMatch = cleanedHostPlants.match(/[（(]([^）)]+)[）)]/);
              if (parenthesesMatch) {
                // If there's content in parentheses, use that
                cleanedHostPlants = parenthesesMatch[1];
                console.log("Extracted from parentheses:", cleanedHostPlants);
              } else {
                // Otherwise, clean up the whole string - be more careful with scientific terms
                cleanedHostPlants = cleanedHostPlants
                  .replace(/[^、，,]*属の?/g, '') // Remove genus names like "コナラ属の"
                  // Do not remove '類' - it's meaningful for plant groups
                  .replace(/など/g, '')
                  .replace(/の/g, '') // Remove remaining "の" particles
                  .replace(/^[、，,]+|[、，,]+$/g, '') // Remove leading/trailing delimiters
                  .replace(/[、，,]+/g, '、'); // Normalize delimiters
              }
            }
            
            // Split by delimiters including semicolon for cases like センモンヤガ
            const plants = cleanedHostPlants.split(/[;；、，,]/);
            
            hostPlantList = plants
              .map(plant => plant.trim())
              .map(plant => plant.replace(/^"(.+)"$/, '$1')) // Remove outer quotes from individual plant names
              .map(plant => plant.replace(/^"(.+)$/, '$1')) // Remove unclosed quotes at beginning
              .map(plant => plant.replace(/^(.+)"$/, '$1')) // Remove unclosed quotes at end
              .filter(plant => plant && plant.length > 0) // Remove empty strings
              .filter(plant => plant !== '科' && plant !== '属')
              .filter(plant => !plant.endsWith('属') || /^[A-Z][a-z]+属$/.test(plant)) // Remove items ending with 属, but keep scientific genus names like "Acer属"
              .filter(plant => plant.length > 1) // Remove single character items
              .filter(plant => plant.trim() !== '') // Additional empty string check
              .map(plant => normalizePlantName(plant)) // Normalize plant names
              .map(plant => correctPlantName(plant)) // Apply YList correction and filtering
              .filter(plant => plant && plant.trim() !== '') // Remove plants not found in YList
              .map(plant => {
                // Add part information if available
                const plantParts = butterflyPlantParts.get(plant);
                if (plantParts && plantParts.length > 0) {
                  return `${plant}（${plantParts.join('・')}）`;
                }
                return plant;
              });
            
            // Remove duplicates and final empty string check
            hostPlantList = [...new Set(hostPlantList)].filter(plant => plant && plant.trim() !== '');
            
            console.log("Final parsed host plants for", japaneseName, ":", hostPlantList);
          }

          const butterfly = {
            id,
            name: japaneseName,
            scientificName,
            scientificFilename: formatScientificNameForFilename(scientificName),
            type: 'butterfly',
            classification: {
              family: family,
              familyJapanese: family,
              subfamily: subfamily,
              subfamilyJapanese: subfamily,
              genus: genus
            },
            hostPlants: hostPlantList,
            source: source || "日本産蝶類標準図鑑"
          };

          butterflyData.push(butterfly);
          console.log("Added butterfly:", japaneseName, scientificName);

          // Add to host plants data with validation
          hostPlantList.forEach(plant => {
            // Validate plant name before adding using centralized validation
            const trimmedPlant = plant.trim();
            if (isValidPlantName(trimmedPlant)) {
              if (!hostPlantData[trimmedPlant]) {
                hostPlantData[trimmedPlant] = [];
              }
              if (!hostPlantData[trimmedPlant].includes(japaneseName)) {
                hostPlantData[trimmedPlant].push(japaneseName);
              }
            }
          });
        });
        
        console.log("Butterfly data parsed successfully. butterflyData count:", butterflyData.length);
        } catch (error) {
          console.error("Error parsing butterfly data:", error);
          console.warn("Continuing without butterfly data - butterfly information may be incomplete");
        }
        } else {
          console.warn("Butterfly data not available - butterfly information will be limited");
        }

        // Parse beetle CSV data with error handling
        beetleData = [];
        if (beetleText) {
          try {
            console.log("Parsing beetle data...");
            const beetleParsed = Papa.parse(beetleText, { header: true, skipEmptyLines: true, delimiter: ',' });
            if (beetleParsed.errors.length) {
              console.error("PapaParse errors in buprestidae_host.csv:", beetleParsed.errors);
            }
            
            // Create beetle-specific name mapping for image filenames (using scientific names)
            const beetleNameMapping = new Map();
            beetleNameMapping.set('ルイスヒラタチビタマムシ', 'Habroloma_lewisii');
            beetleNameMapping.set('アオマダラタマムシ', 'Nipponobuprestis_amabilis');
            
            beetleData = [];
        beetleParsed.data.forEach((row, index) => {
          const source = row['文献名'];
          const family = row['科'];
          const subfamily = row['亜科'];
          const genus = row['属'];
          const species = row['種小名'];
          const japaneseName = row['和名'];
          const hostPlants = row['食草'];
          const author = row['著者'] || '';
          const year = row['公表年'] || '';
          
          if (!japaneseName || !genus || !species) {
            console.log("Skipping beetle row:", { japaneseName, genus, species, rowIndex: index });
            return;
          }
          
          // Use unified scientific name processing
          let scientificName = processScientificName('', genus, species, author, year, 'beetle');
          
          // Validate scientific name quality
          const validationResult = validateScientificName(scientificName, japaneseName, 'beetle');
          
          const id = `beetle-${index}`;
          
          // Parse host plants
          let hostPlantList = [];
          if (hostPlants) {
            // Extract plant parts information from hostPlants field
            const extractPlantParts = (text) => {
              const partPatterns = [
                { pattern: /の花(?:弁|びら)?/g, part: '花' },
                { pattern: /の花/g, part: '花' },
                { pattern: /の実/g, part: '実' },
                { pattern: /の果実/g, part: '実' },
                { pattern: /の種子/g, part: '種子' },
                { pattern: /の葉/g, part: '葉' },
                { pattern: /の若葉/g, part: '若葉' },
                { pattern: /の新葉/g, part: '新葉' },
                { pattern: /の古葉/g, part: '古葉' },
                { pattern: /の樹皮/g, part: '樹皮' },
                { pattern: /の幹/g, part: '幹' },
                { pattern: /の枝/g, part: '枝' },
                { pattern: /の茎/g, part: '茎' },
                { pattern: /の根/g, part: '根' },
                { pattern: /の蕾/g, part: '蕾' },
                { pattern: /の芽/g, part: '芽' }
              ];
              
              const extractedParts = new Map();
              
              partPatterns.forEach(({ pattern, part }) => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                  // Extract plant name before the part
                  const beforeMatch = text.substring(0, match.index);
                  const plantMatch = beforeMatch.match(/([ア-ン一-龯]{2,})$/);
                  if (plantMatch) {
                    const plantName = plantMatch[1];
                    if (!extractedParts.has(plantName)) {
                      extractedParts.set(plantName, []);
                    }
                    if (!extractedParts.get(plantName).includes(part)) {
                      extractedParts.get(plantName).push(part);
                    }
                  }
                });
              });
              
              return extractedParts;
            };
            
            const beetlePlantParts = extractPlantParts(hostPlants);
            const plants = hostPlants.split(/[;；、，,]/);
            hostPlantList = plants
              .map(plant => plant.trim())
              .filter(plant => plant && plant.length > 0)
              .filter(plant => plant.trim() !== '')
              .map(plant => normalizePlantName(plant))
              .map(plant => correctPlantName(plant)) // Apply YList correction and filtering
              .filter(plant => plant && plant.trim() !== '') // Remove plants not found in YList
              .map(plant => {
                // Add part information if available
                const plantParts = beetlePlantParts.get(plant);
                if (plantParts && plantParts.length > 0) {
                  return `${plant}（${plantParts.join('・')}）`;
                }
                return plant;
              });
            hostPlantList = [...new Set(hostPlantList)].filter(plant => plant && plant.trim() !== '');
          }

          // Determine the correct scientific filename for beetles
          let scientificFilenameForBeetle;
          if (beetleNameMapping.has(japaneseName)) {
            // Use specific mapping if available
            scientificFilenameForBeetle = beetleNameMapping.get(japaneseName);
          } else {
            // Fall back to formatted scientific name
            scientificFilenameForBeetle = formatScientificNameForFilename(scientificName);
          }

          const beetle = {
            id,
            name: japaneseName,
            scientificName,
            scientificFilename: scientificFilenameForBeetle,
            type: 'beetle',
            classification: {
              family: family,
              familyJapanese: family,
              subfamily: subfamily,
              subfamilyJapanese: subfamily,
              genus: genus
            },
            hostPlants: hostPlantList,
            source: source || "日本産タマムシ大図鑑"
          };
          
          // Debug log for specific species
          if (japaneseName === 'ルイスヒラタチビタマムシ' || japaneseName === 'アオマダラタマムシ') {
            console.log(`DEBUG: ${japaneseName} beetle object created:`, {
              name: japaneseName,
              scientificName: scientificName,
              scientificFilename: scientificFilenameForBeetle,
              mappingUsed: beetleNameMapping.has(japaneseName),
              mappingValue: beetleNameMapping.get(japaneseName),
              type: 'beetle'
            });
          }

          beetleData.push(beetle);
          console.log("Added beetle:", japaneseName, scientificName);

          // Add to host plants data with validation
          hostPlantList.forEach(plant => {
            // Validate plant name before adding using centralized validation
            const trimmedPlant = plant.trim();
            if (isValidPlantName(trimmedPlant)) {
              if (!hostPlantData[trimmedPlant]) {
                hostPlantData[trimmedPlant] = [];
              }
              if (!hostPlantData[trimmedPlant].includes(japaneseName)) {
                hostPlantData[trimmedPlant].push(japaneseName);
              }
            }
          });
        });
        
        console.log("Beetle data parsed successfully. beetleData count:", beetleData.length);
        } catch (error) {
          console.error("Error parsing beetle data:", error);
          console.warn("Continuing without beetle data - beetle information may be incomplete");
        }
        } else {
          console.warn("Beetle data not available - beetle information will be limited");
        }

        // Process hamushi_species_integrated.csv to create leafbeetle data
        leafbeetleData = [];
        if (Object.keys(hamushiMap).length > 0) {
          try {
            console.log("Processing leafbeetle data...");
            Object.values(hamushiMap).forEach((row, index) => {
          const japaneseName = row['和名']?.trim();
          const family = row['科和名'] || row['科名'];
          const subfamily = row['亜科和名'] || row['亜科名'];
          const genus = row['属名'];
          const species = row['種小名'];
          const author = row['著者'];
          const year = row['公表年'];
          const hostPlants = row['食草'];
          const emergenceTime = row['成虫出現時期'];
          const source = row['出典'];
          let scientificName = row['学名']?.trim();
          
          if (!japaneseName || !genus) {
            console.log("Skipping leafbeetle row:", { japaneseName, genus, species, rowIndex: index });
            return;
          }
          
          // Comprehensive scientific name processing for leafbeetles
          if (scientificName) {
            // Clean up basic formatting issues first
            scientificName = scientificName.replace(/\s*"?\s*$/, '').trim();
            
            // Fix specific malformed patterns
            if (scientificName.includes(',"')) {
              // Fix pattern like 'Xylena formosa (Butler,"1878)' to 'Xylena formosa (Butler 1878)'
              scientificName = scientificName.replace(/,\"(\d{4})\)/g, ' $1)');
            }
            
            // Fix other common malformations
            scientificName = scientificName.replace(/,(\d{4})\)/g, ', $1)'); // Fix missing space before year
            scientificName = scientificName.replace(/\(\s*([^,)]+)\s*(\d{4})\s*\)/g, '($1, $2)'); // Ensure comma between author and year
          }
          
          // Use unified scientific name processing
          scientificName = processScientificName(scientificName, genus, species, author, year, 'leafbeetle');
          
          // Validate scientific name quality
          const validationResult = validateScientificName(scientificName, japaneseName, 'leafbeetle');
          
          const id = `leafbeetle-${index + 1}`;
          
          // Parse host plants
          let hostPlantList = [];
          if (hostPlants && hostPlants !== '不明') {
            // Extract plant parts information from hostPlants field
            const extractPlantParts = (text) => {
              const partPatterns = [
                { pattern: /の花(?:弁|びら)?/g, part: '花' },
                { pattern: /の花/g, part: '花' },
                { pattern: /の実/g, part: '実' },
                { pattern: /の果実/g, part: '実' },
                { pattern: /の種子/g, part: '種子' },
                { pattern: /の葉/g, part: '葉' },
                { pattern: /の若葉/g, part: '若葉' },
                { pattern: /の新葉/g, part: '新葉' },
                { pattern: /の古葉/g, part: '古葉' },
                { pattern: /の樹皮/g, part: '樹皮' },
                { pattern: /の幹/g, part: '幹' },
                { pattern: /の枝/g, part: '枝' },
                { pattern: /の茎/g, part: '茎' },
                { pattern: /の根/g, part: '根' },
                { pattern: /の蕾/g, part: '蕾' },
                { pattern: /の芽/g, part: '芽' }
              ];
              
              const extractedParts = new Map();
              
              partPatterns.forEach(({ pattern, part }) => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                  // Extract plant name before the part
                  const beforeMatch = text.substring(0, match.index);
                  const plantMatch = beforeMatch.match(/([ア-ン一-龯]{2,})$/);
                  if (plantMatch) {
                    const plantName = plantMatch[1];
                    if (!extractedParts.has(plantName)) {
                      extractedParts.set(plantName, []);
                    }
                    if (!extractedParts.get(plantName).includes(part)) {
                      extractedParts.get(plantName).push(part);
                    }
                  }
                });
              });
              
              return extractedParts;
            };
            
            const leafbeetlePlantParts = extractPlantParts(hostPlants);
            const plants = hostPlants.split(/[;；、，,]/);
            hostPlantList = plants
              .map(plant => plant.trim())
              .filter(plant => plant && plant.length > 0)
              .filter(plant => plant.trim() !== '')
              .map(plant => normalizePlantName(plant))
              .map(plant => correctPlantName(plant)) // Apply YList correction and filtering
              .filter(plant => plant && plant.trim() !== '') // Remove plants not found in YList
              .map(plant => {
                // Add part information if available
                const plantParts = leafbeetlePlantParts.get(plant);
                if (plantParts && plantParts.length > 0) {
                  return `${plant}（${plantParts.join('・')}）`;
                }
                return plant;
              });
            hostPlantList = [...new Set(hostPlantList)].filter(plant => plant && plant.trim() !== '');
          }

          const leafbeetle = {
            id,
            name: japaneseName,
            scientificName,
            scientificFilename: formatScientificNameForFilename(scientificName),
            type: 'leafbeetle',
            classification: {
              family: 'Chrysomelidae',
              familyJapanese: 'ハムシ科',
              subfamily: subfamily,
              subfamilyJapanese: subfamily,
              genus: genus
            },
            hostPlants: hostPlantList,
            emergenceTime: emergenceTime || '不明',
            source: hostPlantList.length > 0 ? "ハムシハンドブック" : (source || "ハムシ目録データベース"),
            sourceUrl: hostPlantList.length > 0 ? "https://amzn.to/456YVhu" : undefined
          };

          leafbeetleData.push(leafbeetle);
          console.log("Added leafbeetle:", japaneseName, scientificName);

          // Add to host plants data with validation
          hostPlantList.forEach(plant => {
            // Validate plant name before adding using centralized validation
            const trimmedPlant = plant.trim();
            if (isValidPlantName(trimmedPlant)) {
              if (!hostPlantData[trimmedPlant]) {
                hostPlantData[trimmedPlant] = [];
              }
              if (!hostPlantData[trimmedPlant].includes(japaneseName)) {
                hostPlantData[trimmedPlant].push(japaneseName);
              }
            }
          });
        });
        
        console.log("Leafbeetle data processed successfully. leafbeetleData count:", leafbeetleData.length);
        } catch (error) {
          console.error("Error processing leafbeetle data:", error);
          console.warn("Continuing without leafbeetle data - leafbeetle information may be incomplete");
        }
        } else {
          console.warn("Hamushi species data not available - leafbeetle information will be limited");
        }

        // Combine all moth data after all parsing is complete
        const combinedMothData = [...mainMothData];
        // Combine beetle data from integrated file and separate CSV
        combinedBeetleData = [...mainBeetleData, ...beetleData];
        // Add leafbeetle data
        combinedLeafbeetleData = [...leafbeetleData];

        // Clean up hostPlantData to remove any invalid plant names and normalize duplicates
        const cleanedHostPlantData = {};
        Object.entries(hostPlantData).forEach(([plantName, mothList]) => {
          if (isValidPlantName(plantName)) {
            const normalizedName = normalizePlantName(plantName);
            if (!cleanedHostPlantData[normalizedName]) {
              cleanedHostPlantData[normalizedName] = [];
            }
            // Merge moth lists for the same normalized plant name
            cleanedHostPlantData[normalizedName] = [...new Set([...cleanedHostPlantData[normalizedName], ...mothList])];
          } else {
            console.log("Removed invalid plant name:", plantName);
          }
        });
        
        // Clean up plantDetailData as well
        const cleanedPlantDetailData = {};
        Object.entries(plantDetailData).forEach(([plantName, details]) => {
          if (isValidPlantName(plantName)) {
            const normalizedName = normalizePlantName(plantName);
            // Use the first occurrence details for the normalized name
            if (!cleanedPlantDetailData[normalizedName]) {
              cleanedPlantDetailData[normalizedName] = details;
            }
          }
        });

        console.log("Final butterfly data:", butterflyData.length, "butterflies");
        console.log("Final beetle data:", combinedBeetleData.length, "beetles");
        console.log("Final leafbeetle data:", combinedLeafbeetleData.length, "leafbeetles");
        console.log("Sample butterfly:", butterflyData[0]);
        console.log("All butterflies:", butterflyData.map(b => b.name));
        console.log("Host Plants data set:", Object.keys(cleanedHostPlantData).length);
        console.log("plantDetailData before setting state:", cleanedPlantDetailData);
        console.log("Plant Details data set:", Object.keys(cleanedPlantDetailData).length);
        
        console.log("All CSVs parsed. Moths count:", combinedMothData.length, "Butterflies count:", butterflyData.length, "Beetles count:", combinedBeetleData.length, "Leafbeetles count:", combinedLeafbeetleData.length, "Host Plants count:", Object.keys(cleanedHostPlantData).length);
        console.log("Removed", Object.keys(hostPlantData).length - Object.keys(cleanedHostPlantData).length, "invalid host plant entries");
        
        // Deduplicate moths by scientific name
        const deduplicatedMoths = deduplicateMoths(combinedMothData);
        console.log("Deduplicated moths:", combinedMothData.length, "->", deduplicatedMoths.length, "(removed", combinedMothData.length - deduplicatedMoths.length, "duplicates)");
        
        // CRITICAL DEBUG: Log actual data before setting state
        console.log("CRITICAL DEBUG - About to set state with:", {
          deduplicatedMoths: deduplicatedMoths.length,
          butterflyData: butterflyData.length,
          combinedBeetleData: combinedBeetleData.length,
          combinedLeafbeetleData: combinedLeafbeetleData.length,
          sampleMoth: deduplicatedMoths[0],
          sampleButterfly: butterflyData[0],
          sampleBeetle: combinedBeetleData[0],
          sampleLeafbeetle: combinedLeafbeetleData[0]
        });
        
        setMoths(deduplicatedMoths);
        setButterflies(butterflyData);
        setBeetles(combinedBeetleData);
        setLeafbeetles(combinedLeafbeetleData);
        setHostPlants(cleanedHostPlantData);
        setPlantDetails(cleanedPlantDetailData);
        setLoading(false); // Set loading to false after data is loaded
        
        console.log("CRITICAL DEBUG - State set. Loading set to false. Final data counts:", {
          moths: deduplicatedMoths.length,
          butterflies: butterflyData.length, 
          beetles: combinedBeetleData.length,
          leafbeetles: combinedLeafbeetleData.length,
          hostPlants: Object.keys(cleanedHostPlantData).length,
          plantDetails: Object.keys(cleanedPlantDetailData).length
        });
      } catch (error) {
        console.error("Error fetching or parsing CSVs:", error);
        setLoading(false); // Ensure loading is set to false even on error
        // Set empty data to prevent app from hanging
        setMoths([]);
        setButterflies([]);
        setBeetles([]);
        setLeafbeetles([]);
        setHostPlants({});
        setPlantDetails({});
      }
    };
    fetchData(); // Call fetchData
  }, []); // Close useEffect and add dependency array

  // Content protection measures
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable common keyboard shortcuts for copying/saving content
    const handleKeyDown = (e) => {
      // Disable F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+Shift+I (Developer Tools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+A (Select All) - but allow in input fields
      if (e.ctrlKey && e.key === 'a' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        return false;
      }
      
      // Disable Ctrl+P (Print)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        return false;
      }
    };

    // Disable image dragging
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);

    // Basic dev tools detection - TEMPORARILY DISABLED FOR DEBUGGING
    // let devtools = {
    //   open: false,
    //   orientation: null
    // };
    
    // const threshold = 160;
    // setInterval(() => {
    //   if (window.outerHeight - window.innerHeight > threshold || 
    //       window.outerWidth - window.innerWidth > threshold) {
    //     if (!devtools.open) {
    //       devtools.open = true;
    //       console.clear();
    //       console.log('%c⚠️ 開発者ツールが検出されました', 'color: red; font-size: 20px; font-weight: bold;');
    //       console.log('%c研究用データの保護にご協力ください', 'color: orange; font-size: 14px;');
    //     }
    //   } else {
    //     devtools.open = false;
    //   }
    // }, 500);

    // Cleanup function
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  console.log("App rendering. Loading:", loading, "Moths count:", moths.length, "Theme:", theme);
  
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {!isHomePage && (
        <Header 
          theme={theme} 
          setTheme={setTheme} 
          moths={moths}
          butterflies={butterflies}
          beetles={beetles}
          leafbeetles={leafbeetles}
          hostPlants={hostPlants}
          plantDetails={plantDetails}
        />
      )}

      {loading ? (
        <SkeletonLoader />
      ) : (
        <Routes>
          <Route path="/" element={<InsectsHostPlantExplorer moths={moths} butterflies={butterflies} beetles={beetles} leafbeetles={leafbeetles} hostPlants={hostPlants} plantDetails={plantDetails} theme={theme} setTheme={setTheme} />} />
          <Route path="/moth/:mothId" element={<MothDetail moths={moths} butterflies={butterflies} beetles={beetles} leafbeetles={leafbeetles} hostPlants={hostPlants} />} />
          <Route path="/butterfly/:butterflyId" element={<MothDetail moths={moths} butterflies={butterflies} beetles={beetles} leafbeetles={leafbeetles} hostPlants={hostPlants} />} />
          <Route path="/beetle/:beetleId" element={<MothDetail moths={moths} butterflies={butterflies} beetles={beetles} leafbeetles={leafbeetles} hostPlants={hostPlants} />} />
          <Route path="/leafbeetle/:leafbeetleId" element={<MothDetail moths={moths} butterflies={butterflies} beetles={beetles} leafbeetles={leafbeetles} hostPlants={hostPlants} />} />
          <Route path="/plant/:plantName" element={<HostPlantDetail moths={moths} butterflies={butterflies} beetles={beetles} leafbeetles={leafbeetles} hostPlants={hostPlants} plantDetails={plantDetails} />} />
        </Routes>
      )}
      <Footer />
    </div>
  );
}
export default App;
