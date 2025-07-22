#!/usr/bin/env python3
"""
Final solution to fix the CSV parsing issue.

The root problem: The CSV has already been corrupted by incorrect parsing.
We need to reconstruct the correct data structure.
"""

import csv
import re
import shutil
from pathlib import Path

def fix_csv_final_solution():
    """Fix the CSV by detecting and merging incorrectly split fields."""
    
    input_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_original.csv")
    output_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga.csv")
    
    if not input_file.exists():
        print(f"Error: Original file not found: {input_file}")
        return
    
    print(f"Processing: {input_file}")
    
    # Read and fix line by line
    fixed_rows = []
    issues_fixed = 0
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        fixed_rows.append(header)
        print(f"Header fields: {len(header)}")
        
        for line_num, row in enumerate(reader, 2):
            # Check if this row might have the splitting issue
            # Expected: 27 fields, but if we have 26 or 28, check for the pattern
            
            if len(row) >= 24:
                # Check if field 23 (0-indexed) looks like incomplete scientific name
                sci_name_field = row[23]
                
                # Pattern: ends with (Author but no closing parenthesis
                if re.search(r'\([^,\)]+$', sci_name_field) and len(row) > 24:
                    # Check if next field starts with year pattern
                    next_field = row[24]
                    if re.match(r'^"?\d{4}\)', next_field):
                        # This is a split field that needs merging
                        print(f"\nLine {line_num}: Found split scientific name")
                        print(f"  Field 23: {sci_name_field}")
                        print(f"  Field 24: {next_field}")
                        
                        # Extract year and fix format
                        year_match = re.match(r'^"?(\d{4})\)', next_field)
                        if year_match:
                            year = year_match.group(1)
                            
                            # Reconstruct the scientific name
                            fixed_sci_name = sci_name_field + ', ' + year + ')'
                            
                            # Extract food plant data
                            food_plant_start = next_field.find(')')
                            if food_plant_start >= 0 and food_plant_start + 1 < len(next_field):
                                food_plant = next_field[food_plant_start + 1:]
                                if food_plant.startswith(','):
                                    food_plant = food_plant[1:].strip()
                                
                                # Remove quotes if present
                                food_plant = food_plant.strip('"')
                            else:
                                food_plant = ""
                            
                            # Reconstruct the row
                            fixed_row = row[:23] + [fixed_sci_name, food_plant] + row[25:]
                            fixed_rows.append(fixed_row)
                            issues_fixed += 1
                            
                            print(f"  Fixed to: {fixed_sci_name}")
                            print(f"  Food plant: {food_plant[:50]}...")
                            continue
            
            # No fix needed for this row
            fixed_rows.append(row)
    
    # Write the fixed data
    print(f"\nWriting fixed data to: {output_file}")
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(fixed_rows)
    
    print(f"\nFixed {issues_fixed} rows")
    
    # Verify the fix
    verify_fix(output_file)

def verify_fix(file_path):
    """Verify the fix worked correctly."""
    
    print("\nVerifying fixes...")
    
    test_species = [
        'センモンヤガ',
        'イラクサマダラウワバ',
        'エゾヒサゴキンウワバ',
        'ガマキンウワバ'
    ]
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        for row in reader:
            if len(row) >= 25 and row[16] in test_species:
                print(f"\n{row[16]}:")
                print(f"  Fields: {len(row)}")
                print(f"  Scientific name: {row[23]}")
                print(f"  Food plant: {row[24][:80]}...")
                
                # Check format
                if re.match(r'^[A-Za-z]+ [a-z]+ \([A-Za-z]+, \d{4}\)$', row[23]):
                    print("  ✓ Scientific name format is correct")
                else:
                    print("  ✗ Scientific name format needs attention")

if __name__ == "__main__":
    fix_csv_final_solution()