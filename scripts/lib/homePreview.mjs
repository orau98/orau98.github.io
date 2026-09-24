import fs from 'fs';
import path from 'path';
import { INSECT_COLLECTION_KEYS } from '../../src/utils/siteTaxonomy.js';
import { SUPPLEMENTAL_INSECT_IMAGE_EXTS } from '../../src/utils/insectImageMappings.js';
import { buildNormalizedEntries } from '../../src/utils/insectImageResolver.js';
import { selectInsectImageBase } from '../../src/utils/insectImageSelection.js';

export const HOME_PREVIEW_FILE = path.join('catalog', 'home-preview.json');
// 4列×12行（PC）。2列・3列の画面ではこの先頭から24件・36件を使う
export const HOME_PREVIEW_SIZE = 48;

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
};

/**
 * トップ（日本語・昆虫タブ・条件なし）の1ページ目と同じ並びの先頭48件を作る。
 * 一覧の既定の並び（写真あり優先 → 和名の五十音順）を、ブラウザと同じ画像解決
 * （selectInsectImageBase）で再現する。全分類のデータ（約500KB）を待たずに
 * 最初のカードを出すためのもので、全データが届いたら通常の一覧に置き換わる。
 */
export const buildHomePreview = ({ collections, imageIndex, version, size = HOME_PREVIEW_SIZE }) => {
  const names = Array.isArray(imageIndex?.names) ? imageIndex.names : Object.keys(imageIndex?.exts || {});
  const imageNames = new Set(names.map((name) => String(name).trim()).filter(Boolean));
  const imageExtensions = { ...(imageIndex?.exts || {}) };
  Object.entries(SUPPLEMENTAL_INSECT_IMAGE_EXTS).forEach(([name, ext]) => {
    imageNames.add(name);
    imageExtensions[name] = ext;
  });
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);
  const context = { imageNames, imageExtensions, normalizedEntries, isReady: true };

  const all = INSECT_COLLECTION_KEYS.flatMap((key) => (Array.isArray(collections[key]) ? collections[key] : []));
  const withImage = all.map((insect) => ({ insect, image: selectInsectImageBase(insect, context) }));
  const visibleName = (insect) => insect?.name || insect?.scientificName || insect?.id || '';
  // Array.prototype.sort は安定ソートなので、同順位はブラウザと同じく分類の結合順になる
  withImage.sort((a, b) => {
    if (a.image && !b.image) return -1;
    if (!a.image && b.image) return 1;
    return String(visibleName(a.insect)).localeCompare(String(visibleName(b.insect)), 'ja');
  });

  const groupCounts = {};
  all.forEach((insect) => {
    const type = insect?.type || 'moth';
    groupCounts[type] = (groupCounts[type] || 0) + 1;
  });

  return {
    version,
    total: all.length,
    groupCounts,
    records: withImage.slice(0, size).map(({ insect, image }) => ({ ...insect, imageFilename: image || '' })),
  };
};

/** catalog と image-index.json の両方が揃っていれば先読み用ファイルを書く（順不同のビルド手順に対応） */
export const writeHomePreviewIfPossible = (dataLiteDir) => {
  const manifest = readJson(path.join(dataLiteDir, 'manifest.json'));
  const imageIndex = readJson(path.join(dataLiteDir, 'image-index.json'));
  const collections = Object.fromEntries(
    INSECT_COLLECTION_KEYS.map((key) => [key, readJson(path.join(dataLiteDir, 'catalog', `${key}.json`))]),
  );
  const outPath = path.join(dataLiteDir, HOME_PREVIEW_FILE);
  if (!manifest?.version || !imageIndex || INSECT_COLLECTION_KEYS.some((key) => !Array.isArray(collections[key]))) {
    fs.rmSync(outPath, { force: true });
    console.warn('[home-preview] catalog または image-index.json が未生成のため省略（もう一方のビルド後に作られます）');
    return null;
  }
  const preview = buildHomePreview({ collections, imageIndex, version: manifest.version });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(preview), 'utf-8');
  console.log('[home-preview] wrote', outPath, `records=${preview.records.length} size=${fs.statSync(outPath).size} bytes`);
  return preview;
};
