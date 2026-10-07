import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const write = (root, file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const writeJson = (root, file, data) => write(root, file, JSON.stringify(data));
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const indexHtml = `<!doctype html><html lang="ja"><head>
<title>Home</title><meta name="description" content="Home"><meta name="robots" content="index, follow">
<link rel="canonical" href="https://orau98.github.io/"><link rel="icon" href="/favicon.ico">
<script src="/assets/analytics-loader.js" data-measurement-id="G-MFEQF99G0H"></script>
<script type="module" src="/assets/index-fixture.js"></script><link rel="stylesheet" href="/assets/index-fixture.css">
</head><body><div id="root"></div></body></html>`;

test('一覧の別名は既存のindexableな正規ページへ入り、薄い植物の直接URLも404にならない', (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-route-regression-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  write(fixture, 'dist/index.html', indexHtml);
  writeJson(fixture, 'dist/assets/data-lite/hostplants.json', {
    統合名: ['蛾A', '蛾B'], 記録1種: ['蛾A'],
  });
  writeJson(fixture, 'dist/assets/data-lite/plant-details.json', {
    統合名: { aliases: ['元表記', '統合名'] },
    短いプロフィール: { profile: { habit: '多年草' } },
  });
  for (const locale of ['', 'en/']) {
    const canonical = `https://orau98.github.io/${locale}plant/${encodeURIComponent('元表記')}/`;
    const profile = `<!doctype html><html><head><title>元表記の詳細</title>
<meta name="robots" content="index, follow"><link rel="canonical" href="${canonical}"></head>
<body><header class="meta-header"><h1>元表記</h1></header><main><p>昆虫2種の利用記録</p></main></body></html>`;
    write(fixture, `dist/${locale}meta/plant/元表記.html`, profile);
    write(fixture, `dist/${locale}plant/元表記/index.html`, profile);
  }
  const run = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/postbuild-cleanup.mjs')], { cwd: fixture, encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const routeSeo = JSON.parse(read(fixture, 'dist/assets/data-lite/plant-seo-routes.json'));
  for (const locale of ['ja', 'en']) {
    assert.deepEqual(routeSeo[locale].統合名, { canonicalName: '元表記', indexable: true });
    assert.deepEqual(routeSeo[locale].記録1種, { canonicalName: '記録1種', indexable: false });
  }
  const aliasBefore = read(fixture, 'dist/plant/統合名/index.html');
  for (const locale of ['', 'en/']) {
    const alias = read(fixture, `dist/${locale}plant/統合名/index.html`);
    assert.ok(alias.includes(`rel="canonical" href="https://orau98.github.io/${locale}plant/${encodeURIComponent('元表記')}/"`));
    assert.match(alias, /name="robots" content="index, follow/);
    assert.match(alias, /window\.history\.replaceState/);
    assert.match(alias, /__PLANT_SEARCH_ALIAS__/);
    for (const name of ['記録1種', '短いプロフィール']) {
      const direct = read(fixture, `dist/${locale}plant/${name}/index.html`);
      assert.match(direct, /name="robots" content="noindex, follow/);
      assert.match(direct, /__SEO_FORCE_NOINDEX__ = true/);
      assert.match(direct, /src="\/assets\/index-fixture.js"/);
      assert.match(direct, /id="root"/);
    }
    assert.equal(fs.existsSync(path.join(fixture, `dist/${locale}plant/削除済み/index.html`)), false);
  }
  const second = run();
  assert.equal(second.status, 0, second.stdout + second.stderr);
  const normalizeMarkup = (html) => html.replace(/>\s+</g, '><').trim();
  assert.equal(normalizeMarkup(read(fixture, 'dist/plant/統合名/index.html')), normalizeMarkup(aliasBefore));
});

test('本文のあるべき植物が欠落した場合はnoindexへ落とさずビルドを失敗させる', (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-route-guard-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  write(fixture, 'dist/index.html', indexHtml);
  writeJson(fixture, 'dist/assets/data-lite/hostplants.json', { 未生成: ['蛾A', '蛾B'] });
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/postbuild-cleanup.mjs')], { cwd: fixture, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Indexable plant content is missing: ja\/未生成/);
  assert.equal(fs.existsSync(path.join(fixture, 'dist/plant/未生成/index.html')), false);
});

test('英語メタ生成は既に確定した植物名を古い別名索引で別植物へ移さず、写真のみのページもindexを保つ', async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-meta-regression-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const dataRoot = 'public/assets/data-lite/';
  writeJson(fixture, dataRoot + 'moths.json', [
    { id: 'species-1', name: '蛾A', scientificName: 'Testa alpha', type: 'moth', hostPlants: ['チシャノキ'] },
    { id: 'species-2', name: '蛾B', scientificName: 'Testa beta', type: 'moth', hostPlants: ['チシャノキ'] },
  ]);
  writeJson(fixture, dataRoot + 'hostplants.json', { チシャノキ: ['蛾A', '蛾B'] });
  writeJson(fixture, dataRoot + 'flower-visit-plants.json', { 訪花のみ: ['蛾A', '蛾B'] });
  writeJson(fixture, dataRoot + 'plant-details.json', {
    チシャノキ: { name: 'チシャノキ', scientificName: 'Ehretia acuminata', aliases: ['チシャノキ'] },
    写真のみ: { name: '写真のみ', scientificName: 'Photo test', profile: { habit: '多年草' } },
    訪花のみ: { name: '訪花のみ', scientificName: 'Flower test' },
  });
  writeJson(fixture, dataRoot + 'ylist-lite.json', { aliasToCanonical: { チシャノキ: 'エゴノキ' }, plants: {} });
  write(fixture, 'public/images/plants/写真のみ.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=', 'base64'));
  const fakeGenerator = path.join(fixture, 'scripts/generate-meta-en-pages.mjs');
  const bundle = await build({ entryPoints: [path.join(ROOT, 'scripts/generate-meta-en-pages.mjs')],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(fakeGenerator).href) },
    // この最小データには統合済み昆虫を入れない。植物生成とは独立した監査台帳だけ空にする。
    plugins: [{ name: 'empty-insect-merge-inventory', setup(builder) {
      builder.onLoad({ filter: /mergedTaxonRedirects\.mjs$/ }, () => ({
        contents: 'export const loadMergedTaxonRedirects = () => [];', loader: 'js',
      }));
    } }],
  });
  const run = spawnSync(process.execPath, ['--input-type=module'], { cwd: fixture, input: bundle.outputFiles[0].text, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const map = JSON.parse(read(fixture, 'public/seo-route-map.plants.json'));
  assert.ok(map.チシャノキ, '昆虫2種の通常ページがindex対象として生成される');
  assert.equal(map.エゴノキ, undefined, '別植物へ転送しない');
  const html = read(fixture, `public/${map.チシャノキ.slice(1)}`);
  assert.match(html, /Ehretia acuminata/);
  assert.match(html, /name="robots" content="index, follow/);
  assert.ok(map.写真のみ, '写真のあるページは従来のindex基準を満たす');
  assert.ok(map.訪花のみ, '訪花だけでも2昆虫の記録があるページをnoindexへ落とさない');
  assert.ok(fs.existsSync(path.join(fixture, 'public/en/plant/チシャノキ/index.html')));
});

test('日本語メタ生成も写真のある短いプロフィールには本文とindexableな正規URLを用意する', async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-photo-regression-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  write(fixture, 'normalized_data/insects.csv', 'insect_id,japanese_name,scientific_name,family,family_jp\n');
  write(fixture, 'normalized_data/hostplants.csv', 'record_id,insect_id,plant_name,plant_family\n');
  write(fixture, 'normalized_data/general_notes.csv', 'record_id,insect_id,note_type,note\n');
  writeJson(fixture, 'public/assets/data-lite/plant-details.json', {
    写真のみ: { name: '写真のみ', scientificName: 'Photo test', aliases: ['写真のみ'], profile: { habit: '多年草' } },
  });
  write(fixture, 'public/images/plants/写真のみ.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=', 'base64'));
  const fakeGenerator = path.join(fixture, 'scripts/generate-meta-pages.js');
  const bundle = await build({ entryPoints: [path.join(ROOT, 'scripts/generate-meta-pages.js')],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(fakeGenerator).href) },
    plugins: [{ name: 'empty-insect-merge-inventory', setup(builder) {
      builder.onLoad({ filter: /mergedTaxonRedirects\.mjs$/ }, () => ({
        contents: 'export const loadMergedTaxonRedirects = () => [];', loader: 'js',
      }));
    } }],
  });
  const run = spawnSync(process.execPath, ['--input-type=module'], { cwd: fixture, input: bundle.outputFiles[0].text, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const html = read(fixture, 'public/meta/plant/写真のみ.html');
  assert.match(html, /name="robots" content="index, follow/);
  assert.match(html, /<h1[^>]*>写真のみ<\/h1>/);
  assert.ok(fs.existsSync(path.join(fixture, 'public/plant/写真のみ/index.html')));
});
