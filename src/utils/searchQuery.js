import { hiraganaToKatakana, normalizeNFKC } from './text.js';

// 一覧の検索語の解釈（昆虫・植物の一覧で共通）。
// - 前後の空白（全角スペースを含む）を無視する。NFKC で全角スペースが半角になるため、正規化の後で切る
// - 空白で区切った語は「すべてを含む」で探す（例:「コナラ クヌギ」→ 両方を食べる昆虫）。
//   区切りを詰めた語（「アオスジ アゲハ」→「アオスジアゲハ」）でも探す
// - 植物の、図鑑の表記と違うよく使われる呼び方（漢字・通称）は図鑑の表記に読み替える
//   （昆虫の別名は insects.csv の別名欄に入れる。例: アゲハ の別名 ナミアゲハ）

// 植物: 漢字1〜2字の名前と、通称（図鑑の表記で探すと見つかるもの）
export const PLANT_QUERY_ALIASES = Object.freeze({
  桜: 'サクラ',
  梅: 'ウメ',
  桃: 'モモ',
  松: 'マツ',
  杉: 'スギ',
  檜: 'ヒノキ',
  桧: 'ヒノキ',
  樫: 'カシ',
  楢: 'ナラ',
  栗: 'クリ',
  柿: 'カキ',
  桑: 'クワ',
  柳: 'ヤナギ',
  藤: 'フジ',
  楓: 'カエデ',
  椿: 'ツバキ',
  欅: 'ケヤキ',
  榎: 'エノキ',
  楠: 'クスノキ',
  樟: 'クスノキ',
  竹: 'タケ',
  笹: 'ササ',
  菊: 'キク',
  萩: 'ハギ',
  蓬: 'ヨモギ',
  葛: 'クズ',
  葦: 'ヨシ',
  芦: 'ヨシ',
  薄: 'ススキ',
  芒: 'ススキ',
  蜜柑: 'ミカン',
  柑橘: 'ミカン',
  カンキツ: 'ミカン',
  山椒: 'サンショウ',
  紫陽花: 'アジサイ',
  ドングリ: 'ブナ科',
});

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const variantsOf = (token, aliases) => {
  const lower = token.toLowerCase();
  const katakana = hiraganaToKatakana(lower);
  const alias = aliases[token] || aliases[lower] || aliases[katakana];
  return unique([lower, katakana, alias ? alias.toLowerCase() : '']);
};

/**
 * 検索語を解釈する。空なら null。
 * 返り値の tokens は語ごとの言い換え候補、compact は区切りを詰めた語の言い換え候補。
 */
export const parseSearchQuery = (rawTerm, aliases = {}) => {
  const normalized = normalizeNFKC(rawTerm).trim();
  if (!normalized) return null;
  const words = normalized.split(/\s+/).filter(Boolean);
  return {
    text: normalized,
    tokens: words.map((word) => variantsOf(word, aliases)),
    compact: variantsOf(words.join(''), aliases),
    isMultiWord: words.length > 1,
  };
};

/**
 * fields（小文字化済みの検索対象の文字列）が検索語に一致するか。
 * mode: 'all' = 区切った語をすべて含む、'any' = どれか1つを含む（すべて含むものが無いときの予備）
 */
export const matchesSearchQuery = (query, fields, mode = 'all') => {
  if (!query) return true;
  const hit = (variants) => variants.some((variant) => fields.some((field) => field && field.includes(variant)));
  if (hit(query.compact)) return true;
  if (!query.isMultiWord) return false;
  return mode === 'any' ? query.tokens.some(hit) : query.tokens.every(hit);
};

/**
 * items を検索語で絞り込む。区切った語をすべて含むものが1件も無いときだけ、どれか1つを含むもので探し直す
 * （例: 植物の一覧で「コナラ クヌギ」→ 1つの植物名に両方は含まれないので、コナラとクヌギを出す）。
 */
export const filterBySearchQuery = (items, query, getFields) => {
  if (!query) return items;
  const strict = items.filter((item) => matchesSearchQuery(query, getFields(item), 'all'));
  if (strict.length > 0 || !query.isMultiWord) return strict;
  return items.filter((item) => matchesSearchQuery(query, getFields(item), 'any'));
};

// 一致度での並べ替え（utils/searchRelevance）に渡す語。言い換えがあれば言い換え後の語にする
export const getRelevanceTerm = (query) => {
  if (!query) return '';
  if (query.isMultiWord) return query.text;
  const [primary] = query.tokens;
  return primary[primary.length - 1] || query.text;
};
