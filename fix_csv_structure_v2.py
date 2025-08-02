#!/usr/bin/env python3
"""
Fix malformed CSV where scientific names with commas are not properly quoted.
Version 2: Better handling of scientific names split across columns.
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
            
            # Determine the structure based on row length
            if len(row) == 5:
                # Properly formatted row
                scientific_name = row[1]
                host_plants = row[2]
                remarks = row[3]
                emergence_period = row[4]
            elif len(row) == 6:
                # Scientific name split into 2 parts (author with comma)
                scientific_name = f"{row[1]}, {row[2]}"
                host_plants = row[3]
                remarks = row[4]
                emergence_period = row[5] if len(row) > 5 else ""
            elif len(row) == 7:
                # Row 18 special case or similar
                if row[2] == "1878)":
                    scientific_name = f"{row[1]} {row[2]}"
                else:
                    scientific_name = f"{row[1]}, {row[2]}"
                host_plants = row[3]
                remarks = row[4]
                emergence_period = row[5]
            else:
                # For other cases, try to intelligently combine
                # Look for year pattern to determine where scientific name ends
                scientific_parts = []
                idx = 1
                
                while idx < len(row):
                    part = row[idx].strip()
                    scientific_parts.append(part)
                    
                    # Check if we've reached the end of scientific name
                    if re.search(r'\d{4}\)?$', part) or re.search(r'\[\d{4}\]\)?$', part):
                        break
                    idx += 1
                
                # Combine scientific name parts
                if len(scientific_parts) >= 2 and re.search(r'^(Leech|Butler|Sugi|Chang|Draudt|Esper|Graeser|Hufnagel|Hübner|Bockhausen|Denis|Schiffermüller|Fabricius|Linnaeus|Moore|Treitschke|Hampson|Lederer|Püngeler|Oberthür|Matsumura|Motschulsky|Wileman|West|Vieweg|Bryk|Staudinger|Boursin|Graeser|Hreblay|Ronkay|Yoshimoto|Scriba|Shikata|Filipjev|Draudt|Inaba|Harie|Hône|Ohtsuka|Höne|Bremer)', scientific_parts[-2]):
                    # Author name found, combine with comma
                    scientific_name = scientific_parts[0]
                    for i in range(1, len(scientific_parts)-1):
                        scientific_name += f" {scientific_parts[i]}"
                    scientific_name += f", {scientific_parts[-1]}"
                else:
                    scientific_name = ' '.join(scientific_parts)
                
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
            
            # Clean up any issues with the scientific name
            scientific_name = re.sub(r'\s+', ' ', scientific_name.strip())
            
            # Add the fixed row
            fixed_row = [japanese_name, scientific_name, host_plants, remarks, emergence_period]
            fixed_rows.append(fixed_row)
            
            # Debug output for rows that were modified
            if len(row) != 5:
                print(f"Row {row_num} ({japanese_name}): {len(row)} columns -> fixed scientific name: {scientific_name}")
    
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