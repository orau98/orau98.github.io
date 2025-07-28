#!/usr/bin/env python3
"""
ハマキガCSVファイルをクリーンアップして正しい形式に変換
"""

import re

def fix_hamakiga_csv():
    input_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/日本のハマキガ1.csv'
    output_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/日本のハマキガ1_fixed.csv'
    
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    fixed_lines = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        # 行全体の引用符を削除
        if line.startswith('"') and line.endswith('"'):
            line = line[1:-1]
        
        # フィールドを手動で分離
        # パターン: 科名,亜科名,和名,学名,食草,食草に関する備考,成虫の発生時期
        
        if i == 0:  # ヘッダー行
            fixed_lines.append('科名,亜科名,和名,学名,食草,食草に関する備考,成虫の発生時期\n')
            continue
        
        # 正規表現を使用してフィールドを抽出
        # パターン: 科名,亜科名,和名,学名(括弧内に年が含まれる可能性),引用符で囲まれた食草,引用符で囲まれた備考,発生時期
        
        # より確実な方法: 既知のパターンに基づいて分析
        parts = []
        current_part = ''
        in_quotes = False
        quote_count = 0
        
        i_char = 0
        while i_char < len(line):
            char = line[i_char]
            
            if char == '"':
                quote_count += 1
                if quote_count % 2 == 1:
                    in_quotes = True
                else:
                    in_quotes = False
                current_part += char
            elif char == ',' and not in_quotes:
                parts.append(current_part.strip())
                current_part = ''
            else:
                current_part += char
            
            i_char += 1
        
        # 最後の部分を追加
        if current_part:
            parts.append(current_part.strip())
        
        # 想定される列数は7
        if len(parts) >= 7:
            # 7番目以降の部分は最後の列に結合
            if len(parts) > 7:
                parts[6] = ','.join(parts[6:])
                parts = parts[:7]
            
            # 各フィールドをクリーンアップ
            clean_parts = []
            for part in parts:
                # 先頭と末尾の引用符を削除
                part = part.strip()
                if part.startswith('"') and part.endswith('"'):
                    part = part[1:-1]
                # 内部の二重引用符を修正
                part = part.replace('""', '"')
                clean_parts.append(part)
            
            # CSVとして出力
            csv_line = ','.join([f'"{part}"' for part in clean_parts])
            fixed_lines.append(csv_line + '\n')
            
            # デバッグ用（最初の数行）
            if len(fixed_lines) <= 4:
                print(f"処理例 {len(fixed_lines)-1}: {clean_parts[2]} -> {clean_parts[3]}")
        else:
            print(f"Warning: 列数が不足しています: {len(parts)} 列, 行: {line}")
    
    # ファイルに書き込み
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        f.writelines(fixed_lines)
    
    print(f"修正されたCSVファイルを保存しました: {output_file}")
    print(f"処理した行数: {len(fixed_lines)}")

if __name__ == "__main__":
    fix_hamakiga_csv()