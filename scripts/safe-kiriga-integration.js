#!/usr/bin/env node

/**
 * 安全なキリガデータ統合スクリプト
 * 
 * 特徴:
 * - 元のファイル構造を完全に保持
 * - BOMを維持
 * - 既存の26カラム構造を維持
 * - 複数レベルのバックアップ
 * - 詳細な検証機能
 * - ロールバック機能
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ファイルパス設定
const MAIN_DATA_FILE = path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_bokutou.csv');
const BACKUP_DIR = path.join(__dirname, '../backups');

// バックアップディレクトリを作成
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 安全なキリガデータ（厳選した5種のみでテスト）
const SAFE_KIRIGA_DATA = [
  {
    和名: 'タニガワモクメキリガ',
    学名: 'Brachionycha permixta',
    食草: 'サクラ類（バラ科）',
    備考: '野外からは未知。飼育下での記録。発生時期: 3~4月',
    出典: '日本のキリガ'
  },
  {
    和名: 'エゾモクメキリガ',  
    学名: 'Brachionycha nubeculosa',
    食草: 'ハルニレ、ミズナラ、ブナ、ヤナギ類、サクラ類',
    備考: 'サクラ類は飼育下での記録。発生時期: 3月下旬~5月上旬',
    出典: '日本のキリガ'
  },
  {
    和名: 'ハンノキリガ',
    学名: 'Lithophane ustulata',
    食草: 'カシワ、コナラ、ミズナラ、フモトミズナラ、クリ（飼育）、シダレヤナギ（飼育）',
    備考: 'クリ、シダレヤナギは飼育下での記録。発生時期: 10月頃羽化し、翌年4月まで',
    出典: '日本のキリガ'
  },
  {
    和名: 'アヤモクメキリガ',
    学名: 'Xylena fumosa',
    食草: 'サクラ類、ダイズ、アズキ、ヤハズエンドウ、ジャガイモ、タバコ、テンサイ、ユリ類、ネギ、ノゲシなど',
    備考: '多食性。発生時期: 12~3月',
    出典: '日本のキリガ'
  },
  {
    和名: 'キバラモクメキリガ',
    学名: 'Xylena formosa',
    食草: 'クヌギ、カシワ、アベマキ、コナラ、アラカシ、シデコブシ、ナシ、サクラ、エンドウ、エニシダ、タケニグサ、イタドリ、ギシギシ、ゴボウ、キクイモ、タバコ、セッコク、エノキなど',
    備考: '多食性。発生時期: 11~4月',
    出典: '日本のキリガ'
  }
];

/**
 * 学名を正規化する（完全一致用）
 */
function normalizeScientificName(name) {
  if (!name) return '';
  return name.trim()
    .replace(/[(),]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .slice(0, 2)
    .join(' ')
    .toLowerCase();
}

/**
 * CSVフィールドを安全にエスケープ
 */
function safeCsvEscape(field) {
  if (!field) return '';
  const str = field.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * タイムスタンプ付きバックアップを作成
 */
function createBackup(sourceFile) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `ListMJ_hostplants_${timestamp}.csv`);
  fs.copyFileSync(sourceFile, backupFile);
  console.log(`バックアップ作成: ${backupFile}`);
  return backupFile;
}

/**
 * ファイルの整合性を検証
 */
function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // 基本検証
    if (lines.length < 100) {
      throw new Error('ファイルが小さすぎます');
    }
    
    // ヘッダー検証
    const header = lines[0];
    if (!header.includes('大図鑑カタログNo') || !header.includes('学名') || !header.includes('食草')) {
      throw new Error('ヘッダーが不正です');
    }
    
    // カラム数検証
    const columnCount = header.split(',').length;
    if (columnCount !== 26) {
      throw new Error(`カラム数が不正です: ${columnCount} (期待値: 26)`);
    }
    
    console.log(`ファイル検証成功: ${lines.length - 1}行, ${columnCount}カラム`);
    return true;
  } catch (error) {
    console.error(`ファイル検証エラー: ${error.message}`);
    return false;
  }
}

/**
 * 行を解析してフィールドを取得（カンマ区切り対応）
 */
function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (i + 1 < line.length && line[i + 1] === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  fields.push(currentField);
  return fields;
}

/**
 * メイン統合処理
 */
async function main() {
  try {
    console.log('=== 安全なキリガデータ統合を開始 ===');
    
    // 1. 事前検証
    if (!validateFile(MAIN_DATA_FILE)) {
      throw new Error('元ファイルの検証に失敗しました');
    }
    
    // 2. バックアップ作成
    const backupFile = createBackup(MAIN_DATA_FILE);
    
    // 3. データ読み込み
    console.log('データを読み込み中...');
    const content = fs.readFileSync(MAIN_DATA_FILE, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0];
    
    // 4. 既存データのインデックス作成
    const dataIndex = {};
    const processedLines = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length >= 24) {
        const scientificName = fields[23]; // 学名
        if (scientificName) {
          const normalized = normalizeScientificName(scientificName);
          if (normalized) {
            dataIndex[normalized] = i - 1; // processedLines内のインデックス
          }
        }
      }
      processedLines.push(fields);
    }
    
    console.log(`既存データ: ${processedLines.length}件`);
    
    // 5. キリガデータ統合（安全なテストデータのみ）
    let updatedCount = 0;
    let addedCount = 0;
    
    for (const kirigaEntry of SAFE_KIRIGA_DATA) {
      const normalized = normalizeScientificName(kirigaEntry.学名);
      
      if (normalized && dataIndex.hasOwnProperty(normalized)) {
        // 既存データの更新
        const index = dataIndex[normalized];
        const fields = processedLines[index];
        
        // 食草と出典を更新（既存の26カラム構造を維持）
        fields[24] = safeCsvEscape(kirigaEntry.食草); // 食草
        fields[25] = safeCsvEscape(kirigaEntry.出典); // 出典
        
        // 備考情報は「標準図鑑以後の変更」カラムに追加
        if (kirigaEntry.備考) {
          const existingChange = fields[22] || '';
          fields[22] = existingChange ? 
            `${existingChange}; ${kirigaEntry.備考}` : 
            kirigaEntry.備考;
        }
        
        updatedCount++;
        console.log(`更新: ${kirigaEntry.和名} (${kirigaEntry.学名})`);
      } else {
        console.log(`スキップ: ${kirigaEntry.和名} (既存データに見つからず)`);
      }
    }
    
    // 6. 統合データの保存
    console.log('統合データを保存中...');
    const outputLines = [header];
    
    for (const fields of processedLines) {
      // 26カラム確保
      while (fields.length < 26) {
        fields.push('');
      }
      outputLines.push(fields.join(','));
    }
    
    const outputContent = outputLines.join('\n');
    
    // 7. 保存前の最終検証
    fs.writeFileSync(MAIN_DATA_FILE + '.tmp', outputContent, 'utf-8');
    
    if (!validateFile(MAIN_DATA_FILE + '.tmp')) {
      throw new Error('統合後ファイルの検証に失敗しました');
    }
    
    // 8. ファイル置換
    fs.renameSync(MAIN_DATA_FILE + '.tmp', MAIN_DATA_FILE);
    
    // 9. 最終検証
    if (!validateFile(MAIN_DATA_FILE)) {
      // ロールバック
      console.error('最終検証失敗。バックアップからロールバックします');
      fs.copyFileSync(backupFile, MAIN_DATA_FILE);
      throw new Error('統合に失敗しました');
    }
    
    console.log('\n=== 統合完了 ===');
    console.log(`更新された種: ${updatedCount}件`);
    console.log(`新規追加された種: ${addedCount}件`);
    console.log(`バックアップ: ${backupFile}`);
    console.log(`統合データ: ${MAIN_DATA_FILE}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateFile, createBackup, SAFE_KIRIGA_DATA };