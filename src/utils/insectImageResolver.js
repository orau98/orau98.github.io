import { createSafeInsectFilename } from './image.js';

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

export const buildInsectImageBaseCandidates = (insect, mappedFilename) => {
  if (!insect) return [];
  const nameJp = insect.name || insect.japaneseName || '';
  const safeFromSci = createSafeInsectFilename(insect.scientificName || '');
  const safeWithSpaces = safeFromSci ? safeFromSci.replace(/_/g, ' ') : '';
  return [
    insect.scientificFilename,
    mappedFilename,
    safeFromSci,
    safeWithSpaces,
    nameJp,
  ].filter(Boolean);
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

  for (const candidate of candidates || []) {
    if (!candidate) continue;
    let resolved = null;
    if (hasName(candidate)) {
      resolved = candidate;
    } else {
      const normalized = normalizeImageBase(candidate);
      const prefix = `${normalized}_`;
      for (const entry of normalizedEntries) {
        if (entry.normalized === normalized || entry.normalized.startsWith(prefix)) {
          resolved = entry.name;
          break;
        }
      }
      if (!resolved) {
        const compact = normalizeCompactImageBase(candidate);
        // compactが空（記号のみの候補等）だと startsWith('') が全エントリに真となり、
        // 無関係な先頭画像へ誤解決してしまうためガードする
        if (compact) {
          for (const entry of normalizedEntries) {
            if (entry.compact === compact || entry.compact.startsWith(compact)) {
              resolved = entry.name;
              break;
            }
          }
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
