#!/usr/bin/env python3
"""Audit OCR-derived wild plant profiles for likely hallucinations.

The extractor intentionally keeps short factual fields only, but OCR can still
produce plausible-looking wrong names, families, or duplicate figure captions.
This script cross-checks the generated CSV against the cached OCR page text,
YList-derived site taxonomy, and duplicate rows for the same Japanese name.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "normalized_data" / "plant_profiles.csv"
DEFAULT_YLIST = ROOT / "public" / "assets" / "data-lite" / "ylist-lite.json"
DEFAULT_EXTRACTION_REPORT = ROOT / "reports" / "wildplant_profile_extraction_report.json"
DEFAULT_EXTRACTION_REPORT_PATTERN = "wildplant_profile_extraction_report*.json"
DEFAULT_CSV_REPORT = ROOT / "reports" / "wildplant_profile_factcheck.csv"
DEFAULT_MD_REPORT = ROOT / "reports" / "wildplant_profile_factcheck.md"
DEFAULT_JSON_REPORT = ROOT / "reports" / "wildplant_profile_factcheck_summary.json"
DEFAULT_TAXONOMY_REVIEW = (
    ROOT / "data" / "source_audits" / "japanese-wild-plants-taxonomy-followup-2026-07-12.csv"
)

FACT_FIELDS = [
    "habit",
    "height",
    "flower_period",
    "distribution",
    "habitat",
    "distinguishing_features",
]
TAXON_FIELDS = ["family", "family_latin", "genus_jp", "genus_scientific", "scientific_name"]
STRUCTURED_FACT_FIELDS = ["habit", "height", "flower_period", "distribution", "habitat"]
SUBJECTIVE_RE = re.compile(
    r"美し|優美|上品|豪壮|幸福|至福|うれし|嬉し|楽しい|かっこ|格好|魅力|観賞価値|"
    r"条件に恵まれ|採集者|コレクション|珍品"
)
UNVERIFIED_RE = re.compile(
    r"[?？]|推定|と思|とされ|と考え|可能性|疑問符|見解がある|おそらく|疑わし|不明|"
    r"らしい|といわれ|であろう|わからない|説もある"
)
OCR_PUNCTUATION_RE = re.compile(r"，|\d\s*ー\s*\d")
HEADING_OR_PLATE_RE = re.compile(
    r"\b[A-Z][a-z]+(?:\s+(?:×\s*)?[a-z][A-Za-z.-]*)+\b|[（(]?[PＰ][LＬ.]?\s*\d+"
)
KNOWN_OCR_CORRUPTION_RE = re.compile(
    r"林緑|治海地|広薬|掃化|針薬|落薬|掛林|温原|材林|熟帯|荷林|プナ帯|楽林|業林|"
    r"洗水|相林|道ぼた|横林|吐感喇|波蝕能上の街中|吐略射列島|満に|東開アジア|飯島|"
    r"薬は|際半島|照楽勘林|酉太平洋|洸水|千潟|寒器|地瑚礁|酸陵品|棋林|広城|"
    r"フィリビン|阪島|桝林|針業荷林|広楽林|広業林|琉琉球|探集|昼久島|植裁|"
    r"吐感射列島|以商|開麟|薬が|專の形質|化序|吐畷射列島|に[避違]する|"
    r"吐鴨喇|海美半島|薬裏|，、|山離|広楽|林線|常線|浴葉|開喫|吐鳴喇|南部島膜|"
    r"開側|機験島|プナ帝|多営地|針楽街休|要南省|以率|橋林|常緑酵林|以酒|落棄樹林|"
    r"楜林|常緑広棄林|朝鮮半品|亜寒番|亜寒待|多年章|観質|霧ヶ絲|陳林|伯者大山|"
    r"丘険地|白馬店|夕張缶|毎枝|制技|海水地|全殿|品後|科面基部|開願|提防|出憩|"
    r"伯者|浦限|全士|四因|朝鮮半鳥|街路間|睡道|治岸|菌アジア|痛る|山糸|夏緑橋林|"
    r"製素|厳阜|蘭焼|常緑勘林|租子島|鹿島槍ヶ缶|禁島|吐蠣開列島|吐職刺列島|"
    r"常緑萄林|吐蠣喇列島|九レ州|吐略刺列島|常緑材|常麻|専筒|照薬萄林|照棄街林|隠枝|千薬県|"
    r"九州産部|八ヶ醤|無帯"
)
REPORT_FIELDS = [
    "score",
    "category",
    "display_scope",
    "profile_id",
    "plant_name",
    "scientific_name",
    "family",
    "family_latin",
    "page",
    "printed_page",
    "source",
    "current_value",
    "expected_or_check",
    "reason",
    "evidence",
]

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

CORRECTION_REVERSE: dict[str, list[str]] = defaultdict(list)
for bad_name, fixed_name in PLANT_NAME_CORRECTIONS.items():
    CORRECTION_REVERSE[fixed_name].append(bad_name)


@dataclass(frozen=True)
class Finding:
    score: int
    category: str
    row: dict[str, str]
    current_value: str
    expected_or_check: str
    reason: str
    evidence: str = ""

    def as_dict(self, display_profile_ids: set[str] | None = None) -> dict[str, str | int]:
        display_scope = finding_display_scope(self, display_profile_ids or set())
        return {
            "score": self.score,
            "category": self.category,
            "display_scope": display_scope,
            "profile_id": clean(self.row.get("profile_id", "")),
            "plant_name": clean(self.row.get("plant_name", "")),
            "scientific_name": clean(self.row.get("scientific_name", "")),
            "family": clean(self.row.get("family", "")),
            "family_latin": clean(self.row.get("family_latin", "")),
            "page": clean(self.row.get("page", "")),
            "printed_page": clean(self.row.get("printed_page", "")),
            "source": clean(self.row.get("source", "")),
            "current_value": self.current_value,
            "expected_or_check": self.expected_or_check,
            "reason": self.reason,
            "evidence": self.evidence,
        }


def clean(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\u3000", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "")
    text = text.replace("−", "-").replace("–", "-").replace("—", "-")
    text = text.replace("×", "x")
    return text


def compact(value: str) -> str:
    return re.sub(r"\s+", "", normalize_text(value))


def normalize_family_latin(value: str) -> str:
    return re.sub(r"[^A-Za-z]", "", normalize_text(value)).upper()


def scientific_tokens(value: str) -> list[str]:
    text = normalize_text(value)
    tokens = re.findall(r"[A-Za-z]+|[×x]", text)
    return [token.lower() for token in tokens if token.strip()]


def scientific_base(value: str) -> str:
    tokens = [token for token in scientific_tokens(value) if token not in {"x", "var", "subsp", "f"}]
    return " ".join(tokens[:2])


def scientific_compact(value: str) -> str:
    return "".join(scientific_tokens(value))


def scientific_ratio(a: str, b: str) -> float:
    a_norm = scientific_base(a) or scientific_compact(a)
    b_norm = scientific_base(b) or scientific_compact(b)
    if not a_norm or not b_norm:
        return 0.0
    return SequenceMatcher(None, a_norm, b_norm).ratio()


def first_token(value: str) -> str:
    tokens = scientific_tokens(value)
    return tokens[0] if tokens else ""


def second_token(value: str) -> str:
    tokens = [token for token in scientific_tokens(value) if token not in {"x", "var", "subsp", "f"}]
    return tokens[1] if len(tokens) > 1 else ""


def has_profile_facts(row: dict[str, str]) -> bool:
    return any(clean(row.get(field, "")) for field in FACT_FIELDS)


def page_numbers(value: str) -> tuple[int, ...]:
    pages: list[int] = []
    for part in clean(value).split(";"):
        part = part.strip()
        if part.isdigit():
            pages.append(int(part))
    return tuple(dict.fromkeys(pages))


def first_page_number(value: str) -> int:
    pages = page_numbers(value)
    return pages[0] if pages else 0


def profile_score(row: dict[str, str]) -> int:
    score = sum(4 for field in FACT_FIELDS if clean(row.get(field, "")))
    score += 2 if clean(row.get("family", "")) and clean(row.get("family_latin", "")) else 0
    score += sum(1 for field in TAXON_FIELDS if clean(row.get(field, "")))
    return score


def row_sort_key(row: dict[str, str]) -> tuple[int, int, str]:
    page = first_page_number(row.get("page", ""))
    return (-profile_score(row), page, clean(row.get("profile_id", "")))


def display_profile_ids(rows: list[dict[str, str]]) -> set[str]:
    best_by_name: dict[str, dict[str, str]] = {}
    for row in rows:
        name = clean(row.get("plant_name", ""))
        if not name or not has_profile_facts(row):
            continue
        current = best_by_name.get(name)
        if current is None or row_sort_key(row) < row_sort_key(current):
            best_by_name[name] = row
    return {clean(row.get("profile_id", "")) for row in best_by_name.values() if clean(row.get("profile_id", ""))}


def finding_display_scope(finding: Finding, chosen_profile_ids: set[str]) -> str:
    profile_id = clean(finding.row.get("profile_id", ""))
    if profile_id in chosen_profile_ids:
        return "profile_candidate"
    if not has_profile_facts(finding.row):
        return "raw_only_no_profile_facts"
    return "raw_only_shadowed"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_ylist(path: Path) -> tuple[dict, dict]:
    if not path.exists():
        return {}, {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("plants", {}) or {}, data.get("aliasToCanonical", {}) or {}


def ylist_detail(name: str, plants: dict, alias_to_canonical: dict) -> tuple[str, dict | None]:
    canonical = alias_to_canonical.get(name, name)
    detail = plants.get(name) or plants.get(canonical)
    return canonical, detail


def ylist_detail_for_row(row: dict[str, str], plants: dict, alias_to_canonical: dict) -> tuple[str, dict | None]:
    name = clean(row.get("plant_name", ""))
    if not name:
        return "", None
    exact = plants.get(name)
    if exact:
        return name, exact
    canonical = alias_to_canonical.get(name, name)
    detail = plants.get(canonical)
    if not detail:
        return canonical, None
    row_genus = first_token(row.get("scientific_name", ""))
    ylist_genus = first_token(detail.get("scientificName", ""))
    if row_genus and ylist_genus and row_genus != ylist_genus:
        return canonical, None
    return canonical, detail


def discover_extraction_reports() -> list[Path]:
    reports = sorted((ROOT / "reports").glob(DEFAULT_EXTRACTION_REPORT_PATTERN))
    if reports:
        return reports
    return [DEFAULT_EXTRACTION_REPORT]


def infer_source_label(report_path: Path, report: dict) -> str:
    source_label = clean(report.get("source_label", ""))
    if source_label:
        return source_label
    probe = " ".join([report_path.name, clean(report.get("pdf", "")), clean(report.get("cache_dir", ""))])
    if re.search(r"(?:book2|plants_2|wild_plants_2|第2巻| 2-)", probe):
        return "日本の野生植物 第2巻"
    return "日本の野生植物 第1巻"


def load_cache_sources(report_paths: list[Path], override: str | None) -> list[tuple[str, Path]]:
    if override:
        return [("", Path(override).expanduser())]

    cache_sources: list[tuple[str, Path]] = []
    for report_path in report_paths:
        if not report_path.exists():
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        cache_dir = report.get("cache_dir")
        if not cache_dir:
            continue
        cache_sources.append((infer_source_label(report_path, report), Path(cache_dir).expanduser()))
    return cache_sources


def load_ocr_pages(cache_sources: list[tuple[str, Path]]) -> dict[tuple[str, int], str]:
    pages: dict[tuple[str, int], str] = {}
    for source_label, cache_dir in cache_sources:
        if not cache_dir.exists():
            continue
        for path in sorted(cache_dir.glob("page-*.txt")):
            match = re.search(r"page-(\d+)\.txt$", path.name)
            if not match:
                continue
            pages[(source_label, int(match.group(1)))] = path.read_text(encoding="utf-8", errors="replace")
    return pages


def ocr_cache_summary(cache_sources: list[tuple[str, Path]]) -> str:
    if not cache_sources:
        return "not available"
    return "; ".join(
        f"{source_label or 'unspecified'}: {cache_dir}"
        for source_label, cache_dir in cache_sources
    )


def ocr_cache_json(cache_sources: list[tuple[str, Path]]) -> list[dict[str, str]]:
    return [
        {"source": source_label, "cache_dir": str(cache_dir)}
        for source_label, cache_dir in cache_sources
    ]


def source_summary(
    rows: list[dict[str, str]],
    findings: list[Finding],
    chosen_profile_ids: set[str],
) -> list[dict[str, int | str]]:
    row_counts = Counter(clean(row.get("source", "")) or "unspecified" for row in rows)
    candidate_counts = Counter(
        clean(row.get("source", "")) or "unspecified"
        for row in rows
        if clean(row.get("profile_id", "")) in chosen_profile_ids
    )
    high_candidate_counts = Counter(
        clean(finding.row.get("source", "")) or "unspecified"
        for finding in findings
        if finding.score >= 80 and finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"
    )
    sources = sorted(set(row_counts) | set(candidate_counts) | set(high_candidate_counts))
    return [
        {
            "source": source,
            "rows": row_counts[source],
            "profile_candidate_rows": candidate_counts[source],
            "high_priority_profile_candidate_findings": high_candidate_counts[source],
        }
        for source in sources
    ]


def high_candidate_category_summary(
    findings: list[Finding],
    chosen_profile_ids: set[str],
) -> list[dict[str, int | str]]:
    counts = Counter(
        (clean(finding.row.get("source", "")) or "unspecified", finding.category)
        for finding in findings
        if finding.score >= 80 and finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"
    )
    return [
        {"source": source, "category": category, "count": count}
        for (source, category), count in sorted(counts.items(), key=lambda item: (item[0][0], -item[1], item[0][1]))
    ]


def plant_name_variants(name: str) -> list[str]:
    variants = [name]
    variants.extend(CORRECTION_REVERSE.get(name, []))
    return [variant for variant in dict.fromkeys(variants) if variant]


def latin_chunks(text: str) -> Iterable[str]:
    normalized = normalize_text(text)
    for match in re.finditer(r"[A-Z][A-Za-z×x.\- ]{4,90}", normalized):
        yield clean(match.group(0))


def best_scientific_ocr_ratio(scientific_name: str, page_text: str) -> float:
    best = 0.0
    for chunk in latin_chunks(page_text):
        best = max(best, scientific_ratio(scientific_name, chunk))
        if best >= 0.98:
            break
    return best


def add_finding(findings: list[Finding], finding: Finding) -> None:
    findings.append(finding)


def audit_ocr_support(rows: list[dict[str, str]], ocr_pages: dict[tuple[str, int], str], findings: list[Finding]) -> None:
    if not ocr_pages:
        return
    for row in rows:
        pages = page_numbers(row.get("page", ""))
        source = clean(row.get("source", ""))
        page_texts = [
            page_text
            for page in pages
            if (page_text := ocr_pages.get((source, page)) or ocr_pages.get(("", page))) is not None
        ]
        if not page_texts:
            add_finding(
                findings,
                Finding(
                    72,
                    "ocr_page_missing",
                    row,
                    clean(row.get("page", "")),
                    "Cached OCR page should exist",
                    "The profile points to a page that is not present in the OCR cache.",
                ),
            )
            continue

        page_text = "\n".join(page_texts)
        page_compact = compact(page_text)
        name = clean(row.get("plant_name", ""))
        if name and not any(compact(variant) in page_compact for variant in plant_name_variants(name)):
            add_finding(
                findings,
                Finding(
                    95,
                    "plant_name_not_supported_by_ocr_page",
                    row,
                    name,
                    "Plant name or known OCR-correction variant should appear on the cited page",
                    "The corrected plant name is not traceable to the cached OCR text for this page.",
                ),
            )

        scientific_name = clean(row.get("scientific_name", ""))
        if scientific_name:
            exact = scientific_compact(scientific_name) in scientific_compact(page_text)
            if not exact:
                ratio = best_scientific_ocr_ratio(scientific_name, page_text)
                if ratio < 0.82:
                    add_finding(
                        findings,
                        Finding(
                            92,
                            "scientific_name_not_supported_by_ocr_page",
                            row,
                            scientific_name,
                            "Scientific name should be exact or close to cached OCR text",
                            "The scientific name does not appear to be supported by the cited OCR page.",
                            f"best_ocr_similarity={ratio:.2f}",
                        ),
                    )


def audit_ylist(rows: list[dict[str, str]], plants: dict, alias_to_canonical: dict, findings: list[Finding]) -> None:
    for row in rows:
        name = clean(row.get("plant_name", ""))
        if not name:
            continue
        canonical, detail = ylist_detail_for_row(row, plants, alias_to_canonical)
        if not detail:
            continue

        y_family_jp = clean(detail.get("familyJp", ""))
        row_family = clean(row.get("family", ""))
        if row_family and y_family_jp and row_family != y_family_jp:
            add_finding(
                findings,
                Finding(
                    84,
                    "ylist_family_conflict",
                    row,
                    row_family,
                    y_family_jp,
                    "The PDF-derived family differs from the site's YList-derived family.",
                    f"ylist_canonical={canonical}",
                ),
            )

        y_family_latin = clean(detail.get("familyEn", ""))
        row_family_latin = clean(row.get("family_latin", ""))
        if row_family_latin and y_family_latin:
            if normalize_family_latin(row_family_latin) != normalize_family_latin(y_family_latin):
                add_finding(
                    findings,
                    Finding(
                        74,
                        "ylist_family_latin_conflict",
                        row,
                        row_family_latin,
                        y_family_latin,
                        "The Latin family name differs from the site's YList-derived family.",
                        f"ylist_canonical={canonical}",
                    ),
                )

        y_scientific = clean(detail.get("scientificName", ""))
        row_scientific = clean(row.get("scientific_name", ""))
        if not y_scientific or not row_scientific:
            continue
        if scientific_base(row_scientific) == scientific_base(y_scientific):
            continue

        ratio = scientific_ratio(row_scientific, y_scientific)
        genus_ratio = SequenceMatcher(None, first_token(row_scientific), first_token(y_scientific)).ratio()
        species_ratio = SequenceMatcher(None, second_token(row_scientific), second_token(y_scientific)).ratio()
        if ratio >= 0.82 or (genus_ratio >= 0.75 and species_ratio >= 0.70):
            add_finding(
                findings,
                Finding(
                    88,
                    "possible_ocr_latin_typo_against_ylist",
                    row,
                    row_scientific,
                    y_scientific,
                    "The scientific name is very close to YList but not identical, which is typical of OCR letter errors.",
                    f"ylist_canonical={canonical}; similarity={ratio:.2f}",
                ),
            )
        else:
            add_finding(
                findings,
                Finding(
                    64,
                    "ylist_scientific_name_conflict",
                    row,
                    row_scientific,
                    y_scientific,
                    "The scientific name differs from YList; this may be a synonym, taxonomy difference, or OCR issue.",
                    f"ylist_canonical={canonical}; similarity={ratio:.2f}",
                ),
            )


def audit_family_consistency(rows: list[dict[str, str]], findings: list[Finding]) -> None:
    votes: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        family = clean(row.get("family", ""))
        latin = normalize_family_latin(row.get("family_latin", ""))
        if family and latin.endswith("ACEAE"):
            votes[family][latin] += 1

    dominant = {
        family: counter.most_common(1)[0]
        for family, counter in votes.items()
        if counter and counter.most_common(1)[0][1] >= 3
    }

    for row in rows:
        family = clean(row.get("family", ""))
        latin = normalize_family_latin(row.get("family_latin", ""))
        if not family or not latin or family not in dominant:
            continue
        expected, count = dominant[family]
        if latin != expected:
            add_finding(
                findings,
                Finding(
                    58,
                    "family_latin_outlier_for_japanese_family",
                    row,
                    clean(row.get("family_latin", "")),
                    expected,
                    "Most rows with this Japanese family use a different Latin family name.",
                    f"dominant_count={count}",
                ),
            )

        if latin and not latin.endswith("ACEAE"):
            add_finding(
                findings,
                Finding(
                    54,
                    "family_latin_shape_suspicious",
                    row,
                    clean(row.get("family_latin", "")),
                    "Expected botanical family ending -ACEAE",
                    "The Latin family does not look like a normal plant family name.",
                ),
            )


def audit_scientific_shape(rows: list[dict[str, str]], findings: list[Finding]) -> None:
    for row in rows:
        scientific_name = clean(row.get("scientific_name", ""))
        if not scientific_name:
            continue
        if re.search(r"[0-9一-龯ぁ-んァ-ヶ]", scientific_name):
            add_finding(
                findings,
                Finding(
                    86,
                    "scientific_name_has_invalid_characters",
                    row,
                    scientific_name,
                    "Latin scientific name without Japanese characters or digits",
                    "The scientific name contains characters that usually indicate OCR spillover.",
                ),
            )
        tokens = scientific_tokens(scientific_name)
        if len([token for token in tokens if token not in {"x", "var", "subsp", "f"}]) < 2:
            add_finding(
                findings,
                Finding(
                    66,
                    "scientific_name_not_binomial",
                    row,
                    scientific_name,
                    "At least genus and species epithet",
                    "The scientific name is shorter than expected for a species entry.",
                ),
            )
        genus = clean(row.get("genus_scientific", ""))
        sci_genus = first_token(scientific_name)
        if genus and sci_genus and first_token(genus) and first_token(genus) != sci_genus:
            add_finding(
                findings,
                Finding(
                    78,
                    "genus_scientific_conflicts_with_scientific_name",
                    row,
                    genus,
                    sci_genus,
                    "The row's genus field should match the first word of the scientific name.",
                    "This usually means parser state leaked from a neighboring OCR block.",
                ),
            )


def audit_duplicate_rows(rows: list[dict[str, str]], findings: list[Finding]) -> None:
    rows_by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        name = clean(row.get("plant_name", ""))
        if name:
            rows_by_name[name].append(row)

    for name, group in rows_by_name.items():
        if len(group) < 2:
            continue
        best = sorted(group, key=row_sort_key)[0]
        best_id = clean(best.get("profile_id", ""))
        families = sorted({clean(row.get("family", "")) for row in group if clean(row.get("family", ""))})
        scientific_names = sorted(
            {clean(row.get("scientific_name", "")) for row in group if clean(row.get("scientific_name", ""))}
        )
        best_scientific = clean(best.get("scientific_name", ""))
        best_family = clean(best.get("family", ""))

        for row in group:
            row_id = clean(row.get("profile_id", ""))
            factless = not has_profile_facts(row)
            if len(families) > 1:
                score = 90 if factless and row_id != best_id else 76
                add_finding(
                    findings,
                    Finding(
                        score,
                        "duplicate_name_family_conflict",
                        row,
                        clean(row.get("family", "")),
                        " / ".join(families),
                        "The same Japanese plant name appears with multiple families.",
                        f"chosen_display_profile={best_id}; chosen_family={best_family}",
                    ),
                )

            if len(scientific_names) > 1:
                score = 82 if factless and row_id != best_id else 62
                add_finding(
                    findings,
                    Finding(
                        score,
                        "duplicate_name_scientific_conflict",
                        row,
                        clean(row.get("scientific_name", "")),
                        " / ".join(scientific_names[:6]),
                        "The same Japanese plant name appears with multiple scientific names.",
                        f"chosen_display_profile={best_id}; chosen_scientific={best_scientific}",
                    ),
                )

            if row_id != best_id and factless:
                row_scientific = clean(row.get("scientific_name", ""))
                row_family = clean(row.get("family", ""))
                if row_scientific != best_scientific or row_family != best_family:
                    add_finding(
                        findings,
                        Finding(
                            80,
                            "duplicate_low_information_row_shadowed",
                            row,
                            f"{row_family} / {row_scientific}",
                            f"{best_family} / {best_scientific}",
                            "The display builder will prefer a richer row for this plant name.",
                            f"chosen_display_profile={best_id}",
                        ),
                    )


def audit_low_information(rows: list[dict[str, str]], plants: dict, alias_to_canonical: dict, findings: list[Finding]) -> None:
    name_counts = Counter(clean(row.get("plant_name", "")) for row in rows)
    for row in rows:
        name = clean(row.get("plant_name", ""))
        if not name or has_profile_facts(row):
            continue
        _canonical, detail = ylist_detail(name, plants, alias_to_canonical)
        if name_counts[name] > 1 or not detail:
            add_finding(
                findings,
                Finding(
                    44,
                    "low_information_profile",
                    row,
                    "no habit/height/flower/distribution/habitat/distinguishing_features",
                    "At least one concrete profile fact",
                    "This row is mostly taxonomy only, so it is more likely to be a figure caption or duplicate fragment.",
                ),
            )


def audit_public_fact_integrity(rows: list[dict[str, str]], findings: list[Finding]) -> None:
    """Fail-visible checks for prose that must never return to public profiles."""
    checks = [
        (SUBJECTIVE_RE, "subjective_or_editorial_profile_text", "Objective profile prose only"),
        (UNVERIFIED_RE, "unverified_or_speculative_profile_text", "Verified objective facts only"),
        (KNOWN_OCR_CORRUPTION_RE, "known_ocr_corruption_in_profile_text", "Corrected original-PDF wording"),
        (OCR_PUNCTUATION_RE, "ocr_punctuation_in_profile_text", "Normalize punctuation without changing meaning"),
    ]
    for row in rows:
        for field in FACT_FIELDS:
            value = clean(row.get(field, ""))
            if not value:
                continue
            for pattern, category, expected in checks:
                if pattern.search(value):
                    add_finding(
                        findings,
                        Finding(
                            100,
                            category,
                            row,
                            value,
                            expected,
                            f"Forbidden public profile prose remains in {field}.",
                        ),
                    )
        for field in STRUCTURED_FACT_FIELDS:
            value = clean(row.get(field, ""))
            if value and HEADING_OR_PLATE_RE.search(value):
                add_finding(
                    findings,
                    Finding(
                        100,
                        "heading_scientific_or_plate_text_in_profile_field",
                        row,
                        value,
                        "Account facts without heading, scientific name, or plate label",
                        f"A species heading or plate label remains in {field}.",
                    ),
                )


def dedupe_findings(findings: list[Finding]) -> list[Finding]:
    seen: set[tuple[str, str, str, str, str]] = set()
    deduped: list[Finding] = []
    for finding in findings:
        row = finding.row
        key = (
            finding.category,
            clean(row.get("profile_id", "")),
            finding.current_value,
            finding.expected_or_check,
            finding.reason,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(finding)
    return sorted(
        deduped,
        key=lambda item: (
            -item.score,
            item.category,
            clean(item.row.get("plant_name", "")),
            first_page_number(item.row.get("page", "")),
            clean(item.row.get("profile_id", "")),
        ),
    )


def apply_taxonomy_review_decisions(
    findings: list[Finding],
    review_rows: list[dict[str, str]],
) -> tuple[list[Finding], dict[str, int]]:
    """Remove only exact, original-PDF-reviewed taxonomy candidates from the unresolved list.

    A keep decision matches the reviewed current value. A correction matches its
    verified replacement, so source-era names that still intentionally differ
    from YList do not return as unresolved after the OCR repair. The pre-fix
    value of a correction is never suppressed; that keeps unapplied actions
    visible.
    """
    reviewed: dict[tuple[str, str, str, str], dict[str, str]] = {}
    for row in review_rows:
        decision = clean(row.get("decision", ""))
        reviewed_value = (
            clean(row.get("current_value", ""))
            if decision == "keep_source"
            else clean(row.get("verified_value", ""))
        )
        review_key = (
            clean(row.get("source", "")),
            clean(row.get("plant_name", "")),
            clean(row.get("audit_category", "")),
            reviewed_value,
        )
        if all(review_key):
            reviewed[review_key] = row
            if review_key[2] == "possible_ocr_latin_typo_against_ylist":
                reviewed[(
                    review_key[0],
                    review_key[1],
                    "scientific_name_not_supported_by_ocr_page",
                    review_key[3],
                )] = row

    unresolved: list[Finding] = []
    matched_ids: set[str] = set()
    for finding in findings:
        finding_key = (
            clean(finding.row.get("source", "")),
            clean(finding.row.get("plant_name", "")),
            finding.category,
            clean(finding.current_value),
        )
        review = reviewed.get(finding_key)
        if not review:
            unresolved.append(finding)
            continue
        matched_ids.add(clean(review.get("audit_id", "")))

    correction_rows = [row for row in review_rows if clean(row.get("decision", "")) == "correct_ocr"]
    keep_rows = [row for row in review_rows if clean(row.get("decision", "")) == "keep_source"]
    return unresolved, {
        "ledger_rows": len(review_rows),
        "keep_source_rows": len(keep_rows),
        "correct_ocr_rows": len(correction_rows),
        "reviewed_findings_suppressed": len(findings) - len(unresolved),
        "review_rows_matching_current_findings": len(matched_ids),
    }


def write_csv_report(path: Path, findings: list[Finding], chosen_profile_ids: set[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=REPORT_FIELDS, lineterminator="\n")
        writer.writeheader()
        for finding in findings:
            writer.writerow(finding.as_dict(chosen_profile_ids))


def markdown_escape(value: object) -> str:
    text = clean(value)
    return text.replace("|", "\\|")


def write_markdown_report(
    path: Path,
    rows: list[dict[str, str]],
    findings: list[Finding],
    cache_sources: list[tuple[str, Path]],
    limit: int,
    chosen_profile_ids: set[str],
    review_stats: dict[str, int],
) -> None:
    category_counts = Counter(finding.category for finding in findings)
    candidate_findings = [finding for finding in findings if finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"]
    high_priority = sum(1 for finding in findings if finding.score >= 80)
    high_priority_candidates = sum(1 for finding in candidate_findings if finding.score >= 80)
    source_counts = source_summary(rows, findings, chosen_profile_ids)
    high_by_source_category = high_candidate_category_summary(findings, chosen_profile_ids)
    generated_at = datetime.now().isoformat(timespec="seconds")
    lines = [
        "# Wild Plant Profile Fact Check",
        "",
        f"Generated: {generated_at}",
        "",
        "This report audits the OCR-derived `normalized_data/plant_profiles.csv` data for likely hallucinations or OCR/parser artifacts. It is a review list, not an automatic deletion list.",
        "",
        "Display safety rules: taxonomy-only OCR fragments are excluded from site profile output, and YList taxonomy is preferred over OCR taxonomy when the plant is already known to the site.",
        "",
        "## Summary",
        "",
        f"- Audited rows: {len(rows)}",
        f"- Profile candidate rows with factual fields: {len(chosen_profile_ids)}",
        f"- Findings: {len(findings)}",
        f"- Original-PDF taxonomy review ledger rows: {review_stats['ledger_rows']}",
        f"- Reviewed taxonomy findings excluded from this unresolved list: {review_stats['reviewed_findings_suppressed']}",
        f"- High-priority findings (score >= 80): {high_priority}",
        f"- High-priority profile-candidate findings: {high_priority_candidates}",
        f"- OCR caches: {ocr_cache_summary(cache_sources)}",
        "",
        "## Source Counts",
        "",
        "| Source | Rows | Profile candidate rows | High-priority profile-candidate findings |",
        "| --- | ---: | ---: | ---: |",
    ]
    for item in source_counts:
        lines.append(
            "| "
            + " | ".join(
                [
                    markdown_escape(item["source"]),
                    str(item["rows"]),
                    str(item["profile_candidate_rows"]),
                    str(item["high_priority_profile_candidate_findings"]),
                ]
            )
            + " |"
        )

    lines.extend(
        [
            "",
            "## High-Priority Profile-Candidate Findings By Source",
            "",
            "| Source | Category | Count |",
            "| --- | --- | ---: |",
        ]
    )
    for item in high_by_source_category:
        lines.append(
            "| "
            + " | ".join(
                [
                    markdown_escape(item["source"]),
                    markdown_escape(item["category"]),
                    str(item["count"]),
                ]
            )
            + " |"
        )

    lines.extend(
        [
            "",
            "## Category Counts",
            "",
            "| Category | Count |",
            "| --- | ---: |",
        ]
    )
    for category, count in category_counts.most_common():
        lines.append(f"| {markdown_escape(category)} | {count} |")

    candidate_category_counts = Counter(finding.category for finding in candidate_findings)
    lines.extend(
        [
            "",
            "## Profile-Candidate Category Counts",
            "",
            "| Category | Count |",
            "| --- | ---: |",
        ]
    )
    for category, count in candidate_category_counts.most_common():
        lines.append(f"| {markdown_escape(category)} | {count} |")

    candidate_limit = min(limit, len(candidate_findings))
    lines.extend(
        [
            "",
            f"## Top {candidate_limit} Profile-Candidate Findings",
            "",
            "| Score | Category | Plant | Scientific name | Family | Page | Reason | Expected/check |",
            "| ---: | --- | --- | --- | --- | ---: | --- | --- |",
        ]
    )
    for finding in candidate_findings[:candidate_limit]:
        row = finding.row
        lines.append(
            "| "
            + " | ".join(
                [
                    str(finding.score),
                    markdown_escape(finding.category),
                    markdown_escape(row.get("plant_name", "")),
                    markdown_escape(row.get("scientific_name", "")),
                    markdown_escape(row.get("family", "")),
                    markdown_escape(row.get("page", "")),
                    markdown_escape(finding.reason),
                    markdown_escape(finding.expected_or_check),
                ]
            )
            + " |"
        )

    raw_limit = min(limit, len(findings))
    lines.extend(
        [
            "",
            f"## Top {raw_limit} Raw CSV Findings",
            "",
            "| Score | Scope | Category | Plant | Scientific name | Family | Page | Reason | Expected/check |",
            "| ---: | --- | --- | --- | --- | --- | ---: | --- | --- |",
        ]
    )
    for finding in findings[:raw_limit]:
        row = finding.row
        lines.append(
            "| "
            + " | ".join(
                [
                    str(finding.score),
                    markdown_escape(finding_display_scope(finding, chosen_profile_ids)),
                    markdown_escape(finding.category),
                    markdown_escape(row.get("plant_name", "")),
                    markdown_escape(row.get("scientific_name", "")),
                    markdown_escape(row.get("family", "")),
                    markdown_escape(row.get("page", "")),
                    markdown_escape(finding.reason),
                    markdown_escape(finding.expected_or_check),
                ]
            )
            + " |"
        )
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_json_summary(
    path: Path,
    rows: list[dict[str, str]],
    findings: list[Finding],
    cache_sources: list[tuple[str, Path]],
    chosen_profile_ids: set[str],
    review_stats: dict[str, int],
) -> None:
    candidate_findings = [finding for finding in findings if finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"]
    summary = {
        "audited_rows": len(rows),
        "profile_candidate_rows": len(chosen_profile_ids),
        "findings": len(findings),
        "taxonomy_review": review_stats,
        "high_priority_findings": sum(1 for finding in findings if finding.score >= 80),
        "profile_candidate_findings": len(candidate_findings),
        "high_priority_profile_candidate_findings": sum(1 for finding in candidate_findings if finding.score >= 80),
        "category_counts": dict(Counter(finding.category for finding in findings).most_common()),
        "profile_candidate_category_counts": dict(Counter(finding.category for finding in candidate_findings).most_common()),
        "source_counts": source_summary(rows, findings, chosen_profile_ids),
        "high_priority_profile_candidate_category_counts_by_source": high_candidate_category_summary(findings, chosen_profile_ids),
        "ocr_caches": ocr_cache_json(cache_sources),
        "top_profile_candidate_findings": [finding.as_dict(chosen_profile_ids) for finding in candidate_findings[:20]],
        "top_findings": [finding.as_dict(chosen_profile_ids) for finding in findings[:20]],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_path(value: str | None, default: Path) -> Path:
    path = Path(value).expanduser() if value else default
    return path if path.is_absolute() else ROOT / path


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit OCR-derived wild plant profile facts")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input plant profile CSV")
    parser.add_argument("--ylist", default=str(DEFAULT_YLIST), help="YList lite JSON")
    parser.add_argument(
        "--extraction-report",
        action="append",
        help="Extraction report JSON. Repeat to load multiple OCR caches. Defaults to all wildplant extraction reports.",
    )
    parser.add_argument("--cache-dir", help="Override OCR cache directory")
    parser.add_argument("--csv-report", default=str(DEFAULT_CSV_REPORT), help="Output suspect CSV")
    parser.add_argument("--md-report", default=str(DEFAULT_MD_REPORT), help="Output Markdown summary")
    parser.add_argument("--json-report", default=str(DEFAULT_JSON_REPORT), help="Output JSON summary")
    parser.add_argument(
        "--taxonomy-review",
        default=str(DEFAULT_TAXONOMY_REVIEW),
        help="Original-PDF taxonomy review ledger used to separate reviewed candidates from unresolved findings",
    )
    parser.add_argument("--top", type=int, default=100, help="Number of findings to include in Markdown")
    args = parser.parse_args()

    input_path = resolve_path(args.input, DEFAULT_INPUT)
    ylist_path = resolve_path(args.ylist, DEFAULT_YLIST)
    extraction_report_paths = (
        [resolve_path(value, DEFAULT_EXTRACTION_REPORT) for value in args.extraction_report]
        if args.extraction_report
        else discover_extraction_reports()
    )
    csv_report_path = resolve_path(args.csv_report, DEFAULT_CSV_REPORT)
    md_report_path = resolve_path(args.md_report, DEFAULT_MD_REPORT)
    json_report_path = resolve_path(args.json_report, DEFAULT_JSON_REPORT)
    taxonomy_review_path = resolve_path(args.taxonomy_review, DEFAULT_TAXONOMY_REVIEW)
    cache_sources = load_cache_sources(extraction_report_paths, args.cache_dir)

    rows = read_csv(input_path)
    plants, alias_to_canonical = load_ylist(ylist_path)
    ocr_pages = load_ocr_pages(cache_sources)

    findings: list[Finding] = []
    audit_ocr_support(rows, ocr_pages, findings)
    audit_ylist(rows, plants, alias_to_canonical, findings)
    audit_family_consistency(rows, findings)
    audit_scientific_shape(rows, findings)
    audit_duplicate_rows(rows, findings)
    audit_low_information(rows, plants, alias_to_canonical, findings)
    audit_public_fact_integrity(rows, findings)
    findings = dedupe_findings(findings)
    taxonomy_review_rows = read_csv(taxonomy_review_path)
    findings, review_stats = apply_taxonomy_review_decisions(findings, taxonomy_review_rows)
    chosen_profile_ids = display_profile_ids(rows)

    write_csv_report(csv_report_path, findings, chosen_profile_ids)
    write_markdown_report(
        md_report_path,
        rows,
        findings,
        cache_sources,
        args.top,
        chosen_profile_ids,
        review_stats,
    )
    write_json_summary(
        json_report_path,
        rows,
        findings,
        cache_sources,
        chosen_profile_ids,
        review_stats,
    )

    candidate_findings = [finding for finding in findings if finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"]
    print(
        "[wildplants-audit] "
        f"rows={len(rows)} profile_candidates={len(chosen_profile_ids)} "
        f"findings={len(findings)} high_priority={sum(1 for f in findings if f.score >= 80)} "
        f"candidate_high_priority={sum(1 for f in candidate_findings if f.score >= 80)} "
        f"reviewed_suppressed={review_stats['reviewed_findings_suppressed']}"
    )
    print(f"[wildplants-audit] wrote {csv_report_path}")
    print(f"[wildplants-audit] wrote {md_report_path}")
    print(f"[wildplants-audit] wrote {json_report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
