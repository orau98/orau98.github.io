#!/usr/bin/env python3
"""Taxonomy / hostplant cleanup based on the repository-wide audit.

This script does three things:
1. Remaps linked data from stale synonym / typo insect rows to accepted rows.
2. Normalizes polluted `scientific_name` / `author` / `year` fields.
3. Cleans sentence-like hostplant rows that created bad plant pages.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INSECTS_CSV = ROOT / "normalized_data" / "insects.csv"
HOSTPLANTS_CSV = ROOT / "normalized_data" / "hostplants.csv"
GENERAL_NOTES_CSV = ROOT / "normalized_data" / "general_notes.csv"

JP_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
LATIN_RE = re.compile(r"[A-Z][a-z]+")
YEAR_RE = re.compile(r"\[?\d{4}\]?")


INSECT_ID_REMAP = {
    # Older placeholder / synonym rows that should resolve to accepted rows already present.
    "species-20796": "species-0993",
    "species-20823": "species-0910",
    "species-20826": "species-0912",
    "species-20839": "species-0940",
    "species-20843": "species-0946",
    "species-20859": "species-0964",
    "species-20966": "species-1623",
    "species-20971": "species-1629",
    "species-20975": "species-1634",
    "species-21659": "species-6116",
}

DELETE_INSECT_IDS = {
    *INSECT_ID_REMAP.keys(),
    # Synonym rows with no linked data.
    "species-21807",  # Agrilus nakanei / A. ohmomoi -> Agrilus yamabusi row already exists.
    "species-22080",  # Leptepania japonica -> Leptepania minuta japonica row already exists.
}

HOSTPLANT_DELETIONS = {
    "hostplant-005533",  # family-level note only
    "hostplant-901766",
    "hostplant-901767",
    "hostplant-901772",
    "hostplant-901850",  # merged into hostplant-901849
    "hostplant-906040",
    "hostplant-907676",
    "hostplant-907768",
    "hostplant-907770",
    "hostplant-907771",
    "hostplant-907811",
    "hostplant-908292",
}

HOSTPLANT_UPDATES = {
    "hostplant-003569": {
        "plant_name": "イネ",
        "plant_family": "イネ科",
        "notes_append": "原文: イネの害虫として有名",
    },
    "hostplant-005696": {
        "plant_name": "ハギカズラ",
        "notes_append": "原文: ハギカズラ（国外ではイソマツ科も記録）",
    },
    "hostplant-900283": {
        "plant_name": "カジイチゴ",
        "plant_family": "バラ科",
        "notes_append": "記録は疑わしい",
    },
    "hostplant-901849": {
        "plant_name": "ウシハコベ",
        "plant_family": "ナデシコ科",
        "notes_append": "欧州での記録、日本では5月に幼虫確認",
    },
    "hostplant-901981": {
        "plant_name": "アカザ",
        "notes_append": "未確認",
    },
    "hostplant-902285": {
        "plant_name": "ゴボウ",
        "plant_family": "キク科",
        "notes_append": "西日本ではゴボウのみ",
    },
    "hostplant-902286": {
        "plant_name": "オケラ",
        "notes_append": "北日本ではオケラ",
    },
    "hostplant-905882": {
        "plant_name": "ダケカンバ",
        "plant_family": "カバノキ科",
        "notes": "食草として確認",
    },
    "hostplant-905883": {
        "plant_name": "ダケカンバ",
        "plant_family": "カバノキ科",
        "notes": "食草として確認",
    },
    "hostplant-905884": {
        "plant_name": "ミズキ",
        "plant_family": "ミズキ科",
        "notes": "食草として確認",
    },
    "hostplant-905885": {
        "plant_name": "タニウツギ",
        "plant_family": "スイカズラ科",
        "notes": "食草として確認",
    },
    "hostplant-905886": {
        "plant_name": "カワラハンノキ",
        "plant_family": "カバノキ科",
        "notes": "食草として確認",
    },
    "hostplant-905887": {
        "plant_name": "コケモモ",
        "plant_family": "ツツジ科",
        "notes": "食草として確認",
    },
    "hostplant-905888": {
        "plant_name": "ノゲシ",
        "plant_family": "キク科",
        "notes": "食草として確認",
    },
    "hostplant-905895": {
        "plant_name": "ウンシュウミカン",
        "plant_family": "ミカン科",
        "notes": "新寄主植物として記録",
    },
    "hostplant-905959": {
        "plant_name": "トキワイカリソウ",
        "notes": "食草として記録",
    },
    "hostplant-905960": {
        "plant_name": "トリアシショウマ",
        "plant_family": "ユキノシタ科",
        "notes": "原文: アカリ、トリアシショウマを食草として記録",
    },
    "hostplant-905961": {
        "plant_name": "ホウチャクソウ",
        "plant_family": "イヌサフラン科",
        "notes": "食草として記録",
    },
    "hostplant-905972": {
        "plant_name": "ツゲ",
        "plant_family": "ツゲ科",
        "notes": "食草として岐阜県から記録",
    },
    "hostplant-905986": {
        "plant_name": "アカギ",
        "plant_family": "トウダイグサ科",
        "notes_append": "大発生、奄美大島で初記録",
    },
    "hostplant-906034": {
        "plant_name": "キールンカンコノキ",
        "plant_family": "コミカンソウ科",
        "notes": "食草として確認",
    },
    "hostplant-907643": {
        "plant_name": "イヌビワ",
        "plant_family": "クワ科",
        "plant_part": "葉",
    },
    "hostplant-908434": {
        "plant_name": "ヌルデ",
        "plant_family": "ウルシ科",
        "notes_append": "原文: インドではヌルデ",
    },
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def append_unique(existing: str, extra: str, sep: str = " / ") -> str:
    extra = (extra or "").strip()
    existing = (existing or "").strip()
    if not extra:
        return existing
    if not existing:
        return extra
    parts = [part.strip() for part in existing.split(sep) if part.strip()]
    if extra in parts:
        return existing
    return existing + sep + extra


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def split_scientific_name(text: str) -> tuple[str, list[str]]:
    text = normalize_spaces(text)
    if not text:
        return "", []

    primary, *rest = [part.strip() for part in re.split(r"[;；]+", text) if part.strip()]
    extras = [part for part in rest if part]

    m = JP_RE.search(primary)
    if m:
        jp_tail = primary[m.start():].strip(" ,")
        primary = primary[:m.start()].rstrip(" ,")
        if jp_tail:
            extras.insert(0, jp_tail)

    primary = primary.rstrip(" ,;；")
    return primary, extras


def sanitize_author_year(row: dict[str, str], cleaned_scientific_name: str) -> None:
    author = normalize_spaces(row.get("author", ""))
    year = normalize_spaces(row.get("year", ""))

    if author:
        author = re.split(r"[;；]", author, maxsplit=1)[0].strip()
        m = JP_RE.search(author)
        if m:
            author = author[:m.start()].rstrip(" ,")

    if not year:
        source = " ".join(part for part in [row.get("author", ""), row.get("year", ""), cleaned_scientific_name] if part)
        m = YEAR_RE.search(source)
        if m:
            year = m.group(0)

    if author and year:
        author = author.replace(f", {year}", "")
        author = author.replace(f",{year}", "")
        author = author.replace(f" {year}", "")

    author = author.strip(" ,")

    row["author"] = author
    row["year"] = year


def classify_extra(extra: str) -> str:
    if not extra:
        return "skip"
    if LATIN_RE.search(extra) or any(keyword in extra for keyword in (
        "とされていた",
        "基亜種",
        "復活",
        "CPC",
        "タイプロカリティ",
        "New synonyms",
        "記載",
    )):
        return "changes"
    if JP_RE.search(extra):
        return "name"
    return "note"


def normalize_insects() -> None:
    headers, rows = read_csv(INSECTS_CSV)

    rows = [row for row in rows if row["insect_id"] not in DELETE_INSECT_IDS]

    # Fill missing classification from surviving rows with the same genus.
    genus_classification: dict[str, tuple[str, str, str, str, str, str]] = {}
    ambiguous_genera: set[str] = set()
    for row in rows:
        genus = normalize_spaces(row.get("genus", ""))
        family = normalize_spaces(row.get("family", ""))
        if not genus or not family:
            continue
        value = (
            family,
            normalize_spaces(row.get("family_jp", "")),
            normalize_spaces(row.get("subfamily", "")),
            normalize_spaces(row.get("subfamily_jp", "")),
            normalize_spaces(row.get("tribe", "")),
            normalize_spaces(row.get("tribe_jp", "")),
        )
        existing = genus_classification.get(genus)
        if existing and existing != value:
            ambiguous_genera.add(genus)
        else:
            genus_classification[genus] = value

    for row in rows:
        insect_id = row["insect_id"]
        if insect_id == "species-21459":
            row["japanese_name"] = row["japanese_name"].rstrip(")")

        cleaned, extras = split_scientific_name(row.get("scientific_name", ""))
        if cleaned:
            row["scientific_name"] = cleaned
        sanitize_author_year(row, cleaned)

        for extra in extras:
            kind = classify_extra(extra)
            if kind == "changes":
                row["changes_since_standard"] = append_unique(row.get("changes_since_standard", ""), extra)
            elif kind == "name":
                row["other_names"] = append_unique(row.get("other_names", ""), extra)
            elif kind == "note":
                row["notes"] = append_unique(row.get("notes", ""), extra)

        genus = normalize_spaces(row.get("genus", ""))
        if not normalize_spaces(row.get("family", "")) and genus and genus not in ambiguous_genera and genus in genus_classification:
            family, family_jp, subfamily, subfamily_jp, tribe, tribe_jp = genus_classification[genus]
            row["family"] = family
            row["family_jp"] = family_jp
            row["subfamily"] = subfamily
            row["subfamily_jp"] = subfamily_jp
            row["tribe"] = tribe
            row["tribe_jp"] = tribe_jp

    write_csv(INSECTS_CSV, headers, rows)


def remap_and_dedupe(path: Path) -> None:
    headers, rows = read_csv(path)
    out: list[dict[str, str]] = []
    seen: set[tuple[str, ...]] = set()
    for row in rows:
        insect_id = row.get("insect_id", "")
        if insect_id in INSECT_ID_REMAP:
            row["insect_id"] = INSECT_ID_REMAP[insect_id]
        key = tuple((row.get(header, "") or "").strip() for header in headers)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    write_csv(path, headers, out)


def normalize_hostplants() -> None:
    headers, rows = read_csv(HOSTPLANTS_CSV)
    out: list[dict[str, str]] = []
    seen: set[tuple[str, ...]] = set()

    for row in rows:
        record_id = row["record_id"]
        row["insect_id"] = INSECT_ID_REMAP.get(row["insect_id"], row["insect_id"])
        if record_id in HOSTPLANT_DELETIONS:
            continue

        update = HOSTPLANT_UPDATES.get(record_id)
        if update:
            if "plant_name" in update:
                row["plant_name"] = update["plant_name"]
            if "plant_family" in update:
                row["plant_family"] = update["plant_family"]
            if "plant_part" in update:
                row["plant_part"] = update["plant_part"]
            if "notes" in update:
                row["notes"] = update["notes"]
            if "notes_append" in update:
                row["notes"] = append_unique(row.get("notes", ""), update["notes_append"])

        key = tuple((row.get(header, "") or "").strip() for header in headers)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)

    write_csv(HOSTPLANTS_CSV, headers, out)


def normalize_general_notes() -> None:
    headers, rows = read_csv(GENERAL_NOTES_CSV)
    out: list[dict[str, str]] = []
    seen: set[tuple[str, ...]] = set()
    for row in rows:
        row["insect_id"] = INSECT_ID_REMAP.get(row["insect_id"], row["insect_id"])
        key = tuple((row.get(header, "") or "").strip() for header in headers)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    write_csv(GENERAL_NOTES_CSV, headers, out)


def main() -> None:
    normalize_insects()
    normalize_hostplants()
    normalize_general_notes()
    remap_and_dedupe(HOSTPLANTS_CSV)
    remap_and_dedupe(GENERAL_NOTES_CSV)
    print("Applied taxonomy audit cleanup.")


if __name__ == "__main__":
    main()
