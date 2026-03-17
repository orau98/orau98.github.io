#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REFERENCE = "日本のハマキガ2"

INSECT_COLUMNS = [
    "insect_id",
    "family",
    "family_jp",
    "subfamily",
    "subfamily_jp",
    "tribe",
    "tribe_jp",
    "genus",
    "subgenus",
    "species",
    "subspecies",
    "author",
    "year",
    "japanese_name",
    "old_japanese_name",
    "alternative_name",
    "other_names",
    "scientific_name",
    "synonyms",
    "changes_since_standard",
    "notes",
]

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


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, str]], columns: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def blank_insect() -> dict[str, str]:
    return {column: "" for column in INSECT_COLUMNS}


def make_insect(
    insect_id: str,
    tribe: str,
    tribe_jp: str,
    genus: str,
    subgenus: str,
    species: str,
    author: str,
    year: str,
    japanese_name: str,
    scientific_name: str,
) -> dict[str, str]:
    row = blank_insect()
    row.update(
        {
            "insect_id": insect_id,
            "family": "Tortricidae",
            "family_jp": "ハマキガ科",
            "subfamily": "Olethreutinae",
            "subfamily_jp": "ヒメハマキガ亜科",
            "tribe": tribe,
            "tribe_jp": tribe_jp,
            "genus": genus,
            "subgenus": subgenus,
            "species": species,
            "author": author,
            "year": year,
            "japanese_name": japanese_name,
            "scientific_name": scientific_name,
        }
    )
    return row


INSECT_UPDATES = {
    "species-1942": {
        "tribe": "Gatesclarkeanini",
        "tribe_jp": "クラークヒメハマキガ族",
    },
    "species-2066": {
        "genus": "Enarmonia",
        "species": "flammeata",
        "author": "Kuznetzov",
        "year": "1971",
        "scientific_name": "Enarmonia flammeata Kuznetzov, 1971",
    },
    "species-2109": {
        "species": "microplaca",
        "author": "(Meyrick)",
        "year": "1912",
        "scientific_name": "Pseudacroclita microplaca (Meyrick, 1912)",
    },
    "species-6156": {
        "subgenus": "Microcorses",
        "species": "mirabilis",
        "author": "Kuznetzov",
        "year": "1964",
        "scientific_name": "Cryptaspasma mirabilis Kuznetzov, 1964",
    },
    "species-6157": {
        "subgenus": "Microcorses",
        "species": "sp. 1",
        "scientific_name": "Cryptaspasma sp. 1",
    },
    "species-6158": {
        "species": "negligens",
        "author": "(Diakonoff)",
        "year": "1973",
        "scientific_name": "Syntozyga negligens (Diakonoff, 1973)",
    },
    "species-6159": {
        "species": "bifurcvalva",
        "author": "Nasu & Saito",
        "year": "2021",
        "scientific_name": "Tetramoera bifurcvalva Nasu & Saito, 2021",
    },
    "species-6160": {
        "species": "sasakii",
        "author": "Nasu",
        "year": "2022",
        "scientific_name": "Tetramoera sasakii Nasu, 2022",
    },
    "species-6161": {
        "species": "shimizui",
        "author": "Nasu",
        "year": "2022",
        "scientific_name": "Semnostola shimizui Nasu, 2022",
    },
    "species-6162": {
        "species": "citharistis",
        "author": "(Meyrick)",
        "year": "1909",
        "scientific_name": "Endothenia citharistis (Meyrick, 1909)",
    },
}

NEW_INSECTS = [
    make_insect(
        "species-6163",
        "Microcorsini",
        "ハラブトヒメハマキガ族",
        "Cryptaspasma",
        "Microcorses",
        "sp. 2",
        "",
        "",
        "ニセクロサンカクモンヒメハマキ",
        "Cryptaspasma sp. 2",
    ),
    make_insect(
        "species-6164",
        "Microcorsini",
        "ハラブトヒメハマキガ族",
        "Cryptaspasma",
        "Microcorses",
        "sp. 3",
        "",
        "",
        "アマミクロサンカクモンヒメハマキ",
        "Cryptaspasma sp. 3",
    ),
    make_insect(
        "species-6165",
        "Bactrini",
        "トガリバヒメハマキガ族",
        "Endothenia",
        "",
        "sp. 4",
        "",
        "",
        "ミカエリソウヒメハマキ",
        "Endothenia sp. 4",
    ),
    make_insect(
        "species-6166",
        "Enarmoniini",
        "カギバヒメハマキガ族",
        "Ancylis",
        "",
        "sp.",
        "",
        "",
        "ホソバタテスジカギバヒメハマキ",
        "Ancylis sp.",
    ),
    make_insect(
        "species-6167",
        "Enarmoniini",
        "カギバヒメハマキガ族",
        "Pseudacroclita",
        "",
        "sp.",
        "",
        "",
        "アサダツツヒメハマキ",
        "Pseudacroclita sp.",
    ),
]

HOSTPLANT_RECORD_UPDATES = {
    "hostplant-090010": {"insect_id": "species-6164"},
    "hostplant-090011": {"insect_id": "species-6164"},
    "hostplant-090036": {"insect_id": "species-6165"},
    "hostplant-090037": {"insect_id": "species-6165"},
    "hostplant-090088": {"insect_id": "species-6167"},
    "hostplant-090044": {"plant_name": "枯葉", "plant_part": "枯葉", "notes": ""},
    "hostplant-900077": {"plant_family": "アヤメ科"},
    "hostplant-900079": {"plant_family": "リンドウ科"},
    "hostplant-900082": {"plant_family": "リンドウ科"},
    "hostplant-900083": {"plant_family": "ナデシコ科"},
    "hostplant-900092": {"plant_family": "クロウメモドキ科"},
}

HOSTPLANT_PART_BY_INSECT = {
    "species-1867": "堅果",
    "species-1868": "堅果",
    "species-1869": "実",
    "species-1870": "茎",
    "species-1871": "茎、根",
    "species-1881": "茎、根",
    "species-1882": "茎、新芽、花",
    "species-1883": "茎、新芽、花",
    "species-1885": "茎",
    "species-1886": "",
    "species-1889": "茎・地下茎",
    "species-1890": "根・地下茎",
    "species-1891": "枯れ葉",
    "species-1892": "葉、花",
    "species-1895": "新葉",
    "species-2063": "枯葉",
    "species-2065": "茎",
    "species-2066": "幼鞘",
    "species-2111": "新梢",
    "species-6156": "堅果",
    "species-6157": "堅果",
    "species-6164": "堅果",
    "species-6165": "花序軸",
    "species-6167": "葉",
}

NOTE_RECORD_UPDATES = {
    "note-200013": {"insect_id": "species-6163"},
    "note-200014": {"insect_id": "species-6164"},
    "note-200015": None,
    "note-200016": {"insect_id": "species-6164"},
    "note-200027": {"note_type": "生態情報"},
    "note-200030": {"note_type": "生態情報"},
    "note-200041": {"note_type": "生態情報"},
    "note-200082": {"insect_id": "species-6165"},
    "note-200086": {"note_type": "生態情報"},
    "note-200110": {"note_type": "生態情報"},
    "note-200116": {"note_type": "生態情報"},
    "note-200122": {"note_type": "生態情報"},
    "note-200138": {"note_type": "生態情報"},
    "note-200143": {"note_type": "生態情報"},
    "note-200170": {"note_type": "生態情報"},
    "note-200177": {"note_type": "生態情報"},
    "note-200180": {"note_type": "生態情報"},
    "note-200190": {"note_type": "生態情報"},
    "note-200193": {"note_type": "生態情報"},
    "note-200196": {"note_type": "生態情報"},
    "note-200201": {"note_type": "生態情報"},
    "note-200204": {"note_type": "生態情報"},
    "note-200212": {"insect_id": "species-6167"},
    "note-200213": {"note_type": "生態情報"},
    "note-200216": {"note_type": "生態情報"},
    "note-200219": {"note_type": "生態情報"},
}

NEW_NOTES = [
    {
        "record_id": "note-hamakiga2-fix-001",
        "insect_id": "species-6166",
        "note_type": "出現時期",
        "content": "3月-7月",
        "reference": REFERENCE,
        "page": "",
        "year": "",
    },
    {
        "record_id": "note-hamakiga2-fix-002",
        "insect_id": "species-6166",
        "note_type": "生態情報",
        "content": "年2化かもしれない",
        "reference": REFERENCE,
        "page": "",
        "year": "",
    },
]


def fix_insects(path: Path) -> None:
    rows = read_csv(path)
    by_id = {row["insect_id"]: row for row in rows}

    for insect_id, updates in INSECT_UPDATES.items():
        if insect_id in by_id:
            by_id[insect_id].update(updates)

    existing_ids = {row["insect_id"] for row in rows}
    insert_at = None
    for index, row in enumerate(rows):
        if row["insect_id"] == "species-6162":
            insert_at = index + 1
            break
    if insert_at is None:
        insert_at = len(rows)

    additions = [row for row in NEW_INSECTS if row["insect_id"] not in existing_ids]
    for offset, row in enumerate(additions):
        rows.insert(insert_at + offset, row)

    write_csv(path, rows, INSECT_COLUMNS)


def fix_hostplants(path: Path) -> None:
    rows = read_csv(path)
    for row in rows:
        record_id = row["record_id"]
        if record_id in HOSTPLANT_RECORD_UPDATES:
            row.update(HOSTPLANT_RECORD_UPDATES[record_id])
        if row["reference"] != REFERENCE:
            continue
        if row["plant_name"] in {"", "不明"}:
            continue
        new_part = HOSTPLANT_PART_BY_INSECT.get(row["insect_id"])
        if new_part is not None and new_part != "":
            row["plant_part"] = new_part
    write_csv(path, rows, HOSTPLANT_COLUMNS)


def fix_notes(path: Path) -> None:
    rows = read_csv(path)
    fixed_rows: list[dict[str, str]] = []
    seen_ids = set()
    for row in rows:
        record_id = row["record_id"]
        updates = NOTE_RECORD_UPDATES.get(record_id, ...)
        if updates is None:
            continue
        if updates is not ...:
            row.update(updates)
        fixed_rows.append(row)
        seen_ids.add(record_id)

    existing_new_ids = {row["record_id"] for row in fixed_rows}
    for row in NEW_NOTES:
        if row["record_id"] not in existing_new_ids:
            fixed_rows.append(row.copy())

    write_csv(path, fixed_rows, NOTE_COLUMNS)


def main() -> None:
    insect_targets = [
        Path("normalized_data/insects.csv"),
        Path("public/insects.csv"),
    ]
    hostplant_targets = [
        Path("normalized_data/hostplants.csv"),
        Path("public/hostplants.csv"),
    ]
    note_targets = [
        Path("normalized_data/general_notes.csv"),
        Path("public/general_notes.csv"),
    ]

    for relative in insect_targets:
        path = ROOT / relative
        if path.exists():
            fix_insects(path)

    for relative in hostplant_targets:
        path = ROOT / relative
        if path.exists():
            fix_hostplants(path)

    for relative in note_targets:
        path = ROOT / relative
        if path.exists():
            fix_notes(path)

    print("fixed 日本のハマキガ2 import issues")


if __name__ == "__main__":
    main()
