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
YLIST_LITE_PATH = ROOT / "public" / "assets" / "data-lite" / "ylist-lite.json"

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

SCIENTIFIC_PLANT_TOKEN_OVERRIDES = {
    "Carex sp.": {"plant_name": "スゲ属", "plant_family": "カヤツリグサ科"},
}

INVALID_PLANT_NAMES = {
    "枯葉",
    "植物",
    "複数の植物",
    "キク科野草",
    "食葉性",
    "判明",
    "羽化",
    "葉",
    "み",
}

INVALID_PLANT_NAME_PATTERN = re.compile(
    r"(食草|幼虫|採集|確認|記録|飼育|摂食|寄主|本種|小笠原|終齢|として|では|から|での|発見|発生|加害|食害|つくこ|するこ|巻いて住む|越冬|蛹化|従来|生活環|繭構成物|営繭|あるこ|生育|県|市|郡|町|村)"
)


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
    with open(input_path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def build_hostplant_family_lookup(rows: list[dict]) -> dict[str, str]:
    lookup = {}
    if YLIST_LITE_PATH.exists():
        with open(YLIST_LITE_PATH, encoding="utf-8") as f:
            payload = json.load(f)
        for japanese_name, detail in (payload.get("plants") or {}).items():
            family = ((detail or {}).get("familyJp") or "").strip()
            if japanese_name and family:
                lookup[japanese_name] = family
    for row in rows:
        plant_name = row.get("plant_name", "").strip()
        plant_family = row.get("plant_family", "").strip()
        if plant_name and plant_family and plant_name not in lookup:
            lookup[plant_name] = plant_family
    lookup.setdefault("オトギリソウ", "オトギリソウ科")
    lookup.setdefault("イワオトギリ", "オトギリソウ科")
    lookup.setdefault("シナノオトギリ", "オトギリソウ科")
    lookup.setdefault("ノバラ", "バラ科")
    lookup.setdefault("カラフトイバラ", "バラ科")
    lookup.setdefault("セイヨウタンポポ", "キク科")
    lookup.setdefault("ヌマガヤ", "イネ科")
    lookup.setdefault("イヌビエ", "イネ科")
    lookup.setdefault("アカリ", "")
    lookup.setdefault("アカザ", "ヒユ科")
    lookup.setdefault("イワオオギ", "マメ科")
    lookup.setdefault("ウニヤバネゴケ", "ウロコゴケ綱")
    lookup.setdefault("モエギコミミゴケ", "ウロコゴケ綱")
    lookup.setdefault("オオキゴケ", "キゴケ科")
    lookup.setdefault("キールンカンコノキ", "コミカンソウ科")
    lookup.setdefault("シャク", "セリ科")
    lookup.setdefault("キオン", "キク科")
    lookup.setdefault("タムラソウ", "キク科")
    lookup.setdefault("フキ", "キク科")
    lookup.setdefault("ウバメガシ", "ブナ科")
    lookup.setdefault("イヌビワ", "クワ科")
    lookup.setdefault("ネザサ", "イネ科")
    lookup.setdefault("ヨモギ属", "キク科")
    lookup.setdefault("ハンノキ", "カバノキ科")
    lookup.setdefault("ヒラドツツジ", "ツツジ科")
    lookup.setdefault("ドロノキ", "ヤナギ科")
    lookup.setdefault("ノコンギク", "キク科")
    lookup.setdefault("ユウガギク", "キク科")
    lookup.setdefault("オクラ", "アオイ科")
    lookup.setdefault("ビロードスゲ", "カヤツリグサ科")
    lookup.setdefault("シリブカカシ", "ブナ科")
    lookup.setdefault("フモトシダ", "コバノイシカグマ科")
    return lookup


def normalize_scientific_plant_name(value: str) -> str:
    normalized = re.sub(r"\s+", " ", (value or "").strip())
    normalized = re.sub(r"\s+(?:subsp\.|var\.|f\.)\s+[A-Za-z-]+.*$", "", normalized, flags=re.IGNORECASE)
    return normalized.strip()


def build_ylist_scientific_lookup() -> dict[str, dict]:
    if not YLIST_LITE_PATH.exists():
        return {}

    with open(YLIST_LITE_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    buckets: dict[str, list[dict]] = {}
    for japanese_name, detail in (payload.get("plants") or {}).items():
        scientific_name = (detail or {}).get("scientificName", "").strip()
        if not japanese_name or not scientific_name:
            continue

        family = ((detail or {}).get("familyJp") or "").strip()
        for alias in {scientific_name, normalize_scientific_plant_name(scientific_name)}:
            if not alias:
                continue
            buckets.setdefault(alias, []).append(
                {
                    "plant_name": japanese_name.strip(),
                    "plant_family": family,
                }
            )

    lookup: dict[str, dict] = {}
    for alias, entries in buckets.items():
        unique_names = {entry["plant_name"] for entry in entries if entry["plant_name"]}
        if len(unique_names) != 1:
            continue
        first = entries[0]
        lookup[alias] = {
            "plant_name": first["plant_name"],
            "plant_family": first.get("plant_family", ""),
        }
    return lookup


def extract_japanese_plant_name(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    leading_match = re.match(r"^([一-龯ぁ-んァ-ヶー]+)", text)
    if leading_match and re.search(r"[A-Za-z]", text):
        return leading_match.group(1)
    jp_tokens = re.findall(r"[一-龯ぁ-んァ-ヶー]+", text)
    if jp_tokens:
        return jp_tokens[-1]
    if re.search(r"[A-Za-z]", text):
        return ""
    return text


def normalize_parenthetical_family(text: str) -> str:
    def repl(match: re.Match) -> str:
        content = match.group(1).strip()
        common_family = re.fullmatch(r"いずれも([一-龯ぁ-んァ-ヶー]+科)", content)
        if common_family:
            return f"（{common_family.group(1)}）"
        family_match = re.search(r"([一-龯ぁ-んァ-ヶー]+科)", content)
        jp_candidates = [
            candidate
            for candidate in re.findall(r"[一-龯ぁ-んァ-ヶー]+", content)
            if candidate != "いずれも" and not candidate.endswith("科")
        ]
        if family_match and jp_candidates:
            return f"（{jp_candidates[0]} {family_match.group(1)}）"
        exact_family = re.fullmatch(r"[一-龯ぁ-んァ-ヶー]+科", content)
        if exact_family:
            return f"（{content}）"
        prefix_family = re.match(r"^([一-龯ぁ-んァ-ヶー]+科)", content)
        if prefix_family:
            return f"（{prefix_family.group(1)}）"
        trailing_family_match = re.search(r"(?:^|[、，\s])([一-龯ぁ-んァ-ヶー]+科)$", content)
        if trailing_family_match:
            return f"（{trailing_family_match.group(1)}）"
        return ""

    return re.sub(r"[（(]([^）)]*)[）)]", repl, text)


def parse_hostplant_token(
    token: str,
    family_lookup: dict[str, str],
    default_family: str = "",
    scientific_lookup: dict[str, dict] | None = None,
) -> dict | None:
    token = token.strip(" 、。")
    if not token:
        return None

    family = default_family
    explicit_family_taxon = bool(re.search(r"[一-龯ぁ-んァ-ヶー]+科(?:植物|の仲間|$)", token))
    raw_parenthetical = re.search(r"[（(]([^）)]*)[）)]", token)
    parenthetical_name = ""
    if raw_parenthetical:
        content = raw_parenthetical.group(1)
        family_match = re.search(r"([一-龯ぁ-んァ-ヶー]+科)", content)
        if family_match:
            family = family_match.group(1)
        jp_candidates = [
            candidate
            for candidate in re.findall(r"[一-龯ぁ-んァ-ヶー]+", content)
            if candidate != "いずれも" and not candidate.endswith("科")
        ]
        if jp_candidates:
            parenthetical_name = jp_candidates[0]

    name_text = normalize_parenthetical_family(token)
    name_text = re.sub(r"^(?:小笠原で|終齢幼虫では|幼虫では)", "", name_text).strip()
    name_text = re.sub(r"^.*?産は", "", name_text).strip()
    name_text = re.sub(r"などの[一-龯ぁ-んァ-ヶー]+$", "", name_text).strip()
    name_text = re.sub(r"からも確認$", "", name_text).strip()

    paren_match = re.match(r"^(.+?)[（(]([一-龯ぁ-んァ-ヶー]+科)[）)]$", name_text)
    if paren_match:
        name_text = paren_match.group(1).strip()
        family = paren_match.group(2).strip()
    else:
        name_text = re.sub(r"[（(][^）)]*[）)]", "", name_text).strip(" 、。")

    if parenthetical_name and not re.search(r"[一-龯ぁ-んァ-ヶー]", name_text):
        name_text = parenthetical_name

    family_prefix_match = re.match(r"^([一-龯ぁ-んァ-ヶー]+科)の(.+)$", name_text)
    if family_prefix_match:
        family = family_prefix_match.group(1)
        name_text = family_prefix_match.group(2).strip()
    else:
        family_prefix_match = re.match(r"^([一-龯ぁ-んァ-ヶー]+科)([一-龯ぁ-んァ-ヶー]+)$", name_text)
        if family_prefix_match:
            family = family_prefix_match.group(1)
            name_text = family_prefix_match.group(2).strip()
        else:
            family_prefix_match = re.match(r"^([一-龯ぁ-んァ-ヶー]+科)([一-龯ぁ-んァ-ヶー]+)(?:\s|$)", name_text)
            if family_prefix_match:
                family = family_prefix_match.group(1)
                name_text = family_prefix_match.group(2).strip()
    genus_prefix_match = re.match(r"^[一-龯ぁ-んァ-ヶー]+属の(.+)$", name_text)
    if genus_prefix_match:
        name_text = genus_prefix_match.group(1).strip()
    if name_text == "スゲの一種":
        name_text = "スゲ属"
        family = family or "カヤツリグサ科"
    if name_text.startswith("スゲの一種"):
        name_text = "スゲ属"
        family = family or "カヤツリグサ科"
    name_text = re.sub(r"^.*?で(?=[一-龯ぁ-んァ-ヶー]+$)", "", name_text).strip()
    name_text = re.sub(r"^(?:して|湿らせた)", "", name_text).strip()
    name_text = re.sub(r"の(?:花|葉|実)$", "", name_text).strip()
    name_text = re.sub(r"(?:の若葉|の果実|の種子|の根茎基部|の栄養葉|の生葉|の葉上|の枯葉|の花蕾|の花蕾・葉|の害虫)$", "", name_text).strip()
    name_text = re.sub(r"(?:のみ|等)$", "", name_text).strip()
    name_text = re.sub(r"(?:属|科)$", lambda m: m.group(0), name_text).strip()

    plant_name = extract_japanese_plant_name(name_text)
    if plant_name.startswith("スゲの一種"):
        plant_name = "スゲ属"
        family = family or "カヤツリグサ科"
    if plant_name == "植物" and family:
        plant_name = family
        family = ""
        explicit_family_taxon = True
    if plant_name in INVALID_PLANT_NAMES:
        return None
    if not plant_name:
        override = SCIENTIFIC_PLANT_TOKEN_OVERRIDES.get(normalize_scientific_plant_name(name_text))
        if override:
            plant_name = override["plant_name"]
            if not family:
                family = override.get("plant_family", "")
        else:
            resolved = (scientific_lookup or {}).get(normalize_scientific_plant_name(name_text))
            if not resolved:
                return None
            plant_name = resolved["plant_name"]
            if not family:
                family = resolved.get("plant_family", "")
    if not plant_name:
        return None
    if not family:
        resolved = (scientific_lookup or {}).get(normalize_scientific_plant_name(name_text))
        if resolved:
            family = resolved.get("plant_family", "")
    if not family:
        family = family_lookup.get(plant_name, "")
    if family and INVALID_PLANT_NAME_PATTERN.search(family):
        family = family_lookup.get(plant_name, "")
    if plant_name in INVALID_PLANT_NAMES:
        return None
    if plant_name.endswith("科") and not explicit_family_taxon:
        return None
    if INVALID_PLANT_NAME_PATTERN.search(plant_name):
        return None

    return {
        "plant_name": plant_name,
        "plant_family": family,
        "notes": "",
    }


def parse_hostplant_tokens(
    payload: str,
    family_lookup: dict[str, str],
    scientific_lookup: dict[str, dict] | None = None,
) -> list[dict]:
    entries = []
    common_family_match = re.search(r"いずれも([一-龯ぁ-んァ-ヶー]+科)", payload)
    common_family = common_family_match.group(1) if common_family_match else ""
    normalized_payload = normalize_parenthetical_family(payload)
    normalized_payload = re.sub(r"^.*?産は", "", normalized_payload)
    normalized_payload = re.sub(r"など複数の植物", "", normalized_payload)
    normalized_payload = re.sub(r"\s*および\s*", "、", normalized_payload)
    normalized_payload = re.sub(r"\s*と\s*", "、", normalized_payload)
    normalized_payload = re.sub(r"[，、及び・/]", "、", normalized_payload)
    for token in normalized_payload.split("、"):
        entry = parse_hostplant_token(token, family_lookup, "", scientific_lookup)
        if not entry:
            continue
        if common_family and not entry.get("plant_family"):
            entry["plant_family"] = common_family
        entries.append(entry)
    return entries


def normalize_hostplant_additions(
    proposed: str,
    family_lookup: dict[str, str],
    scientific_lookup: dict[str, dict] | None = None,
) -> list[dict]:
    proposed = proposed.strip()
    if not proposed:
        return []

    if any(marker in proposed for marker in ("日本では食草は未知", "わが国での食草は未知")):
        return []
    if proposed.startswith("食草は外国では") or proposed.startswith("ヨーロッパでは"):
        return []

    if proposed in HOSTPLANT_PROPOSED_OVERRIDES:
        return [dict(entry) for entry in HOSTPLANT_PROPOSED_OVERRIDES[proposed]]

    if proposed.startswith("食草："):
        payload = proposed.split("：", 1)[1].strip()
        if any(separator in payload for separator in ("、", "，", "及び", "・", "/")):
            return parse_hostplant_tokens(payload, family_lookup, scientific_lookup)
        entry = parse_hostplant_token(payload, family_lookup, scientific_lookup=scientific_lookup)
        return [entry] if entry else []

    phrase_patterns = [
        r"^幼虫の飼育により、(.+?)を食草として確認",
        r"^幼虫の食草は(.+?)(?:のみ|[。、]|$)",
        r"^幼虫の食草が(.+?)であることを.*確認",
        r"^幼虫は(.+?)の(?:葉|枯葉).*?(?:摂食|巻いて)",
        r"^幼虫は(.+?)を食",
        r"^幼虫は(.+?)を摂食",
        r"^幼虫が(.+?)を食餌として確認",
        r"^幼虫が(.+?)で飼育され",
        r"^幼虫が(.+?)で生育することを確認",
        r"^幼虫が(.+?)につくことが確認",
        r".*食草は(.+?)(?:[)。、]|$)",
        r"^食草として(.+?)を(?:初記録|確認|記録)",
        r"^食草は(.+?)(?:と判明|$)",
        r"^主要食草は(.+?)と判明",
        r"^(.+?)を(?:高山植物)?食草として(?:確認|記録)",
        r"^(.+?)を食草として(?:初)?(?:確認|記録)",
        r"^(.+?)を食草として.*?(?:確認|記録)",
        r"^(.+?)を食草として追加",
        r"^(.+?)を食草確認",
        r"^(.+?)を食草[。、]?",
        r"^(.+?)を新寄主植物として記録",
        r"^(.+?)を新たな寄主植物として確認",
        r"^(.+?)を寄主植物として確認",
        r"^(.+?)を新食草として(?:確認|追加記録)",
        r"^(.+?)を新食樹として確認",
        r"^(.+?)を新しい食餌植物として記録",
        r"^(.+?)を食餌植物として確認",
        r"^([^。]+?)を確認",
        r"^(.+?)を追加食草として確認",
        r"^(.+?)を主食草として確認",
        r"^(.+?)を食餌とすることが特定",
        r"^(.+?)を摂食することを確認",
        r"^野生寄主として(.+?)を確認",
        r"^(.+?)での飼育に成功",
        r"^(.+?)で飼育に成功",
        r"^(.+?)で採卵飼育に成功",
        r"^(.+?)で大発生",
        r"^(.+?)での営繭を確認",
        r"^(.+?)での越冬態",
        r"^(.+?)につくことを確認",
        r"^(.+?)につくことを初めて確認",
        r"^(.+?)からの発生を新記録",
        r"^(.+?)[、，](?:終齢幼虫では|幼虫では).+?も摂食",
        r"、([^、。]+?)も摂食",
        r"^(.+?)で幼虫の飼育に成功",
        r"^(.+?)の花から幼虫を採集",
        r"^(.+?)の(?:若葉|果実|実|種子|葉|栄養葉|根茎基部|花蕾・葉|生葉|花).*?(?:食害|摂食|食草|採集|確認|発見|記録)",
        r"^(.+?)から(?:若齢|終齢|老熟|成熟)?幼虫.*?(?:採集|確認|発見|初めて発見|採取)",
        r"^(.+?)から(?:卵を採取|採卵|飼育羽化|幼虫)",
        r"^(.+?)を食する幼虫",
        r"^(.+?)の花を食す幼虫",
        r"^(.+?)に産卵を確認",
        r"^(.+?)で(?:幼虫を)?発見",
        r"^繭構成物が(.+?)であることを確認",
        r"^(?:.*で)?(.+?)に加害すること",
        r"^.*幼虫を(.+?)から採",
        r"^(.+?)をつづった巣から.*食草として確認",
        r"^(.+?)での寄生を確認",
        r"^本邦では[一-龯ぁ-んァ-ヶー]+科の(.+?)より幼虫",
        r"^(.+?)より幼虫を",
        r"^飼育では(.+?)をよく食べた",
        r"。(.+?)もよく食した",
        r"。(.+?)も飼育下で食する",
        r"。(.+?)からも幼虫発見",
        r"。(.+?)も食べる",
    ]
    collected_entries = []
    seen_entries = set()
    for pattern in phrase_patterns:
        matches = re.finditer(pattern, proposed)
        for match in matches:
            entries = parse_hostplant_tokens(match.group(1), family_lookup, scientific_lookup)
            for entry in entries:
                key = (entry.get("plant_name", ""), entry.get("plant_family", ""))
                if key in seen_entries:
                    continue
                entry["notes"] = proposed
                collected_entries.append(entry)
                seen_entries.add(key)
    if collected_entries:
        return collected_entries

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

    simple_entry = parse_hostplant_token(proposed, family_lookup, scientific_lookup=scientific_lookup)
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
    with open(hostplants_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    family_lookup = build_hostplant_family_lookup(rows)
    scientific_lookup = build_ylist_scientific_lookup()
    normalized_entries = normalize_hostplant_additions(proposed, family_lookup, scientific_lookup)
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
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
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

    with open(insects_path, encoding="utf-8-sig") as f:
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
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
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

    with open(insects_path, encoding="utf-8-sig") as f:
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
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
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

    with open(insects_path, encoding="utf-8-sig") as f:
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
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
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
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="バリデーション後の npm run build 確認を省略する",
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

    try:
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
    except Exception as exc:
        print(f"\nエラー: 変更適用中に失敗しました: {exc}")
        rollback(backup_path)
        raise

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

    if args.skip_build:
        print("\n--skip-build: npm run build をスキップしました。")
        print("手動で実行する場合: npm run build")
        print(f"\nバックアップ: {backup_path}")
        print("git push は手動で行ってください。")
        return

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
