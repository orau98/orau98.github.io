#!/usr/bin/env python3
"""
Final comprehensive fix for CSV parsing issues.

The issue: Lines containing patterns like:
  Agrotis exclamationis (Linnaeus,"1758),農業害虫であり...
Should be:
  "Agrotis exclamationis (Linnaeus, 1758)","農業害虫であり..."
"""

import csv
import re
import shutil
from pathlib import Path

def fix_csv_final():
    """Final fix using a more robust approach."""
    
    input_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga.csv")
    output_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_fixed.csv")
    backup_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_backup2.csv")
    
    # Create backup
    print(f"Creating backup: {backup_file}")
    shutil.copy2(input_file, backup_file)
    
    # Read all lines
    print("Reading file...")
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Process header
    header_line = lines[0]
    header = list(csv.reader([header_line]))[0]
    print(f"Header has {len(header)} fields")
    
    # Process each line
    fixed_lines = [header_line]
    issues_fixed = 0
    
    for line_num, line in enumerate(lines[1:], 2):
        if not line.strip():
            fixed_lines.append(line)
            continue
        
        # Check if this line has the problematic pattern
        if re.search(r'\(Linnaeus,"1758\)', line) or re.search(r'\([^,]+,"1\d{3}\)', line):
            # This line needs fixing
            # Split by comma but be careful about quoted fields
            parts = []
            current_part = []
            in_quotes = False
            
            for char in line:
                if char == '"' and (not current_part or current_part[-1] != '\\'):
                    in_quotes = not in_quotes
                elif char == ',' and not in_quotes:
                    parts.append(''.join(current_part))
                    current_part = []
                    continue
                current_part.append(char)
            
            # Don't forget the last part
            if current_part:
                parts.append(''.join(current_part))
            
            # Now fix the specific issue
            # Look for the pattern in the parts
            fixed_parts = []
            i = 0
            while i < len(parts):
                part = parts[i]
                
                # Check if this part ends with (Author
                if i < len(parts) - 1 and re.search(r'\([^,\)]+$', part) and re.match(r'^"1\d{3}\)', parts[i+1]):
                    # This is the problematic split
                    # The scientific name is split across two parts
                    scientific_name = part + ',' + parts[i+1]
                    
                    # Extract the year from the second part
                    year_match = re.match(r'^"(1\d{3})\)', parts[i+1])
                    if year_match:
                        year = year_match.group(1)
                        # Fix the scientific name format
                        scientific_name = re.sub(r'\(([^,]+),"' + year + r'\)', r'(\1, ' + year + ')', part)
                        
                        # Get the rest of the food plant data from the second part
                        food_plant_start = parts[i+1].find(')') + 1
                        if food_plant_start > 0 and food_plant_start < len(parts[i+1]):
                            # The food plant data starts after the year
                            food_plant = parts[i+1][food_plant_start:]
                            if food_plant.startswith(','):
                                food_plant = food_plant[1:]
                            
                            fixed_parts.append(scientific_name)
                            fixed_parts.append(food_plant)
                            i += 2
                            issues_fixed += 1
                            continue
                
                fixed_parts.append(part)
                i += 1
            
            # Reconstruct the line
            # Use csv.writer to properly quote fields
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(fixed_parts)
            fixed_line = output.getvalue()
            fixed_lines.append(fixed_line)
        else:
            fixed_lines.append(line)
    
    # Write the fixed file
    print(f"\nWriting fixed file: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)
    
    print(f"\nFixed {issues_fixed} problematic lines")
    
    # Verify the fixes
    print("\nVerifying fixes...")
    verify_species(output_file)
    
    return output_file

def verify_species(file_path):
    """Verify specific species are correctly parsed."""
    
    test_species = {
        'センモンヤガ': 'Agrotis exclamationis',
        'イラクサマダラウワバ': 'Abrostola triplasia',
        'エゾヒサゴキンウワバ': 'Diachrysia chrysitis'
    }
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        for row in reader:
            if len(row) >= 25:
                japanese_name = row[16] if len(row) > 16 else ''
                if japanese_name in test_species:
                    print(f"\n{japanese_name}:")
                    print(f"  Total fields: {len(row)}")
                    print(f"  Expected fields: 27")
                    print(f"  Field 23 (学名): {row[23] if len(row) > 23 else 'N/A'}")
                    print(f"  Field 24 (食草): {row[24][:50] if len(row) > 24 else 'N/A'}...")
                    
                    # Check if scientific name is complete
                    if len(row) > 23 and test_species[japanese_name] in row[23]:
                        if '(' in row[23] and ')' in row[23]:
                            print(f"  ✓ Scientific name appears complete")
                        else:
                            print(f"  ✗ Scientific name may be incomplete")

def create_manual_fix():
    """Create a manual fix by rebuilding problematic lines."""
    
    input_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga.csv")
    output_file = Path("/Users/akimotohiroki/insects-host-plant-explorer/dist/ListMJ_hostplants_integrated_with_kiriga_manual_fixed.csv")
    
    print("\nCreating manual fix...")
    
    # Define the correct format for problematic entries
    manual_fixes = {
        'Agrotis exclamationis (Linnaeus': {
            'scientific_name': 'Agrotis exclamationis (Linnaeus, 1758)',
            'food_plant_pattern': r'農業害虫であり'
        },
        'Abrostola triplasia (Linnaeus': {
            'scientific_name': 'Abrostola triplasia (Linnaeus, 1758)',
            'food_plant_pattern': r'イラクサ'
        },
        'Diachrysia chrysitis (Linnaeus': {
            'scientific_name': 'Diachrysia chrysitis (Linnaeus, 1758)',
            'food_plant_pattern': r'多食性'
        },
        'Autographa gamma (Linnaeus': {
            'scientific_name': 'Autographa gamma (Linnaeus, 1758)',
            'food_plant_pattern': r'多食性'
        },
        'Syngrapha interrogationis (Linnaeus': {
            'scientific_name': 'Syngrapha interrogationis (Linnaeus, 1758)',
            'food_plant_pattern': r'ツルコケモモ'
        },
        'Plusia festucae (Linnaeus': {
            'scientific_name': 'Plusia festucae (Linnaeus, 1758)',
            'food_plant_pattern': r'多食性'
        }
    }
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        with open(output_file, 'w', encoding='utf-8') as outfile:
            reader = csv.reader(infile)
            writer = csv.writer(outfile)
            
            # Write header
            header = next(reader)
            writer.writerow(header)
            
            fixed_count = 0
            for row in reader:
                # Check if this row needs manual fixing
                if len(row) >= 24:
                    scientific_name_field = row[23]
                    
                    for pattern, fix_info in manual_fixes.items():
                        if pattern in scientific_name_field:
                            # This row needs fixing
                            # Find where the food plant data is
                            food_plant_field = row[24]
                            
                            # Fix the scientific name
                            row[23] = fix_info['scientific_name']
                            
                            # The food plant data might be in field 24 starting with the year
                            if food_plant_field.startswith('"'):
                                # Extract the actual food plant data
                                match = re.search(r'\d{4}\),(.+)', food_plant_field)
                                if match:
                                    row[24] = match.group(1).strip()
                                    fixed_count += 1
                            
                            break
                
                writer.writerow(row)
    
    print(f"Manual fix completed. Fixed {fixed_count} entries.")
    print(f"Output saved to: {output_file}")
    
    # Verify manual fix
    print("\nVerifying manual fix...")
    verify_species(output_file)

if __name__ == "__main__":
    # Try the automatic fix first
    output_file = fix_csv_final()
    
    # If still issues, try manual fix
    print("\n" + "="*50)
    print("Trying manual fix approach...")
    create_manual_fix()