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

const SUSPICIOUS_PLANT_NAME_PATTERNS = [
  /^[,、，]/,
  /^の/,
  /^(および|およぴ|と)/,
  /^(であり|であるが|には少ない|に多く|これらの植物と混生していれば|の一種)$/,
  /菌類に侵された|枯れ(?:葉|木|枝|菜)|朽ち木|樹皮下|樹皮|材部|被害果|落ち葉/,
  /[(（][^)）]*$/,   // 閉じ括弧のない括弧を含む（例：「Spiraea nipponica(本州」）
];

export function normalizePlantNameLite(plantName) {
  if (!plantName || typeof plantName !== 'string') return '';
  let value = plantName.trim();
  if (!value || value === '不明') return '';
  value = value.replace(/[（(][^）)]*科[^）)]*[）)]/g, '');
  value = value.replace(/[（(][^）)]*[）)]$/g, '');
  value = value.replace(/^[）)]/, '');
  return value.trim();
}

export const isSuspiciousPlantName = (value) => {
  const normalized = cleanString(value);
  if (!normalized) return false;
  return (
    SUSPICIOUS_PLANT_NAME_SET.has(normalized) ||
    SUSPICIOUS_PLANT_NAME_PATTERNS.some((pattern) => pattern.test(normalized))
  );
};

export const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = cleanString(record.lifeStage);
  const plantPart = cleanString(record.plantPart);
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

const PLANT_PROFILE_FACT_FIELDS = ['habit', 'height', 'flowerPeriod', 'distribution', 'habitat'];

const plantProfileFactScore = (profile) =>
  PLANT_PROFILE_FACT_FIELDS.reduce((score, field) => score + (cleanString(profile?.[field]) ? 1 : 0), 0);

const plantProfileScore = (profile) => {
  const factScore = plantProfileFactScore(profile) * 4;
  const familyScore = cleanString(profile?.family) && cleanString(profile?.familyLatin) ? 2 : 0;
  const taxonScore = ['genus', 'genusJp', 'scientificName'].reduce(
    (score, field) => score + (cleanString(profile?.[field]) ? 1 : 0),
    0,
  );
  return factScore + familyScore + taxonScore;
};

const isBetterPlantProfile = (candidate, current) => {
  if (!current) return true;
  const candidateScore = plantProfileScore(candidate);
  const currentScore = plantProfileScore(current);
  if (candidateScore !== currentScore) return candidateScore > currentScore;
  const candidatePage = Number.parseInt(candidate?.page, 10);
  const currentPage = Number.parseInt(current?.page, 10);
  if (Number.isFinite(candidatePage) && Number.isFinite(currentPage)) {
    return candidatePage < currentPage;
  }
  return false;
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

export function normalizePlantProfileRows(rows = []) {
  const bestByName = new Map();
  (rows || [])
    .forEach((row) => {
      const name = cleanString(row?.plant_name);
      if (!name || name === '不明' || isSuspiciousPlantName(name)) return;
      const profile = {
        name,
        scientificName: cleanString(row?.scientific_name),
        family: cleanString(row?.family),
        familyLatin: cleanString(row?.family_latin),
        genus: cleanString(row?.genus_scientific),
        genusJp: cleanString(row?.genus_jp),
        habit: cleanString(row?.habit),
        height: cleanString(row?.height),
        flowerPeriod: cleanString(row?.flower_period),
        distribution: cleanString(row?.distribution),
        habitat: cleanString(row?.habitat),
        source: cleanString(row?.source),
        page: cleanString(row?.page),
        extractionMethod: cleanString(row?.extraction_method),
      };
      if (isBetterPlantProfile(profile, bestByName.get(name))) {
        bestByName.set(name, profile);
      }
    });
  return Array.from(bestByName.values());
}

export function buildHostPlantDataset(allInsects = [], ylistLite = {}, plantProfilesInput = []) {
  const hostPlantsMap = {};
  const plantDetailsRaw = {};
  const aliasToCanonical = { ...(ylistLite.aliasToCanonical || {}) };
  const ylistPlants = ylistLite.plants || {};
  const plantProfiles = normalizePlantProfileRows(plantProfilesInput);

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
        profile: null,
        profileHasFacts: false,
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

  plantProfiles.forEach((profile) => {
    const canonical =
      aliasToCanonical[profile.name] ||
      aliasToCanonical[normalizePlantNameLite(profile.name)] ||
      profile.name;
    const detail = ensureDetail(canonical);
    detail.family = profile.family || (detail.family && detail.family !== '不明' ? detail.family : '');
    detail.familyName = profile.family || detail.familyName || detail.family;
    detail.familyLatin = profile.familyLatin || detail.familyLatin || '';
    detail.scientificName = detail.scientificName || profile.scientificName;
    const profileLatinGenus = profile.scientificName
      ? profile.scientificName.split(/\s+/)[0] || ''
      : '';
    detail.genus =
      detail.genus ||
      profileLatinGenus ||
      profile.genus;
    detail.aliases.add(profile.name);
    if (canonical !== profile.name && !aliasToCanonical[profile.name]) {
      aliasToCanonical[profile.name] = canonical;
    }
    detail.profile = {
      source: profile.source,
      page: profile.page,
      habit: profile.habit,
      height: profile.height,
      flowerPeriod: profile.flowerPeriod,
      distribution: profile.distribution,
      habitat: profile.habitat,
      genusJp: profile.genusJp,
      extractionMethod: profile.extractionMethod,
    };
    detail.profileHasFacts = plantProfileFactScore(profile) > 0;
  });

  Object.entries(plantDetailsRaw).forEach(([name, detail]) => {
    const canonical = aliasToCanonical[name] || name;
    const yDetail = ylistPlants[canonical] || ylistPlants[name];
    if (yDetail) {
      const hasProfileFamily = Boolean(detail.profileHasFacts && detail.family && detail.familyLatin);
      detail.family = hasProfileFamily ? detail.family : (yDetail.familyJp || detail.family || '');
      detail.familyName = hasProfileFamily ? (detail.familyName || detail.family) : (yDetail.familyJp || detail.familyName || detail.family);
      detail.familyLatin = hasProfileFamily ? detail.familyLatin : (yDetail.familyEn || detail.familyLatin || '');
      detail.order = yDetail.orderJp || detail.order || '';
      detail.orderLatin = yDetail.orderEn || detail.orderLatin || '';
      const scientificName = yDetail.scientificName || detail.scientificName || '';
      detail.scientificName = scientificName || detail.scientificName || '';
      if (scientificName) {
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
      profile: detail.profile || null,
      aliases,
    };
  });

  Object.keys(hostPlantsMap).forEach((plantName) => {
    hostPlantsMap[plantName] = Array.from(new Set(hostPlantsMap[plantName]))
      .sort((a, b) => a.localeCompare(b, 'ja'));
  });

  return { hostPlantsMap, plantDetails, aliasToCanonical };
}
