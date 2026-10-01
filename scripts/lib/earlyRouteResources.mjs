// 起動直後に読むデータを、HTML を読んだ時点で取りに行かせる（vite.config.js から使う）。
//
// 以前は「JS を実行 → manifest.json → 最初の48件（トップのみ）」と順番に取りに行っていた。
// どちらも数KB と小さいので、HTML の preload にしても最初の描画の邪魔にならない。
// 一覧画面の JS（遅延読み込みのチャンク）は、HTML で先読みすると最初の描画と CPU・帯域を
// 取り合ったため、アプリの起動時に読み始める（src/App.jsx の prefetchExplorerRoute）。
import fs from 'fs';
import path from 'path';

// postbuild-cleanup.mjs が、トップ以外のページからこの印の付いた行（トップ専用のデータ）を外す
export const ROUTE_PRELOAD_ATTRIBUTE = 'data-route-preload';

// build-data-lite が書いた manifest.json の版（最初の48件のURLの ?v= に使われる）
export const readDataLiteManifestVersion = (rootDir) => {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'public', 'assets', 'data-lite', 'manifest.json'), 'utf8'),
    );
    return typeof manifest?.version === 'string' ? manifest.version : '';
  } catch {
    return '';
  }
};

// URL はアプリの fetch と完全に同じにする（違うと二重に取得する）。
// crossorigin は fetch() と資格情報モードを揃えるために必要。
export const buildEarlyRouteResourceTags = ({
  base = '/',
  appBuildId = '',
  manifestVersion = '',
}) => [
  ...(appBuildId ? [{
    tag: 'link',
    attrs: {
      rel: 'preload',
      as: 'fetch',
      href: `${base}assets/data-lite/manifest.json?v=${encodeURIComponent(appBuildId)}`,
      fetchpriority: 'high',
      crossorigin: true,
    },
    injectTo: 'head',
  }] : []),
  ...(manifestVersion ? [{
    tag: 'link',
    attrs: {
      rel: 'preload',
      as: 'fetch',
      href: `${base}assets/data-lite/catalog/home-preview.json?v=${manifestVersion}`,
      fetchpriority: 'high',
      crossorigin: true,
      [ROUTE_PRELOAD_ATTRIBUTE]: 'home',
    },
    injectTo: 'head',
  }] : []),
];

export const earlyRouteResourcesPlugin = ({ appBuildId, rootDir }) => {
  let base = '/';
  return {
    name: 'early-route-resources',
    apply: 'build',
    configResolved(config) {
      base = config.base || '/';
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return {
          html,
          tags: buildEarlyRouteResourceTags({
            base,
            appBuildId,
            manifestVersion: readDataLiteManifestVersion(rootDir),
          }),
        };
      },
    },
  };
};

// postbuild 用: トップ専用の先読み行（最初の48件）を HTML から外す
export const stripHomeOnlyPreloads = (html = '') =>
  String(html || '').replace(
    new RegExp(`[ \\t]*<link\\b[^>]*\\b${ROUTE_PRELOAD_ATTRIBUTE}="home"[^>]*>\\n?`, 'g'),
    '',
  );
