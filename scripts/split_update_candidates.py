#!/usr/bin/env python3
"""Split update_candidates.csv into small review/apply batches.

The source CSV can contain thousands of rows. This helper keeps each Codex
session small by producing numbered CSV files that can be reviewed or applied
one at a time.
"""

import argparse
import csv
import json
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"
DEFAULT_INPUT = REPORTS_DIR / "update_candidates.csv"
DEFAULT_OUTPUT_DIR = REPORTS_DIR / "update_batches"
APPLY_SUPPORTED_TYPES = {"食草追加", "学名変更", "和名変更", "新規種追加"}


def load_rows(input_path: Path) -> tuple[list[str], list[dict]]:
    if not input_path.exists():
        raise SystemExit(f"入力CSVが見つかりません: {input_path}")
    with input_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def row_matches_mode(row: dict, mode: str) -> bool:
    approved = row.get("approved", "").strip().upper() == "OK"
    review_required = row.get("review_required", "").strip().upper() == "YES"
    if mode == "approved":
        return approved
    if mode == "pending":
        return not approved
    if mode == "review":
        return review_required
    return True


def filter_rows(
    rows: list[dict],
    mode: str,
    change_types: set[str],
    apply_supported_only: bool,
    require_insect_id: bool,
) -> list[dict]:
    filtered = [row for row in rows if row_matches_mode(row, mode)]
    if change_types:
        filtered = [row for row in filtered if row.get("change_type", "") in change_types]
    if apply_supported_only:
        filtered = [
            row for row in filtered
            if row.get("change_type", "") in APPLY_SUPPORTED_TYPES
        ]
    if require_insect_id:
        filtered = [row for row in filtered if row.get("insect_id", "").strip()]
    return filtered


def chunk_rows(rows: list[dict], batch_size: int) -> list[list[dict]]:
    return [rows[i:i + batch_size] for i in range(0, len(rows), batch_size)]


def write_batch(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="reports/update_candidates.csv を小さいバッチCSVへ分割",
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=str(DEFAULT_INPUT),
        help=f"入力CSVパス（デフォルト: {DEFAULT_INPUT}）",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"出力ディレクトリ（デフォルト: {DEFAULT_OUTPUT_DIR}）",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=25,
        help="1ファイルあたりの行数（デフォルト: 25）",
    )
    parser.add_argument(
        "--mode",
        choices=["approved", "pending", "review", "all"],
        default="approved",
        help="分割対象（デフォルト: approved）",
    )
    parser.add_argument(
        "--change-type",
        action="append",
        default=[],
        help="対象 change_type。複数指定可",
    )
    parser.add_argument(
        "--apply-supported-only",
        action="store_true",
        help="apply_updates.py が扱える change_type だけに絞る",
    )
    parser.add_argument(
        "--require-insect-id",
        action="store_true",
        help="insect_id が空の行を除外する",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="既存の出力ディレクトリを削除して作り直す",
    )
    args = parser.parse_args()

    if args.batch_size < 1:
        raise SystemExit("--batch-size は1以上にしてください。")

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    if not input_path.is_absolute():
        input_path = ROOT / input_path
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir

    fieldnames, rows = load_rows(input_path)
    selected = filter_rows(
        rows,
        mode=args.mode,
        change_types=set(args.change_type),
        apply_supported_only=args.apply_supported_only,
        require_insect_id=args.require_insect_id,
    )

    if args.fresh and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    batches = chunk_rows(selected, args.batch_size)
    manifest_batches = []
    for index, batch in enumerate(batches, start=1):
        filename = f"{args.mode}-batch-{index:03d}.csv"
        batch_path = output_dir / filename
        write_batch(batch_path, fieldnames, batch)
        type_counts = dict(Counter(row.get("change_type", "") for row in batch))
        force_required = sum(
            1 for row in batch
            if row.get("change_type", "") in {"学名変更", "和名変更"}
        )
        manifest_batches.append({
            "file": str(batch_path.relative_to(ROOT)),
            "rows": len(batch),
            "change_type_counts": type_counts,
            "force_required_rows": force_required,
        })

    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "input": str(input_path.relative_to(ROOT)),
        "output_dir": str(output_dir.relative_to(ROOT)),
        "mode": args.mode,
        "batch_size": args.batch_size,
        "change_types": args.change_type,
        "apply_supported_only": args.apply_supported_only,
        "require_insect_id": args.require_insect_id,
        "total_input_rows": len(rows),
        "selected_rows": len(selected),
        "batch_count": len(batches),
        "batches": manifest_batches,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"入力: {input_path.relative_to(ROOT)}")
    print(f"対象: {len(selected)}件 / 全{len(rows)}件")
    print(f"出力: {output_dir.relative_to(ROOT)}")
    print(f"バッチ数: {len(batches)}")
    print(f"manifest: {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
