#!/usr/bin/env python3

import csv
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
REPORT_JSON = BASE / "reports" / "zukan2_missing_emergence_boxes.json"
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"
APPLY_REPORT_JSON = BASE / "reports" / "zukan2_missing_emergence_boxes_apply_report.json"
REFERENCE = "日本産蛾類標準図鑑2"

MANUAL_OVERRIDES = {
    "species-4852": {"content": "6月と7～8月", "page": "26"},
    "species-5349": {"content": "6～10月", "page": "62"},
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
    report_rows = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
    notes = load_notes()

    existing_keys = {
        (
            row["insect_id"],
            row["note_type"],
            row.get("content", ""),
            row.get("reference", ""),
        )
        for row in notes
    }
    existing_emergence_ids = {
        row["insect_id"]
        for row in notes
        if row["note_type"] == "出現時期"
    }

    id_gen = next_note_id(notes)
    additions = []
    skipped = []

    for row in report_rows:
        insect_id = row["insect_id"]
        if insect_id in existing_emergence_ids:
            skipped.append({"reason": "already_has_emergence", "insect_id": insect_id, "name": row["name"]})
            continue

        override = MANUAL_OVERRIDES.get(insect_id)
        if override:
            content = override["content"]
            page = override["page"]
            source = "manual_crop"
        elif row.get("candidate_emergence") and row.get("anchor_match_kind") == "exact":
            content = row["candidate_emergence"]
            page = row.get("page", "")
            source = "boxes_exact"
        else:
            skipped.append(
                {
                    "reason": "not_safe_enough",
                    "insect_id": insect_id,
                    "name": row["name"],
                    "candidate": row.get("candidate_emergence", ""),
                    "anchor_match_kind": row.get("anchor_match_kind", ""),
                }
            )
            continue

        key = (insect_id, "出現時期", content, REFERENCE)
        if key in existing_keys:
            skipped.append({"reason": "duplicate", "insect_id": insect_id, "name": row["name"], "content": content})
            continue

        additions.append(
            {
                "record_id": next(id_gen),
                "insect_id": insect_id,
                "note_type": "出現時期",
                "content": content,
                "reference": REFERENCE,
                "page": str(page),
                "year": "",
                "_source": source,
            }
        )
        existing_keys.add(key)

    if additions:
        merged = sort_notes(notes + [{k: v for k, v in row.items() if not k.startswith("_")} for row in additions])
        with NOTES_CSV.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["record_id", "insect_id", "note_type", "content", "reference", "page", "year"],
            )
            writer.writeheader()
            writer.writerows(merged)

    APPLY_REPORT_JSON.write_text(
        json.dumps(
            {
                "reference": REFERENCE,
                "added_count": len(additions),
                "skipped_count": len(skipped),
                "added_preview": additions[:50],
                "skipped_preview": skipped[:100],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"added={len(additions)} skipped={len(skipped)}")
    print(f"wrote {APPLY_REPORT_JSON.relative_to(BASE)}")


if __name__ == "__main__":
    main()
