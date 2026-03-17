#!/usr/bin/env python3
"""hostplants.csvの植物名を正規化するスクリプト。

文章がそのまま植物名に入っているレコードを検出し:
1. 植物名を抽出（和名 + 学名 → 「和名(科名)」形式）
2. 元の文章をnotesに移動
3. 複数食草は個別レコードに分割
"""

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOSTPLANTS_CSV = ROOT / "normalized_data" / "hostplants.csv"

DELETE_RECORD_IDS = {
    # Re-imported sentence-like rows when an equivalent canonical hostplant already exists.
    "hostplant-905998", "hostplant-906197", "hostplant-906396", "hostplant-906595", "hostplant-906868", "hostplant-907142",
    "hostplant-906000", "hostplant-906199", "hostplant-906398", "hostplant-906597", "hostplant-906870", "hostplant-907144",
    "hostplant-906004", "hostplant-906203", "hostplant-906402", "hostplant-906601", "hostplant-906874", "hostplant-907148",
    "hostplant-906202", "hostplant-906401", "hostplant-906600", "hostplant-906873", "hostplant-907147",
    "hostplant-906204", "hostplant-906403", "hostplant-906602", "hostplant-906875", "hostplant-907149",
    "hostplant-906205", "hostplant-906404", "hostplant-906603", "hostplant-906876", "hostplant-907150",
    "hostplant-906206", "hostplant-906405", "hostplant-906604", "hostplant-906877", "hostplant-907151",
    "hostplant-906008", "hostplant-906207", "hostplant-906406", "hostplant-906605", "hostplant-906878", "hostplant-907152",
    "hostplant-906208", "hostplant-906407", "hostplant-906606", "hostplant-906879", "hostplant-907153",
    "hostplant-906010", "hostplant-906209", "hostplant-906408", "hostplant-906607", "hostplant-906880", "hostplant-907154",
    "hostplant-906011", "hostplant-906210", "hostplant-906409", "hostplant-906608", "hostplant-906881", "hostplant-907155",
    "hostplant-906035", "hostplant-906234", "hostplant-906433", "hostplant-906632", "hostplant-906905", "hostplant-907179",
    "hostplant-906038", "hostplant-906237", "hostplant-906436", "hostplant-906635", "hostplant-906908", "hostplant-907182",
    "hostplant-906639", "hostplant-906912", "hostplant-907186",
    "hostplant-906723", "hostplant-906996", "hostplant-907270",
    "hostplant-906729", "hostplant-907002", "hostplant-907276",
    "hostplant-907281",
}

TARGETED_REPLACEMENTS = {
    # Keep one canonical row for re-imported 1986 additions that had no prior clean row.
    "hostplant-906003": [{"plant_name": "ネジキ", "plant_family": "ツツジ科"}],
    "hostplant-906005": [{"plant_name": "シシウド", "plant_family": "セリ科"}],
    "hostplant-906006": [{"plant_name": "ヤマブキショウマ", "plant_family": "バラ科", "notes": "初記録"}],
    "hostplant-906007": [{"plant_name": "キュウリ", "plant_family": "ウリ科", "notes": "既知：ワタ、アオイ、ヘチマ"}],
    "hostplant-906009": [{"plant_name": "ヤマモミジ", "plant_family": "ムクロジ科"}],
    # Split one representative 1989 sentence into concrete plants and drop the duplicate imports.
    "hostplant-906042": [{"plant_name": "オトギリソウ", "plant_family": "オトギリソウ科", "notes": "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属"}],
    "hostplant-906241": [{"plant_name": "イワオトギリ", "plant_family": "オトギリソウ科", "notes": "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属"}],
    "hostplant-906440": [{"plant_name": "シナノオトギリ", "plant_family": "オトギリソウ科", "notes": "食草はオトギリソウ、イワオトギリ、シナノオトギリなどのオトギリソウ科オトギリソウ属"}],
    # Keep additional 1999 hosts that were embedded in a sentence.
    "hostplant-906734": [{"plant_name": "ハルニレ", "plant_family": "ニレ科", "notes": "食草がケヤキ Zelkova serrata（ニレ科）と判明。ハルニレとエノキでも摂食"}],
    "hostplant-907007": [{"plant_name": "エノキ", "plant_family": "アサ科", "notes": "食草がケヤキ Zelkova serrata（ニレ科）と判明。ハルニレとエノキでも摂食"}],
}

# 科名マッピング（主要な科）
FAMILY_MAP = {
    # ブナ科
    "クヌギ": "ブナ科", "コナラ": "ブナ科", "ミズナラ": "ブナ科", "カシワ": "ブナ科",
    "アベマキ": "ブナ科", "アラカシ": "ブナ科", "ウラジロガシ": "ブナ科", "シラカシ": "ブナ科",
    "ブナ": "ブナ科", "イヌブナ": "ブナ科", "クリ": "ブナ科",
    # バラ科
    "ノイバラ": "バラ科", "ノバラ": "バラ科", "サクラ": "バラ科", "ソメイヨシノ": "バラ科",
    "ミヤマザクラ": "バラ科", "タカネザクラ": "バラ科", "ボケ": "バラ科",
    "アズキナシ": "バラ科", "カマツカ": "バラ科", "ウラジロノキ": "バラ科",
    "ホウロクイチゴ": "バラ科", "ベニバナイチゴ": "バラ科",
    # ヤナギ科
    "エゾノバッコヤナギ": "ヤナギ科", "シバヤナギ": "ヤナギ科", "ドロノキ": "ヤナギ科",
    "ヤナギ": "ヤナギ科",
    # カバノキ科
    "ハンノキ": "カバノキ科", "ヤハズハンノキ": "カバノキ科", "クマシデ": "カバノキ科",
    "イヌシデ": "カバノキ科", "アカシデ": "カバノキ科", "シラカンバ": "カバノキ科",
    # マメ科
    "ヤマハギ": "マメ科", "クサフジ": "マメ科", "ヤブマメ": "マメ科",
    "ナンバンサイカチ": "マメ科", "ハリエンジュ": "マメ科",
    # キク科
    "ヨモギ": "キク科", "ノコンギク": "キク科", "ユウガギク": "キク科",
    "ウスベニニガナ": "キク科", "キダチハマグルマ": "キク科", "マルバダケブキ": "キク科",
    # ツツジ科
    "ヒサカキ": "モッコク科", "サカキ": "モッコク科", "ミミズバイ": "ハイノキ科",
    "アセビ": "ツツジ科", "ツツジ": "ツツジ科", "ヒラドツツジ": "ツツジ科",
    "イソツツジ": "ツツジ科", "ガンコウラン": "ツツジ科", "ミヤマホツツジ": "ツツジ科",
    "クロマメノキ": "ツツジ科", "ヒメシャクナゲ": "ツツジ科", "ツルコケモモ": "ツツジ科",
    # カバノキ科
    "ハンノキ": "カバノキ科",
    # ニレ科
    "ケヤキ": "ニレ科", "アキニレ": "ニレ科", "ハルニレ": "ニレ科", "エノキ": "アサ科",
    # スイカズラ科
    "サンゴジュ": "ガマズミ科", "オオカメノキ": "ガマズミ科",
    # ミカン科
    "イヌザンショウ": "ミカン科",
    # アカネ科
    "コンロンカ": "アカネ科", "ギョクシンカ": "アカネ科", "シラタマカズラ": "アカネ科",
    "ナガミボチョウジ": "アカネ科", "クチナシ": "アカネ科",
    # イネ科
    "ネザサ": "イネ科", "ササ": "イネ科",
    # タデ科
    "ミゾソバ": "タデ科", "イタドリ": "タデ科", "ケタデ": "タデ科",
    # サトイモ科
    "クワズイモ": "サトイモ科",
    # ヤマモモ科
    "ヤマモモ": "ヤマモモ科",
    # ウリ科
    "アマチャヅル": "ウリ科",
    # ツバキ科
    "ツバキ": "ツバキ科", "サザンカ": "ツバキ科",
    # クスノキ科
    "クスノキ": "クスノキ科", "ヤブニッケイ": "クスノキ科", "ムニンイヌグス": "クスノキ科",
    # カキノキ科
    "リュウキュウガキ": "カキノキ科", "リュウキュウマメガキ": "カキノキ科",
    # マンサク科
    "マンサク": "マンサク科",
    # クルミ科
    "オニグルミ": "クルミ科",
    # カエデ科
    "ヒナウチワカエデ": "ムクロジ科", "カジカエデ": "ムクロジ科",
    # ウルシ科
    "ヌルデ": "ウルシ科", "ヤマハゼ": "ウルシ科",
    # シナノキ科
    "シナノキ": "アオイ科",
    # ガガイモ科
    "ガガイモ": "キョウチクトウ科",
    # ナデシコ科
    "フシグロ": "ナデシコ科", "カワラナデシコ": "ナデシコ科",
    # セリ科
    "セリ": "セリ科",
    # その他
    "ヒノキ": "ヒノキ科", "スギ": "ヒノキ科", "リュウキュウマツ": "マツ科",
    "サルスベリ": "ミソハギ科", "イヌマキ": "マキ科", "オクラ": "アオイ科",
    "クロウメモドキ": "クロウメモドキ科", "クロツバラ": "クロウメモドキ科",
    "モウセンゴケ": "モウセンゴケ科", "シロモジ": "クスノキ科",
    "ウラジロモミ": "マツ科", "ウラジロガシ": "ブナ科",
    "アキタブキ": "キク科", "ギョウジャニンニク": "ヒガンバナ科",
    "サトイモ": "サトイモ科", "アキグミ": "グミ科",
    "ヤマブドウ": "ブドウ科", "エビヅル": "ブドウ科", "ノブドウ": "ブドウ科",
    "オバコ": "オオバコ科", "オオバコ": "オオバコ科",
    "カニクサ": "フサシダ科", "タチシノブ": "イノモトソウ科",
    "ハマゴウ": "シソ科", "イブキジャコウソウ": "シソ科",
    "ヤロード": "キョウチクトウ科", "テイカカズラ": "キョウチクトウ科",
    "シンジュ": "ニガキ科",
    "カジノキ": "クワ科",
    "ムラサキカタバミ": "カタバミ科",
    "ヤマモガシ": "ヤマモガシ科",
    "イイギリ": "ヤナギ科",
    "サンカヨウ": "メギ科",
    "シシンラン": "イワタバコ科", "イワタバコ": "イワタバコ科",
    # 追加分
    "ミネヤナギ": "ヤナギ科", "バッコヤナギ": "ヤナギ科",
    "ヒルガオ": "ヒルガオ科",
    "リョウブ": "リョウブ科",
    "トキワガキ": "カキノキ科",
    "イタヤカエデ": "ムクロジ科",
    "エノコログサ": "イネ科", "メヒシバ": "イネ科", "カモガヤ": "イネ科",
    "フキ": "キク科", "アキタブキ": "キク科",
    "エゾノギシギシ": "タデ科", "オオイタドリ": "タデ科", "ウラジロタデ": "タデ科",
    "ヤマブキショウマ": "バラ科", "アズマイチゲ": "キンポウゲ科",
    "クサソテツ": "コウヤワラビ科",
    "ノリウツギ": "アジサイ科",
    "ミヤマウグイスカグラ": "スイカズラ科",
    "サルスベリ": "ミソハギ科",
    "ホルトノキ": "ホルトノキ科",
    "ナンキンハゼ": "トウダイグサ科", "シラキ": "トウダイグサ科",
    "コミカンソウ": "コミカンソウ科",
    "ヤマモモ": "ヤマモモ科",
    "クスドイゲ": "ヤナギ科",
}


def is_sentence_like(name: str) -> bool:
    """植物名が文章的かどうか判定"""
    if len(name) <= 10:
        return False
    sentence_markers = [
        "を確認", "から", "を食", "で飼育", "として", "にて", "で採集",
        "の葉を", "幼虫", "食草は", "食樹は", "寄主", "つく", "食べ",
        "採集", "羽化", "飼育", "加害", "潜孔", "穿入", "を記録",
        "を得", "で発見", "で生育", "を摂食", "に産卵", "に発生",
        "が主な", "であるが", "のほか", "に食入",
    ]
    return any(m in name for m in sentence_markers)


def extract_plant_names(text: str) -> list[dict]:
    """文章から植物名を抽出して個別のレコードに分割"""
    results = []

    # パターン1: 「和名（学名）」形式
    pattern_jp_sci = re.findall(
        r"([ァ-ヶー]{2,})[\s　]*[（(]([A-Z][a-z]+ [a-z]+(?:\s+(?:var\.|subsp\.)\s+[a-z]+)?)[）)]",
        text,
    )
    for jp_name, sci_name in pattern_jp_sci:
        family = FAMILY_MAP.get(jp_name, "")
        # 科名が学名の後に書いてある場合: 「クヌギ（Quercus acutissima、ブナ科）」
        sci_fam = re.search(
            re.escape(sci_name) + r"[^）)]*?[、,]\s*([ァ-ヶー]+科)", text
        )
        if sci_fam:
            family = sci_fam.group(1)
        results.append({"name": jp_name, "family": family, "scientific": sci_name})

    # パターン2: 科名付き「和名（科名）」
    pattern_fam = re.findall(r"([ァ-ヶー]{2,})[\s　]*[（(]([ァ-ヶー]+科)[）)]", text)
    for jp_name, fam in pattern_fam:
        if not any(r["name"] == jp_name for r in results):
            results.append({"name": jp_name, "family": fam, "scientific": ""})

    # パターン3: 読点区切りの植物名リスト「クヌギ、ノバラ、コナラ」
    if not results:
        # 文頭や「食草として」の前にあるカタカナ名の列挙
        list_match = re.findall(r"[ァ-ヶー]{2,}", text)
        # フィルタ: 既知の植物名のみ
        for name in list_match:
            if name in FAMILY_MAP and not any(r["name"] == name for r in results):
                results.append(
                    {"name": name, "family": FAMILY_MAP[name], "scientific": ""}
                )

    # パターン4: 学名のみ「Genus species」
    if not results:
        sci_only = re.findall(r"([A-Z][a-z]+ [a-z]+)", text)
        for sci in sci_only[:3]:  # max 3
            results.append({"name": "", "family": "", "scientific": sci})

    return results


def merge_notes(*parts: str) -> str:
    merged = []
    for part in parts:
        cleaned = (part or "").strip()
        if cleaned and cleaned not in merged:
            merged.append(cleaned)
    return " ".join(merged)


def apply_targeted_fix(row: dict) -> list[dict]:
    record_id = row.get("record_id", "")
    if record_id in DELETE_RECORD_IDS:
        return []

    replacements = TARGETED_REPLACEMENTS.get(record_id)
    if not replacements:
        return [row]

    original_text = row.get("plant_name", "").strip()
    existing_notes = row.get("notes", "").strip()
    fixed_rows = []
    for replacement in replacements:
        fixed = dict(row)
        fixed["plant_name"] = replacement["plant_name"]
        fixed["plant_family"] = replacement["plant_family"]
        fixed["notes"] = replacement.get("notes", existing_notes)
        fixed_rows.append(fixed)
    return fixed_rows


def main():
    rows = []
    with open(HOSTPLANTS_CSV) as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    new_rows = []
    modified = 0
    split_count = 0
    targeted_modified = 0
    targeted_deleted = 0
    numeric_ids = []
    for r in rows:
        rid = r["record_id"]
        if rid.startswith("hostplant-"):
            suffix = rid.split("-", 1)[1]
            if suffix.isdigit():
                numeric_ids.append(int(suffix))
    next_id = max(numeric_ids) + 1 if numeric_ids else 1000000

    expected_replacement_ids = set(TARGETED_REPLACEMENTS.keys())
    seen_replacement_ids = set()

    for row in rows:
        record_id = row.get("record_id", "")
        if record_id in expected_replacement_ids:
            seen_replacement_ids.add(record_id)

        targeted_rows = apply_targeted_fix(row)
        if not targeted_rows:
            targeted_deleted += 1
            continue
        if len(targeted_rows) != 1 or targeted_rows[0] != row:
            targeted_modified += 1
        if len(targeted_rows) != 1:
            new_rows.extend(targeted_rows)
            continue
        row = targeted_rows[0]

        plant_name = row.get("plant_name", "")

        if not is_sentence_like(plant_name):
            new_rows.append(row)
            continue

        # 文章から植物名を抽出
        extracted = extract_plant_names(plant_name)
        original_text = plant_name

        if not extracted:
            # 抽出できなかった場合はそのまま（notesに元テキストを移動）
            row["notes"] = (row.get("notes", "") + " " + original_text).strip() if row.get("notes") else original_text
            row["plant_name"] = original_text[:50]  # 切り詰め
            new_rows.append(row)
            continue

        modified += 1

        if len(extracted) == 1:
            # 単一植物: 名前を修正、notesに元文を保存
            plant = extracted[0]
            row["plant_name"] = plant["name"] or plant["scientific"]
            if plant["family"] and not row.get("plant_family"):
                row["plant_family"] = plant["family"]
            elif plant["family"]:
                row["plant_family"] = plant["family"]
            existing_notes = row.get("notes", "").strip()
            row["notes"] = (existing_notes + " " + original_text).strip() if existing_notes else original_text
            new_rows.append(row)
        else:
            # 複数植物: レコード分割
            for i, plant in enumerate(extracted):
                new_row = dict(row)
                if i > 0:
                    new_row["record_id"] = f"hostplant-{next_id:06d}"
                    next_id += 1
                    split_count += 1
                new_row["plant_name"] = plant["name"] or plant["scientific"]
                if plant["family"]:
                    new_row["plant_family"] = plant["family"]
                new_row["notes"] = original_text
                new_rows.append(new_row)

    missing_replacement_ids = sorted(expected_replacement_ids - seen_replacement_ids)
    if missing_replacement_ids:
        print("Missing targeted replacement rows:")
        for record_id in missing_replacement_ids:
            print(f"  - {record_id}")
        sys.exit(1)

    # 書き出し
    with open(HOSTPLANTS_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(new_rows)

    print(f"Targeted modified: {targeted_modified}, targeted deleted: {targeted_deleted}")
    print(f"Modified: {modified}, Split into new records: {split_count}")
    print(f"Total rows: {len(rows)} -> {len(new_rows)}")


if __name__ == "__main__":
    main()
