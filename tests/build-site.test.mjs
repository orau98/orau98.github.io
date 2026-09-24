import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUILD_STEPS, runBuild } from '../scripts/build-site.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const order = (script) => BUILD_STEPS.findIndex((step) => step.script === script);

test('ビルド工程はすべて package.json に実在するスクリプトを指す', () => {
  for (const { script } of BUILD_STEPS) assert.ok(pkg.scripts[script], `missing npm script: ${script}`);
  assert.equal(pkg.scripts.build, 'node scripts/build-site.mjs');
  // 前処理を prebuild に分けると手順の定義が2か所になるため置かない
  assert.equal(pkg.scripts.prebuild, undefined);
});

test('ビルド工程の順番は依存関係を満たす', () => {
  // data-lite はトップの先読みを画像の有無で並べるので、画像索引の後
  assert.ok(order('build:image-index') < order('build:data-lite'));
  assert.ok(order('build:images:responsive') < order('build:data-lite'));
  // メタページは data-lite の JSON を読む
  assert.ok(order('build:data-lite') < order('generate-meta:all'));
  assert.ok(order('sync:public-insects') < order('build:data-lite'));
  // サイトマップと後処理は dist を扱う
  assert.ok(order('build:app') < order('generate-sitemap'));
  assert.ok(order('generate-sitemap') < order('postbuild:cleanup'));
  assert.equal(BUILD_STEPS.at(-1).script, 'postbuild:cleanup');
});

test('本番公開とPRチェックは同じビルドコマンドだけを呼び、個別の工程を並べない', () => {
  for (const workflow of ['deploy', 'ci']) {
    const text = fs.readFileSync(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), 'utf8');
    assert.match(text, /run: npm run build\n/, workflow);
    for (const { script } of BUILD_STEPS) {
      assert.doesNotMatch(text, new RegExp(`run: npm run ${script.replace(/[:]/g, '\\$&')}\\n`), `${workflow} runs ${script} directly`);
    }
  }
  const deploy = fs.readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  // 縮小版の使い回し: キャッシュを戻してからビルドし、保管場所をビルドに渡す
  assert.ok(deploy.indexOf('uses: actions/cache@') < deploy.indexOf('run: npm run build\n'));
  assert.match(deploy, /RESPONSIVE_CACHE_DIR: \.cache\/resized/);
});

test('途中の工程が失敗したら以降を実行せずに失敗を返す', () => {
  const calls = [];
  const run = (_cmd, args) => {
    calls.push(args[1]);
    return { status: args[1] === 'build:data-lite' ? 1 : 0 };
  };
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'build-site-test-'));
  try {
    const result = runBuild({ run, cwd });
    assert.equal(result.ok, false);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  assert.equal(calls.at(-1), 'build:data-lite');
  assert.ok(!calls.includes('generate-meta:all'));
});
