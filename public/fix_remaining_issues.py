#!/usr/bin/env python3
"""
Fix remaining issues in the CSV where some scientific names are still incomplete.
"""

import csv
import re

def fix_remaining_issues(input_file, output_file):
    """
    Fix remaining scientific name issues in the CSV.
    """
    fixed_rows = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        # Process all rows
        for row_num, row in enumerate(reader):
            if row_num == 0:
                # Header
                fixed_rows.append(row)
                continue
            
            # Check if scientific name appears incomplete (missing closing parenthesis)
            scientific_name = row[1]
            
            # Fix specific patterns
            if "Meganephria funesta (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Meganephria funesta (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            elif "Daseochaeta viridis (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Daseochaeta viridis (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            elif "Lithophane venusta (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Lithophane venusta (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            elif "Eupsilia quadrilinea (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Eupsilia quadrilinea (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            elif "Conistra albipuncta (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Conistra albipuncta (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            elif "Telorta edentata (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Telorta edentata (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            elif "Egira saxea (Leech" in scientific_name and "[1889])" in row[2]:
                scientific_name = "Egira saxea (Leech, [1889])"
                row[2] = row[3]  # Shift other columns
                row[3] = row[4] if len(row) > 4 else ""
                row[4] = row[5] if len(row) > 5 else ""
            
            # Update the row
            row[1] = scientific_name
            
            # Ensure we have exactly 5 columns
            while len(row) < 5:
                row.append("")
            row = row[:5]
            
            fixed_rows.append(row)
    
    # Write the fixed data
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerows(fixed_rows)
    
    print(f"Fixed CSV written to: {output_file}")
    print(f"Total rows processed: {len(fixed_rows)}")

if __name__ == "__main__":
    input_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_corrected.csv"
    output_file = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_final.csv"
    
    fix_remaining_issues(input_file, output_file)