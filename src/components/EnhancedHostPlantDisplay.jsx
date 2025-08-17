import React, { useState } from 'react';

/**
 * 観察タイプ別のスタイルを取得
 */
const getObservationTypeStyle = (observationType) => {
  switch (observationType) {
    case '飼育':
      return {
        label: '飼育',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-700'
      };
    case '野外（国内）':
      return {
        label: '野外',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-700'
      };
    case '海外':
      return {
        label: '海外',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-200 dark:border-purple-700'
      };
    default:
      return {
        label: '記録',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        textColor: 'text-gray-700 dark:text-gray-300',
        borderColor: 'border-gray-200 dark:border-gray-700'
      };
  }
};

/**
 * 観察タイプ別の優先度を取得（数値が小さいほど優先度が高い）
 */
const getObservationTypePriority = (observationType) => {
  switch (observationType) {
    case '野外（国内）': return 1; // 最優先
    case '飼育': return 2;
    case '野外（海外）':
    case '海外': return 3;
    default: return 4; // その他は最後
  }
};

/**
 * 植物記録をグループ化する関数
 */
const groupPlantsByName = (plants) => {
  const groups = {};
  
  plants.forEach(plant => {
    const key = plant.name;
    if (!groups[key]) {
      groups[key] = {
        name: plant.name,
        family: plant.family || '',
        records: []
      };
    }
    groups[key].records.push({
      observationType: plant.observationType,
      plantPart: plant.plantPart,
      lifeStage: plant.lifeStage,
      reference: plant.reference,
      notes: plant.notes
    });
  });
  
  return Object.values(groups);
};

/**
 * 個別食草情報の詳細表示コンポーネント（統合版）
 */
const HostPlantDetailCard = ({ plantGroup, isExpanded, onToggle }) => {
  // 最優先の観察タイプを決定（野外（国内）を最優先）
  const primaryRecord = plantGroup.records.reduce((prev, current) => {
    const prevPriority = getObservationTypePriority(prev.observationType);
    const currentPriority = getObservationTypePriority(current.observationType);
    return currentPriority < prevPriority ? current : prev;
  });
  
  const obsStyle = getObservationTypeStyle(primaryRecord.observationType);
  const isDomesticWild = primaryRecord.observationType === '野外（国内）';
  
  // 利用情報をグループ化
  const usageInfo = plantGroup.records.reduce((acc, record) => {
    const key = `${record.lifeStage || ''}|${record.plantPart || ''}`;
    if (!acc[key]) {
      acc[key] = {
        lifeStage: record.lifeStage,
        plantPart: record.plantPart,
        observationTypes: new Set(),
        references: new Set(),
        notes: new Set()
      };
    }
    if (record.observationType) acc[key].observationTypes.add(record.observationType);
    if (record.reference) acc[key].references.add(record.reference);
    if (record.notes) acc[key].notes.add(record.notes);
    return acc;
  }, {});
  
  const usageInfoArray = Object.values(usageInfo);
  const hasMultipleUsages = usageInfoArray.length > 1;
  
  return (
    <div className={`rounded-lg border ${obsStyle.borderColor} ${obsStyle.bgColor} p-3 transition-all duration-200`}>
      {/* 基本情報行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <div className="flex-1">
            <span className={`font-medium ${isDomesticWild ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
              {plantGroup.name}
            </span>
            {plantGroup.family && (
              <span className={`text-sm ml-2 ${isDomesticWild ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {plantGroup.family}
              </span>
            )}
          </div>
          
          <span className={`text-xs px-2 py-0.5 rounded ${obsStyle.bgColor} ${obsStyle.textColor} font-medium`}>
            {obsStyle.label}
          </span>
        </div>
      </div>
      
      {/* 利用情報 - 横並びまたは単一表示 */}
      {usageInfoArray.length > 0 && (
        <div className="mt-2">
          {hasMultipleUsages ? (
            // 複数利用の場合 - 横並び表示
            <div className="flex flex-wrap gap-3 text-sm">
              {usageInfoArray.map((usage, index) => (
                <div key={index} className="flex items-center space-x-2 px-2 py-1 bg-white/50 dark:bg-slate-900/30 rounded">
                  {usage.lifeStage && (
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {usage.lifeStage}
                    </span>
                  )}
                  {usage.lifeStage && usage.plantPart && (
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                  )}
                  {usage.plantPart && (
                    <span className="text-slate-600 dark:text-slate-400">
                      {usage.plantPart}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // 単一利用の場合 - インライン表示
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              {usageInfoArray[0].lifeStage && (
                <span className="font-medium">{usageInfoArray[0].lifeStage}</span>
              )}
              {usageInfoArray[0].lifeStage && usageInfoArray[0].plantPart && (
                <span className="text-slate-400 dark:text-slate-500">•</span>
              )}
              {usageInfoArray[0].plantPart && (
                <span>{usageInfoArray[0].plantPart}</span>
              )}
            </div>
          )}
          
          {/* 出典情報 - 統合表示 */}
          {(() => {
            const allReferences = new Set();
            usageInfoArray.forEach(usage => {
              usage.references.forEach(ref => allReferences.add(ref));
            });
            if (allReferences.size > 0) {
              return (
                <div className="mt-4 pt-4 border-t border-emerald-200/30 dark:border-emerald-700/30">
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-medium">出典:</span>{' '}
                      {Array.from(allReferences).join(', ')}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
};

/**
 * 統合食草情報表示コンポーネント
 */
const EnhancedHostPlantDisplay = ({ 
  hostPlants = [], 
  hostPlantsDetailed = [], 
  showDetailsByDefault = false,
  maxDisplayCount = 5 
}) => {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [showAll, setShowAll] = useState(false);
  
  // 詳細情報がある場合はそれを優先、なければ従来形式を使用
  let plantsToDisplay = hostPlantsDetailed && hostPlantsDetailed.length > 0 
    ? hostPlantsDetailed 
    : hostPlants.map(plant => ({
        name: typeof plant === 'string' ? plant.replace(/（.*）$/, '') : plant.name || plant,
        family: typeof plant === 'string' ? extractFamily(plant) : plant.family || '',
        displayName: typeof plant === 'string' ? plant : plant.displayName || plant.name || plant,
        observationType: '野外（国内）',
        plantPart: '葉',
        lifeStage: '幼虫',
        reference: '',
        notes: '',
        isDetailed: false
      }));

  // 同じ植物名の記録をグループ化
  const groupedPlants = groupPlantsByName(plantsToDisplay);

  // グループを「野外（国内）」を優先してソート
  const sortedGroups = groupedPlants.sort((a, b) => {
    // 各グループの最優先観察タイプを取得
    const priorityA = Math.min(...a.records.map(r => getObservationTypePriority(r.observationType)));
    const priorityB = Math.min(...b.records.map(r => getObservationTypePriority(r.observationType)));
    
    // 優先度が同じ場合は植物名でソート
    if (priorityA === priorityB) {
      return (a.name || '').localeCompare(b.name || '', 'ja');
    }
    
    return priorityA - priorityB;
  });
  
  const toggleExpanded = (index) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };
  
  if (!plantsToDisplay || plantsToDisplay.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 italic">
        食草情報なし
      </div>
    );
  }
  
  const displayCount = showAll ? sortedGroups.length : Math.min(maxDisplayCount, sortedGroups.length);
  const hasMore = sortedGroups.length > maxDisplayCount;
  
  return (
    <div className="space-y-3">
      {/* 食草リスト */}
      <div className="space-y-2">
        {sortedGroups.slice(0, displayCount).map((plantGroup, index) => (
          <HostPlantDetailCard
            key={`${plantGroup.name}-${index}`}
            plantGroup={plantGroup}
            isExpanded={expandedItems.has(index) || showDetailsByDefault}
            onToggle={() => toggleExpanded(index)}
          />
        ))}
      </div>
      
      {/* "もっと見る" ボタン */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
          >
            {showAll ? '簡略表示' : `他${sortedGroups.length - maxDisplayCount}種を表示`}
            <svg 
              className={`ml-1 w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * 科名を抽出するヘルパー関数
 */
const extractFamily = (plantText) => {
  const match = plantText.match(/（([^）]+科)）/);
  return match ? match[1] : '';
};

export default EnhancedHostPlantDisplay;