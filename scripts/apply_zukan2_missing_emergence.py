#!/usr/bin/env python3

import csv
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
AUDIT_JSON = BASE / "reports" / "zukan2_missing_notes_audit.json"
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"
REPORT_JSON = BASE / "reports" / "zukan2_missing_emergence_apply_report.json"
REFERENCE = "日本産蛾類標準図鑑2"

MIN_SCORE = 3
EXCLUDED_NAMES = {
    "アメリカシロヒトリ",
}
MANUAL_OVERRIDES = {
    "クニガミスゲドクガ": "4～5月と11月",
}


def load_notes():
    with NOTES_CSV.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    return rows


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


def normalize_content(row):
    name = row["name"]
    if name in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[name]

    content = row["candidate_emergence"]
    block = row.get("ocr_block", "")

    if content.endswith("から") and re.search(r"ほ.?周年", block):
        return f"{content}、ほぼ周年"

    region_match = re.search(r"沖縄では通年[^\n。]*本州では([0-9～月]+)", block)
    if region_match:
        return f"沖縄では通年、本州では{region_match.group(1)}"

    return content


def main():
    audit_rows = json.loads(AUDIT_JSON.read_text(encoding="utf-8"))
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

    for row in audit_rows:
        if not row.get("candidate_emergence"):
            continue
        if row.get("match_score", -1) < MIN_SCORE:
            skipped.append({"reason": "low_score", "name": row["name"], "score": row["match_score"]})
            continue
        if row["name"] in EXCLUDED_NAMES:
            skipped.append({"reason": "excluded_name", "name": row["name"], "score": row["match_score"]})
            continue
        if row["insect_id"] in existing_emergence_ids:
            skipped.append({"reason": "already_has_emergence", "name": row["name"], "score": row["match_score"]})
            continue
        if re.search(r"(\d{1,2})～\1月", row.get("ocr_block", "")):
            skipped.append({"reason": "ocr_same_range", "name": row["name"], "score": row["match_score"]})
            continue

        content = normalize_content(row)
        key = (row["insect_id"], "出現時期", content, REFERENCE)
        if key in existing_keys:
            skipped.append({"reason": "duplicate", "name": row["name"], "score": row["match_score"]})
            continue

        additions.append(
            {
                "record_id": next(id_gen),
                "insect_id": row["insect_id"],
                "note_type": "出現時期",
                "content": content,
                "reference": REFERENCE,
                "page": str(row.get("page", "")),
                "year": "",
            }
        )
        existing_keys.add(key)

    if additions:
        merged = sort_notes(notes + additions)
        with NOTES_CSV.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["record_id", "insect_id", "note_type", "content", "reference", "page", "year"],
            )
            writer.writeheader()
            writer.writerows(merged)

    REPORT_JSON.write_text(
        json.dumps(
            {
                "reference": REFERENCE,
                "min_score": MIN_SCORE,
                "added_count": len(additions),
                "skipped_count": len(skipped),
                "added_preview": additions[:20],
                "skipped_preview": skipped[:50],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"added={len(additions)} skipped={len(skipped)}")
    print(f"wrote {REPORT_JSON.relative_to(BASE)}")


if __name__ == "__main__":
    main()
