import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PLANT_DIR = path.join(PUBLIC_DIR, 'images', 'plants');
const OUT_FILE = path.join(PUBLIC_DIR, 'plant_image_filenames.txt');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(PUBLIC_DIR);

if (!fs.existsSync(PLANT_DIR)) {
  console.warn('[update_plant_image_filenames] plant images directory missing; writing empty index.');
  fs.writeFileSync(OUT_FILE, '', 'utf-8');
  process.exit(0);
}

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const files = fs.readdirSync(PLANT_DIR);
const names = new Set();
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!allowedExt.has(ext)) continue;
  const base = path.basename(file, ext);
  if (base) names.add(base);
}

// コードポイント順で環境非依存にソート（localeCompareはICU差で並びが揺れる）
const sorted = Array.from(names).sort();
fs.writeFileSync(OUT_FILE, sorted.join('\n') + (sorted.length ? '\n' : ''), 'utf-8');
console.log(`[update_plant_image_filenames] wrote ${sorted.length} entries to ${path.relative(ROOT, OUT_FILE)}`);
