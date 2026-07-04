const CJK_CHAR = '一-龯ぁ-んァ-ヶ々〆〇';
const CJK_INTERNAL_SPACE_RE = new RegExp(`([${CJK_CHAR}])\\s+([${CJK_CHAR}])`, 'g');

export const normalizePlantProfileText = (value = '') => String(value || '')
  .replace(CJK_INTERNAL_SPACE_RE, '$1$2')
  .replace(/\s+([、。])/g, '$1')
  .trim();

const normalizeSourceText = (value = '') => String(value || '')
  .replace(/\s+([、。])/g, '$1')
  .trim();

// 出典 + ページを 1 文字列に整形（HostPlantDetail の SourceCitation で使用）
export const buildSourceLabel = (profile = {}) => [
  normalizeSourceText(profile.source),
  profile.page ? `p.${normalizeSourceText(profile.page)}` : '',
].filter(Boolean).join(' ');
