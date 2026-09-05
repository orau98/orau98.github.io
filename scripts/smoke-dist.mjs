import fs from 'fs';
import path from 'path';
import { buildInsectPath } from '../src/utils/insectSlug.js';
import { INSECT_SECTION_CONFIGS } from '../src/utils/siteTaxonomy.js';
import { slugifyScientificLabel } from './lib/englishNaming.mjs';
import { loadKamikiriMergedTaxonRedirects } from './lib/kamikiriAuditRedirects.mjs';
import {
  loadButterflyMergedTaxonRedirects,
  loadLeafBeetleMergedTaxonRedirects,
} from './lib/mergedTaxonRedirects.mjs';
import { hasNoindexRobotsMeta } from './lib/metaPageLinks.mjs';
import { SITE_ICON_VERSION } from '../src/utils/siteBrand.js';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');
const RESPONSIVE_IMAGES_SKIPPED = process.env.SKIP_RESPONSIVE_IMAGES === '1';
const KAMIKIRI_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-longhorn-beetles-2007.csv',
);
const LEAF_BEETLE_CANONICAL_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const BUTTERFLY_CANONICAL_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/butterfly-canonical-taxonomy-merge-2026-07-12.json',
);
const REQUIRED_FILES = [
  'index.html',
  '.nojekyll',
  'favicon.ico',
  'favicon-48.png',
  'favicon-192.png',
  'favicon.svg',
  'apple-touch-icon.png',
  'site.webmanifest',
  'quiz/index.html',
  'en/index.html',
  'en/quiz/index.html',
  'moth/index.html',
  'plant/index.html',
  'en/moth/index.html',
  'en/plant/index.html',
  'meta/butterfly/index.html',
  'meta/moth/index.html',
  'meta/plant/index.html',
  'meta/plant/グスクカンアオイ.html',
  'meta/plant/アカミノルイヨウショウマ.html',
  'meta/plant/ナガバギシギシ.html',
  'meta/plant/キハダ.html',
  'en/meta/moth/index.html',
  'en/meta/plant/index.html',
  'robots.txt',
  'ads.txt',
  'sitemap.txt',
  'sitemap.xml',
  'sitemap-index.xml',
  'sitemap_index.xml',
  'search-console-submit.xml',
  'search-console-submit.txt',
  'search-console-discovery-seed.xml',
  'search-console-discovery-seed.txt',
  'sitemap-core.xml',
  'sitemap-all.txt',
  'opensearch.xml',
  'sitemap.html',
];

// Runtime data contract: every file the SPA fetches at runtime.
// If one of these is missing the deployed site silently degrades
// (404 responses are masked by fetch fallbacks), so fail the build here.
// Keep in sync with scripts/sync-public-insects-csv.mjs and src data loaders.
const RUNTIME_DATA_FILES = [
  'insects.csv',
  'hostplants.csv',
  'general_notes.csv',
  'image_filenames.txt',
  'image_extensions.json',
  'plant_image_filenames.txt',
  'instagram_posts.json',
  'instagram_posts.txt',
  'instagram_latest.txt',
  'assets/data-lite/manifest.json',
  'assets/data-lite/moths.json',
  'assets/data-lite/butterflies.json',
  'assets/data-lite/beetles.json',
  'assets/data-lite/longhornbeetles.json',
  'assets/data-lite/barkbeetles.json',
  'assets/data-lite/leafbeetles.json',
  'assets/data-lite/aphids.json',
  ...INSECT_SECTION_CONFIGS.map(
    (section) => `assets/data-lite/catalog/${section.collectionKey}.json`,
  ),
  'assets/data-lite/hostplants.json',
  'assets/data-lite/plant-details.json',
  'assets/data-lite/flower-visit-plants.json',
  'assets/data-lite/image-index.json',
  'assets/data-lite/ylist-lite.json',
  'assets/data-lite/index.json',
  'assets/data-lite/full-dataset.json',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasIndexFollowRobots(html) {
  const robotsTag = (html.match(/<meta\b[^>]*>/gi) || []).find((tag) =>
    /\bname=["']robots["']/i.test(tag),
  );
  const content = robotsTag?.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
  const tokens = new Set(content.toLowerCase().split(/[\s,]+/).filter(Boolean));
  return tokens.has('index') &&
    tokens.has('follow') &&
    !tokens.has('noindex') &&
    !tokens.has('nofollow');
}

const REQUIRED_SITE_ICON_HREFS = [
  `/favicon-48.png?v=${SITE_ICON_VERSION}`,
  `/favicon.svg?v=${SITE_ICON_VERSION}`,
  `/favicon-192.png?v=${SITE_ICON_VERSION}`,
  `/apple-touch-icon.png?v=${SITE_ICON_VERSION}`,
  `/site.webmanifest?v=${SITE_ICON_VERSION}`,
];

function assertSiteIconLinks(html, sourcePath) {
  for (const href of REQUIRED_SITE_ICON_HREFS) {
    assert(html.includes(`href="${href}"`), `${sourcePath} is missing site icon link: ${href}`);
  }
}

assert(
  hasIndexFollowRobots('<meta content="index, follow" name="robots">'),
  'robots parser must accept index, follow regardless of attribute order',
);
assert(
  !hasIndexFollowRobots('<meta name="robots" content="noindex, follow">') &&
    !hasIndexFollowRobots('<meta name="robots" content="index, nofollow">'),
  'robots parser must reject noindex and nofollow directives',
);

const readDistText = (relativePath) =>
  fs.readFileSync(path.join(DIST_DIR, relativePath), 'utf8');
const readPublicText = (relativePath) =>
  fs.readFileSync(path.join(PUBLIC_DIR, relativePath), 'utf8');

const assertLegacyMetaCompatibility = (html, sourcePath) => {
  const canonicalHref = html.match(
    /<link\s+rel=["']canonical["'][^>]*href=(?:"([^"]+)"|'([^']+)')/i,
  )?.slice(1).find(Boolean) || '';
  assert(
    html.includes('window.__LEGACY_META_COMPATIBILITY__') &&
      html.includes('window.history.replaceState') &&
      html.includes('window.location.search + window.location.hash') &&
      html.includes('<div id="root"></div>') &&
      !/http-equiv=["']refresh["']/i.test(html) &&
      !/window\.location\.replace\(/.test(html) &&
      !/https:\/\/orau98\.github\.io\/(?:en\/)?meta\//.test(canonicalHref),
    `${sourcePath} must enter the clean React route without a redirect reload`,
  );
};

const siteUrlToDistRelativeFile = (href) => {
  const pathname = decodeURIComponent(new URL(href, 'https://orau98.github.io').pathname);
  const relativePath = pathname.replace(/^\/+/, '');
  return pathname.endsWith('/') ? path.join(relativePath, 'index.html') : relativePath;
};

const readDistJson = (relativePath) => {
  try {
    return JSON.parse(readDistText(relativePath));
  } catch (error) {
    throw new Error(`invalid JSON in dist artifact ${relativePath}: ${error?.message || error}`);
  }
};

const validateEnglishRedirectCanonical = ({
  html,
  mappedTargetPath = '',
  sourcePath,
  type,
}) => {
  const canonicalHref = html.match(
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i,
  )?.[1];
  assert(canonicalHref, `${sourcePath} canonical target missing`);

  if (mappedTargetPath) {
    assert(
      canonicalHref === `https://orau98.github.io${mappedTargetPath}`,
      `${sourcePath} canonical mismatch`,
    );
    return canonicalHref;
  }

  const targetRelativePath = decodeURIComponent(new URL(canonicalHref).pathname)
    .replace(/^\/+/, '');
  assert(
    fs.existsSync(path.join(DIST_DIR, targetRelativePath)),
    `${sourcePath} noindex canonical target is missing: ${canonicalHref}`,
  );
  const targetHtml = readDistText(targetRelativePath);
  const targetCanonical = targetHtml.match(
    /<link\s+rel=["']canonical["']\s+href=(?:"([^"]+)"|'([^']+)')/i,
  )?.slice(1).find(Boolean) || '';
  assert(
    hasNoindexRobotsMeta(targetHtml) &&
      targetCanonical.startsWith(`https://orau98.github.io/en/${type}/`),
    `${sourcePath} unmapped canonical must be the matching noindex English profile`,
  );
  return canonicalHref;
};

assert(fs.existsSync(DIST_DIR), 'dist directory not found');

for (const relativePath of REQUIRED_FILES) {
  const fullPath = path.join(DIST_DIR, relativePath);
  assert(fs.existsSync(fullPath), `missing dist artifact: ${relativePath}`);
}

const faviconIco = fs.readFileSync(path.join(DIST_DIR, 'favicon.ico'));
assert(
  faviconIco.length > 6 &&
    faviconIco.readUInt16LE(0) === 0 &&
    faviconIco.readUInt16LE(2) === 1,
  'favicon.ico must be a valid Windows icon resource',
);
const siteManifest = readDistJson('site.webmanifest');
assert(
  Array.isArray(siteManifest.icons) &&
    siteManifest.icons.length > 0 &&
    siteManifest.icons.every(({ src }) => String(src).endsWith(`?v=${SITE_ICON_VERSION}`)),
  'site.webmanifest must point to the cache-busted leaf icon set',
);

for (const relativePath of ['robots.txt', 'sitemap.xml', 'sitemap-en-moth.xml']) {
  const publicPath = path.join(ROOT, 'public', relativePath);
  assert(
    fs.existsSync(publicPath) && readDistText(relativePath) === fs.readFileSync(publicPath, 'utf8'),
    `${relativePath} must match the freshly generated public discovery artifact`,
  );
}

const englishHomeHtml = readDistText('en/index.html');
const englishHead = englishHomeHtml.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
const englishBody = englishHomeHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
assert(englishHead, 'en/index.html must contain a valid head element');
assert(
  !/<(?:section|h1|h2|p|div|ul|li)\b/i.test(englishHead),
  'en/index.html head must not contain body-only content from the no-JavaScript fallback',
);
assert(
  englishHead.includes('<title>Insects and Host Plants of Japan</title>') &&
    englishHead.includes('<link rel="canonical" href="https://orau98.github.io/en/">') &&
    englishHead.includes('hreflang="en" href="https://orau98.github.io/en/"') &&
    englishHead.includes('hreflang="x-default" href="https://orau98.github.io/"'),
  'en/index.html title, canonical, and hreflang metadata must remain inside head',
);
assert(
  /<noscript>[\s\S]*?<section\b/.test(englishBody),
  'en/index.html must keep the English no-JavaScript navigation inside body',
);

const japaneseHomeHtml = readDistText('index.html');
assertSiteIconLinks(japaneseHomeHtml, 'index.html');
// GA計測の回帰防止:
// (1) すべての着地ページ（ホーム・ハブシェル・種/植物ルートシェル）に
//     gtagローダが載っていること。シェルに無いと詳細URL直リンクの
//     セッションが丸ごと未計測になる。
// (2) index.html は js/config を page_view より先にキューへ積むこと。
//     順序が逆だと直帰セッションの初回 page_view が GA4 で破棄され得る。
const GA_LOADER_URL = 'https://www.googletagmanager.com/gtag/js?id=G-MFEQF99G0H';
const SHARED_ANALYTICS_LOADER = 'src="/assets/analytics-loader.js"';
const assertAnalyticsLoader = (html, sourcePath) => {
  assert(
    (html.includes(GA_LOADER_URL) && html.includes('window.dataLayer')) ||
      (html.includes(SHARED_ANALYTICS_LOADER) &&
        html.includes('data-measurement-id="G-MFEQF99G0H"')),
    `${sourcePath} must include the Google Analytics loader`,
  );
};
assertAnalyticsLoader(japaneseHomeHtml, 'index.html');
{
  const configPosition = japaneseHomeHtml.indexOf("window.gtag('config', 'G-MFEQF99G0H'");
  const loaderPosition = japaneseHomeHtml.indexOf('var loadAnalytics');
  assert(
    configPosition !== -1 && loaderPosition !== -1 && configPosition < loaderPosition,
    "index.html must queue gtag('js')/gtag('config') before the deferred loader so the first page_view is never processed ahead of config",
  );
}
for (const shellPath of [
  'moth/index.html',
  'plant/index.html',
  'en/moth/index.html',
  'en/plant/index.html',
  'en/index.html',
  'quiz/index.html',
  '404.html',
]) {
  assertAnalyticsLoader(readDistText(shellPath), shellPath);
}

const hubShellChecks = [
  { file: 'moth/index.html', canonical: 'https://orau98.github.io/moth/' },
  { file: 'plant/index.html', canonical: 'https://orau98.github.io/plant/' },
  { file: 'en/moth/index.html', canonical: 'https://orau98.github.io/en/moth/' },
  { file: 'en/plant/index.html', canonical: 'https://orau98.github.io/en/plant/' },
];
for (const { file, canonical } of hubShellChecks) {
  const hubHtml = readDistText(file);
  assert(
    hasIndexFollowRobots(hubHtml) &&
      hubHtml.includes(`rel="canonical" href="${canonical}"`) &&
      !/http-equiv=["']refresh["']/i.test(hubHtml),
    `hub shell must be indexable and self-canonical: ${file}`,
  );
}
const japaneseHomeBody = japaneseHomeHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
const japaneseHomeNoscript = japaneseHomeBody.match(/<noscript>([\s\S]*?)<\/noscript>/i)?.[1] || '';
assert(
  japaneseHomeNoscript.includes('JavaScript が無効な環境では') &&
    japaneseHomeNoscript.includes('植物・科から探す') &&
    japaneseHomeNoscript.includes('/moth/') &&
    japaneseHomeNoscript.includes('/plant/') &&
    !japaneseHomeNoscript.includes('/meta/'),
  'Japanese home must retain generic static navigation when JavaScript is unavailable',
);

const staticIndexTargets = [
  '/meta/butterfly/index.html',
  '/meta/moth/index.html',
  '/meta/plant/index.html',
  '/en/meta/butterfly/index.html',
  '/en/meta/moth/index.html',
  '/en/meta/plant/index.html',
];
for (const targetUrl of staticIndexTargets) {
  const targetPath = targetUrl.replace(/^\/+/, '');
  assert(
    fs.existsSync(path.join(DIST_DIR, targetPath)),
    `static index target is missing: ${targetUrl}`,
  );
  const targetHtml = readDistText(targetPath);
  const cleanHubUrl = targetUrl.startsWith('/en/')
    ? targetUrl.includes('/plant/') ? '/en/plant/' : '/en/moth/'
    : targetUrl.includes('/plant/') ? '/plant/' : '/moth/';
  assert(
    targetHtml.includes('window.__LEGACY_META_COMPATIBILITY__') &&
      targetHtml.includes('<div id="root"></div>') &&
      targetHtml.includes(`rel="canonical" href="https://orau98.github.io${cleanHubUrl}"`) &&
      targetHtml.includes('window.history.replaceState') &&
      !/http-equiv=["']refresh["']/i.test(targetHtml) &&
      !/window\.location\.replace\(/.test(targetHtml),
    `legacy index must enter the clean React hub without reloading: ${targetUrl}`,
  );
}

for (const relativePath of RUNTIME_DATA_FILES) {
  const fullPath = path.join(DIST_DIR, relativePath);
  assert(
    fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0,
    `missing or empty runtime data file: ${relativePath}`,
  );
}

const englishRouteMaps = {
  insects: readDistJson('seo-route-map.insects.json'),
  plants: readDistJson('seo-route-map.plants.json'),
};
for (const [mapName, routeMap] of Object.entries(englishRouteMaps)) {
  for (const [key, href] of Object.entries(routeMap)) {
    const targetRelativePath = decodeURIComponent(new URL(href, 'https://orau98.github.io').pathname)
      .replace(/^\/+/, '');
    const targetPath = path.join(DIST_DIR, targetRelativePath);
    assert(fs.existsSync(targetPath), `${mapName} route map target is missing: ${key} -> ${href}`);
    assert(
      hasIndexFollowRobots(readDistText(targetRelativePath)),
      `${mapName} route map target must be indexable: ${key} -> ${href}`,
    );
  }
}

const exactScientificPlantLinkCases = [
  {
    source: 'meta/moth/species-0353.html',
    scientificName: 'Artemisia maritima',
    canonicalName: 'ミブヨモギ',
  },
  {
    source: 'meta/moth/species-0680.html',
    scientificName: 'Salix caprea',
    canonicalName: 'バッコヤナギ',
  },
];
for (const { source, scientificName, canonicalName } of exactScientificPlantLinkCases) {
  const html = readPublicText(source);
  const canonicalHref = `/plant/${encodeURIComponent(canonicalName)}/`;
  const invalidHref = `/plant/${encodeURIComponent(scientificName)}/`;
  assert(
    html.includes(`href="${canonicalHref}"`) && !html.includes(`href="${invalidHref}"`),
    `${source} must resolve ${scientificName} to the generated ${canonicalName} page`,
  );
}

const unresolvedScientificPlantHtml = readPublicText('meta/moth/species-0352.html');
assert(
  unresolvedScientificPlantHtml.includes('Artemisia laciniata') &&
    !unresolvedScientificPlantHtml.includes(
      `href="/plant/${encodeURIComponent('Artemisia laciniata')}/"`,
    ),
  'unresolved scientific plant names must remain visible plain text without a broken link',
);

// Structural sanity checks on the runtime data contract.
const manifest = readDistJson('assets/data-lite/manifest.json');
assert(manifest && typeof manifest === 'object', 'manifest.json must be an object');
assert(Boolean(manifest.version), 'manifest.json must declare a version');
assert(
  /^[a-f0-9]{16}$/.test(String(manifest.version)),
  'manifest.json version must be a stable content hash',
);
assert(
  manifest.counts && typeof manifest.counts === 'object',
  'manifest.json must declare dataset counts',
);

const ylistLite = readDistJson('assets/data-lite/ylist-lite.json');
assert(
  Object.keys(ylistLite?.plants || {}).length > 0,
  'ylist-lite.json must contain plant entries (plant alias/family resolution breaks otherwise)',
);
assert(
  Object.keys(ylistLite?.aliasToCanonical || {}).length > 0,
  'ylist-lite.json must contain alias mappings',
);

const mothsLite = readDistJson('assets/data-lite/moths.json');
assert(Array.isArray(mothsLite) && mothsLite.length > 0, 'moths.json must be a non-empty array');
const mothsCatalog = readDistJson('assets/data-lite/catalog/moths.json');
assert(
  Array.isArray(mothsCatalog) && mothsCatalog.length === mothsLite.length,
  'catalog/moths.json must preserve every moth list entry',
);
assert(
  mothsCatalog.every(
    (record) =>
      record?._detail === false &&
      !Object.hasOwn(record, 'hostPlantsDetailed') &&
      !Object.hasOwn(record, 'generalNotes') &&
      !Object.hasOwn(record, 'emergenceTimeDetailed'),
  ),
  'catalog records must exclude detail-only literature payloads',
);
assert(
  mothsLite.every((record) => record?._detail === true),
  'full insect partitions must be marked as detail-ready',
);
assert(
  fs.statSync(path.join(DIST_DIR, 'assets/data-lite/catalog/moths.json')).size <
    fs.statSync(path.join(DIST_DIR, 'assets/data-lite/moths.json')).size * 0.7,
  'moth catalog must remain materially smaller than the detail partition',
);

const csvHeaderChecks = [
  { file: 'insects.csv', columns: ['insect_id'] },
  { file: 'hostplants.csv', columns: ['insect_id', 'plant_name'] },
  { file: 'general_notes.csv', columns: ['insect_id', 'note_type'] },
];
for (const { file, columns } of csvHeaderChecks) {
  const headerLine = (readDistText(file).split(/\r?\n/, 1)[0] || '').replace(/^﻿/, '');
  for (const column of columns) {
    assert(
      headerLine.includes(column),
      `${file} header must contain "${column}" (got: ${headerLine.slice(0, 120)})`,
    );
  }
}

const assetsDir = path.join(DIST_DIR, 'assets');
assert(fs.existsSync(assetsDir), 'missing dist/assets directory');

const assetFiles = fs.readdirSync(assetsDir);
assert(assetFiles.some((name) => /^index-.*\.js$/.test(name)), 'missing built JS asset in dist/assets');
assert(assetFiles.some((name) => /^index-.*\.css$/.test(name)), 'missing built CSS asset in dist/assets');

const builtJavaScript = assetFiles
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({
    name,
    content: fs.readFileSync(path.join(assetsDir, name), 'utf8'),
  }));
const homeExperienceBundles = builtJavaScript.filter(({ content }) =>
  content.includes('data-explorer-heading') && content.includes('explorer-results'),
);
assert(
  homeExperienceBundles.length === 1,
  `home experience must appear in exactly one built JS asset (got: ${homeExperienceBundles.map(({ name }) => name).join(', ') || 'none'})`,
);
assert(
  homeExperienceBundles[0].content.includes('data-explorer-heading'),
  'built home experience must retain the localized accessible h1',
);
assert(
  builtJavaScript.every(({ content }) =>
    !content.includes('data-home-discovery-links') &&
    !content.includes('目的から探す') &&
    !content.includes('Browse by topic')
  ),
  'built app must keep the search hero adjacent to results without the removed discovery block',
);

const okinagusaRoutePath = path.join('plant', 'オキナグサ', 'index.html');
assert(
  fs.existsSync(path.join(DIST_DIR, okinagusaRoutePath)),
  'missing オキナグサ plant app route',
);
const okinagusaRouteHtml = readDistText(okinagusaRoutePath);
assertSiteIconLinks(okinagusaRouteHtml, okinagusaRoutePath);
assertAnalyticsLoader(okinagusaRouteHtml, okinagusaRoutePath);
assert(
  okinagusaRouteHtml.includes('window.__PLANT_ROUTE_SHELL__') &&
    okinagusaRouteHtml.includes('/assets/index-') &&
    okinagusaRouteHtml.includes('/assets/meta-styles.css?v=4') &&
    okinagusaRouteHtml.includes('<div id="root" data-static-profile="plant">') &&
    okinagusaRouteHtml.includes('<main class="meta-content">'),
  'オキナグサ direct route must serve static profile content plus the Japanese SPA',
);
assert(
  !/http-equiv=["']refresh["']/i.test(okinagusaRouteHtml),
  'オキナグサ direct route must not redirect away from the app plant detail',
);
assert(
  okinagusaRouteHtml.includes('name="robots" content="index, follow') &&
    okinagusaRouteHtml.includes('rel="canonical" href="https://orau98.github.io/plant/%E3%82%AA%E3%82%AD%E3%83%8A%E3%82%B0%E3%82%B5/'),
  'オキナグサ interactive route must be the self-canonical plant profile',
);

const identificationProfileHtml = readPublicText('meta/plant/グスクカンアオイ.html');
assert(
  identificationProfileHtml.includes('類似種との見分け方') &&
    identificationProfileHtml.includes('比較対象') &&
    identificationProfileHtml.includes('日本の野生植物'),
  'a profile-only plant with audited identification traits must get a source-backed static page',
);

const indexableProfileName = 'アカミノルイヨウショウマ';
const indexableProfileRelativePath = `meta/plant/${indexableProfileName}.html`;
const indexableProfileHtml = readPublicText(indexableProfileRelativePath);
const indexableProfileUrl = `https://orau98.github.io/plant/${encodeURIComponent(indexableProfileName)}/`;
assert(
  hasIndexFollowRobots(indexableProfileHtml) &&
    indexableProfileHtml.includes('｜植物プロフィール｜昆虫植物図鑑</title>') &&
    indexableProfileHtml.includes('Actaea erythroearpa') &&
    indexableProfileHtml.includes('日本の野生植物 第1巻 p.369'),
  'a complete twice-reviewed profile-only plant must be indexable with scientific name and source',
);
assert(
  indexableProfileHtml.includes('"@type": "WebPage"') &&
    indexableProfileHtml.includes('"scientificName": "Actaea erythroearpa"') &&
    !indexableProfileHtml.includes('"hasEcologicalInteraction"') &&
    !indexableProfileHtml.includes('0種') &&
    !indexableProfileHtml.includes('食草として重要'),
  'profile-only metadata and body must not invent empty insect interactions or food-plant claims',
);
assert(
  indexableProfileHtml.includes(`/?tab=plants&amp;q=${encodeURIComponent(indexableProfileName)}`) &&
    indexableProfileHtml.includes('図鑑でこの植物を探す'),
  'a profile-only page must continue into the matching SPA plant search',
);

const thinProfileName = 'ナガバギシギシ';
const thinProfileHtml = readPublicText(`meta/plant/${thinProfileName}.html`);
const thinProfileUrl = `https://orau98.github.io/plant/${encodeURIComponent(thinProfileName)}/`;
assert(
  !hasIndexFollowRobots(thinProfileHtml) &&
    /<meta name="robots" content="noindex, follow/.test(thinProfileHtml),
  'an identification-only thin profile must remain noindex',
);

const plantHubHtml = fs.readdirSync(path.join(PUBLIC_DIR, 'meta', 'plant'))
  .filter((file) => /^(?:index|page-\d+)\.html$/.test(file))
  .map((file) => readPublicText(path.join('meta', 'plant', file)))
  .join('\n');
const plantSitemapHtml = readDistText('sitemap-plant.xml');
const discoverySeedHtml = readDistText('search-console-discovery-seed.xml');
assert(
  plantHubHtml.includes(`>${indexableProfileName}</a>`) &&
    plantSitemapHtml.includes(indexableProfileUrl) &&
    discoverySeedHtml.includes(indexableProfileUrl),
  'an indexable profile-only plant must be linked from the hub, sitemap, and discovery seed',
);
for (const oneInsectProfileName of ['ナガバノスミレサイシン', 'ルイヨウショウマ']) {
  const oneInsectProfileUrl = `https://orau98.github.io/plant/${encodeURIComponent(oneInsectProfileName)}/`;
  assert(
    discoverySeedHtml.includes(oneInsectProfileUrl),
    `a source-reviewed profile must stay in the discovery seed even when it has one related insect: ${oneInsectProfileName}`,
  );
}
assert(
  !plantHubHtml.includes(`>${thinProfileName}</a>`) &&
    !plantSitemapHtml.includes(thinProfileUrl) &&
    !discoverySeedHtml.includes(thinProfileUrl),
  'a thin noindex profile must stay out of discovery inventories',
);

const kihadaDetail = readDistJson('assets/data-lite/plant-details.json').キハダ;
const kihadaProfileHtml = readPublicText('meta/plant/キハダ.html');
assert(
  kihadaDetail?.profile?.habit === '落葉高木' &&
    kihadaDetail?.additionalProfiles?.[0]?.sourcePlantName === 'ミヤマキハダ' &&
    kihadaDetail.additionalProfiles[0].distinguishingFeatures.includes('オオバキハダ'),
  'YList alias canonicalization must preserve the canonical and source-name profiles separately',
);
assert(
  kihadaProfileHtml.includes('「ミヤマキハダ」としての植物プロフィール') &&
    kihadaProfileHtml.includes('オオバキハダに似るが') &&
    kihadaProfileHtml.includes('日本の野生植物 第2巻 p.112'),
  'the canonical static page must render the preserved source-name profile with its own citation',
);

const okinagusaEnglishRoutePath = path.join('en', 'plant', 'オキナグサ', 'index.html');
assert(
  fs.existsSync(path.join(DIST_DIR, okinagusaEnglishRoutePath)),
  'missing English オキナグサ plant app route',
);
const okinagusaEnglishRouteHtml = readDistText(okinagusaEnglishRoutePath);
assert(
  okinagusaEnglishRouteHtml.includes('window.__PLANT_ROUTE_SHELL__') &&
    okinagusaEnglishRouteHtml.includes('<html lang="en"') &&
    okinagusaEnglishRouteHtml.includes('/assets/index-') &&
    okinagusaEnglishRouteHtml.includes('<div id="root" data-static-profile="plant">') &&
    okinagusaEnglishRouteHtml.includes('<main class="meta-content">'),
  'English オキナグサ direct route must serve static profile content plus the English SPA',
);
assert(
  !/http-equiv=["']refresh["']/i.test(okinagusaEnglishRouteHtml),
  'English オキナグサ direct route must not redirect away from the app plant detail',
);
assert(
  okinagusaEnglishRouteHtml.includes('name="robots" content="index, follow') &&
    okinagusaEnglishRouteHtml.includes('rel="canonical" href="https://orau98.github.io/en/plant/%E3%82%AA%E3%82%AD%E3%83%8A%E3%82%B0%E3%82%B5/'),
  'English オキナグサ interactive route must be the self-canonical plant profile',
);

const insectProfileSegments = [
  'moth',
  'butterfly',
  'beetle',
  'longhornbeetle',
  'barkbeetle',
  'leafbeetle',
  'aphid',
];

// Species/profile discovery must use only the short canonical namespace.
// Legacy /meta/ documents stay live for inbound links, but submitting them in
// the same sitemap would keep Google's canonical choice split indefinitely.
for (const segment of [...new Set([...insectProfileSegments, 'plant'])]) {
  const sitemapHtml = readDistText(`sitemap-${segment}.xml`);
  const legacyProfilePattern = segment === 'plant'
    ? /<loc>https:\/\/orau98\.github\.io\/meta\/plant\/(?!page-\d+\.html<\/loc>)[^<]+\.html<\/loc>/u
    : new RegExp(
      `<loc>https://orau98\\.github\\.io/meta/${segment}/species-[^<]+\\.html</loc>`,
      'u',
    );
  assert(
    !legacyProfilePattern.test(sitemapHtml),
    `sitemap-${segment}.xml must not submit legacy /meta/ profile URLs`,
  );
  assert(
    sitemapHtml.includes(`<loc>https://orau98.github.io/${segment}/`),
    `sitemap-${segment}.xml must submit canonical /${segment}/ profile URLs`,
  );
}

for (const segment of insectProfileSegments) {
  const routeDir = path.join(DIST_DIR, segment);
  const routeDirectories = fs.readdirSync(routeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  assert(
    !routeDirectories.some((entry) => /%[0-9a-f]{2}/i.test(entry.name)),
    `${segment} shared routes must not keep literal percent-encoded directory names`,
  );
  const decodedRoute = routeDirectories.find((entry) => {
    if (!Array.from(entry.name).some((character) => character.codePointAt(0) > 127)) return false;
    const html = readDistText(path.join(segment, entry.name, 'index.html'));
    return html.includes('window.__INSECT_ROUTE_SHELL__');
  });
  assert(decodedRoute, `${segment} must include at least one decoded shared SPA route`);
  const decodedRouteHtml = readDistText(path.join(segment, decodedRoute.name, 'index.html'));
  assertSiteIconLinks(decodedRouteHtml, `${segment}/${decodedRoute.name}/index.html`);
  assertAnalyticsLoader(decodedRouteHtml, `${segment}/${decodedRoute.name}/index.html`);
  assert(
    decodedRouteHtml.includes('window.__INSECT_ROUTE_SHELL__') &&
      decodedRouteHtml.includes('/assets/index-') &&
      decodedRouteHtml.includes('<div id="root" data-static-profile="insect">') &&
      decodedRouteHtml.includes('<main class="meta-content">') &&
      decodedRouteHtml.includes(`https://orau98.github.io/${segment}/`),
    `${segment} shared route must serve static profile content plus a self-canonical SPA`,
  );
  assert(
    !/http-equiv=["']refresh["']/i.test(decodedRouteHtml) &&
      !decodedRouteHtml.includes('window.location.replace'),
    `${segment} shared route must not redirect away from the app detail`,
  );
}

const aoAtsubaRouteHtml = readDistText(path.join('moth', 'アオアツバ', 'index.html'));
assert(
  aoAtsubaRouteHtml.includes('window.__INSECT_ROUTE_SHELL__') &&
    aoAtsubaRouteHtml.includes('/assets/meta-styles.css?v=4') &&
    aoAtsubaRouteHtml.includes('<div id="root" data-static-profile="insect">') &&
    aoAtsubaRouteHtml.includes('<main class="meta-content">') &&
    !/http-equiv=["']refresh["']/i.test(aoAtsubaRouteHtml) &&
    !aoAtsubaRouteHtml.includes('window.location.replace'),
  'アオアツバ reload route must expose static content and keep the React detail instead of redirecting to /meta/',
);

const citationCanonicalHtml = readDistText(
  path.join('moth', 'ヒメアトスカシバ', 'index.html'),
);
assert(
  citationCanonicalHtml.includes('<span class="citation-bibliography">') &&
    citationCanonicalHtml.includes('ISBN 978-4-05-405109-6') &&
    citationCanonicalHtml.includes('>購入先</a>') &&
    citationCanonicalHtml.includes('rel="sponsored nofollow noopener noreferrer"'),
  'profile references must separate full bibliography text from affiliate purchase links',
);
assert(
  citationCanonicalHtml.includes('<span class="citation-bibliography">') &&
    citationCanonicalHtml.includes('ISBN 978-4-05-405109-6'),
  'canonical profile snapshots must preserve complete bibliography details',
);

const englishRouteMap = englishRouteMaps.insects;
for (const section of INSECT_SECTION_CONFIGS) {
  const insects = readDistJson(`assets/data-lite/${section.collectionKey}.json`);
  for (const insect of insects) {
    for (const locale of ['ja', 'en']) {
      const routePath = decodeURIComponent(buildInsectPath(insect, locale));
      const routeFile = path.join(
        DIST_DIR,
        ...routePath.replace(/^\/+/, '').split('/'),
        'index.html',
      );
      assert(
        fs.existsSync(routeFile),
        `${locale} app route has no static entry: ${routePath} (${insect.id})`,
      );
      const routeHtml = fs.readFileSync(routeFile, 'utf8');
      const routeNoindex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(routeHtml);
      const mappedEnglishTarget = englishRouteMap[insect.id];
      assert(
        routeHtml.includes('window.__INSECT_ROUTE_SHELL__') &&
          !/http-equiv=["']refresh["']/i.test(routeHtml) &&
          !routeHtml.includes('window.location.replace'),
        `${locale} app route must render the React detail without redirecting: ${routePath}`,
      );
      if (locale === 'ja' || mappedEnglishTarget) {
        assert(
          routeHtml.includes('<div id="root" data-static-profile="insect">') &&
            routeHtml.includes('<main class="meta-content">'),
          `${locale} app route with a generated profile must expose static content: ${routePath}`,
        );
      }
      assert(
        routeHtml.includes(SHARED_ANALYTICS_LOADER),
        `${locale} app route must include the Google Analytics loader: ${routePath}`,
      );
      const canonicalHref = routeHtml.match(
        /<link\s+rel=["']canonical["']\s+href=(?:"([^"]+)"|'([^']+)')/i,
      )?.slice(1).find(Boolean);
      assert(canonicalHref, `${locale} app route must declare its canonical profile: ${routePath}`);
      const expectedCanonicalHref = new URL(buildInsectPath(insect, locale), 'https://orau98.github.io').href;
      assert(
        canonicalHref === expectedCanonicalHref,
        `${locale} app route must be self-canonical: ${routePath} -> ${canonicalHref}`,
      );
      if (locale === 'en' && mappedEnglishTarget) {
        assert(
          !routeNoindex,
          `${locale} mapped app route must remain indexable: ${routePath}`,
        );
      } else if (locale === 'en') {
        assert(
          routeNoindex,
          `unmapped English app route must retain its noindex profile for ${insect.id}`,
        );
      } else {
        const sourceProfileSegment = INSECT_SECTION_CONFIGS
          .map((candidate) => candidate.routeSegment)
          .find((candidate) => fs.existsSync(
            path.join(DIST_DIR, 'meta', candidate, `${insect.id}.html`),
          ));
        assert(sourceProfileSegment, `missing Japanese source profile for ${insect.id}`);
        const sourceProfileHtml = readPublicText(`meta/${sourceProfileSegment}/${insect.id}.html`);
        const sourceNoindex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(sourceProfileHtml);
        assert(
          routeNoindex === sourceNoindex,
          `${locale} app route robots must match its source profile: ${routePath}`,
        );
      }
      if (insect.routeName) {
        const legacyRoutePath = decodeURIComponent(
          buildInsectPath({ ...insect, routeName: '' }, locale),
        );
        const legacyRouteFile = path.join(
          DIST_DIR,
          ...legacyRoutePath.replace(/^\/+/, '').split('/'),
          'index.html',
        );
        assert(
          fs.existsSync(legacyRouteFile),
          `${locale} duplicate-name legacy route disappeared: ${legacyRoutePath}`,
        );
      }
    }
  }
}

const unsafeAphidRouteHtml = readDistText(
  path.join('aphid', 'species-21296', 'index.html'),
);
assert(
  unsafeAphidRouteHtml.includes(
    'https://orau98.github.io/aphid/species-21296/',
  ),
  'insect names containing a slash must fall back to a stable id route',
);

const englishMothHubDir = path.join(PUBLIC_DIR, 'en', 'meta', 'moth');
const englishMothHubFiles = fs.readdirSync(englishMothHubDir)
  .filter((filename) => filename === 'index.html' || /^page-\d+\.html$/.test(filename))
  .sort();
assert(
  englishMothHubFiles.length >= 4,
  'English moth index must paginate beyond the former 1,500-link cap',
);
const englishMothHubLinks = new Set(
  englishMothHubFiles
    .flatMap((filename) => Array.from(
      readPublicText(path.join('en', 'meta', 'moth', filename))
        .matchAll(/href=["']([^"']+)["']/g),
      (match) => match[1],
    )),
);
const missingEnglishMothHubLinks = fs.readdirSync(englishMothHubDir)
  .filter((filename) => filename.endsWith('.html'))
  .filter((filename) => filename !== 'index.html' && !/^page-\d+\.html$/.test(filename))
  .filter((filename) => {
    const html = readPublicText(path.join('en', 'meta', 'moth', filename));
    if (!/name=["']robots["'] content=["']index, follow/i.test(html)) return false;
    const canonicalHref = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    return !canonicalHref || !englishMothHubLinks.has(new URL(canonicalHref).pathname);
  });
assert(
  missingEnglishMothHubLinks.length === 0,
  `English moth index leaves ${missingEnglishMothHubLinks.length} indexable profile(s) unlinked`,
);

const butterflyHubHtml = readPublicText(path.join('meta', 'butterfly', 'index.html'));
assert(
  butterflyHubHtml.includes('<title>蝶の食草一覧｜植物名と蝶の名前から探す｜昆虫植物図鑑</title>') &&
    butterflyHubHtml.includes('<h1>蝶の食草一覧</h1>') &&
    butterflyHubHtml.includes('<h2 id="butterfly-host-plant-heading">蝶を食草植物・分類群から探す</h2>') &&
    butterflyHubHtml.includes('<h2 id="butterfly-name-heading">蝶の名前・科から探す</h2>'),
  'butterfly hub must answer both plant-name and butterfly-name lookup intent',
);
assert(
  butterflyHubHtml.includes('主要食草や野外での利用頻度の順位を示すものではありません') &&
    /食草植物・分類群\d+件/.test(butterflyHubHtml) &&
    butterflyHubHtml.includes('id="butterfly-host-plant-filter"') &&
    butterflyHubHtml.includes('aria-live="polite"'),
  'butterfly host-plant lookup must explain record scope and provide an accessible filter',
);
assert(
  butterflyHubHtml.includes('rel="canonical" href="https://orau98.github.io/meta/butterfly/index.html"') &&
    /name=["']robots["'] content=["']index, follow/i.test(butterflyHubHtml),
  'butterfly hub must remain self-canonical and indexable',
);

const decodeHtmlText = (value) => String(value || '')
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'");
const featuredHostPlantBlock = butterflyHubHtml.match(
  /<ul class="featured-host-plants" data-butterfly-featured-host-plants>([\s\S]*?)<\/ul>/,
)?.[1] || '';
const featuredHostPlants = Array.from(
  featuredHostPlantBlock.matchAll(
    /<a href="([^"]+)">\s*<span>([^<]+)<\/span>\s*<span class="host-plant-count">蝶(\d+)種<\/span>/g,
  ),
  (match) => ({ href: match[1], name: decodeHtmlText(match[2]), count: Number(match[3]) }),
);
assert(featuredHostPlants.length === 12, 'butterfly hub must feature exactly 12 host plants');

const hostPlantDirectoryBlock = butterflyHubHtml.match(
  /<ul class="host-plant-directory-list" data-butterfly-host-plant-directory>([\s\S]*?)<\/ul>/,
)?.[1] || '';
const hostPlantDirectory = Array.from(
  hostPlantDirectoryBlock.matchAll(
    /<li class="host-plant-directory-item"[^>]*>\s*<a href="([^"]+)">([^<]+)<\/a>\s*<span class="host-plant-count">(\d+)種<\/span>/g,
  ),
  (match) => ({ href: match[1], name: decodeHtmlText(match[2]), count: Number(match[3]) }),
);
assert(
  hostPlantDirectory.length >= 500,
  `butterfly host-plant directory unexpectedly shrank to ${hostPlantDirectory.length} entries`,
);
assert(
  new Set(hostPlantDirectory.map(({ href }) => href)).size === hostPlantDirectory.length,
  'butterfly host-plant directory must not contain duplicate target links',
);
assert(
  hostPlantDirectory.every((item, index, items) =>
    index === 0 || items[index - 1].name.localeCompare(item.name, 'ja') <= 0),
  'butterfly host-plant directory must remain in Japanese name order',
);

const expectedFeaturedHostPlants = hostPlantDirectory
  .slice()
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
  .slice(0, 12);
assert(
  JSON.stringify(featuredHostPlants) === JSON.stringify(expectedFeaturedHostPlants),
  'featured butterfly host plants must be the deterministic top 12 from the full directory',
);

for (const { href, name, count } of hostPlantDirectory) {
  const relativePath = siteUrlToDistRelativeFile(href);
  assert(fs.existsSync(path.join(DIST_DIR, relativePath)), `missing butterfly host-plant target: ${href}`);
  const plantHtml = readDistText(relativePath);
  assert(
    !/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(plantHtml),
    `butterfly host-plant target must be indexable: ${href}`,
  );
  assert(
    plantHtml.includes(`rel="canonical" href="https://orau98.github.io${href}"`),
    `butterfly host-plant target must be self-canonical: ${href}`,
  );
  if (featuredHostPlants.some((item) => item.href === href)) {
    const sourcePlantName = decodeURIComponent(new URL(href, 'https://orau98.github.io').pathname)
      .split('/')
      .filter(Boolean)
      .at(-1);
    const sourcePlantHtml = readPublicText(`meta/plant/${sourcePlantName}.html`);
    assert(
      sourcePlantHtml.includes(`<strong>蝶</strong>では${count}種`),
      `featured count must match the ${name} plant profile`,
    );
  }
}

for (const segment of insectProfileSegments.filter((segment) => segment !== 'butterfly')) {
  assert(
    !readPublicText(path.join('meta', segment, 'index.html'))
      .includes('data-butterfly-host-plant-directory'),
    `${segment} hub must not inherit the butterfly-only host-plant directory`,
  );
}

for (const localePrefix of ['', 'en']) {
  const routeRoot = path.join(DIST_DIR, ...(localePrefix ? [localePrefix, 'plant'] : ['plant']));
  for (const entry of fs.readdirSync(routeRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const routeRelativePath = path.join(localePrefix, 'plant', entry.name, 'index.html');
    const routeHtml = readDistText(routeRelativePath);
    const canonicalHref = routeHtml.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    assert(canonicalHref, `${routeRelativePath} must declare a canonical target`);
    const canonicalRelativePath = siteUrlToDistRelativeFile(canonicalHref);
    const canonicalHtml = readDistText(canonicalRelativePath);
    const routeNoindex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(routeHtml);
    const canonicalNoindex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(canonicalHtml);
    assert(
      routeNoindex === canonicalNoindex,
      `${routeRelativePath} robots must match canonical target indexability`,
    );
  }
}

const legacyGuideChecks = [
  {
    source: path.join('guides', 'plants', 'keyaki.html'),
    target: 'https://orau98.github.io/plant/%E3%82%B1%E3%83%A4%E3%82%AD/',
  },
  {
    source: path.join('guides', 'categories', 'vegetables.html'),
    target: 'https://orau98.github.io/plant/',
  },
  {
    source: path.join('guides', 'host-plant-search.html'),
    target: 'https://orau98.github.io/plant/',
  },
  {
    source: path.join('en', 'guides', 'plants', 'fuji.html'),
    targetPrefix: 'https://orau98.github.io/en/plant/',
  },
];
for (const { source, target, targetPrefix } of legacyGuideChecks) {
  assert(fs.existsSync(path.join(DIST_DIR, source)), `missing migrated guide URL: ${source}`);
  const html = readDistText(source);
  assert(/http-equiv=["']refresh["']/i.test(html), `${source} must use an instant meta refresh`);
  assert(!/name=["']robots["'][^>]*noindex/i.test(html), `${source} migration must remain crawlable`);
  if (target) {
    assert(html.includes(`rel="canonical" href="${target}"`), `${source} canonical target mismatch`);
  } else {
    assert(html.includes(`rel="canonical" href="${targetPrefix}`), `${source} canonical target mismatch`);
  }
}

const kunugiPlantMetaHtml = readPublicText(path.join('meta', 'plant', 'クヌギ.html'));
const kunugiInsectSearchHref = '/?tab=insects&amp;q=%E3%82%AF%E3%83%8C%E3%82%AE';
assert(
  kunugiPlantMetaHtml.includes(kunugiInsectSearchHref) &&
    kunugiPlantMetaHtml.includes('この植物を利用する昆虫を見る') &&
    kunugiPlantMetaHtml.includes('関連昆虫を図鑑で見る'),
  'plant profiles must continue into the SPA insect results for that host plant',
);
assert(
  !kunugiPlantMetaHtml.includes('/?tab=plants&amp;q=%E3%82%AF%E3%83%8C%E3%82%AE'),
  'plant profiles must not send readers back to the same plant card search',
);

const defaultSocialJpgPath = '/images/resized/insects/Cucullia_argentea.1024.jpg';
const defaultSocialJpgFile = path.join(
  DIST_DIR,
  'images',
  'resized',
  'insects',
  'Cucullia_argentea.1024.jpg',
);
assert(
  fs.existsSync(defaultSocialJpgFile) && fs.statSync(defaultSocialJpgFile).size > 0,
  'missing retained JPEG used for default social metadata',
);
const rootHtml = readDistText('index.html');
assert(rootHtml.includes(defaultSocialJpgPath), 'root metadata must use the retained social JPEG');
if (!RESPONSIVE_IMAGES_SKIPPED) {
  assert(
    !fs.existsSync(path.join(
      DIST_DIR,
      'images',
      'resized',
      'insects',
      'Acronicta_alni.1024.jpg',
    )),
    'duplicate insect JPEG should be pruned when a WebP equivalent exists',
  );
  assert(
    fs.existsSync(path.join(
      DIST_DIR,
      'images',
      'resized',
      'insects',
      'Acronicta_alni.1024.webp',
    )),
    'legacy JPEG-only sources must receive a deployed WebP variant',
  );
}

const okinagusaImagePath = '/images/resized/plants/%E3%82%AA%E3%82%AD%E3%83%8A%E3%82%B0%E3%82%B5.1024.jpg';
const okinagusaImageFile = path.join(DIST_DIR, 'images', 'resized', 'plants', 'オキナグサ.1024.jpg');
if (!RESPONSIVE_IMAGES_SKIPPED) {
  assert(
    fs.existsSync(okinagusaImageFile) && fs.statSync(okinagusaImageFile).size > 0,
    'missing deployed オキナグサ responsive image file',
  );
}
const okinagusaMetaCandidates = [
  path.join('meta', 'plant', 'オキナグサ.html'),
  path.join('meta', 'plant', 'オキナグサ(キク科).html'),
  path.join('meta', 'plant', 'オキナグサ(キンポウゲ科).html'),
];
assert(
  okinagusaMetaCandidates.some((relativePath) => {
    const fullPath = path.join(DIST_DIR, relativePath);
    return fs.existsSync(fullPath) && readDistText(relativePath).includes(okinagusaImagePath);
  }),
  'オキナグサ static meta page must include the responsive plant image',
);

const mergedKamikiriRedirects = loadKamikiriMergedTaxonRedirects(KAMIKIRI_AUDIT_PATH);
assert(
  mergedKamikiriRedirects.length === 97,
  `expected 97 merged kamikiri redirects, found ${mergedKamikiriRedirects.length}`,
);
const longhornRuntimeIds = new Set(
  readDistJson('assets/data-lite/longhornbeetles.json').map((insect) => insect.id),
);
const englishInsectRoutes = readDistJson('seo-route-map.insects.json');
const japaneseLonghornSitemap = readDistText('sitemap-longhornbeetle.xml');
const englishLonghornSitemap = readDistText('sitemap-en-longhornbeetle.xml');
for (const redirect of mergedKamikiriRedirects) {
  assert(
    !longhornRuntimeIds.has(redirect.duplicateId) && longhornRuntimeIds.has(redirect.canonicalId),
    `merged kamikiri runtime IDs are inconsistent: ${redirect.duplicateId} -> ${redirect.canonicalId}`,
  );

  const jaRelativePath = path.join('meta', 'longhornbeetle', `${redirect.duplicateId}.html`);
  assert(fs.existsSync(path.join(DIST_DIR, jaRelativePath)), `missing merged ID redirect: ${jaRelativePath}`);
  const jaHtml = readDistText(jaRelativePath);
  const jaSourceHtml = readPublicText(jaRelativePath);
  const jaCleanTarget = jaHtml.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
  const jaTarget = `https://orau98.github.io/meta/longhornbeetle/${redirect.canonicalId}.html`;
  assertLegacyMetaCompatibility(jaHtml, jaRelativePath);
  assert(jaSourceHtml.includes(`rel="canonical" href="${jaTarget}"`), `${jaRelativePath} source canonical mismatch`);
  assert(jaSourceHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'), `${jaRelativePath} source migration marker missing`);
  assert(
    !japaneseLonghornSitemap.includes(`/meta/longhornbeetle/${redirect.duplicateId}.html`),
    `${jaRelativePath} migration URL must not be submitted in the sitemap`,
  );

  const englishTargetPath = englishInsectRoutes[redirect.canonicalId] || '';
  const legacyScientificSlug = slugifyScientificLabel(redirect.legacyScientificName);
  const enRelativePath = path.join('en', 'meta', 'longhornbeetle', `${legacyScientificSlug}.html`);
  assert(fs.existsSync(path.join(DIST_DIR, enRelativePath)), `missing merged English redirect: ${enRelativePath}`);
  const enHtml = readDistText(enRelativePath);
  const enSourceHtml = readPublicText(enRelativePath);
  const enCleanTarget = enHtml.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
  validateEnglishRedirectCanonical({
    html: enSourceHtml,
    mappedTargetPath: englishTargetPath,
    sourcePath: enRelativePath,
    type: 'longhornbeetle',
  });
  assertLegacyMetaCompatibility(enHtml, enRelativePath);
  assert(enSourceHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'), `${enRelativePath} source migration marker missing`);
  assert(
    !englishLonghornSitemap.includes(`/en/meta/longhornbeetle/${legacyScientificSlug}.html`),
    `${enRelativePath} migration URL must not be submitted in the sitemap`,
  );

  for (const legacyName of new Set([
    redirect.legacyDisplayName,
    redirect.legacyRouteName,
  ])) {
    const legacyNamedRouteKey = /[/\\?#%]/.test(legacyName)
      ? redirect.duplicateId
      : legacyName;
    for (const { prefix, target, label } of [
      { prefix: [], target: jaCleanTarget, label: 'Japanese' },
      { prefix: ['en'], target: enCleanTarget, label: 'English' },
    ]) {
      const namedRelativePath = path.join(
        ...prefix,
        'longhornbeetle',
        legacyNamedRouteKey,
        'index.html',
      );
      assert(
        fs.existsSync(path.join(DIST_DIR, namedRelativePath)),
        `missing merged ${label} named-route redirect: ${namedRelativePath}`,
      );
      const namedHtml = readDistText(namedRelativePath);
      assert(
        /http-equiv=["']refresh["']/i.test(namedHtml),
        `${namedRelativePath} must refresh immediately`,
      );
      assert(
        namedHtml.includes(`rel="canonical" href="${target}"`),
        `${namedRelativePath} canonical mismatch`,
      );
      assert(
        namedHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'),
        `${namedRelativePath} migration marker missing`,
      );
      assert(!/noindex/i.test(namedHtml), `${namedRelativePath} migration must remain crawlable`);
    }
  }
}

const mergedLeafBeetleRedirects = loadLeafBeetleMergedTaxonRedirects(
  LEAF_BEETLE_CANONICAL_AUDIT_PATH,
);
assert(
  mergedLeafBeetleRedirects.length === 13,
  `expected 13 merged leaf-beetle redirects, found ${mergedLeafBeetleRedirects.length}`,
);
const leafBeetleRuntimeIds = new Set(
  readDistJson('assets/data-lite/leafbeetles.json').map((insect) => insect.id),
);
const japaneseLeafBeetleSitemap = readDistText('sitemap-leafbeetle.xml');
const englishLeafBeetleSitemap = readDistText('sitemap-en-leafbeetle.xml');
for (const redirect of mergedLeafBeetleRedirects) {
  assert(
    !leafBeetleRuntimeIds.has(redirect.duplicateId)
      && leafBeetleRuntimeIds.has(redirect.canonicalId),
    `merged leaf-beetle runtime IDs are inconsistent: ${redirect.duplicateId} -> ${redirect.canonicalId}`,
  );

  const jaRelativePath = path.join('meta', 'leafbeetle', `${redirect.duplicateId}.html`);
  assert(
    fs.existsSync(path.join(DIST_DIR, jaRelativePath)),
    `missing merged leaf-beetle ID redirect: ${jaRelativePath}`,
  );
  const jaHtml = readDistText(jaRelativePath);
  const jaSourceHtml = readPublicText(jaRelativePath);
  const jaCleanTarget = jaHtml.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
  const jaTarget = `https://orau98.github.io/meta/leafbeetle/${redirect.canonicalId}.html`;
  assertLegacyMetaCompatibility(jaHtml, jaRelativePath);
  assert(jaSourceHtml.includes(`rel="canonical" href="${jaTarget}"`), `${jaRelativePath} source canonical mismatch`);
  assert(jaSourceHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'), `${jaRelativePath} source migration marker missing`);
  assert(
    !japaneseLeafBeetleSitemap.includes(`/meta/leafbeetle/${redirect.duplicateId}.html`),
    `${jaRelativePath} migration URL must not be submitted in the sitemap`,
  );

  const englishTargetPath = englishInsectRoutes[redirect.canonicalId] || '';
  const legacyScientificSlug = slugifyScientificLabel(redirect.legacyScientificName);
  const enRelativePath = path.join('en', 'meta', 'leafbeetle', `${legacyScientificSlug}.html`);
  assert(
    fs.existsSync(path.join(DIST_DIR, enRelativePath)),
    `missing merged leaf-beetle English redirect: ${enRelativePath}`,
  );
  const enHtml = readDistText(enRelativePath);
  const enSourceHtml = readPublicText(enRelativePath);
  const enCleanTarget = enHtml.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
  validateEnglishRedirectCanonical({
    html: enSourceHtml,
    mappedTargetPath: englishTargetPath,
    sourcePath: enRelativePath,
    type: 'leafbeetle',
  });
  assertLegacyMetaCompatibility(enHtml, enRelativePath);
  assert(enSourceHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'), `${enRelativePath} source migration marker missing`);
  assert(
    !englishLeafBeetleSitemap.includes(`/en/meta/leafbeetle/${legacyScientificSlug}.html`),
    `${enRelativePath} migration URL must not be submitted in the sitemap`,
  );

  for (const legacyName of new Set([
    redirect.legacyDisplayName,
    redirect.legacyRouteName,
  ].filter(Boolean))) {
    const legacyNamedRouteKey = /[/\\?#%]/.test(legacyName)
      ? redirect.duplicateId
      : legacyName;
    for (const { prefix, target, label } of [
      { prefix: [], target: jaCleanTarget, label: 'Japanese' },
      { prefix: ['en'], target: enCleanTarget, label: 'English' },
    ]) {
      const namedRelativePath = path.join(
        ...prefix,
        'leafbeetle',
        legacyNamedRouteKey,
        'index.html',
      );
      assert(
        fs.existsSync(path.join(DIST_DIR, namedRelativePath)),
        `missing merged leaf-beetle ${label} named-route redirect: ${namedRelativePath}`,
      );
      const namedHtml = readDistText(namedRelativePath);
      assert(/http-equiv=["']refresh["']/i.test(namedHtml), `${namedRelativePath} must refresh immediately`);
      assert(namedHtml.includes(`rel="canonical" href="${target}"`), `${namedRelativePath} canonical mismatch`);
      assert(
        namedHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'),
        `${namedRelativePath} migration marker missing`,
      );
      assert(!/noindex/i.test(namedHtml), `${namedRelativePath} migration must remain crawlable`);
    }
  }
}

const mergedButterflyRedirects = loadButterflyMergedTaxonRedirects(
  BUTTERFLY_CANONICAL_AUDIT_PATH,
);
assert(
  mergedButterflyRedirects.length === 1,
  `expected 1 merged butterfly redirect, found ${mergedButterflyRedirects.length}`,
);
const butterflyRuntimeIds = new Set(
  readDistJson('assets/data-lite/butterflies.json').map((insect) => insect.id),
);
const japaneseButterflySitemap = readDistText('sitemap-butterfly.xml');
for (const redirect of mergedButterflyRedirects) {
  assert(
    !butterflyRuntimeIds.has(redirect.duplicateId)
      && butterflyRuntimeIds.has(redirect.canonicalId),
    `merged butterfly runtime IDs are inconsistent: ${redirect.duplicateId} -> ${redirect.canonicalId}`,
  );
  const jaRelativePath = path.join('meta', 'butterfly', `${redirect.duplicateId}.html`);
  assert(fs.existsSync(path.join(DIST_DIR, jaRelativePath)), `missing merged butterfly ID redirect: ${jaRelativePath}`);
  const jaHtml = readDistText(jaRelativePath);
  const jaSourceHtml = readPublicText(jaRelativePath);
  const jaTarget = `https://orau98.github.io/meta/butterfly/${redirect.canonicalId}.html`;
  assertLegacyMetaCompatibility(jaHtml, jaRelativePath);
  assert(jaSourceHtml.includes(`rel="canonical" href="${jaTarget}"`), `${jaRelativePath} source canonical mismatch`);
  assert(jaSourceHtml.includes('name="x-redirect-kind" content="taxonomy-merge"'), `${jaRelativePath} source migration marker missing`);
  assert(
    !japaneseButterflySitemap.includes(`/meta/butterfly/${redirect.duplicateId}.html`),
    `${jaRelativePath} migration URL must not be submitted in the sitemap`,
  );
  assert(!englishInsectRoutes[redirect.duplicateId], `duplicate butterfly must not have an English canonical route: ${redirect.duplicateId}`);
  // The English route map intentionally contains indexable pages only. The exhaustive
  // app-route loop above separately verifies unmapped noindex canonical profiles.
}

assert(
  fs.existsSync(path.join(
    DIST_DIR,
    'en',
    'meta',
    'longhornbeetle',
    'glaphyra-glaphyra-shibatai-okinawana.html',
  )),
  'exact deleted scientific name must restore the Glaphyra (Glaphyra) English URL',
);
assert(
  !fs.existsSync(path.join(
    DIST_DIR,
    'en',
    'meta',
    'longhornbeetle',
    'glaphyra-shibatai-okinawana-hayashi-matsuda-1976.html',
  )),
  'simplified source taxon must not create a replacement URL that never existed',
);

console.log('[smoke-dist] ok');
