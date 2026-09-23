import { normalizeForSearch } from './text.js';

// 検索結果の「名前の一致度」。小さいほど上位に並べる。
// 入力中の候補リスト（InsectsHostPlantExplorer の getMatchScore）と同じ考え方で、
// 結果一覧でも「名前がぴったり一致 → 名前の先頭が一致 → 名前の一部に一致」を、
// 科名・食草名など名前以外だけで一致したものより先に出す
// （例:「アゲハ」で「アゲハ」本体が5番目、「ハンノキ」で「ハンノキ」が7番目になっていた）
export const SEARCH_MATCH_TIER = Object.freeze({
  EXACT: 0,
  PREFIX: 1,
  PARTIAL: 2,
  OTHER: 3,
});

// 別名欄（「、」「,」区切り）や学名シノニム欄（「;」区切り）を配列にする
export const splitNameList = (value, separator = /[、,，;；]/) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
};

const collapseSpaces = (value) => value.replace(/\s+/g, ' ');

const tierForName = (candidate, term) => {
  const value = normalizeForSearch(candidate);
  if (!value) return SEARCH_MATCH_TIER.OTHER;
  if (value === term) return SEARCH_MATCH_TIER.EXACT;
  if (value.startsWith(term)) return SEARCH_MATCH_TIER.PREFIX;
  if (value.includes(term)) return SEARCH_MATCH_TIER.PARTIAL;
  return SEARCH_MATCH_TIER.OTHER;
};

// 学名は著者名・年を含む（例: "Papilio xuthus Linnaeus, 1767"）。
// 属名＋種小名まで入力された（空白を含む）場合は、後ろに著者名が続いても完全一致とみなす
const tierForScientificName = (candidate, term) => {
  const value = collapseSpaces(normalizeForSearch(candidate));
  const normalizedTerm = collapseSpaces(term);
  if (!value) return SEARCH_MATCH_TIER.OTHER;
  if (value === normalizedTerm) return SEARCH_MATCH_TIER.EXACT;
  if (normalizedTerm.includes(' ') && value.startsWith(`${normalizedTerm} `)) {
    return SEARCH_MATCH_TIER.EXACT;
  }
  if (value.startsWith(normalizedTerm)) return SEARCH_MATCH_TIER.PREFIX;
  if (value.includes(normalizedTerm)) return SEARCH_MATCH_TIER.PARTIAL;
  return SEARCH_MATCH_TIER.OTHER;
};

/**
 * 和名・別名（names）と学名（scientificNames）のうち、最もよく一致したものの段階を返す。
 * 検索語が空なら全件 OTHER（＝一致度で並べ替えない）。
 */
export const getSearchMatchTier = ({ names = [], scientificNames = [] } = {}, rawTerm = '') => {
  const term = normalizeForSearch(rawTerm);
  if (!term) return SEARCH_MATCH_TIER.OTHER;
  let best = SEARCH_MATCH_TIER.OTHER;
  for (const name of names) {
    best = Math.min(best, tierForName(name, term));
    if (best === SEARCH_MATCH_TIER.EXACT) return best;
  }
  for (const name of scientificNames) {
    best = Math.min(best, tierForScientificName(name, term));
    if (best === SEARCH_MATCH_TIER.EXACT) return best;
  }
  return best;
};
