import React, { useState } from 'react';
import logger from '../utils/logger';
import { Link } from 'react-router-dom';
import { getSourceLink, normalizeReference } from '../utils/sourceLinks';

/**
 * 生活史段階のスタイル（アイコンは使用しない）
 */
const getLifeStageIcon = (lifeStage) => {
  switch (lifeStage) {
    case '幼虫':
      return {
        icon: null,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30'
      };
    case '成虫':
      return {
        icon: null,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30'
      };
    case '蛹':
      return {
        icon: null,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30'
      };
    case '卵':
      return {
        icon: null,
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
 * 植物部位のスタイル（アイコンは使用しない）
 */
const getPlantPartIcon = (plantPart) => {
  switch (plantPart) {
    case '葉':
      return {
        icon: null,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/30'
      };
    case '花':
      return {
        icon: null,
        color: 'text-pink-600 dark:text-pink-400',
        bgColor: 'bg-pink-100 dark:bg-pink-900/30'
      };
    case '実':
    case '果実':
      return {
        icon: null,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30'
      };
    case '樹皮':
    case '茎':
      return {
        icon: null,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30'
      };
    case '根':
      return {
        icon: null,
        color: 'text-yellow-700 dark:text-yellow-500',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
      };
    case '新芽':
    case '芽':
      return {
        icon: null,
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
    logger.debug(`DEBUG ${plantGroup.name} observation processing:`, {
      plantName: plantGroup.name,
      records: plantGroup.records,
      primaryRecord: primaryRecord,
      primaryObservationType: primaryRecord.observationType
    });
    
    plantGroup.records.forEach((record, idx) => {
      logger.debug(`DEBUG ${plantGroup.name} record[${idx}]:`, {
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
  
  // インライン用バッジを事前計算（上限2件 + 余剰表示）
  const badges = usageInfoArray.map((usage) => {
    const ls = usage.lifeStage ? getLifeStageIcon(usage.lifeStage) : null;
    const pp = usage.plantPart ? getPlantPartIcon(usage.plantPart) : null;
    const label = [usage.lifeStage, usage.plantPart].filter(Boolean).join('・') || '';
    return { label, ls, pp };
  }).filter(b => b.label);
  const maxBadges = 2;
  const shownBadges = badges.slice(0, maxBadges);
  const extra = badges.length - shownBadges.length;

  return (
    <div className={`rounded-lg border ${obsStyle.borderColor} ${obsStyle.bgColor} p-3 transition-all duration-200`}>
      {/* 基本情報行（食草名 + 科名 + 利用バッジを横並びで表示） */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to={`/plant/${encodeURIComponent(plantGroup.name)}`}
            className={`font-medium truncate ${isDomesticWild ? 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'} underline-offset-2 hover:underline`}
            title={`${plantGroup.name} の詳細へ`}
          >
            {plantGroup.name}
          </Link>
          {plantGroup.family && (
            <span className={`text-sm shrink-0 ${isDomesticWild ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {plantGroup.family}
            </span>
          )}
          {/* 利用バッジ（極小・横並び・折り返さない） */}
          {shownBadges.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {shownBadges.map((b, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 text-[11px] leading-5 px-1.5 py-[1px] rounded border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/30 ${b.ls ? b.ls.color : ''}`}
                  title={b.label}
                >
                  <span className="truncate max-w-[8rem]">{b.label}</span>
                </span>
              ))}
              {extra > 0 && (
                <span className="text-[11px] leading-5 px-1 py-[1px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  他+{extra}
                </span>
              )}
            </div>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${obsStyle.bgColor} ${obsStyle.textColor} font-medium`}>
          {obsStyle.label}
        </span>
      </div>

      {/* 出典情報（必要時のみ下段に表示） */}
      {(() => {
        const allReferences = new Set();
        const allNotes = new Set();
        usageInfoArray.forEach(usage => {
          usage.references.forEach(ref => allReferences.add(ref));
          usage.notes.forEach(n => allNotes.add(n));
        });
        if (allReferences.size === 0 && allNotes.size === 0) return null;
        return (
          <div className="mt-2 pt-2 border-t border-emerald-200/30 dark:border-emerald-700/30 space-y-1.5">
            {allReferences.size > 0 && (
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-500 dark:text-slate-400">出典:</span>{' '}
                  {Array.from(allReferences).map((ref, index) => {
                    const displayRef = normalizeReference(ref);
                    const sourceLink = getSourceLink(displayRef);
                    const separator = index > 0 ? ', ' : '';
                    if (sourceLink) {
                      return (
                        <React.Fragment key={index}>
                          {separator}
                          <a 
                            href={sourceLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 underline decoration-slate-300 hover:decoration-slate-400 transition-colors duration-200"
                          >
                            {displayRef}
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
                        <span className="font-medium">{displayRef}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
            {allNotes.size > 0 && (
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v10a2 2 0 01-2 2z" />
                </svg>
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-medium">備考:</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {Array.from(allNotes).map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })()}
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

  // 「不明」植物のフィルタリング：野外食草情報がある場合は「不明」を除外
  const hasWildPlants = plantsToDisplay.some(plant => 
    plant.name && plant.name !== '不明' && 
    plant.observationType && plant.observationType.includes('野外')
  );
  
  if (hasWildPlants) {
    plantsToDisplay = plantsToDisplay.filter(plant => plant.name !== '不明');
  }

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
