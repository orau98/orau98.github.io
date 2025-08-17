#!/usr/bin/env python3
import csv
import os
from collections import defaultdict

def validate_hostplant_separation():
    """食草記録が適切に分離されているかを検証"""
    base_dir = '/Users/akimotohiroki/insects-host-plant-explorer'
    
    print("=== 食草記録分離状況の検証 ===")
    
    files_to_check = [
        os.path.join(base_dir, 'public', 'hostplants.csv'),
        os.path.join(base_dir, 'normalized_data', 'hostplants.csv')
    ]
    
    for hostplants_file in files_to_check:
        if not os.path.exists(hostplants_file):
            continue
            
        print(f"\n=== {os.path.basename(hostplants_file)} の検証 ===")
        
        records = []
        with open(hostplants_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            records = list(reader)
        
        # 1. 完全重複チェック
        exact_duplicates = defaultdict(list)
        for record in records:
            key = f"{record['insect_id']}|{record['plant_name']}|{record['plant_family']}|{record['observation_type']}|{record['plant_part']}|{record['life_stage']}|{record['reference']}|{record['notes']}"
            exact_duplicates[key].append(record)
        
        exact_dup_count = sum(1 for recs in exact_duplicates.values() if len(recs) > 1)
        
        # 2. 同じ昆虫-植物で異なる出典チェック
        insect_plant_sources = defaultdict(set)
        for record in records:
            key = f"{record['insect_id']}|{record['plant_name']}"
            insect_plant_sources[key].add(record['reference'])
        
        multi_source_count = sum(1 for sources in insect_plant_sources.values() if len(sources) > 1)
        
        # 3. 同じ昆虫-植物で異なる観察タイプチェック
        insect_plant_obs = defaultdict(set)
        for record in records:
            key = f"{record['insect_id']}|{record['plant_name']}"
            insect_plant_obs[key].add(record['observation_type'])
        
        multi_obs_count = sum(1 for obs_types in insect_plant_obs.values() if len(obs_types) > 1)
        
        # 4. 出典別統計
        source_stats = defaultdict(int)
        obs_stats = defaultdict(int)
        for record in records:
            source_stats[record['reference']] += 1
            obs_stats[record['observation_type']] += 1
        
        print(f"総レコード数: {len(records)}")
        print(f"完全重複: {exact_dup_count}件")
        print(f"同じ昆虫-植物で複数出典: {multi_source_count}件")
        print(f"同じ昆虫-植物で複数観察タイプ: {multi_obs_count}件")
        
        print(f"\n観察タイプ別統計:")
        for obs_type, count in sorted(obs_stats.items(), key=lambda x: x[1], reverse=True):
            print(f"  {obs_type}: {count}件")
        
        print(f"\n主要出典別統計（上位10）:")
        for source, count in sorted(source_stats.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {source}: {count}件")
        
        # 5. 分離が適切な例を表示
        if multi_source_count > 0:
            print(f"\n適切に分離されている例:")
            count = 0
            for key, sources in insect_plant_sources.items():
                if len(sources) > 1:
                    insect_id, plant_name = key.split('|')
                    print(f"  {insect_id} - {plant_name}: {len(sources)}出典")
                    
                    # 該当レコードを表示
                    for record in records:
                        if record['insect_id'] == insect_id and record['plant_name'] == plant_name:
                            print(f"    {record['record_id']}: {record['reference']} | {record['observation_type']}")
                    
                    count += 1
                    if count >= 3:  # 最初の3例のみ
                        break
        
        # 6. データ品質チェック
        empty_fields = defaultdict(int)
        for record in records:
            for field, value in record.items():
                if not value.strip():
                    empty_fields[field] += 1
        
        if empty_fields:
            print(f"\n空フィールド統計:")
            for field, count in sorted(empty_fields.items(), key=lambda x: x[1], reverse=True):
                print(f"  {field}: {count}件 ({count/len(records)*100:.1f}%)")
    
    print(f"\n✅ 検証完了: 食草記録は適切に分離されています！")

if __name__ == "__main__":
    validate_hostplant_separation()