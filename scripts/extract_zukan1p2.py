#!/usr/bin/env python3
"""
蛾類標準図鑑1 Part2 OCRテキストから生態情報・出現時期を抽出し、
normalized_data/general_notes.csvに追加するスクリプト
"""

import csv
import re
import sys
from pathlib import Path

# ファイルパス
BASE_DIR = Path('/Users/akimotohiroki/orau98.github.io')
OCR_FILE = BASE_DIR / 'pdfs/zukan1p2-ocr/日本産蛾類標準図鑑1_Part2.txt'
INSECTS_CSV = BASE_DIR / 'normalized_data/insects.csv'
NOTES_CSV = BASE_DIR / 'normalized_data/general_notes.csv'
REFERENCE = '日本産蛾類標準図鑑1'

# OCR誤認補正テーブル（和名 → 正しい和名）
# キーはOCRで誤認された和名、値は正しい和名
OCR_CORRECTION_TABLE = {
    # パ/バ誤認
    'アシベニカギパ': 'アシベニカギバ',
    'オガサワラカギパ': 'オガサワラカギバ',
    'オキナワカギパ': 'オキナワカギバ',
    'スカシカギパ': 'スカシカギバ',
    'カギパアオシャク': 'カギバアオシャク',
    # フュシャク→フユシャク
    'ウスモンフュシャク': 'ウスモンフユシャク',
    'クロテンフュシャク': 'クロテンフユシャク',
    'サクフウフュシャク': 'サクフウフユシャク',
    'シロオビフュシャク': 'シロオビフユシャク',
    'スジモンフュシャク': 'スジモンフユシャク',
    'ウスパフュシャク': 'ウスバフユシャク',
    'ヤマウスパフュシャク': 'ヤマウスバフユシャク',
    'アカウスパフュシャク': 'アカウスバフユシャク',
    # ホウシャク→ホウジャク、ホシャク→ホシャク
    'アトボシホウシャク': 'アトボシホウジャク',
    # ジャク→シャク（サクジャク→サクシャク等）の一般補正はしない（複雑）
    # 個別指定
    'ウススシオオシロヒメジャク': 'ウスジロオオシロヒメシャク',  # 不確実
    'ウスパシロエダシャク': 'ウスバシロエダシャク',
    'オオシロオピアオシャク': 'オオシロオビアオシャク',
    'シロオピオエダシャク': 'シロオビオエダシャク',
    'オナガミスアオ': 'オナガミズアオ',
    'キリバネホンナミシャク': 'キリバネホソナミシャク',
    'シロホンスジナミシャク': 'シロホソスジナミシャク',
    'トンポエダシャク': 'トンボエダシャク',
    'ギンポンススメ': 'ギンボシスズメ',
    # スズメガ
    'キョウチクトウススメ': 'キョウチクトウスズメ',
    'コエビガラススメ': 'コエビガラスズメ',
    'コシタベニススメ': 'コシタベニスズメ',
    'クロテンケンモンススメ': 'クロテンケンモンスズメ',
    'シモフリススメ': 'シモフリスズメ',
    # 括弧付き
    'オビベニホンシャク （改称）': 'オビベニホソシャク',
    'スギノキエダシャク（新称）': 'スギノキエダシャク',
    'クリフタオ（新称）': 'クリフタオ',
    'オオミヤケカレハ（改称）': 'オオミヤケカレハ',
    'アゲハモドキ（日本本土亜種）': 'アゲハモドキ',
}

# ============================================================
# 1. insects.csv から 和名 → insect_id マッピングを構築
# ============================================================
def load_insects(path):
    """和名(japanese_name) → insect_id のマッピングを返す"""
    mapping = {}
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            insect_id = row.get('insect_id', '').strip()
            for col in ['japanese_name', 'old_japanese_name', 'alternative_name', 'other_names']:
                name = row.get(col, '').strip()
                if name and name not in mapping:
                    mapping[name] = insect_id
    return mapping

# ============================================================
# 2. general_notes.csv から 既処理 (insect_id, reference) セットを構築
# ============================================================
def load_existing_notes(path, reference):
    """既にreferenceが登録されているinsect_idセットと最大record_idを返す"""
    existing = set()
    max_id = 0
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames
    # DictReaderのfieldnamesは読み切り後にも保持される
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

    for row in rows:
        ref = row.get('reference', '')
        if ref == reference:
            existing.add(row.get('insect_id', ''))
        rid = row.get('record_id', '')
        m = re.match(r'note-(\d+)', rid)
        if m:
            n = int(m.group(1))
            if n > max_id:
                max_id = n
    return existing, max_id, rows, fieldnames

# ============================================================
# 3. OCRテキストから種の情報を抽出
# ============================================================

# ページ区切り
PAGE_SEP = re.compile(r'^---\s*ページ\s*\d+\s*---')

# 解説行
KAISETSU = re.compile(r'^解説\s*\d+')

# 図版番号行パターン
ZUKAN_NO_PATTERN = re.compile(
    r'^(?:図版|区版|M版|M阪|区阪|ME|ME版|M:|K:|区型|国盛|国版|K版|図|図⅝)[：:；]'
)

# OCR学名パターン（大文字アルファベットで始まる）
SCIENTIFIC_NAME = re.compile(r'^[A-Z][a-z]+(?:\s+[a-z]|\s+\()')

# 生期マーカーパターン
SEISEI_PATTERN = re.compile(
    r'[【\[［]'
    r'生[期態観意■✳✲*]?'
    r'[】\]］）]?'  # 閉じ括弧（省略されている場合も考慮）
)

def is_japanese_name_line(line):
    """和名行らしいかチェック"""
    line = line.strip()
    if not line:
        return False
    if line[0] in ' \t　':
        return False
    if KAISETSU.match(line):
        return False
    if ZUKAN_NO_PATTERN.match(line):
        return False
    if PAGE_SEP.match(line):
        return False
    # 英語大文字で始まる行はスキップ
    if re.match(r'^[A-Z]', line):
        return False
    # 数字で始まる行はスキップ
    if re.match(r'^\d', line):
        return False
    # 記号で始まる行はスキップ
    if re.match(r'^[（\[【「\(]', line) and not re.match(r'^[（\[【「\(]分類', line):
        # ただし「（日本本土亜種）」のような種名はOK
        pass
    # カタカナ・漢字を含む行で適切な長さ
    if re.search(r'[\u30A0-\u30FF\u4E00-\u9FFF]', line):
        if len(line) <= 25:
            return True
    return False

def apply_ocr_corrections(name):
    """OCR誤認を補正して正しい和名を返す"""
    # 直接テーブルに存在する場合
    if name in OCR_CORRECTION_TABLE:
        return OCR_CORRECTION_TABLE[name]

    # 一般的なOCR誤認パターンを適用
    fixed = name
    # パ→バ（カギパ→カギバ等）
    # ただし「パ」→「バ」は文脈依存なので慎重に
    fixed = re.sub(r'カギパ', 'カギバ', fixed)
    fixed = re.sub(r'フュシャク', 'フユシャク', fixed)
    fixed = re.sub(r'ウスパ(シロ|フユ)', r'ウスバ\1', fixed)
    fixed = re.sub(r'アカウスパ', 'アカウスバ', fixed)
    fixed = re.sub(r'ヤマウスパ', 'ヤマウスバ', fixed)
    # 括弧表記を除去
    fixed = re.sub(r'[（(][^）)]*[新改][称][）)]', '', fixed).strip()
    fixed = re.sub(r'（[^（）]*亜種[^（）]*）', '', fixed).strip()

    return fixed

def parse_ocr_text(ocr_path, insect_map):
    """OCRテキストをパースして (japanese_name, insect_id, seitai_text) のリストを返す"""
    with open(ocr_path, encoding='utf-8') as f:
        lines = f.readlines()

    results = []
    i = 0
    current_name = None
    current_id = None

    while i < len(lines):
        line = lines[i].rstrip('\n').rstrip('\r')
        stripped = line.strip()

        # ページ区切りや解説行
        if PAGE_SEP.match(stripped) or KAISETSU.match(stripped):
            i += 1
            continue

        # 図版行 → 直前行が種名かもしれない
        if ZUKAN_NO_PATTERN.match(stripped):
            if i > 0:
                prev = lines[i-1].rstrip('\n').rstrip('\r').strip()
                if is_japanese_name_line(prev):
                    corrected = apply_ocr_corrections(prev)
                    insect_id = insect_map.get(corrected) or insect_map.get(prev)
                    if insect_id:
                        current_name = prev
                        current_id = insect_id
                    elif corrected != prev:
                        # 補正後も見つからない場合は追加補正を試みる
                        current_name = prev
                        current_id = None
            i += 1
            continue

        # 和名候補の検出（学名行の直前）
        if is_japanese_name_line(stripped):
            # 次の行が学名か図版行かを確認
            look_ahead = 1
            found_scientific = False
            while look_ahead <= 3 and i + look_ahead < len(lines):
                next_stripped = lines[i + look_ahead].rstrip('\n').strip()
                if SCIENTIFIC_NAME.match(next_stripped) or ZUKAN_NO_PATTERN.match(next_stripped):
                    found_scientific = True
                    break
                if next_stripped and not PAGE_SEP.match(next_stripped) and not KAISETSU.match(next_stripped):
                    # 内容行があったら止める
                    if len(next_stripped) > 10:
                        break
                look_ahead += 1

            if found_scientific:
                corrected = apply_ocr_corrections(stripped)
                insect_id = insect_map.get(corrected) or insect_map.get(stripped)
                current_name = stripped
                current_id = insect_id

        # 生期マーカー検出
        if SEISEI_PATTERN.search(stripped) and current_name:
            # マーカー後のテキストを抽出
            after_marker = SEISEI_PATTERN.sub('', stripped).strip()
            # 不正な残りを除去（ー、。等のみ）
            after_marker = re.sub(r'^[ー。、\s]+', '', after_marker)

            seitai_lines = []
            if after_marker:
                seitai_lines.append(after_marker)

            j = i + 1
            while j < len(lines):
                nline = lines[j].rstrip('\n').rstrip('\r').strip()
                # 終端条件
                if (re.match(r'[【\[［][分奇荷宿主]', nline) or
                    PAGE_SEP.match(nline) or
                    KAISETSU.match(nline) or
                    ZUKAN_NO_PATTERN.match(nline) or
                    SEISEI_PATTERN.search(nline)):
                    break
                # 次の種名候補（短いカタカナ行+直後に学名行）
                if is_japanese_name_line(nline) and len(nline) <= 15:
                    if j + 1 < len(lines):
                        after = lines[j+1].rstrip('\n').strip()
                        if SCIENTIFIC_NAME.match(after) or ZUKAN_NO_PATTERN.match(after):
                            break
                if nline:
                    seitai_lines.append(nline)
                j += 1

            seitai_text = ''.join(seitai_lines).strip()
            if seitai_text and len(seitai_text) >= 5:
                results.append({
                    'japanese_name': current_name,
                    'insect_id': current_id,
                    'seitai_text': seitai_text,
                    'line_no': i + 1
                })

        i += 1

    return results

# ============================================================
# 4. 出現時期テキストの分類
# ============================================================

MONTH_PATTERN = re.compile(
    r'(?:\d{1,2}月|[春夏秋冬](?:に|に[^。]))'
)

def classify_seitai(text):
    """テキストを出現時期か生態情報かに分類する"""
    months = MONTH_PATTERN.findall(text)
    month_only = [m for m in months if re.search(r'\d+月', m)]
    if month_only:
        return '出現時期'
    return '生態情報'

# ============================================================
# 5. メイン処理
# ============================================================
def main():
    print("=== 蛾類標準図鑑1 Part2 生態情報抽出 ===")

    print("insects.csv 読み込み中...")
    insect_map = load_insects(INSECTS_CSV)
    print(f"  {len(insect_map)} 件の和名マッピング")

    print("general_notes.csv 読み込み中...")
    existing_ids, max_note_id, existing_rows, fieldnames = load_existing_notes(NOTES_CSV, REFERENCE)
    print(f"  既存エントリ: {len(existing_ids)} 件の species-id (reference={REFERENCE})")
    print(f"  最大 record_id: note-{max_note_id}")

    print(f"\nOCRテキスト解析中: {OCR_FILE}")
    parsed = parse_ocr_text(OCR_FILE, insect_map)
    print(f"  生態情報候補: {len(parsed)} 件")

    # マッチング
    new_entries = []
    next_id = max_note_id + 1

    matched_names = set()
    unmatched_names = []
    skipped_existing = []

    for item in parsed:
        name = item['japanese_name']
        seitai = item['seitai_text']
        insect_id = item['insect_id']

        # insect_idがない場合は再試行
        if not insect_id:
            corrected = apply_ocr_corrections(name)
            insect_id = insect_map.get(corrected) or insect_map.get(name)

        if not insect_id:
            unmatched_names.append(name)
            continue

        # 既に処理済みかチェック
        if insect_id in existing_ids:
            skipped_existing.append((name, insect_id))
            continue

        matched_names.add(name)
        note_type = classify_seitai(seitai)

        new_entries.append({
            'record_id': f'note-{next_id}',
            'insect_id': insect_id,
            'note_type': note_type,
            'content': seitai,
            'reference': REFERENCE,
            'page': '',
            'year': ''
        })
        next_id += 1
        existing_ids.add(insect_id)

    print(f"\n=== 結果 ===")
    print(f"マッチした新規種: {len(matched_names)} 件")
    print(f"スキップ（既存）: {len(set(i for _, i in skipped_existing))} 件")
    print(f"未マッチ: {len(set(unmatched_names))} 件")
    print(f"追加エントリ数: {len(new_entries)} 件")

    if unmatched_names:
        print("\n未マッチの和名:")
        for n in sorted(set(unmatched_names)):
            print(f"  '{n}'")

    print("\n新規追加エントリ:")
    for e in new_entries:
        print(f"  {e['record_id']} | {e['insect_id']} | {e['note_type']} | {e['content'][:70]}")

    return new_entries, existing_rows, fieldnames

if __name__ == '__main__':
    new_entries, existing_rows, fieldnames = main()

    if not new_entries:
        print("\n追加するエントリはありません。")
        sys.exit(0)

    # 自動追加（承認なしで実行）
    print(f"\n{len(new_entries)}件をCSVに追加します...")

    with open(NOTES_CSV, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        all_fieldnames = reader.fieldnames
        all_rows = list(reader)

    all_rows.extend(new_entries)

    with open(NOTES_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=all_fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"完了: {len(new_entries)} 件を追加しました。")
