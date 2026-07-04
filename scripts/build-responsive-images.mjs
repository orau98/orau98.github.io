import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import {
  MIN_IMAGE_BYTES,
  RESIZED_WIDTHS,
  SOURCE_IMAGE_EXTENSIONS,
} from './lib/imageAssetConstants.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const TARGETS = [
  { dir: 'images/insects', outSub: 'images/resized/insects' },
  { dir: 'images/plants', outSub: 'images/resized/plants' },
];

const WIDTHS = RESIZED_WIDTHS;
const FORMATS = [
  {
    ext: 'jpg',
    transform: (pipeline) => pipeline.jpeg({ quality: 88, progressive: true, mozjpeg: true }),
  },
  {
    ext: 'webp',
    transform: (pipeline) => pipeline.webp({ quality: 86, effort: 5 }),
  },
  {
    ext: 'avif',
    transform: (pipeline) => pipeline.avif({ quality: 72, effort: 5 }),
  },
];
const FORCE_REBUILD = ['force', 'rebuild'].includes(
  String(process.env.FORCE_RESPONSIVE_IMAGES || '').toLowerCase(),
);
const ALLOW_CI_RESPONSIVE_IMAGES =
  FORCE_REBUILD || process.env.FORCE_RESPONSIVE_IMAGES === '1';
const IS_PAGES_DEPLOY = process.env.GITHUB_WORKFLOW === 'Deploy with GitHub Actions Pages';
const GENERATE_MISSING_ONLY =
  !FORCE_REBUILD && ALLOW_CI_RESPONSIVE_IMAGES && process.env.CI === 'true';

function statOrNull(p) { try { return fs.statSync(p); } catch { return null; } }

if (
  process.env.SKIP_RESPONSIVE_IMAGES === '1' ||
  (!ALLOW_CI_RESPONSIVE_IMAGES && IS_PAGES_DEPLOY) ||
  (process.env.CI === 'true' && !ALLOW_CI_RESPONSIVE_IMAGES)
) {
  console.log('[responsive] skipped (CI, Pages deploy, or SKIP_RESPONSIVE_IMAGES=1)');
  process.exit(0);
}

async function processImage(srcPath, outBase, widths = WIDTHS) {
  try {
    const srcStat = fs.statSync(srcPath);
    // Skip obviously invalid placeholders or tiny files
    if (!srcStat.isFile() || srcStat.size < MIN_IMAGE_BYTES) {
      console.warn('[responsive] skip', srcPath, 'Input file too small or not a regular file');
      return;
    }
    for (const w of widths) {
      for (const format of FORMATS) {
        const outPath = `${outBase}.${w}.${format.ext}`;
        const outStat = statOrNull(outPath);
        if (!FORCE_REBUILD && outStat) {
          if (GENERATE_MISSING_ONLY || outStat.mtimeMs >= srcStat.mtimeMs) continue; // up-to-date
        }
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
  // 索引(build-image-index)と同じ拡張子集合を小文字比較で使う。
  // 集合がずれると「索引に載るのにリサイズ版が無い」404の原因になる
  const exts = new Set(SOURCE_IMAGE_EXTENSIONS);
  const items = fs.readdirSync(dir);
  return items
    .filter(name => exts.has(path.extname(name).toLowerCase()))
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
