#!/usr/bin/env python3
import csv
import re

def clean_japanese_name(name):
    """
    和名フィールドから余計な文字や引用符を除去する
    """
    if not name:
        return name
    
    # 元の値をログ出力
    original = name
    
    # Step 1: 外側の余計な引用符を除去
    if name.startswith('"""') and name.endswith('"""'):
        name = name[3:-3]
    elif name.startswith('""') and name.endswith('""'):
        name = name[2:-2]
    elif name.startswith('"') and name.endswith('"'):
        name = name[1:-1]
    
    # Step 2: パターンマッチングで問題のある形式を修正
    
    # パターン1: """未知""実際の和名" -> 実際の和名
    pattern1 = r'^"*未知"*"*(.+?)"*$'
    match1 = re.match(pattern1, name)
    if match1:
        name = match1.group(1)
        print(f"Pattern 1 fixed: '{original}' -> '{name}'")
    
    # パターン2: """食草情報""和名" -> 和名
    pattern2 = r'^"*[^"]*(?:バラ科|ブナ科|カバノキ科|アオイ科|マメ科|ツツジ科|シソ科|ニレ科|レンプクソウ科|アサ科|シナノキ科|モクセイ科)[^"]*"*"*(.+?)"*$'
    match2 = re.match(pattern2, name)
    if match2:
        name = match2.group(1)
        print(f"Pattern 2 fixed: '{original}' -> '{name}'")
    
    # パターン3: """その他の説明文""和名" -> 和名
    pattern3 = r'^"*[^"]+で知られる[^"]*"*"*(.+?)"*$'
    match3 = re.match(pattern3, name)
    if match3:
        name = match3.group(1)
        print(f"Pattern 3 fixed: '{original}' -> '{name}'")
    
    # パターン4: """幼虫は〜という""和名" -> 和名
    pattern4 = r'^"*幼虫は[^"]+という"*"*(.+?)"*$'
    match4 = re.match(pattern4, name)
    if match4:
        name = match4.group(1)
        print(f"Pattern 4 fixed: '{original}' -> '{name}'")
    
    # パターン5: """説明文。説明文""和名" -> 和名
    pattern5 = r'^"*[^"]+。[^"]*"*"*(.+?)"*$'
    match5 = re.match(pattern5, name)
    if match5:
        name = match5.group(1)
        print(f"Pattern 5 fixed: '{original}' -> '{name}'")
    
    # Step 3: 残った余計な引用符を除去
    name = name.strip('"')
    
    # Step 4: 空白文字の正規化
    name = name.strip()
    
    # 変更があった場合はログ出力
    if name != original and original not in ['', name]:
        print(f"Japanese name cleaned: '{original}' -> '{name}'")
    
    return name

def fix_csv_japanese_names(input_file, output_file):
    """
    CSVファイルの和名フィールドを修正する
    """
    print("Starting CSV Japanese name cleanup...")
    
    # CSVファイルを読み込み
    with open(input_file, 'r', encoding='utf-8-sig') as infile:
        reader = csv.reader(infile)
        rows = list(reader)
    
    if not rows:
        print("No data found in CSV file")
        return
    
    # ヘッダー行を取得
    header = rows[0]
    
    # 和名フィールドのインデックスを見つける
    japanese_name_index = None
    for i, col in enumerate(header):
        if col.strip() == '和名':
            japanese_name_index = i
            break
    
    if japanese_name_index is None:
        print("Japanese name column '和名' not found in CSV")
        return
    
    print(f"Found Japanese name column at index {japanese_name_index}")
    
    # データ行を処理
    fixed_count = 0
    for i in range(1, len(rows)):
        if len(rows[i]) > japanese_name_index:
            original_name = rows[i][japanese_name_index]
            cleaned_name = clean_japanese_name(original_name)
            
            if original_name != cleaned_name:
                rows[i][japanese_name_index] = cleaned_name
                fixed_count += 1
    
    print(f"Fixed {fixed_count} Japanese names")
    
    # 修正されたCSVファイルを書き出し
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(rows)
    
    print(f"Fixed CSV saved to: {output_file}")

if __name__ == "__main__":
    input_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_bokutou.csv"
    output_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_bokutou_fixed.csv"
    
    fix_csv_japanese_names(input_file, output_file)
    print("Japanese name cleanup completed!")