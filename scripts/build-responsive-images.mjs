import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import {
  MIN_IMAGE_BYTES,
  RESIZED_WIDTHS,
  RETAINED_INSECT_JPEGS,
  SOURCE_IMAGE_EXTENSIONS,
} from './lib/imageAssetConstants.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
// 元画像の指紋（大きさ＋内容のハッシュ）の記録。公開ワークフローは縮小版を
// キャッシュして使い回すので、同じファイル名で差し替えられた元画像を
// この記録との食い違いで見つけて作り直す（Git管理外・キャッシュと一緒に保存）
const FINGERPRINT_PATH = process.env.RESPONSIVE_FINGERPRINT_PATH
  ? path.resolve(process.env.RESPONSIVE_FINGERPRINT_PATH)
  : path.join(ROOT, '.cache', 'responsive-images.json');
const RETAINED_INSECT_JPEG_SET = new Set(RETAINED_INSECT_JPEGS);
// 縮小版の保管場所（公開ワークフローが actions/cache で次回へ持ち越す）。
// リポジトリ内の縮小版は上書きせず、足りないものだけここから補う
const CACHE_DIR = process.env.RESPONSIVE_CACHE_DIR
  ? path.resolve(process.env.RESPONSIVE_CACHE_DIR)
  : null;
const RESIZED_ROOT = path.join(PUBLIC_DIR, 'images', 'resized');
const cachePathFor = (outPath) =>
  (CACHE_DIR ? path.join(CACHE_DIR, path.relative(RESIZED_ROOT, outPath)) : null);
const stats = { generated: 0, restored: 0 };

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

const readFingerprints = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(FINGERPRINT_PATH, 'utf-8'));
    return parsed && typeof parsed.sources === 'object' ? parsed.sources : {};
  } catch {
    return {};
  }
};
const previousFingerprints = readFingerprints();
const nextFingerprints = {};

// 大きさと更新時刻が前回と同じなら前回のハッシュを使い、読み直しを省く
const fingerprintOf = (srcPath, srcStat, key) => {
  const previous = previousFingerprints[key];
  if (previous && previous.size === srcStat.size && previous.mtimeMs === srcStat.mtimeMs) {
    return previous;
  }
  const sha1 = createHash('sha1').update(fs.readFileSync(srcPath)).digest('hex');
  return { size: srcStat.size, mtimeMs: srcStat.mtimeMs, sha1 };
};

if (
  process.env.SKIP_RESPONSIVE_IMAGES === '1' ||
  (!ALLOW_CI_RESPONSIVE_IMAGES && IS_PAGES_DEPLOY) ||
  (process.env.CI === 'true' && !ALLOW_CI_RESPONSIVE_IMAGES)
) {
  console.log('[responsive] skipped (CI, Pages deploy, or SKIP_RESPONSIVE_IMAGES=1)');
  process.exit(0);
}

async function processImage(srcPath, outBase, fingerprintKey, widths = WIDTHS) {
  try {
    const srcStat = fs.statSync(srcPath);
    // Skip obviously invalid placeholders or tiny files
    if (!srcStat.isFile() || srcStat.size < MIN_IMAGE_BYTES) {
      console.warn('[responsive] skip', srcPath, 'Input file too small or not a regular file');
      return;
    }
    const fingerprint = fingerprintOf(srcPath, srcStat, fingerprintKey);
    const previous = previousFingerprints[fingerprintKey];
    // 前回の記録と内容が違う＝同じ名前で差し替えられた元画像。既存の縮小版は古いので作り直す
    const sourceReplaced = Boolean(previous?.sha1) && previous.sha1 !== fingerprint.sha1;
    const isInsect = outBase.includes(`${path.sep}resized${path.sep}insects${path.sep}`);
    for (const w of widths) {
      // 昆虫は WebP のみ（AVIF と JPEG は Pages から削除されるので作らない。SNS用の既定画像の JPEG だけ例外）
      const formats = isInsect
        ? FORMATS.filter(({ ext }) =>
          ext === 'webp' ||
          (ext === 'jpg' && RETAINED_INSECT_JPEG_SET.has(`${path.basename(outBase)}.${w}.jpg`)))
        : FORMATS;
      for (const format of formats) {
        const outPath = `${outBase}.${w}.${format.ext}`;
        const cachedPath = cachePathFor(outPath);
        let outStat = statOrNull(outPath);
        // 保管場所に同じ元画像から作った縮小版があれば、作り直さずに使う
        if (!outStat && cachedPath && !sourceReplaced && !FORCE_REBUILD && statOrNull(cachedPath)) {
          await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
          fs.copyFileSync(cachedPath, outPath);
          stats.restored += 1;
          outStat = statOrNull(outPath);
        }
        if (!FORCE_REBUILD && outStat && !sourceReplaced) {
          if (GENERATE_MISSING_ONLY || outStat.mtimeMs >= srcStat.mtimeMs) {
            if (cachedPath && !statOrNull(cachedPath)) {
              await fs.promises.mkdir(path.dirname(cachedPath), { recursive: true });
              fs.copyFileSync(outPath, cachedPath);
            }
            continue; // up-to-date
          }
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
        stats.generated += 1;
        if (cachedPath) {
          await fs.promises.mkdir(path.dirname(cachedPath), { recursive: true });
          fs.copyFileSync(outPath, cachedPath);
        }
      }
    }
    nextFingerprints[fingerprintKey] = fingerprint;
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

// 元画像が削除された縮小版を消す。キャッシュから戻した縮小版に、
// もう存在しない写真のものが残り続けて配信されないようにする（CIの作業場所のみ）
function pruneOrphans(outDir, sourceBases) {
  if (!fs.existsSync(outDir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(outDir)) {
    const match = name.match(/^(.*)\.(\d+)\.(?:jpg|webp|avif)$/i);
    if (!match || sourceBases.has(match[1])) continue;
    fs.rmSync(path.join(outDir, name), { force: true });
    removed += 1;
  }
  return removed;
}

async function main() {
  const startedAt = Date.now();
  for (const t of TARGETS) {
    const srcDir = path.join(PUBLIC_DIR, t.dir);
    if (!fs.existsSync(srcDir)) continue;
    const files = listImages(srcDir);
    const sourceBases = new Set();
    for (const f of files) {
      const rel = path.relative(srcDir, f);
      const baseName = path.basename(rel, path.extname(rel));
      sourceBases.add(baseName);
      const outBase = path.join(PUBLIC_DIR, t.outSub, baseName);
      await processImage(f, outBase, `${t.dir}/${rel}`);
    }
    const outDir = path.join(PUBLIC_DIR, t.outSub);
    const pruneDirs = [
      GENERATE_MISSING_ONLY ? outDir : null,
      CACHE_DIR ? path.join(CACHE_DIR, path.relative(RESIZED_ROOT, outDir)) : null,
    ].filter(Boolean);
    for (const dir of pruneDirs) {
      const removed = pruneOrphans(dir, sourceBases);
      if (removed) console.log(`[responsive] removed ${removed} variant(s) whose source image no longer exists (${path.relative(ROOT, dir)})`);
    }
  }
  fs.mkdirSync(path.dirname(FINGERPRINT_PATH), { recursive: true });
  fs.writeFileSync(FINGERPRINT_PATH, JSON.stringify({ version: 1, sources: nextFingerprints }), 'utf-8');
  console.log(`[responsive] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s ` +
    `(generated ${stats.generated}, restored from cache ${stats.restored})`);
}

main().catch(err => { console.error(err); process.exit(1); });
