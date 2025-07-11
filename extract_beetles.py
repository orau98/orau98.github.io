#!/usr/bin/env python3
import PyPDF2
import re
import csv
import sys

def extract_beetle_data(pdf_path):
    """Extract beetle data from PDF"""
    beetle_data = []
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            print(f"PDF has {len(pdf_reader.pages)} pages")
            
            all_text = ""
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                all_text += text + "\n"
                
                # Print progress every 10 pages
                if (page_num + 1) % 10 == 0:
                    print(f"Processed {page_num + 1} pages...")
            
            print(f"Total text length: {len(all_text)} characters")
            
            # Look for species entries - common patterns in taxonomic texts
            # This is a basic pattern - may need refinement based on actual PDF structure
            species_pattern = r'([A-Z][a-z]+)\s+([a-z]+)\s+([^。\n]+?)(?:食草|寄主|宿主)[:：]?\s*([^。\n]+)'
            
            matches = re.findall(species_pattern, all_text, re.MULTILINE)
            print(f"Found {len(matches)} potential species entries")
            
            # Also look for Japanese names pattern
            japanese_pattern = r'([ァ-ヶー]+(?:タマムシ|ナガタマムシ|ヒメタマムシ))\s+([A-Z][a-z]+\s+[a-z]+)\s*([^。\n]*(?:食草|寄主)[^。\n]*)'
            
            japanese_matches = re.findall(japanese_pattern, all_text, re.MULTILINE)
            print(f"Found {len(japanese_matches)} Japanese name entries")
            
            # Save extracted text for manual review
            with open('/Users/akimotohiroki/insects-host-plant-explorer/beetle_text_extract.txt', 'w', encoding='utf-8') as text_file:
                text_file.write(all_text)
            
            print("Full text saved to beetle_text_extract.txt for manual review")
            
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []
    
    return beetle_data

if __name__ == "__main__":
    pdf_path = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本産タマムシ大図鑑_compressed.pdf"
    beetle_data = extract_beetle_data(pdf_path)