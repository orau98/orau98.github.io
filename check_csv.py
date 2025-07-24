import csv

with open('public/日本のキリガ_fixed.csv', 'r') as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        if len(row) != 5:
            print(f'Line {i+1}: {len(row)} fields - {row}')
            if i > 30:
                break