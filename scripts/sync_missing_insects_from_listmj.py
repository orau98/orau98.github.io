#!/usr/bin/env python3
import csv, re, sys, os

ROOT = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(ROOT, '..'))
PUBLIC_INSECTS = os.path.join(ROOT, 'public', 'insects.csv')
LISTMJ_PATH = os.path.join(ROOT, 'archive', 'public-archive', 'legacy-data', 'ListMJ_hostplants_master.csv')

def read_csv(path):
    encs = ['utf-8-sig', 'utf-8']
    for enc in encs:
        try:
            with open(path, 'r', encoding=enc, newline='') as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise

def write_csv(path, rows, fieldnames):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

def sci_base(name):
    if not name: return ''
    t = str(name).strip()
    # Remove parentheses content
    t = re.sub(r"\s*\(.*?\)", "", t)
    # Collapse extra spaces
    t = re.sub(r"\s+", " ", t).strip()
    # First two tokens
    parts = t.split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[1]}"
    return t

def next_species_id(existing_rows):
    mx = 0
    for r in existing_rows:
        sid = r.get('insect_id','')
        m = re.match(r'^species-(\d+)$', sid)
        if m:
            mx = max(mx, int(m.group(1)))
    n = mx + 1
    while True:
        yield f"species-{n}"
        n += 1

def main():
    if not os.path.exists(PUBLIC_INSECTS):
        print(f"[error] not found: {PUBLIC_INSECTS}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(LISTMJ_PATH):
        print(f"[error] not found: {LISTMJ_PATH}", file=sys.stderr)
        sys.exit(1)

    target = read_csv(PUBLIC_INSECTS)
    src = read_csv(LISTMJ_PATH)

    # Build presence indexes
    have_jp = set()
    have_sci = set()
    for r in target:
        jp = (r.get('japanese_name') or '').strip()
        if jp:
            have_jp.add(jp)
        sci = sci_base(r.get('scientific_name') or '')
        if sci:
            have_sci.add(sci)

    missing = []
    unresolved = []
    for r in src:
        jp = (r.get('和名') or '').strip()
        sci_full = (r.get('学名') or '').strip()
        # Build base from columns if 学名 absent
        if not sci_full:
            genus = (r.get('属名') or '').strip()
            species = (r.get('種小名') or '').strip()
            sci_full = f"{genus} {species}".strip()
        base = sci_base(sci_full)
        # Skip obviously empty rows
        if not jp and not base:
            continue
        # If still cannot determine base genus/species, mark unresolved
        if not base or ' ' not in base:
            unresolved.append({ '和名': jp, '学名': sci_full })
            continue
        if (jp and jp in have_jp) or (base in have_sci):
            continue
        # Candidate to add
        missing.append(r)

    if not missing and not unresolved:
        print('[sync] no missing species detected.')
        return

    # Extend target with missing species
    id_gen = next_species_id(target)
    def val(r, key):
        return (r.get(key) or '').strip()

    added = []
    for r in missing:
        row = {
            'insect_id': next(id_gen),
            'family': val(r, '科名'),
            'family_jp': val(r, '科和名'),
            'subfamily': val(r, '亜科名'),
            'subfamily_jp': val(r, '亜科和名'),
            'tribe': val(r, '族名'),
            'tribe_jp': val(r, '族和名'),
            'genus': val(r, '属名'),
            'subgenus': val(r, '亜属名'),
            'species': val(r, '種小名'),
            'subspecies': val(r, '亜種小名'),
            'author': val(r, '著者'),
            'year': val(r, '公表年'),
            'japanese_name': val(r, '和名'),
            'old_japanese_name': val(r, '旧和名'),
            'alternative_name': val(r, '別名'),
            'other_names': val(r, 'その他の和名'),
            'scientific_name': val(r, '学名') or (f"{val(r,'属名')} {val(r,'種小名')}".strip()),
            'synonyms': '',
            'changes_since_standard': val(r, '標準図鑑以後の変更'),
            'notes': ''
        }
        target.append(row)
        # Update indexes to avoid duplicates on subsequent adds
        if row['japanese_name']:
            have_jp.add(row['japanese_name'])
        if row['scientific_name']:
            have_sci.add(sci_base(row['scientific_name']))
        added.append(row)

    # Sort by insect_id numeric order
    def id_key(r):
        m = re.match(r'^species-(\d+)$', r.get('insect_id',''))
        return int(m.group(1)) if m else 0
    target.sort(key=id_key)

    # Write back
    write_csv(PUBLIC_INSECTS, target, fieldnames=list(target[0].keys()))

    print(f"[sync] added {len(added)} missing species to public/insects.csv")
    if unresolved:
        print('[sync] unresolved entries (need manual scientific name):')
        for u in unresolved[:100]:
            print(f" - 和名={u['和名']} 学名候補={u['学名']}")
        if len(unresolved) > 100:
            print(f" ... and {len(unresolved)-100} more")

if __name__ == '__main__':
    main()
