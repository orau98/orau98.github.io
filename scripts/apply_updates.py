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
import re
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

HOSTPLANT_PROPOSED_OVERRIDES = {
    "食草はキク科のCentaurea属が知られているが、日本では食草は未知": [],
    "食草は外国ではキク科のCarduus, Centaurea, Arctium, Serratula属": [],
    "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属": [
        {"plant_name": "オトギリソウ", "plant_family": "オトギリソウ科", "notes": "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属"},
        {"plant_name": "イワオトギリ", "plant_family": "オトギリソウ科", "notes": "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属"},
        {"plant_name": "シナノオトギリ", "plant_family": "オトギリソウ科", "notes": "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属"},
    ],
    "食草がケヤキ Zelkova serrata（ニレ科）と判明。ハルニレとエノキでも摂食": [
        {"plant_name": "ケヤキ", "plant_family": "ニレ科", "notes": "食草がケヤキ Zelkova serrata（ニレ科）と判明。ハルニレとエノキでも摂食"},
        {"plant_name": "ハルニレ", "plant_family": "ニレ科", "notes": "食草がケヤキ Zelkova serrata（ニレ科）と判明。ハルニレとエノキでも摂食"},
        {"plant_name": "エノキ", "plant_family": "アサ科", "notes": "食草がケヤキ Zelkova serrata（ニレ科）と判明。ハルニレとエノキでも摂食"},
    ],
    "食草がイボタ（モクセイ科）と判明": [
        {"plant_name": "イボタノキ", "plant_family": "モクセイ科", "notes": "食草がイボタ（モクセイ科）と判明"},
    ],
    "クロツバラ Rhamnus davurica（クロウメモドキ科）であることが判明": [
        {"plant_name": "クロツバラ", "plant_family": "クロウメモドキ科", "notes": "クロツバラ Rhamnus davurica（クロウメモドキ科）であることが判明"},
    ],
}


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


def build_hostplant_family_lookup(rows: list[dict]) -> dict[str, str]:
    lookup = {}
    for row in rows:
        plant_name = row.get("plant_name", "").strip()
        plant_family = row.get("plant_family", "").strip()
        if plant_name and plant_family and plant_name not in lookup:
            lookup[plant_name] = plant_family
    lookup.setdefault("オトギリソウ", "オトギリソウ科")
    lookup.setdefault("イワオトギリ", "オトギリソウ科")
    lookup.setdefault("シナノオトギリ", "オトギリソウ科")
    return lookup


def extract_japanese_plant_name(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    leading_match = re.match(r"^([一-龯ぁ-んァ-ヶー]+)", text)
    if leading_match and re.search(r"[A-Za-z]", text):
        return leading_match.group(1)
    jp_tokens = re.findall(r"[一-龯ぁ-んァ-ヶー]+", text)
    return jp_tokens[-1] if jp_tokens else text


def parse_hostplant_token(token: str, family_lookup: dict[str, str], default_family: str = "") -> dict | None:
    token = token.strip(" 、。")
    if not token:
        return None

    family = default_family
    name_text = token

    paren_match = re.match(r"^(.+?)[（(]([^）)]+科)[）)]$", token)
    if paren_match:
        name_text = paren_match.group(1).strip()
        family = paren_match.group(2).strip()

    plant_name = extract_japanese_plant_name(name_text)
    if not plant_name:
        return None
    if not family:
        family = family_lookup.get(plant_name, "")

    return {
        "plant_name": plant_name,
        "plant_family": family,
        "notes": "",
    }


def normalize_hostplant_additions(proposed: str, family_lookup: dict[str, str]) -> list[dict]:
    proposed = proposed.strip()
    if not proposed:
        return []

    if proposed in HOSTPLANT_PROPOSED_OVERRIDES:
        return [dict(entry) for entry in HOSTPLANT_PROPOSED_OVERRIDES[proposed]]

    if proposed.startswith("食草："):
        payload = proposed.split("：", 1)[1].strip()
        if "、" in payload:
            entries = []
            default_family = ""
            for token in payload.split("、"):
                entry = parse_hostplant_token(token, family_lookup, default_family)
                if not entry:
                    continue
                entries.append(entry)
                if entry["plant_family"]:
                    default_family = entry["plant_family"]
            return entries
        entry = parse_hostplant_token(payload, family_lookup)
        return [entry] if entry else []

    match = re.match(r"^食草が(.+?)[（(]([^）)]+科)[）)](?:と判明|であることが判明)", proposed)
    if match:
        plant_name = extract_japanese_plant_name(match.group(1))
        if plant_name:
            return [{
                "plant_name": plant_name,
                "plant_family": match.group(2).strip(),
                "notes": proposed,
            }]

    match = re.match(r"^([一-龯ぁ-んァ-ヶー]+)\s+[A-Za-z][^（(]*[（(]([^）)]+科)[）)]であることが判明$", proposed)
    if match:
        return [{
            "plant_name": match.group(1).strip(),
            "plant_family": match.group(2).strip(),
            "notes": proposed,
        }]

    simple_entry = parse_hostplant_token(proposed, family_lookup)
    if simple_entry and simple_entry["plant_name"] == proposed:
        return [simple_entry]

    if any(marker in proposed for marker in ("食草：", "食草は", "食草が", "判明", "確認", "記録", "採集", "摂食")):
        return []

    return [simple_entry] if simple_entry else []


def hostplant_row_exists(rows: list[dict], insect_id: str, plant_name: str, plant_family: str, source: str) -> bool:
    for row in rows:
        if row.get("insect_id", "").strip() != insect_id:
            continue
        if row.get("plant_name", "").strip() != plant_name:
            continue
        if row.get("reference", "").strip() != source:
            continue
        if row.get("plant_family", "").strip() != plant_family:
            continue
        return True
    return False


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

    family_lookup = build_hostplant_family_lookup(rows)
    normalized_entries = normalize_hostplant_additions(proposed, family_lookup)
    if not normalized_entries:
        print(f"    スキップ（食草名を抽出できず手修正が必要）: {proposed}")
        return False

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
    next_id = max_id + 1
    added_rows = []

    for entry in normalized_entries:
        plant_name = entry.get("plant_name", "").strip()
        plant_family = entry.get("plant_family", "").strip()
        notes = entry.get("notes", "").strip()
        if not plant_name:
            continue
        if hostplant_row_exists(rows, insect_id, plant_name, plant_family, source):
            print(f"    重複スキップ: {insect_id}: {plant_name}")
            continue

        new_row = {
            "record_id": f"hostplant-{next_id:06d}",
            "insect_id": insect_id,
            "plant_name": plant_name,
            "plant_family": plant_family,
            "observation_type": "",
            "plant_part": "",
            "life_stage": "",
            "reference": source,
            "notes": notes,
        }
        rows.append(new_row)
        added_rows.append(new_row)
        next_id += 1

    if not added_rows:
        print("    追加対象なし")
        return False

    # 書き出し
    with open(hostplants_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    for added in added_rows:
        print(f"    食草追加: {added['record_id']} → {insect_id}: {added['plant_name']}")
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
