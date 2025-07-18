#!/usr/bin/env python3
import csv
import re

def fix_csv_file(input_file, output_file):
    """Fix malformed CSV file by properly parsing and reformatting"""
    
    with open(input_file, 'r', encoding='utf-8-sig') as infile:
        content = infile.read()
    
    # Split into lines
    lines = content.split('\n')
    
    # Process each line
    fixed_lines = []
    
    for i, line in enumerate(lines):
        if i == 0:
            # Header line - should be correct
            fixed_lines.append(line)
            continue
        
        if not line.strip():
            # Empty line
            continue
        
        # Parse the line manually to fix CSV format issues
        # The expected format is: "和名","学名","食草","食草に関する備考","成虫の発生時期"
        
        # Try to extract the 5 fields
        try:
            # Remove BOM if present
            line = line.strip()
            if line.startswith('"'):
                # Try to parse as proper CSV
                try:
                    reader = csv.reader([line])
                    row = next(reader)
                    if len(row) == 5:
                        # Properly formatted row
                        fixed_lines.append(line)
                        continue
                except:
                    pass
            
            # If we get here, the line needs fixing
            # Try to parse manually
            
            # Remove leading/trailing quotes if present
            if line.startswith('"') and line.endswith('"'):
                line = line[1:-1]
            
            # Split by comma, but be careful about commas inside quotes
            parts = []
            current_part = ""
            in_quotes = False
            i = 0
            
            while i < len(line):
                char = line[i]
                
                if char == '"':
                    if in_quotes and i + 1 < len(line) and line[i + 1] == '"':
                        # Double quote - escaped quote
                        current_part += '"'
                        i += 2
                        continue
                    else:
                        # Toggle quote state
                        in_quotes = not in_quotes
                        i += 1
                        continue
                
                if char == ',' and not in_quotes:
                    # Field separator
                    parts.append(current_part.strip())
                    current_part = ""
                    i += 1
                    continue
                
                current_part += char
                i += 1
            
            # Add the last part
            if current_part:
                parts.append(current_part.strip())
            
            # Clean up parts and ensure we have 5 fields
            cleaned_parts = []
            for part in parts:
                # Remove extra quotes
                part = part.strip()
                if part.startswith('"') and part.endswith('"'):
                    part = part[1:-1]
                # Handle double quotes
                part = part.replace('""', '"')
                cleaned_parts.append(part)
            
            # Ensure we have exactly 5 fields
            while len(cleaned_parts) < 5:
                cleaned_parts.append("")
            
            # Take only first 5 fields
            cleaned_parts = cleaned_parts[:5]
            
            # Create properly formatted CSV line
            formatted_line = ','.join(f'"{part}"' for part in cleaned_parts)
            fixed_lines.append(formatted_line)
            
        except Exception as e:
            print(f"Error processing line {i}: {line}")
            print(f"Error: {e}")
            # Skip malformed lines
            continue
    
    # Write fixed content
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        outfile.write('\n'.join(fixed_lines))

if __name__ == "__main__":
    fix_csv_file(
        "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ.csv",
        "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_fixed.csv"
    )
    print("CSV file fixed successfully!")