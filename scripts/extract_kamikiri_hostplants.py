#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日本産カミキリムシの寄主植物一覧テキストから食草データを抽出するスクリプト。

OCRテキスト 18650行目〜21162行目（寄主植物一覧セクション）を解析し、
- normalized_data/insects.csv で和名→insect_id を解決
- hostplants.csv の既存「日本産カミキリムシ」データとの重複を除外
- 結果を reports/kamikiri_hostplant_list.json に出力

テキスト構造:
  科名行   : 日本語科名 + ラテン科名
  植物名行  : 植物和名 (別名) ラテン名 [植栽情報]
  カミキリ行 : カミキリ和名1 学名1，カミキリ和名2 学名2, ... （改行またぎあり）
"""

import csv
import json
import re
import unicodedata
import difflib
from pathlib import Path

BASE         = Path('/Users/akimotohiroki/orau98.github.io')
OCR_FILE     = BASE / 'pdfs/kamikiri-ocr/日本産カミキリムシ_compressed.txt'
INSECTS_CSV  = BASE / 'normalized_data/insects.csv'
HOSTS_CSV    = BASE / 'normalized_data/hostplants.csv'
OUT_JSON     = BASE / 'reports/kamikiri_hostplant_list.json'

# ===================================================================
# ユーティリティ
# ===================================================================
def normalize(s: str) -> str:
    """NFKC正規化・空白除去"""
    s = unicodedata.normalize('NFKC', s or '')
    return s.strip().replace('\u3000', '').replace(' ', '')

JP_CHAR = re.compile(r'[ぁ-んァ-ヶーｦ-ﾟ一-龠]')

def has_jp(s: str) -> bool:
    return bool(JP_CHAR.search(s))

# ===================================================================
# 1. insects.csv からカミキリムシ辞書を構築
# ===================================================================
# kamikiri_by_norm: 正規化和名 -> (insect_id, 正式和名)
# 亜種を含む全エントリを登録（基亜種の場合 "種名 基亜種" も "種名" に対応）

kamikiri_by_norm: dict[str, tuple[str, str]] = {}

with open(INSECTS_CSV, encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        if row['family'] != 'Cerambycidae':
            continue
        iid   = row['insect_id']
        jname = row['japanese_name'].strip()
        n     = normalize(jname)
        if n:
            kamikiri_by_norm.setdefault(n, (iid, jname))

        # 亜種名 "種名 亜種名" → "種名" でも引けるようにする
        # 例: "ルリボシカミキリ 基亜種" → "ルリボシカミキリ"
        base = re.sub(r'\s+(基亜種|亜種\d*|[A-Z].*亜種).*$', '', jname).strip()
        nb = normalize(base)
        if nb and nb != n:
            kamikiri_by_norm.setdefault(nb, (iid, jname))

        # 旧名・別名もインデックス
        for col in ('old_japanese_name', 'alternative_name', 'other_names'):
            for alt in re.split(r'[;；、,，]', row.get(col, '') or ''):
                alt = alt.strip()
                na = normalize(alt)
                if na:
                    kamikiri_by_norm.setdefault(na, (iid, jname))

print(f'カミキリムシ登録エントリ数: {len(kamikiri_by_norm)} (別名・亜種含む)')
print(f'サンプル:')
for k, v in list(kamikiri_by_norm.items())[:5]:
    print(f'  {k!r} -> {v}')

# ===================================================================
# 2. OCRテキスト読み込み (行18650〜21162, 0-indexed: 18649〜21161)
# ===================================================================
with open(OCR_FILE, encoding='utf-8') as f:
    all_lines = f.readlines()

raw_lines = [l.rstrip('\n') for l in all_lines[18649:21162]]
print(f'\nOCR対象行数: {len(raw_lines)}')

# ===================================================================
# 3. 前処理: ページヘッダ・ページ番号・区切り行を除去し、
#    折り返された行を結合してセグメントに分割
# ===================================================================
SKIP_RE = re.compile(
    r'^\s*(---|寄主植物一覧|寄上植物一覧|寄王植物一覧|寺主植物一覧|\d{3,4})\s*$'
)

# まずページ区切り系を除去
filtered = []
for line in raw_lines:
    ls = line.strip()
    if SKIP_RE.match(ls):
        continue
    if re.match(r'^---\s+ページ', ls):
        continue
    filtered.append(ls)

# 空行を区切りとしてセグメントに分割し、内部の行を連結
segments: list[str] = []
buf = []
for line in filtered:
    if line == '':
        if buf:
            segments.append(' '.join(buf))
            buf = []
    else:
        buf.append(line)
if buf:
    segments.append(' '.join(buf))

print(f'セグメント数: {len(segments)}')
print('先頭セグメントサンプル:')
for s in segments[:5]:
    print(f'  {s[:100]!r}')

# ===================================================================
# 4. セグメントを解析して (科名, 植物名, カミキリ名リスト) を構築
# ===================================================================
# 科名行パターン: 日本語の科名(末尾が「科」か「料」) + ラテン名
RE_FAMILY_LINE = re.compile(
    r'^([ぁ-んァ-ヶーｦ-ﾟ一-龠a-zA-Z\s]{2,20}?[科料])\s+[A-Z][A-Za-z]'
)

# 植物名行パターン: 先頭が日本語で始まり、カミキリを含まない
# 例: "ヤマザクラ Prunus yedoensis" / "Cotoneaster bullata" (ラテン語のみ)
RE_PLANT_START_JP = re.compile(r'^[ぁ-んァ-ヶーｦ-ﾟ一-龠]')
RE_PLANT_START_LAT = re.compile(r'^[A-Z][a-z]+\s+[a-z]')   # 属名+種名

# カミキリムシ和名の正規表現:
# カタカナ・漢字混じりで「カミキリ」で終わる2文字以上のトークン
RE_KAMIKIRI_NAME = re.compile(
    r'([一-龠ぁ-んァ-ヶーｦ-ﾟ\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]+?カミキリ)'
)

def extract_kamikiri_names(text: str) -> list[str]:
    """テキスト中のカミキリムシ和名候補を抽出"""
    candidates = RE_KAMIKIRI_NAME.findall(text)
    result = []
    for c in candidates:
        c = c.strip()
        # ゴミ除外
        if len(c) < 5:
            continue
        if '植物' in c or '一覧' in c or '植栽' in c:
            continue
        result.append(c)
    return result

def looks_like_family(seg: str) -> str | None:
    """科名行なら科名を返す、違えばNone"""
    m = RE_FAMILY_LINE.match(seg)
    if m:
        fam = m.group(1).replace('料', '科').strip()
        return fam
    return None

def looks_like_plant(seg: str) -> str | None:
    """植物名行なら植物和名を返す、違えばNone"""
    # カミキリを含む行は植物名行ではない
    if 'カミキリ' in seg:
        return None
    # 日本語で始まる
    if RE_PLANT_START_JP.match(seg):
        # 先頭から日本語部分（括弧含む）を抽出
        # 例: "ヤマザクラ（エゾヤマザクラ） Prunus ..."
        #      "ウメ Prunus mume"
        #      "モミジバスズカケノキ（モミジバスズカケ） Platanus X acerifolia 植栽"
        m = re.match(
            r'^((?:[ぁ-んァ-ヶーｦ-ﾟ一-龠]+)(?:[（(][^）)]*[）)])?'
            r'(?:\s*[ぁ-んァ-ヶーｦ-ﾟ一-龠]+(?:[（(][^）)]*[）)])?)*)',
            seg
        )
        if m:
            plant = m.group(1).strip()
            # 括弧内の別名を除去して主名のみ
            main = re.sub(r'[（(][^）)]*[）)]', '', plant).strip()
            return main if main else plant
    # ラテン語のみの行（栽培種）
    if RE_PLANT_START_LAT.match(seg):
        m = re.match(r'^([A-Z][a-z]+(?:\s+[a-z×][a-z.]+)*)', seg)
        if m:
            return m.group(1).strip()
    return None

# 状態機械で走査
current_family = ''
current_plant  = ''
records: list[tuple[str, str, list[str]]] = []   # (plant, family, [kamikiri_names])

for seg in segments:
    seg = seg.strip()
    if not seg:
        continue

    # --- 科名チェック ---
    fam = looks_like_family(seg)
    if fam:
        current_family = fam
        # 科名行にカミキリ名が続く場合は稀だが念のため確認
        names = extract_kamikiri_names(seg)
        if names and current_plant:
            records.append((current_plant, current_family, names))
        continue

    # --- カミキリ名を含むか ---
    names = extract_kamikiri_names(seg)

    if names:
        # カミキリ行: 現在の植物に紐付け
        if current_plant:
            records.append((current_plant, current_family, names))
        # else: 植物名を見逃した（OCR破損等）→ スキップ
        continue

    # --- 植物名行チェック ---
    plant = looks_like_plant(seg)
    if plant:
        current_plant = plant
        continue

    # --- 「植栽（原産地：...）」だけの行 ---
    if re.match(r'^植栽', seg):
        continue

    # --- それ以外（OCR誤字・ページ番号残り等）はスキップ ---

print(f'\n抽出レコード数: {len(records)}')
print('レコードサンプル:')
for plant, fam, names in records[:5]:
    print(f'  [{fam}] {plant}: {names}')

# ===================================================================
# 5. カミキリムシ和名 → insect_id の曖昧マッチング
# ===================================================================
_all_norm_keys = list(kamikiri_by_norm.keys())

def find_insect_id(raw_name: str) -> tuple[str | None, str | None, float]:
    """
    カミキリムシ和名 raw_name から (insect_id, 正式和名, スコア) を返す。
    スコア: 1.0=完全一致, 0.7〜0.99=曖昧マッチ, 0.0=未マッチ
    """
    n = normalize(raw_name)
    if not n:
        return None, None, 0.0

    # --- 完全一致 ---
    if n in kamikiri_by_norm:
        iid, jname = kamikiri_by_norm[n]
        return iid, jname, 1.0

    # --- 末尾の「様」「類」「型」「類似」を除去して再試行 ---
    n2 = re.sub(r'(様|類|型|類似|モドキ$)', '', n)
    if n2 != n and n2 in kamikiri_by_norm:
        iid, jname = kamikiri_by_norm[n2]
        return iid, jname, 0.95

    # --- 部分一致: n が登録名に含まれる、または登録名が n に含まれる ---
    best = (None, None, 0.0)
    for reg in _all_norm_keys:
        if n in reg and len(n) >= 5:
            score = len(n) / len(reg)
            if score > best[2]:
                best = (*kamikiri_by_norm[reg], score)
        elif reg in n and len(reg) >= 5:
            score = len(reg) / len(n)
            if score > best[2]:
                best = (*kamikiri_by_norm[reg], score)

    if best[2] >= 0.75:
        return best

    # --- difflib 類似度マッチング ---
    matches = difflib.get_close_matches(n, _all_norm_keys, n=1, cutoff=0.78)
    if matches:
        ratio = difflib.SequenceMatcher(None, n, matches[0]).ratio()
        iid, jname = kamikiri_by_norm[matches[0]]
        return iid, jname, round(ratio, 3)

    return None, None, 0.0

# ===================================================================
# 6. 既存 hostplants.csv の (insect_id, 正規化植物名) セットを構築
# ===================================================================
existing: set[tuple[str, str]] = set()
with open(HOSTS_CSV, encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        ref = row.get('reference', '') or ''
        if 'カミキリムシ' in ref:
            existing.add((row['insect_id'], normalize(row['plant_name'])))

print(f'\n既存カミキリムシ食草ペア数: {len(existing)}')

# ===================================================================
# 7. 結果を組み立て
# ===================================================================
results: list[dict] = []
stats = {'exact': 0, 'fuzzy': 0, 'no_match': 0}

for plant_name, plant_family, kamikiri_names in records:
    plant_norm = normalize(plant_name)
    for raw in kamikiri_names:
        iid, matched_jname, score = find_insect_id(raw)

        if iid is None:
            stats['no_match'] += 1
            results.append({
                'insect_id': None,
                'insect_name': raw,
                'matched_name': None,
                'match_score': 0.0,
                'plant_name': plant_name,
                'plant_family': plant_family,
                'is_new': False,
                'note': 'no_match'
            })
            continue

        if score >= 0.99:
            stats['exact'] += 1
        else:
            stats['fuzzy'] += 1

        is_new = (iid, plant_norm) not in existing

        results.append({
            'insect_id': iid,
            'insect_name': matched_jname,
            'matched_name': raw if normalize(raw) != normalize(matched_jname) else None,
            'match_score': round(score, 3),
            'plant_name': plant_name,
            'plant_family': plant_family,
            'is_new': is_new,
            'note': 'fuzzy_match' if score < 0.99 else ''
        })

print(f'\nマッチ統計: 完全={stats["exact"]}, 曖昧={stats["fuzzy"]}, 未マッチ={stats["no_match"]}')
print(f'総レコード数: {len(results)}')
new_count = sum(1 for r in results if r['is_new'])
print(f'新規 (is_new=True): {new_count}')
print(f'既存 (is_new=False): {sum(1 for r in results if not r["is_new"])}')

# ===================================================================
# 8. JSON 出力
# ===================================================================
OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f'\n出力完了: {OUT_JSON}')
print(f'  総エントリ: {len(results)}')
print(f'  新規 (is_new=True): {new_count}')

# サンプル表示
print('\n--- 新規エントリ (is_new=True) サンプル ---')
for r in [x for x in results if x['is_new'] and x['insect_id']][:10]:
    print(f'  {r["insect_id"]} {r["insect_name"]} / {r["plant_name"]} ({r["plant_family"]})'
          f' score={r["match_score"]}')

print('\n--- 未マッチサンプル ---')
for r in [x for x in results if x['note'] == 'no_match'][:10]:
    print(f'  OCR名: {r["insect_name"]!r} / {r["plant_name"]}')
