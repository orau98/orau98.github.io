#!/usr/bin/env python3
"""抽出結果を統合して最終確認用CSVを生成

- reports/extracted_candidates.json（PDF抽出）
- reports/api_update_candidates.csv（API検索）
を統合して reports/update_candidates.csv を出力。

学名・和名変更は自動で「要確認」フラグを付与。
"""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"

PDF_CANDIDATES = REPORTS_DIR / "extracted_candidates.json"
API_CANDIDATES = REPORTS_DIR / "api_update_candidates.csv"
OUTPUT_FILE = REPORTS_DIR / "update_candidates.csv"

# insects.csv の場所
CSV_CANDIDATES_DIRS = [ROOT / "normalized_data", ROOT / "public"]

FIELDNAMES = [
    "insect_id",
    "japanese_name",
    "scientific_name",
    "change_type",
    "current_value",
    "proposed_value",
    "source",
    "source_url",
    "confidence",
    "review_required",
    "approved",
    "note",
]

# 要確認フラグを強制する変更種別
FORCE_REVIEW = {"学名変更", "和名変更"}


def find_csv(filename: str) -> Path | None:
    for d in CSV_CANDIDATES_DIRS:
        p = d / filename
        if p.exists():
            return p
    return None


def load_insects_index() -> dict:
    """insects.csv からinsect_id→{japanese_name, scientific_name}のインデックスを構築"""
    csv_path = find_csv("insects.csv")
    if not csv_path:
        return {}
    index = {}
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            iid = row.get("insect_id", "").strip()
            if iid:
                index[iid] = {
                    "japanese_name": row.get("japanese_name", ""),
                    "scientific_name": row.get("scientific_name", ""),
                }
    return index


def load_pdf_candidates() -> list[dict]:
    """PDF抽出結果を読み込み"""
    if not PDF_CANDIDATES.exists():
        print(f"注意: {PDF_CANDIDATES} が見つかりません（スキップ）")
        return []
    data = json.loads(PDF_CANDIDATES.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return []

    rows = []
    for item in data:
        change_type = item.get("change_type", "")
        row = {
            "insect_id": "",  # PDF抽出ではinsect_id不明の場合あり
            "japanese_name": item.get("japanese_name", ""),
            "scientific_name": item.get("scientific_name", ""),
            "change_type": change_type,
            "current_value": "",
            "proposed_value": item.get("content", ""),
            "source": f"{item.get('source_name', '')} {item.get('issue_number', '')}号",
            "source_url": "",
            "confidence": item.get("confidence", "low"),
            "review_required": "YES" if change_type in FORCE_REVIEW else "",
            "approved": "",
            "note": f"ページ: {item.get('page', '不明')}, ファイル: {item.get('source_file', '')}",
        }
        rows.append(row)
    return rows


def load_api_candidates() -> list[dict]:
    """API検索結果を読み込み"""
    if not API_CANDIDATES.exists():
        print(f"注意: {API_CANDIDATES} が見つかりません（スキップ）")
        return []
    rows = []
    with open(API_CANDIDATES, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            change_type = row.get("change_type", "")
            row["review_required"] = (
                "YES" if change_type in FORCE_REVIEW else row.get("review_required", "")
            )
            row.setdefault("approved", "")
            rows.append(row)
    return rows


def deduplicate(rows: list[dict]) -> list[dict]:
    """重複を除去（同じinsect_id + change_type + proposed_value）"""
    seen = set()
    unique = []
    for row in rows:
        key = (
            row.get("insect_id", ""),
            row.get("change_type", ""),
            row.get("proposed_value", ""),
        )
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


def main():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("=== 差分レポート統合 ===\n")

    pdf_rows = load_pdf_candidates()
    print(f"PDF抽出候補: {len(pdf_rows)}件")

    api_rows = load_api_candidates()
    print(f"API検索候補: {len(api_rows)}件")

    all_rows = pdf_rows + api_rows

    # 要確認フラグの強制適用
    for row in all_rows:
        if row.get("change_type", "") in FORCE_REVIEW:
            row["review_required"] = "YES"

    # 重複除去
    all_rows = deduplicate(all_rows)
    print(f"統合後（重複除去）: {len(all_rows)}件")

    # 信頼度順にソート: high > medium > low
    confidence_order = {"high": 0, "medium": 1, "low": 2}
    all_rows.sort(key=lambda r: confidence_order.get(r.get("confidence", "low"), 3))

    # CSV出力
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\n出力: {OUTPUT_FILE}")
    print(f"合計: {len(all_rows)}件")

    # サマリー
    by_type = {}
    for row in all_rows:
        ct = row.get("change_type", "不明")
        by_type[ct] = by_type.get(ct, 0) + 1
    print("\n変更種別の内訳:")
    for ct, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {ct}: {count}件")

    review_count = sum(1 for r in all_rows if r.get("review_required") == "YES")
    print(f"\n要確認: {review_count}件")
    print("\napproved 列に 'OK' を記入して apply_updates.py で反映してください。")


if __name__ == "__main__":
    main()
