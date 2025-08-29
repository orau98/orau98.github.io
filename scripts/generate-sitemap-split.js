import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// サイトマップを分割して生成
function generateSplitSitemaps() {
  console.log('分割サイトマップ生成を開始します...');
  
  const baseUrl = 'https://orau98.github.io';
  // 現在の日付を動的に取得
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
  
  // 各カテゴリごとのサイトマップを格納
  const sitemaps = {
    main: [],
    moth: [],
    butterfly: [],
    leafbeetle: [],
    plant: []
  };
  
  // トップページ（メインサイトマップ）
  sitemaps.main.push({
    loc: baseUrl + '/',
    lastmod: currentDate,
    changefreq: 'weekly',
    priority: '1.0'
  });
  
  // 重要: サイトマップには静的にクロール可能なURL（meta配下・トップ等）のみ含め、
  // SPAルート（/moth/{id}, /leafbeetle/{id}, /plant/{name}）は除外する。
  // 理由: 404リダイレクト→index.htmlのSPA構成はクローラブルだが、
  // サイトマップのURLは「直接取得可能な静的URL」を優先した方が安定して取得されるため。
  
  // メタページディレクトリから実際のファイルを読み取る
  const metaDir = path.join(__dirname, '../public/meta');
  
  // ディレクトリ内のHTMLファイルを対応するサイトマップに追加
  const addMetaPages = (dir, baseType, targetSitemap, priority = '0.8') => {
    const fullPath = path.join(metaDir, baseType);
    if (!fs.existsSync(fullPath)) {
      console.log(`ディレクトリが存在しません: ${fullPath}`);
      return 0;
    }
    
    const files = fs.readdirSync(fullPath);
    let count = 0;
    
    files.forEach(file => {
      if (file.endsWith('.html')) {
        // ファイル名が無効（ハイフンで始まる等）でないかチェック
        if (file.startsWith('-') || file.startsWith('_')) {
          console.log(`無効なファイル名をスキップ: ${file}`);
          return;
        }
        
        targetSitemap.push({
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
  const mothMetaCount = addMetaPages(metaDir, 'moth', sitemaps.moth, '0.8');
  const butterflyMetaCount = addMetaPages(metaDir, 'butterfly', sitemaps.butterfly, '0.8');
  addMetaPages(metaDir, 'beetle', sitemaps.main, '0.8'); // beetleは少ないのでmainに含める
  const leafbeetleMetaCount = addMetaPages(metaDir, 'leafbeetle', sitemaps.leafbeetle, '0.8');
  const plantMetaCount = addMetaPages(metaDir, 'plant', sitemaps.plant, '0.7');
  
  // XMLを生成する関数
  const generateXML = (urls) => {
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
      
      sitemapFiles.push({
        loc: `${baseUrl}/${filename}`,
        lastmod: currentDate
      });
      
      console.log(`${filename} 生成完了: ${urls.length} URLs`);
    }
  });
  
  // サイトマップインデックスを生成
  let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  indexXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  sitemapFiles.forEach(sitemap => {
    indexXml += '  <sitemap>\n';
    indexXml += `    <loc>${sitemap.loc}</loc>\n`;
    indexXml += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
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

  // 一般的な別名（sitemap_index.xml）も出力しておく
  const indexAliasPublic = path.join(__dirname, '../public/sitemap_index.xml');
  fs.writeFileSync(indexAliasPublic, indexXml, 'utf-8');
  if (fs.existsSync(distPath)) {
    const indexAliasDist = path.join(distPath, 'sitemap_index.xml');
    fs.writeFileSync(indexAliasDist, indexXml, 'utf-8');
  }
  
  console.log('\nサイトマップインデックス生成完了');
  console.log('分割サイトマップ:');
  sitemapFiles.forEach(file => {
    console.log(`  - ${file.loc}`);
  });
  
  console.log('\n統計:');
  console.log(`- 蛾メタ: ${mothMetaCount}種`);
  console.log(`- 蝶メタ: ${butterflyMetaCount}種`);
  console.log(`- ハムシメタ: ${leafbeetleMetaCount}種`);
  console.log(`- 植物メタ: ${plantMetaCount}種`);
  console.log(`- 合計: ${Object.values(sitemaps).reduce((sum, urls) => sum + urls.length, 0)} URLs`);
}

// メイン処理
generateSplitSitemaps();
