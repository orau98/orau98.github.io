#!/usr/bin/env python3
"""macOS Vision OCR でスキャンPDFからテキストを抽出し、テキスト埋め込みPDFを生成する。

Usage:
    python scripts/ocr_scanned_pdf.py pdfs/ga-tsushin/ --output pdfs/ga-tsushin-ocr/
    python scripts/ocr_scanned_pdf.py pdfs/ga-tsushin/jhj200.pdf --output pdfs/ga-tsushin-ocr/
    python scripts/ocr_scanned_pdf.py pdfs/ga-tsushin/ --range 101-150 --output pdfs/ga-tsushin-ocr/

テキスト埋め込み済みPDFはスキップされる（303-305号など）。
出力はページごとのテキストファイル（extract_from_pdf.pyと互換）。
"""

import argparse
import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF
import objc
import Vision
from Foundation import NSURL, NSData
from Quartz import (
    CGImageSourceCreateWithData,
    CGImageSourceCreateImageAtIndex,
)


def has_text(pdf_path: Path, sample_pages: int = 3) -> bool:
    """PDFにテキストレイヤーがあるか判定"""
    try:
        doc = fitz.open(str(pdf_path))
        for i in range(min(sample_pages, len(doc))):
            if doc[i].get_text().strip():
                doc.close()
                return True
        doc.close()
    except Exception:
        pass
    return False


def ocr_image_data(image_bytes: bytes) -> str:
    """macOS Vision frameworkでOCR実行"""
    ns_data = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    img_source = CGImageSourceCreateWithData(ns_data, None)
    if not img_source:
        return ""
    cg_image = CGImageSourceCreateImageAtIndex(img_source, 0, None)
    if not cg_image:
        return ""

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(
        cg_image, None
    )
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["ja", "en"])
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)

    success = handler.performRequests_error_([request], None)
    if not success[0]:
        return ""

    lines = []
    for obs in request.results() or []:
        candidate = obs.topCandidates_(1)
        if candidate and len(candidate) > 0:
            lines.append(candidate[0].string())
    return "\n".join(lines)


def ocr_pdf(pdf_path: Path) -> list[dict]:
    """PDF全ページをOCRしてテキストを返す"""
    doc = fitz.open(str(pdf_path))
    pages = []
    total = len(doc)

    for page_num in range(total):
        page = doc[page_num]
        # ページを画像にレンダリング（150 DPI: 速度と精度のバランス）
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        text = ocr_image_data(img_bytes)
        pages.append({
            "page": page_num + 1,
            "text": text,
            "chars": len(text),
        })
        status = f"  p.{page_num + 1}/{total}: {len(text)} chars"
        print(status, end="\r", flush=True)

    doc.close()
    print()  # newline after progress
    return pages


def save_as_text(pages: list[dict], output_path: Path):
    """ページテキストを結合してテキストファイルとして保存"""
    parts = []
    for p in pages:
        parts.append(f"--- ページ {p['page']} ---")
        parts.append(p["text"])
    output_path.write_text("\n\n".join(parts), encoding="utf-8")


def extract_issue_number(filename: str) -> int | None:
    """ファイル名から号数を抽出"""
    m = re.search(r"(\d+(?:-\d+)?)", filename)
    return int(m.group(1).split("-")[0]) if m else None


def main():
    parser = argparse.ArgumentParser(description="macOS Vision OCR for scanned PDFs")
    parser.add_argument("target", help="PDF file or directory")
    parser.add_argument("--output", "-o", default="pdfs/ga-tsushin-ocr",
                        help="Output directory for OCR text files")
    parser.add_argument("--range", "-r", default=None,
                        help="Issue number range filter, e.g., 101-150")
    parser.add_argument("--dpi", type=int, default=150,
                        help="Render DPI (default: 150)")
    parser.add_argument("--force", action="store_true",
                        help="Re-OCR even if output exists")
    args = parser.parse_args()

    target = Path(args.target)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Range filter
    range_min, range_max = 0, 999999
    if args.range:
        parts = args.range.split("-")
        range_min = int(parts[0])
        range_max = int(parts[1]) if len(parts) > 1 else range_min

    # Collect PDFs
    if target.is_file():
        pdfs = [target]
    elif target.is_dir():
        pdfs = sorted(target.glob("*.pdf"))
    else:
        print(f"エラー: {target} が見つかりません")
        sys.exit(1)

    # Filter by range
    filtered = []
    for pdf in pdfs:
        issue = extract_issue_number(pdf.stem)
        if issue is not None and range_min <= issue <= range_max:
            filtered.append(pdf)

    print(f"対象: {len(filtered)}件のPDF (range: {range_min}-{range_max})")

    # Progress tracking
    progress_file = output_dir / "ocr_progress.json"
    progress = {}
    if progress_file.exists():
        progress = json.loads(progress_file.read_text(encoding="utf-8"))

    skipped_text = 0
    skipped_done = 0
    processed = 0
    total_chars = 0

    for pdf_path in filtered:
        name = pdf_path.name
        txt_output = output_dir / f"{pdf_path.stem}.txt"

        # Skip if already OCR'd
        if not args.force and name in progress and progress[name].get("status") == "done":
            skipped_done += 1
            continue

        # Skip text PDFs (303-305 etc.)
        if has_text(pdf_path):
            print(f"  {name}: テキスト埋め込み済み — スキップ")
            progress[name] = {"status": "has_text"}
            skipped_text += 1
            continue

        print(f"  {name}: OCR処理中...")
        try:
            pages = ocr_pdf(pdf_path)
            char_count = sum(p["chars"] for p in pages)
            save_as_text(pages, txt_output)
            progress[name] = {
                "status": "done",
                "pages": len(pages),
                "chars": char_count,
                "output": str(txt_output),
            }
            processed += 1
            total_chars += char_count
            print(f"  {name}: 完了 ({len(pages)}ページ, {char_count:,}文字)")
        except Exception as e:
            print(f"  {name}: エラー — {e}")
            progress[name] = {"status": "error", "message": str(e)}

        # Save progress after each file
        progress_file.write_text(
            json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # Final summary
    print(f"\n完了: OCR={processed}件, スキップ(テキスト済)={skipped_text}件, "
          f"スキップ(処理済)={skipped_done}件, 合計文字数={total_chars:,}")
    progress_file.write_text(
        json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
