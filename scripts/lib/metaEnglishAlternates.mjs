// 日本語メタページの「英語版ページへのリンク（hreflang="en"）」を扱う共通処理。
//
// 日本語ページと英語ページは互いの生成物を参照する:
//   - 英語の生成（generate-meta-en-pages.mjs）は、対応する日本語ページが存在するかを見る
//   - 日本語ページの hreflang="en" は、英語ページがインデックス対象かどうかで決まる
// 以前は「日本語 → 英語 → 日本語をもう一度全部」の2回生成で解決していた。
// 現在は、日本語の生成で英語リンクの位置に目印（EN_ALTERNATE_MARKER）を置いて対象を記録し、
// 英語の生成後に apply-meta-en-alternates.mjs が目印だけを置き換える（生成は1回）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INSECT_SECTION_CONFIGS } from '../../src/utils/siteTaxonomy.js';
import { hasNoindexRobotsMeta } from './metaPageLinks.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_PUBLIC_DIR = path.join(ROOT, 'public');
export const DEFERRED_EN_ALTERNATES_PATH = path.join(ROOT, '.cache', 'meta-en-alternates.json');

// 目印は href を含む HTML コメント。置き換え後の文字列は従来の生成結果と完全に同じにする
export const buildEnAlternateLink = (href) => `<link rel="alternate" hreflang="en" href="${href}">\n  `;
export const buildEnAlternateMarker = (href) => `<!--meta:en-alternate href="${href}"-->`;
const EN_ALTERNATE_MARKER_PATTERN = /<!--meta:en-alternate href="([^"]*)"-->/;

// 英語メタページ（public/en/meta/）から id→slug および 植物名→slug のマップを構築する
function isIndexableEnglishMetaHref(href, publicDir) {
  if (!href) return false;
  const relativePath = decodeURIComponent(String(href).replace(/^\//, ''));
  const filePath = path.join(publicDir, relativePath);
  if (!fs.existsSync(filePath)) return false;
  return !hasNoindexRobotsMeta(fs.readFileSync(filePath, 'utf-8'));
}

export function buildEnglishSlugMaps({ publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  const SEO_ROUTE_MAP_INSECTS_PATH = path.join(publicDir, 'seo-route-map.insects.json');
  const SEO_ROUTE_MAP_PLANTS_PATH = path.join(publicDir, 'seo-route-map.plants.json');
  const insectIdToEnSlug = new Map();
  const plantNameToEnSlug = new Map();

  if (fs.existsSync(SEO_ROUTE_MAP_INSECTS_PATH)) {
    try {
      const routeMap = JSON.parse(fs.readFileSync(SEO_ROUTE_MAP_INSECTS_PATH, 'utf-8'));
      Object.entries(routeMap).forEach(([insectId, href]) => {
        const match = String(href).match(/^\/en\/meta\/([^/]+)\/([^/]+)\.html$/);
        if (!match || !isIndexableEnglishMetaHref(href, publicDir)) return;
        insectIdToEnSlug.set(insectId, {
          type: match[1],
          slug: decodeURIComponent(match[2]),
          href,
        });
      });
    } catch (_e) {
      // Existing English pages are still scanned below as a fallback.
    }
  }

  if (fs.existsSync(SEO_ROUTE_MAP_PLANTS_PATH)) {
    try {
      const routeMap = JSON.parse(fs.readFileSync(SEO_ROUTE_MAP_PLANTS_PATH, 'utf-8'));
      Object.entries(routeMap).forEach(([plantName, href]) => {
        const match = String(href).match(/^\/en\/meta\/plant\/([^/]+)\.html$/);
        if (!match || !isIndexableEnglishMetaHref(href, publicDir)) return;
        plantNameToEnSlug.set(plantName, decodeURIComponent(match[1]));
      });
    } catch (_e) {
      // Existing English pages are still scanned below as a fallback.
    }
  }

  const enMetaDir = path.join(publicDir, 'en', 'meta');
  if (!fs.existsSync(enMetaDir)) {
    return { insectIdToEnSlug, plantNameToEnSlug };
  }

  // 昆虫: /en/meta/{type}/*.html の Japanese page リンクからIDとスラグを対応付ける
  const insectTypes = INSECT_SECTION_CONFIGS.map(({ type }) => type);
  for (const type of insectTypes) {
    const typeDir = path.join(enMetaDir, type);
    if (!fs.existsSync(typeDir)) continue;
    for (const file of fs.readdirSync(typeDir)) {
      if (!file.endsWith('.html') || file === 'index.html') continue;
      const slug = file.replace(/\.html$/, '');
      try {
        const content = fs.readFileSync(path.join(typeDir, file), 'utf-8');
        if (hasNoindexRobotsMeta(content)) continue;
        // Japanese page link: href="/meta/{type}/{id}.html"
        const jaPageMatch = content.match(/href="\/meta\/[^/]+\/([^"]+)\.html"/);
        if (jaPageMatch) {
          const insectId = decodeURIComponent(jaPageMatch[1]);
          insectIdToEnSlug.set(insectId, {
            slug,
            type,
            href: `/en/meta/${type}/${encodeURIComponent(slug)}.html`,
          });
        }
      } catch (_e) {
        // 読み込み失敗はスキップ
      }
    }
  }

  // 植物: /en/meta/plant/*.html の Japanese page リンクから植物名を取得
  const plantDir = path.join(enMetaDir, 'plant');
  if (fs.existsSync(plantDir)) {
    for (const file of fs.readdirSync(plantDir)) {
      if (!file.endsWith('.html') || file === 'index.html') continue;
      const slug = file.replace(/\.html$/, '');
      try {
        const content = fs.readFileSync(path.join(plantDir, file), 'utf-8');
        if (hasNoindexRobotsMeta(content)) continue;
        // Japanese page link: href="/plant/{plantName}/"
        const jaPageMatch = content.match(/href="\/plant\/([^"]+)\/"/);
        if (jaPageMatch) {
          const plantName = decodeURIComponent(jaPageMatch[1]);
          plantNameToEnSlug.set(plantName, slug);
        }
      } catch (_e) {
        // 読み込み失敗はスキップ
      }
    }
  }

  return { insectIdToEnSlug, plantNameToEnSlug };
}

/**
 * 日本語の生成が記録した目印を、英語ページの有無に応じてリンクに置き換える（または消す）。
 * 英語ページがある植物だけ、旧英語ガイドURLからの転送ページも書き出す。
 */
export function applyDeferredEnglishAlternates({
  manifestPath = DEFERRED_EN_ALTERNATES_PATH,
  publicDir = DEFAULT_PUBLIC_DIR,
} = {}) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[meta-en-alternates] 記録がありません: ${manifestPath}（先に generate-meta-pages.js --defer-en-alternates を実行）`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const { insectIdToEnSlug, plantNameToEnSlug } = buildEnglishSlugMaps({ publicDir });
  const hasEnglish = ({ kind, key }) => (kind === 'plant' ? plantNameToEnSlug.has(key) : insectIdToEnSlug.has(key));
  let linked = 0;
  let cleared = 0;
  for (const page of manifest.pages || []) {
    const html = fs.readFileSync(page.file, 'utf-8');
    const match = html.match(EN_ALTERNATE_MARKER_PATTERN);
    if (!match) continue;
    const withEnglish = hasEnglish(page);
    fs.writeFileSync(page.file, html.replace(EN_ALTERNATE_MARKER_PATTERN, withEnglish ? buildEnAlternateLink(match[1]) : ''));
    if (withEnglish) linked += 1;
    else cleared += 1;
  }
  let redirects = 0;
  for (const redirect of manifest.redirects || []) {
    if (!hasEnglish(redirect)) continue;
    fs.mkdirSync(path.dirname(redirect.outputPath), { recursive: true });
    fs.writeFileSync(redirect.outputPath, redirect.html);
    redirects += 1;
  }
  fs.rmSync(manifestPath, { force: true });
  return { linked, cleared, redirects, insectMap: insectIdToEnSlug.size, plantMap: plantNameToEnSlug.size };
}
