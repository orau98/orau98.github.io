#!/usr/bin/env python3

import argparse
import csv
import difflib
import json
import re
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path

import fitz


BASE = Path(__file__).resolve().parent.parent
INSECTS_CSV = BASE / "normalized_data" / "insects.csv"
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"
REPORT_JSON = BASE / "reports" / "butterfly_emergence_extraction_report.json"
REFERENCE = "日本産蝶類標準図鑑"
DEFAULT_PDF = Path("/Users/akimotohiroki/Downloads/pdf/日本産蝶類標準図鑑_compressed.pdf")
OCR_SWIFT = BASE / "scripts" / "ocr_images_with_vision_boxes.swift"

BUTTERFLY_FAMILIES = {
    "アゲハチョウ科",
    "シロチョウ科",
    "シジミチョウ科",
    "タテハチョウ科",
    "セセリチョウ科",
    "ジャノメチョウ科",
    "マダラチョウ科",
    "テングチョウ科",
}

SECTION_STOP_RE = re.compile(
    r"[\[【(]?(?:食草|寄主|分布|変異|分類|生活史|文献|備考|図版|解説)[\]】)]?"
)
ECOLOGY_START_RE = re.compile(r"[\[【(]?(?:生態|生憩|生観|生期|生境)[\]】)]?")
TOP_ASCII_RE = re.compile(r"[A-Za-z]{4,}")
TIMING_CUE_RE = re.compile(
    r"(?:\d{1,2}月|年[0-9一二三四五六七八九十]+(?:[〜～,、][0-9一二三四五六七八九十]+)?[回化]|"
    r"年中|周年|通年|越冬|春型|夏型|秋型|冬型)"
)
ADULT_TIMING_CUE_RE = re.compile(
    r"(?:出現|発生|最盛期|見られ|姿を見る|飛翔|飛ぶ|羽化|活動|連続的に発生|発生を繰り返|"
    r"多化性|年[0-9一二三四五六七八九十]+(?:[、,～][0-9一二三四五六七八九十]+)?回)"
)
GENERATION_CUE_RE = re.compile(r"(?:第[0-9一二三四五六七八九十]+化|春型|夏型|秋型|冬型)")
NEGATIVE_STAGE_RE = re.compile(
    r"(?:卵|卵果|卵巣|幼虫|蛹|産卵|終齢|齢|食草|食樹|越冬卵|越冬幼虫|越冬蛹)"
)


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = text.replace("　", " ")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("［", "[").replace("］", "]")
    text = text.replace("【", "[").replace("】", "]")
    text = text.replace("〜", "～").replace("~", "～")
    text = re.sub(r"(?<=\d)\s*[‐-]\s*(?=\d)", "～", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def normalize_ocr_text(text: str) -> str:
    text = normalize_text(text)
    replacements = {
        "生憩": "生態",
        "生観": "生態",
        "生期": "生態",
        "生境": "生態",
        "図版I": "図版1",
        "区版": "図版",
        "版I": "図版1",
        "年2円": "年2回",
        "年3円": "年3回",
        "年4円": "年4回",
        "年5円": "年5回",
        "年1円": "年1回",
        "中・下旬": "中下旬",
        "上・中旬": "上中旬",
        "上・下旬": "上下旬",
        "〜": "～",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    text = re.sub(r"(?<=\d)[.,](?=\d)", "月、", text)
    text = re.sub(r"(?<=\d)\s*月\s*(?=[0-9])", "月、", text)
    text = re.sub(r"(?<=\d)[一−ー](?=\d)", "～", text)
    text = re.sub(r"(?<=\d) ?～ ?(?=\d)", "～", text)
    text = re.sub(r"月\s*([上下中])\s*旬", r"月\1旬", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_scientific_candidate(text: str) -> str:
    cleaned = re.sub(r"[^A-Za-z .,&-]", " ", text)
    tokens = re.findall(r"[A-Za-z][A-Za-z.-]*", cleaned)
    if len(tokens) < 2:
        return ""
    first = tokens[0]
    second = tokens[1]
    return f"{first} {second}".strip()


def normalize_scientific_binomial(text: str) -> str:
    candidate = clean_scientific_candidate(text)
    if not candidate:
        return ""
    candidate = candidate.replace("Pabilio", "Papilio")
    candidate = candidate.replace("Papito", "Papilio")
    candidate = candidate.replace("Papitio", "Papilio")
    candidate = candidate.replace("Papiilo", "Papilio")
    candidate = candidate.replace("Pierisnapi", "Pieris napi")
    candidate = candidate.replace("Lycaenaphlaeas", "Lycaena phlaeas")
    parts = [part.lower() for part in candidate.split()[:2]]
    if len(parts) < 2:
        return ""
    return " ".join(parts)


def butterfly_rows():
    rows = []
    with INSECTS_CSV.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("family_jp", "") not in BUTTERFLY_FAMILIES:
                continue
            scientific = normalize_text(row.get("scientific_name", ""))
            binomial = " ".join(scientific.split()[:2]).strip().lower()
            rows.append(
                {
                    "insect_id": row["insect_id"],
                    "name": row.get("japanese_name", "").strip(),
                    "scientific": scientific,
                    "binomial": binomial,
                }
            )
    return rows


def render_half_pages(pdf_path: Path, halves_dir: Path, dpi: int):
    existing = sorted(halves_dir.glob("page-*-?.png"))
    if existing:
        return existing
    halves_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    for index in range(len(doc)):
        page = doc[index]
        rect = page.rect
        mid_x = rect.x0 + (rect.width / 2)
        clips = [
            ("L", fitz.Rect(rect.x0, rect.y0, mid_x, rect.y1)),
            ("R", fitz.Rect(mid_x, rect.y0, rect.x1, rect.y1)),
        ]
        for side, clip in clips:
            output_path = halves_dir / f"page-{index + 1:03d}-{side}.png"
            pix = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)
            pix.save(str(output_path))
    doc.close()
    return sorted(halves_dir.glob("page-*-?.png"))


def run_ocr(page_paths, ocr_jsonl: Path):
    if ocr_jsonl.exists() and ocr_jsonl.stat().st_size > 0:
        return
    ocr_jsonl.parent.mkdir(parents=True, exist_ok=True)
    batch_size = 60
    with ocr_jsonl.open("w", encoding="utf-8") as out:
        for index in range(0, len(page_paths), batch_size):
            batch = page_paths[index : index + batch_size]
            cmd = ["swift", str(OCR_SWIFT), *[str(path) for path in batch]]
            result = subprocess.run(cmd, check=True, text=True, capture_output=True)
            out.write(result.stdout)


def load_ocr_pages(ocr_jsonl: Path):
    pages = []
    with ocr_jsonl.open(encoding="utf-8") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            obj = json.loads(raw)
            match = re.search(r"page-(\d+)-([LR])\.png$", Path(obj["path"]).name)
            if not match:
                continue
            obj["page"] = int(match.group(1))
            obj["side"] = match.group(2)
            pages.append(obj)
    pages.sort(key=lambda row: (row["page"], row["side"]))
    return pages


def logical_pages(ocr_pages):
    items = []
    for page in ocr_pages:
        lines = [
            {
                "text": normalize_text(line["text"]),
                "x": line["x"],
                "y": line["y"],
            }
            for line in page.get("lines", [])
        ]
        if not lines:
            continue
        lines.sort(key=lambda row: (-row["y"], row["x"]))
        top_lines = [line["text"] for line in lines[:8]]
        top_text = " ".join(line["text"] for line in lines if line["y"] > 0.9)
        joined = "\n".join(line["text"] for line in lines)
        is_explanation = bool(re.search(r"解[説悦]", top_text or " ".join(top_lines)))
        is_plate = "図版" in (top_text or " ".join(top_lines))
        is_supplemental = "追補・迷チョウ" in (top_text or " ".join(top_lines))
        items.append(
            {
                "page": page["page"],
                "side": page["side"],
                "lines": lines,
                "top_lines": top_lines,
                "text": joined,
                "is_explanation": is_explanation,
                "is_plate": is_plate,
                "is_supplemental": is_supplemental,
            }
        )
    return items


def best_scientific_match(lines, butterflies):
    best = None
    for idx, line in enumerate(lines[:24]):
        if not TOP_ASCII_RE.search(line["text"]):
            continue
        candidate = normalize_scientific_binomial(line["text"])
        if not candidate:
            continue
        for butterfly in butterflies:
            score = difflib.SequenceMatcher(None, candidate, butterfly["binomial"]).ratio()
            if candidate.split()[0] == butterfly["binomial"].split()[0]:
                score += 0.08
            if idx < 12:
                score += 0.03
            if best is None or score > best["score"]:
                best = {
                    "score": score,
                    "candidate": candidate,
                    "line": line["text"],
                    "butterfly": butterfly,
                }
    return best


def best_japanese_match(lines, butterflies):
    best = None
    lookup = {row["name"]: row for row in butterflies}
    for idx, line in enumerate(lines[:14]):
        stripped = line["text"].strip()
        for name, butterfly in lookup.items():
            if stripped == name or stripped.startswith(f"{name}(") or stripped.startswith(f"{name}（"):
                score = 1.0 - (idx * 0.01)
                if best is None or score > best["score"]:
                    best = {
                        "score": score,
                        "candidate": name,
                        "line": line["text"],
                        "butterfly": butterfly,
                    }
    return best


def find_species_mentions(text: str, butterflies):
    mentions = []
    occupied = []
    for butterfly in sorted(butterflies, key=lambda row: len(row["name"]), reverse=True):
        name = butterfly["name"]
        start = text.find(name)
        while start != -1:
            end = start + len(name)
            if not any(not (end <= left or start >= right) for left, right in occupied):
                mentions.append(
                    {
                        "start": start,
                        "end": end,
                        "name": name,
                        "butterfly": butterfly,
                    }
                )
                occupied.append((start, end))
            start = text.find(name, start + 1)
    mentions.sort(key=lambda row: (row["start"], -len(row["name"])))
    return mentions


def select_heading_occurrence(occurrences):
    def key(row):
        return (
            1 if row["dedicated"] else 0,
            1 if row["has_plate_marker"] else 0,
            row["score"],
            -row["line_index"],
        )

    return max(occurrences, key=key)


def extract_species_blocks(item, butterflies):
    occurrences_by_id = defaultdict(list)
    lines = item["lines"]

    for index, line in enumerate(lines):
        text = line["text"].strip()
        if not text:
            continue
        mentions = find_species_mentions(text, butterflies)
        if not mentions:
            continue
        mention_names = {mention["butterfly"]["insect_id"] for mention in mentions}
        for mention in mentions:
            line_starts_with_name = text.startswith(mention["name"])
            dedicated = line_starts_with_name and len(mention_names) == 1
            has_plate_marker = "図版" in text or "版" in text
            score = 0
            if index < 6:
                score += 4
            if dedicated:
                score += 5
            elif line_starts_with_name:
                score += 3
            if has_plate_marker:
                score += 2
            if len(text) <= len(mention["name"]) + 24:
                score += 2
            if line["y"] >= 0.55:
                score += 1
            occurrences_by_id[mention["butterfly"]["insect_id"]].append(
                {
                    "line_index": index,
                    "text": text,
                    "score": score,
                    "dedicated": dedicated,
                    "has_plate_marker": has_plate_marker,
                    "butterfly": mention["butterfly"],
                }
            )

    if not occurrences_by_id:
        return []

    headings = []
    for insect_id, occurrences in occurrences_by_id.items():
        selected = select_heading_occurrence(occurrences)
        headings.append(selected)

    headings.sort(key=lambda row: row["line_index"])
    blocks = []
    for idx, heading in enumerate(headings):
        start = heading["line_index"]
        end = headings[idx + 1]["line_index"] if idx + 1 < len(headings) else len(lines)
        block_lines = lines[start:end]
        block_text = "\n".join(line["text"] for line in block_lines).strip()
        if len(block_text) < 40 and not TIMING_CUE_RE.search(block_text):
            continue
        blocks.append(
            {
                "insect": heading["butterfly"],
                "match_kind": "block_heading",
                "score": round(0.8 + (heading["score"] * 0.02), 3),
                "match_line": heading["text"],
                "page": item["page"],
                "side": item["side"],
                "block_text": block_text,
            }
        )
    return blocks


def identify_species(item, butterflies):
    sci = best_scientific_match(item["lines"], butterflies)
    jp = best_japanese_match(item["lines"], butterflies)
    if sci and sci["score"] >= 0.78:
        return {
            "match_kind": "scientific",
            "score": round(sci["score"], 3),
            "match_line": sci["line"],
            "insect": sci["butterfly"],
        }
    if jp:
        return {
            "match_kind": "japanese",
            "score": round(jp["score"], 3),
            "match_line": jp["line"],
            "insect": jp["butterfly"],
        }
    if sci and sci["score"] >= 0.7:
        return {
            "match_kind": "scientific_loose",
            "score": round(sci["score"], 3),
            "match_line": sci["line"],
            "insect": sci["butterfly"],
        }
    return None


def extract_ecology_section(text: str) -> str:
    text = normalize_ocr_text(text)
    start = ECOLOGY_START_RE.search(text)
    if not start:
        return ""
    tail = text[start.end() :]
    stop = SECTION_STOP_RE.search(tail)
    if stop:
        tail = tail[: stop.start()]
    tail = re.sub(r"\n+", " ", tail)
    tail = re.sub(r"\s+", " ", tail).strip(" ・、,;")
    return tail


def normalize_month_token(token: str) -> str:
    token = token.strip(" 、,。.；;")
    token = token.replace("〜", "～")
    token = token.replace("中・下旬", "中下旬")
    token = token.replace("上・中旬", "上中旬")
    token = token.replace("上・下旬", "上下旬")
    token = re.sub(r"\s+", "", token)
    token = token.replace("月月", "月")
    token = re.sub(r"(?<=\d)～(?=\d{1,2}月)", "～", token)
    token = re.sub(r"(\d{2,3})(?=月|～)", _fix_month_number_match, token)
    same_month_specific = re.fullmatch(
        r"(\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬))～(\d{1,2}月)", token
    )
    if same_month_specific and re.match(r"\d{1,2}月", same_month_specific.group(1)).group(0) == same_month_specific.group(2):
        return same_month_specific.group(1)
    same_month_plain = re.fullmatch(r"(\d{1,2}月)～(\d{1,2}月)", token)
    if same_month_plain and same_month_plain.group(1) == same_month_plain.group(2):
        return same_month_plain.group(1)
    cross_year_short = re.fullmatch(r"(\d{1,2})～(\d{1,2})月", token)
    if cross_year_short:
        start = int(cross_year_short.group(1))
        end = int(cross_year_short.group(2))
        if start > end:
            return f"{start}月～翌{end}月"
    cross_year_full = re.fullmatch(
        r"(\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)～(\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)",
        token,
    )
    if cross_year_full:
        start_month = int(re.match(r"(\d{1,2})月", cross_year_full.group(1)).group(1))
        end_month = int(re.match(r"(\d{1,2})月", cross_year_full.group(2)).group(1))
        if start_month > end_month:
            return f"{cross_year_full.group(1)}～翌{cross_year_full.group(2)}"
    return token


def _fix_month_number_match(match):
    raw = match.group(1)
    try:
        number = int(raw)
    except ValueError:
        return raw
    if 1 <= number <= 12:
        return str(number)
    if len(raw) >= 2:
        tail_two = int(raw[-2:])
        if 10 <= tail_two <= 12:
            return str(tail_two)
        tail_one = int(raw[-1])
        if 1 <= tail_one <= 9:
            return str(tail_one)
    return raw


def range_phrase_tokens(text: str):
    compact = compact_timing_text(text)
    matches = []
    patterns = [
        r"(\d{1,3}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)(?:ごろ)?(?:より|から)(\d{1,3}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)(?:にわたって|にかけて|まで)",
        r"(\d{1,3}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)(?:ごろ)?(?:より|から)(\d{1,3}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)",
        r"(\d{1,3}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)(?:ごろ)?(?:より|から).{0,80}?(\d{1,3}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?)(?:まで見られる|まで発生|まで出現|まで)",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, compact):
            start = normalize_month_token(match.group(1))
            end = normalize_month_token(match.group(2))
            matches.append({"start": match.start(), "end": match.end(), "token": f"{start}～{end}"})
    unique = []
    seen = set()
    for match in matches:
        key = (match["start"], match["token"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(match)
    return compact, unique


def compact_timing_text(text: str) -> str:
    compact = text.replace("、", "、").replace(",", "、")
    compact = re.sub(r"\s+", "", compact)
    compact = compact.replace("〜", "～")
    compact = compact.replace("中・下旬", "中下旬")
    compact = compact.replace("上・中旬", "上中旬")
    compact = compact.replace("上・下旬", "上下旬")
    compact = compact.replace("か5月", "～5月")
    compact = compact.replace("〜7月", "～7月")
    return compact


def extract_month_matches(text: str):
    compact, range_matches = range_phrase_tokens(text)
    matches = list(range_matches)
    occupied = set()
    for match in range_matches:
        occupied.update(range(match["start"], match["end"]))
    patterns = [
        r"\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?～\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?",
        r"\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?～(?:上旬|中旬|下旬)",
        r"\d{1,2}～\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?",
        r"\d{1,2}月(?:上旬|中旬|下旬|上中旬|中下旬|上下旬)?",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, compact):
            span = match.span()
            if any(i in occupied for i in range(span[0], span[1])):
                continue
            token = normalize_month_token(match.group(0))
            if not token:
                continue
            matches.append({"start": span[0], "end": span[1], "token": token})
            occupied.update(range(span[0], span[1]))
    matches.sort(key=lambda row: (row["start"], len(row["token"])))
    return compact, matches


def extract_month_tokens(text: str):
    compact, matches = extract_month_matches(text)
    if not matches:
        return []

    scored = []
    for match in matches:
        context = compact[max(0, match["start"] - 16) : min(len(compact), match["end"] + 16)]
        local_context = compact[max(0, match["start"] - 8) : min(len(compact), match["end"] + 8)]
        score = 0
        if ADULT_TIMING_CUE_RE.search(context):
            score += 4
        if GENERATION_CUE_RE.search(context):
            score += 2
        if any(phrase in context for phrase in ("まで見られる", "まで発生", "まで出現", "連続的に発生", "発生を繰り返")):
            score += 2
        if NEGATIVE_STAGE_RE.search(context) and not re.search(r"(?:羽化|成虫)", context):
            score -= 5
        if NEGATIVE_STAGE_RE.search(local_context) and not re.search(r"(?:羽化|成虫)", local_context):
            score -= 6
        scored.append({**match, "score": score})

    positive = [match for match in scored if match["score"] > 0]
    chosen = positive or scored

    best_by_token = {}
    for match in chosen:
        current = best_by_token.get(match["token"])
        if current is None or (match["score"], -match["start"]) > (current["score"], -current["start"]):
            best_by_token[match["token"]] = match

    ordered = sorted(best_by_token.values(), key=lambda row: (row["start"], len(row["token"])))
    range_boundaries = set()
    for match in ordered:
        if "～" not in match["token"]:
            continue
        start, end = match["token"].split("～", 1)
        range_boundaries.add(start)
        range_boundaries.add(end)

    unique = []
    seen = set()
    for match in ordered:
        token = match["token"]
        if token in seen:
            continue
        if token in range_boundaries:
            continue
        seen.add(token)
        unique.append(token)
    return unique


def extract_generation_tokens(text: str):
    compact = re.sub(r"\s+", "", text)
    compact = compact.replace("年2円", "年2回").replace("年3円", "年3回")
    found = []
    for match in re.finditer(r"年[0-9一二三四五六七八九十]+(?:[、,～][0-9一二三四五六七八九十]+)?[回化]", compact):
        token = match.group(0).replace(",", "、")
        if token not in found:
            found.append(token)
    return found


def summarize_emergence(ecology_text: str) -> str:
    text = normalize_ocr_text(ecology_text)
    if not text:
        return ""
    if any(marker in text for marker in ("一年中", "ほぼ周年", "周年", "通年", "年中")):
        return "一年中"
    months = extract_month_tokens(text)
    if months:
        return "、".join(months)
    generations = extract_generation_tokens(text)
    if generations:
        return "、".join(generations)
    return ""


def load_notes():
    with NOTES_CSV.open(encoding="utf-8-sig", newline="") as f:
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


def choose_best_candidate(candidates):
    def key(row):
        months = len(row["emergence"].split("、")) if row["emergence"] else 0
        return (
            months,
            1 if row["match_kind"] == "scientific" else 0,
            row["score"],
            len(row["ecology"]),
        )

    return max(candidates, key=key)


def main():
    parser = argparse.ArgumentParser(description="Extract butterfly emergence timing from 日本産蝶類標準図鑑")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--pages-dir", type=Path, default=None)
    parser.add_argument("--halves-dir", type=Path, default=None)
    parser.add_argument("--ocr-jsonl", type=Path, default=None)
    parser.add_argument("--report", type=Path, default=REPORT_JSON)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pdf_path = args.pdf
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    with tempfile.TemporaryDirectory(prefix="butterfly-emergence-") as temp_dir:
        temp_root = Path(temp_dir)
        pages_dir = args.pages_dir or (temp_root / "pages")
        halves_dir = args.halves_dir or (temp_root / "halves")
        ocr_jsonl = args.ocr_jsonl or (temp_root / "ocr.jsonl")

        _ = pages_dir
        half_paths = render_half_pages(pdf_path, halves_dir, args.dpi)
        run_ocr(half_paths, ocr_jsonl)

        butterflies = butterfly_rows()
        note_rows = load_notes()
        existing_emergence = {
            row["insect_id"]
            for row in note_rows
            if row["note_type"] == "出現時期"
        }
        existing_keys = {
            (row["insect_id"], row["note_type"], row.get("content", ""), row.get("reference", ""))
            for row in note_rows
        }

        items = logical_pages(load_ocr_pages(ocr_jsonl))
        candidates_by_id = defaultdict(list)
        unmatched_pages = []

        for item in items:
            if not item["is_explanation"]:
                continue
            if item["is_supplemental"]:
                continue
            blocks = extract_species_blocks(item, butterflies)
            if not blocks:
                matched = identify_species(item, butterflies)
                if matched:
                    blocks = [
                        {
                            "insect": matched["insect"],
                            "match_kind": matched["match_kind"],
                            "score": matched["score"],
                            "match_line": matched["match_line"],
                            "page": item["page"],
                            "side": item["side"],
                            "block_text": item["text"],
                        }
                    ]
            if not blocks:
                unmatched_pages.append(
                    {
                        "page": item["page"],
                        "side": item["side"],
                        "top_lines": item["top_lines"][:6],
                    }
                )
                continue
            for block in blocks:
                ecology = extract_ecology_section(block["block_text"])
                emergence = summarize_emergence(ecology)
                if not emergence and TIMING_CUE_RE.search(block["block_text"]):
                    emergence = summarize_emergence(block["block_text"])
                record = {
                    "page": block["page"],
                    "side": block["side"],
                    "name": block["insect"]["name"],
                    "insect_id": block["insect"]["insect_id"],
                    "scientific": block["insect"]["scientific"],
                    "match_kind": block["match_kind"],
                    "score": block["score"],
                    "match_line": block["match_line"],
                    "ecology": ecology or block["block_text"][:800],
                    "emergence": emergence,
                }
                candidates_by_id[record["insect_id"]].append(record)

        additions = []
        unresolved = []
        id_gen = next_note_id(note_rows)

        for butterfly in butterflies:
            insect_id = butterfly["insect_id"]
            candidates = candidates_by_id.get(insect_id, [])
            if not candidates:
                unresolved.append(
                    {
                        "name": butterfly["name"],
                        "insect_id": insect_id,
                        "reason": "no_page_match",
                    }
                )
                continue
            best = choose_best_candidate(candidates)
            if not best["emergence"]:
                unresolved.append(
                    {
                        "name": butterfly["name"],
                        "insect_id": insect_id,
                        "reason": "no_emergence_extracted",
                        "page": best["page"],
                        "side": best["side"],
                        "ecology": best["ecology"][:240],
                    }
                )
                continue
            if insect_id in existing_emergence:
                continue
            key = (insect_id, "出現時期", best["emergence"], REFERENCE)
            if key in existing_keys:
                continue
            additions.append(
                {
                    "record_id": next(id_gen),
                    "insect_id": insect_id,
                    "note_type": "出現時期",
                    "content": best["emergence"],
                    "reference": REFERENCE,
                    "page": str(best["page"]),
                    "year": "",
                }
            )
            existing_keys.add(key)

        if additions and not args.dry_run:
            merged = note_rows + additions
            with NOTES_CSV.open("w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=["record_id", "insect_id", "note_type", "content", "reference", "page", "year"],
                    lineterminator="\r\n",
                )
                writer.writeheader()
                writer.writerows(merged)

        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(
                {
                    "reference": REFERENCE,
                    "pdf": str(pdf_path),
                    "butterfly_count": len(butterflies),
                    "logical_pages": len(items),
                    "matched_species": len(candidates_by_id),
                    "added_count": len(additions),
                    "unresolved_count": len(unresolved),
                    "added_preview": additions[:30],
                    "candidate_preview": [
                        choose_best_candidate(rows)
                        for _, rows in list(candidates_by_id.items())[:30]
                    ],
                    "unresolved_preview": unresolved[:80],
                    "unmatched_page_preview": unmatched_pages[:40],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        print(
            f"butterflies={len(butterflies)} matched_species={len(candidates_by_id)} "
            f"added={len(additions)} unresolved={len(unresolved)} dry_run={args.dry_run}"
        )
        try:
            report_label = args.report.relative_to(BASE)
        except ValueError:
            report_label = args.report
        print(f"wrote {report_label}")


if __name__ == "__main__":
    main()
