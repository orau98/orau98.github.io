// Utilities for splitting Japanese insect names with alias parentheses.

const NON_ALIAS_KEYWORDS = [
  '新称',
  '旧称',
  '未記載',
  '未記述',
  '未同定',
  '未定',
  '不明',
  '別名',
  '別称',
  '俗称',
  '通称',
  '仮称',
  '誤記',
  '誤称',
  '雑誌',
  '巻',
  '号',
  '頁',
  'ページ',
  '図',
  '版',
  '章',
  'type',
  'locality',
  'fig',
  'pp',
  'p.'
];

const hasJapanese = (text = '') => /[ぁ-んァ-ヶ一-龠]/.test(text);

const JAPANESE_NAME_PLACEHOLDER = /[（(]?\s*和名(?:未記載|なし|不明|未登録)\s*[）)]?/g;

export const normalizeJapaneseInsectName = (rawName = '') =>
  String(rawName || '')
    .replace(JAPANESE_NAME_PLACEHOLDER, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const isAliasToken = (token = '') => {
  const t = token.trim();
  if (!t || t.length <= 1) return false;
  if (!hasJapanese(t)) return false;
  if (/[A-Za-z0-9]/.test(t)) return false;
  const lower = t.toLowerCase();
  if (NON_ALIAS_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return false;
  return true;
};

export const splitJapaneseNameAliases = (rawName = '') => {
  const source = normalizeJapaneseInsectName(rawName);
  if (!source) return { name: '', aliases: [] };

  const aliasSet = new Set();
  let cleaned = source;
  const re = /[（(]([^）)]+)[）)]/g;
  let match;
  while ((match = re.exec(source))) {
    const inner = (match[1] || '').trim();
    if (!inner) continue;
    const tokens = inner
      .split(/[、,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = tokens.filter(isAliasToken);
    if (valid.length > 0) {
      valid.forEach((v) => aliasSet.add(v));
      cleaned = cleaned.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  return {
    name: cleaned || source,
    aliases: Array.from(aliasSet)
  };
};
