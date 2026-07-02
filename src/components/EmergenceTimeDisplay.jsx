import { useMemo } from 'react';
import logger from '../utils/logger';
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

const FULL_YEAR_PATTERN = /(一年中|周年|通年|年中)/;
const EMERGENCE_HINT_PATTERN = /(成虫|出現|羽化|発生|得られ|見られ|採れ|採集|越冬|越年|春の蛾|夏の蛾|秋の蛾|冬の蛾|周年|通年|年中)/;
const FUZZY_SEASON_CUES = [
  { pattern: /(初春|早春)/, months: [2, 3] },
  { pattern: /(晩春)/, months: [4, 5] },
  { pattern: /(翌春|春にも|春まで|春ごろ|春頃|春先|春に|春の|春型|春季|春期|春)/, months: [3, 4, 5] },
  { pattern: /(初夏)/, months: [5, 6] },
  { pattern: /(盛夏)/, months: [7, 8] },
  { pattern: /(晩夏)/, months: [8, 9] },
  { pattern: /(翌夏|夏にも|夏まで|夏ごろ|夏頃|夏に|夏の|夏型|夏季|夏期|夏)/, months: [6, 7, 8] },
  { pattern: /(初秋)/, months: [9, 10] },
  { pattern: /(晩秋)/, months: [10, 11] },
  { pattern: /(翌秋|秋にも|秋まで|秋ごろ|秋頃|秋に|秋の|秋型|秋季|秋期|秋)/, months: [9, 10, 11] },
  { pattern: /(初冬|晩冬|真冬|厳冬)/, months: [12, 1, 2] },
  { pattern: /(翌冬|冬にも|冬まで|冬ごろ|冬頃|冬に|冬の|冬型|冬季|冬期)/, months: [12, 1, 2] }
];

const addMonthPeriods = (monthSet, periodSet, month) => {
  if (!(month >= 1 && month <= 12)) return;
  monthSet.add(month);
  for (let p = 1; p <= 3; p++) {
    periodSet.add(month + p * 0.1);
  }
};

const addMonthRangePeriods = (monthSet, periodSet, startMonth, endMonth) => {
  if (!(startMonth >= 1 && startMonth <= 12) || !(endMonth >= 1 && endMonth <= 12)) return;
  if (startMonth <= endMonth) {
    for (let month = startMonth; month <= endMonth; month++) {
      addMonthPeriods(monthSet, periodSet, month);
    }
    return;
  }
  for (let month = startMonth; month <= 12; month++) {
    addMonthPeriods(monthSet, periodSet, month);
  }
  for (let month = 1; month <= endMonth; month++) {
    addMonthPeriods(monthSet, periodSet, month);
  }
};

const getNextMonth = (month) => (month === 12 ? 1 : month + 1);

const findNextTargetMonth = (anchorMonth, targetMonths = []) => {
  const targetSet = new Set((targetMonths || []).filter((month) => month >= 1 && month <= 12));
  if (!anchorMonth || targetSet.size === 0) return null;
  let month = getNextMonth(anchorMonth);
  for (let i = 0; i < 12; i++) {
    if (targetSet.has(month)) return month;
    month = getNextMonth(month);
  }
  return null;
};

const addBridgePeriodsUntilSeason = (monthSet, periodSet, anchorMonth, targetMonths = []) => {
  const targetMonth = findNextTargetMonth(anchorMonth, targetMonths);
  if (!targetMonth) return;
  let month = getNextMonth(anchorMonth);
  while (month !== targetMonth) {
    addMonthPeriods(monthSet, periodSet, month);
    month = getNextMonth(month);
  }
};

const extractMentionedMonths = (text = '') =>
  Array.from(text.matchAll(/(\d{1,2})月/g))
    .map((match) => parseInt(match[1], 10))
    .filter((month) => month >= 1 && month <= 12);

const shouldAnalyzeEmergenceHint = (text = '', isPrimary = false) => {
  if (!text) return false;
  if (isPrimary) return true;
  return EMERGENCE_HINT_PATTERN.test(text);
};

const collectFuzzyEmergenceHints = (primaryText, supplementalTexts = [], anchorMonths = []) => {
  const fuzzyMonths = new Set();
  const fuzzyPeriods = new Set();
  const bridgedMonths = new Set();
  const bridgedPeriods = new Set();
  const texts = [primaryText, ...supplementalTexts]
    .map((text) => String(text || '').trim())
    .filter(Boolean);

  texts.forEach((text, index) => {
    const isPrimary = index === 0;
    if (!shouldAnalyzeEmergenceHint(text, isPrimary)) return;

    const matchedSeasonMonths = [];
    FUZZY_SEASON_CUES.forEach(({ pattern, months }) => {
      if (pattern.test(text)) {
        matchedSeasonMonths.push(months);
        months.forEach((month) => addMonthPeriods(fuzzyMonths, fuzzyPeriods, month));
      }
    });

    const mentionedMonths = extractMentionedMonths(text);
    const anchorMonth = mentionedMonths.length > 0
      ? mentionedMonths[mentionedMonths.length - 1]
      : (anchorMonths.length > 0 ? anchorMonths[anchorMonths.length - 1] : null);

    if (anchorMonth && /(越冬|越年)/.test(text)) {
      matchedSeasonMonths.forEach((months) => {
        addBridgePeriodsUntilSeason(bridgedMonths, bridgedPeriods, anchorMonth, months);
      });
    }
  });

  return {
    months: Array.from(fuzzyMonths).sort((a, b) => a - b),
    periods: Array.from(fuzzyPeriods).sort((a, b) => a - b),
    bridgedMonths: Array.from(bridgedMonths).sort((a, b) => a - b),
    bridgedPeriods: Array.from(bridgedPeriods).sort((a, b) => a - b)
  };
};

// 成虫発生時期を解析する関数（旬単位対応）
// 一覧カード側が「バーを描けるだけの月データがあるか」を事前判定できるよう公開する
export const hasEmergencePeriods = (emergenceTime, supplementalTexts = []) => {
  const parsed = parseEmergenceTime(emergenceTime, supplementalTexts);
  return (parsed.periods?.length || 0) > 0 || (parsed.fuzzyPeriods?.length || 0) > 0;
};

const parseEmergenceTime = (emergenceTime, supplementalTexts = []) => {
  if ((!emergenceTime || emergenceTime === '不明') && (!supplementalTexts || supplementalTexts.length === 0)) {
    return { months: [], periods: [], fuzzyMonths: [], fuzzyPeriods: [] };
  }

  emergenceTime = String(emergenceTime || '');
  
  // Debug log for specific species
  const isDebugSpecies = emergenceTime.includes('3月') || emergenceTime.includes('丘陵地') || emergenceTime.includes('山地') || emergenceTime.includes('10-12、1-5月');
  if (isDebugSpecies) {
    logger.debug('DEBUG: parseEmergenceTime input:', emergenceTime);
  }
  
  const activeMonths = new Set();
  const activePeriods = new Set(); // 月.旬の形式 (例: 3.1 = 3月上旬, 3.2 = 3月中旬, 3.3 = 3月下旬)

  const hintTexts = [emergenceTime, ...(supplementalTexts || [])].filter(Boolean);
  if (hintTexts.some((text) => FULL_YEAR_PATTERN.test(String(text)))) {
    addMonthRangePeriods(activeMonths, activePeriods, 1, 12);
  }
  
  // 月の漢数字を数字に変換
  const kanjiToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
    '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12
  };
  
  // 処理対象のテキストを準備
  // 地域別・条件別の記述を含む場合は統合して処理
  let textToProcess = emergenceTime;
  
  // "丘陵地では4-5月、山地では7-8月" のようなパターンを検出
  if (emergenceTime.includes('では') || emergenceTime.includes('で') && emergenceTime.includes('月')) {
    // カンマで分割して、それぞれから月の情報を抽出
    const segments = emergenceTime.split(/[、,]/);
    const monthPatterns = segments.map(segment => {
      // 月の範囲を含む部分を抽出
      const monthMatch = segment.match(/\d{1,2}[-~～〜]\d{1,2}月|\d{1,2}月/g);
      return monthMatch ? monthMatch.join(' ') : '';
    }).filter(s => s);
    
    // 全ての月パターンを結合
    textToProcess = monthPatterns.join(' ') + ' ' + emergenceTime;
  }
  
  // 「〜から」と「〜まで」を個別に検出して期間を作成
  const fromPattern = /(\d{1,2})月(上旬|中旬|下旬)?から/g;
  const toPattern = /(\d{1,2})月(上旬|中旬|下旬)?まで/g;
  
  let fromMonth = null, fromPeriod = null;
  let toMonth = null, toPeriod = null;
  
  // 「〜から」を検出
  let match;
  while ((match = fromPattern.exec(emergenceTime)) !== null) {
    fromMonth = parseInt(match[1]);
    fromPeriod = match[2];
  }
  
  // 「〜まで」を検出
  while ((match = toPattern.exec(emergenceTime)) !== null) {
    toMonth = parseInt(match[1]);
    toPeriod = match[2];
  }

  // 特別処理: 「X月…翌年Y月まで」の表現を検出（例: 10月頃羽化し、翌年4月まで）
  if (fromMonth === null && toMonth === null) {
    const nextYearPattern = /(\d{1,2})月[^\d]*翌年(\d{1,2})月まで/;
    const nyMatch = emergenceTime.match(nextYearPattern);
    if (nyMatch) {
      fromMonth = parseInt(nyMatch[1]);
      toMonth = parseInt(nyMatch[2]);
    }
  }

  // 補助: 「から」が無いが最初の月と「Y月まで」がある場合に範囲推定（例: 10月…4月まで）
  if (fromMonth === null && toMonth !== null) {
    const monthAll = Array.from(emergenceTime.matchAll(/(\d{1,2})月/g));
    if (monthAll.length > 0) {
      fromMonth = parseInt(monthAll[0][1]);
    }
  }
  
  // 「から」と「まで」の両方がある場合、期間として処理
  if (fromMonth !== null && toMonth !== null) {
    const startPeriodNum = fromPeriod ? (fromPeriod === '上旬' ? 1 : fromPeriod === '中旬' ? 2 : 3) : 1;
    const endPeriodNum = toPeriod ? (toPeriod === '上旬' ? 1 : toPeriod === '中旬' ? 2 : 3) : 3;
    
    if (fromMonth <= toMonth) {
      for (let m = fromMonth; m <= toMonth; m++) {
        if (m > 12) break;
        activeMonths.add(m);
        
        if (m === fromMonth && fromPeriod) {
          // 開始月：指定された旬から月末まで
          for (let p = startPeriodNum; p <= 3; p++) {
            activePeriods.add(m + p * 0.1);
          }
        } else if (m === toMonth && toPeriod) {
          // 終了月：月初から指定された旬まで
          for (let p = 1; p <= endPeriodNum; p++) {
            activePeriods.add(m + p * 0.1);
          }
        } else {
          // 中間月または旬指定なし：全旬
          for (let p = 1; p <= 3; p++) {
            activePeriods.add(m + p * 0.1);
          }
        }
      }
    } else {
      // 年をまたぐ場合
      for (let m = fromMonth; m <= 12; m++) {
        activeMonths.add(m);
        if (m === fromMonth && fromPeriod) {
          for (let p = startPeriodNum; p <= 3; p++) {
            activePeriods.add(m + p * 0.1);
          }
        } else {
          for (let p = 1; p <= 3; p++) {
            activePeriods.add(m + p * 0.1);
          }
        }
      }
      for (let m = 1; m <= toMonth; m++) {
        activeMonths.add(m);
        if (m === toMonth && toPeriod) {
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
  
  // 旬単位のパターンを検出（例：3月上旬、4月中旬、5月下旬）- 「から」「まで」がない場合のみ
  if (fromMonth === null && toMonth === null) {
    const periodPattern = /(\d{1,2})月(上旬|中旬|下旬)/g;
    while ((match = periodPattern.exec(textToProcess)) !== null) {
      const month = parseInt(match[1]);
      const period = match[2];
      if (month >= 1 && month <= 12) {
        activeMonths.add(month);
        const periodNum = period === '上旬' ? 1 : period === '中旬' ? 2 : 3;
        activePeriods.add(month + periodNum * 0.1);
      }
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

  // 混在範囲その1: 「X月(上|中|下)旬~Y月」(終了側に旬指定なし)
  const periodToMonthPattern = /(\d{1,2})月(上旬|中旬|下旬)[～〜~-](\d{1,2})月(?![頃上中下])/g;
  while ((match = periodToMonthPattern.exec(emergenceTime)) !== null) {
    const startMonth = parseInt(match[1]);
    const startPeriod = match[2];
    const endMonth = parseInt(match[3]);
    const startPeriodNum = startPeriod === '上旬' ? 1 : startPeriod === '中旬' ? 2 : 3;
    const endPeriodNum = 3; // 指定がない場合は月末まで

    if (startMonth <= endMonth) {
      for (let m = startMonth; m <= endMonth; m++) {
        activeMonths.add(m);
        if (m === startMonth) {
          for (let p = startPeriodNum; p <= 3; p++) activePeriods.add(m + p * 0.1);
        } else if (m === endMonth) {
          for (let p = 1; p <= endPeriodNum; p++) activePeriods.add(m + p * 0.1);
        } else {
          for (let p = 1; p <= 3; p++) activePeriods.add(m + p * 0.1);
        }
      }
    } else {
      // 年越し
      for (let m = startMonth; m <= 12; m++) {
        activeMonths.add(m);
        if (m === startMonth) {
          for (let p = startPeriodNum; p <= 3; p++) activePeriods.add(m + p * 0.1);
        } else {
          for (let p = 1; p <= 3; p++) activePeriods.add(m + p * 0.1);
        }
      }
      for (let m = 1; m <= endMonth; m++) {
        activeMonths.add(m);
        for (let p = 1; p <= 3; p++) activePeriods.add(m + p * 0.1);
      }
    }
  }

  // 混在範囲その2: 「X月~Y月(上|中|下)旬」（開始側に旬指定なし）
  const monthToPeriodPattern = /(\d{1,2})月[～〜~-](\d{1,2})月(上旬|中旬|下旬)/g;
  while ((match = monthToPeriodPattern.exec(emergenceTime)) !== null) {
    const startMonth = parseInt(match[1]);
    const endMonth = parseInt(match[2]);
    const endPeriod = match[3];
    const startPeriodNum = 1; // 指定がない場合は月初から
    const endPeriodNum = endPeriod === '上旬' ? 1 : endPeriod === '中旬' ? 2 : 3;

    if (startMonth <= endMonth) {
      for (let m = startMonth; m <= endMonth; m++) {
        activeMonths.add(m);
        if (m === startMonth) {
          for (let p = startPeriodNum; p <= 3; p++) activePeriods.add(m + p * 0.1);
        } else if (m === endMonth) {
          for (let p = 1; p <= endPeriodNum; p++) activePeriods.add(m + p * 0.1);
        } else {
          for (let p = 1; p <= 3; p++) activePeriods.add(m + p * 0.1);
        }
      }
    } else {
      // 年越し
      for (let m = startMonth; m <= 12; m++) {
        activeMonths.add(m);
        if (m === startMonth) {
          for (let p = startPeriodNum; p <= 3; p++) activePeriods.add(m + p * 0.1);
        } else {
          for (let p = 1; p <= 3; p++) activePeriods.add(m + p * 0.1);
        }
      }
      for (let m = 1; m <= endMonth; m++) {
        activeMonths.add(m);
        if (m === endMonth) {
          for (let p = 1; p <= endPeriodNum; p++) activePeriods.add(m + p * 0.1);
        } else {
          for (let p = 1; p <= 3; p++) activePeriods.add(m + p * 0.1);
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
  
  // カンマで区切られた複数の範囲/月を処理（例：10-12、1-5月）
  const commaSeparatedPattern = /(\d{1,2})[-－](\d{1,2})[、，,]\s*(\d{1,2})[-－](\d{1,2})月/g;
  let hasCommaSeparatedPattern = false;
  while ((match = commaSeparatedPattern.exec(emergenceTime)) !== null) {
    hasCommaSeparatedPattern = true;
    if (isDebugSpecies) {
      logger.debug('DEBUG: commaSeparatedPattern match:', match, 'input:', emergenceTime);
    }
    const firstStart = parseInt(match[1]);
    const firstEnd = parseInt(match[2]);
    const secondStart = parseInt(match[3]);
    const secondEnd = parseInt(match[4]);
    
    if (isDebugSpecies) {
      logger.debug('DEBUG: Processing ranges:', firstStart, '-', firstEnd, 'and', secondStart, '-', secondEnd);
    }
    
    // 最初の範囲を処理
    for (let i = firstStart; i <= firstEnd; i++) {
      activeMonths.add(i);
      for (let p = 1; p <= 3; p++) {
        activePeriods.add(i + p * 0.1);
      }
    }
    
    // 2番目の範囲を処理  
    if (secondStart <= secondEnd) {
      for (let i = secondStart; i <= secondEnd; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    } else {
      // 年をまたぐ場合
      for (let i = secondStart; i <= 12; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
      for (let i = 1; i <= secondEnd; i++) {
        activeMonths.add(i);
        for (let p = 1; p <= 3; p++) {
          activePeriods.add(i + p * 0.1);
        }
      }
    }
  }
  
  // 範囲指定（例：5～8月、3月～10月、4-5月）を検出 - ASCII チルダ (~) も含む（旬指定なし）
  // ハイフンも含めて処理
  // カンマ区切りパターンがある場合はスキップ（重複処理を避ける）
  if (!hasCommaSeparatedPattern) {
    const rangePattern = /(\d{1,2})月?[～〜~\-－](\d{1,2})月(?![上中下])/g;
    while ((match = rangePattern.exec(emergenceTime)) !== null) {
      if (isDebugSpecies) {
        logger.debug('DEBUG: rangePattern match:', match, 'input:', emergenceTime);
      }
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
  
  const fuzzyData = collectFuzzyEmergenceHints(
    emergenceTime,
    supplementalTexts,
    Array.from(activeMonths).sort((a, b) => a - b)
  );

  fuzzyData.bridgedMonths.forEach((month) => activeMonths.add(month));
  fuzzyData.bridgedPeriods.forEach((period) => activePeriods.add(period));
  
  // Debug log for specific species
  if (isDebugSpecies) {
    logger.debug('DEBUG: parseEmergenceTime result:', {
      activeMonths: Array.from(activeMonths).sort((a, b) => a - b),
      activePeriods: Array.from(activePeriods).sort((a, b) => a - b)
    });
  }
  
  return {
    months: Array.from(activeMonths).sort((a, b) => a - b),
    periods: Array.from(activePeriods).sort((a, b) => a - b),
    fuzzyMonths: fuzzyData.months,
    fuzzyPeriods: fuzzyData.periods
  };
};

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
                        ${isActive ? month.color : isFuzzy ? 'bg-gradient-to-b from-orange-200/80 to-orange-50/15 ring-1 ring-inset ring-orange-200/70' : 'bg-transparent'}
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
                      ${isActive ? month.color : isFuzzy ? 'bg-gradient-to-b from-orange-200/80 to-orange-50/15 ring-1 ring-inset ring-orange-200/70' : 'bg-transparent'}
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
              <span className="h-3 w-5 rounded-sm bg-gradient-to-b from-orange-200/80 to-orange-50/15 ring-1 ring-inset ring-orange-300/70" aria-hidden="true" />
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
