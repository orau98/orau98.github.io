import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { META_PAGE_SECTIONS } from '../src/utils/siteTaxonomy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * 基準日（today）から N ヶ月前の月初日を "YYYY-MM-DD" 形式で返す。
 * N=0 → 今月1日, N=1 → 先月1日, N=3 → 3ヶ月前の月初日
 */
function monthsAgoFirstDay(n, today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - n, 1));
  return formatDate(d);
}

/**
 * normalized_data/hostplants.csv を読み込み、
 * insect_id → 食草レコード数 のマップを返す。
 * CSV は UTF-8 (BOM 有無どちらも対応)。
 */
function buildHostplantCountMap(csvPath) {
  const map = new Map();
  if (!fs.existsSync(csvPath)) {
    console.warn(`[sitemap] hostplants.csv not found: ${csvPath}`);
    return map;
  }
  let content = fs.readFileSync(csvPath, 'utf-8');
  // BOM 除去
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const lines = content.split(/\r?\n/);
  // 1行目はヘッダー: record_id,insect_id,...
  // insect_id は列インデックス 1
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // カンマ分割（簡易。引用符内カンマは insect_id 列には存在しないため問題なし）
    const comma = line.indexOf(',');
    if (comma < 0) continue;
    const rest = line.slice(comma + 1);
    const comma2 = rest.indexOf(',');
    const insectId = comma2 >= 0 ? rest.slice(0, comma2) : rest;
    if (!insectId) continue;
    map.set(insectId, (map.get(insectId) || 0) + 1);
  }
  return map;
}

/**
 * normalized_data/general_notes.csv を読み込み、
 * 「生態情報」ノートを持つ insect_id の Set を返す。
 */
function buildEcoNoteSet(csvPath) {
  const set = new Set();
  if (!fs.existsSync(csvPath)) {
    console.warn(`[sitemap] general_notes.csv not found: ${csvPath}`);
    return set;
  }
  let content = fs.readFileSync(csvPath, 'utf-8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const lines = content.split(/\r?\n/);
  // ヘッダー: record_id,insect_id,note_type,...
  // insect_id=1, note_type=2
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const insectId = parts[1];
    const noteType = parts[2];
    if (noteType && (noteType.includes('生態') || noteType.includes('生物'))) {
      set.add(insectId);
    }
  }
  return set;
}

/**
 * normalized_data/hostplants.csv から plant_name → 昆虫種数 のマップを返す。
 * plant_name は列インデックス 2。
 */
function buildPlantInsectCountMap(csvPath) {
  const map = new Map();
  if (!fs.existsSync(csvPath)) return map;
  let content = fs.readFileSync(csvPath, 'utf-8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const lines = content.split(/\r?\n/);
  // ヘッダー: record_id,insect_id,plant_name,...
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const plantName = parts[2].trim();
    if (!plantName) continue;
    if (!map.has(plantName)) map.set(plantName, new Set());
    const insectId = parts[1].trim();
    if (insectId) map.get(plantName).add(insectId);
  }
  // Set → count に変換
  const countMap = new Map();
  for (const [name, ids] of map) {
    countMap.set(name, ids.size);
  }
  return countMap;
}

function encodeFilename(filename) {
  return encodeURIComponent(filename).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

function getFileLastmod(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const now = Date.now();
    const clamped = Math.min(stat.mtimeMs || stat.mtime.getTime(), now);
    return formatDate(new Date(clamped));
  } catch {
    return formatDate(new Date());
  }
}

function isNoindexPage(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
  } catch {
    return false;
  }
}

function buildRobotsTxt(baseUrl) {
  const sitemapPaths = [
    '/sitemap.xml',
    '/search-console-submit.xml',
  ];

  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    ...sitemapPaths.map((sitemapPath) => `Sitemap: ${baseUrl}${sitemapPath}`),
    '',
  ];
  return lines.join('\n');
}

function formatRfc822Date(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toUTCString();
}

function writePublicAndDistFile(filename, content, distPath) {
  const publicPath = path.join(__dirname, '../public', filename);
  fs.writeFileSync(publicPath, content, 'utf-8');

  if (fs.existsSync(distPath)) {
    const distFilePath = path.join(distPath, filename);
    fs.writeFileSync(distFilePath, content, 'utf-8');
  }
}

function buildGoogleFallbackFiles(baseUrl, generatedAt) {
  const homepage = `${baseUrl}/`;
  const indexPage = `${baseUrl}/index.html`;
  const hubUrl = 'https://pubsubhubbub.appspot.com/';
  const rfc822Date = formatRfc822Date(generatedAt);
  const escapedHomepage = escapeXml(homepage);
  const escapedIndexPage = escapeXml(indexPage);
  const escapedHubUrl = escapeXml(hubUrl);
  const escapedGeneratedAt = escapeXml(generatedAt);

  return {
    'search-console-sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url>',
      `    <loc>${escapedHomepage}</loc>`,
      `    <lastmod>${escapedGeneratedAt}</lastmod>`,
      '  </url>',
      '</urlset>',
      '',
    ].join('\n'),
    'gsc-sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url>',
      `    <loc>${escapedHomepage}</loc>`,
      '  </url>',
      '</urlset>',
      '',
    ].join('\n'),
    'gsc-index-sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url>',
      `    <loc>${escapedIndexPage}</loc>`,
      '  </url>',
      '</urlset>',
      '',
    ].join('\n'),
    'search-console-sitemap.txt': `${homepage}\n`,
    'gsc-sitemap.txt': `${homepage}\n`,
    'google-sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url>',
      `    <loc>${escapedHomepage}</loc>`,
      `    <lastmod>${escapedGeneratedAt}</lastmod>`,
      '  </url>',
      '</urlset>',
      '',
    ].join('\n'),
    'google-sitemap.txt': `${homepage}\n`,
    'google-feed.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      '    <title>orau98.github.io</title>',
      `    <link>${escapedHomepage}</link>`,
      '    <description>orau98.github.io sitemap feed</description>',
      `    <atom:link href="${escapeXml(`${baseUrl}/google-feed.xml`)}" rel="self" type="application/rss+xml"/>`,
      `    <atom:link href="${escapedHubUrl}" rel="hub"/>`,
      `    <lastBuildDate>${escapeXml(rfc822Date)}</lastBuildDate>`,
      '    <language>ja</language>',
      '    <ttl>60</ttl>',
      '    <item>',
      '      <title>orau98.github.io</title>',
      `      <link>${escapedHomepage}</link>`,
      '      <description>昆虫植物図鑑のトップページ</description>',
      `      <guid isPermaLink="true">${escapedHomepage}</guid>`,
      `      <pubDate>${escapeXml(rfc822Date)}</pubDate>`,
      '    </item>',
      '  </channel>',
      '</rss>',
      '',
    ].join('\n'),
    'google-atom.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<feed xmlns="http://www.w3.org/2005/Atom">',
      '  <title>orau98.github.io</title>',
      `  <link href="${escapedHomepage}"/>`,
      `  <link rel="self" href="${escapeXml(`${baseUrl}/google-atom.xml`)}"/>`,
      `  <link rel="hub" href="${escapedHubUrl}"/>`,
      `  <updated>${escapedGeneratedAt}T00:00:00Z</updated>`,
      `  <id>${escapedHomepage}</id>`,
      '  <entry>',
      '    <title>orau98.github.io</title>',
      `    <link href="${escapedHomepage}"/>`,
      `    <id>${escapedHomepage}</id>`,
      `    <updated>${escapedGeneratedAt}T00:00:00Z</updated>`,
      '    <summary>昆虫植物図鑑のトップページ</summary>',
      '  </entry>',
      '</feed>',
      '',
    ].join('\n'),
  };
}

function addStaticPageToMain(sitemaps, baseUrl, routePath, filePath, options = {}) {
  if (!fs.existsSync(filePath) || isNoindexPage(filePath)) {
    return false;
  }
  const targetKey = options.targetKey || 'main';
  sitemaps[targetKey].push({
    loc: `${baseUrl}${routePath}`,
    lastmod: getFileLastmod(filePath),
    changefreq: options.changefreq || 'monthly',
    priority: options.priority || '0.6',
  });
  return true;
}

function addStaticDirectoryToMain(sitemaps, baseUrl, absDir, routePrefix, options = {}) {
  if (!fs.existsSync(absDir)) return 0;

  const files = fs
    .readdirSync(absDir)
    .filter((name) => name.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  let count = 0;
  files.forEach((file) => {
    const filePath = path.join(absDir, file);
    const routePath = `${routePrefix}${encodeFilename(file)}`;
    const added = addStaticPageToMain(sitemaps, baseUrl, routePath, filePath, options);
    if (added) count++;
  });
  return count;
}

const EN_META_PAGE_SECTIONS = META_PAGE_SECTIONS.map((section) => ({
  ...section,
  key: `en-${section.key}`,
  dir: section.dir,
  title: `English ${section.title}`,
  routePrefix: `/en/meta/${section.dir}/`,
}));

// サイトマップを分割して生成
function generateSplitSitemaps() {
  console.log('分割サイトマップ生成を開始します...');

  const baseUrl = process.env.BASE_ORIGIN || 'https://orau98.github.io';

  // --- lastmod 差別化のためのデータ読み込み ---
  const today = new Date();
  const generatedAt = formatDate(today);
  const DATE_RICH    = monthsAgoFirstDay(0, today); // 今月1日: データが豊富
  const DATE_MEDIUM  = monthsAgoFirstDay(1, today); // 先月1日: データが中程度
  const DATE_SPARSE  = monthsAgoFirstDay(3, today); // 3ヶ月前1日: データが少ない

  const normalizedDataDir = path.join(__dirname, '../normalized_data');
  const hostplantCountMap = buildHostplantCountMap(
    path.join(normalizedDataDir, 'hostplants.csv'),
  );
  const ecoNoteSet = buildEcoNoteSet(
    path.join(normalizedDataDir, 'general_notes.csv'),
  );
  const plantInsectCountMap = buildPlantInsectCountMap(
    path.join(normalizedDataDir, 'hostplants.csv'),
  );

  console.log(
    `[sitemap] hostplant entries loaded: ${hostplantCountMap.size} insect IDs, ` +
    `ecoNote IDs: ${ecoNoteSet.size}, plant entries: ${plantInsectCountMap.size}`,
  );

  /**
   * 昆虫メタページの insect_id からlastmodを決定する。
   * - 食草5件以上 または 生態情報あり → DATE_RICH
   * - 食草1-4件                      → DATE_MEDIUM
   * - 食草なし                        → DATE_SPARSE
   */
  function resolveInsectLastmod(insectId) {
    const hostCount = hostplantCountMap.get(insectId) || 0;
    const hasEco = ecoNoteSet.has(insectId);
    if (hostCount >= 5 || hasEco) return DATE_RICH;
    if (hostCount >= 1) return DATE_MEDIUM;
    return DATE_SPARSE;
  }

  /**
   * 植物メタページのファイル名（"植物名.html" or "植物名(科名).html"）から
   * 植物名を取り出し、hostplants.csv の昆虫種数でlastmodを決定する。
   * - 5種以上 → DATE_RICH
   * - 1-4種  → DATE_MEDIUM
   * - 0種    → DATE_SPARSE
   */
  function resolvePlantLastmod(filename) {
    // ファイル名から ".html" を除いたものが植物名（科名付き or なし）
    const rawName = filename.replace(/\.html$/i, '');
    // hostplants.csv の plant_name は科名なしが多いので、
    // "植物名(科名)" → "植物名" も試みる
    const baseName = rawName.replace(/\([^)]*科\)$/, '').trim();
    const count =
      plantInsectCountMap.get(rawName) ||
      plantInsectCountMap.get(baseName) ||
      0;
    if (count >= 5) return DATE_RICH;
    if (count >= 1) return DATE_MEDIUM;
    return DATE_SPARSE;
  }

  // 各カテゴリごとのサイトマップを格納
  const sitemaps = {
    main: [],
    'en-main': [],
    ...Object.fromEntries(META_PAGE_SECTIONS.map(({ key }) => [key, []])),
    ...Object.fromEntries(EN_META_PAGE_SECTIONS.map(({ key }) => [key, []])),
  };
  
  const topLevelFile = path.join(__dirname, '../index.html');
  sitemaps.main.push({
    loc: `${baseUrl}/`,
    lastmod: getFileLastmod(topLevelFile),
    changefreq: 'weekly',
    priority: '1.0'
  });

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/quiz/',
    topLevelFile,
    { changefreq: 'weekly', priority: '0.8' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/en/',
    path.join(__dirname, '../public/en/index.html'),
    { changefreq: 'weekly', priority: '0.9', targetKey: 'en-main' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/en/quiz/',
    topLevelFile,
    { changefreq: 'weekly', priority: '0.8', targetKey: 'en-main' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/sitemap.html',
    path.join(__dirname, '../public/sitemap.html'),
    { changefreq: 'monthly', priority: '0.5' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/guides/',
    path.join(__dirname, '../public/guides/index.html'),
    { changefreq: 'monthly', priority: '0.7' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/guides/host-plant-search.html',
    path.join(__dirname, '../public/guides/host-plant-search.html'),
    { changefreq: 'monthly', priority: '0.7' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/en/guides/',
    path.join(__dirname, '../public/en/guides/index.html'),
    { changefreq: 'monthly', priority: '0.7', targetKey: 'en-main' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/en/guides/host-plant-search.html',
    path.join(__dirname, '../public/en/guides/host-plant-search.html'),
    { changefreq: 'monthly', priority: '0.7', targetKey: 'en-main' },
  );

  // NOTE:
  // GitHub Pages の SPA ルート（/moth/... など）は HTTP 404 になるため、
  // 検索エンジン向けのサイトマップは 200 を返す静的メタページ（/meta/.../*.html）を列挙する。
  const addMetaDirToSitemap = ({ key, dir, routePrefix, priority, includeIndexInMain = true }) => {
    const absDir = path.join(__dirname, dir);
    if (!fs.existsSync(absDir)) {
      console.warn(`[sitemap] meta dir not found: ${absDir}`);
      return 0;
    }
    let files = fs
      .readdirSync(absDir)
      .filter((f) => f.endsWith('.html'))
      .sort((a, b) => a.localeCompare(b, 'en'));

    // 植物は「科名付きが正」として、科名なしエイリアスをサイトマップから除外
    if (key === 'plant') {
      const aliasBases = new Set();
      files.forEach((file) => {
        if (file === 'index.html') return;
        const base = file.replace(/\.html$/i, '');
        const m = base.match(/^(.+?)\(([^)]+科)\)$/);
        if (m) aliasBases.add(m[1]);
      });
      files = files.filter((file) => {
        if (file === 'index.html') return true;
        const base = file.replace(/\.html$/i, '');
        const isFamilyVariant = /\([^)]*科\)$/.test(base);
        if (!isFamilyVariant && aliasBases.has(base)) return false;
        return true;
      });
    }

    const preNoindexCount = files.length;
    files = files.filter((file) => {
      if (file === 'index.html') return true;
      return !isNoindexPage(path.join(absDir, file));
    });
    const removedByNoindex = preNoindexCount - files.length;
    if (removedByNoindex > 0) {
      console.log(`[sitemap] ${key}: excluded noindex pages = ${removedByNoindex}`);
    }

    // index.html はカテゴリの入口なので main に入れる（重複・分散を避ける）
    if (includeIndexInMain && files.includes('index.html')) {
      const indexPath = path.join(absDir, 'index.html');
      const targetMain = routePrefix.startsWith('/en/') ? sitemaps['en-main'] : sitemaps.main;
      targetMain.push({
        loc: `${baseUrl}${routePrefix}index.html`,
        lastmod: getFileLastmod(indexPath),
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    // key から植物ページか昆虫ページかを判定（英語版は "en-plant", "en-moth" 等）
    const isPlantSection = key === 'plant' || key === 'en-plant';

    let count = 0;
    files.forEach((file) => {
      if (file === 'index.html') return;

      // lastmod: ファイルの mtime ではなくデータ充実度で決定する
      let lastmod;
      if (isPlantSection) {
        // 植物ページ: ファイル名（植物名）から昆虫種数で決定
        lastmod = resolvePlantLastmod(file);
      } else {
        // 昆虫ページ: ファイル名が "insect_id.html" なので insect_id を抽出
        const insectId = file.replace(/\.html$/i, '');
        lastmod = resolveInsectLastmod(insectId);
      }

      // changefreq: データが豊富なページは weekly、それ以外は monthly
      const changefreq = lastmod === DATE_RICH ? 'weekly' : 'monthly';

      sitemaps[key].push({
        loc: `${baseUrl}${routePrefix}${encodeFilename(file)}`,
        lastmod,
        changefreq,
        priority,
      });
      count++;
    });
    return count;
  };

  const sectionCounts = Object.fromEntries(
    META_PAGE_SECTIONS.map((section) => [
      section.key,
      addMetaDirToSitemap({
        key: section.key,
        dir: `../public/meta/${section.dir}`,
        routePrefix: section.routePrefix,
        priority: section.priority,
        includeIndexInMain: true,
      }),
    ]),
  );
  const englishSectionCounts = Object.fromEntries(
    EN_META_PAGE_SECTIONS.map((section) => [
      section.key,
      addMetaDirToSitemap({
        key: section.key,
        dir: `../public/en/meta/${section.dir}`,
        routePrefix: section.routePrefix,
        priority: section.priority,
        includeIndexInMain: true,
      }),
    ]),
  );
  
  // XMLを生成する関数
  const generateXML = (urls, options = {}) => {
    const {
      includeGeneratedComment = true,
      includeMetadata = true,
    } = options;
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    if (includeGeneratedComment) {
      xml += `<!-- generated: ${generatedAt} -->\n`;
    }
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    urls.forEach(url => {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
      if (includeMetadata) {
        xml += `    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n`;
        xml += `    <changefreq>${escapeXml(url.changefreq)}</changefreq>\n`;
        xml += `    <priority>${escapeXml(url.priority)}</priority>\n`;
      }
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  };

  const generateSitemapFile = (filename, urls) => {
    if (!Array.isArray(urls) || urls.length === 0) return null;
    const xml = generateXML(urls);
    const publicPath = path.join(__dirname, '../public', filename);
    fs.writeFileSync(publicPath, xml, 'utf-8');

    const distPath = path.join(__dirname, '../dist');
    if (fs.existsSync(distPath)) {
      const distSitemapPath = path.join(distPath, filename);
      fs.writeFileSync(distSitemapPath, xml, 'utf-8');
    }

    const newestLastmod = urls.reduce((latest, item) =>
      item.lastmod > latest ? item.lastmod : latest,
    '1970-01-01');

    return {
      loc: `${baseUrl}/${filename}`,
      lastmod: newestLastmod,
    };
  };

  const generateTextSitemapFile = (filename, urls) => {
    if (!Array.isArray(urls) || urls.length === 0) return null;
    const text = `${urls.map((url) => url.loc).join('\n')}\n`;
    const publicPath = path.join(__dirname, '../public', filename);
    fs.writeFileSync(publicPath, text, 'utf-8');

    const distPath = path.join(__dirname, '../dist');
    if (fs.existsSync(distPath)) {
      const distSitemapPath = path.join(distPath, filename);
      fs.writeFileSync(distSitemapPath, text, 'utf-8');
    }

    const newestLastmod = urls.reduce((latest, item) =>
      item.lastmod > latest ? item.lastmod : latest,
    '1970-01-01');

    return {
      loc: `${baseUrl}/${filename}`,
      lastmod: newestLastmod,
    };
  };

  const dedupeUrls = (urls) => {
    const unique = new Map();
    urls.forEach((entry) => {
      if (!entry?.loc) return;
      if (!unique.has(entry.loc)) unique.set(entry.loc, entry);
    });
    return Array.from(unique.values());
  };
  
  // 各サイトマップファイルを生成
  const sitemapFiles = [];
  const supplementalSitemapFiles = [];
  
  Object.entries(sitemaps).forEach(([name, urls]) => {
    const filename = name === 'main' ? 'sitemap-main.xml' : `sitemap-${name}.xml`;
    if (urls.length > 0) {
      const generated = generateSitemapFile(filename, urls);
      if (generated) sitemapFiles.push(generated);

      console.log(`${filename} 生成完了: ${urls.length} URLs`);
    } else {
      // urls が 0 のカテゴリは、古いサイトマップが残って誤解を招かないよう削除する
      const publicPath = path.join(__dirname, '../public', filename);
      if (fs.existsSync(publicPath)) {
        fs.rmSync(publicPath, { force: true });
        console.log(`${filename} を削除: URLs=0`);
      }
      const distPath = path.join(__dirname, '../dist');
      if (fs.existsSync(distPath)) {
        const distSitemapPath = path.join(distPath, filename);
        if (fs.existsSync(distSitemapPath)) {
          fs.rmSync(distSitemapPath, { force: true });
        }
      }
    }
  });

  const coreUrls = dedupeUrls([...sitemaps.main, ...sitemaps['en-main']]);
  const allUrls = dedupeUrls(Object.values(sitemaps).flat());

  const fullTextSitemapFile = generateTextSitemapFile('sitemap-all.txt', allUrls);
  if (fullTextSitemapFile) {
    supplementalSitemapFiles.push(fullTextSitemapFile);
    console.log(`sitemap-all.txt 生成完了: ${allUrls.length} URLs`);
  }
  const coreSitemapFile = generateSitemapFile('sitemap-core.xml', coreUrls);
  if (coreSitemapFile) {
    supplementalSitemapFiles.push(coreSitemapFile);
    console.log(`sitemap-core.xml 生成完了: ${coreUrls.length} URLs`);
  }

  const rootTextSitemapFile = generateTextSitemapFile('sitemap.txt', allUrls);
  if (rootTextSitemapFile) {
    console.log(`sitemap.txt 生成完了: ${allUrls.length} URLs`);
  }

  // 分割サイトマップインデックスを生成
  let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  indexXml += `<!-- generated: ${generatedAt} -->\n`;
  indexXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  sitemapFiles.forEach(sitemap => {
    indexXml += '  <sitemap>\n';
    indexXml += `    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
    indexXml += `    <lastmod>${escapeXml(sitemap.lastmod)}</lastmod>\n`;
    indexXml += '  </sitemap>\n';
  });

  indexXml += '</sitemapindex>';

  // 分割サイトマップインデックスを保存
  const distPath = path.join(__dirname, '../dist');
  const rootSitemapPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(rootSitemapPath, indexXml, 'utf-8');

  const indexPath = path.join(__dirname, '../public/sitemap-index.xml');
  fs.writeFileSync(indexPath, indexXml, 'utf-8');

  // Compatibility for previously submitted Search Console URLs that used
  // the common underscore variant instead of this repo's hyphenated filename.
  const legacyIndexPath = path.join(__dirname, '../public/sitemap_index.xml');
  fs.writeFileSync(legacyIndexPath, indexXml, 'utf-8');

  if (fs.existsSync(distPath)) {
    const distRootSitemapPath = path.join(distPath, 'sitemap.xml');
    fs.writeFileSync(distRootSitemapPath, indexXml, 'utf-8');

    const distIndexPath = path.join(distPath, 'sitemap-index.xml');
    fs.writeFileSync(distIndexPath, indexXml, 'utf-8');

    const distLegacyIndexPath = path.join(distPath, 'sitemap_index.xml');
    fs.writeFileSync(distLegacyIndexPath, indexXml, 'utf-8');
  }

  const googleFallbackFiles = buildGoogleFallbackFiles(baseUrl, generatedAt);
  const searchConsoleSubmitUrls = allUrls.length > 0
    ? allUrls
    : [{ loc: `${baseUrl}/`, lastmod: generatedAt, changefreq: 'weekly', priority: '1.0' }];
  const searchConsoleSubmitXml = generateXML(
    searchConsoleSubmitUrls,
    { includeGeneratedComment: true, includeMetadata: true },
  ) + '\n';
  const searchConsoleSubmitText = `${searchConsoleSubmitUrls.map((url) => url.loc).join('\n')}\n`;
  [
    'search-console-submit.xml',
    'search-console-sitemap.xml',
    'google-sitemap.xml',
    'gsc-sitemap.xml',
  ].forEach((filename) => {
    googleFallbackFiles[filename] = searchConsoleSubmitXml;
  });
  [
    'search-console-submit.txt',
    'search-console-sitemap.txt',
    'google-sitemap.txt',
    'gsc-sitemap.txt',
  ].forEach((filename) => {
    googleFallbackFiles[filename] = searchConsoleSubmitText;
  });
  Object.entries(googleFallbackFiles).forEach(([filename, content]) => {
    writePublicAndDistFile(filename, content, distPath);
  });

  const robotsTxt = buildRobotsTxt(baseUrl);
  const robotsPath = path.join(__dirname, '../public/robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8');
  if (fs.existsSync(distPath)) {
    const distRobotsPath = path.join(distPath, 'robots.txt');
    fs.writeFileSync(distRobotsPath, robotsTxt, 'utf-8');
  }

  console.log('\nルートサイトマップ生成完了');
  console.log(`  - ${baseUrl}/sitemap.xml (sitemap index, ${sitemapFiles.length} files)`);
  console.log('分割サイトマップ:');
  console.log(`  - ${baseUrl}/sitemap-index.xml`);
  [...supplementalSitemapFiles, ...sitemapFiles].forEach(file => {
    console.log(`  - ${file.loc}`);
  });
  
  console.log('\n統計:');
  META_PAGE_SECTIONS.forEach((section) => {
    const label = section.title.replace('（メタページ一覧）', '');
    console.log(`- ${label}（meta）: ${sectionCounts[section.key] || 0} URL`);
  });
  EN_META_PAGE_SECTIONS.forEach((section) => {
    const label = section.dir === 'plant'
      ? 'Plants'
      : `English ${section.dir}`;
    console.log(`- ${label}（en meta）: ${englishSectionCounts[section.key] || 0} URL`);
  });
  const totalUrls = Object.values(sitemaps).reduce((sum, urls) => sum + urls.length, 0);
  console.log(`- 合計: ${totalUrls} URLs`);

  // lastmod 分布の集計ログ（メタページのみ）
  const allMetaUrls = [
    ...Object.keys(sectionCounts).flatMap((k) => sitemaps[k] || []),
    ...Object.keys(englishSectionCounts).flatMap((k) => sitemaps[k] || []),
  ];
  const lastmodDist = { [DATE_RICH]: 0, [DATE_MEDIUM]: 0, [DATE_SPARSE]: 0, other: 0 };
  for (const u of allMetaUrls) {
    if (u.lastmod === DATE_RICH) lastmodDist[DATE_RICH]++;
    else if (u.lastmod === DATE_MEDIUM) lastmodDist[DATE_MEDIUM]++;
    else if (u.lastmod === DATE_SPARSE) lastmodDist[DATE_SPARSE]++;
    else lastmodDist.other++;
  }
  console.log('\nlastmod 分布（メタページ）:');
  console.log(`  ${DATE_RICH}（豊富・weekly）: ${lastmodDist[DATE_RICH]} URL`);
  console.log(`  ${DATE_MEDIUM}（中程度・monthly）: ${lastmodDist[DATE_MEDIUM]} URL`);
  console.log(`  ${DATE_SPARSE}（少ない・monthly）: ${lastmodDist[DATE_SPARSE]} URL`);
  if (lastmodDist.other > 0) console.log(`  その他: ${lastmodDist.other} URL`);
}

// メイン処理
generateSplitSitemaps();
