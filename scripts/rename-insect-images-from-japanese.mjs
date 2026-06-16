import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INSECT_IMG_DIR = path.join(PUBLIC_DIR, 'images', 'insects');
const INSECT_RESIZED_DIR = path.join(PUBLIC_DIR, 'images', 'resized', 'insects');
const BACKUP_DIR = path.join(INSECT_IMG_DIR, 'backup_japanese_names');

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG', '.WEBP']);

const normalizeJapaneseName = (str = '') => str ? str.normalize('NFC') : str;

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
    .replace(/\s+[A-Z][a-zA-Z\s&.]+\s*\d{4}\s*$/, '') // author + year
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // keep alnum and spaces
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();

  const tokens = cleanedName.split(/\s+/).filter(Boolean);
  const taxonTokens = [];
  for (const token of tokens) {
    if (taxonTokens.length === 0) {
      if (/^[A-Z][a-zA-Z0-9-]*$/.test(token)) taxonTokens.push(token);
      continue;
    }
    if (/^[a-z][a-zA-Z0-9-]*$/.test(token)) {
      taxonTokens.push(token);
      continue;
    }
    break;
  }
  return taxonTokens.length >= 2 ? taxonTokens.join('_') : cleanedName.replace(/\s/g, '_');
}

async function loadJapaneseToScientificMap() {
  // Prefer CSV for freshness; fallback to data-lite JSON when CSV parsing unavailable
  const map = new Map();
  const insectsCsv = path.join(PUBLIC_DIR, 'insects.csv');
  let loadedFromCsv = false;
  if (fs.existsSync(insectsCsv)) {
    try {
      const csvParser = (await import('csv-parser')).default;
      await new Promise((resolve, reject) => {
        fs.createReadStream(insectsCsv)
          .pipe(csvParser())
          .on('data', (row) => {
            const j = normalizeJapaneseName(String(row['japanese_name'] || '').trim());
            const s = String(row['scientific_name'] || '').trim();
            if (j && s) map.set(j, s);
          })
          .on('end', resolve)
          .on('error', reject);
      });
      if (map.size > 0) loadedFromCsv = true;
    } catch (e) {
      console.warn('[rename] csv-parser not available, fallback to JSON:', e.message);
    }
  }
  // Fallback to data-lite JSON
  if (!loadedFromCsv) {
    const litePath = path.join(PUBLIC_DIR, 'assets', 'data-lite', 'index.json');
    if (fs.existsSync(litePath)) {
      const j = JSON.parse(fs.readFileSync(litePath, 'utf-8'));
      const addArr = (arr = []) => {
        for (const it of arr) {
          const jn = normalizeJapaneseName(String(it.name || '').trim());
          const sn = String(it.scientificName || '').trim();
          if (jn && sn) map.set(jn, sn);
        }
      };
      addArr(j.moths);
      addArr(j.leafbeetles);
      addArr(j.beetles);
      addArr(j.longhornbeetles);
      addArr(j.butterflies);
    }
  }
  // Supplement map with unmatched report (normalized_binomial,japanese)
  try {
    const unmatchedPath = path.join(ROOT, 'reports', 'unmatched_detailed_日本産蛾類標準図鑑2.csv');
    if (fs.existsSync(unmatchedPath)) {
      const lines = fs.readFileSync(unmatchedPath, 'utf-8').split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        // pattern: "Original",Normalized Binomial,Japanese
        const m = line.match(/^(?:\".*?\"|[^,]*),([^,]*),([^,]*)$/);
        if (m) {
          const bin = (m[1] || '').trim();
          const jp = normalizeJapaneseName((m[2] || '').trim());
          if (jp && bin && !map.has(jp)) {
            map.set(jp, bin);
          }
        }
      }
    }
  } catch {}
  // Manual overrides for names missing from datasets
  const manualOverrides = {
    'アカスジキヨトウ': 'Mythimna postica (Hampson, 1905)',
    'ウスイロキヨトウ': 'Mythimna inanis (Oberthür, 1880)',
    'ウスクロモクメヨトウ': 'Dipterygina cupreotincta Sugi, 1954',
    'ウスモンクロテンヒメシャク': 'Scopula ignobilis (Warren, 1901)',
    'テングイラガ': 'Microleon longipalpis Butler, 1885',
    'キホソノメイガ本州以南亜種': 'Circobotys heterogenalis (Bremer, 1864)',
  };
  for (const [jp, sci] of Object.entries(manualOverrides)) {
    const key = normalizeJapaneseName(jp);
    if (key && sci && !map.has(key)) map.set(key, sci);
  }

  // Merge global override mapping used by the web app itself so scripts stay in sync
  try {
    const mappingModule = await import(
      pathToFileURL(path.join(ROOT, 'src', 'utils', 'insectImageMappings.js'))
    );
    const { globalJapaneseToScientificMapping } = mappingModule || {};
    if (globalJapaneseToScientificMapping instanceof Map) {
      for (const [jp, sci] of globalJapaneseToScientificMapping.entries()) {
        const key = normalizeJapaneseName(jp);
        if (key && sci && !map.has(key)) map.set(key, sci);
      }
    }
  } catch (err) {
    console.warn('[rename] warning: failed to load global mapping:', err.message);
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

function getAvailableImageBase(dir, base, ext) {
  const normalizedExt = safeExt(ext);
  let candidate = base;
  let suffix = 2;
  while (fs.existsSync(path.join(dir, `${candidate}${normalizedExt}`))) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function parseOnlyTargets() {
  const raw = process.env.RENAME_INSECT_IMAGES_ONLY || '';
  const entries = raw
    .split(',')
    .map(s => normalizeJapaneseName(s.trim()))
    .filter(Boolean);
  return new Set(entries.flatMap((entry) => [
    entry,
    path.basename(entry, path.extname(entry)),
  ]));
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

  const onlyTargets = parseOnlyTargets();
  const targets = listJapaneseNamedImages(INSECT_IMG_DIR).filter((name) => {
    if (onlyTargets.size === 0) return true;
    const normalizedName = normalizeJapaneseName(name);
    const normalizedBase = normalizeJapaneseName(path.basename(name, path.extname(name)));
    return onlyTargets.has(normalizedName) || onlyTargets.has(normalizedBase);
  });
  if (onlyTargets.size > 0) {
    console.log('[rename] restricted targets:', targets.length);
  }
  if (targets.length === 0) {
    console.log('[rename] no Japanese-named insect images found');
  }
  for (const name of targets) {
    const srcPath = path.join(INSECT_IMG_DIR, name);
    const base = path.basename(name, path.extname(name));
    const ext = path.extname(name);

    // Derive clean Japanese name before any spaces/latin blocks (e.g., 'ニッコウシャチホコ Shachia ...')
    const m = base.match(/^([\u3040-\u30ff\u3400-\u9fff]+)/);
    const japaneseName = normalizeJapaneseName(m ? m[1] : base);
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
    const finalBase = getAvailableImageBase(INSECT_IMG_DIR, sciBase, ext);
    const dstName = `${finalBase}${safeExt(ext)}`;
    const dstPath = path.join(INSECT_IMG_DIR, dstName);

    fs.copyFileSync(srcPath, dstPath);
    if (finalBase === sciBase) {
      console.log('[rename] created', path.relative(PUBLIC_DIR, dstPath));
    } else {
      console.log('[rename] created additional image', path.relative(PUBLIC_DIR, dstPath));
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
        const resizedDst = path.join(INSECT_RESIZED_DIR, `${finalBase}.${w}.jpg`);
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
        const jpBase = normalizeJapaneseName(m[1]);
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

main().catch(err => { console.error('[rename] fatal error (non-blocking):', err); process.exit(0); });
