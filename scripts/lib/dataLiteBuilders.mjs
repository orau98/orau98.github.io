export const cleanString = (value) => (value ?? '').toString().trim();

const SUSPICIOUS_PLANT_NAME_SET = new Set([
  '葉',
  '葉裏',
  '葉表',
  '茎',
  '茎と葉裏',
  '主として茎',
  '根',
  '成葉の裏面',
  '生長部の茎と葉裏',
  '新梢の生長部',
  '新梢の茎',
  '穂',
  '地中の根',
]);

export function normalizePlantNameLite(plantName) {
  if (!plantName || typeof plantName !== 'string') return '';
  let value = plantName.trim();
  if (!value || value === '不明') return '';
  value = value.replace(/[（(][^）)]*科[^）)]*[）)]/g, '');
  value = value.replace(/[（(][^）)]*[）)]$/g, '');
  value = value.replace(/^[）)]/, '');
  return value.trim();
}

export const isSuspiciousPlantName = (value) =>
  SUSPICIOUS_PLANT_NAME_SET.has(cleanString(value));

export const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = cleanString(record.lifeStage);
  const plantPart = cleanString(record.plantPart);
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

export function buildFlowerVisitPlantDataset(allInsects = [], ylistLite = {}) {
  const flowerVisitPlants = {};
  const aliasToCanonical = { ...(ylistLite.aliasToCanonical || {}) };

  allInsects.forEach((insect) => {
    const insectName = cleanString(insect?.name || insect?.japaneseName);
    if (!insectName) return;
    const records = Array.isArray(insect?.hostPlantsDetailed) ? insect.hostPlantsDetailed : [];
    records.forEach((record) => {
      if (!isFlowerVisitRecord(record)) return;
      const rawName = cleanString(record?.displayName || record?.name || record?.plant);
      if (!rawName || isSuspiciousPlantName(rawName)) return;
      const normalized = normalizePlantNameLite(rawName) || rawName;
      const canonical =
        aliasToCanonical[normalized] ||
        aliasToCanonical[rawName] ||
        normalized;
      if (!canonical || canonical === '不明') return;
      if (!flowerVisitPlants[canonical]) {
        flowerVisitPlants[canonical] = [];
      }
      if (!flowerVisitPlants[canonical].includes(insectName)) {
        flowerVisitPlants[canonical].push(insectName);
      }
    });
  });

  Object.keys(flowerVisitPlants).forEach((plantName) => {
    flowerVisitPlants[plantName] = flowerVisitPlants[plantName]
      .slice()
      .sort((a, b) => a.localeCompare(b, 'ja'));
  });

  return flowerVisitPlants;
}

export function buildHostPlantDataset(allInsects = [], ylistLite = {}) {
  const hostPlantsMap = {};
  const plantDetailsRaw = {};
  const aliasToCanonical = { ...(ylistLite.aliasToCanonical || {}) };
  const ylistPlants = ylistLite.plants || {};

  const ensureDetail = (name) => {
    if (!plantDetailsRaw[name]) {
      plantDetailsRaw[name] = {
        family: '',
        familyName: '',
        familyLatin: '',
        order: '',
        orderLatin: '',
        scientificName: '',
        genus: '',
        aliases: new Set(),
      };
    }
    return plantDetailsRaw[name];
  };

  const registerInsect = (plantName, insectName) => {
    if (!plantName) return;
    if (!hostPlantsMap[plantName]) hostPlantsMap[plantName] = [];
    if (!hostPlantsMap[plantName].includes(insectName)) {
      hostPlantsMap[plantName].push(insectName);
    }
  };

  allInsects.forEach((insect) => {
    const insectName = cleanString(insect?.name || insect?.japaneseName);
    if (!insectName) return;
    const detailedPlants = Array.isArray(insect?.hostPlantsDetailed)
      ? insect.hostPlantsDetailed
      : [];

    detailedPlants.forEach((hostPlant) => {
      const rawName = cleanString(hostPlant?.name);
      if (!rawName || isSuspiciousPlantName(rawName)) return;
      const normalized = normalizePlantNameLite(rawName) || rawName;
      const canonical =
        aliasToCanonical[normalized] ||
        aliasToCanonical[rawName] ||
        normalized;
      const detail = ensureDetail(canonical);
      if (hostPlant.family && hostPlant.family !== '不明') {
        detail.family = detail.family && detail.family !== '不明' ? detail.family : hostPlant.family;
        detail.familyName = detail.familyName || hostPlant.family;
      }
      detail.aliases.add(rawName);
      if (canonical !== normalized) {
        detail.aliases.add(normalized);
        if (!aliasToCanonical[normalized]) aliasToCanonical[normalized] = canonical;
      }
      if (rawName !== canonical && !aliasToCanonical[rawName]) {
        aliasToCanonical[rawName] = canonical;
      }
      if (!isFlowerVisitRecord(hostPlant)) {
        registerInsect(canonical, insectName);
      }
    });
  });

  Object.entries(plantDetailsRaw).forEach(([name, detail]) => {
    const canonical = aliasToCanonical[name] || name;
    const yDetail = ylistPlants[canonical] || ylistPlants[name];
    if (yDetail) {
      detail.family =
        detail.family && detail.family !== '不明'
          ? detail.family
          : yDetail.familyJp || detail.family;
      detail.familyName = detail.familyName || yDetail.familyJp || detail.family;
      detail.familyLatin = detail.familyLatin || yDetail.familyEn || '';
      detail.order = detail.order || yDetail.orderJp || '';
      detail.orderLatin = detail.orderLatin || yDetail.orderEn || '';
      const scientificName = yDetail.scientificName || detail.scientificName || '';
      detail.scientificName = scientificName || detail.scientificName || '';
      if (scientificName && !detail.genus) {
        detail.genus = scientificName.split(/\s+/)[0] || '';
      }
      (yDetail.aliases || []).forEach((alias) => {
        const trimmedAlias = cleanString(alias);
        if (!trimmedAlias) return;
        detail.aliases.add(trimmedAlias);
        if (!aliasToCanonical[trimmedAlias]) aliasToCanonical[trimmedAlias] = canonical;
      });
    }
    detail.aliases.add(name);
    if (!aliasToCanonical[name]) aliasToCanonical[name] = canonical;
  });

  const plantDetails = {};
  Object.entries(plantDetailsRaw).forEach(([name, detail]) => {
    const aliases = Array.from(detail.aliases)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ja'));
    plantDetails[name] = {
      name,
      family: detail.family || detail.familyName || '',
      familyName: detail.familyName || detail.family || '',
      familyLatin: detail.familyLatin || '',
      order: detail.order || '',
      orderLatin: detail.orderLatin || '',
      scientificName: detail.scientificName || '',
      genus: detail.genus || '',
      aliases,
    };
  });

  Object.keys(hostPlantsMap).forEach((plantName) => {
    hostPlantsMap[plantName] = Array.from(new Set(hostPlantsMap[plantName]))
      .sort((a, b) => a.localeCompare(b, 'ja'));
  });

  return { hostPlantsMap, plantDetails, aliasToCanonical };
}
