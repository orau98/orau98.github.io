const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

/**
 * ハムシCSVデータの問題を詳細分析するスクリプト
 */

const analyzeHamushiCSV = () => {
  console.log('🔍 ハムシCSVデータ問題分析を開始...');
  
  const csvPath = path.join(__dirname, '..', 'public', 'hamushi_species_integrated.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('❌ hamushi_species_integrated.csv が見つかりません');
    return;
  }

  const csvData = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
  
  if (parsed.errors.length) {
    console.log('⚠️  CSVパースエラー:', parsed.errors.length);
  }

  const issues = {
    scientificNameIssues: [],
    plantNameIssues: [],
    incompleteData: [],
    duplicateEntries: [],
    spSpecies: []
  };

  // 問題のある植物名リスト（YListで見つからないもの）
  const problematicPlants = new Set();
  
  // 重複チェック用
  const speciesCount = new Map();

  parsed.data.forEach((row, index) => {
    const japaneseName = row['和名']?.trim() || '';
    const scientificName = row['学名']?.trim() || '';
    const hostPlants = row['食草']?.trim() || '';
    const genus = row['属名']?.trim() || '';
    const species = row['種小名']?.trim() || '';

    // 1. 学名の問題をチェック
    if (scientificName) {
      // 不完全な学名 (属名のみ、亜属のみなど)
      if (scientificName.match(/^[A-Z][a-z]+ \([A-Z][a-z]+\)$/)) {
        issues.scientificNameIssues.push({
          row: index + 2,
          japaneseName,
          scientificName,
          issue: '不完全な学名（亜属名のみ）',
          genus,
          species
        });
      }
      
      // sp. を含む未同定種
      if (scientificName.includes(' sp.')) {
        issues.spSpecies.push({
          row: index + 2,
          japaneseName,
          scientificName,
          genus,
          species
        });
      }
      
      // 不正な括弧の使用
      if (scientificName.match(/\([^,)]*\)\s*\([^)]*\)/)) {
        issues.scientificNameIssues.push({
          row: index + 2,
          japaneseName,
          scientificName,
          issue: '不正な括弧構造',
          genus,
          species
        });
      }
    }

    // 2. 植物名の問題をチェック
    if (hostPlants && hostPlants !== '不明') {
      const plants = hostPlants.split(/[、,，]/).map(p => p.trim());
      plants.forEach(plant => {
        // 一般的すぎる植物名
        if (['ツバキ', 'クワ', 'サクラ', 'マツ', 'ヤナギ', 'ハギ', 'カンバ', 'シデ', 'ブドウ', 'リンゴ', 'ツツジ'].includes(plant)) {
          problematicPlants.add(plant);
        }
        
        // 説明的な記述
        if (plant.includes('など') || plant.includes('類') || plant.includes('の花') || plant.includes('の実')) {
          issues.plantNameIssues.push({
            row: index + 2,
            japaneseName,
            plantName: plant,
            issue: '不正確な植物名記述'
          });
        }
      });
    }

    // 3. 不完全なデータをチェック
    if (!scientificName && (!genus || !species)) {
      issues.incompleteData.push({
        row: index + 2,
        japaneseName,
        issue: '学名データが不完全'
      });
    }

    // 4. 重複をチェック
    if (japaneseName) {
      const baseJapaneseName = japaneseName.replace(/　.+$/, ''); // 亜種情報を除去
      speciesCount.set(baseJapaneseName, (speciesCount.get(baseJapaneseName) || 0) + 1);
    }
  });

  // 重複エントリを特定
  speciesCount.forEach((count, name) => {
    if (count > 1) {
      issues.duplicateEntries.push({ name, count });
    }
  });

  // 結果出力
  console.log('\n📊 分析結果:');
  console.log(`総レコード数: ${parsed.data.length}`);
  
  console.log('\n🚨 学名の問題:');
  console.log(`- 不完全な学名: ${issues.scientificNameIssues.length}件`);
  issues.scientificNameIssues.slice(0, 5).forEach(issue => {
    console.log(`  Row ${issue.row}: ${issue.japaneseName} - ${issue.scientificName} (${issue.issue})`);
  });
  
  console.log('\n🌿 植物名の問題:');
  console.log(`- 問題のある植物名: ${problematicPlants.size}種類`);
  console.log(`  一般的すぎる名前: ${Array.from(problematicPlants).join(', ')}`);
  console.log(`- 不正確な記述: ${issues.plantNameIssues.length}件`);
  
  console.log('\n🔍 sp. 未同定種:');
  console.log(`- 未同定種の数: ${issues.spSpecies.length}件`);
  issues.spSpecies.slice(0, 5).forEach(issue => {
    console.log(`  ${issue.japaneseName}: ${issue.scientificName}`);
  });
  
  console.log('\n📋 重複エントリ:');
  console.log(`- 重複種の数: ${issues.duplicateEntries.length}種`);
  issues.duplicateEntries.slice(0, 5).forEach(issue => {
    console.log(`  ${issue.name}: ${issue.count}回`);
  });
  
  console.log('\n💡 推奨される修正:');
  console.log('1. 植物名の標準化 (例: ツバキ → ヤブツバキ)');
  console.log('2. 不完全な学名の完全な種名への置換');
  console.log('3. 重複エントリの統合');
  console.log('4. sp. 未同定種の正確な種名への更新');
  
  // 詳細な問題リストをファイルに出力
  const reportPath = path.join(__dirname, 'hamushi-csv-issues-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2), 'utf8');
  console.log(`\n📄 詳細レポートを保存: ${reportPath}`);
  
  return issues;
};

// 実行
if (require.main === module) {
  analyzeHamushiCSV();
}