import React from 'react';
import { useParams, Link } from 'react-router-dom';

const DetailCard = ({ title, children }) => (
  <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-xl shadow-xl">
    <h2 className="text-2xl font-bold mb-4 text-primary-600 dark:text-primary-400">{title}</h2>
    {children}
  </div>
);

const MothDetail = ({ moths, hostPlants }) => {
  const { mothId } = useParams();
  const moth = moths.find(m => m.id === parseInt(mothId));

  if (!moth) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500 text-lg">蛾が見つかりません。</p>
        <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline mt-4 inline-block">← リストに戻る</Link>
      </div>
    );
  }

  const relatedMoths = new Set();
  moth.hostPlants.forEach(plant => {
    if (hostPlants[plant]) {
      hostPlants[plant].forEach(mothName => {
        if (mothName !== moth.name) {
          relatedMoths.add(mothName);
        }
      });
    }
  });

  const imagePath = `/images/moths/${encodeURIComponent(moth.scientificFilename)}.jpg`;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline mb-6 inline-block">← 蛾のリストに戻る</Link>
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-primary-600 dark:text-primary-400">{moth.name}</h1>
        <p className="text-xl text-neutral-500 dark:text-neutral-400 italic mt-1">{moth.scientificName}</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <DetailCard title="基本情報">
            <div className="w-full h-64 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center rounded-lg mb-4">
              <img 
                src={imagePath} 
                alt={moth.name}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => { e.target.onerror = null; e.target.src=`${import.meta.env.BASE_URL}images/placeholder.jpg`; e.target.alt='画像が見つかりません'; }}
              />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">出典:</h3>
                <p className="text-neutral-600 dark:text-neutral-400">{moth.source}</p>
            </div>
          </DetailCard>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <DetailCard title="分類">
            <dl className="space-y-2 text-neutral-600 dark:text-neutral-400">
              {moth.classification.familyJapanese && (
                <div>
                  <dt className="font-semibold text-neutral-700 dark:text-neutral-300">科:</dt>
                  <dd className="ml-4">{moth.classification.familyJapanese} ({moth.classification.family})</dd>
                </div>
              )}
              {moth.classification.subfamilyJapanese && (
                <div>
                  <dt className="font-semibold text-neutral-700 dark:text-neutral-300">亜科:</dt>
                  <dd className="ml-4">{moth.classification.subfamilyJapanese} ({moth.classification.subfamily})</dd>
                </div>
              )}
              {moth.classification.tribeJapanese && (
                <div>
                  <dt className="font-semibold text-neutral-700 dark:text-neutral-300">族:</dt>
                  <dd className="ml-4">{moth.classification.tribeJapanese} ({moth.classification.tribe})</dd>
                </div>
              )}
              {moth.classification.genus && (
                <div>
                  <dt className="font-semibold text-neutral-700 dark:text-neutral-300">属:</dt>
                  <dd className="ml-4">{moth.classification.genus}</dd>
                </div>
              )}
            </dl>
          </DetailCard>

          <DetailCard title="食草">
            <ul className="space-y-2">
              {moth.hostPlants.length > 0 ? (
                moth.hostPlants.map(plant => (
                    <li key={plant}>
                        <Link to={`/plant/${encodeURIComponent(plant)}`} className="text-secondary-600 dark:text-secondary-400 hover:underline">
                            {plant}
                        </Link>
                    </li>
                ))
              ) : (
                <li className="text-neutral-500 dark:text-neutral-400">不明</li>
              )}
            </ul>
          </DetailCard>
        </div>
      </div>

      <div className="mt-8">
        <DetailCard title="同じ食草を持つ蛾">
            {relatedMoths.size > 0 ? (
              <div className="flex flex-wrap gap-2">
                {[...relatedMoths].map(relatedMothName => {
                    const relatedMoth = moths.find(m => m.name === relatedMothName);
                    return relatedMoth ? (
                        <Link key={relatedMoth.id} to={`/moth/${relatedMoth.id}`} className="bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-full text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                            {relatedMothName}
                        </Link>
                    ) : null;
                })}
              </div>
            ) : (
              <p className="text-neutral-500 dark:text-neutral-400">同じ食草を持つ他の蛾は見つかりませんでした。</p>
            )}
        </DetailCard>
      </div>
    </div>
  );
};

export default MothDetail;
