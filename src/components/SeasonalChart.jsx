import React, { useMemo } from 'react';

// 月の情報
const MONTHS = [
  { name: '1月', short: 'Jan', season: 'winter', temp: 5 },
  { name: '2月', short: 'Feb', season: 'winter', temp: 6 },
  { name: '3月', short: 'Mar', season: 'spring', temp: 10 },
  { name: '4月', short: 'Apr', season: 'spring', temp: 16 },
  { name: '5月', short: 'May', season: 'spring', temp: 21 },
  { name: '6月', short: 'Jun', season: 'summer', temp: 25 },
  { name: '7月', short: 'Jul', season: 'summer', temp: 28 },
  { name: '8月', short: 'Aug', season: 'summer', temp: 29 },
  { name: '9月', short: 'Sep', season: 'autumn', temp: 25 },
  { name: '10月', short: 'Oct', season: 'autumn', temp: 19 },
  { name: '11月', short: 'Nov', season: 'autumn', temp: 13 },
  { name: '12月', short: 'Dec', season: 'winter', temp: 7 }
];

// 季節の色
const seasonColors = {
  spring: 'rgb(34, 197, 94)',   // green-500
  summer: 'rgb(239, 68, 68)',   // red-500
  autumn: 'rgb(245, 158, 11)',  // amber-500
  winter: 'rgb(59, 130, 246)'   // blue-500
};

// 成虫発生時期を解析する関数（EmergenceTimeDisplayと同じ）
const parseEmergenceTime = (emergenceTime) => {
  if (!emergenceTime || emergenceTime === '不明') return [];
  
  const activeMonths = new Set();
  
  // 数字の月（1月、2月など）を検出
  const numberMonthPattern = /(\d{1,2})月/g;
  let match;
  while ((match = numberMonthPattern.exec(emergenceTime)) !== null) {
    const month = parseInt(match[1]);
    if (month >= 1 && month <= 12) {
      activeMonths.add(month);
    }
  }
  
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
      // 年をまたぐ場合
      for (let i = start; i <= 12; i++) {
        activeMonths.add(i);
      }
      for (let i = 1; i <= end; i++) {
        activeMonths.add(i);
      }
    }
  }
  
  return Array.from(activeMonths).sort((a, b) => a - b);
};

const SeasonalChart = ({ emergenceTime, className = "" }) => {
  const activeMonths = useMemo(() => parseEmergenceTime(emergenceTime), [emergenceTime]);
  
  if (!emergenceTime || emergenceTime === '不明' || activeMonths.length === 0) {
    return null;
  }
  
  // SVGの設定
  const width = 320;
  const height = 200;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 70;
  
  // 月の角度を計算（12時の位置から開始）
  const getAngle = (monthIndex) => (monthIndex * 30 - 90) * (Math.PI / 180);
  
  // 極座標から直交座標への変換
  const getPosition = (monthIndex, r = radius) => ({
    x: centerX + r * Math.cos(getAngle(monthIndex)),
    y: centerY + r * Math.sin(getAngle(monthIndex))
  });
  
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          年間活動パターン
        </h4>
      </div>
      
      <div className="flex justify-center">
        <svg width={width} height={height} className="overflow-visible">
          {/* 背景の円 */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius + 10}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-slate-200 dark:text-slate-600"
            opacity="0.3"
          />
          
          {/* 季節の背景セクター */}
          {[
            { season: 'winter', months: [11, 0, 1], color: seasonColors.winter },
            { season: 'spring', months: [2, 3, 4], color: seasonColors.spring },
            { season: 'summer', months: [5, 6, 7], color: seasonColors.summer },
            { season: 'autumn', months: [8, 9, 10], color: seasonColors.autumn }
          ].map(({ season, months, color }) => {
            const startAngle = getAngle(months[0]);
            const endAngle = getAngle(months[2] + 1);
            const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
            
            const startPoint = getPosition(months[0], radius + 25);
            const endPoint = getPosition(months[2] + 1, radius + 25);
            
            return (
              <path
                key={season}
                d={`M ${centerX} ${centerY} L ${startPoint.x} ${startPoint.y} A ${radius + 25} ${radius + 25} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y} Z`}
                fill={color}
                opacity="0.1"
              />
            );
          })}
          
          {/* 月の表示 */}
          {MONTHS.map((month, index) => {
            const monthNumber = index + 1;
            const isActive = activeMonths.includes(monthNumber);
            const position = getPosition(index);
            const labelPosition = getPosition(index, radius + 35);
            
            return (
              <g key={monthNumber}>
                {/* 月の点 */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={isActive ? 8 : 4}
                  fill={isActive ? seasonColors[month.season] : 'currentColor'}
                  className={isActive ? '' : 'text-slate-300 dark:text-slate-600'}
                />
                
                {/* アクティブな月の強調 */}
                {isActive && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={12}
                    fill="none"
                    stroke={seasonColors[month.season]}
                    strokeWidth="2"
                    opacity="0.6"
                  />
                )}
                
                {/* 月のラベル */}
                <text
                  x={labelPosition.x}
                  y={labelPosition.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`text-xs font-medium ${
                    isActive 
                      ? 'text-slate-800 dark:text-slate-200 font-bold' 
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {monthNumber}
                </text>
              </g>
            );
          })}
          
          {/* アクティブな月を線で結ぶ */}
          {activeMonths.length > 1 && (
            <g>
              {activeMonths.map((monthNumber, index) => {
                if (index === activeMonths.length - 1) return null;
                
                const currentPos = getPosition(monthNumber - 1);
                const nextMonth = activeMonths[index + 1];
                const nextPos = getPosition(nextMonth - 1);
                
                // 年をまたぐ場合の特別処理
                let pathElement;
                if (nextMonth - monthNumber > 6) {
                  // 年をまたぐ場合は外側の弧を描く
                  const largeArcFlag = 1;
                  pathElement = (
                    <path
                      d={`M ${currentPos.x} ${currentPos.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${nextPos.x} ${nextPos.y}`}
                      fill="none"
                      stroke={seasonColors[MONTHS[monthNumber - 1].season]}
                      strokeWidth="3"
                      opacity="0.7"
                    />
                  );
                } else {
                  pathElement = (
                    <line
                      x1={currentPos.x}
                      y1={currentPos.y}
                      x2={nextPos.x}
                      y2={nextPos.y}
                      stroke={seasonColors[MONTHS[monthNumber - 1].season]}
                      strokeWidth="3"
                      opacity="0.7"
                    />
                  );
                }
                
                return (
                  <g key={`${monthNumber}-${nextMonth}`}>
                    {pathElement}
                  </g>
                );
              })}
            </g>
          )}
          
          {/* 中央のテキスト */}
          <text
            x={centerX}
            y={centerY - 5}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-bold text-slate-600 dark:text-slate-400"
          >
            成虫発生
          </text>
          <text
            x={centerX}
            y={centerY + 8}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs text-slate-500 dark:text-slate-500"
          >
            {activeMonths.length}ヶ月
          </text>
        </svg>
      </div>
      
      {/* 凡例 */}
      <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
        {[
          { season: 'spring', name: '春', color: seasonColors.spring },
          { season: 'summer', name: '夏', color: seasonColors.summer },
          { season: 'autumn', name: '秋', color: seasonColors.autumn },
          { season: 'winter', name: '冬', color: seasonColors.winter }
        ].map(({ season, name, color }) => (
          <div key={season} className="flex items-center space-x-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-600 dark:text-slate-400">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SeasonalChart;