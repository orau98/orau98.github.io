import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHomePreview } from '../scripts/lib/homePreview.mjs';
import { isHomePreviewRoute } from '../src/utils/insectDataLoading.js';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';

const emptyCollections = () => Object.fromEntries(INSECT_COLLECTION_KEYS.map((key) => [key, []]));

test('先読みの48件は一覧の既定の並び（写真あり優先→五十音順）と同じ順に並ぶ', () => {
  const collections = emptyCollections();
  collections.moths = [
    { id: 'm1', name: 'ウスバ', scientificName: 'Usuba one', type: 'moth' },
    { id: 'm2', name: 'アオバ', scientificName: 'Aoba two', type: 'moth' },
    { id: 'm3', name: 'イラガ', scientificName: 'Iraga three', type: 'moth' },
  ];
  collections.butterflies = [{ id: 'b1', name: 'カラス', scientificName: 'Karasu four', type: 'butterfly' }];
  const preview = buildHomePreview({
    collections,
    imageIndex: { names: ['Iraga_three', 'Karasu_four'], exts: { Iraga_three: '.jpg', Karasu_four: '.jpg' } },
    version: 'v1',
    size: 3,
  });
  assert.equal(preview.version, 'v1');
  assert.equal(preview.total, 4);
  assert.deepEqual(preview.groupCounts, { moth: 3, butterfly: 1 });
  assert.deepEqual(preview.records.map((row) => row.id), ['m3', 'b1', 'm2']);
  assert.deepEqual(preview.records.map((row) => row.imageFilename), ['Iraga_three', 'Karasu_four', '']);
});

test('先読みはトップ（日本語・昆虫タブ・条件なし）だけで使う', () => {
  assert.equal(isHomePreviewRoute('/', ''), true);
  assert.equal(isHomePreviewRoute('/', '?utm_source=x'), true);
  for (const search of ['?q=アゲハ', '?tab=plants', '?ipage=2', '?igroup=moth', '?iphoto=has', '?isort=name', '?iper=96']) {
    assert.equal(isHomePreviewRoute('/', search), false, search);
  }
  assert.equal(isHomePreviewRoute('/en', ''), false);
  assert.equal(isHomePreviewRoute('/plant', ''), false);
  assert.equal(isHomePreviewRoute('/moth/アオバ/', ''), false);
});

test('一覧は先読み中、検索・絞り込み・2ページ目では空表示ではなくスケルトンを出す', () => {
  const source = fs.readFileSync(new URL('../src/components/MothList.jsx', import.meta.url), 'utf8');
  assert.match(source, /const showPreviewCards = isPreviewMode && !hasAnyCriteria && effectivePage === 1/);
  assert.match(source, /\(moths\?\.length \?\? 0\) === 0 && \(!hasAnyCriteria \|\| previewRecords\)/);
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  // 先読みの版がデータ本体と一致するときだけ使う
  assert.match(app, /preview\?\.version === manifest\.version/);
});
