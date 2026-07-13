function getQuotedAttribute(tag, attributeName) {
  const escapedName = String(attributeName || '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(
    new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  );
  return match ? (match[1] ?? match[2] ?? '') : '';
}

export function hasNoindexRobotsMeta(html = '') {
  const metaTags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  return metaTags.some((tag) => {
    if (getQuotedAttribute(tag, 'name').toLowerCase() !== 'robots') return false;
    return getQuotedAttribute(tag, 'content')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
      .includes('noindex');
  });
}

function normalizeScientificLookupKey(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

export function createPlantMetaTargetResolver({ plantDetails = {}, pageNames = [] } = {}) {
  const generatedPageNames = new Set(
    Array.from(pageNames || [], (name) => String(name || '').trim()).filter(Boolean),
  );
  const canonicalByScientificName = new Map();

  for (const [canonicalName, detail] of Object.entries(plantDetails || {})) {
    if (!generatedPageNames.has(canonicalName)) continue;
    const scientificKey = normalizeScientificLookupKey(detail?.scientificName);
    if (!scientificKey) continue;

    if (!canonicalByScientificName.has(scientificKey)) {
      canonicalByScientificName.set(scientificKey, canonicalName);
      continue;
    }
    if (canonicalByScientificName.get(scientificKey) !== canonicalName) {
      canonicalByScientificName.set(scientificKey, null);
    }
  }

  return (plantName = '') => {
    const exactName = String(plantName || '').trim();
    if (!exactName) return '';
    if (generatedPageNames.has(exactName)) return exactName;

    const scientificKey = normalizeScientificLookupKey(exactName);
    const canonicalName = scientificKey
      ? canonicalByScientificName.get(scientificKey)
      : '';
    return typeof canonicalName === 'string' ? canonicalName : '';
  };
}
