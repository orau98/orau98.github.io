#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
from pathlib import Path


def normalize(text: str) -> str:
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("［", "[").replace("］", "]")
    text = text.replace("　", " ")
    return text.strip()


def key(text: str) -> str:
    text = normalize(text)
    return re.sub(r"[\s\[\]【】()（）:：,.、。・/／'\"-]", "", text)


def line_column(x: float) -> int:
    if x < 0.22:
        return 0
    if x < 0.48:
        return 1
    if x < 0.74:
        return 2
    return 3


def is_title_like(text: str) -> bool:
    if len(text) > 18:
        return False
    if any(token in text for token in ("図版", "開張", "分布", "寄主", "荷主", "生態", "生期", "分類", "mm", "月", "国外")):
        return False
    if re.search(r"[A-Za-z]", text):
        return False
    if re.search(r"[:：\[\]【】()（）]", text):
        return False
    return bool(re.search(r"[ァ-ヶ一-龠々]{4,}", text))


def load_pages(jsonl_path: Path):
    pages = {}
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        image = Path(obj["path"])
        m = re.search(r"p-(\d+)\.png$", image.name)
        if not m:
            continue
        page = int(m.group(1))
        lines = []
        for raw in obj.get("lines", []):
            text = normalize(raw["text"])
            if not text:
                continue
            lines.append(
                {
                    "text": text,
                    "key": key(text),
                    "x": float(raw["x"]),
                    "y": float(raw["y"]),
                    "width": float(raw["width"]),
                    "height": float(raw["height"]),
                    "column": line_column(float(raw["x"])),
                }
            )
        pages[page] = {
            "image": image,
            "width": int(obj["imageWidth"]),
            "height": int(obj["imageHeight"]),
            "lines": sorted(lines, key=lambda row: (-row["y"], row["x"])),
        }
    return pages


def find_anchor(lines, target_name: str):
    target_key = key(target_name)
    best = None
    for line in lines:
        score = 0
        if line["key"] == target_key:
            score = 100
        elif target_key and target_key in line["key"]:
            score = 50
        elif line["key"] and line["key"] in target_key and len(line["key"]) >= 4:
            score = 20
        if score == 0:
            continue
        if best is None or score > best[0]:
            best = (score, line)
    return best[1] if best else None


def block_bounds(lines, anchor):
    same_col = [line for line in lines if line["column"] == anchor["column"]]
    titles = [line for line in same_col if is_title_like(line["text"])]
    lower_titles = [line for line in titles if line["y"] < anchor["y"] - 0.01]
    upper_titles = [line for line in titles if line["y"] > anchor["y"] + 0.01]
    next_y = max((line["y"] for line in lower_titles), default=0.0)
    prev_y = min((line["y"] for line in upper_titles), default=1.0)
    block = [line for line in same_col if next_y < line["y"] <= prev_y]
    min_x = min(line["x"] for line in block)
    max_x = max(line["x"] + line["width"] for line in block)
    max_y = max(line["y"] + line["height"] for line in block)
    min_y = min(line["y"] for line in block)
    return min_x, min_y, max_x, max_y


def crop(image_path: Path, image_w: int, image_h: int, bounds, out_path: Path):
    min_x, min_y, max_x, max_y = bounds
    left = max(0, int(min_x * image_w) - 40)
    right = min(image_w, int(max_x * image_w) + 40)
    top = max(0, int((1 - max_y) * image_h) - 40)
    bottom = min(image_h, int((1 - min_y) * image_h) + 40)
    crop_w = right - left
    crop_h = bottom - top
    out_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "sips",
            "-c",
            str(crop_h),
            str(crop_w),
            "--cropOffset",
            str(top),
            str(left),
            str(image_path),
            "--out",
            str(out_path),
        ],
        check=True,
        capture_output=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jsonl", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("targets", nargs="+", help="page:name")
    args = parser.parse_args()

    pages = load_pages(Path(args.jsonl))
    out_dir = Path(args.out_dir)

    for target in args.targets:
        page_s, name = target.split(":", 1)
        page = int(page_s)
        page_data = pages[page]
        anchor = find_anchor(page_data["lines"], name)
        if not anchor:
            print(f"MISS\t{page}\t{name}")
            continue
        bounds = block_bounds(page_data["lines"], anchor)
        safe_name = re.sub(r"[^\w一-龠ぁ-んァ-ヶー]+", "_", name)
        out = out_dir / f"p{page:03d}_{safe_name}.png"
        crop(page_data["image"], page_data["width"], page_data["height"], bounds, out)
        print(f"OK\t{page}\t{name}\t{out}")


if __name__ == "__main__":
    main()
