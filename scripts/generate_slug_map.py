#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Generate a slug map JSON for scientific-name based routing.

Input: insects.csv (moths)
Output: assets/slug-map.json with structure:
{
  "version": 1,
  "generated_at": "2025-10-16T00:00:00Z",
  "moth": { "abraxas-grossulariata": "species-3541", ... },
  "butterfly": {},
  "leafbeetle": {},
  "beetle": {}
}

Notes:
- Subspecies are appended as a third epithet: genus-species-subspecies
- Rank markers like "subsp.", "ssp.", "var.", "f." are ignored when building slugs
- Slug collisions are resolved by appending a hyphen and a short id suffix
"""

import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_INSECTS = os.path.join(ROOT, 'insects.csv')
OUT_JSON = os.path.join(ROOT, 'assets', 'slug-map.json')


def slugify_token(token: str) -> str:
    if not token:
        return ''
    t = token.strip()
    # Normalize Unicode and strip diacritics
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(ch for ch in t if not unicodedata.combining(ch))
    # Common hybrid sign
    t = t.replace('×', 'x').replace('✕', 'x').replace('X', 'x')
    # Remove authorship parentheses, commas, etc. (handled later anyway)
    t = t.lower()
    # Replace separators with hyphen
    t = re.sub(r"[\s_/]+", '-', t)
    # Keep only a-z0-9 and hyphens
    t = re.sub(r"[^a-z0-9-]", '-', t)
    # Collapse multiple hyphens
    t = re.sub(r"-+", '-', t)
    # Trim hyphens
    t = t.strip('-')
    return t


def build_slug(genus: str, species: str, subspecies: str) -> str:
    # Drop infraspecific rank tokens in species/subspecies fields if present
    rank_tokens = {'subsp', 'ssp', 'var', 'forma', 'form', 'f'}
    def clean_epithet(x: str) -> str:
        x = (x or '').strip()
        if not x:
            return ''
        # Remove rank keywords if included inline (e.g., "subsp. okinawensis")
        x = re.sub(r"\b(subsp|ssp|var|forma|form|f)\.?\b\s*", '', x, flags=re.IGNORECASE)
        return x

    g = slugify_token(genus)
    s = slugify_token(clean_epithet(species))
    ss = slugify_token(clean_epithet(subspecies))
    parts = [p for p in (g, s, ss) if p]
    return '-'.join(parts)


def classify_group(family: str, family_jp: str) -> str:
    family = (family or '').strip()
    fj = (family_jp or '').strip()
    # Mirror app logic
    if any(k in fj for k in ('チョウ', 'シジミ', 'セセリ')):
        return 'butterfly'
    if 'タマムシ' in fj or family == 'Buprestidae':
        return 'beetle'
    if 'ハムシ' in fj or family == 'Chrysomelidae':
        return 'leafbeetle'
    return 'moth'


def id_suffix(insect_id: str) -> str:
    # Prefer trailing digits; otherwise sanitize id
    m = re.search(r"(\d+)$", insect_id or '')
    if m:
        return m.group(1)
    # fallback: short sanitized id
    t = slugify_token((insect_id or '').lower())
    return t[:10] if t else 'x'


def main():
    if not os.path.exists(CSV_INSECTS):
        print(f"Missing {CSV_INSECTS}", file=sys.stderr)
        sys.exit(1)

    groups = { 'moth': {}, 'butterfly': {}, 'leafbeetle': {}, 'beetle': {} }
    collisions = {}

    with open(CSV_INSECTS, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            insect_id = (row.get('insect_id') or '').strip()
            if not insect_id:
                continue
            genus = row.get('genus') or ''
            species = row.get('species') or ''
            subspecies = row.get('subspecies') or ''
            family = row.get('family') or ''
            family_jp = row.get('family_jp') or ''

            # Skip incomplete names
            if not genus or not species:
                continue

            group = classify_group(family, family_jp)
            slug = build_slug(genus, species, subspecies)
            if not slug:
                continue

            gmap = groups[group]
            if slug in gmap and gmap[slug] != insect_id:
                # Collision: ensure stable, append id short suffix
                suffix = id_suffix(insect_id)
                slug2 = f"{slug}-{suffix}"
                # Reserve the suffix variant for this id
                gmap[slug2] = insect_id
                collisions.setdefault(group, []).append((slug, insect_id))
            else:
                gmap[slug] = insect_id

    out = {
        'version': 1,
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'moth': groups['moth'],
        'butterfly': groups['butterfly'],
        'leafbeetle': groups['leafbeetle'],
        'beetle': groups['beetle'],
    }

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    print(f"Wrote {OUT_JSON}")
    if any(collisions.values()):
        total = sum(len(v) for v in collisions.values())
        print(f"Note: {total} slug collision(s) resolved with id suffixes.")


if __name__ == '__main__':
    main()

