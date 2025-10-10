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
}

build().catch(err => {
  console.error('[data-lite] failed:', err);
  process.exit(1);
});
