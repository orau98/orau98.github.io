#!/usr/bin/env python3
"""
Comprehensive fix for CSV parsing issues in the moth database.

The main issue: Scientific names containing patterns like (Linnaeus,"1758)
are causing CSV parsing errors because the quotes are not properly escaped.
"""

import csv
import re
import shutil
from pathlib import Path

def fix_csv_comprehensive():
    """Fix all CSV parsing issues comprehensively."""
    
    input_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga.csv")
    output_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_fixed.csv")
    backup_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_backup.csv")
    
    # Create backup
    print(f"Creating backup: {backup_file}")
    shutil.copy2(input_file, backup_file)
    
    # Read the raw file content
    print("Reading raw file content...")
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix patterns where quotes appear in scientific names
    # Pattern 1: (Author,"YEAR) -> (Author, "YEAR)
    print("Fixing quote patterns in scientific names...")
    
    # Find all occurrences of the problematic pattern
    pattern1 = re.compile(r'\(([^,\n]+),"(\d{4})\)')
    matches = pattern1.findall(content)
    print(f"Found {len(matches)} instances of (Author,\"YEAR) pattern")
    
    # Replace the pattern
    fixed_content = pattern1.sub(r'(\1, "\2)', content)
    
    # Additional fix: Sometimes the pattern appears as field content
    # We need to ensure that field values containing quotes are properly quoted
    # When a field contains both quotes and commas, the entire field must be quoted
    # and internal quotes must be doubled
    
    print("\nAnalyzing line-by-line for additional issues...")
    lines = fixed_content.split('\n')
    fixed_lines = []
    issues_fixed = 0
    
    for line_num, line in enumerate(lines, 1):
        if not line.strip():
            fixed_lines.append(line)
            continue
            
        # Try to parse the line
        try:
            reader = csv.reader([line])
            row = list(reader)[0]
            
            # Check if we have the expected number of fields
            if len(row) == 27:  # Expected number of fields
                fixed_lines.append(line)
            else:
                # Try to fix common issues
                # Look for patterns that might cause parsing issues
                if 'Linnaeus' in line and '"' in line:
                    # This line might have the quote issue
                    # Manually fix the scientific name field
                    parts = line.split(',')
                    
                    # Find the scientific name field (should be around index 23)
                    for i in range(len(parts) - 1):
                        if 'Linnaeus' in parts[i] and '"' in parts[i+1]:
                            # Found the problematic split
                            # Merge these parts
                            parts[i] = parts[i] + ',' + parts[i+1]
                            parts.pop(i+1)
                            issues_fixed += 1
                            print(f"  Fixed line {line_num}: merged scientific name field")
                            break
                    
                    fixed_line = ','.join(parts)
                    fixed_lines.append(fixed_line)
                else:
                    fixed_lines.append(line)
                    
        except Exception as e:
            print(f"  Error parsing line {line_num}: {e}")
            fixed_lines.append(line)
    
    # Write the fixed content
    print(f"\nWriting fixed file: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))
    
    # Verify specific problematic cases
    print("\nVerifying fixes...")
    with open(output_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if 'センモンヤガ' in line and 'exclamationis' in line:
                print(f"\nFound センモンヤガ at line {line_num}")
                reader = csv.reader([line])
                row = list(reader)[0]
                print(f"  Number of fields: {len(row)}")
                if len(row) >= 25:
                    print(f"  Field 23 (学名): {row[23]}")
                    print(f"  Field 24 (食草): {row[24][:100]}...")
                break
    
    print(f"\nFixed CSV saved to: {output_file}")
    print(f"Total pattern replacements: {len(matches)}")
    print(f"Additional line fixes: {issues_fixed}")
    
    return output_file

def verify_all_problematic_species():
    """Verify that all known problematic species are fixed."""
    
    fixed_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_fixed.csv")
    
    # List of species known to have the issue
    problematic_species = [
        'センモンヤガ',
        'イラクサマダラウワバ', 
        'エゾヒサゴキンウワバ',
        'ガマキンウワバ',
        'ホクトギンウワバ',
        'イネキンウワバ'
    ]
    
    print("\nVerifying all problematic species...")
    with open(fixed_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        for row in reader:
            if len(row) >= 25 and row[16] in problematic_species:
                print(f"\n{row[16]}:")
                print(f"  Fields: {len(row)}")
                print(f"  学名: {row[23]}")
                print(f"  食草: {row[24][:50]}...")

if __name__ == "__main__":
    output_file = fix_csv_comprehensive()
    verify_all_problematic_species()