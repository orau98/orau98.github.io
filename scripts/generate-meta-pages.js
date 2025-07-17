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

// HTMLテンプレートを生成する関数
function generateInsectHTML(insect, type) {
  const typeNames = {
    moth: '蛾',
    butterfly: '蝶',
    beetle: '甲虫',
    leafbeetle: 'ハムシ'
  };
  
  const hostPlants = insect.hostPlants || '不明';
  const scientificName = insect.scientificName || '';
  const imageUrl = insect.scientificFilename ? 
    `/insects-host-plant-explorer-/images/moths/${insect.scientificFilename}.jpg` : '';
  
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${insect.name} (${scientificName}) - ${typeNames[type]}図鑑</title>
  <meta name="description" content="${insect.name}の詳細情報。食草: ${hostPlants}">
  <meta name="keywords" content="${insect.name},${scientificName},${typeNames[type]},食草,昆虫図鑑">
  <link rel="canonical" href="https://h-amoto.github.io/insects-host-plant-explorer-/${type}/${insect.id}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${insect.name} (${scientificName}) - ${typeNames[type]}図鑑">
  <meta property="og:description" content="${insect.name}の詳細情報。食草: ${hostPlants}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://h-amoto.github.io/insects-host-plant-explorer-/${type}/${insect.id}">
  ${imageUrl ? `<meta property="og:image" content="https://h-amoto.github.io${imageUrl}">` : ''}
  <meta property="og:site_name" content="昆虫と食草の図鑑">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${insect.name} (${scientificName}) - ${typeNames[type]}図鑑">
  <meta property="twitter:description" content="${insect.name}の詳細情報。食草: ${hostPlants}">
  ${imageUrl ? `<meta property="twitter:image" content="https://h-amoto.github.io${imageUrl}">` : ''}
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${insect.name} (${scientificName}) - ${typeNames[type]}図鑑",
    "description": "${insect.name}の詳細情報。食草: ${hostPlants}",
    "url": "https://h-amoto.github.io/insects-host-plant-explorer-/${type}/${insect.id}",
    ${imageUrl ? `"image": "https://h-amoto.github.io${imageUrl}",` : ''}
    "author": {
      "@type": "Person",
      "name": "昆虫図鑑管理者"
    },
    "publisher": {
      "@type": "Organization",
      "name": "昆虫と食草の図鑑"
    }
  }
  </script>
  
  <meta http-equiv="refresh" content="0; url=/insects-host-plant-explorer-/${type}/${insect.id}">
</head>
<body>
  <h1>${insect.name} (${scientificName}) - ${typeNames[type]}図鑑</h1>
  <p>${insect.name}の詳細情報。食草: ${hostPlants}</p>
  <p><a href="/insects-host-plant-explorer-/${type}/${insect.id}">詳細ページへ移動</a></p>
</body>
</html>`;
}

// 植物のHTMLテンプレートを生成する関数
function generatePlantHTML(plantName, relatedInsects) {
  const insectsList = relatedInsects.map(insect => insect.name).join(', ');
  
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plantName} - 食草図鑑</title>
  <meta name="description" content="${plantName}を食草とする昆虫: ${insectsList}">
  <meta name="keywords" content="${plantName},食草,植物,昆虫図鑑">
  <link rel="canonical" href="https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(plantName)}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${plantName} - 食草図鑑">
  <meta property="og:description" content="${plantName}を食草とする昆虫: ${insectsList}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(plantName)}">
  <meta property="og:site_name" content="昆虫と食草の図鑑">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta property="twitter:title" content="${plantName} - 食草図鑑">
  <meta property="twitter:description" content="${plantName}を食草とする昆虫: ${insectsList}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${plantName} - 食草図鑑",
    "description": "${plantName}を食草とする昆虫: ${insectsList}",
    "url": "https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(plantName)}",
    "author": {
      "@type": "Person",
      "name": "昆虫図鑑管理者"
    },
    "publisher": {
      "@type": "Organization",
      "name": "昆虫と食草の図鑑"
    }
  }
  </script>
  
  <meta http-equiv="refresh" content="0; url=/insects-host-plant-explorer-/plant/${encodeURIComponent(plantName)}">
</head>
<body>
  <h1>${plantName} - 食草図鑑</h1>
  <p>${plantName}を食草とする昆虫: ${insectsList}</p>
  <p><a href="/insects-host-plant-explorer-/plant/${encodeURIComponent(plantName)}">詳細ページへ移動</a></p>
</body>
</html>`;
}

// メインの生成処理
async function generateMetaPages() {
  console.log('メタページ生成を開始します...');
  
  // 出力ディレクトリを作成
  const metaDir = path.join(__dirname, '../public/meta');
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }
  
  ['moth', 'butterfly', 'beetle', 'leafbeetle', 'plant'].forEach(type => {
    const typeDir = path.join(metaDir, type);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
  });
  
  try {
    // CSVデータを読み込み
    const csvData = loadCSV(path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_bokutou.csv'));
    
    // 昆虫データの処理
    let mothCount = 0, butterflyCount = 0, beetleCount = 0, leafbeetleCount = 0;
    const hostPlantsMap = new Map();
    
    csvData.forEach((row, index) => {
      const insectName = row['和名'] || row['種名'] || '';
      if (!insectName) return;
      
      const familyJapanese = row['科和名'] || row['科名'] || '';
      const scientificName = `${row['属名'] || ''} ${row['種小名'] || ''}`.trim();
      const hostPlants = row['食草'] || '不明';
      
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
      
      const insect = {
        id: counter,
        name: insectName,
        scientificName: scientificName,
        hostPlants: hostPlants,
        scientificFilename: scientificName.replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
      };
      
      // HTMLファイルを生成
      const html = generateInsectHTML(insect, type);
      const filename = path.join(__dirname, `../public/meta/${type}/${type}-${counter}.html`);
      fs.writeFileSync(filename, html);
      
      // 食草データを収集
      if (hostPlants && hostPlants !== '不明') {
        const plants = hostPlants.split(/[、,，]/).map(p => p.trim()).filter(p => p);
        plants.forEach(plant => {
          if (!hostPlantsMap.has(plant)) {
            hostPlantsMap.set(plant, []);
          }
          hostPlantsMap.get(plant).push(insect);
        });
      }
    });
    
    // 植物ページを生成
    let plantCount = 0;
    hostPlantsMap.forEach((insects, plantName) => {
      plantCount++;
      const html = generatePlantHTML(plantName, insects);
      const filename = path.join(__dirname, `../public/meta/plant/plant-${plantCount}.html`);
      fs.writeFileSync(filename, html);
    });
    
    console.log(`メタページ生成完了:`);
    console.log(`- 蛾: ${mothCount}種`);
    console.log(`- 蝶: ${butterflyCount}種`);
    console.log(`- 甲虫: ${beetleCount}種`);
    console.log(`- ハムシ: ${leafbeetleCount}種`);
    console.log(`- 食草: ${plantCount}種`);
    
  } catch (error) {
    console.error('メタページ生成中にエラーが発生しました:', error);
  }
}

// 実行
generateMetaPages();