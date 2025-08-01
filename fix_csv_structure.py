#!/usr/bin/env python3
import csv
import sys

def fix_csv_structure():
    input_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_master.csv'
    output_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_master_fixed.csv'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Read header and ensure it has exactly 27 columns with 備考
    header_line = lines[0].strip()
    header_cols = header_line.split(',')
    
    # Ensure header has exactly 27 columns ending with 備考
    if len(header_cols) == 26:
        header_cols.append('備考')
    elif len(header_cols) > 27:
        header_cols = header_cols[:27]
    
    fixed_lines = []
    fixed_lines.append(','.join(header_cols))
    
    # Process each data row
    for i, line in enumerate(lines[1:], start=2):
        line = line.strip()
        if not line:
            continue
            
        # Split the line respecting quoted fields
        try:
            reader = csv.reader([line], quotechar='"', delimiter=',', quoting=csv.QUOTE_MINIMAL)
            cols = next(reader)
        except:
            # Fallback to simple split if CSV parsing fails
            cols = line.split(',')
        
        # Handle different column counts
        if len(cols) < 27:
            # Pad with empty strings to reach 27 columns
            cols.extend([''] * (27 - len(cols)))
        elif len(cols) > 27:
            # For rows with >27 columns, merge extras into the last column (備考)
            if len(cols) > 27:
                # Keep first 26 columns, merge the rest into 備考
                merged_remarks = ','.join(cols[26:])
                cols = cols[:26] + [merged_remarks]
        
        # Escape any quotes in the data properly
        escaped_cols = []
        for col in cols:
            if '"' in col or ',' in col or '\n' in col:
                # Escape quotes and wrap in quotes
                escaped_col = '"' + col.replace('"', '""') + '"'
                escaped_cols.append(escaped_col)
            else:
                escaped_cols.append(col)
        
        fixed_lines.append(','.join(escaped_cols))
    
    # Write the fixed CSV
    with open(output_file, 'w', encoding='utf-8') as f:
        for line in fixed_lines:
            f.write(line + '\n')
    
    print(f"Fixed CSV saved to {output_file}")
    print(f"Processed {len(fixed_lines)-1} data rows")

if __name__ == "__main__":
    fix_csv_structure()