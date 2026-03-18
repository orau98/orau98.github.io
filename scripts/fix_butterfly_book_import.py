#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REFERENCE = "日本産蝶類標準図鑑"
REPORT_PATH = ROOT / "reports" / "butterfly_book_audit_report.json"

HOSTPLANT_COLUMNS = [
    "record_id",
    "insect_id",
    "plant_name",
    "plant_family",
    "observation_type",
    "plant_part",
    "life_stage",
    "reference",
    "notes",
]

NOTE_COLUMNS = [
    "record_id",
    "insect_id",
    "note_type",
    "content",
    "reference",
    "page",
    "year",
]

BUTTERFLY_FAMILIES = {
    "アゲハチョウ科",
    "シロチョウ科",
    "タテハチョウ科",
    "シジミチョウ科",
    "セセリチョウ科",
}

MISSING_HOSTPLANTS = {
    "species-20432": [
        ("イネ", "イネ科"),
        ("ススキ", "イネ科"),
        ("アシ", "イネ科"),
        ("ヨシ", "イネ科"),
        ("ジュズダマ", "イネ科"),
        ("マコモ", "イネ科"),
    ],
}

MISSING_NOTES = {
    "species-20287": "食草は不明。マメ科のクロヨナの可能性が高い。",
    "species-20340": "食草は不明。国外ではスミレ科が記録される。",
    "species-20391": "食草は不明。国外ではガガイモ科が記録される。",
    "species-20402": "食草は不明。国外ではアカネ科が記録される。",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, str]], columns: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def max_record_number(rows: list[dict[str, str]], prefix: str) -> int:
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    max_id = 0
    for row in rows:
        record_id = row.get("record_id", "")
        match = pattern.match(record_id)
        if match:
            max_id = max(max_id, int(match.group(1)))
    return max_id


def next_record_id(prefix: str, counter: int) -> str:
    return f"{prefix}{counter:06d}"


def main() -> None:
    insects_path = ROOT / "normalized_data" / "insects.csv"
    hostplants_path = ROOT / "normalized_data" / "hostplants.csv"
    notes_path = ROOT / "normalized_data" / "general_notes.csv"

    insects = read_csv(insects_path)
    hostplants = read_csv(hostplants_path)
    notes = read_csv(notes_path)

    insects_by_id = {row["insect_id"]: row for row in insects}

    removed_hostplants: list[str] = []
    clean_hostplants: list[dict[str, str]] = []
    for row in hostplants:
        if row.get("reference") != REFERENCE:
            clean_hostplants.append(row)
            continue
        family_jp = insects_by_id.get(row["insect_id"], {}).get("family_jp", "")
        if family_jp not in BUTTERFLY_FAMILIES:
            removed_hostplants.append(row["record_id"])
            continue
        clean_hostplants.append(row)
    hostplants = clean_hostplants

    removed_notes: list[str] = []
    clean_notes: list[dict[str, str]] = []
    for row in notes:
        if row.get("reference") != REFERENCE:
            clean_notes.append(row)
            continue
        family_jp = insects_by_id.get(row["insect_id"], {}).get("family_jp", "")
        if family_jp not in BUTTERFLY_FAMILIES:
            removed_notes.append(row["record_id"])
            continue
        clean_notes.append(row)
    notes = clean_notes

    hostplant_counter = max_record_number(hostplants, "hostplant-")
    note_counter = max_record_number(notes, "note-")

    existing_hostplant_keys = {
        (
            row["insect_id"],
            row["plant_name"],
            row.get("plant_family", ""),
            row.get("life_stage", ""),
            row.get("reference", ""),
        )
        for row in hostplants
    }
    existing_note_keys = {
        (
            row["insect_id"],
            row["note_type"],
            row["content"],
            row["reference"],
        )
        for row in notes
    }

    added_hostplants: list[str] = []
    for insect_id, plants in MISSING_HOSTPLANTS.items():
        for plant_name, plant_family in plants:
            key = (insect_id, plant_name, plant_family, "幼虫", REFERENCE)
            if key in existing_hostplant_keys:
                continue
            hostplant_counter += 1
            row = {
                "record_id": next_record_id("hostplant-", hostplant_counter),
                "insect_id": insect_id,
                "plant_name": plant_name,
                "plant_family": plant_family,
                "observation_type": "",
                "plant_part": "",
                "life_stage": "幼虫",
                "reference": REFERENCE,
                "notes": "",
            }
            hostplants.append(row)
            existing_hostplant_keys.add(key)
            added_hostplants.append(row["record_id"])

    added_notes: list[str] = []
    for insect_id, content in MISSING_NOTES.items():
        key = (insect_id, "生態情報", content, REFERENCE)
        if key in existing_note_keys:
            continue
        note_counter += 1
        row = {
            "record_id": next_record_id("note-", note_counter),
            "insect_id": insect_id,
            "note_type": "生態情報",
            "content": content,
            "reference": REFERENCE,
            "page": "",
            "year": "",
        }
        notes.append(row)
        existing_note_keys.add(key)
        added_notes.append(row["record_id"])

    write_csv(hostplants_path, hostplants, HOSTPLANT_COLUMNS)
    write_csv(notes_path, notes, NOTE_COLUMNS)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(
            {
                "reference": REFERENCE,
                "removed_hostplants": removed_hostplants,
                "removed_notes": removed_notes,
                "added_hostplants": added_hostplants,
                "added_notes": added_notes,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "removed_hostplants": len(removed_hostplants),
                "removed_notes": len(removed_notes),
                "added_hostplants": len(added_hostplants),
                "added_notes": len(added_notes),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
