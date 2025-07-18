#!/usr/bin/env python3
import csv
import re

def fix_csv_file_v2(input_file, output_file):
    """Fix malformed CSV file by reconstructing the proper format"""
    
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
        
        # Try to reconstruct the proper CSV format
        # The issue is that the original CSV has malformed quotes
        
        # First, let's try to identify the pattern for each line
        # Expected format: "和名","学名","食草","食草に関する備考","成虫の発生時期"
        
        line = line.strip()
        
        # Special handling for lines that start with a quote but are malformed
        if line.startswith('"') and not line.endswith('"'):
            # This is likely a malformed line, try to fix it
            
            # Try to find the pattern: "name,scientific_name,food,remarks,emergence_time"
            # But the scientific name might have commas in it
            
            # For lines like:
            # "ナンカイミドリキリガ,Diphtherocome autumnalis (Chang, 1991),サクラ類,""飼育下での記録。"",11月下旬~1月"
            
            # Remove the leading quote
            line = line[1:]
            
            # Try to split by quotes to identify fields
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
            
            # Now we need to reconstruct the 5 fields
            # The format should be: 和名, 学名, 食草, 食草に関する備考, 成虫の発生時期
            
            if len(parts) >= 5:
                # We have at least 5 parts, but some might be incorrectly split
                # Let's try to identify the correct grouping
                
                # The first part should be the Japanese name
                japanese_name = parts[0]
                
                # The scientific name is tricky - it might contain commas
                # Look for patterns like (Author, YYYY) or (Author YYYY)
                
                # Try to reconstruct the scientific name
                scientific_name = ""
                food_start_idx = 1
                
                # Look for the end of scientific name (usually ends with year in parentheses)
                for j in range(1, len(parts)):
                    temp_sci_name = ", ".join(parts[1:j+1])
                    if re.search(r'\([^)]*\d{4}\)', temp_sci_name):
                        # Found a year pattern, this is likely the end of scientific name
                        scientific_name = temp_sci_name
                        food_start_idx = j + 1
                        break
                
                if not scientific_name and len(parts) > 1:
                    # Fallback - assume scientific name is just the second part
                    scientific_name = parts[1]
                    food_start_idx = 2
                
                # The remaining parts should be food, remarks, and emergence time
                remaining_parts = parts[food_start_idx:]
                
                # Ensure we have exactly 3 remaining parts
                while len(remaining_parts) < 3:
                    remaining_parts.append("")
                
                # Take only first 3 remaining parts
                food = remaining_parts[0] if len(remaining_parts) > 0 else ""
                remarks = remaining_parts[1] if len(remaining_parts) > 1 else ""
                emergence_time = remaining_parts[2] if len(remaining_parts) > 2 else ""
                
                # Clean up the fields
                fields = [japanese_name, scientific_name, food, remarks, emergence_time]
                cleaned_fields = []
                
                for field in fields:
                    field = field.strip()
                    # Remove surrounding quotes if present
                    if field.startswith('"') and field.endswith('"'):
                        field = field[1:-1]
                    # Handle escaped quotes
                    field = field.replace('""', '"')
                    cleaned_fields.append(field)
                
                # Create properly formatted CSV line
                formatted_line = ','.join(f'"{field}"' for field in cleaned_fields)
                fixed_lines.append(formatted_line)
            else:
                # Not enough parts, skip this line
                print(f"Skipping malformed line {i}: {line}")
                continue
        else:
            # Try normal CSV parsing
            try:
                reader = csv.reader([line])
                row = next(reader)
                if len(row) == 5:
                    # Properly formatted row
                    formatted_line = ','.join(f'"{field}"' for field in row)
                    fixed_lines.append(formatted_line)
                else:
                    # Wrong number of fields, skip
                    print(f"Skipping line with wrong field count {i}: {line}")
                    continue
            except Exception as e:
                print(f"Error processing line {i}: {line}")
                print(f"Error: {e}")
                continue
    
    # Write fixed content
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        outfile.write('\n'.join(fixed_lines))

if __name__ == "__main__":
    fix_csv_file_v2(
        "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ.csv",
        "/Users/akimotohiroki/insects-host-plant-explorer/public/日本のキリガ_fixed_v2.csv"
    )
    print("CSV file fixed successfully with version 2!")