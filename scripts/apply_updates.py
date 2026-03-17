#!/usr/bin/env python3
"""承認済み差分をCSVに反映

- 引数: reports/update_candidates.csv（人間が確認・編集済み）
- approved列が「OK」の行のみ処理
- 安全装置:
  - バックアップなしには絶対に実行しない
  - validate-normalized でエラーが出たら即停止・自動ロールバック
  - git push は絶対に自動実行しない
  - 学名変更・和名変更は --force フラグなしでは適用しない
"""

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"
BACKUP_DIR = ROOT / "public" / "backup"
DEFAULT_INPUT = REPORTS_DIR / "update_candidates.csv"

# CSVの場所（validate-normalized.mjs と同じロジック）
CSV_CANDIDATES_DIRS = [ROOT / "normalized_data", ROOT / "public"]

# 学名・和名変更は --force 必須
FORCE_REQUIRED_TYPES = {"学名変更", "和名変更"}


def find_csv(filename: str) -> Path | None:
    for d in CSV_CANDIDATES_DIRS:
        p = d / filename
        if p.exists():
            return p
    return None


def create_backup() -> Path:
    """日付付きバックアップを作成"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / timestamp
    backup_path.mkdir(parents=True, exist_ok=True)

    files_to_backup = [
        ("insects.csv", find_csv("insects.csv")),
        ("hostplants.csv", find_csv("hostplants.csv")),
        ("general_notes.csv", find_csv("general_notes.csv")),
    ]

    backed_up = []
    for name, src in files_to_backup:
        if src and src.exists():
            dest = backup_path / name
            shutil.copy2(src, dest)
            backed_up.append(name)
            print(f"  バックアップ: {src} → {dest}")

    if not backed_up:
        print("エラー: バックアップ対象のファイルが見つかりません。")
        sys.exit(1)

    print(f"  バックアップ先: {backup_path}")
    return backup_path


def rollback(backup_path: Path):
    """バックアップからロールバック"""
    print("\n!!! ロールバック実行 !!!")
    for backup_file in backup_path.iterdir():
        if backup_file.suffix == ".csv":
            original = find_csv(backup_file.name)
            if original:
                shutil.copy2(backup_file, original)
                print(f"  復元: {backup_file} → {original}")
    print("ロールバック完了。")


def load_candidates(input_path: Path) -> list[dict]:
    """update_candidates.csv を読み込み"""
    if not input_path.exists():
        print(f"エラー: {input_path} が見つかりません。")
        sys.exit(1)
    with open(input_path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def apply_hostplant_addition(row: dict, hostplants_path: Path):
    """食草追加: hostplants.csv に新レコードを追加"""
    insect_id = row.get("insect_id", "").strip()
    proposed = row.get("proposed_value", "").strip()
    source = row.get("source", "").strip()

    if not insect_id or not proposed:
        print(f"    スキップ（データ不足）: insect_id={insect_id}, proposed={proposed}")
        return False

    # 既存レコードを読み込み
    with open(hostplants_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    # 新しいrecord_idを生成
    max_id = 0
    for r in rows:
        rid = r.get("record_id", "")
        if rid.startswith("hostplant-"):
            try:
                num = int(rid.replace("hostplant-", "").split("-")[0])
                if num > max_id:
                    max_id = num
            except ValueError:
                pass
    new_id = f"hostplant-{max_id + 1:06d}"

    # 植物名と科名を分離（"ノイバラ(バラ科)" → name="ノイバラ", family="バラ科"）
    plant_name = proposed
    plant_family = ""
    if "(" in proposed and proposed.endswith(")"):
        parts = proposed.rsplit("(", 1)
        plant_name = parts[0]
        plant_family = parts[1].rstrip(")")
    elif "（" in proposed and proposed.endswith("）"):
        parts = proposed.rsplit("（", 1)
        plant_name = parts[0]
        plant_family = parts[1].rstrip("）")

    new_row = {
        "record_id": new_id,
        "insect_id": insect_id,
        "plant_name": plant_name,
        "plant_family": plant_family,
        "observation_type": "",
        "plant_part": "",
        "life_stage": "",
        "reference": source,
        "notes": "",
    }
    rows.append(new_row)

    # 書き出し
    with open(hostplants_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"    食草追加: {new_id} → {insect_id}: {plant_name}")
    return True


def apply_scientific_name_change(row: dict, insects_path: Path):
    """学名変更: insects.csv の scientific_name を更新"""
    insect_id = row.get("insect_id", "").strip()
    proposed = row.get("proposed_value", "").strip()

    if not insect_id or not proposed:
        print(f"    スキップ（データ不足）: insect_id={insect_id}")
        return False

    with open(insects_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    updated = False
    for r in rows:
        if r.get("insect_id", "").strip() == insect_id:
            old_name = r.get("scientific_name", "")
            r["scientific_name"] = proposed
            # 旧学名を synonyms に追加
            old_synonyms = r.get("synonyms", "")
            if old_name and old_name not in old_synonyms:
                r["synonyms"] = f"{old_synonyms}; {old_name}".strip("; ")
            print(f"    学名変更: {insect_id}: {old_name} → {proposed}")
            updated = True
            break

    if updated:
        with open(insects_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    return updated


def apply_japanese_name_change(row: dict, insects_path: Path):
    """和名変更: insects.csv の japanese_name を更新"""
    insect_id = row.get("insect_id", "").strip()
    proposed = row.get("proposed_value", "").strip()

    if not insect_id or not proposed:
        print(f"    スキップ（データ不足）: insect_id={insect_id}")
        return False

    with open(insects_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    updated = False
    for r in rows:
        if r.get("insect_id", "").strip() == insect_id:
            old_name = r.get("japanese_name", "")
            r["japanese_name"] = proposed
            # 旧和名を old_japanese_name に追加
            old_jp = r.get("old_japanese_name", "")
            if old_name and old_name not in old_jp:
                r["old_japanese_name"] = f"{old_jp}; {old_name}".strip("; ")
            print(f"    和名変更: {insect_id}: {old_name} → {proposed}")
            updated = True
            break

    if updated:
        with open(insects_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    return updated


def apply_new_species(row: dict, insects_path: Path):
    """新規種追加: insects.csv に新行を追加"""
    japanese_name = row.get("japanese_name", "").strip()
    scientific_name = row.get("scientific_name", "").strip()
    proposed = row.get("proposed_value", "").strip()

    if not japanese_name and not scientific_name:
        print("    スキップ（和名・学名なし）")
        return False

    with open(insects_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    # 新しいinsect_idを生成（species-NNNN の最大値 + 1）
    max_num = 0
    for r in rows:
        iid = r.get("insect_id", "")
        if iid.startswith("species-"):
            suffix = iid.replace("species-", "")
            try:
                num = int(suffix)
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    new_id = f"species-{max_num + 1:04d}"

    new_row = {fn: "" for fn in fieldnames}
    new_row["insect_id"] = new_id
    new_row["japanese_name"] = japanese_name
    new_row["scientific_name"] = scientific_name
    new_row["notes"] = f"自動追加: {proposed}"
    rows.append(new_row)

    with open(insects_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"    新規種追加: {new_id}: {japanese_name} ({scientific_name})")
    return True


def run_validate() -> bool:
    """npm run validate-normalized を実行"""
    print("\n--- バリデーション実行 ---")
    result = subprocess.run(
        ["npm", "run", "validate-normalized"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"バリデーションエラー:\n{result.stderr}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="承認済み差分をCSVに反映")
    parser.add_argument(
        "input",
        nargs="?",
        default=str(DEFAULT_INPUT),
        help=f"入力CSVパス（デフォルト: {DEFAULT_INPUT}）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="学名変更・和名変更も適用する（通常は拒否）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際のCSV更新を行わず、何が適用されるか表示のみ",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    candidates = load_candidates(input_path)

    # 承認済みの行を抽出
    approved = [r for r in candidates if r.get("approved", "").strip().upper() == "OK"]
    if not approved:
        print("承認済みの行がありません。approved 列に 'OK' を記入してください。")
        return

    print(f"=== 更新適用 ===")
    print(f"入力: {input_path}")
    print(f"承認済み: {len(approved)}件 / 全{len(candidates)}件")
    if args.force:
        print("--force: 学名・和名変更を許可")
    if args.dry_run:
        print("--dry-run: 表示のみ（CSV変更なし）")
    print()

    # --force チェック
    force_needed = [
        r for r in approved if r.get("change_type", "") in FORCE_REQUIRED_TYPES
    ]
    if force_needed and not args.force:
        print(f"エラー: 学名/和名変更が {len(force_needed)}件 含まれていますが、--force が指定されていません。")
        print("以下の行が対象:")
        for r in force_needed:
            print(f"  {r.get('insect_id')}: {r.get('change_type')} → {r.get('proposed_value')}")
        print("\n--force を付けて再実行するか、approved を取り消してください。")
        sys.exit(1)

    if args.dry_run:
        print("--- ドライラン: 以下の変更が適用されます ---")
        for r in approved:
            print(f"  [{r.get('change_type')}] {r.get('insect_id', '?')}: {r.get('proposed_value', '')}")
        return

    # バックアップ作成
    print("--- バックアップ作成 ---")
    backup_path = create_backup()

    # CSVパスの取得
    insects_path = find_csv("insects.csv")
    hostplants_path = find_csv("hostplants.csv")

    if not insects_path:
        print("エラー: insects.csv が見つかりません。")
        sys.exit(1)

    # 変更適用
    print("\n--- 変更適用 ---")
    applied = 0
    skipped = 0

    for r in approved:
        change_type = r.get("change_type", "").strip()
        print(f"\n  処理: [{change_type}] {r.get('insect_id', '?')}")

        if change_type == "食草追加":
            if hostplants_path:
                if apply_hostplant_addition(r, hostplants_path):
                    applied += 1
                else:
                    skipped += 1
            else:
                print("    hostplants.csv が見つかりません — スキップ")
                skipped += 1

        elif change_type == "学名変更":
            if apply_scientific_name_change(r, insects_path):
                applied += 1
            else:
                skipped += 1

        elif change_type == "和名変更":
            if apply_japanese_name_change(r, insects_path):
                applied += 1
            else:
                skipped += 1

        elif change_type == "新規種追加":
            if apply_new_species(r, insects_path):
                applied += 1
            else:
                skipped += 1

        else:
            print(f"    未対応の変更種別: {change_type} — スキップ")
            skipped += 1

    print(f"\n--- 結果 ---")
    print(f"適用: {applied}件, スキップ: {skipped}件")

    if applied == 0:
        print("適用された変更はありません。")
        return

    # バリデーション
    if not run_validate():
        print("\nバリデーションに失敗しました。自動ロールバックを実行します。")
        rollback(backup_path)
        sys.exit(1)

    print("\nバリデーション成功。")

    # ビルド確認
    print("\n" + "=" * 50)
    answer = input("npm run build を実行してよいですか？ (yes/no): ").strip().lower()
    if answer in ("yes", "y", "はい"):
        print("\n--- ビルド実行 ---")
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=str(ROOT),
        )
        if result.returncode != 0:
            print("\nビルドに失敗しました。バックアップからの復元を検討してください。")
            print(f"バックアップ: {backup_path}")
            sys.exit(1)
        print("\nビルド完了。git push は手動で行ってください。")
    else:
        print("\nビルドをスキップしました。")
        print("手動で実行する場合: npm run build")

    print(f"\nバックアップ: {backup_path}")
    print("git push は手動で行ってください。")


if __name__ == "__main__":
    main()
