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
  
  const addSpaRoutes = (items, routeBuilder, target, priority = '0.7', lastmod = today) => {
    let count = 0;
    items.forEach(item => {
      if (!item) return;
      const loc = routeBuilder(item);
      if (!loc) return;
      target.push({
        loc: `${baseUrl}${loc}`,
        lastmod,
        changefreq: 'monthly',
        priority
      });
      count++;
    });
    return count;
  };
  
  const readJsonArray = (relativePath) => {
    const filePath = path.join(__dirname, relativePath);
    if (!fs.existsSync(filePath)) {
      console.warn(`[sitemap] JSONファイルが見つかりません: ${filePath}`);
      return { data: [], lastmod: today };
    }
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { data: Array.isArray(json) ? json : [], lastmod: getFileLastmod(filePath) };
  };
  
  const readJsonObject = (relativePath) => {
    const filePath = path.join(__dirname, relativePath);
    if (!fs.existsSync(filePath)) {
      console.warn(`[sitemap] JSONファイルが見つかりません: ${filePath}`);
      return { data: {}, lastmod: today };
    }
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { data: json && typeof json === 'object' ? json : {}, lastmod: getFileLastmod(filePath) };
  };
  
  const { data: moths } = readJsonArray('../public/assets/data-lite/moths.json');
  const { data: butterflies } = readJsonArray('../public/assets/data-lite/butterflies.json');
  const { data: beetles } = readJsonArray('../public/assets/data-lite/beetles.json');
  const { data: leafbeetles } = readJsonArray('../public/assets/data-lite/leafbeetles.json');
  const { data: hostplantsMap } = readJsonObject('../public/assets/data-lite/hostplants.json');
  
  const mothCount = addSpaRoutes(
    moths,
    (item) => (item.id ? `/moth/${encodeFilename(String(item.id))}` : null),
    sitemaps.moth,
    '0.8',
    today
  );
  const butterflyCount = addSpaRoutes(
    butterflies,
    (item) => (item.id ? `/butterfly/${encodeFilename(String(item.id))}` : null),
    sitemaps.butterfly,
    '0.8',
    today
  );
  const beetleCount = addSpaRoutes(
    beetles,
    (item) => (item.id ? `/beetle/${encodeFilename(String(item.id))}` : null),
    sitemaps.main,
    '0.7',
    today
  );
  const leafCount = addSpaRoutes(
    leafbeetles,
    (item) => (item.id ? `/leafbeetle/${encodeFilename(String(item.id))}` : null),
    sitemaps.leafbeetle,
    '0.7',
    today
  );
  
  const plantNames = Object.keys(hostplantsMap || {});
  const plantCount = addSpaRoutes(
    plantNames.map((name) => ({ name })),
    (item) => (item.name ? `/plant/${encodeFilename(item.name)}` : null),
    sitemaps.plant,
    '0.6',
    today
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
  console.log(`- 蛾: ${mothCount} URL`);
  console.log(`- 蝶: ${butterflyCount} URL`);
  console.log(`- 甲虫（メイン）: ${beetleCount} URL`);
  console.log(`- ハムシ: ${leafCount} URL`);
  console.log(`- 植物: ${plantCount} URL`);
  console.log(`- 合計: ${Object.values(sitemaps).reduce((sum, urls) => sum + urls.length, 0)} URLs`);
}

// メイン処理
generateSplitSitemaps();
