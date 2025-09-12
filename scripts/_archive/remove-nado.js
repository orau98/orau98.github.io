import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSVファイルを読み込む関数
function loadCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`CSVファイルが見つかりません: ${filePath}`);
      return null;
    }
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      console.warn(`CSV解析警告 ${filePath}:`, result.errors.slice(0, 3));
    }
    
    return { data: result.data, meta: result.meta };
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error.message}`);
    return null;
  }
}

// CSVファイルを保存する関数
function saveCSV(filePath, data, fieldNames) {
  try {
    const csv = Papa.unparse(data, {
      header: true,
      columns: fieldNames
    });
    fs.writeFileSync(filePath, csv, 'utf-8');
    return true;
  } catch (error) {
    console.error(`CSVファイルの保存エラー: ${error.message}`);
    return false;
  }
}

// 植物名から「など」を除去する関数
function removeNado(plantName) {
  if (!plantName || typeof plantName !== 'string') {
    return plantName;
  }
  
  // 「など」で終わる場合は除去
  if (plantName.endsWith('など')) {
    return plantName.substring(0, plantName.length - 2);
  }
  
  return plantName;
}

// 食草フィールドを処理する関数（複数の植物名がカンマ区切りで含まれる場合）
function processHostPlantsField(hostPlantsText) {
  if (!hostPlantsText || typeof hostPlantsText !== 'string') {
    return hostPlantsText;
  }
  
  // 「など」を含む場合は直接除去
  let processed = hostPlantsText;
  if (processed.includes('など')) {
    // カンマまたは日本語の読点で分割
    const plants = processed.split(/[、,，]/).map(plant => {
      const trimmed = plant.trim();
      return removeNado(trimmed);
    });
    processed = plants.join('、');
  }
  
  return processed;
}

// メイン処理関数
function removeNadoFromCSVs() {
  console.log('「など」除去処理を開始します...');
  
  const publicDir = path.join(__dirname, '../public');
  const csvFiles = [
    'ListMJ_hostplants_master.csv',
    'hamushi_integrated_master.csv',
    'butterfly_host.csv',
    'buprestidae_host.csv',
    'ハムシ.csv',
    '日本のキリガ.csv',
    '日本のキリガ_corrected.csv',
    '日本のキリガ_fixed.csv',
    '日本のハマキガ1.csv',
    '日本のハマキガ1_fixed.csv'
  ];
  
  let totalChanges = 0;
  let processedFiles = 0;
  
  csvFiles.forEach(fileName => {
    const filePath = path.join(publicDir, fileName);
    console.log(`\n処理中: ${fileName}`);
    
    const csvResult = loadCSV(filePath);
    if (!csvResult) {
      console.log(`  スキップ: ファイルが見つかりません`);
      return;
    }
    
    const { data, meta } = csvResult;
    let fileChanges = 0;
    
    // 食草関連のフィールドを特定
    const hostPlantFields = meta.fields.filter(field => 
      field.includes('食草') || 
      field.includes('ホスト') || 
      field.includes('host') ||
      field === '食草' ||
      field === 'ホストプラント'
    );
    
    console.log(`  検出された食草フィールド:`, hostPlantFields);
    
    // データを処理 - すべてのフィールドをチェック
    data.forEach((row, index) => {
      Object.keys(row).forEach(field => {
        const originalValue = row[field];
        if (originalValue && typeof originalValue === 'string' && originalValue.includes('など')) {
          const newValue = processHostPlantsField(originalValue);
          if (newValue !== originalValue) {
            row[field] = newValue;
            fileChanges++;
            
            if (fileChanges <= 10) { // 最初の10個の変更をログ出力
              console.log(`    行${index + 1} [${field}]: "${originalValue}" → "${newValue}"`);
            }
          }
        }
      });
    });
    
    if (fileChanges > 0) {
      // ファイルを保存
      const success = saveCSV(filePath, data, meta.fields);
      if (success) {
        console.log(`  完了: ${fileChanges}件の変更を保存しました`);
        totalChanges += fileChanges;
        processedFiles++;
      } else {
        console.log(`  エラー: ファイルの保存に失敗しました`);
      }
    } else {
      console.log(`  変更なし: 「など」を含む項目は見つかりませんでした`);
    }
  });
  
  console.log(`\n処理完了:`);
  console.log(`- 処理ファイル数: ${processedFiles}/${csvFiles.length}`);
  console.log(`- 総変更件数: ${totalChanges}件`);
  
  if (totalChanges > 0) {
    console.log('\n注意: 変更を反映するには、アプリケーションの再ビルドが必要です。');
  }
}

// 実行
removeNadoFromCSVs();