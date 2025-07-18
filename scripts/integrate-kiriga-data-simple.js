#!/usr/bin/env node

/**
 * 「日本のキリガ」文献データを既存の食草データに統合するスクリプト（簡易版）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ファイルパス設定
const MAIN_DATA_FILE = path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_bokutou.csv');
const KIRIGA_DATA_FILE = path.join(__dirname, '../public/日本のキリガ.csv');

/**
 * 手動でキリガデータを定義
 */
const kirigaData = [
  {
    和名: 'タニガワモクメキリガ',
    学名: 'Brachionycha permixta',
    食草: 'サクラ類（バラ科）',
    備考: '野外からは未知。飼育下での記録。',
    発生時期: '3~4月'
  },
  {
    和名: 'タカセモクメキリガ',
    学名: 'Brachionycha sajana',
    食草: 'カラマツ',
    備考: '飼育下でよく食べることから野外でも食べていると推測される。天然カラマツ林に固有だったが植林で生息域を広げたと考えられる。',
    発生時期: '3月下旬~4月'
  },
  {
    和名: 'エゾモクメキリガ',
    学名: 'Brachionycha nubeculosa',
    食草: 'ハルニレ、ミズナラ、ブナ、ヤナギ類、サクラ類',
    備考: 'サクラ類は飼育下での記録。',
    発生時期: '3月下旬~5月上旬'
  },
  {
    和名: 'ハイイロハガネヨトウ',
    学名: 'Xanthia cinerea',
    食草: 'ハルニレ、オヒョウ',
    備考: '',
    発生時期: '9-10月'
  },
  {
    和名: 'ホソバハガタヨトウ',
    学名: 'Meganephria funesta',
    食草: 'ケヤキ',
    備考: '',
    発生時期: '10~11月'
  },
  {
    和名: 'ミドリハガタヨトウ',
    学名: 'Meganephria extensa',
    食草: 'ケヤキ',
    備考: '',
    発生時期: '10~11月'
  },
  {
    和名: 'ミヤマゴマキリガ',
    学名: 'Feralia sauberi',
    食草: 'カラマツ',
    備考: 'カラマツ植林により分布を拡大したと考えられる。',
    発生時期: '5月上旬頃から7月上旬頃まで'
  },
  {
    和名: 'ケンモンミドリキリガ',
    学名: 'Daseochaeta viridis',
    食草: 'チドリノキ、ヤマザクラ',
    備考: '',
    発生時期: '9~11月'
  },
  {
    和名: 'ナンカイミドリキリガ',
    学名: 'Diphtherocome autumnalis',
    食草: 'サクラ類',
    備考: '飼育下での記録。',
    発生時期: '11月下旬~1月'
  },
  {
    和名: 'シロモンアカガネヨトウ',
    学名: 'Valeria dilutiapicana',
    食草: 'ハルニレ',
    備考: '',
    発生時期: '4-5月'
  },
  {
    和名: 'プライヤオビキリガ',
    学名: 'Dryobotodes pryeri',
    食草: 'ヒメヤシャブシ、コナラ、カシワ',
    備考: '',
    発生時期: '9月中旬~11月'
  },
  {
    和名: 'ナカオビキリガ',
    学名: 'Dryobotodes intermissa',
    食草: 'アラカシ、クヌギ',
    備考: '飼育下での記録。',
    発生時期: '10月~12月'
  },
  {
    和名: 'ホソバオビキリガ',
    学名: 'Dryobotodes angusta',
    食草: 'ウバメガシ、クヌギ、カシワ',
    備考: 'クヌギは飼育下での記録。産地の多くはウバメガシ自生地と重なるため、ウバメガシ林が主要生息地と考えられる。東日本ではカシワ林で得られており、カシワを食べている可能性がある。',
    発生時期: '11月上旬~12月上旬'
  },
  {
    和名: 'ヒロバモクメキリガ',
    学名: 'Xylena changi',
    食草: 'カマツカ、カナメモチ、ソメイヨシノ、ミミズバイ、サカキ、ツバキ、アラカシなど',
    備考: '多食性。',
    発生時期: '11~3月'
  },
  {
    和名: 'ハネナガモクメキリガ',
    学名: 'Xylena nihonica',
    食草: 'ミミズバイ、サカキ、ツバキ、アラカシ、イジュなど',
    備考: '多食性。',
    発生時期: '11~3月'
  },
  {
    和名: 'アヤモクメキリガ',
    学名: 'Xylena fumosa',
    食草: 'サクラ類、ダイズ、アズキ、ヤハズエンドウ、ジャガイモ、タバコ、テンサイ、ユリ類、ネギ、ノゲシなど',
    備考: '多食性。',
    発生時期: '12~3月'
  },
  {
    和名: 'キバラモクメキリガ',
    学名: 'Xylena formosa',
    食草: 'クヌギ、カシワ、アベマキ、コナラ、アラカシ、シデコブシ、ナシ、サクラ、エンドウ、エニシダ、タケニグサ、イタドリ、ギシギシ、ゴボウ、キクイモ、タバコ、セッコク、エノキ、シデコブシなど',
    備考: '多食性。',
    発生時期: '11~4月'
  },
  {
    和名: 'シロスジキリガ',
    学名: 'Lithomosa solidaginus',
    食草: 'ホロムイイチゴ、キジムシロ',
    備考: 'ヨーロッパでは各種の樹種を食す。',
    発生時期: '8月下旬~9月'
  },
  {
    和名: 'ハンノキリガ',
    学名: 'Lithophane ustulata',
    食草: 'カシワ、コナラ、ミズナラ、フモトミズナラ、クリ（飼育）、シダレヤナギ（飼育）',
    備考: 'クリ、シダレヤナギは飼育下での記録。',
    発生時期: '10月頃羽化し、翌年4月まで'
  },
  {
    和名: 'クロモンキリガ',
    学名: 'Lithophane leautieri',
    食草: 'クルミ、オニグルミ',
    備考: '',
    発生時期: '10月頃羽化し、翌年4月まで'
  }
];

/**
 * 学名を正規化する（比較用）
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
 * CSVエスケープ処理
 */
function escapeCsv(str) {
  if (!str) return '';
  str = str.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('データ統合処理を開始します...');
    
    // 既存データを読み込み
    console.log('既存データを読み込み中...');
    const existingContent = fs.readFileSync(MAIN_DATA_FILE, 'utf-8');
    const existingLines = existingContent.replace(/^\uFEFF/, '').split('\n'); // Remove BOM if present
    const existingHeader = existingLines[0];
    const existingData = existingLines.slice(1).filter(line => line.trim() && !line.startsWith('﻿'));
    
    // 既存のヘッダーに備考カラムを追加（まだ存在しない場合）
    const newHeader = existingHeader.includes(',備考') ? existingHeader : existingHeader + ',備考';
    
    console.log(`既存データ: ${existingData.length}件`);
    
    // 既存データのインデックスを作成し、備考カラムを追加
    const existingIndex = {};
    const processedData = existingData.map((line, index) => {
      const fields = line.split(',');
      
      // 備考カラムが存在しない場合は空の値を追加
      if (fields.length < 27) {
        fields.push('');
      }
      
      if (fields.length >= 24) {
        const scientificName = fields[23]; // 学名の位置
        if (scientificName) {
          const normalizedName = normalizeScientificName(scientificName.replace(/"/g, ''));
          if (normalizedName) {
            existingIndex[normalizedName] = index;
          }
        }
      }
      
      return fields.join(',');
    });
    
    // 統合データを作成
    const integratedData = [...processedData];
    let updatedCount = 0;
    let addedCount = 0;
    
    // キリガデータを処理
    for (const kirigaEntry of kirigaData) {
      const normalizedName = normalizeScientificName(kirigaEntry.学名);
      
      console.log(`処理中: ${kirigaEntry.和名} (${kirigaEntry.学名}) -> 正規化: ${normalizedName}`);
      
      if (normalizedName && existingIndex.hasOwnProperty(normalizedName)) {
        // 既存データを更新
        const existingIndex_num = existingIndex[normalizedName];
        const existingFields = integratedData[existingIndex_num].split(',');
        
        // 食草を更新
        existingFields[24] = escapeCsv(kirigaEntry.食草);
        
        // 出典を更新
        existingFields[25] = escapeCsv('日本のキリガ');
        
        // 備考を統合
        const remarks = [];
        if (kirigaEntry.備考) {
          remarks.push(`食草: ${kirigaEntry.備考}`);
        }
        if (kirigaEntry.発生時期) {
          remarks.push(`発生時期: ${kirigaEntry.発生時期}`);
        }
        if (existingFields.length > 26 && existingFields[26] && existingFields[26] !== '""' && existingFields[26] !== '') {
          remarks.push(`旧備考: ${existingFields[26].replace(/"/g, '')}`);
        }
        
        // 備考カラムが存在しない場合は追加
        if (existingFields.length < 27) {
          existingFields[26] = escapeCsv(remarks.join(' | '));
        } else {
          existingFields[26] = escapeCsv(remarks.join(' | '));
        }
        
        integratedData[existingIndex_num] = existingFields.join(',');
        updatedCount++;
        console.log(`更新: ${kirigaEntry.和名} (${kirigaEntry.学名})`);
      } else if (normalizedName) {
        // 新しいエントリを追加
        const newEntry = [
          '', // 大図鑑カタログNo
          'Noctuidae', // 科名
          'ヤガ科', // 科和名
          '', // 亜科名
          '', // 亜科和名
          '', // 族名
          '', // 族和名
          '', // 亜族名
          '', // 亜族和名
          '', // 属名
          '', // 亜属名
          '', // 種小名
          '', // 亜種小名
          '', // 著者
          '', // 公表年
          '', // 類似種
          escapeCsv(kirigaEntry.和名), // 和名
          '', // 旧和名
          '', // 別名
          '', // その他の和名
          '', // 亜種範囲
          '', // 標準図鑑ステータス
          '日本のキリガ追加データ', // 標準図鑑以後の変更
          escapeCsv(kirigaEntry.学名), // 学名
          escapeCsv(kirigaEntry.食草), // 食草
          escapeCsv('日本のキリガ'), // 出典
          escapeCsv([
            kirigaEntry.備考 ? `食草: ${kirigaEntry.備考}` : '',
            kirigaEntry.発生時期 ? `発生時期: ${kirigaEntry.発生時期}` : ''
          ].filter(Boolean).join(' | ')) // 備考
        ];
        
        integratedData.push(newEntry.join(','));
        addedCount++;
        console.log(`追加: ${kirigaEntry.和名} (${kirigaEntry.学名})`);
      }
    }
    
    // 統合データを保存
    console.log('統合データを保存中...');
    const outputContent = [newHeader, ...integratedData].filter(line => line.trim()).join('\n');
    const outputFile = path.join(__dirname, '../public/ListMJ_hostplants_integrated_with_kiriga.csv');
    fs.writeFileSync(outputFile, outputContent, 'utf-8');
    
    console.log('\n=== 統合処理完了 ===');
    console.log(`元データ: ${existingData.length}件`);
    console.log(`キリガデータ: ${kirigaData.length}件`);
    console.log(`更新された種: ${updatedCount}件`);
    console.log(`新規追加された種: ${addedCount}件`);
    console.log(`最終データ: ${integratedData.length}件`);
    console.log(`出力ファイル: ${outputFile}`);
    
    // 統合後の元ファイルのバックアップを作成
    const backupFile = MAIN_DATA_FILE.replace('.csv', '_backup.csv');
    fs.copyFileSync(MAIN_DATA_FILE, backupFile);
    console.log(`バックアップ: ${backupFile}`);
    
    // 統合データを元のファイルに上書き
    fs.copyFileSync(outputFile, MAIN_DATA_FILE);
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