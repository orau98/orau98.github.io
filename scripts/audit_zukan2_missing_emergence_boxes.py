#!/usr/bin/env python3

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
INSECTS_CSV = BASE / "normalized_data" / "insects.csv"
HOSTPLANTS_CSV = BASE / "normalized_data" / "hostplants.csv"
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"
BOXES_JSONL = BASE / "reports" / "zukan2_boxes.jsonl"
REPORT_JSON = BASE / "reports" / "zukan2_missing_emergence_boxes.json"
REPORT_CSV = BASE / "reports" / "zukan2_missing_emergence_boxes.csv"
REFERENCE = "日本産蛾類標準図鑑2"

EXCLUDE_FAMILIES = (
    "カミキリムシ",
    "ハムシ",
    "タマムシ",
    "アブラムシ",
    "セセリ",
    "シジミ",
    "タテハ",
    "アゲハ",
    "シロチョウ",
    "ジャノメ",
)

STOP_MARKERS = ("寄主", "荷主", "宿主", "分布", "分類")


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("［", "[").replace("］", "]")
    text = text.replace("　", " ")
    text = text.replace("~", "～").replace("〜", "～")
    text = re.sub(r"(?<=\d)-(?=\d)", "～", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def normalize_key(text: str) -> str:
    text = normalize_text(text)
    text = re.sub(r"[\s\[\]【】()（）:：,.、。・/／'\"-]", "", text)
    return text


def line_column(x: float) -> int:
    if x < 0.22:
        return 0
    if x < 0.48:
        return 1
    if x < 0.74:
        return 2
    return 3


def load_targets():
    insects = {}
    with INSECTS_CSV.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            family_jp = row.get("family_jp", "")
            if any(token in family_jp for token in EXCLUDE_FAMILIES):
                continue
            insects[row["insect_id"]] = row

    host_refs = defaultdict(list)
    with HOSTPLANTS_CSV.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("reference") == REFERENCE:
                host_refs[row["insect_id"]].append(row)

    note_types_any = defaultdict(set)
    with NOTES_CSV.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            note_types_any[row["insect_id"]].add(row["note_type"])

    targets = {}
    for iid, rows in host_refs.items():
        if iid not in insects:
            continue
        if "出現時期" in note_types_any.get(iid, set()):
            continue
        name = insects[iid].get("japanese_name", "").strip()
        if not name:
            continue
        sci = insects[iid].get("scientific_name", "").strip()
        genus = insects[iid].get("genus", "").strip()
        species = insects[iid].get("species", "").strip()
        genus_species = " ".join(part for part in [genus, species] if part)
        targets[iid] = {
            "name": name,
            "name_key": normalize_key(name),
            "scientific_name": sci,
            "scientific_key": normalize_key(genus_species or sci.split("(")[0].strip()),
            "host_count": len(rows),
        }
    return targets


def load_pages():
    pages = []
    with BOXES_JSONL.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            match = re.search(r"page-(\d+)\.png$", obj["path"])
            if not match:
                continue
            page = int(match.group(1))
            lines = []
            for raw in obj.get("lines", []):
                text = normalize_text(raw.get("text", "")).strip()
                if not text:
                    continue
                lines.append(
                    {
                        "text": text,
                        "text_key": normalize_key(text),
                        "x": float(raw["x"]),
                        "y": float(raw["y"]),
                        "width": float(raw["width"]),
                        "height": float(raw["height"]),
                        "confidence": float(raw["confidence"]),
                        "column": line_column(float(raw["x"])),
                    }
                )
            pages.append({"page": page, "lines": sorted(lines, key=lambda row: (-row["y"], row["x"]))})
    return sorted(pages, key=lambda row: row["page"])


def line_match_score(info, line):
    text = line["text"]
    key = line["text_key"]
    score = 0
    if key == info["name_key"]:
        score += 10
    elif info["name_key"] and info["name_key"] in key:
        score += 8
    elif key and key in info["name_key"] and len(key) >= 4:
        score += 4

    sci_key = info["scientific_key"]
    if sci_key:
        if sci_key in key:
            score += 4
        elif any(part and part in text for part in sci_key.split()[:2]):
            score += 1

    if re.search(r"[ァ-ヶ一-龠々]{4,}", text):
        score += 1
    if len(text) <= 18:
        score += 1
    if any(token in text for token in ("図版", "開張", "分布", "寄主", "荷主", "生態", "生期", "分類", "mm", "月")):
        score -= 3
    score += min(line["confidence"], 1.0)
    return score


def anchor_match_kind(info, line):
    key = line["text_key"]
    if key == info["name_key"]:
        return "exact"
    if info["name_key"] and info["name_key"] in key:
        return "contains"
    if key and key in info["name_key"] and len(key) >= 4:
        return "partial"
    return "fallback"


def is_title_like(line):
    text = line["text"]
    if len(text) > 18:
        return False
    if any(token in text for token in ("図版", "開張", "分布", "寄主", "荷主", "生態", "生期", "分類", "mm", "月", "国外")):
        return False
    if re.search(r"[A-Za-z]", text):
        return False
    if re.search(r"[:：\[\]【】()（）]", text):
        return False
    return bool(re.search(r"[ァ-ヶ一-龠々]{4,}", text))


def find_best_anchor(info, pages):
    best = None
    for page in pages:
        for line in page["lines"]:
            score = line_match_score(info, line)
            if score < 9:
                continue
            candidate = {
                "page": page["page"],
                "line": line,
                "score": score,
                "match_kind": anchor_match_kind(info, line),
            }
            if best is None or candidate["score"] > best["score"]:
                best = candidate
    return best


def find_block_lines(anchor, page_lines):
    title = anchor["line"]
    same_column = [line for line in page_lines if line["column"] == title["column"]]
    title_candidates = [line for line in same_column if is_title_like(line)]
    lower_titles = [line for line in title_candidates if line["y"] < title["y"] - 0.01]
    next_title_y = max((line["y"] for line in lower_titles), default=0.0)
    return [line for line in same_column if next_title_y < line["y"] <= title["y"] + 0.001]


def extract_ecology_lines(block_lines):
    start_index = None
    for i, line in enumerate(block_lines):
        text = line["text"]
        if any(marker in text for marker in ("生態", "生観", "生期", "生境")) or re.search(r"\d{1,2}.*月", text):
            start_index = i
            break
    if start_index is None:
        return []

    kept = []
    for line in block_lines[start_index:]:
        text = line["text"]
        if kept and any(marker in text for marker in STOP_MARKERS):
            break
        kept.append(text)
    return kept


def normalize_month_ocr(text: str) -> str:
    text = normalize_text(text)
    text = text.replace("生観", "生態").replace("生期", "生態")
    text = text.replace("山現", "出現").replace("山見", "出現")
    text = text.replace("39月", "3～9月")
    text = text.replace("49月", "4～9月")
    text = text.replace("59月", "5～9月")
    text = text.replace("69月", "6～9月")
    text = text.replace("79月", "7～9月")
    text = text.replace("3.9月", "3～9月").replace("4.9月", "4～9月").replace("5.9月", "5～9月")
    text = text.replace("3,9月", "3～9月").replace("4,9月", "4～9月").replace("5,9月", "5～9月")
    text = text.replace("2.3月", "2～3月").replace("2,3月", "2～3月")
    text = text.replace("3.4月", "3～4月").replace("3,4月", "3～4月")
    text = text.replace("4.5月", "4～5月").replace("4,5月", "4～5月")
    text = text.replace("5.6月", "5～6月").replace("5,6月", "5～6月")
    text = text.replace("6.7月", "6～7月").replace("6,7月", "6～7月")
    text = text.replace("7.8月", "7～8月").replace("7,8月", "7～8月")
    text = text.replace("8.9月", "8～9月").replace("8,9月", "8～9月")
    text = re.sub(r"(?<=\d) ?[~\-] ?(?=\d)", "～", text)
    return text


def extract_emergence(text: str) -> str:
    if not text:
        return ""
    text = normalize_month_ocr(text)
    if re.search(r"(ほ[ぼはほ]?|ほぼ)1年中|ほ[ぼはほ]?周年", text):
        return "一年中"
    if "1年中" in text or "通年" in text or "周年" in text:
        return "一年中"
    text = re.sub(r"(?<=\d)\.(?=\d)", "月、", text)
    text = re.sub(r"(?<=\d),(?=\d)", "月、", text)
    sentences = [seg.strip() for seg in re.split(r"[。．]", text) if seg.strip()]
    month_sentence = next((seg for seg in sentences if "月" in seg or "通年" in seg), text)
    patterns = [
        r"(\d{1,2}月(?:[上中下]旬)?から\d{1,2}月(?:[上中下]旬)?まで)",
        r"(\d{1,2}月(?:[上中下]旬)?から\d{1,2}月(?:[上中下]旬)?頃)",
        r"(\d{1,2}月(?:[上中下]旬)?から\d{1,2}月(?:[上中下]旬)?)",
        r"((?:\d{1,2}～\d{1,2}月(?:[上中下]旬)?|\d{1,2}月(?:[上中下]旬)?)(?:[、と]\d{1,2}～\d{1,2}月(?:[上中下]旬)?|[、と]\d{1,2}月(?:[上中下]旬)?)*)",
        r"((?:\d{1,2}月(?:[上中下]旬)?)(?:[、と]\d{1,2}月(?:[上中下]旬)?)+)",
        r"(\d{1,2}～\d{1,2}月(?:[上中下]旬)?)",
        r"(通年)",
        r"(\d{1,2}月(?:[上中下]旬)?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, month_sentence)
        if not match:
            continue
        value = match.group(1).strip(" 。、,")
        value = re.sub(r"(?<=\d) ?～ ?(?=\d)", "～", value)
        value = value.replace("・", "、")
        if "まで" in value or len(re.findall(r"\d{1,2}月", value)) >= 2:
            value = value.replace("から", "～").replace("まで", "").replace("頃", "")
        value = re.sub(r"\s+", "", value)
        value = re.sub(r"(\d{1,2})月～(\d{1,2})月", r"\1～\2月", value)
        value = re.sub(r"(\d{1,2})～\1月", r"\1月", value)
        return value
    return ""


def main():
    targets = load_targets()
    pages = load_pages()

    results = []
    for iid, info in targets.items():
        anchor = find_best_anchor(info, pages)
        if not anchor:
            results.append(
                {
                    "insect_id": iid,
                    "name": info["name"],
                    "scientific_name": info["scientific_name"],
                    "page": "",
                    "match_score": 0,
                    "candidate_emergence": "",
                    "status": "anchor_not_found",
                    "host_count": info["host_count"],
                    "anchor_match_kind": "",
                    "anchor_text": "",
                    "ecology_text": "",
                }
            )
            continue

        page = next(page for page in pages if page["page"] == anchor["page"])
        block_lines = find_block_lines(anchor, page["lines"])
        ecology_lines = extract_ecology_lines(block_lines)
        ecology_text = " ".join(ecology_lines)
        candidate = extract_emergence(ecology_text)
        results.append(
            {
                "insect_id": iid,
                "name": info["name"],
                "scientific_name": info["scientific_name"],
                "page": anchor["page"],
                "match_score": round(anchor["score"], 2),
                "candidate_emergence": candidate,
                "status": "candidate" if candidate else "no_candidate",
                "host_count": info["host_count"],
                "anchor_match_kind": anchor["match_kind"],
                "anchor_text": anchor["line"]["text"],
                "ecology_text": ecology_text,
            }
        )

    REPORT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    with REPORT_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "insect_id",
                "name",
                "scientific_name",
                "page",
                "match_score",
                "candidate_emergence",
                "status",
                "host_count",
                "anchor_match_kind",
                "anchor_text",
                "ecology_text",
            ],
        )
        writer.writeheader()
        writer.writerows(results)

    candidate_count = sum(1 for row in results if row["candidate_emergence"])
    print(f"targets={len(results)} candidate_emergence={candidate_count}")
    print(f"wrote {REPORT_JSON.relative_to(BASE)}")
    print(f"wrote {REPORT_CSV.relative_to(BASE)}")


if __name__ == "__main__":
    main()
