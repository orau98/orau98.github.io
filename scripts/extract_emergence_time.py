#!/usr/bin/env python3

import csv
import sys

def extract_emergence_time_data():
    # Read existing integrated data
    existing_records = {}
    try:
        with open('emergence_time_integrated.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (row['和名'], row['学名'])
                existing_records[key] = row
        print(f"Loaded {len(existing_records)} existing records from integrated CSV")
    except:
        # If file doesn't exist or is empty, start fresh
        print("Starting with empty integrated CSV")
    
    all_records = list(existing_records.values())
    
    # Extract from 日本のキリガ.csv
    print("\nExtracting from 日本のキリガ.csv...")
    kiriga_count = 0
    with open('日本のキリガ.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            japanese_name = row.get('和名', '').strip()
            scientific_name = row.get('学名', '').strip()
            emergence_time = row.get('成虫の発生時期', '').strip()
            
            if japanese_name and scientific_name and emergence_time and emergence_time != '不明':
                key = (japanese_name, scientific_name)
                if key not in existing_records:
                    all_records.append({
                        '和名': japanese_name,
                        '学名': scientific_name,
                        '成虫出現時期': emergence_time,
                        '出典': '日本のキリガ',
                        '備考': ''
                    })
                    existing_records[key] = all_records[-1]
                    kiriga_count += 1
    
    print(f"Found {kiriga_count} new records from 日本のキリガ")
    
    # Extract from hamushi data (if available)
    print("\nExtracting from hamushi data...")
    hamushi_count = 0
    
    # Try different hamushi file names
    hamushi_files = ['hamushi_species_integrated.csv', 'ハムシ.csv', 'hamushi.csv']
    
    for hamushi_file in hamushi_files:
        try:
            with open(hamushi_file, 'r', encoding='utf-8') as f:
                print(f"Found hamushi file: {hamushi_file}")
                reader = csv.DictReader(f)
                for row in reader:
                    japanese_name = row.get('和名', '').strip()
                    scientific_name = row.get('学名', '').strip()
                    emergence_time = row.get('成虫出現時期', '').strip()
                    
                    if japanese_name and scientific_name and emergence_time and emergence_time != '不明':
                        key = (japanese_name, scientific_name)
                        if key not in existing_records:
                            all_records.append({
                                '和名': japanese_name,
                                '学名': scientific_name,
                                '成虫出現時期': emergence_time,
                                '出典': 'ハムシハンドブック',
                                '備考': ''
                            })
                            existing_records[key] = all_records[-1]
                            hamushi_count += 1
                break  # If we found one file, don't try others
        except FileNotFoundError:
            continue
    
    if hamushi_count == 0:
        print("No hamushi files found or no emergence time data in hamushi files")
    else:
        print(f"Found {hamushi_count} new records from ハムシハンドブック")
    
    # Sort by Japanese name
    all_records.sort(key=lambda x: x['和名'])
    
    # Save to CSV
    with open('emergence_time_integrated.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['和名', '学名', '成虫出現時期', '出典', '備考'])
        writer.writeheader()
        writer.writerows(all_records)
    
    print(f"\nSaved {len(all_records)} total records to emergence_time_integrated.csv")
    
    # Show sample
    print("\nSample of integrated data:")
    for i, record in enumerate(all_records[:10]):
        print(f"{record['和名']} ({record['学名']}) - {record['成虫出現時期']} [{record['出典']}]")

if __name__ == "__main__":
    extract_emergence_time_data()