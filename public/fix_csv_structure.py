#!/usr/bin/env python3
"""
Fix malformed CSV where scientific names with commas are not properly quoted.
The CSV should have exactly 5 columns:
1. 和名 (Japanese name)
2. 学名 (Scientific name)
3. 食草 (Host plants)
4. 食草に関する備考 (Remarks about host plants)
5. 成虫の発生時期 (Adult emergence period)
"""

import csv
import re

def fix_csv_structure(input_file, output_file):
    """
    Fix the CSV structure by properly combining scientific name columns.
    """
    fixed_rows = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        # Process header first
        header = next(reader)
        # The header should be correct already
        fixed_rows.append(header[:5])  # Ensure exactly 5 columns
        
        # Process data rows
        for row_num, row in enumerate(reader, start=2):
            if len(row) < 3:
                print(f"Warning: Row {row_num} has insufficient columns: {row}")
                continue
            
            # Extract Japanese name (always first column)
            japanese_name = row[0]
            
            # Get remaining columns first
            remaining_cols = []
            
            # Now we need to find where the scientific name ends
            # Scientific names typically end with a year (4 digits) or a closing parenthesis followed by year
            scientific_name_parts = []
            idx = 1
            found_year = False
            
            while idx < len(row) and not found_year:
                part = row[idx].strip()
                scientific_name_parts.append(part)
                
                # Check if this part ends with a year pattern
                # Patterns: "1934", "1785)", "[1889])", "[1889]", etc.
                # Also check if next part starts with year to handle split years
                if re.search(r'\d{4}[\]\)]?$', part):
                    found_year = True
                elif idx + 1 < len(row) and re.search(r'^\[?\d{4}[\]\)]?$', row[idx + 1].strip()):
                    # Next part is just a year (possibly with brackets)
                    scientific_name_parts.append(row[idx + 1].strip())
                    idx += 1
                    found_year = True
                
                idx += 1
            
            # Get remaining columns
            remaining_cols = row[idx:] if idx < len(row) else []
            
            # Combine scientific name parts
            if scientific_name_parts:
                # Check if last part looks like host plants (contains Japanese characters or plant indicators)
                last_part = scientific_name_parts[-1]
                if re.search(r'[ぁ-んァ-ン一-龥]', last_part) or '、' in last_part:
                    # This is likely host plants, not part of scientific name
                    remaining_cols.insert(0, scientific_name_parts.pop())
                
                scientific_name = ', '.join(scientific_name_parts)
            else:
                scientific_name = ""
            
            # Ensure we have exactly 5 columns
            if len(remaining_cols) >= 3:
                host_plants = remaining_cols[0]
                remarks = remaining_cols[1]
                emergence_period = remaining_cols[2] if len(remaining_cols) > 2 else ""
            elif len(remaining_cols) == 2:
                host_plants = remaining_cols[0]
                remarks = remaining_cols[1]
                emergence_period = ""
            elif len(remaining_cols) == 1:
                host_plants = remaining_cols[0]
                remarks = ""
                emergence_period = ""
            else:
                host_plants = ""
                remarks = ""
                emergence_period = ""
            
            # Add the fixed row
            fixed_row = [japanese_name, scientific_name, host_plants, remarks, emergence_period]
            fixed_rows.append(fixed_row)
            
            # Debug output for problematic rows
            if len(row) > 5:
                print(f"Row {row_num} had {len(row)} columns, fixed to: {fixed_row}")
    
    # Write the fixed data
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerows(fixed_rows)
    
    print(f"Fixed CSV written to: {output_file}")
    print(f"Total rows processed: {len(fixed_rows)}")

if __name__ == "__main__":
    input_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_fixed.csv"
    output_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_corrected.csv"
    
    fix_csv_structure(input_file, output_file)