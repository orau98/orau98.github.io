#!/usr/bin/env python3
"""Merge scientific-only hostplant names into canonical Japanese names via ylist-lite."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOSTPLANTS_PATH = ROOT / "normalized_data" / "hostplants.csv"
YLIST_LITE_PATH = ROOT / "public" / "assets" / "data-lite" / "ylist-lite.json"

JAPANESE_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
SCIENTIFIC_RE = re.compile(r"^[A-Z][a-z]+(?:\s+[a-z-]+)+(?:\s+(?:subsp\.|var\.|f\.)\s+[A-Za-z-]+.*)?$")


def clean(value: str) -> str:
    return (value or "").strip()


def normalize_scientific_name(value: str) -> str:
    normalized = re.sub(r"\s+", " ", clean(value))
    normalized = re.sub(r"\s+(?:subsp\.|var\.|f\.)\s+[A-Za-z-]+.*$", "", normalized, flags=re.IGNORECASE)
    return normalized.strip()


def is_scientific_only_name(value: str) -> bool:
    text = clean(value)
    if not text or JAPANESE_RE.search(text):
        return False
    return bool(SCIENTIFIC_RE.match(text))


def load_unique_scientific_lookup() -> dict[str, dict[str, str]]:
    with open(YLIST_LITE_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    buckets: dict[str, list[dict[str, str]]] = defaultdict(list)
    for japanese_name, detail in (payload.get("plants") or {}).items():
        scientific_name = clean((detail or {}).get("scientificName", ""))
        if not japanese_name or not scientific_name:
            continue

        family = clean((detail or {}).get("familyJp", ""))
        for alias in {scientific_name, normalize_scientific_name(scientific_name)}:
            if not alias:
                continue
            buckets[alias].append(
                {
                    "plant_name": clean(japanese_name),
                    "plant_family": family,
                }
            )

    lookup: dict[str, dict[str, str]] = {}
    for alias, entries in buckets.items():
        unique_names = {entry["plant_name"] for entry in entries if entry["plant_name"]}
        if len(unique_names) != 1:
            continue
        lookup[alias] = entries[0]
    return lookup


def dedupe_rows(rows: list[dict], fieldnames: list[str]) -> tuple[list[dict], int]:
    deduped: list[dict] = []
    seen: set[tuple[str, ...]] = set()
    for row in rows:
        key = tuple(clean(row.get(field, "")) for field in fieldnames if field != "record_id")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped, len(rows) - len(deduped)


def main() -> None:
    with open(HOSTPLANTS_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    lookup = load_unique_scientific_lookup()
    replaced = 0
    mapping_counter: Counter[tuple[str, str]] = Counter()

    for row in rows:
        plant_name = clean(row.get("plant_name", ""))
        if not is_scientific_only_name(plant_name):
            continue
        canonical = lookup.get(normalize_scientific_name(plant_name))
        if not canonical:
            continue

        row["plant_name"] = canonical["plant_name"]
        if canonical.get("plant_family"):
            row["plant_family"] = canonical["plant_family"]
        replaced += 1
        mapping_counter[(plant_name, canonical["plant_name"])] += 1

    deduped_rows, removed_duplicates = dedupe_rows(rows, fieldnames)

    with open(HOSTPLANTS_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(deduped_rows)

    print(f"[merge-scientific-hostplants] replaced rows: {replaced}")
    print(f"[merge-scientific-hostplants] removed exact duplicates: {removed_duplicates}")
    for (scientific_name, japanese_name), count in sorted(
        mapping_counter.items(),
        key=lambda item: (-item[1], item[0][0]),
    ):
        print(f"  {scientific_name} -> {japanese_name}: {count}")


if __name__ == "__main__":
    main()
