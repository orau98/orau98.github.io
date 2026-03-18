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
OCR_JSONL = BASE / "reports" / "zukan2_ocr.jsonl"
REPORT_JSON = BASE / "reports" / "zukan2_missing_notes_audit.json"
REPORT_CSV = BASE / "reports" / "zukan2_missing_notes_candidates.csv"
REFERENCE = "日本産蛾類標準図鑑2"

EXCLUDE_FAMILIES = ("カミキリムシ", "ハムシ", "タマムシ", "アブラムシ", "セセリ", "シジミ", "タテハ", "アゲハ", "シロチョウ", "ジャノメ")


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("［", "[").replace("］", "]")
    text = text.replace("　", " ")
    text = text.replace("~", "～").replace("〜", "～")
    text = re.sub(r"(?<=\d)-(?=\d)", "～", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def load_pages():
    pages = []
    with OCR_JSONL.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            path = Path(obj["path"])
            m = re.search(r"page-(\d+)\.png$", path.name)
            if not m:
                continue
            pages.append(
                {
                    "page": int(m.group(1)),
                    "text": normalize_text(obj["text"]),
                }
            )
    return sorted(pages, key=lambda row: row["page"])


def load_insects():
    rows = {}
    with INSECTS_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            family_jp = row.get("family_jp", "")
            if any(token in family_jp for token in EXCLUDE_FAMILIES):
                continue
            iid = row["insect_id"]
            rows[iid] = {
                "name": row.get("japanese_name", "").strip(),
                "scientific": row.get("scientific_name", "").strip(),
                "genus_species": " ".join(
                    part for part in [row.get("genus", "").strip(), row.get("species", "").strip()] if part
                ),
                "species_token": row.get("species", "").strip(),
            }
    return rows


def load_status():
    host_refs = defaultdict(list)
    book2_note_types = defaultdict(set)
    note_types_any = defaultdict(set)
    note_contents = defaultdict(list)
    with HOSTPLANTS_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("reference") != REFERENCE:
                continue
            host_refs[row["insect_id"]].append(row)
    with NOTES_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            note_types_any[row["insect_id"]].add(row["note_type"])
            if row.get("reference") != REFERENCE:
                continue
            book2_note_types[row["insect_id"]].add(row["note_type"])
            note_contents[row["insect_id"]].append(row)
    return host_refs, book2_note_types, note_types_any, note_contents


def block_name_hits(page_text: str, targets):
    name_to_iid = {info["name"]: iid for iid, info in targets.items()}
    hits = []
    offset = 0
    for line in page_text.splitlines(keepends=True):
        stripped = line.strip()
        for name, iid in name_to_iid.items():
            if stripped == name or stripped.startswith(f"{name} ") or stripped.startswith(f"{name}("):
                pos = offset + line.find(name)
                hits.append((pos, iid, name))
        offset += len(line)
    return sorted(hits)


def choose_page_block(iid, info, pages, page_hits):
    name = info["name"]
    genus_species = info["genus_species"]
    scientific = info["scientific"]
    species_token = info["species_token"]
    candidates = []
    for entry in pages:
        page_text = entry["text"]
        hits = page_hits[entry["page"]]
        header_positions = [hit_pos for hit_pos, other_iid, _ in hits if other_iid == iid]
        if not header_positions:
            fallback_positions = []
            start = 0
            while True:
                pos = page_text.find(name, start)
                if pos < 0:
                    break
                fallback_positions.append(pos)
                start = pos + len(name)
            header_positions = fallback_positions
        if not header_positions:
            scientific_hits = []
            search_terms = [term for term in [genus_species, scientific.split("(")[0].strip(), species_token] if term]
            seen_terms = set()
            for term in search_terms:
                if term in seen_terms:
                    continue
                seen_terms.add(term)
                start = 0
                while True:
                    pos = page_text.find(term, start)
                    if pos < 0:
                        break
                    line_start = page_text.rfind("\n", 0, pos)
                    if line_start < 0:
                        line_start = 0
                    else:
                        line_start += 1
                    scientific_hits.append(line_start)
                    start = pos + len(term)
            header_positions = sorted(set(scientific_hits))

        for pos in header_positions:
            window = page_text[pos : pos + 240]
            sci_score = 0
            if any(hit_pos == pos and other_iid == iid for hit_pos, other_iid, _ in hits):
                sci_score += 3
            if genus_species and genus_species in window:
                sci_score += 2
            elif genus_species and genus_species in page_text:
                sci_score += 1
            if scientific and scientific.split("(")[0].strip() in page_text:
                sci_score += 1
            if species_token and species_token in window:
                sci_score += 1

            next_positions = [hit_pos for hit_pos, other_iid, _ in hits if hit_pos > pos and other_iid != iid]
            end = min(next_positions) if next_positions else len(page_text)
            block = page_text[pos:end]
            if end == len(page_text):
                next_page = next((row for row in pages if row["page"] == entry["page"] + 1), None)
                if next_page:
                    block += "\n" + next_page["text"][:700]
            candidates.append((sci_score, entry["page"], block))
    if not candidates:
        return None
    candidates.sort(key=lambda row: (-row[0], row[1]))
    return {"page": candidates[0][1], "block": candidates[0][2], "score": candidates[0][0]}


def extract_section(block: str, markers, stop_markers):
    start_match = None
    for pattern in markers:
        match = re.search(pattern, block)
        if match and (start_match is None or match.start() < start_match.start()):
            start_match = match
    if not start_match:
        return ""
    tail = block[start_match.end() :]
    stops = []
    for pattern in stop_markers:
        match = re.search(pattern, tail)
        if match:
            stops.append(match.start())
    section = tail[: min(stops)] if stops else tail
    section = normalize_text(section)
    section = re.sub(r"\n+", " ", section)
    section = re.sub(r"\s+", " ", section).strip(" .。・、,")
    return section


def extract_emergence(text: str) -> str:
    if not text:
        return ""
    text = normalize_text(text)
    text = re.sub(r"(?<=\d)\.(?=\d)", "月、", text)
    text = re.sub(r"(?<=\d),(?=\d)", "月、", text)
    sentences = [seg.strip() for seg in re.split(r"[。．]", text) if seg.strip()]
    month_sentence = next((seg for seg in sentences if "月" in seg or "通年" in seg), text)
    patterns = [
        r"(\d{1,2}月(?:[上中下]旬)?から\d{1,2}月(?:[上中下]旬)?まで)",
        r"(\d{1,2}月(?:[上中下]旬)?から\d{1,2}月(?:[上中下]旬)?頃)",
        r"(\d{1,2}月(?:[上中下]旬)?から\d{1,2}月(?:[上中下]旬)?)",
        r"(\d{1,2}月(?:[上中下]旬)?から)",
        r"((?:\d{1,2}～\d{1,2}月(?:[上中下]旬)?|\d{1,2}月(?:[上中下]旬)?)(?:[、と]\d{1,2}～\d{1,2}月(?:[上中下]旬)?|[、と]\d{1,2}月(?:[上中下]旬)?)*)",
        r"((?:\d{1,2}月(?:[上中下]旬)?)(?:[、と]\d{1,2}月(?:[上中下]旬)?)+)",
        r"(\d{1,2}～\d{1,2}月(?:[上中下]旬)?)",
        r"(\d{1,2}月(?:[上中下]旬)?)",
        r"(通年)",
    ]
    for pattern in patterns:
        match = re.search(pattern, month_sentence)
        if match:
            value = match.group(1).strip(" 。、,")
            value = re.sub(r"(?<=\d) ?～ ?(?=\d)", "～", value)
            value = value.replace("・", "、")
            if "まで" in value or len(re.findall(r"\d{1,2}月", value)) >= 2:
                value = value.replace("から", "～").replace("まで", "").replace("頃", "")
            value = re.sub(r"\s+", "", value)
            value = re.sub(r"(\d{1,2})～\1月", r"\1月", value)
            return value
    return ""


def extract_ecology(text: str) -> str:
    if not text:
        return ""
    sentences = [seg.strip() for seg in re.split(r"[。．]", text) if seg.strip()]
    kept = []
    for sentence in sentences:
        if "に出現" in sentence:
            continue
        if re.fullmatch(r"(通年|\d{1,2}月.*)", sentence):
            continue
        kept.append(sentence)
    ecology = "。".join(kept).strip()
    if ecology:
        ecology += "。"
    return ecology


def main():
    pages = load_pages()
    insects = load_insects()
    host_refs, book2_note_types, note_types_any, note_contents = load_status()

    target_ids = [iid for iid in host_refs if "出現時期" not in note_types_any.get(iid, set())]
    targets = {iid: insects[iid] for iid in target_ids if iid in insects and insects[iid]["name"]}

    page_hits = {entry["page"]: block_name_hits(entry["text"], targets) for entry in pages}

    results = []
    for iid, info in targets.items():
        chosen = choose_page_block(iid, info, pages, page_hits)
        if not chosen:
            results.append(
                {
                    "insect_id": iid,
                    "name": info["name"],
                    "scientific_name": info["scientific"],
                    "page": "",
                    "match_score": -1,
                    "candidate_emergence": "",
                    "candidate_ecology": "",
                    "existing_note_types": sorted(book2_note_types.get(iid, set())),
                    "existing_note_types_any": sorted(note_types_any.get(iid, set())),
                    "status": "page_not_found",
                }
            )
            continue

        block = chosen["block"]
        ecology_section = extract_section(
            block,
            markers=[r"[\[【]生[期観態糖間意]?[】\]]?"],
            stop_markers=[r"[\[【](?:奇|荷|寄|宿|商)主植物[】\]]?", r"[\[【]分類[】\]]?", r"[\[【]分布[】\]]?"],
        )
        host_section = extract_section(
            block,
            markers=[r"[\[【](?:奇|荷|寄|宿|商)主植物[】\]]?"],
            stop_markers=[r"[\[【]分類[】\]]?", r"[\[【]分布[】\]]?"],
        )
        candidate_emergence = extract_emergence(ecology_section)
        candidate_ecology = extract_ecology(ecology_section)

        status = "no_candidate"
        if candidate_emergence:
            status = "candidate_emergence"
        if host_section and not host_refs.get(iid):
            status = "candidate_host_only"

        results.append(
            {
                "insect_id": iid,
                "name": info["name"],
                "scientific_name": info["scientific"],
                "page": chosen["page"],
                "match_score": chosen["score"],
                "candidate_emergence": candidate_emergence,
                "candidate_ecology": candidate_ecology,
                "existing_note_types": sorted(book2_note_types.get(iid, set())),
                "existing_note_types_any": sorted(note_types_any.get(iid, set())),
                "existing_notes": note_contents.get(iid, []),
                "host_count": len(host_refs.get(iid, [])),
                "status": status,
                "ocr_block": block[:1200],
            }
        )

    REPORT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    with REPORT_CSV.open("w", encoding="utf-8", newline="") as f:
        fieldnames = [
            "insect_id",
            "name",
            "scientific_name",
            "page",
            "match_score",
            "candidate_emergence",
            "candidate_ecology",
            "host_count",
            "existing_note_types",
            "existing_note_types_any",
            "status",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            writer.writerow(
                {
                    **{key: row.get(key, "") for key in fieldnames},
                    "existing_note_types": ";".join(row.get("existing_note_types", [])),
                    "existing_note_types_any": ";".join(row.get("existing_note_types_any", [])),
                }
            )

    candidate_count = sum(1 for row in results if row["candidate_emergence"])
    print(f"targets={len(results)} candidate_emergence={candidate_count}")
    print(f"wrote {REPORT_JSON.relative_to(BASE)}")
    print(f"wrote {REPORT_CSV.relative_to(BASE)}")


if __name__ == "__main__":
    main()
