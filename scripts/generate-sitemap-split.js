import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { META_PAGE_SECTIONS } from '../src/utils/siteTaxonomy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(date) {
  return date.toISOString().split('T')[0];
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

function buildRobotsTxt(baseUrl, sitemapFiles) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Primary sitemap index',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
    '# Child sitemaps (fallback for crawlers that fail sitemap index fetch)',
    ...sitemapFiles.map((sitemap) => `Sitemap: ${sitemap.loc}`),
    '',
  ];
  return lines.join('\n');
}

// サイトマップを分割して生成
function generateSplitSitemaps() {
  console.log('分割サイトマップ生成を開始します...');

  const baseUrl = process.env.BASE_ORIGIN || 'https://orau98.github.io';

  // 各カテゴリごとのサイトマップを格納
  const sitemaps = {
    main: [],
    ...Object.fromEntries(META_PAGE_SECTIONS.map(({ key }) => [key, []])),
  };
  const today = formatDate(new Date());
  
  const topLevelFile = path.join(__dirname, '../public/index.html');
  sitemaps.main.push({
    loc: `${baseUrl}/`,
    lastmod: getFileLastmod(topLevelFile),
    changefreq: 'weekly',
    priority: '1.0'
  });

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
      sitemaps.main.push({
        loc: `${baseUrl}${routePrefix}index.html`,
        lastmod: getFileLastmod(indexPath),
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    let count = 0;
    files.forEach((file) => {
      if (file === 'index.html') return;
      const filePath = path.join(absDir, file);
      sitemaps[key].push({
        loc: `${baseUrl}${routePrefix}${encodeFilename(file)}`,
        lastmod: getFileLastmod(filePath),
        changefreq: 'monthly',
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
  
  // XMLを生成する関数
  const generateXML = (urls) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    urls.forEach(url => {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
      xml += `    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n`;
      xml += `    <changefreq>${escapeXml(url.changefreq)}</changefreq>\n`;
      xml += `    <priority>${escapeXml(url.priority)}</priority>\n`;
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  };
  
  // 各サイトマップファイルを生成
  const sitemapFiles = [];
  
  Object.entries(sitemaps).forEach(([name, urls]) => {
    const filename = name === 'main' ? 'sitemap-main.xml' : `sitemap-${name}.xml`;
    if (urls.length > 0) {
      const xml = generateXML(urls);

      // publicディレクトリに保存
      const publicPath = path.join(__dirname, '../public', filename);
      fs.writeFileSync(publicPath, xml, 'utf-8');

      // distディレクトリにもコピー
      const distPath = path.join(__dirname, '../dist');
      if (fs.existsSync(distPath)) {
        const distSitemapPath = path.join(distPath, filename);
        fs.writeFileSync(distSitemapPath, xml, 'utf-8');
      }

      const newestLastmod = urls.reduce((latest, item) =>
        item.lastmod > latest ? item.lastmod : latest,
      '1970-01-01');

      sitemapFiles.push({
        loc: `${baseUrl}/${filename}`,
        lastmod: newestLastmod,
      });

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
  
  // サイトマップインデックスを生成
  let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  indexXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  sitemapFiles.forEach(sitemap => {
    indexXml += '  <sitemap>\n';
    indexXml += `    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
    indexXml += `    <lastmod>${escapeXml(sitemap.lastmod)}</lastmod>\n`;
    indexXml += '  </sitemap>\n';
  });
  
  indexXml += '</sitemapindex>';
  
  // サイトマップインデックスを保存（sitemap.xmlとして）
  const indexPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(indexPath, indexXml, 'utf-8');

  // distディレクトリにもコピー
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    const distIndexPath = path.join(distPath, 'sitemap.xml');
    fs.writeFileSync(distIndexPath, indexXml, 'utf-8');
  }

  const robotsTxt = buildRobotsTxt(baseUrl, sitemapFiles);
  const robotsPath = path.join(__dirname, '../public/robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8');
  if (fs.existsSync(distPath)) {
    const distRobotsPath = path.join(distPath, 'robots.txt');
    fs.writeFileSync(distRobotsPath, robotsTxt, 'utf-8');
  }

  console.log('\nサイトマップインデックス生成完了');
  console.log('分割サイトマップ:');
  sitemapFiles.forEach(file => {
    console.log(`  - ${file.loc}`);
  });
  
  console.log('\n統計:');
  META_PAGE_SECTIONS.forEach((section) => {
    const label = section.title.replace('（メタページ一覧）', '');
    console.log(`- ${label}（meta）: ${sectionCounts[section.key] || 0} URL`);
  });
  console.log(`- 合計: ${Object.values(sitemaps).reduce((sum, urls) => sum + urls.length, 0)} URLs`);
}

// メイン処理
generateSplitSitemaps();
