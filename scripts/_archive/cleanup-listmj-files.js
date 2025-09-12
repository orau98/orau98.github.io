#!/usr/bin/env node

/**
 * ListMJファイル群をクリーンアップして不要なファイルを削除
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

console.log('=== ListMJファイルクリーンアップ開始 ===');

// 削除対象ファイル
const filesToRemove = [
  // publicディレクトリ内の不要ファイル
  'public/ListMJ_hostplants_integrated_with_bokutou.csv',
  'public/ListMJ_hostplants_integrated_with_kiriga.csv', 
  'public/ListMJ_hostplants_cleaned_comprehensive.csv',
  'public/ListMJ_hostplants_cleaned_comprehensive_backup.csv',
  
  // ルートディレクトリの古いファイル
  'ListMJ_hostplants0616.csv',
  'ListMJ_hostplants_integrated_with_bokutou.csv'
];

// 保持するファイル（確認用）
const filesToKeep = [
  'public/ListMJ_hostplants_master.csv', // 新しい統合ファイル
  'backups/' // バックアップディレクトリ全体
];

console.log('削除対象ファイル:');
filesToRemove.forEach(file => {
  const fullPath = path.join(PROJECT_ROOT, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ 削除: ${file}`);
    fs.unlinkSync(fullPath);
  } else {
    console.log(`  - 見つからず: ${file}`);
  }
});

console.log('\n保持されるファイル:');
filesToKeep.forEach(file => {
  const fullPath = path.join(PROJECT_ROOT, file);
  if (fs.existsSync(fullPath)) {
    if (file.endsWith('/')) {
      // ディレクトリの場合、内容を表示
      const files = fs.readdirSync(fullPath).filter(f => f.startsWith('ListMJ'));
      if (files.length > 0) {
        console.log(`  ✓ 保持: ${file}`);
        files.forEach(f => console.log(`    - ${f}`));
      }
    } else {
      // ファイルの場合、サイズを表示
      const stats = fs.statSync(fullPath);
      console.log(`  ✓ 保持: ${file} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    }
  } else {
    console.log(`  ❌ 見つからず: ${file}`);
  }
});

// distディレクトリもクリーンアップ
const distListMJFiles = fs.readdirSync(path.join(PROJECT_ROOT, 'dist'))
  .filter(file => file.startsWith('ListMJ') && file !== 'ListMJ_hostplants_master.csv');

if (distListMJFiles.length > 0) {
  console.log('\ndistディレクトリのクリーンアップ:');
  distListMJFiles.forEach(file => {
    const fullPath = path.join(PROJECT_ROOT, 'dist', file);
    console.log(`  ✓ 削除: dist/${file}`);
    fs.unlinkSync(fullPath);
  });
}

console.log('\n=== クリーンアップ完了 ===');
console.log('結果:');
console.log('- 統合されたマスターファイル: public/ListMJ_hostplants_master.csv');
console.log('- バックアップファイル: backups/ ディレクトリ内');
console.log('- 不要なListMJファイルが削除されました');

// 最終確認
console.log('\n=== 最終確認 ===');
const remainingListMJ = [];

// publicディレクトリを確認
const publicFiles = fs.readdirSync(path.join(PROJECT_ROOT, 'public'))
  .filter(file => file.startsWith('ListMJ'));
remainingListMJ.push(...publicFiles.map(f => `public/${f}`));

// ルートディレクトリを確認
const rootFiles = fs.readdirSync(PROJECT_ROOT)
  .filter(file => file.startsWith('ListMJ'));
remainingListMJ.push(...rootFiles);

console.log('残存するListMJファイル:');
if (remainingListMJ.length === 0) {
  console.log('  なし');
} else {
  remainingListMJ.forEach(file => {
    console.log(`  ${file}`);
  });
}

console.log('\n統合プロジェクト完了！');