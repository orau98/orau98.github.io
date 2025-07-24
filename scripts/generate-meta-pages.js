import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 学名フォーマッティング関数 - 属名+種小名のみをイタリック体にし、著者名と年は通常体にする
function formatScientificNameHTML(scientificName) {
  if (!scientificName || scientificName.trim() === '') {
    return '';
  }

  const trimmed = scientificName.trim();
  
  // 括弧で囲まれた著者名と年を特定
  const authorMatch = trimmed.match(/^(.+?)\s*(\([^)]+\))?\s*$/);
  
  if (authorMatch) {
    const nameWithoutAuthor = authorMatch[1].trim();
    const authorInfo = authorMatch[2] || '';
    
    // 属名と種小名を分離（最初の2語のみを取得）
    const nameParts = nameWithoutAuthor.split(/\s+/);
    if (nameParts.length >= 2) {
      const binomialName = `${nameParts[0]} ${nameParts[1]}`;
      const extraInfo = nameParts.slice(2).join(' ');
      
      // イタリック体の学名 + 通常体の著者情報
      return `<em>${binomialName}</em>${extraInfo ? ' ' + extraInfo : ''}${authorInfo ? ' ' + authorInfo : ''}`;
    }
  }
  
  // フォールバック: 全体をイタリック体にする
  return `<em>${trimmed}</em>`;
}

// CSVファイルを読み込む関数
function loadCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`CSVファイルが見つかりません: ${filePath}`);
      console.error(`現在のディレクトリ: ${process.cwd()}`);
      console.error(`スクリプトのディレクトリ: ${__dirname}`);
      process.exit(1);
    }
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    return Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true
    }).data;
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error.message}`);
    process.exit(1);
  }
}

// 植物名として有効かどうかを検証
function isValidPlantName(plantName) {
  if (!plantName || typeof plantName !== 'string') {
    return false;
  }
  
  const trimmed = plantName.trim();
  
  // 基本的な長さチェック
  if (trimmed.length < 2 || trimmed.length > 50) {
    return false;
  }
  
  // 年号パターンを除外
  if (/^\d{4}\)?$/.test(trimmed)) {
    return false;
  }
  
  // 括弧付き年号を除外
  if (/^[（(]\d{4}[）)]?$/.test(trimmed)) {
    return false;
  }
  
  // 学名記号を除外
  const taxonomicPatterns = [
    /^comb\.\s*nov\.?$/i,
    /^sp\.?$/i,
    /^spp\.?$/i,
    /^var\.?$/i,
    /^subsp\.?$/i,
    /^f\.?$/i,
    /^emend\.?$/i,
    /^nom\.\s*nud\.?$/i,
    /^auct\.?$/i,
    /^non$/i,
    /^sensu$/i,
    /^cf\.?$/i,
    /^aff\.?$/i
  ];
  
  for (const pattern of taxonomicPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // 時期情報を含む場合は除外
  if (/[0-9０-９]月[上中下]旬|[0-9０-９]月頃/.test(trimmed)) {
    return false;
  }
  
  // 説明文のパターンを除外
  const descriptivePatterns = [
    /野外で/,
    /飼育下で/,
    /から記録/,
    /による飼育/,
    /幼虫[がはを]/,
    /成虫[がはを]/,
    /海外では/,
    /ヨーロッパでは/,
    /日本では/,
    /を食[すし]/,
    /を好む/,
    /から[得発]られ/,
    /ことが[判知]明/,
    /推[測定]される/,
    /と[思考]われる/,
    /に固有/,
    /に寄生/,
    /害虫/,
    /栽培/,
    /発生する/,
    /生息/,
    /分布/
  ];
  
  for (const pattern of descriptivePatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // 数字だけ、英字だけは除外
  if (/^[0-9０-９]+$/.test(trimmed) || /^[A-Za-z]+$/.test(trimmed)) {
    return false;
  }
  
  // 最低限日本語文字を含むこと
  if (!/[ぁ-んァ-ヶー一-龯]/.test(trimmed)) {
    return false;
  }
  
  // 著者名パターンを除外
  if (/^[A-Z][a-z]+[,\s]+\d{4}/.test(trimmed)) {
    return false;
  }
  
  return true;
}

// 学名を正しく構築する関数 - SPAと同じロジック
function processScientificName(existingScientificName, genusName, speciesName, authorName, yearName) {
  // Clean up inputs
  const cleanGenus = genusName?.trim() || '';
  const cleanSpecies = speciesName?.trim() || '';
  const cleanAuthor = authorName?.trim() || '';
  const cleanYear = yearName?.trim() || '';
  let cleanExisting = existingScientificName?.trim() || '';
  
  // Clean up basic formatting issues first
  cleanExisting = cleanExisting.replace(/\s*"?\s*$/, '').trim();
  
  // Check if existing scientific name is valid (has both genus and species)
  if (cleanExisting) {
    // Check if it's a complete binomial (genus + species)
    const binomialMatch = cleanExisting.match(/^([A-Z][a-z]+)\s+([a-z]+(?:\s+[a-z]+)*)/);
    if (binomialMatch) {
      // It's a valid binomial, but check if it has complete author and year
      const hasCompleteAuthorYear = cleanExisting.match(/\([^)]+,\s*\d{4}\)$/);
      if (hasCompleteAuthorYear) {
        return cleanExisting;
      }
      // If not complete, we'll reconstruct it below
    }
  }
  
  // If we have both genus and species, construct binomial
  if (cleanGenus && cleanSpecies) {
    let binomial = `${cleanGenus} ${cleanSpecies}`;
    
    // Add author and year if available
    if (cleanAuthor || cleanYear) {
      // Clean up author - remove existing brackets if present
      let author = cleanAuthor.replace(/^\(|\)$/g, '').trim();
      const authorYear = [author, cleanYear].filter(Boolean).join(', ');
      binomial += ` (${authorYear})`;
    }
    
    return binomial;
  }
  
  // Fallback to existing or default
  return cleanExisting || '未同定';
}

// Enhanced HTMLテンプレートを生成する関数 - フルコンテンツバージョン
function generateInsectHTML(insect, type) {
  const typeNames = {
    moth: '蛾',
    butterfly: '蝶',
    beetle: 'タマムシ',
    leafbeetle: 'ハムシ'
  };
  
  const hostPlants = insect.hostPlants || '不明';
  const scientificName = insect.scientificName || '';
  const source = insect.source || '不明';
  const imageUrl = insect.scientificFilename ? 
    `/insects-host-plant-explorer-/images/moths/${insect.scientificFilename}.jpg` : '';
  
  // 食草リストを配列として処理
  // セミコロン区切りも処理する（例：センモンヤガの場合）
  const hostPlantsArray = hostPlants !== '不明' ? 
    hostPlants.split(/[;；、,，]/)
      .map(p => p.trim())
      .map(p => p.replace(/につく[。．]?$/g, '').trim()) // Remove "につく。"
      .filter(p => p) 
      .filter(p => {
        // Filter out non-plant texts
        if (!p) return false;
        if (p.includes('害虫') || p.includes('であり')) return false;
        if (p === '農業' || p === '農業害虫' || p === '農業害虫であり') return false;
        // Filter out year numbers that might be parsed as plants
        if (/^\d{4}\)?$/.test(p)) return false;
        // Must have at least one Japanese or alphabetic character
        if (!/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(p)) return false;
        return true;
      })
      : [];
  
  // 分類情報の生成
  const familyName = insect.familyJapanese || {
    moth: 'ヤガ科',
    butterfly: 'タテハチョウ科', 
    beetle: 'タマムシ科',
    leafbeetle: 'ハムシ科'
  }[type];
  
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${insect.name} (${scientificName}) - ${typeNames[type]}図鑑</title>
  <meta name="description" content="${insect.name}の詳細情報、分類、食草について。${hostPlantsArray.length > 0 ? `食草: ${hostPlantsArray.slice(0, 3).join('、')}など` : ''}">
  <meta name="keywords" content="${insect.name},${scientificName},${typeNames[type]},食草,昆虫図鑑,${familyName}">
  <link rel="canonical" href="https://h-amoto.github.io/insects-host-plant-explorer-/${type}/${insect.id}">
  <link rel="stylesheet" href="/insects-host-plant-explorer-/assets/meta-styles.css">
  
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
  
  <!-- Enhanced Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": "${insect.name}",
    "alternateName": ["${scientificName}", "${insect.name}"],
    "scientificName": "${scientificName}",
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id",
      "value": "${insect.id}"
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": {
        "@type": "Taxon",
        "name": "${familyName}",
        "taxonRank": "family"
      }
    },
    "description": "${insect.name}（${scientificName}）は${familyName}に属する${typeNames[type]}の一種です。${hostPlantsArray.length > 0 ? `主な食草：${hostPlantsArray.slice(0, 3).join('、')}など${hostPlantsArray.length}種の植物を利用します。` : '食草情報は現在調査中です。'}",
    "url": "https://h-amoto.github.io/insects-host-plant-explorer-/${type}/${insect.id}",
    ${imageUrl ? `"image": {
      "@type": "ImageObject",
      "url": "https://h-amoto.github.io${imageUrl}",
      "caption": "${insect.name}（${scientificName}）の写真"
    },` : ''}
    "inLanguage": "ja",
    "author": {
      "@type": "Organization",
      "name": "昆虫食草図鑑"
    },
    "publisher": {
      "@type": "Organization",
      "name": "昆虫と食草の図鑑"
    }
  }
  </script>
</head>
<body>
  <div class="meta-page">
    <nav class="breadcrumb">
      <a href="/insects-host-plant-explorer-/">昆虫食草図鑑</a>
      <span>></span>
      <a href="/insects-host-plant-explorer-/${type}">${typeNames[type]}</a>
      <span>></span>
      <span>${insect.name}</span>
    </nav>
    
    <header class="meta-header">
      <h1>${insect.name}</h1>
      <h2>${formatScientificNameHTML(scientificName)}</h2>
    </header>
    
    <main class="meta-content">
      <section class="basic-info">
        <h3>基本情報</h3>
        <dl>
          <dt>和名</dt>
          <dd>${insect.name}</dd>
          <dt>学名</dt>
          <dd>${formatScientificNameHTML(scientificName)}</dd>
          <dt>分類</dt>
          <dd>${familyName}</dd>
          <dt>種類</dt>
          <dd>${typeNames[type]}</dd>
          ${hostPlantsArray.length > 0 ? `
          <dt>食草数</dt>
          <dd>${hostPlantsArray.length}種</dd>` : ''}
          <dt>出典</dt>
          <dd>${source}</dd>
        </dl>
      </section>
      
      ${imageUrl ? `
      <section class="image-section">
        <img src="${imageUrl}" 
             alt="${insect.name}（${scientificName}）の写真" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="display:none; padding: 40px; text-align: center; background-color: #f0f0f0; border-radius: 8px; color: #666;">
          画像を読み込み中...
        </div>
        <div class="image-caption">${insect.name}の生態写真</div>
      </section>` : ''}
      
      <section class="host-plants">
        <h3>食草・食樹</h3>
        ${hostPlantsArray.length > 0 ? `
        <p>${insect.name}は以下の植物を食草として利用します：</p>
        <ul>
          ${hostPlantsArray.map(plant => {
            const safePlantName = plant.replace(/[/\\?%*:|"<>]/g, '-');
            return `<li><a href="/insects-host-plant-explorer-/plant/${encodeURIComponent(safePlantName)}.html">${plant}</a></li>`;
          }).join('')}
        </ul>` : `
        <p>食草情報は現在調査中です。</p>`}
      </section>
      
      <section class="description">
        <h3>詳細説明</h3>
        <p>${insect.name}（学名：${formatScientificNameHTML(scientificName)}）は${familyName}に分類される${typeNames[type]}の一種です。</p>
        ${hostPlantsArray.length > 0 ? `
        <p>幼虫は${hostPlantsArray.slice(0, 3).join('、')}${hostPlantsArray.length > 3 ? 'など' : ''}を食草として成長します。${hostPlantsArray.length}種の植物との関係が確認されており、多様な植物資源を利用する種です。</p>` : ''}
        ${source && source !== '不明' ? `<p>出典: ${source}</p>` : ''}
        <p>この種の詳細な生態情報や観察記録については、メインの図鑑ページでご確認ください。</p>
      </section>
    </main>
    
    <section class="navigation">
      <a href="/insects-host-plant-explorer-/" class="back-link">図鑑トップへ</a>
      <a href="/insects-host-plant-explorer-/${type}/${insect.id}" class="detail-link">詳細ページへ</a>
    </section>
  </div>
  
  <script>
    // Progressive enhancement - SPA化が可能な場合のみ遷移
    (function() {
      // JavaScript有効時の拡張機能
      const detailLinks = document.querySelectorAll('a[href*="/${type}/"]');
      
      // 画像の遅延読み込み対応
      const img = document.querySelector('.image-section img');
      if (img) {
        img.addEventListener('load', function() {
          this.style.opacity = '1';
        });
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
      }
      
      // 外部リンクの処理
      const externalLinks = document.querySelectorAll('a[href^="http"]');
      externalLinks.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
    })();
  </script>
</body>
</html>`;
}

// Enhanced 植物のHTMLテンプレートを生成する関数 - フルコンテンツバージョン
function generatePlantHTML(plantName, relatedInsects, plantImages) {
  const insectsList = relatedInsects.map(insect => insect.name).join(', ');
  const safePlantName = plantName.replace(/[/\\?%*:|"<>]/g, '-');

  // この植物に関連する画像を探す
  const plantImageFiles = plantImages.filter(img => img.startsWith(plantName));
  const mainImageUrl = plantImageFiles.length > 0 
    ? `/insects-host-plant-explorer-/images/plants/${encodeURIComponent(plantImageFiles[0])}` 
    : '';

  // 昆虫を種類別に分類
  const insectsByType = {
    moth: relatedInsects.filter(i => i.type === 'moth'),
    butterfly: relatedInsects.filter(i => i.type === 'butterfly'),
    beetle: relatedInsects.filter(i => i.type === 'beetle'),
    leafbeetle: relatedInsects.filter(i => i.type === 'leafbeetle')
  };
  
  const typeNames = {
    moth: '蛾',
    butterfly: '蝶',
    beetle: 'タマムシ',
    leafbeetle: 'ハムシ'
  };
  
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plantName} - 食草図鑑 | ${relatedInsects.length}種の昆虫が利用</title>
  <meta name="description" content="${plantName}を食草とする${relatedInsects.length}種の昆虫の詳細情報。蛾、蝶、タマムシ、ハムシの生態と食草関係について。">
  <meta name="keywords" content="${plantName},食草,植物,昆虫図鑑,生態系,${relatedInsects.slice(0, 5).map(i => i.name).join(',')}">
  <link rel="canonical" href="https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(safePlantName)}.html">
  <link rel="stylesheet" href="/insects-host-plant-explorer-/assets/meta-styles.css">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${plantName} - 食草図鑑 | ${relatedInsects.length}種の昆虫が利用">
  <meta property="og:description" content="${plantName}を食草とする昆虫: ${insectsList.substring(0, 100)}${insectsList.length > 100 ? '...' : ''}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(safePlantName)}.html">
  ${mainImageUrl ? `<meta property="og:image" content="https://h-amoto.github.io${mainImageUrl}">` : ''}
  <meta property="og:site_name" content="昆虫と食草の図鑑">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${plantName} - 食草図鑑">
  <meta property="twitter:description" content="${plantName}を食草とする${relatedInsects.length}種の昆虫情報">
  ${mainImageUrl ? `<meta property="twitter:image" content="https://h-amoto.github.io${mainImageUrl}">` : ''}
  
  <!-- Enhanced Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": ["Plant", "Species"],
    "name": "${plantName}",
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "plant_name",
      "value": "${plantName}"
    },
    "description": "${plantName}の食草植物情報。${relatedInsects.length}種の昆虫がこの植物を食草として利用します.",
    "url": "https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(safePlantName)}.html",
    ${mainImageUrl ? `"image": "https://h-amoto.github.io${mainImageUrl}",` : ''}
    "inLanguage": "ja",
    "hasEcologicalInteraction": [
      ${relatedInsects.map(insect => `{
        "@type": "EcologicalInteraction",
        "interactionType": "herbivory",
        "participantOrganism": {
          "@type": ["Animal", "Species"],
          "name": "${insect.name}",
          "scientificName": "${insect.scientificName}"
        }
      }`).join(',\n      ')}
    ],
    "author": {
      "@type": "Organization",
      "name": "昆虫食草図鑑"
    },
    "publisher": {
      "@type": "Organization",
      "name": "昆虫と食草の図鑑"
    }
  }
  </script>
</head>
<body>
  <div class="meta-page">
    <nav class="breadcrumb">
      <a href="/insects-host-plant-explorer-/">昆虫食草図鑑</a>
      <span>></span>
      <a href="/insects-host-plant-explorer-/plant">植物</a>
      <span>></span>
      <span>${plantName}</span>
    </nav>
    
    <header class="meta-header">
      <h1>${plantName}</h1>
      <h2>食草植物の詳細情報</h2>
    </header>
    
    <main class="meta-content">
      <section class="basic-info">
        <h3>基本情報</h3>
        <dl>
          <dt>植物名</dt>
          <dd>${plantName}</dd>
          <dt>利用昆虫数</dt>
          <dd>${relatedInsects.length}種</dd>
          <dt>昆虫の種類</dt>
          <dd>
            ${Object.entries(insectsByType)
              .filter(([type, insects]) => insects.length > 0)
              .map(([type, insects]) => `${typeNames[type]}: ${insects.length}種`)
              .join(', ')}
          </dd>
        </dl>
      </section>

      ${plantImageFiles.length > 0 ? `
      <section class="image-gallery">
        <h3>${plantName}の写真</h3>
        <div class="gallery-container">
          ${plantImageFiles.map(img => `
            <div class="gallery-item">
              <a href="/insects-host-plant-explorer-/images/plants/${encodeURIComponent(img)}" target="_blank" title="画像を拡大表示">
                <img src="/insects-host-plant-explorer-/images/plants/${encodeURIComponent(img)}" alt="${plantName}の写真 - ${img.replace(/\.[^/.]+$/, '')}" loading="lazy">
              </a>
              <div class="image-caption">${img.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}</div>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}
      
      <section class="description">
        <h3>生態系での役割</h3>
        <p>${plantName}は、昆虫の食草として重要な役割を果たしている植物です。</p>
        <p>この植物を食草として利用する昆虫は${relatedInsects.length}種確認されており、生態系において多様な昆虫の生活を支える重要な植物資源となっています。</p>
        ${Object.entries(insectsByType)
          .filter(([type, insects]) => insects.length > 0)
          .map(([type, insects]) => 
            `<p><strong>${typeNames[type]}</strong>では${insects.length}種が確認されており、${insects.slice(0, 3).map(i => i.name).join('、')}${insects.length > 3 ? 'などが' : 'が'}この植物を利用しています。</p>`
          ).join('')}
      </section>
      
      <section class="related-insects">
        <h3>この植物を利用する昆虫（${relatedInsects.length}種）</h3>
        ${Object.entries(insectsByType)
          .filter(([type, insects]) => insects.length > 0)
          .map(([type, insects]) => `
        <h4>${typeNames[type]}（${insects.length}種）</h4>
        <ul>
          ${insects.map(insect => `
          <li>
            <div class="insect-name">
              <a href="/insects-host-plant-explorer-/${type}/${insect.id}">${insect.name}</a>
            </div>
            <div class="insect-scientific">${formatScientificNameHTML(insect.scientificName)}</div>
          </li>`).join('')}
        </ul>`).join('')}
      </section>
    </main>
    
    <section class="navigation">
      <a href="/insects-host-plant-explorer-/" class="back-link">図鑑トップへ</a>
    </section>
  </div>
  
  <script>
    // Progressive enhancement
    (function() {
      // 外部リンクの処理
      const externalLinks = document.querySelectorAll('a[href^="http"]');
      externalLinks.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
      
      // 昆虫リンクのハイライト効果
      const insectLinks = document.querySelectorAll('.related-insects a');
      insectLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
          this.closest('li').style.backgroundColor = '#e8f5e8';
        });
        link.addEventListener('mouseleave', function() {
          this.closest('li').style.backgroundColor = '';
        });
      });
    })();
  </script>
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
    if (fs.existsSync(typeDir)) {
      // 古いファイルを削除して再生成に備える
      fs.rmSync(typeDir, { recursive: true, force: true });
    }
    fs.mkdirSync(typeDir, { recursive: true });
  });
  
  try {
    // 植物の画像一覧を取得
    const plantImagesDir = path.join(__dirname, '../public/images/plants');
    const allPlantImages = fs.existsSync(plantImagesDir) 
      ? fs.readdirSync(plantImagesDir).filter(file =>
          /\.jpe?g|\.png|\.gif|\.webp$/i.test(file)
        )
      : [];
    console.log(`${allPlantImages.length}件の植物画像を読み込みました。`);

    // CSVデータを読み込み
    const csvData = loadCSV(path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_kiriga.csv'));
    
    // 昆虫データの処理
    let mothCount = 0;
    const hostPlantsMap = new Map();
    
    csvData.forEach((row, index) => {
      const insectName = row['和名'] || row['種名'] || '';
      if (!insectName) return;
      
      const familyJapanese = row['科和名'] || row['科名'] || '';
      
      const existingScientificName = (row['学名'] || '').trim();
      const genus = row['属名'] || '';
      const species = row['種小名'] || '';
      const author = row['著者'] || '';
      const year = row['公表年'] || '';
      
      const scientificName = processScientificName(existingScientificName, genus, species, author, year);
      
      const hostPlants = row['食草'] || '不明';
      const source = row['出典'] || row['出典\r'] || '不明';
      
      const catalogNo = row['大図鑑カタログNo'] || '';
      const insectId = catalogNo ? `catalog-${catalogNo}` : `main-${index}`;
      const type = 'moth';
      
      const insect = {
        id: insectId,
        name: insectName,
        scientificName: scientificName,
        hostPlants: hostPlants,
        source: source,
        scientificFilename: scientificName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_()\,]/g, ''),
        familyJapanese: familyJapanese,
        type: type
      };
      
      const html = generateInsectHTML(insect, type);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      fs.writeFileSync(filename, html);
      mothCount++;
      
      if (hostPlants && hostPlants !== '不明') {
        const plants = hostPlants.split(/[、,，;；]/).map(p => p.trim()).filter(p => p);
        plants.forEach(plant => {
          if (isValidPlantName(plant)) {
            if (!hostPlantsMap.has(plant)) {
              hostPlantsMap.set(plant, []);
            }
            hostPlantsMap.get(plant).push(insect);
          }
        });
      }
    });
    
    // 植物ページを生成
    let plantCount = 0;
    let skippedPlants = 0;
    hostPlantsMap.forEach((insects, plantName) => {
      if (!isValidPlantName(plantName)) {
        console.log(`スキップ: 無効な植物名 '${plantName}'`);
        skippedPlants++;
        return;
      }
      plantCount++;
      const html = generatePlantHTML(plantName, insects, allPlantImages);
      const safePlantName = plantName.replace(/[/\\?%*:|"<>]/g, '-');
      const filename = path.join(__dirname, `../public/meta/plant/${safePlantName}.html`);
      fs.writeFileSync(filename, html);
    });
    
    console.log(`メタページ生成完了:`);
    console.log(`- 蛾: ${mothCount}種`);
    console.log(`- 食草: ${plantCount}種`);
    if (skippedPlants > 0) {
      console.log(`- スキップされた無効な植物: ${skippedPlants}件`);
    }
    
  } catch (error) {
    console.error('メタページ生成中にエラーが発生しました:', error);
  }
}

// 実行
generateMetaPages();