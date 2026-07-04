import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MIN_IMAGE_BYTES, SOURCE_IMAGE_EXTENSIONS } from './lib/imageAssetConstants.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INSECT_DIR = path.join(PUBLIC_DIR, 'images', 'insects');
const RESIZED_INSECT_DIR = path.join(PUBLIC_DIR, 'images', 'resized', 'insects');
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

const allowedExt = new Set(SOURCE_IMAGE_EXTENSIONS);
const extPriority = SOURCE_IMAGE_EXTENSIONS;
// MIN_IMAGE_BYTES 未満の壊れたファイルはリサイズ版が生成されない。
// 過去の正常時に生成されたリサイズ版も無い場合、索引に載せると
// サイト側が存在しないURLへ404を繰り返す（カードが読み込み失敗表示になる）
const hasResizedOutput = (base) => {
  // サイトのカード/詳細はリサイズ版のjpgを最終フォールバックに使うため、
  // 代表して .320.jpg の存在で表示可否を判定する
  try {
    return fs.statSync(path.join(RESIZED_INSECT_DIR, `${base}.320.jpg`)).isFile();
  } catch {
    return false;
  }
};
const files = fs.readdirSync(INSECT_DIR);
const candidatesByBase = new Map();

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!allowedExt.has(ext)) continue;
  const base = path.basename(file, path.extname(file));
  if (!base) continue;
  try {
    const stat = fs.statSync(path.join(INSECT_DIR, file));
    if ((!stat.isFile() || stat.size < MIN_IMAGE_BYTES) && !hasResizedOutput(base)) {
      console.warn(
        `[build-image-index] skip broken/tiny image without resized output: ${file} (${stat.size} bytes)`,
      );
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
