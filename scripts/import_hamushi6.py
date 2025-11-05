#!/usr/bin/env python3
"""
Integrate data from tmp/hamushi6.csv into public hostplants/general_notes.
- Adds host plant records when食草 is provided.
- Adds general notes for emergence/larval remarks.
- Writes unmatched species to reports/unmatched_hamushi6.csv.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


ROOT = Path(__file__).resolve().parent.parent
INPUT_CSV = ROOT / "tmp" / "hamushi6.csv"
INSECTS_CSV = ROOT / "public" / "insects.csv"
HOSTPLANTS_CSV = ROOT / "public" / "hostplants.csv"
NOTES_CSV = ROOT / "public" / "general_notes.csv"
UNMATCHED_REPORT = ROOT / "reports" / "unmatched_hamushi6.csv"
REFERENCE = "日本産ハムシ科生態覚書 (6)"


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


def clean_scientific_name(name: str) -> str:
    return normalize_spaces(name.replace('"', "")) if name else ""


def parse_insects(csv_path: Path) -> Tuple[Dict[str, InsectRow], Dict[str, str]]:
    rows: Dict[str, InsectRow] = {}
    ja_map: Dict[str, str] = {}
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
    return rows, ja_map


def split_name_variants(raw: str) -> List[str]:
    if not raw:
        return []
    raw = raw.replace("／", "、")
    parts = re.split(r"[、,;；]", raw)
    return [normalize_japanese_name(p) for p in parts if normalize_japanese_name(p)]


def build_scientific_map(insects: Iterable[InsectRow]) -> Dict[str, List[str]]:
    mapping: Dict[str, List[str]] = {}
    for insect in insects:
        sci = insect.scientific_name
        if not sci:
            continue
        key_full = clean_scientific_name(sci)
        if key_full:
            mapping.setdefault(key_full, []).append(insect.insect_id)
        key = extract_genus_species(sci)
        if key:
            mapping.setdefault(key, []).append(insect.insect_id)
    return mapping


def extract_genus_species(scientific: str) -> str:
    if not scientific:
        return ""
    cleaned = re.sub(r"\([^)]*\)", "", scientific)
    tokens = cleaned.strip().split()
    if len(tokens) < 2:
        return ""
    return f"{tokens[0]} {tokens[1]}"


def load_hostplant_lookup(csv_path: Path) -> Tuple[Dict[str, str], Dict[str, str], int]:
    name_to_family: Dict[str, str] = {}
    existing_keys: Dict[str, str] = {}
    max_id = 0
    with csv_path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            record_id = row["record_id"]
            insect_id = row["insect_id"]
            plant_name = row["plant_name"]
            reference = row.get("reference", "")
            family = row.get("plant_family", "")
            key = "|".join([insect_id, plant_name, reference])
            existing_keys[key] = record_id
            if plant_name and family and plant_name not in name_to_family:
                name_to_family[plant_name] = family
            m = re.match(r"hostplant-(\d+)", record_id or "")
            if m:
                max_id = max(max_id, int(m.group(1)))
    return name_to_family, existing_keys, max_id


def load_general_note_lookup(csv_path: Path) -> Tuple[Dict[str, str], int]:
    existing: Dict[str, str] = {}
    max_id = 0
    with csv_path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            record_id = row["record_id"]
            insect_id = row["insect_id"]
            note_type = row["note_type"]
            content = row["content"]
            reference = row.get("reference", "")
            key = "|".join([insect_id, note_type, content, reference])
            existing[key] = record_id
            m = re.match(r"note-(\d+)", record_id or "")
            if m:
                max_id = max(max_id, int(m.group(1)))
    return existing, max_id


def next_hostplant_id(value: int) -> Iterable[str]:
    cur = value
    while True:
        cur += 1
        yield f"hostplant-{cur:06d}"


def next_note_id(value: int) -> Iterable[str]:
    cur = value
    while True:
        cur += 1
        yield f"note-{cur:06d}"


def split_hostplants(raw: str) -> List[str]:
    if not raw or raw.strip() in {"", "不明", "不詳"}:
        return []
    raw = raw.replace("。", "、").replace("，", "、")
    tokens: List[str] = []
    current: List[str] = []
    depth = 0
    for ch in raw:
        if ch in "（(":
            depth += 1
            current.append(ch)
        elif ch in "）)":
            if depth > 0:
                depth -= 1
            current.append(ch)
        elif ch in "、,，;/；／" and depth == 0:
            token = "".join(current).strip()
            if token:
                tokens.append(token)
            current = []
        else:
            current.append(ch)
    token = "".join(current).strip()
    if token:
        tokens.append(token)
    cleaned: List[str] = []
    for token in tokens:
        t = token.strip()
        if not t or t in {"-", "－"}:
            continue
        t = re.sub(r"など(?:の.*)?$", "", t)
        t = re.sub(r"[（(].*?科[)）]", "", t)
        t = re.sub(r"[（(][^)）]*[)）]", "", t)
        t = t.strip()
        if not t:
            continue
        if t.startswith(("幼虫は", "成虫は", "老熟", "蛹は")):
            continue
        cleaned.append(t)
    seen: set[str] = set()
    result: List[str] = []
    for item in cleaned:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


PLANT_PART_RULES: List[Tuple[str, str]] = [
    ("堅果", "堅果"),
    ("種子", "種子"),
    ("実", "果実"),
    ("果", "果実"),
    ("花序", "花序"),
    ("穂", "穂"),
    ("花", "花"),
    ("蕾", "蕾"),
    ("芽", "新芽"),
    ("新葉", "新芽"),
    ("若い葉", "若葉"),
    ("葉柄", "葉柄"),
    ("葉内", "葉"),
    ("葉面", "葉"),
    ("葉上", "葉"),
    ("葉", "葉"),
    ("茎部", "茎"),
    ("茎内", "茎"),
    ("茎", "茎"),
    ("根際", "根"),
    ("根部", "根"),
    ("根元", "根"),
    ("根に", "根"),
    ("根を", "根"),
    ("地下茎", "根"),
    ("根", "根"),
]


def infer_plant_part(text: str) -> str:
    if not text:
        return ""
    for keyword, part in PLANT_PART_RULES:
        if keyword in text:
            return part
    return ""


def infer_life_stage(*texts: str) -> str:
    seen: List[str] = []
    for text in texts:
        if not text:
            continue
        if "幼虫" in text and "幼虫" not in seen:
            seen.append("幼虫")
        if "成虫" in text and "成虫" not in seen:
            seen.append("成虫")
        if "蛹" in text and "蛹" not in seen:
            seen.append("蛹")
        if "卵" in text and "卵" not in seen:
            seen.append("卵")
    if not seen:
        return ""
    return "・".join(seen)


def join_notes(parts: Sequence[str]) -> str:
    filtered: List[str] = []
    for p in parts:
        if not p:
            continue
        if p in {"不明", "不詳"}:
            continue
        filtered.append(p)
    content = " / ".join(filtered)
    return content.strip()


def find_insect_id(ja_name: str, sci_name: str, ja_map: Dict[str, str], sci_map: Dict[str, List[str]]) -> Optional[str]:
    if ja_name and ja_name in ja_map:
        return ja_map[ja_name]
    sci_clean = clean_scientific_name(sci_name)
    if sci_clean and sci_clean in sci_map:
        options = sci_map[sci_clean]
        if len(options) == 1:
            return options[0]
    genus_key = extract_genus_species(sci_clean)
    if genus_key and genus_key in sci_map:
        options = sci_map[genus_key]
        if len(options) == 1:
            return options[0]
    return None


def main() -> None:
    if not INPUT_CSV.exists():
        raise SystemExit("Input tmp/hamushi6.csv not found")

    insects, ja_map = parse_insects(INSECTS_CSV)
    sci_map = build_scientific_map(insects.values())
    name_to_family, existing_host_keys, host_max = load_hostplant_lookup(HOSTPLANTS_CSV)
    existing_notes, note_max = load_general_note_lookup(NOTES_CSV)

    host_id_iter = next_hostplant_id(host_max)
    note_id_iter = next_note_id(note_max)

    new_host_rows: List[List[str]] = []
    new_note_rows: List[List[str]] = []
    unmatched: List[Tuple[str, str]] = []

    with INPUT_CSV.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            ja_name = normalize_japanese_name(row.get("和名", "") or "")
            sci_name = row.get("学名", "") or ""
            host_field = row.get("食草", "") or ""
            larval = normalize_spaces(row.get("幼生期", "") or "")
            adult = normalize_spaces(row.get("成虫出現時期", "") or "")
            remarks = normalize_spaces(row.get("備考", "") or "")

            insect_id = find_insect_id(ja_name, sci_name, ja_map, sci_map)
            if not insect_id:
                unmatched.append((ja_name, sci_name))
                continue

            host_names = split_hostplants(host_field)
            for plant in host_names:
                reference = REFERENCE
                key = "|".join([insect_id, plant, reference])
                if key in existing_host_keys:
                    continue
                record_id = next(host_id_iter)
                family = name_to_family.get(plant, "")
                plant_part = infer_plant_part(f"{larval} {remarks}")
                life_stage = infer_life_stage(larval, remarks)
                notes_text = join_notes([larval, remarks])
                new_host_rows.append(
                    [
                        record_id,
                        insect_id,
                        plant,
                        family,
                        "文献",
                        plant_part,
                        life_stage,
                        reference,
                        notes_text,
                    ]
                )
                existing_host_keys[key] = record_id

            if adult and adult not in {"不明", "不詳"}:
                key = "|".join([insect_id, "出現時期", adult, REFERENCE])
                if key not in existing_notes:
                    record_id = next(note_id_iter)
                    new_note_rows.append(
                        [record_id, insect_id, "出現時期", adult, REFERENCE, "", ""]
                    )
                    existing_notes[key] = record_id

            for text in [larval, remarks]:
                if not text or text in {"不明", "不詳"}:
                    continue
                key = "|".join([insect_id, "生態情報", text, REFERENCE])
                if key in existing_notes:
                    continue
                record_id = next(note_id_iter)
                new_note_rows.append(
                    [record_id, insect_id, "生態情報", text, REFERENCE, "", ""]
                )
                existing_notes[key] = record_id

    if new_host_rows:
        with HOSTPLANTS_CSV.open("a", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh, lineterminator="\n")
            for row in new_host_rows:
                writer.writerow(row)

    if new_note_rows:
        with NOTES_CSV.open("a", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh, lineterminator="\n")
            for row in new_note_rows:
                writer.writerow(row)

    if unmatched:
        UNMATCHED_REPORT.parent.mkdir(parents=True, exist_ok=True)
        with UNMATCHED_REPORT.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh, lineterminator="\n")
            writer.writerow(["和名", "学名"])
            writer.writerows(unmatched)

    summary = [
        f"hostplants added: {len(new_host_rows)}",
        f"general notes added: {len(new_note_rows)}",
        f"unmatched species: {len(unmatched)}",
    ]
    print("\n".join(summary))


if __name__ == "__main__":
    main()
