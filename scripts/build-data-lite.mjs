import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath, pathToFileURL } from 'url';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';
import {
  buildFlowerVisitPlantDataset,
  buildHostPlantDataset,
  cleanString,
  isNonPlantResourceName,
  isSuspiciousPlantName,
  isValidPlantName,
} from './lib/dataLiteBuilders.mjs';

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

function normalizeScientificPlantAlias(name) {
  const trimmed = cleanString(name).replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .replace(/\s+(subsp\.|var\.|f\.)\s+[A-Za-z-]+.*$/i, '')
    .trim();
}

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
  const resourceHostplants = hostplantsRaw.filter((row) => isNonPlantResourceName(row?.plant_name));
  if (suspiciousHostplants.length > 0) {
    console.warn(`[data-lite] filtered suspicious hostplant rows from plant index: ${suspiciousHostplants.length}`);
  }
  if (resourceHostplants.length > 0) {
    console.warn(`[data-lite] filtered non-plant resource rows from plant index: ${resourceHostplants.length}`);
  }
  const hostplantsForInsects = hostplantsRaw.filter(
    (row) => !isSuspiciousPlantName(row?.plant_name) || isNonPlantResourceName(row?.plant_name),
  );
  // 植物インデックス（一覧カード・植物ページの母集団）はメタページ生成と同じ
  // isValidPlantName 基準で厳格にフィルタし、「SPAには出るがメタページが無く
  // 外部からは404」という不整合（栽培◯◯・純ラテン属名・文章断片等）を防ぐ。
  const invalidIndexHostplants = hostplantsRaw.filter(
    (row) =>
      !isSuspiciousPlantName(row?.plant_name) &&
      !isNonPlantResourceName(row?.plant_name) &&
      !isValidPlantName(row?.plant_name),
  );
  if (invalidIndexHostplants.length > 0) {
    console.warn(`[data-lite] filtered invalid plant-index names (meta parity): ${invalidIndexHostplants.length}`);
  }
  const hostplants = hostplantsRaw.filter(
    (row) =>
      !isSuspiciousPlantName(row?.plant_name) &&
      !isNonPlantResourceName(row?.plant_name) &&
      isValidPlantName(row?.plant_name),
  );
  const notes = parseCsv(notesCsv);
  const ylistCsv = readText(path.join(PUBLIC_DIR, '20210514YList_download.csv'));
  const ylistRows = ylistCsv ? parseCsv(ylistCsv) : [];
  const plantProfilesCsv = readFirstExistingText([
    path.join(ROOT, 'normalized_data', 'plant_profiles.csv'),
    path.join(PUBLIC_DIR, 'plant_profiles.csv'),
  ]);
  const plantProfiles = plantProfilesCsv ? parseCsv(plantProfilesCsv) : [];

  // Import converter from app util (ESM)
  const { convertNormalizedDataToStandardFormat } = await import(pathToFileURL(path.join(ROOT, 'src', 'utils', 'normalizedDataParser.js')).href);
  const normalized = convertNormalizedDataToStandardFormat(insects, hostplantsForInsects, notes);

  // Slim each record for list/search use
const slim = (arr) => (arr || []).map(i => ({
    id: i.id,
    name: i.name,
    scientificName: i.scientificName,
    scientificFilename: i.scientificFilename || '',
    alternativeNames: i.alternativeNames || '',
    synonyms: i.synonyms || '',
    type: i.type,
    classification: i.classification || {},
    hostPlants: Array.isArray(i.hostPlants) ? i.hostPlants.slice() : [],
    hostPlantsDetailed: Array.isArray(i.hostPlantsDetailed) ? i.hostPlantsDetailed : [],
    generalNotes: Array.isArray(i.generalNotes) ? i.generalNotes : [],
    emergenceTimeDetailed: Array.isArray(i.emergenceTimeDetailed) ? i.emergenceTimeDetailed : [],
    notes: i.notes || '',
    emergenceTime: i.emergenceTime || ''
  }));

  const slimmedCollections = Object.fromEntries(
    INSECT_COLLECTION_KEYS.map((key) => [key, slim(normalized[key])]),
  );

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

  // Build and write full dataset for runtime consumption
  // ylist-lite source resolution, in priority order:
  //   1. public/20210514YList_download.csv  (original YList CSV, currently not in the repo)
  //   2. normalized_data/ylist-lite.json    (canonical committed snapshot)
  //   3. public/assets/data-lite/ylist-lite.json (legacy fallback)
  // The frontend resolves plant aliases/families from this file, so a missing or
  // empty result must fail the build instead of silently degrading the site.
  const readJsonIfValid = (filePath, label) => {
    const text = readText(filePath);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn(`[data-lite] failed to parse ${label}:`, error?.message || error);
      return null;
    }
  };
  const ylistSnapshotPath = path.join(ROOT, 'normalized_data', 'ylist-lite.json');
  const hostPlantTargets = new Set(
    hostplants
      .map(r => cleanString(r.plant_name))
      .filter(name => name && name !== '不明' && !isSuspiciousPlantName(name) && !isNonPlantResourceName(name))
  );
  let builtYListLite = null;
  if (ylistRows.length > 0) {
    builtYListLite = buildYListLite(ylistRows, hostPlantTargets);
    console.log('[data-lite] ylist-lite built from public/20210514YList_download.csv');
  } else {
    builtYListLite = readJsonIfValid(ylistSnapshotPath, 'normalized_data/ylist-lite.json');
    if (builtYListLite) {
      console.log('[data-lite] ylist-lite loaded from normalized_data/ylist-lite.json snapshot');
    } else {
      builtYListLite = readJsonIfValid(ylistLitePath, 'existing ylist-lite.json');
      if (builtYListLite) {
        console.warn(
          '[data-lite] ylist-lite reused from previous public output; ' +
          'restore normalized_data/ylist-lite.json so the source of truth is tracked.',
        );
      }
    }
  }
  const ylistLite = augmentYListLiteWithScientificAliases(
    builtYListLite || { plants: {}, familiesMap: {}, ordersMap: {}, aliasToCanonical: {} },
  );
  if (
    Object.keys(ylistLite.plants || {}).length === 0 &&
    Object.keys(ylistLite.aliasToCanonical || {}).length === 0
  ) {
    throw new Error(
      '[data-lite] ylist-lite.json would be empty: no YList CSV, no normalized_data/ylist-lite.json ' +
      'snapshot, and no previous output found. Aborting so plant alias/family resolution does not break.',
    );
  }
  write('ylist-lite.json', ylistLite);
  const processedCollections = Object.fromEntries(
    INSECT_COLLECTION_KEYS.map((key) => [key, processInsects(normalized[key])]),
  );
  const allProcessedInsects = INSECT_COLLECTION_KEYS.flatMap(
    (key) => processedCollections[key],
  );
  const { hostPlantsMap: fullHostPlants, plantDetails, aliasToCanonical } = buildHostPlantDataset(
    allProcessedInsects,
    ylistLite,
    plantProfiles,
  );
  const flowerVisitPlants = buildFlowerVisitPlantDataset(allProcessedInsects, ylistLite);
  write('hostplants.json', fullHostPlants);
  write('plant-details.json', plantDetails);
  write('flower-visit-plants.json', flowerVisitPlants);
  const summaryCounts = {
    ...Object.fromEntries(
      INSECT_COLLECTION_KEYS.map((key) => [key, processedCollections[key].length]),
    ),
    hostPlants: Object.keys(fullHostPlants).length,
  };
  const manifest = {
    counts: summaryCounts,
    version: Date.now(),
  };
  write('manifest.json', manifest);

  // Keep combined index for backward compatibility and fast single-fetch fallback
  const out = {
    ...slimmedCollections,
    hostPlants: fullHostPlants,
    plantDetails,
    flowerVisitPlants,
    summaryCounts,
  };
  write('index.json', out);
  const fullDataset = {
    version: Date.now(),
    summaryCounts,
    ...processedCollections,
    hostPlants: fullHostPlants,
    flowerVisitPlants,
    plantDetails,
    aliasToCanonical,
  };
  write('full-dataset.json', fullDataset);
}

build().catch(err => {
  console.error('[data-lite] failed:', err);
  process.exit(1);
});
