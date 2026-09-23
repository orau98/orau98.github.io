import { normalizePlantKey } from './plantNameUtils.js';

/**
 * 植物一覧の「正規名への統合」を1か所にまとめたもの。
 * 植物一覧（HostPlantList）・トップのタブの件数・ビルド時の件数（manifest）が
 * 同じ規則で数えるようにし、「タブは2,952種なのに一覧は6,286件」のような食い違いを防ぐ。
 */

const hasParenthesis = (value) => /[（(].*[)）]/.test(value);

const toAliasList = (value) => {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return Array.from(value);
  return [];
};

/** 植物詳細（別名つき）から、別名→正規名 と 正規化キー→正規名 の対応表を作る */
export const buildPlantCanonicalMaps = (plantDetails = {}) => {
  const aliasToCanonical = new Map();
  const normalizedToCanonical = new Map();
  const details = plantDetails || {};

  Object.entries(details).forEach(([canonical, detail]) => {
    if (!canonical || !detail) return;
    toAliasList(detail.aliases || detail.aliasNames).forEach((alias) => {
      const key = (alias || '').trim();
      if (key) aliasToCanonical.set(key, canonical);
    });
  });

  Object.keys(details).forEach((name) => {
    if (!name) return;
    const normalized = normalizePlantKey(name);
    if (!normalized) return;
    if (!normalizedToCanonical.has(normalized)) {
      normalizedToCanonical.set(normalized, name);
      return;
    }
    const existing = normalizedToCanonical.get(normalized);
    if (existing === normalized) return;
    if (name === normalized) {
      normalizedToCanonical.set(normalized, name);
      return;
    }
    // 括弧つき表記（例: 〇〇（〇〇科））より括弧なしの名前を正規名として優先する
    if (hasParenthesis(existing) && !hasParenthesis(name)) {
      normalizedToCanonical.set(normalized, name);
    }
  });

  return { aliasToCanonical, normalizedToCanonical };
};

/**
 * 食草・訪花・植物プロフィールを正規名ごとに統合する。
 * 戻り値は { 正規名: 関係する昆虫名の配列 }。
 * プロフィール（図鑑の説明）だけあって昆虫の記録がない植物は、空配列で含まれる。
 */
export const mergePlantEntries = ({
  hostPlants = {},
  flowerVisitPlants = {},
  plantDetails = {},
  maps = null,
} = {}) => {
  const { aliasToCanonical, normalizedToCanonical } = maps || buildPlantCanonicalMaps(plantDetails);
  const merged = new Map();
  const addEntry = (plantName, insects = []) => {
    if (!plantName || plantName === '不明') return;
    const normalized = normalizePlantKey(plantName);
    if (!normalized || normalized === '不明') return;
    const canonical = aliasToCanonical.get(plantName)
      || aliasToCanonical.get(normalized)
      || normalizedToCanonical.get(normalized)
      || normalized;
    let set = merged.get(canonical);
    if (!set) {
      set = new Set();
      merged.set(canonical, set);
    }
    if (Array.isArray(insects)) {
      insects.forEach((name) => {
        if (name) set.add(name);
      });
    }
  };

  Object.entries(hostPlants || {}).forEach(([plant, insects]) => addEntry(plant, insects));
  Object.entries(flowerVisitPlants || {}).forEach(([plant, insects]) => addEntry(plant, insects));
  Object.entries(plantDetails || {}).forEach(([plant, detail]) => {
    if (detail?.profile) addEntry(plant, []);
  });

  const result = {};
  merged.forEach((set, key) => {
    result[key] = Array.from(set);
  });
  return result;
};

/** 昆虫（食草・訪花）の記録がある植物の数。トップのタブと植物一覧の既定表示の件数になる */
export const countInsectLinkedPlants = (mergedPlants = {}) =>
  Object.values(mergedPlants || {}).filter((insects) => Array.isArray(insects) && insects.length > 0).length;
