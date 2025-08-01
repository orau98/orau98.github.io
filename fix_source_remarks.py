#!/usr/bin/env python3
import csv
import re

def fix_source_remarks():
    input_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_master.csv'
    output_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_master_fixed_source.csv'
    
    # 日本産蛾類標準図鑑のパターン
    source_pattern = re.compile(r'^日本産蛾類標準図鑑[0-9１２３４]*$')
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        rows = list(reader)
    
    # ヘッダー
    header = rows[0]
    print(f"Header columns: {len(header)}")
    
    fixed_rows = [header]
    fixed_count = 0
    
    for i, row in enumerate(rows[1:], start=2):
        if len(row) == 28:
            # 28列の行は、学名が分割されている可能性がある
            # 列24と25を結合して学名を修正
            if row[24] and row[25] and '(' in row[24] and ')' in row[25]:
                # 学名を結合
                scientific_name = f"{row[24]}, {row[25]}"
                # 新しい行を作成
                new_row = row[:24] + [scientific_name] + row[26:]
                
                # 出典と備考の位置を確認して修正
                if len(new_row) >= 27:
                    if source_pattern.match(new_row[26]):
                        # 備考列に出典がある場合、入れ替える
                        new_row[25], new_row[26] = new_row[26], new_row[25]
                        fixed_count += 1
                        print(f"Fixed row {i}: {row[16]} - Source: {new_row[25]}, Remarks: {new_row[26]}")
                
                fixed_rows.append(new_row)
            else:
                # その他の28列の行もチェック
                if len(row) >= 28 and source_pattern.match(row[27]):
                    # 最後の列に出典がある場合
                    # 26列目を出典、27列目を備考にする
                    new_row = row[:26] + [row[27], row[26]]
                    fixed_count += 1
                    print(f"Fixed row {i}: {row[16]} - Source: {new_row[25]}, Remarks: {new_row[26]}")
                    fixed_rows.append(new_row)
                else:
                    fixed_rows.append(row)
        elif len(row) == 27:
            # 27列の行で出典と備考が逆の場合を修正
            if source_pattern.match(row[26]):
                # 備考列に出典がある場合、入れ替える
                row[25], row[26] = row[26], row[25]
                fixed_count += 1
                print(f"Fixed row {i}: {row[16]} - Source: {row[25]}, Remarks: {row[26]}")
            fixed_rows.append(row)
        else:
            fixed_rows.append(row)
    
    # 修正したデータを保存
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(fixed_rows)
    
    print(f"\nTotal rows fixed: {fixed_count}")
    print(f"Output saved to: {output_file}")

if __name__ == "__main__":
    fix_source_remarks()