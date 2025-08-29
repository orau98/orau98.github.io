import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 英語単語をイタリック体にフォーマットする関数
function formatEnglishWordsInItalic(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // 既に<em>タグがある場合は、一度削除
  text = text.replace(/<\/?em>/g, '');
  
  // 日本語文字が含まれる単語は除外
  const isJapanese = (word) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word);
  
  // 英語の単語をすべて見つけて置換（重複を許可）
  text = text.replace(/\b([A-Za-z]+)\b/g, (match, word) => {
    // 日本語が含まれていない場合はイタリック体にする
    if (!isJapanese(word)) {
      return `<em>${word}</em>`;
    }
    return match;
  });
  
  return text;
}

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
      throw new Error(`Missing CSV: ${filePath}`);
    }
    let csvContent = fs.readFileSync(filePath, 'utf-8');
    
    // Remove BOM if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    
    // Fix quoted lines issue for butterfly CSV - entire CSV is malformed with quotes around each line
    if (filePath.includes('butterfly_host.csv')) {
      const lines = csvContent.split('\n');
      let fixedLines = [];
      let fixedCount = 0;
      
      for (let line of lines) {
        if (line.trim() && line.startsWith('"') && line.endsWith('"')) {
          // Remove outer quotes from the entire line
          line = line.slice(1, -1);
          fixedCount++;
        }
        fixedLines.push(line);
      }
      
      if (fixedCount > 0) {
        csvContent = fixedLines.join('\n');
        console.log(`Fixed ${fixedCount} quoted lines in ${filePath}`);
      }
    }
    
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"'
    });
    
    if (result.errors && result.errors.length > 0) {
      console.error(`CSV parsing errors for ${filePath}:`, result.errors);
    }
    
    return result.data;
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error.message}`);
    process.exit(1);
  }
}

// 任意CSV（存在しなければ空配列で続行）
function loadCSVOptional(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Optional CSV not found (skipping): ${filePath}`);
      return [];
    }
    return loadCSV(filePath);
  } catch (e) {
    console.log(`Optional CSV load error (skipping): ${filePath} -> ${e.message}`);
    return [];
  }
}

// 植物名として有効かどうかを検証
function isValidPlantName(plantName) {
  if (!plantName || typeof plantName !== 'string') {
    return false;
  }
  
  const trimmed = plantName.trim();
  
  // 空文字列や空白のみの文字列を除外
  if (trimmed === '' || trimmed.length === 0) {
    return false;
  }
  
  // 「不明」を除外
  if (trimmed === '不明') {
    return false;
  }
  
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
  
  // 不正な植物名パターンを除外（「キョウチクトウ科が」「記録）」等）
  const invalidPatterns = [
    /科が$/,           // 「科が」で終わる
    /^記録[）)]?$/,    // 「記録」「記録）」
    /^が記録[）)]?$/,  // 「が記録」「が記録）」
    /^\)[^(]*$/,       // 「）」で始まる（括弧の後半のみ）
    /^[（(][^）)]*$/   // 「（」で始まり「）」で終わらない（括弧の前半のみ）
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // 文章的なパターンを除外（句点や説明文）
  if (/[。．]/.test(trimmed) || /で(飼育|採卵|得られ|記録)/.test(trimmed) || /による/.test(trimmed) || /からの/.test(trimmed)) {
    return false;
  }
  
  // ハイフンで始まる植物名を除外
  if (/^[-ー]/.test(trimmed)) {
    return false;
  }
  
  // 括弧内の説明だけの場合を除外
  if (/^\([^)]*\)$/.test(trimmed)) {
    return false;
  }
  
  // 学名記号を除外
  const taxonomicPatterns = [
    /^comb\.\\s*nov\.?$/i,
    /^sp\.?$/i,
    /^spp\.?$/i,
    /^var\.?$/i,
    /^subsp\.?$/i,
    /^f\.?$/i,
    /^emend\.?$/i,
    /^nom\.\\s*nud\.?$/i,
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
    /分布/,
    /寄主植物/,
    /とするが$/,
    /植物で$/,
    /植物であるが$/,
    /が主な/,
    /を主な/,
    /から子実体へ/,
    /の樹皮下から/
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
  if (!/[あ-ん ア-ヶー一-龯]/.test(trimmed)) {
    return false;
  }
  
  // 著者名パターンを除外
  if (/^[A-Z][a-z]+[,\\s]+\\d{4}/.test(trimmed)) {
    return false;
  }
  
  return true;
}

// 植物名を正規化する関数
function normalizePlantName(plantName) {
  if (!plantName || typeof plantName !== 'string') {
    return plantName;
  }
  
  // 全角スペースを半角スペースに統一
  let normalized = plantName.replace(/　/g, ' ');
  
  // 全角括弧を半角括弧に統一
  normalized = normalized.replace(/（/g, '(').replace(/）/g, ')');
  
  // 「科名の植物名」形式を「植物名(科名)」形式に変換
  normalized = normalized.replace(/^([^の]+科)の(.+)$/g, '$2($1)');
  
  // 「以上」を削除（例：「(以上クルミ科)」→「(クルミ科)」）
  normalized = normalized.replace(/\(以上([^)]+)\)/g, '($1)');
  
  // 科名の前後のスペースを統一（スペースなしに）
  normalized = normalized.replace(/\s*\(\s*([^)]+科)\s*\)/g, '($1)');
  
  // 「によって」「による」「からの」「での」「における」などの余分なテキストを削除
  normalized = normalized.replace(/\s*(によって|による|から|での|における|羽化|採卵|飼育|記録|例が|ある).*$/g, '');
  
  // 括弧内の余分なテキストも削除（科名以外）
  normalized = normalized.replace(/\s*\([^)]*によって[^)]*\)/g, '');
  normalized = normalized.replace(/\s*\([^)]*による[^)]*\)/g, '');
  
  // 連続するスペースを1つに
  normalized = normalized.replace(/\s+/g, ' ');
  
  // 前後の空白を削除
  normalized = normalized.trim();
  
  return normalized;
}

// 備考欄から食草情報を抽出する関数
function extractHostPlantsFromRemarks(remarks) {
  if (!remarks || typeof remarks !== 'string') {
    return [];
  }
  
  const hostPlants = [];
  const trimmed = remarks.trim();
  
  // パターン1: "名義タイプ亜種の幼虫は...を食すという"
  const nominalSubspeciesMatch = trimmed.match(/名義タイプ亜種の幼虫は([^。]+)を食すという/);
  if (nominalSubspeciesMatch) {
    const plantText = nominalSubspeciesMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン2: "飼育下で...の記録があり"
  const culturingMatch = trimmed.match(/飼育下で([^。]+)の記録があり?/);
  if (culturingMatch) {
    const plantText = culturingMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン3: "飼育条件下では...を食べる"  
  const culturingConditionMatch = trimmed.match(/飼育条件下では([^。]+)を食べる/);
  if (culturingConditionMatch) {
    const plantText = culturingConditionMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン4: "...によって採卵飼育の記録がある"パターン
  const eggRearingMatch = trimmed.match(/(.+?)[\s　]*[にに]よって採卵飼育の記録がある/);
  if (eggRearingMatch) {
    const plantText = eggRearingMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン5: "採卵により...で飼育記録がある"パターン  
  const eggCollectionMatch = trimmed.match(/採卵により(.+?)で飼育記録がある/);
  if (eggCollectionMatch) {
    const plantText = eggCollectionMatch[1];
    const plants = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || p.includes('属') || isValidPlantName(p)));
    hostPlants.push(...plants);
  }
  
  // パターン6: 文頭の植物名パターン（例："ショウロウクサギ (シソ科); ノアサガオ (ヒルガオ科)。"）
  const directPlantMatch = trimmed.match(/^([^。]+(?:\([^)]+\)[^。]*)*)[。；]/);
  if (directPlantMatch && !trimmed.includes('名義タイプ亜種') && !trimmed.includes('飼育下で')) {
    const plantText = directPlantMatch[1];
    // 科名を含む植物名パターンをより正確に抽出
    const plantPatterns = plantText.split(/[;；、，,]/)
      .map(p => p.trim())
      .filter(p => p && (p.includes('科') || isValidPlantName(p)));
    hostPlants.push(...plantPatterns);
  }
  
  // パターン7: "広食性"を検出
  if (trimmed.includes('広食性')) {
    hostPlants.push('広食性');
  }
  
  // 重複を除去して返す
  return [...new Set(hostPlants)];
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
      
      // Check if it has incomplete author/year (missing comma and year)
      const hasIncompleteAuthor = cleanExisting.match(/\([^)]+$/);
      if (hasIncompleteAuthor && cleanYear) {
        // Fix incomplete format like "Cucullia argentea (Hufnagel" by adding year
        const incompleteAuthor = hasIncompleteAuthor[0].substring(1); // Remove opening parenthesis
        return `${binomialMatch[1]} ${binomialMatch[2]} (${incompleteAuthor}, ${cleanYear})`;
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

// 植物の別名を取得する関数
function getPlantAliases(plantName) {
  // App.jsxと同じ別名マップを定義
  const aliasToMainMap = {
    'セイヨウリンゴ': 'リンゴ',
    'ヨーロッパリンゴ': 'リンゴ',
    'セイヨウナシ': 'ナシ',
    'ヨーロッパナシ': 'ナシ',
    'セイヨウカラシナ': 'カラシナ',
    'セイヨウタンポポ': 'タンポポ',
    'セイヨウミザクラ': 'ミザクラ',
    'セイヨウアブラナ': 'アブラナ',
    'セイヨウハコヤナギ': 'ハコヤナギ'
  };
  
  // 逆引きマップ（メイン名から別名のリストへ）
  const mainToAliasesMap = {};
  for (const [alias, main] of Object.entries(aliasToMainMap)) {
    if (!mainToAliasesMap[main]) {
      mainToAliasesMap[main] = [];
    }
    mainToAliasesMap[main].push(alias);
  }
  
  // 植物名から基本名を抽出（科名などを除去）
  const basePlantName = plantName.split(/[（(]/)[0].trim();
  
  // この植物の別名を返す
  return mainToAliasesMap[basePlantName] || [];
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
    `/images/moths/${insect.scientificFilename}.jpg` : '';
  
  // 食草リストを配列として処理
  // セミコロン区切りも処理する（例：センモンヤガの場合）
  const hostPlantsArray = hostPlants !== '不明' ? 
    [...new Set(hostPlants.split(/[;；、,，]/)
      .map(p => p.trim())
      .filter(p => p && p !== '' && p !== '不明')
      .map(p => p.replace(/につく[。．]?$/g, '').trim()) // Remove "につく。"
      .flatMap(p => {
        // Handle patterns like "クマノミズキ (以上ミズキ科)" - extract individual plant names
        const familyMatch = p.match(/^(.+?)\s*\(\s*以上[^)]*科\s*\)$/);
        if (familyMatch) {
          // Split individual plant names before the family annotation
          const plantNames = familyMatch[1].split(/[、，,]/).map(name => name.trim()).filter(name => name);
          return plantNames;
        }
        return [p];
      })
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
      }))]
      : [];
  
  // 分類情報の生成
  const familyName = insect.family || {
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
  <title>${insect.japaneseName} (${scientificName}) - ${typeNames[type]}図鑑</title>
  <meta name="description" content="${insect.japaneseName}の詳細情報、分類、食草について。${hostPlantsArray.length > 0 ? `食草: ${hostPlantsArray.slice(0, 3).join('、')}など` : ''}">
  <meta name="keywords" content="${insect.japaneseName},${scientificName},${typeNames[type]},食草,昆虫図鑑,${familyName}">
  <link rel="canonical" href="https://orau98.github.io/${type}/${insect.id}">
  <link rel="stylesheet" href="/assets/meta-styles.css">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${insect.japaneseName} (${scientificName}) - ${typeNames[type]}図鑑">
  <meta property="og:description" content="${insect.japaneseName}の詳細情報。食草: ${hostPlantsArray.length > 0 ? hostPlantsArray.join('、') : '不明'}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://orau98.github.io/${type}/${insect.id}">
  ${imageUrl ? `<meta property="og:image" content="https://orau98.github.io${imageUrl}">` : ''}
  <meta property="og:site_name" content="昆虫と食草の図鑑">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${insect.japaneseName} (${scientificName}) - ${typeNames[type]}図鑑">
  <meta property="twitter:description" content="${insect.japaneseName}の詳細情報。食草: ${hostPlantsArray.length > 0 ? hostPlantsArray.join('、') : '不明'}">
  ${imageUrl ? `<meta property="twitter:image" content="https://orau98.github.io${imageUrl}">` : ''}
  
  <!-- Enhanced Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": "${insect.japaneseName}",
    "alternateName": ["${scientificName}", "${insect.japaneseName}"],
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
    "description": "${insect.japaneseName}（${scientificName}）は${familyName}に属する${typeNames[type]}の一種です。${hostPlantsArray.length > 0 ? `主な食草：${hostPlantsArray.slice(0, 3).join('、')}など${hostPlantsArray.length}種の植物を利用します。` : '食草情報は現在調査中です。'}",
    "url": "https://orau98.github.io/${type}/${insect.id}",
    ${imageUrl ? `"image": {
      "@type": "ImageObject",
      "url": "https://orau98.github.io${imageUrl}",
      "caption": "${insect.japaneseName}（${scientificName}）の写真"
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
      <a href="/">昆虫食草図鑑</a>
      <span>></span>
      <a href="/${type}">${typeNames[type]}</a>
      <span>></span>
      <span>${insect.japaneseName}</span>
    </nav>
    
    <header class="meta-header">
      <h1>${insect.japaneseName}</h1>
      <h2>${formatScientificNameHTML(scientificName)}</h2>
    </header>
    
    <main class="meta-content">
      <section class="basic-info">
        <h3>基本情報</h3>
        <dl>
          <dt>和名</dt>
          <dd>${insect.japaneseName}</dd>
          ${insect.alternativeNames && insect.alternativeNames.trim() ? `
          <dt>別名</dt>
          <dd>${insect.alternativeNames}</dd>` : ''}
          <dt>学名</dt>
          <dd>${formatScientificNameHTML(scientificName)}</dd>
          <dt>分類</dt>
          <dd>${familyName}</dd>
          <dt>種類</dt>
          <dd>${typeNames[type]}</dd>
          ${hostPlantsArray.length > 0 ? `
          <dt>食草数</dt>
          <dd>${hostPlantsArray.length}種</dd>` : ''}
          ${insect.emergenceTime && insect.emergenceTime !== '不明' ? `
          <dt>成虫出現時期</dt>
          <dd>${insect.emergenceTime}</dd>` : ''}
          <dt>出典</dt>
          <dd>${source}</dd>
        </dl>
      </section>
      
      ${imageUrl ? `
      <section class="image-section">
        <img src="${imageUrl}" 
             alt="${insect.japaneseName}（${scientificName}）の写真" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="display:none; padding: 40px; text-align: center; background-color: #f0f0f0; border-radius: 8px; color: #666;">
          画像を読み込み中...
        </div>
        <div class="image-caption">${insect.japaneseName}の生態写真</div>
      </section>` : ''}
      
      <section class="host-plants">
        <h3>食草・食樹</h3>
        ${hostPlantsArray.length > 0 ? `
        <p>${insect.japaneseName}は以下の植物を食草として利用します：</p>
        <ul>
          ${hostPlantsArray.map(plant => {
            const safePlantName = plant.replace(/[/\\?%*:|"<>]/g, '-');
            return `<li><a href="/plant/${encodeURIComponent(safePlantName)}.html">${plant}</a></li>`;
          }).join('')}
        </ul>` : `
        <p>食草情報は現在調査中です。</p>`}
      </section>
      
      <section class="description">
        <h3>詳細説明</h3>
        <p>${insect.japaneseName}（学名：${formatScientificNameHTML(scientificName)}）は${familyName}に分類される${typeNames[type]}の一種です。</p>
        ${hostPlantsArray.length > 0 ? `
        <p>幼虫は${hostPlantsArray.slice(0, 3).join('、')}${hostPlantsArray.length > 3 ? 'など' : ''}を食草として成長します。${hostPlantsArray.length}種の植物との関係が確認されており、多様な植物資源を利用する種です。</p>` : ''}
        ${insect.remarks && insect.remarks.trim() ? `
        <h4>備考</h4>
        <p>${formatEnglishWordsInItalic(insect.remarks)}</p>` : ''}
        ${source && source !== '不明' ? `<p>出典: ${source}</p>` : ''}
        <p>この種の詳細な生態情報や観察記録については、メインの図鑑ページでご確認ください。</p>
      </section>
    </main>
    
    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
      <a href="/${type}/${insect.id}" class="detail-link">詳細ページへ</a>
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
// originalPlantName: エイリアス生成時に元の植物名（科名付き）を渡すため
function generatePlantHTML(plantName, relatedInsects, plantImages, originalPlantName = null) {
  // originalPlantNameが指定されている場合は、それが実際のデータの植物名
  // plantNameは表示用の名前（エイリアスの場合は科名なし）
  const dataPlantName = originalPlantName || plantName;
  const displayPlantName = plantName;
  
  const insectsList = relatedInsects.map(insect => insect.japaneseName).join(', ');
  const safePlantName = displayPlantName.replace(/[/\\?%*:|"<>]/g, '-');

  // 植物の別名を取得（データ用の名前で取得）
  const plantAliases = getPlantAliases(dataPlantName);

  // この植物に関連する画像を探す（表示名から基本名を取得）
  const basePlantName = displayPlantName.split(/[\s(（]/)[0]; // "タケニグサ (ケシ科)" -> "タケニグサ"
  const plantImageFiles = plantImages.filter(img => img.startsWith(basePlantName));
  const mainImageUrl = plantImageFiles.length > 0 
    ? `/images/plants/${encodeURIComponent(plantImageFiles[0])}` 
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
  <title>${displayPlantName} - 食草図鑑 | ${relatedInsects.length}種の昆虫が利用</title>
  <meta name="description" content="${displayPlantName}を食草とする${relatedInsects.length}種の昆虫の詳細情報。蛾、蝶、タマムシ、ハムシの生態と食草関係について。">
  <meta name="keywords" content="${displayPlantName},食草,植物,昆虫図鑑,生態系,${relatedInsects.slice(0, 5).map(i => i.japaneseName).join(',')}">
  <link rel="canonical" href="https://orau98.github.io/plant/${encodeURIComponent(safePlantName)}.html">
  <link rel="stylesheet" href="/assets/meta-styles.css">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${displayPlantName} - 食草図鑑 | ${relatedInsects.length}種の昆虫が利用">
  <meta property="og:description" content="${displayPlantName}を食草とする昆虫: ${insectsList.substring(0, 100)}${insectsList.length > 100 ? '...' : ''}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://orau98.github.io/plant/${encodeURIComponent(safePlantName)}.html">
  ${mainImageUrl ? `<meta property="og:image" content="https://orau98.github.io${mainImageUrl}">` : ''}
  <meta property="og:site_name" content="昆虫と食草の図鑑">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${displayPlantName} - 食草図鑑">
  <meta property="twitter:description" content="${displayPlantName}を食草とする${relatedInsects.length}種の昆虫情報">
  ${mainImageUrl ? `<meta property="twitter:image" content="https://orau98.github.io${mainImageUrl}">` : ''}
  
  <!-- Enhanced Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": ["Plant", "Species"],
    "name": "${displayPlantName}",
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "plant_name",
      "value": "${displayPlantName}"
    },
    "description": "${displayPlantName}の食草植物情報。${relatedInsects.length}種の昆虫がこの植物を食草として利用します.",
    "url": "https://orau98.github.io/plant/${encodeURIComponent(safePlantName)}.html",
    ${mainImageUrl ? `"image": "https://orau98.github.io${mainImageUrl}",` : ''}
    "inLanguage": "ja",
    "hasEcologicalInteraction": [
      ${relatedInsects.map(insect => `{
        "@type": "EcologicalInteraction",
        "interactionType": "herbivory",
        "participantOrganism": {
          "@type": ["Animal", "Species"],
          "name": "${insect.japaneseName}",
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
      <a href="/">昆虫食草図鑑</a>
      <span>></span>
      <a href="/plant">植物</a>
      <span>></span>
      <span>${displayPlantName}</span>
    </nav>
    
    <header class="meta-header">
      <h1>${displayPlantName}</h1>
      <h2>食草植物の詳細情報</h2>
    </header>
    
    <main class="meta-content">
      <section class="basic-info">
        <h3>基本情報</h3>
        <dl>
          <dt>植物名</dt>
          <dd>${displayPlantName}</dd>
          ${plantAliases.length > 0 ? `
          <dt>別名</dt>
          <dd>${plantAliases.join('、')}</dd>
          ` : ''}
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
        <h3>${displayPlantName}の写真</h3>
        <div class="gallery-container">
          ${plantImageFiles.map(img => `
            <div class="gallery-item">
              <a href="/images/plants/${encodeURIComponent(img)}" target="_blank" title="画像を拡大表示">
                <img src="/images/plants/${encodeURIComponent(img)}" alt="${displayPlantName}の写真 - ${img.replace(/\.[^/.]+$/, '')}" loading="lazy">
              </a>
              <div class="image-caption">${img.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}</div>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}
      
      <section class="description">
        <h3>生態系での役割</h3>
        <p>${displayPlantName}は、昆虫の食草として重要な役割を果たしている植物です。</p>
        <p>この植物を食草として利用する昆虫は${relatedInsects.length}種確認されており、生態系において多様な昆虫の生活を支える重要な植物資源となっています。</p>
        ${Object.entries(insectsByType)
          .filter(([type, insects]) => insects.length > 0)
          .map(([type, insects]) => 
            `<p><strong>${typeNames[type]}</strong>では${insects.length}種が確認されており、${insects.slice(0, 3).map(i => i.japaneseName).join('、')}${insects.length > 3 ? 'などが' : 'が'}この植物を利用しています。</p>`
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
              <a href="/${type}/${insect.id}">${insect.japaneseName}</a>
            </div>
            <div class="insect-scientific">${formatScientificNameHTML(insect.scientificName)}</div>
          </li>`).join('')}
        </ul>`).join('')}
      </section>
    </main>
    
    <section class="navigation">
      <a href="/" class="back-link">図鑑トップへ</a>
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

    // 正規化された3つのCSVファイルを読み込み
    const insectsData = loadCSV(path.join(__dirname, '../public/insects.csv'));
    const hostplantsData = loadCSV(path.join(__dirname, '../public/hostplants.csv'));
    const generalNotesData = loadCSV(path.join(__dirname, '../public/general_notes.csv'));
    
    // バタフライとハムシの従来データも読み込み
    const butterflyData = loadCSVOptional(path.join(__dirname, '../public/butterfly_host.csv'));
    const hamushiData = loadCSVOptional(path.join(__dirname, '../public/hamushi_integrated_master.csv'));
    
    // 昆虫IDをキーとした食草マップを作成
    const hostPlantsMapByInsectId = new Map();
    hostplantsData.forEach(row => {
      const insectId = row.insect_id;
      const plantName = row.plant_name;
      const plantFamily = row.plant_family || '';
      const observationType = row.observation_type || '野外（国内）';
      const plantPart = row.plant_part || '葉';
      const lifeStage = row.life_stage || '幼虫';
      const reference = row.reference || '';
      const notes = row.notes || '';
      
      if (insectId && plantName) {
        if (!hostPlantsMapByInsectId.has(insectId)) {
          hostPlantsMapByInsectId.set(insectId, []);
        }
        
        // 植物名に科名を付加（必要に応じて）
        let displayPlantName = plantName;
        if (plantFamily && !plantName.includes('(') && !plantName.includes('（')) {
          displayPlantName = `${plantName}(${plantFamily})`;
        }
        
        hostPlantsMapByInsectId.get(insectId).push({
          name: plantName,
          family: plantFamily,
          displayName: displayPlantName,
          observationType,
          plantPart,
          lifeStage,
          reference,
          notes,
          isDetailed: true
        });
      }
    });
    
    // 昆虫IDをキーとした一般備考マップを作成
    const generalNotesMapByInsectId = new Map();
    generalNotesData.forEach(row => {
      const insectId = row.insect_id;
      const noteType = row.note_type;
      const content = row.content;
      const reference = row.reference || '';
      const page = row.page || '';
      const year = row.year || '';
      
      if (insectId && content) {
        if (!generalNotesMapByInsectId.has(insectId)) {
          generalNotesMapByInsectId.set(insectId, []);
        }
        generalNotesMapByInsectId.get(insectId).push({
          type: noteType,
          content,
          reference,
          page,
          year
        });
      }
    });
    
    // 日本の冬夜蛾.csvから成虫出現時期データを読み込み
    const kirigaData = loadCSVOptional(path.join(__dirname, '../public/日本の冬夜蛾.csv'));
    const emergenceTimeMap = new Map();
    
    kirigaData.forEach(row => {
      const japaneseName = row['和名']?.trim();
      const scientificName = row['学名']?.trim();
      const emergenceTime = row['成虫の発生時期']?.trim();
      
      if (japaneseName && emergenceTime && emergenceTime !== '' && emergenceTime !== '不明') {
        emergenceTimeMap.set(japaneseName, emergenceTime);
      }
      if (scientificName && emergenceTime && emergenceTime !== '' && emergenceTime !== '不明') {
        emergenceTimeMap.set(scientificName, emergenceTime);
        // Also store with author/year removed
        const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (cleanedScientificName !== scientificName) {
          emergenceTimeMap.set(cleanedScientificName, emergenceTime);
        }
      }
    });
    
    // 日本の冬尺蛾.csvからも成虫出現時期データを読み込み
    const fuyushakuCsvPath = path.join(__dirname, '../public/日本の冬尺蛾.csv');
    if (fs.existsSync(fuyushakuCsvPath)) {
      const fuyushakuData = loadCSVOptional(fuyushakuCsvPath);
      
      fuyushakuData.forEach(row => {
        const japaneseName = row['和名']?.trim();
        const scientificName = row['学名']?.trim();
        let emergenceTime = row['成虫の発生時期']?.trim();
        
        // Fix for CSV parsing issue - check if real emergence time is in __parsed_extra
        if (row.__parsed_extra && row.__parsed_extra.length > 0) {
          const extraData = row.__parsed_extra[0]?.trim();
          if (extraData && (extraData.includes('月') || extraData.includes('上旬') || extraData.includes('中旬') || extraData.includes('下旬'))) {
            emergenceTime = extraData;
          }
        }
        
        
        if (japaneseName && emergenceTime && emergenceTime !== '' && emergenceTime !== '不明') {
          emergenceTimeMap.set(japaneseName, emergenceTime);
        }
        if (scientificName && emergenceTime && emergenceTime !== '' && emergenceTime !== '不明') {
          emergenceTimeMap.set(scientificName, emergenceTime);
          // Also store with author/year removed
          const cleanedScientificName = scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (cleanedScientificName !== scientificName) {
            emergenceTimeMap.set(cleanedScientificName, emergenceTime);
          }
        }
      });
    }
    
    console.log(`成虫出現時期データを${emergenceTimeMap.size}件読み込みました`);
    
    // 昆虫データの処理（正規化データを使用）
    let mothCount = 0;
    const hostPlantsMap = new Map();
    
    insectsData.forEach((row, index) => {
      const insectId = row.insect_id;
      const japaneseName = row.japanese_name || '';
      const scientificName = row.scientific_name || '';
      const familyJapanese = row.family_jp || row.family || '';
      const subfamily = row.subfamily_jp || row.subfamily || '';
      const genus = row.genus || '';
      const species = row.species || '';
      const author = row.author || '';
      const year = row.year || '';
      const notes = row.notes || '';
      const alternativeNames = row.alternative_name || '';
      
    if (!japaneseName || !insectId) return;
    // Skip malformed IDs like "species-" (missing suffix)
    if (/^species-$/.test(insectId)) return;
      
      // プレースホルダーや無効な昆虫名を除外
      if (japaneseName === '和名' || japaneseName === '種名' || japaneseName === '不明' || japaneseName.trim().length < 2) {
        return;
      }
      
      // 食草データを取得
      const insectHostPlants = hostPlantsMapByInsectId.get(insectId) || [];
      const hostPlantsString = insectHostPlants.map(hp => hp.displayName).join('; ') || '不明';
      
      // 一般備考データを取得
      const generalNotes = generalNotesMapByInsectId.get(insectId) || [];
      
      const type = 'moth';
      
      // 成虫出現時期の検索
      const emergenceTime = emergenceTimeMap.get(japaneseName) || 
                           emergenceTimeMap.get(scientificName) ||
                           emergenceTimeMap.get(scientificName.replace(/\s*\([^)]*\)\s*$/, '').trim()) ||
                           null;
      
      const insect = {
        id: insectId,
        name: japaneseName,
        japaneseName: japaneseName,
        scientificName: scientificName,
        hostPlants: hostPlantsString,
        hostPlantsDetailed: insectHostPlants,
        generalNotes: generalNotes,
        source: 'insects.csv + hostplants.csv',
        remarks: notes,
        alternativeNames: alternativeNames,
        emergenceTime: emergenceTime,
        scientificFilename: (() => {
          // Extract binomial name (genus + species) from scientific name for filename
          const binomialMatch = scientificName.match(/^([A-Z][a-z]+)\s+([a-z]+)/);
          const binomialName = binomialMatch ? `${binomialMatch[1]} ${binomialMatch[2]}` : scientificName;
          return binomialName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_(),]/g, '');
        })(),
        family: familyJapanese,
        familyJapanese: familyJapanese,
        subfamily: subfamily,
        type: type
      };
      
      const html = generateInsectHTML(insect, type);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      fs.writeFileSync(filename, html);
      mothCount++;
      
      // 食草マップに追加（植物ページ生成用）
      insectHostPlants.forEach(hostPlant => {
        const plantName = hostPlant.displayName;
        const normalizedPlant = normalizePlantName(plantName);
        
        if (isValidPlantName(normalizedPlant)) {
          if (!hostPlantsMap.has(normalizedPlant)) {
            hostPlantsMap.set(normalizedPlant, []);
          }
          hostPlantsMap.get(normalizedPlant).push(insect);
        }
      });
    });
    
    // バタフライデータの処理（従来通り）
    let butterflyCount = 0;
    
    butterflyData.forEach((row, index) => {
      const japaneseName = row['和名'];
      const genus = row['属'];
      const species = row['種小名'];
      const familyJapanese = row['科'] || '';
      const author = ''; // バタフライCSVには著者情報なし
      const year = ''; // バタフライCSVには年情報なし
      let hostPlants = row['食草'] || '不明';
      
      if (!japaneseName || !genus || !species) {
        return;
      }
      
      // 学名を構築（バタフライCSVには著者・年情報なし）
      const scientificName = `${genus} ${species}`;
      
      const insectId = `butterfly-csv-${index}`;
      const type = 'butterfly';
      
      const insect = {
        id: insectId,
        japaneseName,
        scientificName,
        family: familyJapanese,
        hostPlants,
        type,
        genus,
        species,
        author,
        year
      };
      
      
      const html = generateInsectHTML(insect, type);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      fs.writeFileSync(filename, html);
      butterflyCount++;
      
      if (hostPlants && hostPlants !== '不明') {
        // 「(以上...科)」パターンを処理
        let processedHostPlants = hostPlants;
        const familySuffixMatch = hostPlants.match(/[\(（]以上([^)）]+科)[\)）]$/);
        if (familySuffixMatch) {
          const familyName = familySuffixMatch[1];
          // 「(以上...科)」を一旦削除
          const plantsWithoutSuffix = hostPlants.replace(/\s*[\(（]以上[^)）]+[\)）]$/, '');
          // 各植物に科名を追加
          const plantsList = plantsWithoutSuffix.split(/[、,，;；]/).map(p => p.trim()).filter(p => p);
          processedHostPlants = plantsList.map(p => {
            // すでに科名がついている場合はそのまま
            if (p.includes('科)') || p.includes('科）')) {
              return p;
            }
            return `${p}(${familyName})`;
          }).join('; ');
        }
        
        const plants = [...new Set(processedHostPlants.split(/[、,，;；]/).map(p => p.trim()).filter(p => p && p !== '' && p !== '不明'))];
        plants.forEach(plant => {
          const normalizedPlant = normalizePlantName(plant);
          if (isValidPlantName(normalizedPlant)) {
            if (!hostPlantsMap.has(normalizedPlant)) {
              hostPlantsMap.set(normalizedPlant, []);
            }
            hostPlantsMap.get(normalizedPlant).push(insect);
          }
        });
      }
    });
    
    // ハムシデータの処理（従来通り）
    let leafbeetleCount = 0;
    
    hamushiData.forEach((row, index) => {
      const id = row['大図鑑カタログNo'] || row['ID'] || row['id'] || '';
      const japaneseName = row['和名'] || '';
      const scientificName = row['学名'] || '';
      const family = row['科和名'] || row['科'] || 'ハムシ科';
      const subfamily = row['亜科和名'] || row['亜科'] || '';
      const hostPlants = row['食草'] || row['寄主植物'] || '不明';
      const remarks = row['備考'] || '';
      
      if (!japaneseName && !scientificName) {
        return;
      }
      
      // IDがある場合はそれを使い、ない場合はインデックスベースで生成
      const insectId = id ? id.replace(/^H/, 'leafbeetle-') : `leafbeetle-${index}`;
      const type = 'leafbeetle';
      
      const insect = {
        id: insectId,
        japaneseName,
        scientificName,
        family,
        subfamily,
        hostPlants,
        remarks,
        type,
        source: 'ハムシハンドブック'
      };
      
      const html = generateInsectHTML(insect, type);
      const filename = path.join(__dirname, `../public/meta/${type}/${insectId}.html`);
      fs.writeFileSync(filename, html);
      leafbeetleCount++;
      
      if (hostPlants && hostPlants !== '不明') {
        // 「(以上...科)」パターンを処理
        let processedHostPlants = hostPlants;
        const familySuffixMatch = hostPlants.match(/[\(（]以上([^)）]+科)[\)）]$/);
        if (familySuffixMatch) {
          const familyName = familySuffixMatch[1];
          // 「(以上...科)」を一旦削除
          const plantsWithoutSuffix = hostPlants.replace(/\s*[\(（]以上[^)）]+[\)）]$/, '');
          // 各植物に科名を追加
          const plantsList = plantsWithoutSuffix.split(/[、,，;；]/).map(p => p.trim()).filter(p => p);
          processedHostPlants = plantsList.map(p => {
            // すでに科名がついている場合はそのまま
            if (p.includes('科)') || p.includes('科）')) {
              return p;
            }
            return `${p}(${familyName})`;
          }).join('; ');
        }
        
        const plants = [...new Set(processedHostPlants.split(/[、,，;；]/).map(p => p.trim()).filter(p => p && p !== '' && p !== '不明'))];
        plants.forEach(plant => {
          const normalizedPlant = normalizePlantName(plant);
          if (isValidPlantName(normalizedPlant)) {
            if (!hostPlantsMap.has(normalizedPlant)) {
              hostPlantsMap.set(normalizedPlant, []);
            }
            hostPlantsMap.get(normalizedPlant).push(insect);
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
      
      // 科名を含む植物名の場合、科名なしバージョンも生成（エイリアス）
      const familyMatch = plantName.match(/^(.+?)\(([^)]+科)\)$/);
      if (familyMatch) {
        const plantNameWithoutFamily = familyMatch[1];
        // デバッグ: オニグルミの場合の昆虫数を確認
        if (plantNameWithoutFamily === 'オニグルミ') {
          console.log(`DEBUG: オニグルミ(クルミ科)の昆虫数: ${insects.length}`);
          console.log(`DEBUG: 最初の3種: ${insects.slice(0, 3).map(i => i.japaneseName).join(', ')}`);
        }
        // エイリアス用のHTMLを生成（科名なしの植物名で表示、元の植物名のデータを使用）
        const aliasHtml = generatePlantHTML(plantNameWithoutFamily, insects, allPlantImages, plantName);
        const safeAliasName = plantNameWithoutFamily.replace(/[/\\?%*:|"<>]/g, '-');
        const aliasFilename = path.join(__dirname, `../public/meta/plant/${safeAliasName}.html`);
        fs.writeFileSync(aliasFilename, aliasHtml);
        console.log(`エイリアス作成: ${plantNameWithoutFamily} -> ${plantName} (昆虫数: ${insects.length})`);
      }
    });
    
    console.log(`メタページ生成完了:`);
    console.log(`- 蛾: ${mothCount}種`);
    console.log(`- 蝶: ${butterflyCount}種`);
    console.log(`- ハムシ: ${leafbeetleCount}種`);
    console.log(`- 食草: ${plantCount}種`);
    if (skippedPlants > 0) {
      console.log(`- スキップされた無効な植物: ${skippedPlants}件`);
    }
    
    // 画像ファイルリストを生成
    generateImageFileLists();
    
  } catch (error) {
    console.error('メタページ生成中にエラーが発生しました:', error);
  }
}

// 画像ファイルリストを生成する関数
function generateImageFileLists() {
  console.log('\n画像ファイルリストを生成中...');
  
  try {
    // 昆虫画像ファイルリストの生成（和名から学名への変換を含む）
    const mothImagesDir = path.join(__dirname, '../public/images/moths');
    if (fs.existsSync(mothImagesDir)) {
      // 和名と学名の対応表を作成
      const nameMapping = new Map();
      
      // メインCSVを読み込んでマッピングを作成
      const csvPath = path.join(__dirname, '../public/ListMJ_hostplants_master.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const csvData = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
      }).data;
      
      csvData.forEach(row => {
        const japaneseName = row['和名'] || row['属名'];
        const scientificName = row['学名'];
        const genus = row['属名'];
        const species = row['種小名'];
        
        if (japaneseName && scientificName) {
          // 学名をファイル名形式（アンダースコア）に変換
          const scientificFilename = scientificName
            .replace(/\s*\([^)]*\)\s*/g, '') // 著者情報を除去
            .replace(/\s+/g, '_') // スペースをアンダースコアに
            .replace(/[,\.]/g, ''); // カンマやピリオドを除去
          nameMapping.set(japaneseName, scientificFilename);
        } else if (japaneseName && genus && species) {
          // 学名がない場合は属名と種名から構築
          const scientificFilename = `${genus}_${species}`;
          nameMapping.set(japaneseName, scientificFilename);
        }
      });
      
      // 手動で追加する必要のあるマッピング（ファイル名変更対応）
      nameMapping.set('ウスムラサキケンモン', 'Acronicta_subpurpurea_Matsumura');
      nameMapping.set('オオマエベニトガリバ', 'Tethea_consimilis');
      nameMapping.set('ショウブオオヨトウ', 'Helotropha_leucostigma');
      nameMapping.set('シラオビキリガ', 'Cosmia_camptostigma');
      nameMapping.set('シラホシキリガ', 'Cosmia_pyralina');
      nameMapping.set('タカオキリガ', 'Pseudopanolis_takao');
      nameMapping.set('ツマベニヒメハマキ', 'Phaecasiophora_roseana_2');
      nameMapping.set('ナシキリガ', 'Cosmia_restituta_Walker_1857');
      nameMapping.set('ニッコウケンモン', 'Craniophora_praeclara');
      nameMapping.set('ニッコウシャチホコ', 'Shachia_circumscripta');
      nameMapping.set('ノコメセダカヨトウ', 'Orthogonia_sera');
      nameMapping.set('ハスモンヨトウ', 'Spodoptera_litura');
      nameMapping.set('マエジロシャチホコ', 'Notodonta_albicosta');
      nameMapping.set('クロハナコヤガ', 'Aventiola_pusilla');
      nameMapping.set('フタスジエグリアツバ', 'Gonepatica_opalina');
      nameMapping.set('ベニスズメ', 'Deilephila_elpenor');
      nameMapping.set('ヒメスズメ', 'Deilephila_askoldensis');
      nameMapping.set('マダラキボシキリガ', 'Dimorphicosmia_variegata');
      nameMapping.set('ナシイラガ', 'Narosoideus_flavidorsalis');
      nameMapping.set('ヨモギオオホソハマキ', 'Phtheochroides_clandestina');
      nameMapping.set('アオマダラタマムシ', 'Nipponobuprestis_amabilis');
      nameMapping.set('ルイスヒラタチビタマムシ', 'Habroloma_lewisii');
      
      console.log(`和名-学名マッピング作成: ${nameMapping.size}件`);
      
      const mothImageFiles = fs.readdirSync(mothImagesDir)
        .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i));
      
      const mothImages = mothImageFiles
        .map(file => file.replace(/\.[^.]+$/, '')) // 拡張子を除去したファイル名
        .sort();
      
      // 拡張子マッピングを作成
      const extensionMapping = {};
      mothImageFiles.forEach(file => {
        const nameWithoutExt = file.replace(/\.[^.]+$/, '');
        const extension = file.match(/\.[^.]+$/)[0];
        extensionMapping[nameWithoutExt] = extension;
      });
      
      const imageListPath = path.join(__dirname, '../public/image_filenames.txt');
      fs.writeFileSync(imageListPath, mothImages.join('\n') + '\n');
      
      // 拡張子マッピングをJSONファイルとして保存
      const extensionMappingPath = path.join(__dirname, '../public/image_extensions.json');
      fs.writeFileSync(extensionMappingPath, JSON.stringify(extensionMapping, null, 2));
      
      console.log(`- 昆虫画像リスト生成完了: ${mothImages.length}件`);
      console.log(`- 画像拡張子マッピング生成完了: ${Object.keys(extensionMapping).length}件`);
    }
    
    // 植物画像ファイルリストの生成
    const plantImagesDir = path.join(__dirname, '../public/images/plants');
    if (fs.existsSync(plantImagesDir)) {
      const plantImages = fs.readdirSync(plantImagesDir)
        .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map(file => file.replace(/\.[^.]+$/, '')) // 拡張子を除去
        .sort();
      
      const plantImageListPath = path.join(__dirname, '../public/plant_image_filenames.txt');
      fs.writeFileSync(plantImageListPath, plantImages.join('\n') + '\n');
      console.log(`- 植物画像リスト生成完了: ${plantImages.length}件`);
    }
    
  } catch (error) {
    console.error('画像ファイルリスト生成中にエラーが発生しました:', error);
  }
}

// 実行
generateMetaPages();
