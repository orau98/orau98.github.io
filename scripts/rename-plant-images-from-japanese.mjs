import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildPlantImageFilename,
  createSafeScientificPlantFilename,
  splitPlantImageBaseAndSuffix,
} from '../src/utils/filename.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PLANT_IMG_DIR = path.join(PUBLIC_DIR, 'images', 'plants');
const PLANT_RESIZED_DIR = path.join(PUBLIC_DIR, 'images', 'resized', 'plants');
const YLIST_LITE_PATH = path.join(PUBLIC_DIR, 'assets', 'data-lite', 'ylist-lite.json');
const FULL_DATASET_PATH = path.join(PUBLIC_DIR, 'assets', 'data-lite', 'full-dataset.json');
const OUT_FILE = path.join(PUBLIC_DIR, 'plant_image_filenames.txt');

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const RESIZED_WIDTHS = [320, 640, 1024];

const MANUAL_OVERRIDES = {
  モッコク: 'Ternstroemia gymnanthera',
};

const hasJapaneseText = (value = '') => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value));

const normalizeNameKey = (value = '') => String(value || '').normalize('NFC').trim();

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const readJsonOrEmpty = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.warn('[rename-plant-images] failed to read JSON', path.relative(ROOT, filePath), error.message);
    return {};
  }
};

const addMapping = (map, japaneseName, scientificName) => {
  const key = normalizeNameKey(japaneseName);
  const value = String(scientificName || '').trim();
  if (!key || !value) return;
  if (!map.has(key)) {
    map.set(key, value);
  }
};

const loadPlantScientificMap = () => {
  const map = new Map();

  const ylistLite = readJsonOrEmpty(YLIST_LITE_PATH);
  Object.entries(ylistLite.plants || {}).forEach(([name, detail]) => {
    addMapping(map, name, detail?.scientificName);
    (detail?.aliases || []).forEach((alias) => addMapping(map, alias, detail?.scientificName));
  });

  const fullDataset = readJsonOrEmpty(FULL_DATASET_PATH);
  Object.entries(fullDataset.plantDetails || {}).forEach(([name, detail]) => {
    addMapping(map, name, detail?.scientificName);
    (detail?.aliases || []).forEach((alias) => addMapping(map, alias, detail?.scientificName));
  });

  Object.entries(MANUAL_OVERRIDES).forEach(([name, scientificName]) => {
    addMapping(map, name, scientificName);
  });

  return map;
};

const listJapaneseNamedImages = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => {
    const ext = path.extname(name).toLowerCase();
    if (!IMG_EXTS.has(ext)) return false;
    return hasJapaneseText(path.basename(name, path.extname(name)));
  });
};

const safeExt = (ext = '') => {
  const lower = String(ext || '').toLowerCase();
  return IMG_EXTS.has(lower) ? lower : '.jpg';
};

const copyIfMissing = (srcPath, dstPath) => {
  ensureDir(path.dirname(dstPath));
  if (fs.existsSync(dstPath)) return false;
  fs.copyFileSync(srcPath, dstPath);
  return true;
};

const updatePlantImageIndex = () => {
  if (!fs.existsSync(PLANT_IMG_DIR)) {
    fs.writeFileSync(OUT_FILE, '', 'utf-8');
    return 0;
  }

  const names = new Set();
  fs.readdirSync(PLANT_IMG_DIR).forEach((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!IMG_EXTS.has(ext)) return;
    const base = path.basename(file, path.extname(file));
    if (base) names.add(base);
  });

  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
  fs.writeFileSync(OUT_FILE, sorted.join('\n') + (sorted.length ? '\n' : ''), 'utf-8');
  return sorted.length;
};

function main() {
  if (!fs.existsSync(PLANT_IMG_DIR)) {
    console.log('[rename-plant-images] no plant image directory found');
    return;
  }

  const scientificMap = loadPlantScientificMap();
  const targets = listJapaneseNamedImages(PLANT_IMG_DIR);
  const skipped = [];
  let created = 0;
  let resizedCreated = 0;
  let alreadyPresent = 0;

  for (const file of targets) {
    const ext = path.extname(file);
    const originalBase = path.basename(file, ext);
    const { base: japaneseBase, suffix } = splitPlantImageBaseAndSuffix(originalBase);
    const scientificName = scientificMap.get(normalizeNameKey(japaneseBase));

    if (!scientificName) {
      skipped.push(originalBase);
      continue;
    }

    const scientificBase = createSafeScientificPlantFilename(scientificName);
    if (!scientificBase) {
      skipped.push(originalBase);
      continue;
    }

    const dstBase = buildPlantImageFilename(scientificBase, suffix);
    const srcPath = path.join(PLANT_IMG_DIR, file);
    const dstPath = path.join(PLANT_IMG_DIR, `${dstBase}${safeExt(ext)}`);

    if (copyIfMissing(srcPath, dstPath)) {
      created += 1;
      console.log('[rename-plant-images] created', path.relative(PUBLIC_DIR, dstPath));
    } else {
      alreadyPresent += 1;
    }

    for (const width of RESIZED_WIDTHS) {
      const resizedSrc = path.join(PLANT_RESIZED_DIR, `${originalBase}.${width}.jpg`);
      const resizedDst = path.join(PLANT_RESIZED_DIR, `${dstBase}.${width}.jpg`);
      if (!fs.existsSync(resizedSrc)) continue;
      if (copyIfMissing(resizedSrc, resizedDst)) {
        resizedCreated += 1;
        console.log('[rename-plant-images] resized', path.relative(PUBLIC_DIR, resizedDst));
      }
    }
  }

  const indexed = updatePlantImageIndex();
  console.log(
    `[rename-plant-images] created ${created} originals, ${resizedCreated} resized, ${alreadyPresent} already present, ${skipped.length} skipped, indexed ${indexed}`,
  );
  if (skipped.length > 0) {
    console.warn('[rename-plant-images] unresolved basenames:', skipped.join(', '));
  }
}

main();
