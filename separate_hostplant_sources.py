#!/usr/bin/env python3
import csv
import os
from collections import defaultdict

def separate_hostplant_sources():
    """同じ食草記録でも出典が異なる場合は別レコードとして分離"""
    base_dir = '/Users/akimotohiroki/insects-host-plant-explorer'
    
    print("=== 食草記録の出典別分離処理 ===")
    
    # 両方のファイルを処理
    files_to_process = [
        os.path.join(base_dir, 'public', 'hostplants.csv'),
        os.path.join(base_dir, 'normalized_data', 'hostplants.csv')
    ]
    
    for hostplants_file in files_to_process:
        if not os.path.exists(hostplants_file):
            print(f"ファイルが見つかりません: {hostplants_file}")
            continue
            
        print(f"\n=== {hostplants_file} の処理 ===")
        
        # データを読み込み、重複チェック
        records_by_key = defaultdict(list)
        all_records = []
        
        with open(hostplants_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            fieldnames = reader.fieldnames
            
            for row in reader:
                # キー: 昆虫ID + 植物名 + 観察タイプ
                key = f"{row['insect_id']}|{row['plant_name']}|{row['observation_type']}"
                records_by_key[key].append(row)
                all_records.append(row)
        
        # 重複を分析
        duplicates_found = 0
        separated_records = []
        
        for key, records in records_by_key.items():
            if len(records) > 1:
                # 同じキーで複数レコードがある場合
                insect_id, plant_name, obs_type = key.split('|')
                print(f"\n重複発見: {insect_id} - {plant_name} ({obs_type}): {len(records)}件")
                
                # 出典別にグループ化
                by_reference = defaultdict(list)
                for record in records:
                    ref_key = f"{record['reference']}|{record['notes']}"
                    by_reference[ref_key].append(record)
                
                # 出典別に分離
                for ref_key, ref_records in by_reference.items():
                    reference, notes = ref_key.split('|', 1)
                    
                    if len(ref_records) > 1:
                        print(f"  出典 '{reference}' で {len(ref_records)}件の重複")
                        # 最初のレコードのみ保持、他は統合
                        base_record = ref_records[0]
                        
                        # 植物部位や備考を統合
                        plant_parts = set()
                        life_stages = set()
                        all_notes = set()
                        
                        for rec in ref_records:
                            if rec['plant_part']:
                                plant_parts.add(rec['plant_part'])
                            if rec['life_stage']:
                                life_stages.add(rec['life_stage'])
                            if rec['notes']:
                                all_notes.add(rec['notes'])
                        
                        # 統合情報を設定
                        if len(plant_parts) > 1:
                            base_record['plant_part'] = '; '.join(sorted(plant_parts))
                        if len(life_stages) > 1:
                            base_record['life_stage'] = '; '.join(sorted(life_stages))
                        if len(all_notes) > 1:
                            base_record['notes'] = '; '.join(sorted(all_notes))
                        
                        separated_records.append(base_record)
                        duplicates_found += len(ref_records) - 1
                        print(f"    → 1件に統合: {base_record['record_id']}")
                    else:
                        # 重複なし、そのまま追加
                        separated_records.append(ref_records[0])
            else:
                # 重複なし
                separated_records.append(records[0])
        
        print(f"\n処理結果:")
        print(f"  元レコード数: {len(all_records)}")
        print(f"  統合後レコード数: {len(separated_records)}")
        print(f"  統合削除数: {duplicates_found}")
        
        # 出典別の統計
        reference_stats = defaultdict(int)
        for record in separated_records:
            reference_stats[record['reference']] += 1
        
        print(f"\n出典別統計:")
        for ref, count in sorted(reference_stats.items(), key=lambda x: x[1], reverse=True):
            print(f"  {ref}: {count}件")
        
        # ファイルを更新
        if duplicates_found > 0:
            print(f"\n=== ファイル更新 ===")
            
            with open(hostplants_file, 'w', encoding='utf-8', newline='') as file:
                writer = csv.DictWriter(file, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(separated_records)
            
            print(f"{hostplants_file} を更新しました")
        else:
            print("重複がないため、ファイル更新は不要です")
    
    print(f"\n✅ 食草記録の出典別分離処理が完了しました！")

if __name__ == "__main__":
    separate_hostplant_sources()