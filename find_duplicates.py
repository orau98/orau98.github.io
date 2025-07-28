#!/usr/bin/env python3
"""
重複したハマキガデータを特定するスクリプト
"""

import csv
from collections import defaultdict

def find_duplicate_moths():
    """重複した蛾のデータを特定"""
    csv_path = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_bokutou.csv'
    
    # 和名をキーにしてデータを収集
    name_data = defaultdict(list)
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        # ヘッダー情報をデバッグ
        print(f"ヘッダー列数: {len(header)}")
        for i, col_name in enumerate(header):
            if '和名' in col_name or '出典' in col_name:
                print(f"列{i}: {col_name}")
        
        # 和名の列インデックスを探す
        name_col_index = None
        source_col_index = None
        for i, col_name in enumerate(header):
            if col_name == '和名':
                name_col_index = i
            if col_name == '出典':
                source_col_index = i
        
        print(f"和名列: {name_col_index}, 出典列: {source_col_index}")
        
        if name_col_index is None or source_col_index is None:
            print("和名または出典列が見つかりません")
            return
        
        # データを読み込み
        processed_count = 0
        for line_num, row in enumerate(reader, start=2):
            # 行の長さを調整（必要に応じてパディング）
            while len(row) <= max(name_col_index, source_col_index):
                row.append('')
            
            japanese_name = row[name_col_index].strip()
            source = row[source_col_index].strip()
            
            if japanese_name:  # 和名がある場合のみ
                name_data[japanese_name].append({
                    'line': line_num,
                    'source': source,
                    'row': row
                })
                processed_count += 1
                
                # マゲバヒメハマキの特別なデバッグ
                if japanese_name == 'マゲバヒメハマキ':
                    print(f"マゲバヒメハマキ発見: 行{line_num}, 出典={source}")
        
        print(f"処理した行数: {processed_count}")
    
    # 重複を特定
    duplicates = {}
    for name, entries in name_data.items():
        if len(entries) > 1:
            duplicates[name] = entries
    
    print(f"重複している種数: {len(duplicates)}")
    
    # ハマキガ関連の重複を詳細に表示
    hamakiga_duplicates = {}
    for name, entries in duplicates.items():
        # ハマキガ関連かチェック
        has_hamakiga = any('日本のハマキガ1' in entry['source'] for entry in entries)
        if has_hamakiga:
            hamakiga_duplicates[name] = entries
            print(f"\n=== {name} ===")
            for entry in entries:
                print(f"  行{entry['line']}: 出典='{entry['source']}'")
    
    print(f"\nハマキガ関連の重複: {len(hamakiga_duplicates)}件")
    
    # 削除すべき行を特定
    lines_to_remove = []
    for name, entries in hamakiga_duplicates.items():
        # 日本のハマキガ1以外のエントリを削除対象とする
        for entry in entries:
            if entry['source'] != '日本のハマキガ1':
                lines_to_remove.append(entry['line'])
    
    print(f"削除対象の行数: {len(lines_to_remove)}")
    print("削除対象の行:", sorted(lines_to_remove)[:10], "..." if len(lines_to_remove) > 10 else "")
    
    return lines_to_remove

if __name__ == "__main__":
    find_duplicate_moths()