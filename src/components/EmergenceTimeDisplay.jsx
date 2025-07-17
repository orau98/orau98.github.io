import React, { useMemo } from 'react';

// 月名と色のマッピング
const MONTHS = [
  { name: '1月', short: 'Jan', color: 'bg-blue-100 text-blue-800 border-blue-200', season: 'winter' },
  { name: '2月', short: 'Feb', color: 'bg-blue-100 text-blue-800 border-blue-200', season: 'winter' },
  { name: '3月', short: 'Mar', color: 'bg-green-100 text-green-800 border-green-200', season: 'spring' },
  { name: '4月', short: 'Apr', color: 'bg-green-100 text-green-800 border-green-200', season: 'spring' },
  { name: '5月', short: 'May', color: 'bg-green-100 text-green-800 border-green-200', season: 'spring' },
  { name: '6月', short: 'Jun', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', season: 'summer' },
  { name: '7月', short: 'Jul', color: 'bg-red-100 text-red-800 border-red-200', season: 'summer' },
  { name: '8月', short: 'Aug', color: 'bg-red-100 text-red-800 border-red-200', season: 'summer' },
  { name: '9月', short: 'Sep', color: 'bg-orange-100 text-orange-800 border-orange-200', season: 'autumn' },
  { name: '10月', short: 'Oct', color: 'bg-orange-100 text-orange-800 border-orange-200', season: 'autumn' },
  { name: '11月', short: 'Nov', color: 'bg-amber-100 text-amber-800 border-amber-200', season: 'autumn' },
  { name: '12月', short: 'Dec', color: 'bg-blue-100 text-blue-800 border-blue-200', season: 'winter' }
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

// 成虫発生時期を解析する関数
const parseEmergenceTime = (emergenceTime) => {
  if (!emergenceTime || emergenceTime === '不明') return [];
  
  const activeMonths = new Set();
  
  // 月の漢数字を数字に変換
  const kanjiToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
    '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12
  };
  
  // 数字の月（1月、2月など）を検出
  const numberMonthPattern = /(\d{1,2})月/g;
  let match;
  while ((match = numberMonthPattern.exec(emergenceTime)) !== null) {
    const month = parseInt(match[1]);
    if (month >= 1 && month <= 12) {
      activeMonths.add(month);
    }
  }
  
  // 漢数字の月を検出
  Object.entries(kanjiToNumber).forEach(([kanji, number]) => {
    if (emergenceTime.includes(`${kanji}月`)) {
      activeMonths.add(number);
    }
  });
  
  // 範囲指定（例：5～8月、3月～10月）を検出
  const rangePattern = /(\d{1,2})月?[～〜-](\d{1,2})月/g;
  while ((match = rangePattern.exec(emergenceTime)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    
    if (start <= end) {
      for (let i = start; i <= end; i++) {
        activeMonths.add(i);
      }
    } else {
      // 年をまたぐ場合（例：10～3月）
      for (let i = start; i <= 12; i++) {
        activeMonths.add(i);
      }
      for (let i = 1; i <= end; i++) {
        activeMonths.add(i);
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
      months.forEach(month => activeMonths.add(month));
    }
  });
  
  return Array.from(activeMonths).sort((a, b) => a - b);
};

const EmergenceTimeDisplay = ({ emergenceTime, compact = false }) => {
  const activeMonths = useMemo(() => parseEmergenceTime(emergenceTime), [emergenceTime]);
  
  if (!emergenceTime || emergenceTime === '不明' || activeMonths.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">発生時期不明</span>
      </div>
    );
  }
  
  if (compact) {
    // コンパクト表示：アクティブな月のみ表示
    return (
      <div className="flex flex-wrap gap-1">
        {activeMonths.map(monthIndex => {
          const month = MONTHS[monthIndex - 1];
          return (
            <span
              key={monthIndex}
              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${month.color}`}
            >
              <SeasonIcon season={month.season} className="w-3 h-3 mr-1" />
              {month.short}
            </span>
          );
        })}
      </div>
    );
  }
  
  // フル表示：全月表示でアクティブ月をハイライト
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-3">
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          成虫発生時期
        </h4>
      </div>
      
      {/* 原文表示 */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          {emergenceTime}
        </p>
      </div>
      
      {/* 月別カレンダー表示 */}
      <div className="grid grid-cols-12 gap-1 sm:gap-2">
        {MONTHS.map((month, index) => {
          const monthNumber = index + 1;
          const isActive = activeMonths.includes(monthNumber);
          
          return (
            <div
              key={monthNumber}
              className={`
                relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg border transition-all duration-200
                ${isActive 
                  ? `${month.color} shadow-sm transform scale-105 ring-2 ring-offset-1 ring-opacity-50` 
                  : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                }
              `}
            >
              {isActive && (
                <div className="absolute -top-1 -right-1">
                  <SeasonIcon season={month.season} className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
              )}
              
              <span className="text-xs sm:text-sm font-bold">
                {monthNumber}
              </span>
              <span className="text-[10px] sm:text-xs mt-1">
                {month.name}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* 活動ピーク表示 */}
      {activeMonths.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700/50">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                活動期間
              </h5>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {activeMonths.length === 12 ? '通年' : 
                 activeMonths.length >= 6 ? '長期間活動' :
                 activeMonths.length >= 3 ? '複数月活動' : '短期間活動'
                } 
                （{activeMonths.length}ヶ月間）
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {activeMonths.map(monthIndex => {
                  const month = MONTHS[monthIndex - 1];
                  return (
                    <span
                      key={monthIndex}
                      className={`inline-flex items-center px-2 py-1 text-xs rounded-md border ${month.color}`}
                    >
                      {month.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergenceTimeDisplay;