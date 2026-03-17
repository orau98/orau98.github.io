#!/usr/bin/env python3
"""
カミキリムシ図鑑のOCRテキストから成虫出現期・生態情報を抽出し、
general_notes.csvに追加するスクリプト。
"""

import csv
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
OCR_FILE = BASE / "pdfs" / "kamikiri-ocr" / "日本産カミキリムシ_compressed.txt"
INSECTS_CSV = BASE / "normalized_data" / "insects.csv"
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"
REFERENCE = "日本産カミキリムシ"


def load_kamikiri_name_map():
    """カミキリムシ科の和名→insect_idマッピングを構築"""
    name_map = {}
    with open(INSECTS_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("family_jp") != "カミキリムシ科":
                continue
            jp = row.get("japanese_name", "").strip()
            iid = row["insect_id"]
            if jp:
                # 亜種名を含む完全名でマッピング
                name_map[jp] = iid
                # 基亜種の「基亜種」を除いた名前でもマッピング
                base = re.sub(r'\s*(基亜種|本土亜種)$', '', jp)
                if base != jp and base not in name_map:
                    name_map[base] = iid
    return name_map


def load_existing_notes():
    """既存の general_notes を読み込み、カミキリムシの不正エントリを除外"""
    rows = []
    max_id = 0
    with open(NOTES_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            rid = row.get("record_id", "")
            # 既存のカミキリムシ参照の不正エントリを除外
            if row.get("reference") == REFERENCE:
                continue
            rows.append(row)
            # record_id のmax取得
            m = re.match(r'note-(\d+)', rid)
            if m:
                max_id = max(max_id, int(m.group(1)))
    return rows, fieldnames, max_id


def parse_ocr_species_blocks(text):
    """
    OCRテキストから各種の記述ブロックを抽出。
    和名 + 学名 + 【成虫出現期】パターンを探す。
    """
    results = []

    # ページ区切りを除去
    text = re.sub(r'--- ページ \d+ ---', '', text)
    # 章番号除去
    text = re.sub(r'第3[章=車]?\s*種の解説\s*\d+', '', text)

    # 【成虫出現期】の各種バリエーション（OCRエラー含む）を検出
    emergence_pattern = re.compile(
        r'【成[虫山里出]出?現期】\s*(.+?)(?:\.|\。|【|$)', re.DOTALL
    )

    # 種の和名パターン: カタカナの和名の後に学名が続く
    # 和名は3文字以上のカタカナ（一部漢字含む）
    species_pattern = re.compile(
        r'([ァ-ヶー]{2,}(?:[ァ-ヶー\s]*[ァ-ヶー])?)\s+'
        r'([A-Z][a-z]+(?:\s+\([A-Z][a-z]+\))?\s+[a-z]+(?:\s+[a-z]+)?)'
    )

    # テキストを行ごとに処理
    lines = text.split('\n')
    current_species = None
    current_text = []

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # 新しい種の記述開始を検出
        sp_match = species_pattern.search(line)
        if sp_match:
            # 前の種のデータを保存
            if current_species and current_text:
                block_text = ' '.join(current_text)
                em_match = emergence_pattern.search(block_text)
                if em_match:
                    emergence = em_match.group(1).strip()
                    # 余分な文字を除去
                    emergence = re.sub(r'[\s　]+', '', emergence)
                    # 長すぎる場合はトリミング
                    if len(emergence) < 100:
                        results.append({
                            'name': current_species,
                            'emergence': emergence,
                            'block': block_text[:500]
                        })

            current_species = sp_match.group(1).strip()
            current_text = [line]
        elif current_species:
            current_text.append(line)

    # 最後の種
    if current_species and current_text:
        block_text = ' '.join(current_text)
        em_match = emergence_pattern.search(block_text)
        if em_match:
            emergence = em_match.group(1).strip()
            emergence = re.sub(r'[\s　]+', '', emergence)
            if len(emergence) < 100:
                results.append({
                    'name': current_species,
                    'emergence': emergence,
                    'block': block_text[:500]
                })

    return results


def extract_with_simple_regex(text):
    """
    シンプルな正規表現でOCRテキストから和名と出現期をペアで抽出。
    各【成虫出現期】の直前のカタカナ和名を探す。
    """
    results = []

    # ページ区切りを除去
    text = re.sub(r'--- ページ \d+ ---\n', '', text)
    text = re.sub(r'第3[章=車]?\s*種の解説\s*\d+', '', text)

    # 和名パターン: カタカナ3文字以上（間にスペース可）
    name_pattern = re.compile(r'([ァ-ヶー]{3,}(?:\s+[ァ-ヶー]*亜種)?)')

    # 全ての出現期を見つける
    emergence_re = re.compile(r'【成[虫山里出]出?現期】\s*([^【\n]{3,80})')

    for m in emergence_re.finditer(text):
        emergence = m.group(1).strip().rstrip('。．.')
        pos = m.start()

        # この出現期の前の500文字から和名を検出
        before = text[max(0, pos-800):pos]

        # 最後に出現した和名+学名パターンを探す
        # パターン: カタカナ和名 学名
        sp_matches = list(re.finditer(
            r'([ァ-ヶー]{3,}(?:[ァ-ヶー]*)?(?:\s+[ァ-ヶー基本土島八丈奄美沖縄屋久先諸]+亜種)?)\s+'
            r'[A-Z][a-z]',
            before
        ))

        if sp_matches:
            last_match = sp_matches[-1]
            name = last_match.group(1).strip()
            # 亜種名の「属」「科」「族」除外
            if any(x in name for x in ['属', '科', '族', '亜科']):
                continue
            results.append({
                'name': name,
                'emergence': emergence,
            })

    return results


def normalize_emergence(text):
    """出現期テキストを正規化"""
    # OCR特有のエラー修正
    text = text.replace('リH', '月').replace('り月', '月')
    text = text.replace('円', '月').replace('力', '月')
    text = re.sub(r'~|〜|～', '〜', text)
    # 不要な後続テキストをカット
    text = re.split(r'[【\[（(]', text)[0].strip()
    text = text.rstrip('、．。.,')
    return text


def fuzzy_match_name(name, name_map):
    """和名の曖昧マッチング"""
    # 完全一致
    if name in name_map:
        return name_map[name]

    # スペース除去して一致
    clean = name.replace(' ', '').replace('　', '')
    for k, v in name_map.items():
        if k.replace(' ', '').replace('　', '') == clean:
            return v

    # 「基亜種」付きで探す
    for suffix in ['基亜種', ' 基亜種']:
        test = name + suffix
        if test in name_map:
            return name_map[test]

    # 部分一致（名前が長い方から）
    for k, v in sorted(name_map.items(), key=lambda x: -len(x[0])):
        if len(k) >= 4 and k in name:
            return v
        if len(name) >= 4 and name in k:
            return v

    return None


def main():
    print("=== カミキリムシ出現期抽出スクリプト ===")

    # 1. 和名→IDマッピング
    name_map = load_kamikiri_name_map()
    print(f"カミキリムシ和名数: {len(name_map)}")

    # 2. OCRテキスト読み込み
    ocr_text = OCR_FILE.read_text(encoding="utf-8")
    print(f"OCRテキスト行数: {len(ocr_text.splitlines())}")

    # 3. 出現期抽出
    results = extract_with_simple_regex(ocr_text)
    print(f"抽出された出現期数: {len(results)}")

    # 4. DBマッチング
    matched = []
    unmatched = []
    for r in results:
        name = r['name']
        iid = fuzzy_match_name(name, name_map)
        emergence = normalize_emergence(r['emergence'])
        if iid:
            matched.append({
                'insect_id': iid,
                'name': name,
                'emergence': emergence,
            })
        else:
            unmatched.append(name)

    print(f"マッチ成功: {len(matched)}")
    print(f"マッチ失敗: {len(unmatched)}")

    # マッチ失敗の上位を表示
    from collections import Counter
    unmatched_count = Counter(unmatched)
    print("\n--- マッチ失敗 TOP 30 ---")
    for name, cnt in unmatched_count.most_common(30):
        print(f"  {name} ({cnt})")

    # 5. 既存データ読み込み（不正データ除外済み）
    existing_rows, fieldnames, max_id = load_existing_notes()
    print(f"\n既存ノート数（カミキリ不正除外後）: {len(existing_rows)}")

    # 既存の insect_id + note_type + reference の組み合わせを記録
    existing_keys = set()
    for row in existing_rows:
        key = (row.get('insect_id', ''), row.get('note_type', ''), row.get('content', '')[:30])
        existing_keys.add(key)

    # 6. 重複除外しつつ追加
    new_count = 0
    seen_ids = set()  # 同一IDの重複を防ぐ
    for m in matched:
        iid = m['insect_id']
        emergence = m['emergence']

        # 空や短すぎる出現期はスキップ
        if not emergence or len(emergence) < 2:
            continue

        # 同一insect_idで最初の出現期のみ採用（OCRで同じ種が複数回出る場合）
        if iid in seen_ids:
            continue
        seen_ids.add(iid)

        # 既存データと内容が重複しないか
        key = (iid, '出現時期', emergence[:30])
        if key in existing_keys:
            continue

        max_id += 1
        new_row = {
            'record_id': f'note-{max_id:06d}',
            'insect_id': iid,
            'note_type': '出現時期',
            'content': emergence,
            'reference': REFERENCE,
            'page': '',
            'year': '',
        }
        existing_rows.append(new_row)
        existing_keys.add(key)
        new_count += 1

    print(f"新規追加: {new_count}")
    print(f"合計ノート数: {len(existing_rows)}")

    # 7. CSV書き出し
    with open(NOTES_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in existing_rows:
            writer.writerow(row)

    print(f"\n{NOTES_CSV} に書き込み完了")

    # マッチした種名のサンプル
    print("\n--- マッチ成功サンプル ---")
    for m in matched[:20]:
        print(f"  {m['name']} ({m['insect_id']}): {m['emergence']}")


if __name__ == '__main__':
    main()
