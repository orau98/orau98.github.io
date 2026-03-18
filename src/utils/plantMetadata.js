import logger from './logger';

export const plantFamilyMap = {
  'ヤナギ': 'ヤナギ科', 'ヤナギ類': 'ヤナギ科', 'クリ': 'ブナ科', 'クヌギ': 'ブナ科', 'コナラ': 'ブナ科',
  'ブナ': 'ブナ科', 'カシワ': 'ブナ科', 'アラカシ': 'ブナ科', 'スダジイ': 'ブナ科', 'リンゴ': 'バラ科',
  'サクラ': 'バラ科', 'ズミ': 'バラ科', 'ナナカマド': 'バラ科', 'マツ': 'マツ科', 'アカマツ': 'マツ科',
  'トドマツ': 'マツ科', 'スギ': 'スギ科', 'ヒノキ': 'ヒノキ科', 'ヨモギ': 'キク科', 'キク': 'キク科',
  'アザミ': 'キク科', 'イネ': 'イネ科', 'ススキ': 'イネ科', 'ヨシ': 'イネ科', 'ササ': 'イネ科',
  'ハンノキ': 'カバノキ科', 'シラカンバ': 'カバノキ科', 'ダケカンバ': 'カバノキ科', 'カエデ': 'ムクロジ科',
  'イタヤカエデ': 'ムクロジ科', 'ツタ': 'ブドウ科', 'ブドウ': 'ブドウ科', 'ヌルデ': 'ウルシ科',
  'ウルシ': 'ウルシ科', 'ツツジ': 'ツツジ科', 'アセビ': 'ツツジ科', 'スイカズラ': 'スイカズラ科',
  'ガマズミ': 'スイカズラ科', 'クズ': 'マメ科', 'ハギ': 'マメ科', 'フジ': 'マメ科',
};

export const plantScientificNameMap = {
  'サクラ': 'Cerasus',
  'ソメイヨシノ': 'Cerasus × yedoensis',
  'ヤマザクラ': 'Cerasus serrulata',
  'リンゴ': 'Malus domestica',
  'マツ': 'Pinus',
  'アカマツ': 'Pinus densiflora',
  'スギ': 'Cryptomeria japonica',
  'クリ': 'Castanea crenata',
  'クヌギ': 'Quercus acutissima',
  'コナラ': 'Quercus serrata',
};

export const collectAlternativeNames = (row, options = {}) => {
  const { dedupe = false, excludePrimary = '' } = options;
  const names = [];
  const oldName = (row['旧和名'] || '').trim();
  const alias = (row['別名'] || '').trim();
  const others = (row['その他の和名'] || '').trim();
  if (oldName) names.push(oldName);
  if (alias) names.push(...alias.split(/[、,，]/).map((s) => s.trim()).filter(Boolean));
  if (others) names.push(...others.split(/[、,，]/).map((s) => s.trim()).filter(Boolean));
  let merged = names;
  if (excludePrimary) {
    merged = merged.filter((name) => name !== excludePrimary);
  }
  if (dedupe) {
    merged = Array.from(new Set(merged));
  }
  return merged.join('、');
};

export const safeDeepClone = (obj) => {
  if (!obj) return {};
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    logger.debug('safeDeepClone fallback due to error:', error);
    return { ...obj };
  }
};

export const shouldDeferHeavyWork = () => {
  try {
    if (typeof navigator === 'undefined') return false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = connection?.saveData;
    const effectiveType = connection?.effectiveType || '';
    const isSlowNetwork = /^(slow-2g|2g)$/i.test(effectiveType);
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2;
    return Boolean(saveData || isSlowNetwork || lowMemory);
  } catch (error) {
    logger.debug('shouldDeferHeavyWork fallback due to error:', error);
    return false;
  }
};
