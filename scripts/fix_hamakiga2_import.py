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
    "hostplant-090088": {"insect_id": "species-6167", "plant_part": "", "life_stage": "幼虫"},
    "hostplant-090044": {"plant_name": "枯葉", "plant_part": "枯葉", "notes": ""},
    "hostplant-900035": {"plant_part": "茎"},
    "hostplant-900043": {"plant_part": ""},
    "hostplant-900046": {"plant_part": ""},
    "hostplant-900047": {
        "plant_name": "オランダイチゴ属",
        "plant_family": "バラ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録（我が国では未知）",
    },
    "hostplant-900048": {
        "plant_name": "キイチゴ属",
        "plant_family": "バラ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録（我が国では未知）",
    },
    "hostplant-900049": {
        "plant_name": "バラ属",
        "plant_family": "バラ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録（我が国では未知）",
    },
    "hostplant-900050": {
        "plant_name": "イブキジャコウソウ属",
        "plant_family": "シソ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録（我が国では未知）",
    },
    "hostplant-900051": {
        "plant_name": "ニガクサ属",
        "plant_family": "シソ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録（我が国では未知）",
    },
    "hostplant-900052": {"observation_type": "飼育", "plant_part": "", "notes": "富永智氏飼育"},
    "hostplant-900053": {"observation_type": "飼育", "plant_part": "", "notes": "富永智氏飼育"},
    "hostplant-900054": {"plant_part": ""},
    "hostplant-900055": {"plant_part": ""},
    "hostplant-900056": {"plant_part": ""},
    "hostplant-900057": {"plant_part": ""},
    "hostplant-900058": {"plant_part": ""},
    "hostplant-900059": {"plant_part": ""},
    "hostplant-900060": {"plant_part": ""},
    "hostplant-900061": {"plant_part": ""},
    "hostplant-900062": {"plant_part": ""},
    "hostplant-900077": {
        "plant_name": "アヤメ属",
        "plant_family": "アヤメ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900078": {
        "plant_name": "イヌゴマ属",
        "plant_family": "シソ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900079": {
        "plant_name": "リンドウ属",
        "plant_family": "リンドウ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900080": {
        "plant_name": "アキノキリンソウ属",
        "plant_family": "キク科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900081": {
        "plant_name": "オオバコ属",
        "plant_family": "オオバコ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900082": {
        "plant_name": "リンドウ属",
        "plant_family": "リンドウ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900083": {
        "plant_name": "ナデシコ属",
        "plant_family": "ナデシコ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900084": {"observation_type": "飼育", "plant_part": "", "notes": "岩手県でブナから飼育"},
    "hostplant-900085": {
        "plant_name": "コナラ属",
        "plant_family": "ブナ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ロシア記録",
    },
    "hostplant-900086": {
        "plant_name": "カバノキ属",
        "plant_family": "カバノキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "国外記録",
    },
    "hostplant-900087": {
        "plant_name": "コナラ属",
        "plant_family": "ブナ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "国外記録",
    },
    "hostplant-900088": {
        "plant_name": "カルーナ属",
        "plant_family": "ツツジ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "国外記録",
    },
    "hostplant-900089": {
        "plant_name": "エリカ属",
        "plant_family": "ツツジ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "国外記録",
    },
    "hostplant-900090": {
        "plant_name": "イソノキ属",
        "plant_family": "クロウメモドキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900091": {
        "plant_name": "ヤナギ属",
        "plant_family": "ヤナギ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録",
    },
    "hostplant-900092": {
        "plant_name": "クロウメモドキ属",
        "plant_family": "クロウメモドキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録",
    },
    "hostplant-900093": {
        "plant_name": "イソノキ属",
        "plant_family": "クロウメモドキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録",
    },
    "hostplant-900094": {
        "plant_name": "キイチゴ属",
        "plant_family": "バラ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録",
    },
    "hostplant-900095": {
        "plant_name": "エリカ属",
        "plant_family": "ツツジ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900096": {
        "plant_name": "レンリソウ",
        "plant_family": "マメ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ロシア記録",
    },
    "hostplant-900097": {
        "plant_name": "サンシュユ属",
        "plant_family": "ミズキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900098": {
        "plant_name": "ヤチヤナギ属",
        "plant_family": "ヤマモモ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900099": {
        "plant_name": "イボタノキ属",
        "plant_family": "モクセイ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900100": {
        "plant_name": "スモモ属",
        "plant_family": "バラ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
    "hostplant-900101": {
        "plant_name": "Drypetes属",
        "plant_family": "ツゲモドキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "オーストラリア記録",
    },
    "hostplant-900102": {
        "plant_name": "ヤナギ属",
        "plant_family": "ヤナギ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "海外記録",
    },
    "hostplant-900103": {
        "plant_name": "スノキ属",
        "plant_family": "ツツジ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "notes": "ヨーロッパ記録",
    },
}

NEW_HOSTPLANTS = [
    {
        "record_id": "hostplant-H2-audit-001",
        "insect_id": "species-1882",
        "plant_name": "クマツヅラ属",
        "plant_family": "クマツヅラ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ヨーロッパ記録",
    },
    {
        "record_id": "hostplant-H2-audit-002",
        "insect_id": "species-1883",
        "plant_name": "ナベナ属",
        "plant_family": "スイカズラ科",
        "observation_type": "野外（国外）",
        "plant_part": "茎、新芽、花",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ヨーロッパ記録",
    },
    {
        "record_id": "hostplant-H2-audit-003",
        "insect_id": "species-2072",
        "plant_name": "カバノキ属",
        "plant_family": "カバノキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ロシア記録",
    },
    {
        "record_id": "hostplant-H2-audit-004",
        "insect_id": "species-2074",
        "plant_name": "ニレ属",
        "plant_family": "ニレ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "国外記録",
    },
    {
        "record_id": "hostplant-H2-audit-005",
        "insect_id": "species-2076",
        "plant_name": "カバノキ属",
        "plant_family": "カバノキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "国外記録",
    },
    {
        "record_id": "hostplant-H2-audit-006",
        "insect_id": "species-2078",
        "plant_name": "クロウメモドキ属",
        "plant_family": "クロウメモドキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ヨーロッパ記録",
    },
    {
        "record_id": "hostplant-H2-audit-007",
        "insect_id": "species-2087",
        "plant_name": "ヤマナラシ属",
        "plant_family": "ヤナギ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "海外記録",
    },
    {
        "record_id": "hostplant-H2-audit-008",
        "insect_id": "species-2090",
        "plant_name": "カルーナ属",
        "plant_family": "ツツジ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ヨーロッパ記録",
    },
    {
        "record_id": "hostplant-H2-audit-009",
        "insect_id": "species-2080",
        "plant_name": "クサフジ",
        "plant_family": "マメ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ロシア記録",
    },
    {
        "record_id": "hostplant-H2-audit-010",
        "insect_id": "species-2082",
        "plant_name": "ミヤコグサ属",
        "plant_family": "マメ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ヨーロッパ記録",
    },
    {
        "record_id": "hostplant-H2-audit-011",
        "insect_id": "species-2092",
        "plant_name": "クロウメモドキ属",
        "plant_family": "クロウメモドキ科",
        "observation_type": "野外（国外）",
        "plant_part": "",
        "life_stage": "幼虫",
        "reference": REFERENCE,
        "notes": "ヨーロッパ記録",
    },
]

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
    "species-6167": "",
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
    existing_ids = {row["record_id"] for row in rows}
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
    for row in NEW_HOSTPLANTS:
        if row["record_id"] not in existing_ids:
            rows.append(row.copy())
            existing_ids.add(row["record_id"])
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
