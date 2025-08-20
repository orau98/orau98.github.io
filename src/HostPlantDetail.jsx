import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';
import { PlantStructuredData } from './components/StructuredData';
import { RelatedPlants } from './components/RelatedLinks';

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
  
  // この植物を利用する昆虫のリストを作成
  const relatedInsects = allInsects.filter(insect => {
    if (!insect.hostPlants) return false;
    
    // 食草リストを正規化して検索
    const hostPlantsList = insect.hostPlants.split(/[、,；;]/).map(p => p.trim());
    return hostPlantsList.some(plant => {
      // 括弧を除いた植物名でも一致を確認
      const cleanPlant = plant.replace(/[(（][^)）]*[)）]/g, '').trim();
      return plant === decodedPlantName || cleanPlant === decodedPlantName;
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
      { suffix: '_茎', label: '茎' },
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
  
  const insectsOnThisPlant = allInsects.filter(insect => {
    if (!insect.hostPlants) return false;
    const hostPlantsList = insect.hostPlants.split(/[、,；;]/).map(p => p.trim());
    return hostPlantsList.some(plant => {
      const cleanPlant = plant.replace(/[(（][^)）]*[)）]/g, '').trim();
      return plant === decodedPlantName || cleanPlant === decodedPlantName;
    });
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 構造化データ */}
      <PlantStructuredData 
        plant={{ name: decodedPlantName }} 
        relatedInsects={insectsOnThisPlant} 
      />
      <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">← リストに戻る</Link>
      
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-blue-600 dark:text-blue-400">{decodedPlantName}</h1>
        <dl className="text-xl text-slate-500 dark:text-slate-400 mt-1">
          <dt className="font-semibold">科名:</dt>
          <dd className="ml-4">
            {details.genusFamily || details.family}
          </dd>
          {details.genusScientificName && (
            <>
              <dt className="font-semibold mt-2">属名 (学名):</dt>
              <dd className="ml-4 italic">
                {formatScientificNameReact(details.genusScientificName)}属
              </dd>
            </>
          )}
          {details.scientificName && !details.genusScientificName && (
            <>
              <dt className="font-semibold mt-2">学名:</dt>
              <dd className="ml-4 italic">
                {formatScientificNameReact(details.scientificName)}
              </dd>
            </>
          )}
          {(() => {
            const allAliases = [];
            if (plantAliases[decodedPlantName]) {
              allAliases.push(...plantAliases[decodedPlantName]);
            }
            if (details.aliases && details.aliases.length > 0) {
              // Add CSV aliases but avoid duplicates and current plant name
              details.aliases.forEach(alias => {
                if (!allAliases.includes(alias) && alias !== decodedPlantName) {
                  allAliases.push(alias);
                }
              });
            }
            // Filter out the current plant name from hardcoded aliases too
            const filteredAliases = allAliases.filter(alias => alias !== decodedPlantName);
            
            // Only show aliases section if there are actually aliases to display
            return filteredAliases.length > 0 ? (
              <>
                <dt className="font-semibold mt-2">別名:</dt>
                <dd className="ml-4">{filteredAliases.join('、')}</dd>
              </>
            ) : null;
          })()}
        </dl>
      </div>

      <div className="space-y-8">
        {/* Full-width photo gallery */}
        <DetailCard title="植物写真ギャラリー">
          <PlantImageGallery images={plantImages} />
          <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-700/50">
            <p className="text-emerald-700 dark:text-emerald-300 text-sm leading-relaxed">
              <span className="font-semibold">植物の特徴:</span> この植物の詳細な説明や生態学的特徴についての情報がここに表示されます。

            </p>
          </div>
        </DetailCard>

        
        {/* この植物を利用する昆虫一覧 */}
        <DetailCard title={`${decodedPlantName}を利用する昆虫`}>
          <div className="space-y-2">
            {relatedInsects.length > 0 ? (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {relatedInsects.length}種の昆虫がこの植物を利用しています
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {relatedInsects.map((insect, index) => (
                    <Link 
                      key={index}
                      to={insect.path}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="font-medium text-emerald-700 dark:text-emerald-400">
                        {insect.japaneseName}
                      </div>
                      {insect.scientificName && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 italic">
                          {insect.scientificName}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                この植物を利用する昆虫のデータはまだありません
              </p>
            )}
          </div>
        </DetailCard>

        {/* 関連する植物と昆虫のリンク */}
        <RelatedPlants 
          currentPlant={decodedPlantName} 
          allInsects={allInsects} 
          hostPlants={hostPlants} 
        />
      </div>
    </div>
  );
};

export default HostPlantDetail;
