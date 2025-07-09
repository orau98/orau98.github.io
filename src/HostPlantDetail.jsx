import React from 'react';
import { useParams, Link } from 'react-router-dom';

const DetailCard = ({ title, children }) => (
  <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-xl shadow-xl">
    <h2 className="text-2xl font-bold mb-4 text-primary-600 dark:text-primary-400">{title}</h2>
    {children}
  </div>
);

const HostPlantDetail = ({ moths, butterflies = [], hostPlants, plantDetails }) => {
  const { plantName } = useParams();
  const decodedPlantName = decodeURIComponent(plantName);

  const mothsOnThisPlant = hostPlants[decodedPlantName] || [];
  const details = plantDetails[decodedPlantName] || { family: '不明' };
  const imagePath = `/images/plants/${decodedPlantName}.jpg`;
  
  // Separate moths and butterflies that use this plant
  const allInsects = [...moths, ...butterflies];
  const insectsOnThisPlant = allInsects.filter(insect => 
    insect.hostPlants.includes(decodedPlantName)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline mb-6 inline-block">← リストに戻る</Link>
      
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-primary-600 dark:text-primary-400">{decodedPlantName}</h1>
        <dl className="text-xl text-neutral-500 dark:text-neutral-400 mt-1">
          <dt className="font-semibold">科名:</dt>
          <dd className="ml-4">{details.family}</dd>
          {details.scientificName && (
            <>
              <dt className="font-semibold mt-2">学名:</dt>
              <dd className="ml-4 italic">{details.scientificName}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <DetailCard title="基本情報">
            <div className="w-full h-64 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center rounded-lg mb-4">
              <img 
                src={imagePath} 
                alt={decodedPlantName}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => { e.target.onerror = null; e.target.src='/images/placeholder.jpg'; e.target.alt='画像が見つかりません'; }}
              />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">(ここに食草の解説が入ります)</p>
          </DetailCard>
        </div>

        <div className="lg:col-span-2">
          <DetailCard title="この植物を食べる昆虫">
            {insectsOnThisPlant.length > 0 ? (
              <>
                {/* Moths section */}
                {insectsOnThisPlant.filter(insect => insect.type !== 'butterfly').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-400">蛾</h3>
                    <div className="flex flex-wrap gap-2">
                      {insectsOnThisPlant.filter(insect => insect.type !== 'butterfly').map(moth => (
                        <Link key={moth.id} to={`/moth/${moth.id}`} className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
                          {moth.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Butterflies section */}
                {insectsOnThisPlant.filter(insect => insect.type === 'butterfly').length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-orange-600 dark:text-orange-400">蝶</h3>
                    <div className="flex flex-wrap gap-2">
                      {insectsOnThisPlant.filter(insect => insect.type === 'butterfly').map(butterfly => (
                        <Link key={butterfly.id} to={`/butterfly/${butterfly.id}`} className="bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-full text-sm text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors">
                          {butterfly.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-neutral-500 dark:text-neutral-400">この食草を食べる昆虫の情報はありません。</p>
            )}
          </DetailCard>
        </div>
      </div>
    </div>
  );
};

export default HostPlantDetail;
