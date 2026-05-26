#!/usr/bin/env node
// Remove non-public/development artifacts from the built output to keep Pages lean
import fs from 'fs';
import path from 'path';

const MAX_PAGES_DIST_BYTES = 900 * 1024 * 1024;
const BASE_ORIGIN = process.env.BASE_ORIGIN || 'https://orau98.github.io';
const SPA_ROUTE_SHELLS = [
  {
    segments: ['quiz'],
    lang: 'ja',
    title: '4択図鑑 | 昆虫植物図鑑',
    description: '蛾・蝶の幼虫食草を4択で学べる昆虫植物図鑑のクイズ。昆虫から食草、食草から昆虫の双方向で検索練習できます。',
    canonicalPath: '/quiz',
    alternates: [
      { hreflang: 'ja', path: '/quiz' },
      { hreflang: 'en', path: '/en/quiz' },
      { hreflang: 'x-default', path: '/quiz' },
    ],
    ogTitle: '4択図鑑 | 昆虫植物図鑑',
    ogDescription: '蛾・蝶の幼虫食草を4択で学べるクイズです。',
  },
  {
    segments: ['en', 'quiz'],
    lang: 'en',
    title: 'Four-choice Quiz | Insects and Host Plants of Japan',
    description: 'A four-choice quiz for learning larval host plants of Japanese moths and butterflies in both insect-to-plant and plant-to-insect modes.',
    canonicalPath: '/en/quiz',
    alternates: [
      { hreflang: 'ja', path: '/quiz' },
      { hreflang: 'en', path: '/en/quiz' },
      { hreflang: 'x-default', path: '/quiz' },
    ],
    ogTitle: 'Four-choice Quiz | Insects and Host Plants of Japan',
    ogDescription: 'Practice moth and butterfly larval host plants with immediate feedback.',
  },
];
const PLANT_PROFILE_ROUTE_SHELL_MARKER = 'window.__PLANT_ROUTE_SHELL__';
const targets = [
  // Serve only generated responsive insect images on GitHub Pages.
  path.join('dist', 'images', 'insects'),
  // Serve plant photos from responsive derivatives; full-size originals push
  // Pages artifacts over the limit without changing the visible page content.
  path.join('dist', 'images', 'plants'),
  // Development CSV snapshots should remain in the repository, not in Pages output.
  path.join('dist', 'backup'),
  path.join('dist', 'insects.csv.bak.butterfly_subfamily_fix_20260114125318'),
];

const ensureSpa404 = () => {
  try {
    const indexPath = path.join('dist', 'index.html');
    const targetPath = path.join('dist', '404.html');
    if (!fs.existsSync(indexPath)) return;
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const noindexMeta = '    <meta name="robots" content="noindex, follow, max-image-preview:none">\n';
    const fallbackFlag = '    <script>window.__SEO_FORCE_NOINDEX__ = true; window.__IS_SPA_404__ = true;</script>\n';
    const htmlWithNoindex = indexHtml.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*>/i,
      noindexMeta.trimEnd(),
    );
    const targetHtml = htmlWithNoindex.replace('</head>', `${fallbackFlag}  </head>`);
    fs.writeFileSync(targetPath, targetHtml, 'utf8');
    console.log('[postbuild] Synced SPA 404.html from index.html (no redirect hop).');
  } catch (error) {
    console.warn('[postbuild] Failed to sync SPA 404:', error?.message || error);
  }
};

const escapeHtmlAttr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const replaceMetaContent = (html, attr, key, content) => {
  const pattern = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="[^"]*"\\s*>`,
    'i',
  );
  const replacement = `<meta ${attr}="${key}" content="${escapeHtmlAttr(content)}">`;
  return html.replace(pattern, replacement);
};

const buildSpaRouteShell = (indexHtml, route) => {
  const canonicalUrl = `${BASE_ORIGIN}${route.canonicalPath}`;
  const alternateLinks = route.alternates
    .map(({ hreflang, path: routePath }) =>
      `    <link rel="alternate" hreflang="${escapeHtmlAttr(hreflang)}" href="${escapeHtmlAttr(`${BASE_ORIGIN}${routePath}`)}">`)
    .join('\n');

  let html = indexHtml
    .replace(/<html\s+lang="[^"]*"/i, `<html lang="${escapeHtmlAttr(route.lang)}"`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(route.title)}</title>`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*>/i, `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">`)
    .replace(
      /(?:\s*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]+"\s*>\n?)+/i,
      `\n${alternateLinks}\n`,
    );

  html = replaceMetaContent(html, 'name', 'description', route.description);
  html = replaceMetaContent(html, 'property', 'og:title', route.ogTitle);
  html = replaceMetaContent(html, 'property', 'og:description', route.ogDescription);
  html = replaceMetaContent(html, 'property', 'og:url', canonicalUrl);
  html = replaceMetaContent(html, 'name', 'twitter:title', route.ogTitle);
  html = replaceMetaContent(html, 'name', 'twitter:description', route.ogDescription);
  return html;
};

const ensureSpaRouteShells = () => {
  try {
    const indexPath = path.join('dist', 'index.html');
    if (!fs.existsSync(indexPath)) return;
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    let count = 0;

    for (const route of SPA_ROUTE_SHELLS) {
      const routeDir = path.join('dist', ...route.segments);
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(
        path.join(routeDir, 'index.html'),
        buildSpaRouteShell(indexHtml, route),
        'utf8',
      );
      count++;
    }

    console.log(`[postbuild] Synced ${count} SPA route shell(s).`);
  } catch (error) {
    console.warn('[postbuild] Failed to sync SPA route shells:', error?.message || error);
  }
};

const buildPlantProfileRouteShell = (indexHtml, plantName) => {
  const routeFlag = `    <script>${PLANT_PROFILE_ROUTE_SHELL_MARKER} = ${JSON.stringify(plantName)};</script>\n`;
  return indexHtml.includes(PLANT_PROFILE_ROUTE_SHELL_MARKER)
    ? indexHtml
    : indexHtml.replace('</head>', `${routeFlag}  </head>`);
};

const readTextIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
};

const isPlantProfileRouteShell = (html) => html.includes(PLANT_PROFILE_ROUTE_SHELL_MARKER);

const getPlantRouteIndexPaths = (plantName) => {
  const encodedPlantName = encodeURIComponent(plantName);
  const decodedPath = path.join('dist', 'plant', plantName, 'index.html');
  const encodedPath = path.join('dist', 'plant', encodedPlantName, 'index.html');
  return encodedPath === decodedPath ? [decodedPath] : [decodedPath, encodedPath];
};

const findExistingStaticPlantRoute = (plantName) => {
  for (const filePath of getPlantRouteIndexPaths(plantName)) {
    const html = readTextIfExists(filePath);
    if (html && !isPlantProfileRouteShell(html)) {
      return { filePath, html };
    }
  }
  return null;
};

const isSafePlantRouteSegment = (name) => {
  const value = String(name || '').trim();
  return Boolean(value && !/[\/\\\0]/.test(value));
};

const ensurePlantProfileRouteShells = () => {
  try {
    const indexPath = path.join('dist', 'index.html');
    const plantDetailsPath = path.join('dist', 'assets', 'data-lite', 'plant-details.json');
    if (!fs.existsSync(indexPath) || !fs.existsSync(plantDetailsPath)) return;

    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const plantDetails = JSON.parse(fs.readFileSync(plantDetailsPath, 'utf8'));
    let count = 0;
    let preserved = 0;
    let skipped = 0;

    for (const [plantName, detail] of Object.entries(plantDetails)) {
      if (!detail?.profile) continue;
      if (!isSafePlantRouteSegment(plantName)) {
        skipped++;
        continue;
      }
      const routeDir = path.join('dist', 'plant', plantName);
      const routeIndexPath = path.join(routeDir, 'index.html');
      const staticRoute = findExistingStaticPlantRoute(plantName);
      if (staticRoute) {
        fs.mkdirSync(routeDir, { recursive: true });
        if (readTextIfExists(routeIndexPath) !== staticRoute.html) {
          fs.writeFileSync(routeIndexPath, staticRoute.html, 'utf8');
        }
        preserved++;
        continue;
      }

      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(
        routeIndexPath,
        buildPlantProfileRouteShell(indexHtml, plantName),
        'utf8',
      );
      count++;
    }

    console.log(`[postbuild] Synced ${count} plant profile SPA route shell(s).`);
    if (preserved) {
      console.log(`[postbuild] Preserved ${preserved} static plant redirect route(s).`);
    }
    if (skipped) {
      console.warn(`[postbuild] Skipped ${skipped} plant profile route shell(s) with unsafe path characters.`);
    }
  } catch (error) {
    console.warn('[postbuild] Failed to sync plant profile SPA route shells:', error?.message || error);
  }
};

const getDirectorySizeBytes = (dirPath) => {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    }
  }
  return total;
};

const formatMiB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

const assertPagesSizeBudget = () => {
  const distDir = path.join('dist');
  const sizeBytes = getDirectorySizeBytes(distDir);
  console.log(`[postbuild] dist size after cleanup: ${formatMiB(sizeBytes)}`);
  if (sizeBytes > MAX_PAGES_DIST_BYTES) {
    throw new Error(
      `dist is still too large for GitHub Pages safety budget: ${formatMiB(sizeBytes)} > ${formatMiB(MAX_PAGES_DIST_BYTES)}.`,
    );
  }
};

for (const p of targets) {
  try {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log('[postbuild] Removed dir:', p);
      } else {
        fs.rmSync(p, { force: true });
        console.log('[postbuild] Removed file:', p);
      }
    }
  } catch (e) {
    console.warn('[postbuild] Warning removing', p, e?.message || e);
  }
}

ensureSpa404();
ensureSpaRouteShells();
ensurePlantProfileRouteShells();
assertPagesSizeBudget();
