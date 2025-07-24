#!/usr/bin/env python3
"""
Final version: Fix malformed CSV where scientific names with commas are not properly quoted.
This version correctly handles all the different patterns in the data.
"""

import csv
import re

def fix_csv_structure(input_file, output_file):
    """
    Fix the CSV structure by properly combining scientific name columns.
    """
    fixed_rows = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Process header
    fixed_rows.append(["和名", "学名", "食草", "食草に関する備考", "成虫の発生時期"])
    
    # Process data rows
    for row_num, line in enumerate(lines[1:], start=2):
        # Parse CSV line
        reader = csv.reader([line])
        row = next(reader)
        
        if len(row) < 3:
            print(f"Warning: Row {row_num} has insufficient columns: {row}")
            continue
        
        # Extract Japanese name (always first column)
        japanese_name = row[0]
        
        # Initialize variables
        scientific_name = ""
        host_plants = ""
        remarks = ""
        emergence_period = ""
        
        # For rows with exactly 5 columns, they're already correct
        if len(row) == 5:
            scientific_name = row[1]
            host_plants = row[2]
            remarks = row[3]
            emergence_period = row[4]
        # For rows with 6 columns, the scientific name is split at the comma
        elif len(row) == 6:
            # Check if column 2 is a year (4 digits)
            if re.match(r'^\d{4}\)?$', row[2].strip()) or re.match(r'^\[\d{4}\]\)?$', row[2].strip()):
                # Scientific name is split: "Author", "Year"
                scientific_name = f"{row[1]}, {row[2]}"
                host_plants = row[3]
                remarks = row[4]
                emergence_period = row[5] if len(row) > 5 else ""
            else:
                # Different pattern
                scientific_name = row[1]
                host_plants = row[2]
                remarks = row[3]
                emergence_period = row[4]
        else:
            # For other cases, need to handle special patterns
            # Row 18 is special: "Xylena formosa (Butler 1878)" without comma
            if japanese_name == "キバラモクメキリガ" and len(row) == 7:
                scientific_name = f"{row[1]} {row[2]}"  # No comma for this one
                host_plants = row[3]
                remarks = row[4]
                emergence_period = row[5]
            else:
                # General case: find where scientific name ends by looking for year
                idx = 1
                parts = []
                while idx < len(row):
                    part = row[idx].strip()
                    parts.append(part)
                    # Check if this is a year
                    if re.match(r'^\d{4}\)?$', part) or re.match(r'^\[\d{4}\]\)?$', part):
                        break
                    idx += 1
                
                # Combine scientific name parts with comma before the year
                if len(parts) >= 2:
                    scientific_name = f"{parts[0]}, {' '.join(parts[1:])}"
                else:
                    scientific_name = ' '.join(parts)
                
                # Get remaining fields
                idx += 1
                if idx < len(row):
                    host_plants = row[idx]
                    idx += 1
                if idx < len(row):
                    remarks = row[idx]
                    idx += 1
                if idx < len(row):
                    emergence_period = row[idx]
        
        # Clean up the scientific name
        scientific_name = re.sub(r'\s+', ' ', scientific_name.strip())
        
        # Add the fixed row
        fixed_row = [japanese_name, scientific_name, host_plants, remarks, emergence_period]
        fixed_rows.append(fixed_row)
        
        # Debug output for rows that were modified
        if len(row) != 5:
            print(f"Row {row_num} ({japanese_name}): {len(row)} columns -> {scientific_name}")
    
    # Write the fixed data
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerows(fixed_rows)
    
    print(f"\nFixed CSV written to: {output_file}")
    print(f"Total rows processed: {len(fixed_rows)}")

if __name__ == "__main__":
    input_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_fixed.csv"
    output_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_corrected.csv"
    
    fix_csv_structure(input_file, output_file)