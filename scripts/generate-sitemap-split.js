import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// サイトマップを分割して生成
function generateSplitSitemaps() {
  console.log('分割サイトマップ生成を開始します...');

  const baseUrl = process.env.BASE_ORIGIN || 'https://orau98.github.io';

  // 各カテゴリごとのサイトマップを格納
  const sitemaps = {
    main: [],
    moth: [],
    butterfly: [],
    beetle: [],
    leafbeetle: [],
    plant: []
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
    const files = fs
      .readdirSync(absDir)
      .filter((f) => f.endsWith('.html'))
      .sort((a, b) => a.localeCompare(b, 'en'));

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

  const mothCount = addMetaDirToSitemap({
    key: 'moth',
    dir: '../public/meta/moth',
    routePrefix: '/meta/moth/',
    priority: '0.8',
    includeIndexInMain: true,
  });
  const butterflyCount = addMetaDirToSitemap({
    key: 'butterfly',
    dir: '../public/meta/butterfly',
    routePrefix: '/meta/butterfly/',
    priority: '0.8',
    includeIndexInMain: true,
  });
  const beetleCount = addMetaDirToSitemap({
    key: 'beetle',
    dir: '../public/meta/beetle',
    routePrefix: '/meta/beetle/',
    priority: '0.7',
    includeIndexInMain: false,
  });
  const leafCount = addMetaDirToSitemap({
    key: 'leafbeetle',
    dir: '../public/meta/leafbeetle',
    routePrefix: '/meta/leafbeetle/',
    priority: '0.7',
    includeIndexInMain: true,
  });
  const plantCount = addMetaDirToSitemap({
    key: 'plant',
    dir: '../public/meta/plant',
    routePrefix: '/meta/plant/',
    priority: '0.6',
    includeIndexInMain: true,
  });
  
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
    if (urls.length > 0) {
      const filename = name === 'main' ? 'sitemap-main.xml' : `sitemap-${name}.xml`;
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

  console.log('\nサイトマップインデックス生成完了');
  console.log('分割サイトマップ:');
  sitemapFiles.forEach(file => {
    console.log(`  - ${file.loc}`);
  });
  
  console.log('\n統計:');
  console.log(`- 蛾（meta）: ${mothCount} URL`);
  console.log(`- 蝶（meta）: ${butterflyCount} URL`);
  console.log(`- 甲虫（meta）: ${beetleCount} URL`);
  console.log(`- ハムシ（meta）: ${leafCount} URL`);
  console.log(`- 植物（meta）: ${plantCount} URL`);
  console.log(`- 合計: ${Object.values(sitemaps).reduce((sum, urls) => sum + urls.length, 0)} URLs`);
}

// メイン処理
generateSplitSitemaps();
