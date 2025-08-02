#!/usr/bin/env python3
"""
Correct version: Fix malformed CSV where scientific names with commas are not properly quoted.
This version correctly combines author names and years with commas.
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
        
        # Process header
        header = next(reader)
        fixed_rows.append(["和名", "学名", "食草", "食草に関する備考", "成虫の発生時期"])
        
        # Process data rows
        for row_num, row in enumerate(reader, start=2):
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
            
            # Handle different row lengths
            if len(row) == 5:
                # Already correct format
                scientific_name = row[1]
                host_plants = row[2]
                remarks = row[3]
                emergence_period = row[4]
            elif len(row) == 6:
                # Scientific name split: "Genus species (Author", "Year)", host plants...
                # Check if row[2] is a year (with or without parentheses/brackets)
                if re.match(r'^[\[\(]?\d{4}[\]\)]?$', row[2].strip()):
                    scientific_name = f"{row[1]}, {row[2]}"
                    host_plants = row[3]
                    remarks = row[4]
                    emergence_period = row[5] if len(row) > 5 else ""
                else:
                    # Different pattern - row[1] is complete scientific name
                    scientific_name = row[1]
                    host_plants = row[2]
                    remarks = row[3]
                    emergence_period = row[4]
            elif len(row) == 7:
                # Special case - could be "Genus species (Author Year)" without comma
                # or scientific name split across 3 columns
                if japanese_name == "キバラモクメキリガ":
                    # Special case: "Xylena formosa (Butler 1878)" - no comma
                    scientific_name = f"{row[1]} {row[2]}"
                    host_plants = row[3]
                    remarks = row[4]
                    emergence_period = row[5]
                else:
                    # Standard case with comma
                    scientific_name = f"{row[1]}, {row[2]}"
                    host_plants = row[3]
                    remarks = row[4]
                    emergence_period = row[5]
            else:
                print(f"Row {row_num} has unusual structure ({len(row)} columns): {row}")
                # Try to handle it generically
                scientific_name = row[1]
                if len(row) > 2:
                    host_plants = row[2]
                if len(row) > 3:
                    remarks = row[3]
                if len(row) > 4:
                    emergence_period = row[4]
            
            # Clean up scientific name
            scientific_name = re.sub(r'\s+', ' ', scientific_name.strip())
            
            # Add the fixed row
            fixed_row = [japanese_name, scientific_name, host_plants, remarks, emergence_period]
            fixed_rows.append(fixed_row)
            
            # Debug output
            if len(row) != 5:
                print(f"Row {row_num} ({japanese_name}): {len(row)} columns -> Scientific name: {scientific_name}")
    
    # Write the fixed data
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerows(fixed_rows)
    
    print(f"\nFixed CSV written to: {output_file}")
    print(f"Total rows processed: {len(fixed_rows)}")
    
    # Verify by showing a few sample rows
    print("\nSample corrected rows:")
    for i in [2, 3, 4, 5, 6, 17]:  # Rows with issues
        if i < len(fixed_rows):
            print(f"Row {i+1}: {fixed_rows[i][1]}")  # Show scientific name

if __name__ == "__main__":
    input_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_fixed.csv"
    output_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_corrected.csv"
    
    fix_csv_structure(input_file, output_file)