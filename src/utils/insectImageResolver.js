import { createSafeInsectFilename } from './image';

export const normalizeImageBase = (name) => {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, '_');
};

export const buildNormalizedEntries = (imageNames, imageExtensions) => {
  const list = imageNames && imageNames.size
    ? Array.from(imageNames)
    : Object.keys(imageExtensions || {});
  return list.map((name) => [normalizeImageBase(name), name]);
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
  { imageExtensions = {}, imageNames = new Set(), normalizedEntries = [] } = {},
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
      for (const [norm, actual] of normalizedEntries) {
        if (norm === normalized || norm.startsWith(prefix)) {
          resolved = actual;
          break;
        }
      }
    }
    const finalName = resolved || candidate;
    if (finalName && !seen.has(finalName)) {
      seen.add(finalName);
      unique.push(finalName);
    }
  }

  return unique;
};
