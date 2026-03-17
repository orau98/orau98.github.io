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


def main():
    rows = []
    with open(HOSTPLANTS_CSV) as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    new_rows = []
    modified = 0
    split_count = 0
    numeric_ids = []
    for r in rows:
        rid = r["record_id"]
        if rid.startswith("hostplant-"):
            suffix = rid.split("-", 1)[1]
            if suffix.isdigit():
                numeric_ids.append(int(suffix))
    next_id = max(numeric_ids) + 1 if numeric_ids else 1000000

    for row in rows:
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

    # 書き出し
    with open(HOSTPLANTS_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(new_rows)

    print(f"Modified: {modified}, Split into new records: {split_count}")
    print(f"Total rows: {len(rows)} -> {len(new_rows)}")


if __name__ == "__main__":
    main()
