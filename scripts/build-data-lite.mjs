import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'assets', 'data-lite');

function readText(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function parseCsv(text, opts = {}) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h)=>h.trim(), ...opts });
  return result.data || [];
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

const cleanString = (value) => (value ?? '').toString().trim();

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
      registerInsect(canonical, insectName);
    });
  });

  Object.entries(plantDetailsRaw).forEach(([name, detail]) => {
    const canonical = aliasToCanonical[name] || name;
    const yDetail = ylistPlants[canonical] || ylistPlants[name];
    if (yDetail) {
      detail.family = detail.family && detail.family !== '不明' ? detail.family : yDetail.familyJp || detail.family;
      detail.familyName = detail.familyName || yDetail.familyJp || detail.family;
      detail.familyLatin = detail.familyLatin || yDetail.familyEn || '';
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
  const insectsCsv = readText(path.join(PUBLIC_DIR, 'insects.csv'));
  const hostplantsCsv = readText(path.join(PUBLIC_DIR, 'hostplants.csv'));
  const notesCsv = readText(path.join(PUBLIC_DIR, 'general_notes.csv'));

  if (!insectsCsv || !hostplantsCsv) {
    console.warn('[data-lite] required normalized CSVs not found; skipping');
    return;
  }

  const insects = parseCsv(insectsCsv);
  const hostplants = parseCsv(hostplantsCsv);
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
    type: i.type,
    classification: i.classification || {},
    hostPlants: Array.isArray(i.hostPlants) ? i.hostPlants.slice(0, 5) : [],
    notes: i.emergenceTime || i.notes || '',
    emergenceTime: i.emergenceTime || ''
  }));

  const moths = slim(normalized.moths);
  const butterflies = slim(normalized.butterflies);
  const beetles = slim(normalized.beetles);
  const leafbeetles = slim(normalized.leafbeetles);

  // Build lightweight host plant map from slim data
  const hostPlantsMap = {};
  const addPlants = (insect) => {
    (insect.hostPlants || []).forEach(raw => {
      const key = normalizePlantNameLite(raw);
      if (!key) return;
      if (!hostPlantsMap[key]) hostPlantsMap[key] = [];
      if (hostPlantsMap[key].length < 8 && !hostPlantsMap[key].includes(insect.name)) hostPlantsMap[key].push(insect.name);
    });
  };
  [...moths, ...butterflies, ...beetles, ...leafbeetles].forEach(addPlants);

  // Ensure output dir
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Write split files for lazy loading
  const write = (name, data) => {
    const p = path.join(OUT_DIR, name);
    fs.writeFileSync(p, JSON.stringify(data), 'utf-8');
    const size = fs.statSync(p).size;
    console.log('[data-lite] wrote', p, `size=${size} bytes`);
  };

  write('moths.json', moths);
  write('butterflies.json', butterflies);
  write('beetles.json', beetles);
  write('leafbeetles.json', leafbeetles);
  write('hostplants.json', hostPlantsMap);
  const manifest = {
    counts: {
      moths: moths.length,
      butterflies: butterflies.length,
      beetles: beetles.length,
      leafbeetles: leafbeetles.length,
      hostPlants: Object.keys(hostPlantsMap).length
    },
    version: Date.now()
  };
  write('manifest.json', manifest);

  // Keep combined index for backward compatibility
  const out = { moths, butterflies, beetles, leafbeetles, hostPlants: hostPlantsMap };
  write('index.json', out);

  // Build and write full dataset for runtime consumption
  const hostPlantTargets = new Set(hostplants.map(r => cleanString(r.plant_name)).filter(name => name && name !== '不明'));
  const ylistLite = buildYListLite(ylistRows, hostPlantTargets);
  const processedMoths = processInsects(normalized.moths);
  const processedButterflies = processInsects(normalized.butterflies);
  const processedBeetles = processInsects(normalized.beetles);
  const processedLeafbeetles = processInsects(normalized.leafbeetles);
  const { hostPlantsMap: fullHostPlants, plantDetails, aliasToCanonical } = buildHostPlantDataset(
    [...processedMoths, ...processedButterflies, ...processedBeetles, ...processedLeafbeetles],
    ylistLite
  );
  const fullDataset = {
    version: Date.now(),
    summaryCounts: {
      moths: processedMoths.length,
      butterflies: processedButterflies.length,
      beetles: processedBeetles.length,
      leafbeetles: processedLeafbeetles.length,
      hostPlants: Object.keys(fullHostPlants).length
    },
    moths: processedMoths,
    butterflies: processedButterflies,
    beetles: processedBeetles,
    leafbeetles: processedLeafbeetles,
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
