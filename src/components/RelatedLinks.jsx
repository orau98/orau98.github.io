import React from 'react';
import { Link } from 'react-router-dom';

// 関連する昆虫のリンクコンポーネント
export const RelatedInsects = ({ currentInsect, allInsects, hostPlants }) => {
  if (!currentInsect?.hostPlants?.length) return null;

  // 同じ食草を持つ昆虫を検索
  const relatedInsects = allInsects.filter(insect => 
    insect.id !== currentInsect.id &&
    insect.hostPlants?.some(plant => currentInsect.hostPlants.includes(plant))
  ).slice(0, 6); // 最大6件

  if (relatedInsects.length === 0) return null;

  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-xl shadow-xl border border-white/20 dark:border-slate-700/50">
      <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
        同じ食草を持つ昆虫
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {relatedInsects.map(insect => (
          <Link
            key={insect.id}
            to={`/${insect.type}/${insect.id}`}
            className="group bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600"
          >
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                {insect.name}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 ml-4">
              {insect.scientificName}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};

// 関連する植物のリンクコンポーネント
export const RelatedPlants = ({ currentPlant, allInsects, hostPlants }) => {
  if (!currentPlant) return null;

  // この植物を食べる昆虫を探す
  const insectsOnThisPlant = allInsects.filter(insect => 
    insect.hostPlants?.includes(currentPlant)
  );

  // 同じ科の植物を探す（簡易的な実装）
  const relatedPlants = hostPlants.filter(plant => 
    plant.name !== currentPlant &&
    plant.name !== '不明' &&
    // 同じ文字パターンを持つ植物（例：～ノキ、～ガシなど）
    (plant.name.includes('ノキ') && currentPlant.includes('ノキ') ||
     plant.name.includes('ガシ') && currentPlant.includes('ガシ') ||
     plant.name.includes('カエデ') && currentPlant.includes('カエデ') ||
     plant.name.includes('ザクラ') && currentPlant.includes('ザクラ') ||
     plant.name.includes('ヤナギ') && currentPlant.includes('ヤナギ'))
  ).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* この植物を食べる昆虫 */}
      {insectsOnThisPlant.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-xl shadow-xl border border-white/20 dark:border-slate-700/50">
          <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
            {currentPlant}を食草とする昆虫
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insectsOnThisPlant.map(insect => (
              <Link
                key={insect.id}
                to={`/${insect.type}/${insect.id}`}
                className="group bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      {insect.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {insect.scientificName}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    insect.type === 'moth' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    insect.type === 'butterfly' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' :
                    insect.type === 'beetle' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {insect.type === 'moth' ? '蛾' : 
                     insect.type === 'butterfly' ? '蝶' : 
                     insect.type === 'beetle' ? '甲虫' : 'ハムシ'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 関連する植物 */}
      {relatedPlants.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-xl shadow-xl border border-white/20 dark:border-slate-700/50">
          <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
            関連する植物
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedPlants.map(plant => (
              <Link
                key={plant.name}
                to={`/plant/${encodeURIComponent(plant.name)}`}
                className="group bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-all duration-200 border border-teal-200/50 dark:border-teal-700/50"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full group-hover:scale-125 transition-transform"></div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-400">
                    {plant.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};