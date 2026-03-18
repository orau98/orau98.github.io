#!/usr/bin/env python3

import csv
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"
REPORT_JSON = BASE / "reports" / "zukan2_manual_emergence_overrides_report.json"
REFERENCE = "日本産蛾類標準図鑑2"

UPSERTS = {
    "species-4734": {"name": "クロミャクホソバ", "content": "7～8月", "page": "17"},
    "species-4741": {"name": "ウスキシタホソバ", "content": "7～8月", "page": "17"},
    "species-4991": {"name": "フタテンアツバ", "content": "4～10月", "page": "38"},
    "species-5131": {"name": "トガリアツバ", "content": "5～9月、翌春にも得られる", "page": "46"},
    "species-5144": {"name": "フタコブスジアツバ", "content": "6～9月、春にも得られる", "page": "47"},
    "species-5219": {"name": "キマダラアツバ", "content": "5～8月", "page": "52"},
    "species-5224": {"name": "ウスマダラアツバ", "content": "4～6月と7～8月", "page": "52"},
    "species-5236": {"name": "ヨシノツマキリアツバ", "content": "6～8月", "page": "53"},
    "species-5238": {"name": "ツマジロツマキリアツバ", "content": "5～9月", "page": "53"},
    "species-5301": {"name": "ヒメツマオビアツバ", "content": "本州中部山地では7～8月、温暖地では6～9月", "page": "58"},
    "species-5348": {"name": "ウスエグリバ", "content": "6～7月と8～9月", "page": "62"},
    "species-5390": {"name": "オオシロシタバ", "content": "7月中旬～10月下旬", "page": "65"},
    "species-5392": {"name": "ベニシタバ", "content": "7月上旬～10月中旬", "page": "65"},
    "species-5414": {"name": "キシタバ", "content": "8月上旬～10月下旬", "page": "65"},
    "species-5456": {"name": "ホソオビアシブトクチバ", "content": "3～11月", "page": "70"},
    "species-5663": {"name": "シロガ", "content": "6～10月", "page": "87"},
    "species-5755": {"name": "マイコトラガ", "content": "8月", "page": "95"},
    "species-5930": {"name": "コゴマヨトウ", "content": "8～10月", "page": "110"},
}

NORMALIZE_EXISTING = {
    "species-4785": {"from": "ほぼ周年", "to": "一年中"},
    "species-5447": {"from": "ほぼ周年", "to": "一年中"},
    "species-5540": {"from": "ほぼ周年", "to": "一年中"},
}


def load_notes():
    with NOTES_CSV.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def next_note_id(rows):
    max_id = 0
    for row in rows:
        match = re.match(r"note-(\d+)$", row["record_id"])
        if match:
            max_id = max(max_id, int(match.group(1)))
    while True:
        max_id += 1
        yield f"note-{max_id:07d}"


def sort_notes(rows):
    return sorted(
        rows,
        key=lambda row: (
            row.get("insect_id", ""),
            row.get("note_type", ""),
            row.get("record_id", ""),
        ),
    )


def main():
    rows = load_notes()
    id_gen = next_note_id(rows)

    updated = []
    added = []
    skipped = []

    for row in rows:
        spec = NORMALIZE_EXISTING.get(row["insect_id"])
        if not spec:
            continue
        if row["note_type"] != "出現時期" or row.get("reference") != REFERENCE:
            continue
        if row.get("content") == spec["from"]:
            row["content"] = spec["to"]
            updated.append(
                {
                    "record_id": row["record_id"],
                    "insect_id": row["insect_id"],
                    "content": row["content"],
                }
            )

    existing_by_insect = {}
    for row in rows:
        if row["note_type"] == "出現時期" and row.get("reference") == REFERENCE:
            existing_by_insect[row["insect_id"]] = row

    for insect_id, spec in UPSERTS.items():
        existing = existing_by_insect.get(insect_id)
        if existing:
            if existing.get("content") != spec["content"] or existing.get("page") != spec["page"]:
                existing["content"] = spec["content"]
                existing["page"] = spec["page"]
                updated.append(
                    {
                        "record_id": existing["record_id"],
                        "insect_id": insect_id,
                        "content": existing["content"],
                    }
                )
            else:
                skipped.append({"insect_id": insect_id, "name": spec["name"], "reason": "already_up_to_date"})
            continue

        new_row = {
            "record_id": next(id_gen),
            "insect_id": insect_id,
            "note_type": "出現時期",
            "content": spec["content"],
            "reference": REFERENCE,
            "page": spec["page"],
            "year": "",
        }
        rows.append(new_row)
        existing_by_insect[insect_id] = new_row
        added.append({"record_id": new_row["record_id"], "insect_id": insect_id, **spec})

    with NOTES_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["record_id", "insect_id", "note_type", "content", "reference", "page", "year"],
        )
        writer.writeheader()
        writer.writerows(sort_notes(rows))

    REPORT_JSON.write_text(
        json.dumps(
            {
                "reference": REFERENCE,
                "updated_count": len(updated),
                "added_count": len(added),
                "skipped_count": len(skipped),
                "updated": updated,
                "added": added,
                "skipped": skipped,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"updated={len(updated)} added={len(added)} skipped={len(skipped)}")
    print(f"wrote {REPORT_JSON.relative_to(BASE)}")


if __name__ == "__main__":
    main()
