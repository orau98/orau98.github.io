#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日本原色アブラムシ図鑑 OCRテキストから出現時期・生態情報を抽出して
normalized_data/general_notes.csv に追記するスクリプト。

使用方法:
  cd /Users/akimotohiroki/orau98.github.io
  python3 scripts/import-aburamushi-notes.py
"""

import re
import csv
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR_PATH = os.path.join(BASE, 'pdfs', 'aburamushi-ocr', '日本原色アブラムシ図鑑.txt')
INSECTS_CSV = os.path.join(BASE, 'normalized_data', 'insects.csv')
NOTES_CSV = os.path.join(BASE, 'normalized_data', 'general_notes.csv')
REFERENCE = '日本原色アブラムシ図鑑'


# ---- 1. アブラムシ和名 → insect_id マッピングを構築 ----

def build_name_map(insects_csv):
    """insects.csv からアブラムシ科のエントリを読み込み、和名→IDのマッピングを返す。"""
    name_map = {}  # 和名 (および括弧内の別名) → insect_id
    with open(insects_csv, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('family_jp', '') != 'アブラムシ科':
                continue
            insect_id = row['insect_id']
            jp_name_field = row.get('japanese_name', '').strip()
            if not jp_name_field:
                continue

            # 主名（括弧以前の部分）と括弧内の別名を両方登録
            # 例: "カンシャワタムシ (カンショウタムシ, カンシャノワタアブラムシ)"
            main_name = re.sub(r'\s*\(.*', '', jp_name_field).strip()
            if main_name:
                name_map[main_name] = insect_id

            # 括弧内の別名もすべて登録
            aliases = re.findall(r'\(([^)]+)\)', jp_name_field)
            for alias_group in aliases:
                for alias in re.split(r'[,、]', alias_group):
                    alias = alias.strip()
                    if alias:
                        name_map[alias] = insect_id

    print(f"[INFO] アブラムシ和名マップ: {len(name_map)} エントリ")
    return name_map


# ---- 2. OCRテキスト解析 ----

def parse_ocr(ocr_path):
    """OCRテキストを解析して各種のブロックを返す。"""
    with open(ocr_path, encoding='utf-8') as f:
        lines = f.read().splitlines()

    species_entries = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # 種番号 + 和名 の行を探す: "142 タデケクダヒゲナガアブラムシ"
        m = re.match(r'^(\d{1,3})\s+(.+)', line)
        if m:
            num = int(m.group(1))
            jp_name = m.group(2).strip()
            if 1 <= num <= 240 and len(jp_name) >= 3:
                # 次の非空行が学名か確認
                j = i + 1
                while j < len(lines) and lines[j].strip() == '':
                    j += 1
                sci_line = lines[j].strip() if j < len(lines) else ''
                # 学名にはラテン文字を含む
                if re.search(r'[A-Z][a-z]', sci_line):
                    # 本文を収集（次の種ブロックまで）
                    body_lines = []
                    k = j + 1
                    while k < len(lines):
                        next_line = lines[k].strip()
                        # 次の種ブロック判定
                        nm = re.match(r'^(\d{1,3})\s+(.+)', next_line)
                        if nm and 1 <= int(nm.group(1)) <= 240 and len(nm.group(2).strip()) >= 3:
                            nj = k + 1
                            while nj < len(lines) and lines[nj].strip() == '':
                                nj += 1
                            nsci = lines[nj].strip() if nj < len(lines) else ''
                            if re.search(r'[A-Z][a-z]', nsci):
                                break
                        # 索引セクション
                        if next_line.startswith('アブラムシ和名別'):
                            k = len(lines)
                            break
                        body_lines.append(next_line)
                        k += 1

                    body = '\n'.join(body_lines)

                    # 寄主植物行
                    kiju_m = re.search(r'寄主植物\s*(.+?)(?:\n|$)', body)
                    kiju = kiju_m.group(1).strip() if kiju_m else ''

                    # 寄生行（コロニー・寄生部位情報）
                    kisei_m = re.search(r'寄生\s*(.+?)(?:\n|$)', body)
                    kisei = kisei_m.group(1).strip() if kisei_m else ''

                    species_entries.append({
                        'number': num,
                        'jp_name': jp_name,
                        'sci_name': sci_line,
                        'body': body,
                        'kiju': kiju,
                        'kisei': kisei,
                    })
                    i = k
                    continue
        i += 1

    print(f"[INFO] OCR解析完了: {len(species_entries)} 種")
    return species_entries


# ---- 3. 出現時期を本文から抽出 ----

SEASON_PATTERNS = [
    # 月の範囲: "4月中旬から5月", "3〜6月" など
    r'\d+月[上中下旬]*(?:[〜～から][〜～]?\d+月[上中下旬]*)?',
    # 季節語
    r'(?:早)?春(?:季|から初夏|に|ころ)?',
    r'初夏',
    r'(?:夏季|夏(?:に|の|は|季|ころ))',
    r'晩夏',
    r'秋(?:季|に|ころ|冷)?',
    r'晩秋',
    r'冬(?:季|に|は)?',
]

SEASON_RE = re.compile('|'.join(SEASON_PATTERNS))


def extract_timing(body, jp_name, kiju, kisei):
    """本文から出現時期に関する記述を抽出して返す。"""
    timing_hints = []

    # 1) 月表現を含む文
    for sentence in re.split(r'[。\n]', body):
        if re.search(r'\d+月', sentence):
            s = sentence.strip()
            if s:
                timing_hints.append(s)

    # 2) 季節表現を含む文（月を含まないもの）
    for sentence in re.split(r'[。\n]', body):
        if re.search(r'(?:春|初夏|夏季|夏の|秋|冬)', sentence) and not re.search(r'\d+月', sentence):
            s = sentence.strip()
            if s and len(s) > 5:
                timing_hints.append(s)

    # 3) 越冬態
    for sentence in re.split(r'[。\n]', body):
        if '越冬' in sentence:
            s = sentence.strip()
            if s:
                timing_hints.append(s)

    # 重複削除・長さ制限
    seen = set()
    result = []
    for h in timing_hints:
        h_clean = re.sub(r'\s+', ' ', h)[:200]
        if h_clean not in seen:
            seen.add(h_clean)
            result.append(h_clean)

    if result:
        return '。'.join(result[:3])  # 最大3文
    return ''


# ---- 4. 生態情報を本文から抽出 ----

def extract_ecology(body, jp_name, kiju, kisei):
    """本文から生態情報を抽出して返す。"""
    parts = []

    # 寄生行（寄生部位・コロニー情報）
    if kisei:
        parts.append(f'寄生: {kisei}')

    # コロニー
    for sentence in re.split(r'[。\n]', body):
        if 'コロニー' in sentence:
            s = sentence.strip()
            if s and s not in kisei:
                parts.append(s)
                break

    # 越冬態
    for sentence in re.split(r'[。\n]', body):
        if '越冬' in sentence:
            s = sentence.strip()
            if s:
                parts.append(s)
            break

    # 寄主移動（冬寄主・夏寄主）
    for sentence in re.split(r'[。\n]', body):
        if re.search(r'(?:冬寄主|夏寄主|移住)', sentence):
            s = sentence.strip()
            if s:
                parts.append(s)
                break

    # 虫癭形成
    for sentence in re.split(r'[。\n]', body):
        if '虫癭' in sentence or '虫\u7004' in sentence:
            s = sentence.strip()
            if s:
                parts.append(s)
                break

    # 重複削除
    seen = set()
    result = []
    for p in parts:
        p_clean = re.sub(r'\s+', ' ', p)[:300]
        if p_clean not in seen:
            seen.add(p_clean)
            result.append(p_clean)

    return '。'.join(result[:4]) if result else ''


# ---- 5. 既存データ読み込み ----

def load_existing_notes(notes_csv):
    """既存の general_notes.csv を読み込み、最大IDと重複チェック用セットを返す。"""
    existing = set()  # (insect_id, note_type, reference)
    max_id = 0
    with open(notes_csv, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row.get('record_id', '')
            m = re.search(r'note-(\d+)', rid)
            if m:
                max_id = max(max_id, int(m.group(1)))
            key = (row.get('insect_id', ''), row.get('note_type', ''), row.get('reference', ''))
            existing.add(key)
    print(f"[INFO] 既存ノート: {len(existing)} 件, 最大ID: {max_id}")
    return existing, max_id


# ---- 6. 和名マッチング（ファジー対応） ----

def find_insect_id(jp_name, name_map):
    """和名からinsect_idを返す。完全一致優先、次に前方一致。"""
    # 完全一致
    if jp_name in name_map:
        return name_map[jp_name]

    # 「Aphis sp.」などの特殊ケース
    normalized = re.sub(r'\s+', '', jp_name)
    for key, val in name_map.items():
        if re.sub(r'\s+', '', key) == normalized:
            return val

    # 前方一致（OCR誤認対応）
    candidates = [(k, v) for k, v in name_map.items() if k.startswith(jp_name) or jp_name.startswith(k)]
    if len(candidates) == 1:
        return candidates[0][1]

    return None


# ---- メイン処理 ----

def main():
    print("[START] 日本原色アブラムシ図鑑 インポート処理")

    # データ読み込み
    name_map = build_name_map(INSECTS_CSV)
    species_entries = parse_ocr(OCR_PATH)
    existing_notes, max_id = load_existing_notes(NOTES_CSV)

    # 新規レコードを構築
    new_rows = []
    counter = max_id + 1
    unmatched = []
    matched_count = 0

    for entry in species_entries:
        jp_name = entry['jp_name']
        body = entry['body']
        kiju = entry['kiju']
        kisei = entry['kisei']

        insect_id = find_insect_id(jp_name, name_map)
        if not insect_id:
            unmatched.append(f"{entry['number']}: {jp_name}")
            continue

        matched_count += 1

        # 出現時期
        timing = extract_timing(body, jp_name, kiju, kisei)
        if timing:
            key = (insect_id, '出現時期', REFERENCE)
            if key not in existing_notes:
                new_rows.append({
                    'record_id': f'note-{counter}',
                    'insect_id': insect_id,
                    'note_type': '出現時期',
                    'content': timing,
                    'reference': REFERENCE,
                    'page': '',
                    'year': '',
                })
                existing_notes.add(key)
                counter += 1

        # 生態情報
        ecology = extract_ecology(body, jp_name, kiju, kisei)
        if ecology:
            key = (insect_id, '生態情報', REFERENCE)
            if key not in existing_notes:
                new_rows.append({
                    'record_id': f'note-{counter}',
                    'insect_id': insect_id,
                    'note_type': '生態情報',
                    'content': ecology,
                    'reference': REFERENCE,
                    'page': '',
                    'year': '',
                })
                existing_notes.add(key)
                counter += 1

    print(f"[INFO] マッチ済み: {matched_count} 種 / {len(species_entries)} 種")
    print(f"[INFO] 未マッチ: {len(unmatched)} 種")
    for u in unmatched:
        print(f"  未マッチ: {u}")
    print(f"[INFO] 追記予定レコード: {len(new_rows)} 件")

    if not new_rows:
        print("[INFO] 追記するレコードはありません。")
        return

    # CSVに追記
    fieldnames = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']
    with open(NOTES_CSV, encoding='utf-8-sig', newline='', mode='a') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        for row in new_rows:
            writer.writerow(row)

    print(f"[DONE] {len(new_rows)} 件のレコードを {NOTES_CSV} に追記しました。")

    # サマリー（種別カウント）
    timing_count = sum(1 for r in new_rows if r['note_type'] == '出現時期')
    ecology_count = sum(1 for r in new_rows if r['note_type'] == '生態情報')
    print(f"  - 出現時期: {timing_count} 件")
    print(f"  - 生態情報: {ecology_count} 件")


if __name__ == '__main__':
    main()
