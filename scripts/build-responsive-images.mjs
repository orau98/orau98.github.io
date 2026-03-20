import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const TARGETS = [
  { dir: 'images/insects', outSub: 'images/resized/insects' },
  { dir: 'images/plants', outSub: 'images/resized/plants' },
];

const WIDTHS = [320, 640, 1024];
const FORMATS = [
  {
    ext: 'jpg',
    transform: (pipeline) => pipeline.jpeg({ quality: 82, progressive: true }),
  },
  {
    ext: 'webp',
    transform: (pipeline) => pipeline.webp({ quality: 78, effort: 4 }),
  },
  {
    ext: 'avif',
    transform: (pipeline) => pipeline.avif({ quality: 56, effort: 4 }),
  },
];

function statOrNull(p) { try { return fs.statSync(p); } catch { return null; } }

if (
  process.env.SKIP_RESPONSIVE_IMAGES === '1' ||
  (process.env.CI === 'true' && process.env.FORCE_RESPONSIVE_IMAGES !== '1')
) {
  console.log('[responsive] skipped (CI or SKIP_RESPONSIVE_IMAGES=1)');
  process.exit(0);
}

async function processImage(srcPath, outBase, widths = WIDTHS) {
  try {
    const srcStat = fs.statSync(srcPath);
    // Skip obviously invalid placeholders or tiny files
    if (!srcStat.isFile() || srcStat.size < 100) {
      console.warn('[responsive] skip', srcPath, 'Input file too small or not a regular file');
      return;
    }
    for (const w of widths) {
      for (const format of FORMATS) {
        const outPath = `${outBase}.${w}.${format.ext}`;
        const outStat = statOrNull(outPath);
        if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) continue; // up-to-date
        await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
        await format.transform(
          sharp(srcPath, { failOnError: false }).rotate().resize({
            width: w,
            withoutEnlargement: true,
            fit: 'inside',
          }),
        ).toFile(outPath);
        console.log('[responsive]', path.relative(PUBLIC_DIR, outPath));
      }
    }
  } catch (e) {
    console.warn('[responsive] skip', srcPath, e.message);
  }
}

function listImages(dir) {
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG', '.WEBP']);
  const items = fs.readdirSync(dir);
  return items
    .filter(name => exts.has(path.extname(name)))
    .map(name => path.join(dir, name));
}

async function main() {
  for (const t of TARGETS) {
    const srcDir = path.join(PUBLIC_DIR, t.dir);
    if (!fs.existsSync(srcDir)) continue;
    const files = listImages(srcDir);
    for (const f of files) {
      const rel = path.relative(srcDir, f);
      const baseName = path.basename(rel, path.extname(rel));
      const outBase = path.join(PUBLIC_DIR, t.outSub, baseName);
      await processImage(f, outBase);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
