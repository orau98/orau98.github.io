#!/usr/bin/env python3
"""
日本のハマキガ1の誤データを削除し、正しいデータと置き換えるスクリプト
"""

import csv
import os
import sys

def read_csv_file(filepath):
    """CSVファイルを読み込む"""
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            return list(reader)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None

def read_hamakiga_csv(filepath):
    """ハマキガCSVファイルを読み込む（特殊形式対応）"""
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
        
        # 各行を手動でパース
        parsed_rows = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 行全体の引用符を削除
            if line.startswith('"') and line.endswith('"'):
                line = line[1:-1]
            
            # 行をCSVとしてパース
            import io
            csv_reader = csv.reader(io.StringIO(line))
            row = next(csv_reader)
            parsed_rows.append(row)
        
        return parsed_rows
    except Exception as e:
        print(f"Error reading hamakiga CSV {filepath}: {e}")
        return None

def write_csv_file(filepath, data):
    """CSVファイルに書き込む"""
    try:
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(data)
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return False

def remove_hamakiga_data(main_data):
    """メインデータから「日本のハマキガ1」を出典とする行を削除"""
    if not main_data:
        return main_data
    
    # ヘッダーの取得
    header = main_data[0]
    
    # 出典列のインデックスを探す
    source_col_index = None
    for i, col_name in enumerate(header):
        if '出典' in col_name:
            source_col_index = i
            break
    
    if source_col_index is None:
        print("出典列が見つかりません")
        return main_data
    
    # ヘッダー以外のデータから「日本のハマキガ1」を削除
    filtered_data = [header]  # ヘッダーを保持
    removed_count = 0
    
    for row in main_data[1:]:  # ヘッダー以外
        if len(row) > source_col_index and row[source_col_index] == '日本のハマキガ1':
            removed_count += 1
            continue  # この行をスキップ
        filtered_data.append(row)
    
    print(f"削除した「日本のハマキガ1」のレコード数: {removed_count}")
    return filtered_data

def convert_hamakiga_to_main_format(hamakiga_data):
    """ハマキガデータをメインCSVの形式に変換"""
    if not hamakiga_data or len(hamakiga_data) < 2:
        return []
    
    # ハマキガCSVのヘッダーを確認
    hamakiga_header = hamakiga_data[0]
    print(f"ハマキガCSVヘッダー: {hamakiga_header}")
    
    # メインCSVの形式に変換
    converted_rows = []
    
    for row in hamakiga_data[1:]:  # ヘッダー以外
        if len(row) < 7:  # 必要な列数をチェック
            print(f"Skipping row with insufficient columns: {row}")
            continue
            
        # ハマキガCSVの列: 科名,亜科名,和名,学名,食草,食草に関する備考,成虫の発生時期
        family_name = row[0].strip() if len(row) > 0 else ''
        subfamily_name = row[1].strip() if len(row) > 1 else ''
        japanese_name = row[2].strip() if len(row) > 2 else ''
        scientific_name = row[3].strip() if len(row) > 3 else ''
        host_plants = row[4].strip() if len(row) > 4 else ''
        remarks = row[5].strip() if len(row) > 5 else ''
        emergence_time = row[6].strip() if len(row) > 6 else ''
        
        # 余分な引用符を削除
        def clean_field(field):
            if field:
                # 最初と最後の引用符を削除
                field = field.strip()
                if field.startswith('"') and field.endswith('"'):
                    field = field[1:-1]
                # 内部の二重引用符を単一引用符に置換
                field = field.replace('""', '"')
            return field
        
        family_name = clean_field(family_name)
        subfamily_name = clean_field(subfamily_name)
        japanese_name = clean_field(japanese_name)
        scientific_name = clean_field(scientific_name)
        host_plants = clean_field(host_plants)
        remarks = clean_field(remarks)
        emergence_time = clean_field(emergence_time)
        
        # 備考を適切に作成
        combined_remarks = []
        if remarks:
            combined_remarks.append(remarks)
        if emergence_time:
            combined_remarks.append(f"成虫発生時期: {emergence_time}")
        final_remarks = '; '.join(combined_remarks)
        
        # メインCSVの形式で行を作成
        # メインCSVの列順: 大図鑑カタログNo,科名,科和名,亜科名,亜科和名,族名,族和名,亜族名,亜族和名,属名,亜属名,種小名,亜種小名,著者,公表年,類似種,和名,旧和名,別名,その他の和名,亜種範囲,標準図鑑ステータス,標準図鑑以後の変更,学名,食草,出典,備考
        
        new_row = [
            '',  # 大図鑑カタログNo (空)
            family_name,  # 科名
            family_name,  # 科和名 (日本語名なので同じ)
            subfamily_name,  # 亜科名
            subfamily_name,  # 亜科和名 (日本語名なので同じ)
            '',  # 族名 (空)
            '',  # 族和名 (空)
            '',  # 亜族名 (空)
            '',  # 亜族和名 (空)
            '',  # 属名 (学名から推定可能だが、今回は空)
            '',  # 亜属名 (空)
            '',  # 種小名 (学名から推定可能だが、今回は空)
            '',  # 亜種小名 (空)
            '',  # 著者 (学名に含まれているが、今回は空)
            '',  # 公表年 (学名に含まれているが、今回は空)
            '',  # 類似種 (空)
            japanese_name,  # 和名
            '',  # 旧和名 (空)
            '',  # 別名 (空)
            '',  # その他の和名 (空)
            '',  # 亜種範囲 (空)
            '',  # 標準図鑑ステータス (空)
            '',  # 標準図鑑以後の変更 (空)
            scientific_name,  # 学名
            host_plants,  # 食草
            '日本のハマキガ1',  # 出典
            final_remarks  # 備考
        ]
        
        converted_rows.append(new_row)
        
        # デバッグ用: 最初の数行を表示
        if len(converted_rows) <= 3:
            print(f"変換例 {len(converted_rows)}: {japanese_name} -> {new_row}")
    
    print(f"変換した新しいハマキガレコード数: {len(converted_rows)}")
    return converted_rows

def main():
    """メイン処理"""
    # ファイルパス
    main_csv_path = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_bokutou.csv'
    hamakiga_csv_path = '/Users/akimotohiroki/insects-host-plant-explorer/public/日本のハマキガ1.csv'
    
    print("=== 日本のハマキガ1データ置き換え処理開始 ===")
    
    # メインCSVファイルを読み込み
    print("1. メインCSVファイルを読み込み中...")
    main_data = read_csv_file(main_csv_path)
    if main_data is None:
        print("メインCSVファイルの読み込みに失敗しました")
        return False
    
    print(f"メインCSV総行数: {len(main_data)}")
    
    # ハマキガCSVファイルを読み込み（修正版を使用）
    print("2. ハマキガCSVファイルを読み込み中...")
    hamakiga_fixed_path = '/Users/akimotohiroki/insects-host-plant-explorer/public/日本のハマキガ1_fixed.csv'
    hamakiga_data = read_csv_file(hamakiga_fixed_path)
    if hamakiga_data is None:
        print("ハマキガCSVファイルの読み込みに失敗しました")
        return False
    
    print(f"ハマキガCSV総行数: {len(hamakiga_data)}")
    
    # 既存の「日本のハマキガ1」データを削除
    print("3. 既存の「日本のハマキガ1」データを削除中...")
    filtered_main_data = remove_hamakiga_data(main_data)
    print(f"削除後のメインCSV行数: {len(filtered_main_data)}")
    
    # ハマキガデータをメイン形式に変換
    print("4. ハマキガデータをメイン形式に変換中...")
    converted_hamakiga_data = convert_hamakiga_to_main_format(hamakiga_data)
    
    # 新しいデータを統合
    print("5. 新しいデータを統合中...")
    final_data = filtered_main_data + converted_hamakiga_data
    print(f"統合後の総行数: {len(final_data)}")
    
    # ファイルに書き込み
    print("6. 更新されたCSVファイルを保存中...")
    if write_csv_file(main_csv_path, final_data):
        print("=== 処理完了: データの置き換えが成功しました ===")
        print(f"最終的な総行数: {len(final_data)}")
        print(f"新たに追加されたハマキガレコード数: {len(converted_hamakiga_data)}")
        return True
    else:
        print("=== 処理失敗: ファイルの保存に失敗しました ===")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)