import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Papa from 'papaparse';
import InsectsHostPlantExplorer from './InsectsHostPlantExplorer';
import MothDetail from './MothDetail';
import HostPlantDetail from './HostPlantDetail';
import SkeletonLoader from './components/SkeletonLoader';
import Footer from './components/Footer';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';

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
  const [moths, setMoths] = useState([]);
  const [hostPlants, setHostPlants] = useState({});
  const [plantDetails, setPlantDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let mainMothData = [];
      let hostPlantData = {};
      let plantDetailData = {};
      const wameiCsvPath = `${import.meta.env.BASE_URL}wamei_checklist_ver.1.10.csv`;
      const mainCsvPath = `${import.meta.env.BASE_URL}ListMJ_hostplants_integrated_with_bokutou.csv`;
      const yListCsvPath = `${import.meta.env.BASE_URL}20210514YList_download.csv`; // New YList CSV path
      const book1CsvPath = `${import.meta.env.BASE_URL}Book1.csv`;
      const hamushiSpeciesCsvPath = `${import.meta.env.BASE_URL}hamushi_species.csv`;

      console.log("Fetching CSV files...");
      console.log("wameiCsvPath:", wameiCsvPath);
      console.log("mainCsvPath:", mainCsvPath);
      console.log("yListCsvPath:", yListCsvPath); // Log new path
      console.log("book1CsvPath:", book1CsvPath);

      try {
        const [wameiRes, mainRes, yListRes, book1Res, hamushiSpeciesRes] = await Promise.all([
          fetch(wameiCsvPath),
          fetch(mainCsvPath),
          fetch(yListCsvPath),
          fetch(book1CsvPath),
          fetch(hamushiSpeciesCsvPath)
        ]);

        if (!wameiRes.ok) throw new Error(`Failed to fetch ${wameiCsvPath}: ${wameiRes.statusText}`);
        if (!mainRes.ok) throw new Error(`Failed to fetch ${mainCsvPath}: ${mainRes.statusText}`);
        if (!yListRes.ok) throw new Error(`Failed to fetch ${yListCsvPath}: ${yListRes.statusText}`);
        if (!book1Res.ok) throw new Error(`Failed to fetch ${book1CsvPath}: ${book1Res.statusText}`);
        if (!hamushiSpeciesRes.ok) throw new Error(`Failed to fetch ${hamushiSpeciesCsvPath}: ${hamushiSpeciesRes.statusText}`);

        const [wameiText, mainText, yListText, book1Text, hamushiSpeciesText] = await Promise.all([
          wameiRes.text(),
          mainRes.text(),
          yListRes.text(),
          book1Res.text(),
          hamushiSpeciesRes.text()
        ]);

        console.log("CSV files fetched successfully. Parsing...");

        // Parse wamei_checklist_ver.1.10.csv
        const wameiParsed = Papa.parse(wameiText, { header: true, skipEmptyLines: true, delimiter: ',' });
        if (wameiParsed.errors.length) {
          console.error("PapaParse errors in wamei_checklist_ver.1.10.csv:", wameiParsed.errors);
        }
        const wameiMap = {};
        const wameiFamilyMap = {};
        const correctMothNames = new Set();
        wameiParsed.data.forEach(row => {
          const allName = row['all_name']?.trim();
          const hubName = row['Hub name']?.trim();
          const familyJp = row['Family name (JP)']?.trim();
          if (allName) correctMothNames.add(allName);
          if (hubName) correctMothNames.add(hubName);
          if (allName && hubName) wameiMap[allName] = hubName;
          if (hubName && familyJp) wameiFamilyMap[hubName] = familyJp;
        });
        console.log("wamei_checklist_ver.1.10.csv parsed. wameiMap size:", Object.keys(wameiMap).length);

        const correctMothName = (name) => {
          if (correctMothNames.has(name)) {
            return name;
          }
          const corrections = {
            'パ': 'バ', 'ピ': 'ビ', 'プ': 'ブ', 'ペ': 'ベ', 'ポ': 'ボ',
            'ガ': 'カ', 'ギ': 'キ', 'グ': 'ク', 'ゲ': 'ケ', 'ゴ': 'コ',
            'ザ': 'サ', 'ジ': 'シ', 'ズ': 'ス', 'ゼ': 'セ', 'ゾ': 'ソ',
            'ダ': 'タ', 'ヂ': 'チ', 'ヅ': 'ツ', 'デ': 'テ', 'ド': 'ト',
          };
          let correctedName = name;
          for (const [wrong, correct] of Object.entries(corrections)) {
            if (correctedName.includes(wrong)) {
              const tempName = correctedName.replace(new RegExp(wrong, 'g'), correct);
              if (correctMothNames.has(tempName)) {
                return tempName;
              }
            }
          }
          return name;
        };

        const formatScientificNameForFilename = (scientificName) => {
          if (!scientificName) return '';
          let cleanedName = scientificName.replace(/\s*\(.+?\)\s*(,\s*\d{4})?/, '');
          cleanedName = cleanedName.replace(/\s/g, '_');
          return cleanedName;
        };

        // Parse 20210514YList_download.csv
        const yListParsed = Papa.parse(yListText, { header: true, skipEmptyLines: true, delimiter: ',' });
        if (yListParsed.errors.length) {
          console.error("PapaParse errors in 20210514YList_download.csv:", yListParsed.errors);
        }
        const yListPlantFamilyMap = {};
        const yListPlantScientificNameMap = {};
        const yListPlantNames = new Set();
        yListParsed.data.forEach(row => {
          const plantName = row['和名']?.trim();
          const familyJp = row['LAPG 科名']?.trim();
          const scientificName = row['学名']?.trim();

          if (plantName) {
            yListPlantNames.add(plantName);
          }
          if (plantName && familyJp) {
            yListPlantFamilyMap[plantName] = familyJp;
          }
          if (plantName && scientificName) {
            yListPlantScientificNameMap[plantName] = scientificName;
          }
        });
        console.log("20210514YList_download.csv parsed. yListPlantFamilyMap size:", Object.keys(yListPlantFamilyMap).length);
        console.log("20210514YList_download.csv parsed. yListPlantScientificNameMap size:", Object.keys(yListPlantScientificNameMap).length);

        const correctPlantName = (name) => {
          if (yListPlantNames.has(name)) {
            return name;
          }
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
          return name; // Return original name if no correction is found
        };

        // Process hamushi_species.csv first to create hamushiMap
        const hamushiParsed = Papa.parse(hamushiSpeciesText, { header: true, skipEmptyLines: true, delimiter: ',' });
        if (hamushiParsed.errors.length) {
          console.error("PapaParse errors in hamushi_species.csv:", hamushiParsed.errors);
        }
        const hamushiMap = {};
        hamushiParsed.data.forEach(row => {
          const name = row['和名']?.trim();
          if (name) {
            hamushiMap[name] = row;
          }
        });

        // Process book1Text using the hamushiMap
        const book1Parsed = Papa.parse(book1Text, { header: true, skipEmptyLines: true, encoding: 'utf8', delimiter: ',', newline: '\r\n' });
        if (book1Parsed.errors.length) {
          console.error("PapaParse errors in Book1.csv:", book1Parsed.errors);
        }
        const book1MothData = [];
        book1Parsed.data.forEach((row, index) => {
          const originalInsectName = row['和名']?.trim();
          if (!originalInsectName) return;

          const insectName = correctMothName(originalInsectName);
          let scientificName = row['学名'] || '';
          let classification = { family: 'ハムシ科' };

          const hamushiDetail = hamushiMap[insectName];
          if (hamushiDetail) {
            scientificName = `${hamushiDetail['属']} ${hamushiDetail['種小名']}`.trim();
            classification = {
              family: hamushiDetail['科'] || '',
              subfamily: hamushiDetail['亜科'] || '',
              genus: hamushiDetail['属'] || '',
              speciesEpithet: hamushiDetail['種小名'] || '',
            };
          }

          const scientificFilename = formatScientificNameForFilename(scientificName);

          const hostPlantList = (row['食草'] || '').split(/\u3001|,/).map(p => p.trim()).filter(Boolean);
          book1MothData.push({ id: `book1-${index}`, name: insectName, scientificName: scientificName, scientificFilename: scientificFilename, hostPlants: hostPlantList, source: 'ハムシ', classification: classification });
        });

        // Process mainText
        const mainMothData = [];
        Papa.parse(mainText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          complete: (results) => {
            if (results.errors.length) {
              console.error("PapaParse errors in ListMJ_hostplants_integrated_with_bokutou.csv:", results.errors);
            }
            results.data.forEach((row, index) => {
              const originalMothName = row['和名']?.trim();
              if (!originalMothName) return;

              const mothName = correctMothName(originalMothName);
              const scientificName = row['学名'] || '';
              const scientificFilename = formatScientificNameForFilename(scientificName);

              const familyFromMainCsv = row['科和名'] || row['科名'] || '';

              const classification = {
                family: row['科名'] || '', familyJapanese: row['科和名'] || '', subfamily: row['亜科名'] || '',
                subfamilyJapanese: row['亜科和名'] || '', tribe: row['族名'] || '', tribeJapanese: row['族和名'] || '',
                subtribe: row['亜族名'] || '', subtribeJapanese: row['亜族和名'] || '', genus: row['属名'] || '',
                subgenus: row['亜属名'] || '', speciesEpithet: row['種小名'] || '', subspeciesEpithet: row['亜種小名'] || '',
              };

              const hostPlantEntries = (row['食草'] || ' ')
                .split(';')
                .flatMap(entry => {
                  let plant = entry.trim();
                  console.log('DEBUG: Initial entry:', entry);
                  console.log('DEBUG: Trimmed entry:', plant);
                  plant = plant.replace(/[["(\uFF08\uFF3B\u300C\u300E][^)\]}"）」「』】]*[\\)\]}"（）」「』】]/g, '');
                  console.log('DEBUG: After bracket removal:', plant);
                  plant = plant.replace(/など/g, '');
                  console.log('DEBUG: After "など" removal:', plant);
                  plant = plant.replace(/[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\s,\u3001]/gu, '');
                  console.log('DEBUG: After non-Japanese/symbol removal:', plant);
                  plant = plant.replace(/\s+/g, ' ').trim();
                  console.log('DEBUG: After space normalization and trim:', plant);

                  return plant.split(/,|\u3001/).map(p => {
                    let cleanedP = p.trim();
                    console.log('DEBUG: Sub-entry before final cleaning:', p, '->', cleanedP);
                    const match = cleanedP.match(/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/u);
                    cleanedP = match ? match[0] : '';
                    console.log('DEBUG: After Japanese word extraction:', cleanedP);
                    cleanedP = cleanedP.replace(/科|属/g, '');
                    console.log('DEBUG: After "科"/"属" removal:', cleanedP);
                    cleanedP = cleanedP.trim();
                    console.log('DEBUG: Final cleanedP:', cleanedP);

                    if (!cleanedP) return null;

                    const correctedPlantName = correctPlantName(wameiMap[cleanedP] || cleanedP);

                    return { plant: correctedPlantName, familyFromMainCsv: familyFromMainCsv };
                  });
                }).filter(Boolean);

              const hostPlantList = hostPlantEntries.map(e => e.plant);
              mainMothData.push({ id: `main-${index}`, name: mothName, scientificName: scientificName, scientificFilename: scientificFilename, hostPlants: hostPlantList, source: row['出典'] || '不明', classification });

              hostPlantEntries.forEach(({ plant, familyFromMainCsv }) => {
                if (!hostPlantData[plant]) hostPlantData[plant] = [];
                hostPlantData[plant].push(mothName);

                if (!plantDetailData[plant]) plantDetailData[plant] = { family: '不明' };
                plantDetailData[plant].family = yListPlantFamilyMap[plant] || wameiFamilyMap[plant] || familyFromMainCsv || plantFamilyMap[plant] || '不明';
                plantDetailData[plant].scientificName = yListPlantScientificNameMap[plant] || '';
                plantDetailData[plant].genus = yListPlantScientificNameMap[plant]?.split(' ')[0] || '';
              });
            });
          } // Added missing closing brace for complete callback
        });

        // Combine all moth data after all parsing is complete
        const combinedMothData = [...mainMothData, ...book1MothData];

        setMoths(combinedMothData);
        setHostPlants(hostPlantData);
        setPlantDetails(plantDetailData);
        console.log("All CSVs parsed. Moths count:", combinedMothData.length, "Host Plants count:", Object.keys(hostPlantData).length);
      } // This is the missing closing brace for the fetchData async function
    }; // This is the closing brace for the fetchData function declaration
