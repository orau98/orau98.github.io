import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { PlantStructuredData } from './components/StructuredData';
import EnhancedHostPlantDisplay from './components/EnhancedHostPlantDisplay';
// import { RelatedPlants } from './components/RelatedLinks';

// DetailCard component
const DetailCard = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6">
    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{title}</h2>
    {children}
  </div>
);

// 植物の別名データ
const plantAliases = {
  'ソメイヨシノ': ['染井吉野'],  // ユーザーリクエストにより手動追加
  'リンゴ': ['セイヨウリンゴ', 'ヨーロッパリンゴ']
};

const ImageModal = ({ image, isOpen, onClose }) => {
  if (!isOpen || !image) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-6xl max-h-[90vh] w-full">
        <img 
          src={image.finalSrc || image.src}
          alt={image.alt}
          className="w-full h-full object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
          <p className="text-white font-medium">{image.label}</p>
        </div>
      </div>
    </div>
  );
};

const PlantImageGallery = ({ images }) => {
  const [availableImages, setAvailableImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainImage, setMainImage] = useState(null);

  useEffect(() => {
    const checkImages = async () => {
      const available = [];
      
      // cache-buster to avoid stale 404s on Pages/CDN
      const v = `?v=${Date.now()}`;
      for (const image of images) {
        try {
          // Try both .jpg and .JPG
          const responses = await Promise.allSettled([
            fetch(image.src + v, { method: 'HEAD' }),
            fetch(image.srcJPG + v, { method: 'HEAD' })
          ]);
          
          if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
            available.push({ ...image, finalSrc: image.src + v });
          } else if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
            available.push({ ...image, finalSrc: image.srcJPG + v });
          }
        } catch {
          // Image doesn't exist, skip it
        }
      }
      
      setAvailableImages(available);
      if (available.length > 0) {
        setMainImage(available[0]); // Set first image as main image
      }
      setLoading(false);
    };

    checkImages();
  }, [images]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (availableImages.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <p>この植物の写真はまだ登録されていません。</p>
      </div>
    );
  }

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedImage(null);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Main large image */}
        {mainImage && (
          <div className="relative">
            <div 
              className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl cursor-pointer"
              onClick={() => handleImageClick(mainImage)}
            >
              <div className="relative bg-emerald-50 dark:bg-emerald-900/20 overflow-hidden aspect-[16/10] min-h-[200px] md:min-h-[300px] lg:min-h-[400px]">
                <img 
                  src={mainImage.finalSrc}
                  alt={`${mainImage.alt}の写真`}
                  className="w-full h-full object-cover"
                />
                
                {/* Elegant gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100"></div>
                
                {/* Image label overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transform translate-y-full group-hover:translate-y-0">
                  <h3 className="text-white font-bold text-xl drop-shadow-lg">{mainImage.label}</h3>
                  <p className="text-white/90 text-sm drop-shadow-md mt-1">クリックで拡大表示</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Thumbnail gallery */}
        {availableImages.length > 1 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              その他の写真
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {availableImages.map((image, index) => (
                <div
                  key={index}
                  className={`group relative bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg cursor-pointer ${
                    mainImage?.finalSrc === image.finalSrc 
                      ? 'ring-3 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' 
                      : ''
                  }`}
                  onClick={() => setMainImage(image)}
                >
                  <div className="relative aspect-square bg-emerald-50 dark:bg-emerald-900/20">
                    <img 
                      src={image.finalSrc}
                      alt={`${image.alt}の写真`}
                      className="w-full h-full object-cover"
                    />
                    {mainImage?.finalSrc === image.finalSrc && (
                      <div className="absolute inset-0 bg-emerald-500/20"></div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-center text-emerald-700 dark:text-emerald-300 truncate">
                      {image.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <ImageModal 
        image={selectedImage}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
};

// カードコンポーネント（昆虫詳細ページのデザインに近い表現）
const InsectCard = ({ insect, idx, imageFilenames = new Set(), imageExtensions = {} }) => {
  const [imgError, setImgError] = React.useState(false);
  const scientificSlug = (insect.scientificName || '').replace(/\s+/g, '_');
  const filename = insect.scientificFilename || scientificSlug;
  const hasImage = imageFilenames.size > 0 && imageFilenames.has(filename);
  const ext = imageExtensions[filename] || '.jpg';
  const imgSrc = `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(filename)}${ext}`;
  const href = insect.path || '#';
  const name = insect.name || insect.japaneseName || '（名称不明）';
  const family = insect.classification?.familyJapanese || insect.family_jp || '';

  return (
    <Link to={href} className="block bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-2xl shadow-lg overflow-hidden border border-white/30 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-0.5 transition">
      <div className="relative aspect-[4/3] bg-blue-50 dark:bg-blue-900/20 group overflow-hidden">
        {!imgError && hasImage ? (
          <div className="relative h-full w-full">
            <img
              src={imgSrc}
              alt={name}
              className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
              decoding="async"
            />
            {/* Hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            {/* Name overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
              <h3 className="text-white font-bold text-lg drop-shadow-lg">{name}</h3>
              {insect.scientificName && (
                <p className="text-white/90 text-sm drop-shadow-md italic">{insect.scientificName}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-3 bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">画像が見つかりません</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">{name}</h3>
        {insect.scientificName && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 italic">{insect.scientificName}</p>
        )}
        {family && (
          <p className="text-sm text-slate-600 dark:text-slate-300">科: {family}</p>
        )}
      </div>
    </Link>
  );
};

const HostPlantDetail = ({ moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants, plantDetails }) => {
  const { plantName } = useParams();
  const decodedPlantName = decodeURIComponent(plantName);

  // If URL provides Latin binomial without a space (e.g., Capparisheyncana), repair for display only
  const isLikelyLatin = (s) => /^[A-Za-z]+$/.test(s);
  const repairLatinBinomial = (s) => {
    if (!isLikelyLatin(s) || s.includes(' ')) return s;
    const m = s.match(/^([A-Z][a-z]+)([a-z-].*)$/);
    return m ? `${m[1]} ${m[2]}` : s;
  };
  const displayLatin = repairLatinBinomial(decodedPlantName);
  const [imageFilenames, setImageFilenames] = useState(new Set());
  const [imageExtensions, setImageExtensions] = useState({});
  
  // Debug logging for plant detail
  console.log('HostPlantDetail - plantName param:', plantName);

  // Load image filenames and extension mapping for insect cards (avoid 404s)
  useEffect(() => {
    const load = async () => {
      try {
        const base = import.meta.env.BASE_URL || '/';
        const [fnRes, extRes] = await Promise.allSettled([
          fetch(`${base}image_filenames.txt`),
          fetch(`${base}image_extensions.json?v=${Date.now()}`)
        ]);
        if (fnRes.status === 'fulfilled' && fnRes.value.ok) {
          const text = await fnRes.value.text();
          setImageFilenames(new Set(text.trim().split('\n').filter(Boolean)));
        }
        if (extRes.status === 'fulfilled' && extRes.value.ok) {
          const json = await extRes.value.json();
          setImageExtensions(json);
        }
      } catch (e) {
        // silent
      }
    };
    load();
  }, []);
  console.log('HostPlantDetail - decodedPlantName:', decodedPlantName);
  console.log('HostPlantDetail - hostPlants keys:', Object.keys(hostPlants).slice(0, 10));

  const details = plantDetails[decodedPlantName] || { family: '不明' };
  const [taxonomy, setTaxonomy] = useState({ familyJp: '', familyEn: '', orderJp: '', orderEn: '', genus: '', scientificName: '' });
  const [canonicalName, setCanonicalName] = useState('');
  const [aliasNames, setAliasNames] = useState([]);
  const navigate = useNavigate();
  const familyLabel = taxonomy.familyJp || details.family || details.familyName || '';
  
  // SEO: update title/description/canonical to static meta page
  useEffect(() => {
    const title = `${decodedPlantName} - 食草植物の詳細 | 昆虫食草図鑑`;
    const desc = `${decodedPlantName}を食草とする昆虫情報（${familyLabel || '植物'}）。関連する昆虫の一覧や写真ギャラリーを掲載。`;
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = desc;
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.rel = 'canonical';
      document.head.appendChild(canon);
    }
    const safePlantName = decodedPlantName;
    canon.href = `https://orau98.github.io/meta/plant/${encodeURIComponent(safePlantName)}.html`;
    // BreadcrumbList (JSON-LD)
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "昆虫食草図鑑", "item": "https://orau98.github.io/" },
        { "@type": "ListItem", "position": 2, "name": "植物", "item": "https://orau98.github.io/plant" },
        { "@type": "ListItem", "position": 3, "name": decodedPlantName, "item": `https://orau98.github.io/meta/plant/${encodeURIComponent(safePlantName)}.html` }
      ]
    };
    let breadcrumbScript = document.querySelector('#breadcrumb-structured-data');
    if (!breadcrumbScript) {
      breadcrumbScript = document.createElement('script');
      breadcrumbScript.id = 'breadcrumb-structured-data';
      breadcrumbScript.type = 'application/ld+json';
      document.head.appendChild(breadcrumbScript);
    }
    breadcrumbScript.textContent = JSON.stringify(breadcrumb);
    return () => {
      // restore index canonical
      const c = document.querySelector('link[rel="canonical"]');
      if (c) c.href = 'https://orau98.github.io/';
      const b = document.querySelector('#breadcrumb-structured-data');
      if (b) b.remove();
    };
  }, [decodedPlantName, familyLabel]);
  
  // All insects for RelatedPlants component
  const allInsects = [...moths, ...butterflies, ...beetles, ...leafbeetles];
  
  // 植物名を正規化する関数（App.jsxと同じロジック）
  const normalizePlantName = (plantName) => {
    if (!plantName) return '';
    return plantName
      .replace(/（[^）]*科[^）]*）/g, '') // 全角括弧の科名
      .replace(/\([^)]*科[^)]*\)/g, '') // 半角括弧の科名
      .replace(/（[^）]*）/g, '') // その他の全角括弧
      .replace(/\([^)]*\)/g, '') // その他の半角括弧
      .trim();
  };
  
  // Debug: オニグルミを含む昆虫を探す
  if (decodedPlantName === 'オニグルミ') {
    console.log('DEBUG: Searching for オニグルミ in all insects...');
    console.log('Total insects:', allInsects.length);
    const onigurumiInsects = allInsects.filter(insect => {
      if (!insect.hostPlants) return false;
      const hostPlantsStr = String(insect.hostPlants);
      return hostPlantsStr.includes('オニグルミ');
    });
    console.log('Found insects with オニグルミ:', onigurumiInsects.length);
    onigurumiInsects.forEach(insect => {
      console.log(`- ${insect.japaneseName}: hostPlants type=${typeof insect.hostPlants}, value="${insect.hostPlants}"`);
    });
  }
  
  // この植物を利用する昆虫のリストを作成（改善されたマッチングロジック）
  const relatedInsects = allInsects.filter(insect => {
    if (!insect.hostPlants) return false;
    
    // hostPlantsを文字列に変換（配列の場合も考慮）
    let hostPlantsStr;
    if (typeof insect.hostPlants === 'string') {
      hostPlantsStr = insect.hostPlants;
    } else if (Array.isArray(insect.hostPlants)) {
      hostPlantsStr = insect.hostPlants.join('、');
    } else {
      // その他の型の場合はStringに変換を試みる
      hostPlantsStr = String(insect.hostPlants);
    }
    
    // 食草リストを正規化して検索
    const hostPlantsList = hostPlantsStr.split(/[、,；;]/).map(p => p.trim());
    
    // 検索対象の植物名を正規化
    const normalizedTarget = normalizePlantName(decodedPlantName);
    const additionalTargets = new Set([
      normalizedTarget,
      ...aliasNames.map(normalizePlantName),
      normalizePlantName(canonicalName)
    ].filter(Boolean));
    
    return hostPlantsList.some(plant => {
      // 元の植物名での完全一致
      if (plant === decodedPlantName) return true;
      if (canonicalName && plant === canonicalName) return true;
      if (aliasNames.includes(plant)) return true;
      
      // 正規化した植物名での一致
      const normalizedPlant = normalizePlantName(plant);
      if (normalizedPlant === normalizedTarget) return true;
      if (additionalTargets.has(normalizedPlant)) return true;
      
      // 括弧を除いた植物名での一致（従来のロジック）
      const cleanPlant = plant.replace(/[(（][^)）]*[)）]/g, '').trim();
      if (cleanPlant === decodedPlantName) return true;
      
      // App.jsxのhostPlantDataとの一貫性を保つため、
      // hostPlantsに登録されている昆虫名リストもチェック
      if ((hostPlants[decodedPlantName] && hostPlants[decodedPlantName].includes(insect.name || insect.japaneseName)) ||
          (canonicalName && hostPlants[canonicalName] && hostPlants[canonicalName].includes(insect.name || insect.japaneseName)) ||
          aliasNames.some(a => hostPlants[a] && hostPlants[a].includes(insect.name || insect.japaneseName))) {
        return true;
      }
      
      return false;
    });
  }).map(insect => {
    // pathプロパティを追加
    let path = '';
    if (moths.includes(insect)) {
      path = `/moth/${insect.id}`;
    } else if (butterflies.includes(insect)) {
      path = `/butterfly/${insect.id}`;
    } else if (beetles.includes(insect)) {
      path = `/beetle/${insect.id}`;
    } else if (leafbeetles.includes(insect)) {
      path = `/leafbeetle/${insect.id}`;
    }
    return { ...insect, path };
  });
  
  // Debug logging for オニグルミ
  if (decodedPlantName === 'オニグルミ') {
    console.log('DEBUG: Related insects found for オニグルミ:', relatedInsects.length);
    console.log('DEBUG: hostPlants[オニグルミ]:', hostPlants['オニグルミ']);
    console.log('DEBUG: First few related insects:', relatedInsects.slice(0, 5).map(i => i.name || i.japaneseName));
  }
  
  // Get all available images for this plant (try canonical + aliases)
  const getPlantImages = (plantName, altNames = []) => {
    const commonImages = [
      { suffix: '', label: '全体' },
      { suffix: '_葉表', label: '葉表' },
      { suffix: '_葉', label: '葉' },
      { suffix: '_葉裏', label: '葉裏' },
      { suffix: '_葉表白化', label: '葉表白化' },
      { suffix: '_羽状複葉', label: '羽状複葉' },
      { suffix: '_樹皮', label: '樹皮' },
      { suffix: '_実', label: '実' },
      { suffix: '_果実', label: '果実' },
      { suffix: '_花', label: '花' },
      { suffix: '_蕾', label: '蕾' },
      { suffix: '_若葉', label: '若葉' },
      { suffix: '_芽', label: '芽' },
      { suffix: '_枝', label: '枝' },
      { suffix: '_枝先', label: '枝先' },
      { suffix: '_断面', label: '断面' }
    ];
    const bases = Array.from(new Set([plantName, ...altNames].filter(Boolean)));
    const images = [];
    bases.forEach(base => {
      commonImages.forEach(({ suffix, label }) => {
        images.push({
          src: `${import.meta.env.BASE_URL}images/plants/${base}${suffix}.jpg`,
          srcJPG: `${import.meta.env.BASE_URL}images/plants/${base}${suffix}.JPG`,
          label,
          alt: `${base}${suffix ? ` (${label})` : ''}`
        });
      });
    });
    return images;
  };
  
  const plantImages = getPlantImages(decodedPlantName, aliasNames);

  // (no sticky tabs; aligns with insect page)

  // Load classification from public/20210514YList_download.csv
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}20210514YList_download.csv`;
    fetch(url)
      .then(r => r.text())
      .then(text => {
        const res = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = res.data || [];
        // Normalize column keys to trim BOM or spaces
        const normalizeKeys = (obj) => {
          const out = {};
          Object.keys(obj).forEach(k => {
            const nk = k.replace(/^\ufeff/, '').trim();
            out[nk] = obj[k];
          });
          return out;
        };

        const target = decodedPlantName;
        // Try exact match on 和名, then fallback to 別名に含む
        let hit = null;
        for (const row0 of rows) {
          const row = normalizeKeys(row0);
          if ((row['和名'] || '').trim() === target) { hit = row; break; }
        }
        if (!hit) {
          for (const row0 of rows) {
            const row = normalizeKeys(row0);
            const aliases = (row['別名'] || '').split(/[、,]/).map(s => s.trim()).filter(Boolean);
            if (aliases.includes(target)) { hit = row; break; }
          }
        }
        if (hit) {
          const familyJp = hit['LAPGII::LAPG科名'] || hit['LAPG 科名'] || hit['Cronquist 科名'] || hit['Engler 科名'] || '';
          const familyEn = hit['LAPGII::LAPG Family狭義'] || hit['LAPGII::LAPG Family広義'] || hit['LAPG Family'] || hit['Cronquist family'] || hit['Engler family'] || '';
          const orderJp  = hit['LAPGII::LAPG 目'] || hit['LAPGII::LAPG Order'] || '';
          const orderEn  = hit['LAPGII::LAPG Order'] || '';
          let sci = (hit['学名'] || '').trim();
          if (!sci) sci = (hit['学名 withAuthor'] || '').trim();
          let genus = '';
          if (sci) genus = (sci.split(/\s+/)[0] || '').trim();
          setTaxonomy({ familyJp: (familyJp||'').trim(), familyEn: (familyEn||'').trim(), orderJp: (orderJp||'').trim(), orderEn: (orderEn||'').trim(), genus, scientificName: sci });

          // 別名を保持して正規化に利用
          const canonical = (hit['和名'] || '').trim();
          const aliases = (hit['別名'] || '').split(/[、,]/).map(s => s.trim()).filter(Boolean);
          setCanonicalName(canonical);
          setAliasNames(aliases);

          // もし別名で到達していたら正規の和名へリダイレクト（URL統一）
          if (canonical && canonical !== decodedPlantName) {
            navigate(`/plant/${encodeURIComponent(canonical)}`, { replace: true });
          }
        }
      })
      .catch(() => { /* ignore */ });
  }, [decodedPlantName, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top row: back link + classification chips (unified with insect detail) */}
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
        <div className="flex flex-wrap gap-2">
          {taxonomy.orderJp && (
            <span
              className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50"
            >
              <span className="font-medium">{taxonomy.orderJp}</span>
              {taxonomy.orderEn && (
                <span className="ml-1 text-xs italic opacity-80">{taxonomy.orderEn}</span>
              )}
            </span>
          )}
          {familyLabel && (
            <span
              className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50"
            >
              <span className="font-medium">{familyLabel}</span>
              {taxonomy.familyEn && (
                <span className="ml-1 text-xs italic opacity-80">{taxonomy.familyEn}</span>
              )}
            </span>
          )}
          {taxonomy.genus && (
            <span
              className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-300 transition-all duration-200 border border-slate-200/50 dark:border-slate-700/50"
            >
              <span className="font-medium italic">{taxonomy.genus}</span>
            </span>
          )}
        </div>
      </div>
      {/* 構造化データ */}
      <PlantStructuredData 
        plant={{ name: decodedPlantName, scientificName: isLikelyLatin(displayLatin) ? displayLatin : undefined }} 
        details={details} 
        insects={relatedInsects}
        images={plantImages}
      />
      
      {/* 概要セクション（和名＋学名のみ） */}
      <div className="mt-4 md:mt-6">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white text-left">
            {/^[\u3040-\u30ff\u3400-\u9fff]/.test(decodedPlantName)
              ? decodedPlantName
              : (<span className="whitespace-nowrap break-keep">{formatScientificNameReact(displayLatin)}</span>)}
          </h1>
          {aliasNames.length > 0 && (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">別名:</span> {aliasNames.join('、')}
            </div>
          )}
          {taxonomy.scientificName && (
            <div className="mt-1 text-left text-slate-600 dark:text-slate-300 text-lg">
              {formatScientificNameReact(taxonomy.scientificName)}
            </div>
          )}
        </div>
      </div>

      {/* 植物画像ギャラリー */}
      <section aria-labelledby="plant-photos" className="mb-12 md:mb-16 lg:mb-20">
        <PlantImageGallery images={plantImages} plantName={decodedPlantName} />
      </section>

      {/* この植物を利用する昆虫一覧（カード表示） */}
      <div className="mt-12 md:mt-16 mb-10">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-8 flex items-center">
          <svg className="w-8 h-8 mr-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          同じ食草を利用する昆虫 ({relatedInsects.length}種)
        </h2>
        {relatedInsects.length === 0 ? (
          <div className="text-slate-500 dark:text-slate-400">関連する昆虫が見つかりませんでした。</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {relatedInsects.map((insect, idx) => (
              <InsectCard key={insect.id || idx} insect={insect} idx={idx} imageFilenames={imageFilenames} imageExtensions={imageExtensions} />
            ))}
          </div>
        )}
      </div>

      {/* 関連する他の植物 - 一時的にコメントアウト */}
      {/* 
      <div className="mb-8">
        <RelatedPlants 
          currentPlant={decodedPlantName} 
          currentFamily={details.family}
          allInsects={allInsects}
        />
      </div>
      */}
      </div>
    </div>
  );
};

export default HostPlantDetail;
