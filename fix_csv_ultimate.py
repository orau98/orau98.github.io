#!/usr/bin/env python3
"""
Ultimate fix for the CSV parsing issue.

Root cause: The original data has patterns like:
  ...,Agrotis exclamationis (Linnaeus,"1758),農業害虫であり...
  
This should be TWO separate fields:
  ...,Agrotis exclamationis (Linnaeus, 1758),農業害虫であり...
"""

import csv
import re
import shutil
from pathlib import Path

def fix_csv_ultimate():
    """Ultimate fix that handles the root cause properly."""
    
    input_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga.csv")
    output_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga.csv")
    backup_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_original.csv")
    
    # Create backup if not exists
    if not backup_file.exists():
        print(f"Creating backup: {backup_file}")
        shutil.copy2(input_file, backup_file)
    
    # Read the entire file
    print("Reading file content...")
    with open(backup_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # The main issue is that patterns like (Linnaeus,"1758) appear in the data
    # These should be (Linnaeus, 1758) without quotes around the year
    
    # First, let's fix all occurrences of this pattern in the content
    print("Fixing quote patterns...")
    
    # Pattern: (Author,"YEAR) where YEAR is 4 digits
    # Replace with: (Author, YEAR)
    pattern = re.compile(r'\(([^,\)]+),"(\d{4})\)')
    
    # Count matches
    matches = pattern.findall(content)
    print(f"Found {len(matches)} instances to fix")
    
    # Show some examples
    for i, (author, year) in enumerate(matches[:5]):
        print(f"  Example {i+1}: ({author},\"{year}) -> ({author}, {year})")
    
    # Apply the fix
    fixed_content = pattern.sub(r'(\1, \2)', content)
    
    # Write the fixed content
    print(f"\nWriting fixed content to: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    # Verify the fix
    print("\nVerifying fixes...")
    verify_complete_fix(output_file)
    
    return output_file

def verify_complete_fix(file_path):
    """Comprehensive verification of the fix."""
    
    print("\nChecking CSV structure...")
    
    # First, check if the file can be parsed properly
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        print(f"Header fields: {len(header)}")
        
        # Count field consistency
        field_counts = {}
        total_rows = 0
        problem_rows = []
        
        for line_num, row in enumerate(reader, 2):
            total_rows += 1
            field_count = len(row)
            field_counts[field_count] = field_counts.get(field_count, 0) + 1
            
            if field_count != 27:
                problem_rows.append((line_num, field_count))
        
        print(f"\nTotal data rows: {total_rows}")
        print("Field count distribution:")
        for count, freq in sorted(field_counts.items()):
            print(f"  {count} fields: {freq} rows")
        
        if problem_rows:
            print(f"\nFound {len(problem_rows)} rows with unexpected field count:")
            for line_num, count in problem_rows[:10]:
                print(f"  Line {line_num}: {count} fields")
    
    # Check specific problematic species
    print("\nChecking specific species...")
    test_cases = [
        ('センモンヤガ', 'Agrotis exclamationis', '農業害虫'),
        ('イラクサマダラウワバ', 'Abrostola triplasia', 'イラクサ'),
        ('エゾヒサゴキンウワバ', 'Diachrysia chrysitis', '多食性'),
        ('ガマキンウワバ', 'Autographa gamma', '多食性'),
        ('ホクトギンウワバ', 'Syngrapha interrogationis', 'ツルコケモモ'),
        ('イネキンウワバ', 'Plusia festucae', '多食性')
    ]
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        
        found_species = {}
        for row in reader:
            if len(row) >= 25:
                japanese_name = row[16]
                for test_name, latin_prefix, food_prefix in test_cases:
                    if japanese_name == test_name:
                        found_species[test_name] = {
                            'fields': len(row),
                            'scientific_name': row[23] if len(row) > 23 else 'N/A',
                            'food_plant': row[24][:50] if len(row) > 24 else 'N/A'
                        }
    
    print("\nSpecies verification results:")
    for test_name, latin_prefix, food_prefix in test_cases:
        if test_name in found_species:
            data = found_species[test_name]
            print(f"\n{test_name}:")
            print(f"  Fields: {data['fields']} (expected: 27)")
            print(f"  Scientific name: {data['scientific_name']}")
            print(f"  Food plant: {data['food_plant']}...")
            
            # Check if properly formatted
            sci_name = data['scientific_name']
            if latin_prefix in sci_name and ', ' in sci_name and ')' in sci_name:
                print(f"  ✓ Scientific name properly formatted")
            else:
                print(f"  ✗ Scientific name format issue")
            
            if food_prefix in data['food_plant']:
                print(f"  ✓ Food plant data starts correctly")
            else:
                print(f"  ✗ Food plant data issue")
        else:
            print(f"\n{test_name}: NOT FOUND")

if __name__ == "__main__":
    output_file = fix_csv_ultimate()
    print(f"\nFix completed. File updated: {output_file}")