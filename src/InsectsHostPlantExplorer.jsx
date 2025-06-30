
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const InsectsHostPlantExplorer = ({ moths, hostPlants }) => {
  const [mothSearchTerm, setMothSearchTerm] = useState('');
  const [plantSearchTerm, setPlantSearchTerm] = useState('');

  const filteredMoths = moths.filter(moth =>
    moth.name.toLowerCase().includes(mothSearchTerm.toLowerCase()) ||
    (moth.scientificName && moth.scientificName.toLowerCase().includes(mothSearchTerm.toLowerCase()))
  );

  const filteredHostPlants = Object.entries(hostPlants).filter(([plant]) =>
    plant.toLowerCase().includes(plantSearchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">蛾のリスト</h2>
          <input
            type="text"
            placeholder="蛾を検索 (和名・学名)"
            className="w-full p-3 border rounded-lg mb-4 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            onChange={(e) => setMothSearchTerm(e.target.value)}
          />
          <div className="overflow-y-auto h-[75vh] p-1">
            <ul>
              {filteredMoths.map(moth => (
                <li key={moth.id} className="mb-3">
                  <Link to={`/moth/${moth.id}`} className="block card">
                    <p className="font-bold text-lg text-blue-700 hover:underline">{moth.name}</p>
                    <p className="text-md italic text-gray-600">{moth.scientificName}</p>
                    <p className="text-sm mt-2">
                      <span className="font-semibold">食草:</span> {moth.hostPlants.join(', ') || '不明'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">食草リスト</h2>
           <input
            type="text"
            placeholder="食草を検索"
            className="w-full p-3 border rounded-lg mb-4 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            onChange={(e) => setPlantSearchTerm(e.target.value)}
          />
          <div className="overflow-y-auto h-[75vh] p-1">
            <ul>
              {filteredHostPlants.map(([plant, mothList]) => (
                <li key={plant} className="mb-3">
                  <Link to={`/plant/${encodeURIComponent(plant)}`} className="block card">
                    <p className="font-bold text-lg text-green-700 hover:underline">{plant}</p>
                    <p className="text-sm mt-1">
                      この植物を食べる蛾: <span className="font-semibold">{mothList.length}</span> 種
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsectsHostPlantExplorer;
