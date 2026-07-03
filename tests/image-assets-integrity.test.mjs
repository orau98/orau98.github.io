// 画像資産の整合性テスト（依存パッケージ不要）
//
// 背景: 壊れたアップロード（数バイトのテキストファイル）が画像インデックスに
// 登録され、「画像あり」扱いのカードが本番で「画像なし」表示になる障害が発生した。
// さらに最終フォールバックの placeholder.jpg 自体が画像でないテキストだったため、
// あらゆる読み込み失敗が復帰不能のエラー表示に直行していた。
//
// ここでは「デプロイ時の再生成では自己修復できない」不変条件を固定する:
//   1. placeholder.jpg は実際に読み込める JPEG である（デプロイでは再生成されない）
//   2. コミット済みインデックスに載った画像は実在し、壊れていない
//   3. コミット済みリサイズ画像は壊れていない
//      （デプロイの欠落補完は「存在しないファイル」しか作り直さないため、
//        壊れたまま存在するファイルは配信され続ける）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const INSECT_DIR = path.join(PUB, 'images', 'insects');
const PLANT_DIR = path.join(PUB, 'images', 'plants');
const RESIZED_DIRS = [
  path.join(PUB, 'images', 'resized', 'insects'),
  path.join(PUB, 'images', 'resized', 'plants'),
];

const MIN_VALID_IMAGE_BYTES = 100;
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// 先頭バイトのマジックナンバーで画像形式を判定する（フル依存なしの軽量検証）
const sniffImageFormat = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buf.toString('ascii', 4, 12) === 'ftypavif' || buf.toString('ascii', 4, 12) === 'ftypavis') return 'avif';
  return null;
};

const readHead = (filePath, bytes = 16) => {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
};

const validateImageFile = (filePath) => {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return `not a regular file`;
  if (stat.size < MIN_VALID_IMAGE_BYTES) return `too small (${stat.size}B)`;
  const format = sniffImageFormat(readHead(filePath));
  if (!format) return 'unknown format (magic bytes mismatch)';
  return null;
};

const findOriginalFile = (dir, base, preferredExt) => {
  const exts = preferredExt
    ? [preferredExt, ...ALLOWED_EXTS.filter((e) => e !== preferredExt)]
    : ALLOWED_EXTS;
  for (const ext of exts) {
    const p = path.join(dir, `${base}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

test('placeholder.jpg は実際に読み込める JPEG 画像である', () => {
  const placeholderPath = path.join(PUB, 'images', 'placeholder.jpg');
  assert.ok(fs.existsSync(placeholderPath), 'public/images/placeholder.jpg が存在しない');
  const stat = fs.statSync(placeholderPath);
  assert.ok(
    stat.size >= 500,
    `placeholder.jpg が小さすぎる (${stat.size}B)。過去にdata URIテキストが誤って書かれた障害があるため実画像であること`,
  );
  const format = sniffImageFormat(readHead(placeholderPath));
  assert.equal(
    format,
    'jpeg',
    `placeholder.jpg が JPEG でない (判定: ${format ?? 'テキスト等の非画像'})。` +
      '最終フォールバックが壊れると全ての読み込み失敗が「画像なし」表示になる',
  );
});

test('昆虫画像インデックスの全エントリが実在する健全な画像を指す', () => {
  const namesPath = path.join(PUB, 'image_filenames.txt');
  const extsPath = path.join(PUB, 'image_extensions.json');
  const names = fs.readFileSync(namesPath, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const extMap = JSON.parse(fs.readFileSync(extsPath, 'utf8'));

  assert.deepEqual(
    [...names].sort(),
    Object.keys(extMap).sort(),
    'image_filenames.txt と image_extensions.json のエントリが一致しない（npm run build:image-index で再生成すること）',
  );

  const problems = [];
  for (const base of names) {
    const filePath = findOriginalFile(INSECT_DIR, base, extMap[base]);
    if (!filePath) {
      problems.push(`${base}: 元画像ファイルが存在しない`);
      continue;
    }
    const error = validateImageFile(filePath);
    if (error) problems.push(`${base}: ${error}`);
  }
  assert.deepEqual(
    problems,
    [],
    `インデックスに壊れた/存在しない画像が登録されている。` +
      `「画像あり」扱いのまま表示が404になるため、該当ファイルを修正・削除して ` +
      `npm run build:image-index を実行すること:\n${problems.join('\n')}`,
  );
});

test('植物画像インデックスの全エントリが実在する健全な画像を指す', () => {
  const idxPath = path.join(PUB, 'plant_image_filenames.txt');
  const entries = fs.readFileSync(idxPath, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => (line.includes('→') ? line.split('→')[1].trim() : line));

  const problems = [];
  for (const base of entries) {
    const filePath = findOriginalFile(PLANT_DIR, base);
    if (!filePath) {
      problems.push(`${base}: 元画像ファイルが存在しない`);
      continue;
    }
    const error = validateImageFile(filePath);
    if (error) problems.push(`${base}: ${error}`);
  }
  assert.deepEqual(
    problems,
    [],
    `植物インデックスに壊れた/存在しない画像が登録されている。該当ファイルを修正・削除して ` +
      `npm run build:plant-image-index を実行すること:\n${problems.join('\n')}`,
  );
});

test('コミット済みリサイズ画像はすべて拡張子どおりの健全な画像である', () => {
  // デプロイの欠落補完(GENERATE_MISSING_ONLY)は既存ファイルを再生成しないため、
  // 壊れたリサイズ画像がコミットされるとそのまま配信され続ける。
  const extToFormat = { '.jpg': 'jpeg', '.webp': 'webp', '.avif': 'avif' };
  const problems = [];
  for (const dir of RESIZED_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file).toLowerCase();
      const expected = extToFormat[ext];
      if (!expected) continue;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.size < MIN_VALID_IMAGE_BYTES) {
        problems.push(`${path.relative(PUB, filePath)}: too small (${stat.size}B)`);
        continue;
      }
      const format = sniffImageFormat(readHead(filePath));
      if (format !== expected) {
        problems.push(`${path.relative(PUB, filePath)}: expected ${expected}, got ${format ?? 'unknown'}`);
      }
    }
  }
  assert.deepEqual(
    problems,
    [],
    `壊れたリサイズ画像がコミットされている。削除して npm run build:images:responsive で再生成すること:\n${problems.join('\n')}`,
  );
});

test('【参考情報】インデックス未登録・リサイズ未生成の画像を通知する（失敗にはしない）', () => {
  // どちらもデプロイ時に自動修復される（インデックス再構築・欠落リサイズ生成）ため
  // テスト失敗にはしないが、開発環境での見え方と差が出るので気づけるようにする。
  const extMap = JSON.parse(fs.readFileSync(path.join(PUB, 'image_extensions.json'), 'utf8'));
  const indexed = new Set(Object.keys(extMap));

  const unindexed = [];
  for (const file of fs.readdirSync(INSECT_DIR)) {
    const ext = path.extname(file).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) continue;
    const filePath = path.join(INSECT_DIR, file);
    if (validateImageFile(filePath)) continue; // 壊れたファイルは上のテストの管轄
    const base = path.basename(file, path.extname(file));
    if (!indexed.has(base)) unindexed.push(file);
  }
  if (unindexed.length > 0) {
    console.warn(
      `[image-assets] インデックス未登録の昆虫画像が ${unindexed.length} 件あります` +
        `（npm run build:image-index で登録されます）: ${unindexed.slice(0, 10).join(', ')}`,
    );
  }

  const missingResized = [];
  for (const base of indexed) {
    const resized = path.join(PUB, 'images', 'resized', 'insects', `${base}.1024.jpg`);
    if (!fs.existsSync(resized)) missingResized.push(base);
  }
  if (missingResized.length > 0) {
    console.warn(
      `[image-assets] リサイズ版(.1024.jpg)未コミットの昆虫画像が ${missingResized.length} 件あります` +
        `（デプロイ時に自動生成されますが、npm run build:images:responsive でコミットしておくと確実です）: ` +
        `${missingResized.slice(0, 10).join(', ')}`,
    );
  }
  assert.ok(true);
});
