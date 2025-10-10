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

function statOrNull(p) { try { return fs.statSync(p); } catch { return null; } }

async function processImage(srcPath, outBase, widths = WIDTHS) {
  try {
    const srcStat = fs.statSync(srcPath);
    const input = sharp(srcPath, { failOnError: false });
    for (const w of widths) {
      const outPath = `${outBase}.${w}.jpg`;
      const outStat = statOrNull(outPath);
      if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) continue; // up-to-date
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await input.resize({ width: w }).jpeg({ quality: 82, progressive: true }).toFile(outPath);
      // Reload input to avoid cumulative resampling
      input.rotate(0); // no-op to keep pipeline valid
      console.log('[responsive]', path.relative(PUBLIC_DIR, outPath));
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

