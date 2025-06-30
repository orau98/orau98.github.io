import React from 'react';
import { useParams, Link } from 'react-router-dom';

const MothDetail = ({ moths, hostPlants }) => {
  const { mothId } = useParams();
  const moth = moths.find(m => m.id === parseInt(mothId));

  if (!moth) {
    return (
        <div className="container mx-auto p-4 text-center">
            <p className="text-xl">蛾が見つかりません。</p>
            <Link to="/" className="text-blue-500 hover:underline mt-4 inline-block">← リストに戻る</Link>
        </div>
    );
  }

  // 同じ食草を持つ他の蛾を探す
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

  const imagePath = `/images/moths/${moth.name}.jpg`;

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
        <div className="mb-6">
            <Link to="/" className="text-blue-600 hover:underline">← 蛾のリストに戻る</Link>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-2">{moth.name}</h1>
        <p className="text-xl md:text-2xl italic text-gray-500 mb-6">{moth.scientificName}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold mb-3 border-b pb-2">基本情報</h2>
            <div className="w-full h-64 bg-gray-200 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
              <img 
                src={imagePath} 
                alt={moth.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.onerror = null; e.target.style.display='none'; e.target.parentElement.innerHTML = '<span class="text-gray-500">画像なし</span>'; }}
              />
            </div>
            <div className="mt-4">
                <h3 className="font-semibold">出典:</h3>
                <p className="text-gray-700">{moth.source}</p>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-3 border-b pb-2">食草</h2>
            <ul className="space-y-2 mt-4">
              {moth.hostPlants.length > 0 ? (
                moth.hostPlants.map(plant => (
                    <li key={plant}>
                        <Link to={`/plant/${encodeURIComponent(plant)}`} className="text-green-700 hover:underline font-semibold">
                            {plant}
                        </Link>
                    </li>
                ))
              ) : (
                <li>不明</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10">
            <h2 className="text-2xl font-semibold mb-3 border-b pb-2">同じ食草を持つ蛾</h2>
            {relatedMoths.size > 0 ? (
              <div className="flex flex-wrap gap-2 mt-4">
                {[...relatedMoths].map(relatedMothName => {
                    const relatedMoth = moths.find(m => m.name === relatedMothName);
                    return relatedMoth ? (
                        <Link key={relatedMoth.id} to={`/moth/${relatedMoth.id}`} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200">
                            {relatedMothName}
                        </Link>
                    ) : null;
                })}
              </div>
            ) : (
              <p className="mt-4">同じ食草を持つ他の蛾は見つかりませんでした。</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default MothDetail;