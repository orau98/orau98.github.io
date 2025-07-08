import React from 'react';
import { useParams, Link } from 'react-router-dom';

const DetailCard = ({ title, children }) => (
  <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-xl shadow-xl">
    <h2 className="text-2xl font-bold mb-4 text-primary-600 dark:text-primary-400">{title}</h2>
    {children}
  </div>
);

const HostPlantDetail = ({ moths, hostPlants, plantDetails }) => {
  const { plantName } = useParams();
  const decodedPlantName = decodeURIComponent(plantName);

  const mothsOnThisPlant = hostPlants[decodedPlantName] || [];
  const details = plantDetails[decodedPlantName] || { family: '不明' };
  const imagePath = `/images/plants/${decodedPlantName}.jpg`;

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
          <DetailCard title="この植物を食べる蛾">
            {mothsOnThisPlant.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mothsOnThisPlant.map(mothName => {
                    const moth = moths.find(m => m.name === mothName);
                    return (
                      moth ? (
                          <Link key={moth.id} to={`/moth/${moth.id}`} className="bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-full text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                              {mothName}
                          </Link>
                      ) : null
                    );
                  })}
                </div>
              ) : (
                <p className="text-neutral-500 dark:text-neutral-400">この食草を食べる蛾の情報はありません。</p>
              )}
          </DetailCard>
        </div>
      </div>
    </div>
  );
};

export default HostPlantDetail;
