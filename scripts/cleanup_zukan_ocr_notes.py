#!/usr/bin/env python3

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
NOTES_CSV = ROOT / "normalized_data" / "general_notes.csv"
REPORT_JSON = ROOT / "reports" / "zukan_ocr_note_cleanup_report.json"
TARGET_REFERENCES = {
    "日本産蛾類標準図鑑1",
    "日本産蛾類標準図鑑2",
    "日本産蛾類標準図鑑3",
}

HOST_LABEL_VARIANTS = [
    "寄主植物",
    "寄主物",
    "主植物",
    "主物",
    "主権物",
    "主種物",
    "主着物",
    "主福物",
    "主■物",
    "荷主物",
    "荷主権物",
    "荷主種物",
    "奇主物",
    "容主植物",
    "容主物",
    "容主権物",
    "森主物",
]

SPECIFIC_OVERRIDES = {
    "note-1002208": "年1化の春の蛾であるが、地域によっては4月頃から7月上旬くらいまで見られる。蛹で越冬し、各地に多産する。",
    "note-1002281": "3～4月に出現する春の蛾で、蛹で越冬する。場所によっては5～6月に得られる。",
    "note-1002460": "年2化。関東地方周辺では前種より低標高の低山地から産する。",
    "note-1002523": "非常にまれな種で、神奈川県、愛知県、三重県、愛媛県、徳島県、熊本県で5～6月に数頭が得られているだけである。",
    "note-1002836": "10月に出現し、成虫で越冬するので翌春にも得られる。まれな種である。",
}

DIRECT_REPLACEMENTS = [
    ("。；", "。"),
    ("。、", "。"),
    ("ほほ1年中", "ほぼ1年中"),
    ("ほま1年中", "ほぼ1年中"),
    ("ほは1年中", "ほぼ1年中"),
    ("麺化", "蛹化"),
    ("麺する", "蛹化する"),
    ("麺で", "蛹で"),
    ("超する", "越冬する"),
    ("進する", "越冬する"),
    ("現化する", "出現する"),
    ("関年", "周年"),
    ("観体", "個体"),
    ("ま れ", "まれ"),
    ("；", "、"),
    ("糸の上で感する", "糸の上で蛹化する"),
    ("翌にも得られる", "翌春にも得られる"),
    ("本にも越冬した個体", "春にも越冬した個体"),
    ("汚張した製体", "越冬した個体"),
    ("汚した観体", "越冬した個体"),
    ("［奇主物〕", "［寄主植物］"),
]

REGEX_REPLACEMENTS = [
    (re.compile(r"(?<=\d)\.(?=\d)"), "月、"),
    (re.compile(r"(?<=\d),(?=\d)"), "月、"),
    (re.compile(r"(?<=\d)~(?=\d)"), "～"),
    (re.compile(r"(^|[。．、，\s])年化(?=[ 　]*\d)"), r"\1年1化で"),
    (re.compile(r"年化で"), "年1化で"),
    (re.compile(r"(^|[。．、，\s])年([1-9])(?=(?:[0-9][～\-月]))"), r"\1年\2化で"),
    (re.compile(r"([卵成虫幼虫若齢幼虫終齢幼虫亜終齢幼虫蛹])で感する"), r"\1で越冬する"),
    (re.compile(r"若齢効由で感する"), "若齢幼虫で越冬する"),
    (re.compile(r"成虫で感し"), "成虫で越冬し"),
    (re.compile(r"終齢幼虫で地、"), "終齢幼虫で越冬し、"),
    (re.compile(r"幼虫地、"), "幼虫で越冬し、"),
    (re.compile(r"蛹で越冬するこ\s*と"), "蛹で越冬すること"),
    (re.compile(r"成虫で越冬するので[、,]?(?:本|春)にも越冬した個体"), "成虫で越冬するので、春にも越冬した個体"),
    (re.compile(r"[（(［\[]?\s*分類[）)］\]]?.*$"), ""),
]

SUSPICIOUS_PATTERNS = {
    "超する": re.compile(r"超する"),
    "感する": re.compile(r"感する"),
    "進する": re.compile(r"進する"),
    "現化する": re.compile(r"現化する"),
    "年化で": re.compile(r"年化で"),
    "figure_noise": re.compile(r"(?:Fig|Fa Esaf|交尾8|C insolia|Cleora)"),
    "trailing_partial_bracket": re.compile(r"[［【]\s*(?:寄|主|容)?\s*$"),
    "bad_host_label": re.compile(r"(?:主権物|主種物|主着物|荷主物|奇主物|容主物|容主権物|森主物)"),
}


def normalize_host_labels(text: str) -> str:
    variants = "|".join(sorted((re.escape(v) for v in HOST_LABEL_VARIANTS), key=len, reverse=True))
    pattern = re.compile(
        rf"(?:(?<=^)|(?<=[。．、，\s]))[（(\[［【]?\s*(?:[国園商春荷奇容森海各※])?(?:{variants})\s*[】］\])）〕]?"
    )
    return pattern.sub("［寄主植物］", text)


def clean_text(text: str) -> str:
    text = text.replace("\u3000", " ")
    text = text.replace("‥", "…")
    text = text.replace("；", "、")

    for old, new in DIRECT_REPLACEMENTS:
        text = text.replace(old, new)

    text = normalize_host_labels(text)

    for pattern, replacement in REGEX_REPLACEMENTS:
        text = pattern.sub(replacement, text)

    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"(?<=[ぁ-んァ-ヶ一-龠々])\s+(?=[ぁ-んァ-ヶ一-龠々])", "", text)
    text = re.sub(r"年([1-9])化で\s+", r"年\1化で", text)
    text = re.sub(r"\s+([。．、，」』】］）])", r"\1", text)
    text = re.sub(r"([「『【［（])\s+", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[［【]\s*(?:寄|主|容)?\s*$", "", text).strip()
    text = re.sub(r"[、,]\s*$", "。", text)

    return text


def suspicious_counts(rows):
    counts = {}
    for name, pattern in SUSPICIOUS_PATTERNS.items():
        counts[name] = 0
        for row in rows:
            if row["reference"] not in TARGET_REFERENCES or row["note_type"] != "生態情報":
                continue
            if pattern.search(row["content"]):
                counts[name] += 1
    return counts


def load_rows():
    with NOTES_CSV.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def write_rows(rows):
    with NOTES_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["record_id", "insect_id", "note_type", "content", "reference", "page", "year"],
        )
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = load_rows()
    before_counts = suspicious_counts(rows)
    changed = []

    for row in rows:
        if row["reference"] not in TARGET_REFERENCES or row["note_type"] != "生態情報":
            continue

        original = row["content"]
        if row["record_id"] in SPECIFIC_OVERRIDES:
            updated = SPECIFIC_OVERRIDES[row["record_id"]]
        else:
            updated = clean_text(original)

        if updated != original:
            row["content"] = updated
            changed.append(
                {
                    "record_id": row["record_id"],
                    "insect_id": row["insect_id"],
                    "reference": row["reference"],
                    "before": original,
                    "after": updated,
                }
            )

    write_rows(rows)
    after_counts = suspicious_counts(rows)
    REPORT_JSON.write_text(
        json.dumps(
            {
                "changed_count": len(changed),
                "before_counts": before_counts,
                "after_counts": after_counts,
                "changed": changed[:400],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"changed={len(changed)}")
    print(json.dumps({"before": before_counts, "after": after_counts}, ensure_ascii=False))
    print(f"wrote {REPORT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
