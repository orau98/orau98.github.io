import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INSECT_DIR = path.join(PUBLIC_DIR, 'images', 'insects');
const OUT_NAMES = path.join(PUBLIC_DIR, 'image_filenames.txt');
const OUT_EXTS = path.join(PUBLIC_DIR, 'image_extensions.json');
const OUT_LITE = path.join(PUBLIC_DIR, 'assets', 'data-lite', 'image-index.json');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const writeIndexes = (names, extMap) => {
  ensureDir(PUBLIC_DIR);
  ensureDir(path.dirname(OUT_LITE));
  fs.writeFileSync(OUT_NAMES, names.join('\n') + (names.length ? '\n' : ''), 'utf-8');
  fs.writeFileSync(OUT_EXTS, JSON.stringify(extMap, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(
    OUT_LITE,
    JSON.stringify({ names, exts: extMap }, null, 2) + '\n',
    'utf-8',
  );
};

if (!fs.existsSync(INSECT_DIR)) {
  console.warn('[build-image-index] insect image directory missing; writing empty indexes.');
  writeIndexes([], {});
  process.exit(0);
}

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const extPriority = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const files = fs.readdirSync(INSECT_DIR);
const candidatesByBase = new Map();

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!allowedExt.has(ext)) continue;
  const base = path.basename(file, path.extname(file));
  if (!base) continue;
  // 壊れたアップロード（数バイトのテキスト等）を載せると「画像あり」扱いのまま
  // 表示が404になるため、インデックスから除外する
  try {
    const stat = fs.statSync(path.join(INSECT_DIR, file));
    if (!stat.isFile() || stat.size < 100) {
      console.warn(`[build-image-index] skip invalid image (too small): ${file}`);
      continue;
    }
  } catch {
    continue;
  }
  if (!candidatesByBase.has(base)) candidatesByBase.set(base, []);
  candidatesByBase.get(base).push(ext);
}

const names = Array.from(candidatesByBase.keys()).sort((a, b) =>
  a.localeCompare(b, 'ja'),
);
const extMap = {};
for (const base of names) {
  const exts = Array.from(new Set(candidatesByBase.get(base) || []));
  exts.sort((a, b) => extPriority.indexOf(a) - extPriority.indexOf(b));
  extMap[base] = exts[0] || '.jpg';
}

writeIndexes(names, extMap);
console.log(
  `[build-image-index] wrote ${names.length} names, ${Object.keys(extMap).length} extensions, and lite index`,
);
