import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'assets', 'data-lite');

function readText(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function readFirstExistingText(paths) {
  for (const filePath of paths) {
    const text = readText(filePath);
    if (text) return text;
  }
  return '';
}

function parseCsv(text, opts = {}) {
  const normalizedText = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const result = Papa.parse(normalizedText, { header: true, skipEmptyLines: true, transformHeader: (h)=>h.trim(), ...opts });
  return result.data || [];
}

function mergeRowsById(primaryRows = [], secondaryRows = [], idKey = 'insect_id') {
  if (!Array.isArray(primaryRows) || primaryRows.length === 0) {
    return Array.isArray(secondaryRows) ? [...secondaryRows] : [];
  }
  const merged = [...primaryRows];
  const seen = new Set(
    primaryRows
      .map((row) => cleanString(row?.[idKey]))
      .filter(Boolean),
  );
  (secondaryRows || []).forEach((row) => {
    const id = cleanString(row?.[idKey]);
    if (!id || seen.has(id)) return;
    merged.push(row);
    seen.add(id);
  });
  return merged;
}

function normalizePlantNameLite(plantName) {
  if (!plantName || typeof plantName !== 'string') return '';
  let s = plantName.trim();
  if (!s || s === '不明') return '';
  // Remove (科) annotations and trailing/leading parens
  s = s.replace(/[（(][^）)]*科[^）)]*[）)]/g, '');
  s = s.replace(/[（(][^）)]*[）)]$/g, '');
  s = s.replace(/^[）)]/, '');
  return s.trim();
}

function normalizeScientificPlantAlias(name) {
  const trimmed = cleanString(name).replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .replace(/\s+(subsp\.|var\.|f\.)\s+[A-Za-z-]+.*$/i, '')
    .trim();
}

const cleanString = (value) => (value ?? '').toString().trim();
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

const isSuspiciousPlantName = (value) => SUSPICIOUS_PLANT_NAME_SET.has(cleanString(value));

const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = cleanString(record.lifeStage);
  const plantPart = cleanString(record.plantPart);
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

const firstNonEmpty = (...values) => {
  for (const v of values) {
    const trimmed = cleanString(v);
    if (trimmed) return trimmed;
  }
  return '';
};

function buildYListLite(rows, targets) {
  const plants = {};
  const familiesMap = {};
  const ordersMap = {};
  const aliasToCanonical = {};

  rows.forEach(row => {
    const name = cleanString(row['和名']);
    if (!name) return;
    const aliases = cleanString(row['別名'])
      .split(/[、,，;]/)
      .map(s => s.trim())
      .filter(Boolean);
    const matchTarget = !targets?.size || targets.has(name) || aliases.some(a => targets.has(a));
    if (!matchTarget) return;

    const familyJp = firstNonEmpty(row['LAPGII::LAPG科名'], row['LAPG 科名'], row['Cronquist 科名'], row['Engler 科名']);
    const familyEn = firstNonEmpty(row['LAPGII::LAPG Family狭義'], row['LAPGII::LAPG Family広義'], row['LAPG Family'], row['Cronquist family'], row['Engler family']);
    const orderJp = firstNonEmpty(row['LAPGII::LAPG 目'], row['LAPGII::LAPG Order']);
    const orderEn = firstNonEmpty(row['LAPGII::LAPG Order']);
    let scientificName = cleanString(row['学名']);
    if (!scientificName) scientificName = cleanString(row['学名 withAuthor']);

    const current = plants[name] || { familyJp: '', familyEn: '', orderJp: '', orderEn: '', scientificName: '', aliases: [] };
    current.familyJp = current.familyJp || familyJp;
    current.familyEn = current.familyEn || familyEn;
    current.orderJp = current.orderJp || orderJp;
    current.orderEn = current.orderEn || orderEn;
    current.scientificName = current.scientificName || scientificName;
    const aliasSet = new Set([...(current.aliases || []), ...aliases]);
    current.aliases = Array.from(aliasSet);
    plants[name] = current;

    if (current.familyJp) {
      if (!familiesMap[current.familyJp]) familiesMap[current.familyJp] = [];
      if (!familiesMap[current.familyJp].includes(name)) familiesMap[current.familyJp].push(name);
    }
    if (current.orderJp) {
      if (!ordersMap[current.orderJp]) ordersMap[current.orderJp] = [];
      if (!ordersMap[current.orderJp].includes(name)) ordersMap[current.orderJp].push(name);
    }

    aliases.forEach(alias => {
      if (!aliasToCanonical[alias]) aliasToCanonical[alias] = name;
    });
  });

  return { plants, familiesMap, ordersMap, aliasToCanonical };
}

function augmentYListLiteWithScientificAliases(lite = {}) {
  const plants = lite?.plants && typeof lite.plants === 'object' ? lite.plants : {};
  const scientificAliasBuckets = new Map();

  Object.entries(plants).forEach(([canonical, detail]) => {
    const scientificName = cleanString(detail?.scientificName);
    if (!canonical || !scientificName) return;
    const aliasCandidates = new Set([
      scientificName,
      normalizeScientificPlantAlias(scientificName),
    ].filter(Boolean));

    aliasCandidates.forEach((alias) => {
      if (!scientificAliasBuckets.has(alias)) {
        scientificAliasBuckets.set(alias, new Set());
      }
      scientificAliasBuckets.get(alias).add(canonical);
    });
  });

  const aliasToCanonical = { ...(lite?.aliasToCanonical || {}) };
  scientificAliasBuckets.forEach((canonicals, alias) => {
    if (canonicals.size !== 1) return;
    if (aliasToCanonical[alias]) return;
    aliasToCanonical[alias] = Array.from(canonicals)[0];
  });

  return {
    plants,
    familiesMap: lite?.familiesMap && typeof lite.familiesMap === 'object' ? lite.familiesMap : {},
    ordersMap: lite?.ordersMap && typeof lite.ordersMap === 'object' ? lite.ordersMap : {},
    aliasToCanonical,
  };
}

const repairScientificBinomial = (name) => {
  if (!name || typeof name !== 'string') return name || '';
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(' ')) return trimmed;
  const match = trimmed.match(/^([A-Z][a-z]+)([a-z-]{3,})(.*)$/);
  if (match) return `${match[1]} ${match[2]}${match[3] || ''}`.trim();
  return trimmed;
};

const fixScientificNames = (records = []) => records.map(item => ({
  ...item,
  scientificName: repairScientificBinomial(item.scientificName)
}));

const isEmergenceNoteGeneric = (note) => {
  if (!note) return false;
  const type = cleanString(note.type);
  const content = cleanString(note.content);
  if (!content || content === '不明') return false;
  const typeHit = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期']
    .some(keyword => type.includes(keyword));
  const contentHit = /\d+\s*月|春|夏|秋|冬|上旬|中旬|下旬|頃/.test(content);
  return typeHit || (!type && contentHit);
};

const fillEmergenceFromNotes = (records = []) => records.map(item => {
  if (!item) return item;
  if (item.emergenceTime && item.emergenceTime !== '不明') return item;
  const note = (item.generalNotes || []).find(isEmergenceNoteGeneric);
  if (note && note.content) {
    return {
      ...item,
      emergenceTime: note.content,
      emergenceTimeSource: note.reference || item.emergenceTimeSource || '',
      emergenceTimeDescription: note.page ? `p.${note.page}` : (item.emergenceTimeDescription || '')
    };
  }
  return item;
});

const processInsects = (records = []) => fillEmergenceFromNotes(fixScientificNames(records));

function buildHostPlantDataset(allInsects = [], ylistLite = {}) {
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
        aliases: new Set()
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

  allInsects.forEach(insect => {
    const insectName = insect?.name;
    if (!insectName) return;
    (insect.hostPlantsDetailed || []).forEach(hp => {
      const rawName = cleanString(hp?.name);
      if (!rawName) return;
      const normalized = normalizePlantNameLite(rawName) || rawName;
      const canonical = aliasToCanonical[normalized] || aliasToCanonical[rawName] || normalized;
      const detail = ensureDetail(canonical);
      if (hp.family && hp.family !== '不明') {
        detail.family = detail.family && detail.family !== '不明' ? detail.family : hp.family;
        detail.familyName = detail.familyName || hp.family;
      }
      detail.aliases.add(rawName);
      if (canonical !== normalized) {
        detail.aliases.add(normalized);
        if (!aliasToCanonical[normalized]) aliasToCanonical[normalized] = canonical;
      }
      if (rawName !== canonical && !aliasToCanonical[rawName]) {
        aliasToCanonical[rawName] = canonical;
      }
      if (!isFlowerVisitRecord(hp)) {
        registerInsect(canonical, insectName);
      }
    });
  });

  Object.entries(plantDetailsRaw).forEach(([name, detail]) => {
    const canonical = aliasToCanonical[name] || name;
    const yDetail = ylistPlants[canonical] || ylistPlants[name];
    if (yDetail) {
      detail.family = detail.family && detail.family !== '不明' ? detail.family : yDetail.familyJp || detail.family;
      detail.familyName = detail.familyName || yDetail.familyJp || detail.family;
      detail.familyLatin = detail.familyLatin || yDetail.familyEn || '';
      detail.order = detail.order || yDetail.orderJp || '';
      detail.orderLatin = detail.orderLatin || yDetail.orderEn || '';
      const sci = yDetail.scientificName || detail.scientificName || '';
      detail.scientificName = sci || detail.scientificName || '';
      if (sci && !detail.genus) {
        detail.genus = sci.split(/\s+/)[0] || '';
      }
      (yDetail.aliases || []).forEach(alias => {
        const aliasTrimmed = alias.trim();
        if (!aliasTrimmed) return;
        detail.aliases.add(aliasTrimmed);
        if (!aliasToCanonical[aliasTrimmed]) aliasToCanonical[aliasTrimmed] = canonical;
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
      aliases
    };
  });

  Object.keys(hostPlantsMap).forEach(key => {
    hostPlantsMap[key] = Array.from(new Set(hostPlantsMap[key])).sort((a, b) => a.localeCompare(b, 'ja'));
  });

  return { hostPlantsMap, plantDetails, aliasToCanonical };
}

async function build() {
  console.log('[data-lite] start');
  const normalizedInsectsCsv = readText(path.join(ROOT, 'normalized_data', 'insects.csv'));
  const publicInsectsCsv = readText(path.join(PUBLIC_DIR, 'insects.csv'));
  const hostplantsCsv = readFirstExistingText([
    path.join(ROOT, 'normalized_data', 'hostplants.csv'),
    path.join(PUBLIC_DIR, 'hostplants.csv'),
  ]);
  const notesCsv = readFirstExistingText([
    path.join(ROOT, 'normalized_data', 'general_notes.csv'),
    path.join(PUBLIC_DIR, 'general_notes.csv'),
  ]);
  const ylistLitePath = path.join(OUT_DIR, 'ylist-lite.json');

  if ((!normalizedInsectsCsv && !publicInsectsCsv) || !hostplantsCsv) {
    console.warn('[data-lite] required normalized CSVs not found; skipping');
    return;
  }

  const insects = mergeRowsById(
    parseCsv(normalizedInsectsCsv || publicInsectsCsv),
    normalizedInsectsCsv && publicInsectsCsv ? parseCsv(publicInsectsCsv) : [],
  );
  const hostplantsRaw = parseCsv(hostplantsCsv);
  const suspiciousHostplants = hostplantsRaw.filter((row) => isSuspiciousPlantName(row?.plant_name));
  if (suspiciousHostplants.length > 0) {
    console.warn(`[data-lite] filtered suspicious hostplant rows: ${suspiciousHostplants.length}`);
  }
  const hostplants = hostplantsRaw.filter((row) => !isSuspiciousPlantName(row?.plant_name));
  const notes = parseCsv(notesCsv);
  const ylistCsv = readText(path.join(PUBLIC_DIR, '20210514YList_download.csv'));
  const ylistRows = ylistCsv ? parseCsv(ylistCsv) : [];

  // Import converter from app util (ESM)
  const { convertNormalizedDataToStandardFormat } = await import(path.join(ROOT, 'src', 'utils', 'normalizedDataParser.js'));
  const normalized = convertNormalizedDataToStandardFormat(insects, hostplants, notes);

  // Slim each record for list/search use
const slim = (arr) => (arr || []).map(i => ({
    id: i.id,
    name: i.name,
    scientificName: i.scientificName,
    scientificFilename: i.scientificFilename || '',
    alternativeNames: i.alternativeNames || '',
    type: i.type,
    classification: i.classification || {},
    hostPlants: Array.isArray(i.hostPlants) ? i.hostPlants.slice() : [],
    hostPlantsDetailed: Array.isArray(i.hostPlantsDetailed) ? i.hostPlantsDetailed : [],
    generalNotes: Array.isArray(i.generalNotes) ? i.generalNotes : [],
    emergenceTimeDetailed: Array.isArray(i.emergenceTimeDetailed) ? i.emergenceTimeDetailed : [],
    notes: i.emergenceTime || i.notes || '',
    emergenceTime: i.emergenceTime || ''
  }));

  const slimmedCollections = Object.fromEntries(
    INSECT_COLLECTION_KEYS.map((key) => [key, slim(normalized[key])]),
  );

  // Build lightweight host plant map using full normalized host plant data
  const hostPlantsMap = {};
  const addPlants = (insect) => {
    const insectName = insect.name?.trim();
    if (!insectName) return;
    (insect.hostPlants || []).forEach(raw => {
      const key = normalizePlantNameLite(raw);
      if (!key) return;
      if (!hostPlantsMap[key]) hostPlantsMap[key] = [];
      if (!hostPlantsMap[key].includes(insectName)) hostPlantsMap[key].push(insectName);
    });
  };
  INSECT_COLLECTION_KEYS.flatMap((key) => normalized[key] || []).forEach(addPlants);

  // Ensure output dir
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Write split files for lazy loading
  const write = (name, data) => {
    const p = path.join(OUT_DIR, name);
    fs.writeFileSync(p, JSON.stringify(data), 'utf-8');
    const size = fs.statSync(p).size;
    console.log('[data-lite] wrote', p, `size=${size} bytes`);
  };

  INSECT_COLLECTION_KEYS.forEach((key) => {
    write(`${key}.json`, slimmedCollections[key]);
  });
  write('hostplants.json', hostPlantsMap);
  const manifest = {
    counts: {
      ...Object.fromEntries(
        INSECT_COLLECTION_KEYS.map((key) => [key, slimmedCollections[key].length]),
      ),
      hostPlants: Object.keys(hostPlantsMap).length
    },
    version: Date.now()
  };
  write('manifest.json', manifest);

  // Keep combined index for backward compatibility
  const out = { ...slimmedCollections, hostPlants: hostPlantsMap };
  write('index.json', out);

  // Build and write full dataset for runtime consumption
  const existingYListLiteText = readText(ylistLitePath);
  const existingYListLite = (() => {
    if (!existingYListLiteText) return null;
    try {
      return JSON.parse(existingYListLiteText);
    } catch (error) {
      console.warn('[data-lite] failed to parse existing ylist-lite.json:', error?.message || error);
      return null;
    }
  })();
  const hostPlantTargets = new Set(
    hostplants
      .map(r => cleanString(r.plant_name))
      .filter(name => name && name !== '不明' && !isSuspiciousPlantName(name))
  );
  const builtYListLite = ylistRows.length > 0
    ? buildYListLite(ylistRows, hostPlantTargets)
    : (existingYListLite || { plants: {}, familiesMap: {}, ordersMap: {}, aliasToCanonical: {} });
  const ylistLite = augmentYListLiteWithScientificAliases(builtYListLite);
  if (
    Object.keys(ylistLite.plants || {}).length > 0 ||
    Object.keys(ylistLite.aliasToCanonical || {}).length > 0
  ) {
    write('ylist-lite.json', ylistLite);
  }
  const processedCollections = Object.fromEntries(
    INSECT_COLLECTION_KEYS.map((key) => [key, processInsects(normalized[key])]),
  );
  const { hostPlantsMap: fullHostPlants, plantDetails, aliasToCanonical } = buildHostPlantDataset(
    INSECT_COLLECTION_KEYS.flatMap((key) => processedCollections[key]),
    ylistLite
  );
  const fullDataset = {
    version: Date.now(),
    summaryCounts: {
      ...Object.fromEntries(
        INSECT_COLLECTION_KEYS.map((key) => [key, processedCollections[key].length]),
      ),
      hostPlants: Object.keys(fullHostPlants).length
    },
    ...processedCollections,
    hostPlants: fullHostPlants,
    plantDetails,
    aliasToCanonical
  };
  write('full-dataset.json', fullDataset);
}

build().catch(err => {
  console.error('[data-lite] failed:', err);
  process.exit(1);
});
