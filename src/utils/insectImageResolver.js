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
        for (const entry of normalizedEntries) {
          if (entry.compact === compact || entry.compact.startsWith(compact)) {
            resolved = entry.name;
            break;
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
