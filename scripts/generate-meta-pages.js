import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { globalJapaneseToScientificMapping } from '../src/utils/insectImageMappings.js';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from '../src/utils/insectImageResolver.js';
import {
  buildPlantPath,
  INSECT_SECTION_CONFIGS,
  META_PAGE_SECTIONS,
} from '../src/utils/siteTaxonomy.js';
import { buildInsectPath } from '../src/utils/insectSlug.js';
import {
  comparePlantImageDisplayPriority,
  createSafePlantFilename,
  createSafeScientificPlantFilename,
  PLANT_IMAGE_SUFFIXES,
} from '../src/utils/filename.js';
import { bibliography } from '../src/utils/bibliography.js';
import { getSourceLink, normalizeReference } from '../src/utils/sourceLinks.js';
import {
  AMAZON_ASSOCIATES_DISCLOSURE,
  isAmazonAssociateUrl,
} from '../src/utils/amazonAssociates.js';
import {
  getPublicHostPlantNote,
  getPublicHostPlantSectionNote,
} from '../src/utils/publicHostPlantNotes.js';
import { normalizeJapaneseInsectName } from '../src/utils/insectNameAliases.js';
import { buildSourceLabel as buildPlantProfileSourceLabel } from '../src/utils/plantProfileText.js';
import { getHostResourceType } from '../src/utils/hostResource.js';
import {
  collectPlantPageNames,
  isIndexablePlantProfile,
  isValidPlantName,
  SUSPICIOUS_PLANT_NAME_SET,
} from './lib/dataLiteBuilders.mjs';
import { loadMergedTaxonRedirects } from './lib/mergedTaxonRedirects.mjs';
import {
  createPlantMetaTargetResolver,
  hasNoindexRobotsMeta,
} from './lib/metaPageLinks.mjs';
import { buildAnalyticsHeadTags } from './lib/analyticsHeadTags.mjs';
import { SITE_LOGO_SRC } from '../src/utils/siteBrand.js';

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
const DEFAULT_SOCIAL_IMAGE_PATH = '/images/resized/insects/Cucullia_argentea.1024.jpg';
const META_STYLE_PATH = '/assets/meta-styles.css?v=4';
const SEO_ROUTE_MAP_INSECTS_PATH = path.join(__dirname, '../public/seo-route-map.insects.json');
const SEO_ROUTE_MAP_PLANTS_PATH = path.join(__dirname, '../public/seo-route-map.plants.json');
const PLANT_DETAILS_PATH = path.join(__dirname, '../public/assets/data-lite/plant-details.json');
const KAMIKIRI_AUDIT_PATH = path.join(
  __dirname,
  '../data/source_audits/japanese-longhorn-beetles-2007.csv',
);
const LEAF_BEETLE_CANONICAL_AUDIT_PATH = path.join(
  __dirname,
  '../data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const BUTTERFLY_CANONICAL_AUDIT_PATH = path.join(
  __dirname,
  '../data/source_audits/butterfly-canonical-taxonomy-merge-2026-07-12.json',
);

const INSECT_RESIZED_DIR = path.join(__dirname, '../public/images/resized/insects');
const insectResizedFiles = fs.existsSync(INSECT_RESIZED_DIR)
  ? fs.readdirSync(INSECT_RESIZED_DIR).filter(file => file.match(/\.(320|640|1024)\.(?:jpg|webp)$/i))
  : [];
const insectResizedBaseSet = new Set(
  insectResizedFiles.map(file => file.replace(/\.(320|640|1024)\.(?:jpg|webp)$/i, '')),
);
const insectResizedEntries = buildNormalizedEntries(insectResizedBaseSet);

const META_SECTION_KEYS = META_PAGE_SECTIONS.map(({ key }) => key);
const INSECT_TYPE_NAMES = Object.fromEntries(
  INSECT_SECTION_CONFIGS.map(({ type, label }) => [type, label]),
);
const INSECT_DEFAULT_FAMILIES = Object.fromEntries(
  INSECT_SECTION_CONFIGS.map(({ type, defaultFamilyName }) => [type, defaultFamilyName]),
);
function readJsonOrEmpty(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.warn(`[meta] JSON読み込み失敗: ${path.relative(path.join(__dirname, '..'), filePath)} (${error.message})`);
    return {};
  }
}

const runtimeInsectRouteById = new Map();
for (const section of INSECT_SECTION_CONFIGS) {
  const runtimeInsects = readJsonOrEmpty(
    path.join(__dirname, `../public/assets/data-lite/${section.collectionKey}.json`),
  );
  if (!Array.isArray(runtimeInsects)) continue;
  for (const insect of runtimeInsects) {
    const insectId = String(insect?.id || '').trim();
    const routeName = String(
      insect?.routeName || insect?.name || insect?.japaneseName || '',
    ).trim();
    const legacyName = String(insect?.name || insect?.japaneseName || '').trim();
    if (insectId && routeName) {
      runtimeInsectRouteById.set(insectId, {
        type: section.type,
        name: routeName,
        legacyName,
      });
    }
  }
}

const plantDetailIndex = readJsonOrEmpty(PLANT_DETAILS_PATH);

function buildJapaneseInsectPath(insect, fallbackType = 'moth') {
  const runtimeRoute = runtimeInsectRouteById.get(String(insect?.id || '').trim());
  const routeName = String(
    runtimeRoute?.name || insect?.routeName || insect?.name || insect?.japaneseName || '',
  ).trim();
  return buildInsectPath({
    id: insect?.id,
    type: runtimeRoute?.type || insect?.type || fallbackType,
    routeName,
    name: routeName,
  }, 'ja');
}

function buildEnglishInsectPath(insect, fallbackType = 'moth') {
  const runtimeRoute = runtimeInsectRouteById.get(String(insect?.id || '').trim());
  const routeName = String(
    runtimeRoute?.name || insect?.routeName || insect?.name || insect?.japaneseName || '',
  ).trim();
  return buildInsectPath({
    id: insect?.id,
    type: runtimeRoute?.type || insect?.type || fallbackType,
    routeName,
    name: routeName,
  }, 'en');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeRedirectHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderJsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

function buildMetaWebPageData({ url, title, description, inLanguage, entityId, imageObject = null }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
    name: title,
    description,
    inLanguage,
    isPartOf: {
      '@type': 'WebSite',
      name: '昆虫植物図鑑',
      url: `${BASE_ORIGIN}/`,
    },
    mainEntity: {
      '@id': entityId,
    },
  };

  if (imageObject) {
    data.primaryImageOfPage = imageObject;
  }

  return data;
}

function shouldRenderInsectWebPageData(hostPlantsArray = []) {
  return Array.isArray(hostPlantsArray) && hostPlantsArray.length >= 10;
}

function shouldRenderPlantWebPageData(relatedInsects = []) {
  return Array.isArray(relatedInsects) && relatedInsects.length >= 10;
}

const isInternalSourceLabel = (value = '') => {
  const source = String(value || '').trim();
  return !source || /\.csv\b|hostplants|insects|normalized_data|public\//i.test(source);
};

const normalizeCitationMatchKey = (value = '') => String(value || '')
  .normalize('NFKC')
  .replace(/[「」『』]/g, '')
  .replace(/[‐‑‒–—−]/g, '-')
  .replace(/\s+/g, '')
  .toLowerCase();

function splitReferenceTokens(value = '') {
  return String(value || '')
    .split(/[;；]|(?:\s+[\/／]\s+)/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function formatCitationAuthors(authors = []) {
  if (!Array.isArray(authors) || authors.length === 0) return '';
  return authors.join('・');
}

function formatCitationContributors(entry = {}) {
  const authors = formatCitationAuthors(entry.authors);
  if (authors) return authors;
  const editors = formatCitationAuthors(entry.editors);
  return editors ? `${editors}（編）` : '';
}

function findBibliographyEntry(rawReference = '') {
  const raw = String(rawReference || '').trim();
  if (!raw) return null;
  const candidates = [
    raw,
    normalizeReference(raw),
  ].map(normalizeCitationMatchKey).filter(Boolean);

  return bibliography.find((entry) => {
    const titleKey = normalizeCitationMatchKey(entry.title);
    if (!titleKey) return false;
    return candidates.some((candidate) => candidate === titleKey || candidate.includes(titleKey));
  }) || null;
}

function extractAuthorYearLabel(rawReference = '') {
  const raw = String(rawReference || '').trim();
  const match = raw.match(/^(.+?)\s*[（(]\s*((?:18|19|20)\d{2})\s*[）)]/);
  if (match) return `${match[1].trim()} (${match[2]})`;
  return normalizeReference(raw) || raw;
}

function formatCitationShortPlain(entry, rawReference = '') {
  if (!entry) return extractAuthorYearLabel(rawReference);

  const contributors = formatCitationContributors(entry);
  if (contributors && entry.year) return `${contributors} (${entry.year})`;
  return contributors || entry.year || entry.title || extractAuthorYearLabel(rawReference);
}

function formatCitationPlain(entry, rawReference = '') {
  if (!entry) return extractAuthorYearLabel(rawReference);

  const contributors = formatCitationContributors(entry);
  const contributorYear = [contributors, entry.year ? `(${entry.year})` : '']
    .filter(Boolean)
    .join(' ');
  const title = [entry.title, entry.note].filter(Boolean).join(' — ');
  const publication = entry.journal
    ? [entry.journal, entry.issue ? `第${entry.issue}号` : '', entry.pages ? `pp. ${entry.pages}` : '']
      .filter(Boolean)
      .join(' ')
    : [entry.publisher, entry.place, entry.pages].filter(Boolean).join('、');
  const isbn = entry.isbn13 || entry.isbn10;

  return [
    contributorYear,
    title,
    publication,
    isbn ? `ISBN ${isbn}` : '',
  ].filter(Boolean).join('。');
}

function formatCitationHtml(entry, rawReference = '') {
  const display = formatCitationPlain(entry, rawReference);
  const link = entry?.url || getSourceLink(rawReference);
  const label = escapeRedirectHtml(display);
  if (!link) return `<cite>${label}</cite>`;

  const isAssociate = isAmazonAssociateUrl(link);
  const rel = isAssociate ? 'sponsored nofollow noopener noreferrer' : 'noopener noreferrer';
  const linkLabel = isAssociate ? '購入先' : '出典ページ';
  const associateLabel = isAssociate
    ? '<span class="amazon-associate-link-label">（Amazonアソシエイトリンク）</span>'
    : '';
  return `<cite><span class="citation-bibliography">${label}</span> <a class="citation-source-link" href="${escapeRedirectHtml(link)}" target="_blank" rel="${rel}">${linkLabel}</a>${associateLabel}</cite>`;
}

function formatCitationShortHtml(entry, rawReference = '') {
  const display = formatCitationShortPlain(entry, rawReference);
  const link = entry?.url || getSourceLink(rawReference);
  const label = escapeRedirectHtml(display);
  if (!link) return `<cite>${label}</cite>`;

  const isAssociate = isAmazonAssociateUrl(link);
  const rel = isAssociate ? 'sponsored nofollow noopener noreferrer' : 'noopener noreferrer';
  const associateLabel = isAssociate
    ? '<span class="amazon-associate-link-label">（Amazonアソシエイトリンク）</span>'
    : '';
  return `<cite><a href="${escapeRedirectHtml(link)}" target="_blank" rel="${rel}">${label}</a>${associateLabel}</cite>`;
}

function renderAmazonAssociatesDisclosureHtml(citationEntries = []) {
  const hasAssociateLink = citationEntries.some(({ entry, rawReference }) => {
    const link = entry?.url || getSourceLink(rawReference);
    return isAmazonAssociateUrl(link);
  });
  if (!hasAssociateLink) return '';

  return `<p class="amazon-associates-disclosure">${escapeRedirectHtml(AMAZON_ASSOCIATES_DISCLOSURE.ja)}</p>`;
}

function buildCitationEntriesFromReferences(rawReferences = []) {
  const entries = [];
  const seen = new Set();

  rawReferences
    .flatMap(splitReferenceTokens)
    .filter((reference) => reference && !isInternalSourceLabel(reference))
    .forEach((rawReference) => {
      const entry = findBibliographyEntry(rawReference);
      const plain = formatCitationPlain(entry, rawReference);
      const key = `citation:${normalizeCitationMatchKey(plain)}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({
        key,
        rawReference,
        entry,
        plain,
        html: formatCitationHtml(entry, rawReference),
        shortHtml: formatCitationShortHtml(entry, rawReference),
      });
    });

  return entries;
}

function buildInsectCitationEntries(insect) {
  const references = [];
  if (Array.isArray(insect.hostPlantsDetailed)) {
    insect.hostPlantsDetailed.forEach((hostPlant) => {
      if (hostPlant?.reference) references.push(hostPlant.reference);
    });
  }
  if (Array.isArray(insect.generalNotes)) {
    insect.generalNotes.forEach((note) => {
      if (note?.reference) references.push(note.reference);
    });
  }
  if (insect.source && !isInternalSourceLabel(insect.source)) {
    references.push(insect.source);
  }
  return buildCitationEntriesFromReferences(references);
}

function buildPlantCitationEntries(relatedInsects = [], dataPlantName = '', displayPlantName = '') {
  const targetPlantNames = new Set(
    [dataPlantName, displayPlantName, normalizePlantName(dataPlantName), normalizePlantName(displayPlantName)]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
  const references = [];

  relatedInsects.forEach((insect) => {
    let foundSpecificHostReference = false;
    if (Array.isArray(insect.hostPlantsDetailed)) {
      insect.hostPlantsDetailed.forEach((hostPlant) => {
        const candidateNames = [
          hostPlant?.name,
          hostPlant?.displayName,
          normalizePlantName(hostPlant?.name || ''),
          normalizePlantName(hostPlant?.displayName || ''),
        ].map((value) => String(value || '').trim()).filter(Boolean);
        const matchesPlant = candidateNames.some((name) => targetPlantNames.has(name));
        if (matchesPlant && hostPlant?.reference) {
          references.push(hostPlant.reference);
          foundSpecificHostReference = true;
        }
      });
    }
    if (!foundSpecificHostReference && insect.source && !isInternalSourceLabel(insect.source)) {
      references.push(insect.source);
    }
  });

  return buildCitationEntriesFromReferences(references);
}

function renderCitationSummaryHtml(entries = [], maxItems = 2) {
  if (!entries.length) return '';
  const shown = entries.slice(0, maxItems).map((entry) => entry.shortHtml);
  const remaining = entries.length - shown.length;
  if (remaining > 0) {
    shown.push(`<span class="citation-more">ほか${remaining}件</span>`);
  }
  return shown.join('<br>');
}

function renderCitationListHtml(entries = []) {
  if (!entries.length) return '';
  return `<ol class="citation-list">
          ${entries.map((entry) => `<li>${entry.html}</li>`).join('\n          ')}
        </ol>`;
}

const ADSENSE_CLIENT = process.env.VITE_ADSENSE_CLIENT || 'ca-pub-6982051533473293';
const ADSENSE_HEAD_TAGS = `<meta name="google-adsense-account" content="${ADSENSE_CLIENT}">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;
const GA_MEASUREMENT_ID = process.env.VITE_GA_MEASUREMENT_ID || 'G-MFEQF99G0H';
const GA_HEAD_TAGS = buildAnalyticsHeadTags(GA_MEASUREMENT_ID);

const buildLegacyInsectSlug = (displayName, insectId) => {
  const normalizedName = String(displayName || '').trim();
  const routeKey = normalizedName && !/[/\\?#%]/.test(normalizedName)
    ? normalizedName
    : String(insectId || '').trim();
  return encodeURIComponent(routeKey);
};

const routePathToOutputPath = (rootDir, routePath) => {
  const segments = String(routePath)
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => decodeURIComponent(segment));
  if (segments.some((segment) => !segment || /[/\\\0]/.test(segment))) {
    throw new Error(`unsafe route path: ${routePath}`);
  }
  return path.join(rootDir, ...segments);
};
// GA4 の直近28日ランディングページで実流入を確認した、削除済みガイドURL。
// 旧AI量産ガイド本文は復元せず、意味的に同一の現行植物プロフィールへ恒久移転する。
const LEGACY_TRAFFIC_GUIDE_PLANTS = Object.freeze([
  ['keyaki', 'ケヤキ'],
  ['konara', 'コナラ'],
  ['fuji', 'フジ'],
  ['nemunoki', 'ネムノキ'],
  ['akebia-quinata', 'アケビ'],
  ['asebi', 'アセビ'],
  ['chengiopanax-sciadophylloides', 'コシアブラ'],
  ['chenopodium-album', 'シロザ'],
  ['cornus-kousa-subsp-kousa', 'ヤマボウシ'],
  ['kashiwa', 'カシワ'],
  ['litchi-chinensis', 'レイシ'],
  ['magnolia-obovata', 'ホオノキ'],
  ['meliosma-myriantha', 'アワブキ'],
  ['plant-f3ca3f', 'ミネヤナギ'],
  ['sakura', 'サクラ'],
  ['salix-udensis', 'オノエヤナギ'],
  ['schima-wallichii-subsp-noronhae', 'イジュ'],
  ['seitaka-awadachiso', 'セイタカアワダチソウ'],
  ['yamamomo', 'ヤマモモ'],
]);
const MANUAL_AD_SLOTS = Object.freeze({
  footer: process.env.VITE_ADSENSE_SLOT_FOOTER || '',
  detail: process.env.VITE_ADSENSE_SLOT_DETAIL || '',
});
const HAS_MANUAL_AD_SLOTS = Object.values(MANUAL_AD_SLOTS).some(Boolean);
const DEFERRED_ADS_SCRIPT = HAS_MANUAL_AD_SLOTS ? `<script>
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
        if (document.querySelector('script[src*="adsbygoogle.js"]')) {
          loaded = true;
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
      function schedule() {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(loadAds, { timeout: 1800 });
        } else {
          window.setTimeout(loadAds, 900);
        }
      }
      window.addEventListener('load', schedule, { once: true });
    })();
  </script>` : '';

function renderManualAdSlot(slotId, label = '広告') {
  if (!slotId) return '';
  return `<aside class="manual-ad-slot" aria-label="${label}" style="margin:32px 0;padding:12px;border:1px solid #dbe4ee;border-radius:12px;background:#ffffff;text-align:center">
        <div class="manual-ad-label" style="margin-bottom:8px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#8a98aa">${label}</div>
        <ins class="adsbygoogle"
             style="display:block;min-height:120px"
             data-ad-client="${ADSENSE_CLIENT}"
             data-ad-slot="${escapeRedirectHtml(slotId)}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </aside>`;
}

function buildExplorerSearchPath(tab, query) {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (query) params.set('q', query);
  return `/?${params.toString()}`;
}

// 旧 /moth/ /plant/ 用の静的リダイレクトは廃止した。
// これらのパスはSPAルート（siteTaxonomy の EXPLORER_ROUTE_CONFIGS）として
// 直接描画されるため、静的な meta-refresh を置くとクリーンURLを
// `/?tab=...` に書き換えてしまい、余計なリダイレクトホップも発生していた。

function stripImageExtension(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/i, '');
}

function buildPlantResizedImageUrl(fileName, width = 1024, format = 'jpg') {
  const baseName = stripImageExtension(fileName);
  if (!baseName) return '';
  return `/images/resized/plants/${encodeURIComponent(baseName)}.${width}.${format}`;
}

// resized 画像の生成幅（build-responsive-images と対応）。
const RESIZED_HERO_WIDTHS = [320, 640, 1024];
const PUBLIC_DIR_ABS = path.join(__dirname, '../public');
const _imgSizeCache = new Map();

// 依存を増やさず JPEG の SOF マーカーから実寸を取得する（CLS 対策の width/height 用）。
// resized 画像は sharp 生成の正常な JPEG のため、最初の SOFn を読めば十分。
function readJpegSize(absPath) {
  if (_imgSizeCache.has(absPath)) return _imgSizeCache.get(absPath);
  let size = null;
  try {
    const buf = fs.readFileSync(absPath);
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        if (marker === 0xff) { off++; continue; }
        // SOF0..SOF15（DHT=0xc4, JPG=0xc8, DAC=0xcc を除く）で幅・高さが読める
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          size = { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
          break;
        }
        // 長さを持たないスタンドアロンマーカー（SOI/EOI/RSTn/TEM）
        if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          off += 2;
          continue;
        }
        off += 2 + buf.readUInt16BE(off + 2);
      }
    }
  } catch { /* 読めなければ寸法なしで続行 */ }
  _imgSizeCache.set(absPath, size);
  return size;
}

// resized 画像からレスポンシブ <picture> を生成する。
// Pages では容量節約のため昆虫 AVIF を配信しないため、昆虫は WebP/JPG、
// 植物は AVIF/WebP/JPG を使う（src/utils/imageSrcset.js と同じ方針）。
// dir: 'insects' | 'plants'、base: 拡張子・幅を除いたファイル名（未エンコードでも可）。
// aboveFold=true で fetchpriority=high（lazy 無し）、false で loading=lazy。
function buildResponsivePicture({ dir, base, alt, aboveFold = false }) {
  const decodedBase = decodeURIComponent(String(base || ''));
  if (!decodedBase) return '';
  const dirAbs = path.join(PUBLIC_DIR_ABS, 'images/resized', dir);
  const preferredFallbackFormat = dir === 'insects' ? 'webp' : 'jpg';
  const preferredWidths = RESIZED_HERO_WIDTHS.filter((w) =>
    fs.existsSync(path.join(dirAbs, `${decodedBase}.${w}.${preferredFallbackFormat}`)),
  );
  const fallbackFormat = preferredWidths.length ? preferredFallbackFormat : 'jpg';
  const widths = preferredWidths.length
    ? preferredWidths
    : RESIZED_HERO_WIDTHS.filter((w) => fs.existsSync(path.join(dirAbs, `${decodedBase}.${w}.jpg`)));
  if (!widths.length) return '';
  const enc = encodeURIComponent(decodedBase);
  const maxW = Math.max(...widths);
  const srcset = (fmt, formatWidths = widths) =>
    formatWidths.map((w) => `/images/resized/${dir}/${enc}.${w}.${fmt} ${w}w`).join(', ');
  const sizesAttr = '(max-width: 640px) 100vw, 640px';
  const fallback = `/images/resized/${dir}/${enc}.${maxW}.${fallbackFormat}`;
  const dims = readJpegSize(path.join(dirAbs, `${decodedBase}.${maxW}.jpg`));
  const dimAttrs = dims ? ` width="${dims.width}" height="${dims.height}"` : '';
  const loadAttrs = aboveFold ? 'decoding="async" fetchpriority="high"' : 'loading="lazy" decoding="async"';
  const safeAlt = escapeRedirectHtml(alt);
  const sourceFormats = dir === 'insects' ? [] : ['avif', 'webp'];
  const sources = sourceFormats.flatMap((fmt) => {
    const formatWidths = widths.filter((w) =>
      fs.existsSync(path.join(dirAbs, `${decodedBase}.${w}.${fmt}`)),
    );
    if (!formatWidths.length) return [];
    return [`                    <source type="image/${fmt}" srcset="${srcset(fmt, formatWidths)}" sizes="${sizesAttr}">`];
  });
  return `<picture>
${sources.join('\n')}
                    <img src="${fallback}" srcset="${srcset(fallbackFormat)}" sizes="${sizesAttr}"${dimAttrs} alt="${safeAlt}" ${loadAttrs} style="max-width:100%;height:auto;">
                  </picture>`;
}

// above-the-fold ヒーロー画像の preload リンク（LCP の早期発見用）。
function buildHeroPreloadLink({ dir, base }) {
  const decodedBase = decodeURIComponent(String(base || ''));
  if (!decodedBase) return '';
  const dirAbs = path.join(PUBLIC_DIR_ABS, 'images/resized', dir);
  const format = dir === 'insects' ? 'webp' : 'avif';
  const widths = RESIZED_HERO_WIDTHS.filter((w) =>
    fs.existsSync(path.join(dirAbs, `${decodedBase}.${w}.${format}`)),
  );
  if (!widths.length) return '';
  const enc = encodeURIComponent(decodedBase);
  const maxW = Math.max(...widths);
  const imagesrcset = widths.map((w) => `/images/resized/${dir}/${enc}.${w}.${format} ${w}w`).join(', ');
  return `<link rel="preload" as="image" type="image/${format}" fetchpriority="high" href="/images/resized/${dir}/${enc}.${maxW}.${format}" imagesrcset="${imagesrcset}" imagesizes="(max-width: 640px) 100vw, 640px">`;
}

function buildPlantPictureHtml(img, altText) {
  const base = stripImageExtension(img);
  const picture = buildResponsivePicture({ dir: 'plants', base, alt: altText, aboveFold: false });
  if (picture) return picture;
  // resized が見つからない場合のフォールバック
  const fileUrl = buildPlantResizedImageUrl(img);
  return `<img src="${escapeRedirectHtml(fileUrl)}" alt="${escapeRedirectHtml(altText)}" loading="lazy" decoding="async">`;
}

function buildLegacyRedirectHtml({
  lang = 'ja',
  title = '',
  targetUrl = '',
  noindex = true,
  redirectKind = '',
}) {
  const safeTitle = escapeRedirectHtml(title || '昆虫植物図鑑');
  const safeTargetUrl = escapeRedirectHtml(targetUrl);
  const bodyCopy = lang === 'en'
    ? 'Opening the canonical page...'
    : '正規ページを開いています...';
  const fallbackCopy = lang === 'en'
    ? 'If you are not redirected automatically, open the canonical page.'
    : '自動で移動しない場合は正規ページを開いてください。';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${noindex ? '<meta name="robots" content="noindex, follow">' : ''}
  ${redirectKind ? `<meta name="x-redirect-kind" content="${escapeRedirectHtml(redirectKind)}">` : ''}
  <title>${safeTitle}</title>
  <link rel="canonical" href="${safeTargetUrl}">
  <meta http-equiv="refresh" content="0;url=${safeTargetUrl}">
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
  <main>
    <p>${bodyCopy}</p>
    <p>${fallbackCopy} <a href="${safeTargetUrl}">${safeTargetUrl}</a></p>
  </main>
</body>
</html>`;
}

// 英語単語をイタリック体にフォーマットする関数
function formatEnglishWordsInItalic(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // 既に<em>タグがある場合は、一度削除
  text = text.replace(/<\/?em>/g, '');
  
  // 日本語文字が含まれる単語は除外
  const isJapanese = (word) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word);
  
  // 英語の単語をすべて見つけて置換（重複を許可）
  text = text.replace(/\b([A-Za-z]+)\b/g, (match, word) => {
    // 日本語が含まれていない場合はイタリック体にする
    if (!isJapanese(word)) {
      return `<em>${word}</em>`;
    }
    return match;
  });
  
  return text;
}

// 学名フォーマッティング関数 - 属名+種小名のみをイタリック体にし、著者名と年は通常体にする
function formatScientificNameHTML(scientificName) {
  if (!scientificName || scientificName.trim() === '') {
    return '';
  }

  const trimmed = scientificName.trim();
  
  // 括弧で囲まれた著者名と年を特定
  const authorMatch = trimmed.match(/^(.+?)\s*(\([^)]+\))?\s*$/);
  
  if (authorMatch) {
    const nameWithoutAuthor = authorMatch[1].trim();
    const authorInfo = authorMatch[2] || '';

    // 亜属を含む形式: Genus (Subgenus) species [...]
    const gss = nameWithoutAuthor.match(/^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s+([a-z-]+)(\s+.*)?$/);
    if (gss) {
      const genus = gss[1];
      const subgenus = gss[2];
      const species = gss[3];
      const extraInfo = (gss[4] || '').trim();
      return `<em>${genus}</em> (<em>${subgenus}</em>) <em>${species}</em>${extraInfo ? ' ' + extraInfo : ''}${authorInfo ? ' ' + authorInfo : ''}`;
    }

    // 属名と種小名を分離（最初の2語のみを取得）
    const nameParts = nameWithoutAuthor.split(/\s+/);
    if (nameParts.length >= 2) {
      const binomialName = `${nameParts[0]} ${nameParts[1]}`;
      const extraInfo = nameParts.slice(2).join(' ');
      
      // イタリック体の学名 + 通常体の著者情報
      return `<em>${binomialName}</em>${extraInfo ? ' ' + extraInfo : ''}${authorInfo ? ' ' + authorInfo : ''}`;
    }
  }
  
  // フォールバック: 全体をイタリック体にする
  return `<em>${trimmed}</em>`;
}

// CSVファイルを読み込む関数
function loadCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`CSVファイルが見つかりません: ${filePath}`);
      console.error(`現在のディレクトリ: ${process.cwd()}`);
      console.error(`スクリプトのディレクトリ: ${__dirname}`);
      throw new Error(`Missing CSV: ${filePath}`);
    }
    let csvContent = fs.readFileSync(filePath, 'utf-8');
    csvContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove BOM if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    
    // Fix quoted lines issue for butterfly CSV - entire CSV is malformed with quotes around each line
    if (filePath.includes('butterfly_host.csv')) {
      const lines = csvContent.split('\n');
      let fixedLines = [];
      let fixedCount = 0;
      
      for (let line of lines) {
        if (line.trim() && line.startsWith('"') && line.endsWith('"')) {
          // Remove outer quotes from the entire line
          line = line.slice(1, -1);
          fixedCount++;
        }
        fixedLines.push(line);
      }
      
      if (fixedCount > 0) {
        csvContent = fixedLines.join('\n');
        console.log(`Fixed ${fixedCount} quoted lines in ${filePath}`);
      }
    }
    
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"'
    });
    
    if (result.errors && result.errors.length > 0) {
      console.error(`CSV parsing errors for ${filePath}:`, result.errors);
    }
    
    return result.data;
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error.message}`);
    process.exit(1);
  }
}

// 任意CSV（存在しなければ空配列で続行）
function loadCSVOptional(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Optional CSV not found (skipping): ${filePath}`);
      return [];
    }
    return loadCSV(filePath);
  } catch (e) {
    console.log(`Optional CSV load error (skipping): ${filePath} -> ${e.message}`);
    return [];
  }
}

function pickFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function findLatestBackupPath(dirPath, prefix) {
  try {
    if (!fs.existsSync(dirPath)) return null;
    const files = fs
      .readdirSync(dirPath)
      .filter((name) => name.startsWith(prefix))
      .map((name) => ({
        name,
        fullPath: path.join(dirPath, name),
        mtimeMs: fs.statSync(path.join(dirPath, name)).mtimeMs || 0,
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (files.length === 0) return null;
    return files[0].fullPath;
  } catch {
    return null;
  }
}

// 植物名を正規化する関数
function normalizePlantName(plantName) {
  if (!plantName || typeof plantName !== 'string') {
    return plantName;
  }
  
  // 全角スペースを半角スペースに統一
  let normalized = plantName.replace(/　/g, ' ');

  // 先頭のカンマ・読点を除去（例：「,コウマゴヤシ」→「コウマゴヤシ」）
  normalized = normalized.replace(/^[,、，]+\s*/, '');

  // 全角括弧を半角括弧に統一
  normalized = normalized.replace(/（/g, '(').replace(/）/g, ')');
  
  // 「科名の植物名」形式を「植物名(科名)」形式に変換
  normalized = normalized.replace(/^([^の]+科)の(.+)$/g, '$2($1)');
  
  // 「以上」を削除（例：「(以上クルミ科)」→「(クルミ科)」）
  normalized = normalized.replace(/\(以上([^)]+)\)/g, '($1)');

  // 括弧直後に混入した読点・カンマを除去（例: "ヨモギ(，キク科)"）
  normalized = normalized.replace(/\(\s*[，,、]+\s*/g, '(');
  
  // 科名の前後のスペースを統一（スペースなしに）
  normalized = normalized.replace(/\s*\(\s*([^)]+科)\s*\)/g, '($1)');
  
  // 「によって」「による」「からの」「での」「における」などの余分なテキストを削除
  normalized = normalized.replace(/\s*(によって|による|から|での|における|羽化|採卵|飼育|記録|例が|ある).*$/g, '');
  
  // 括弧内の余分なテキストも削除（科名以外）
  normalized = normalized.replace(/\s*\([^)]*によって[^)]*\)/g, '');
  normalized = normalized.replace(/\s*\([^)]*による[^)]*\)/g, '');
  
  // 連続するスペースを1つに
  normalized = normalized.replace(/\s+/g, ' ');
  
  // 前後の空白を削除
  normalized = normalized.trim();
  
  return normalized;
}

// --- 植物ページの統合キー（同名植物の分裂バグ対策）---
// 末尾の科名括弧 "(...科)" を植物名の識別子から切り離す。これにより
// 「サクラ」と「サクラ(バラ科)」のように科名の有無で分裂していた同名植物が
// 1つの正規ページ（基底名）に統合される。科名はページ本文の属性として別途表示する。
function extractPlantFamilySuffix(name) {
  if (!name || typeof name !== 'string') return '';
  const m = name.match(/[(（]\s*([^()（）]*科)\s*[)）]\s*$/);
  return m ? m[1].trim() : '';
}
function stripPlantFamilySuffix(name) {
  if (!name || typeof name !== 'string') return name;
  return name.replace(/\s*[(（]\s*[^()（）]*科\s*[)）]\s*$/, '').trim();
}
// 植物ページの正規キー: 正規化した上で末尾の科名を除いた基底名を返す
function plantPageKey(name) {
  return stripPlantFamilySuffix(normalizePlantName(name));
}

function normalizePlantFamilyLabel(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/　/g, ' ')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/^[\s,，、]+/g, '')
    .replace(/[\s,，、]+$/g, '')
    .trim();
}

// 備考欄から食草情報を抽出する関数
function _extractHostPlantsFromRemarks(remarks) {
  if (!remarks || typeof remarks !== 'string') {
    return [];
  }
  
  const hostPlants = [];
  const trimmed = remarks.trim();
  
  // パターン1: "名義タイプ亜種の幼虫は...を食すという"
  const nominalSubspeciesMatch = trimmed.match(/名義タイプ亜種の幼虫は([^。]+)を食すという/);
  if (nominalSubspeciesMatch) {
    const plantText = nominalSubspeciesMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン2: "飼育下で...の記録があり"
  const culturingMatch = trimmed.match(/飼育下で([^。]+)の記録があり?/);
  if (culturingMatch) {
    const plantText = culturingMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン3: "飼育条件下では...を食べる"  
  const culturingConditionMatch = trimmed.match(/飼育条件下では([^。]+)を食べる/);
  if (culturingConditionMatch) {
    const plantText = culturingConditionMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン4: "...によって採卵飼育の記録がある"パターン
  const eggRearingMatch = trimmed.match(/(.+?)[\s　]*[にに]よって採卵飼育の記録がある/);
  if (eggRearingMatch) {
    const plantText = eggRearingMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン5: "採卵により...で飼育記録がある"パターン  
  const eggCollectionMatch = trimmed.match(/採卵により(.+?)で飼育記録がある/);
  if (eggCollectionMatch) {
    const plantText = eggCollectionMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン6: 文頭の植物名パターン（例："ショウロウクサギ (シソ科); ノアサガオ (ヒルガオ科)。"）
  const directPlantMatch = trimmed.match(/^([^。]+(?:\([^)]+\)[^。]*)*)[。；]/);
  if (directPlantMatch && !trimmed.includes('名義タイプ亜種') && !trimmed.includes('飼育下で')) {
    const plantText = directPlantMatch[1];
    // 科名を含む植物名パターンをより正確に抽出
    const plantPatterns = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || isValidPlantName(p)));
    hostPlants.push(...plantPatterns);
  }
  
  // パターン7: "広食性"を検出
  if (trimmed.includes('広食性')) {
    hostPlants.push('広食性');
  }
  
  // 重複を除去して返す
  return [...new Set(hostPlants)];
}

// 学名を正しく構築する関数 - SPAと同じロジック
function _processScientificName(existingScientificName, genusName, speciesName, authorName, yearName) {
  // Clean up inputs
  const cleanGenus = genusName?.trim() || '';
  const cleanSpecies = speciesName?.trim() || '';
  const cleanAuthor = authorName?.trim() || '';
  const cleanYear = yearName?.trim() || '';
  let cleanExisting = existingScientificName?.trim() || '';
  
  // Clean up basic formatting issues first
  cleanExisting = cleanExisting.replace(/\s*"?\s*$/, '').trim();
  
  // Check if existing scientific name is valid (has both genus and species)
  if (cleanExisting) {
    // Check if it's a complete binomial (genus + species)
    const binomialMatch = cleanExisting.match(/^([A-Z][a-z]+)\s+([a-z]+(?:\s+[a-z]+)*)/);
    if (binomialMatch) {
      // It's a valid binomial, but check if it has complete author and year
      const hasCompleteAuthorYear = cleanExisting.match(/\([^)]+,\s*\d{4}\)$/);
      if (hasCompleteAuthorYear) {
        return cleanExisting;
      }
      
      // Check if it has incomplete author/year (missing comma and year)
      const hasIncompleteAuthor = cleanExisting.match(/\([^)]+$/);
      if (hasIncompleteAuthor && cleanYear) {
        // Fix incomplete format like "Cucullia argentea (Hufnagel" by adding year
        const incompleteAuthor = hasIncompleteAuthor[0].substring(1); // Remove opening parenthesis
        return `${binomialMatch[1]} ${binomialMatch[2]} (${incompleteAuthor}, ${cleanYear})`;
      }
      
      // If not complete, we'll reconstruct it below
    }
  }
  
  // If we have both genus and species, construct binomial
  if (cleanGenus && cleanSpecies) {
    let binomial = `${cleanGenus} ${cleanSpecies}`;
    
    // Add author and year if available
    if (cleanAuthor || cleanYear) {
      // Clean up author - remove existing brackets if present
      let author = cleanAuthor.replace(/^\(|\)$/g, '').trim();
      const authorYear = [author, cleanYear].filter(Boolean).join(', ');
      binomial += ` (${authorYear})`;
    }
    
    return binomial;
  }
  
  // Fallback to existing or default
  return cleanExisting || '未同定';
}

// 植物の別名を取得する関数
function getPlantAliases(plantName) {
  // App.jsxと同じ別名マップを定義
  const aliasToMainMap = {
    'セイヨウリンゴ': 'リンゴ',
    'ヨーロッパリンゴ': 'リンゴ',
    'セイヨウナシ': 'ナシ',
    'ヨーロッパナシ': 'ナシ',
    'セイヨウカラシナ': 'カラシナ',
    'セイヨウタンポポ': 'タンポポ',
    'セイヨウミザクラ': 'ミザクラ',
    'セイヨウアブラナ': 'アブラナ',
    'セイヨウハコヤナギ': 'ハコヤナギ'
  };
  
  // 逆引きマップ（メイン名から別名のリストへ）
  const mainToAliasesMap = {};
  for (const [alias, main] of Object.entries(aliasToMainMap)) {
    if (!mainToAliasesMap[main]) {
      mainToAliasesMap[main] = [];
    }
    mainToAliasesMap[main].push(alias);
  }
  
  // 植物名から基本名を抽出（科名などを除去）
  const basePlantName = plantName.split(/[（(]/)[0].trim();
  
  // この植物の別名を返す
  return mainToAliasesMap[basePlantName] || [];
}

function normalizePlantImageCandidateBase(value = '') {
  return String(value || '')
    .split(/\s+/)[0]
    .trim();
}

function getPlantDetailForMeta(plantName) {
  const basePlantName = String(plantName || '').split(/[（(]/)[0].trim();
  return plantDetailIndex[plantName] || plantDetailIndex[basePlantName] || {};
}

function buildPlantImageLookupBases(displayPlantName, dataPlantName = null) {
  const names = new Set();
  const addName = (name) => {
    const raw = String(name || '').trim();
    if (!raw) return;
    const base = normalizePlantImageCandidateBase(raw);
    [raw, base, createSafePlantFilename(raw), createSafePlantFilename(base)]
      .filter(Boolean)
      .forEach((candidate) => names.add(candidate));
  };

  addName(displayPlantName);
  addName(dataPlantName);

  const detail = getPlantDetailForMeta(dataPlantName || displayPlantName);
  (Array.isArray(detail.aliases) ? detail.aliases : []).forEach(addName);
  getPlantAliases(dataPlantName || displayPlantName).forEach(addName);

  const scientificBase = createSafeScientificPlantFilename(detail.scientificName || '');
  if (scientificBase) names.add(scientificBase);

  return Array.from(names).filter(Boolean);
}

function plantImageNameMatchesBase(rawBase, lookupBase) {
  if (!rawBase || !lookupBase) return false;
  if (rawBase === lookupBase) return true;
  if (rawBase.startsWith(`${lookupBase}_`) || rawBase.startsWith(`${lookupBase}＿`)) return true;
  if (!rawBase.startsWith(lookupBase)) return false;

  const tail = rawBase.slice(lookupBase.length);
  if (!tail) return true;
  return PLANT_IMAGE_SUFFIXES.some(({ suffix, label }) => {
    const suffixCore = String(suffix || '').replace(/^[_＿]+/, '');
    return tail === label || tail === suffixCore;
  });
}

function getPlantImageFilesForMeta(displayPlantName, allPlantImages, dataPlantName = null) {
  if (!Array.isArray(allPlantImages) || allPlantImages.length === 0) return [];
  const lookupBases = buildPlantImageLookupBases(displayPlantName, dataPlantName);
  const matches = allPlantImages.filter((img) => {
    const rawBase = img.replace(/\.[^.]+$/i, '');
    return lookupBases.some((base) => plantImageNameMatchesBase(rawBase, base));
  });

  return Array.from(new Set(matches)).sort(comparePlantImageDisplayPriority);
}

function resolveInsectImageUrl(insect) {
  if (!insect) return '';
  const jpName = (insect.japaneseName || insect.name || '').trim();
  const mapped = jpName ? globalJapaneseToScientificMapping.get(jpName) : undefined;
  const candidates = buildInsectImageBaseCandidates(insect, mapped);
  const resolvedBases = resolveImageBaseCandidates(candidates, {
    imageNames: insectResizedBaseSet,
    normalizedEntries: insectResizedEntries,
  });

  for (const base of resolvedBases) {
    if (!insectResizedBaseSet.has(base)) continue;
    for (const width of [1024, 640, 320]) {
      for (const format of ['webp', 'jpg']) {
        const resizedPath = path.join(INSECT_RESIZED_DIR, `${base}.${width}.${format}`);
        if (fs.existsSync(resizedPath)) {
          return `/images/resized/insects/${encodeURIComponent(base)}.${width}.${format}`;
        }
      }
    }
  }
  for (const base of candidates) {
    if (!base || !insectResizedBaseSet.has(base)) continue;
    if (insectResizedBaseSet.has(base)) {
      for (const width of [1024, 640, 320]) {
        for (const format of ['webp', 'jpg']) {
          const resizedPath = path.join(INSECT_RESIZED_DIR, `${base}.${width}.${format}`);
          if (fs.existsSync(resizedPath)) {
            return `/images/resized/insects/${encodeURIComponent(base)}.${width}.${format}`;
          }
        }
      }
    }
  }
  return '';
}

const ROBOTS_PREVIEW_DIRECTIVES =
  'follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

function buildRobotsContent(shouldIndex) {
  return `${shouldIndex ? 'index' : 'noindex'}, ${ROBOTS_PREVIEW_DIRECTIVES}`;
}

function computeInsectRobotsContent({ insect }) {
  const name = String(insect?.japaneseName || insect?.name || '').trim();
  if (!name || name === '不明') {
    return buildRobotsContent(false);
  }
  // 種名検索での発見性を優先し、昆虫の個別種ページは原則 index へ。
  // 食草が未整理でも、和名・学名・分類だけでロングテール検索の入口になる。
  return buildRobotsContent(true);
}

function computePlantRobotsContent({ isAlias, relatedInsects, plantImageFiles, plantDetail }) {
  if (isAlias) return buildRobotsContent(false);
  const insectCount = Array.isArray(relatedInsects) ? relatedInsects.length : 0;
  const hasImage = Array.isArray(plantImageFiles) && plantImageFiles.length > 0;

  // 関連昆虫が2種以上あればインデックス対象（ロングテールキーワードの機会確保）
  if (insectCount >= 2) {
    return buildRobotsContent(true);
  }
  // 画像がある場合もインデックス対象
  if (hasImage) {
    return buildRobotsContent(true);
  }
  // 食草関係や写真が無くても、原典確認済みで独自情報が十分な植物プロフィールは
  // 検索意図（形態・分布・類似種との見分け方）に応えられるため index へ。
  const plantProfiles = [plantDetail?.profile, ...(plantDetail?.additionalProfiles || [])]
    .filter(Boolean);
  if (plantProfiles.some((profile) => isIndexablePlantProfile(profile, plantDetail))) {
    return buildRobotsContent(true);
  }
  // 関連昆虫0-1種 + 画像なし は薄いページとして noindex
  return buildRobotsContent(false);
}

function isGeneratedMetaPageIndexable(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const html = fs.readFileSync(filePath, 'utf-8');
    return !/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
  } catch {
    return false;
  }
}

function splitAlternativeNames(value = '') {
  return normalizeJapaneseInsectName(value)
    .split(/[、，,;；／/]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function combineInsectAlternativeNames(row = {}) {
  return uniqueNonEmpty([
    ...splitAlternativeNames(row.old_japanese_name),
    ...splitAlternativeNames(row.alternative_name),
    ...splitAlternativeNames(row.other_names),
  ]).join('、');
}

function uniqueNonEmpty(values = []) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function extractScientificGenus(scientificName = '') {
  const match = String(scientificName || '').trim().match(/^([A-Z][a-zA-Z-]+)/);
  return match ? match[1] : '';
}

// 英語メタページ（public/en/meta/）から id→slug および 植物名→slug のマップを構築する
// 注意: public/en/ と seo-route-map.*.json は gitignore された生成物なので、
// クリーンチェックアウト直後の1回目の実行ではこのマップは空になり、
// 日本語ページに hreflang="en" が付かない。このため generate-meta:all は
// 「ja → en → ja再実行」の2パス構成になっている（package.json）。
function isIndexableEnglishMetaHref(href) {
  if (!href) return false;
  const relativePath = decodeURIComponent(String(href).replace(/^\//, ''));
  const filePath = path.join(__dirname, '../public', relativePath);
  if (!fs.existsSync(filePath)) return false;
  return !hasNoindexRobotsMeta(fs.readFileSync(filePath, 'utf-8'));
}

function buildEnglishSlugMaps() {
  const insectIdToEnSlug = new Map();
  const plantNameToEnSlug = new Map();

  if (fs.existsSync(SEO_ROUTE_MAP_INSECTS_PATH)) {
    try {
      const routeMap = JSON.parse(fs.readFileSync(SEO_ROUTE_MAP_INSECTS_PATH, 'utf-8'));
      Object.entries(routeMap).forEach(([insectId, href]) => {
        const match = String(href).match(/^\/en\/meta\/([^/]+)\/([^/]+)\.html$/);
        if (!match || !isIndexableEnglishMetaHref(href)) return;
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
        if (!match || !isIndexableEnglishMetaHref(href)) return;
        plantNameToEnSlug.set(plantName, decodeURIComponent(match[1]));
      });
    } catch (_e) {
      // Existing English pages are still scanned below as a fallback.
    }
  }

  const enMetaDir = path.join(__dirname, '../public/en/meta');
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

// --- 食草ガイドへの内部リンク ---
// 食草ガイドは廃止したため、種ページからガイドへの逆リンクは生成しない（no-op）。
const renderHostPlantGuideLinks = () => '';

// --- 同じ食草を利用する他の昆虫（共起昆虫）---
// hostPlantsMap（食草→昆虫の逆引き、全ループ完成後に渡す）から、この種と食草を共有する
// 他の昆虫を抽出して相互リンクする。各種ページの内容を厚くし(薄い・定型コンテンツの是正)、
// 種↔種の内部リンク網を密にしてクロール到達性とトピック関連性を高める。
function renderCoOccurringInsects(insect, fallbackType, hostPlantsArray = [], hostPlantsMap = null) {
  if (!hostPlantsMap || !hostPlantsArray.length) return '';
  const selfId = insect && insect.id;
  const seen = new Map();
  for (const plant of hostPlantsArray) {
    const list = hostPlantsMap.get(plantPageKey(plant));
    if (!Array.isArray(list)) continue;
    for (const other of list) {
      if (!other || !other.id || other.id === selfId) continue;
      const name = other.japaneseName || other.name;
      if (!name) continue;
      if (!seen.has(other.id)) {
        seen.set(other.id, { id: other.id, name, type: other.type || fallbackType });
      }
    }
  }
  const others = [...seen.values()];
  if (!others.length) return '';
  const shown = others.slice(0, 20);
  const items = shown
    .map((o) => `<li><a href="${buildJapaneseInsectPath(o, o.type)}">${o.name}</a></li>`)
    .join('');
  return `
      <section class="co-occurring">
        <h3>同じ食草を利用する他の昆虫</h3>
        <p>${insect.japaneseName}と食草を共有する昆虫が${others.length}種知られています${others.length > shown.length ? `（うち${shown.length}種を表示）` : ''}：</p>
        <ul>${items}</ul>
      </section>`;
}

// Enhanced HTMLテンプレートを生成する関数 - フルコンテンツバージョン
function generateInsectHTML(
  insect,
  type,
  enSlugEntry = null,
  hostPlantsMap = null,
  resolvePlantMetaTarget = null,
) {
  const typeNames = INSECT_TYPE_NAMES;
  
  const hostPlants = insect.hostPlants || '不明';
  const scientificName = insect.scientificName || '';
  const citationEntries = buildInsectCitationEntries(insect);
  const citationSummaryHtml = renderCitationSummaryHtml(citationEntries);
  const citationListHtml = renderCitationListHtml(citationEntries);
  const imageUrl = resolveInsectImageUrl(insect);
  // ヒーロー画像のベース名（/images/resized/insects/<enc>.<w>.<format> → <enc>）。
  // レスポンシブ <picture> と preload の生成に使う。
  const insectImageBase = (() => {
    const m = /\/images\/resized\/insects\/(.+)\.(?:320|640|1024)\.(?:jpg|webp)$/.exec(imageUrl || '');
    return m ? m[1] : '';
  })();
  const heroPreloadHtml = insectImageBase
    ? buildHeroPreloadLink({ dir: 'insects', base: insectImageBase })
    : '';
  const socialImageUrl = `${BASE_ORIGIN}${imageUrl || DEFAULT_SOCIAL_IMAGE_PATH}`;
  const socialImageAlt = imageUrl
    ? `${insect.japaneseName}（${scientificName}）の写真`
    : `${insect.japaneseName}のイメージ画像`;
  
  // 食草リストを配列として処理
  // セミコロン区切りも処理する（例：センモンヤガの場合）
  const hostPlantsArray = hostPlants !== '不明' ? 
    [...new Set(hostPlants.split(/[;；、,，]/)
      .map(p => p.trim())
      .filter(p => p && p !== '' && p !== '不明')
      .map(p => p.replace(/につく[。．]?$/g, '').trim()) // Remove "につく。"
      .flatMap(p => {
        // Handle patterns like "クマノミズキ (以上ミズキ科)" - extract individual plant names
        const familyMatch = p.match(/^(.+?)\s*\(\s*以上[^)]*科\s*\)$/);
        if (familyMatch) {
          // Split individual plant names before the family annotation
          const plantNames = familyMatch[1].split(/[、，,]/).map(name => name.trim()).filter(name => name);
          return plantNames;
        }
        return [p];
      })
      .filter(p => p) 
      .filter(p => {
        // Filter out non-plant texts
        if (!p) return false;
        if (p.includes('害虫') || p.includes('であり')) return false;
        if (p === '農業' || p === '農業害虫' || p === '農業害虫であり') return false;
        // Filter out year-like tokens that might be parsed as plants
        if (/^[\[(（]?\s*\d{3,4}\s*[\])）)]*\s*$/.test(p)) return false;
        // Must have at least one Japanese or alphabetic character
        if (!/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(p)) return false;
        const normalized = normalizePlantName(p);
        if (!isValidPlantName(normalized)) return false;
        return true;
      }))]
      : [];
  
  // 分類情報の生成
  const familyName = insect.family || INSECT_DEFAULT_FAMILIES[type];
  const robotsContent = computeInsectRobotsContent({ hostPlantsArray, imageUrl, insect });
  const alternativeNameList = splitAlternativeNames(insect.alternativeNames);
  const scientificGenus = extractScientificGenus(scientificName);
  const hostPlantKeywordList = uniqueNonEmpty(
    hostPlantsArray
      .slice(0, 12)
      .map((plant) => normalizePlantName(plant))
      .filter(isValidPlantName),
  );
  const insectKeywordList = uniqueNonEmpty([
    insect.japaneseName,
    ...alternativeNameList,
    scientificName,
    scientificGenus,
    familyName,
    typeNames[type],
    '昆虫',
    '昆虫 食草',
    '食草',
    '寄主植物',
    '幼虫 食草',
    '昆虫図鑑',
    ...hostPlantKeywordList,
  ]);
  const enAlternatePath = (() => {
    if (!enSlugEntry) return '';
    return buildEnglishInsectPath(insect, type);
  })();

  // --- description テンプレート生成 ---
  // 出現時期は insect.emergenceTime から取得
  // データが「成虫は〜に出現[。]」など文章形式の場合は先頭の「成虫は」を除去し、
  // 句点・読点・25文字のうち最初に来るもので打ち切って時期テキストを取り出す
  const emergenceTimeRaw = (insect.emergenceTime || '').trim();
  const hasEmergence = emergenceTimeRaw !== '' && emergenceTimeRaw !== '不明';
  const emergenceTimeVal = (() => {
    if (!hasEmergence) return '';
    // 先頭の「成虫は」「成虫の」を除去
    let t = emergenceTimeRaw.replace(/^成虫[はの]/, '').trim();
    // 句点・読点で打ち切り（30文字以内の位置のみ）
    const cutIdx = t.search(/[。．、,，]/);
    if (cutIdx !== -1 && cutIdx <= 30) {
      t = t.substring(0, cutIdx);
    } else {
      t = t.substring(0, 25);
    }
    // 打ち切り後に末尾の「に出現」「に発生」「で出現」「出現し」「に出る」を除去
    t = t.replace(/(?:に出現|に発生|で出現|出現し|に出る)$/, '').trim();
    // 末尾が時期らしい語（月・旬・頃・季節）で終わっている場合のみ有効
    // それ以外（動詞・助詞・名詞など）で終わる場合は不自然なので空文字を返す
    if (!/[月旬頃秋春夏冬]$/.test(t)) {
      return '';
    }
    return t;
  })();

  // 備考テキスト（先頭を生態情報として利用）
  const remarksRaw = (insect.remarks || '').trim();
  // HTML タグやダブルクォートを除去して plain text 化
  const remarksPlain = remarksRaw.replace(/<[^>]*>/g, '').replace(/"/g, '');

  // 昆虫ページ description（120〜160文字目標、末尾句の余裕を確保して打ち切り）
  const DESC_MAX = 160;
  const SUFFIX_FOOD = '寄主植物・生態の詳細情報。';
  const SUFFIX_NOFOOD = '食草・寄主植物・生態についての情報。';
  let insectDescription;
  if (hostPlantsArray.length > 0) {
    // 食草あり
    const plantListStr = hostPlantsArray.slice(0, 3).join('、');
    const plantSuffix = hostPlantsArray.length > 3 ? `など${hostPlantsArray.length}種` : `${hostPlantsArray.length}種`;
    let desc = `${insect.japaneseName}（${familyName}）の幼虫の食草・食樹は${plantListStr}${plantSuffix}。`;
    if (hasEmergence && emergenceTimeVal) {
      desc += `成虫は${emergenceTimeVal}に出現。`;
    }
    // 備考の先頭スニペットを追加（残り文字数に応じて）
    if (remarksPlain.length > 0 && desc.length < DESC_MAX - SUFFIX_FOOD.length) {
      const available = DESC_MAX - SUFFIX_FOOD.length - desc.length;
      const sentenceEnd = remarksPlain.search(/[。．]/);
      const snippet = (sentenceEnd !== -1 && sentenceEnd < available)
        ? remarksPlain.substring(0, sentenceEnd + 1)
        : remarksPlain.substring(0, available);
      if (snippet.length > 0) {
        desc += snippet;
      }
    }
    desc += SUFFIX_FOOD;
    insectDescription = desc.replace(/"/g, '');
  } else {
    // 食草なし
    const sciPart = scientificName ? `${scientificName.replace(/"/g, '')}。` : '';
    let desc = `${insect.japaneseName}（${familyName}）は${sciPart}`;
    if (remarksPlain.length > 0 && desc.length < DESC_MAX - SUFFIX_NOFOOD.length) {
      const available = DESC_MAX - SUFFIX_NOFOOD.length - desc.length;
      const sentenceEnd = remarksPlain.search(/[。．]/);
      const snippet = (sentenceEnd !== -1 && sentenceEnd < available)
        ? remarksPlain.substring(0, sentenceEnd + 1)
        : remarksPlain.substring(0, available);
      if (snippet.length > 0) {
        desc += snippet;
      }
    }
    desc += SUFFIX_NOFOOD;
    insectDescription = desc.replace(/"/g, '');
  }

  // og:description / twitter:description（先頭5種 + など に制限）
  let insectOgDescription;
  if (hostPlantsArray.length > 0) {
    const ogPlants = hostPlantsArray.slice(0, 5).join('、');
    const ogSuffix = hostPlantsArray.length > 5 ? 'など' : '';
    insectOgDescription = `${insect.japaneseName}（${familyName}）の食草は${ogPlants}${ogSuffix}。${(hasEmergence && emergenceTimeVal) ? `成虫は${emergenceTimeVal}に出現。` : ''}寄主植物・生態の詳細情報。`.replace(/"/g, '');
  } else {
    insectOgDescription = insectDescription;
  }
  // --- description テンプレート生成終わり ---

  const explorerSearchPath = buildExplorerSearchPath('insects', insect.japaneseName);
  const insectPageUrl = `${BASE_ORIGIN}${buildJapaneseInsectPath(insect, type)}`;
  const familyTitlePart = familyName ? `（${familyName}）` : '';
  const insectTitle = hostPlantsArray.length > 0
    ? `${insect.japaneseName}の食草・寄主植物・分類 - ${typeNames[type]}図鑑`
    : `${insect.japaneseName}${familyTitlePart}の分類・生態 - ${typeNames[type]}図鑑`;
  const insectKeywords = insectKeywordList.join(',');
  const insectEntityId = `${insectPageUrl}#species`;
  const insectImageObject = imageUrl ? {
    '@type': 'ImageObject',
    url: `${BASE_ORIGIN}${imageUrl}`,
    caption: `${insect.japaneseName}（${scientificName}）の写真`,
    representativeOfPage: true,
  } : null;
  const insectStructuredData = {
    '@context': 'https://schema.org',
    '@id': insectEntityId,
    '@type': ['Animal', 'Species'],
    name: insect.japaneseName,
    alternateName: uniqueNonEmpty([scientificName, insect.japaneseName, ...alternativeNameList]),
    scientificName,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': insectPageUrl,
    },
    identifier: {
      '@type': 'PropertyValue',
      propertyID: 'species_id',
      value: insect.id,
    },
    classification: {
      '@type': 'Taxon',
      taxonRank: 'species',
      parentTaxon: {
        '@type': 'Taxon',
        name: familyName,
        taxonRank: 'family',
      },
    },
    description: `${insect.japaneseName}（${scientificName}）は${familyName}に属する${typeNames[type]}の一種です。${hostPlantsArray.length > 0 ? `主な食草：${hostPlantsArray.slice(0, 3).join('、')}など${hostPlantsArray.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    keywords: insectKeywordList.slice(0, 14),
    url: insectPageUrl,
    inLanguage: 'ja',
    author: {
      '@type': 'Organization',
      name: '昆虫植物図鑑',
    },
    publisher: {
      '@type': 'Organization',
      name: '昆虫植物図鑑',
    },
  };
  if (citationEntries.length > 0) {
    insectStructuredData.citation = citationEntries.map((entry) => entry.plain);
  }
  if (insectImageObject) {
    insectStructuredData.image = insectImageObject;
  }
  const insectWebPageData = shouldRenderInsectWebPageData(hostPlantsArray)
    ? buildMetaWebPageData({
      url: insectPageUrl,
      title: insectTitle,
      description: insectDescription,
      inLanguage: 'ja',
      entityId: insectEntityId,
      imageObject: insectImageObject,
    })
    : null;
  const insectBreadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '昆虫植物図鑑', item: `${BASE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: typeNames[type], item: `${BASE_ORIGIN}/moth/` },
      { '@type': 'ListItem', position: 3, name: insect.japaneseName, item: insectPageUrl },
    ],
  };
  const faqPlantList = hostPlantsArray.slice(0, 5).join('、');
  const faqPlantSummary = hostPlantsArray.length > 5
    ? `${faqPlantList}など${hostPlantsArray.length}種`
    : `${faqPlantList}の${hostPlantsArray.length}種`;
  const insectFaqItems = hostPlantsArray.length > 0 ? [
    {
      question: `${insect.japaneseName}の食草・寄主植物は何ですか？`,
      answer: `${insect.japaneseName}の食草・寄主植物として、このページでは${faqPlantSummary}を掲載しています。`,
    },
    {
      question: `${insect.japaneseName}は何種の植物を利用しますか？`,
      answer: `整理済みデータでは、${insect.japaneseName}が利用する植物として${hostPlantsArray.length}種が記録されています。表記ゆれや近縁植物を含む場合があります。`,
    },
    {
      question: `${insect.japaneseName}の食草情報の出典はどこで確認できますか？`,
      answer: citationEntries.length > 0
        ? `このページの出典欄で、${insect.japaneseName}の食草・寄主植物情報に関係する文献やデータ出典を確認できます。`
        : `このページの食草リストと各植物ページを確認し、報告や同定に使う場合は元データの出典を確認してください。`,
    },
  ] : [];
  const insectFaqData = insectFaqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: insectFaqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null;
  const safeInsectTitle = escapeRedirectHtml(insectTitle);
  const safeInsectDescription = escapeRedirectHtml(insectDescription);
  const safeInsectKeywords = escapeRedirectHtml(insectKeywords);
  const safeInsectOgDescription = escapeRedirectHtml(insectOgDescription);
  const safeSocialImageAlt = escapeRedirectHtml(socialImageAlt);
  const safeExplorerSearchPath = escapeRedirectHtml(explorerSearchPath);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${robotsContent}">
  ${GA_HEAD_TAGS}
  <!-- Google AdSense account verification -->
  <meta name="google-adsense-account" content="ca-pub-6982051533473293">
  ${DEFERRED_ADS_SCRIPT}
  <title>${safeInsectTitle}</title>
  <meta name="description" content="${safeInsectDescription}">
  <meta name="keywords" content="${safeInsectKeywords}">
  <link rel="canonical" href="${insectPageUrl}">
  <link rel="alternate" hreflang="ja" href="${insectPageUrl}">
  ${enAlternatePath ? `<link rel="alternate" hreflang="en" href="${BASE_ORIGIN}${enAlternatePath}">
  ` : ''}<link rel="alternate" hreflang="x-default" href="${insectPageUrl}">
  <link rel="stylesheet" href="${META_STYLE_PATH}">
  ${heroPreloadHtml}

  <!-- Open Graph -->
  <meta property="og:title" content="${safeInsectTitle}">
  <meta property="og:description" content="${safeInsectOgDescription}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${insectPageUrl}">
  <meta property="og:image" content="${socialImageUrl}">
  <meta property="og:image:alt" content="${safeSocialImageAlt}">
  <meta property="og:site_name" content="昆虫植物図鑑">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeInsectTitle}">
  <meta name="twitter:description" content="${safeInsectOgDescription}">
  <meta name="twitter:image" content="${socialImageUrl}">
  <meta name="twitter:image:alt" content="${safeSocialImageAlt}">
  
  <!-- Enhanced Structured Data -->
  ${insectWebPageData ? `<script type="application/ld+json">${renderJsonLd(insectWebPageData)}</script>` : ''}
  <script type="application/ld+json">${renderJsonLd(insectStructuredData)}</script>
  <script type="application/ld+json">${renderJsonLd(insectBreadcrumbData)}</script>
  ${insectFaqData ? `<script type="application/ld+json">${renderJsonLd(insectFaqData)}</script>` : ''}
</head>
<body>
  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/" class="meta-site-logo" aria-label="昆虫植物図鑑 トップへ">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <img src="${SITE_LOGO_SRC}" width="28" height="28" alt="" decoding="async">
        </span>
        <span class="meta-site-logo-text">昆虫植物図鑑</span>
      </a>
      <a href="${safeExplorerSearchPath}" class="meta-site-header-link">図鑑で検索 →</a>
    </div>
  </header>

  <div class="meta-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <ol>
        <li><a href="/">昆虫植物図鑑</a></li>
        <li><a href="/moth/">${typeNames[type]}</a></li>
        <li aria-current="page">${insect.japaneseName}</li>
      </ol>
    </nav>

    <header class="meta-header">
      <h1>${insect.japaneseName}</h1>
      <h2>${formatScientificNameHTML(scientificName)}</h2>
    </header>
    
    <main class="meta-content">
      <section class="basic-info">
        <h3>基本情報</h3>
        <dl>
          <dt>和名</dt>
          <dd>${insect.japaneseName}</dd>
          ${insect.alternativeNames && insect.alternativeNames.trim() ? `
          <dt>別名</dt>
          <dd>${insect.alternativeNames}</dd>` : ''}
          <dt>学名</dt>
          <dd>${formatScientificNameHTML(scientificName)}</dd>
          <dt>分類</dt>
          <dd>${familyName}</dd>
          <dt>種類</dt>
          <dd>${typeNames[type]}</dd>
          ${hostPlantsArray.length > 0 ? `
          <dt>食草数</dt>
          <dd>${hostPlantsArray.length}種</dd>` : ''}
          ${insect.emergenceTime && insect.emergenceTime !== '不明' ? `
          <dt>成虫出現時期</dt>
          <dd>${insect.emergenceTime}</dd>` : ''}
          ${citationSummaryHtml ? `
          <dt>出典</dt>
          <dd>${citationSummaryHtml}</dd>` : ''}
        </dl>
      </section>
      
      ${imageUrl ? `
      <section class="image-section">
        ${buildResponsivePicture({ dir: 'insects', base: insectImageBase, alt: `${insect.japaneseName}（${scientificName}）の写真`, aboveFold: true })}
        <div class="image-caption">${insect.japaneseName}の生態写真</div>
      </section>` : ''}
      
      <section class="host-plants">
        <h3>食草・食樹</h3>
        ${hostPlantsArray.length > 0 ? `
        <p>${insect.japaneseName}は以下の植物を食草として利用します：</p>
        <ul>
          ${hostPlantsArray.map(plant => {
            const normalizedPlant = normalizePlantName(plant);
            if (!isValidPlantName(normalizedPlant)) {
              return `<li>${escapeRedirectHtml(plant)}</li>`;
            }
            // リンク先は科名を除いた正規ページ（統合先）。科名は隣接テキストで補足表示する。
            const key = plantPageKey(plant);
            const fam = extractPlantFamilySuffix(normalizedPlant);
            const targetName = resolvePlantMetaTarget ? resolvePlantMetaTarget(key) : '';
            const label = escapeRedirectHtml(key);
            const familyLabel = fam ? `（${escapeRedirectHtml(fam)}）` : '';
            if (!targetName) {
              return `<li>${label}${familyLabel}</li>`;
            }
            const safeTargetName = targetName.replace(/[/\\?%*:|"<>]/g, '-');
            return `<li><a href="${buildPlantPath(safeTargetName, 'ja')}">${label}</a>${familyLabel}</li>`;
          }).join('')}
        </ul>
        ${renderHostPlantGuideLinks(hostPlantsArray)}` : `
        <p>食草情報は現在調査中です。</p>`}
      </section>
      ${renderCoOccurringInsects(insect, type, hostPlantsArray, hostPlantsMap)}

      ${insectFaqItems.length > 0 ? `
      <section class="description">
        <h3>よくある疑問</h3>
        <dl>
          ${insectFaqItems.map((item) => `
          <dt>${escapeRedirectHtml(item.question)}</dt>
          <dd>${escapeRedirectHtml(item.answer)}</dd>`).join('')}
        </dl>
      </section>` : ''}

      <section class="description">
        <h3>詳細説明</h3>
        <p>${insect.japaneseName}（学名：${formatScientificNameHTML(scientificName)}）は${familyName}に分類される${typeNames[type]}の一種です。</p>
        ${hostPlantsArray.length > 0 ? `
        <p>幼虫は${hostPlantsArray.slice(0, 3).join('、')}${hostPlantsArray.length > 3 ? 'など' : ''}を食草として成長します。${
          hostPlantsArray.length === 1
            ? `知られている食草は${hostPlantsArray[0]}の1種で、特定の植物に依存する食性をもつと考えられます。`
            : hostPlantsArray.length <= 5
              ? `これまでに${hostPlantsArray.length}種の植物が食草として記録されています。`
              : `${hostPlantsArray.length}種におよぶ幅広い植物を利用する多食性の種です。`
        }</p>` : ''}
        ${insect.remarks && insect.remarks.trim() ? `
        <h4>備考</h4>
        <p>${formatEnglishWordsInItalic(insect.remarks)}</p>` : ''}
        ${citationListHtml ? `
        <h4>出典</h4>
        ${citationListHtml}` : ''}
        <p>この種の詳細な生態情報や観察記録については、メインの図鑑ページでご確認ください。</p>
	      </section>
	      ${renderManualAdSlot(MANUAL_AD_SLOTS.detail)}
	    </main>
	    
	    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
      <a href="${safeExplorerSearchPath}" class="detail-link">図鑑で検索</a>
    </section>
    ${renderAmazonAssociatesDisclosureHtml(citationEntries)}
  </div>
  
  <script>
    // Progressive enhancement - SPA化が可能な場合のみ遷移
    (function() {
      // JavaScript有効時の拡張機能
      const detailLinks = document.querySelectorAll('a[href*="/${type}/"]');
      
      // 画像の遅延読み込み対応
      const img = document.querySelector('.image-section img');
      if (img) {
        img.addEventListener('load', function() {
          this.style.opacity = '1';
        });
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
      }
      
      // 外部リンクの処理
      const externalLinks = document.querySelectorAll('a[href^="http"]');
      externalLinks.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
    })();
  </script>
</body>
</html>`;
}

// 植物プロファイル（『日本の野生植物』由来の生活形・樹高・花期・分布・生育環境・識別形質）の
// 表示ラベル。data-lite の detail.profile と対応する。
const PLANT_PROFILE_FIELDS = [
  ['habit', '生活形'],
  ['height', '樹高・草丈'],
  ['flowerPeriod', '花期'],
  ['distribution', '分布'],
  ['habitat', '生育環境'],
  ['similarTaxa', '比較対象'],
  ['distinguishingFeatures', '類似種との見分け方'],
];

// 植物メタページ本文に「植物の特徴」セクションを描画する。
// data-lite に実データ（detail.profile）がある植物のみ出力し、
// 各ページの独自テキスト量を増やして薄コンテンツによるインデックス未登録を回避する。
// 事実が1件も無い場合は空文字を返す（セクションごと出力しない）。
function renderSinglePlantProfileSection(
  displayPlantName,
  profile,
  detail = {},
  plantFamily = '',
  isAdditional = false,
) {
  const facts = PLANT_PROFILE_FIELDS
    .map(([key, label]) => [label, String(profile[key] || '').trim()])
    .filter(([, value]) => value);
  if (facts.length === 0) return '';

  const sourcePlantName = String(profile.sourcePlantName || displayPlantName).trim();
  const profileScientificName = String(
    profile.scientificName || (!isAdditional ? detail.scientificName : '') || '',
  ).trim();
  const familyLabel = String(
    profile.family || (!isAdditional ? (plantFamily || detail.familyName || detail.family) : '') || '',
  ).trim();
  const habit = String(profile.habit || '').trim();
  // 先頭の要約文は名詞（生活形・科名）のみで構成し、文法破綻を避ける。
  const leadSentence = habit
    ? `${sourcePlantName}は${habit}${familyLabel ? `（${familyLabel}）` : ''}の植物です。`
    : `${sourcePlantName}の形態・分布に関する基本情報です。`;

  const source = String(profile.source || '').trim();
  const sourceLabel = buildPlantProfileSourceLabel(profile);
  const sourceText = source ? `出典：${sourceLabel}` : '';

  const dlItems = facts
    .map(([label, value]) => `
          <dt>${escapeRedirectHtml(label)}</dt>
          <dd>${escapeRedirectHtml(value)}</dd>`)
    .join('');

  const sourceIdentityHtml = isAdditional ? `
          <dt>出典上の植物名</dt>
          <dd>${escapeRedirectHtml(sourcePlantName)}</dd>${profileScientificName ? `
          <dt>出典上の学名</dt>
          <dd>${escapeRedirectHtml(profileScientificName)}</dd>` : ''}${familyLabel ? `
          <dt>出典上の科名</dt>
          <dd>${escapeRedirectHtml(familyLabel)}</dd>` : ''}` : '';
  const heading = isAdditional
    ? `「${sourcePlantName}」としての植物プロフィール`
    : '植物の特徴';

  return `
      <section class="description plant-profile">
        <h3>${escapeRedirectHtml(heading)}</h3>
        <p>${escapeRedirectHtml(leadSentence)}</p>
        <dl>${sourceIdentityHtml}${dlItems}
        </dl>${sourceText ? `
        <p class="profile-source">${escapeRedirectHtml(sourceText)}</p>` : ''}
      </section>`;
}

function renderPlantProfileSections(
  displayPlantName,
  detail = {},
  plantFamily = '',
) {
  const profileEntries = [
    ...(detail?.profile ? [{ profile: detail.profile, isAdditional: false }] : []),
    ...(detail?.additionalProfiles || [])
      .map((profile) => ({ profile, isAdditional: true })),
  ];
  return profileEntries
    .map(({ profile, isAdditional }) => renderSinglePlantProfileSection(
      displayPlantName,
      profile,
      detail,
      plantFamily,
      isAdditional,
    ))
    .join('');
}

function getPlantProfileTopicLabels(profile = {}) {
  return [
    [profile.habit || profile.height, '特徴'],
    [profile.distribution, '分布'],
    [profile.distinguishingFeatures, '見分け方'],
    [profile.habitat, '生育環境'],
    [profile.flowerPeriod, '花期'],
  ]
    .filter(([value]) => String(value || '').trim())
    .map(([, label]) => label);
}

function buildPlantProfileMetaDescription(
  displayPlantName,
  profile = {},
  detail = {},
  plantFamily = '',
) {
  const sourcePlantName = String(profile.sourcePlantName || displayPlantName).trim();
  const scientificName = String(profile.scientificName || detail?.scientificName || '').trim();
  const family = String(profile.family || plantFamily || detail?.familyName || detail?.family || '').trim();
  const similarTaxa = String(profile.similarTaxa || '').trim();
  const distinguishingFeatures = String(profile.distinguishingFeatures || '').trim();
  const source = String(profile.source || '').trim();
  const identity = [scientificName, family].filter(Boolean).join('・');
  const comparison = similarTaxa ? `${similarTaxa}との見分け方` : '類似種との見分け方';
  const profileIdentity = `${sourcePlantName}${identity ? `（${identity}）` : ''}`;
  const profileTopics = getPlantProfileTopicLabels(profile)
    .filter((label) => label !== '見分け方');
  const topicParts = [
    ...profileTopics,
    ...(distinguishingFeatures ? [comparison] : []),
  ];
  const topicSummary = topicParts.length > 0
    ? topicParts.join('・')
    : '形態情報';
  const raw = [
    `${displayPlantName}の植物プロフィール。`,
    sourcePlantName !== displayPlantName
      ? `出典では「${sourcePlantName}」として記載。`
      : '',
    `${profileIdentity}の${topicSummary}を${source ? `『${source}』に基づいて` : ''}掲載。`,
    distinguishingFeatures ? `識別点：${distinguishingFeatures}` : '',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return raw.length <= 180 ? raw : `${raw.slice(0, 177).trimEnd()}…`;
}

// Enhanced 植物のHTMLテンプレートを生成する関数 - フルコンテンツバージョン
// originalPlantName: エイリアス生成時に元の植物名（科名付き）を渡すため
function generatePlantHTML(plantName, relatedInsects, plantImages, originalPlantName = null, enSlug = null, plantFamily = '') {
  // originalPlantNameが指定されている場合は、それが実際のデータの植物名
  // plantNameは表示用の名前（エイリアスの場合は科名なし）
  // plantFamily は科名（例「バラ科」）。ページ識別子には含めず本文属性として表示する。
  const dataPlantName = originalPlantName || plantName;
  const displayPlantName = plantName;
  
  const isAlias = Boolean(originalPlantName && originalPlantName !== displayPlantName);
  const canonicalPlantName = originalPlantName || displayPlantName;
  const safeCanonicalName = canonicalPlantName.replace(/[/\\?%*:|"<>]/g, '-');

  // 植物の別名を取得（データ用の名前で取得）
  const plantAliases = getPlantAliases(dataPlantName);

  // 形態・分布プロフィールは画像・robots・メタ情報・本文で共通利用する。
  const plantDetail = getPlantDetailForMeta(dataPlantName);
  const plantProfiles = [plantDetail?.profile, ...(plantDetail?.additionalProfiles || [])]
    .filter(Boolean);
  const indexablePlantProfile = plantProfiles.find((profile) =>
    isIndexablePlantProfile(profile, plantDetail));
  const profileForMetadata = indexablePlantProfile || plantProfiles[0] || null;
  const hasRelatedInsects = relatedInsects.length > 0;

  // この植物に関連する画像を探す（和名・別名・学名ベースのファイル名を許容）
  const plantImageFiles = getPlantImageFilesForMeta(displayPlantName, plantImages, dataPlantName);
  const mainImageUrl = plantImageFiles.length > 0 
    ? buildPlantResizedImageUrl(plantImageFiles[0]) 
    : '';
  const socialImageUrl = `${BASE_ORIGIN}${mainImageUrl || DEFAULT_SOCIAL_IMAGE_PATH}`;
  const socialImageAlt = mainImageUrl
    ? `${displayPlantName}の写真`
    : `${displayPlantName}のイメージ画像`;
  const robotsContent = computePlantRobotsContent({
    isAlias,
    relatedInsects,
    plantImageFiles,
    plantDetail,
  });

  const getPlantGroupingType = (insect) => {
    const family = (insect.familyJapanese || insect.family || '').trim();
    if (family.includes('アブラムシ')) return 'aphid';
    return insect.type;
  };

  const getInsectMetaRouteType = (insect) => insect.type || 'moth';

  // 植物ページ用に昆虫を種類別に分類
  const insectsByType = {
    moth: relatedInsects.filter(i => getPlantGroupingType(i) === 'moth'),
    butterfly: relatedInsects.filter(i => getPlantGroupingType(i) === 'butterfly'),
    beetle: relatedInsects.filter(i => getPlantGroupingType(i) === 'beetle'),
    longhornbeetle: relatedInsects.filter(i => getPlantGroupingType(i) === 'longhornbeetle'),
    barkbeetle: relatedInsects.filter(i => getPlantGroupingType(i) === 'barkbeetle'),
    leafbeetle: relatedInsects.filter(i => getPlantGroupingType(i) === 'leafbeetle'),
    aphid: relatedInsects.filter(i => getPlantGroupingType(i) === 'aphid')
  };
  
  const typeNames = {
    moth: '蛾',
    butterfly: '蝶',
    beetle: 'タマムシ',
    longhornbeetle: 'カミキリムシ',
    barkbeetle: 'キクイムシ',
    leafbeetle: 'ハムシ',
    aphid: 'アブラムシ'
  };
  const citationEntries = buildPlantCitationEntries(relatedInsects, dataPlantName, displayPlantName);
  const citationListHtml = renderCitationListHtml(citationEntries);

  // 『日本の野生植物』由来の形態・分布データを本文に描画（薄コンテンツ回避）
  const plantProfileHtml = renderPlantProfileSections(
    displayPlantName,
    plantDetail,
    plantFamily,
  );

  // --- 植物ページ description テンプレート生成 ---
  // 種類別内訳を「蛾X種、蝶Y種...」形式で生成（0種は省略）
  const plantTypeBreakdown = Object.entries(insectsByType)
    .filter(([, insects]) => insects.length > 0)
    .map(([t, insects]) => `${typeNames[t]}${insects.length}種`)
    .join('、');
  // description: 昆虫数・内訳 + 代表的な昆虫名 + 末尾句
  const plantRepresentatives = relatedInsects.slice(0, 3).map(i => i.japaneseName).join('、');
  const plantDescriptionBase = `${displayPlantName}を食草・寄主植物とする昆虫は${relatedInsects.length}種（${plantTypeBreakdown}）。`;
  const plantDescriptionSuffix = `${plantRepresentatives}など${displayPlantName}につく幼虫・成虫の種類と生態情報。`;
  const insectBasedPlantDescription = (plantDescriptionBase + plantDescriptionSuffix).replace(/"/g, '');
  // og:description: 先頭5種の昆虫名 + など
  const ogInsects = relatedInsects.slice(0, 5).map(i => i.japaneseName).join('、');
  const ogInsectsSuffix = relatedInsects.length > 5 ? 'など' : '';
  const insectBasedPlantOgDescription = `${displayPlantName}を食草とする昆虫: ${ogInsects}${ogInsectsSuffix}。利用昆虫${relatedInsects.length}種の生態・食草関係。`.replace(/"/g, '');
  const profileBasedPlantDescription = buildPlantProfileMetaDescription(
    displayPlantName,
    profileForMetadata || {},
    plantDetail,
    plantFamily,
  );
  const plantDescription = hasRelatedInsects
    ? insectBasedPlantDescription
    : profileBasedPlantDescription;
  const plantOgDescription = hasRelatedInsects
    ? insectBasedPlantOgDescription
    : profileBasedPlantDescription;
  // --- 植物ページ description テンプレート生成終わり ---

  // 関連昆虫があるページは昆虫検索へ、プロフィール単独ページは植物検索へつなぎ、
  // 空の昆虫結果や静的一覧への行き止まりを避ける。
  const explorerSearchPath = buildExplorerSearchPath('insects', displayPlantName);
  const plantExplorerSearchPath = buildExplorerSearchPath('plants', displayPlantName);
  const plantActionPath = hasRelatedInsects ? explorerSearchPath : plantExplorerSearchPath;
  const plantHeaderActionLabel = hasRelatedInsects
    ? 'この植物を利用する昆虫を見る →'
    : '図鑑でこの植物を探す →';
  const plantFooterActionLabel = hasRelatedInsects
    ? '関連昆虫を図鑑で見る'
    : '図鑑で植物を検索';
  const plantProfileTopicSummary = getPlantProfileTopicLabels(profileForMetadata || {})
    .slice(0, 3)
    .join('・') || '特徴';
  const plantPageUrl = `${BASE_ORIGIN}${buildPlantPath(safeCanonicalName, 'ja')}`;
  const plantTitle = hasRelatedInsects
    ? `${displayPlantName}につく虫・幼虫${relatedInsects.length}種｜食草記録と出典｜昆虫植物図鑑`
    : `${displayPlantName}の${plantProfileTopicSummary}｜植物プロフィール｜昆虫植物図鑑`;
  const plantKeywords = hasRelatedInsects
    ? `${displayPlantName},食草,植物,昆虫図鑑,生態系,${relatedInsects.slice(0, 5).map(i => i.japaneseName).join(',')}`
    : [
      displayPlantName,
      plantDetail.scientificName,
      plantFamily || plantDetail.familyName || plantDetail.family,
      '植物プロフィール',
      '特徴',
      '分布',
      '生育環境',
      '見分け方',
    ].filter(Boolean).join(',');
  const plantEntityId = `${plantPageUrl}#plant`;
  const plantProfileCitationLabels = Array.from(new Set(
    plantProfiles
      .map((profile) => buildPlantProfileSourceLabel(profile))
      .filter(Boolean),
  ));
  const plantImageObject = mainImageUrl ? {
    '@type': 'ImageObject',
    url: `${BASE_ORIGIN}${mainImageUrl}`,
    caption: socialImageAlt,
    representativeOfPage: true,
  } : null;
  const plantStructuredData = {
    '@context': 'https://schema.org',
    '@id': plantEntityId,
    '@type': ['Plant', 'Species'],
    name: displayPlantName,
    identifier: {
      '@type': 'PropertyValue',
      propertyID: 'plant_name',
      value: displayPlantName,
    },
    description: hasRelatedInsects
      ? `${displayPlantName}の食草植物情報。${relatedInsects.length}種の昆虫がこの植物を食草として利用します.`
      : plantDescription,
    url: plantPageUrl,
    inLanguage: 'ja',
    ...(hasRelatedInsects ? { hasEcologicalInteraction: relatedInsects.map(insect => ({
      '@type': 'EcologicalInteraction',
      interactionType: 'herbivory',
      participantOrganism: {
        '@type': ['Animal', 'Species'],
        name: insect.japaneseName,
        scientificName: insect.scientificName,
      },
    })) } : {}),
    author: {
      '@type': 'Organization',
      name: '昆虫植物図鑑',
    },
    publisher: {
      '@type': 'Organization',
      name: '昆虫植物図鑑',
    },
  };
  if (!hasRelatedInsects) {
    const profileScientificName = String(
      plantDetail.scientificName || profileForMetadata?.scientificName || '',
    ).trim();
    if (profileScientificName) {
      plantStructuredData.scientificName = profileScientificName;
    }
    if (plantProfileCitationLabels.length > 0) {
      plantStructuredData.citation = plantProfileCitationLabels;
    }
  } else if (citationEntries.length > 0) {
    plantStructuredData.citation = citationEntries.map((entry) => entry.plain);
  }
  if (plantImageObject) {
    plantStructuredData.image = plantImageObject;
  }
  const plantWebPageData = (
    shouldRenderPlantWebPageData(relatedInsects) ||
    (!hasRelatedInsects && Boolean(indexablePlantProfile))
  )
    ? buildMetaWebPageData({
      url: plantPageUrl,
      title: plantTitle,
      description: plantDescription,
      inLanguage: 'ja',
      entityId: plantEntityId,
      imageObject: plantImageObject,
    })
    : null;
  const plantBreadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '昆虫植物図鑑', item: `${BASE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: '植物', item: `${BASE_ORIGIN}/plant/` },
      { '@type': 'ListItem', position: 3, name: displayPlantName, item: plantPageUrl },
    ],
  };
  const plantFaqInsectList = relatedInsects.slice(0, 5).map((insect) => insect.japaneseName).join('、');
  const plantFaqInsectSummary = relatedInsects.length > 5
    ? `${plantFaqInsectList}など${relatedInsects.length}種`
    : `${plantFaqInsectList}の${relatedInsects.length}種`;
  const shouldRenderPlantFaq = relatedInsects.length >= 5;
  const plantFaqItems = shouldRenderPlantFaq ? [
    {
      question: `${displayPlantName}につく虫は何種ありますか？`,
      answer: `昆虫植物図鑑の整理済みデータでは、${displayPlantName}を食草・寄主植物として利用する昆虫を${relatedInsects.length}種掲載しています。内訳は${plantTypeBreakdown || `計${relatedInsects.length}種`}です。`,
    },
    {
      question: `${displayPlantName}を食べる幼虫や昆虫を調べるには？`,
      answer: `${displayPlantName}を利用する昆虫として、このページでは${plantFaqInsectSummary}を掲載しています。各昆虫名から食草・分類・出典を確認できます。`,
    },
    {
      question: `${displayPlantName}の食草記録の出典はどこで確認できますか？`,
      answer: citationEntries.length > 0
        ? `このページの出典欄で、${displayPlantName}を利用する昆虫の食草・寄主植物情報に関係する文献やデータ出典を確認できます。`
        : `このページの関連昆虫リストと各昆虫ページを確認し、報告や同定に使う場合は元データの出典を確認してください。`,
    },
  ] : [];
  const plantFaqData = plantFaqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: plantFaqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null;
  const safePlantTitle = escapeRedirectHtml(plantTitle);
  const safePlantDescription = escapeRedirectHtml(plantDescription);
  const safePlantKeywords = escapeRedirectHtml(plantKeywords);
  const safePlantOgDescription = escapeRedirectHtml(plantOgDescription);
  const safePlantTwitterTitle = safePlantTitle;
  const safePlantImageAlt = escapeRedirectHtml(socialImageAlt);
  const safePlantPageUrl = escapeRedirectHtml(plantPageUrl);
  const safePlantActionPath = escapeRedirectHtml(plantActionPath);
  const safePlantHeaderActionLabel = escapeRedirectHtml(plantHeaderActionLabel);
  const safePlantFooterActionLabel = escapeRedirectHtml(plantFooterActionLabel);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${robotsContent}">
  ${GA_HEAD_TAGS}
  <!-- Google AdSense account verification -->
  <meta name="google-adsense-account" content="ca-pub-6982051533473293">
  ${DEFERRED_ADS_SCRIPT}
  <title>${safePlantTitle}</title>
  <meta name="description" content="${safePlantDescription}">
  <meta name="keywords" content="${safePlantKeywords}">
  <link rel="canonical" href="${safePlantPageUrl}">
  <link rel="alternate" hreflang="ja" href="${safePlantPageUrl}">
  ${enSlug ? `<link rel="alternate" hreflang="en" href="${BASE_ORIGIN}${buildPlantPath(safeCanonicalName, 'en')}">
  ` : ''}<link rel="alternate" hreflang="x-default" href="${safePlantPageUrl}">
  <link rel="stylesheet" href="${META_STYLE_PATH}">

  <!-- Open Graph -->
  <meta property="og:title" content="${safePlantTitle}">
  <meta property="og:description" content="${safePlantOgDescription}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${safePlantPageUrl}">
  <meta property="og:image" content="${socialImageUrl}">
  <meta property="og:image:alt" content="${safePlantImageAlt}">
  <meta property="og:site_name" content="昆虫植物図鑑">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safePlantTwitterTitle}">
  <meta name="twitter:description" content="${safePlantOgDescription}">
  <meta name="twitter:image" content="${socialImageUrl}">
  <meta name="twitter:image:alt" content="${safePlantImageAlt}">
  
  <!-- Enhanced Structured Data -->
  ${plantWebPageData ? `<script type="application/ld+json">${renderJsonLd(plantWebPageData)}</script>` : ''}
  <script type="application/ld+json">${renderJsonLd(plantStructuredData)}</script>
  <script type="application/ld+json">${renderJsonLd(plantBreadcrumbData)}</script>
  ${plantFaqData ? `<script type="application/ld+json">${renderJsonLd(plantFaqData)}</script>` : ''}
</head>
<body>
  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/" class="meta-site-logo" aria-label="昆虫植物図鑑 トップへ">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <img src="${SITE_LOGO_SRC}" width="28" height="28" alt="" decoding="async">
        </span>
        <span class="meta-site-logo-text">昆虫植物図鑑</span>
      </a>
      <a href="${safePlantActionPath}" class="meta-site-header-link">${safePlantHeaderActionLabel}</a>
    </div>
  </header>

  <div class="meta-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <ol>
        <li><a href="/">昆虫植物図鑑</a></li>
        <li><a href="/plant/">植物</a></li>
        <li aria-current="page">${displayPlantName}</li>
      </ol>
    </nav>

    <header class="meta-header">
      <h1>${displayPlantName}</h1>
      <h2>${hasRelatedInsects ? '食草植物の詳細情報' : `植物の${plantProfileTopicSummary}`}</h2>
    </header>

    ${hasRelatedInsects ? `
    <section class="quick-links">
      <h3>代表的な関連昆虫</h3>
      <ul>
        ${relatedInsects.slice(0, 3).map(insect => `
          <li><a href="${buildJapaneseInsectPath(insect, getInsectMetaRouteType(insect))}">${insect.japaneseName}</a>（${insect.scientificName}）</li>
        `).join('')}
      </ul>
    </section>` : ''}
    
    <main class="meta-content">
      <section class="basic-info">
        <h3>基本情報</h3>
        <dl>
          <dt>植物名</dt>
          <dd>${displayPlantName}</dd>
          ${plantFamily ? `
          <dt>科名</dt>
          <dd>${plantFamily}</dd>
          ` : ''}
          ${plantAliases.length > 0 ? `
          <dt>別名</dt>
          <dd>${plantAliases.join('、')}</dd>
          ` : ''}
          ${hasRelatedInsects ? `<dt>利用昆虫数</dt>
          <dd>${relatedInsects.length}種</dd>
          <dt>昆虫の種類</dt>
          <dd>
            ${Object.entries(insectsByType)
              .filter(([_type, insects]) => insects.length > 0)
              .map(([type, insects]) => `${typeNames[type]}: ${insects.length}種`)
              .join(', ')}
          </dd>` : ''}
        </dl>
      </section>

      ${plantImageFiles.length > 0 ? `
      <section class="image-gallery">
        <h3>${displayPlantName}の写真</h3>
        <div class="gallery-container">
          ${plantImageFiles.map(img => `
            <div class="gallery-item">
              <a href="${buildPlantResizedImageUrl(img)}" target="_blank" title="画像を拡大表示">
                ${buildPlantPictureHtml(img, `${displayPlantName}の写真 - ${img.replace(/\.[^/.]+$/, '')}`)}
              </a>
              <div class="image-caption">${img.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}</div>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}
      
      ${plantProfileHtml}
      ${hasRelatedInsects ? `
      <section class="description">
        <h3>生態系での役割</h3>
        <p>${displayPlantName}は、昆虫の食草として重要な役割を果たしている植物です。</p>
        <p>この植物を食草として利用する昆虫は${relatedInsects.length}種確認されており、生態系において多様な昆虫の生活を支える重要な植物資源となっています。</p>
        ${Object.entries(insectsByType)
          .filter(([_type, insects]) => insects.length > 0)
          .map(([type, insects]) => 
            `<p><strong>${typeNames[type]}</strong>では${insects.length}種が確認されており、${insects.slice(0, 3).map(i => `<a href=\"${buildJapaneseInsectPath(i, getInsectMetaRouteType(i))}\">${i.japaneseName}</a>`).join('、')}${insects.length > 3 ? 'などが' : 'が'}この植物を利用しています。</p>`
          ).join('')}
        ${citationListHtml ? `
        <h4>出典</h4>
        ${citationListHtml}` : ''}
      </section>` : `
      <section class="description plant-record-status">
        <h3>昆虫記録の掲載状況</h3>
        <p>当サイトの整理済み食草・寄主植物データでは、${escapeRedirectHtml(displayPlantName)}を利用する昆虫はまだ掲載していません。これは、この植物を利用する昆虫がいないことを示すものではありません。</p>
      </section>`}

      ${plantFaqItems.length > 0 ? `
      <section class="description">
        <h3>よくある疑問</h3>
        <dl>
          ${plantFaqItems.map((item) => `
          <dt>${escapeRedirectHtml(item.question)}</dt>
          <dd>${escapeRedirectHtml(item.answer)}</dd>`).join('')}
        </dl>
      </section>` : ''}
      
      ${hasRelatedInsects ? `<section class="related-insects">
        <h3>この植物を利用する昆虫（${relatedInsects.length}種）</h3>
        ${Object.entries(insectsByType)
          .filter(([_type, insects]) => insects.length > 0)
          .map(([type, insects]) => `
        <h4>${typeNames[type]}（${insects.length}種）</h4>
        <ul>
          ${insects.map(insect => `
          <li>
            <div class="insect-name">
              <a href="${buildJapaneseInsectPath(insect, getInsectMetaRouteType(insect))}">${insect.japaneseName}</a>
            </div>
            <div class="insect-scientific">${formatScientificNameHTML(insect.scientificName)}</div>
          </li>`).join('')}
        </ul>`).join('')}
	      </section>` : ''}
	      ${renderManualAdSlot(MANUAL_AD_SLOTS.detail)}
	    </main>
	    
	    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
      <a href="${safePlantActionPath}" class="detail-link">${safePlantFooterActionLabel}</a>
    </section>
    ${renderAmazonAssociatesDisclosureHtml(citationEntries)}
  </div>
  
  <script>
    // Progressive enhancement
    (function() {
      // 外部リンクの処理
      const externalLinks = document.querySelectorAll('a[href^="http"]');
      externalLinks.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
      
      // 昆虫リンクのハイライト効果
      const insectLinks = document.querySelectorAll('.related-insects a');
      insectLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
          this.closest('li').style.backgroundColor = '#e8f5e8';
        });
        link.addEventListener('mouseleave', function() {
          this.closest('li').style.backgroundColor = '';
        });
      });
    })();
  </script>
</body>
</html>`;
}

// メインの生成処理
async function generateMetaPages() {
  console.log('メタページ生成を開始します...');

  // 先に必須CSVの存在を確認（欠損時に既存メタページを消さない）
  // 正規化データを正とし、public 側は完全な代替ソースとしてのみ使う
  const insectsCsvPath = pickFirstExistingPath([
    path.join(__dirname, '../normalized_data/insects.csv'),
    path.join(__dirname, '../public/insects.csv'),
  ]);
  const hostplantsCsvPath = pickFirstExistingPath([
    path.join(__dirname, '../normalized_data/hostplants.csv'),
    path.join(__dirname, '../public/hostplants.csv'),
  ]);
  const generalNotesCsvPath =
    pickFirstExistingPath([
      path.join(__dirname, '../normalized_data/general_notes.csv'),
      path.join(__dirname, '../public/general_notes.csv'),
    ]) ||
    findLatestBackupPath(
      path.join(__dirname, '../normalized_data'),
      'general_notes.csv.bak.',
    );

  const requiredCsvs = [
    { label: 'insects', path: insectsCsvPath },
    { label: 'hostplants', path: hostplantsCsvPath },
  ];
  const missingRequiredCsvs = requiredCsvs.filter((item) => !item.path);
  if (missingRequiredCsvs.length > 0) {
    console.error('[meta] 必須CSVが見つからないため、メタページ生成を中止します。');
    missingRequiredCsvs.forEach((item) => {
      console.error(`  - ${item.label}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log(`[meta] insects CSV: ${insectsCsvPath}`);
  console.log(`[meta] hostplants CSV: ${hostplantsCsvPath}`);
  if (generalNotesCsvPath) {
    console.log(`[meta] general_notes CSV: ${generalNotesCsvPath}`);
  } else {
    console.warn('[meta] general_notes CSV が見つからないため、一般備考なしで生成します。');
  }
  
  // 出力ディレクトリを作成
  const metaDir = path.join(__dirname, '../public/meta');
  // 既存のカスタムページ（*-support-test.html）を退避しておき、生成後に復元する
  const preserveMap = new Map();
  try {
    META_SECTION_KEYS.forEach(type => {
      const typeDir = path.join(metaDir, type);
      const preserve = [];
      if (fs.existsSync(typeDir)) {
        try {
          for (const f of fs.readdirSync(typeDir)) {
            if (f.endsWith('-support-test.html')) {
              const p = path.join(typeDir, f);
              try {
                preserve.push({ name: f, content: fs.readFileSync(p, 'utf-8') });
              } catch {}
            }
          }
        } catch {}
      }
      preserveMap.set(type, preserve);
    });
  } catch (e) {
    console.warn('preserve custom meta pages warn:', e.message || e);
  }
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }
  const publicDir = path.join(__dirname, '../public');
  const legacyRouteSegments = [...META_SECTION_KEYS, 'plant'];
  legacyRouteSegments.forEach((segment) => {
    const routeDir = path.join(publicDir, segment);
    if (fs.existsSync(routeDir)) {
      fs.rmSync(routeDir, { recursive: true, force: true });
    }
  });
  const legacyRedirects = new Map();
  let legacyRedirectConflicts = 0;
  let legacyRedirectWriteSkips = 0;
  const queueLegacyRedirect = (
    routePath,
    targetPath,
    title,
    lang = 'ja',
    redirectKind = '',
  ) => {
    if (!routePath || !targetPath) return;
    const normalizedRoutePath = String(routePath).replace(/\/{2,}/g, '/');
    const targetUrl = targetPath.startsWith('http') ? targetPath : `${BASE_ORIGIN}${targetPath}`;
    const existing = legacyRedirects.get(normalizedRoutePath);
    if (existing && existing.targetUrl !== targetUrl) {
      legacyRedirectConflicts++;
      return;
    }
    if (existing && redirectKind && !existing.redirectKind) {
      legacyRedirects.set(normalizedRoutePath, { ...existing, redirectKind });
      return;
    }
    if (!existing) {
      legacyRedirects.set(normalizedRoutePath, { targetUrl, title, lang, redirectKind });
    }
  };
  const queueInsectLegacyRedirects = ({ type, insectId, displayName, targetPath, title }) => {
    const runtimeRoute = runtimeInsectRouteById.get(insectId);
    const routeEntries = [
      runtimeRoute,
      runtimeRoute?.legacyName
        ? { type: runtimeRoute.type, name: runtimeRoute.legacyName }
        : null,
      { type, name: displayName || insectId },
    ].filter((entry) => entry?.type && entry?.name);
    const seenRoutes = new Set();
    for (const routeEntry of routeEntries) {
      const legacySlug = buildLegacyInsectSlug(routeEntry.name, insectId);
      const routePath = `/${routeEntry.type}/${legacySlug}/index.html`;
      if (seenRoutes.has(routePath)) continue;
      seenRoutes.add(routePath);
      queueLegacyRedirect(routePath, targetPath, title);
    }
  };
  
  META_SECTION_KEYS.forEach(type => {
    const typeDir = path.join(metaDir, type);
    if (fs.existsSync(typeDir)) {
      // 古いファイルを削除して再生成に備える
      fs.rmSync(typeDir, { recursive: true, force: true });
    }
    fs.mkdirSync(typeDir, { recursive: true });
  });
  
  // 英語メタページが既に生成済みの場合、id→enSlug マップを構築
  const { insectIdToEnSlug, plantNameToEnSlug } = buildEnglishSlugMaps();
  console.log(`[meta] 英語スラグマップ: 昆虫${insectIdToEnSlug.size}件、植物${plantNameToEnSlug.size}件`);

  try {
    // 植物の画像一覧を取得
    const plantImagesDir = path.join(__dirname, '../public/images/plants');
    const allPlantImages = fs.existsSync(plantImagesDir) 
      ? fs.readdirSync(plantImagesDir).filter(file =>
          /\.jpe?g|\.png|\.gif|\.webp$/i.test(file)
        )
      : [];
    console.log(`${allPlantImages.length}件の植物画像を読み込みました。`);

    // 正規化された3つのCSVファイルを読み込み
    const insectsData = loadCSV(insectsCsvPath);
    const hostplantsDataRaw = loadCSV(hostplantsCsvPath);
    const hostplantsData = hostplantsDataRaw.filter((row) => !SUSPICIOUS_PLANT_NAME_SET.has((row.plant_name || '').trim()));
    const filteredHostplants = hostplantsDataRaw.length - hostplantsData.length;
    if (filteredHostplants > 0) {
      console.warn(`[meta] filtered suspicious hostplant rows: ${filteredHostplants}`);
    }
    const generalNotesData = generalNotesCsvPath ? loadCSV(generalNotesCsvPath) : [];
    
    // バタフライとハムシの従来データも読み込み
    const butterflyData = loadCSVOptional(path.join(__dirname, '../public/butterfly_host.csv'));
    const hamushiData = loadCSVOptional(path.join(__dirname, '../public/hamushi_integrated_master.csv'));
    
    // 昆虫IDをキーとした食草マップを作成
    const hostPlantsMapByInsectId = new Map();
    hostplantsData.forEach(row => {
      const insectId = row.insect_id;
      const plantName = row.plant_name;
      const plantFamily = normalizePlantFamilyLabel(row.plant_family || '');
      const observationType = row.observation_type || '野外（国内）';
      const resourceType = getHostResourceType(plantName);
      const plantPart = row.plant_part || (resourceType === 'substrate' ? '' : '葉');
      const lifeStage = row.life_stage || '幼虫';
      const reference = row.reference || '';
      const notes = getPublicHostPlantNote(row.notes || '');
      
      if (insectId && plantName) {
        if (!hostPlantsMapByInsectId.has(insectId)) {
          hostPlantsMapByInsectId.set(insectId, []);
        }
        
        // 植物名に科名を付加（必要に応じて）
        let displayPlantName = plantName;
        if (plantFamily && !plantName.includes('(') && !plantName.includes('（')) {
          displayPlantName = `${plantName}(${plantFamily})`;
        }
        
        hostPlantsMapByInsectId.get(insectId).push({
          name: plantName,
          family: plantFamily,
          displayName: displayPlantName,
          observationType,
          plantPart,
          lifeStage,
          reference,
          notes,
          isDetailed: true,
          resourceType
        });
      }
    });
    
    // 昆虫IDをキーとした一般備考マップを作成
    const generalNotesMapByInsectId = new Map();
    generalNotesData.forEach(row => {
      const insectId = row.insect_id;
      const noteType = row.note_type;
      const content = row.content;
      const reference = row.reference || '';
      const page = row.page || '';
      const year = row.year || '';
      
      if (insectId && content) {
        if (!generalNotesMapByInsectId.has(insectId)) {
          generalNotesMapByInsectId.set(insectId, []);
        }
        generalNotesMapByInsectId.get(insectId).push({
          type: noteType,
          content,
          reference,
          page,
          year
        });
      }
    });
    
    // 成虫出現時期データは general_notes のみ使用
    const emergenceTimeMap = new Map();
    const addEmergenceFromRow = (nameJP, nameSci, time) => {
      const j = (nameJP || '').trim();
      const s = (nameSci || '').trim();
      const t = (time || '').trim();
      if (!t || t === '不明') return;
      if (j) emergenceTimeMap.set(j, t);
      if (s) {
        emergenceTimeMap.set(s, t);
        const cleaned = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (cleaned && cleaned !== s) emergenceTimeMap.set(cleaned, t);
      }
    };
    // general_notesから出現時期タイプのレコードをemergenceTimeMapに投入
    const emergenceTypes = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期'];
    generalNotesData.forEach(row => {
      const noteType = (row.note_type || '').trim();
      const content = (row.content || '').trim();
      if (!content || content === '不明') return;
      const isEmergence = emergenceTypes.some(k => noteType.includes(k))
        || (!noteType && /\d+\s*月|春|夏|秋|冬|上旬|中旬|下旬|頃/.test(content));
      if (!isEmergence) return;
      const insectId = (row.insect_id || '').trim();
      const insect = insectsData.find(r => r.insect_id === insectId);
      if (insect) {
        addEmergenceFromRow(insect.japanese_name, insect.scientific_name, content);
      }
    });
    console.log(`成虫出現時期データを${emergenceTimeMap.size}件読み込みました（general_notesのみ）`);
    
    // 昆虫データの処理（正規化データを使用）
    let mothCount = 0;
    let butterflyCountFromInsects = 0;
    let beetleCountFromInsects = 0;
    let longhornbeetleCountFromInsects = 0;
    let barkbeetleCountFromInsects = 0;
    let leafbeetleCountFromInsects = 0;
    let aphidCountFromInsects = 0;
    const hostPlantsMap = new Map();
    // 植物基底名（科名を除いたキー）-> 科名。本文の属性表示と科別インデックスに使う。
    const plantFamilyByKey = new Map();
    // 種ページは hostPlantsMap が全ループで完成してから2パス目で書き出す（共起昆虫の相互リンクのため）
    const insectPageQueue = [];

    // e.g. "1758)" / "[1799])" / "1978"
    const looksLikeYearOnly = (value = '') => /^[\[(（]?\s*\d{3,4}\s*[\])）)]*\s*$/.test(String(value || '').trim());
    
    insectsData.forEach((row) => {
      const insectId = row.insect_id;
      let japaneseName = normalizeJapaneseInsectName(row.japanese_name);
      const scientificName = (row.scientific_name || '').trim();
      const familyJapanese = row.family_jp || row.family || '';
      const subfamily = row.subfamily_jp || row.subfamily || '';
      const _genus = row.genus || '';
      const _species = row.species || '';
      const _author = row.author || '';
      const _year = row.year || '';
      const notes = getPublicHostPlantSectionNote(row.notes || '');
      const alternativeNames = combineInsectAlternativeNames(row);
      const synonyms = row.synonyms || '';
      
    if (!insectId) return;
    // Skip malformed IDs like "species-" (missing suffix)
    if (/^species-$/.test(insectId)) return;

      // 年号だけが和名欄に混入するケース（例: "1758)"）は無効として扱う
      if (looksLikeYearOnly(japaneseName) || japaneseName.length < 2) {
        japaneseName = '';
      }
      const displayName = japaneseName || scientificName;
      if (!displayName) return;
      
      // プレースホルダーや無効な昆虫名を除外
      if (displayName === '和名' || displayName === '種名' || displayName === '不明' || displayName.trim().length < 2) {
        return;
      }
      
      // 食草データを取得
      const insectHostPlants = hostPlantsMapByInsectId.get(insectId) || [];
      const hostPlantsString = insectHostPlants.map(hp => hp.displayName).join('; ') || '不明';
      
      // 一般備考データを取得
      const generalNotes = generalNotesMapByInsectId.get(insectId) || [];
      
      // 種ページのタイプ判定（科ベース）
      const famLatin = (row.family || '').trim();
      const famJP = (row.family_jp || '').trim();
      const isButterfly = /チョウ科$/.test(famJP) || /^(Papilionidae|Pieridae|Lycaenidae|Nymphalidae|Hesperiidae|Riodinidae)$/.test(famLatin);
      const isLeafBeetle = famJP.includes('ハムシ') || famLatin === 'Chrysomelidae' || famLatin === 'Megalopodidae';
      const isLonghornBeetle = famJP === 'カミキリムシ科' || famLatin === 'Cerambycidae';
      const isBarkBeetle =
        (row.subfamily || '').trim() === 'Scolytinae' ||
        (row.subfamily_jp || '').includes('キクイムシ');
      const isBeetle = famJP === 'タマムシ科' || famLatin === 'Buprestidae';
      const isAphid = famJP.includes('アブラムシ') || famLatin === 'Aphididae';
      const type = isButterfly
        ? 'butterfly'
        : (isBarkBeetle
          ? 'barkbeetle'
          : (isLeafBeetle
          ? 'leafbeetle'
          : (isLonghornBeetle
            ? 'longhornbeetle'
            : (isBeetle
              ? 'beetle'
              : (isAphid ? 'aphid' : 'moth')))));
      
      // 成虫出現時期の検索（外部CSV→general_notesの順にフォールバック）
      let emergenceTime = emergenceTimeMap.get(japaneseName) || 
                           emergenceTimeMap.get(scientificName) ||
                           emergenceTimeMap.get(scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim()) ||
                           null;
      if (!emergenceTime) {
        // general_notes から抽出
        const isEmergenceNote = (note) => {
          const t = (note?.type || '').trim();
          const c = (note?.content || '').trim();
          if (!c || c === '不明') return false;
          const typeHit = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期']
            .some(k => t.includes(k));
          const contentHit = /\d+\s*月|春|夏|秋|冬|上旬|中旬|下旬|頃/.test(c);
          return typeHit || (!t && contentHit);
        };
        const gn = (generalNotes || []).find(isEmergenceNote);
        if (gn) emergenceTime = gn.content;
      }
      
      const insect = {
        id: insectId,
        name: displayName,
        japaneseName: displayName,
        scientificName: scientificName,
        hostPlants: hostPlantsString,
        hostPlantsDetailed: insectHostPlants,
        generalNotes: generalNotes,
        source: '',
        remarks: notes,
        alternativeNames: alternativeNames,
        synonyms: synonyms,
        emergenceTime: emergenceTime,
        scientificFilename: (() => {
          // Extract binomial name (genus + species) from scientific name for filename
          const binomialMatch = scientificName.match(/^([A-Z][a-z]+)\s+([a-z]+)/);
          const binomialName = binomialMatch ? `${binomialMatch[1]} ${binomialMatch[2]}` : scientificName;
          return binomialName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_(),]/g, '');
        })(),
        family: familyJapanese,
        familyJapanese: familyJapanese,
        subfamily: subfamily,
        type: type
      };
      
      const enSlugEntry = insectIdToEnSlug.get(insectId);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      insectPageQueue.push({ insect, type, enSlugEntry, filename });
      queueInsectLegacyRedirects({
        type,
        insectId,
        displayName,
        targetPath: `/meta/${type}/${insectId}.html`,
        title: `${displayName || insectId} | 昆虫植物図鑑`,
      });
      if (type === 'moth') mothCount++;
      else if (type === 'butterfly') butterflyCountFromInsects++;
      else if (type === 'beetle') beetleCountFromInsects++;
      else if (type === 'longhornbeetle') longhornbeetleCountFromInsects++;
      else if (type === 'barkbeetle') barkbeetleCountFromInsects++;
      else if (type === 'leafbeetle') leafbeetleCountFromInsects++;
      else if (type === 'aphid') aphidCountFromInsects++;
      
      // 食草マップに追加（植物ページ生成用）。
      // キーは科名を除いた基底名に統一し、同名植物（例「サクラ」と「サクラ(バラ科)」）を
      // 1つの正規ページに統合する。科名は plantFamilyByKey に退避し本文属性として表示する。
      insectHostPlants.forEach(hostPlant => {
        const key = plantPageKey(hostPlant.displayName);
        if (isValidPlantName(key)) {
          if (!hostPlantsMap.has(key)) {
            hostPlantsMap.set(key, []);
          }
          hostPlantsMap.get(key).push(insect);
          const fam = normalizePlantFamilyLabel(hostPlant.family || '') || extractPlantFamilySuffix(normalizePlantName(hostPlant.displayName));
          if (fam && !plantFamilyByKey.has(key)) plantFamilyByKey.set(key, fam);
        }
      });
    });
    
    // バタフライデータの処理（従来通り）
    let butterflyCount = butterflyCountFromInsects;
    
    butterflyData.forEach((row, index) => {
      const japaneseName = row['和名'];
      const genus = row['属'];
      const species = row['種小名'];
      const familyJapanese = row['科'] || '';
      const author = ''; // バタフライCSVには著者情報なし
      const year = ''; // バタフライCSVには年情報なし
      let hostPlants = row['食草'] || '不明';
      
      if (!japaneseName || !genus || !species) {
        return;
      }
      
      // 学名を構築（バタフライCSVには著者・年情報なし）
      const scientificName = `${genus} ${species}`;
      
      const insectId = `butterfly-csv-${index}`;
      const type = 'butterfly';
      
      const insect = {
        id: insectId,
        japaneseName,
        scientificName,
        family: familyJapanese,
        hostPlants,
        type,
        genus,
        species,
        author,
        year
      };
      
      
      const enSlugEntryB = insectIdToEnSlug.get(insectId);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      insectPageQueue.push({ insect, type, enSlugEntry: enSlugEntryB, filename });
      queueInsectLegacyRedirects({
        type,
        insectId,
        displayName: japaneseName,
        targetPath: `/meta/${type}/${insectId}.html`,
        title: `${japaneseName || insectId} | 昆虫植物図鑑`,
      });
      butterflyCount++;

      if (hostPlants && hostPlants !== '不明') {
        // 「(以上...科)」パターンを処理
        let processedHostPlants = hostPlants;
        const familySuffixMatch = hostPlants.match(/[\(（]以上([^)）]+科)[\)）]$/);
        if (familySuffixMatch) {
          const familyName = familySuffixMatch[1];
          // 「(以上...科)」を一旦削除
          const plantsWithoutSuffix = hostPlants.replace(/\s*[\(（]以上[^)）]+[\)）]$/, '');
          // 各植物に科名を追加
          const plantsList = plantsWithoutSuffix.split(/[、,，;；]/).map(p => p.trim()).filter(p => p);
          processedHostPlants = plantsList.map(p => {
            // すでに科名がついている場合はそのまま
            if (p.includes('科)') || p.includes('科）')) {
              return p;
            }
            return `${p}(${familyName})`;
          }).join('; ');
        }
        
        const plants = [...new Set(processedHostPlants.split(/[、,，;；]/).map(p => p.trim()).filter(p => p && p !== '' && p !== '不明'))];
        plants.forEach(plant => {
          const key = plantPageKey(plant);
          if (isValidPlantName(key)) {
            if (!hostPlantsMap.has(key)) {
              hostPlantsMap.set(key, []);
            }
            hostPlantsMap.get(key).push(insect);
            const fam = extractPlantFamilySuffix(normalizePlantName(plant));
            if (fam && !plantFamilyByKey.has(key)) plantFamilyByKey.set(key, fam);
          }
        });
      }
    });
    
    // ハムシデータの処理（従来通り）
    let beetleCount = beetleCountFromInsects;
    let longhornbeetleCount = longhornbeetleCountFromInsects;
    const barkbeetleCount = barkbeetleCountFromInsects;
    let leafbeetleCount = leafbeetleCountFromInsects;
    let aphidCount = aphidCountFromInsects;
    
    hamushiData.forEach((row, index) => {
      const id = row['大図鑑カタログNo'] || row['ID'] || row['id'] || '';
      const japaneseName = row['和名'] || '';
      const scientificName = row['学名'] || '';
      const family = row['科和名'] || row['科'] || 'ハムシ科';
      const subfamily = row['亜科和名'] || row['亜科'] || '';
      const hostPlants = row['食草'] || row['寄主植物'] || '不明';
      const remarks = row['備考'] || '';
      
      if (!japaneseName && !scientificName) {
        return;
      }
      
      // IDがある場合はそれを使い、ない場合はインデックスベースで生成
      const insectId = id ? id.replace(/^H/, 'leafbeetle-') : `leafbeetle-${index}`;
      const type = 'leafbeetle';
      
      const insect = {
        id: insectId,
        japaneseName,
        scientificName,
        family,
        subfamily,
        hostPlants,
        remarks,
        type,
        source: 'ハムシハンドブック'
      };
      
      const enSlugEntryH = insectIdToEnSlug.get(insectId);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      insectPageQueue.push({ insect, type, enSlugEntry: enSlugEntryH, filename });
      queueInsectLegacyRedirects({
        type,
        insectId,
        displayName: japaneseName,
        targetPath: `/meta/${type}/${insectId}.html`,
        title: `${japaneseName || insectId} | 昆虫植物図鑑`,
      });
      leafbeetleCount++;
      
      if (hostPlants && hostPlants !== '不明') {
        // 「(以上...科)」パターンを処理
        let processedHostPlants = hostPlants;
        const familySuffixMatch = hostPlants.match(/[\(（]以上([^)）]+科)[\)）]$/);
        if (familySuffixMatch) {
          const familyName = familySuffixMatch[1];
          // 「(以上...科)」を一旦削除
          const plantsWithoutSuffix = hostPlants.replace(/\s*[\(（]以上[^)）]+[\)）]$/, '');
          // 各植物に科名を追加
          const plantsList = plantsWithoutSuffix.split(/[、,，;；]/).map(p => p.trim()).filter(p => p);
          processedHostPlants = plantsList.map(p => {
            // すでに科名がついている場合はそのまま
            if (p.includes('科)') || p.includes('科）')) {
              return p;
            }
            return `${p}(${familyName})`;
          }).join('; ');
        }
        
        const plants = [...new Set(processedHostPlants.split(/[、,，;；]/).map(p => p.trim()).filter(p => p && p !== '' && p !== '不明'))];
        plants.forEach(plant => {
          const key = plantPageKey(plant);
          if (isValidPlantName(key)) {
            if (!hostPlantsMap.has(key)) {
              hostPlantsMap.set(key, []);
            }
            hostPlantsMap.get(key).push(insect);
            const fam = extractPlantFamilySuffix(normalizePlantName(plant));
            if (fam && !plantFamilyByKey.has(key)) plantFamilyByKey.set(key, fam);
          }
        });
      }
    });
    
    // 2パス目: hostPlantsMap が全ループで完成した後に種ページを書き出す。
    // 「同じ食草を利用する他の昆虫」を相互リンクし、各ページの内容を厚くする。
    console.log(`[meta] 種ページを書き出します（共起昆虫リンク付き）: ${insectPageQueue.length}件`);
    const plantPageNames = collectPlantPageNames(hostPlantsMap, plantDetailIndex);
    const resolvePlantMetaTarget = createPlantMetaTargetResolver({
      plantDetails: plantDetailIndex,
      pageNames: plantPageNames,
    });
    insectPageQueue.forEach(({ insect, type, enSlugEntry, filename }) => {
      const html = generateInsectHTML(
        insect,
        type,
        enSlugEntry,
        hostPlantsMap,
        resolvePlantMetaTarget,
      );
      fs.writeFileSync(filename, html);
    });

    // 分類統合で削除した旧IDの静的URLを、正本ページへ恒久転送する。
    // 既存の被リンクやブックマークを404にせず、重複ページも再生成しない。
    const insectPageById = new Map(
      insectPageQueue.map(({ insect, type }) => [insect.id, { insect, type }]),
    );
    const mergedTaxonRedirects = loadMergedTaxonRedirects({
      kamikiriPath: KAMIKIRI_AUDIT_PATH,
      leafBeetlePath: LEAF_BEETLE_CANONICAL_AUDIT_PATH,
      butterflyPath: BUTTERFLY_CANONICAL_AUDIT_PATH,
    });
    for (const redirect of mergedTaxonRedirects) {
      const canonical = insectPageById.get(redirect.canonicalId);
      if (!canonical) {
        throw new Error(
          `[meta] merged taxon target is missing: ${redirect.duplicateId} -> ${redirect.canonicalId}`,
        );
      }
      if (insectPageById.has(redirect.duplicateId)) {
        throw new Error(`[meta] merged duplicate still has a canonical page: ${redirect.duplicateId}`);
      }

      const targetPath = `/meta/${canonical.type}/${redirect.canonicalId}.html`;
      const targetUrl = `${BASE_ORIGIN}${targetPath}`;
      const cleanTargetPath = buildJapaneseInsectPath(canonical.insect, canonical.type);
      const title = `${redirect.legacyDisplayName} | 昆虫植物図鑑`;
      const duplicateOutputPath = path.join(
        __dirname,
        `../public/meta/${canonical.type}/${redirect.duplicateId}.html`,
      );
      fs.writeFileSync(duplicateOutputPath, buildLegacyRedirectHtml({
        lang: 'ja',
        title,
        targetUrl,
        noindex: false,
        redirectKind: 'taxonomy-merge',
      }));

      const canonicalRouteNames = new Set([
        canonical.insect.routeName,
        canonical.insect.name,
        canonical.insect.japaneseName,
      ].map((value) => String(value || '').trim()).filter(Boolean));
      for (const legacyName of new Set([
        redirect.legacyDisplayName,
        redirect.legacyRouteName,
        redirect.legacyJapaneseName,
        redirect.duplicateJapaneseName,
        redirect.sourceJapaneseName,
      ].filter((name) => name && !canonicalRouteNames.has(String(name).trim())))) {
        queueLegacyRedirect(
          `/${canonical.type}/${buildLegacyInsectSlug(legacyName, redirect.duplicateId)}/index.html`,
          cleanTargetPath,
          title,
          'ja',
          'taxonomy-merge',
        );
      }
    }

    // 植物ページを生成
    let plantCount = 0;
    let skippedPlants = 0;
    plantPageNames.forEach((plantName) => {
      const insects = hostPlantsMap.get(plantName) || [];
      if (!isValidPlantName(plantName)) {
        console.log(`スキップ: 無効な植物名 '${plantName}'`);
        skippedPlants++;
        return;
      }
      plantCount++;
      const safePlantName = plantName.replace(/[/\\?%*:|"<>]/g, '-');
      const plantEnSlug = plantNameToEnSlug.get(safePlantName) || null;
      const plantFamily = plantFamilyByKey.get(plantName) || getPlantDetailForMeta(plantName)?.family || '';
      const html = generatePlantHTML(plantName, insects, allPlantImages, null, plantEnSlug, plantFamily);
      const filename = path.join(__dirname, `../public/meta/plant/${safePlantName}.html`);
      fs.writeFileSync(filename, html);
      queueLegacyRedirect(
        `/plant/${encodeURIComponent(plantName)}/index.html`,
        `/meta/plant/${encodeURIComponent(safePlantName)}.html`,
        `${plantName} | 昆虫植物図鑑`,
      );

      // 旧「植物名(科名).html」URL（統合前に分裂ページとして生成・被リンクされていた分）を、
      // 新しい基底名ページへ noindex+canonical のリダイレクトHTMLで寄せ、既存の
      // インデックス・被リンクを失わせない。ファイル名は旧実ページと同じ生（未エンコード）表記。
      if (plantFamily) {
        const legacyWithFamily = `${plantName}(${plantFamily})`;
        const safeLegacy = legacyWithFamily.replace(/[/\\?%*:|"<>]/g, '-');
        if (safeLegacy !== safePlantName) {
          const legacyFilename = path.join(__dirname, `../public/meta/plant/${safeLegacy}.html`);
          fs.writeFileSync(legacyFilename, buildLegacyRedirectHtml({
            lang: 'ja',
            title: `${plantName} | 昆虫植物図鑑`,
            // canonicalは絶対URL必須（相対だとSEO監査が失敗し、クローラにも曖昧）
            targetUrl: `${BASE_ORIGIN}/plant/${encodeURIComponent(plantName)}/`,
          }));
        }
      }
    });

    // 削除前の /guides/plants/*.html へ今も入ってくる検索・外部リンク流入を、
    // 同じ植物の現行 canonical ページへ一対一で回収する。0秒 meta refresh は
    // GitHub Pages のようにHTTP 301を設定できない環境でGoogleが恒久移転として扱う。
    const legacyGuidePlantDir = path.join(publicDir, 'guides', 'plants');
    const legacyEnglishGuidePlantDir = path.join(publicDir, 'en', 'guides', 'plants');
    fs.rmSync(legacyGuidePlantDir, { recursive: true, force: true });
    fs.rmSync(legacyEnglishGuidePlantDir, { recursive: true, force: true });
    ensureDir(legacyGuidePlantDir);
    ensureDir(legacyEnglishGuidePlantDir);
    let legacyGuideRedirectCount = 0;
    let legacyGuideRedirectSkips = 0;

    const writePermanentGuideRedirect = ({ outputPath, lang, title, targetPath, verifyTarget = true }) => {
      const targetFile = path.join(publicDir, ...decodeURIComponent(targetPath).replace(/^\//, '').split('/'));
      if (verifyTarget && !fs.existsSync(targetFile)) {
        legacyGuideRedirectSkips++;
        console.warn(`[meta] legacy guide target missing: ${targetPath}`);
        return;
      }
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, buildLegacyRedirectHtml({
        lang,
        title,
        targetUrl: `${BASE_ORIGIN}${targetPath}`,
        noindex: false,
      }));
      legacyGuideRedirectCount++;
    };

    for (const [legacySlug, plantName] of LEGACY_TRAFFIC_GUIDE_PLANTS) {
      const safePlantName = plantName.replace(/[/\\?%*:|"<>]/g, '-');
      writePermanentGuideRedirect({
        outputPath: path.join(legacyGuidePlantDir, `${legacySlug}.html`),
        lang: 'ja',
        title: `${plantName}につく虫 | 昆虫植物図鑑`,
        targetPath: `/plant/${encodeURIComponent(plantName)}/`,
        verifyTarget: false,
      });

      const englishSlug = plantNameToEnSlug.get(safePlantName);
      if (englishSlug) {
        writePermanentGuideRedirect({
          outputPath: path.join(legacyEnglishGuidePlantDir, `${legacySlug}.html`),
          lang: 'en',
          title: `${plantName} host-plant insects | Insects and Host Plants of Japan`,
          targetPath: `/en/plant/${encodeURIComponent(plantName)}/`,
          verifyTarget: false,
        });
      }
    }

    writePermanentGuideRedirect({
      outputPath: path.join(legacyGuidePlantDir, 'index.html'),
      lang: 'ja',
      title: '植物から昆虫を探す | 昆虫植物図鑑',
      targetPath: '/plant/',
      verifyTarget: false,
    });
    writePermanentGuideRedirect({
      outputPath: path.join(publicDir, 'guides', 'host-plant-search.html'),
      lang: 'ja',
      title: '食草・寄主植物から昆虫を探す | 昆虫植物図鑑',
      targetPath: '/plant/',
      verifyTarget: false,
    });
    // GA4で現在も実流入を確認した旧カテゴリURL。削除済みの量産本文は
    // 復元せず、現行の植物一覧へ恒久移転して404流入を回収する。
    writePermanentGuideRedirect({
      outputPath: path.join(publicDir, 'guides', 'categories', 'vegetables.html'),
      lang: 'ja',
      title: '野菜につく虫・幼虫 | 昆虫植物図鑑',
      targetPath: '/plant/',
      verifyTarget: false,
    });

    legacyRedirects.forEach(({ targetUrl, title, lang, redirectKind }, routePath) => {
      try {
        const outputPath = routePathToOutputPath(publicDir, routePath);
        ensureDir(path.dirname(outputPath));
        fs.writeFileSync(outputPath, buildLegacyRedirectHtml({
          lang,
          title,
          targetUrl,
          noindex: false,
          redirectKind,
        }));
      } catch (error) {
        legacyRedirectWriteSkips++;
        console.warn(`[meta] legacy redirect skipped: ${routePath} (${error.code || error.message})`);
      }
    });
    
    console.log(`メタページ生成完了:`);
    console.log(`- 蛾: ${mothCount}種`);
    console.log(`- 蝶: ${butterflyCount}種`);
    console.log(`- タマムシ: ${beetleCount}種`);
    console.log(`- カミキリムシ: ${longhornbeetleCount}種`);
    console.log(`- キクイムシ: ${barkbeetleCount}種`);
    console.log(`- ハムシ: ${leafbeetleCount}種`);
    console.log(`- アブラムシ: ${aphidCount}種`);
    console.log(`- 食草: ${plantCount}種`);
    console.log(`- レガシールート redirect: ${legacyRedirects.size}件`);
    console.log(`- 統合分類群ID redirect: ${mergedTaxonRedirects.length}件`);
    console.log(`- 実流入ガイド redirect: ${legacyGuideRedirectCount}件`);
    if (skippedPlants > 0) {
      console.log(`- スキップされた無効な植物: ${skippedPlants}件`);
    }
    if (legacyRedirectConflicts > 0) {
      console.warn(`[meta] レガシールート競合をスキップ: ${legacyRedirectConflicts}件`);
    }
    if (legacyRedirectWriteSkips > 0) {
      console.warn(`[meta] レガシールート書き出しをスキップ: ${legacyRedirectWriteSkips}件`);
    }
    if (legacyGuideRedirectSkips > 0) {
      console.warn(`[meta] 実流入ガイド redirect をスキップ: ${legacyGuideRedirectSkips}件`);
    }
    
  // 画像ファイルリストを生成
  generateImageFileLists();

  // メタページのインデックスを生成（内部リンク強化・クロール補助）
  // 生成済みのデータを渡して全種リスト入りインデックスを作る
  try {
    // 昆虫カテゴリ別の科別グループを構築
    const insectIndexData = {};
    insectsData.forEach((row) => {
      const insectId = (row.insect_id || '').trim();
      if (!insectId || /^species-$/.test(insectId)) return;
      let japaneseName = normalizeJapaneseInsectName(row.japanese_name);
      if (looksLikeYearOnly(japaneseName) || japaneseName.length < 2) japaneseName = '';
      const displayName =
        japaneseName ||
        (row.scientific_name || '').trim();
      if (!displayName || displayName.length < 2) return;
      const famJP = (row.family_jp || '').trim();
      const famLatin = (row.family || '').trim();
      const isBfly =
        /チョウ科$/.test(famJP) ||
        /^(Papilionidae|Pieridae|Lycaenidae|Nymphalidae|Hesperiidae|Riodinidae)$/.test(famLatin);
      const isLB =
        famJP.includes('ハムシ') ||
        famLatin === 'Chrysomelidae' ||
        famLatin === 'Megalopodidae';
      const isLHB = famJP === 'カミキリムシ科' || famLatin === 'Cerambycidae';
      const isBB =
        (row.subfamily || '').trim() === 'Scolytinae' ||
        (row.subfamily_jp || '').includes('キクイムシ');
      const isBtl = famJP === 'タマムシ科' || famLatin === 'Buprestidae';
      const isAph =
        famJP.includes('アブラムシ') || famLatin === 'Aphididae';
      const insType = isBfly
        ? 'butterfly'
        : isBB
        ? 'barkbeetle'
        : isLB
        ? 'leafbeetle'
        : isLHB
        ? 'longhornbeetle'
        : isBtl
        ? 'beetle'
        : isAph
        ? 'aphid'
        : 'moth';
      const familyLabel = famJP || famLatin || '不明';
      if (!insectIndexData[insType]) insectIndexData[insType] = {};
      if (!insectIndexData[insType][familyLabel])
        insectIndexData[insType][familyLabel] = [];
      insectIndexData[insType][familyLabel].push({ id: insectId, name: displayName });
    });
    // butterfly_host.csv 由来のデータも追加
    butterflyData.forEach((row, index) => {
      const japaneseName = normalizeJapaneseInsectName(row['和名']);
      const genus = (row['属'] || '').trim();
      const species = (row['種小名'] || '').trim();
      if (!japaneseName || !genus || !species) return;
      const insectId = `butterfly-csv-${index}`;
      const familyLabel = (row['科'] || '').trim() || 'タテハチョウ科';
      if (!insectIndexData['butterfly']) insectIndexData['butterfly'] = {};
      if (!insectIndexData['butterfly'][familyLabel])
        insectIndexData['butterfly'][familyLabel] = [];
      insectIndexData['butterfly'][familyLabel].push({ id: insectId, name: japaneseName });
    });
    // hamushi 由来のデータも追加
    hamushiData.forEach((row, index) => {
      const japaneseName = normalizeJapaneseInsectName(row['和名']);
      const sciName = (row['学名'] || '').trim();
      if (!japaneseName && !sciName) return;
      const displayName = japaneseName || sciName;
      const id =
        row['大図鑑カタログNo'] || row['ID'] || row['id'] || '';
      const insectId = id ? id.replace(/^H/, 'leafbeetle-') : `leafbeetle-${index}`;
      const familyLabel = (row['科和名'] || row['科'] || 'ハムシ科').trim();
      if (!insectIndexData['leafbeetle']) insectIndexData['leafbeetle'] = {};
      if (!insectIndexData['leafbeetle'][familyLabel])
        insectIndexData['leafbeetle'][familyLabel] = [];
      insectIndexData['leafbeetle'][familyLabel].push({ id: insectId, name: displayName });
    });

    // 植物インデックス用データ（科名別グループ）を構築
    const plantIndexByFamily = {};
    collectPlantPageNames(hostPlantsMap, plantDetailIndex).forEach((plantName) => {
      if (!isValidPlantName(plantName)) return;
      // キーは基底名なので科名は plantFamilyByKey から引く（科別グルーピング用）
      const family = plantFamilyByKey.get(plantName) || getPlantDetailForMeta(plantName)?.family || '科名未設定';
      if (!plantIndexByFamily[family]) plantIndexByFamily[family] = [];
      const safePlantName = plantName.replace(/[/\\?%*:|"<>]/g, '-');
      plantIndexByFamily[family].push({ name: plantName, file: safePlantName });
    });

    generateMetaIndexes({ insectIndexData, plantIndexByFamily, hostPlantsMap });
  } catch (e) {
    console.warn('メタインデックス生成で警告:', e.message || e);
  }

  // 退避していたカスタムページを復元
  try {
    let restored = 0;
    for (const [type, files] of preserveMap.entries()) {
      if (!files || files.length === 0) continue;
      const typeDir = path.join(metaDir, type);
      fs.mkdirSync(typeDir, { recursive: true });
      for (const { name, content } of files) {
        const out = path.join(typeDir, name);
        try { fs.writeFileSync(out, content); restored++; } catch {}
      }
    }
    if (restored > 0) console.log(`Restored custom meta pages: ${restored}`);
  } catch (e) {
    console.warn('restore custom meta pages warn:', e.message || e);
  }
    
  } catch (error) {
    console.error('メタページ生成中にエラーが発生しました:', error);
    process.exitCode = 1;
  }
}

// 画像ファイルリストを生成する関数
function generateImageFileLists() {
  console.log('\n画像ファイルリストを生成中...');
  
  // 昆虫画像ファイルリストの生成（和名から学名への変換を含む）
  try {
    const mothImagesDir = path.join(__dirname, '../public/images/insects');
    if (fs.existsSync(mothImagesDir)) {
      const nameMapping = new Map();
      try {
        // メインCSV（任意）を読み込んでマッピングを作成（無ければスキップ）
        const csvPath = path.join(__dirname, '../public/ListMJ_hostplants_master.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const csvData = Papa.parse(csvContent, { header: true, skipEmptyLines: true }).data;
        csvData.forEach(row => {
          const japaneseName = row['和名'] || row['属名'];
          const scientificName = row['学名'];
          const genus = row['属名'];
          const species = row['種小名'];
          if (japaneseName && scientificName) {
            const scientificFilename = scientificName
              .replace(/\s*\([^)]*\)\s*/g, '')
              .replace(/\s+/g, '_')
              .replace(/[,\.]/g, '');
            nameMapping.set(japaneseName, scientificFilename);
          } else if (japaneseName && genus && species) {
            nameMapping.set(japaneseName, `${genus}_${species}`);
          }
        });
      } catch (_e) {
        console.warn('ListMJ_hostplants_master.csv が無いため、昆虫画像の和名→学名マッピングは手動追加分のみ使用します');
      }
      // 手動で追加する必要のあるマッピング（ファイル名変更対応）
      nameMapping.set('ウスムラサキケンモン', 'Acronicta_subpurpurea_Matsumura');
      nameMapping.set('オオマエベニトガリバ', 'Tethea_consimilis');
      nameMapping.set('ショウブオオヨトウ', 'Helotropha_leucostigma');
      nameMapping.set('シラオビキリガ', 'Cosmia_camptostigma');
      nameMapping.set('シラホシキリガ', 'Cosmia_pyralina');
      nameMapping.set('タカオキリガ', 'Pseudopanolis_takao');
      nameMapping.set('ツマベニヒメハマキ', 'Phaecasiophora_roseana_2');
      nameMapping.set('ナシキリガ', 'Cosmia_restituta_Walker_1857');
      nameMapping.set('ニッコウケンモン', 'Craniophora_praeclara');
      nameMapping.set('ニッコウシャチホコ', 'Shachia_circumscripta');
      nameMapping.set('ノコメセダカヨトウ', 'Orthogonia_sera');
      nameMapping.set('ハスモンヨトウ', 'Spodoptera_litura');
      nameMapping.set('マエジロシャチホコ', 'Notodonta_albicosta');
      nameMapping.set('クロハナコヤガ', 'Aventiola_pusilla');
      nameMapping.set('フタスジエグリアツバ', 'Gonepatica_opalina');
      nameMapping.set('ベニスズメ', 'Deilephila_elpenor');
      nameMapping.set('ヒメスズメ', 'Deilephila_askoldensis');
      nameMapping.set('マダラキボシキリガ', 'Dimorphicosmia_variegata');
      nameMapping.set('ナシイラガ', 'Narosoideus_flavidorsalis');
      nameMapping.set('ヨモギオオホソハマキ', 'Phtheochroides_clandestina');
      nameMapping.set('アオマダラタマムシ', 'Nipponobuprestis_amabilis');
      nameMapping.set('ルイスヒラタチビタマムシ', 'Habroloma_lewisii');

      const imageExtensionPriority = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const mothImageFiles = fs.readdirSync(mothImagesDir)
        .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i));
      const imageCandidatesByName = new Map();
      mothImageFiles.forEach(file => {
        const nameWithoutExt = file.replace(/\.[^.]+$/, '');
        const extension = file.match(/\.[^.]+$/)[0].toLowerCase();
        if (!imageCandidatesByName.has(nameWithoutExt)) {
          imageCandidatesByName.set(nameWithoutExt, []);
        }
        imageCandidatesByName.get(nameWithoutExt).push(extension);
      });
      const mothImages = Array.from(imageCandidatesByName.keys()).sort();
      const extensionMapping = {};
      mothImages.forEach(nameWithoutExt => {
        const extensions = Array.from(new Set(imageCandidatesByName.get(nameWithoutExt) || []));
        extensions.sort((a, b) => imageExtensionPriority.indexOf(a) - imageExtensionPriority.indexOf(b));
        extensionMapping[nameWithoutExt] = extensions[0] || '.jpg';
      });
      // クライアントの画像優先表示に必要なインデックスを公開ディレクトリに出力
      fs.writeFileSync(path.join(__dirname, '../public/image_filenames.txt'), mothImages.join('\n') + '\n');
      fs.writeFileSync(path.join(__dirname, '../public/image_extensions.json'), JSON.stringify(extensionMapping, null, 2) + '\n');
      console.log(`- 昆虫画像リスト生成完了: ${mothImages.length}件`);
      console.log(`- 画像拡張子マッピング生成完了: ${Object.keys(extensionMapping).length}件`);
    }
  } catch (error) {
    console.error('昆虫画像ファイルリスト生成時にエラー:', error);
  }

  // 植物画像ファイルリストの生成（昆虫の失敗に関わらず続行）
  try {
    const plantImagesDir = path.join(__dirname, '../public/images/plants');
    if (fs.existsSync(plantImagesDir)) {
      const plantImages = fs.readdirSync(plantImagesDir)
        .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map(file => file.replace(/\.[^.]+$/, ''))
        .sort();
      fs.writeFileSync(path.join(__dirname, '../public/plant_image_filenames.txt'), plantImages.join('\n') + '\n');
      console.log(`- 植物画像リスト生成完了: ${plantImages.length}件`);
    } else {
      console.log('植物画像ディレクトリが見つかりませんでした（skipping）。');
    }
  } catch (error) {
    console.error('植物画像ファイルリスト生成時にエラー:', error);
  }
}

// メタページ用インデックスを生成（全種リンク・科別グルーピング対応）
// indexData: { insectIndexData, plantIndexByFamily, hostPlantsMap } を受け取る
function generateMetaIndexes(indexData) {
  const base = path.join(__dirname, '../public/meta');
  const sections = META_PAGE_SECTIONS;
  const insectIndexData = (indexData && indexData.insectIndexData) || null;
  const plantIndexByFamily = (indexData && indexData.plantIndexByFamily) || null;
  const hostPlantsMap = (indexData && indexData.hostPlantsMap) || null;

  // 50音順比較
  const jaSort = (a, b) => a.localeCompare(b, 'ja');

  // 蝶ハブでは、植物ページと蝶ページの双方が indexable な関係だけを逆引きに使う。
  // 件数は利用頻度ではなく、収録レコードにひもづく distinct な蝶ID数として数える。
  const buildButterflyHostPlantDirectory = () => {
    if (!hostPlantsMap) return [];
    const butterflyDir = path.join(base, 'butterfly');
    const plantDir = path.join(base, 'plant');
    const butterflyIndexability = new Map();
    const isIndexableButterfly = (insectId) => {
      if (!butterflyIndexability.has(insectId)) {
        butterflyIndexability.set(
          insectId,
          isGeneratedMetaPageIndexable(path.join(butterflyDir, `${insectId}.html`)),
        );
      }
      return butterflyIndexability.get(insectId);
    };
    const plantsByFile = new Map();

    hostPlantsMap.forEach((insects, plantName) => {
      if (!isValidPlantName(plantName) || !Array.isArray(insects)) return;
      const file = plantName.replace(/[/\\?%*:|"<>]/g, '-');
      if (!isGeneratedMetaPageIndexable(path.join(plantDir, `${file}.html`))) return;

      const butterflyIds = new Set(
        insects
          .filter((insect) => insect?.type === 'butterfly' && insect?.id)
          .map((insect) => insect.id)
          .filter(isIndexableButterfly),
      );
      if (butterflyIds.size === 0) return;

      // ファイル名の安全化で衝突した場合は、誤った重複リンクを作らず件数の多い方を残す。
      const candidate = { name: plantName, file, count: butterflyIds.size };
      const current = plantsByFile.get(file);
      if (!current || candidate.count > current.count) plantsByFile.set(file, candidate);
    });

    return [...plantsByFile.values()].sort((a, b) => jaSort(a.name, b.name));
  };

  // ヘッダーHTML（共通）
  const headerHtml = `  <header class="meta-site-header" role="banner">
    <div class="meta-site-header-inner">
      <a href="/" class="meta-site-logo" aria-label="昆虫植物図鑑 トップへ">
        <span class="meta-site-logo-icon" aria-hidden="true">
          <img src="${SITE_LOGO_SRC}" width="28" height="28" alt="" decoding="async">
        </span>
        <span class="meta-site-logo-text">昆虫植物図鑑</span>
      </a>
    </div>
  </header>`;

  // 共通スタイル
  const indexStyles = `  <style>
    .family-group { margin-bottom: 1.5rem; }
    .family-group h2, .family-group h3 { font-size: 1rem; font-weight: bold; padding: 0.4rem 0.75rem; background: var(--color-bg-secondary, #f5f5f5); border-left: 4px solid var(--color-accent, #4caf50); margin-bottom: 0.5rem; }
    .species-list { list-style: none; columns: 3; gap: 1rem; line-height: 1.85; padding: 0; }
    @media (max-width: 600px) { .species-list { columns: 2; } }
    .species-list li a { text-decoration: none; color: var(--color-link, #1976d2); }
    .species-list li a:hover { text-decoration: underline; }
    .index-summary { margin-bottom: 1.5rem; padding: 0.75rem 1rem; background: var(--color-bg-card, #fff); border: 1px solid var(--color-border, #ddd); border-radius: 8px; }
    .lookup-section { margin: 0 0 2rem; }
    .lookup-section > h2 { margin: 0 0 0.65rem; font-size: 1.35rem; }
    .lookup-lead { margin: 0 0 1rem; line-height: 1.75; }
    .record-scope-note { margin: 0 0 1.25rem; padding: 0.75rem 1rem; border-left: 4px solid #c78b19; background: #fff8e7; line-height: 1.7; }
    .featured-host-plants { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; padding: 0; margin: 0 0 1.5rem; }
    .featured-host-plants a { display: flex; justify-content: space-between; gap: 0.75rem; height: 100%; padding: 0.75rem; border: 1px solid var(--color-border, #ddd); border-radius: 8px; color: var(--color-link, #1976d2); text-decoration: none; background: var(--color-bg-card, #fff); }
    .featured-host-plants a:hover { text-decoration: underline; border-color: var(--color-accent, #4caf50); }
    .host-plant-count { white-space: nowrap; color: var(--color-text-secondary, #555); font-variant-numeric: tabular-nums; }
    .host-plant-filter-label { display: block; margin-bottom: 0.35rem; font-weight: bold; }
    .host-plant-filter { width: min(100%, 32rem); min-height: 44px; padding: 0.65rem 0.75rem; border: 1px solid var(--color-border, #bbb); border-radius: 7px; font: inherit; }
    .host-plant-filter:focus { outline: 3px solid rgba(25, 118, 210, 0.25); border-color: var(--color-link, #1976d2); }
    .host-plant-result-count { margin: 0.65rem 0; color: var(--color-text-secondary, #555); }
    .host-plant-directory { max-height: 34rem; overflow: auto; border: 1px solid var(--color-border, #ddd); border-radius: 8px; background: var(--color-bg-card, #fff); }
    .host-plant-directory-list { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin: 0; padding: 0; }
    .host-plant-directory-item { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--color-border, #eee); }
    .host-plant-directory-item a { color: var(--color-link, #1976d2); text-decoration: none; }
    .host-plant-directory-item a:hover { text-decoration: underline; }
    .pager { margin: 1.5rem 0; }
    .pager-inner { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .pager a, .pager span { min-width: 2rem; text-align: center; padding: 0.3rem 0.55rem; border: 1px solid var(--color-border, #ddd); border-radius: 6px; text-decoration: none; font-size: 0.9rem; color: var(--color-link, #1976d2); }
    .pager span[aria-current="page"] { font-weight: 700; background: var(--color-accent, #4caf50); color: #fff; border-color: var(--color-accent, #4caf50); }
    @media (max-width: 760px) {
      .featured-host-plants, .host-plant-directory-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 480px) {
      .featured-host-plants, .host-plant-directory-list { grid-template-columns: 1fr; }
    }
  </style>`;

  const HUB_PAGE_SIZE = 600;
  const hubPageFileName = (pageNo) => (pageNo === 1 ? 'index.html' : `page-${pageNo}.html`);
  const hubPagePath = (dir, pageNo) =>
    pageNo === 1 ? `/meta/${dir}/index.html` : `/meta/${dir}/page-${pageNo}.html`;
  const hubPageUrl = (dir, pageNo) => `${BASE_ORIGIN}${hubPagePath(dir, pageNo)}`;

  const removeStaleHubPages = (dirPath) => {
    for (const fileName of fs.readdirSync(dirPath)) {
      if (!/^page-\d+\.html$/.test(fileName)) continue;
      try { fs.unlinkSync(path.join(dirPath, fileName)); } catch { /* ignore stale build output */ }
    }
  };

  const buildPagerHtml = (dir, pageCount, currentPage) => {
    if (pageCount <= 1) return '';
    const links = Array.from({ length: pageCount }, (_, index) => index + 1)
      .map((pageNo) => {
        if (pageNo === currentPage) return `<span aria-current="page">${pageNo}</span>`;
        const rel = pageNo === currentPage - 1
          ? ' rel="prev"'
          : (pageNo === currentPage + 1 ? ' rel="next"' : '');
        return `<a href="${hubPagePath(dir, pageNo)}"${rel}>${pageNo}</a>`;
      })
      .join('\n        ');
    return `      <nav class="pager" aria-label="ページ送り">
        <div class="pager-inner">
        ${links}
        </div>
      </nav>`;
  };

  const emitPaginatedHub = ({ sec, dirPath, familyBlocks, descriptionBase }) => {
    const familyTotals = new Map(familyBlocks.map(({ family, items }) => [family, items.length]));
    const flatItems = familyBlocks.flatMap(({ family, items }) =>
      items.map((item) => ({ family, ...item })),
    );
    const pageCount = Math.max(1, Math.ceil(flatItems.length / HUB_PAGE_SIZE));

    for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
      const pageStart = (pageNo - 1) * HUB_PAGE_SIZE;
      const pageItems = flatItems.slice(pageStart, pageStart + HUB_PAGE_SIZE);
      const pageUrl = hubPageUrl(sec.dir, pageNo);
      const pageSuffix = `（${pageNo}/${pageCount}）`;
      const title = `${sec.title}${pageSuffix} | 昆虫植物図鑑`;
      const description = `${descriptionBase}（${pageNo}/${pageCount}ページ）`;
      const prevLink = pageNo > 1
        ? `\n  <link rel="prev" href="${hubPageUrl(sec.dir, pageNo - 1)}">`
        : '';
      const nextLink = pageNo < pageCount
        ? `\n  <link rel="next" href="${hubPageUrl(sec.dir, pageNo + 1)}">`
        : '';

      const groupedItems = [];
      for (const item of pageItems) {
        const lastGroup = groupedItems[groupedItems.length - 1];
        if (!lastGroup || lastGroup.family !== item.family) {
          groupedItems.push({ family: item.family, items: [item] });
        } else {
          lastGroup.items.push(item);
        }
      }
      const mainContent = groupedItems.map(({ family, items }) => {
        const heading = family
          ? `${escapeRedirectHtml(family)}（${familyTotals.get(family)}種）`
          : `全${flatItems.length}種`;
        const links = items
          .map(({ href, label }) => `<li><a href="${href}">${escapeRedirectHtml(label)}</a></li>`)
          .join('\n          ');
        return `<section class="family-group">
        <h2>${heading}</h2>
        <ul class="species-list">
          ${links}
        </ul>
      </section>`;
      }).join('\n      ');

      const listStructuredData = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${sec.title}${pageSuffix}`,
        description,
        url: pageUrl,
        inLanguage: 'ja',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: flatItems.length,
          itemListElement: pageItems.slice(0, 100).map((item, index) => ({
            '@type': 'ListItem',
            position: pageStart + index + 1,
            item: {
              '@type': 'WebPage',
              name: item.label,
              url: `${BASE_ORIGIN}${item.href}`,
            },
          })),
        },
      }, null, 2);
      const pagerHtml = buildPagerHtml(sec.dir, pageCount, pageNo);
      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  ${GA_HEAD_TAGS}
  ${ADSENSE_HEAD_TAGS}
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${pageUrl}">${prevLink}${nextLink}
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="昆虫植物図鑑">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <script type="application/ld+json">${listStructuredData}</script>
  <link rel="stylesheet" href="${META_STYLE_PATH}">
${indexStyles}
</head>
<body>
${headerHtml}
  <div class="meta-page">
    <header class="meta-header">
      <h1>${sec.title}${pageSuffix}</h1>
    </header>
    <main>
      <p class="index-summary">全${flatItems.length}種を${familyBlocks.length}科に分けて掲載しています。${pageSuffix}</p>
${pagerHtml}
      ${mainContent}
${pagerHtml}
    </main>
    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
    </section>
  </div>
</body>
</html>`;
      fs.writeFileSync(path.join(dirPath, hubPageFileName(pageNo)), html);
    }

    console.log(`[index] ${sec.dir}: ${flatItems.length}種 / ${familyBlocks.length}科 / ${pageCount}ページ`);
  };

  for (const sec of sections) {
    const dirPath = path.join(base, sec.dir);
    if (!fs.existsSync(dirPath)) continue;
    removeStaleHubPages(dirPath);
    const listUrl = `${BASE_ORIGIN}/meta/${sec.dir}/index.html`;

    // ---- 植物インデックス ----
    if (sec.dir === 'plant') {
      const familyData = Object.fromEntries(
        Object.entries(plantIndexByFamily || {})
          .map(([family, plants]) => [
            family,
            plants.filter((plant) =>
              isGeneratedMetaPageIndexable(path.join(dirPath, `${plant.file}.html`)),
            ),
          ])
          .filter(([, plants]) => plants.length > 0),
      );
      const sortedFamilies = Object.keys(familyData).sort(jaSort);
      const totalPlants = sortedFamilies.reduce((s, f) => s + familyData[f].length, 0);
      if (totalPlants > HUB_PAGE_SIZE) {
        const familyBlocks = sortedFamilies.map((family) => ({
          family,
          items: familyData[family]
            .slice()
            .sort((a, b) => jaSort(a.name, b.name))
            .map((plant) => ({
              href: buildPlantPath(plant.file, 'ja'),
              label: plant.name.replace(/\([^)]+科\)$/, '').trim() || plant.name,
            })),
        }));
        emitPaginatedHub({
          sec,
          dirPath,
          familyBlocks,
          descriptionBase: `昆虫植物図鑑の食草植物一覧。${totalPlants}種の植物を科別に掲載。`,
        });
        continue;
      }
      const flatPlants = sortedFamilies.flatMap(f => familyData[f]).slice(0, 100);
      const pageDescription = `昆虫植物図鑑の食草植物一覧。${totalPlants}種の植物を科別に掲載。`;

      const listStructuredData = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: sec.title,
        description: pageDescription,
        url: listUrl,
        inLanguage: 'ja',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: totalPlants,
          itemListElement: flatPlants.map((p, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            item: {
              '@type': 'WebPage',
              name: p.name,
              url: `${BASE_ORIGIN}${buildPlantPath(p.file, 'ja')}`,
            },
          })),
        },
      }, null, 2);

      const sectionBlocks = sortedFamilies.map(family => {
        const plants = familyData[family].slice().sort((a, b) => jaSort(a.name, b.name));
        const items = plants
          .map(p => {
            const displayName = p.name.replace(/\([^)]+科\)$/, '').trim() || p.name;
            return `<li><a href="${buildPlantPath(p.file, 'ja')}">${displayName}</a></li>`;
          })
          .join('\n          ');
        return `<section class="family-group">
        <h2>${family}（${plants.length}種）</h2>
        <ul class="species-list">
          ${items}
        </ul>
      </section>`;
      }).join('\n      ');

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  ${GA_HEAD_TAGS}
  ${ADSENSE_HEAD_TAGS}
  <title>${sec.title} | 昆虫植物図鑑</title>
  <meta name="description" content="${pageDescription}">
  <link rel="canonical" href="${listUrl}">
  <meta property="og:title" content="${sec.title} | 昆虫植物図鑑">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${listUrl}">
  <meta property="og:site_name" content="昆虫植物図鑑">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${sec.title} | 昆虫植物図鑑">
  <meta name="twitter:description" content="${pageDescription}">
  <script type="application/ld+json">${listStructuredData}</script>
  <link rel="stylesheet" href="${META_STYLE_PATH}">
${indexStyles}
</head>
<body>
${headerHtml}
  <div class="meta-page">
    <header class="meta-header">
      <h1>${sec.title}</h1>
    </header>
    <main>
      <p class="index-summary">全${totalPlants}種の食草植物を${sortedFamilies.length}科に分けて掲載しています。</p>
      ${sectionBlocks}
    </main>
    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
    </section>
  </div>
</body>
</html>`;
      fs.writeFileSync(path.join(dirPath, 'index.html'), html);
      console.log(`[index] plant: ${totalPlants}種 / ${sortedFamilies.length}科`);
      continue;
    }

    // ---- 昆虫インデックス ----
    const typeData = Object.fromEntries(
      Object.entries((insectIndexData && insectIndexData[sec.dir]) || {})
        .map(([family, speciesList]) => [
          family,
          speciesList.filter((species) =>
            isGeneratedMetaPageIndexable(path.join(dirPath, `${species.id}.html`)),
          ),
        ])
        .filter(([, speciesList]) => speciesList.length > 0),
    );
    const sortedFamilies = Object.keys(typeData).sort(jaSort);
    const totalSpecies = sortedFamilies.reduce((s, f) => s + typeData[f].length, 0);
    const isButterflyHub = sec.dir === 'butterfly';
    const butterflyHostPlants = isButterflyHub ? buildButterflyHostPlantDirectory() : [];
    const featuredButterflyHostPlants = butterflyHostPlants
      .slice()
      .sort((a, b) => b.count - a.count || jaSort(a.name, b.name))
      .slice(0, 12);

    // フォールバック: データなしの場合はファイルスキャン
    let flatItems;
    if (totalSpecies === 0) {
      flatItems = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.html') && f !== 'index.html')
        .filter(f => isGeneratedMetaPageIndexable(path.join(dirPath, f)))
        .sort(jaSort)
        .map(f => ({ id: f.replace(/\.html$/i, ''), name: f.replace(/\.html$/i, '') }));
    } else {
      flatItems = sortedFamilies.flatMap(f => typeData[f]);
    }

    if (!isButterflyHub && flatItems.length > HUB_PAGE_SIZE) {
      const familyBlocks = totalSpecies > 0
        ? sortedFamilies.map((family) => ({
            family,
            items: typeData[family]
              .slice()
              .sort((a, b) => jaSort(a.name, b.name))
              .map((species) => ({
                href: buildJapaneseInsectPath(species, sec.dir),
                label: species.name,
              })),
          }))
        : [{
            family: '',
            items: flatItems.map((species) => ({
              href: buildJapaneseInsectPath(species, sec.dir),
              label: species.name,
            })),
          }];
      emitPaginatedHub({
        sec,
        dirPath,
        familyBlocks,
        descriptionBase: `昆虫植物図鑑の${sec.title}。${flatItems.length}種を科別に掲載し、各種の食草・寄主植物ページへ案内します。`,
      });
      continue;
    }

    // JSON-LD: 先頭100件
    const pageHeading = isButterflyHub ? '蝶の食草一覧' : sec.title;
    const documentTitle = isButterflyHub
      ? `蝶の食草一覧｜植物名と蝶の名前から探す｜昆虫植物図鑑`
      : `${sec.title} | 昆虫植物図鑑`;
    const pageDescription = isButterflyHub
      ? `昆虫植物図鑑に収録した蝶${flatItems.length}種の食草一覧。食草植物・分類群${butterflyHostPlants.length}件からの逆引きと、蝶の科別一覧から調べられます。各植物ページに出典付き記録を掲載。`
      : `昆虫植物図鑑の${sec.title}。${flatItems.length}種を科別に掲載し、各種の食草・寄主植物ページへ案内します。`;
    const listStructuredData = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageHeading,
      description: pageDescription,
      url: listUrl,
      inLanguage: 'ja',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: flatItems.length,
        itemListElement: flatItems.slice(0, 100).map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'WebPage',
            name: item.name,
            url: `${BASE_ORIGIN}${buildJapaneseInsectPath(item, sec.dir)}`,
          },
        })),
      },
    }, null, 2);

    // 科別セクション（データあり）またはフラットリスト（フォールバック）
    let mainContent;
    if (totalSpecies > 0) {
      const familyHeadingTag = isButterflyHub ? 'h3' : 'h2';
      mainContent = sortedFamilies
        .map(family => {
          const speciesList = typeData[family].slice().sort((a, b) => jaSort(a.name, b.name));
          const items = speciesList
            .map(
              s =>
                `<li><a href="${buildJapaneseInsectPath(s, sec.dir)}">${s.name}</a></li>`,
            )
            .join('\n          ');
          return `<section class="family-group">
        <${familyHeadingTag}>${family}（${speciesList.length}種）</${familyHeadingTag}>
        <ul class="species-list">
          ${items}
        </ul>
      </section>`;
        })
        .join('\n      ');
    } else {
      const items = flatItems
        .map(
          s =>
            `<li><a href="${buildJapaneseInsectPath(s, sec.dir)}">${s.name}</a></li>`,
        )
        .join('\n          ');
      mainContent = `<ul class="species-list" style="columns:3;gap:1rem;list-style:none;padding:0;">
          ${items}
        </ul>`;
    }

    const summaryLabel =
      isButterflyHub
        ? `蝶${flatItems.length}種と食草植物・分類群${butterflyHostPlants.length}件を、植物名の逆引きと蝶の科別一覧から探せます。`
        : totalSpecies > 0
        ? `全${flatItems.length}種を${sortedFamilies.length}科に分けて掲載しています。`
        : `全${flatItems.length}種を掲載しています。`;

    const butterflyHostPlantContent = isButterflyHub
      ? (() => {
          const featuredItems = featuredButterflyHostPlants
            .map(({ name, file, count }) => `<li>
            <a href="${buildPlantPath(file, 'ja')}">
              <span>${escapeRedirectHtml(name)}</span>
              <span class="host-plant-count">蝶${count}種</span>
            </a>
          </li>`)
            .join('\n          ');
          const directoryItems = butterflyHostPlants
            .map(({ name, file, count }) => `<li class="host-plant-directory-item" data-host-plant-name="${escapeRedirectHtml(name.normalize('NFKC').toLocaleLowerCase('ja'))}">
            <a href="${buildPlantPath(file, 'ja')}">${escapeRedirectHtml(name)}</a>
            <span class="host-plant-count">${count}種</span>
          </li>`)
            .join('\n          ');
          return `<section class="lookup-section" aria-labelledby="butterfly-host-plant-heading">
        <h2 id="butterfly-host-plant-heading">蝶を食草植物・分類群から探す</h2>
        <p class="lookup-lead">植物名や分類群から、その植物を食草として収録した蝶を逆引きできます。リンク先では蝶の種名とレコードごとの出典を確認できます。</p>
        <p class="record-scope-note"><strong>件数の見方：</strong>この図鑑の食草レコードにひもづく蝶の種数です。主要食草や野外での利用頻度の順位を示すものではありません。</p>
        <h3>収録レコードが多い植物・分類群</h3>
        <ul class="featured-host-plants" data-butterfly-featured-host-plants>
          ${featuredItems}
        </ul>
        <label class="host-plant-filter-label" for="butterfly-host-plant-filter">植物名・分類群で絞り込む</label>
        <input class="host-plant-filter" id="butterfly-host-plant-filter" type="search" placeholder="例：スミレ、エノキ、サンショウ" autocomplete="off">
        <p class="host-plant-result-count" id="butterfly-host-plant-result-count" role="status" aria-live="polite">食草植物・分類群${butterflyHostPlants.length}件</p>
        <div class="host-plant-directory" tabindex="0" aria-label="蝶の食草植物・分類群一覧">
          <ul class="host-plant-directory-list" data-butterfly-host-plant-directory>
          ${directoryItems}
          </ul>
        </div>
      </section>`;
        })()
      : '';

    if (isButterflyHub) {
      mainContent = `<section class="lookup-section" aria-labelledby="butterfly-name-heading">
        <h2 id="butterfly-name-heading">蝶の名前・科から探す</h2>
        <p class="lookup-lead">蝶の名前を選ぶと、その種に記録された食草・食樹と出典を確認できます。</p>
        ${mainContent}
      </section>`;
    }

    const butterflyFilterScript = isButterflyHub
      ? `  <script>
    (() => {
      const input = document.getElementById('butterfly-host-plant-filter');
      const status = document.getElementById('butterfly-host-plant-result-count');
      const items = Array.from(document.querySelectorAll('[data-host-plant-name]'));
      if (!input || !status || items.length === 0) return;
      const total = items.length;
      input.addEventListener('input', () => {
        const query = input.value.normalize('NFKC').toLocaleLowerCase('ja').trim();
        let visible = 0;
        items.forEach((item) => {
          const matches = !query || item.dataset.hostPlantName.includes(query);
          item.hidden = !matches;
          if (matches) visible += 1;
        });
        status.textContent = query ? visible + '件が一致' : '食草植物・分類群' + total + '件';
      });
    })();
  </script>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  ${GA_HEAD_TAGS}
  ${ADSENSE_HEAD_TAGS}
  <title>${documentTitle}</title>
  <meta name="description" content="${pageDescription}">
  <link rel="canonical" href="${listUrl}">
  <meta property="og:title" content="${documentTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${listUrl}">
  <meta property="og:site_name" content="昆虫植物図鑑">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${documentTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <script type="application/ld+json">${listStructuredData}</script>
  <link rel="stylesheet" href="${META_STYLE_PATH}">
${indexStyles}
</head>
<body>
${headerHtml}
  <div class="meta-page">
    <header class="meta-header">
      <h1>${pageHeading}</h1>
    </header>
    <main>
      <p class="index-summary">${summaryLabel}</p>
      ${butterflyHostPlantContent}
      ${mainContent}
    </main>
    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
    </section>
  </div>
${butterflyFilterScript}
</body>
</html>`;
    fs.writeFileSync(path.join(dirPath, 'index.html'), html);
    console.log(`[index] ${sec.dir}: ${flatItems.length}種 / ${sortedFamilies.length}科`);
  }
}

// 実行
generateMetaPages();
