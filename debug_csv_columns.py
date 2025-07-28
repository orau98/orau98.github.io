#!/usr/bin/env python3
"""
CSVファイルの列構造を分析し、ウスキヒメシャクとキヒメナミシャクのデータを詳細に確認する
"""

import csv
import sys

def analyze_csv_columns():
    csv_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_integrated_with_bokutou.csv'
    
    print("=== CSV列構造分析 ===")
    
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        
        print("ヘッダー一覧:")
        for i, header in enumerate(headers):
            print(f"  {i:2d}: {header}")
        
        print(f"\n総列数: {len(headers)}")
        
        # Find target species
        target_species = ['ウスキヒメシャク', 'キヒメナミシャク']
        
        for row_num, row in enumerate(reader, start=2):  # start=2 because header is row 1
            moth_name = row.get('和名', '').strip()
            
            if any(target in moth_name for target in target_species):
                print(f"\n=== {moth_name} (行 {row_num}) ===")
                print(f"カタログNo: {row.get('大図鑑カタログNo', '')}")
                print(f"学名: {row.get('学名', '')}")
                print(f"食草: '{row.get('食草', '')}'")
                print(f"出典: '{row.get('出典', '')}'")
                print(f"備考: '{row.get('備考', '')}'")
                
                # Check if any columns are misaligned
                print("\n主要列の値:")
                key_columns = ['大図鑑カタログNo', '和名', '学名', '食草', '出典', '備考']
                for col in key_columns:
                    value = row.get(col, '')
                    print(f"  {col}: '{value}'")
                
                # Check for unexpected patterns
                food_plant = row.get('食草', '').strip()
                source = row.get('出典', '').strip()
                
                if source in food_plant or '図鑑' in food_plant:
                    print("❌ 問題発見: 食草欄に出典データが混入している可能性")
                
                if food_plant == source:
                    print("❌ 問題発見: 食草と出典が完全に同じ")
                
                if not food_plant and source:
                    print("⚠️  注意: 食草欄が空で出典のみ存在")

if __name__ == '__main__':
    analyze_csv_columns()