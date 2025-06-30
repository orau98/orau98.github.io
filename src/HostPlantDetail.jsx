import React from 'react';
import { useParams, Link } from 'react-router-dom';

const HostPlantDetail = ({ moths, hostPlants, plantDetails }) => {
  const { plantName } = useParams();
  const decodedPlantName = decodeURIComponent(plantName);

  const mothsOnThisPlant = hostPlants[decodedPlantName] || [];
  const details = plantDetails[decodedPlantName] || { family: '不明' };
  const imagePath = `/images/plants/${decodedPlantName}.jpg`;

  return (
    <div className="container mx-auto p-4">
       <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
        <div className="mb-6">
            <Link to="/" className="text-blue-600 hover:underline">← リストに戻る</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h1 className="text-4xl md:text-5xl font-bold text-green-800">{decodedPlantName}</h1>
                <p className="text-xl text-gray-500 mt-2">科名: {details.family}</p>
                <p className="text-lg text-gray-700 my-4">（ここに食草の解説が入ります）</p>
            </div>
            <div>
                <div className="w-full h-64 bg-gray-200 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    <img 
                        src={imagePath} 
                        alt={decodedPlantName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.style.display='none'; e.target.parentElement.innerHTML = '<span class="text-gray-500">画像なし</span>'; }}
                    />
                </div>
            </div>
        </div>

        <div className="mt-10">
            <h2 className="text-2xl font-semibold mb-3 border-b pb-2">この植物を食べる蛾</h2>
            {mothsOnThisPlant.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-4">
                {mothsOnThisPlant.map(mothName => {
                  const moth = moths.find(m => m.name === mothName);
                  return (
                    moth ? (
                        <Link key={moth.id} to={`/moth/${moth.id}`} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200">
                            {mothName}
                        </Link>
                    ) : null
                  );
                })}
              </div>
            ) : (
              <p className="mt-4">この食草を食べる蛾の情報はありません。</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default HostPlantDetail;