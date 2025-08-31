import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import InstagramIcon from './components/InstagramIcon';
import InstagramEmbed from './components/InstagramEmbed';
import { getSourceLink } from './utils/sourceLinks';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { MothStructuredData, ButterflyStructuredData, LeafBeetleStructuredData, BeetleStructuredData } from './components/StructuredData';
import EmergenceTimeDisplay from './components/EmergenceTimeDisplay';
import EnhancedHostPlantDisplay from './components/EnhancedHostPlantDisplay';
// import EnhancedEmergenceTimeDisplay from './components/EnhancedEmergenceTimeDisplay';
import RelatedInsectsSection from './components/RelatedInsectsSection';
import { extractEmergenceTime, normalizeEmergenceTime } from './utils/emergenceTimeUtils';

const MothDetail = ({ moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants }) => {
  // 🔍 デバッグ：コンポーネント呼び出し確認
  console.log('🔍 MothDetail component called');
  
  const { mothId, butterflyId, beetleId, leafbeetleId } = useParams();
  let insectId = mothId || butterflyId || beetleId || leafbeetleId;
  
  // 🔍 デバッグ：URLパラメータ確認
  console.log('🔍 URL params:', { mothId, butterflyId, beetleId, leafbeetleId, insectId });
  
  // ID mapping for compatibility between different data sources
  // Since moths array is built from insects.csv (species-XXX format)
  // We need to map catalog-XXX to species-XXX, not the other way around
  const idMapping = {
    'catalog-3123': 'species-4601', // アオバシャチホコ (Zaranga permagna)
    'catalog-3586': 'species-6115', // アズサキリガ (Pseudopanolis azusa)
    // Add more mappings as needed
  };
  
  // Apply ID mapping if needed
  const mappedInsectId = idMapping[insectId] || insectId;
  
  // 🔍 デバッグ：データ配列の状況確認
  console.log('🔍 Data arrays status:', {
    mothsLength: moths.length,
    butterfliesLength: butterflies.length,
    beetlesLength: beetles.length,
    leafbeetlesLength: leafbeetles.length,
    totalDataLoaded: moths.length + butterflies.length + beetles.length + leafbeetles.length
  });
  
  // Check if data is still loading
  const totalDataLoaded = moths.length + butterflies.length + beetles.length + leafbeetles.length;
  const isDataLoading = totalDataLoaded === 0;
  
  // Add debug logging for アオバシャチホコ
  if (insectId === 'species-4601' || insectId === 'catalog-3123') {
    console.log('🔍 DEBUG アオバシャチホコ ID mapping:', {
      originalId: insectId,
      mappedId: mappedInsectId,
      hasMapping: !!idMapping[insectId],
      idMappingTable: idMapping,
      isDataLoading: isDataLoading,
      totalDataLoaded: totalDataLoaded
    });
  }
  
  // species-6115のIDマッピングデバッグ
  if (insectId === 'species-6115') {
    console.log('DEBUG species-6115 ID mapping:', {
      originalId: insectId,
      mappedId: mappedInsectId,
      hasMapping: !!idMapping[insectId]
    });
  }
  
  // Combine all insects for searching
  const allInsects = [...moths, ...butterflies, ...beetles, ...leafbeetles];
  const moth = allInsects.find(m => m.id === mappedInsectId);
  
  // Debug logging for ID mapping
  if (insectId !== mappedInsectId) {
    console.log(`ID mapped: ${insectId} -> ${mappedInsectId}`);
  }
  
  // Add specific debug for アオバシャチホコ search
  if (insectId === 'species-4601' || insectId === 'catalog-3123' || mappedInsectId === 'species-4601') {
    console.log('🔍 DEBUG アオバシャチホコ search:', {
      originalId: insectId,
      mappedId: mappedInsectId,
      allInsectsLength: allInsects.length,
      mothsLength: moths.length,
      foundMoth: moth,
      foundMothId: moth?.id,
      foundMothName: moth?.name,
      isDataLoading: isDataLoading
    });
    
    // Search manually to see if species-4601 exists
    const manualSearch = allInsects.find(m => m.id === 'species-4601');
    console.log('🔍 Manual search for species-4601:', manualSearch);
    
    // Show first few moths for debugging
    console.log('🔍 First 5 moths:', moths.slice(0, 5).map(m => ({ id: m.id, name: m.name })));
  }
  
  // Debug for catalog-2090 (ヒメウコンカギバ)
  if (mappedInsectId === 'catalog-2090') {
    console.log('DEBUG MothDetail: catalog-2090 (ヒメウコンカギバ) display:', {
      id: moth?.id,
      name: moth?.name,
      remarks: moth?.remarks,
      geographicalRemarks: moth?.geographicalRemarks,
      type: moth?.type,
      hostPlants: moth?.hostPlants,
      hasRemarks: !!(moth?.remarks && moth?.remarks.trim()),
      remarksIncludesPipe: moth?.remarks?.includes('|')
    });
  }
  
  // Debug logging for オオゴマシジミ
  if (mappedInsectId === 'butterfly-csv-131' || (moth && moth.name === 'オオゴマシジミ')) {
    console.log('=== DEBUG オオゴマシジミ SEARCH ===');
    console.log('  insectId:', insectId);
    console.log('  mappedInsectId:', mappedInsectId);
    console.log('  found moth:', moth);
    if (moth) {
      console.log('  moth.name:', moth.name);
      console.log('  moth.geographicalRemarks:', moth.geographicalRemarks);
      console.log('  moth.type:', moth.type);
    }
    console.log('  butterflies array length:', butterflies.length);
    const ogomaButterfly = butterflies.find(b => b.name === 'オオゴマシジミ');
    console.log('  direct search for オオゴマシジミ in butterflies:', ogomaButterfly);
  }
  
  // Debug logging for catalog-6065 (スミレモンキリガ)
  if (mappedInsectId === 'catalog-6065') {
    console.log('DEBUG catalog-6065: Found moth:', moth);
    if (moth) {
      console.log('DEBUG catalog-6065: hostPlants:', moth.hostPlants);
      console.log('DEBUG catalog-6065: hostPlantDetails:', moth.hostPlantDetails);
      // Log the actual plant names
      if (Array.isArray(moth.hostPlants) && moth.hostPlants.length > 0) {
        moth.hostPlants.forEach((plant, index) => {
          console.log(`DEBUG catalog-6065: hostPlant[${index}] = "${plant}"`);
        });
      }
      if (moth.hostPlantDetails && moth.hostPlantDetails.length > 0) {
        moth.hostPlantDetails.forEach((detail, index) => {
          console.log(`DEBUG catalog-6065: hostPlantDetail[${index}] = `, detail);
        });
      }
    }
  }
  

  // Debug logging for センモンヤガ
  if (mappedInsectId === 'catalog-3489' || mappedInsectId === 'main-6519') {
    console.log('DEBUG: Looking for センモンヤガ with ID:', mappedInsectId);
    console.log('DEBUG: Found moth:', moth);
    if (moth) {
      console.log('DEBUG: センモンヤガ hostPlants:', moth.hostPlants);
      console.log('DEBUG: センモンヤガ hostPlantDetails:', moth.hostPlantDetails);
    }
  }
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Filter alternative names to exclude duplicates of the primary name
  const alternativeNamesFiltered = React.useMemo(() => {
    const raw = (moth?.alternativeNames || '').trim();
    if (!raw) return '';
    const items = raw.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    const filtered = Array.from(new Set(items.filter(n => n !== moth?.name)));
    return filtered.join('、');
  }, [moth?.alternativeNames, moth?.name]);

  // General-notes emergence-time detector (type is not fixed)
  const isEmergenceNote = (note) => {
    const t = (note?.type || '').trim();
    const c = (note?.content || '').trim();
    if (!c) return false;
    const typeHit = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期']
      .some(k => t.includes(k));
    const contentHit = /\d+\s*月|成虫|発生/.test(c);
    return typeHit || (!t && contentHit);
  };

  // SEO optimization: Update page title and meta tags
  useEffect(() => {
    if (moth) {
      const insectType = moth.type === 'butterfly' ? '蝶' : moth.type === 'beetle' ? 'タマムシ' : moth.type === 'leafbeetle' ? 'ハムシ' : '蛾';
      const title = `${moth.name} (${moth.scientificName}) | ${insectType}の詳細 - 昆虫食草図鑑`;
      const hostPlantsText = Array.isArray(moth.hostPlants)
        ? (moth.hostPlants.length ? moth.hostPlants.join('、') : '不明')
        : (typeof moth.hostPlants === 'string' && moth.hostPlants.trim()
            ? moth.hostPlants
            : '不明');
      const description = `${moth.name}（${moth.scientificName}）の詳細情報。食草: ${hostPlantsText}。昆虫食草図鑑で${insectType}と植物の関係を詳しく学ぼう。`;
      
      document.title = title;
      
      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = description;

      // Update canonical to static meta page for better SEO crawling
      const canonicalHref = `https://orau98.github.io/meta/${moth.type === 'butterfly' ? 'butterfly' : moth.type === 'beetle' ? 'beetle' : moth.type === 'leafbeetle' ? 'leafbeetle' : 'moth'}/${moth.id}.html`;
      let linkCanonical = document.querySelector('link[rel="canonical"]');
      if (!linkCanonical) {
        linkCanonical = document.createElement('link');
        linkCanonical.rel = 'canonical';
        document.head.appendChild(linkCanonical);
      }
      linkCanonical.href = canonicalHref;
      
      // Update OG tags
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.content = title;
      
      let ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) ogDescription.content = description;
      
      // Add structured data for the specific insect
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": moth.name,
        "description": description,
        "author": {
          "@type": "Organization",
          "name": "昆虫食草図鑑"
        },
        "publisher": {
          "@type": "Organization",
          "name": "昆虫食草図鑑"
        },
        "mainEntity": {
          "@type": "Animal",
          "name": moth.name,
          "scientificName": moth.scientificName,
          "classification": moth.classification?.familyJapanese || '不明'
        }
      };
      
      let structuredDataScript = document.querySelector('#insect-structured-data');
      if (!structuredDataScript) {
        structuredDataScript = document.createElement('script');
        structuredDataScript.id = 'insect-structured-data';
        structuredDataScript.type = 'application/ld+json';
        document.head.appendChild(structuredDataScript);
      }
      structuredDataScript.textContent = JSON.stringify(structuredData);
    }
    
    // Cleanup function to restore original title
    return () => {
      document.title = '昆虫食草図鑑 - 蛾と食草の繋がりを探る | 7000種以上の昆虫データベース';
      const linkCanonical = document.querySelector('link[rel="canonical"]');
      if (linkCanonical) {
        linkCanonical.href = 'https://orau98.github.io/';
      }
      const structuredDataScript = document.querySelector('#insect-structured-data');
      if (structuredDataScript) {
        structuredDataScript.remove();
      }
    };
  }, [moth]);

  // Show loading state if data is still loading
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-400 rounded-full flex items-center justify-center animate-pulse">
            <svg className="w-10 h-10 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">データを読み込んでいます...</h1>
          <p className="text-slate-600 dark:text-slate-400">昆虫データベースを読み込んでいます。しばらくお待ちください。</p>
        </div>
      </div>
    );
  }

  if (!moth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-400 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">昆虫が見つかりません</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">指定されたIDの昆虫は存在しません。</p>
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            リストに戻る
          </Link>
        </div>
      </div>
    );
  }

  // Group related moths by host plant
  const relatedMothsByPlant = {};
  
  // Get plant names from current moth - handle both string and array formats
  let currentMothPlants = [];
  if (moth.hostPlantsDetailed && moth.hostPlantsDetailed.length > 0) {
    // Use new detailed format
    currentMothPlants = moth.hostPlantsDetailed.map(plant => plant.name).filter(name => name);
  } else if (moth.hostPlants) {
    // Handle old format - could be string or array
    if (typeof moth.hostPlants === 'string') {
      // Split by common delimiters and clean up
      currentMothPlants = moth.hostPlants.split(/[;；、,]/)
        .map(plant => plant.trim())
        .filter(plant => plant && plant !== '不明')
        .map(plant => {
          // Remove family annotations like （〇〇科）
          return plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
        })
        .filter(plant => plant);
    } else if (Array.isArray(moth.hostPlants)) {
      currentMothPlants = moth.hostPlants.filter(plant => plant && plant !== '不明');
    }
  }

  currentMothPlants.forEach(plant => {
    // Extract base plant name for matching (e.g., "フジの花蕾" -> "フジ")
    let basePlantName = plant;
    const partMatch = plant.match(/^([^の]+)の/);
    if (partMatch) {
      basePlantName = partMatch[1];
    }
    
    // Try both full plant name and base plant name
    const plantsToCheck = [plant, basePlantName];
    
    plantsToCheck.forEach(checkPlant => {
      if (hostPlants[checkPlant]) {
        const relatedMoths = hostPlants[checkPlant].filter(mothName => mothName !== moth.name);
        if (relatedMoths.length > 0) {
          // Use base plant name for display (without parts like "の花蕾")
          if (!relatedMothsByPlant[basePlantName]) {
            relatedMothsByPlant[basePlantName] = [];
          }
          // Add unique moths only
          relatedMoths.forEach(mothName => {
            if (!relatedMothsByPlant[basePlantName].includes(mothName)) {
              relatedMothsByPlant[basePlantName].push(mothName);
            }
          });
        }
      }
    });
  });

  // Debug logging for アオバシャチホコ
  if (moth.name === 'アオバシャチホコ') {
    console.log('DEBUG アオバシャチホコ関連昆虫:', {
      currentMothPlants,
      relatedMothsByPlant,
      hostPlantsKeys: Object.keys(hostPlants),
      hostPlantsForヤマボウシ: hostPlants['ヤマボウシ'],
      hostPlantsForミズキ: hostPlants['ミズキ'],
      hostPlantsForクマノミズキ: hostPlants['クマノミズキ']
    });
  }

  // Get plant names from current moth - handle both string and array formats
  // (reusing existing relatedMothsByPlant and currentMothPlants from above)
  if (moth.hostPlantsDetailed && moth.hostPlantsDetailed.length > 0) {
    // Use new detailed format
    currentMothPlants = moth.hostPlantsDetailed.map(plant => plant.name).filter(name => name);
  } else if (moth.hostPlants) {
    // Handle old format - could be string or array
    if (typeof moth.hostPlants === 'string') {
      // Split by common delimiters and clean up
      currentMothPlants = moth.hostPlants.split(/[;；、,]/)
        .map(plant => plant.trim())
        .filter(plant => plant && plant !== '不明')
        .map(plant => {
          // Remove family annotations like （○○科）
          return plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
        })
        .filter(plant => plant);
    } else if (Array.isArray(moth.hostPlants)) {
      currentMothPlants = moth.hostPlants.filter(plant => plant && plant !== '不明');
    }
  }

  currentMothPlants.forEach(plant => {
    // Extract base plant name for matching (e.g., "フジの花蕾" -> "フジ")
    let basePlantName = plant;
    const partMatch = plant.match(/^([^の]+)の/);
    if (partMatch) {
      basePlantName = partMatch[1];
    }
    
    // Try both full plant name and base plant name
    const plantsToCheck = [plant, basePlantName];
    
    plantsToCheck.forEach(checkPlant => {
      if (hostPlants[checkPlant]) {
        const relatedMoths = hostPlants[checkPlant].filter(mothName => mothName !== moth.name);
        if (relatedMoths.length > 0) {
          // Use base plant name for display (without parts like "の花蕾")
          if (!relatedMothsByPlant[basePlantName]) {
            relatedMothsByPlant[basePlantName] = [];
          }
          // Add unique moths only
          relatedMoths.forEach(mothName => {
            if (!relatedMothsByPlant[basePlantName].includes(mothName)) {
              relatedMothsByPlant[basePlantName].push(mothName);
            }
          });
        }
      }
    });
  });

  // Debug logging for アオバシャチホコ
  if (moth.name === 'アオバシャチホコ') {
    console.log('DEBUG アオバシャチホコ関連昆虫:', {
      currentMothPlants,
      relatedMothsByPlant,
      hostPlantsKeys: Object.keys(hostPlants),
      hasYamaboushi: hostPlants['ヤマボウシ'] || 'not found',
      hasMizuki: hostPlants['ミズキ'] || 'not found',
      hasKumanoMizuki: hostPlants['クマノミズキ'] || 'not found'
    });
  }

  // Also keep the old format for backward compatibility
  const relatedMoths = new Set();
  currentMothPlants.forEach(plant => {
    // Extract base plant name for matching (e.g., "フジの花蕾" -> "フジ")
    let basePlantName = plant;
    const partMatch = plant.match(/^([^の]+)の/);
    if (partMatch) {
      basePlantName = partMatch[1];
    }
    
    // Try both full plant name and base plant name
    const plantsToCheck = [plant, basePlantName];
    
    plantsToCheck.forEach(checkPlant => {
      if (hostPlants[checkPlant]) {
        hostPlants[checkPlant].forEach(mothName => {
          if (mothName !== moth.name) {
            relatedMoths.add(mothName);
          }
        });
      }
    });
  });

  // Check if Instagram post is available
  const hasInstagramPost = moth.instagramUrl && moth.instagramUrl.trim();
  
  // Create safe filename for static image fallback
  const createSafeFilename = (scientificName) => {
    if (!scientificName) return '';
    let cleanedName = scientificName.replace(/\s*\(.*?(?:\)|\s*$)/g, '');
    cleanedName = cleanedName.replace(/\s*,\s*\d{4}\s*$/, '');
    cleanedName = cleanedName.replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '');
    // More specific pattern to remove author names - only remove if it's after a binomial name
    cleanedName = cleanedName.replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1');
    cleanedName = cleanedName.replace(/[^a-zA-Z0-9\s]/g, '');
    cleanedName = cleanedName.replace(/\s+/g, '_');
    return cleanedName;
  };

  const safeFilename = moth.scientificFilename || createSafeFilename(moth.scientificName);
  const japaneseName = moth.name;
  
  // 画像拡張子・ファイル名リスト（詳細でも堅牢に解決）
  const [imageExtensions, setImageExtensions] = useState({});
  const [imageBases, setImageBases] = useState([]);
  
  useEffect(() => {
    const loadImageExtensions = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}image_extensions.json?v=${Date.now()}`);
        if (response.ok) {
          const extensions = await response.json();
          setImageExtensions(extensions);
        }
      } catch (error) {
        console.warn('Failed to load image extensions:', error);
        setImageExtensions({});
      }
    };
    const loadImageFilenames = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}image_filenames.txt?v=${Date.now()}`);
        if (res.ok) {
          const text = await res.text();
          const list = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          setImageBases(list);
        }
      } catch (e) {
        console.debug('Failed to load image_filenames.txt:', e);
      }
    };

    loadImageExtensions();
    loadImageFilenames();
  }, []);

  // 画像候補（拡張子マップ + フォールバック拡張子を試行）
  const possibleImagePaths = React.useMemo(() => {
    const exts = imageExtensions || {};
    const v = `?v=${Date.now()}`;
    const build = (name, ext) => `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(name)}${ext}${v}`;
    const uniq = new Set();
    const push = (url) => { if (url && !uniq.has(url)) uniq.add(url); };
    const tryExts = ['.jpg', '.jpeg', '.png', '.webp'];

    // 1) mapping-priority
    if (exts[safeFilename]) push(build(safeFilename, exts[safeFilename]));
    if (exts[japaneseName]) push(build(japaneseName, exts[japaneseName]));

    // 2) fallback exts for scientific filename
    tryExts.forEach(ext => push(build(safeFilename, ext)));

    // 3) fallback exts for Japanese filename
    tryExts.forEach(ext => push(build(japaneseName, ext)));

    // 4) filename list-based matching (e.g., "Amraica superans superans Butler")
    try {
      if (imageBases && imageBases.length > 0 && moth?.scientificName) {
        const sci = moth.scientificName.replace(/\s*\(.*$/, '').trim(); // "Genus species"
        const [genus, species] = sci.split(/\s+/);
        if (genus && species) {
          const candidates = imageBases.filter(base => base.includes(genus) && base.includes(species));
          // Prefer the shortest matching base (likely closest to binomial)
          candidates.sort((a, b) => a.length - b.length);
          for (const base of candidates) {
            if (exts[base]) push(build(base, exts[base]));
            else {
              tryExts.forEach(ext => push(build(base, ext)));
            }
          }
        }
      }
    } catch (_) {}

    return Array.from(uniq);
  }, [imageExtensions, imageBases, safeFilename, japaneseName, moth?.scientificName]);
  
  const staticImagePath = possibleImagePaths[0]; // Default to scientific name
  
  // Debug logging
  console.log('Moth ID:', moth.id);
  console.log('Instagram URL:', moth.instagramUrl);
  console.log('Has Instagram Post:', hasInstagramPost);
  console.log('Static Image Path:', staticImagePath);
  
  // Additional debug for beetles
  if (moth.type === 'beetle') {
    console.log('DEBUG: Beetle detail view:', {
      name: moth.name,
      scientificName: moth.scientificName,
      scientificFilename: moth.scientificFilename,
      safeFilename: safeFilename,
      japaneseName: japaneseName,
      imageExtensions: imageExtensions,
      possibleImagePaths: possibleImagePaths
    });
  }

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    if (currentImageIndex < possibleImagePaths.length - 1) {
      // Try next image path
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      // All paths failed
      setImageLoaded(false);
      setImageError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* 構造化データ */}
      {mothId && moth && <MothStructuredData moth={moth} />}
      {butterflyId && moth && <ButterflyStructuredData butterfly={moth} />}
      {(beetleId || leafbeetleId) && moth && <LeafBeetleStructuredData leafbeetle={moth} />}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-200 shadow-sm hover:shadow-md text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
ホームに戻る
          </Link>
          
          {/* 分類情報をヘッダーに表示 */}
          <div className="flex flex-wrap gap-2">
            {moth.classification.familyJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.familyJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
              >
                <span className="font-medium">{moth.classification.familyJapanese}</span>
                {moth.classification.family && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.family}</span>
                )}
              </Link>
            )}
            {moth.classification.subfamilyJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.subfamilyJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50"
              >
                <span className="font-medium">{moth.classification.subfamilyJapanese}</span>
                {moth.classification.subfamily && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.subfamily}</span>
                )}
              </Link>
            )}
            {moth.classification.tribeJapanese && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.tribeJapanese)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
              >
                <span className="font-medium">{moth.classification.tribeJapanese}</span>
                {moth.classification.tribe && (
                  <span className="ml-1 text-xs italic opacity-80">{moth.classification.tribe}</span>
                )}
              </Link>
            )}
            {moth.classification.genus && (
              <Link
                to={`/?classification=${encodeURIComponent(moth.classification.genus)}`}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900/50 transition-all duration-200 border border-slate-200/50 dark:border-slate-700/50"
              >
                <span className="font-medium italic">{moth.classification.genus}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 画像セクション */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-white/20 dark:border-slate-700/50">
                {hasInstagramPost ? (
                  <div className="p-3">
                    <InstagramEmbed url={moth.instagramUrl} />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] bg-blue-50 dark:bg-blue-900/20 group overflow-hidden">
                    {!imageError && possibleImagePaths.length > 0 ? (
                      <div className="relative h-full w-full">
                        <img 
                          src={possibleImagePaths[currentImageIndex]} 
                          alt={`${moth.name}（${moth.scientificName}）の写真 - ${moth.classification?.familyJapanese || '蛾科'}に属する昆虫`}
                          className={`w-full h-full object-contain transition-all duration-700 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                          onLoad={handleImageLoad}
                          onError={handleImageError}
                        />
                        {/* Elegant gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        {/* Moth name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                          <h3 className="text-white font-bold text-lg drop-shadow-lg">{moth.name}</h3>
                          <p className="text-white/90 text-sm drop-shadow-md">{formatScientificNameReact(moth.scientificName)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <div className="text-center p-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">画像が見つかりません</p>
                        </div>
                      </div>
                    )}
                    
                    {!imageLoaded && !imageError && possibleImagePaths.length > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 dark:bg-blue-900/40">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-700 rounded-full"></div>
                          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="p-4">
                  {hasInstagramPost && (
                    <div className="flex items-center justify-end mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <InstagramIcon className="w-4 h-4 mr-2" />
                        Instagram
                      </span>
                    </div>
                  )}
                  
                  {hasInstagramPost && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <InstagramIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Instagram投稿
                          </span>
                        </div>
                        <a 
                          href={moth.instagramUrl} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                        >
                          投稿を見る →
                        </a>
                      </div>
                      {moth.instagramDate && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          <span className="font-medium">投稿日:</span> {moth.instagramDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 情報セクション */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* 種名情報 */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden p-6">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
                {moth.name}
              </h1>
              {alternativeNamesFiltered && (
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-2">
                  別名: {alternativeNamesFiltered}
                </p>
              )}
              <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">
                {formatScientificNameReact(moth.scientificName)}
              </p>
            </div>

            {/* 食草情報 */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
              <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-emerald-200/30 dark:border-emerald-700/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    食草・食樹
                    {moth.isMonophagous && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        単食性
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              
              <div className="p-4">
                {/* 備考内容の重複を防ぐための追跡 */}
                {(() => {
                  // コンポーネント内で表示済み備考を追跡するSet
                  window.displayedRemarks = new Set();
                  return null;
                })()}
                
                {/* 備考から部位情報を抽出して食草と統合する処理 */}
                {(() => {
                  // 部位情報を抽出する関数
                  const extractPlantParts = (notes) => {
                    if (!notes || !Array.isArray(notes)) return {};
                    
                    const plantParts = {};
                    const partKeywords = ['花', '実', '果実', '葉', '茎', '根', '枝', '樹皮', '蕾', '若葉'];
                    
                    notes.forEach(note => {
                      partKeywords.forEach(part => {
                        // 基本的な部位情報チェック（「の花」「花」など）
                        if (note.includes(part)) {
                          // 植物名を抽出する試み
                          // 例: "ツバキの花を食べる" -> ツバキ: [花]
                          const plantMatch = note.match(/(\S+?)(?:の|から|で)?\s*(?:花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)/);
                          if (plantMatch) {
                            const plantName = plantMatch[1];
                            if (!plantParts[plantName]) plantParts[plantName] = new Set();
                            plantParts[plantName].add(part);
                          }
                          // 汎用的な部位情報も記録
                          if (!plantParts['*']) plantParts['*'] = new Set();  
                          plantParts['*'].add(part);
                        }
                        
                        // 「などの花」「など花」形式もチェック
                        const extendedPattern = new RegExp(`(など|等)の?${part}`, 'g');
                        if (extendedPattern.test(note)) {
                          if (!plantParts['*']) plantParts['*'] = new Set();  
                          plantParts['*'].add(part);
                        }
                      });
                    });
                    
                    // SetをArrayに変換
                    Object.keys(plantParts).forEach(key => {
                      plantParts[key] = Array.from(plantParts[key]);
                    });
                    
                    return plantParts;
                  };
                  
                  // 部位情報を抽出
                  const plantPartsInfo = extractPlantParts(moth.hostPlantNotes);
                  
                  // スミレモンキリガのデバッグ
                  if (moth.id === 'catalog-6065') {
                    console.log('DEBUG catalog-6065 plant parts extraction:', {
                      hostPlantNotes: moth.hostPlantNotes,
                      extractedParts: plantPartsInfo
                    });
                  }
                  
                  // グローバルに保存して食草表示時に使用
                  window.currentPlantParts = plantPartsInfo;
                  return null;
                })()}
                
                {(() => {
                  const hostPlantsArray = Array.isArray(moth.hostPlants)
                    ? moth.hostPlants
                    : (typeof moth.hostPlants === 'string' && moth.hostPlants.trim()
                        ? moth.hostPlants.split(/[;；、,]/).map(p => p.trim()).filter(Boolean)
                        : []);
                  const hostPlantsDetailedArray = Array.isArray(moth.hostPlantsDetailed)
                    ? moth.hostPlantsDetailed
                    : (Array.isArray(moth.hostPlantDetails) ? moth.hostPlantDetails : []);
                  return (
                    <EnhancedHostPlantDisplay 
                      hostPlants={hostPlantsArray}
                      hostPlantsDetailed={hostPlantsDetailedArray}
                      showDetailsByDefault={false}
                      maxDisplayCount={10}
                    />
                  );
                })()}

                {/* 食草備考表示 */}
                {moth.hostPlantNotes && moth.hostPlantNotes.length > 0 && (() => {
                  const filteredNotes = moth.hostPlantNotes.filter(note => {
                      if (!note) return false; // 空の場合は除外
                      
                      // 既存の食草データから部位情報を抽出
                      const existingParts = new Set();
                      
                      // hostPlants から既存の部位情報を抽出
                      Array.isArray(moth.hostPlants) && moth.hostPlants.forEach(plant => {
                        // 括弧内の部位情報
                        const match = plant.match(/（([^）]+)）$/);
                        if (match) {
                          match[1].split('・').forEach(part => existingParts.add(part.trim()));
                        }
                        
                        // 「などの花」「など花」形式の部位情報
                        const partKeywords = ['花', '実', '果実', '葉', '茎', '根', '枝', '樹皮', '蕾', '若葉'];
                        partKeywords.forEach(part => {
                          const extendedPattern = new RegExp(`(など|等)の?${part}`, 'g');
                          if (extendedPattern.test(plant)) {
                            existingParts.add(part);
                          }
                        });
                      });
                      
                      // hostPlantDetails から既存の部位情報を抽出
                      if (moth.hostPlantDetails) {
                        moth.hostPlantDetails.forEach(detail => {
                          // 括弧内の部位情報
                          const match = detail.plant.match(/（([^）]+)）$/);
                          if (match) {
                            match[1].split('・').forEach(part => existingParts.add(part.trim()));
                          }
                          
                          // 「などの花」「など花」形式の部位情報
                          const partKeywords = ['花', '実', '果実', '葉', '茎', '根', '枝', '樹皮', '蕾', '若葉'];
                          partKeywords.forEach(part => {
                            const extendedPattern = new RegExp(`(など|等)の?${part}`, 'g');
                            if (extendedPattern.test(detail.plant)) {
                              existingParts.add(part);
                            }
                          });
                        });
                      }
                      
                      // 新たに抽出された部位情報も追加
                      const plantParts = window.currentPlantParts || {};
                      Object.values(plantParts).flat().forEach(part => existingParts.add(part));
                      
                      // catalog-2604特別対応：「などの花」「の花」を含む備考は完全除去
                      if (moth.id === 'catalog-2604') {
                        console.log('DEBUG catalog-2604 filtering note:', note);
                        // 「の花」「などの花」が含まれる場合は無条件で除去
                        if (note.includes('の花') || note.includes('など花') || note.includes('などの花')) {
                          console.log('DEBUG catalog-2604: Filtering out flower note:', note);
                          return false;
                        }
                      }
                      
                      // 既に統合済みの部位情報を含む備考は除去
                      const hasExistingPart = Array.from(existingParts).some(part => note.includes(part));
                      if (hasExistingPart) {
                        // 部位情報のみの備考は除去（強化版）
                        // パターン1: 「の花」「の実」「から花」「で花」など
                        const simplePartPattern = /^[^、；;]*?(の|から|で)(花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)[^、；;]*?[。．]?$/;
                        // パターン2: 「などの花」「など花」「等の花」「等花」など
                        const extendedPartPattern = /^[^、；;]*?(など|等)(の)?(花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)[^、；;]*?[。．]?$/;
                        // パターン3: 単純な部位のみ「花」「実」など
                        const singlePartPattern = /^[^、；;]*?(花|実|果実|葉|茎|根|枝|樹皮|蕾|若葉)[^、；;]*?[。．]?$/;
                        
                        if (simplePartPattern.test(note) || extendedPartPattern.test(note) || singlePartPattern.test(note)) {
                          return false; // 部位情報のみの場合は除去
                        }
                        
                        // その他の重要な情報が含まれている場合のみ残す
                        const hasOtherImportantInfo = note.match(/生態|習性|時期|条件|環境|地域|分布/);
                        return hasOtherImportantInfo;
                      }
                      
                      // その他の一般的なフィルタリング
                      return !note.includes('花・若い翼果');
                    });
                  
                  // Debug logging for catalog-2604
                  if (moth.id === 'catalog-2604') {
                    console.log('DEBUG catalog-2604 hostPlantNotes section:', {
                      original: moth.hostPlantNotes,
                      filtered: filteredNotes
                    });
                  }
                  
                  // 重複チェック - 既に表示された内容をスキップ
                  const uniqueNotes = filteredNotes.filter(note => {
                    if (window.displayedRemarks && window.displayedRemarks.has(note.trim())) {
                      return false; // 既に表示済みの場合はスキップ
                    }
                    window.displayedRemarks.add(note.trim());
                    return true;
                  });
                  
                  if (uniqueNotes.length === 0) return null;
                  
                  return (
                    <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">備考:</span>
                        {uniqueNotes.map((note, noteIndex) => (
                          <span key={noteIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* 地理的備考・生態学的特徴 - moth.remarksも考慮 */}
                {((moth.geographicalRemarks && typeof moth.geographicalRemarks === 'string' && moth.geographicalRemarks.trim()) || 
                  (moth.remarks && typeof moth.remarks === 'string' && moth.remarks.trim() && moth.type === 'moth')) && (() => {
                  // Debug logging for オオゴマシジミ
                  if (moth.name === 'オオゴマシジミ') {
                    console.log('=== DEBUG オオゴマシジミ geographicalRemarks section ===');
                    console.log('  moth.geographicalRemarks:', moth.geographicalRemarks);
                    console.log('  moth.geographicalRemarks type:', typeof moth.geographicalRemarks);
                    console.log('  moth.geographicalRemarks length:', moth.geographicalRemarks ? moth.geographicalRemarks.length : 0);
                    console.log('  moth.geographicalRemarks.trim():', moth.geographicalRemarks ? moth.geographicalRemarks.trim() : 'N/A');
                    console.log('  moth.id:', moth.id);
                    console.log('  moth.name:', moth.name);
                    console.log('  moth.type:', moth.type);
                    console.log('  Full moth object:', moth);
                  }
                  
                  // Debug logging for catalog-2604
                  if (moth.id === 'catalog-2604') {
                    console.log('DEBUG catalog-2604 geographicalRemarks section:', {
                      content: moth.geographicalRemarks,
                      isEcological: moth.geographicalRemarks.trim().match(/^(単食性|広食性|狭食性)$/)
                    });
                  }
                  
                  // 重複チェック - 生態情報（単食性等）でない場合のみチェック
                  // moth.remarksがある場合は優先して使用
                  const remarksContent = (moth.type === 'moth' && moth.remarks && moth.remarks.trim()) ? 
                                        moth.remarks.trim() : 
                                        (moth.geographicalRemarks ? moth.geographicalRemarks.trim() : '');
                  if (!remarksContent) return false;
                  
                  const isEcological = remarksContent.match(/^(単食性|広食性|狭食性)$/);
                  
                  if (!isEcological && window.displayedRemarks && window.displayedRemarks.has(remarksContent)) {
                    return false; // 既に表示済みの場合はスキップ
                  }
                  
                  if (!isEcological) {
                    window.displayedRemarks.add(remarksContent);
                  }
                  
                  return true;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex flex-wrap gap-2">
                      {/* 生態学的特徴（単食性、広食性など）か地域情報かを判断 */}
                      {(() => {
                        // moth.remarksがある場合は優先して使用
                        const displayRemarks = (moth.type === 'moth' && moth.remarks && moth.remarks.trim()) ? 
                                              moth.remarks.trim() : 
                                              (moth.geographicalRemarks ? moth.geographicalRemarks.trim() : '');
                        
                        if (displayRemarks.match(/^(単食性|広食性|狭食性)$/)) {
                          return (
                            <>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">食性:</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                {displayRemarks}
                              </span>
                            </>
                          );
                        } else if ((moth.name === 'ルリシジミ' || moth.japaneseName === 'ルリシジミ') && displayRemarks.includes('。')) {
                          return (
                            <>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">備考:</span>
                              <div className="flex flex-col gap-2 mt-2 w-full">
                                {displayRemarks.split('。').filter(s => s.trim()).map((sentence, idx) => (
                                  <div key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                    <span className="mr-2">•</span>
                                    <span>{sentence.trim()}。</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">備考:</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                {displayRemarks}
                              </span>
                            </>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* シンプルな備考表示 - 蛾とタマムシの場合（重複を避ける） */}
                {(() => {
                  // Debug logging for remarks
                  if (moth.id && (moth.id.includes('2090') || moth.id.includes('2102'))) {
                    console.log('DEBUG moth remarks:', {
                      id: moth.id,
                      name: moth.name,
                      remarks: moth.remarks,
                      geographicalRemarks: moth.geographicalRemarks,
                      type: moth.type
                    });
                  }
                  // geographicalRemarksと同じ内容の場合は表示しない（重複を避ける）
                  return (moth.type === 'moth' || moth.type === 'beetle') && 
                         moth.remarks && moth.remarks.trim() && 
                         !moth.remarks.includes('|') &&
                         moth.remarks !== moth.geographicalRemarks;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">備考:</span>
                      {(() => {
                        // セミコロン(;)で区切られている場合は箇条書きにする
                        if (moth.remarks.includes(';')) {
                          const remarkItems = moth.remarks.split(';').map(item => item.trim()).filter(item => item);
                          return (
                            <div className="flex-1 space-y-2">
                              {remarkItems.map((item, index) => (
                                <div key={index} className="flex items-start space-x-2">
                                  <span className="text-orange-600 dark:text-orange-400 mt-0.5">•</span>
                                  <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {item}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                              {moth.remarks.trim()}
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* 詳細備考情報（キリガデータ統合対応） - ルリシジミや既に備考表示済みの蝶は除外 */}
                {(moth.remarks && moth.remarks.includes('|') && !(moth.name === 'ルリシジミ' || moth.japaneseName === 'ルリシジミ')) && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="space-y-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">詳細情報:</span>
                      {(() => {
                        // butterflyの場合、geographicalRemarksをremarksとして扱う
                        const actualRemarks = moth.remarks || (moth.type === 'butterfly' && moth.geographicalRemarks ? moth.geographicalRemarks : '');
                        
                        if (!actualRemarks) return null;
                        
                        return actualRemarks.split(' | ').map((remark, remarkIndex) => {
                        // 成虫発生時期を含む備考は除外
                        const { notes: filteredRemark } = extractEmergenceTime(remark);
                        if (!filteredRemark.trim()) return null;
                        // 食草備考の場合 - 本来の食草情報として扱う
                        if (remark.startsWith('食草: ')) {
                          const content = remark.substring(3);
                          // 食草データが空の場合、備考の食草情報を主要食草として表示
                          if (moth.hostPlants.length === 0) {
                            const foodPlants = content.split(/[、，,;；]/).map(p => p.trim()).filter(p => p.length > 0);
                            return (
                              <div key={remarkIndex} className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700/50">
                                <div className="flex items-start space-x-2">
                                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">食草情報（文献記録）:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {foodPlants.map((plant, plantIndex) => (
                                        <span key={plantIndex} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                          {plant}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{content}</p>
                            </div>
                          );
                        }
                        // 発生時期の場合
                        else if (remark.startsWith('発生時期: ')) {
                          const content = remark.substring(5);
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{content}</p>
                            </div>
                          );
                        }
                        // 旧備考の場合
                        else if (remark.startsWith('旧備考: ')) {
                          const content = remark.substring(4);
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-600 dark:text-slate-400 italic">{content}</p>
                            </div>
                          );
                        }
                        // その他の備考
                        else {
                          // ルリシジミの場合、文章を箇条書きにする
                          if ((moth.name === 'ルリシジミ' || moth.japaneseName === 'ルリシジミ') && remark.includes('。')) {
                            const sentences = remark.split('。').filter(s => s.trim());
                            return (
                              <div key={remarkIndex} className="space-y-2">
                                <div className="flex items-start space-x-2">
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="space-y-1">
                                    {sentences.map((sentence, idx) => (
                                      <div key={idx} className="flex items-start">
                                        <span className="text-blue-500 dark:text-blue-400 mr-2">•</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{sentence.trim()}。</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          // 通常の備考
                          return (
                            <div key={remarkIndex} className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{remark}</p>
                            </div>
                          );
                        }
                      });
                      })()}
                    </div>
                  </div>
                )}

                {/* 成虫発生時期を除去した備考情報 */}
                {moth.notes && (() => {
                  let { notes: remainingNotes } = extractEmergenceTime(moth.notes);
                  
                  // catalog-2604特別対応：「などの花」「の花」を含む備考は完全除去
                  if (moth.id === 'catalog-2604') {
                    console.log('DEBUG catalog-2604 notes section:', {
                      original: moth.notes,
                      remaining: remainingNotes
                    });
                    if (remainingNotes.includes('の花') || remainingNotes.includes('など花') || remainingNotes.includes('などの花')) {
                      console.log('DEBUG catalog-2604: Filtering out flower note in condition check:', remainingNotes);
                      remainingNotes = '';
                    }
                  }
                  
                  // 重複チェック
                  const trimmedNotes = remainingNotes.trim();
                  if (window.displayedRemarks && window.displayedRemarks.has(trimmedNotes)) {
                    return false; // 既に表示済みの場合はスキップ
                  }
                  
                  if (trimmedNotes) {
                    window.displayedRemarks.add(trimmedNotes);
                  }
                  
                  return trimmedNotes;
                })() && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-medium">備考:</span>{' '}
                        {(() => {
                          let { notes: remainingNotes } = extractEmergenceTime(moth.notes);
                          
                          // catalog-2604特別対応：「などの花」「の花」を含む備考は完全除去
                          if (moth.id === 'catalog-2604') {
                            console.log('DEBUG catalog-2604 filtering remainingNotes:', remainingNotes);
                            if (remainingNotes.includes('の花') || remainingNotes.includes('など花') || remainingNotes.includes('などの花')) {
                              console.log('DEBUG catalog-2604: Filtering out flower note in remaining notes:', remainingNotes);
                              remainingNotes = '';
                            }
                          }
                          
                          return remainingNotes.trim();
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* 出典情報 */}
                {moth.source && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                    <div className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-500 dark:text-slate-400">出典:</span>{' '}
                        {getSourceLink(moth.source) ? (
                          <a 
                            href={getSourceLink(moth.source)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 underline decoration-slate-300 hover:decoration-slate-400 transition-colors duration-200"
                          >
                            {moth.source}
                            <svg className="w-3 h-3 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="font-medium">{moth.source}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 成虫発生時期情報 - ハムシと蛾で表示 */}
            {(moth.type === 'leafbeetle' || moth.type === 'moth') && (() => {
              const hasDetailedTime = moth.emergenceTimeDetailed && moth.emergenceTimeDetailed.length > 0;
              const hasExistingTime = moth.emergenceTime && moth.emergenceTime !== '不明';
              const { emergenceTime } = extractEmergenceTime(moth.notes || '');
              const normalizedTime = normalizeEmergenceTime(emergenceTime);
              const hasExtractedTime = normalizedTime && normalizedTime !== '不明';
              
              // generalNotesから出現時期を抽出（共通関数で柔軟に判定）
              const emergenceFromGeneralNotes = moth.generalNotes && moth.generalNotes.find(isEmergenceNote);
              const hasGeneralNotesTime = emergenceFromGeneralNotes && emergenceFromGeneralNotes.content !== '不明';
              
              return hasDetailedTime || hasExistingTime || hasExtractedTime || hasGeneralNotesTime;
            })() && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
                <div className="p-4 bg-orange-500/10 dark:bg-orange-500/20 border-b border-orange-200/30 dark:border-orange-700/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      発生時期
                    </h2>
                  </div>
                </div>
                
                <div className="p-4">
                  {(() => {
                    // まず備考欄から発生時期を抽出
                    const { emergenceTime: extractedTime } = extractEmergenceTime(moth.notes || '');
                    const normalizedTime = normalizeEmergenceTime(extractedTime);
                    
                    // 統合された発生時期データを作成
                    let allEmergenceTimeData = [];
                    
                    // 詳細データがある場合はそれを追加
                    if (moth.emergenceTimeDetailed && moth.emergenceTimeDetailed.length > 0) {
                      allEmergenceTimeData = [...moth.emergenceTimeDetailed];
                    }
                    
                    // 既存のemergenceTimeがある場合は追加
                    if (moth.emergenceTime && moth.emergenceTime !== '不明') {
                      allEmergenceTimeData.push({
                        period: moth.emergenceTime,
                        source: moth.emergenceTimeSource || '',
                        region: '',
                        notes: moth.emergenceTimeDescription || ''
                      });
                    }
                    
                    // 備考欄から抽出した発生時期がある場合は追加
                    if (normalizedTime && normalizedTime !== '不明') {
                      allEmergenceTimeData.push({
                        period: normalizedTime,
                        source: moth.source || '',
                        region: '',
                        notes: '備考欄から抽出'
                      });
                    }
                    
                    // generalNotesから出現時期を追加（柔軟判定）
                    const emergenceFromGeneralNotes = moth.generalNotes && moth.generalNotes.find(isEmergenceNote);
                    if (emergenceFromGeneralNotes && emergenceFromGeneralNotes.content !== '不明') {
                      allEmergenceTimeData.push({
                        period: emergenceFromGeneralNotes.content,
                        source: emergenceFromGeneralNotes.reference || '',
                        region: '',
                        notes: 'general_notes.csvから抽出'
                      });
                    }
                    
                    // 最初のデータを使用してEmergenceTimeDisplayに渡す
                    const primaryEmergenceTime = allEmergenceTimeData.length > 0 
                      ? allEmergenceTimeData[0].period 
                      : '不明';
                    const primarySource = allEmergenceTimeData.length > 0 
                      ? allEmergenceTimeData[0].source 
                      : '';
                    
                    return (
                      <EmergenceTimeDisplay
                        emergenceTime={primaryEmergenceTime}
                        source={primarySource}
                        compact={false}
                      />
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 関連種情報 - 横スクロール式カードデザイン */}
            <RelatedInsectsSection 
              relatedMothsByPlant={relatedMothsByPlant} 
              allInsects={allInsects} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MothDetail;
