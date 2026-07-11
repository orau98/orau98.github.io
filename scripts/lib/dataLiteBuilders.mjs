import { isNonPlantResourceName, isPlantHostRecord } from '../../src/utils/hostResource.js';

export { isNonPlantResourceName, isPlantHostRecord };

export const cleanString = (value) => (value ?? '').toString().trim();

// 科・目のラテン名の大文字小文字ゆれ（ROSACEAE / rosaceae 等）を正規形
// （先頭大文字+小文字）へ統一する。出典によって表記が割れると、英語UIの
// 科フィルタが同一科を別項目として分裂させ、どれを選んでも部分集合しか
// 表示されなくなる
export const normalizeLatinTaxonName = (value = '') => {
  const v = cleanString(value);
  if (!/^[A-Za-z]+$/.test(v)) return v;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

export const SUSPICIOUS_PLANT_NAME_SET = new Set([
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
  // 植物ではない/曖昧すぎるホスト記録（菌類・動物質・総称）。昆虫側の食性記録としては
  // 残すが、植物一覧・植物ページには載せない。
  'カワラタケ  などの菌類',
  'カワラタケ (サルノコシカケ科) などの菌',
  '魚粉などの動物質',
  'シリアル食品や豆類などの植物性のもの',
  'アブラナ科その他の草本など多種の植物',
  '多種の植物',
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

// メタページ生成（scripts/generate-meta-pages.js の isValidPlantName）と同基準で
// 「植物として表示・ページ化する価値のある名前か」を判定する。
// data-lite の植物インデックスにも同じ基準を適用することで、
// 「SPA一覧には出るがメタページが無く外部からは404」という不整合を防ぐ。
const INVALID_PLANT_NAME_PATTERNS = [
  /科が$/, // 「キョウチクトウ科が」
  /^記録[）)]?$/,
  /^が記録[）)]?$/,
  /^[)）][^(（]*$/, // 「）」で始まる（括弧の後半のみ・全角/半角対応）
  /^[,、，]/,
  /[(（][^)）]*$/, // 閉じ括弧のない括弧
];
const DESCRIPTIVE_PLANT_NAME_PATTERNS = [
  /野外で/, /飼育下で/, /から記録/, /による飼育/, /幼虫[がはを]/, /成虫[がはを]/,
  /海外では/, /ヨーロッパでは/, /日本では/, /を食[すし]/, /を好む/, /から[得発]られ/,
  /ことが[判知]明/, /推[測定]される/, /と[思考]われる/, /に固有/, /に寄生/, /害虫/,
  /栽培/, /発生する/, /生息/, /分布/, /寄主植物/, /とするが$/, /植物で$/, /植物であるが$/,
  /が主な/, /を主な/, /から子実体へ/, /の樹皮下から/,
];
const TAXONOMIC_TOKEN_PATTERNS = [
  /^comb\.\s*nov\.?$/i, /^sp\.?$/i, /^spp\.?$/i, /^var\.?$/i, /^subsp\.?$/i,
  /^f\.?$/i, /^emend\.?$/i, /^nom\.\s*nud\.?$/i, /^auct\.?$/i, /^non$/i,
  /^sensu$/i, /^cf\.?$/i, /^aff\.?$/i,
];

export const isValidPlantName = (plantName) => {
  const trimmed = cleanString(plantName);
  if (!trimmed || trimmed === '不明') return false;
  if (SUSPICIOUS_PLANT_NAME_SET.has(trimmed)) return false;
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (/^[[(（]?\s*\d{3,4}\s*[\])）)]*\s*$/.test(trimmed)) return false;
  if (INVALID_PLANT_NAME_PATTERNS.some((p) => p.test(trimmed))) return false;
  if (/[。．]/.test(trimmed) || /で(飼育|採卵|得られ|記録)/.test(trimmed) || /による/.test(trimmed) || /からの/.test(trimmed)) return false;
  if (/^[-ー]/.test(trimmed)) return false;
  if (/^\([^)]*\)$/.test(trimmed)) return false;
  if (TAXONOMIC_TOKEN_PATTERNS.some((p) => p.test(trimmed))) return false;
  if (/[0-9０-９]月[上中下]旬|[0-9０-９]月頃/.test(trimmed)) return false;
  if (DESCRIPTIVE_PLANT_NAME_PATTERNS.some((p) => p.test(trimmed))) return false;
  if (/^[0-9０-９]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) return false;
  // 純ラテンの二名法・属名連結（例「ハシバミ属 Corylus」「Carex sp」）も、
  // 最低限の日本語文字を要求することで弾く
  if (!/[あ-んア-ヶー一-龯]/.test(trimmed)) return false;
  if (/^[A-Z][a-z]+[,\s]+\d{4}/.test(trimmed)) return false;
  return true;
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

const GENUS_JP_CORRECTIONS = new Map([
  ['クロッグ属', 'クロツグ属'],
  ['シマセンプリ属', 'シマセンブリ属'],
  ['センプリ属', 'センブリ属'],
  ['タニウッギ属', 'タニウツギ属'],
  ['ックバネウッギ属', 'ツクバネウツギ属'],
  ['ヒメセンプリ属', 'ヒメセンブリ属'],
]);

const normalizeGenusJp = (value) => {
  const genusJp = cleanString(value);
  return GENUS_JP_CORRECTIONS.get(genusJp) || genusJp;
};

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

const scientificGenus = (value) => {
  const match = cleanString(value).match(/[A-Za-z][A-Za-z-]*/);
  return match ? match[0].toLowerCase() : '';
};

const profileConflictsWithYlistAlias = (profile, canonical, ylistPlants) => {
  if (!canonical || canonical === profile.name) return false;
  const yDetail = ylistPlants?.[canonical];
  if (!yDetail) return false;
  const profileGenus = scientificGenus(profile.scientificName);
  const ylistGenus = scientificGenus(yDetail.scientificName);
  return Boolean(profileGenus && ylistGenus && profileGenus !== ylistGenus);
};

const familyConflictsWithYlistAlias = (family, canonical, ylistPlants) => {
  const sourceFamily = cleanString(family);
  if (!sourceFamily || !canonical) return false;
  const canonicalFamily = cleanString(ylistPlants?.[canonical]?.familyJp);
  return Boolean(canonicalFamily && canonicalFamily !== sourceFamily);
};

const resolvePlantCanonical = (rawName, family, aliasToCanonical, ylistPlants) => {
  const normalized = normalizePlantNameLite(rawName) || rawName;
  const aliasCanonical =
    aliasToCanonical[normalized] ||
    aliasToCanonical[rawName] ||
    '';
  const preserveLocalTaxonomy = familyConflictsWithYlistAlias(family, aliasCanonical, ylistPlants);
  return {
    normalized,
    canonical: preserveLocalTaxonomy ? normalized : (aliasCanonical || normalized),
    preserveLocalTaxonomy,
  };
};

const profileGenusJpSupported = (profile, yDetail) => {
  const genusJp = cleanString(profile?.genusJp);
  if (!genusJp) return true;
  const profileGenus = scientificGenus(profile?.genus);
  const referenceGenus = scientificGenus(yDetail?.scientificName) || scientificGenus(profile?.scientificName);
  return Boolean(!profileGenus || !referenceGenus || profileGenus === referenceGenus);
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
  const ylistPlants = ylistLite.plants || {};

  allInsects.forEach((insect) => {
    const insectName = cleanString(insect?.name || insect?.japaneseName);
    if (!insectName) return;
    const records = Array.isArray(insect?.hostPlantsDetailed) ? insect.hostPlantsDetailed : [];
    records.forEach((record) => {
      if (!isPlantHostRecord(record)) return;
      if (!isFlowerVisitRecord(record)) return;
      const rawName = cleanString(record?.displayName || record?.name || record?.plant);
      if (!rawName || isSuspiciousPlantName(rawName)) return;
      const { canonical } = resolvePlantCanonical(
        rawName,
        record?.family,
        aliasToCanonical,
        ylistPlants,
      );
      if (!canonical || canonical === '不明') return;
      // 訪花植物も同じメタページ基準でフィルタし、植物一覧・詳細の整合を保つ
      if (!isValidPlantName(canonical)) return;
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
        familyLatin: normalizeLatinTaxonName(row?.family_latin),
        genus: cleanString(row?.genus_scientific),
        genusJp: normalizeGenusJp(row?.genus_jp),
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
        preserveProfileTaxonomy: false,
        preserveAliasTaxonomy: false,
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
      if (!isPlantHostRecord(hostPlant) || isNonPlantResourceName(rawName)) return;
      if (!rawName || isSuspiciousPlantName(rawName)) return;
      const { normalized, canonical, preserveLocalTaxonomy } = resolvePlantCanonical(
        rawName,
        hostPlant?.family,
        aliasToCanonical,
        ylistPlants,
      );
      // 正規化後の表示名がメタページ基準で無効なら、植物データセットに載せない
      // （SPA一覧・詳細に出るがメタページが無く外部から404、を防ぐ）
      if (!isValidPlantName(canonical)) return;
      const detail = ensureDetail(canonical);
      if (preserveLocalTaxonomy) {
        detail.preserveAliasTaxonomy = true;
      }
      if (hostPlant.family && hostPlant.family !== '不明') {
        detail.family = detail.family && detail.family !== '不明' ? detail.family : hostPlant.family;
        detail.familyName = detail.familyName || hostPlant.family;
      }
      detail.aliases.add(rawName);
      if (!preserveLocalTaxonomy && canonical !== normalized) {
        detail.aliases.add(normalized);
        if (!aliasToCanonical[normalized]) aliasToCanonical[normalized] = canonical;
      }
      if (!preserveLocalTaxonomy && rawName !== canonical && !aliasToCanonical[rawName]) {
        aliasToCanonical[rawName] = canonical;
      }
      if (!isFlowerVisitRecord(hostPlant)) {
        registerInsect(canonical, insectName);
      }
    });
  });

  plantProfiles.forEach((profile) => {
    const profileHasFacts = plantProfileFactScore(profile) > 0;
    if (!profileHasFacts) return;
    const aliasCanonical =
      aliasToCanonical[profile.name] ||
      aliasToCanonical[normalizePlantNameLite(profile.name)] ||
      profile.name;
    const preserveProfileTaxonomy = profileConflictsWithYlistAlias(profile, aliasCanonical, ylistPlants);
    const canonical = preserveProfileTaxonomy ? profile.name : aliasCanonical;
    const yDetailForProfile = preserveProfileTaxonomy
      ? ylistPlants[profile.name]
      : (ylistPlants[canonical] || ylistPlants[profile.name]);
    const detail = ensureDetail(canonical);
    if (preserveProfileTaxonomy) {
      detail.preserveProfileTaxonomy = true;
    }
    detail.family = profile.family || (detail.family && detail.family !== '不明' ? detail.family : '');
    detail.familyName = profile.family || detail.familyName || detail.family;
    detail.familyLatin = normalizeLatinTaxonName(profile.familyLatin || detail.familyLatin || '');
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
      genusJp: profileGenusJpSupported(profile, yDetailForProfile) ? profile.genusJp : '',
      extractionMethod: profile.extractionMethod,
    };
    detail.profileHasFacts = true;
  });

  Object.entries(plantDetailsRaw).forEach(([name, detail]) => {
    const preserveLocalTaxonomy = detail.preserveProfileTaxonomy || detail.preserveAliasTaxonomy;
    const canonical = preserveLocalTaxonomy ? name : (aliasToCanonical[name] || name);
    const yDetail = preserveLocalTaxonomy
      ? ylistPlants[name]
      : (ylistPlants[canonical] || ylistPlants[name]);
    if (yDetail) {
      detail.family = yDetail.familyJp || detail.family || '';
      detail.familyName = yDetail.familyJp || detail.familyName || detail.family;
      detail.familyLatin = normalizeLatinTaxonName(yDetail.familyEn || detail.familyLatin || '');
      detail.order = yDetail.orderJp || detail.order || '';
      detail.orderLatin = normalizeLatinTaxonName(yDetail.orderEn || detail.orderLatin || '');
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
    if (!preserveLocalTaxonomy && !aliasToCanonical[name]) aliasToCanonical[name] = canonical;
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
