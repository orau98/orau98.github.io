#!/usr/bin/env python3
"""
CSV内の備考欄から成虫発生時期を除去するスクリプト
"""

import csv
import re
from pathlib import Path

def clean_emergence_time_from_notes(notes):
    """備考欄から成虫発生時期を除去"""
    if not notes:
        return notes
    
    # 成虫発生時期のパターンを定義
    patterns = [
        r'成虫発生時期:\s*[^;。\n]+[;。]?\s*',
        r'成虫出現時期:\s*[^;。\n]+[;。]?\s*',
        r'出現時期:\s*[^;。\n]+[;。]?\s*',
        r'発生時期:\s*[^;。\n]+[;。]?\s*',
    ]
    
    cleaned_notes = notes
    for pattern in patterns:
        cleaned_notes = re.sub(pattern, '', cleaned_notes)
    
    # 余分な区切り文字を整理
    cleaned_notes = re.sub(r';\s*;', ';', cleaned_notes)  # 連続するセミコロンを一つに
    cleaned_notes = re.sub(r'^;\s*', '', cleaned_notes)   # 先頭のセミコロンを除去
    cleaned_notes = re.sub(r'\s*;$', '', cleaned_notes)   # 末尾のセミコロンを除去
    cleaned_notes = cleaned_notes.strip()
    
    return cleaned_notes

def main():
    csv_path = Path('public/ListMJ_hostplants_integrated_with_bokutou.csv')
    backup_path = Path('public/ListMJ_hostplants_integrated_with_bokutou.csv.backup_before_emergence_cleanup')
    
    # バックアップ作成
    if not backup_path.exists():
        import shutil
        shutil.copy(csv_path, backup_path)
        print(f"バックアップ作成: {backup_path}")
    
    # CSVを読み込み、処理、書き込み
    rows = []
    changed_count = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            if len(row) > 26:  # 備考欄がある行のみ処理
                original_notes = row[26]
                cleaned_notes = clean_emergence_time_from_notes(original_notes)
                
                if original_notes != cleaned_notes:
                    row[26] = cleaned_notes
                    changed_count += 1
                    print(f"変更: {row[16]} - '{original_notes}' → '{cleaned_notes}'")
            
            rows.append(row)
    
    # 変更されたCSVを書き込み
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"\n処理完了: {changed_count}件の備考欄から成虫発生時期を除去しました。")

if __name__ == '__main__':
    main()