#!/usr/bin/env python3
"""蛾類通信PDFの一括ダウンロード

No.1〜305を自動ダウンロード。
- No.1-99:  インデックスページからリンクを取得（合併号対応）
- No.101-305: URLパターンで直接生成
- 保存先: pdfs/ga-tsushin/
- 1ファイルごとに1秒待機
- ダウンロード済みファイルはスキップ
- 失敗URLは reports/download_errors.txt に記録
"""

import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SAVE_DIR = ROOT / "pdfs" / "ga-tsushin"
REPORTS_DIR = ROOT / "reports"
ERROR_LOG = REPORTS_DIR / "download_errors.txt"

BASE_URL = "http://publ.moth.jp/tsushin/"

# No.1-99 はインデックスページからリンク取得
INDEX_URL_1_99 = f"{BASE_URL}1-99/"

# No.101-305 のURL範囲とパターン
RANGES = [
    (101, 150, f"{BASE_URL}101-150/", "jhj"),
    (151, 200, f"{BASE_URL}151-200/", "jhj"),
    (201, 250, f"{BASE_URL}201-250/", "jhj"),
    (251, 300, f"{BASE_URL}251-300/", "jhj"),
    (301, 305, f"{BASE_URL}301-350/", "jhj"),
]

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; insect-hostplant-db/1.0)"
})

TIMEOUT = 30


def ensure_dirs():
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def log_error(url: str, reason: str):
    with open(ERROR_LOG, "a", encoding="utf-8") as f:
        f.write(f"{url}\t{reason}\n")


def download_file(url: str, dest: Path) -> bool:
    """URLからファイルをダウンロード。成功でTrue。"""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  スキップ（既存）: {dest.name}")
        return True
    try:
        resp = SESSION.get(url, timeout=TIMEOUT)
        if resp.status_code == 200 and len(resp.content) > 100:
            dest.write_bytes(resp.content)
            print(f"  ダウンロード完了: {dest.name} ({len(resp.content):,} bytes)")
            return True
        else:
            reason = f"HTTP {resp.status_code}, size={len(resp.content)}"
            print(f"  失敗: {dest.name} — {reason}")
            log_error(url, reason)
            return False
    except Exception as e:
        reason = str(e)
        print(f"  エラー: {dest.name} — {reason}")
        log_error(url, reason)
        return False


def scrape_1_99():
    """No.1-99: インデックスページをスクレイピングしてPDFリンクを取得"""
    print("=== No.1-99: インデックスページからリンク取得 ===")
    try:
        resp = SESSION.get(INDEX_URL_1_99, timeout=TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        print(f"インデックスページ取得失敗: {e}")
        log_error(INDEX_URL_1_99, f"index page error: {e}")
        # フォールバック: パターンで試行
        print("フォールバック: jhs{N}.pdf パターンで試行")
        for n in range(1, 100):
            url = f"{INDEX_URL_1_99}jhs{n}.pdf"
            dest = SAVE_DIR / f"jhs{n}.pdf"
            download_file(url, dest)
            time.sleep(1)
        return

    soup = BeautifulSoup(resp.content, "html.parser")
    pdf_links = set()
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if href.lower().endswith(".pdf"):
            full_url = urljoin(INDEX_URL_1_99, href)
            pdf_links.add(full_url)

    if not pdf_links:
        print("PDFリンクが見つかりません。パターンでフォールバック。")
        for n in range(1, 100):
            url = f"{INDEX_URL_1_99}jhs{n}.pdf"
            dest = SAVE_DIR / f"jhs{n}.pdf"
            download_file(url, dest)
            time.sleep(1)
        return

    print(f"  {len(pdf_links)}件のPDFリンクを検出")
    for url in sorted(pdf_links):
        filename = url.split("/")[-1]
        dest = SAVE_DIR / filename
        download_file(url, dest)
        time.sleep(1)


def download_range(start: int, end: int, base_url: str, prefix: str):
    """指定範囲の号をURLパターンでダウンロード"""
    print(f"\n=== No.{start}-{end}: {base_url} ===")
    for n in range(start, end + 1):
        url = f"{base_url}{prefix}{n}.pdf"
        dest = SAVE_DIR / f"{prefix}{n}.pdf"
        download_file(url, dest)
        time.sleep(1)


def main():
    ensure_dirs()

    # エラーログを初期化
    ERROR_LOG.write_text("", encoding="utf-8")

    print(f"保存先: {SAVE_DIR}")
    print(f"エラーログ: {ERROR_LOG}\n")

    # No.1-99
    scrape_1_99()

    # No.101-305
    for start, end, base_url, prefix in RANGES:
        download_range(start, end, base_url, prefix)

    # 結果サマリー
    downloaded = list(SAVE_DIR.glob("*.pdf"))
    errors = ERROR_LOG.read_text(encoding="utf-8").strip().split("\n")
    error_count = len([e for e in errors if e])
    print(f"\n=== 完了 ===")
    print(f"ダウンロード済みPDF: {len(downloaded)}件")
    print(f"エラー: {error_count}件")
    if error_count > 0:
        print(f"エラー詳細: {ERROR_LOG}")


if __name__ == "__main__":
    main()
