import { createSafeInsectFilename } from './image.js';

const splitImageAliasValues = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(splitImageAliasValues);
  if (value instanceof Set) return Array.from(value).flatMap(splitImageAliasValues);

  return String(value)
    .split(/[;；、，]/)
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) return [];
      if (/^[A-Z][a-z]+\s+[a-z-]+/.test(trimmed)) return [trimmed];
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    })
    .flatMap((part) => {
      const cleaned = part
        .replace(/[（(][^）)]*(?:和名|新称|改称|旧称)[^）)]*[）)]/g, '')
        .trim();
      return cleaned && cleaned !== part ? [part, cleaned] : [part];
    });
};

const buildScientificFilenameAliases = (value) => {
  const safe = createSafeInsectFilename(value);
  if (!safe) return [];
  return [safe, safe.replace(/_/g, ' ')];
};

const uniqueNonEmpty = (values) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
};

export const normalizeImageBase = (name) => {
  if (!name) return '';
  return String(name)
    .normalize('NFC')
    .trim()
    .replace(/[＿]/g, '_')
    .replace(/\s+/g, '_');
};

export const normalizeCompactImageBase = (name) => {
  if (!name) return '';
  return String(name)
    .normalize('NFC')
    .trim()
    .replace(/[＿_]/g, '')
    .replace(/[\s・･\-−‐ー]/g, '')
    .replace(/[()（）[\]【】]/g, '')
    .toLowerCase();
};

export const buildNormalizedEntries = (imageNames, imageExtensions) => {
  const list = imageNames && imageNames.size
    ? Array.from(imageNames)
    : Object.keys(imageExtensions || {});
  return list.map((name) => ({
    name,
    normalized: normalizeImageBase(name),
    compact: normalizeCompactImageBase(name),
  }));
};

// (imageNames, imageExtensions) の参照が変わらない限り正規化エントリ配列を
// 再構築しない共有キャッシュ。消費側（一覧・詳細・カード等）ごとに同じ
// 3,000件規模の正規化をやり直すのを防ぎ、配列参照が安定することで
// 下記の検索構造キャッシュ(entryLookupCache)も全消費側で共有される。
// インデックスは実行時に1組しか存在しないため単一スロットで足りる。
let cachedEntriesNames = null;
let cachedEntriesExts = null;
let cachedEntries = [];
export const buildNormalizedEntriesCached = (imageNames, imageExtensions) => {
  if (imageNames !== cachedEntriesNames || imageExtensions !== cachedEntriesExts) {
    cachedEntriesNames = imageNames;
    cachedEntriesExts = imageExtensions;
    cachedEntries = buildNormalizedEntries(imageNames, imageExtensions);
  }
  return cachedEntries;
};

export const buildInsectImageBaseCandidates = (insect, mappedFilename) => {
  if (!insect) return [];
  const nameJp = insect.name || insect.japaneseName || '';
  const safeFromSci = createSafeInsectFilename(insect.scientificName || '');
  const safeWithSpaces = safeFromSci ? safeFromSci.replace(/_/g, ' ') : '';
  const aliasCandidates = splitImageAliasValues([
    insect.alternativeNames,
    insect.oldJapaneseName,
    insect.old_japanese_name,
    insect.otherNames,
    insect.other_names,
    insect.synonyms,
  ]);
  return uniqueNonEmpty([
    insect.scientificFilename,
    mappedFilename,
    safeFromSci,
    safeWithSpaces,
    nameJp,
    ...aliasCandidates.flatMap((alias) => [alias, ...buildScientificFilenameAliases(alias)]),
  ]);
};

// normalizedEntries 配列ごとの検索構造キャッシュ。
// 以前は候補1件ごとに全エントリを線形走査していたため、画像を持たない種が
// 多い一覧では「種数 × 候補数 × インデックス件数」の文字列比較が発生し、
// 一覧へ戻るたびに主スレッドを長時間占有していた。
// exact一致はMap、接頭辞一致はソート済み配列の二分探索でO(log n)にする。
const entryLookupCache = new WeakMap();

const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const lowerBound = (sorted, target) => {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].key < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const buildEntryLookup = (normalizedEntries) => {
  const byNormalized = new Map();
  const byCompact = new Map();
  const normalizedSorted = [];
  const compactSorted = [];
  for (const entry of normalizedEntries) {
    if (!entry || !entry.name) continue;
    if (entry.normalized) {
      if (!byNormalized.has(entry.normalized)) byNormalized.set(entry.normalized, entry.name);
      normalizedSorted.push({ key: entry.normalized, name: entry.name });
    }
    if (entry.compact) {
      if (!byCompact.has(entry.compact)) byCompact.set(entry.compact, entry.name);
      compactSorted.push({ key: entry.compact, name: entry.name });
    }
  }
  normalizedSorted.sort((a, b) => compareKeys(a.key, b.key));
  compactSorted.sort((a, b) => compareKeys(a.key, b.key));
  return { byNormalized, byCompact, normalizedSorted, compactSorted };
};

const getEntryLookup = (normalizedEntries) => {
  if (!Array.isArray(normalizedEntries) || normalizedEntries.length === 0) return null;
  let lookup = entryLookupCache.get(normalizedEntries);
  if (!lookup) {
    lookup = buildEntryLookup(normalizedEntries);
    entryLookupCache.set(normalizedEntries, lookup);
  }
  return lookup;
};

const findByPrefix = (sorted, prefix) => {
  if (!prefix) return null;
  const idx = lowerBound(sorted, prefix);
  if (idx < sorted.length && sorted[idx].key.startsWith(prefix)) return sorted[idx].name;
  return null;
};

export const resolveImageBaseCandidates = (
  candidates,
  {
    imageExtensions = {},
    imageNames = new Set(),
    normalizedEntries = [],
    includeUnresolved = true,
  } = {},
) => {
  const unique = [];
  const seen = new Set();
  const hasName = (name) =>
    Boolean(imageExtensions && imageExtensions[name]) ||
    Boolean(imageNames && imageNames.has && imageNames.has(name));
  const lookup = getEntryLookup(normalizedEntries);

  for (const candidate of candidates || []) {
    if (!candidate) continue;
    let resolved = null;
    if (hasName(candidate)) {
      resolved = candidate;
    } else if (lookup) {
      const normalized = normalizeImageBase(candidate);
      resolved =
        lookup.byNormalized.get(normalized) ||
        findByPrefix(lookup.normalizedSorted, `${normalized}_`) ||
        null;
      if (!resolved) {
        // compactが空になる候補（記号のみ等）は全件に前方一致してしまうため照合しない
        const compact = normalizeCompactImageBase(candidate);
        if (compact) {
          resolved =
            lookup.byCompact.get(compact) ||
            findByPrefix(lookup.compactSorted, compact) ||
            null;
        }
      }
    }
    const finalName = resolved || (includeUnresolved ? candidate : '');
    if (finalName && !seen.has(finalName)) {
      seen.add(finalName);
      unique.push(finalName);
    }
  }

  return unique;
};
