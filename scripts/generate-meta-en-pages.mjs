import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globalJapaneseToScientificMapping } from '../src/utils/insectImageMappings.js';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from '../src/utils/insectImageResolver.js';
import { INSECT_SECTION_CONFIGS } from '../src/utils/siteTaxonomy.js';
import { ENGLISH_GUIDE_LABELS, buildHostPlantGuideConfigs } from './generate-host-plant-guides.mjs';
import {
  cleanString,
  isFlowerVisitRecord,
  normalizePlantNameLite,
} from './lib/dataLiteBuilders.mjs';
import {
  buildJapaneseReferenceLabel,
  ENGLISH_NAMING_NOTICE,
  EN_SITE_NAME,
  EN_TYPE_LABELS,
  EN_TYPE_PLURALS,
  getPrimaryEnglishName,
  slugifyScientificLabel,
} from './lib/englishNaming.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadProductionEnv() {
  const envPath = path.join(__dirname, '../.env.production');
  if (!fs.existsSync(envPath)) return;

  fs.readFileSync(envPath, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

loadProductionEnv();

const BASE_ORIGIN = process.env.BASE_ORIGIN || 'https://orau98.github.io';
const DATA_LITE_DIR = path.join(__dirname, '../public/assets/data-lite');
const PUBLIC_EN_DIR = path.join(__dirname, '../public/en');
const EN_META_DIR = path.join(PUBLIC_EN_DIR, 'meta');
const EN_META_STYLE_PATH = '/assets/meta-styles.css?v=4';
const INSECT_RESIZED_DIR = path.join(__dirname, '../public/images/resized/insects');
const PLANT_IMAGES_DIR = path.join(__dirname, '../public/images/plants');
const PUBLIC_DIR = path.join(__dirname, '../public');
const SEO_ROUTE_MAP_INSECTS_PATH = path.join(PUBLIC_DIR, 'seo-route-map.insects.json');
const SEO_ROUTE_MAP_PLANTS_PATH = path.join(PUBLIC_DIR, 'seo-route-map.plants.json');
const DEFAULT_SOCIAL_IMAGE_PATH = '/images/resized/insects/Cucullia_argentea.1024.jpg';
const ADSENSE_CLIENT = process.env.VITE_ADSENSE_CLIENT || 'ca-pub-6982051533473293';
const ADSENSE_HEAD_TAGS = `<meta name="google-adsense-account" content="${ADSENSE_CLIENT}">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;
const MANUAL_AD_SLOTS = Object.freeze({
  detail: process.env.VITE_ADSENSE_SLOT_DETAIL || '',
});
const DEFERRED_ADS_SCRIPT = MANUAL_AD_SLOTS.detail ? `<script>
    (function() {
      var loaded = false;
      function requestAds() {
        if (!document.querySelector('.adsbygoogle')) return;
        var queue = window.adsbygoogle = window.adsbygoogle || [];
        document.querySelectorAll('.adsbygoogle').forEach(function() {
          queue.push({});
        });
      }
      function loadAds() {
        if (loaded) {
          requestAds();
          return;
        }
        loaded = true;
        var script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}';
        script.onload = requestAds;
        document.head.appendChild(script);
      }
      window.addEventListener('load', function() {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(loadAds, { timeout: 1800 });
        } else {
          window.setTimeout(loadAds, 900);
        }
      }, { once: true });
    })();
  </script>` : '';
const PRESERVED_EN_STATIC_FILES = Object.freeze([
  'guides/index.html',
  'guides/what-is-host-plant.html',
  'guides/host-plant-search.html',
]);

const insectResizedFiles = fs.existsSync(INSECT_RESIZED_DIR)
  ? fs.readdirSync(INSECT_RESIZED_DIR).filter((file) => file.match(/\.(320|640|1024)\.jpg$/i))
  : [];
const insectResizedBaseSet = new Set(
  insectResizedFiles.map((file) => file.replace(/\.(320|640|1024)\.jpg$/i, '')),
);
const insectResizedEntries = buildNormalizedEntries(insectResizedBaseSet);

const SECTION_CONFIGS = Object.freeze(
  INSECT_SECTION_CONFIGS.map((section) => ({
    type: section.type,
    routeSegment: section.routeSegment,
    singularLabel: EN_TYPE_LABELS[section.type],
    pluralLabel: EN_TYPE_PLURALS[section.type],
  })),
);

function loadJson(fileName, fallback = null) {
  const filePath = path.join(DATA_LITE_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    if (fallback !== null) return fallback;
    throw new Error(`Missing JSON: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

function renderManualAdSlot(slotId, label = 'Advertisement') {
  if (!slotId) return '';
  return `<aside class="manual-ad-slot" aria-label="${label}" style="margin:32px 0;padding:12px;border:1px solid #dbe4ee;border-radius:12px;background:#ffffff;text-align:center">
        <div class="manual-ad-label" style="margin-bottom:8px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#8a98aa">${label}</div>
        <ins class="adsbygoogle"
             style="display:block;min-height:120px"
             data-ad-client="${ADSENSE_CLIENT}"
             data-ad-slot="${escapeAttr(slotId)}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </aside>`;
}

function stripImageExtension(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/i, '');
}

function buildPlantResizedImageUrl(fileName, width = 1024, format = 'jpg') {
  const baseName = stripImageExtension(fileName);
  if (!baseName) return '';
  return `/images/resized/plants/${encodeURIComponent(baseName)}.${width}.${format}`;
}

function buildPlantPictureHtml(file, altText) {
  const fileUrl = buildPlantResizedImageUrl(file);
  const fallback = escapeAttr(fileUrl);

  return `<img
                    src="${fallback}"
                    alt="${escapeAttr(altText)}"
                    loading="lazy"
                    decoding="async"
                  >`;
}

function buildExplorerRedirectHtml({ title, tab, label }) {
  const targetPath = `/en/?tab=${encodeURIComponent(tab)}`;
  const targetUrl = `${BASE_ORIGIN}${targetPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${targetUrl}">
  <meta http-equiv="refresh" content="0;url=${targetUrl}">
  <script>
    (function() {
      var params = new URLSearchParams(window.location.search || '');
      if (!params.has('tab')) params.set('tab', ${JSON.stringify(tab)});
      window.location.replace('/en/?' + params.toString() + (window.location.hash || ''));
    })();
  </script>
</head>
<body>
  <main>
    <p>Opening ${escapeHtml(label)}...</p>
    <p><a href="${targetPath}">${escapeHtml(label)}</a></p>
  </main>
</body>
</html>`;
}

function writeExplorerRedirect(segment, options) {
  const routeDir = path.join(PUBLIC_EN_DIR, segment);
  ensureDir(routeDir);
  fs.writeFileSync(path.join(routeDir, 'index.html'), buildExplorerRedirectHtml(options));
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function sitePathToPublicFilePath(sitePath) {
  if (!sitePath) return null;
  let pathname = '';
  try {
    pathname = new URL(sitePath, BASE_ORIGIN).pathname;
  } catch {
    return null;
  }
  const segments = pathname
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map(decodePathSegment);
  if (segments.length === 0) return path.join(PUBLIC_DIR, 'index.html');
  const filePath = path.join(PUBLIC_DIR, ...segments);
  if (pathname.endsWith('/')) return path.join(filePath, 'index.html');
  return filePath;
}

function sitePathExists(sitePath) {
  const filePath = sitePathToPublicFilePath(sitePath);
  return Boolean(filePath && fs.existsSync(filePath));
}

function buildLegacyRedirectHtml({ lang = 'en', title = '', targetUrl = '' }) {
  const safeTitle = escapeAttr(title || EN_SITE_NAME);
  const safeTargetUrl = escapeAttr(targetUrl);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>${safeTitle}</title>
  <link rel="canonical" href="${safeTargetUrl}">
  <meta http-equiv="refresh" content="0;url=${safeTargetUrl}">
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
  <main>
    <p>Opening the canonical page...</p>
    <p>If you are not redirected automatically, open the canonical page. <a href="${safeTargetUrl}">${safeTargetUrl}</a></p>
  </main>
</body>
</html>`;
}

function renderJsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

function formatScientificNameHTML(scientificName = '') {
  const trimmed = String(scientificName || '').trim();
  if (!trimmed) return '';
  const authorMatch = trimmed.match(/^(.+?)\s*(\([^)]+\))?\s*$/);
  if (authorMatch) {
    const nameWithoutAuthor = authorMatch[1].trim();
    const authorInfo = authorMatch[2] || '';
    const gss = nameWithoutAuthor.match(/^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s+([a-z-]+)(\s+.*)?$/);
    if (gss) {
      const genus = escapeHtml(gss[1]);
      const subgenus = escapeHtml(gss[2]);
      const species = escapeHtml(gss[3]);
      const extraInfo = escapeHtml((gss[4] || '').trim());
      const author = escapeHtml(authorInfo);
      return `<em>${genus}</em> (<em>${subgenus}</em>) <em>${species}</em>${extraInfo ? ` ${extraInfo}` : ''}${author ? ` ${author}` : ''}`;
    }
    const nameParts = nameWithoutAuthor.split(/\s+/);
    if (nameParts.length >= 2) {
      const binomial = escapeHtml(`${nameParts[0]} ${nameParts[1]}`);
      const extraInfo = escapeHtml(nameParts.slice(2).join(' '));
      const author = escapeHtml(authorInfo);
      return `<em>${binomial}</em>${extraInfo ? ` ${extraInfo}` : ''}${author ? ` ${author}` : ''}`;
    }
  }
  return `<em>${escapeHtml(trimmed)}</em>`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createSafeFileName(value = '') {
  return String(value || '').replace(/[/\\?%*:|"<>]/g, '-').trim();
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readPreservedEnglishStaticFiles() {
  return PRESERVED_EN_STATIC_FILES
    .map((relativePath) => {
      const filePath = path.join(PUBLIC_EN_DIR, relativePath);
      if (!fs.existsSync(filePath)) return null;
      return {
        relativePath,
        content: fs.readFileSync(filePath, 'utf-8'),
      };
    })
    .filter(Boolean);
}

function restorePreservedEnglishStaticFiles(files = []) {
  files.forEach(({ relativePath, content }) => {
    const filePath = path.join(PUBLIC_EN_DIR, relativePath);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf-8');
  });
}

function buildAlternateLanguageLinks(jaPath, enPath) {
  const validJaPath = jaPath && sitePathExists(jaPath) ? jaPath : '';
  const defaultPath = validJaPath || enPath;
  return [
    validJaPath
      ? `<link rel="alternate" hreflang="ja" href="${BASE_ORIGIN}${escapeAttr(validJaPath)}">`
      : '',
    `<link rel="alternate" hreflang="en" href="${BASE_ORIGIN}${escapeAttr(enPath)}">`,
    `<link rel="alternate" hreflang="x-default" href="${BASE_ORIGIN}${escapeAttr(defaultPath)}">`,
  ].filter(Boolean).join('\n  ');
}

function resolveJapanesePlantMetaPath(canonicalName, detail) {
  const display = buildPlantDisplay(detail, canonicalName);
  const candidates = [
    canonicalName,
    display.japaneseName,
    display.familyJapanese && display.japaneseName
      ? `${display.japaneseName}(${display.familyJapanese})`
      : '',
    ...(Array.isArray(display.aliases) ? display.aliases : []),
  ]
    .map((name) => cleanString(name))
    .filter(Boolean)
    .map((name) => `/meta/plant/${encodeURIComponent(createSafeFileName(name))}.html`);

  for (const candidate of Array.from(new Set(candidates))) {
    if (sitePathExists(candidate)) return candidate;
  }
  return '';
}

function resolveJapaneseInsectMetaPath(insect, preferredRouteSegment) {
  const insectId = cleanString(insect.id);
  if (!insectId) return '';
  const routeSegments = [
    preferredRouteSegment,
    ...SECTION_CONFIGS.map((section) => section.routeSegment),
  ].filter(Boolean);
  const candidates = Array.from(new Set(routeSegments))
    .map((routeSegment) => `/meta/${routeSegment}/${encodeURIComponent(insectId)}.html`);
  for (const candidate of candidates) {
    if (sitePathExists(candidate)) return candidate;
  }
  return '';
}

function normalizedTextLength(value) {
  return String(value || '').replace(/\s+/g, '').length;
}

function buildRobotsContent(shouldIndex) {
  return `${shouldIndex ? 'index' : 'noindex'}, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`;
}

function isGeneratedMetaPageIndexableByHref(href) {
  if (!href) return false;
  const relativePath = decodeURIComponent(String(href).replace(/^\//, ''));
  const filePath = path.join(__dirname, '../public', relativePath);
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, 'utf-8');
  return !/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
}

function resolveInsectImageUrl(insect) {
  if (!insect) return '';
  const japaneseName = cleanString(insect.name || insect.japaneseName);
  const mapped = japaneseName ? globalJapaneseToScientificMapping.get(japaneseName) : undefined;
  const candidates = buildInsectImageBaseCandidates(insect, mapped);
  const resolvedBases = resolveImageBaseCandidates(candidates, {
    imageNames: insectResizedBaseSet,
    normalizedEntries: insectResizedEntries,
  });
  for (const base of resolvedBases) {
    if (!insectResizedBaseSet.has(base)) continue;
    for (const width of [1024, 640, 320]) {
      const resizedPath = path.join(INSECT_RESIZED_DIR, `${base}.${width}.jpg`);
      if (fs.existsSync(resizedPath)) {
        return `/images/resized/insects/${encodeURIComponent(base)}.${width}.jpg`;
      }
    }
  }
  return '';
}

function extractLarvalHostPlants(insect) {
  const detailed = Array.isArray(insect?.hostPlantsDetailed) ? insect.hostPlantsDetailed : [];
  if (detailed.length > 0) {
    const plants = detailed
      .filter((record) => !isFlowerVisitRecord(record))
      .map((record) => normalizePlantNameLite(cleanString(record?.name || record?.displayName || record?.plant)))
      .filter(Boolean)
      .filter((name) => name !== '不明');
    if (plants.length > 0) {
      return Array.from(new Set(plants));
    }
  }
  const hostPlants = insect?.hostPlants;
  if (Array.isArray(hostPlants)) {
    return Array.from(new Set(hostPlants.map((name) => normalizePlantNameLite(cleanString(name))).filter(Boolean)));
  }
  if (typeof hostPlants === 'string') {
    return Array.from(
      new Set(
        hostPlants
          .split(/[;；、,，]/)
          .map((name) => normalizePlantNameLite(cleanString(name)))
          .filter(Boolean),
      ),
    );
  }
  return [];
}

function normalizeInsectFamilyLabels(insect) {
  const classification = insect?.classification || {};
  return {
    familyLatin: cleanString(classification.family || insect.familyLatin || ''),
    familyJapanese: cleanString(classification.familyJapanese || insect.familyJapanese || insect.family || ''),
  };
}

function normalizePlantDetail(plantName, plantDetails) {
  return plantDetails?.[plantName] || {
    name: plantName,
    family: '',
    familyName: '',
    familyLatin: '',
    order: '',
    orderLatin: '',
    scientificName: '',
    genus: '',
    aliases: [plantName],
  };
}

function buildPlantDisplay(detail, plantName) {
  const japaneseName = cleanString(detail?.name || plantName);
  const scientificName = cleanString(detail?.scientificName);
  const primaryName = getPrimaryEnglishName({
    scientificName,
    japaneseName,
    fallback: 'Unknown plant',
  });
  return {
    primaryName,
    scientificName,
    japaneseName,
    japaneseReference: buildJapaneseReferenceLabel(japaneseName),
    familyLatin: cleanString(detail?.familyLatin),
    familyJapanese: cleanString(detail?.familyName || detail?.family),
    orderLatin: cleanString(detail?.orderLatin),
    orderJapanese: cleanString(detail?.order),
    genus: cleanString(detail?.genus),
    aliases: Array.isArray(detail?.aliases) ? detail.aliases.filter(Boolean) : [],
  };
}

function createUniqueSlug(baseSlug, usedSlugs, fallbackPrefix) {
  let base = cleanString(baseSlug) || fallbackPrefix;
  if (!base) base = fallbackPrefix;
  let candidate = base;
  let index = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

function getPlantImageFiles(plantName, plantDetail, allPlantImages) {
  if (!Array.isArray(allPlantImages) || allPlantImages.length === 0) return [];
  const baseJapanese = cleanString(plantName).split(/[（(]/)[0].trim();
  const baseScientific = slugifyScientificLabel(plantDetail?.scientificName);
  return allPlantImages.filter((file) => {
    const raw = file.replace(/\.[^.]+$/i, '');
    return raw.startsWith(baseJapanese) || (baseScientific && raw.includes(baseScientific.replace(/-/g, '_')));
  });
}

function buildPlantRecordMap(hostPlantsMap, plantDetails, ylistLite) {
  const aliasToCanonical = { ...(ylistLite?.aliasToCanonical || {}) };
  const usedSlugs = new Set();
  const plantRecords = new Map();

  Object.keys(hostPlantsMap)
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .forEach((plantName) => {
      const normalized = normalizePlantNameLite(plantName) || plantName;
      const canonical = aliasToCanonical[plantName] || aliasToCanonical[normalized] || normalized;
      const detail = normalizePlantDetail(canonical, plantDetails);
      const scientificSlug = slugifyScientificLabel(detail?.scientificName || canonical);
      const fileBase = scientificSlug || createSafeFileName(canonical);
      const slug = createUniqueSlug(fileBase, usedSlugs, `plant-${usedSlugs.size + 1}`);
      plantRecords.set(canonical, {
        canonicalName: canonical,
        detail,
        slug,
        href: `/en/meta/plant/${encodeURIComponent(slug)}.html`,
      });
    });

  return { plantRecords, aliasToCanonical };
}

function computeInsectRobotsContent({ hostPlantsArray, imageUrl, insect }) {
  const hasHostPlants = hostPlantsArray.length > 0;
  const hasImage = Boolean(imageUrl);
  const hasEmergence = cleanString(insect?.emergenceTime) && cleanString(insect?.emergenceTime) !== '不明';
  const hasRichNotes = normalizedTextLength(insect?.notes || insect?.remarks) >= 80;
  return buildRobotsContent(hasHostPlants || hasImage || hasEmergence || hasRichNotes);
}

function computePlantRobotsContent({ relatedInsects, plantImageFiles }) {
  const insectCount = Array.isArray(relatedInsects) ? relatedInsects.length : 0;
  const hasImage = Array.isArray(plantImageFiles) && plantImageFiles.length > 0;
  // 関連昆虫2種以上 or 画像あり でインデックス対象
  return buildRobotsContent(insectCount >= 2 || hasImage);
}

const hostPlantGuideConfigs = buildHostPlantGuideConfigs(loadJson('full-dataset.json', {}));
const HOST_PLANT_GUIDE_BY_VARIANT = new Map();
for (const guide of hostPlantGuideConfigs) {
  const names = new Set([guide.name, ...(Array.isArray(guide.variants) ? guide.variants : [])]);
  for (const name of names) {
    const key = buildHostPlantGuideLookupKey(name);
    if (key) HOST_PLANT_GUIDE_BY_VARIANT.set(key, guide);
  }
}

function buildHostPlantGuideLookupKey(value = '') {
  return String(value || '')
    .replace(/[（(][^）)]*[）)]\s*$/, '')
    .trim();
}

function findEnglishHostPlantGuides(plantNames = []) {
  const found = new Map();
  for (const name of plantNames) {
    const rawKey = buildHostPlantGuideLookupKey(name);
    if (!rawKey) continue;
    const normalizedKey = buildHostPlantGuideLookupKey(normalizePlantNameLite(rawKey));
    const guide = HOST_PLANT_GUIDE_BY_VARIANT.get(rawKey) || HOST_PLANT_GUIDE_BY_VARIANT.get(normalizedKey);
    if (guide) found.set(guide.slug, guide);
  }
  return [...found.values()];
}

function getEnglishHostPlantGuideLabel(guide) {
  return ENGLISH_GUIDE_LABELS[guide.slug] || buildJapaneseReferenceLabel(guide.name);
}

function renderEnglishHostPlantGuideLinks(plantNames = []) {
  const guides = findEnglishHostPlantGuides(plantNames);
  if (!guides.length) return '';
  return `
      <section class="host-plant-guides">
        <h3>Host plant search guides</h3>
        <p>Use these guide pages to find other Japanese insect records that use the same host plants.</p>
        <ul>
          ${guides.map((guide) => `<li><a href="/en/guides/plants/${escapeAttr(guide.slug)}.html">${escapeHtml(getEnglishHostPlantGuideLabel(guide))} host plant insects</a></li>`).join('\n          ')}
        </ul>
      </section>`;
}

function collectPlantGuideCandidateNames(canonicalName, detail = {}) {
  return Array.from(new Set([
    canonicalName,
    detail.name,
    detail.japaneseName,
    ...(Array.isArray(detail.aliases) ? detail.aliases : []),
  ].filter(Boolean)));
}

function buildPlantListItems(hostPlantsArray, plantRecords, plantDetails, aliasToCanonical) {
  return hostPlantsArray.map((plantName) => {
    const normalized = normalizePlantNameLite(plantName) || plantName;
    const canonical = aliasToCanonical[plantName] || aliasToCanonical[normalized] || normalized;
    const record = plantRecords.get(canonical);
    const detail = normalizePlantDetail(canonical, plantDetails);
    const display = buildPlantDisplay(detail, canonical);
    const href = record ? record.href : null;
    return {
      href,
      primaryName: display.primaryName,
      scientificName: display.scientificName,
      japaneseName: display.japaneseName,
      japaneseReference: display.japaneseReference,
    };
  });
}

function buildEnglishInsectPage({
  insect,
  section,
  englishSlug,
  plantRecords,
  plantDetails,
  aliasToCanonical,
}) {
  const scientificName = cleanString(insect.scientificName);
  const japaneseName = cleanString(insect.name || insect.japaneseName);
  const primaryName = getPrimaryEnglishName({
    scientificName,
    japaneseName,
    fallback: insect.id || 'Unknown species',
  });
  const japaneseReference = buildJapaneseReferenceLabel(japaneseName);
  const familyLabels = normalizeInsectFamilyLabels(insect);
  const imageUrl = resolveInsectImageUrl(insect);
  const socialImageUrl = `${BASE_ORIGIN}${imageUrl || DEFAULT_SOCIAL_IMAGE_PATH}`;
  const socialImageAlt = imageUrl
    ? `${primaryName} photograph`
    : `${primaryName} reference image`;
  const hostPlantsArray = extractLarvalHostPlants(insect);
  const hostPlantItems = buildPlantListItems(
    hostPlantsArray,
    plantRecords,
    plantDetails,
    aliasToCanonical,
  );
  const pagePath = `/en/meta/${section.routeSegment}/${encodeURIComponent(englishSlug)}.html`;
  const japanesePagePath = resolveJapaneseInsectMetaPath(insect, section.routeSegment);
  const japaneseNavigationPath = japanesePagePath || `/meta/${section.routeSegment}/index.html`;
  const canonicalUrl = `${BASE_ORIGIN}${pagePath}`;
  const seasonText = cleanString(insect.emergenceTime);
  const description = [
    japaneseReference,
    `${primaryName} is listed here as a ${section.singularLabel.toLowerCase()} from Japan.`,
    hostPlantItems.length > 0
      ? `Recorded larval host plants: ${hostPlantItems
          .slice(0, 3)
          .map((item) => item.primaryName)
          .join(', ')}${hostPlantItems.length > 3 ? ` and ${hostPlantItems.length - 3} more` : ''}.`
      : 'Larval host plant information is currently limited on this page.',
  ]
    .filter(Boolean)
    .join(' ');
  const robotsContent = computeInsectRobotsContent({ hostPlantsArray, imageUrl, insect });
  const title = `${primaryName} | ${section.singularLabel} profile from Japan`;
  const summaryParagraphs = [
    `${primaryName} is documented here as a ${section.singularLabel.toLowerCase()} associated with plants recorded in Japan.`,
    scientificName
      ? 'The scientific name is used as the primary identifier because a stable English common name is not always available for Japanese taxa.'
      : ENGLISH_NAMING_NOTICE,
  ];
  if (familyLabels.familyLatin || familyLabels.familyJapanese) {
    summaryParagraphs.push(
      `Family: ${familyLabels.familyLatin || familyLabels.familyJapanese}${
        familyLabels.familyLatin && familyLabels.familyJapanese
          ? ` (${familyLabels.familyJapanese})`
          : ''
      }.`,
    );
  }
  if (seasonText && seasonText !== '不明') {
    summaryParagraphs.push(`Adult season in the source dataset: ${seasonText}.`);
  }
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['Animal', 'Species'],
    name: primaryName,
    alternateName: [japaneseName, scientificName].filter(Boolean),
    scientificName: scientificName || undefined,
    description,
    url: canonicalUrl,
    inLanguage: 'en',
    image: imageUrl ? `${BASE_ORIGIN}${imageUrl}` : undefined,
    classification: {
      '@type': 'Taxon',
      taxonRank: 'species',
      parentTaxon: familyLabels.familyLatin || familyLabels.familyJapanese
        ? {
            '@type': 'Taxon',
            name: familyLabels.familyLatin || familyLabels.familyJapanese,
            alternateName:
              familyLabels.familyLatin && familyLabels.familyJapanese
                ? familyLabels.familyJapanese
                : undefined,
            taxonRank: 'family',
          }
        : undefined,
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: EN_SITE_NAME,
        item: `${BASE_ORIGIN}/en/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: section.pluralLabel,
        item: `${BASE_ORIGIN}/en/meta/${section.routeSegment}/index.html`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: primaryName,
        item: canonicalUrl,
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${escapeAttr(robotsContent)}">
  <meta name="google-adsense-account" content="${ADSENSE_CLIENT}">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="keywords" content="${escapeAttr([primaryName, scientificName, japaneseName, section.singularLabel, familyLabels.familyLatin || familyLabels.familyJapanese].filter(Boolean).join(', '))}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  ${buildAlternateLanguageLinks(japanesePagePath, pagePath)}
  <link rel="stylesheet" href="${EN_META_STYLE_PATH}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:image" content="${escapeAttr(socialImageUrl)}">
  <meta property="og:image:alt" content="${escapeAttr(socialImageAlt)}">
  <meta property="og:site_name" content="${escapeAttr(EN_SITE_NAME)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${escapeAttr(socialImageUrl)}">
  <meta name="twitter:image:alt" content="${escapeAttr(socialImageAlt)}">
  <script type="application/ld+json">${renderJsonLd(structuredData)}</script>
  <script type="application/ld+json">${renderJsonLd(breadcrumbData)}</script>
  ${DEFERRED_ADS_SCRIPT}
</head>
<body>
  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/en/" class="meta-site-logo" aria-label="${escapeAttr(EN_SITE_NAME)} home">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <svg width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
        </span>
        <span class="meta-site-logo-text">${escapeHtml(EN_SITE_NAME)}</span>
      </a>
      <a href="${escapeAttr(japaneseNavigationPath)}" class="meta-site-header-link">Japanese page</a>
    </div>
  </header>

  <div class="meta-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <ol>
        <li><a href="/en/">${escapeHtml(EN_SITE_NAME)}</a></li>
        <li><a href="/en/meta/${escapeAttr(section.routeSegment)}/index.html">${escapeHtml(section.pluralLabel)}</a></li>
        <li aria-current="page">${escapeHtml(primaryName)}</li>
      </ol>
    </nav>

    <header class="meta-header">
      <h1>${escapeHtml(primaryName)}</h1>
      ${scientificName && scientificName !== primaryName ? `<h2>${formatScientificNameHTML(scientificName)}</h2>` : ''}
      ${japaneseReference ? `<p class="meta-note">${escapeHtml(japaneseReference)}</p>` : ''}
      <p class="meta-note">${escapeHtml(ENGLISH_NAMING_NOTICE)}</p>
    </header>

    <main class="meta-content">
      <section class="basic-info">
        <h3>Overview</h3>
        <dl>
          ${scientificName ? `<dt>Scientific name</dt><dd>${formatScientificNameHTML(scientificName)}</dd>` : ''}
          ${japaneseName ? `<dt>Japanese name</dt><dd>${escapeHtml(japaneseName)}</dd>` : ''}
          <dt>Group</dt>
          <dd>${escapeHtml(section.singularLabel)}</dd>
          ${(familyLabels.familyLatin || familyLabels.familyJapanese)
            ? `<dt>Family</dt><dd>${escapeHtml(familyLabels.familyLatin || familyLabels.familyJapanese)}${
                familyLabels.familyLatin && familyLabels.familyJapanese
                  ? ` <span class="meta-note">(${escapeHtml(familyLabels.familyJapanese)})</span>`
                  : ''
              }</dd>`
            : ''}
          <dt>Recorded larval host plants</dt>
          <dd>${hostPlantItems.length}</dd>
          ${seasonText && seasonText !== '不明' ? `<dt>Adult season</dt><dd>${escapeHtml(seasonText)}</dd>` : ''}
        </dl>
      </section>

      ${imageUrl ? `
      <section class="image-section">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(socialImageAlt)}" loading="eager">
        <div class="image-caption">${escapeHtml(primaryName)}</div>
      </section>` : ''}

      <section class="description">
        <h3>Summary</h3>
        ${summaryParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n        ')}
      </section>

      <section class="host-plants">
        <h3>Recorded larval host plants</h3>
        ${hostPlantItems.length > 0 ? `
        <ul>
          ${hostPlantItems.map((item) => `<li>
            ${item.href ? `<a href="${escapeAttr(item.href)}">${escapeHtml(item.primaryName)}</a>` : escapeHtml(item.primaryName)}
            ${item.scientificName && item.primaryName !== item.scientificName ? `<div class="insect-scientific">${formatScientificNameHTML(item.scientificName)}</div>` : ''}
            ${item.japaneseReference ? `<div class="meta-note">${escapeHtml(item.japaneseReference)}</div>` : ''}
          </li>`).join('\n          ')}
        </ul>` : `
        <p>Larval host plant information is currently limited in the source dataset for this entry.</p>`}
      </section>

      ${renderEnglishHostPlantGuideLinks(hostPlantsArray)}

      ${cleanString(insect.notes || insect.remarks) ? `
      <section class="description">
        <h3>Original source note</h3>
        <p>${escapeHtml(cleanString(insect.notes || insect.remarks))}</p>
      </section>` : ''}
      ${renderManualAdSlot(MANUAL_AD_SLOTS.detail)}
    </main>

    <section class="navigation">
      <a href="/en/meta/${escapeAttr(section.routeSegment)}/index.html" class="back-link">Browse ${escapeHtml(section.pluralLabel)}</a>
      <a href="${escapeAttr(japaneseNavigationPath)}" class="detail-link">Open Japanese page</a>
    </section>
  </div>
</body>
</html>`;
}

function buildEnglishPlantPage({
  canonicalName,
  detail,
  relatedInsects,
  plantImageFiles,
  plantRecord,
  insectEntriesById,
}) {
  const display = buildPlantDisplay(detail, canonicalName);
  const pagePath = plantRecord.href;
  const japanesePagePath = resolveJapanesePlantMetaPath(canonicalName, detail);
  const japaneseNavigationPath = japanesePagePath || '/meta/plant/index.html';
  const canonicalUrl = `${BASE_ORIGIN}${pagePath}`;
  const robotsContent = computePlantRobotsContent({ relatedInsects, plantImageFiles });
  const mainImageUrl = plantImageFiles.length > 0
    ? buildPlantResizedImageUrl(plantImageFiles[0])
    : '';
  const socialImageUrl = `${BASE_ORIGIN}${mainImageUrl || DEFAULT_SOCIAL_IMAGE_PATH}`;
  const socialImageAlt = mainImageUrl
    ? `${display.primaryName} photograph`
    : `${display.primaryName} reference image`;
  const title = `${display.primaryName} | Host plant profile from Japan`;
  const description = [
    display.japaneseReference,
    `${display.primaryName} is documented here as a plant associated with ${relatedInsects.length} insect records from Japan.`,
    display.scientificName
      ? 'Scientific names are used as the primary identifier on English pages.'
      : ENGLISH_NAMING_NOTICE,
  ]
    .filter(Boolean)
    .join(' ');
  const grouped = Object.entries(
    relatedInsects.reduce((acc, insect) => {
      const type = cleanString(insect.type) || 'moth';
      if (!acc[type]) acc[type] = [];
      acc[type].push(insect);
      return acc;
    }, {}),
  ).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['Plant', 'Species'],
    name: display.primaryName,
    alternateName: [display.japaneseName, display.scientificName].filter(Boolean),
    description,
    url: canonicalUrl,
    image: mainImageUrl ? `${BASE_ORIGIN}${mainImageUrl}` : undefined,
    inLanguage: 'en',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${escapeAttr(robotsContent)}">
  <meta name="google-adsense-account" content="${ADSENSE_CLIENT}">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="keywords" content="${escapeAttr([display.primaryName, display.scientificName, display.japaneseName, display.familyLatin, display.familyJapanese, 'host plant'].filter(Boolean).join(', '))}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  ${buildAlternateLanguageLinks(japanesePagePath, pagePath)}
  <link rel="stylesheet" href="${EN_META_STYLE_PATH}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:image" content="${escapeAttr(socialImageUrl)}">
  <meta property="og:image:alt" content="${escapeAttr(socialImageAlt)}">
  <meta property="og:site_name" content="${escapeAttr(EN_SITE_NAME)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${escapeAttr(socialImageUrl)}">
  <meta name="twitter:image:alt" content="${escapeAttr(socialImageAlt)}">
  <script type="application/ld+json">${renderJsonLd(structuredData)}</script>
  ${DEFERRED_ADS_SCRIPT}
</head>
<body>
  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/en/" class="meta-site-logo" aria-label="${escapeAttr(EN_SITE_NAME)} home">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <svg width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
        </span>
        <span class="meta-site-logo-text">${escapeHtml(EN_SITE_NAME)}</span>
      </a>
      <a href="${escapeAttr(japaneseNavigationPath)}" class="meta-site-header-link">Japanese page</a>
    </div>
  </header>

  <div class="meta-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <ol>
        <li><a href="/en/">${escapeHtml(EN_SITE_NAME)}</a></li>
        <li><a href="/en/meta/plant/index.html">Plants</a></li>
        <li aria-current="page">${escapeHtml(display.primaryName)}</li>
      </ol>
    </nav>

    <header class="meta-header">
      <h1>${escapeHtml(display.primaryName)}</h1>
      ${display.scientificName && display.scientificName !== display.primaryName ? `<h2>${formatScientificNameHTML(display.scientificName)}</h2>` : ''}
      ${display.japaneseReference ? `<p class="meta-note">${escapeHtml(display.japaneseReference)}</p>` : ''}
      <p class="meta-note">${escapeHtml(ENGLISH_NAMING_NOTICE)}</p>
    </header>

    <main class="meta-content">
      <section class="basic-info">
        <h3>Overview</h3>
        <dl>
          ${display.scientificName ? `<dt>Scientific name</dt><dd>${formatScientificNameHTML(display.scientificName)}</dd>` : ''}
          ${display.japaneseName ? `<dt>Japanese name</dt><dd>${escapeHtml(display.japaneseName)}</dd>` : ''}
          ${display.familyLatin || display.familyJapanese ? `<dt>Family</dt><dd>${escapeHtml(display.familyLatin || display.familyJapanese)}${display.familyLatin && display.familyJapanese ? ` <span class="meta-note">(${escapeHtml(display.familyJapanese)})</span>` : ''}</dd>` : ''}
          ${display.orderLatin || display.orderJapanese ? `<dt>Order</dt><dd>${escapeHtml(display.orderLatin || display.orderJapanese)}${display.orderLatin && display.orderJapanese ? ` <span class="meta-note">(${escapeHtml(display.orderJapanese)})</span>` : ''}</dd>` : ''}
          ${display.genus ? `<dt>Genus</dt><dd>${escapeHtml(display.genus)}</dd>` : ''}
          <dt>Recorded insect associations</dt>
          <dd>${relatedInsects.length}</dd>
        </dl>
      </section>

      ${plantImageFiles.length > 0 ? `
      <section class="image-gallery">
        <h3>Images</h3>
        <div class="gallery-container">
          ${plantImageFiles.slice(0, 6).map((file) => `
            <div class="gallery-item">
              <a href="${buildPlantResizedImageUrl(file)}" target="_blank" rel="noopener noreferrer">
                ${buildPlantPictureHtml(file, `${display.primaryName} photograph`)}
              </a>
            </div>`).join('')}
        </div>
      </section>` : ''}

      <section class="description">
        <h3>Summary</h3>
        <p>${escapeHtml(`${display.primaryName} is listed here as a plant associated with insect records from Japan.`)}</p>
        <p>${escapeHtml(ENGLISH_NAMING_NOTICE)}</p>
      </section>

      ${renderEnglishHostPlantGuideLinks(collectPlantGuideCandidateNames(canonicalName, detail))}

      <section class="related-insects">
        <h3>Associated insects</h3>
        ${grouped.map(([type, insects]) => {
          const label = EN_TYPE_PLURALS[type] || EN_TYPE_LABELS[type] || 'Insects';
          return `<h4>${escapeHtml(label)} (${insects.length})</h4>
          <ul>
            ${insects.map((insect) => {
              const entry = insectEntriesById.get(insect.id);
              const primaryName = getPrimaryEnglishName({
                scientificName: insect.scientificName,
                japaneseName: insect.name || insect.japaneseName,
                fallback: insect.id,
              });
              const japaneseReference = buildJapaneseReferenceLabel(insect.name || insect.japaneseName);
              const href = entry ? entry.href : null;
              return `<li>
                <div class="insect-name">${href ? `<a href="${escapeAttr(href)}">${escapeHtml(primaryName)}</a>` : escapeHtml(primaryName)}</div>
                ${insect.scientificName && insect.scientificName !== primaryName ? `<div class="insect-scientific">${formatScientificNameHTML(insect.scientificName)}</div>` : ''}
                ${japaneseReference ? `<div class="meta-note">${escapeHtml(japaneseReference)}</div>` : ''}
              </li>`;
            }).join('\n            ')}
          </ul>`;
        }).join('\n        ')}
      </section>
      ${renderManualAdSlot(MANUAL_AD_SLOTS.detail)}
    </main>

    <section class="navigation">
      <a href="/en/meta/plant/index.html" class="back-link">Browse Plants</a>
      <a href="${escapeAttr(japaneseNavigationPath)}" class="detail-link">Open Japanese page</a>
    </section>
  </div>
</body>
</html>`;
}

function buildEnglishSectionIndex(section, entries) {
  const listDescription = `English index for ${section.pluralLabel.toLowerCase()} pages from Japan. Scientific names are used as the primary identifier when available.`;
  const indexPath = `/en/meta/${section.routeSegment}/index.html`;
  const canonicalUrl = `${BASE_ORIGIN}${indexPath}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${section.pluralLabel} | ${EN_SITE_NAME}`,
    description: listDescription,
    url: canonicalUrl,
    inLanguage: 'en',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${buildRobotsContent(true)}">
  ${ADSENSE_HEAD_TAGS}
  <title>${escapeHtml(section.pluralLabel)} | ${escapeHtml(EN_SITE_NAME)}</title>
  <meta name="description" content="${escapeAttr(listDescription)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="stylesheet" href="${EN_META_STYLE_PATH}">
  <meta property="og:title" content="${escapeAttr(`${section.pluralLabel} | ${EN_SITE_NAME}`)}">
  <meta property="og:description" content="${escapeAttr(listDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:site_name" content="${escapeAttr(EN_SITE_NAME)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeAttr(`${section.pluralLabel} | ${EN_SITE_NAME}`)}">
  <meta name="twitter:description" content="${escapeAttr(listDescription)}">
  <script type="application/ld+json">${renderJsonLd(structuredData)}</script>
</head>
<body>
  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/en/" class="meta-site-logo" aria-label="${escapeAttr(EN_SITE_NAME)} home">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <svg width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
        </span>
        <span class="meta-site-logo-text">${escapeHtml(EN_SITE_NAME)}</span>
      </a>
    </div>
  </header>
  <div class="meta-page">
    <header class="meta-header">
      <h1>${escapeHtml(section.pluralLabel)}</h1>
      <p class="meta-note">${escapeHtml(ENGLISH_NAMING_NOTICE)}</p>
    </header>
    <main>
      <section style="background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);padding:1rem 1.25rem 1.25rem;">
        <p>${escapeHtml(listDescription)}</p>
        <ul style="list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;padding:0;margin:1rem 0 0;">
          ${entries.slice(0, 1500).map((entry) => `<li style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:0.9rem 1rem;">
            <a href="${escapeAttr(entry.href)}" style="font-weight:700;display:block;margin-bottom:0.25rem;">${escapeHtml(entry.primaryName)}</a>
            ${entry.scientificName && entry.scientificName !== entry.primaryName ? `<div class="insect-scientific">${formatScientificNameHTML(entry.scientificName)}</div>` : ''}
            ${entry.japaneseReference ? `<div class="meta-note">${escapeHtml(entry.japaneseReference)}</div>` : ''}
          </li>`).join('\n          ')}
        </ul>
      </section>
    </main>
    <section class="navigation">
      <a href="/en/" class="back-link">English home</a>
    </section>
  </div>
</body>
</html>`;
}

function buildEnglishHomePage(counts) {
  const description = `English entry pages for insects and host plants recorded in Japan. Scientific names are used as the main identifier to avoid assigning unstable English common names.`;
  const canonicalUrl = `${BASE_ORIGIN}/en/`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: EN_SITE_NAME,
    description,
    url: canonicalUrl,
    inLanguage: 'en',
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${buildRobotsContent(true)}">
  ${ADSENSE_HEAD_TAGS}
  <title>${escapeHtml(EN_SITE_NAME)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="alternate" hreflang="ja" href="${BASE_ORIGIN}/">
  <link rel="alternate" hreflang="en" href="${canonicalUrl}">
  <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
  <link rel="stylesheet" href="${EN_META_STYLE_PATH}">
  <meta property="og:title" content="${escapeAttr(EN_SITE_NAME)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:site_name" content="${escapeAttr(EN_SITE_NAME)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeAttr(EN_SITE_NAME)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <script type="application/ld+json">${renderJsonLd(structuredData)}</script>
</head>
<body>
  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/en/" class="meta-site-logo" aria-label="${escapeAttr(EN_SITE_NAME)} home">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <svg width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
        </span>
        <span class="meta-site-logo-text">${escapeHtml(EN_SITE_NAME)}</span>
      </a>
      <a href="/" class="meta-site-header-link">Japanese home</a>
    </div>
  </header>

  <div class="meta-page">
    <header class="meta-header">
      <h1>${escapeHtml(EN_SITE_NAME)}</h1>
      <p>${escapeHtml(description)}</p>
      <p class="meta-note">${escapeHtml(ENGLISH_NAMING_NOTICE)}</p>
    </header>

    <main class="meta-content">
      <section class="basic-info">
        <h3>Coverage</h3>
        <dl>
          <dt>Moths</dt><dd>${counts.moths}</dd>
          <dt>Butterflies</dt><dd>${counts.butterflies}</dd>
          <dt>Jewel beetles</dt><dd>${counts.beetles}</dd>
          <dt>Longhorn beetles</dt><dd>${counts.longhornbeetles}</dd>
          <dt>Leaf beetles</dt><dd>${counts.leafbeetles}</dd>
          <dt>Aphids</dt><dd>${counts.aphids}</dd>
          <dt>Host plants</dt><dd>${counts.hostPlants}</dd>
        </dl>
      </section>

      <section class="quick-links">
        <h3>Browse English pages</h3>
        <ul>
          <li><a href="/en/meta/moth/index.html">Moths</a></li>
          <li><a href="/en/meta/butterfly/index.html">Butterflies</a></li>
          <li><a href="/en/meta/beetle/index.html">Jewel beetles</a></li>
          <li><a href="/en/meta/longhornbeetle/index.html">Longhorn beetles</a></li>
          <li><a href="/en/meta/leafbeetle/index.html">Leaf beetles</a></li>
          <li><a href="/en/meta/aphid/index.html">Aphids</a></li>
          <li><a href="/en/meta/plant/index.html">Plants</a></li>
        </ul>
      </section>
    </main>
  </div>
</body>
</html>`;
}

async function generateEnglishMetaPages() {
  console.log('[meta-en] Generating English meta pages...');

  const allPlantImages = fs.existsSync(PLANT_IMAGES_DIR)
    ? fs.readdirSync(PLANT_IMAGES_DIR).filter((file) => /\.(jpe?g|png|gif|webp)$/i.test(file))
    : [];

  const insectsByType = {
    moth: loadJson('moths.json', []),
    butterfly: loadJson('butterflies.json', []),
    beetle: loadJson('beetles.json', []),
    longhornbeetle: loadJson('longhornbeetles.json', []),
    leafbeetle: loadJson('leafbeetles.json', []),
    aphid: loadJson('aphids.json', []),
  };
  const hostPlantsMap = loadJson('hostplants.json', {});
  const plantDetails = loadJson('plant-details.json', {});
  const ylistLite = loadJson('ylist-lite.json', { plants: {}, aliasToCanonical: {} });
  const preservedEnglishStaticFiles = readPreservedEnglishStaticFiles();

  fs.rmSync(PUBLIC_EN_DIR, { recursive: true, force: true });
  ensureDir(EN_META_DIR);
  restorePreservedEnglishStaticFiles(preservedEnglishStaticFiles);
  Object.keys(insectsByType).forEach((type) => ensureDir(path.join(EN_META_DIR, type)));
  ensureDir(path.join(EN_META_DIR, 'plant'));
  writeExplorerRedirect('plant', {
    title: 'Opening plant search | Insects and Host Plants of Japan',
    tab: 'plants',
    label: 'plant search',
  });
  writeExplorerRedirect('moth', {
    title: 'Opening insect search | Insects and Host Plants of Japan',
    tab: 'insects',
    label: 'insect search',
  });

  const { plantRecords, aliasToCanonical } = buildPlantRecordMap(hostPlantsMap, plantDetails, ylistLite);

  const insectEntriesByType = new Map();
  const insectEntriesById = new Map();
  const insectObjectsByJapaneseName = new Map();
  const usedInsectSlugsByType = new Map(Object.keys(insectsByType).map((type) => [type, new Set()]));
  const englishInsectRouteMap = {};
  const englishPlantRouteMap = {};
  const legacyRedirects = new Map();
  let legacyRedirectConflicts = 0;
  let legacyRedirectWriteSkips = 0;
  const queueLegacyRedirect = (routePath, targetPath, title) => {
    if (!routePath || !targetPath) return;
    const normalizedRoutePath = String(routePath).replace(/\/{2,}/g, '/');
    const targetUrl = targetPath.startsWith('http') ? targetPath : `${BASE_ORIGIN}${targetPath}`;
    const existing = legacyRedirects.get(normalizedRoutePath);
    if (existing && existing.targetUrl !== targetUrl) {
      legacyRedirectConflicts++;
      return;
    }
    if (!existing) {
      legacyRedirects.set(normalizedRoutePath, { targetUrl, title });
    }
  };

  Object.entries(insectsByType).forEach(([type, insects]) => {
    const section = SECTION_CONFIGS.find((entry) => entry.type === type);
    insectEntriesByType.set(type, []);
    insects.forEach((insect) => {
      const scientificSlug = slugifyScientificLabel(insect.scientificName);
      const slug = createUniqueSlug(
        scientificSlug || cleanString(insect.id),
        usedInsectSlugsByType.get(type),
        `${type}-${usedInsectSlugsByType.get(type).size + 1}`,
      );
      const html = buildEnglishInsectPage({
        insect,
        section,
        englishSlug: slug,
        plantRecords,
        plantDetails,
        aliasToCanonical,
      });
      const outputPath = path.join(EN_META_DIR, type, `${slug}.html`);
      fs.writeFileSync(outputPath, html);
      const entry = {
        id: insect.id,
        href: `/en/meta/${type}/${encodeURIComponent(slug)}.html`,
        primaryName: getPrimaryEnglishName({
          scientificName: insect.scientificName,
          japaneseName: insect.name || insect.japaneseName,
          fallback: insect.id,
        }),
        scientificName: cleanString(insect.scientificName),
        japaneseReference: buildJapaneseReferenceLabel(insect.name || insect.japaneseName),
      };
      insectEntriesByType.get(type).push(entry);
      insectEntriesById.set(insect.id, entry);
      englishInsectRouteMap[insect.id] = entry.href;
      const japaneseName = cleanString(insect.name || insect.japaneseName);
      if (japaneseName) {
        if (!insectObjectsByJapaneseName.has(japaneseName)) {
          insectObjectsByJapaneseName.set(japaneseName, []);
        }
        insectObjectsByJapaneseName.get(japaneseName).push({ ...insect, type });
        queueLegacyRedirect(
          `/en/${type}/${encodeURIComponent(japaneseName)}/index.html`,
          `/en/meta/${type}/${encodeURIComponent(slug)}.html`,
          `${entry.primaryName} | ${section.singularLabel} profile from Japan`,
        );
      }
    });
  });

  const plantEntries = [];
  Array.from(plantRecords.values())
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'ja'))
    .forEach((plantRecord) => {
      const relatedNames = hostPlantsMap[plantRecord.canonicalName] || [];
      const relatedInsects = relatedNames
        .flatMap((name) => insectObjectsByJapaneseName.get(name) || [])
        .filter(Boolean)
        .filter((insect, index, array) => array.findIndex((candidate) => candidate.id === insect.id) === index);
      const plantImageFiles = getPlantImageFiles(
        plantRecord.canonicalName,
        plantRecord.detail,
        allPlantImages,
      );
      const html = buildEnglishPlantPage({
        canonicalName: plantRecord.canonicalName,
        detail: plantRecord.detail,
        relatedInsects,
        plantImageFiles,
        plantRecord,
        insectEntriesById,
      });
      const outputPath = path.join(EN_META_DIR, 'plant', `${plantRecord.slug}.html`);
      fs.writeFileSync(outputPath, html);
      const display = buildPlantDisplay(plantRecord.detail, plantRecord.canonicalName);
      plantEntries.push({
        href: plantRecord.href,
        primaryName: display.primaryName,
        scientificName: display.scientificName,
        japaneseReference: display.japaneseReference,
      });
      englishPlantRouteMap[plantRecord.canonicalName] = plantRecord.href;
      queueLegacyRedirect(
        `/en/plant/${encodeURIComponent(plantRecord.canonicalName)}/index.html`,
        plantRecord.href,
        `${display.primaryName} | Plant profile from Japan`,
      );
    });

  const indexableInsectEntriesByType = new Map();
  SECTION_CONFIGS.forEach((section) => {
    const indexableEntries = (insectEntriesByType.get(section.type) || []).filter((entry) =>
      isGeneratedMetaPageIndexableByHref(entry.href),
    );
    indexableInsectEntriesByType.set(section.type, indexableEntries);
    const indexHtml = buildEnglishSectionIndex(section, indexableEntries);
    fs.writeFileSync(path.join(EN_META_DIR, section.routeSegment, 'index.html'), indexHtml);
  });
  const indexablePlantEntries = plantEntries.filter((entry) =>
    isGeneratedMetaPageIndexableByHref(entry.href),
  );
  const plantSection = {
    routeSegment: 'plant',
    singularLabel: EN_TYPE_LABELS.plant,
    pluralLabel: EN_TYPE_PLURALS.plant,
  };
  fs.writeFileSync(
    path.join(EN_META_DIR, 'plant', 'index.html'),
    buildEnglishSectionIndex(plantSection, indexablePlantEntries),
  );
  legacyRedirects.forEach(({ targetUrl, title }, routePath) => {
    const outputPath = path.join(PUBLIC_DIR, ...routePath.replace(/^\//, '').split('/'));
    try {
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, buildLegacyRedirectHtml({ title, targetUrl }));
    } catch (error) {
      legacyRedirectWriteSkips++;
      console.warn(`[meta-en] legacy redirect skipped: ${routePath} (${error.code || error.message})`);
    }
  });
  writeJson(
    SEO_ROUTE_MAP_INSECTS_PATH,
    Object.fromEntries(Object.entries(englishInsectRouteMap).sort(([a], [b]) => a.localeCompare(b))),
  );
  writeJson(
    SEO_ROUTE_MAP_PLANTS_PATH,
    Object.fromEntries(Object.entries(englishPlantRouteMap).sort(([a], [b]) => a.localeCompare(b, 'ja'))),
  );

  const counts = {
    moths: (indexableInsectEntriesByType.get('moth') || []).length,
    butterflies: (indexableInsectEntriesByType.get('butterfly') || []).length,
    beetles: (indexableInsectEntriesByType.get('beetle') || []).length,
    longhornbeetles: (indexableInsectEntriesByType.get('longhornbeetle') || []).length,
    leafbeetles: (indexableInsectEntriesByType.get('leafbeetle') || []).length,
    aphids: (indexableInsectEntriesByType.get('aphid') || []).length,
    hostPlants: indexablePlantEntries.length,
  };
  fs.writeFileSync(path.join(PUBLIC_EN_DIR, 'index.html'), buildEnglishHomePage(counts));

  console.log('[meta-en] done');
  console.log(`[meta-en] moths: ${counts.moths}`);
  console.log(`[meta-en] butterflies: ${counts.butterflies}`);
  console.log(`[meta-en] beetles: ${counts.beetles}`);
  console.log(`[meta-en] longhorn beetles: ${counts.longhornbeetles}`);
  console.log(`[meta-en] leaf beetles: ${counts.leafbeetles}`);
  console.log(`[meta-en] aphids: ${counts.aphids}`);
  console.log(`[meta-en] plants: ${counts.hostPlants}`);
  console.log(`[meta-en] legacy redirects: ${legacyRedirects.size}`);
  if (legacyRedirectConflicts > 0) {
    console.warn(`[meta-en] skipped conflicting legacy redirects: ${legacyRedirectConflicts}`);
  }
  if (legacyRedirectWriteSkips > 0) {
    console.warn(`[meta-en] skipped writing legacy redirects: ${legacyRedirectWriteSkips}`);
  }
}

generateEnglishMetaPages().catch((error) => {
  console.error('[meta-en] failed:', error);
  process.exitCode = 1;
});
