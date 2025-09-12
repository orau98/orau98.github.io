import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// サイトマップXMLを生成（メタページベース）
function generateSitemap() {
  console.log('サイトマップ生成を開始します（メタページベース）...');
  
  const baseUrl = 'https://orau98.github.io';
  // 正しい日付を使用
  const currentDate = '2025-08-12';
  
  let urls = [];
  
  // トップページ
  urls.push({
    loc: baseUrl + '/',
    lastmod: currentDate,
    changefreq: 'weekly',
    priority: '1.0'
  });
  
  // メタページディレクトリから実際のファイルを読み取る
  const metaDir = path.join(__dirname, '../public/meta');
  
  // ディレクトリ内のHTMLファイルをサイトマップに追加
  const addMetaPages = (dir, baseType, priority = '0.8') => {
    const fullPath = path.join(metaDir, baseType);
    if (!fs.existsSync(fullPath)) {
      console.log(`ディレクトリが存在しません: ${fullPath}`);
      return 0;
    }
    
    const files = fs.readdirSync(fullPath);
    let count = 0;
    
    files.forEach(file => {
      if (file.endsWith('.html')) {
        urls.push({
          loc: `${baseUrl}/meta/${baseType}/${file}`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: priority
        });
        count++;
      }
    });
    
    return count;
  };
  
  // 各タイプのメタページを追加
  const mothCount = addMetaPages(metaDir, 'moth', '0.8');
  const butterflyCount = addMetaPages(metaDir, 'butterfly', '0.8');
  const beetleCount = addMetaPages(metaDir, 'beetle', '0.8');
  const leafbeetleCount = addMetaPages(metaDir, 'leafbeetle', '0.8');
  const plantCount = addMetaPages(metaDir, 'plant', '0.7');
  
  // XMLを構築
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  urls.forEach(url => {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += '  </url>\n';
  });
  
  xml += '</urlset>';
  
  // サイトマップを保存
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf-8');
  
  // distディレクトリにもコピー
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    const distSitemapPath = path.join(distPath, 'sitemap.xml');
    fs.writeFileSync(distSitemapPath, xml, 'utf-8');
  }
  
  console.log(`サイトマップ生成完了: ${urls.length} URLs`);
  console.log(`- 蛾: ${mothCount}種`);
  console.log(`- 蝶: ${butterflyCount}種`);
  console.log(`- タマムシ: ${beetleCount}種`);
  console.log(`- ハムシ: ${leafbeetleCount}種`);
  console.log(`- 食草: ${plantCount}種`);
}

// メイン処理
generateSitemap();