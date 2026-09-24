#!/usr/bin/env node
// サイト全体のビルド手順（唯一の定義）。
// 本番公開（.github/workflows/deploy.yml）・PRチェック（ci.yml）・手元の `npm run build` が
// すべてこのスクリプトを呼ぶ。工程を追加・並べ替えるときはここだけを直すこと
// （以前は3か所に別々の順番で書かれていて、食い違いの原因になっていた）。
//
// 前後のチェックはこのスクリプトの外で行う:
//   ビルド前: npm run check:source（lint・テスト・参照整合性）
//   ビルド後: npm run check:dist（dist のスモーク・画像・SEO監査）
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 順番の理由:
// - 画像索引 → 縮小版 → data-lite: data-lite はトップの先読み（最初の48件）を画像の有無で並べるため、
//   画像索引の後に作る
// - data-lite → メタページ: メタページは data-lite の JSON を読む
// - アプリ（vite）→ サイトマップ → 後処理: サイトマップは public と dist の両方へ書き、
//   後処理は dist を整える
export const BUILD_STEPS = [
  { label: '一次データの参照整合性チェック', script: 'validate-normalized' },
  { label: 'normalized_data → public へCSV同期', script: 'sync:public-insects' },
  { label: '植物画像のファイル名索引', script: 'build:plant-image-index' },
  { label: '昆虫画像の索引', script: 'build:image-index' },
  { label: '写真の縮小版（足りない分だけ）', script: 'build:images:responsive' },
  { label: '画面用の軽量データ（data-lite）', script: 'build:data-lite' },
  { label: 'SEO用の静的ページ（日本語・英語）', script: 'generate-meta:all' },
  { label: 'アプリ本体（vite）', script: 'build:app' },
  { label: 'サイトマップ', script: 'generate-sitemap' },
  { label: 'dist の後処理（不要ファイル削除・容量確認）', script: 'postbuild:cleanup' },
];

const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function runBuild({ steps = BUILD_STEPS, cwd = ROOT, run = spawnSync } = {}) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const timings = [];
  const startedAt = Date.now();
  for (const [index, step] of steps.entries()) {
    const stepStartedAt = Date.now();
    console.log(`\n[build-site] (${index + 1}/${steps.length}) ${step.label} — npm run ${step.script}`);
    const result = run(npm, ['run', step.script], { cwd, stdio: 'inherit', env: process.env });
    const elapsed = Date.now() - stepStartedAt;
    timings.push({ ...step, elapsed });
    if (result.status !== 0) {
      console.error(`\n[build-site] 失敗: ${step.label}（npm run ${step.script}、終了コード ${result.status}）`);
      return { ok: false, timings };
    }
  }
  // GitHub Pages に Jekyll 処理をさせない（_ で始まるファイルを配信するため）
  fs.mkdirSync(path.join(cwd, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'dist', '.nojekyll'), '\n');

  console.log('\n[build-site] 工程ごとの所要時間');
  for (const { label, elapsed } of timings) console.log(`  ${formatSeconds(elapsed).padStart(7)}  ${label}`);
  console.log(`  ${formatSeconds(Date.now() - startedAt).padStart(7)}  合計`);
  return { ok: true, timings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok } = runBuild();
  process.exit(ok ? 0 : 1);
}
