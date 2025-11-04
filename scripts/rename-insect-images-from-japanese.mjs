import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INSECT_IMG_DIR = path.join(PUBLIC_DIR, 'images', 'insects');
const INSECT_RESIZED_DIR = path.join(PUBLIC_DIR, 'images', 'resized', 'insects');
const BACKUP_DIR = path.join(INSECT_IMG_DIR, 'backup_japanese_names');

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG', '.WEBP']);

function hasJapanese(str = '') {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(str);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function formatScientificNameForFilename(scientificName) {
  if (!scientificName) return '';
  let cleanedName = scientificName
    .replace(/\s*\(.*?(?:\)|\s*$)/g, '') // remove parentheses blocks
    .replace(/\s*,\s*\d{4}\s*$/, '') // trailing year
    .replace(/\s*[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '') // author + year
    .replace(/^([A-Z][a-z]+\s+[a-z]+)\s+[A-Z][a-zA-Z\s&.]+\s*$/, '$1') // author only
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // keep alnum and spaces
    .replace(/\s+/g, ' ') // collapse spaces
    .trim()
    .replace(/\s/g, '_');
  return cleanedName;
}

async function loadJapaneseToScientificMap() {
  // Prefer CSV for freshness; fallback to data-lite JSON when CSV parsing unavailable
  const map = new Map();
  const insectsCsv = path.join(PUBLIC_DIR, 'insects.csv');
  if (fs.existsSync(insectsCsv)) {
    try {
      const csvParser = (await import('csv-parser')).default;
      await new Promise((resolve, reject) => {
        fs.createReadStream(insectsCsv)
          .pipe(csvParser())
          .on('data', (row) => {
            const j = String(row['japanese_name'] || '').trim();
            const s = String(row['scientific_name'] || '').trim();
            if (j && s) map.set(j, s);
          })
          .on('end', resolve)
          .on('error', reject);
      });
      if (map.size > 0) return map;
    } catch (e) {
      console.warn('[rename] csv-parser not available, fallback to JSON:', e.message);
    }
  }
  // Fallback to data-lite JSON
  const litePath = path.join(PUBLIC_DIR, 'assets', 'data-lite', 'index.json');
  if (fs.existsSync(litePath)) {
    const j = JSON.parse(fs.readFileSync(litePath, 'utf-8'));
    const addArr = (arr = []) => {
      for (const it of arr) {
        const jn = String(it.name || '').trim();
        const sn = String(it.scientificName || '').trim();
        if (jn && sn) map.set(jn, sn);
      }
    };
    addArr(j.moths);
    addArr(j.leafbeetles);
    addArr(j.beetles);
    addArr(j.butterflies);
  }
  return map;
}

function listJapaneseNamedImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => IMG_EXTS.has(path.extname(name)))
    .filter(name => hasJapanese(path.basename(name, path.extname(name))));
}

function safeExt(ext) {
  const e = ext.toLowerCase();
  if (e === '.jpeg') return '.jpeg';
  if (e === '.jpg') return '.jpg';
  if (e === '.png') return '.png';
  if (e === '.webp') return '.webp';
  return e || '.jpg';
}

function updateImageIndexesFromDir(dir) {
  const names = [];
  const exts = {};
  for (const f of fs.readdirSync(dir)) {
    const ext = path.extname(f);
    if (!IMG_EXTS.has(ext)) continue;
    const base = path.basename(f, ext);
    names.push(base);
    exts[base] = safeExt(ext);
  }
  names.sort((a, b) => a.localeCompare(b));
  const extsSorted = Object.keys(exts).sort((a, b) => a.localeCompare(b)).reduce((acc, k) => { acc[k] = exts[k]; return acc; }, {});
  fs.writeFileSync(path.join(PUBLIC_DIR, 'image_filenames.txt'), names.join('\n') + '\n');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'image_extensions.json'), JSON.stringify(extsSorted, null, 2));
  console.log('[rename] updated image_filenames.txt and image_extensions.json');
}

async function main() {
  ensureDir(BACKUP_DIR);
  const j2s = await loadJapaneseToScientificMap();
  console.log('[rename] loaded name map entries:', j2s.size);

  const targets = listJapaneseNamedImages(INSECT_IMG_DIR);
  if (targets.length === 0) {
    console.log('[rename] no Japanese-named insect images found');
  }
  for (const name of targets) {
    const srcPath = path.join(INSECT_IMG_DIR, name);
    const base = path.basename(name, path.extname(name));
    const ext = path.extname(name);

    // Derive clean Japanese name before any spaces/latin blocks (e.g., 'ニッコウシャチホコ Shachia ...')
    const m = base.match(/^([\u3040-\u30ff\u3400-\u9fff]+)/);
    const japaneseName = m ? m[1] : base;
    const scientificFull = j2s.get(japaneseName);
    if (!scientificFull) {
      console.warn('[rename] skip, mapping not found for', japaneseName, 'file=', name);
      continue;
    }
    const sciBase = formatScientificNameForFilename(scientificFull);
    if (!sciBase) {
      console.warn('[rename] skip, could not format scientific name for', japaneseName, scientificFull);
      continue;
    }
    const dstName = `${sciBase}${safeExt(ext)}`;
    const dstPath = path.join(INSECT_IMG_DIR, dstName);

    if (!fs.existsSync(dstPath)) {
      fs.copyFileSync(srcPath, dstPath);
      console.log('[rename] created', path.relative(PUBLIC_DIR, dstPath));
    } else {
      console.log('[rename] dest exists, skip copy', path.relative(PUBLIC_DIR, dstPath));
    }

    // Move original to backup
    const backupPath = path.join(BACKUP_DIR, path.basename(srcPath));
    if (!fs.existsSync(backupPath)) {
      fs.renameSync(srcPath, backupPath);
      console.log('[rename] moved original to backup', path.relative(PUBLIC_DIR, backupPath));
    } else {
      fs.unlinkSync(srcPath);
      console.log('[rename] removed original (already backed up)');
    }

    // Rename resized variants if present
    if (fs.existsSync(INSECT_RESIZED_DIR)) {
      for (const w of [320, 640, 1024]) {
        const resizedSrc = path.join(INSECT_RESIZED_DIR, `${base}.${w}.jpg`);
        const resizedDst = path.join(INSECT_RESIZED_DIR, `${sciBase}.${w}.jpg`);
        if (fs.existsSync(resizedSrc) && !fs.existsSync(resizedDst)) {
          fs.renameSync(resizedSrc, resizedDst);
          console.log('[rename] resized ->', path.relative(PUBLIC_DIR, resizedDst));
        }
      }
    }
  }

  // Refresh indexes from current directory state
  updateImageIndexesFromDir(INSECT_IMG_DIR);

  // Rename leftover resized images with Japanese basenames
  try {
    if (fs.existsSync(INSECT_RESIZED_DIR)) {
      const files = fs.readdirSync(INSECT_RESIZED_DIR);
      for (const f of files) {
        const ext = path.extname(f);
        if (!IMG_EXTS.has(ext)) continue;
        const base = path.basename(f, ext); // e.g., 日本名.640
        // split base: baseName.width
        const m = base.match(/^(.+?)\.(\d{3,4})$/);
        if (!m) continue;
        const jpBase = m[1];
        if (!hasJapanese(jpBase)) continue;
        const width = m[2];
        // find scientific
        const scientificFull = j2s.get(jpBase);
        if (!scientificFull) {
          console.warn('[rename:resized] skip, mapping not found for', jpBase, 'file=', f);
          continue;
        }
        const sciBase = formatScientificNameForFilename(scientificFull);
        if (!sciBase) continue;
        const src = path.join(INSECT_RESIZED_DIR, f);
        const dst = path.join(INSECT_RESIZED_DIR, `${sciBase}.${width}.jpg`);
        if (!fs.existsSync(dst)) {
          fs.renameSync(src, dst);
          console.log('[rename:resized] ->', path.relative(PUBLIC_DIR, dst));
        }
      }
    }
  } catch (e) {
    console.warn('[rename:resized] error', e.message);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
