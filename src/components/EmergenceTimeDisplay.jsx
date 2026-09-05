import { useMemo } from 'react';
import { parseEmergenceTime, shouldAnalyzeEmergenceHint } from '../utils/emergenceTime.js';
import SourceCitation from './ui/SourceCitation';
import { isEnglishLocale } from '../utils/locale';

// 月名と色のマッピング - 薄い色で統一
const MONTHS = [
  { name: '1月', short: 'Jan', number: 1, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'winter' },
  { name: '2月', short: 'Feb', number: 2, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'winter' },
  { name: '3月', short: 'Mar', number: 3, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'spring' },
  { name: '4月', short: 'Apr', number: 4, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'spring' },
  { name: '5月', short: 'May', number: 5, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'spring' },
  { name: '6月', short: 'Jun', number: 6, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'summer' },
  { name: '7月', short: 'Jul', number: 7, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'summer' },
  { name: '8月', short: 'Aug', number: 8, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'summer' },
  { name: '9月', short: 'Sep', number: 9, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'autumn' },
  { name: '10月', short: 'Oct', number: 10, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'autumn' },
  { name: '11月', short: 'Nov', number: 11, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'autumn' },
  { name: '12月', short: 'Dec', number: 12, color: 'bg-orange-300', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'winter' }
];

// Date parsing is shared with list cards and independently tested.

const EmergenceTimeDisplay = ({ emergenceTime, source, compact = false, supplementalTexts = [], originalText = '', locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const getPeriodLabel = (periodNum) => {
    if (!isEnglish) return periodNum === 1 ? '上旬' : periodNum === 2 ? '中旬' : '下旬';
    return periodNum === 1 ? 'early' : periodNum === 2 ? 'mid' : 'late';
  };
  const getMonthLabel = (month, mode = 'full') => {
    if (!month) return '';
    if (!isEnglish) {
      if (mode === 'header') return `${month.number}月`;
      return month.name;
    }
    return mode === 'header' ? month.short : month.short;
  };
  const emergenceData = useMemo(
    () => parseEmergenceTime(emergenceTime, supplementalTexts),
    [emergenceTime, supplementalTexts]
  );
  const activeMonths = emergenceData.months;
  const activePeriods = emergenceData.periods;
  const fuzzyMonths = emergenceData.fuzzyMonths || [];
  const fuzzyPeriods = emergenceData.fuzzyPeriods || [];
  const displayText = useMemo(() => {
    const primary = String(emergenceTime || '').trim();
    if (primary && primary !== '不明') return primary;
    const emergenceHintText = (supplementalTexts || [])
      .map((text) => String(text || '').trim())
      .find((text) => shouldAnalyzeEmergenceHint(text));
    return emergenceHintText || (supplementalTexts || []).map((text) => String(text || '').trim()).find(Boolean) || '';
  }, [emergenceTime, supplementalTexts]);
  const originalDisplayText = useMemo(() => {
    const original = String(originalText || '').trim();
    if (!original || original === '不明' || original === displayText) return '';
    return original;
  }, [displayText, originalText]);
  
  if ((!displayText || displayText === '不明') && activeMonths.length === 0 && fuzzyMonths.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">{isEnglish ? 'Season unknown' : '時期不明'}</span>
      </div>
    );
  }
  
  if (compact) {
    // 月データを1つも導出できない場合は空のバーを出さない
    // （一覧カードで「壊れた真っ白のバー」に見えてしまうため）
    if (activePeriods.length === 0 && fuzzyPeriods.length === 0) {
      return null;
    }
    // コンパクト表示：スマートで洗練されたタイムライン
    return (
      <div className="space-y-2">
        <div className="mb-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
        </div>
        <div className="relative">
          {/* 背景のタイムライン（旬単位） */}
          <div className="flex h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
            {MONTHS.map((month) => (
              <div key={month.number} className="flex-1 flex">
                {[1, 2, 3].map((periodNum) => {
                  const periodValue = month.number + periodNum * 0.1;
                  const isActive = activePeriods.some(p => Math.abs(p - periodValue) < 0.05);
                  const isFuzzy = !isActive && fuzzyPeriods.some(p => Math.abs(p - periodValue) < 0.05);
                  const periodName = getPeriodLabel(periodNum);
                  
                  const dividerClass = periodNum < 3 ? 'border-r border-white/30 dark:border-slate-600/50' : '';
                  
                  return (
                    <div
                      key={periodNum}
                      className={`
                        flex-1 
                        ${isActive ? month.color : isFuzzy ? 'bg-gradient-to-b from-orange-200/80 to-orange-50/15 ring-1 ring-inset ring-orange-200/70 dark:from-orange-300/60 dark:to-orange-200/15 dark:ring-orange-300/60' : 'bg-transparent'}
                        transition-all duration-200
                        ${dividerClass}
                      `}
                      title={`${getMonthLabel(month)} ${periodName}${isActive ? (isEnglish ? ' (adult season)' : ' (発生期)') : isFuzzy ? (isEnglish ? ' (broad seasonal note)' : ' (月幅のある記述)') : ''}`}
                    >
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          
          {/* 月のラベル */}
          <div className="flex justify-between mt-1.5 px-0.5">
            {[1, 3, 6, 9, 12].map(monthNum => (
              <span key={monthNum} className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {getMonthLabel(MONTHS[monthNum - 1], 'header')}
              </span>
            ))}
          </div>
        </div>
        
        {/* 出典情報 */}
        {source && (
          <div className="mt-4 pt-4 border-t border-line">
            <SourceCitation sources={source} isEnglish={isEnglish} />
          </div>
        )}
      </div>
    );
  }
  
  // フル表示：一覧カードのコンパクト表示と同じデザイン言語
  // （連続した1本のバー＋旬セル＋下側の月ラベル）を、詳細ページ向けに拡大したもの。
  // 旧デザインは月ごとの箱に白い縦スリットが並ぶ櫛状で、未発生月まで視覚的に
  // 主張してしまい期間が読み取りにくかった。
  return (
    <div className="space-y-4">
      <div>
        {/* タイムライン（旬単位・連続バー） */}
        <div className="flex h-7 overflow-hidden rounded-full border border-slate-200 bg-slate-100 sm:h-8 dark:border-slate-600 dark:bg-slate-700">
          {MONTHS.map((month, monthIndex) => (
            <div
              key={month.number}
              className={`flex flex-1 ${monthIndex > 0 ? 'border-l border-white/60 dark:border-slate-500/60' : ''}`}
            >
              {[1, 2, 3].map((periodNum) => {
                const periodValue = month.number + periodNum * 0.1;
                const isActive = activePeriods.some(p => Math.abs(p - periodValue) < 0.05);
                const isFuzzy = !isActive && fuzzyPeriods.some(p => Math.abs(p - periodValue) < 0.05);
                const periodName = getPeriodLabel(periodNum);
                const dividerClass = periodNum < 3 ? 'border-r border-white/30 dark:border-slate-600/50' : '';

                return (
                  <div
                    key={periodNum}
                    className={`
                      flex-1
                      ${isActive ? month.color : isFuzzy ? 'bg-gradient-to-b from-orange-200/80 to-orange-50/15 ring-1 ring-inset ring-orange-200/70 dark:from-orange-300/60 dark:to-orange-200/15 dark:ring-orange-300/60' : 'bg-transparent'}
                      transition-all duration-200
                      ${dividerClass}
                    `}
                    title={`${getMonthLabel(month)} ${periodName}${isActive ? (isEnglish ? ' (adult season)' : ' (発生期)') : isFuzzy ? (isEnglish ? ' (broad seasonal note)' : ' (月幅のある記述)') : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* 月ラベル（全12・バーの月区画と揃う。モバイルは数字のみ） */}
        <div className="mt-1.5 grid grid-cols-12 px-0.5 text-center">
          {MONTHS.map((month) => (
            <span key={month.number} className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">{getMonthLabel(month, 'header')}</span>
              <span className="sm:hidden">{month.number}</span>
            </span>
          ))}
        </div>

        {/* 凡例（ツールチップはタッチ端末で見えないため常時表示する） */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm bg-orange-300" aria-hidden="true" />
            {isEnglish ? 'Adult season' : '発生期'}
          </span>
          {fuzzyPeriods.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-gradient-to-b from-orange-200/80 to-orange-50/15 ring-1 ring-inset ring-orange-300/70 dark:from-orange-300/60 dark:to-orange-200/15 dark:ring-orange-300/60" aria-hidden="true" />
              {isEnglish ? 'Broad seasonal note (e.g. "spring")' : '幅のある記述（「春」など）'}
            </span>
          )}
        </div>
      </div>
      {/* 原文表示 - 食草セクションと同じ構造で色違い */}
      <div>
        <div className="bg-surface-raised rounded-card p-3 border border-line">
          <div className="flex items-center space-x-3">
            <span className="font-medium text-ink">
              {displayText}
            </span>
          </div>
          {originalDisplayText && (
            <div className="mt-2 text-sm text-ink-muted">
              <span className="font-medium">{isEnglish ? 'Original:' : '原文:'}</span> {originalDisplayText}
            </div>
          )}
        </div>
        {source && (
          <div className="mt-4 pt-4 border-t border-line">
            <SourceCitation sources={source} isEnglish={isEnglish} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergenceTimeDisplay;
