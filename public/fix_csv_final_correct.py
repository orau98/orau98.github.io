#!/usr/bin/env python3
"""
Final correct version: Fix malformed CSV where scientific names with commas are not properly quoted.
This version ensures proper comma placement between author and year.
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
            
            # Determine the correct format based on row structure
            if len(row) == 5:
                # Already correct format
                scientific_name = row[1]
                host_plants = row[2]
                remarks = row[3]
                emergence_period = row[4]
            elif len(row) == 6:
                # Scientific name is split at comma
                # Pattern: "Genus species (Author", "Year)"
                if re.match(r'^[\[\(]?\d{4}[\]\)]?$', row[2].strip()):
                    scientific_name = f"{row[1]}, {row[2]}"
                    host_plants = row[3]
                    remarks = row[4]
                    emergence_period = row[5] if len(row) > 5 else ""
                else:
                    # Might be different structure
                    scientific_name = row[1]
                    host_plants = row[2]
                    remarks = row[3]
                    emergence_period = row[4]
            elif len(row) == 7:
                # Special handling for row 18 (キバラモクメキリガ)
                if japanese_name == "キバラモクメキリガ":
                    # "Xylena formosa (Butler 1878)" - no comma between author and year
                    scientific_name = f"{row[1]} {row[2]}"
                else:
                    # Standard case - add comma
                    scientific_name = f"{row[1]}, {row[2]}"
                host_plants = row[3]
                remarks = row[4]
                emergence_period = row[5]
            else:
                print(f"Row {row_num} has unusual structure ({len(row)} columns)")
                # Try generic handling
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
    
    # Write the fixed data
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerows(fixed_rows)
    
    print(f"\nFixed CSV written to: {output_file}")
    print(f"Total rows processed: {len(fixed_rows)}")
    
    # Show sample of corrected scientific names
    print("\nSample scientific names after correction:")
    samples = [2, 3, 4, 5, 6, 17]
    for i in samples:
        if i < len(fixed_rows):
            print(f"Row {i+1}: {fixed_rows[i][0]} -> {fixed_rows[i][1]}")

if __name__ == "__main__":
    input_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_fixed.csv"
    output_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_corrected.csv"
    
    fix_csv_structure(input_file, output_file)