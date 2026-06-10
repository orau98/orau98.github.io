import { useState } from 'react';
import SourceCitation from './ui/SourceCitation';

/**
 * 発生時期の詳細情報カードコンポーネント
 */
const EmergenceTimeDetailCard = ({ emergenceData, isExpanded, onToggle }) => {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 transition-all duration-200">
      {/* 基本情報行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {emergenceData.period}
            </span>
            {emergenceData.region && (
              <span className="text-sm text-slate-600 dark:text-slate-400 ml-2">
                ({emergenceData.region})
              </span>
            )}
          </div>
        </div>
        
        {/* 詳細情報がある場合のトグルボタン */}
        {(emergenceData.source || emergenceData.notes) && (
          <button
            onClick={onToggle}
            className="ml-2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={isExpanded ? "詳細を閉じる" : "詳細を表示"}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      
      {/* 詳細情報（展開時） */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-600 space-y-2">
          {/* 出典情報（サイト共通の控えめ表記） */}
          {emergenceData.source && (
            <SourceCitation sources={emergenceData.source} />
          )}
          
          {/* 備考 */}
          {emergenceData.notes && (
            <div className="text-sm">
              <span className="text-slate-600 dark:text-slate-400">備考:</span>
              <span className="ml-1 text-slate-700 dark:text-slate-300">
                {emergenceData.notes}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 統合発生時期表示コンポーネント
 */
const EnhancedEmergenceTimeDisplay = ({ 
  emergenceTime = '', 
  emergenceTimeDetailed = [], 
  showDetailsByDefault = false 
}) => {
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  // 詳細情報がある場合はそれを優先、なければ従来形式を使用
  const timesToDisplay = emergenceTimeDetailed && emergenceTimeDetailed.length > 0 
    ? emergenceTimeDetailed 
    : emergenceTime && emergenceTime !== '不明' && emergenceTime !== '' 
    ? [{ period: emergenceTime, source: '', region: '', notes: '' }] 
    : [];
  
  const toggleExpanded = (index) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };
  
  if (!timesToDisplay || timesToDisplay.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 italic">
        発生時期情報なし
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* 発生時期リスト */}
      <div className="space-y-2">
        {timesToDisplay.map((timeData, index) => (
          <EmergenceTimeDetailCard
            key={index}
            emergenceData={timeData}
            isExpanded={expandedItems.has(index) || showDetailsByDefault}
            onToggle={() => toggleExpanded(index)}
          />
        ))}
      </div>
      
      {/* 統計情報 */}
      {timesToDisplay.length > 1 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2 border-t border-slate-200 dark:border-slate-700">
          {timesToDisplay.length} 件の発生時期記録
          {emergenceTimeDetailed && emergenceTimeDetailed.length > 0 && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">詳細情報あり</span>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedEmergenceTimeDisplay;
