#!/usr/bin/env python3
"""甲虫目録サイトを参照してタマムシ科・カミキリムシ科・ハムシ科を同期する。

方針:
- 既存 insect_id は維持し、食草・生態情報の紐付けを壊さない
- 既存行は、同一タクソンと確定できる場合のみ分類/学名/和名を更新
- 参照側にのみ存在するタクソンは新規追加する
- ただし、既存に種レベルの行があり、参照側だけが亜種へ分割している場合は
  食草・生態情報の再配分ができないため自動分割せず、保留として報告する
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import subprocess
import time
import sys
from collections import defaultdict
from copy import deepcopy
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"
CACHE_DIR = REPORTS_DIR / "reference_cache"

REFERENCE_FAMILIES = [
    {
        "family": "Buprestidae",
        "family_jp": "タマムシ科",
        "url": "https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/17-%E3%82%BF%E3%83%9E%E3%83%A0%E3%82%B7%E7%A7%91/",
        "id_mode": "species_numeric",
    },
    {
        "family": "Cerambycidae",
        "family_jp": "カミキリムシ科",
        "url": "https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/131-%E3%82%AB%E3%83%9F%E3%82%AD%E3%83%AA%E3%83%A0%E3%82%B7%E7%A7%91/",
        "id_mode": "species_numeric",
    },
    {
        "family": "Chrysomelidae",
        "family_jp": "ハムシ科",
        "url": "https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/134-%E3%83%8F%E3%83%A0%E3%82%B7%E7%A7%91/",
        "id_mode": "species_H",
    },
]

JINA_PREFIX = "https://r.jina.ai/http://"
JP_NAME_RE = re.compile(r"^[ぁ-んァ-ヶー一-龯々ヵヶ・（）()／・ 　]+")
TAXON_LINE_RE = re.compile(r"^(\d+(?:-\d+)?)\s+(.+?)(?:\s*/\s*(.*))?$")
TRIBE_RE = re.compile(r"Tribe\s+([A-Za-z]+ini)")
SUBFAMILY_URL_RE = re.compile(r"\]\((https://[^ )]+)")
REFERENCE_FAMILY_SET = {item["family"] for item in REFERENCE_FAMILIES}


def fetch_text(url: str, expect: str | list[str] | tuple[str, ...] | None = None, retries: int = 3) -> str:
    mirrored = JINA_PREFIX + url
    last_error: Exception | None = None
    markers = []
    if isinstance(expect, (list, tuple)):
        markers = [str(m).lower() for m in expect if str(m).strip()]
    elif expect:
        markers = [str(expect).lower()]
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha1(url.encode("utf-8")).hexdigest()
    cache_path = CACHE_DIR / f"{cache_key}.txt"

    def matches_markers(text: str) -> bool:
        if not markers:
            return True
        text_lower = text.lower()
        return any(marker in text_lower for marker in markers)

    if cache_path.exists():
        cached = cache_path.read_text(encoding="utf-8")
        if matches_markers(cached):
            return cached

    for attempt in range(retries):
        try:
            result = subprocess.run(
                ["curl", "-L", "--max-time", "30", "-sS", mirrored],
                check=True,
                capture_output=True,
                text=True,
            )
            text = result.stdout
            if "42903" in text or "RateLimitTriggeredError" in text:
                raise RuntimeError("rate limited by jina mirror")
            if not matches_markers(text):
                raise RuntimeError(f"expected marker not found: {markers}")
            cache_path.write_text(text, encoding="utf-8")
            return text
        except Exception as exc:  # pragma: no cover - network instability handling
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(5 * (attempt + 1))
                continue
    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def clean_scientific_segment(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"[_*`]", "", value)
    value = value.replace("\u00a0", " ")
    value = normalize_spaces(value)
    return value.strip(" /")


def extract_japanese_name(value: str) -> str:
    value = (value or "").lstrip()
    match = JP_NAME_RE.match(value)
    if not match:
        return ""
    name = normalize_spaces(match.group(0))
    return name.strip(" ;；、,")


def parse_scientific_name(scientific_name: str) -> dict:
    scientific_name = clean_scientific_segment(scientific_name)
    primary_name = scientific_name.split(";", 1)[0].strip()
    # Genus (Subgenus) species subspecies Author, 2024
    name_match = re.match(
        r"^(?P<genus>[A-Z][A-Za-z-]+)"
        r"(?: \((?P<subgenus>[^)]+)\))?"
        r"(?: (?P<species>[a-z][a-z-]+))?"
        r"(?: (?P<subspecies>[a-z][a-z-]+))?"
        r"(?: (?P<author_part>.*))?$",
        primary_name,
    )
    if not name_match:
        return {
            "scientific_name": scientific_name,
            "genus": "",
            "subgenus": "",
            "species": "",
            "subspecies": "",
            "author": "",
            "year": "",
        }

    author_part = normalize_spaces(name_match.group("author_part") or "")
    author = author_part
    year = ""
    year_match = re.search(r"(\d{4})\)?$", author_part)
    if year_match:
        year = year_match.group(1)
        author = author_part[: year_match.start()].rstrip(" ,(")
        if author_part.startswith("(") and author and not author.startswith("("):
            author = f"({author}"
        if author.startswith("(") and not author.endswith(")"):
            author = f"{author})"
    return {
        "scientific_name": scientific_name,
        "genus": (name_match.group("genus") or "").strip(),
        "subgenus": (name_match.group("subgenus") or "").strip(),
        "species": (name_match.group("species") or "").strip(),
        "subspecies": (name_match.group("subspecies") or "").strip(),
        "author": author.strip(),
        "year": year.strip(),
    }


def normalized_epithet(value: str) -> str:
    value = (value or "").strip().lower()
    return value if re.fullmatch(r"[a-z-]+", value) else ""


def parse_subfamily_line(line: str) -> dict | None:
    line = line.strip()
    if "[Subfamily " not in line:
        return None
    url_match = SUBFAMILY_URL_RE.search(line)
    if not url_match:
        return None
    display = line.split("[Subfamily ", 1)[1].split("](", 1)[0]
    latin = ""
    japanese = ""
    if " / " in display:
        left, japanese = display.split(" / ", 1)
        latin = left.split()[0]
    else:
        m = re.match(r"^(?P<latin>[A-Za-z]+).*?(?P<jp>[ぁ-んァ-ヶー一-龯々ヵヶ].*亜科)$", display)
        if m:
            latin = m.group("latin")
            japanese = m.group("jp")
    if not latin or not japanese:
        return None
    return {
        "latin": latin.strip(),
        "japanese": japanese.strip(),
        "url": url_match.group(1),
    }


def normalize_page_layout(text: str) -> str:
    if "Markdown Content:" in text:
        head, body = text.split("Markdown Content:", 1)
        prefix = head + "Markdown Content:\n"
    else:
        prefix = ""
        body = text
    body = body.replace("**備考** **Tribe ", "**備考**\n**Tribe ")
    body = re.sub(r"\s+\*\*Tribe ", "\n**Tribe ", body)
    body = re.sub(r"\s+\*\*Subtribe ", "\n**Subtribe ", body)
    body = re.sub(r"(?<!\n)(?<![A-Za-z])(\d+(?:-\d+)?\s+_)", r"\n\1", body)
    return prefix + body


def parse_taxon_line(line: str, family: str, family_jp: str, subfamily: str, subfamily_jp: str, tribe: str) -> dict | None:
    line = line.strip()
    match = TAXON_LINE_RE.match(line)
    if not match:
        return None
    reference_no = match.group(1)
    scientific_segment = clean_scientific_segment(match.group(2))
    if not scientific_segment:
        return None
    japanese_name = extract_japanese_name(match.group(3) or "")
    parsed_name = parse_scientific_name(scientific_segment)
    if not parsed_name["genus"] or not parsed_name["species"]:
        return None
    return {
        "reference_no": reference_no,
        "family": family,
        "family_jp": family_jp,
        "subfamily": subfamily,
        "subfamily_jp": subfamily_jp,
        "tribe": tribe,
        "tribe_jp": "",
        "japanese_name": japanese_name,
        **parsed_name,
    }


def fetch_reference_taxa(selected_families: set[str] | None = None) -> list[dict]:
    taxa: list[dict] = []
    for family_def in REFERENCE_FAMILIES:
        if selected_families and family_def["family"] not in selected_families:
            continue
        family_page = fetch_text(family_def["url"], expect=[family_def["family"], family_def["family_jp"]])
        subfamilies = []
        for line in family_page.splitlines():
            parsed = parse_subfamily_line(line)
            if parsed:
                subfamilies.append(parsed)
        if not subfamilies:
            raise RuntimeError(f"subfamilies not found for {family_def['family']}")

        for sub in subfamilies:
            page = fetch_text(sub["url"], expect=[sub["latin"], sub["japanese"]])
            page = normalize_page_layout(page)
            current_tribe = ""
            page_taxa_count = 0
            for raw_line in page.splitlines():
                line = raw_line.strip()
                if not line:
                    continue
                tribe_match = TRIBE_RE.search(line)
                if tribe_match:
                    current_tribe = tribe_match.group(1)
                parsed_taxon = parse_taxon_line(
                    line,
                    family=family_def["family"],
                    family_jp=family_def["family_jp"],
                    subfamily=sub["latin"],
                    subfamily_jp=sub["japanese"],
                    tribe=current_tribe,
                )
                if parsed_taxon:
                    taxa.append(parsed_taxon)
                    page_taxa_count += 1
            if page_taxa_count == 0:
                raise RuntimeError(f"no taxa parsed for {sub['url']}")
    return taxa


def exact_key(row: dict) -> tuple[str, str, str, str]:
    return (
        (row.get("family") or "").strip(),
        (row.get("genus") or "").strip().lower(),
        normalized_epithet(row.get("species") or ""),
        normalized_epithet(row.get("subspecies") or ""),
    )


def species_key(row: dict) -> tuple[str, str, str]:
    return (
        (row.get("family") or "").strip(),
        (row.get("genus") or "").strip().lower(),
        normalized_epithet(row.get("species") or ""),
    )


def japanese_key(row: dict) -> tuple[str, str]:
    return (
        (row.get("family") or "").strip(),
        normalize_spaces(row.get("japanese_name") or ""),
    )


def merge_old_name(target: dict, key: str, old_value: str):
    old_value = normalize_spaces(old_value)
    if not old_value:
        return
    existing = [v.strip() for v in (target.get(key) or "").split(";") if v.strip()]
    if old_value not in existing:
        existing.append(old_value)
        target[key] = "; ".join(existing)


def append_change_note(target: dict, message: str):
    message = normalize_spaces(message)
    if not message:
        return
    current = normalize_spaces(target.get("changes_since_standard") or "")
    if not current:
        target["changes_since_standard"] = message
        return
    if message in current:
        return
    target["changes_since_standard"] = f"{current} / {message}"


def normalize_row_scientific_fields(row: dict) -> bool:
    if (row.get("family") or "").strip() not in REFERENCE_FAMILY_SET:
        return False
    parsed = parse_scientific_name(row.get("scientific_name") or "")
    if not parsed["genus"] or not parsed["species"]:
        return False

    changed = False
    for key in ("scientific_name", "genus", "subgenus", "species", "subspecies", "author", "year"):
        new_value = parsed.get(key, "")
        if normalize_spaces(row.get(key) or "") != normalize_spaces(new_value):
            row[key] = new_value
            changed = True
    return changed


def normalize_row_change_fields(row: dict) -> bool:
    if (row.get("family") or "").strip() not in REFERENCE_FAMILY_SET:
        return False
    changes = normalize_spaces(row.get("changes_since_standard") or "")
    year = normalize_spaces(row.get("year") or "")
    if changes and year and changes == year and re.fullmatch(r"\d{4}", changes):
        row["changes_since_standard"] = ""
        return True
    return False


def update_row_from_reference(row: dict, ref: dict) -> bool:
    changed = False
    for key in ("family", "family_jp", "subfamily", "subfamily_jp", "tribe", "tribe_jp", "genus", "subgenus", "species", "subspecies", "author", "year"):
        new_value = ref.get(key, "")
        if normalize_spaces(row.get(key) or "") != normalize_spaces(new_value):
            row[key] = new_value
            changed = True

    if normalize_spaces(row.get("scientific_name") or "") != ref["scientific_name"]:
        old_scientific_name = clean_scientific_segment(row.get("scientific_name") or "")
        if old_scientific_name and old_scientific_name != ref["scientific_name"]:
            merge_old_name(row, "synonyms", old_scientific_name)
        row["scientific_name"] = ref["scientific_name"]
        changed = True

    current_jp = normalize_spaces(row.get("japanese_name") or "")
    new_jp = normalize_spaces(ref.get("japanese_name") or "")
    if new_jp and current_jp != new_jp:
        if current_jp:
            merge_old_name(row, "old_japanese_name", current_jp)
        row["japanese_name"] = new_jp
        changed = True

    normalize_row_scientific_fields(row)
    normalize_row_change_fields(row)
    return changed


def apply_reference_to_rows(rows: list[dict], reference_taxa: list[dict]) -> tuple[list[dict], dict]:
    normalized_existing = 0
    cleared_year_only_changes = 0
    for row in rows:
        if normalize_row_scientific_fields(row):
            normalized_existing += 1
        if normalize_row_change_fields(row):
            cleared_year_only_changes += 1

    exact_index: dict[tuple[str, str, str, str], list[int]] = defaultdict(list)
    species_index: dict[tuple[str, str, str], list[int]] = defaultdict(list)
    jp_index: dict[tuple[str, str], list[int]] = defaultdict(list)
    scheduled_exact_keys: set[tuple[str, str, str, str]] = set()
    scheduled_jp_keys: set[tuple[str, str]] = set()

    for idx, row in enumerate(rows):
        ek = exact_key(row)
        if ek[1] and ek[2]:
            exact_index[ek].append(idx)
            species_index[species_key(row)].append(idx)
        jk = japanese_key(row)
        if jk[1]:
            jp_index[jk].append(idx)

    next_numeric = 0
    next_h = 0
    for row in rows:
        iid = (row.get("insect_id") or "").strip()
        if iid.startswith("species-H"):
            m = re.match(r"^species-H(\d+)$", iid)
            if m:
                next_h = max(next_h, int(m.group(1)))
        elif iid.startswith("species-"):
            m = re.match(r"^species-(\d+)$", iid)
            if m:
                next_numeric = max(next_numeric, int(m.group(1)))

    report: dict[str, object] = {
        "normalized_existing_fields": normalized_existing,
        "cleared_year_only_changes": cleared_year_only_changes,
        "updated_existing": 0,
        "merged_by_japanese_name": 0,
        "added_new": 0,
        "split_conflicts": [],
        "name_only_matches": [],
        "added_ids": [],
        "family_additions": defaultdict(int),
        "family_updates": defaultdict(int),
    }

    additions_by_family: dict[str, list[dict]] = defaultdict(list)

    for ref in reference_taxa:
        ek = exact_key(ref)
        candidates = exact_index.get(ek, [])
        if candidates:
            idx = candidates[0]
            row = rows[idx]
            changed = update_row_from_reference(row, ref)
            if changed:
                report["updated_existing"] += 1
                report["family_updates"][ref["family"]] += 1
            continue

        sk = species_key(ref)
        same_species = species_index.get(sk, [])
        if ref.get("subspecies") and any(not (rows[i].get("subspecies") or "").strip() for i in same_species):
            report["split_conflicts"].append(
                {
                    "family": ref["family"],
                    "scientific_name": ref["scientific_name"],
                    "japanese_name": ref.get("japanese_name") or "",
                    "reason": "local species-level row exists; skipped subspecies split",
                }
            )
            continue

        if ek in scheduled_exact_keys:
            continue

        if ref.get("japanese_name"):
            jk = japanese_key(ref)
            jp_candidates = jp_index.get(jk, [])
            if len(jp_candidates) == 1:
                idx = jp_candidates[0]
                row = rows[idx]
                if update_row_from_reference(row, ref):
                    report["updated_existing"] += 1
                    report["merged_by_japanese_name"] += 1
                    report["family_updates"][ref["family"]] += 1
                exact_index[exact_key(row)].append(idx)
                species_index[species_key(row)].append(idx)
                continue
            if jk in jp_index or jk in scheduled_jp_keys:
                report["name_only_matches"].append(
                    {
                        "family": ref["family"],
                        "scientific_name": ref["scientific_name"],
                        "japanese_name": ref.get("japanese_name") or "",
                        "reason": "same japanese_name exists locally with different taxon key; skipped auto-merge",
                    }
                )
                continue

        fieldnames = list(rows[0].keys())
        new_row = {field: "" for field in fieldnames}
        if ref["family"] == "Chrysomelidae":
            next_h += 1
            new_row["insect_id"] = f"species-H{next_h:03d}"
        else:
            next_numeric += 1
            new_row["insect_id"] = f"species-{next_numeric}"

        for key in ("family", "family_jp", "subfamily", "subfamily_jp", "tribe", "tribe_jp", "genus", "subgenus", "species", "subspecies", "author", "year", "japanese_name", "scientific_name"):
            new_row[key] = ref.get(key, "")
        new_row["notes"] = "日本列島の甲虫全種目録(2026)参照。食草・生態情報は未入力。"
        additions_by_family[ref["family"]].append(new_row)
        report["added_new"] += 1
        report["family_additions"][ref["family"]] += 1
        report["added_ids"].append(new_row["insect_id"])
        scheduled_exact_keys.add(exact_key(new_row))
        if normalize_spaces(new_row.get("japanese_name") or ""):
            scheduled_jp_keys.add(japanese_key(new_row))

    split_species_annotated = 0
    split_groups: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for item in report["split_conflicts"]:
        parsed = parse_scientific_name(item["scientific_name"])
        if not parsed["genus"] or not parsed["species"]:
            continue
        key = (
            item["family"],
            parsed["genus"].strip().lower(),
            normalized_epithet(parsed["species"]),
        )
        if item["japanese_name"]:
            split_groups[key].append(item["japanese_name"])

    for (family, genus, species), names in split_groups.items():
        unique_names = []
        for name in names:
            if name and name not in unique_names:
                unique_names.append(name)
        if not unique_names:
            continue
        for row in rows:
            if (row.get("family") or "").strip() != family:
                continue
            if (row.get("genus") or "").strip().lower() != genus:
                continue
            if normalized_epithet(row.get("species") or "") != species:
                continue
            if normalized_epithet(row.get("subspecies") or ""):
                continue
            message = f"日本列島の甲虫全種目録(2026)では{'、'.join(f'「{name}」' for name in unique_names)}に細分。食草・生態情報の再配分は未実施。"
            before = normalize_spaces(row.get("changes_since_standard") or "")
            append_change_note(row, message)
            after = normalize_spaces(row.get("changes_since_standard") or "")
            if after != before:
                split_species_annotated += 1
            break
    report["split_species_annotated"] = split_species_annotated

    merged_rows = list(rows)
    for family in ("Cerambycidae", "Chrysomelidae", "Buprestidae"):
        inserts = additions_by_family.get(family, [])
        if not inserts:
            continue
        last_idx = max(i for i, row in enumerate(merged_rows) if (row.get("family") or "").strip() == family)
        merged_rows[last_idx + 1:last_idx + 1] = inserts

    report["family_additions"] = dict(report["family_additions"])
    report["family_updates"] = dict(report["family_updates"])
    return merged_rows, report


def load_csv(path: Path) -> tuple[list[str], list[dict]]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        return list(reader.fieldnames or []), rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_markdown_report(reference_taxa: list[dict], report: dict) -> str:
    family_counts: dict[str, int] = defaultdict(int)
    for row in reference_taxa:
        family_counts[row["family"]] += 1

    lines = [
        f"# 甲虫目録同期レポート（{date.today().isoformat()}）",
        "",
        "参照元:",
        "",
        "- https://japanesebeetles.jimdofree.com/目録/17-タマムシ科/",
        "- https://japanesebeetles.jimdofree.com/目録/131-カミキリムシ科/",
        "- https://japanesebeetles.jimdofree.com/目録/134-ハムシ科/",
        "",
        "## 実施結果",
        "",
        f"- 参照タクソン取得数: {len(reference_taxa)}",
        f"- 学名由来の列補正: {report.get('normalized_existing_fields', 0)}",
        f"- 年だけ残っていた変更メモの整理: {report.get('cleared_year_only_changes', 0)}",
        f"- 既存行更新: {report['updated_existing']}",
        f"- 同和名で既存行へ吸収: {report.get('merged_by_japanese_name', 0)}",
        f"- 新規追加: {report['added_new']}",
        f"- 亜種分割保留: {len(report['split_conflicts'])}",
        f"- 種レベル維持の注記追加: {report.get('split_species_annotated', 0)}",
        f"- 和名衝突で保留: {len(report['name_only_matches'])}",
        "",
        "## 科別件数",
        "",
    ]
    for family in ("Buprestidae", "Cerambycidae", "Chrysomelidae"):
        lines.append(
            f"- {family}: 参照 {family_counts.get(family, 0)}件 / 更新 {report['family_updates'].get(family, 0)}件 / 追加 {report['family_additions'].get(family, 0)}件"
        )
    if report["split_conflicts"]:
        lines.extend(["", "## 亜種分割保留（先頭20件）", ""])
        for row in report["split_conflicts"][:20]:
            lines.append(f"- {row['family']} {row['scientific_name']} / {row['japanese_name']} : {row['reason']}")
    if report["name_only_matches"]:
        lines.extend(["", "## 和名衝突保留（先頭20件）", ""])
        for row in report["name_only_matches"][:20]:
            lines.append(f"- {row['family']} {row['scientific_name']} / {row['japanese_name']} : {row['reason']}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="CSVへ反映する")
    parser.add_argument(
        "--targets",
        nargs="*",
        default=["normalized_data/insects.csv", "public/insects.csv"],
        help="更新対象CSV",
    )
    parser.add_argument(
        "--families",
        nargs="*",
        choices=[f["family"] for f in REFERENCE_FAMILIES],
        help="処理する科を限定する",
    )
    args = parser.parse_args()

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    selected_families = set(args.families or [])
    reference_taxa = fetch_reference_taxa(selected_families or None)

    all_reports = {}
    for target_rel in args.targets:
        target = ROOT / target_rel
        fieldnames, rows = load_csv(target)
        merged_rows, report = apply_reference_to_rows(deepcopy(rows), reference_taxa)
        all_reports[target_rel] = report
        if args.apply:
            write_csv(target, fieldnames, merged_rows)

    report_path = REPORTS_DIR / "beetle-reference-sync-2026-03-17.md"
    md = build_markdown_report(reference_taxa, all_reports[args.targets[0]])
    report_path.write_text(md, encoding="utf-8")
    json_path = REPORTS_DIR / "beetle-reference-sync-2026-03-17.json"
    json_path.write_text(json.dumps({"reference_taxa_count": len(reference_taxa), "reports": all_reports}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
