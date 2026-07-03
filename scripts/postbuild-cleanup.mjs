#!/usr/bin/env node
// Remove non-public/development artifacts from the built output to keep Pages lean
import fs from 'fs';
import path from 'path';

const MAX_PAGES_DIST_BYTES = 900 * 1024 * 1024;
const BASE_ORIGIN = process.env.BASE_ORIGIN || 'https://orau98.github.io';
const EN_SITE_NAME = 'Insects and Host Plants of Japan';
const EN_HOME_DESCRIPTION = 'Explore insects and host plants recorded in Japan. Search moths, butterflies, beetles, aphids, and host plants by scientific name, Japanese name, plant name, or taxonomy.';
const EN_HOME_KEYWORDS = 'Japanese insects, host plants, larval host plants, moths, butterflies, beetles, aphids, plant-insect relationships, Japan biodiversity, scientific names';
const DEFAULT_SOCIAL_IMAGE_URL = `${BASE_ORIGIN}/images/resized/insects/Cucullia_argentea.1024.jpg`;
const DEFAULT_SOCIAL_IMAGE_ALT_EN = 'Cucullia argentea on Insects and Host Plants of Japan';
const ADSENSE_CLIENT = process.env.VITE_ADSENSE_CLIENT || 'ca-pub-6982051533473293';
const ADSENSE_SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
const EN_HOME_NOSCRIPT = `    <noscript>
      <section style="max-width: 960px; margin: 24px auto; padding: 16px; border: 1px solid #dbe4ea; border-radius: 8px; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.7;">
        <h1 style="font-size: 1.4rem; margin: 0 0 8px; color: #047857;">Insects and Host Plants of Japan</h1>
        <p style="margin: 0 0 10px; color: #0f172a;">Explore insects and host plants recorded in Japan. The full interactive search needs JavaScript, but static English entry pages are available below.</p>
        <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 1rem; margin: 0 0 6px; color: #064e3b;">Browse insects</h2>
            <ul style="margin: 0 0 0 18px; padding: 0;">
              <li><a href="/en/meta/moth/index.html">Moths</a></li>
              <li><a href="/en/meta/butterfly/index.html">Butterflies</a></li>
              <li><a href="/en/meta/beetle/index.html">Jewel beetles</a></li>
              <li><a href="/en/meta/longhornbeetle/index.html">Longhorn beetles</a></li>
              <li><a href="/en/meta/leafbeetle/index.html">Leaf beetles</a></li>
              <li><a href="/en/meta/aphid/index.html">Aphids</a></li>
            </ul>
          </div>
          <div>
            <h2 style="font-size: 1rem; margin: 0 0 6px; color: #064e3b;">Browse plants</h2>
            <ul style="margin: 0 0 0 18px; padding: 0;">
              <li><a href="/en/meta/plant/index.html">Plant pages</a></li>
            </ul>
          </div>
          <div>
            <h2 style="font-size: 1rem; margin: 0 0 6px; color: #064e3b;">Interactive tools</h2>
            <ul style="margin: 0 0 0 18px; padding: 0;">
              <li><a href="/en/moth">Insect search</a></li>
              <li><a href="/en/plant">Plant search</a></li>
              <li><a href="/en/quiz/">Four-choice quiz</a></li>
            </ul>
          </div>
        </section>
      </section>
    </noscript>`;
const EN_HOME_STRUCTURED_DATA = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_ORIGIN}/en/#website`,
    name: EN_SITE_NAME,
    alternateName: ['InsectPlantDB', 'Japanese insects and host plants'],
    description: EN_HOME_DESCRIPTION,
    url: `${BASE_ORIGIN}/en/`,
    image: DEFAULT_SOCIAL_IMAGE_URL,
    inLanguage: 'en',
    isAccessibleForFree: true,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_ORIGIN}/en/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: EN_SITE_NAME,
    alternateName: ['InsectPlantDB'],
    url: `${BASE_ORIGIN}/en/`,
    logo: `${BASE_ORIGIN}/favicon-192.png`,
    sameAs: [
      'https://www.instagram.com/onychodactylus_nipponoborealis/',
    ],
  },
  {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'SiteNavigationElement', name: 'Insects', url: `${BASE_ORIGIN}/en/meta/moth/index.html` },
      { '@type': 'SiteNavigationElement', name: 'Plants', url: `${BASE_ORIGIN}/en/meta/plant/index.html` },
      { '@type': 'SiteNavigationElement', name: 'Four-choice quiz', url: `${BASE_ORIGIN}/en/quiz/` },
    ],
  },
];
const SPA_ROUTE_SHELLS = [
  {
    segments: ['en'],
    lang: 'en',
    title: EN_SITE_NAME,
    description: EN_HOME_DESCRIPTION,
    canonicalPath: '/en/',
    alternates: [
      { hreflang: 'ja', path: '/' },
      { hreflang: 'en', path: '/en/' },
      { hreflang: 'x-default', path: '/en/' },
    ],
    appName: EN_SITE_NAME,
    appleTitle: EN_SITE_NAME,
    ogTitle: EN_SITE_NAME,
    ogDescription: EN_HOME_DESCRIPTION,
    siteName: EN_SITE_NAME,
    author: EN_SITE_NAME,
    keywords: EN_HOME_KEYWORDS,
    ogLocale: 'en_US',
    imageAlt: DEFAULT_SOCIAL_IMAGE_ALT_EN,
    noscriptHtml: EN_HOME_NOSCRIPT,
    structuredData: EN_HOME_STRUCTURED_DATA,
    requireAdsenseScript: true,
  },
  {
    segments: ['quiz'],
    lang: 'ja',
    title: '4択図鑑 | 昆虫植物図鑑',
    description: '蛾・蝶の幼虫食草を4択で学べる昆虫植物図鑑のクイズ。昆虫から食草、食草から昆虫の双方向で検索練習できます。',
    // 実体は dist/quiz/index.html で、200 を返すのは末尾スラッシュ付きURL。
    // スラッシュなしは GitHub Pages が 301 を返すため、canonical/hreflang は
    // sitemap の登録URL（/quiz/）と同じ形に揃える。
    canonicalPath: '/quiz/',
    alternates: [
      { hreflang: 'ja', path: '/quiz/' },
      { hreflang: 'en', path: '/en/quiz/' },
      { hreflang: 'x-default', path: '/quiz/' },
    ],
    ogTitle: '4択図鑑 | 昆虫植物図鑑',
    ogDescription: '蛾・蝶の幼虫食草を4択で学べるクイズです。',
  },
  {
    segments: ['en', 'quiz'],
    lang: 'en',
    title: 'Four-choice Quiz | Insects and Host Plants of Japan',
    description: 'A four-choice quiz for learning larval host plants of Japanese moths and butterflies in both insect-to-plant and plant-to-insect modes.',
    canonicalPath: '/en/quiz/',
    alternates: [
      { hreflang: 'ja', path: '/quiz/' },
      { hreflang: 'en', path: '/en/quiz/' },
      { hreflang: 'x-default', path: '/quiz/' },
    ],
    ogTitle: 'Four-choice Quiz | Insects and Host Plants of Japan',
    ogDescription: 'Practice moth and butterfly larval host plants with immediate feedback.',
  },
];
const PLANT_PROFILE_ROUTE_SHELL_MARKER = 'window.__PLANT_ROUTE_SHELL__';
const SPA_ROUTE_NOINDEX_ROBOTS = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
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

const escapeHtmlText = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const replaceMetaContent = (html, attr, key, content) => {
  const pattern = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="[^"]*"\\s*\\/?>`,
    'i',
  );
  const replacement = `<meta ${attr}="${key}" content="${escapeHtmlAttr(content)}">`;
  return html.replace(pattern, replacement);
};

const replaceOrInsertMetaContent = (html, attr, key, content) => {
  const nextHtml = replaceMetaContent(html, attr, key, content);
  if (nextHtml !== html) return nextHtml;
  const replacement = `    <meta ${attr}="${key}" content="${escapeHtmlAttr(content)}">\n  </head>`;
  return html.replace('</head>', replacement);
};

const ensureAdsenseScript = (html) => {
  let nextHtml = replaceOrInsertMetaContent(html, 'name', 'google-adsense-account', ADSENSE_CLIENT);
  if (nextHtml.includes(ADSENSE_SCRIPT_URL)) return nextHtml;
  return nextHtml.replace(
    '</head>',
    `    <script async src="${ADSENSE_SCRIPT_URL}" crossorigin="anonymous"></script>\n  </head>`,
  );
};

const renderJsonLdScript = (payload) =>
  `    <script type="application/ld+json">\n${JSON.stringify(payload, null, 2).replace(/</g, '\\u003c')}\n    </script>`;

const extractSpaAssetTags = (indexHtml) => {
  const headMatch = String(indexHtml || '').match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch?.[1] || '';
  return Array.from(headHtml.matchAll(
    /<link\b[^>]+href="\/assets\/[^"]+"[^>]*>|<script\b[^>]+src="\/assets\/[^"]+"[^>]*>\s*<\/script>/gi,
  ))
    .map((match) => `    ${match[0].trim()}`)
    .join('\n');
};

const replaceJsonLdBlocks = (html, structuredData) => {
  if (!Array.isArray(structuredData) || structuredData.length === 0) return html;
  const scripts = structuredData.map(renderJsonLdScript).join('\n');
  const withoutExistingJsonLd = html.replace(
    /\s*<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi,
    '\n',
  );
  if (/<!-- OGP設定 -->/.test(withoutExistingJsonLd)) {
    return withoutExistingJsonLd.replace(/(\s*<!-- OGP設定 -->)/, `\n${scripts}\n$1`);
  }
  return withoutExistingJsonLd.replace('</head>', `${scripts}\n  </head>`);
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
  if (route.robotsContent) {
    html = replaceOrInsertMetaContent(html, 'name', 'robots', route.robotsContent);
  }
  html = replaceMetaContent(html, 'property', 'og:title', route.ogTitle);
  html = replaceMetaContent(html, 'property', 'og:description', route.ogDescription);
  html = replaceMetaContent(html, 'property', 'og:url', canonicalUrl);
  html = replaceMetaContent(html, 'name', 'twitter:title', route.ogTitle);
  html = replaceMetaContent(html, 'name', 'twitter:description', route.ogDescription);
  if (route.keywords) {
    html = replaceMetaContent(html, 'name', 'keywords', route.keywords);
  }
  if (route.author) {
    html = replaceMetaContent(html, 'name', 'author', route.author);
  }
  if (route.appName) {
    html = replaceMetaContent(html, 'name', 'application-name', route.appName);
  }
  if (route.appleTitle) {
    html = replaceMetaContent(html, 'name', 'apple-mobile-web-app-title', route.appleTitle);
  }
  if (route.ogLocale) {
    html = replaceMetaContent(html, 'property', 'og:locale', route.ogLocale);
  }
  if (route.siteName) {
    html = replaceMetaContent(html, 'property', 'og:site_name', route.siteName);
  }
  if (route.imageAlt) {
    html = replaceMetaContent(html, 'property', 'og:image:alt', route.imageAlt);
    html = replaceMetaContent(html, 'name', 'twitter:image:alt', route.imageAlt);
  }
  if (route.noscriptHtml) {
    html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, route.noscriptHtml);
  }
  html = replaceJsonLdBlocks(html, route.structuredData);
  if (route.requireAdsenseScript) {
    html = ensureAdsenseScript(html);
  }
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

const buildPlantRouteMetadata = (plantName, locale) => {
  const encodedPlantName = encodeURIComponent(plantName);
  if (locale === 'en') {
    return {
      lang: 'en',
      title: `${plantName} | Plant Profile | ${EN_SITE_NAME}`,
      description: `Interactive plant profile for ${plantName}, showing recorded plant-insect relationships from Japan.`,
      canonicalPath: `/en/plant/${encodedPlantName}`,
      alternates: [
        { hreflang: 'ja', path: `/plant/${encodedPlantName}` },
        { hreflang: 'en', path: `/en/plant/${encodedPlantName}` },
        { hreflang: 'x-default', path: `/en/plant/${encodedPlantName}` },
      ],
      appName: EN_SITE_NAME,
      appleTitle: EN_SITE_NAME,
      ogTitle: `${plantName} | Plant Profile | ${EN_SITE_NAME}`,
      ogDescription: `Explore insects recorded from ${plantName} and related host-plant records from Japan.`,
      siteName: EN_SITE_NAME,
      author: EN_SITE_NAME,
      keywords: `${plantName}, Japanese host plants, plant-insect relationships, Japan biodiversity`,
      ogLocale: 'en_US',
      imageAlt: DEFAULT_SOCIAL_IMAGE_ALT_EN,
      robotsContent: SPA_ROUTE_NOINDEX_ROBOTS,
    };
  }
  return {
    lang: 'ja',
    title: `${plantName} | 昆虫植物図鑑`,
    description: `${plantName}を利用する昆虫と食草・訪花関係を検索できる昆虫植物図鑑の植物詳細ページ。`,
    canonicalPath: `/plant/${encodedPlantName}`,
    alternates: [
      { hreflang: 'ja', path: `/plant/${encodedPlantName}` },
      { hreflang: 'en', path: `/en/plant/${encodedPlantName}` },
      { hreflang: 'x-default', path: `/en/plant/${encodedPlantName}` },
    ],
    ogTitle: `${plantName} | 昆虫植物図鑑`,
    ogDescription: `${plantName}を利用する昆虫と食草・訪花関係を検索できます。`,
    robotsContent: SPA_ROUTE_NOINDEX_ROBOTS,
  };
};

const buildPlantProfileRouteShell = (indexHtml, plantName, locale = 'ja') => {
  const route = buildPlantRouteMetadata(plantName, locale);
  const canonicalUrl = `${BASE_ORIGIN}${route.canonicalPath}`;
  const assetTags = extractSpaAssetTags(indexHtml);
  if (!assetTags) {
    const routeFlag = `    <script>${PLANT_PROFILE_ROUTE_SHELL_MARKER} = ${JSON.stringify(plantName)};</script>\n`;
    const html = buildSpaRouteShell(indexHtml, route);
    return html.includes(PLANT_PROFILE_ROUTE_SHELL_MARKER)
      ? html
      : html.replace('</head>', `${routeFlag}  </head>`);
  }

  const alternateLinks = route.alternates
    .map(({ hreflang, path: routePath }) =>
      `    <link rel="alternate" hreflang="${escapeHtmlAttr(hreflang)}" href="${escapeHtmlAttr(`${BASE_ORIGIN}${routePath}`)}">`)
    .join('\n');
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.title,
    description: route.description,
    url: canonicalUrl,
    inLanguage: route.lang,
    isPartOf: {
      '@type': 'WebSite',
      name: route.lang === 'en' ? EN_SITE_NAME : '昆虫植物図鑑',
      url: `${BASE_ORIGIN}${route.lang === 'en' ? '/en/' : '/'}`,
    },
  };

  return `<!doctype html>
<html lang="${escapeHtmlAttr(route.lang)}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtmlText(route.title)}</title>
    <meta name="description" content="${escapeHtmlAttr(route.description)}">
    <meta name="robots" content="${escapeHtmlAttr(route.robotsContent || SPA_ROUTE_NOINDEX_ROBOTS)}">
    <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
${alternateLinks}
    <meta property="og:title" content="${escapeHtmlAttr(route.ogTitle)}">
    <meta property="og:description" content="${escapeHtmlAttr(route.ogDescription)}">
    <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttr(route.ogTitle)}">
    <meta name="twitter:description" content="${escapeHtmlAttr(route.ogDescription)}">
${renderJsonLdScript(structuredData)}
    <script>window.__SEO_FORCE_NOINDEX__ = true; ${PLANT_PROFILE_ROUTE_SHELL_MARKER} = ${JSON.stringify(plantName)};</script>
${assetTags}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
};

const readTextIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
};

const decodeRouteSegment = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const isSafeRouteSegment = (segment) => {
  const value = String(segment || '').trim();
  return Boolean(value && !/[\/\\\0]/.test(value));
};

const collectExistingPlantRouteIndexes = (baseDir) => {
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const plantName = decodeRouteSegment(entry.name);
      return {
        plantName,
        sourceDir: path.join(baseDir, entry.name),
        targetDir: path.join(baseDir, plantName),
        indexPath: path.join(baseDir, entry.name, 'index.html'),
      };
    })
    .filter(({ plantName, indexPath }) => isSafeRouteSegment(plantName) && fs.existsSync(indexPath));
};

const ensurePlantProfileRouteShells = () => {
  try {
    const indexPath = path.join('dist', 'index.html');
    if (!fs.existsSync(indexPath)) return;

    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const routeGroups = [
      { baseDir: path.join('dist', 'plant'), locale: 'ja' },
      { baseDir: path.join('dist', 'en', 'plant'), locale: 'en' },
    ];
    let count = 0;

    for (const { baseDir, locale } of routeGroups) {
      const routes = collectExistingPlantRouteIndexes(baseDir);
      for (const { plantName, sourceDir, targetDir } of routes) {
        const routeIndexPath = path.join(targetDir, 'index.html');
        const shellHtml = buildPlantProfileRouteShell(indexHtml, plantName, locale);
        fs.mkdirSync(targetDir, { recursive: true });
        if (readTextIfExists(routeIndexPath) !== shellHtml) {
          fs.writeFileSync(routeIndexPath, shellHtml, 'utf8');
        }
        if (sourceDir !== targetDir && fs.existsSync(sourceDir)) {
          fs.rmSync(sourceDir, { recursive: true, force: true });
        }
        count++;
      }
    }

    console.log(`[postbuild] Synced ${count} plant profile SPA route shell(s).`);
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
