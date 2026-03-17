#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parent.parent
REFERENCE = "日本のハマキガ1"

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

PDF_PATH_CANDIDATES = [
    Path(
        "/Users/akimotohiroki/Downloads/pdf/日本のハマキガ 1　モグリヒメハマキガ族（鱗翅目,ハマキガ科,ヒメハマキガ亜科）.pdf"
    ),
    Path.home()
    / "Downloads"
    / "pdf"
    / "日本のハマキガ 1　モグリヒメハマキガ族（鱗翅目,ハマキガ科,ヒメハマキガ亜科）.pdf",
]

INSECT_UPDATES: dict[str, dict[str, str]] = {
    "species-2113": {
        "author": "(Christoph)",
        "year": "1882",
        "scientific_name": "Rhopalovalva lascivana (Christoph, 1882)",
    },
    "species-2119": {
        "genus": "Rhopalovalva",
        "species": "catharotorna",
        "author": "(Meyrick)",
        "year": "1935",
        "scientific_name": "Rhopalovalva catharotorna (Meyrick, 1935)",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Rhopalovalva 属へ復帰",
    },
    "species-2124": {
        "genus": "Fibuloides",
        "species": "algosa",
        "author": "(Meyrick)",
        "year": "1912",
        "scientific_name": "Fibuloides algosa (Meyrick, 1912)",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Fibuloides 属へ移動",
    },
    "species-2125": {
        "genus": "Kennelia",
        "species": "teliferana",
        "author": "(Christoph)",
        "year": "1882",
        "scientific_name": "Kennelia teliferana (Christoph, 1882)",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Kennelia 属へ移動",
    },
    "species-2126": {
        "genus": "Fibuloides",
        "species": "ancyrota",
        "author": "(Meyrick)",
        "year": "1907",
        "scientific_name": "Fibuloides ancyrota (Meyrick, 1907)",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Fibuloides 属へ移動",
    },
    "species-2127": {
        "genus": "Fibuloides",
        "species": "sp.",
        "author": "",
        "year": "",
        "scientific_name": "Fibuloides sp.",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Fibuloides 属へ移動",
    },
    "species-2143": {
        "author": "(Christoph)",
        "year": "1882",
        "scientific_name": "Spilonota semirufana (Christoph, 1882)",
    },
    "species-2168": {
        "author": "(Christoph)",
        "year": "1882",
        "scientific_name": "Epinotia exquisitana (Christoph, 1882)",
    },
    "species-2169": {
        "author": "(Christoph)",
        "year": "1882",
        "scientific_name": "Epinotia contrariana (Christoph, 1882)",
    },
    "species-2172": {
        "year": "1758",
        "scientific_name": "Epinotia ramella (Linnaeus, 1758)",
    },
    "species-2176": {
        "year": "1851",
        "scientific_name": "Epinotia rubiginosana (Herrich-Schaffer, 1851)",
    },
    "species-2205": {
        "year": "1851",
        "scientific_name": "Zeiraphera rufimitrana (Herrich-Schaffer, 1851)",
    },
    "species-2237": {
        "year": "1969",
        "scientific_name": "Barbara fulgens Kuznetzov, 1969",
    },
    "species-2248": {
        "species": "inconspicua",
        "scientific_name": "Epiblema inconspicua (Walsingham, 1900)",
    },
    "species-2250": {
        "species": "strenuana",
        "author": "(Walker)",
        "year": "1863",
        "scientific_name": "Epiblema strenuana (Walker, 1863)",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Epiblema sugii をシノニム整理",
    },
    "species-2251": {
        "author": "(Christoph)",
        "year": "1882",
        "scientific_name": "Epiblema expressana (Christoph, 1882)",
    },
    "species-2277": {
        "species": "lignana",
        "author": "(Snellen)",
        "year": "1883",
        "scientific_name": "Eucosma lignana (Snellen, 1883)",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1に従い Eucosma tundrana から訂正",
    },
    "species-2312": {
        "species": "sp. 1",
        "author": "",
        "year": "",
        "scientific_name": "Rhopobota sp. 1",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1では学名未定",
    },
    "species-2323": {
        "species": "sp.",
        "author": "",
        "year": "",
        "scientific_name": "‘Cosmetra’ sp.",
        "changes_since_standard": "新記録・再分類等",
        "notes": "日本のハマキガ1では所属不明として仮置き",
    },
}


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
    genus: str,
    species: str,
    author: str,
    year: str,
    japanese_name: str,
    scientific_name: str,
    changes_since_standard: str,
    notes: str,
) -> dict[str, str]:
    row = blank_insect()
    row.update(
        {
            "insect_id": insect_id,
            "family": "Tortricidae",
            "family_jp": "ハマキガ科",
            "subfamily": "Olethreutinae",
            "subfamily_jp": "ヒメハマキガ亜科",
            "tribe": "Eucosmini",
            "tribe_jp": "モグリヒメハマキガ族",
            "genus": genus,
            "species": species,
            "author": author,
            "year": year,
            "japanese_name": japanese_name,
            "scientific_name": scientific_name,
            "changes_since_standard": changes_since_standard,
            "notes": notes,
        }
    )
    return row


NEW_INSECTS = [
    make_insect(
        "species-23153",
        "Strepsicrates",
        "sp.",
        "",
        "",
        "アデクヒメハマキ",
        "Strepsicrates sp.",
        "未同定種の追加",
        "日本のハマキガ1で新称が与えられた未同定種",
    ),
    make_insect(
        "species-23154",
        "Tritopterna",
        "capyra",
        "(Meyrick)",
        "1911",
        "カンコミモグリヒメハマキ",
        "Tritopterna capyra (Meyrick, 1911)",
        "新記録・再分類等",
        "日本のハマキガ1で日本新記録",
    ),
]


def normalize_inline_text(text: str) -> str:
    text = " ".join(part.strip() for part in text.splitlines() if part.strip())
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(?<=[ぁ-んァ-ヴー一-龯々])\s+(?=[ぁ-んァ-ヴー一-龯々])", "", text)
    text = re.sub(r"(?<=[ぁ-んァ-ヴー一-龯々])\s+(?=[(（])", "", text)
    text = re.sub(r"(?<=[)）])\s+(?=[ぁ-んァ-ヴー一-龯々])", "", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = text.replace("， ", "，")
    text = text.replace("． ", "．")
    return text.strip()


def normalize_japanese_name(name: str) -> str:
    name = normalize_inline_text(name)
    name = re.sub(r"[（(]\s*新称\s*[)）]", "", name)
    return name.strip()


def parse_accounts(pdf_path: Path) -> list[dict[str, str]]:
    pdf = fitz.open(pdf_path)
    pages: list[str] = []
    for index in range(6, pdf.page_count):
        lines = pdf[index].get_text("text").splitlines()
        if lines and lines[0].strip().isdigit():
            lines = lines[1:]
        page_lines = [
            line
            for line in lines
            if line.strip() not in {"日本産モグリヒメハマキガ族", "The tribe Eucosmini of Japan"}
        ]
        pages.append("\n".join(page_lines))
    text = "\n".join(pages)
    heads = [
        (int(match.group(1)), match.start(), match.group(0).strip())
        for match in re.finditer(r"(?m)^(\d+)\.\s+[^\n]+$", text)
    ]

    accounts: list[dict[str, str]] = []
    for idx, (number, start, heading) in enumerate(heads):
        end = heads[idx + 1][1] if idx + 1 < len(heads) else len(text)
        body = text[start:end].strip()
        raw_lines = [line.strip() for line in body.splitlines() if line.strip()]
        lines: list[str] = []
        genus_heading_pattern = re.compile(
            r"^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ'’.-]+(?: [A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ'’.-]+)?, \[?\d{4}(?:-\d{2})?\]?$"
        )
        for line_index, line in enumerate(raw_lines):
            if line_index >= 2 and (
                genus_heading_pattern.fullmatch(line)
                or line == "Unassigned to genus"
                or line == "所属不明"
                or line.startswith("＊")
            ):
                break
            lines.append(line)
        body = "\n".join(lines)
        japanese_name = normalize_japanese_name(re.sub(r"\s*\(Pl\..*$", "", lines[1]))

        host_match = re.search(r"寄主植物．(.*?)(?=\n　?(?:生態|備考)．|$)", body, re.S)
        eco_match = re.search(r"生態．(.*?)(?=\n　?備考．|$)", body, re.S)
        note_match = re.search(r"備考．(.*)$", body, re.S)

        host_text = normalize_inline_text(host_match.group(1)) if host_match else ""
        eco_text = normalize_inline_text(eco_match.group(1)) if eco_match else ""
        note_text = normalize_inline_text(note_match.group(1)) if note_match else ""
        note_text = re.split(
            r"．(?=(?:[A-Z][A-Za-z'’.-]+ [A-Z][A-Za-z'’.-]+, \d{4}|Unassigned to genus|＊))",
            note_text,
            maxsplit=1,
        )[0].strip()

        accounts.append(
            {
                "number": str(number),
                "heading": re.sub(r"^\d+\.\s+", "", heading).strip(),
                "japanese_name": japanese_name,
                "host_text": host_text,
                "ecology_text": eco_text,
                "note_text": note_text,
            }
        )
    return accounts


def split_family_groups(host_text: str) -> tuple[list[tuple[str, str]], str]:
    text = host_text.strip().rstrip("．")
    groups: list[tuple[str, str]] = []
    previous_end = 0
    for match in re.finditer(r"\(([^()]+?科)\)", text):
        family = match.group(1).replace(" ", "")
        groups.append((text[previous_end : match.start()], family))
        previous_end = match.end()
    tail = text[previous_end:].strip("， ")
    return groups, tail


def extract_plant_name(segment: str) -> str:
    segment = normalize_inline_text(segment).strip("，． ")
    if not segment:
        return ""
    match = re.match(r"^([^A-Za-z(]+)", segment)
    name = match.group(1).strip() if match else segment
    return name.strip("，． ")


def parse_hostplants(host_text: str) -> tuple[list[tuple[str, str]], str]:
    raw = normalize_inline_text(host_text)
    if not raw or raw in {"未知", "未知．"}:
        return [], ""
    if raw.startswith("日本では未知") or raw.startswith("国内では未知"):
        return [], raw.rstrip("．")

    foreign_markers = ["海外では", "国外では", "ヨーロッパでは", "ロシアでは", "オーストラリアでは", "北アメリカでは"]
    split_points = [raw.find(marker) for marker in foreign_markers if raw.find(marker) > 0]
    if split_points:
        split_at = min(split_points)
        local_text = raw[:split_at].rstrip("， ")
        foreign_text = raw[split_at:].rstrip("． ")
    else:
        local_text = raw
        foreign_text = ""

    groups, tail = split_family_groups(local_text)
    plants: list[tuple[str, str]] = []
    if groups:
        for chunk, family in groups:
            for segment in [part.strip() for part in chunk.strip("， ").split("，") if part.strip()]:
                if "未知" in segment:
                    continue
                name = extract_plant_name(segment)
                if name and name not in {"未知", "日本では未知", "国内では未知"}:
                    plants.append((name, family))
    else:
        for segment in [part.strip() for part in raw.strip("， ").split("，") if part.strip()]:
            name = extract_plant_name(segment)
            if name and name not in {"未知", "日本では未知", "国内では未知"}:
                plants.append((name, ""))

    extras = [part for part in [tail.lstrip("，． ").rstrip("． "), foreign_text] if part]
    return plants, " ".join(extras).strip()


def normalize_emergence(content: str) -> str:
    content = normalize_inline_text(content)
    content = content.replace(" ", "")
    content = content.replace("～", "-")
    content = content.replace("と", ",")
    return content


def split_ecology(eco_text: str) -> tuple[str, str]:
    text = normalize_inline_text(eco_text).rstrip("． ")
    if not text:
        return "", ""

    prefix = "成虫発生時期は"
    if text.startswith(prefix):
        rest = text[len(prefix) :]
        sentence, _, remainder = rest.partition("．")
        return normalize_emergence(sentence), remainder.strip("． ")

    special = "成虫は沖縄では周年発生しているようである"
    if text.startswith(special):
        _, _, remainder = text.partition("．")
        return "周年（沖縄）", remainder.strip("． ")

    return "", text


def infer_plant_part(host_text: str, eco_text: str) -> str:
    text = normalize_inline_text(f"{host_text} {eco_text}")
    parts: list[str] = []
    for key, label in [
        ("球果", "球果"),
        ("種子", "種子"),
        ("果実", "実"),
        ("実に潜", "実"),
        ("実を付着", "実"),
        ("新梢", "新梢"),
        ("茎", "茎"),
        ("新芽", "新芽"),
        ("花", "花"),
        ("針葉", "葉"),
        ("新葉", "葉"),
        ("葉", "葉"),
    ]:
        if key in text and label not in parts:
            parts.append(label)
    return "、".join(parts)


def next_numeric_id(rows: list[dict[str, str]], column: str, prefix: str) -> int:
    numbers = []
    for row in rows:
        value = row.get(column, "")
        match = re.fullmatch(rf"{re.escape(prefix)}(\d+)", value)
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def choose_pdf_path() -> Path:
    if len(sys.argv) > 1:
        path = Path(sys.argv[1]).expanduser()
        if not path.exists():
            raise FileNotFoundError(path)
        return path
    for candidate in PDF_PATH_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("PDF path is required")


def apply_insect_updates(rows: list[dict[str, str]]) -> None:
    by_id = {row["insect_id"]: row for row in rows}
    for insect_id, updates in INSECT_UPDATES.items():
        if insect_id not in by_id:
            raise KeyError(f"missing insect row: {insect_id}")
        by_id[insect_id].update(updates)
    for new_row in NEW_INSECTS:
        if new_row["insect_id"] not in by_id:
            rows.append(new_row)


def build_hostplant_rows(
    accounts: list[dict[str, str]],
    insect_by_name: dict[str, str],
    existing_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    rows = [row for row in existing_rows if row.get("reference") != REFERENCE]
    existing_keys = {
        (
            row["insect_id"],
            row["plant_name"],
            row["plant_family"],
            row["plant_part"],
            row["life_stage"],
        )
        for row in rows
    }
    next_id = next_numeric_id(rows, "record_id", "hostplant-")

    for account in accounts:
        insect_id = insect_by_name[account["japanese_name"]]
        plants, _ = parse_hostplants(account["host_text"])
        plant_part = infer_plant_part(account["host_text"], account["ecology_text"])
        for plant_name, plant_family in plants:
            key = (insect_id, plant_name, plant_family, plant_part, "幼虫")
            if key in existing_keys:
                continue
            rows.append(
                {
                    "record_id": f"hostplant-{next_id:06d}",
                    "insect_id": insect_id,
                    "plant_name": plant_name,
                    "plant_family": plant_family,
                    "observation_type": "野外（国内）",
                    "plant_part": plant_part,
                    "life_stage": "幼虫",
                    "reference": REFERENCE,
                    "notes": "",
                }
            )
            existing_keys.add(key)
            next_id += 1
    return rows


def build_note_rows(
    accounts: list[dict[str, str]],
    insect_by_name: dict[str, str],
    existing_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    rows = [row for row in existing_rows if row.get("reference") != REFERENCE]
    existing_keys = {(row["insect_id"], row["note_type"], row["content"]) for row in rows}
    next_id = next_numeric_id(rows, "record_id", "note-")

    def append_note(insect_id: str, note_type: str, content: str) -> None:
        nonlocal next_id
        content = normalize_inline_text(content).strip("． ")
        if not content:
            return
        key = (insect_id, note_type, content)
        if key in existing_keys:
            return
        rows.append(
            {
                "record_id": f"note-{next_id}",
                "insect_id": insect_id,
                "note_type": note_type,
                "content": content,
                "reference": REFERENCE,
                "page": "",
                "year": "",
            }
        )
        existing_keys.add(key)
        next_id += 1

    for account in accounts:
        insect_id = insect_by_name[account["japanese_name"]]
        emergence, ecology = split_ecology(account["ecology_text"])
        if emergence:
            append_note(insect_id, "出現時期", emergence)
        if ecology:
            append_note(insect_id, "生態情報", ecology)

        plants, extra = parse_hostplants(account["host_text"])
        if not plants and account["host_text"].startswith(("日本では未知", "国内では未知")):
            append_note(insect_id, "生態情報", f"寄主植物は{account['host_text'].rstrip('．')}")
        elif extra:
            append_note(insect_id, "生態情報", extra)

    return rows


def main() -> None:
    pdf_path = choose_pdf_path()
    insects_path = ROOT / "normalized_data" / "insects.csv"
    public_insects_path = ROOT / "public" / "insects.csv"
    hostplants_path = ROOT / "normalized_data" / "hostplants.csv"
    notes_path = ROOT / "normalized_data" / "general_notes.csv"

    insect_rows = read_csv(insects_path)
    apply_insect_updates(insect_rows)

    accounts = parse_accounts(pdf_path)
    insect_by_name = {row["japanese_name"]: row["insect_id"] for row in insect_rows}
    missing_names = [account["japanese_name"] for account in accounts if account["japanese_name"] not in insect_by_name]
    if missing_names:
        raise KeyError(f"missing insects for accounts: {missing_names}")

    hostplant_rows = build_hostplant_rows(accounts, insect_by_name, read_csv(hostplants_path))
    note_rows = build_note_rows(accounts, insect_by_name, read_csv(notes_path))

    insect_rows.sort(key=lambda row: row["insect_id"])
    hostplant_rows.sort(key=lambda row: row["record_id"])
    note_rows.sort(key=lambda row: row["record_id"])

    write_csv(insects_path, insect_rows, INSECT_COLUMNS)
    write_csv(public_insects_path, insect_rows, INSECT_COLUMNS)
    write_csv(hostplants_path, hostplant_rows, HOSTPLANT_COLUMNS)
    write_csv(notes_path, note_rows, NOTE_COLUMNS)

    print(f"[fix_hamakiga1_import] pdf={pdf_path}")
    print(f"[fix_hamakiga1_import] insects={len(insect_rows)}")
    print(f"[fix_hamakiga1_import] hostplants={len(hostplant_rows)}")
    print(f"[fix_hamakiga1_import] notes={len(note_rows)}")


if __name__ == "__main__":
    main()
