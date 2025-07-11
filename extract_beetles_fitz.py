#!/usr/bin/env python3
import fitz  # PyMuPDF
import re
import csv
import sys

def extract_beetle_data(pdf_path):
    """Extract beetle data from PDF using PyMuPDF"""
    beetle_data = []
    
    try:
        pdf_document = fitz.open(pdf_path)
        
        print(f"PDF has {len(pdf_document)} pages")
        
        all_text = ""
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            text = page.get_text()
            all_text += text + "\n"
            
            # Print progress every 10 pages
            if (page_num + 1) % 10 == 0:
                print(f"Processed {page_num + 1} pages...")
        
        pdf_document.close()
        
        print(f"Total text length: {len(all_text)} characters")
        
        # Save extracted text for manual review
        with open('/Users/akimotohiroki/insects-host-plant-explorer/beetle_text_extract.txt', 'w', encoding='utf-8') as text_file:
            text_file.write(all_text)
        
        print("Full text saved to beetle_text_extract.txt for manual review")
        
        # Look for species entries with more comprehensive patterns
        lines = all_text.split('\n')
        
        # Look for lines containing both scientific and Japanese names
        species_entries = []
        current_entry = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Look for scientific names (Genus species)
            scientific_match = re.search(r'([A-Z][a-z]+)\s+([a-z]+)', line)
            
            # Look for Japanese names ending with タマムシ patterns
            japanese_match = re.search(r'([ァ-ヶー]+(?:タマムシ|ムシ))', line)
            
            # Look for host plant information
            host_match = re.search(r'(?:食草|寄主|宿主)[:：]?\s*([^。\n]+)', line)
            
            if scientific_match:
                genus = scientific_match.group(1)
                species = scientific_match.group(2)
                print(f"Found scientific name: {genus} {species}")
                
            if japanese_match:
                japanese_name = japanese_match.group(1)
                print(f"Found Japanese name: {japanese_name}")
                
            if host_match:
                host_plants = host_match.group(1)
                print(f"Found host plants: {host_plants}")
        
        # Print first 2000 characters to see structure
        print("\n=== First 2000 characters of extracted text ===")
        print(all_text[:2000])
        print("=== End of sample ===\n")
        
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []
    
    return beetle_data

if __name__ == "__main__":
    pdf_path = "/Users/akimotohiroki/insects-host-plant-explorer/public/日本産タマムシ大図鑑_compressed.pdf"
    beetle_data = extract_beetle_data(pdf_path)