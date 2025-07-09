import React from 'react';
import MothList from './components/MothList';
import HostPlantList from './components/HostPlantList';

const InsectsHostPlantExplorer = ({ moths, hostPlants, plantDetails }) => {
  return (
    <div className="space-y-8">
      <div className="relative w-full h-64 md:h-96 bg-neutral-200 dark:bg-neutral-700 rounded-xl overflow-hidden shadow-xl flex items-center justify-center">
        <img 
          src="/images/moths/アオモンギンセダカモクメ.jpg" 
          alt="アオモンギンセダカモクメ" 
          className="w-full h-full object-cover"
          onError={(e) => { e.target.onerror = null; e.target.src=`${import.meta.env.BASE_URL}images/placeholder.jpg`; e.target.alt='画像が見つかりません'; }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <h2 className="text-white text-3xl md:text-5xl font-bold text-center drop-shadow-lg">”繋がり”が見える昆虫図鑑</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <MothList moths={moths} />
        <HostPlantList hostPlants={hostPlants} plantDetails={plantDetails} />
      </div>
    </div>
  );
};

export default InsectsHostPlantExplorer;
