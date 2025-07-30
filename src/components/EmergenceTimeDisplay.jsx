import React, { useMemo } from 'react';

// 月名と色のマッピング
const MONTHS = [
  { name: '1月', short: 'Jan', number: 1, color: 'bg-blue-500', lightColor: 'bg-blue-100', textColor: 'text-blue-700', season: 'winter' },
  { name: '2月', short: 'Feb', number: 2, color: 'bg-blue-500', lightColor: 'bg-blue-100', textColor: 'text-blue-700', season: 'winter' },
  { name: '3月', short: 'Mar', number: 3, color: 'bg-green-500', lightColor: 'bg-green-100', textColor: 'text-green-700', season: 'spring' },
  { name: '4月', short: 'Apr', number: 4, color: 'bg-green-500', lightColor: 'bg-green-100', textColor: 'text-green-700', season: 'spring' },
  { name: '5月', short: 'May', number: 5, color: 'bg-green-500', lightColor: 'bg-green-100', textColor: 'text-green-700', season: 'spring' },
  { name: '6月', short: 'Jun', number: 6, color: 'bg-yellow-500', lightColor: 'bg-yellow-100', textColor: 'text-yellow-700', season: 'summer' },
  { name: '7月', short: 'Jul', number: 7, color: 'bg-red-500', lightColor: 'bg-red-100', textColor: 'text-red-700', season: 'summer' },
  { name: '8月', short: 'Aug', number: 8, color: 'bg-red-500', lightColor: 'bg-red-100', textColor: 'text-red-700', season: 'summer' },
  { name: '9月', short: 'Sep', number: 9, color: 'bg-orange-500', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'autumn' },
  { name: '10月', short: 'Oct', number: 10, color: 'bg-orange-500', lightColor: 'bg-orange-100', textColor: 'text-orange-700', season: 'autumn' },
  { name: '11月', short: 'Nov', number: 11, color: 'bg-amber-500', lightColor: 'bg-amber-100', textColor: 'text-amber-700', season: 'autumn' },
  { name: '12月', short: 'Dec', number: 12, color: 'bg-blue-500', lightColor: 'bg-blue-100', textColor: 'text-blue-700', season: 'winter' }
];

// 季節アイコン
const SeasonIcon = ({ season, className = "w-4 h-4" }) => {
  const icons = {
    spring: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L13.5 2.5L16.17 5.17C15.24 5.06 14.32 5 13.38 5C10.38 5 7.5 6.5 6 9C7.5 11.5 10.38 13 13.38 13C14.32 13 15.24 12.94 16.17 12.83L13.5 15.5L15 17L21 11V9ZM12.5 7.5C12.5 8.33 11.83 9 11 9S9.5 8.33 9.5 7.5S10.17 6 11 6S12.5 6.67 12.5 7.5Z"/>
      </svg>
    ),
    summer: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18M20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31L23.31,12L20,8.69Z"/>
      </svg>
    ),
    autumn: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
      </svg>
    ),
    winter: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,11L14,8.5L16.5,11L18,9.5L15.5,7L18,4.5L16.5,3L14,5.5L12,3L10,5.5L7.5,3L6,4.5L8.5,7L6,9.5L7.5,11L10,8.5L12,11M12,13L10,15.5L7.5,13L6,14.5L8.5,17L6,19.5L7.5,21L10,18.5L12,21L14,18.5L16.5,21L18,19.5L15.5,17L18,14.5L16.5,13L14,15.5L12,13Z"/>
      </svg>
    )
  };
  
  return icons[season] || null;
};

// 成虫発生時期を解析する関数（旬単位対応）
const parseEmergenceTime = (emergenceTime) => {
  if (!emergenceTime || emergenceTime === '不明') return { months: [], periods: [] };
  
  // Debug log for specific species
  const isDebugSpecies = emergenceTime.includes('3月');
  if (isDebugSpecies) {
    console.log('DEBUG: parseEmergenceTime input:', emergenceTime);
  }
  
  const activeMonths = new Set();
  const activePeriods = new Set(); // 月.旬の形式 (例: 3.1 = 3月上旬, 3.2 = 3月中旬, 3.3 = 3月下旬)
  
  // 月の漢数字を数字に変換
  const kanjiToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
    '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12
  };
  
  // 旬単位のパターンを検出（例：3月上旬、4月中旬、5月下旬）
  const periodPattern = /(\d{1,2})月(上旬|中旬|下旬)/g;
  let match;
  while ((match = periodPattern.exec(emergenceTime)) !== null) {
    const month = parseInt(match[1]);
    const period = match[2];
    if (month >= 1 && month <= 12) {
      activeMonths.add(month);
      const periodNum = period === '上旬' ? 1 : period === '中旬' ? 2 : 3;
      activePeriods.add(month + periodNum * 0.1);
    }
  }

  // 同月内の旬範囲指定を検出（例：3月上旬~下旬）
  const sameMonthRangePattern = /(\d{1,2})月(上旬|中旬|下旬)[～〜~-](上旬|中旬|下旬)/g;
  while ((match = sameMonthRangePattern.exec(emergenceTime)) !== null) {
    const month = parseInt(match[1]);
    const startPeriod = match[2];
    const endPeriod = match[3];
    
    if (month >= 1 && month <= 12) {
      activeMonths.add(month);
      const startPeriodNum = startPeriod === '上旬' ? 1 : startPeriod === '中旬' ? 2 : 3;
      const endPeriodNum = endPeriod === '上旬' ? 1 : endPeriod === '中旬' ? 2 : 3;
      
      for (let p = startPeriodNum; p <= endPeriodNum; p++) {
        activePeriods.add(month + p * 0.1);
      }
    }
  }

  // 旬範囲指定を検出（例：2月下旬~4月上旬）
  const periodRangePattern = /(\d{1,2})月(上旬|中旬|下旬)[～〜~-](\d{1,2})月(上旬|中旬|下旬)/g;
  while ((match = periodRangePattern.exec(emergenceTime)) !== null) {
    const startMonth = parseInt(match[1]);
    const startPeriod = match[2];
    const endMonth = parseInt(match[3]);
    const endPeriod = match[4];
    
    const startPeriodNum = startPeriod === '上旬' ? 1 : startPeriod === '中旬' ? 2 : 3;
    const endPeriodNum = endPeriod === '上旬' ? 1 : endPeriod === '中旬' ? 2 : 3;
    
    const startValue = startMonth + startPeriodNum * 0.1;
    const endValue = endMonth + endPeriodNum * 0.1;
    
    // 同じ月内の場合
    if (startMonth === endMonth) {
      activeMonths.add(startMonth);
      for (let p = startPeriodNum; p <= endPeriodNum; p++) {
        activePeriods.add(startMonth + p * 0.1);
      }
    } else {
      // 複数月にまたがる場合
      for (let m = startMonth; m <= endMonth; m++) {
        if (m > 12) break;
        activeMonths.add(m);
        
        if (m === startMonth) {
          // 開始月：開始旬から月末まで
          for (let p = startPeriodNum; p <= 3; p++) {
            activePeriods.add(m + p * 0.1);
          }
        } else if (m === endMonth) {
          // 終了月：月初から終了旬まで
          for (let p = 1; p <= endPeriodNum; p++) {
            activePeriods.add(m + p * 0.1);
          }
        } else {
          // 中間月：全旬
          for (let p = 1; p <= 3; p++) {
            activePeriods.add(m + p * 0.1);
          }
        }
      }
      
      // 年をまたぐ場合の処理
      if (startMonth > endMonth) {
        // 12月まで
        for (let m = startMonth; m <= 12; m++) {
          activeMonths.add(m);
          if (m === startMonth) {
            for (let p = startPeriodNum; p <= 3; p++) {
              activePeriods.add(m + p * 0.1);
            }
          } else {
            for (let p = 1; p <= 3; p++) {
              activePeriods.add(m + p * 0.1);
            }
          }
        }
        // 1月から終了月まで
        for (let m = 1; m <= endMonth; m++) {
          activeMonths.add(m);
          if (m === endMonth) {
            for (let p = 1; p <= endPeriodNum; p++) {
              activePeriods.add(m + p * 0.1);
            }
          } else {
            for (let p = 1; p <= 3; p++) {
              activePeriods.add(m + p * 0.1);
            }
          }
        }
      }
    }
  }

  // 数字の月（1月、2月など）を検出（旬指定がない場合）
  const numberMonthPattern = /(\d{1,2})月(?![上中下])/g;
  while ((match = numberMonthPattern.exec(emergenceTime)) !== null) {
    const month = parseInt(match[1]);
    if (month >= 1 && month <= 12) {
      activeMonths.add(month);
      // 旬指定がない場合は全旬を対象とする
      for (let p = 1; p <= 3; p++) {
        activePeriods.add(month + p * 0.1);
      }
    }
  }
  
  // 漢数字の月を検出
  Object.entries(kanjiToNumber).forEach(([kanji, number]) => {
    if (emergenceTime.includes(`${kanji}月`)) {
      activeMonths.add(number);
      // 全旬を追加
      for (let p = 1; p <= 3; p++) {
        activePeriods.add(number + p * 0.1);
      }
    }
  });
  
  // 範囲指定（例：5～8月、3月～10月）を検出 - ASCII チルダ (~) も含む（旬指定なし）
  const rangePattern = /(\d{1,2})月?[～〜~-](\d{1,2})月(?![上中下])/g;
  while ((match = rangePattern.exec(emergenceTime)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    
    if (start <= end) {
      for (let i = start; i <= end; i++) {
        activeMonths.add(i);
        // 全旬を追加
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    } else {
      // 年をまたぐ場合（例：10～3月）
      for (let i = start; i <= 12; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
      for (let i = 1; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    }
  }
  
  // 「X月頃羽化し、Y月頃まで」「X月頃発生し、Y月頃まで」パターンを検出
  const hatchingToPattern = /(\d{1,2})月頃(?:羽化|発生)し?、?(?:.*?)?(\d{1,2})月頃まで/g;
  while ((match = hatchingToPattern.exec(emergenceTime)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    
    if (start <= end) {
      for (let i = start; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    } else {
      // 年をまたぐ場合（例：11月頃羽化し、1月頃まで）
      for (let i = start; i <= 12; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
      for (let i = 1; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    }
  }
  
  // 「X月〜Y月」「X月からY月」パターンを検出 - ASCII チルダ (~) も含む
  const fromToPattern = /(\d{1,2})月(?:から|より)?[〜～~-](\d{1,2})月(?![頃上中下])/g;
  while ((match = fromToPattern.exec(emergenceTime)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    
    if (start <= end) {
      for (let i = start; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    } else {
      // 年をまたぐ場合
      for (let i = start; i <= 12; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
      for (let i = 1; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    }
  }
  
  // 「X月頃〜Y月頃」パターンを検出 - ASCII チルダ (~) も含む
  const approximateRangePattern = /(\d{1,2})月頃[〜～~-](\d{1,2})月頃/g;
  while ((match = approximateRangePattern.exec(emergenceTime)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    
    if (start <= end) {
      for (let i = start; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    } else {
      // 年をまたぐ場合
      for (let i = start; i <= 12; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
      for (let i = 1; i <= end; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    }
  }
  
  // 「X月頃発生」「X月頃出現」パターンを検出
  const approximateMonthPattern = /(\d{1,2})月頃(?:発生|出現|羽化)/g;
  while ((match = approximateMonthPattern.exec(emergenceTime)) !== null) {
    const month = parseInt(match[1]);
    if (month >= 1 && month <= 12) {
      activeMonths.add(month);
      for (let p = 1; p <= 3; p++) {
        activePeriods.add(month + p * 0.1);
      }
    }
  }
  
  // 季節表現を月に変換
  const seasonMap = {
    '春': [3, 4, 5],
    '夏': [6, 7, 8],
    '秋': [9, 10, 11],
    '冬': [12, 1, 2],
    '初春': [2, 3],
    '晩春': [4, 5],
    '初夏': [5, 6],
    '盛夏': [7, 8],
    '晩夏': [8, 9],
    '初秋': [9, 10],
    '晩秋': [10, 11],
    '初冬': [11, 12],
    '真冬': [12, 1, 2]
  };
  
  Object.entries(seasonMap).forEach(([season, months]) => {
    if (emergenceTime.includes(season)) {
      months.forEach(month => {
        activeMonths.add(month);
        // 全旬を追加
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(month + p * 0.1);
        }
      });
    }
  });
  
  // Debug log for specific species
  if (isDebugSpecies) {
    console.log('DEBUG: parseEmergenceTime result:', {
      activeMonths: Array.from(activeMonths).sort((a, b) => a - b),
      activePeriods: Array.from(activePeriods).sort((a, b) => a - b)
    });
  }
  
  return {
    months: Array.from(activeMonths).sort((a, b) => a - b),
    periods: Array.from(activePeriods).sort((a, b) => a - b)
  };
};

// 連続する月の期間を取得する関数
const getActiveRanges = (activeMonths) => {
  if (activeMonths.length === 0) return [];
  
  const ranges = [];
  let currentRange = { start: activeMonths[0], end: activeMonths[0] };
  
  for (let i = 1; i < activeMonths.length; i++) {
    const currentMonth = activeMonths[i];
    const prevMonth = activeMonths[i - 1];
    
    // 連続する月かチェック（年をまたぐ場合も考慮）
    const isConsecutive = currentMonth === prevMonth + 1 || 
                         (prevMonth === 12 && currentMonth === 1);
    
    if (isConsecutive) {
      currentRange.end = currentMonth;
    } else {
      ranges.push({ ...currentRange });
      currentRange = { start: currentMonth, end: currentMonth };
    }
  }
  
  ranges.push(currentRange);
  return ranges;
};

const EmergenceTimeDisplay = ({ emergenceTime, source, compact = false }) => {
  const emergenceData = useMemo(() => parseEmergenceTime(emergenceTime), [emergenceTime]);
  const activeMonths = emergenceData.months;
  const activePeriods = emergenceData.periods;
  const activeRanges = useMemo(() => getActiveRanges(activeMonths), [activeMonths]);
  
  if (!emergenceTime || emergenceTime === '不明' || activeMonths.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">時期不明</span>
      </div>
    );
  }
  
  if (compact) {
    // コンパクト表示：スマートで洗練されたタイムライン
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          発生時期{source && <span className="font-normal text-slate-500"> ({source})</span>}
        </div>
        <div className="relative">
          {/* 背景のタイムライン（旬単位） */}
          <div className="flex h-4 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden shadow-inner">
            {MONTHS.map((month) => (
              <div key={month.number} className="flex-1 flex">
                {[1, 2, 3].map((periodNum) => {
                  const periodValue = month.number + periodNum * 0.1;
                  const isActive = activePeriods.some(p => Math.abs(p - periodValue) < 0.05);
                  const periodName = periodNum === 1 ? '上旬' : periodNum === 2 ? '中旬' : '下旬';
                  
                  // スマートな視覚効果（コンパクト版）
                  const periodIntensity = periodNum === 1 ? 'opacity-80' : periodNum === 2 ? 'opacity-90' : 'opacity-100';
                  const dividerClass = periodNum < 3 ? 'border-r border-white/20 dark:border-slate-800/30' : '';
                  
                  return (
                    <div
                      key={periodNum}
                      className={`
                        flex-1 
                        ${isActive ? `${month.color} ${periodIntensity} shadow-sm` : 'bg-transparent'} 
                        transition-all duration-300 hover:opacity-100
                        ${dividerClass}
                        relative overflow-hidden
                      `}
                      title={`${month.name}${periodName} ${isActive ? '(発生期)' : ''}`}
                    >
                      {isActive && (
                        <>
                          {/* 微妙なグラデーション効果 */}
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                          {/* 期間識別ライン */}
                          <div 
                            className={`
                              absolute left-0 top-0 bottom-0 w-px
                              ${periodNum === 1 ? 'bg-white/40' : periodNum === 2 ? 'bg-white/25' : 'bg-white/35'}
                            `} 
                          />
                        </>
                      )}
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
                {monthNum}月
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // フル表示：ガントチャート風デザイン
  return (
    <div className="space-y-4">
      
      {/* 精密ガントチャート風タイムライン */}
      <div className="space-y-3">
        {/* 月のヘッダー */}
        <div className="grid grid-cols-12 gap-1 text-center">
          {MONTHS.map((month) => (
            <div key={month.number} className="text-xs font-medium text-slate-600 dark:text-slate-400">
              <div className="flex flex-col items-center">
                <span className="hidden sm:block">{month.number}月</span>
                <span className="sm:hidden">{month.number}</span>
              </div>
            </div>
          ))}
        </div>
        
        
        {/* メインタイムライン（旬単位） */}
        <div className="relative bg-white/50 dark:bg-slate-900/50 rounded-xl p-2 shadow-inner border border-slate-200/50 dark:border-slate-700/50">
          {/* 背景グリッド */}
          <div className="grid grid-cols-12 gap-1 h-10">
            {MONTHS.map((month) => (
              <div key={month.number} className="grid grid-cols-3 gap-px bg-slate-100/80 dark:bg-slate-800/80 rounded-md p-px shadow-sm">
                {[1, 2, 3].map((periodNum) => {
                  // 期間による微妙な背景色の差異
                  const bgVariation = periodNum === 1 ? 'bg-slate-50 dark:bg-slate-800' : 
                                     periodNum === 2 ? 'bg-slate-100 dark:bg-slate-700' : 
                                     'bg-slate-200 dark:bg-slate-600';
                  return (
                    <div
                      key={periodNum}
                      className={`${bgVariation} rounded-sm border border-slate-200/30 dark:border-slate-600/30 transition-colors duration-200`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          
          {/* アクティブ期間のバー（旬単位） */}
          <div className="absolute inset-2 grid grid-cols-12 gap-1">
            {MONTHS.map((month) => (
              <div key={month.number} className="grid grid-cols-3 gap-px p-px">
                {[1, 2, 3].map((periodNum) => {
                  const periodValue = month.number + periodNum * 0.1;
                  const isActive = activePeriods.some(p => Math.abs(p - periodValue) < 0.05);
                  const periodName = periodNum === 1 ? '上旬' : periodNum === 2 ? '中旬' : '下旬';
                  
                  if (!isActive) return <div key={periodNum} />;
                  
                  // スマートな視覚効果：期間による微妙な差異
                  const periodIntensity = periodNum === 1 ? 'opacity-85' : periodNum === 2 ? 'opacity-95' : 'opacity-100';
                  const periodPattern = periodNum === 1 ? 'bg-gradient-to-r from-white/15 to-transparent' : 
                                       periodNum === 2 ? 'bg-gradient-to-b from-white/10 to-transparent' : 
                                       'bg-gradient-to-br from-white/20 via-transparent to-white/5';
                  
                  return (
                    <div
                      key={periodNum}
                      className={`
                        ${month.color} 
                        ${periodIntensity}
                        rounded-sm 
                        shadow-sm 
                        border 
                        border-white/30 
                        dark:border-slate-800/50 
                        transition-all 
                        duration-300 
                        hover:scale-110 
                        hover:shadow-lg
                        hover:opacity-100
                        hover:border-white/60
                        relative
                        overflow-hidden
                        min-h-[32px]
                        cursor-pointer
                        group
                      `}
                      title={`${month.name}${periodName} - 成虫発生期`}
                    >
                      {/* スマートな背景パターン */}
                      <div className={`absolute inset-0 ${periodPattern}`} />
                      
                      {/* アクティブ時の微妙な脈動効果 */}
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                      
                      {/* 精密な光沢効果 */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent" />
                      
                      {/* 期間インジケーター（左端の微妙なライン） */}
                      <div 
                        className={`
                          absolute left-0 top-0 bottom-0 w-0.5 
                          ${periodNum === 1 ? 'bg-white/40' : periodNum === 2 ? 'bg-white/30' : 'bg-white/50'}
                        `} 
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        
      </div>
      
      {/* 原文表示 */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0 w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full mt-1.5 shadow-sm"></div>
          <div className="flex-1">
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {emergenceTime}
            </p>
            {source && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                📚 出典: {source}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergenceTimeDisplay;