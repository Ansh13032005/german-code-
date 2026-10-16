#!/usr/bin/env python3
"""
Inspect Unit Test Folder
Extracts all embedded media, dumps text paragraphs, and shows relationships
from .docx files in any unit folder (e.g., Unit 1, Unit 2, ...).

Usage:
    python scripts/inspect_unit.py "Unit wise test/Unit wise test/Unit 2"
    python scripts/inspect_unit.py 2
"""

import sys
import os
import glob
import zipfile
import xml.etree.ElementTree as ET

def inspect_unit(unit_arg):
    if os.path.exists(unit_arg):
        unit_dir = unit_arg
    else:
        # Check if number passed
        candidate = f"Unit wise test/Unit wise test/Unit {unit_arg}"
        if os.path.exists(candidate):
            unit_dir = candidate
        else:
            print(f"Error: Directory not found: {unit_arg}")
            sys.exit(1)

    print("=" * 60)
    print(f"INSPECTING UNIT FOLDER: {unit_dir}")
    print("=" * 60)

    files = sorted(os.listdir(unit_dir))
    docx_files = [f for f in files if f.endswith('.docx')]
    mp3_files = [f for f in files if f.endswith('.mp3')]
    other_files = [f for f in files if not f.endswith('.docx') and not f.endswith('.mp3')]

    print(f"\n[Audio Files ({len(mp3_files)})]:")
    for a in mp3_files:
        size = os.path.getsize(os.path.join(unit_dir, a))
        print(f"  - {a} ({size:,} bytes)")

    print(f"\n[Word Documents ({len(docx_files)})]:")
    for d in docx_files:
        size = os.path.getsize(os.path.join(unit_dir, d))
        print(f"  - {d} ({size:,} bytes)")

    if other_files:
        print(f"\n[Other Files ({len(other_files)})]:")
        for o in other_files:
            print(f"  - {o}")

    # Inspect each docx
    for doc_name in docx_files:
        doc_path = os.path.join(unit_dir, doc_name)
        print("\n" + "-" * 60)
        print(f"DOCUMENT DETAILS: {doc_name}")
        print("-" * 60)
        try:
            with zipfile.ZipFile(doc_path, 'r') as z:
                # Find images
                media = [m for m in z.namelist() if m.startswith('word/media/')]
                print(f"Embedded images in {doc_name} ({len(media)}):")
                for m in sorted(media):
                    print(f"   -> {m} ({z.getinfo(m).file_size:,} bytes)")

                # Parse document.xml for text
                if 'word/document.xml' in z.namelist():
                    doc_tree = ET.fromstring(z.read('word/document.xml'))
                    print("\nDocument Text Preview (first 15 paragraphs):")
                    count = 0
                    for p in doc_tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                        texts = [t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
                        line = "".join(texts).strip()
                        if line:
                            count += 1
                            if count <= 15:
                                print(f"   [{count:02d}] {line}")
                    if count > 15:
                        print(f"   ... and {count - 15} more paragraphs.")
        except Exception as e:
            print(f"Error reading {doc_name}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/inspect_unit.py <unit_number_or_path>")
        print("Example: python scripts/inspect_unit.py 2")
        sys.exit(1)
    inspect_unit(sys.argv[1])
