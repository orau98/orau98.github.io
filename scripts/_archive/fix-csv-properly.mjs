#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const CSV_FILE = path.join(ROOT_DIR, 'public', 'ListMJ_hostplants_master.csv');
const OUTPUT_FILE = path.join(ROOT_DIR, 'public', 'ListMJ_hostplants_master_fixed.csv');

async function fixCsvProperly() {
  console.log('📋 CSV完全修正ツール');
  console.log(`入力: ${CSV_FILE}`);
  console.log(`出力: ${OUTPUT_FILE}\n`);

  try {
    // ファイルを読み込み
    const csvContent = await fs.readFile(CSV_FILE, 'utf-8');
    
    // PapaParseで正しく解析（クォートを考慮）
    console.log('🔍 PapaParseでCSVを正しく解析中...');
    const parseResult = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: false,
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ',',
      dynamicTyping: false, // すべて文字列として扱う
      comments: false
    });

    const rows = parseResult.data;
    console.log(`  - 総行数: ${rows.length}`);

    // ヘッダー行を取得して実際の列数を確認
    const header = rows[0];
    
    // ヘッダーから末尾の空文字列を削除
    while (header.length > 0 && header[header.length - 1].trim() === '') {
      header.pop();
    }
    
    const targetColumns = header.length;
    console.log(`  - ターゲット列数: ${targetColumns}`);
    console.log(`  - ヘッダー最終列: "${header[header.length - 1]}"\n`);

    // 各行を正規化
    const normalizedRows = [];
    let stats = {
      trimmed: 0,
      padded: 0,
      unchanged: 0
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let normalizedRow;

      if (i === 0) {
        // ヘッダー行
        normalizedRow = header;
      } else {
        // データ行
        if (row.length > targetColumns) {
          // 末尾の余分な空列を削除
          normalizedRow = row.slice(0, targetColumns);
          // 末尾が全て空かチェック
          const removed = row.slice(targetColumns);
          if (removed.some(cell => cell.trim() !== '')) {
            console.warn(`⚠️  行${i + 1}: データのある列を削除しました:`, removed.filter(c => c.trim() !== ''));
          }
          stats.trimmed++;
        } else if (row.length < targetColumns) {
          // 不足分を空文字で埋める
          normalizedRow = [...row];
          while (normalizedRow.length < targetColumns) {
            normalizedRow.push('');
          }
          stats.padded++;
        } else {
          normalizedRow = row;
          stats.unchanged++;
        }
      }

      normalizedRows.push(normalizedRow);
    }

    // 修正後のCSVを生成（PapaParseで適切にエスケープ）
    console.log('📝 修正済みCSVを生成中...');
    const fixedCsv = Papa.unparse(normalizedRows, {
      quotes: (value, column) => {
        // カンマ、改行、ダブルクォートを含む場合のみクォート
        if (typeof value === 'string' && (
          value.includes(',') || 
          value.includes('\n') || 
          value.includes('\r') || 
          value.includes('"')
        )) {
          return true;
        }
        return false;
      },
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ',',
      header: false,
      newline: '\n',
      skipEmptyLines: false
    });

    // ファイルに書き込み
    await fs.writeFile(OUTPUT_FILE, fixedCsv);
    
    console.log('\n✅ 修正完了！');
    console.log('📊 処理統計:');
    console.log(`  - 余分な列を削除: ${stats.trimmed}行`);
    console.log(`  - 不足列を追加: ${stats.padded}行`);
    console.log(`  - 変更なし: ${stats.unchanged}行`);

    // 検証
    console.log('\n🔍 修正後の検証...');
    const verifyContent = await fs.readFile(OUTPUT_FILE, 'utf-8');
    const verifyResult = Papa.parse(verifyContent, {
      header: false,
      skipEmptyLines: false
    });

    const columnCounts = {};
    verifyResult.data.forEach((row, idx) => {
      const count = row.length;
      columnCounts[count] = (columnCounts[count] || 0) + 1;
    });

    console.log('列数の分布:');
    Object.entries(columnCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cols, count]) => {
        const bar = '█'.repeat(Math.min(50, Math.floor(count / 100)));
        console.log(`  ${cols}列: ${count}行 ${bar}`);
      });

    // エラーチェック
    if (verifyResult.errors.length > 0) {
      const errorTypes = {};
      verifyResult.errors.forEach(err => {
        errorTypes[err.code] = (errorTypes[err.code] || 0) + 1;
      });
      console.log('\n⚠️  パースエラー:');
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}件`);
      });
    }

    // 最終確認
    if (Object.keys(columnCounts).length === 1 && columnCounts[targetColumns]) {
      console.log(`\n✨ 完璧！すべての行が${targetColumns}列に統一されました！`);
      console.log(`\n次のステップ:`);
      console.log(`1. 確認: diff ${CSV_FILE} ${OUTPUT_FILE}`);
      console.log(`2. 置き換え: mv ${OUTPUT_FILE} ${CSV_FILE}`);
    } else {
      console.log('\n⚠️  まだ列数にばらつきがあります。');
      
      // サンプル表示
      const problems = verifyResult.data
        .map((row, idx) => ({ row, idx, len: row.length }))
        .filter(item => item.len !== targetColumns)
        .slice(0, 5);
      
      if (problems.length > 0) {
        console.log('\n問題のある行のサンプル:');
        problems.forEach(({ row, idx, len }) => {
          console.log(`  行${idx + 1} (${len}列): ${row[0]} | ${row[23]} | ${row[24]} | ${row[25]}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 実行
fixCsvProperly().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});