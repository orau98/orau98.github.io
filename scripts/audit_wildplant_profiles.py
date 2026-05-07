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
DEFAULT_CSV_REPORT = ROOT / "reports" / "wildplant_profile_factcheck.csv"
DEFAULT_MD_REPORT = ROOT / "reports" / "wildplant_profile_factcheck.md"
DEFAULT_JSON_REPORT = ROOT / "reports" / "wildplant_profile_factcheck_summary.json"

FACT_FIELDS = ["habit", "height", "flower_period", "distribution", "habitat"]
TAXON_FIELDS = ["family", "family_latin", "genus_jp", "genus_scientific", "scientific_name"]
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


def profile_score(row: dict[str, str]) -> int:
    score = sum(4 for field in FACT_FIELDS if clean(row.get(field, "")))
    score += 2 if clean(row.get("family", "")) and clean(row.get("family_latin", "")) else 0
    score += sum(1 for field in TAXON_FIELDS if clean(row.get(field, "")))
    return score


def row_sort_key(row: dict[str, str]) -> tuple[int, int, str]:
    page = int(clean(row.get("page", "")) or 0)
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


def load_cache_dir(report_path: Path, override: str | None) -> Path | None:
    if override:
        return Path(override).expanduser()
    if not report_path.exists():
        return None
    report = json.loads(report_path.read_text(encoding="utf-8"))
    cache_dir = report.get("cache_dir")
    return Path(cache_dir).expanduser() if cache_dir else None


def load_ocr_pages(cache_dir: Path | None) -> dict[int, str]:
    if not cache_dir or not cache_dir.exists():
        return {}
    pages: dict[int, str] = {}
    for path in sorted(cache_dir.glob("page-*.txt")):
        match = re.search(r"page-(\d+)\.txt$", path.name)
        if not match:
            continue
        pages[int(match.group(1))] = path.read_text(encoding="utf-8", errors="replace")
    return pages


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


def audit_ocr_support(rows: list[dict[str, str]], ocr_pages: dict[int, str], findings: list[Finding]) -> None:
    if not ocr_pages:
        return
    for row in rows:
        page_text = ocr_pages.get(int(clean(row.get("page", "")) or 0))
        if page_text is None:
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
        canonical, detail = ylist_detail(name, plants, alias_to_canonical)
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
                    "no habit/height/flower/distribution/habitat",
                    "At least one concrete profile fact",
                    "This row is mostly taxonomy only, so it is more likely to be a figure caption or duplicate fragment.",
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
            int(clean(item.row.get("page", "")) or 0),
            clean(item.row.get("profile_id", "")),
        ),
    )


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
    cache_dir: Path | None,
    limit: int,
    chosen_profile_ids: set[str],
) -> None:
    category_counts = Counter(finding.category for finding in findings)
    candidate_findings = [finding for finding in findings if finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"]
    high_priority = sum(1 for finding in findings if finding.score >= 80)
    high_priority_candidates = sum(1 for finding in candidate_findings if finding.score >= 80)
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
        f"- High-priority findings (score >= 80): {high_priority}",
        f"- High-priority profile-candidate findings: {high_priority_candidates}",
        f"- OCR cache: {cache_dir or 'not available'}",
        "",
        "## Category Counts",
        "",
        "| Category | Count |",
        "| --- | ---: |",
    ]
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
    cache_dir: Path | None,
    chosen_profile_ids: set[str],
) -> None:
    candidate_findings = [finding for finding in findings if finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"]
    summary = {
        "audited_rows": len(rows),
        "profile_candidate_rows": len(chosen_profile_ids),
        "findings": len(findings),
        "high_priority_findings": sum(1 for finding in findings if finding.score >= 80),
        "profile_candidate_findings": len(candidate_findings),
        "high_priority_profile_candidate_findings": sum(1 for finding in candidate_findings if finding.score >= 80),
        "category_counts": dict(Counter(finding.category for finding in findings).most_common()),
        "profile_candidate_category_counts": dict(Counter(finding.category for finding in candidate_findings).most_common()),
        "ocr_cache": str(cache_dir) if cache_dir else "",
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
    parser.add_argument("--extraction-report", default=str(DEFAULT_EXTRACTION_REPORT), help="Extraction report JSON")
    parser.add_argument("--cache-dir", help="Override OCR cache directory")
    parser.add_argument("--csv-report", default=str(DEFAULT_CSV_REPORT), help="Output suspect CSV")
    parser.add_argument("--md-report", default=str(DEFAULT_MD_REPORT), help="Output Markdown summary")
    parser.add_argument("--json-report", default=str(DEFAULT_JSON_REPORT), help="Output JSON summary")
    parser.add_argument("--top", type=int, default=100, help="Number of findings to include in Markdown")
    args = parser.parse_args()

    input_path = resolve_path(args.input, DEFAULT_INPUT)
    ylist_path = resolve_path(args.ylist, DEFAULT_YLIST)
    extraction_report_path = resolve_path(args.extraction_report, DEFAULT_EXTRACTION_REPORT)
    csv_report_path = resolve_path(args.csv_report, DEFAULT_CSV_REPORT)
    md_report_path = resolve_path(args.md_report, DEFAULT_MD_REPORT)
    json_report_path = resolve_path(args.json_report, DEFAULT_JSON_REPORT)
    cache_dir = load_cache_dir(extraction_report_path, args.cache_dir)

    rows = read_csv(input_path)
    plants, alias_to_canonical = load_ylist(ylist_path)
    ocr_pages = load_ocr_pages(cache_dir)

    findings: list[Finding] = []
    audit_ocr_support(rows, ocr_pages, findings)
    audit_ylist(rows, plants, alias_to_canonical, findings)
    audit_family_consistency(rows, findings)
    audit_scientific_shape(rows, findings)
    audit_duplicate_rows(rows, findings)
    audit_low_information(rows, plants, alias_to_canonical, findings)
    findings = dedupe_findings(findings)
    chosen_profile_ids = display_profile_ids(rows)

    write_csv_report(csv_report_path, findings, chosen_profile_ids)
    write_markdown_report(md_report_path, rows, findings, cache_dir, args.top, chosen_profile_ids)
    write_json_summary(json_report_path, rows, findings, cache_dir, chosen_profile_ids)

    candidate_findings = [finding for finding in findings if finding_display_scope(finding, chosen_profile_ids) == "profile_candidate"]
    print(
        "[wildplants-audit] "
        f"rows={len(rows)} profile_candidates={len(chosen_profile_ids)} "
        f"findings={len(findings)} high_priority={sum(1 for f in findings if f.score >= 80)} "
        f"candidate_high_priority={sum(1 for f in candidate_findings if f.score >= 80)}"
    )
    print(f"[wildplants-audit] wrote {csv_report_path}")
    print(f"[wildplants-audit] wrote {md_report_path}")
    print(f"[wildplants-audit] wrote {json_report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
