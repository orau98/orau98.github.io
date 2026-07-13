#!/usr/bin/env python3
"""Extract structured plant profile facts from a scanned "日本の野生植物" PDF.

This script intentionally extracts short factual fields instead of copying long
book text. OCR page text is cached outside the repo by default so repeated runs
do not make the working tree heavy.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF
from Foundation import NSData
from Quartz import CGImageSourceCreateImageAtIndex, CGImageSourceCreateWithData
import Vision


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "work" / "wildplant_profile_candidates.csv"
DEFAULT_REPORT = ROOT / "work" / "wildplant_profile_extraction_report.json"
DEFAULT_CACHE_ROOT = Path.home() / "Codex_offload" / "wildplant_ocr_cache"

FIELDNAMES = [
    "profile_id",
    "plant_name",
    "scientific_name",
    "family",
    "family_latin",
    "genus_jp",
    "genus_scientific",
    "habit",
    "height",
    "flower_period",
    "distribution",
    "habitat",
    "similar_taxa",
    "distinguishing_features",
    "printed_page",
    "source",
    "page",
    "extraction_method",
]

FAMILY_RE = re.compile(r"([一-龯ぁ-んァ-ヶー]+科)\s*([A-Z][A-Z]+ACEAE)\b")
GENUS_RE = re.compile(r"[【\[]?\s*\d+\s*[】\]]\s*([一-龯ぁ-んァ-ヶー]+属)\s+([A-Z][A-Za-z-]+)")
ENTRY_RE = re.compile(
    r"(?P<num>[0-9０-９]{1,3})[.．]\s*"
    r"(?P<name>[一-龯ぁ-んァ-ヶー]+(?:[ \u3000]+[一-龯ぁ-んァ-ヶー]+)?)"
    r"(?:\s*[（(〔\[［【][^）)\]〕］】\n]{1,160}[）)\]〕］】])?\s+"
    r"(?P<sci>[A-Za-z][A-Za-z-]+(?:\s+(?:[×x]\s*)?[a-z][A-Za-z-]+)"
    r"(?:\s+(?:var\.|subsp\.|f\.)\s+[a-z][A-Za-z-]+)?)"
)
HABIT_RE = re.compile(
    r"((?:常緑|落葉|多年生|一年生|二年生|寄生性|浮遊性|つる性|着生|海岸性|湿生)?"
    r"(?:高木|小高木|低木|多年草|一年草|二年草|草本|水草|つる草|藤本|木本))"
)
HEIGHT_RE = re.compile(
    r"(?:全体の高さ|高さ|樹高)(?:は|が)?(?:約)?\s*"
    r"([0-9０-９]+(?:[.．][0-9０-９]+)?(?:[ー－〜～\-][0-9０-９]+(?:[.．][0-9０-９]+)?)?\s*(?:m|cm|mm))"
)
FLOWER_RE = re.compile(r"花期は([^。．]{1,40})")

PLANT_NAME_CORRECTIONS = {
    "アプラチャン": "アブラチャン",
    "ショウプ": "ショウブ",
    "キショウプ": "キショウブ",
    "ビャクプ": "ビャクブ",
    "ムサシアプミ": "ムサシアブミ",
    "スプタ": "スブタ",
    "セトヤナギスプタ": "セトヤナギスブタ",
    "マルミスプタ": "マルミスブタ",
    "ミカワスプタ": "ミカワスブタ",
    "ヤナギスプタ": "ヤナギスブタ",
    "イプキ": "イブキ",
    "マツプサ": "マツブサ",
    "アリマウマノススクサ": "アリマウマノスズクサ",
    "コウシュンウマノススクサ": "コウシュンウマノスズクサ",
}


@dataclass
class ParseState:
    family: str = ""
    family_latin: str = ""
    genus_jp: str = ""
    genus_scientific: str = ""


def parse_page_spec(spec: str | None, page_count: int) -> list[int]:
    if not spec:
        return list(range(1, page_count + 1))
    pages: set[int] = set()
    for part in spec.split(","):
        token = part.strip()
        if not token:
            continue
        if "-" in token:
            start_s, end_s = token.split("-", 1)
            start, end = int(start_s), int(end_s)
            pages.update(range(start, end + 1))
        else:
            pages.add(int(token))
    return [p for p in sorted(pages) if 1 <= p <= page_count]


def cache_dir_for(pdf_path: Path, cache_root: Path) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", pdf_path.stem).strip("_") or "wildplants"
    return cache_root / safe


def ocr_image_data(image_bytes: bytes) -> str:
    ns_data = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    image_source = CGImageSourceCreateWithData(ns_data, None)
    if not image_source:
        return ""
    cg_image = CGImageSourceCreateImageAtIndex(image_source, 0, None)
    if not cg_image:
        return ""

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["ja-JP", "en-US"])
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(False)

    success = handler.performRequests_error_([request], None)
    if not success[0]:
        return ""

    lines: list[str] = []
    for observation in request.results() or []:
        candidates = observation.topCandidates_(1)
        if candidates and len(candidates) > 0:
            lines.append(str(candidates[0].string()))
    return "\n".join(lines)


def ocr_page(doc: fitz.Document, page_number: int, dpi: int) -> str:
    page = doc[page_number - 1]
    pix = page.get_pixmap(dpi=dpi)
    return ocr_image_data(pix.tobytes("png"))


def ocr_half_page(doc: fitz.Document, page_number: int, side: str, dpi: int) -> str:
    page = doc[page_number - 1]
    rect = page.rect
    midpoint = rect.x0 + rect.width / 2
    clip = (
        fitz.Rect(rect.x0, rect.y0, midpoint, rect.y1)
        if side == "left"
        else fitz.Rect(midpoint, rect.y0, rect.x1, rect.y1)
    )
    pix = page.get_pixmap(dpi=dpi, clip=clip, alpha=False)
    return ocr_image_data(pix.tobytes("png"))


def load_or_ocr_pages(
    pdf_path: Path,
    pages: list[int],
    cache_dir: Path,
    dpi: int,
    force_ocr: bool = False,
    split_spreads: bool = False,
    printed_pages: set[int] | None = None,
) -> list[tuple[int, int | None, str, bool]]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    results: list[tuple[int, int | None, str, bool]] = []
    for index, page_number in enumerate(pages, 1):
        parts = (
            [
                ("left", 2 * page_number - 2),
                ("right", 2 * page_number - 1),
            ]
            if split_spreads
            else [("full", None)]
        )
        for side, printed_page in parts:
            if printed_pages is not None and printed_page not in printed_pages:
                continue
            cache_name = (
                f"page-{page_number:04d}-{side}-printed-{printed_page:04d}.txt"
                if split_spreads
                else f"page-{page_number:04d}.txt"
            )
            cache_path = cache_dir / cache_name
            if cache_path.exists() and not force_ocr:
                text = cache_path.read_text(encoding="utf-8")
                results.append((page_number, printed_page, text, True))
                continue
            text = (
                ocr_half_page(doc, page_number, side, dpi)
                if split_spreads
                else ocr_page(doc, page_number, dpi)
            )
            cache_path.write_text(text, encoding="utf-8")
            results.append((page_number, printed_page, text, False))
            page_label = f"PDF p.{page_number} / p.{printed_page}" if split_spreads else f"PDF p.{page_number}"
            print(f"  OCR {page_label} ({index}/{len(pages)}): {len(text)} chars", flush=True)
    doc.close()
    return results


def clean_text(value: str) -> str:
    value = (value or "").replace("\u3000", " ")
    value = value.replace("．", ".").replace("－", "-").replace("〜", "ー")
    value = re.sub(r"\s+", " ", value)
    return value.strip(" 、。")


def clean_scientific_name(value: str) -> str:
    value = clean_text(value)
    value = value.replace(" x ", " × ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_plant_name(value: str) -> str:
    value = clean_text(value)
    previous = None
    while value != previous:
        previous = value
        value = re.sub(r"([一-龯ぁ-んァ-ヶー])\s+([一-龯ぁ-んァ-ヶー])", r"\1\2", value)
    return PLANT_NAME_CORRECTIONS.get(value, value)


def clean_genus_name(value: str) -> str:
    value = clean_text(value)
    value = re.sub(r"(?<=[a-z])L$", "", value)
    return value


def sentence_parts(text: str) -> list[str]:
    normalized = clean_text(text)
    return [part.strip(" 、") for part in re.split(r"[。．]", normalized) if part.strip()]


def shorten_fact(value: str, max_chars: int = 180) -> str:
    value = clean_text(value)
    if len(value) <= max_chars:
        return value
    return value[:max_chars].rstrip(" 、") + "..."


def extract_distribution(text: str) -> str:
    for sentence in sentence_parts(text):
        if "分布" not in sentence and "見られる" not in sentence:
            continue
        if not re.search(r"北海道|本州|四国|九州|琉球|奄美|沖縄|小笠原|台湾|中国|韓国|朝鮮|東南アジア|インド|世界|北アメリカ", sentence):
            continue
        return shorten_fact(sentence, 220)
    return ""


def extract_habitat(text: str) -> str:
    for sentence in sentence_parts(text):
        if re.search(r"生え|自生|生育|群生|野生化", sentence):
            hit = re.search(r"生え|自生|生育|群生|野生化", sentence)
            if hit:
                before_hit = sentence[: hit.start()]
                pl_matches = list(re.finditer(r"[（(]PL\.[^）)]*[）)]", before_hit))
                if pl_matches:
                    sentence = sentence[pl_matches[-1].end() :].strip()
                    hit = re.search(r"生え|自生|生育|群生|野生化", sentence)
                    before_hit = sentence[: hit.start()] if hit else ""
                if "分布" in before_hit:
                    comma = max(before_hit.rfind("、"), before_hit.rfind("，"))
                    if comma >= 0:
                        sentence = sentence[comma + 1 :].strip()
                elif hit and "分布" in sentence[hit.end() :]:
                    sentence = sentence[: hit.end()].strip()
            sentence = re.sub(r"^[0-9０-９]+[.．]\s*", "", sentence).strip()
            sentence = re.sub(
                r"^[一-龯ぁ-んァ-ヶー]+(?:[［〔\[][^\]〕］]+[\]〕］])?\s+"
                r"[A-Z][^\u3040-\u30ff\u3400-\u9fff]*",
                "",
                sentence,
            ).strip()
            return shorten_fact(sentence, 180)
    return ""


def extract_habit(text: str) -> str:
    match = HABIT_RE.search(clean_text(text))
    return match.group(1) if match else ""


def extract_height(text: str) -> str:
    match = HEIGHT_RE.search(clean_text(text))
    return clean_text(match.group(1)) if match else ""


def extract_flower_period(text: str) -> str:
    match = FLOWER_RE.search(clean_text(text))
    if not match:
        return ""
    value = clean_text(match.group(1))
    value = re.split(r"[、，;；]", value)[0].strip()
    return value[:40].strip()


def is_valid_plant_name(name: str) -> bool:
    if not name or len(name) < 2:
        return False
    if name.endswith(("科", "属", "目")):
        return False
    if re.search(r"本文|図版|植物|花期|分布|高さ|ページ", name):
        return False
    return bool(re.search(r"[一-龯ぁ-んァ-ヶー]", name))


def iter_events(text: str):
    for match in FAMILY_RE.finditer(text):
        yield (match.start(), "family", match)
    for match in GENUS_RE.finditer(text):
        yield (match.start(), "genus", match)
    for match in ENTRY_RE.finditer(text):
        yield (match.start(), "entry", match)


def parse_profiles(
    page_texts: list[tuple[int, int | None, str, bool]],
    source_label: str,
    split_spreads: bool = False,
) -> list[dict]:
    state = ParseState()
    profiles: list[dict] = []

    for page_number, printed_page, raw_text, _from_cache in page_texts:
        if not raw_text.strip():
            continue
        text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
        events = sorted(iter_events(text), key=lambda item: item[0])
        for idx, (_pos, event_type, match) in enumerate(events):
            if event_type == "family":
                state.family = clean_text(match.group(1))
                state.family_latin = clean_text(match.group(2))
                state.genus_jp = ""
                state.genus_scientific = ""
                continue
            if event_type == "genus":
                state.genus_jp = clean_text(match.group(1))
                state.genus_scientific = clean_genus_name(match.group(2))
                continue

            plant_name = clean_plant_name(match.group("name"))
            if not is_valid_plant_name(plant_name):
                continue
            next_start = events[idx + 1][0] if idx + 1 < len(events) else len(text)
            segment = text[match.start():next_start]
            scientific_name = clean_scientific_name(match.group("sci"))
            profile = {
                "profile_id": "",
                "plant_name": plant_name,
                "scientific_name": scientific_name,
                "family": state.family,
                "family_latin": state.family_latin,
                "genus_jp": state.genus_jp,
                "genus_scientific": clean_genus_name(state.genus_scientific or scientific_name.split(" ")[0]),
                "habit": extract_habit(segment),
                "height": extract_height(segment),
                "flower_period": extract_flower_period(segment),
                "distribution": extract_distribution(segment),
                "habitat": extract_habitat(segment),
                "similar_taxa": "",
                "distinguishing_features": "",
                "printed_page": str(printed_page or ""),
                "source": source_label,
                "page": str(page_number),
                "extraction_method": (
                    "macOS Vision OCR (split spread) + rule parser"
                    if split_spreads
                    else "macOS Vision OCR + rule parser"
                ),
            }
            profiles.append(profile)
    return profiles


def read_existing_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def assign_profile_ids(rows: list[dict]) -> list[dict]:
    for index, row in enumerate(rows, 1):
        row["profile_id"] = f"plant-profile-{index:06d}"
    return rows


PROFILE_FACT_FIELDS = [
    "habit",
    "height",
    "flower_period",
    "distribution",
    "habitat",
    "distinguishing_features",
]
TAXON_FIELDS = ["family", "family_latin", "genus_jp", "genus_scientific"]


def profile_score(row: dict) -> int:
    score = 0
    score += sum(4 for field in PROFILE_FACT_FIELDS if clean_text(row.get(field, "")))
    score += 2 if clean_text(row.get("family", "")) and clean_text(row.get("family_latin", "")) else 0
    score += sum(1 for field in TAXON_FIELDS if clean_text(row.get(field, "")))
    return score


def merge_duplicate_profile(old: dict, new: dict) -> tuple[dict, bool]:
    old_score = profile_score(old)
    new_score = profile_score(new)
    if new_score > old_score:
        winner = {field: new.get(field, "") or old.get(field, "") for field in FIELDNAMES}
        winner["profile_id"] = old.get("profile_id", "")
        return winner, winner != old

    changed = False
    merged = dict(old)
    for field in FIELDNAMES:
        if field == "profile_id":
            continue
        if not merged.get(field) and new.get(field):
            merged[field] = new[field]
            changed = True
    return merged, changed


def merge_rows(existing: list[dict], extracted: list[dict]) -> tuple[list[dict], int, int]:
    merged: dict[tuple[str, str, str], dict] = {}
    for row in existing:
        key = (
            clean_text(row.get("plant_name", "")),
            clean_scientific_name(row.get("scientific_name", "")),
            clean_text(row.get("source", "")),
        )
        if key[0]:
            merged[key] = {field: row.get(field, "") for field in FIELDNAMES}

    added = 0
    updated = 0
    for row in extracted:
        key = (row["plant_name"], row["scientific_name"], row["source"])
        payload = {field: row.get(field, "") for field in FIELDNAMES}
        if key in merged:
            merged_row, changed = merge_duplicate_profile(merged[key], payload)
            if changed:
                merged[key] = merged_row
                updated += 1
            continue
        merged[key] = payload
        added += 1

    rows = sorted(
        merged.values(),
        key=lambda r: (clean_text(r.get("source", "")), int(r.get("page") or 0), clean_text(r.get("plant_name", ""))),
    )
    return assign_profile_ids(rows), added, updated


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate review candidates from scanned wild-plant PDF pages (never public data directly)"
    )
    parser.add_argument("pdf", help="Source PDF path")
    parser.add_argument("--pages", help="Page range, e.g. 34-75,101")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output plant profile CSV")
    parser.add_argument("--report", default=str(DEFAULT_REPORT), help="Extraction report JSON")
    parser.add_argument("--cache-dir", help="OCR text cache directory")
    parser.add_argument("--source-label", default="日本の野生植物 第1巻", help="Source label stored in CSV")
    parser.add_argument("--dpi", type=int, default=220, help="OCR render DPI")
    parser.add_argument("--force-ocr", action="store_true", help="Re-run OCR even when cached text exists")
    parser.add_argument(
        "--split-spreads",
        action="store_true",
        help="OCR the left and right book pages separately and store the printed page number",
    )
    parser.add_argument(
        "--printed-pages",
        help="Printed book page range used with --split-spreads, e.g. 33-608",
    )
    parser.add_argument("--replace", action="store_true", help="Replace output instead of merging")
    parser.add_argument("--replace-source", action="store_true", help="Replace existing rows for the same source label")
    parser.add_argument(
        "--require-profile-facts",
        action="store_true",
        help="Keep only rows with habit, height, flower period, distribution, or habitat facts",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf).expanduser()
    if not pdf_path.is_absolute():
        pdf_path = ROOT / pdf_path
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    resolved_output = output_path.resolve()
    forbidden_roots = [(ROOT / "normalized_data").resolve(), (ROOT / "public").resolve()]
    if any(resolved_output == root or root in resolved_output.parents for root in forbidden_roots):
        print(
            "Refusing to write OCR candidates into normalized_data/ or public/. "
            "Review the original PDF and apply an approved source-audit ledger instead.",
            file=sys.stderr,
        )
        return 2

    doc = fitz.open(str(pdf_path))
    page_count = doc.page_count
    doc.close()
    pages = parse_page_spec(args.pages, page_count)
    if not pages:
        print("No pages selected.", file=sys.stderr)
        return 1

    cache_dir = Path(args.cache_dir).expanduser() if args.cache_dir else cache_dir_for(pdf_path, DEFAULT_CACHE_ROOT)
    if not cache_dir.is_absolute():
        cache_dir = ROOT / cache_dir

    print(f"[wildplants] pdf={pdf_path}")
    print(f"[wildplants] pages={pages[0]}-{pages[-1]} ({len(pages)} pages)")
    print(f"[wildplants] cache={cache_dir}")
    printed_pages = None
    if args.printed_pages:
        if not args.split_spreads:
            parser.error("--printed-pages requires --split-spreads")
        printed_pages = set(parse_page_spec(args.printed_pages, page_count * 2))
    page_texts = load_or_ocr_pages(
        pdf_path,
        pages,
        cache_dir,
        args.dpi,
        args.force_ocr,
        args.split_spreads,
        printed_pages,
    )
    extracted = parse_profiles(page_texts, args.source_label, args.split_spreads)
    raw_extracted = len(extracted)
    if args.require_profile_facts:
        extracted = [
            row
            for row in extracted
            if any(clean_text(row.get(field, "")) for field in PROFILE_FACT_FIELDS)
        ]

    existing = [] if args.replace else read_existing_rows(output_path)
    if args.replace_source and not args.replace:
        source_label = clean_text(args.source_label)
        existing = [row for row in existing if clean_text(row.get("source", "")) != source_label]
    rows, added, updated = merge_rows(existing, extracted)
    write_csv(output_path, rows)

    report = {
        "pdf": str(pdf_path),
        "source_label": args.source_label,
        "pages": pages,
        "printed_pages": sorted(printed_pages) if printed_pages is not None else [],
        "split_spreads": args.split_spreads,
        "output": str(output_path),
        "cache_dir": str(cache_dir),
        "extracted": len(extracted),
        "raw_extracted": raw_extracted,
        "require_profile_facts": args.require_profile_facts,
        "replace_source": args.replace_source,
        "added": added,
        "updated": updated,
        "total_rows": len(rows),
        "cached_pages": sum(1 for _page, _printed, _text, from_cache in page_texts if from_cache),
        "ocr_pages": sum(1 for _page, _printed, _text, from_cache in page_texts if not from_cache),
    }
    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = ROOT / report_path
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[wildplants] extracted={len(extracted)} added={added} updated={updated} total={len(rows)}")
    print("[wildplants] candidates only: original-PDF audit is required before publication")
    print(f"[wildplants] wrote {output_path}")
    print(f"[wildplants] report {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
