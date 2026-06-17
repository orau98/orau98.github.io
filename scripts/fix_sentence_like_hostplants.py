#!/usr/bin/env python3
"""食草欄に混入した文断片・OCR崩れを修復する。

主に以下を行う:
1. `日本のキリガ` 由来の文断片を削除
2. OCRで崩れた植物名や注記付き植物名を正規化
3. 植物名ではなく食性メモだった行を general_notes へ退避
"""

from __future__ import annotations

import csv
import difflib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HOSTPLANTS_CSV = ROOT / "normalized_data" / "hostplants.csv"
GENERAL_NOTES_CSV = ROOT / "normalized_data" / "general_notes.csv"
INSECTS_CSV = ROOT / "normalized_data" / "insects.csv"

KIRIGA_REFERENCE = "日本のキリガ"

DIRECT_ROW_FIXES = {
    "hostplant-905896": {
        "plant_name": "ビワ",
        "plant_family": "バラ科",
        "plant_part": "花",
        "life_stage": "幼虫",
        "notes_override": "原文: ビワの花から幼虫を採集飼育",
    },
    "hostplant-B1B6-0055": {
        "plant_name": "チャ",
        "plant_family": "ツバキ科",
        "notes_append": "野生化した株",
    },
    "hostplant-909577": {
        "plant_name": "シダレヤナギ",
        "plant_family": "ヤナギ科",
    },
}

HOSTPLANT_TO_NOTE = {
    "hostplant-000269": "幼虫は乾燥または腐敗した植物質を食べる。",
    "hostplant-901825": "幼虫は乾燥した蘚苔類を食べる。",
}

OCR_NAME_FIXES = {
    "各種広装": "広葉樹",
    "ウラジロガン": "ウラジロガシ",
    "キブン": "キブシ",
    "ゴミウマツ": "ゴヨウマツ",
    "コアマリ": "コデマリ",
    "サクラが": "サクラ",
    "サクラ肌": "サクラ類",
    "スミ": "ズミ",
    "ナックミ": "ナツグミ",
    "ナッツバキ": "ナツツバキ",
    "ヒマラヤスキ": "ヒマラヤスギ",
    "ホザキシモック": "ホザキシモツケ",
    "ミスキ": "ミズキ",
    "ミスナラ": "ミズナラ",
    "ミツカシワ": "ミツガシワ",
    "クスギ": "クヌギ",
}

ANNOTATION_TOKENS = {
    "飼育",
    "飼育可",
    "飼",
    "有",
    "別",
    "音",
    "自育",
    "創省",
    "国有",
    "国省",
    "Mf",
    "M11",
    "N",
    "例",
    "例T",
    "割付",
    "葉・花",
}

IGNORED_NOTE_TOKENS = {
    "音",
    "し",
}

SENTENCE_EXACT = {
    "また",
    "さて",
    "うーむ",
    "今度",
    "翌年",
    "合掌",
    "未知",
    "木知",
    "ヨーロッパ",
}

SENTENCE_MARKERS = [
    "ページ",
    "採り方",
    "採集",
    "飛来",
    "個体",
    "普通種",
    "明かり",
    "灯火",
    "トーミツ",
    "タイプ標本",
    "博物館",
    "先生",
    "糖蜜",
    "トラップ",
    "現場",
    "日本海",
    "北海道",
    "ロシア",
    "関東",
    "北朝鮮",
    "キリガ",
    "フユシャク",
    "フュシャク",
    "屋台",
    "友人",
    "後輩",
    "僕",
    "私",
    "先生",
    "参戦",
    "上級者",
    "百戦錬磨",
    "珍品",
    "飛んで",
    "飛んで来ない",
    "採れない",
    "得られる",
    "得がたい",
    "生息",
    "分布",
    "当時",
    "現在",
    "最近",
    "よう",
    "こと",
    "ところ",
    "という",
    "である",
    "だった",
    "なった",
    "でした",
    "ます",
    "です",
    "だろう",
    "から",
    "まで",
    "では",
    "しか",
]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def append_unique_notes(*parts: str) -> str:
    items: list[str] = []
    for part in parts:
        for chunk in clean(part).split(" / "):
            chunk = clean(chunk)
            if chunk and chunk not in items:
                items.append(chunk)
    return " / ".join(items)


def clean_host_note_token(text: str) -> str:
    text = clean(text)
    if text in IGNORED_NOTE_TOKENS:
        return ""
    return text


def dedupe_repeated_phrase(text: str) -> str:
    text = clean(text)
    if not text:
        return ""
    words = text.split(" / ")
    if len(set(words)) == 1:
        return words[0]

    for size in range(1, 5):
        phrase = text[: len(text) // max(1, size)]
        if phrase and phrase * size == text:
            return phrase

    chunks = []
    token_re = re.compile(r"(.+?)\1+$")
    m = token_re.match(text)
    if m:
        return clean(m.group(1))

    parts = re.split(r"\s{2,}", text)
    for part in parts:
        part = clean(part)
        if part and part not in chunks:
            chunks.append(part)
    return " / ".join(chunks) if chunks else text


def load_insect_names() -> dict[str, str]:
    _, rows = read_csv(INSECTS_CSV)
    mapping: dict[str, str] = {}
    for row in rows:
        insect_id = clean(row.get("insect_id") or row.get("\ufeffinsect_id") or "")
        if insect_id:
            mapping[insect_id] = clean(row.get("japanese_name", ""))
    return mapping


def build_known_name_sets(rows: list[dict[str, str]]) -> tuple[set[str], dict[str, set[str]]]:
    global_names: set[str] = set()
    by_insect: dict[str, set[str]] = {}
    for row in rows:
        if clean(row.get("reference")) == KIRIGA_REFERENCE:
            continue
        name = clean(row.get("plant_name"))
        if not name or len(name) > 30:
            continue
        global_names.add(name)
        by_insect.setdefault(clean(row.get("insect_id")), set()).add(name)
    return global_names, by_insect


def is_sentence_like(name: str) -> bool:
    if not name:
        return True
    if name in SENTENCE_EXACT:
        return True
    if re.search(r"[ぁ-ん]", name):
        return True
    if len(name) >= 16:
        return True
    if any(marker in name for marker in SENTENCE_MARKERS):
        return True
    if re.search(r"[0-9A-Za-z]|[。．、「」『』<>:：]", name):
        return True
    return False


def apply_name_fixes(name: str) -> str:
    name = clean(name)
    for bad, good in OCR_NAME_FIXES.items():
        if name == bad:
            return good
    return name


def normalize_annotation(annotation: str) -> str:
    return clean(re.sub(r"[^\w一-龯ぁ-んァ-ン・]+", "", annotation))


def strip_annotation(base_name: str) -> tuple[str, str]:
    match = re.match(r"^(.*?)[（(]([^）)]+)[）)]\.?$", base_name)
    if not match:
        return base_name, ""
    base = clean(match.group(1))
    annotation = clean(match.group(2))
    normalized_annotation = normalize_annotation(annotation)
    if normalized_annotation in ANNOTATION_TOKENS:
        return base, normalized_annotation
    if normalized_annotation.startswith("飼育では"):
        inner = clean(normalized_annotation.replace("飼育では", ""))
        if inner:
            return inner, "飼育記録"
    return base_name, ""


def normalize_suffix(base_name: str) -> tuple[str, dict[str, str]]:
    info: dict[str, str] = {}
    base_name = clean(base_name)

    if base_name.endswith("の花"):
        info["plant_part"] = "花"
        return clean(base_name[:-2]), info

    if base_name.endswith("など"):
        return clean(base_name[:-2]), info

    m = re.match(r"^(.+?)(各種広葉[樹街薬樹装]*)$", base_name)
    if m:
        return clean(m.group(1)), info

    m = re.match(r"^(.+?)(で幼虫.+|で記.+)$", base_name)
    if m:
        return clean(m.group(1)), info

    return base_name, info


def split_multi_name(base_name: str) -> list[str]:
    if not re.search(r"[.．]", base_name):
        return [base_name]
    return [clean(part) for part in re.split(r"[.．]", base_name) if clean(part)]


def normalize_name_candidates(name: str, insect_name: str) -> tuple[list[str], dict[str, str]] | None:
    name = clean(name)
    if insect_name and insect_name in name:
        name = clean(name.split(insect_name, 1)[0])
    if not name:
        return None

    normalized: list[str] = []
    info: dict[str, str] = {}
    for part in split_multi_name(name):
        if insect_name and insect_name in part:
            part = clean(part.split(insect_name, 1)[0])
        if not part:
            continue
        base, annotation = strip_annotation(part)
        base, suffix_info = normalize_suffix(base)
        base = apply_name_fixes(base)
        if not base or is_sentence_like(base):
            continue
        normalized.append(base)

        if annotation:
            if annotation == "葉・花":
                info["plant_part"] = "葉・花"
            elif annotation in IGNORED_NOTE_TOKENS:
                pass
            else:
                info["notes"] = append_unique_notes(info.get("notes", ""), annotation)
        if suffix_info.get("plant_part"):
            info["plant_part"] = suffix_info["plant_part"]
        if suffix_info.get("notes"):
            info["notes"] = append_unique_notes(info.get("notes", ""), suffix_info["notes"])

    if not normalized and not is_sentence_like(name):
        base, suffix_info = normalize_suffix(apply_name_fixes(name))
        if base and not is_sentence_like(base):
            normalized = [base]
            if suffix_info.get("plant_part"):
                info["plant_part"] = suffix_info["plant_part"]
            if suffix_info.get("notes"):
                info["notes"] = append_unique_notes(info.get("notes", ""), suffix_info["notes"])

    normalized = [part for part in normalized if part]
    if not normalized:
        return None

    return normalized, info


def infer_family(rows: list[dict[str, str]], insect_id: str, plant_name: str) -> str:
    for row in rows:
        if clean(row.get("insect_id")) == insect_id and clean(row.get("plant_name")) == plant_name:
            family = clean(row.get("plant_family"))
            if family:
                return family
    return ""


def unique_note_record_id(existing_rows: list[dict[str, str]], base_id: str) -> str:
    existing = {clean(row.get("record_id")) for row in existing_rows}
    candidate = base_id
    idx = 1
    while candidate in existing:
        candidate = f"{base_id}-{idx}"
        idx += 1
    return candidate


def main() -> None:
    host_headers, host_rows = read_csv(HOSTPLANTS_CSV)
    note_headers, note_rows = read_csv(GENERAL_NOTES_CSV)
    insect_names = load_insect_names()
    global_clean_names, clean_names_by_insect = build_known_name_sets(host_rows)

    out_rows: list[dict[str, str]] = []
    seen_row_keys: set[tuple[str, ...]] = set()
    moved_note_ids: set[str] = set()

    def append_host_row(row: dict[str, str]) -> None:
        key = tuple(clean(row.get(header)) for header in host_headers if header != "record_id")
        if key in seen_row_keys:
            return
        seen_row_keys.add(key)
        out_rows.append(row)

    for row in host_rows:
        record_id = clean(row.get("record_id"))
        insect_id = clean(row.get("insect_id"))
        plant_name = clean(row.get("plant_name"))
        reference = clean(row.get("reference"))
        normalized_row = dict(row)

        if reference == KIRIGA_REFERENCE and clean(normalized_row.get("notes", "")).startswith("原文"):
            normalized_row["notes"] = ""
            row = normalized_row

        if record_id in HOSTPLANT_TO_NOTE:
            note_id = unique_note_record_id(note_rows, f"cleanup-{record_id}")
            note_rows.append({
                "record_id": note_id,
                "insect_id": insect_id,
                "note_type": "生態情報",
                "content": HOSTPLANT_TO_NOTE[record_id],
                "reference": reference,
                "page": "",
                "year": "",
            })
            moved_note_ids.add(note_id)
            continue

        direct_fix = DIRECT_ROW_FIXES.get(record_id)
        if direct_fix:
            fixed = dict(row)
            fixed["plant_name"] = direct_fix["plant_name"]
            if direct_fix.get("plant_family"):
                fixed["plant_family"] = direct_fix["plant_family"]
            if direct_fix.get("plant_part"):
                fixed["plant_part"] = direct_fix["plant_part"]
            if direct_fix.get("life_stage"):
                fixed["life_stage"] = direct_fix["life_stage"]
            if direct_fix.get("notes_override"):
                fixed["notes"] = direct_fix["notes_override"]
            else:
                fixed["notes"] = append_unique_notes(
                    dedupe_repeated_phrase(row.get("notes", "")),
                    direct_fix.get("notes_append", ""),
                )
            append_host_row(fixed)
            continue

        if reference != KIRIGA_REFERENCE:
            append_host_row(row)
            continue

        insect_name = insect_names.get(insect_id, "")
        result = normalize_name_candidates(plant_name, insect_name)
        if result is None:
            continue
        normalized, extra_info = result

        same_species_clean = clean_names_by_insect.get(insect_id, set())
        created = 0
        for idx, name in enumerate(normalized):
            name = apply_name_fixes(name)
            if not name or is_sentence_like(name):
                continue

            if name in SENTENCE_EXACT:
                continue

            family = infer_family(host_rows, insect_id, name)
            if not family and name not in global_clean_names and same_species_clean:
                # 同種の他参照に近い名前があればそれへ寄せる
                candidates = sorted(same_species_clean)
                close = difflib.get_close_matches(name, candidates, n=1, cutoff=0.6)
                if close:
                    name = close[0]
                    family = infer_family(host_rows, insect_id, name)

            fixed = dict(row)
            fixed["record_id"] = record_id if idx == 0 else unique_note_record_id(out_rows, f"{record_id}-split")
            fixed["plant_name"] = name
            if family:
                fixed["plant_family"] = family
            if extra_info.get("plant_part"):
                fixed["plant_part"] = extra_info["plant_part"]
            fixed["notes"] = append_unique_notes(clean_host_note_token(row.get("notes", "")), extra_info.get("notes", ""))
            append_host_row(fixed)
            created += 1

        if created == 0:
            continue

    write_csv(HOSTPLANTS_CSV, host_headers, out_rows)
    write_csv(GENERAL_NOTES_CSV, note_headers, note_rows)
    print(f"cleaned hostplants rows: {len(host_rows)} -> {len(out_rows)}")
    print(f"added general notes: {len(moved_note_ids)}")


if __name__ == "__main__":
    main()
