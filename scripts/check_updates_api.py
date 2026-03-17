#!/usr/bin/env python3
"""外部APIで最新情報を自動検索

使用API（すべて無料）:
- GBIF API: 学名の有効性・シノニム確認
- J-STAGE API: 関連論文の新着確認
- CiNii API: 日本語論文検索

insects.csv の全種を対象に順番に検索。

並列実行対応:
  --slice 0:2687           行範囲スライス（0始まり, start:end）
  --output reports/api_A.csv  出力ファイル指定
  --progress-file reports/prog_A.json  進捗ファイル指定
"""

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"

# CSVの場所（validate-normalized.mjs と同じロジック）
CSV_CANDIDATES = [ROOT / "normalized_data", ROOT / "public"]

GBIF_API = "https://api.gbif.org/v1/species/match"
JSTAGE_API = "https://api.jstage.jst.go.jp/searchapi/do"
CINII_API = "https://cir.nii.ac.jp/opensearch/articles"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; insect-hostplant-db/1.0)"
})
TIMEOUT = 15

FIELDNAMES = [
    "insect_id", "japanese_name", "scientific_name", "change_type",
    "current_value", "proposed_value", "source", "source_url",
    "confidence", "review_required", "note",
]


def find_csv(filename: str) -> Path | None:
    for d in CSV_CANDIDATES:
        p = d / filename
        if p.exists():
            return p
    return None


def load_insects() -> list[dict]:
    csv_path = find_csv("insects.csv")
    if not csv_path:
        print("エラー: insects.csv が見つかりません。")
        sys.exit(1)
    print(f"insects.csv: {csv_path}")
    with open(csv_path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_progress(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"last_index": 0, "checked_ids": []}


def save_progress(path: Path, progress: dict):
    path.write_text(
        json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def write_csv(path: Path, rows: list):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def check_gbif(scientific_name: str) -> dict | None:
    if not scientific_name.strip():
        return None
    try:
        resp = SESSION.get(
            GBIF_API,
            params={"name": scientific_name, "verbose": "true"},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()

        if data.get("matchType") == "NONE":
            return None

        accepted_name = data.get("species", "")
        status = data.get("status", "")
        synonym = data.get("synonym", False)

        if synonym and accepted_name:
            return {
                "change_type": "学名変更",
                "proposed_value": accepted_name,
                "source": "GBIF",
                "source_url": f"https://www.gbif.org/species/{data.get('usageKey', '')}",
                "confidence": "medium",
                "note": f"GBIF status: {status}, accepted: {accepted_name}",
            }
        return None
    except Exception:
        return None


def check_jstage(species_name: str) -> list[dict]:
    if not species_name.strip():
        return []
    results = []
    try:
        resp = SESSION.get(
            JSTAGE_API,
            params={"service": "3", "text": species_name, "count": "5", "start": "1"},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return []

        from xml.etree import ElementTree as ET
        root = ET.fromstring(resp.content)
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "prism": "http://prismstandard.org/namespaces/basic/2.0/",
        }
        for entry in root.findall(".//atom:entry", ns)[:3]:
            title_el = entry.find("atom:title", ns)
            link_el = entry.find("atom:link[@type='text/html']", ns)
            pub_date_el = entry.find("prism:publicationDate", ns)
            title = title_el.text if title_el is not None else ""
            url = link_el.get("href", "") if link_el is not None else ""
            pub_date = pub_date_el.text if pub_date_el is not None else ""
            if title:
                results.append({
                    "change_type": "論文発見",
                    "proposed_value": title,
                    "source": "J-STAGE",
                    "source_url": url,
                    "confidence": "low",
                    "note": f"公開日: {pub_date}",
                })
    except Exception:
        pass
    return results


def check_cinii(japanese_name: str) -> list[dict]:
    if not japanese_name.strip():
        return []
    results = []
    try:
        resp = SESSION.get(
            CINII_API,
            params={"q": japanese_name, "format": "json", "count": "5"},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        for item in data.get("items", [])[:3]:
            title = item.get("title", "")
            link = item.get("link", {}).get("@id", "")
            if isinstance(title, list):
                title = title[0] if title else ""
            if title:
                results.append({
                    "change_type": "論文発見",
                    "proposed_value": title if isinstance(title, str) else str(title),
                    "source": "CiNii",
                    "source_url": link,
                    "confidence": "low",
                    "note": "",
                })
    except Exception:
        pass
    return results


def main():
    parser = argparse.ArgumentParser(description="外部APIで最新情報を自動検索")
    parser.add_argument(
        "--slice", "-s",
        help="行範囲スライス（0始まり, 'start:end' 例: '0:2687'）",
    )
    parser.add_argument(
        "--output", "-o",
        help="出力CSVファイル（デフォルト: reports/api_update_candidates.csv）",
    )
    parser.add_argument(
        "--progress-file",
        help="進捗管理ファイル（並列実行時に分離するため）",
    )
    args = parser.parse_args()

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 出力先
    output_file = Path(args.output) if args.output else REPORTS_DIR / "api_update_candidates.csv"
    if not output_file.is_absolute():
        output_file = ROOT / output_file

    # 進捗ファイル
    progress_file = (
        Path(args.progress_file) if args.progress_file
        else REPORTS_DIR / "api_check_progress.json"
    )
    if not progress_file.is_absolute():
        progress_file = ROOT / progress_file

    all_insects = load_insects()

    # スライスで範囲を指定
    if args.slice:
        parts = args.slice.split(":")
        start = int(parts[0])
        end = int(parts[1]) if len(parts) > 1 else len(all_insects)
        insects = all_insects[start:end]
        print(f"スライス: [{start}:{end}] ({len(insects)}種 / 全{len(all_insects)}種)")
    else:
        insects = all_insects
        start = 0

    progress = load_progress(progress_file)
    # 進捗のlast_indexはスライス内の相対位置
    rel_start = progress.get("last_index", 0)
    checked_ids = set(progress.get("checked_ids", []))

    print(f"対象: {len(insects)}種")
    print(f"チェック済み: {len(checked_ids)}種")
    print(f"出力先: {output_file}\n")

    # 既存結果の読み込み
    existing_rows = []
    if output_file.exists():
        with open(output_file, encoding="utf-8") as f:
            existing_rows = list(csv.DictReader(f))

    all_rows = list(existing_rows)
    new_count = 0
    last_i = rel_start

    try:
        for i, insect in enumerate(insects[rel_start:], rel_start):
            last_i = i
            insect_id = insect.get("insect_id", "").strip()
            if not insect_id or insect_id in checked_ids:
                continue

            japanese_name = insect.get("japanese_name", "").strip()
            scientific_name = insect.get("scientific_name", "").strip()

            if not japanese_name and not scientific_name:
                checked_ids.add(insect_id)
                continue

            abs_idx = start + i + 1
            print(f"[{abs_idx}/{len(all_insects)}] {insect_id}: {japanese_name}")

            # 1) GBIF
            gbif_result = check_gbif(scientific_name)
            if gbif_result:
                row = {
                    "insect_id": insect_id,
                    "japanese_name": japanese_name,
                    "scientific_name": scientific_name,
                    "current_value": scientific_name,
                    "review_required": "YES" if gbif_result["change_type"] in ("学名変更", "和名変更") else "",
                    **gbif_result,
                }
                all_rows.append(row)
                new_count += 1
                print(f"  → GBIF: {gbif_result['change_type']}")
            time.sleep(1)

            # 2) J-STAGE
            jstage_results = check_jstage(scientific_name or japanese_name)
            for jr in jstage_results:
                all_rows.append({
                    "insect_id": insect_id,
                    "japanese_name": japanese_name,
                    "scientific_name": scientific_name,
                    "current_value": "",
                    "review_required": "",
                    **jr,
                })
                new_count += 1
            if jstage_results:
                print(f"  → J-STAGE: {len(jstage_results)}件")
            time.sleep(1)

            # 3) CiNii
            cinii_results = check_cinii(japanese_name)
            for cr in cinii_results:
                all_rows.append({
                    "insect_id": insect_id,
                    "japanese_name": japanese_name,
                    "scientific_name": scientific_name,
                    "current_value": "",
                    "review_required": "",
                    **cr,
                })
                new_count += 1
            if cinii_results:
                print(f"  → CiNii: {len(cinii_results)}件")
            time.sleep(1)

            checked_ids.add(insect_id)

            # 100件ごとに中間保存
            if (i + 1) % 100 == 0:
                progress["last_index"] = i + 1
                progress["checked_ids"] = sorted(checked_ids)
                save_progress(progress_file, progress)
                write_csv(output_file, all_rows)
                print(f"  --- 中間保存 ({i + 1}/{len(insects)}) ---")

    except KeyboardInterrupt:
        print("\n\n中断されました。進捗を保存します...")
    finally:
        progress["last_index"] = last_i + 1
        progress["checked_ids"] = sorted(checked_ids)
        save_progress(progress_file, progress)
        write_csv(output_file, all_rows)

    print(f"\n=== 完了 ===")
    print(f"新規発見: {new_count}件")
    print(f"累計結果: {len(all_rows)}件")
    print(f"出力: {output_file}")


if __name__ == "__main__":
    main()
