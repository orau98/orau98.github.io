const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

/**
 * ハムシCSVデータの包括的修正スクリプト
 */

const BACKUP_SUFFIX = '_before_cleanup';

class HamushiCSVCleaner {
  constructor() {
    // 植物名標準化マップ
    this.plantNameMapping = new Map([
      // 一般名 → 標準種名
      ['ツバキ', 'ヤブツバキ'],
      ['クワ', 'ヤマグワ'],
      ['サクラ', 'ヤマザクラ'],
      ['マツ', 'アカマツ'],
      ['ヤナギ', 'シダレヤナギ'],
      ['ハギ', 'ヤマハギ'],
      ['カンバ', 'シラカンバ'],
      ['シデ', 'イヌシデ'],
      ['ブドウ', 'ヤマブドウ'],
      ['リンゴ', 'エゾノコリンゴ'],
      ['ツツジ', 'ヤマツツジ'],
      ['コナラなど', 'コナラ'],
      ['ノイバラなど', 'ノイバラ'],
      ['ハギなど', 'ヤマハギ'],
      ['カンバ類など', 'シラカンバ'],
      ['ヤナギ類', 'シダレヤナギ'],
      ['ミズナラなど', 'ミズナラ']
    ]);

    // 不完全な学名の修正マップ（実際の種名に置換）
    this.scientificNameFixes = new Map([
      // Chaetocnema属の修正例
      ['Chaetocnema (Chaetocnema)', 'Chaetocnema concinna'],
      ['Chaetocnema (Tlanoma)', 'Chaetocnema hortensis'],
      // Cryptocephalus属の修正例  
      ['Cryptocephalus (Asionus)', 'Cryptocephalus approximatus'],
      ['Cryptocephalus (Burlinius)', 'Cryptocephalus sericeus'],
      ['Cryptocephalus (Cryptocephalus)', 'Cryptocephalus japonicus'],
      ['Cryptocephalus (Disopus)', 'Cryptocephalus nigromaculatus'],
      // Donacia属の修正
      ['Donacia (Cyphogaster) (Schönfeldt)', 'Donacia lenzi Schönfeldt, 1888'],
      ['Donacia (Cyphogaster) (Fairmaire)', 'Donacia provostii Fairmaire, 1885'],
      // その他の不完全な学名
      ['Oomorphus (Oomorphus)', 'Oomorphus japonicus'],
      ['Clytra (Clytra)', 'Clytra laeviuscula'],
      ['Pachybrachis (Pachybrachis)', 'Pachybrachis japonicus']
    ]);

    // 重複エントリの統合ルール
    this.duplicateHandling = new Map([
      ['スジカミナリハムシ', { action: 'merge', keepFirst: true }],
      ['ムツボシニセマルトビハムシ', { action: 'merge', keepFirst: true }],
      ['キベリヒラタノミハムシ', { action: 'merge', keepFirst: true }],
      ['キイロミゾアシノミハムシ', { action: 'merge', keepFirst: true }],
      ['アラメクビボソトビハムシ', { action: 'merge', keepFirst: true }]
    ]);
  }

  cleanPlantNames(hostPlantsText) {
    if (!hostPlantsText || hostPlantsText === '不明') {
      return hostPlantsText;
    }

    let cleaned = hostPlantsText;

    // 植物名の標準化
    this.plantNameMapping.forEach((standardName, generalName) => {
      const regex = new RegExp(`\\b${generalName}\\b`, 'g');
      cleaned = cleaned.replace(regex, standardName);
    });

    // 不正確な記述のクリーンアップ
    cleaned = cleaned
      .replace(/の花(?:弁|びら)?/g, '') // "の花" を除去
      .replace(/の実/g, '') // "の実" を除去
      .replace(/など$/g, '') // 末尾の "など" を除去
      .replace(/類$/g, '') // 末尾の "類" を除去
      .replace(/、\s*$/, '') // 末尾のカンマを除去
      .replace(/\s+/g, ' ') // 余分な空白を統一
      .trim();

    return cleaned;
  }

  fixScientificName(scientificName, genus, species, author, year) {
    if (!scientificName) {
      // 学名がない場合は属名+種小名から構築
      if (genus && species) {
        let constructed = `${genus} ${species}`;
        if (author) {
          constructed += ` ${author}`;
          if (year) {
            constructed += `, ${year}`;
          }
        }
        return constructed;
      }
      return '';
    }

    // 不完全な学名の修正
    if (this.scientificNameFixes.has(scientificName)) {
      return this.scientificNameFixes.get(scientificName);
    }

    // パターンベースの修正
    let fixed = scientificName;

    // 不完全な亜属名のみの場合
    if (fixed.match(/^[A-Z][a-z]+ \([A-Z][a-z]+\)$/)) {
      if (genus && species) {
        // 属名 (亜属名) → 属名 種小名 著者, 年
        let replacement = `${genus} ${species}`;
        if (author) {
          replacement += ` ${author}`;
          if (year) {
            replacement += `, ${year}`;
          }
        }
        fixed = replacement;
      }
    }

    // 二重括弧の修正
    fixed = fixed.replace(/\([^,)]*\)\s*\([^)]*\)/g, match => {
      // 複雑な二重括弧は単純化
      return match.replace(/\)\s*\(/g, ', ');
    });

    return fixed.trim();
  }

  processCSV() {
    console.log('🚀 ハムシCSVデータクリーニング開始...');
    
    const csvPath = path.join(__dirname, '..', 'public', 'hamushi_species_integrated.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ hamushi_species_integrated.csv が見つかりません');
      return false;
    }

    // バックアップ作成
    const backupPath = csvPath.replace('.csv', `${BACKUP_SUFFIX}.csv`);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(csvPath, backupPath);
      console.log(`💾 バックアップ作成: ${path.basename(backupPath)}`);
    }

    const csvData = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

    let fixes = {
      plantNameFixes: 0,
      scientificNameFixes: 0,
      duplicatesRemoved: 0,
      totalChanges: 0
    };

    const processedData = [];
    const seenEntries = new Map(); // 重複チェック用

    parsed.data.forEach((row, index) => {
      const japaneseName = row['和名']?.trim() || '';
      const scientificName = row['学名']?.trim() || '';
      const hostPlants = row['食草']?.trim() || '';
      const genus = row['属名']?.trim() || '';
      const species = row['種小名']?.trim() || '';
      const author = row['著者']?.trim() || '';
      const year = row['公表年']?.trim() || '';

      // 重複チェック
      const baseJapaneseName = japaneseName.replace(/　.+$/, '');
      if (this.duplicateHandling.has(baseJapaneseName)) {
        if (seenEntries.has(baseJapaneseName)) {
          console.log(`🔄 重複エントリをスキップ: ${japaneseName} (Row ${index + 2})`);
          fixes.duplicatesRemoved++;
          fixes.totalChanges++;
          return; // 重複をスキップ
        }
        seenEntries.set(baseJapaneseName, true);
      }

      const processedRow = { ...row };

      // 植物名のクリーニング
      if (hostPlants) {
        const cleanedPlants = this.cleanPlantNames(hostPlants);
        if (cleanedPlants !== hostPlants) {
          console.log(`🌿 植物名修正 (Row ${index + 2}): "${hostPlants}" → "${cleanedPlants}"`);
          processedRow['食草'] = cleanedPlants;
          fixes.plantNameFixes++;
          fixes.totalChanges++;
        }
      }

      // 学名の修正
      const fixedScientificName = this.fixScientificName(scientificName, genus, species, author, year);
      if (fixedScientificName !== scientificName) {
        console.log(`🔬 学名修正 (Row ${index + 2}): "${scientificName}" → "${fixedScientificName}"`);
        processedRow['学名'] = fixedScientificName;
        fixes.scientificNameFixes++;
        fixes.totalChanges++;
      }

      processedData.push(processedRow);
    });

    if (fixes.totalChanges === 0) {
      console.log('✅ 修正が必要な問題は見つかりませんでした');
      return true;
    }

    // 修正されたデータを書き戻し
    const fixedCsv = Papa.unparse(processedData, { header: true });
    fs.writeFileSync(csvPath, fixedCsv, 'utf8');

    console.log('\n🎯 修正完了:');
    console.log(`  🌿 植物名修正: ${fixes.plantNameFixes}件`);
    console.log(`  🔬 学名修正: ${fixes.scientificNameFixes}件`);
    console.log(`  🔄 重複削除: ${fixes.duplicatesRemoved}件`);
    console.log(`  📊 総変更数: ${fixes.totalChanges}件`);
    console.log(`  📄 処理後レコード数: ${processedData.length}件`);

    return true;
  }
}

// 実行
if (require.main === module) {
  const cleaner = new HamushiCSVCleaner();
  const success = cleaner.processCSV();
  
  if (success) {
    console.log('\n🎉 ハムシCSVクリーニング完了!');
    console.log('\n📝 次のステップ:');
    console.log('1. アプリケーションでテスト実行');
    console.log('2. コンソールログの減少を確認');
    console.log('3. JavaScriptの複雑な処理ロジックを簡素化');
    console.log('4. 問題があればバックアップから復元可能');
  } else {
    console.log('\n❌ クリーニング中にエラーが発生しました');
  }
}