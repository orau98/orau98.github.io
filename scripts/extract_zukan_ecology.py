#!/usr/bin/env python3
"""
蛾類標準図鑑1・2のOCRテキストから生態情報・出現時期を抽出し、
general_notes.csvに追加するスクリプト。
"""

import csv
import re
import sys
from pathlib import Path
from collections import defaultdict

BASE = Path(__file__).resolve().parent.parent
INSECTS_CSV = BASE / "normalized_data" / "insects.csv"
NOTES_CSV = BASE / "normalized_data" / "general_notes.csv"

ZUKAN1_OCR = BASE / "pdfs" / "zukan1-ocr" / "日本産蛾類標準図鑑1.txt"
ZUKAN2_OCR = BASE / "pdfs" / "zukan2-ocr" / "日本産蛾類標準図鑑2.txt"


def load_moth_name_map():
    """蛾の和名→insect_idマッピング"""
    name_map = {}
    with open(INSECTS_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 蛾のみ（カミキリ、ハムシ、タマムシ、アブラムシ、蝶を除外）
            fam = row.get("family_jp", "")
            if any(x in fam for x in ["カミキリムシ", "ハムシ", "タマムシ", "アブラムシ"]):
                continue
            iid = row["insect_id"]
            # species-20XXX は蝶なのでスキップ（ただし一部は蛾）
            jp = row.get("japanese_name", "").strip()
            if jp:
                name_map[jp] = iid
                # 括弧や亜種名を除いた短縮名
                short = re.sub(r'\s*[\(（].*$', '', jp)
                if short != jp and short not in name_map:
                    name_map[short] = iid
    return name_map


def load_existing_notes():
    """既存の general_notes を読み込み"""
    rows = []
    max_id = 0
    existing_keys = set()
    with open(NOTES_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            rows.append(row)
            rid = row.get("record_id", "")
            m = re.match(r'note-(\d+)', rid)
            if m:
                max_id = max(max_id, int(m.group(1)))
            # 重複チェック用キー
            key = (row["insect_id"], row["note_type"], row.get("reference", ""))
            existing_keys.add(key)
    return rows, fieldnames, max_id, existing_keys


def extract_species_blocks(text):
    """
    OCRテキストから種名ごとのブロックに分割。
    和名（カタカナ3+文字）+ 学名（Genus species）のパターンで種を検出。
    """
    # ページ区切りを除去
    text = re.sub(r'--- ページ \d+ ---', '', text)
    # 「解説 NNN 科名」ヘッダを除去
    text = re.sub(r'解説\s+\d+\s+\S+科', '', text)

    # 種の開始パターン: カタカナ和名 + 改行or空白 + 学名
    species_re = re.compile(
        r'([ァ-ヶー]{3,}(?:[ァ-ヶー]*)?)\s*\n\s*'
        r'([A-Z][a-z]+\s+[a-z]+)',
        re.MULTILINE
    )

    blocks = []
    matches = list(species_re.finditer(text))

    for i, m in enumerate(matches):
        name = m.group(1).strip()
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else min(start + 3000, len(text))
        block_text = text[start:end]
        blocks.append({
            'name': name,
            'text': block_text,
        })

    return blocks


def extract_ecology_from_block(block_text):
    """
    ブロックテキストから【生】【生態】セクションを抽出。
    出現時期と生態情報を分離する。
    """
    # 生態セクションのマーカー（OCRバリエーション網羅）
    # 主要パターン: 【生］ 【生期］ 【生態］ 【生観］ 【生意］ 【生■ 生■
    # ］ = U+FF3D (全角), ] = U+005D, 】 = U+3011
    CLOSE = r'[\]\uff3d\u3011）\)]'  # 全ての閉じ括弧バリエーション
    eco_markers = [
        r'【生' + CLOSE,                    # 【生］ 【生】 【生]
        r'【生[態期■意観糖題]' + CLOSE + '?',   # 【生期］ 【生態】 【生■ 【生糖 【生題
        r'\[生[態期意観]?\]',               # [生態] [生]
        r'生■(?=' + CLOSE + '?[ァ-ヶー\d年平低山関北本全暖成多5-9])',  # 生■年1化
        r'【生(?=[年\d多5-9成日関本北全低平])',  # 【生年1化 【生成虫は (bracket missing)
    ]
    eco_pattern = '|'.join(eco_markers)

    # 次のセクションマーカー（幅広く）
    OPEN_B = r'[\[\uff3b\u3010（\(]'
    next_section = (
        OPEN_B + r'[分寄荷奇商宿]|' +
        OPEN_B + r'主[植福権細物]|'
        r'【分[布類]|'
        r'[（\(]主植物|'
        r'商主[植権]|荷主[植細]|奇主[植細]|寄主[植権]'
    )

    eco_match = re.search(eco_pattern, block_text)
    if not eco_match:
        return None, None

    eco_start = eco_match.end()

    # 次のセクションまで
    next_match = re.search(next_section, block_text[eco_start:])
    if next_match:
        eco_text = block_text[eco_start:eco_start + next_match.start()]
    else:
        eco_text = block_text[eco_start:eco_start + 500]

    eco_text = eco_text.strip()
    # 改行をスペースに
    eco_text = re.sub(r'\n+', ' ', eco_text)
    eco_text = re.sub(r'\s+', ' ', eco_text).strip()

    # 出現時期の抽出
    emergence = extract_emergence(eco_text)
    # 生態情報（出現時期以外）
    ecology = extract_ecology_notes(eco_text)

    return emergence, ecology


def extract_emergence(eco_text):
    """生態テキストから出現時期を抽出"""
    # 月の出現パターン
    patterns = [
        # "5～6月と7～8月に出現" 型
        r'(\d{1,2})[～〜~](\d{1,2})月(?:と|、|,)(\d{1,2})[～〜~](\d{1,2})月',
        # "5月と8月に出現" 型
        r'(\d{1,2})月(?:と|、)(\d{1,2})月',
        # "5～6月初旬" 型
        r'(\d{1,2})[～〜~](\d{1,2})月',
        # "5月中旬～7月" 型
        r'(\d{1,2})月[上中下]旬?[～〜~](\d{1,2})月',
        # "5月から出現" 型
        r'(\d{1,2})月(?:から|より)',
        # 単月 "6月に出現"
        r'(\d{1,2})月に',
    ]

    # まず、生態テキスト全体から月の範囲を抽出
    months = re.findall(r'(\d{1,2})月', eco_text)
    if not months:
        return None

    # より具体的なテキスト抽出を試みる
    # "成虫は5～6月、8月に出現する" のような文を探す
    emergence_text = None

    # パターン1: 「X月（中旬）～Y月（上旬）に出現」
    m = re.search(r'(\d{1,2}月[上中下]?旬?[～〜~からよりまで]*\d{0,2}月?[上中下]?旬?)(?:に出現|に得|に出|に採)', eco_text)
    if m:
        emergence_text = m.group(1)

    # パターン2: 「成虫は X月、Y月に出現」
    if not emergence_text:
        m = re.search(r'成虫は[、,]?(\d{1,2}月[上中下]?旬?(?:[～〜~、とから]*\d{1,2}月?[上中下]?旬?)*)', eco_text)
        if m:
            emergence_text = m.group(1)

    # パターン3: 「X～Y月」のシンプルパターン
    if not emergence_text:
        m = re.search(r'(\d{1,2})[～〜~](\d{1,2})月', eco_text)
        if m:
            emergence_text = f"{m.group(1)}～{m.group(2)}月"

    # パターン4: 複数月パターン「X月、Y月」
    if not emergence_text:
        all_months = re.findall(r'\d{1,2}月[上中下]?旬?', eco_text)
        if all_months:
            emergence_text = '、'.join(all_months[:4])

    # パターン5: 地域別出現期
    if not emergence_text:
        m = re.search(r'([^\n。]{0,30}?\d{1,2}[～〜~]\d{1,2}月[^\n。]{0,30})', eco_text)
        if m:
            emergence_text = m.group(1).strip()

    if emergence_text:
        # クリーンアップ
        emergence_text = emergence_text.strip().rstrip('。．.,、')
        # 長すぎる場合はカット
        if len(emergence_text) > 100:
            emergence_text = emergence_text[:100]

    return emergence_text


def extract_ecology_notes(eco_text):
    """生態テキストから生態情報を抽出（出現月以外の情報）"""
    if not eco_text or len(eco_text) < 5:
        return None

    notes = []

    # 年化数
    m = re.search(r'年(\d)化|(\d)化性|多化性|多化する', eco_text)
    if m:
        if '多化' in (m.group(0) or ''):
            notes.append('多化性')
        elif m.group(1):
            notes.append(f'年{m.group(1)}化')
        elif m.group(2):
            notes.append(f'年{m.group(2)}化')

    # 越冬態
    m = re.search(r'(卵|幼虫|蛹|成虫|繭)越冬|越冬(態は)?(卵|幼虫|蛹|成虫|繭)', eco_text)
    if m:
        stage = m.group(1) or m.group(3) or ''
        if stage:
            notes.append(f'{stage}越冬')
        else:
            notes.append('越冬')

    # 夏眠
    if '夏眠' in eco_text:
        notes.append('夏眠する')

    # 生息環境
    habitat_patterns = [
        (r'平地に普通', '平地に普通に産する'),
        (r'平地から山地', '平地から山地に広く生息'),
        (r'(低山地|山地|亜高山|高山)(?:に|から|まで)(?:産|生息|多い)', None),
        (r'暖地では', None),
        (r'(ごく普通|きわめて普通)', None),
    ]
    for pat, fixed in habitat_patterns:
        m = re.search(pat, eco_text)
        if m:
            if fixed:
                notes.append(fixed)
            else:
                # 前後の文脈を取得
                start = max(0, m.start() - 20)
                end = min(len(eco_text), m.end() + 30)
                context = eco_text[start:end].strip()
                # 文の切れ目で整形
                context = re.split(r'[。．]', context)[0]
                if context and len(context) > 5:
                    notes.append(context)
            break

    # 幼虫の行動
    larval_patterns = [
        r'幼虫は[^。]{5,60}',
        r'若齢幼虫は[^。]{5,60}',
        r'終齢幼虫は[^。]{5,60}',
    ]
    for pat in larval_patterns:
        m = re.search(pat, eco_text)
        if m:
            note = m.group(0).strip()
            if len(note) > 10:
                notes.append(note)
            break

    # 特殊な生態
    special_patterns = [
        r'昼行性',
        r'夜行性',
        r'灯火に[^。]{3,30}',
        r'樹液に[^。]{3,20}',
        r'花に[^。]{3,20}',
    ]
    for pat in special_patterns:
        m = re.search(pat, eco_text)
        if m:
            notes.append(m.group(0).strip())
            break

    if not notes:
        # 生テキスト全体から有用な部分を抽出（ただし短すぎるものは除外）
        clean = eco_text.strip()
        if len(clean) > 15:
            # 最初の2文を取得
            sentences = re.split(r'[。．]', clean)
            useful = [s.strip() for s in sentences[:3] if len(s.strip()) > 5]
            if useful:
                return '。'.join(useful)
        return None

    return '。'.join(notes)


def fuzzy_match_name(name, name_map):
    """和名の曖昧マッチング"""
    if name in name_map:
        return name_map[name]

    # スペース除去
    clean = name.replace(' ', '').replace('　', '')
    for k, v in name_map.items():
        if k.replace(' ', '').replace('　', '') == clean:
            return v

    # 部分一致（3文字以上）
    if len(name) >= 4:
        for k, v in sorted(name_map.items(), key=lambda x: -len(x[0])):
            if len(k) >= 4 and k == name[:len(k)]:
                return v

    return None


def process_zukan(ocr_path, reference, name_map):
    """図鑑のOCRテキストから生態情報を抽出"""
    text = ocr_path.read_text(encoding="utf-8")
    blocks = extract_species_blocks(text)
    print(f"  種ブロック数: {len(blocks)}")

    results = []
    no_eco = 0
    for block in blocks:
        name = block['name']
        emergence, ecology = extract_ecology_from_block(block['text'])

        iid = fuzzy_match_name(name, name_map)
        if not iid:
            continue

        if emergence:
            results.append({
                'insect_id': iid,
                'name': name,
                'note_type': '出現時期',
                'content': emergence,
                'reference': reference,
            })

        if ecology:
            results.append({
                'insect_id': iid,
                'name': name,
                'note_type': '生態情報',
                'content': ecology,
                'reference': reference,
            })

        if not emergence and not ecology:
            no_eco += 1

    print(f"  抽出結果: {len(results)}件 (出現時期: {sum(1 for r in results if r['note_type']=='出現時期')}, "
          f"生態情報: {sum(1 for r in results if r['note_type']=='生態情報')})")
    print(f"  生態情報なし: {no_eco}")

    return results


def main():
    print("=== 蛾類標準図鑑 生態情報抽出スクリプト ===\n")

    # 1. 名前マッピング
    name_map = load_moth_name_map()
    print(f"蛾和名数: {len(name_map)}")

    # 2. 既存データ
    existing_rows, fieldnames, max_id, existing_keys = load_existing_notes()
    print(f"既存ノート数: {len(existing_rows)}")

    # 3. 図鑑1抽出
    all_results = []
    if ZUKAN1_OCR.exists():
        print(f"\n--- 図鑑1 ({ZUKAN1_OCR.name}) ---")
        results1 = process_zukan(ZUKAN1_OCR, "日本産蛾類標準図鑑1", name_map)
        all_results.extend(results1)

    # 4. 図鑑2抽出
    if ZUKAN2_OCR.exists():
        print(f"\n--- 図鑑2 ({ZUKAN2_OCR.name}) ---")
        results2 = process_zukan(ZUKAN2_OCR, "日本産蛾類標準図鑑2", name_map)
        all_results.extend(results2)

    # 5. 既存データとマージ（重複排除）
    new_count = 0
    seen_ids = defaultdict(set)  # insect_id -> set of note_types added

    for r in all_results:
        iid = r['insect_id']
        nt = r['note_type']
        ref = r['reference']
        content = r['content']

        # 空コンテンツスキップ
        if not content or len(content) < 3:
            continue

        # 既存キーとの重複チェック
        key = (iid, nt, ref)
        if key in existing_keys:
            continue

        # 同一insect_id+note_typeで既に追加済み
        if nt in seen_ids[iid]:
            continue
        seen_ids[iid].add(nt)

        max_id += 1
        new_row = {
            'record_id': f'note-{max_id:06d}',
            'insect_id': iid,
            'note_type': nt,
            'content': content,
            'reference': ref,
            'page': '',
            'year': '',
        }
        existing_rows.append(new_row)
        existing_keys.add(key)
        new_count += 1

    print(f"\n=== 結果 ===")
    print(f"新規追加: {new_count}")
    print(f"合計ノート数: {len(existing_rows)}")

    # 6. 書き出し
    with open(NOTES_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in existing_rows:
            writer.writerow(row)

    print(f"{NOTES_CSV} に書き込み完了")


if __name__ == '__main__':
    main()
