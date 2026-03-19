#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日本産蛾類標準図鑑3のテキストから寄主植物・生態情報を抽出し、
normalized_data/hostplants.csv と general_notes.csv に追加するスクリプト。
Canonical extractor for zukan3 OCR text.
"""

import csv
import re
import os
from datetime import datetime

BASE_DIR = '/Users/akimotohiroki/orau98.github.io'
TEXT_FILE = os.path.join(BASE_DIR, 'pdfs/zukan3-ocr/日本産蛾類標準図鑑3.txt')
INSECTS_CSV = os.path.join(BASE_DIR, 'normalized_data/insects.csv')
HOSTPLANTS_CSV = os.path.join(BASE_DIR, 'normalized_data/hostplants.csv')
GENERAL_NOTES_CSV = os.path.join(BASE_DIR, 'normalized_data/general_notes.csv')
REFERENCE = '日本産蛾類標準図鑑3'

SMALL_TO_LARGE = str.maketrans('ァィゥェォャュョッヮヵヶ', 'アイウエオヤユヨツワカケ')


def normalize_japanese_name(name):
    if not name:
        return name
    # 括弧内の補足を除去（閉じ括弧なしも対応）
    name = re.sub(r'[（(][^）)]*(?:新称|改称|新記録|和名)[^）)]*[）)]?', '', name)
    name = name.strip()
    if name and name[0] in 'ァィゥェォャュョッヮヵヶ':
        name = name[0].translate(SMALL_TO_LARGE) + name[1:]
    # OCRノイズ補正: ッツミノガ→ツツミノガ（小文字ッがツツの最初のツになった場合）
    name = re.sub(r'ッツミノガ', 'ツツミノガ', name)
    name = re.sub(r'ッヤコガ', 'ツヤコガ', name)
    return name


def load_insects():
    name_to_id = {}
    with open(INSECTS_CSV, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row['insect_id']
            for field in ['japanese_name', 'old_japanese_name', 'alternative_name']:
                val = row.get(field, '').strip().strip('"')
                if val:
                    name_to_id[val] = sid
                    norm = normalize_japanese_name(val)
                    if norm and norm != val:
                        name_to_id[norm] = sid
            other = row.get('other_names', '')
            for sep in ['、', ',', '；', ';']:
                other = other.replace(sep, '|')
            for name in other.split('|'):
                name = name.strip().strip('"')
                if name:
                    name_to_id[name] = sid
                    norm = normalize_japanese_name(name)
                    if norm and norm != name:
                        name_to_id[norm] = sid
    return name_to_id


def load_existing_hostplants():
    existing = set()
    last_id = 0
    with open(HOSTPLANTS_CSV, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row.get('insect_id', ''), row.get('plant_name', ''), row.get('reference', ''))
            existing.add(key)
            m = re.search(r'hostplant-(\d+)', row.get('record_id', ''))
            if m:
                last_id = max(last_id, int(m.group(1)))
    return existing, last_id


def load_existing_notes():
    existing = set()
    last_id = 0
    with open(GENERAL_NOTES_CSV, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row.get('insect_id', ''), row.get('note_type', ''), row.get('content', ''))
            existing.add(key)
            m = re.search(r'note-(\d+)', row.get('record_id', ''))
            if m:
                last_id = max(last_id, int(m.group(1)))
    return existing, last_id


def is_host_section_line(line):
    """
    「寄主植物」セクション見出し行かどうか判定。
    v3と同じロジックだが、本文中出現（「寄主植物の新葉に」等）を除外。
    ブラケットは全角［］・半角[]・〔〕いずれかを含む
    """
    if '寄主植物' not in line:
        return False
    stripped = line.strip()
    # セクション見出しパターン: 「［寄主植物］」「寄主植物]」「奇主植物]」等
    # 全角ブラケット［］・半角[]・〔〕・「奇主植物」（OCRノイズ）に対応
    if re.search(r'[〔\[\uff3b奇]?寄?主植物[〕\]\uff3d]', stripped):
        # 本文中の参照を除外
        inline_patterns = [
            r'幼虫は寄主植物',
            r'寄主植物の[新薬業葉花樹]',
            r'寄主植物として[はにをが]',
            r'寄主植物が[開判]',
            r'[〔\[\uff3b]生態[〕\]\uff3d].*?寄主植物',
            r'寄主植物[（のから]',
        ]
        for pat in inline_patterns:
            if re.search(pat, stripped):
                return False
        return True
    # ブラケット開始なしだが行頭に「寄主植物」で始まる場合も含める
    if re.match(r'^寄主植物[〕\]\uff3d]', stripped):
        return True
    return False


def collect_host_content(lines, host_idx):
    """寄主植物セクション行の内容を収集"""
    line = lines[host_idx].strip()

    # セクション見出し後の内容を取得
    m = re.search(r'[〔\[\uff3b奇]?寄?主植物[〕\]\uff3d]?[　 ]*(.*)', line)
    content = m.group(1).strip() if m else ''

    # 先頭の「]」「〕」「］」を除去
    content = re.sub(r'^[〕\]\uff3d\uff3b）]+', '', content).strip()

    # 次行から続きを収集
    i = host_idx + 1
    while i < len(lines) and i < host_idx + 10:
        next_line = lines[i].strip()
        if re.search(r'[〔\[\uff3b](分布|生態|寄主植物|分類)[〕\]\uff3d]', next_line):
            break
        if re.match(r'^\d{2,3}$', next_line):
            i += 1
            continue
        if re.match(r'^(図版|Fig\.|---)', next_line):
            break
        if next_line:
            content += next_line
        i += 1

    return content


def collect_ecology_content(lines, host_idx):
    for i in range(host_idx - 1, max(host_idx - 40, -1), -1):
        line = lines[i].strip()
        if re.search(r'[〔\[\uff3b]生態[〕\]\uff3d]', line):
            m = re.search(r'[〔\[\uff3b]生態[〕\]\uff3d][　 ]*(.*)', line)
            content = m.group(1).strip() if m else ''
            k = i + 1
            while k < host_idx:
                next_line = lines[k].strip()
                if re.search(r'[〔\[\uff3b](寄主植物|分類|分布)[〕\]\uff3d]', next_line):
                    break
                if next_line:
                    content += next_line
                k += 1
            return content
    return ''


INVALID_NAME_PATTERNS = [
    r'上科$', r'科$', r'亜科$', r'族$', r'属$',
    r'と同じ', r'から記録', r'^ふくまれた', r'された一方',
    r'\d{4}', r'[A-Z]{3,}',
    r'の決定', r'^口本産', r'記録されている',
    r'幼生期', r'期は不明', r'などは不明',
    r'幼虫期', r'生態は不明', r'よび同色', r'じることがある',
    r'角形の歯', r'に突き刺さ', r'ドクッス', r'年化性は不明',
    r'^より$', r'^ロシア南東部$', r'まる粋通種',
    r'^ミノの', r'^ミノ表面',
    r'サクラ属', r'なる粋通種',
    r'^ハモグリガ科', r'^マルハキバガ科', r'^ニセマイコガ科', r'^ツツミノガ科',
    r'^スカシバガ科', r'^キバガ科', r'^ネマルハキバガ科', r'^カザリバガ科',
    r'^スガ科', r'^ヒロズコガ科',
    r'くわしい', r'しばしば', r'幼虫は幼虫', r'^は不明$',
    r'むかって細く', r'にある大きな', r'たないことから',
    r'しゅう（ひだ）点', r'ヨーロッパ$',
    r'前種タイワン', r'ときに斑紋があ', r'^は幼虫期',
    r'シノニムとされてきた', r'^未矧',
    r'モグリチビガ科', r'ヒゲナガガ科では',
    r'^コボウトガリキバガ$',  # 別の種のことが混入している場合
]


def is_valid_species_name(name):
    if not name or len(name) < 2 or len(name) > 30:
        return False
    for pat in INVALID_NAME_PATTERNS:
        if re.search(pat, name):
            return False
    jp_chars = len(re.findall(r'[ァ-ヺア-ン\u4e00-\u9fff\u3041-\u309f]', name))
    if jp_chars < 2:
        return False
    return True


def find_species_name(lines, host_idx):
    n = len(lines)
    lookback = 120

    last_class_idx = -1
    for i in range(host_idx - 1, max(host_idx - lookback, -1), -1):
        if re.search(r'[〔\[\uff3b]分類[〕\]\uff3d]', lines[i]):
            last_class_idx = i
            break

    dist_start_idx = host_idx
    for i in range(host_idx - 1, max(host_idx - 80, -1), -1):
        if re.search(r'[〔\[\uff3b]分布[〕\]\uff3d]', lines[i]):
            dist_start_idx = i
            break

    search_start = last_class_idx + 1 if last_class_idx >= 0 else max(host_idx - lookback, 0)
    search_end = dist_start_idx

    if search_start >= search_end:
        search_start = max(host_idx - lookback, 0)
        search_end = host_idx

    candidates = []

    for i in range(search_start, min(search_end, n)):
        line = lines[i].strip()
        if not line:
            continue

        if re.match(r'^[ァ-ヺア-ン\u4e00-\u9fff\u3041-\u309f][ァ-ヺア-ン\u4e00-\u9fff\u3041-\u309f・ー\s（）〔〕]{0,28}$', line):
            normalized = normalize_japanese_name(line)
            if not is_valid_species_name(normalized):
                continue

            sci_name = ''
            has_sci = False
            for k in range(i + 1, min(i + 8, n)):
                sci_line = lines[k].strip()
                if re.search(r'\b[A-Z][a-z]{2,}\s+[a-z]{2,}', sci_line):
                    has_sci = True
                    sci_name = sci_line
                    break
                if re.search(r'[〔\[\uff3b](開張|分布|生態|図版|分類)', sci_line):
                    break

            candidates.append((i, normalized, sci_name, has_sci))

    if not candidates:
        return None, '', -1

    sci_cands = [(i, nm, sc, hs) for (i, nm, sc, hs) in candidates if hs]
    if sci_cands:
        best = sci_cands[-1]
    else:
        best = candidates[-1]

    return best[1], best[2], best[0]


def _cut_at_keyword(text, keyword):
    """括弧外に keyword が出現した位置で切断"""
    depth = 0
    idx = 0
    while idx < len(text):
        ch = text[idx]
        if ch in '（(':
            depth += 1
        elif ch in '）)':
            depth = max(0, depth - 1)
        elif depth == 0 and text[idx:idx+len(keyword)] == keyword:
            return text[:idx]
        idx += 1
    return text


def parse_plant_info(raw_text):
    """寄主植物テキストから(植物名, 科名)のリストを返す"""
    if not raw_text:
        return []

    SKIP_WORDS = ['未知', '不明', 'なし', '未記録', '食草不明', '未解明',
                  '確認されていない', 'わかっていない', '不詳', '不明です',
                  '未矧', '未奸', '木本', '不詳', 'H本では未知']
    for s in SKIP_WORDS:
        if s in raw_text:
            # 括弧内に植物名がある場合を考慮
            if not re.search(r'[（(].{2,}?[）)]', raw_text):
                return []

    # クリーニング
    text = raw_text.strip()
    # 先頭の「]」「〕」「）」を除去
    text = re.sub(r'^[〕\]\）]+', '', text).strip()
    # 行末の「分類」セクション等を除去
    text = re.sub(r'[〔\[\uff3b]分類[〕\]\uff3d].*$', '', text)
    text = re.sub(r'[〔\[\uff3b]分布[〕\]\uff3d].*$', '', text)
    # 「など」以降を除去（括弧外のみ）
    text = _cut_at_keyword(text, 'など')
    text = re.sub(r'の害虫.*$', '', text)
    text = re.sub(r'（ただし[^）]*）', '', text)
    text = re.sub(r'（なお[^）]*）', '', text)
    # 空白を除去
    text = re.sub(r'\s+', '', text)

    # 「．」または「。」で最初の文で切断（括弧外の場合のみ）
    text = cut_at_first_sentence_end(text)

    if not text:
        return []

    plants = []
    remaining = text

    while remaining:
        remaining = remaining.strip('，、；　 ')
        if not remaining:
            break

        # パターン1: 「A，B（以上X科）」または「A，B（以l：X科）」等OCRノイズ対応
        m = re.match(r'^(.*?)（以[上lL！][:：]?\s*([^）]+)）', remaining)
        if m:
            plants_str = m.group(1)
            family = m.group(2).strip()
            for p in re.split(r'[，、；]', plants_str):
                p = clean_plant_name(p.strip())
                if p and len(p) >= 2 and not _is_invalid_plant(p):
                    plants.append((p, family))
            remaining = remaining[m.end():]
            continue

        # パターン2: 「A（X科）」または「A（X科の1種）」等
        m = re.match(r'^([^，、；（）]+?)（([^（）]{2,}?科[^（）]*?)）', remaining)
        if m:
            plant_name = m.group(1).strip()
            family = m.group(2).strip()
            # 科名の「以上」「以l：」等OCRノイズを除去
            family = re.sub(r'^以[上lL！][:：]?\s*', '', family).strip()
            family = re.sub(r'^[^ァ-ヺア-ン\u4e00-\u9fff\u3041-\u309f]+', '', family).strip()
            # 先頭の小文字カタカナを補正
            if family and family[0] in 'ァィゥェォャュョッヮヵヶ':
                family = family[0].translate(SMALL_TO_LARGE) + family[1:]
            for p in re.split(r'[，、；]', plant_name):
                p = clean_plant_name(p.strip())
                if p and len(p) >= 2 and not _is_invalid_plant(p):
                    plants.append((p, family))
            remaining = remaining[m.end():]
            continue

        # パターン3: 括弧ありだが科名なし
        m = re.match(r'^([^，、；（）]+?)（([^（）]+?)）', remaining)
        if m:
            plant_name = m.group(1).strip()
            bracket = m.group(2).strip()
            for p in re.split(r'[，、；]', plant_name):
                p = clean_plant_name(p.strip())
                if p and len(p) >= 2 and not _is_invalid_plant(p):
                    plants.append((p, bracket if '科' in bracket else ''))
            remaining = remaining[m.end():]
            continue

        # パターン4: 科名なし・括弧なし
        m = re.match(r'^([^，、；（）]+?)([，、；]|$)', remaining)
        if m:
            plant_name = clean_plant_name(m.group(1).strip())
            if plant_name and len(plant_name) >= 2 and not _is_invalid_plant(plant_name):
                plants.append((plant_name, ''))
            remaining = remaining[len(m.group(0)):]
            continue

        # 括弧内を丸ごとスキップ（科名以外の括弧 → 著者引用など）
        # 全角・半角混在の括弧に対応
        m_bracket = re.match(r'^[（(]([^（()）)]*)[）)]', remaining)
        if m_bracket:
            remaining = remaining[m_bracket.end():]
            continue
        remaining = remaining[1:]

    return plants


def cut_at_first_sentence_end(text):
    """括弧外の最初の「．」「。」で切断する"""
    depth = 0
    for idx, ch in enumerate(text):
        if ch in '（(':
            depth += 1
        elif ch in '）)':
            depth = max(0, depth - 1)
        elif ch in '．。' and depth == 0:
            return text[:idx]
    return text


def _is_invalid_plant(name):
    invalid_starts = [
        '未知', '不明', '食草', '幼虫', '成虫', '年', 'など', '以上', '及び',
        '推測', '可能', 'その他', '多種', '各種', '広葉', '針葉', '樹木',
        '雑草', '草本', '木本', '植物', '複数', '寄主', '多く', '枯れ',
        '成熟', '若齢', '老熟', 'または', 'あるいは', 'もしくは',
        '斑状', '線状', '掌状', '葉衷', '葉脈',
        'の根茎', 'の茎', 'の枝', 'の葉', 'の花', 'の実', 'の果', 'の種',
        'の上脈', 'の下脈', 'の幼果', 'の種子', 'のような',
        '根茎', '上脈', '落ち葉', '枯れ葉', '枯葉', '落下果',
        '地衣類', '蘇類', '岩石', '土中', '乾燥', '生息場所',
        '表面の', '樹皮', '緑色', '粉状',
        '前種', '本種', '近縁種', '下記', '不詳', '未記',
        '飼育', '記録', '推定',
        'や', 'また', 'ある', 'おそらく', 'ほか', '海外', '日本',
        '台湾', '韓国', '中国', 'ヨーロッパ', 'ロシア',
    ]
    for inv in invalid_starts:
        if name.startswith(inv):
            return True
    # 「の○○」で終わる接続フレーズ
    if re.search(r'の[根茎葉枝花実種]+$', name):
        return True
    # 数字だけ、アルファベットだけ
    if re.match(r'^[\d\s]+$', name):
        return True
    if re.match(r'^[A-Za-z\s\.]+$', name):
        return True
    if len(name) > 25:
        return True
    if not re.search(r'[ァ-ヺア-ン\u4e00-\u9fff\u3041-\u309f]', name):
        return True
    # 明らかに植物名でないフレーズ（助詞を含む文）
    if re.search(r'[にはでをが]', name) and len(name) > 5:
        return True
    # 図版・ページ参照
    if re.search(r'図版|図\d|[Ff]ig', name):
        return True
    # OCR化けっぽい文字列（日本語文字が少なすぎる）
    jp_chars = len(re.findall(r'[ァ-ヺア-ン\u4e00-\u9fff\u3041-\u309f]', name))
    if jp_chars < 2:
        return True
    # 「と推測」「と思われ」など推定表現・文構造
    if re.search(r'と推[測定]|と思われ|と考え|可能性|確認されて|のような|のほか', name):
        return True
    # 「〜類」「〜属」「〜科」で終わるが植物属名として有効でない
    if re.search(r'[科族上]$', name):
        return True
    # 数字を含む（ページ番号混入等）
    if re.search(r'\d', name):
        return True
    return False


def clean_plant_name(name):
    """植物名に混入した学名・記号・余分なテキストを除去"""
    # ラテン文字大文字始まりの学名部分を除去
    name = re.sub(r'[A-Z][a-z]+(?:\s+[a-z]+)*', '', name).strip()
    # 括弧・記号など余分な文字を除去
    name = re.sub(r'[（）\(\)\[\]〔〕\uff3b\uff3d]', '', name).strip()
    # 末尾の「の」「や」「と」等接続詞除去
    name = re.sub(r'[のやとも]+$', '', name).strip()
    # 先頭の小文字カタカナを大文字に変換
    if name and name[0] in 'ァィゥェォャュョッヮヵヶ':
        name = name[0].translate(SMALL_TO_LARGE) + name[1:]
    return name


def extract_emergence_period(ecology_text):
    if not ecology_text:
        return None
    text = re.sub(r'\s+', '', ecology_text)

    m = re.search(r'成虫[はの].*?(\d{1,2})[〜～~](\d{1,2})月', text)
    if m:
        return f'{m.group(1)}〜{m.group(2)}月'

    m = re.search(r'(\d{1,2})[〜～~](\d{1,2})月[にで]?出現', text)
    if m:
        return f'{m.group(1)}〜{m.group(2)}月'

    m = re.search(r'(\d{1,2})月[にで]?出現', text)
    if m:
        return f'{m.group(1)}月'

    m = re.search(r'(?:出現|発生)期[はの].*?(\d{1,2})[〜～~](\d{1,2})月', text)
    if m:
        return f'{m.group(1)}〜{m.group(2)}月'

    return None


def main(write_mode=False):
    print("=== 日本産蛾類標準図鑑3 食草抽出スクリプト v5 ===")
    print(f"処理日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"書き込みモード: {'有効' if write_mode else '無効（ドライラン）'}")

    print("\n[1] ファイル読み込み...")
    with open(TEXT_FILE, encoding='utf-8') as f:
        text_content = f.read()

    insects = load_insects()
    print(f"昆虫データ: {len(insects)} エントリ")

    existing_hp, last_hp_id = load_existing_hostplants()
    print(f"既存hostplants: {len(existing_hp)} レコード, 最後のID: {last_hp_id}")

    existing_notes, last_note_id = load_existing_notes()
    print(f"既存general_notes: {len(existing_notes)} レコード, 最後のID: {last_note_id}")

    print("\n[2] テキスト解析...")

    text = re.sub(r'---\s*ページ\s*\d+\s*---', '', text_content)
    text = re.sub(r'\n\s*\d{2,3}\s*\n', '\n', text)
    lines = text.split('\n')

    # 全「寄主植物」行を収集（is_host_section_line でフィルタ）
    host_line_idxs = [i for i, l in enumerate(lines) if is_host_section_line(l)]
    print(f"寄主植物セクション行数: {len(host_line_idxs)}")

    hp_counter = last_hp_id + 1
    note_counter = last_note_id + 1

    new_hostplants = []
    new_notes = []

    matched_count = 0
    no_plants_count = 0
    unmatched_list = []

    for host_idx in host_line_idxs:
        host_content = collect_host_content(lines, host_idx)
        ecology_content = collect_ecology_content(lines, host_idx)

        species_name, scientific_name, found_idx = find_species_name(lines, host_idx)

        if species_name is None:
            unmatched_list.append({'name': None, 'host': host_content, 'idx': host_idx})
            continue

        insect_id = insects.get(species_name)

        if insect_id is None:
            corrected = species_name.translate(SMALL_TO_LARGE)
            if corrected != species_name:
                insect_id = insects.get(corrected)

        if insect_id is None:
            unmatched_list.append({'name': species_name, 'host': host_content, 'idx': host_idx})
            continue

        matched_count += 1

        plants = parse_plant_info(host_content)
        if not plants:
            no_plants_count += 1

        for plant_name, plant_family in plants:
            key = (insect_id, plant_name, REFERENCE)
            if key not in existing_hp:
                new_hostplants.append({
                    'record_id': f'hostplant-{hp_counter:06d}',
                    'insect_id': insect_id,
                    'plant_name': plant_name,
                    'plant_family': plant_family,
                    'observation_type': '文献',
                    'plant_part': '',
                    'life_stage': '幼虫',
                    'reference': REFERENCE,
                    'notes': '',
                })
                existing_hp.add(key)
                hp_counter += 1

        if ecology_content:
            emergence = extract_emergence_period(ecology_content)
            if emergence:
                note_key = (insect_id, '出現時期', emergence)
                if note_key not in existing_notes:
                    new_notes.append({
                        'record_id': f'note-{note_counter:07d}',
                        'insect_id': insect_id,
                        'note_type': '出現時期',
                        'content': emergence,
                        'reference': REFERENCE,
                        'page': '',
                        'year': '',
                    })
                    existing_notes.add(note_key)
                    note_counter += 1

    print(f"\n[3] 抽出結果:")
    print(f"  マッチした種: {matched_count}")
    print(f"    うち食草なし（未知等）: {no_plants_count}")
    print(f"  アンマッチ: {len(unmatched_list)}")
    print(f"  新規hostplants: {len(new_hostplants)}")
    print(f"  新規general_notes: {len(new_notes)}")

    print(f"\n[4] アンマッチ詳細:")
    for item in unmatched_list:
        print(f"  行{item['idx']}: 種名=「{item['name']}」 寄主={item['host'][:60]}")

    print(f"\n[5] 新規hostplantsサンプル（最初の50件）:")
    for row in new_hostplants[:50]:
        print(f"  {row['insect_id']} | {row['plant_name']}({row['plant_family']}) | {row['record_id']}")

    if write_mode:
        write_results(new_hostplants, new_notes)

    return new_hostplants, new_notes, unmatched_list


def write_results(new_hostplants, new_notes):
    if not new_hostplants and not new_notes:
        print("追加データなし。")
        return

    if new_hostplants:
        hp_fieldnames = ['record_id', 'insect_id', 'plant_name', 'plant_family',
                         'observation_type', 'plant_part', 'life_stage', 'reference', 'notes']
        with open(HOSTPLANTS_CSV, 'a', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=hp_fieldnames)
            for row in new_hostplants:
                writer.writerow(row)
        print(f"hostplants.csv に {len(new_hostplants)} 件追記しました。")

    if new_notes:
        note_fieldnames = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']
        with open(GENERAL_NOTES_CSV, 'a', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=note_fieldnames)
            for row in new_notes:
                writer.writerow(row)
        print(f"general_notes.csv に {len(new_notes)} 件追記しました。")


if __name__ == '__main__':
    import sys
    write = '--write' in sys.argv
    new_hp, new_notes, unmatched = main(write_mode=write)
    print(f"\n=== 処理完了 ===")
    if not write:
        print("本番実行: python3 scripts/extract_zukan3_v5.py --write")
