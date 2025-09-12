#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const CSV_FILE = path.join(ROOT_DIR, 'public', 'ListMJ_hostplants_master.csv');
const BACKUP_FILE = path.join(ROOT_DIR, 'public', 'ListMJ_hostplants_master.csv.backup');
const EXPECTED_COLUMNS = 30; // 正しい列数

async function fixCsvColumns() {
  console.log('📋 CSV列数修正ツール');
  console.log(`対象ファイル: ${CSV_FILE}\n`);

  try {
    // ファイルを読み込み
    const csvContent = await fs.readFile(CSV_FILE, 'utf-8');
    
    // バックアップを作成
    await fs.writeFile(BACKUP_FILE, csvContent);
    console.log(`✅ バックアップ作成: ${BACKUP_FILE}`);

    // PapaParseでCSVを解析
    console.log('🔍 CSVファイルを解析中...');
    const parseResult = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: false,
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ','
    });

    if (parseResult.errors.length > 0 && parseResult.errors[0].code !== 'TooFewFields' && parseResult.errors[0].code !== 'TooManyFields') {
      console.error('❌ 重大なパースエラー:', parseResult.errors.slice(0, 5));
    }

    const rows = parseResult.data;
    console.log(`  - 総行数: ${rows.length}`);
    console.log(`  - 期待される列数: ${EXPECTED_COLUMNS}`);

    // ヘッダー行の確認
    const header = rows[0];
    console.log(`  - ヘッダー列数: ${header.length}`);
    
    // ヘッダーから末尾の空列を削除
    while (header.length > 0 && header[header.length - 1] === '') {
      header.pop();
    }
    
    // 正しい列数を再計算（ヘッダーの実際の列数に基づく）
    const actualColumns = header.length;
    console.log(`  - 実際の列数: ${actualColumns}\n`);

    // 統計情報
    const stats = {
      fixed: 0,
      already_correct: 0,
      header_fixed: false
    };

    // 各行を修正
    const fixedRows = rows.map((row, index) => {
      if (index === 0) {
        // ヘッダー行
        if (row.length !== actualColumns) {
          stats.header_fixed = true;
          return header;
        }
        return header;
      }

      // データ行
      if (row.length > actualColumns) {
        // 余分な列を削除（末尾の空列）
        const fixedRow = row.slice(0, actualColumns);
        stats.fixed++;
        return fixedRow;
      } else if (row.length < actualColumns) {
        // 不足する列を空文字で埋める
        const fixedRow = [...row];
        while (fixedRow.length < actualColumns) {
          fixedRow.push('');
        }
        stats.fixed++;
        return fixedRow;
      } else {
        stats.already_correct++;
        return row;
      }
    });

    // 修正後のCSVを生成
    console.log('📝 修正したCSVを生成中...');
    const fixedCsv = Papa.unparse(fixedRows, {
      quotes: false, // 必要な場所のみクォート
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ',',
      header: false,
      newline: '\n'
    });

    // ファイルに書き込み
    await fs.writeFile(CSV_FILE, fixedCsv);
    
    console.log('\n✅ 修正完了！');
    console.log('📊 統計:');
    console.log(`  - 修正された行: ${stats.fixed}`);
    console.log(`  - 既に正しい行: ${stats.already_correct}`);
    console.log(`  - ヘッダー修正: ${stats.header_fixed ? 'はい' : 'いいえ'}`);
    console.log(`  - 最終的な列数: ${actualColumns}`);

    // 検証
    console.log('\n🔍 修正後の検証...');
    const verifyResult = Papa.parse(fixedCsv, {
      header: false,
      skipEmptyLines: false
    });

    const columnCounts = {};
    verifyResult.data.forEach(row => {
      const count = row.length;
      columnCounts[count] = (columnCounts[count] || 0) + 1;
    });

    console.log('列数の分布:');
    Object.entries(columnCounts).forEach(([cols, count]) => {
      console.log(`  - ${cols}列: ${count}行`);
    });

    if (Object.keys(columnCounts).length === 1) {
      console.log('\n✨ すべての行が統一された列数になりました！');
    } else {
      console.log('\n⚠️  まだ列数にばらつきがあります。手動での確認が必要かもしれません。');
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

// 実行
fixCsvColumns().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});