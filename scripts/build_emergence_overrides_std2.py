#!/usr/bin/env python3
"""
Build public/emergence_overrides_std2.csv from the 日本産蛾類標準図鑑2 emergence datasets.
Combines tmp/moth_emergence_notes_book2.csv and tmp/moth_emergence_notes_book2_additions_fixed.csv,
normalises species against public/insects.csv, and writes unmatched records to reports/unmatched_emergence_std2.csv.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


ROOT = Path(__file__).resolve().parent.parent
INSECTS_CSV = ROOT / "public" / "insects.csv"
OUTPUT_CSV = ROOT / "public" / "emergence_overrides_std2.csv"
UNMATCHED_REPORT = ROOT / "reports" / "unmatched_emergence_std2.csv"
INPUT_FILES = [
    ROOT / "tmp" / "moth_emergence_notes_book2.csv",
    ROOT / "tmp" / "moth_emergence_notes_book2_additions_fixed.csv",
]


@dataclass
class InsectRow:
    insect_id: str
    japanese_name: str
    old_name: str
    alternative_names: Sequence[str]
    other_names: Sequence[str]
    scientific_name: str


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def normalize_japanese_name(name: str) -> str:
    out = name.strip()
    out = re.sub(r"[（(]新称[)）]", "", out)
    out = re.sub(r"[（(]仮称[)）]", "", out)
    return out.strip()


def split_name_variants(raw: str) -> List[str]:
    if not raw:
        return []
    raw = raw.replace("／", "、")
    parts = re.split(r"[、,;；]", raw)
    return [normalize_japanese_name(p) for p in parts if normalize_japanese_name(p)]


def clean_scientific_name(name: str) -> str:
    return normalize_spaces(name.replace('"', "")) if name else ""


def parse_insects(csv_path: Path) -> Tuple[Dict[str, InsectRow], Dict[str, str], Dict[str, List[str]]]:
    rows: Dict[str, InsectRow] = {}
    ja_map: Dict[str, str] = {}
    sci_map: Dict[str, List[str]] = {}
    with csv_path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            insect_id = row["insect_id"].strip()
            japanese = normalize_japanese_name(row["japanese_name"] or "")
            old = normalize_japanese_name(row.get("old_japanese_name", "") or "")
            alt_raw = row.get("alternative_name", "") or ""
            other_raw = row.get("other_names", "") or ""
            scientific = clean_scientific_name(row.get("scientific_name", "") or "")
            alternatives = split_name_variants(alt_raw)
            other_names = split_name_variants(other_raw)
            insect = InsectRow(
                insect_id=insect_id,
                japanese_name=japanese,
                old_name=old,
                alternative_names=alternatives,
                other_names=other_names,
                scientific_name=scientific,
            )
            rows[insect_id] = insect
            for key in filter(None, {japanese, old} | set(alternatives) | set(other_names)):
                ja_map.setdefault(key, insect_id)
            if scientific:
                sci_map.setdefault(scientific, []).append(insect_id)
                genus_key = extract_genus_species(scientific)
                if genus_key:
                    sci_map.setdefault(genus_key, []).append(insect_id)
    return rows, ja_map, sci_map


def extract_genus_species(scientific: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", scientific or "")
    tokens = cleaned.strip().split()
    if len(tokens) < 2:
        return ""
    return f"{tokens[0]} {tokens[1]}"


def clean_text(text: str) -> str:
    if text is None:
        return ""
    t = text.strip().strip('"')
    t = t.replace('""', '"')
    t = t.replace("\u3000", " ")
    return t.strip()


def find_insect_id(
    ja_name: str,
    sci_name: str,
    ja_map: Dict[str, str],
    sci_map: Dict[str, List[str]],
) -> Optional[str]:
    if ja_name and ja_name in ja_map:
        return ja_map[ja_name]
    sci_clean = clean_scientific_name(sci_name)
    if sci_clean and sci_clean in sci_map:
        candidates = sci_map[sci_clean]
        if len(candidates) == 1:
            return candidates[0]
    genus_key = extract_genus_species(sci_clean)
    if genus_key and genus_key in sci_map:
        candidates = sci_map[genus_key]
        if len(candidates) == 1:
            return candidates[0]
    return None


def unique_append(values: List[str], new_value: str) -> None:
    new_value = new_value.strip()
    if not new_value:
        return
    if new_value not in values:
        values.append(new_value)


def main() -> None:
    insects, ja_map, sci_map = parse_insects(INSECTS_CSV)
    records: Dict[str, Dict[str, object]] = {}
    unmatched: List[Tuple[str, str]] = []

    for input_path in INPUT_FILES:
        if not input_path.exists():
            continue
        with input_path.open(encoding="utf-8") as fh:
            reader = csv.reader(fh)
            header_skipped = False
            for row in reader:
                if not header_skipped:
                    header_skipped = True
                    continue
                if not row:
                    continue
                if len(row) < 3:
                    continue
                ja_name_raw = clean_text(row[0])
                sci_parts = row[1:-2]
                if sci_parts:
                    sci_name_raw = clean_text(",".join(sci_parts))
                else:
                    sci_name_raw = clean_text(row[1])
                period = clean_text(row[-2]) if len(row) >= 2 else ""
                note = clean_text(row[-1]) if len(row) >= 1 else ""
                ja_name = normalize_japanese_name(ja_name_raw)
                insect_id = find_insect_id(ja_name, sci_name_raw, ja_map, sci_map)
                if not insect_id:
                    unmatched.append((ja_name_raw, sci_name_raw))
                    continue
                insect = insects[insect_id]
                entry = records.setdefault(
                    insect_id,
                    {
                        "japanese_name": insect.japanese_name or ja_name_raw,
                        "scientific_name": insect.scientific_name or sci_name_raw,
                        "periods": [],
                        "notes": [],
                    },
                )
                if period:
                    unique_append(entry["periods"], period)
                if note:
                    unique_append(entry["notes"], note)

    rows_out: List[Tuple[str, str, str, str]] = []
    for data in records.values():
        periods = " / ".join(data["periods"])
        notes = " / ".join(data["notes"])
        rows_out.append(
            (
                data["japanese_name"],
                data["scientific_name"],
                periods,
                notes,
            )
        )

    rows_out.sort(key=lambda item: item[0])

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(["和名", "学名", "成虫発生時期", "備考"])
        writer.writerows(rows_out)

    if unmatched:
        UNMATCHED_REPORT.parent.mkdir(parents=True, exist_ok=True)
        with UNMATCHED_REPORT.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh, lineterminator="\n")
            writer.writerow(["和名", "学名"])
            writer.writerows(unmatched)

    print(
        "records written:",
        len(rows_out),
        "| unmatched:",
        len(unmatched),
    )


if __name__ == "__main__":
    main()
