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
TARGET_NOTE_TYPES = {
    "生態情報",
    "出現時期",
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
    "note-1001510": "4月末～5月頃にかけて、成虫は年1回出現する。［寄主植物］ムラサキハシドイ（モクセイ科）、ヨーロッパではカシ類（ブナ科）、ヤナギ類（ヤナギ科）を好むという。",
    "note-1002179": "5月から9月まで見られるので、地域によって年2～3化し、蛹で越冬すると推定される。ヤナギ類の多い河川敷や、湿性環境に多い。",
    "note-1003019": "6～7月に出現する。山地で得られるがあまり多くない。冬は蛹と推定されている。",
    "note-1003477": "四国、九州などでは年2～3化と推定されるが、沖縄島や西表島では12月から1月にかけても発生しており、周年経過は明らかではない。南西諸島には多産する。",
    "note-1003735": "3月から9月に記録がある。年2～3化と思われる。［寄主植物］日本では未知、国外ではモクセイ科で記録がある。",
    "note-1001285": "年1化で7～8月に出現し、幼虫で越冬。北海道では低地にも生息するが、本州以南では主として1000m以上の山地に産する。［寄主植物］パンダイキノリ、コフキイバラキノリ（以上サルオガセ科）。ヨーロッパで地衣類につくことは古くから知られている。",
    "note-1001295": "年1化。灯火に飛来した♀を見る機会はそれほどまれではない。",
    "note-1001613": "早春の蛾で、2月下旬～3月下旬に出現する。成虫と幼虫の静止姿勢は前種と同様。かつては各地でクワ（クワ科）の害虫であったが、養蚕業の衰退とともに数が減り、本種は得がたい種になった。",
    "note-1001616": "春の蛾で、3月に出現する。沖縄島では5月までに土中で蛹化し、そのまま越冬する。♀が灯火に飛来することはまれである。",
    "note-1003457": "本種の成虫は静止するとき、前翅を頭方に上げて後翅との間を空ける特異な姿勢をとる。暖かい施設ではほぼ1年中成虫が見られる。",
    "note-1005360": "新潟県の低山地では5～6月に幼虫が見られ、6～7月に羽化するので、年1化で、おそらく若齢幼虫で越冬するものと推定している。",
    "note-1005362": "地域によっては4月から出現し、10月頃まで見られるので、年2～3化するものと思われる。越冬は蛹。各地に普通に産する。",
    "note-1005366": "地域によって発生期は異なる。奄美大島、沖縄島では、3～4月、8～9月、10～11月に得られており、年2～3化する。",
    "note-1005374": "地域によって年1～2化し、蛹で越冬する。本属の他種に比べやや少ない。",
    "note-1005375": "新潟県の低山地では、4～5月と7～8月に出現し、蛹で越冬する。幼虫は、前種に比べ黄色みが強く、背面の斑紋にも違いがあるので、外観で区別できる。また、上唇中央の切れ込みが浅いという。針葉樹食幼虫の特徴をそなえている。",
    "note-1005376": "4月から9月頃まで見られ、年に2～3化。蛹で越冬し、各地に普通である。",
    "note-1005378": "関東地方以西では年2化し、5～6月と8～9月に出現する。中部山地では7～8月に見られ、おそらく年1化。越冬態は未確認だが、幼虫越冬の可能性が高い。",
    "note-1005380": "ほぼ年2化し、5～6月と8～9月に出現するが、北海道では7～8月発生の1化かもしれない。幼虫越冬。",
    "note-1005383": "早春の蛾で、2月下旬～3月下旬に出現するが、沖縄島では1月下旬から発生している。前2種と異なり口吻が発達しており、山口市で夜間、アセビ（ツツジ科）やヒサカキ（サカキ科）の花に吸蜜に訪れているのが観察されている。成虫と幼虫の静止姿勢は前2種と同様である。",
    "note-1005384": "年1化で10～11月に出現する秋の蛾で、地域によっては12月中旬頃まで見られる。卵越冬。♀が灯火に飛来することは少ない。茶園の害虫として知られていたが、近年は被害を聞かない。各地に普通に産する。",
    "note-1005385": "栃木県鹿沼市では、5月と7月に成虫の発生が確認されており、年2化。ただし、地域によっては年1化の可能性もある。全国に分布するが、産地は比較的限られている。",
    "note-1005386": "3月と8月を中心に採集されているが、徳之島で6月、石垣島では12月にも得られている。このことから年2～3化の発生だと考えられている。♂は灯火によく飛来するが、♀が飛来することは稀である。",
    "note-1005388": "4～10月に見られ、年2～3化するものと思われる。蛹で越冬する。各地に多産する。",
    "note-1003529": "前種と同様に3月下旬から4月にかけてあらわれる。蛹で越冬し、普通種であるが、♀が灯火に飛来することは少ない。［寄主植物］多食性で多くの広葉樹から幼虫が得られている。",
    "note-1005457": "おそらく年2～3化、3～10月に採集されているが、非常に少ない。",
    "note-1005462": "年2化し、4～5月と7～8月の2回出現する。山地に産するが、あまり多くはなく、特に♀は得難い。蛹で越冬する。",
    "note-1005464": "年1～2化。5～8月に出現する。老熟幼虫は食物から降り、落葉の中で繭をつくって蛹で越冬する。",
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
    ("新県", "新潟県"),
    ("地冬", "越冬"),
    ("静止変券", "静止姿勢"),
    ("変券をとる", "姿勢をとる"),
    ("曲現", "出現"),
    ("飛来した子を見る機会", "飛来した♀を見る機会"),
    ("子が火に飛来することは少ない", "♀が灯火に飛来することは少ない"),
    ("早が火に飛来することが少ない", "♀が灯火に飛来することが少ない"),
    ("子か出火に飛来することは少ない", "♀が灯火に飛来することは少ない"),
    ("子が水に飛来することはまれである", "♀が灯火に飛来することはまれである"),
    ("子は得嫌い", "♀は得難い"),
    ("比較的取られている", "比較的限られている"),
    ("モクセイ料", "モクセイ科"),
    ("ブナ料", "ブナ科"),
    ("ヤナギ料", "ヤナギ科"),
    ("ヤナギ期", "ヤナギ類"),
    ("ツツジ料", "ツツジ科"),
    ("サカキ料", "サカキ科"),
    ("トウダイグサ料", "トウダイグサ科"),
    ("キク料", "キク科"),
    ("タア料", "タデ科"),
    ("ヒルガオ料", "ヒルガオ科"),
    ("クワ料", "クワ科"),
    ("ミカン料", "ミカン科"),
    ("クスノキ料", "クスノキ科"),
    ("ムクロジ料", "ムクロジ科"),
    ("フトモモ料", "フトモモ科"),
    ("マメ料", "マメ科"),
    ("アオイ料", "アオイ科"),
    ("クルミ料", "クルミ科"),
    ("ツバキ料", "ツバキ科"),
    ("ニレ料", "ニレ科"),
    ("ナデシコ料", "ナデシコ科"),
    ("オシダ料", "オシダ科"),
    ("センダン料", "センダン科"),
    ("マツ料", "マツ科"),
    ("サルオガ七料", "サルオガセ科"),
]

REGEX_REPLACEMENTS = [
    (re.compile(r"(?<=\d)\.(?=\d)"), "月、"),
    (re.compile(r"(?<=\d),(?=\d)"), "月、"),
    (re.compile(r"(?<=\d)~(?=\d)"), "～"),
    (re.compile(r"(?<=\d)-(?=\d)"), "～"),
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
    "ocr_variants": re.compile(r"(?:鍋体|使え島|早が火|子が火|子か出火|魅冬|沖縄店|■年経通|取られている|得嫌い|顔をつくって)"),
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
            if row["reference"] not in TARGET_REFERENCES or row["note_type"] not in TARGET_NOTE_TYPES:
                continue
            if pattern.search(row["content"]):
                counts[name] += 1
    return counts


def load_rows():
    with NOTES_CSV.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def write_rows(headers, rows):
    with NOTES_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def main():
    headers, rows = load_rows()
    before_counts = suspicious_counts(rows)
    changed = []

    for row in rows:
        if row["reference"] not in TARGET_REFERENCES or row["note_type"] not in TARGET_NOTE_TYPES:
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

    write_rows(headers, rows)
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
