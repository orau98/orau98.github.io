import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSVファイルを読み込む関数
function loadCSV(filePath) {
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  return Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  }).data;
}

// サイトマップXMLを生成
function generateSitemap() {
  console.log('サイトマップ生成を開始します...');
  
  const baseUrl = 'https://h-amoto.github.io/insects-host-plant-explorer-';
  const currentDate = new Date().toISOString().split('T')[0];
  
  let urls = [];
  
  // トップページ
  urls.push({
    loc: baseUrl + '/',
    lastmod: currentDate,
    changefreq: 'weekly',
    priority: '1.0'
  });
  
  try {
    // CSVデータを読み込み
    const csvData = loadCSV(path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_bokutou.csv'));
    
    // 昆虫データの処理
    let mothCount = 0, butterflyCount = 0, beetleCount = 0, leafbeetleCount = 0;
    const hostPlantsSet = new Set();
    
    csvData.forEach((row) => {
      const insectName = row['和名'] || row['種名'] || '';
      if (!insectName) return;
      
      const familyJapanese = row['科和名'] || row['科名'] || '';
      const hostPlants = row['食草'] || '';
      
      // 昆虫タイプを判定
      let type, counter;
      if (familyJapanese.includes('蛾') || familyJapanese === 'ヤガ科' || familyJapanese === 'シャチホコガ科') {
        type = 'moth';
        counter = ++mothCount;
      } else if (familyJapanese.includes('蝶') || familyJapanese === 'セセリチョウ科' || familyJapanese === 'アゲハチョウ科') {
        type = 'butterfly';
        counter = ++butterflyCount;
      } else if (familyJapanese === 'タマムシ科') {
        type = 'beetle';
        counter = ++beetleCount;
      } else if (familyJapanese === 'ハムシ科') {
        type = 'leafbeetle';
        counter = ++leafbeetleCount;
      } else {
        type = 'moth'; // デフォルト
        counter = ++mothCount;
      }
      
      // 昆虫ページのURL
      urls.push({
        loc: `${baseUrl}/${type}/${counter}`,
        lastmod: currentDate,
        changefreq: 'monthly',
        priority: '0.8'
      });
      
      // 食草データを収集
      if (hostPlants && hostPlants !== '不明') {
        const plants = hostPlants.split(/[、,，]/).map(p => p.trim()).filter(p => p);
        plants.forEach(plant => {
          if (plant) {
            hostPlantsSet.add(plant);
          }
        });
      }
    });
    
    // 植物ページのURL
    hostPlantsSet.forEach(plantName => {
      urls.push({
        loc: `${baseUrl}/plant/${encodeURIComponent(plantName)}`,
        lastmod: currentDate,
        changefreq: 'monthly',
        priority: '0.7'
      });
    });
    
    // XMLを生成
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n';
    
    urls.forEach(url => {
      xml += '  <url>\\n';
      xml += `    <loc>${url.loc}</loc>\\n`;
      xml += `    <lastmod>${url.lastmod}</lastmod>\\n`;
      xml += `    <changefreq>${url.changefreq}</changefreq>\\n`;
      xml += `    <priority>${url.priority}</priority>\\n`;
      xml += '  </url>\\n';
    });
    
    xml += '</urlset>';
    
    // ファイルに保存
    const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    fs.writeFileSync(sitemapPath, xml);
    
    console.log(`サイトマップ生成完了: ${urls.length} URLs`);
    console.log(`- 蛾: ${mothCount}種`);
    console.log(`- 蝶: ${butterflyCount}種`);
    console.log(`- 甲虫: ${beetleCount}種`);
    console.log(`- ハムシ: ${leafbeetleCount}種`);
    console.log(`- 食草: ${hostPlantsSet.size}種`);
    
  } catch (error) {
    console.error('サイトマップ生成中にエラーが発生しました:', error);
  }
}

// 実行
generateSitemap();