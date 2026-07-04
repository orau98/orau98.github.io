import React, { useState } from 'react';
import logger from '../utils/logger';
import { Link, useLocation } from 'react-router-dom';
import SourceCitation from './ui/SourceCitation';
import { makeDetailLinkState } from '../utils/navState';
import { buildPlantPath } from '../utils/siteTaxonomy';
import { isEnglishLocale } from '../utils/locale';
import { buildJapaneseReferenceLabel, getPrimaryEnglishName } from '../utils/englishNaming';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import { getHostResourceType } from '../utils/hostResource';
import { HOST_STYLE, FLOWER_STYLE, buildShowMoreLabel } from '../utils/hostVisitStyle';

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
 * 成虫の訪花記録かどうか
 */
const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = (record.lifeStage || '').trim();
  const plantPart = (record.plantPart || '').trim();
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

/**
 * 観察タイプ別のスタイルを取得
 */
const getObservationTypeStyle = (observationType, isEnglish = false) => {
  switch (observationType) {
    case '文献':
      return {
        label: isEnglish ? 'Literature' : '文献',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        textColor: 'text-amber-700 dark:text-amber-300',
        borderColor: 'border-amber-200 dark:border-amber-700'
      };
    case '飼育':
    case '飼育記録':
      return {
        label: isEnglish ? 'Reared' : '飼育',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-700'
      };
    case '野外（国内）':
      return {
        label: isEnglish ? 'Field' : '野外',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-700'
      };
    case '海外':
    case '国外':
    case '野外（国外）':
      return {
        label: isEnglish ? 'Overseas' : '海外',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-200 dark:border-purple-700'
      };
    default:
      return {
        label: isEnglish ? 'Other' : 'その他',
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
    case '文献': return 2;
    case '飼育':
    case '飼育記録': return 2;
    case '野外（国外）':
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
    const resourceType = plant.resourceType || getHostResourceType(plant.name);
    if (!groups[key]) {
      groups[key] = {
        name: plant.name,
        family: plant.family || '',
        resourceType,
        records: []
      };
    }
    groups[key].records.push({
      observationType: plant.observationType,
      plantPart: plant.plantPart,
      lifeStage: plant.lifeStage,
      reference: plant.reference,
      notes: plant.notes,
      resourceType
    });
  });
  
  return Object.values(groups);
};

/**
 * 個別食草情報の詳細表示コンポーネント（統合版）
 */
const getLifeStageLabel = (lifeStage, isEnglish = false) => {
  if (!isEnglish) return lifeStage;
  return ({
    幼虫: 'Larva',
    成虫: 'Adult',
    蛹: 'Pupa',
    卵: 'Egg',
  })[lifeStage] || lifeStage;
};

const getPlantPartLabel = (plantPart, isEnglish = false) => {
  if (!isEnglish) return plantPart;
  return ({
    葉: 'Leaf',
    花: 'Flower',
    実: 'Fruit',
    果実: 'Fruit',
    樹皮: 'Bark',
    茎: 'Stem',
    根: 'Root',
    新芽: 'Bud',
    芽: 'Bud',
  })[plantPart] || plantPart;
};

const HostPlantDetailCard = React.memo(({ plantGroup, locale = 'ja', plantDetails = {} }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const isResourceGroup = plantGroup.resourceType === 'substrate';
  // 「不明」は植物ページが存在しないため、リンクにしない
  // （文献記録しか無い種では全記録が「不明」のまま残ることがある）
  const isUnknownPlant = String(plantGroup.name || '').trim() === '不明';
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
  
  const obsStyle = getObservationTypeStyle(primaryRecord.observationType, isEnglish);
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
  // インライン用バッジを事前計算（上限2件 + 余剰表示）
  const badges = usageInfoArray.map((usage) => {
    const ls = usage.lifeStage ? getLifeStageIcon(usage.lifeStage) : null;
    const pp = usage.plantPart ? getPlantPartIcon(usage.plantPart) : null;
    const isFlowerVisit = isFlowerVisitRecord({ lifeStage: usage.lifeStage, plantPart: usage.plantPart });
    const label = isFlowerVisit
      ? (isEnglish ? 'Flower visit' : '訪花')
      : ([getLifeStageLabel(usage.lifeStage, isEnglish), getPlantPartLabel(usage.plantPart, isEnglish)].filter(Boolean).join(isEnglish ? ' / ' : '・') || '');
    return { label, ls, pp };
  }).filter(b => b.label);
  const maxBadges = 2;
  const shownBadges = badges.slice(0, maxBadges);
  const extra = badges.length - shownBadges.length;

  // Repair Latin binomials for display (only when needed)
  const repairPlantLatinBinomial = (plant) => {
    if (!plant || typeof plant !== 'string') return plant;
    const t = plant.trim();
    if (!t) return t;
    // Skip when Japanese present
    if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(t)) return t;
    // If already a binomial, normalize to a single space
    const spaced = t.match(/^([A-Z][a-z]+)\s+([a-z-]{3,})(.*)$/);
    if (spaced) return `${spaced[1]} ${spaced[2]}${spaced[3] || ''}`.trim();
    return t;
  };
  const displayPlantName = repairPlantLatinBinomial(plantGroup.name);
  const plantDetail = isResourceGroup ? {} : (plantDetails?.[plantGroup.name] || {});
  const primaryPlantName = isEnglish
    ? getPrimaryEnglishName({
        scientificName: plantDetail.scientificName,
        japaneseName: displayPlantName,
        fallback: displayPlantName,
      })
    : displayPlantName;
  const japaneseReference = isEnglish && /[\u3040-\u30FF\u3400-\u9FFF]/.test(displayPlantName)
    ? buildJapaneseReferenceLabel(displayPlantName)
    : '';

  return (
    <div className={`rounded-lg border ${obsStyle.borderColor} ${obsStyle.bgColor} p-3 transition-all duration-200`}>
      {/* 基本情報行（食草名 + 科名 + 利用バッジを横並びで表示）
          和名と科名はベースラインで揃える。一方、バッジ・観察タイプのピルは
          overflow-hidden を含むためベースラインが「箱の下端」で代用され（CSSの
          合成ベースライン。Safari と Chrome で挙動も異なる）縦にズレるので、
          ベースライン揃えには参加させず、和名の行箱と同じ高さ h-6(24px) に固定して
          行頭揃え（= 視覚的センター一致）にする */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0 flex-1">
          <div className="min-w-0">
            {isResourceGroup || isUnknownPlant ? (
              <span
                // truncateはinline要素には効かないため、inline-block化して省略を有効にする
                className={`inline-block max-w-full font-medium truncate ${isDomesticWild ? 'text-emerald-700 dark:text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}
                title={displayPlantName}
              >
                {primaryPlantName}
              </span>
            ) : (
              <Link
                to={buildPlantPath(plantGroup.name, locale)}
                state={makeDetailLinkState(location)}
                className={`inline-block max-w-full font-medium truncate ${isDomesticWild ? 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'} underline-offset-2 hover:underline`}
                title={isEnglish ? `${primaryPlantName}${japaneseReference ? ` (${displayPlantName})` : ''}` : `${displayPlantName} の詳細へ`}
              >
                {isEnglish && plantDetail.scientificName
                  ? formatScientificNameReact(primaryPlantName)
                  : primaryPlantName}
              </Link>
            )}
            {japaneseReference && (
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {japaneseReference}
              </div>
            )}
          </div>
          {!isResourceGroup && plantGroup.family && plantGroup.family !== plantGroup.name && plantGroup.family !== '不明' && (
            <Link
              to={buildPlantPath(plantGroup.family, locale)}
              state={makeDetailLinkState(location)}
              className={`text-sm shrink-0 underline-offset-2 hover:underline ${isDomesticWild ? 'text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300' : 'text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-300'}`}
              title={isEnglish ? `Go to ${plantGroup.family}` : `${plantGroup.family} の詳細へ`}
            >
              {plantGroup.family}
            </Link>
          )}
          {/* 利用バッジ（極小・横並び・折り返さない） */}
          {shownBadges.length > 0 && (
            <div className="self-start flex items-center gap-1 overflow-hidden">
              {shownBadges.map((b, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 h-6 text-[11px] px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/30 ${b.ls ? b.ls.color : ''}`}
                  title={b.label}
                >
                  <span className="truncate max-w-[8rem]">{b.label}</span>
                </span>
              ))}
              {extra > 0 && (
                <span className="inline-flex items-center h-6 text-[11px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {isEnglish ? `+${extra} more` : `他+${extra}`}
                </span>
              )}
            </div>
          )}
        </div>
        {/* カード背景と同じ bgColor だとバッジが地の文に埋没するため白系の面+枠線にし、
            縦ずれ防止のため h-6 固定・行頭揃え(#63/#69)も維持する */}
        <span className={`inline-flex items-center h-6 text-xs px-2 rounded shrink-0 border ${obsStyle.borderColor} bg-white/80 dark:bg-slate-900/50 ${obsStyle.textColor} font-medium`}>
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
        // 備考のフィルタリング: 食草セクションに不適切な生活史・発生時期系の文言を除去
        const isLifecycleNote = (s) => /地中性|越冬|年[0-9一二三]化|出現|発生|羽化/.test(s);
        const isPlantRelevant = (s) => /葉|花|蕾|若葉|茎|根|枝|樹皮|果実|種子|花粉/.test(s) || /（[^）]*科）/.test(s);
        // 改行も区切りに含め、改行区切りの備考が1行に潰れないようにする
        const splitSegments = (s) => s.split(/[\r\n\/／]|。|；|;/).map(t => t.trim()).filter(Boolean);
        const filteredNotesSet = new Set();
        Array.from(allNotes).forEach(note => {
          splitSegments(note).forEach(seg => {
            if (!seg) return;
            // 生活史重複（出現時期等）は除外
            if (isLifecycleNote(seg) && !isPlantRelevant(seg)) return;
            filteredNotesSet.add(seg);
          });
        });

        if (allReferences.size === 0 && filteredNotesSet.size === 0) return null;
        return (
          <div className="mt-2 pt-2 border-t border-emerald-200/30 dark:border-emerald-700/30 space-y-1.5">
            {allReferences.size > 0 && (
              <SourceCitation sources={Array.from(allReferences)} isEnglish={isEnglish} />
            )}
            {filteredNotesSet.size > 0 && (
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v10a2 2 0 01-2 2z" />
                </svg>
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-medium">{isEnglish ? 'Notes:' : '備考:'}</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {Array.from(filteredNotesSet).map((note, idx) => (
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
});

/**
 * 統合食草情報表示コンポーネント
 */
const EnhancedHostPlantDisplay = ({ 
  hostPlants = [], 
  hostPlantsDetailed = [], 
  showDetailsByDefault = false,
  maxDisplayCount = 5,
  locale = 'ja',
  plantDetails = {},
}) => {
  const isEnglish = isEnglishLocale(locale);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [showAllHost, setShowAllHost] = useState(false);
  const [showAllFlower, setShowAllFlower] = useState(false);
  
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
  
  const toggleExpanded = (key) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };
  
  if (!plantsToDisplay || plantsToDisplay.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 italic">
        {isEnglish ? 'No plant-use records available.' : '食草情報なし'}
      </div>
    );
  }
  
  const splitGroupsByUsage = (groups) => {
    const hostGroups = [];
    const flowerGroups = [];
    const resourceGroups = [];
    groups.forEach((group) => {
      if (group.resourceType === 'substrate') {
        resourceGroups.push(group);
        return;
      }
      const flowerRecords = group.records.filter(isFlowerVisitRecord);
      const hostRecords = group.records.filter((record) => !isFlowerVisitRecord(record));
      if (hostRecords.length > 0) hostGroups.push({ ...group, records: hostRecords, usageCategory: 'host' });
      if (flowerRecords.length > 0) flowerGroups.push({ ...group, records: flowerRecords, usageCategory: 'flower' });
    });
    return { hostGroups, flowerGroups, resourceGroups };
  };

  const { hostGroups, flowerGroups, resourceGroups } = splitGroupsByUsage(sortedGroups);
  const hostDisplayCount = showAllHost ? hostGroups.length : Math.min(maxDisplayCount, hostGroups.length);
  const flowerDisplayCount = showAllFlower ? flowerGroups.length : Math.min(maxDisplayCount, flowerGroups.length);
  const hasMoreHost = hostGroups.length > maxDisplayCount;
  const hasMoreFlower = flowerGroups.length > maxDisplayCount;
  
  return (
    <div className="space-y-4">
      {hostGroups.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs font-semibold uppercase tracking-wide ${HOST_STYLE.labelText}`}>
            {isEnglish ? 'Larval host plants' : '幼虫の食草・食樹'}
          </div>
          <div className="space-y-2">
            {hostGroups.slice(0, hostDisplayCount).map((plantGroup, index) => {
              const key = `host-${index}`;
              return (
                <HostPlantDetailCard
                  key={`${plantGroup.name}-${key}`}
                  plantGroup={plantGroup}
                  isExpanded={expandedItems.has(key) || showDetailsByDefault}
                  onToggle={() => toggleExpanded(key)}
                  locale={locale}
                  plantDetails={plantDetails}
                />
              );
            })}
          </div>
          {hasMoreHost && (
            <div className="text-center">
              <button
                onClick={() => setShowAllHost(!showAllHost)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
              >
                {showAllHost ? (isEnglish ? 'Show less' : '簡略表示') : buildShowMoreLabel(hostGroups.length - maxDisplayCount, isEnglish)}
                <svg 
                  className={`ml-1 w-4 h-4 transition-transform ${showAllHost ? 'rotate-180' : ''}`}
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
      )}

      {flowerGroups.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs font-semibold uppercase tracking-wide ${FLOWER_STYLE.labelText}`}>
            {isEnglish ? 'Adult flower visits' : '成虫の訪花'}
          </div>
          <div className="space-y-2">
            {flowerGroups.slice(0, flowerDisplayCount).map((plantGroup, index) => {
              const key = `flower-${index}`;
              return (
                <HostPlantDetailCard
                  key={`${plantGroup.name}-${key}`}
                  plantGroup={plantGroup}
                  isExpanded={expandedItems.has(key) || showDetailsByDefault}
                  onToggle={() => toggleExpanded(key)}
                  locale={locale}
                  plantDetails={plantDetails}
                />
              );
            })}
          </div>
          {hasMoreFlower && (
            <div className="text-center">
              <button
                onClick={() => setShowAllFlower(!showAllFlower)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              >
                {showAllFlower ? (isEnglish ? 'Show less' : '簡略表示') : buildShowMoreLabel(flowerGroups.length - maxDisplayCount, isEnglish)}
                <svg 
                  className={`ml-1 w-4 h-4 transition-transform ${showAllFlower ? 'rotate-180' : ''}`}
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
      )}

      {resourceGroups.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {isEnglish ? 'Other larval resources' : '植物以外の利用資源'}
          </div>
          <div className="space-y-2">
            {resourceGroups.map((plantGroup, index) => (
              <HostPlantDetailCard
                key={`${plantGroup.name}-resource-${index}`}
                plantGroup={plantGroup}
                isExpanded={expandedItems.has(`resource-${index}`) || showDetailsByDefault}
                onToggle={() => toggleExpanded(`resource-${index}`)}
                locale={locale}
                plantDetails={plantDetails}
              />
            ))}
          </div>
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
