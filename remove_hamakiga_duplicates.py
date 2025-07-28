#!/usr/bin/env python3
"""
重複したハマキガデータを削除するスクリプト
空の出典フィールドを持つ重複エントリを削除し、日本のハマキガ1版のみを保持
"""

import csv
import os
from collections import defaultdict

def remove_hamakiga_duplicates():
    """重複したハマキガエントリを削除"""
    csv_path = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_bokutou.csv'
    backup_path = csv_path + '.backup_before_duplicate_removal'
    
    # バックアップを作成
    if not os.path.exists(backup_path):
        import shutil
        shutil.copy2(csv_path, backup_path)
        print(f"バックアップ作成: {backup_path}")
    
    # まず重複を特定
    name_data = defaultdict(list)
    all_rows = []
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)
        all_rows.append(header)
        
        # 和名と出典の列インデックスを取得
        name_col_index = None
        source_col_index = None
        for i, col_name in enumerate(header):
            if col_name == '和名':
                name_col_index = i
            if col_name == '出典':
                source_col_index = i
        
        if name_col_index is None or source_col_index is None:
            print("ERROR: 和名または出典列が見つかりません")
            return False
        
        print(f"和名列: {name_col_index}, 出典列: {source_col_index}")
        
        # 全ての行を読み込み、重複を特定
        for line_num, row in enumerate(reader, start=2):
            # 行の長さを調整
            while len(row) <= max(name_col_index, source_col_index):
                row.append('')
            
            all_rows.append(row)
            
            japanese_name = row[name_col_index].strip()
            source = row[source_col_index].strip()
            
            if japanese_name:
                name_data[japanese_name].append({
                    'line': line_num,
                    'source': source,
                    'array_index': len(all_rows) - 1  # all_rows内でのインデックス
                })
    
    print(f"読み込んだ総行数: {len(all_rows)}")
    
    # 削除対象の行を特定
    rows_to_remove = set()
    hamakiga_duplicates = 0
    
    for name, entries in name_data.items():
        if len(entries) > 1:
            # ハマキガ関連の重複をチェック
            has_hamakiga = any('日本のハマキガ1' in entry['source'] for entry in entries)
            if has_hamakiga:
                hamakiga_duplicates += 1
                print(f"重複発見: {name}")
                
                # 日本のハマキガ1以外のエントリを削除対象とする
                for entry in entries:
                    if entry['source'] != '日本のハマキガ1':
                        rows_to_remove.add(entry['array_index'])
                        print(f"  削除対象: 行{entry['line']} (出典='{entry['source']}')")
    
    print(f"\nハマキガ関連重複: {hamakiga_duplicates}件")
    print(f"削除対象行数: {len(rows_to_remove)}")
    
    # 削除対象行を除いた新しいデータを作成
    filtered_rows = []
    removed_count = 0
    
    for i, row in enumerate(all_rows):
        if i not in rows_to_remove:
            filtered_rows.append(row)
        else:
            removed_count += 1
    
    print(f"削除した行数: {removed_count}")
    print(f"残った行数: {len(filtered_rows)}")
    
    # 新しいCSVファイルを書き込み
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(filtered_rows)
    
    print(f"更新されたCSVファイルを保存: {csv_path}")
    return True

if __name__ == "__main__":
    success = remove_hamakiga_duplicates()
    if success:
        print("\n重複削除が完了しました")
    else:
        print("\nエラーが発生しました")