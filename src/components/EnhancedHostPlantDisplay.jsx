import { isFlowerVisitRecord } from '../utils/flowerVisitPlants.js';
import React, { useId, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SourceCitation from './ui/SourceCitation';
import { getReferenceMeta } from '../utils/sourceLinks';
import { formatCitationContributors, getBibliographyEntry } from '../utils/bibliography';
import { isAmazonAssociateUrl } from '../utils/amazonAssociates';
import { makeDetailLinkState } from '../utils/navState';
import { buildPlantPath } from '../utils/siteTaxonomy';
import { isEnglishLocale } from '../utils/locale';
import { buildJapaneseReferenceLabel, getPrimaryEnglishName } from '../utils/englishNaming';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import { getHostResourceType } from '../utils/hostResource';
import { HOST_STYLE, FLOWER_STYLE, buildShowMoreLabel } from '../utils/hostVisitStyle';
import { getPublicHostPlantNoteSegments } from '../utils/publicHostPlantNotes';
import { buildPlantUseSummary } from '../utils/plantUseSummary';
import {
  getObservationTypeCategory,
  getObservationTypePriority,
  groupObservationEvidence,
} from '../utils/observationType';

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
      isFlowerVisit: plant.isFlowerVisit,
      recordId: plant.recordId,
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
  if (['記載なし', '未記載', '不明'].includes(lifeStage)) return '';
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

// 食草欄の備考から、植物の利用に関係する文だけを取り出す（出現時期など生活史の重複は除く）
const isLifecycleNote = (s) => /地中性|越冬|年[0-9一二三]化|出現|発生|羽化/.test(s);
const isPlantRelevantNote = (s) => /葉|花|蕾|若葉|茎|根|枝|幹|樹皮|果実|種子|花粉/.test(s) || /（[^）]*科）/.test(s);
// 羽化時期のメモは除外し、寄主からの羽化や出典標本を根拠とする備考は表示する。
const isHostEmergenceEvidence = (s) => /から(?:の)?羽化|羽化(?:個体|標本)/.test(s);
const getPlantRelevantNotes = (records = []) => {
  const notes = new Set();
  records.forEach((record) => {
    if (!record.notes) return;
    getPublicHostPlantNoteSegments(record.notes).forEach((segment) => {
      if (!segment) return;
      if (isLifecycleNote(segment) && !isPlantRelevantNote(segment) && !isHostEmergenceEvidence(segment)) return;
      notes.add(segment);
    });
  });
  return Array.from(notes);
};

const getObservationLabel = ({ label, regionLabel }, isEnglish) =>
  regionLabel ? (isEnglish ? `${label} (${regionLabel})` : `${label}（${regionLabel}）`) : label;

const getUsageLabel = (record, isEnglish) => {
  if (isFlowerVisitRecord(record)) return '';
  const usage = {
    後食: isEnglish ? 'Adult feeding' : '後食',
    採集植物: isEnglish ? 'Collection plant' : '採集植物',
  }[record.observationType];
  return [getLifeStageLabel(record.lifeStage, isEnglish), getPlantPartLabel(record.plantPart, isEnglish), usage]
    .filter(Boolean)
    .join(isEnglish ? ' / ' : '・');
};

const INITIAL_PLANT_LIMIT = 30;

const getPlantSources = (records) => {
  const sources = new Map();
  for (const record of records) {
    const references = String(record.reference || '').split(/[;；]/).map((value) => value.trim()).filter(Boolean);
    for (const reference of references.length ? references : ['']) {
      const entry = getBibliographyEntry(reference);
      const meta = getReferenceMeta(reference);
      const key = entry?.key || meta.key || reference;
      if (!sources.has(key)) {
        const author = entry && formatCitationContributors(entry);
        const label = author && entry.year ? `${author} (${entry.year})` : author || meta.displayLabel || reference;
        const publication = entry?.journal
          ? [entry.journal, entry.volume && entry.issue ? `${entry.volume}(${entry.issue})` : entry.volume || entry.issue].filter(Boolean).join(' ')
          : entry?.title;
        sources.set(key, { key, label, link: meta.link, publication, publicationPages: entry?.journal ? entry.pages : '', records: [] });
      }
      const source = sources.get(key);
      if (!source.records.includes(record)) source.records.push(record);
    }
  }
  return [...sources.values()];
};

const observationBadges = (evidence, isEnglish) => (
  <span className="inline-flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label={isEnglish ? 'Observation setting' : '観察条件'}>
    {evidence.map(({ key, presentation }) => (
      <span key={key} className={`inline-flex min-h-5 items-center rounded border px-1.5 text-xs font-medium leading-5 ${presentation.borderColor} ${presentation.textColor} ${presentation.bgColor}`}>
        {getObservationLabel(presentation, isEnglish)}
      </span>
    ))}
  </span>
);

const sourcePagePattern = /該当頁\s*([0-9０-９]+(?:\s*[、,–〜-]\s*[0-9０-９]+)*)/g;

const PlantUseRow = ({ item, label, familyLabel, locale, sharedUsage }) => {
  const isEnglish = isEnglishLocale(locale);
  const location = useLocation();
  const sourcePanelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const sources = getPlantSources(item.group.records);
  const sourceCount = sources.filter(({ key }) => key).length;
  const hasDetails = sourceCount > 0 || item.notes.length > 0;
  const sourceLabel = sourceCount
    ? (isEnglish ? `Sources (${sourceCount})` : `出典 ${sourceCount}件`)
    : (isEnglish ? 'Record details' : '記録の詳細');
  const linkState = makeDetailLinkState(location);
  const linkStyle = 'min-w-0 break-words underline-offset-2 hover:underline';

  return (
    <li className="min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 sm:gap-x-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2.5">
          {item.name === '不明' ? (
            <span className="text-sm font-semibold text-ink">{isEnglish ? 'Unknown plant' : '不明'}</span>
          ) : (
            <Link to={buildPlantPath(item.name, locale)} state={linkState} className={`${linkStyle} text-sm font-semibold text-emerald-800 dark:text-emerald-300`}>
              {label}
            </Link>
          )}
          {observationBadges(item.observation.evidence, isEnglish)}
          {item.familyKey && !item.isFamilyRecord && (
            <Link to={buildPlantPath(item.familyKey, locale)} state={linkState} className={`${linkStyle} text-xs text-ink-muted`}>
              {familyLabel}
            </Link>
          )}
          {!sharedUsage && item.usage && (
            <span className="text-xs text-ink-muted">{item.usage}</span>
          )}
        </div>
        {hasDetails && (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={sourcePanelId}
            aria-label={`${item.name}${isEnglish ? ': ' : 'の'}${sourceLabel}`}
            onClick={() => setIsOpen(!isOpen)}
            className="col-start-2 inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-1 text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            {sourceLabel}
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`h-3.5 w-3.5 ${isOpen ? 'rotate-180' : ''}`}>
              <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      {hasDetails && (
        <div id={sourcePanelId} hidden={!isOpen}>
          {isOpen && (
            <ul aria-label={sourceLabel} className="mb-2 divide-y divide-line rounded-lg border border-line bg-slate-50/70 px-3 dark:bg-slate-900/40">
              {sources.map((source) => {
                const notes = getPlantRelevantNotes(source.records)
                  .map((note) => note.replace(sourcePagePattern, '').replace(/（\s*）|\(\s*\)/g, '').trim())
                  .filter(Boolean);
                if (!source.key && notes.length === 0) return null;
                const recordPages = [...new Set(source.records.flatMap((record) =>
                  Array.from(String(record.notes || '').matchAll(sourcePagePattern), (match) => match[1])
                ))].join('、');
                const pages = recordPages || source.publicationPages;
                return (
                  <li key={source.key} className="min-w-0 space-y-1 py-2 text-xs">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words text-ink-muted">
                      {source.link ? (
                        <a href={source.link} target="_blank" rel={isAmazonAssociateUrl(source.link) ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="font-semibold text-ink underline underline-offset-2">
                          {source.label}
                        </a>
                      ) : (
                        <span className="font-medium text-ink">{source.label || (isEnglish ? 'Source unspecified' : '出典の記載なし')}</span>
                      )}
                      {source.publication && source.publication !== source.label && <span>{source.publication}</span>}
                      {pages && <span>{isEnglish ? `pp. ${pages}` : `${pages}頁`}</span>}
                      {observationBadges(groupObservationEvidence(source.records, isEnglish), isEnglish)}
                    </div>
                    {notes.map((note) => <p className="break-words text-ink-muted" key={note}>{note}</p>)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

const PlantUseList = ({ groups, kind = 'host', locale = 'ja', plantDetails = {} }) => {
  const isEnglish = isEnglishLocale(locale);
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  const style = kind === 'flower' ? FLOWER_STYLE : HOST_STYLE;
  const title = kind === 'flower'
    ? (isEnglish ? 'Adult flower visits' : '成虫の訪花')
    : (isEnglish ? 'Host plants' : '食草・食樹');

  const summary = useMemo(() => buildPlantUseSummary(groups, {
    usageLabelOf: (record) => getUsageLabel(record, isEnglish),
    observationOf: (group) => {
      const evidence = groupObservationEvidence(group.records, isEnglish);
      return {
        key: evidence.map((entry) => entry.key).sort().join('|'),
        priority: evidence[0].priority,
        evidence,
      };
    },
    notesOf: (group) => getPlantRelevantNotes(group.records),
  }), [groups, isEnglish]);

  if (summary.plantCount === 0) return null;

  const plantLabel = (name) => {
    const detail = plantDetails?.[name] || {};
    if (!isEnglish) return name;
    const primary = getPrimaryEnglishName({ scientificName: detail.scientificName, japaneseName: name, fallback: name });
    return detail.scientificName ? formatScientificNameReact(primary) : primary;
  };

  const items = summary.families.flatMap((family) => family.hasFamilyRecord
    ? [summary.items.find((item) => item.isFamilyRecord && item.familyKey === family.key), ...family.items]
    : family.items);
  const visibleItems = showAll ? items : items.slice(0, INITIAL_PLANT_LIMIT);

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
        <h3 id={headingId} className={`text-sm font-semibold ${style.headingText}`}>{title}</h3>
        <span className="text-xs tabular-nums text-ink-muted">
          {isEnglish ? `${summary.plantCount} plants` : `${summary.plantCount}件`}
        </span>
      </div>
      {summary.commonUsage && <p className="mt-1.5 text-xs text-ink-muted">{summary.commonUsage}</p>}
      <ul className="divide-y divide-line">
        {visibleItems.map((item) => (
          <PlantUseRow
            key={item.name}
            item={item}
            label={plantLabel(item.name)}
            familyLabel={plantLabel(item.familyKey)}
            sharedUsage={summary.commonUsage}
            locale={locale}
          />
        ))}
      </ul>
      {items.length > INITIAL_PLANT_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          aria-expanded={showAll}
          className={`inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 ${style.labelText}`}
        >
          {showAll ? (isEnglish ? 'Show less' : '簡略表示') : buildShowMoreLabel(items.length - visibleItems.length, isEnglish)}
        </button>
      )}
    </section>
  );
};

const HostPlantDetailCard = React.memo(({ plantGroup, locale = 'ja', plantDetails = {} }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const isResourceGroup = plantGroup.resourceType === 'substrate';
  // 「不明」は植物ページが存在しないため、リンクにしない
  // （文献記録しか無い種では全記録が「不明」のまま残ることがある）
  const isUnknownPlant = String(plantGroup.name || '').trim() === '不明';
  const evidence = groupObservationEvidence(plantGroup.records, isEnglish);
  const { presentation: obsStyle } = evidence[0];
  const isDomesticWild = obsStyle.category === 'field' && obsStyle.region === 'domestic';
  
  // 利用情報をグループ化
  const usageInfo = plantGroup.records.reduce((acc, record) => {
    const key = `${record.lifeStage || ''}|${record.plantPart || ''}`;
    if (!acc[key]) {
      acc[key] = {
        isFlowerVisit: isFlowerVisitRecord(record),
        lifeStage: record.lifeStage,
        plantPart: record.plantPart,
      };
    }
    return acc;
  }, {});
  
  const usageInfoArray = Object.values(usageInfo);
  // インライン用バッジを事前計算（上限2件 + 余剰表示）
  const badges = usageInfoArray.map((usage) => {
    const ls = usage.lifeStage ? getLifeStageIcon(usage.lifeStage) : null;
    const pp = usage.plantPart ? getPlantPartIcon(usage.plantPart) : null;
    const isFlowerVisit = usage.isFlowerVisit;
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
      {/* 基本情報行（食草名 + 科名 + 利用バッジ + 観察タイプ）。
          食草名はこの一覧の主役なので、固定幅で「…」省略せず必ず全文を出す（長ければ折り返す）。
          科名は名前の直後に続け、スマホでは利用バッジを2行目へ回して名前の幅を確保する */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="col-start-1 row-start-1 min-w-0">
          {/* flex-wrap: 科名が収まらない時は字下げなしで次の行へ送り、科名の途中では折らない */}
          <div className="flex flex-wrap items-baseline gap-x-2 leading-6">
          {isResourceGroup || isUnknownPlant ? (
            <span
              className={`min-w-0 break-words font-medium ${isDomesticWild ? 'text-emerald-700 dark:text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}
            >
              {primaryPlantName}
            </span>
          ) : (
            <Link
              to={buildPlantPath(plantGroup.name, locale)}
              state={makeDetailLinkState(location)}
              className={`min-w-0 break-words font-medium ${isDomesticWild ? 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'} underline-offset-2 hover:underline`}
              title={isEnglish ? `${primaryPlantName}${japaneseReference ? ` (${displayPlantName})` : ''}` : `${displayPlantName} の詳細へ`}
            >
              {isEnglish && plantDetail.scientificName
                ? formatScientificNameReact(primaryPlantName)
                : primaryPlantName}
            </Link>
          )}
          {!isResourceGroup && plantGroup.family && plantGroup.family !== plantGroup.name && plantGroup.family !== '不明' && (
            <Link
              to={buildPlantPath(plantGroup.family, locale)}
              state={makeDetailLinkState(location)}
              className={`min-w-0 break-words text-sm underline-offset-2 hover:underline ${isDomesticWild ? 'text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300' : 'text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-300'}`}
              title={isEnglish ? `Go to ${plantGroup.family}` : `${plantGroup.family} の詳細へ`}
            >
              {plantGroup.family}
            </Link>
          )}
          </div>
          {japaneseReference && (
            <div className="mt-0.5 break-words text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {japaneseReference}
            </div>
          )}
        </div>
        {/* 利用バッジ（極小・横並び）。スマホは2行目（2列ぶち抜き）、sm以上は名前と観察タイプの間 */}
        {shownBadges.length > 0 && (
          <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-end">
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
        {/* カード背景と同じ bgColor だとバッジが地の文に埋没するため白系の面+枠線にし、
            縦ずれ防止のため h-6 固定・行頭揃え(#63/#69)も維持する */}
        {evidence.length === 1 && (
          <span className={`col-start-2 row-start-1 justify-self-end inline-flex items-center h-6 text-xs px-2 rounded shrink-0 border ${obsStyle.borderColor} bg-white/80 dark:bg-slate-900/50 ${obsStyle.textColor} font-medium sm:col-start-3`}>
            {getObservationLabel(obsStyle, isEnglish)}
          </span>
        )}
      </div>

      {/* 出典情報（必要時のみ下段に表示） */}
      {evidence.map(({ key, presentation, records }) => {
        const references = records.map((record) => record.reference).filter(Boolean);
        const notes = getPlantRelevantNotes(records);
        if (evidence.length === 1 && references.length === 0 && notes.length === 0) return null;
        return (
          <div key={key} className="mt-2 pt-2 border-t border-emerald-200/30 dark:border-emerald-700/30 space-y-1.5">
            {evidence.length > 1 && <p className={`text-xs font-medium ${presentation.textColor}`}>{getObservationLabel(presentation, isEnglish)}</p>}
            <SourceCitation sources={references} isEnglish={isEnglish} />
            {notes.length > 0 && (
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v10a2 2 0 01-2 2z" />
                </svg>
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-medium">{isEnglish ? 'Notes:' : '備考:'}</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
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
  maxDisplayCount: _maxDisplayCount = 5,
  locale = 'ja',
  plantDetails = {},
}) => {
  const isEnglish = isEnglishLocale(locale);
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  // 詳細情報がある場合はそれを優先、なければ従来形式を使用
  let plantsToDisplay = hostPlantsDetailed && hostPlantsDetailed.length > 0 
    ? hostPlantsDetailed 
    : hostPlants.map(plant => ({
        name: typeof plant === 'string' ? plant.replace(/（.*）$/, '') : plant.name || plant,
        family: typeof plant === 'string' ? extractFamily(plant) : plant.family || '',
        displayName: typeof plant === 'string' ? plant : plant.displayName || plant.name || plant,
        observationType: '',
        plantPart: '',
        lifeStage: '',
        reference: '',
        notes: '',
        isDetailed: false
      }));

  // 「不明」植物のフィルタリング：野外食草情報がある場合は「不明」を除外
  const hasWildPlants = plantsToDisplay.some(plant => 
    plant.name && plant.name !== '不明' && 
    getObservationTypeCategory(plant.observationType) === 'field'
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
      <div className="text-sm text-slate-500 dark:text-slate-400">
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
  
  return (
    <div className="space-y-4">
      {hostGroups.length > 0 && (
        <PlantUseList groups={hostGroups} kind="host" locale={locale} plantDetails={plantDetails} />
      )}

      {flowerGroups.length > 0 && (
        <PlantUseList groups={flowerGroups} kind="flower" locale={locale} plantDetails={plantDetails} />
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
