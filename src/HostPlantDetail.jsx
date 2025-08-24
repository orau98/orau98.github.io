import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
      
      for (const image of images) {
        try {
          // Try both .jpg and .JPG
          const responses = await Promise.allSettled([
            fetch(image.src, { method: 'HEAD' }),
            fetch(image.srcJPG, { method: 'HEAD' })
          ]);
          
          if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
            available.push({ ...image, finalSrc: image.src });
          } else if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
            available.push({ ...image, finalSrc: image.srcJPG });
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
                  alt={mainImage.alt}
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
                      alt={image.alt}
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

const HostPlantDetail = ({ moths, butterflies = [], beetles = [], leafbeetles = [], hostPlants, plantDetails }) => {
  const { plantName } = useParams();
  const decodedPlantName = decodeURIComponent(plantName);
  
  // Debug logging for plant detail
  console.log('HostPlantDetail - plantName param:', plantName);
  console.log('HostPlantDetail - decodedPlantName:', decodedPlantName);
  console.log('HostPlantDetail - hostPlants keys:', Object.keys(hostPlants).slice(0, 10));

  const details = plantDetails[decodedPlantName] || { family: '不明' };
  
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
    
    return hostPlantsList.some(plant => {
      // 元の植物名での完全一致
      if (plant === decodedPlantName) return true;
      
      // 正規化した植物名での一致
      const normalizedPlant = normalizePlantName(plant);
      if (normalizedPlant === normalizedTarget) return true;
      
      // 括弧を除いた植物名での一致（従来のロジック）
      const cleanPlant = plant.replace(/[(（][^)）]*[)）]/g, '').trim();
      if (cleanPlant === decodedPlantName) return true;
      
      // App.jsxのhostPlantDataとの一貫性を保つため、
      // hostPlantsに登録されている昆虫名リストもチェック
      if (hostPlants[decodedPlantName] && hostPlants[decodedPlantName].includes(insect.name || insect.japaneseName)) {
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
  
  // Get all available images for this plant
  const getPlantImages = (plantName) => {
    const commonImages = [
      { suffix: '', label: '全体' },
      { suffix: '_葉表', label: '葉表' },
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
      { suffix: '_断面', label: '断面' }
    ];
    
    return commonImages.map(({ suffix, label }) => ({
      src: `${import.meta.env.BASE_URL}images/plants/${plantName}${suffix}.jpg`,
      srcJPG: `${import.meta.env.BASE_URL}images/plants/${plantName}${suffix}.JPG`,
      label,
      alt: `${plantName}${suffix ? ` (${label})` : ''}`
    }));
  };
  
  const plantImages = getPlantImages(decodedPlantName);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 構造化データ */}
      <PlantStructuredData 
        plant={{ name: decodedPlantName }} 
        details={details} 
        insects={relatedInsects}
        images={plantImages}
      />
      
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-4">
          植物詳細: {decodedPlantName}
        </h1>
        <div className="flex flex-wrap justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          {details.family && (
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full">
              {details.family}
            </span>
          )}
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
            {relatedInsects.length}種の昆虫が利用
          </span>
        </div>
      </div>

      {/* 植物画像ギャラリー */}
      <PlantImageGallery images={plantImages} plantName={decodedPlantName} />

      {/* この植物を利用する昆虫一覧 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
          <svg className="w-8 h-8 mr-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          同じ食草を利用する昆虫 ({relatedInsects.length}種)
        </h2>
        
        <EnhancedHostPlantDisplay insects={relatedInsects} />
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
  );
};

export default HostPlantDetail;