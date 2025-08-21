import React, { useState } from 'react';
import { getSourceLink } from '../utils/sourceLinks';

/**
 * 生活史段階のアイコンとスタイル
 */
const getLifeStageIcon = (lifeStage) => {
  switch (lifeStage) {
    case '幼虫':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C9.24 2 7 4.24 7 7s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0 2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
          </svg>
        ),
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30'
      };
    case '成虫':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L7 7l5 5 5-5-5-5zm0 3.8L14.2 8 12 10.2 9.8 8 12 5.8zM6 12l-4 4 4 4 4-4-4-4zm0 3.8L7.2 17 6 18.2 4.8 17 6 15.8zm12 0L19.2 17 18 18.2 16.8 17 18 15.8zm0-3.8l-4 4 4 4 4-4-4-4z"/>
          </svg>
        ),
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30'
      };
    case '蛹':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C9.8 2 8 3.8 8 6v12c0 2.2 1.8 4 4 4s4-1.8 4-4V6c0-2.2-1.8-4-4-4zm0 2c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          </svg>
        ),
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30'
      };
    case '卵':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8"/>
          </svg>
        ),
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
      };
    default:
      return {
        icon: null,
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-900/30'
      };
  }
};

/**
 * 植物部位のアイコンとスタイル
 */
const getPlantPartIcon = (plantPart) => {
  switch (plantPart) {
    case '葉':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
          </svg>
        ),
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/30'
      };
    case '花':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A3,3 0 0,1 15,5A3,3 0 0,1 12,8A3,3 0 0,1 9,5A3,3 0 0,1 12,2M12,9A1,1 0 0,1 13,10V22A1,1 0 0,1 12,23A1,1 0 0,1 11,22V10A1,1 0 0,1 12,9M8,12A3,3 0 0,1 5,15A3,3 0 0,1 2,12A3,3 0 0,1 5,9A3,3 0 0,1 8,12M16,12A3,3 0 0,1 19,9A3,3 0 0,1 22,12A3,3 0 0,1 19,15A3,3 0 0,1 16,12Z"/>
          </svg>
        ),
        color: 'text-pink-600 dark:text-pink-400',
        bgColor: 'bg-pink-100 dark:bg-pink-900/30'
      };
    case '実':
    case '果実':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,20A8,8 0 0,1 4,12C4,7.58 7.58,4 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,3L13.5,5.5L16.5,6L14.5,8.5L15,11.5L12,10L9,11.5L9.5,8.5L7.5,6L10.5,5.5L12,3Z"/>
          </svg>
        ),
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30'
      };
    case '樹皮':
    case '茎':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,1L8,5V11H16V5M12,11L8,15V21H16V15M12,11Z"/>
          </svg>
        ),
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30'
      };
    case '根':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2V12L8,16V22H10V18L12,16L14,18V22H16V16L12,12V2H12Z"/>
          </svg>
        ),
        color: 'text-yellow-700 dark:text-yellow-500',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
      };
    case '新芽':
    case '芽':
      return {
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2C9.24,2 7,4.24 7,7C7,9.05 7.9,10.88 9.29,12C7.9,13.12 7,14.95 7,17C7,19.76 9.24,22 12,22C14.76,22 17,19.76 17,17C17,14.95 16.1,13.12 14.71,12C16.1,10.88 17,9.05 17,7C17,4.24 14.76,2 12,2Z"/>
          </svg>
        ),
        color: 'text-lime-600 dark:text-lime-400',
        bgColor: 'bg-lime-100 dark:bg-lime-900/30'
      };
    default:
      return {
        icon: null,
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-900/30'
      };
  }
};

/**
 * 観察タイプ別のスタイルを取得
 */
const getObservationTypeStyle = (observationType) => {
  switch (observationType) {
    case '飼育':
    case '飼育記録':
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
    case '国外':
    case '野外（海外）':
      return {
        label: '海外',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-200 dark:border-purple-700'
      };
    default:
      return {
        label: 'その他',
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
    case '飼育':
    case '飼育記録': return 2;
    case '野外（海外）':
    case '海外':
    case '国外': return 3;
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
  
  // species-6115関連のデバッグ - ゴヨウマツまたは不明の植物
  if (plantGroup.name === 'ゴヨウマツ' || plantGroup.name === '不明') {
    console.log(`DEBUG ${plantGroup.name} observation processing:`, {
      plantName: plantGroup.name,
      records: plantGroup.records,
      primaryRecord: primaryRecord,
      primaryObservationType: primaryRecord.observationType
    });
    
    plantGroup.records.forEach((record, idx) => {
      console.log(`DEBUG ${plantGroup.name} record[${idx}]:`, {
        observationType: record.observationType,
        plantPart: record.plantPart,
        lifeStage: record.lifeStage,
        reference: record.reference,
        notes: record.notes
      });
    });
  }
  
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
    if (record.reference) {
      // セミコロンで区切られた複数の出典を分割
      const refs = record.reference.split(';').map(r => r.trim()).filter(r => r);
      refs.forEach(ref => acc[key].references.add(ref));
    }
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
              {usageInfoArray.map((usage, index) => {
                const lifeStageInfo = usage.lifeStage ? getLifeStageIcon(usage.lifeStage) : null;
                const plantPartInfo = usage.plantPart ? getPlantPartIcon(usage.plantPart) : null;
                
                return (
                  <div key={index} className="flex items-center space-x-2 px-2 py-1 bg-white/50 dark:bg-slate-900/30 rounded">
                    {lifeStageInfo && (
                      <div className="flex items-center space-x-1">
                        <span className={lifeStageInfo.color}>
                          {lifeStageInfo.icon}
                        </span>
                        <span className={`font-medium ${lifeStageInfo.color}`}>
                          {usage.lifeStage}
                        </span>
                      </div>
                    )}
                    {usage.lifeStage && usage.plantPart && (
                      <span className="text-slate-400 dark:text-slate-500">•</span>
                    )}
                    {plantPartInfo && (
                      <div className="flex items-center space-x-1">
                        <span className={plantPartInfo.color}>
                          {plantPartInfo.icon}
                        </span>
                        <span className={plantPartInfo.color}>
                          {usage.plantPart}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // 単一利用の場合 - インライン表示
            <div className="flex items-center space-x-2 text-sm">
              {(() => {
                const usage = usageInfoArray[0];
                const lifeStageInfo = usage.lifeStage ? getLifeStageIcon(usage.lifeStage) : null;
                const plantPartInfo = usage.plantPart ? getPlantPartIcon(usage.plantPart) : null;
                
                return (
                  <>
                    {lifeStageInfo && (
                      <div className="flex items-center space-x-1">
                        <span className={lifeStageInfo.color}>
                          {lifeStageInfo.icon}
                        </span>
                        <span className={`font-medium ${lifeStageInfo.color}`}>
                          {usage.lifeStage}
                        </span>
                      </div>
                    )}
                    {usage.lifeStage && usage.plantPart && (
                      <span className="text-slate-400 dark:text-slate-500">•</span>
                    )}
                    {plantPartInfo && (
                      <div className="flex items-center space-x-1">
                        <span className={plantPartInfo.color}>
                          {plantPartInfo.icon}
                        </span>
                        <span className={plantPartInfo.color}>
                          {usage.plantPart}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
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
                      {Array.from(allReferences).map((ref, index) => {
                        const sourceLink = getSourceLink(ref);
                        const separator = index > 0 ? ', ' : '';
                        
                        if (sourceLink) {
                          return (
                            <React.Fragment key={index}>
                              {separator}
                              <a 
                                href={sourceLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline hover:no-underline transition-colors duration-200"
                              >
                                {ref}
                                <svg className="w-3 h-3 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={index}>
                            {separator}
                            <span className="font-medium">{ref}</span>
                          </React.Fragment>
                        );
                      })}
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