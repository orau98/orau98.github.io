#!/usr/bin/env python3
import csv
import io

def fix_csv_final():
    input_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_master.csv'
    output_file = '/Users/akimotohiroki/insects-host-plant-explorer/public/ListMJ_hostplants_master_final.csv'
    
    fixed_rows = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        # Read header
        header_line = f.readline().strip()
        header_cols = header_line.split(',')
        
        # Ensure header has exactly 27 columns
        if len(header_cols) == 26:
            header_cols.append('備考')
        elif len(header_cols) > 27:
            header_cols = header_cols[:27]
        
        fixed_rows.append(header_cols)
        
        # Process each line using CSV reader to handle quotes properly
        line_num = 1
        for line in f:
            line_num += 1
            line = line.strip()
            if not line:
                continue
            
            # Use CSV reader to parse the line properly
            try:
                # Create a StringIO object to simulate a file for csv.reader
                csv_input = io.StringIO(line)
                reader = csv.reader(csv_input, quotechar='"', delimiter=',')
                cols = next(reader)
            except Exception as e:
                print(f"Error parsing line {line_num}: {e}")
                # Fallback to simple split
                cols = line.split(',')
            
            # Standardize to exactly 27 columns
            if len(cols) < 27:
                # Pad with empty strings
                cols.extend([''] * (27 - len(cols)))
            elif len(cols) > 27:
                # Merge extra columns into the remarks column (index 26)
                remarks_parts = cols[26:]
                cols = cols[:26] + [','.join(remarks_parts)]
            
            fixed_rows.append(cols)
    
    # Write the properly formatted CSV
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        for row in fixed_rows:
            writer.writerow(row)
    
    print(f"Final fixed CSV saved to {output_file}")
    print(f"Processed {len(fixed_rows)-1} data rows")

if __name__ == "__main__":
    fix_csv_final()