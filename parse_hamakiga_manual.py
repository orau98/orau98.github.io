#!/usr/bin/env python3
"""
ハマキガCSVファイルを手動解析して正しい形式に変換
"""

import re

def parse_hamakiga_line(line):
    """手動でハマキガデータ行を解析"""
    # 行全体の引用符を削除
    if line.startswith('"') and line.endswith('"'):
        line = line[1:-1]
    
    # パターンに基づいて分析
    # 最初の3つのフィールド（科名、亜科名、和名）はシンプル
    parts = []
    remaining = line
    
    # 科名
    match = re.match(r'^([^,]+),(.*)$', remaining)
    if match:
        parts.append(match.group(1).strip())
        remaining = match.group(2)
    else:
        return None
    
    # 亜科名
    match = re.match(r'^([^,]+),(.*)$', remaining)
    if match:
        parts.append(match.group(1).strip())
        remaining = match.group(2)
    else:
        return None
    
    # 和名
    match = re.match(r'^([^,]+),(.*)$', remaining)
    if match:
        parts.append(match.group(1).strip())
        remaining = match.group(2)
    else:
        return None
    
    # 学名 - 括弧内に年を含む可能性があるため特別な処理
    # パターン: "属名 種名 (著者, 年)"
    match = re.match(r'^([^,]+\([^)]+\)),(.*)$', remaining)
    if match:
        parts.append(match.group(1).strip())
        remaining = match.group(2)
    else:
        # 括弧がない場合の fallback
        match = re.match(r'^([^,]+),(.*)$', remaining)
        if match:
            parts.append(match.group(1).strip())
            remaining = match.group(2)
        else:
            return None
    
    # 食草 - 二重引用符で囲まれている
    match = re.match(r'^""([^"]*)"",(.*)$', remaining)
    if match:
        parts.append(match.group(1).strip())
        remaining = match.group(2)
    else:
        # 引用符がない場合の fallback
        match = re.match(r'^([^,]+),(.*)$', remaining)
        if match:
            parts.append(match.group(1).strip())
            remaining = match.group(2)
        else:
            return None
    
    # 備考 - 二重引用符で囲まれている
    match = re.match(r'^""([^"]*)"",(.*)$', remaining)
    if match:
        parts.append(match.group(1).strip())
        remaining = match.group(2)
    else:
        # 引用符がない場合の fallback
        match = re.match(r'^([^,]+),(.*)$', remaining)
        if match:
            parts.append(match.group(1).strip())
            remaining = match.group(2)
        else:
            return None
    
    # 発生時期 - 残りの部分
    parts.append(remaining.strip())
    
    return parts

def create_fixed_hamakiga_csv():
    """修正されたハマキガCSVファイルを作成"""
    input_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/日本のハマキガ1.csv'
    output_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/日本のハマキガ1_fixed.csv'
    
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    # ヘッダーを作成
    header = 'Family,Subfamily,JapaneseName,ScientificName,HostPlants,Remarks,EmergenceTime\n'
    
    fixed_lines = [header]
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        if i == 0:  # ヘッダー行をスキップ
            continue
        
        parts = parse_hamakiga_line(line)
        if parts and len(parts) == 7:
            # CSVとして出力（引用符で囲む）
            csv_line = ','.join([f'"{part}"' for part in parts])
            fixed_lines.append(csv_line + '\n')
            
            # デバッグ用（最初の数行）
            if len(fixed_lines) <= 5:
                print(f"解析例 {len(fixed_lines)-1}: {parts[2]} -> {parts[3]}")
        else:
            print(f"Warning: 解析失敗: {line}")
    
    # ファイルに書き込み
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        f.writelines(fixed_lines)
    
    print(f"修正されたCSVファイルを保存しました: {output_file}")
    print(f"処理した行数: {len(fixed_lines)}")

if __name__ == "__main__":
    create_fixed_hamakiga_csv()