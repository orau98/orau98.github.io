#!/usr/bin/env node

/**
 * ListMJファイル群を統合して単一のマスターファイルを作成
 * 最も完全なデータを持つファイルをベースとして使用
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.dirname(__dirname);

// ファイルパス定義
const FILES = {
  // ベースファイル（最も多くのデータを含む）
  base: path.join(PROJECT_ROOT, 'ListMJ_hostplants_integrated_with_bokutou.csv'),
  
  // 統合対象ファイル
  fuyushaku: path.join(PROJECT_ROOT, 'public/日本の冬尺蛾.csv'),
  kiriga: path.join(PROJECT_ROOT, 'public/日本のキリガ.csv'),
  
  // 出力ファイル
  output: path.join(PROJECT_ROOT, 'public/ListMJ_hostplants_master.csv'),
  backup: path.join(PROJECT_ROOT, `backups/ListMJ_consolidation_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
};

console.log('=== ListMJファイル統合スクリプト開始 ===');

// バックアップディレクトリを作成
const backupDir = path.dirname(FILES.backup);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 現在使用中のファイルをバックアップ
const currentFile = path.join(PROJECT_ROOT, 'public/ListMJ_hostplants_cleaned_comprehensive.csv');
if (fs.existsSync(currentFile)) {
  fs.copyFileSync(currentFile, FILES.backup);
  console.log(`現在のファイルをバックアップ: ${FILES.backup}`);
}

// ベースファイルを読み込み
console.log(`ベースファイル読み込み: ${FILES.base}`);
const baseData = fs.readFileSync(FILES.base, 'utf8');
const baseParsed = Papa.parse(baseData, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (header) => header.replace(/^\uFEFF/, '') // BOM除去
});

console.log(`ベースデータ: ${baseParsed.data.length} 行`);

// フユシャクデータを読み込み
let fuyushakuData = {};
if (fs.existsSync(FILES.fuyushaku)) {
  console.log(`フユシャクデータ読み込み: ${FILES.fuyushaku}`);
  const fuyushakuCsv = fs.readFileSync(FILES.fuyushaku, 'utf8');
  const fuyushakuParsed = Papa.parse(fuyushakuCsv, {
    header: true,
    skipEmptyLines: true
  });
  
  fuyushakuParsed.data.forEach(row => {
    const name = row['和名']?.trim();
    if (name) {
      fuyushakuData[name] = {
        hostPlants: row['食草']?.trim() || '',
        notes: row['食草に関する備考']?.trim() || '',
        emergenceTime: row['成虫出現時期']?.trim() || ''
      };
    }
  });
  console.log(`フユシャクデータ: ${Object.keys(fuyushakuData).length} 種`);
}

// キリガデータを読み込み
let kirigaData = {};
if (fs.existsSync(FILES.kiriga)) {
  console.log(`キリガデータ読み込み: ${FILES.kiriga}`);
  const kirigaCsv = fs.readFileSync(FILES.kiriga, 'utf8');
  const kirigaParsed = Papa.parse(kirigaCsv, {
    header: true,
    skipEmptyLines: true
  });
  
  kirigaParsed.data.forEach(row => {
    const name = row['和名']?.trim();
    if (name) {
      kirigaData[name] = {
        hostPlants: row['食草']?.trim() || '',
        notes: row['食草に関する備考']?.trim() || '',
        emergenceTime: row['成虫出現時期']?.trim() || ''
      };
    }
  });
  console.log(`キリガデータ: ${Object.keys(kirigaData).length} 種`);
}

// 重複削除処理関数
function removeDuplicateHostPlants(hostPlantString) {
  if (!hostPlantString || hostPlantString === '不明') {
    return hostPlantString;
  }
  
  // セミコロンまたはカンマで分割
  const parts = hostPlantString.split(/[;；、，,]/).map(part => part.trim()).filter(part => part);
  
  // 重複削除
  const seen = new Set();
  const uniqueParts = [];
  
  parts.forEach(part => {
    const cleanPart = part.replace(/\s+/g, '').toLowerCase();
    if (!seen.has(cleanPart)) {
      seen.add(cleanPart);
      uniqueParts.push(part);
    }
  });
  
  return uniqueParts.join('; ');
}

// データ統合処理
console.log('データ統合処理開始...');
let integrationCount = 0;

const integratedData = baseParsed.data.map(row => {
  const japaneseName = row['和名']?.trim();
  
  if (!japaneseName) return row;
  
  let hasUpdate = false;
  let hostPlants = row['食草']?.trim() || '';
  
  // フユシャクデータとの統合
  if (fuyushakuData[japaneseName]) {
    const fData = fuyushakuData[japaneseName];
    if (fData.hostPlants && fData.hostPlants !== '不明' && (!hostPlants || hostPlants === '不明')) {
      hostPlants = fData.hostPlants;
      hasUpdate = true;
    }
  }
  
  // キリガデータとの統合
  if (kirigaData[japaneseName]) {
    const kData = kirigaData[japaneseName];
    if (kData.hostPlants && kData.hostPlants !== '不明' && (!hostPlants || hostPlants === '不明')) {
      hostPlants = kData.hostPlants;
      hasUpdate = true;
    }
  }
  
  // 重複削除処理
  if (hostPlants) {
    const cleanedHostPlants = removeDuplicateHostPlants(hostPlants);
    if (cleanedHostPlants !== hostPlants) {
      hostPlants = cleanedHostPlants;
      hasUpdate = true;
    }
  }
  
  if (hasUpdate) {
    integrationCount++;
    console.log(`統合: ${japaneseName} -> ${hostPlants}`);
  }
  
  return {
    ...row,
    '食草': hostPlants,
    // 備考列を削除（BOM除去のため列構成を正規化）
    '備考': undefined
  };
});

console.log(`統合完了: ${integrationCount} 種のデータが更新されました`);

// 最終データをCSVとして出力
const finalHeaders = Object.keys(integratedData[0]).filter(key => key !== '備考');
const csvData = Papa.unparse({
  fields: finalHeaders,
  data: integratedData.map(row => {
    const filteredRow = {};
    finalHeaders.forEach(header => {
      filteredRow[header] = row[header] || '';
    });
    return filteredRow;
  })
});

// ファイル出力
fs.writeFileSync(FILES.output, csvData, 'utf8');
console.log(`統合ファイル作成完了: ${FILES.output}`);
console.log(`最終データ: ${integratedData.length} 行`);

// 統合前後の比較情報
console.log('\n=== 統合結果サマリー ===');
console.log(`ベースファイル: ${baseParsed.data.length} 行`);
console.log(`統合後ファイル: ${integratedData.length} 行`);
console.log(`統合データ数: ${integrationCount} 種`);
console.log(`フユシャクソース: ${Object.keys(fuyushakuData).length} 種`);
console.log(`キリガソース: ${Object.keys(kirigaData).length} 種`);

console.log('\n=== 統合完了 ===');
console.log('次の手順:');
console.log('1. src/App.jsx のCSVファイル参照を ListMJ_hostplants_master.csv に更新');
console.log('2. 不要なListMJファイルを削除');
console.log('3. アプリケーションのテスト実行');