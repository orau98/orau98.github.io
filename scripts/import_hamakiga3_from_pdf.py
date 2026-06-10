#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from io import StringIO
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REFERENCE = "日本のハマキガ3"
SOURCE_URL = "https://publ.moth.jp/special/vol27sup1.pdf"

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
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]], columns: list[str]) -> None:
    keep_bom = path.name in {"insects.csv", "general_notes.csv"}
    encoding = "utf-8-sig" if keep_bom else "utf-8"
    with path.open("w", encoding=encoding, newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(rows)


def write_csv_preserving_existing_lines(
    path: Path,
    added_rows: list[dict[str, str]],
    columns: list[str],
    reference: str,
) -> None:
    """Remove rows for one reference while preserving byte-level formatting of existing rows."""
    if not path.exists():
        write_csv(path, added_rows, columns)
        return

    raw = path.read_bytes()
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    lines = text.splitlines(keepends=True)
    if not lines:
        write_csv(path, added_rows, columns)
        return

    reference_index = columns.index("reference")
    kept = [lines[0]]
    for line in lines[1:]:
        row_text = line.rstrip("\r\n")
        if not row_text:
            kept.append(line)
            continue
        try:
            parsed = next(csv.reader([row_text]))
        except csv.Error:
            kept.append(line)
            continue
        if len(parsed) > reference_index and parsed[reference_index].strip() == reference:
            continue
        kept.append(line)

    eol = "\r\n" if text.count("\r\n") >= text.count("\n") - text.count("\r\n") else "\n"
    if kept and not kept[-1].endswith(("\n", "\r")):
        kept[-1] += eol

    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator=eol)
    writer.writerows(added_rows)
    output = "".join(kept) + buffer.getvalue()
    path.write_bytes((b"\xef\xbb\xbf" if has_bom else b"") + output.encode("utf-8"))


def compact_japanese_spaces(value: str) -> str:
    previous = None
    while previous != value:
        previous = value
        value = re.sub(
            r"(?<=[\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])",
            "",
            value,
        )
    value = re.sub(r"\s+([（(])", r"\1", value)
    return value


def clean_text(value: str) -> str:
    value = value.replace("\f", " ")
    value = compact_japanese_spaces(value)
    value = re.sub(r"\s+", " ", value)
    return (
        value.replace(" ，", "，")
        .replace(" ．", "．")
        .replace("（ ", "（")
        .replace(" ）", "）")
        .strip()
    )


def normalize_body(text: str) -> str:
    text = re.sub(r"寄\s*主\s*植\s*物\s*．", "寄主植物．", text)
    text = re.sub(r"生\s*態\s*．", "生態．", text)
    text = re.sub(r"備\s*考\s*．", "備考．", text)
    return text


def cut_section_noise(value: str) -> str:
    lines: list[str] = []
    for line in value.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^[A-Z][A-Za-z-]+\s+[A-Z][^。．\n]{0,80}$", stripped):
            break
        if stripped in {
            "補遺",
            "Addenda",
            "所属不明",
            "Unassigned to genus",
            "カギバヒメハマキガ族",
            "モグリヒメハマキガ族",
        }:
            break
        lines.append(stripped)
    return "\n".join(lines)


def extract_between(block: str, label: str, end_labels: list[str]) -> str:
    start = block.find(label)
    if start < 0:
        return ""
    start += len(label)
    stops = [block.find(end, start) for end in end_labels if block.find(end, start) >= 0]
    end = min(stops) if stops else len(block)
    return clean_text(cut_section_noise(block[start:end]))


def parse_entries(raw_text: str) -> list[dict[str, str | int]]:
    pages = raw_text.split("\f")
    body = normalize_body("\f".join(pages[13:79]))
    heading_re = re.compile(r"(?m)^\s*(\d{1,3})\.?\s+([^\n]*[A-Za-z][^\n]*)$")
    headings: list[tuple[int, int, int, str]] = []
    for match in heading_re.finditer(body):
        species_no = int(match.group(1))
        scientific_line = re.sub(r"(?<=\d)\.$", "", match.group(2).strip())
        if 1 <= species_no <= 180 and re.match(r"[‘'A-Z][A-Za-z‘’'\-]+\s+", scientific_line):
            headings.append((match.start(), match.end(), species_no, scientific_line))

    entries: list[dict[str, str | int]] = []
    for index, (_, heading_end, species_no, scientific_line) in enumerate(headings):
        block_end = headings[index + 1][0] if index + 1 < len(headings) else len(body)
        block = body[heading_end:block_end]
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        japanese_line = next(
            (
                line
                for line in lines
                if not line.startswith("(")
                and re.search(r"[\u3040-\u30ff\u3400-\u9fff]", line)
            ),
            lines[0],
        )
        japanese_name = re.sub(r"\s*\(.*", "", compact_japanese_spaces(japanese_line))
        japanese_name = japanese_name.replace("（新称）", "").replace("(新称)", "").strip()
        entries.append(
            {
                "number": species_no,
                "scientific_name": scientific_line,
                "japanese_name": japanese_name,
                "host_text": extract_between(block, "寄主植物．", ["生態．", "備考．"]),
                "ecology_text": extract_between(block, "生態．", ["備考．"]),
            }
        )

    missing = [number for number in range(1, 181) if number not in {int(e["number"]) for e in entries}]
    if missing:
        raise RuntimeError(f"Failed to parse species entries: missing {missing}")
    return entries


def normalize_lookup(value: str) -> str:
    value = compact_japanese_spaces(value or "")
    value = value.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", value).strip()


def scientific_core(value: str) -> str:
    value = normalize_lookup(value).replace("‘", "").replace("’", "").replace("'", "")
    match = re.match(r"([A-Z][A-Za-z-]+)\s+([a-z][a-z-]+|sp\.?)(?:\s|$)", value)
    if not match:
        return ""
    return f"{match.group(1)} {match.group(2).replace('.', '')}".lower()


def tribe_for_number(number: int) -> tuple[str, str]:
    if number == 175:
        return "Enarmoniini", "カギバヒメハマキガ族"
    if number >= 176:
        return "Eucosmini", "モグリヒメハマキガ族"
    return "Olethreutini", "ヒメハマキガ族"


def parse_scientific_name(scientific_name: str) -> dict[str, str]:
    clean = re.sub(r"(?<=\d)\.$", "", scientific_name.strip())
    match = re.match(r"([A-Z][A-Za-z-]+)\s+([a-z][a-z-]+|sp\.?)(.*)$", clean)
    if not match:
        return {"genus": "", "species": "", "author": "", "year": ""}
    genus, species, rest = match.groups()
    rest = rest.strip()
    if species in {"sp", "sp."}:
        species = "sp."
        rest = ""
    year_match = re.search(r"(\d{4})", rest)
    return {
        "genus": genus,
        "species": species,
        "author": rest,
        "year": year_match.group(1) if year_match else "",
    }


def blank_insect() -> dict[str, str]:
    return {column: "" for column in INSECT_COLUMNS}


def make_insect(insect_id: str, entry: dict[str, str | int]) -> dict[str, str]:
    scientific = str(entry["scientific_name"])
    parts = parse_scientific_name(scientific)
    tribe, tribe_jp = tribe_for_number(int(entry["number"]))
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
            "genus": parts["genus"],
            "species": parts["species"],
            "author": parts["author"],
            "year": parts["year"],
            "japanese_name": str(entry["japanese_name"]),
            "scientific_name": scientific,
            "notes": f"{REFERENCE}で掲載",
        }
    )
    return row


LEADING_CONTEXT_PATTERNS = [
    r"^ヨーロッパでは",
    r"^ロシアでは",
    r"^国外では",
    r"^海外では",
    r"^HOSTSでは",
    r"^中国では",
    r"^台湾では",
    r"^インドでは",
    r"^東南アジアでは",
    r"^北アメリカでは",
    r"^我が国では",
    r"^日本では",
    r"^国内では",
]

SKIP_HOST_TOKEN_PATTERNS = [
    r"記録されている",
    r"再検討",
    r"らしい",
    r"まれ",
    r"疑問",
    r"可能性",
    r"移った",
    r"得られている",
    r"よると",
    r"食さなかった",
    r"かもしれない",
    r"幼虫",
    r"成虫",
]


def normalize_host_token(token: str) -> str:
    token = compact_japanese_spaces(token.strip(" ．.、，;；"))
    for pattern in LEADING_CONTEXT_PATTERNS:
        token = re.sub(pattern, "", token)
    token = re.sub(r"^(?:および|及び|また|さらに)\s*", "", token)
    token = re.sub(r"^(?:幼虫は)?与えられた", "", token)
    token = re.sub(r"^.*?では(?=[\u30A0-\u30FF\u3040-\u309F\u4E00-\u9FFF])", "", token)
    token = re.split(r"\s*(?:[A-Z][a-zA-Z×.-]+|[A-Z]\.)", token, maxsplit=1)[0]
    token = token.strip(" ．.、，;；")
    token = re.sub(r"[（(]\s*[）)]", "", token).strip()
    token = token.strip("）)")
    token = re.sub(r"など様々な植物を摂食する$|など様々な植物$|などの植物$|など$|の各種$", "", token).strip()
    return token.strip(" ．.、，;；")


def should_skip_host_name(name: str) -> bool:
    if not name or name in {"未知", "不明"}:
        return True
    if not re.search(r"[\u3040-\u30ff\u3400-\u9fff]", name):
        return True
    if re.fullmatch(r"[0-9０-９（）()，,・\s]+", name):
        return True
    return any(re.search(pattern, name) for pattern in SKIP_HOST_TOKEN_PATTERNS)


def parse_hostplants(host_text: str) -> list[dict[str, str]]:
    if not host_text or re.fullmatch(r"(未知|不明)[．.]?", host_text):
        return []
    rows: list[dict[str, str]] = []

    def flush(pending: list[str], family: str, note: str = "") -> None:
        family = compact_japanese_spaces(family.strip())
        for token in pending:
            name = normalize_host_token(token)
            if should_skip_host_name(name):
                continue
            rows.append({"plant_name": name, "plant_family": family, "notes": note})
        pending.clear()

    for sentence in [s.strip() for s in re.split(r"[．。]", host_text) if s.strip()]:
        if re.search(r"再検討を要する|疑問", sentence):
            continue
        is_foreign = any(re.search(pattern, sentence) for pattern in LEADING_CONTEXT_PATTERNS)
        notes = "海外記録" if is_foreign else ""
        for pattern in LEADING_CONTEXT_PATTERNS:
            sentence = re.sub(pattern, "", sentence)
        sentence = re.sub(r"^，", "", sentence)
        sentence = re.sub(r"広食性[（(]", "", sentence).strip()

        pending: list[str] = []
        for token in [t.strip() for t in re.split(r"[、，,；;]", sentence) if t.strip()]:
            families = re.findall(r"[（(]([^（）()]*科)[）)]", token)
            family = families[-1] if families else ""
            token_without_family = re.sub(r"[（(][^（）()]*科[^（）()]*[）)]", "", token).strip()
            if not family:
                family_prefix = re.match(r"^([^、，,；;]*科)の(.+)$", token_without_family)
                if family_prefix:
                    family = family_prefix.group(1)
                    token_without_family = family_prefix.group(2)
            pending.append(token_without_family)
            if family:
                flush(pending, family, notes)
        flush(pending, "", notes)

    deduped: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        key = (row["plant_name"], row["plant_family"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


PLANT_PART_KEYWORDS = [
    "尾状花序",
    "花序",
    "新芽",
    "新葉",
    "新梢",
    "幼鞘",
    "葉鞘",
    "針葉",
    "葉",
    "蕾",
    "枝先",
    "枝",
    "花床",
    "種子",
    "果実",
    "実",
    "花",
    "茎",
    "根",
    "球果",
    "堅果",
    "虫こぶ",
    "果柄",
    "芽",
]


def infer_plant_part(ecology_text: str) -> str:
    compact = "".join(ecology_text.split())
    parts = [keyword for keyword in PLANT_PART_KEYWORDS if keyword in compact]
    for broad, specific in [("葉", "新葉"), ("葉", "針葉"), ("芽", "新芽"), ("枝", "枝先")]:
        if broad in parts and specific in parts:
            parts.remove(broad)
    return "、".join(parts[:4])


def split_sentences(text: str) -> list[str]:
    return [sentence.strip(" ．.") for sentence in re.split(r"[．。]", text) if sentence.strip()]


def normalize_note_text(text: str) -> str:
    text = compact_japanese_spaces(text)
    text = text.replace("〜", "-").replace("～", "-").replace("，", "、")
    text = re.sub(
        r"(?<=[\u3040-\u30ff\u3400-\u9fff])\s+[0-9]{1,3}\s+(?=[\u3040-\u30ff\u3400-\u9fff])",
        "",
        text,
    )
    text = re.sub(r"(?<=\d)\s+(?=[\u3040-\u30ff\u3400-\u9fff])", "", text)
    text = re.sub(r"。[0-9]{1,3}$", "", text)
    text = re.sub(r"^[0-9]{1,3}$", "", text)
    text = re.sub(r"\s*-\s*", "-", text)
    return re.sub(r"\s+", " ", text).strip(" ．.")


def extract_emergence_note(ecology_text: str) -> tuple[str, str]:
    sentences = split_sentences(ecology_text)
    for sentence in sentences:
        if "成虫" not in sentence:
            continue
        content = sentence
        replacements = [
            (r"^成虫発生時期は", ""),
            (r"^成虫は", ""),
            (r"^我が国では、?成虫が", ""),
            (r"^我が国では，?成虫が", ""),
        ]
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
        content = re.sub(r"に(?:採集されている|採れている|得られている|見られる|出現する|発生する|羽化している)$", "", content)
        content = re.sub(r"まで見られる$", "まで", content)
        return normalize_note_text(content), sentence
    return "", ""


def extract_ecology_note(ecology_text: str, emergence_sentence: str) -> str:
    sentences = split_sentences(ecology_text)
    kept: list[str] = []
    for sentence in sentences:
        if sentence == emergence_sentence:
            continue
        normalized = normalize_note_text(sentence)
        if not normalized:
            continue
        if normalized.startswith("幼生期については"):
            continue
        kept.append(normalized)
    return normalize_note_text("。".join(kept))


def build_indexes(insect_rows: list[dict[str, str]]) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    by_japanese: dict[str, dict[str, str]] = {}
    by_scientific: dict[str, dict[str, str]] = {}
    by_core: dict[str, dict[str, str]] = {}
    for row in insect_rows:
        japanese = normalize_lookup(row.get("japanese_name", "")).replace(" ", "")
        scientific = normalize_lookup(row.get("scientific_name", ""))
        core = scientific_core(scientific)
        if japanese and japanese not in by_japanese:
            by_japanese[japanese] = row
        if scientific and scientific not in by_scientific:
            by_scientific[scientific] = row
        if core and core not in by_core:
            by_core[core] = row
    return by_japanese, by_scientific, by_core


def match_entry(
    entry: dict[str, str | int],
    by_japanese: dict[str, dict[str, str]],
    by_scientific: dict[str, dict[str, str]],
    by_core: dict[str, dict[str, str]],
) -> dict[str, str] | None:
    japanese = normalize_lookup(str(entry["japanese_name"])).replace(" ", "")
    scientific = normalize_lookup(str(entry["scientific_name"]))
    return by_japanese.get(japanese) or by_scientific.get(scientific) or by_core.get(scientific_core(scientific))


def apply_import(raw_text_path: Path) -> dict[str, object]:
    entries = parse_entries(raw_text_path.read_text(encoding="utf-8", errors="replace"))

    insects_path = ROOT / "normalized_data" / "insects.csv"
    hostplants_path = ROOT / "normalized_data" / "hostplants.csv"
    notes_path = ROOT / "normalized_data" / "general_notes.csv"

    insect_rows = [
        row for row in read_csv(insects_path) if row.get("notes", "").strip() != f"{REFERENCE}で掲載"
    ]
    by_japanese, by_scientific, by_core = build_indexes(insect_rows)
    existing_ids = {row["insect_id"] for row in insect_rows}

    entry_to_insect_id: dict[int, str] = {}
    new_insects: list[dict[str, str]] = []
    next_new_id = 6168
    for entry in entries:
        matched = match_entry(entry, by_japanese, by_scientific, by_core)
        if matched:
            entry_to_insect_id[int(entry["number"])] = matched["insect_id"]
            continue
        while f"species-{next_new_id}" in existing_ids:
            next_new_id += 1
        insect_id = f"species-{next_new_id}"
        next_new_id += 1
        row = make_insect(insect_id, entry)
        new_insects.append(row)
        existing_ids.add(insect_id)
        entry_to_insect_id[int(entry["number"])] = insect_id

    if new_insects:
        insert_at = next(
            (index + 1 for index, row in enumerate(insect_rows) if row.get("insect_id") == "species-6167"),
            len(insect_rows),
        )
        insect_rows[insert_at:insert_at] = new_insects
        write_csv(insects_path, insect_rows, INSECT_COLUMNS)

    hostplant_rows = [
        row for row in read_csv(hostplants_path) if row.get("reference", "").strip() != REFERENCE
    ]
    existing_host_keys = {
        (
            row.get("insect_id", "").strip(),
            row.get("plant_name", "").strip(),
            row.get("plant_family", "").strip(),
            row.get("reference", "").strip(),
        )
        for row in hostplant_rows
    }

    added_hostplants: list[dict[str, str]] = []
    host_counter = 1
    for entry in entries:
        insect_id = entry_to_insect_id[int(entry["number"])]
        plant_part = infer_plant_part(str(entry["ecology_text"]))
        for host in parse_hostplants(str(entry["host_text"])):
            key = (insect_id, host["plant_name"], host["plant_family"], REFERENCE)
            if key in existing_host_keys:
                continue
            existing_host_keys.add(key)
            added_hostplants.append(
                {
                    "record_id": f"hostplant-H3-{host_counter:04d}",
                    "insect_id": insect_id,
                    "plant_name": host["plant_name"],
                    "plant_family": host["plant_family"],
                    "observation_type": "野外（国外）" if host["notes"] == "海外記録" else "野外（国内）",
                    "plant_part": plant_part,
                    "life_stage": "幼虫",
                    "reference": REFERENCE,
                    "notes": host["notes"],
                }
            )
            host_counter += 1

    hostplant_rows.extend(added_hostplants)
    write_csv(hostplants_path, hostplant_rows, HOSTPLANT_COLUMNS)

    added_notes: list[dict[str, str]] = []
    note_counter = 1
    for entry in entries:
        insect_id = entry_to_insect_id[int(entry["number"])]
        emergence, emergence_sentence = extract_emergence_note(str(entry["ecology_text"]))
        ecology_note = extract_ecology_note(str(entry["ecology_text"]), emergence_sentence)
        if emergence:
            added_notes.append(
                {
                    "record_id": f"note-H3-{note_counter:04d}",
                    "insect_id": insect_id,
                    "note_type": "出現時期",
                    "content": emergence,
                    "reference": REFERENCE,
                    "page": "",
                    "year": "2024",
                }
            )
            note_counter += 1
        if ecology_note:
            added_notes.append(
                {
                    "record_id": f"note-H3-{note_counter:04d}",
                    "insect_id": insect_id,
                    "note_type": "生態情報",
                    "content": ecology_note,
                    "reference": REFERENCE,
                    "page": "",
                    "year": "2024",
                }
            )
            note_counter += 1
    write_csv_preserving_existing_lines(notes_path, added_notes, NOTE_COLUMNS, REFERENCE)

    report = {
        "reference": REFERENCE,
        "source_url": SOURCE_URL,
        "parsed_species_entries": len(entries),
        "new_insects": [
            {
                "insect_id": row["insect_id"],
                "japanese_name": row["japanese_name"],
                "scientific_name": row["scientific_name"],
            }
            for row in new_insects
        ],
        "added_hostplants": len(added_hostplants),
        "added_notes": len(added_notes),
        "species_with_unknown_or_unparsed_hostplants": sum(
            1 for entry in entries if not parse_hostplants(str(entry["host_text"]))
        ),
    }
    reports_dir = ROOT / "reports"
    reports_dir.mkdir(exist_ok=True)
    (reports_dir / "hamakiga3_import_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Import host plant and ecology data from 日本のハマキガ3 text.")
    parser.add_argument(
        "raw_text",
        nargs="?",
        default="/tmp/vol27sup1-raw.txt",
        help="Raw text extracted from vol27sup1.pdf using pdftotext -raw.",
    )
    args = parser.parse_args()
    report = apply_import(Path(args.raw_text))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
