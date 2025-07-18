#!/usr/bin/env node

/**
 * 「日本のキリガ」文献データを既存の食草データに統合するスクリプト
 * 
 * 機能:
 * - 複数の文献データソースを統合
 * - 文献情報を保持して出典追跡を可能にする
 * - 重複する種については新しい文献を優先
 * - 詳細な備考情報を保持
 */

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ファイルパス設定
const MAIN_DATA_FILE = path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_bokutou.csv');
const KIRIGA_DATA_FILE = path.join(__dirname, '../public/日本のキリガ.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_kiriga.csv');

// 文献情報定義
const SOURCES = {
  'original': '日本産蛾類標準図鑑2',
  'bokutou': '日本産蛾類標準図鑑3',
  'kiriga': '日本のキリガ'
};

/**
 * CSVファイルを読み込む
 */
async function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({
        separator: ',',
        skipEmptyLines: true,
        headers: true
      }))
      .on('data', (data) => {
        // データのクリーニング
        const cleanedData = {};
        for (const [key, value] of Object.entries(data)) {
          cleanedData[key.trim()] = value ? value.trim() : '';
        }
        results.push(cleanedData);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * 学名を正規化する（比較用）
 */
function normalizeScientificName(name) {
  if (!name) return '';
  // 基本的なクリーニング
  return name.trim()
    .replace(/[(),]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * 食草情報を統合する
 */
function mergeHostPlantData(existingData, newData) {
  // 新しいデータを優先しつつ、既存データの詳細情報も保持
  const merged = { ...existingData };
  
  // 学名関連の更新
  if (newData.学名) {
    merged.学名 = newData.学名;
  }
  
  // 食草情報の更新（新しいデータを優先）
  if (newData.食草) {
    merged.食草 = newData.食草;
  }
  
  // 出典を「日本のキリガ」に更新
  merged.出典 = SOURCES.kiriga;
  
  // 備考情報を統合
  const remarks = [];
  if (newData['食草に関する備考']) {
    remarks.push(`食草: ${newData['食草に関する備考']}`);
  }
  if (newData['成虫の発生時期']) {
    remarks.push(`発生時期: ${newData['成虫の発生時期']}`);
  }
  if (existingData.備考 && existingData.備考 !== newData['食草に関する備考']) {
    remarks.push(`旧備考: ${existingData.備考}`);
  }
  
  merged.備考 = remarks.join(' | ');
  
  return merged;
}

/**
 * 新しいキリガデータエントリを作成
 */
function createNewKirigaEntry(kirigaData) {
  return {
    '大図鑑カタログNo': '', // 新しいエントリなので空
    '科名': 'Noctuidae',
    '科和名': 'ヤガ科',
    '亜科名': '', // 詳細不明
    '亜科和名': '',
    '族名': '',
    '族和名': '',
    '亜族名': '',
    '亜族和名': '',
    '属名': '', // 学名から抽出可能だが、一旦空で
    '亜属名': '',
    '種小名': '',
    '亜種小名': '',
    '著者': '',
    '公表年': '',
    '類似種': '',
    '和名': kirigaData.和名,
    '旧和名': '',
    '別名': '',
    'その他の和名': '',
    '亜種範囲': '',
    '標準図鑑ステータス': '',
    '標準図鑑以後の変更': '日本のキリガ追加データ',
    '学名': kirigaData.学名,
    '食草': kirigaData.食草,
    '出典': SOURCES.kiriga,
    '備考': [
      kirigaData['食草に関する備考'] ? `食草: ${kirigaData['食草に関する備考']}` : '',
      kirigaData['成虫の発生時期'] ? `発生時期: ${kirigaData['成虫の発生時期']}` : ''
    ].filter(Boolean).join(' | ')
  };
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('データ統合処理を開始します...');
    
    // 既存データを読み込み
    console.log('既存データを読み込み中...');
    const existingData = await readCsvFile(MAIN_DATA_FILE);
    console.log(`既存データ: ${existingData.length}件`);
    
    // キリガデータを読み込み
    console.log('キリガデータを読み込み中...');
    const kirigaData = await readCsvFile(KIRIGA_DATA_FILE);
    console.log(`キリガデータ: ${kirigaData.length}件`);
    
    // 統合データを作成
    const integratedData = [...existingData];
    let updatedCount = 0;
    let addedCount = 0;
    
    // 既存データのインデックスを作成（学名ベース）
    const existingIndex = {};
    existingData.forEach((entry, index) => {
      const normalizedName = normalizeScientificName(entry.学名);
      if (normalizedName) {
        existingIndex[normalizedName] = index;
      }
    });
    
    // キリガデータを処理
    for (const kirigaEntry of kirigaData) {
      const normalizedName = normalizeScientificName(kirigaEntry.学名);
      
      console.log(`処理中: ${kirigaEntry.和名} (${kirigaEntry.学名}) -> 正規化: ${normalizedName}`);
      
      if (normalizedName && existingIndex.hasOwnProperty(normalizedName)) {
        // 既存データを更新
        const existingIndex_num = existingIndex[normalizedName];
        integratedData[existingIndex_num] = mergeHostPlantData(
          integratedData[existingIndex_num],
          kirigaEntry
        );
        updatedCount++;
        console.log(`更新: ${kirigaEntry.和名} (${kirigaEntry.学名})`);
      } else if (normalizedName) {
        // 新しいエントリを追加
        integratedData.push(createNewKirigaEntry(kirigaEntry));
        addedCount++;
        console.log(`追加: ${kirigaEntry.和名} (${kirigaEntry.学名})`);
      } else {
        console.log(`スキップ: ${kirigaEntry.和名} (学名が空または無効)`);
      }
    }
    
    // 統合データを保存
    console.log('統合データを保存中...');
    
    // CSVライターを設定
    const csvWriter = createObjectCsvWriter({
      path: OUTPUT_FILE,
      header: [
        { id: '大図鑑カタログNo', title: '大図鑑カタログNo' },
        { id: '科名', title: '科名' },
        { id: '科和名', title: '科和名' },
        { id: '亜科名', title: '亜科名' },
        { id: '亜科和名', title: '亜科和名' },
        { id: '族名', title: '族名' },
        { id: '族和名', title: '族和名' },
        { id: '亜族名', title: '亜族名' },
        { id: '亜族和名', title: '亜族和名' },
        { id: '属名', title: '属名' },
        { id: '亜属名', title: '亜属名' },
        { id: '種小名', title: '種小名' },
        { id: '亜種小名', title: '亜種小名' },
        { id: '著者', title: '著者' },
        { id: '公表年', title: '公表年' },
        { id: '類似種', title: '類似種' },
        { id: '和名', title: '和名' },
        { id: '旧和名', title: '旧和名' },
        { id: '別名', title: '別名' },
        { id: 'その他の和名', title: 'その他の和名' },
        { id: '亜種範囲', title: '亜種範囲' },
        { id: '標準図鑑ステータス', title: '標準図鑑ステータス' },
        { id: '標準図鑑以後の変更', title: '標準図鑑以後の変更' },
        { id: '学名', title: '学名' },
        { id: '食草', title: '食草' },
        { id: '出典', title: '出典' },
        { id: '備考', title: '備考' }
      ]
    });
    
    await csvWriter.writeRecords(integratedData);
    
    console.log('\n=== 統合処理完了 ===');
    console.log(`元データ: ${existingData.length}件`);
    console.log(`キリガデータ: ${kirigaData.length}件`);
    console.log(`更新された種: ${updatedCount}件`);
    console.log(`新規追加された種: ${addedCount}件`);
    console.log(`最終データ: ${integratedData.length}件`);
    console.log(`出力ファイル: ${OUTPUT_FILE}`);
    
    // 統合後の元ファイルのバックアップを作成
    const backupFile = MAIN_DATA_FILE.replace('.csv', '_backup.csv');
    fs.copyFileSync(MAIN_DATA_FILE, backupFile);
    console.log(`バックアップ: ${backupFile}`);
    
    // 統合データを元のファイルに上書き
    fs.copyFileSync(OUTPUT_FILE, MAIN_DATA_FILE);
    console.log(`統合データを元ファイルに反映: ${MAIN_DATA_FILE}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}