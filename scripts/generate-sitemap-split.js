import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { META_PAGE_SECTIONS } from '../src/utils/siteTaxonomy.js';
import { isIndexablePlantProfile } from './lib/dataLiteBuilders.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(date) {
  return date.toISOString().split('T')[0];
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

function isNonCanonicalPage(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    return (
      /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html) ||
      /<meta\s+name=["']x-redirect-kind["']\s+content=["']taxonomy-merge["']/i.test(html)
    );
  } catch {
    return false;
  }
}

function getCanonicalUrl(filePath, fallbackUrl, baseUrl) {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    const href = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    if (!href) return fallbackUrl;
    const canonical = new URL(href, baseUrl);
    return canonical.origin === new URL(baseUrl).origin ? canonical.href : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function buildRobotsTxt(baseUrl) {
  // 正規の入口は sitemap.xml（分割サイトマップのインデックス）。
  // discovery-seed は、Search Console が大量の分割サイトマップを発見しきれない
  // 事例への対策として高価値URLを直接列挙する補助シード。
  // 同内容の重複エイリアスを複数並べると Search Console の統計が分裂するため、
  // ここには増やさないこと。
  const sitemapPaths = [
    '/sitemap.xml',
    '/search-console-discovery-seed.xml',
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

function writePublicAndDistFile(filename, content, distPath) {
  const publicPath = path.join(__dirname, '../public', filename);
  fs.writeFileSync(publicPath, content, 'utf-8');

  if (fs.existsSync(distPath)) {
    const distFilePath = path.join(distPath, filename);
    fs.writeFileSync(distFilePath, content, 'utf-8');
  }
}

function addStaticPageToMain(sitemaps, baseUrl, routePath, filePath, options = {}) {
  if (!fs.existsSync(filePath) || isNonCanonicalPage(filePath)) {
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

  // --- changefreq 差別化のためのデータ読み込み ---
  const today = new Date();
  const generatedAt = formatDate(today);
  // 全メタページ共通の lastmod。テンプレート変更やデータ一括更新で実際に
  // ページ本文が変わった日に、手動でこの日付を更新すること。
  // かつてはデータ充実度に応じて「今月1日/先月1日/3ヶ月前1日」を返す人工的な
  // lastmod を使っていたが、内容が変わらないのに毎月日付が転がる虚偽シグナルは
  // Google に lastmod 全体を無視される要因になるため廃止した。
  // 充実度の差別化は changefreq（weekly/monthly）にのみ反映する。
  const META_CONTENT_LASTMOD = '2026-07-13';

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
   * 昆虫メタページのデータが「豊富」（食草5件以上 または 生態情報あり）か。
   * changefreq の weekly/monthly 判定にのみ使う。
   */
  function isRichInsectPage(insectId) {
    const hostCount = hostplantCountMap.get(insectId) || 0;
    return hostCount >= 5 || ecoNoteSet.has(insectId);
  }

  /**
   * 植物メタページのファイル名（"植物名.html" or "植物名(科名).html"）から
   * 植物名を取り出し、hostplants.csv の利用昆虫が5種以上なら「豊富」と判定する。
   */
  function isRichPlantPage(filename) {
    // ファイル名から ".html" を除いたものが植物名（科名付き or なし）
    const rawName = filename.replace(/\.html$/i, '');
    // hostplants.csv の plant_name は科名なしが多いので、
    // "植物名(科名)" → "植物名" も試みる
    const baseName = rawName.replace(/\([^)]*科\)$/, '').trim();
    const count =
      plantInsectCountMap.get(rawName) ||
      plantInsectCountMap.get(baseName) ||
      0;
    return count >= 5;
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

  // 一覧ハブ（SPAルート）。postbuild-cleanup.mjs が dist に静的シェルを
  // 書き出すため 200 で配信される。lastmod は quiz と同じく index.html 基準。
  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/moth/',
    topLevelFile,
    { changefreq: 'weekly', priority: '0.8' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/plant/',
    topLevelFile,
    { changefreq: 'weekly', priority: '0.8' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/en/moth/',
    topLevelFile,
    { changefreq: 'weekly', priority: '0.7', targetKey: 'en-main' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/en/plant/',
    topLevelFile,
    { changefreq: 'weekly', priority: '0.7', targetKey: 'en-main' },
  );

  addStaticPageToMain(
    sitemaps,
    baseUrl,
    '/sitemap.html',
    path.join(__dirname, '../public/sitemap.html'),
    { changefreq: 'monthly', priority: '0.5' },
  );


  // 詳細ページのサイトマップURLは、静的メタページ自身が宣言するcanonicalを正とする。
  // メタHTMLは旧URLの互換入口として残し、検索エンジンには200を返す短い詳細URLを送る。
  const addMetaDirToSitemap = ({ key, dir, routePrefix, priority }) => {
    const absDir = path.join(__dirname, dir);
    if (!fs.existsSync(absDir)) {
      console.warn(`[sitemap] meta dir not found: ${absDir}`);
      return 0;
    }
    let files = fs
      .readdirSync(absDir)
      .filter((f) => f.endsWith('.html'))
      .sort((a, b) => a.localeCompare(b, 'en'));

    // 植物は基底名ページ（例「オニグルミ.html」）が正規ページで、
    // 科名付き（例「オニグルミ(クルミ科).html」）は noindex リダイレクトスタブ。
    // スタブは直後の非正規ページフィルタで除外されるため、ここでの特別扱いは不要。

    const preFilterCount = files.length;
    files = files.filter((file) => {
      if (file === 'index.html' || /^page-\d+\.html$/i.test(file)) return false;
      return !isNonCanonicalPage(path.join(absDir, file));
    });
    const removedNonCanonical = preFilterCount - files.length;
    if (removedNonCanonical > 0) {
      console.log(`[sitemap] ${key}: excluded noncanonical pages = ${removedNonCanonical}`);
    }

    // key から植物ページか昆虫ページかを判定（英語版は "en-plant", "en-moth" 等）
    const isPlantSection = key === 'plant' || key === 'en-plant';

    let count = 0;
    files.forEach((file) => {
      // changefreq: データが豊富なページは weekly、それ以外は monthly
      const isRich = isPlantSection
        ? isRichPlantPage(file)
        : isRichInsectPage(file.replace(/\.html$/i, ''));

      sitemaps[key].push({
        loc: getCanonicalUrl(
          path.join(absDir, file),
          `${baseUrl}${routePrefix}${encodeFilename(file)}`,
          baseUrl,
        ),
        lastmod: META_CONTENT_LASTMOD,
        changefreq: isRich ? 'weekly' : 'monthly',
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

  const generateSitemapIndexXML = (entries) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<!-- generated: ${generatedAt} -->\n`;
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    entries.forEach((sitemap) => {
      xml += '  <sitemap>\n';
      xml += `    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
      xml += `    <lastmod>${escapeXml(sitemap.lastmod)}</lastmod>\n`;
      xml += '  </sitemap>\n';
    });

    xml += '</sitemapindex>';
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

  const compareDiscoverySeedUrls = (a, b) => {
    const freqRank = (entry) => (entry.changefreq === 'weekly' ? 0 : 1);
    const freqDiff = freqRank(a) - freqRank(b);
    if (freqDiff !== 0) return freqDiff;
    const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return a.loc.localeCompare(b.loc, 'ja');
  };

  const takeDiscoverySeedUrls = (key, limit) =>
    (sitemaps[key] || [])
      .filter((entry) => !entry.loc.endsWith('/index.html'))
      .slice()
      .sort(compareDiscoverySeedUrls)
      .slice(0, limit);

  const plantDetailsPath = path.join(
    __dirname,
    '../public/assets/data-lite/plant-details.json',
  );
  const plantDetailsForDiscovery = fs.existsSync(plantDetailsPath)
    ? JSON.parse(fs.readFileSync(plantDetailsPath, 'utf8'))
    : {};
  const plantProfileDiscoveryUrls = (sitemaps.plant || []).filter((entry) => {
    try {
      const filename = decodeURIComponent(path.basename(new URL(entry.loc).pathname));
      const plantName = filename.replace(/\.html$/u, '');
      const detail = plantDetailsForDiscovery[plantName];
      const profiles = [detail?.profile, ...(detail?.additionalProfiles || [])]
        .filter(Boolean);
      return profiles.some((profile) => isIndexablePlantProfile(profile, detail));
    } catch {
      return false;
    }
  });

  const buildSearchConsoleDiscoverySeed = () => dedupeUrls([
    ...sitemaps.main,
    ...sitemaps['en-main'],
    // Search Console has previously been unreliable at discovering the large
    // split sitemap inventory. Add a bounded high-value seed of canonical
    // species and plant profile URLs so the preferred routes are submitted directly too.
    ...takeDiscoverySeedUrls('moth', 500),
    ...plantProfileDiscoveryUrls,
    ...takeDiscoverySeedUrls('plant', 220),
    ...takeDiscoverySeedUrls('longhornbeetle', 120),
    ...takeDiscoverySeedUrls('barkbeetle', 100),
    ...takeDiscoverySeedUrls('butterfly', 80),
    ...takeDiscoverySeedUrls('leafbeetle', 80),
    ...takeDiscoverySeedUrls('aphid', 80),
    ...takeDiscoverySeedUrls('beetle', 60),
    ...takeDiscoverySeedUrls('en-moth', 240),
    ...takeDiscoverySeedUrls('en-plant', 180),
    ...takeDiscoverySeedUrls('en-barkbeetle', 80),
  ]);
  
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
  const indexXml = generateSitemapIndexXML(sitemapFiles);

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

  // Search Console reports for this site have failed to discover the huge
  // sitemap aliases. Keep this file as a compact, high-value discovery seed;
  // the complete URL inventory remains available through sitemap.xml.
  const searchConsoleSubmitUrls = coreUrls.length > 0
    ? buildSearchConsoleDiscoverySeed()
    : [{ loc: `${baseUrl}/`, lastmod: generatedAt, changefreq: 'weekly', priority: '1.0' }];
  const searchConsoleSubmitXml = generateXML(
    searchConsoleSubmitUrls,
    { includeGeneratedComment: true, includeMetadata: true },
  ) + '\n';
  const searchConsoleSubmitText = `${searchConsoleSubmitUrls.map((url) => url.loc).join('\n')}\n`;
  const newestSearchConsoleSeedLastmod = searchConsoleSubmitUrls.reduce((latest, item) =>
    item.lastmod > latest ? item.lastmod : latest,
  '1970-01-01');
  const searchConsoleSeedFile = {
    loc: `${baseUrl}/search-console-discovery-seed.xml`,
    lastmod: newestSearchConsoleSeedLastmod,
  };
  const searchConsoleSubmitIndexXml = generateSitemapIndexXML([
    searchConsoleSeedFile,
    ...sitemapFiles,
  ]) + '\n';
  supplementalSitemapFiles.push(searchConsoleSeedFile);
  // search-console-submit.xml は過去に Search Console へ登録した実績のある
  // ファイル名のため互換として生成を継続する（内容はシード+分割サイトマップの
  // インデックス）。かつて生成していた gsc-*/google-*/search-console-sitemap.*
  // と RSS/Atom フィード（google-feed.xml/google-atom.xml）の同内容エイリアスは、
  // 重複送信で Search Console の統計を分裂させるだけのため廃止した。
  const searchConsoleFiles = {
    'search-console-discovery-seed.xml': searchConsoleSubmitXml,
    'search-console-discovery-seed.txt': searchConsoleSubmitText,
    'search-console-submit.xml': searchConsoleSubmitIndexXml,
    'search-console-submit.txt': searchConsoleSubmitText,
  };
  Object.entries(searchConsoleFiles).forEach(([filename, content]) => {
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
    const label = section.title;
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

  // changefreq 分布の集計ログ（メタページのみ）
  const allMetaUrls = [
    ...Object.keys(sectionCounts).flatMap((k) => sitemaps[k] || []),
    ...Object.keys(englishSectionCounts).flatMap((k) => sitemaps[k] || []),
  ];
  const changefreqDist = { weekly: 0, monthly: 0 };
  for (const u of allMetaUrls) {
    if (u.changefreq === 'weekly') changefreqDist.weekly++;
    else changefreqDist.monthly++;
  }
  console.log('\nchangefreq 分布（メタページ）:');
  console.log(`  weekly（データ豊富）: ${changefreqDist.weekly} URL`);
  console.log(`  monthly: ${changefreqDist.monthly} URL`);
}

// メイン処理
generateSplitSitemaps();
