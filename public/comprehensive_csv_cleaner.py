#!/usr/bin/env python3
"""
包括的なCSVクリーナー - 不適切な植物名を除去し、正しい植物名のみを抽出
"""

import csv
import re
import sys

def is_valid_plant_name(plant_name):
    """植物名として有効かどうかを検証"""
    if not plant_name or not isinstance(plant_name, str):
        return False
    
    trimmed = plant_name.strip()
    
    # 基本的な長さチェック
    if len(trimmed) < 2 or len(trimmed) > 50:
        return False
    
    # 年号パターンを除外
    if re.match(r'^\d{4}\)?$', trimmed):
        return False
    
    # 括弧付き年号を除外
    if re.match(r'^[（(]\d{4}[）)]?$', trimmed):
        return False
    
    # 学名記号を除外
    taxonomic_patterns = [
        r'^comb\.\s*nov\.?$',
        r'^sp\.?$',
        r'^spp\.?$',
        r'^var\.?$',
        r'^subsp\.?$',
        r'^f\.?$',
        r'^emend\.?$',
        r'^nom\.\s*nud\.?$',
        r'^auct\.?$',
        r'^non$',
        r'^sensu$',
        r'^cf\.?$',
        r'^aff\.?$'
    ]
    
    for pattern in taxonomic_patterns:
        if re.match(pattern, trimmed, re.IGNORECASE):
            return False
    
    # 時期情報を含む場合は除外
    if re.search(r'[0-9０-９]月[上中下]旬|[0-9０-９]月頃', trimmed):
        return False
    
    # 説明文のパターンを除外
    descriptive_patterns = [
        r'野外で',
        r'飼育下で',
        r'から記録',
        r'による飼育',
        r'幼虫[がはを]',
        r'成虫[がはを]',
        r'海外では',
        r'ヨーロッパでは',
        r'日本では',
        r'を食[すし]',
        r'を好む',
        r'から[得発]られ',
        r'ことが[判知]明',
        r'推[測定]される',
        r'と[思考]われる',
        r'に固有',
        r'に寄生',
        r'害虫',
        r'栽培',
        r'発生する',
        r'生息',
        r'分布'
    ]
    
    for pattern in descriptive_patterns:
        if re.search(pattern, trimmed):
            return False
    
    # 数字だけ、英字だけは除外
    if re.match(r'^[0-9０-９]+$', trimmed) or re.match(r'^[A-Za-z]+$', trimmed):
        return False
    
    # 最低限日本語文字を含むこと
    if not re.search(r'[ぁ-んァ-ヶー一-龠]', trimmed):
        return False
    
    # 著者名パターンを除外
    if re.match(r'^[A-Z][a-z]+[,\s]+\d{4}', trimmed):
        return False
    
    return True

def extract_plant_names(text):
    """テキストから植物名を抽出"""
    if not text:
        return []
    
    # 植物名（科名）のパターンを抽出
    plant_pattern = r'([ア-ン一-龯ァ-ヶー]{2,20})\s*[（(]\s*([^）)]+科)\s*[）)]'
    plants_with_family = []
    
    for match in re.finditer(plant_pattern, text):
        plant_name = match.group(1).strip()
        family_name = match.group(2).strip()
        
        # 前置詞を除去
        prefixes = ['採卵では', '野外では', '飼育下では', 'では', 'での', 'から', 'による']
        for prefix in prefixes:
            if plant_name.endswith(prefix):
                plant_name = plant_name[:-len(prefix)].strip()
        
        if plant_name and len(plant_name) > 1:
            plants_with_family.append(f"{plant_name} ({family_name})")
    
    # セミコロンやカンマで区切られた植物名も処理
    remaining_text = re.sub(plant_pattern, '', text)
    simple_plants = []
    
    for delimiter in [';', '；', ',', '，', '、']:
        parts = remaining_text.split(delimiter)
        for part in parts:
            part = part.strip()
            # 説明文を除去
            part = re.sub(r'以上[^科]*科', '', part)
            part = re.sub(r'など.*$', '', part)
            part = re.sub(r'[。．].*$', '', part)
            
            if is_valid_plant_name(part):
                simple_plants.append(part)
    
    return plants_with_family + simple_plants

def clean_csv_file(input_file, output_file, plant_column_index):
    """CSVファイルをクリーニング"""
    cleaned_count = 0
    problematic_entries = []
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        rows = list(reader)
    
    # ヘッダーを保持
    header = rows[0] if rows else []
    
    # 各行を処理
    for i in range(1, len(rows)):
        if len(rows[i]) > plant_column_index:
            original = rows[i][plant_column_index]
            
            # 植物名を抽出
            valid_plants = extract_plant_names(original)
            
            if valid_plants:
                # 有効な植物名をセミコロンで結合
                cleaned = '; '.join(valid_plants)
            else:
                # 有効な植物名がない場合は「不明」
                if original and original.strip() and original.strip() != '不明':
                    problematic_entries.append({
                        'row': i + 1,
                        'moth': rows[i][16] if len(rows[i]) > 16 else 'Unknown',
                        'original': original
                    })
                cleaned = '不明'
            
            if original != cleaned:
                cleaned_count += 1
                print(f"Row {i+1}: Cleaned")
            
            rows[i][plant_column_index] = cleaned
    
    # クリーニング済みデータを書き込み
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(rows)
    
    print(f"\n✅ クリーニング完了:")
    print(f"   - 修正行数: {cleaned_count}")
    print(f"   - 問題のあるエントリ: {len(problematic_entries)}")
    
    # 問題のあるエントリをレポート
    if problematic_entries:
        print("\n⚠️ 完全に除去されたエントリ（「不明」に変換）:")
        for entry in problematic_entries[:10]:  # 最初の10件のみ表示
            print(f"   Row {entry['row']} ({entry['moth']}): {entry['original'][:60]}...")
    
    return cleaned_count, problematic_entries

if __name__ == "__main__":
    # メインのCSVファイルをクリーニング
    input_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_kiriga.csv'
    output_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_cleaned_comprehensive.csv'
    
    print("🧹 包括的なCSVクリーニングを開始します...\n")
    
    cleaned, problematic = clean_csv_file(input_file, output_file, 24)  # 24列目が食草
    
    print(f"\n✅ 完了: {output_file} に保存しました")