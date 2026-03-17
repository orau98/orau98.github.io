#!/usr/bin/env python3
"""PDFから昆虫情報を抽出（Claude APIで構造化解析）

引数: PDFファイルパスまたはフォルダパス
出力: reports/extracted_candidates.json（デフォルト）

コスト最適化:
  - ページレベルキーワード事前フィルタ（入力 -40〜50%）
  - Prompt Caching（システムプロンプト -90%）
  - 小PDFバッチ結合（API呼び出し回数削減）

並列実行対応:
  --output reports/extracted_A.json   出力ファイル指定
  --range 1-100                       号数フィルタ（ファイル名の数字で絞り込み）
  --processed-file reports/proc_A.json 処理済み管理ファイル指定
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
import anthropic

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"

# PDFフォルダの想定構成
PDF_DIRS = {
    "ga-tsushin": "蛾類通信",
    "cho-to-ga": "蝶と蛾",
    "elytra": "Elytra",
    "tsukimushi": "月刊むし",
    "other": "その他",
}

# --- キーワード事前フィルタ ---
RELEVANCE_KEYWORDS = [
    "食草", "寄主", "新記録", "初記録", "新産地", "新称",
    "シノニム", "異名", "和名変更", "学名変更", "食樹", "食餌",
    "幼虫食", "sp. nov.", "syn. nov.", "comb. nov.", "stat. nov.",
    "gen. nov.", "未記録", "日本新", "新種", "新亜種",
]

# --- Claude API 設定 ---
# NOTE: Sonnet の Prompt Caching 最小要件は 1024 tokens。
# 精度向上に役立つ参考情報を含めて閾値を超えるようにしている。
SYSTEM_PROMPT = """\
あなたは日本産昆虫の分類学・食草情報の専門家です。
以下のPDFテキストから、昆虫データベースの更新に関連する情報を抽出してください。

## 対象分類群
鱗翅目（蛾・蝶）、鞘翅目（タマムシ科 Buprestidae、カミキリムシ科 Cerambycidae、ハムシ科 Chrysomelidae）、半翅目（アブラムシ上科 Aphidoidea）。
これら以外の分類群（トンボ目、双翅目、膜翅目など）の情報は抽出不要です。

## 抽出対象（優先順）
1. 食草・寄主植物の新記録 — 「〇〇を食草として確認」「幼虫は〇〇を食す」「寄主植物は〇〇」など
2. 新産地記録 — 「〇〇県初記録」「〇〇島で初めて確認」など
3. 学名の変更・訂正・シノニム — "syn. nov.", "comb. nov.", "stat. nov.", 「〇〇のシノニムとした」など
4. 和名の新称・変更 — 「（新称）」「和名を〇〇に変更」など
5. 日本未記録種の記録 — 「日本未記録」「日本初記録」「日本新記録」など

## 抽出しない情報
- 既知の分布確認（「〇〇県で多産」など新規性のない記録）
- 生態観察のみ（食草・寄主と無関係な行動記録）
- 追悼文、書評、会報、総会記録、正誤表（ただし正誤表に分類学的訂正が含まれる場合は抽出）
- 写真キャプションのみの情報（本文に裏付けがない場合）

## 主要な昆虫科の和名対応（参考）
- ヤガ科 Noctuidae / シャクガ科 Geometridae / メイガ科 Pyralidae
- ツトガ科 Crambidae / ハマキガ科 Tortricidae / キバガ科 Gelechiidae
- シャチホコガ科 Notodontidae / カレハガ科 Lasiocampidae / ヒトリガ科 Arctiidae
- ドクガ科 Erebidae (part) / スズメガ科 Sphingidae / ヒロズコガ科 Tineidae
- セセリチョウ科 Hesperiidae / シジミチョウ科 Lycaenidae / タテハチョウ科 Nymphalidae
- アゲハチョウ科 Papilionidae / シロチョウ科 Pieridae
- カミキリムシ科 Cerambycidae / タマムシ科 Buprestidae / ハムシ科 Chrysomelidae

## 主要な植物科（食草として頻出）
バラ科、ブナ科、クルミ科、ヤナギ科、カバノキ科、ニレ科、クスノキ科、
マメ科、ミカン科、ツバキ科、アカバナ科、マンサク科、イネ科、カヤツリグサ科、
タデ科、キク科、セリ科、ツツジ科、モクセイ科

## 出力形式
以下のJSON形式で返してください:
{
  "items": [
    {
      "japanese_name": "和名（判明する場合）",
      "scientific_name": "学名（判明する場合）",
      "family": "科名（判明する場合）",
      "change_type": "食草追加|新産地|学名変更|和名変更|新記録種|誤り修正",
      "content": "変更内容の簡潔な説明",
      "page": "PDFのページ番号（判明する場合）",
      "article_author": "記事の著者名（姓のみ可、複数著者はカンマ区切り）",
      "publication_year": "出版年（判明する場合）",
      "confidence": "high|medium|low"
    }
  ]
}

## 注意事項
- 確実な情報のみ抽出してください。推測は confidence: "low" としてください。
- 学名・和名は原文のまま正確に転記してください。
- 食草情報は植物名と科名をできるだけ含めてください。
- 各記事の著者名を必ず抽出してください。ページ上部やタイトル直下に記載されています。
- 出版年は号の奥付または表紙に記載されていることが多いです。
- 関連する情報が見つからない場合は空の items を返してください。
- JSONのみを返してください（説明文不要）。
"""

MAX_TEXT_LENGTH = 80000
BATCH_CHAR_LIMIT = 60000  # バッチ結合の上限文字数
BATCH_SINGLE_THRESHOLD = 15000  # これ以下の号はバッチ候補


def ensure_dirs():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def load_json(path: Path) -> dict | list:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_ocr_text(ocr_path: Path, use_filter: bool) -> tuple[str, dict]:
    """OCR済みテキストファイルを読み込み、キーワードフィルタを適用。"""
    raw = ocr_path.read_text(encoding="utf-8")
    # "--- ページ N ---" 区切りでパース
    pages: list[tuple[int, str]] = []
    current_page = 0
    current_lines: list[str] = []
    for line in raw.split("\n"):
        m = re.match(r"^---\s*ページ\s*(\d+)\s*---$", line)
        if m:
            if current_page and current_lines:
                pages.append((current_page, "\n".join(current_lines)))
            current_page = int(m.group(1))
            current_lines = []
        else:
            current_lines.append(line)
    if current_page and current_lines:
        pages.append((current_page, "\n".join(current_lines)))

    # テキストがないページを除外
    pages = [(n, t) for n, t in pages if t.strip()]
    total_pages = len(pages)
    total_chars = sum(len(t) for _, t in pages)

    if not use_filter or not pages:
        full_text = "\n\n".join(f"--- ページ {n} ---\n{t}" for n, t in pages)
        return full_text, {
            "total_pages": total_pages, "total_chars": total_chars,
            "relevant_pages": total_pages, "relevant_chars": total_chars,
            "reduction_pct": 0,
        }

    # キーワードフィルタ
    hit_indices: set[int] = set()
    for i, (_, text) in enumerate(pages):
        if any(kw in text for kw in RELEVANCE_KEYWORDS):
            hit_indices.add(i)
    if not hit_indices:
        return "", {
            "total_pages": total_pages, "total_chars": total_chars,
            "relevant_pages": 0, "relevant_chars": 0, "reduction_pct": 100,
        }
    context_indices: set[int] = set()
    for i in hit_indices:
        for offset in (-1, 0, 1):
            idx = i + offset
            if 0 <= idx < len(pages):
                context_indices.add(idx)
    selected = sorted(context_indices)
    text_parts = [f"--- ページ {pages[i][0]} ---\n{pages[i][1]}" for i in selected]
    filtered_text = "\n\n".join(text_parts)
    relevant_chars = len(filtered_text)
    reduction_pct = round((1 - relevant_chars / total_chars) * 100) if total_chars else 0
    return filtered_text, {
        "total_pages": total_pages, "total_chars": total_chars,
        "relevant_pages": len(selected), "relevant_chars": relevant_chars,
        "reduction_pct": reduction_pct,
    }


def extract_relevant_text_from_pdf(pdf_path: Path, use_filter: bool = True, ocr_dir: Path | None = None) -> tuple[str, dict]:
    """PDFからテキスト抽出し、キーワードフィルタを適用。

    OCRテキストファイルが ocr_dir に存在する場合はそちらを優先使用する。

    Returns:
        (filtered_text, stats) — stats は {"total_pages", "total_chars",
        "relevant_pages", "relevant_chars", "reduction_pct"}
    """
    # OCRテキストファイルがあれば優先使用
    if ocr_dir:
        ocr_txt = ocr_dir / f"{pdf_path.stem}.txt"
        if ocr_txt.exists():
            return _load_ocr_text(ocr_txt, use_filter)

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        print(f"  PDF読み取りエラー: {pdf_path.name} — {e}")
        return "", {"total_pages": 0, "total_chars": 0,
                    "relevant_pages": 0, "relevant_chars": 0, "reduction_pct": 0}

    # 全ページのテキストを抽出
    pages: list[tuple[int, str]] = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        if text.strip():
            pages.append((page_num, text))
    doc.close()

    total_pages = len(pages)
    total_chars = sum(len(t) for _, t in pages)

    if not use_filter or not pages:
        # フィルタなし: 全ページ返却
        full_text = "\n\n".join(f"--- ページ {n} ---\n{t}" for n, t in pages)
        return full_text, {
            "total_pages": total_pages, "total_chars": total_chars,
            "relevant_pages": total_pages, "relevant_chars": total_chars,
            "reduction_pct": 0,
        }

    # キーワードにヒットするページ番号を特定
    hit_page_indices: set[int] = set()
    for i, (_, text) in enumerate(pages):
        if any(kw in text for kw in RELEVANCE_KEYWORDS):
            hit_page_indices.add(i)

    if not hit_page_indices:
        return "", {
            "total_pages": total_pages, "total_chars": total_chars,
            "relevant_pages": 0, "relevant_chars": 0,
            "reduction_pct": 100,
        }

    # ヒットページの前後1ページもコンテキストとして含める
    context_indices: set[int] = set()
    for i in hit_page_indices:
        for offset in (-1, 0, 1):
            idx = i + offset
            if 0 <= idx < len(pages):
                context_indices.add(idx)

    # フィルタ適用
    selected = sorted(context_indices)
    text_parts = []
    for i in selected:
        page_num, text = pages[i]
        text_parts.append(f"--- ページ {page_num} ---\n{text}")

    filtered_text = "\n\n".join(text_parts)
    relevant_chars = len(filtered_text)
    reduction_pct = round((1 - relevant_chars / total_chars) * 100) if total_chars else 0

    return filtered_text, {
        "total_pages": total_pages,
        "total_chars": total_chars,
        "relevant_pages": len(selected),
        "relevant_chars": relevant_chars,
        "reduction_pct": reduction_pct,
    }


def detect_issue_number(pdf_path: Path) -> str:
    name = pdf_path.stem
    m = re.search(r"(\d+(?:-\d+)?)", name)
    return m.group(1) if m else name


def detect_source_name(pdf_path: Path) -> str:
    parent = pdf_path.parent.name
    return PDF_DIRS.get(parent, parent)


def extract_first_number(filename: str) -> int | None:
    m = re.search(r"(\d+)", filename)
    return int(m.group(1)) if m else None


def analyze_with_claude(text: str, source_file: str, source_name: str,
                        issue_number: str, client: anthropic.Anthropic) -> list:
    """Claude APIでテキストを解析。Prompt Caching 対応。"""
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH] + "\n\n（以降省略）"

    user_prompt = f"""\
以下は「{source_name}」第{issue_number}号（ファイル: {source_file}）のテキストです。
昆虫データベースの更新に関連する情報を抽出してください。

{text}
"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            # Prompt Caching: システムプロンプトをキャッシュ
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text.strip()

        # キャッシュ統計ログ
        usage = response.usage
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        cache_create = getattr(usage, "cache_creation_input_tokens", 0) or 0
        if cache_read:
            print(f"  [cache] hit: {cache_read} tokens cached")
        elif cache_create:
            print(f"  [cache] created: {cache_create} tokens")

        # JSON抽出
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        result = json.loads(content)
        items = result.get("items", [])

        for item in items:
            item["source_file"] = source_file
            item["source_name"] = source_name
            item["issue_number"] = issue_number

        return items

    except json.JSONDecodeError as e:
        print(f"  JSON解析エラー: {e}")
        print(f"  レスポンス: {content[:200]}")
        return []
    except anthropic.RateLimitError as e:
        # 429: リトライ（最大3回、指数バックオフ）
        for attempt in range(1, 4):
            wait = 60 * attempt
            print(f"  レートリミット: {wait}秒待機してリトライ ({attempt}/3)...")
            import time; time.sleep(wait)
            try:
                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4096,
                    system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                    messages=[{"role": "user", "content": user_prompt}],
                )
                content = response.content[0].text.strip()
                if content.startswith("```"):
                    content = re.sub(r"^```(?:json)?\s*", "", content)
                    content = re.sub(r"\s*```$", "", content)
                result = json.loads(content)
                items = result.get("items", [])
                for item in items:
                    item["source_file"] = source_file
                    item["source_name"] = source_name
                    item["issue_number"] = issue_number
                return items
            except anthropic.RateLimitError:
                continue
            except Exception as e2:
                print(f"  リトライ失敗: {e2}")
                return []
        print(f"  リトライ上限到達")
        return []
    except anthropic.APIError as e:
        print(f"  Claude APIエラー: {e}")
        return []


def analyze_batch_with_claude(batch: list[dict], client: anthropic.Anthropic) -> list:
    """複数号をまとめて1回のAPI呼び出しで解析。"""
    combined_parts = []
    source_labels = []
    for entry in batch:
        combined_parts.append(
            f"===== {entry['source_name']} 第{entry['issue_number']}号 "
            f"({entry['source_file']}) =====\n{entry['text']}"
        )
        source_labels.append(entry)

    combined_text = "\n\n".join(combined_parts)
    if len(combined_text) > MAX_TEXT_LENGTH:
        combined_text = combined_text[:MAX_TEXT_LENGTH] + "\n\n（以降省略）"

    label = ", ".join(f"{e['source_file']}" for e in batch)

    user_prompt = f"""\
以下は複数号のテキストです。各号から昆虫データベースの更新に関連する情報を抽出してください。
各項目の source_file には該当する号のファイル名を記載してください。

{combined_text}
"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text.strip()

        usage = response.usage
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        if cache_read:
            print(f"  [cache] hit: {cache_read} tokens cached")

        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        result = json.loads(content)
        items = result.get("items", [])

        # source_file がレスポンスにない場合のフォールバック
        known_files = {e["source_file"] for e in batch}
        for item in items:
            sf = item.get("source_file", "")
            if sf not in known_files:
                # issue_number からマッチを試みる
                inum = item.get("issue_number", "")
                for e in batch:
                    if e["issue_number"] == inum:
                        item["source_file"] = e["source_file"]
                        item["source_name"] = e["source_name"]
                        item["issue_number"] = e["issue_number"]
                        break
                else:
                    # バッチ内の最初の号にフォールバック
                    item.setdefault("source_file", batch[0]["source_file"])
                    item.setdefault("source_name", batch[0]["source_name"])
                    item.setdefault("issue_number", batch[0]["issue_number"])

        return items

    except json.JSONDecodeError as e:
        print(f"  JSON解析エラー（バッチ）: {e}")
        return []
    except anthropic.APIError as e:
        print(f"  Claude APIエラー（バッチ）: {e}")
        return []


def collect_pdf_files(target: Path) -> list[Path]:
    if target.is_file() and target.suffix.lower() == ".pdf":
        return [target]
    elif target.is_dir():
        return sorted(target.rglob("*.pdf"))
    else:
        print(f"エラー: {target} はPDFファイルでもフォルダでもありません")
        return []


def filter_by_range(pdf_files: list[Path], range_str: str) -> list[Path]:
    m = re.match(r"(\d+)-(\d+)", range_str)
    if not m:
        print(f"エラー: --range の形式が不正です: {range_str}（例: 1-100）")
        sys.exit(1)
    lo, hi = int(m.group(1)), int(m.group(2))
    return [p for p in pdf_files
            if (n := extract_first_number(p.stem)) is not None and lo <= n <= hi]


def main():
    parser = argparse.ArgumentParser(description="PDFから昆虫情報を抽出")
    parser.add_argument("target",
                        help="PDFファイルパスまたはフォルダパス（例: pdfs/ga-tsushin/）")
    parser.add_argument("--reprocess", action="store_true",
                        help="処理済みファイルも再処理する")
    parser.add_argument("--output", "-o",
                        help="出力JSONファイル（デフォルト: reports/extracted_candidates.json）")
    parser.add_argument("--range", "-r",
                        help="号数範囲フィルタ（例: 1-100, 101-200）")
    parser.add_argument("--processed-file",
                        help="処理済み管理ファイル（並列実行時に分離するため）")
    parser.add_argument("--no-filter", action="store_true",
                        help="キーワード事前フィルタを無効化（デバッグ用）")
    parser.add_argument("--ocr-dir",
                        help="OCR済みテキストディレクトリ（スキャンPDF用）")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("エラー: 環境変数 ANTHROPIC_API_KEY を設定してください。")
        sys.exit(1)

    ensure_dirs()

    output_file = Path(args.output) if args.output else REPORTS_DIR / "extracted_candidates.json"
    if not output_file.is_absolute():
        output_file = ROOT / output_file

    processed_file = (
        Path(args.processed_file) if args.processed_file
        else REPORTS_DIR / "processed_files.json"
    )
    if not processed_file.is_absolute():
        processed_file = ROOT / processed_file

    target = Path(args.target)
    if not target.is_absolute():
        target = ROOT / target

    pdf_files = collect_pdf_files(target)
    if args.range:
        pdf_files = filter_by_range(pdf_files, args.range)
    if not pdf_files:
        print("処理対象のPDFファイルが見つかりません。")
        sys.exit(1)

    processed = load_json(processed_file) if processed_file.exists() else {}
    existing = load_json(output_file) if output_file.exists() else []
    candidates = existing if isinstance(existing, list) else []
    client = anthropic.Anthropic(api_key=api_key)

    if not args.reprocess:
        pdf_files = [p for p in pdf_files if str(p) not in processed]
    if not pdf_files:
        print("すべてのPDFは処理済みです。--reprocess で再処理できます。")
        return

    use_filter = not args.no_filter
    range_label = f" (range: {args.range})" if args.range else ""
    filter_label = " [フィルタON]" if use_filter else " [フィルタOFF]"
    print(f"処理対象: {len(pdf_files)}件のPDF{range_label}{filter_label}")
    print(f"出力先: {output_file}\n")

    # --- Phase 1: テキスト抽出 + フィルタ ---
    entries = []  # (pdf_path, text, stats, source_name, issue_number)
    total_saved_chars = 0

    for pdf_path in pdf_files:
        ocr_dir = Path(args.ocr_dir) if args.ocr_dir else None
        text, stats = extract_relevant_text_from_pdf(pdf_path, use_filter=use_filter, ocr_dir=ocr_dir)

        if use_filter and stats["total_chars"] > 0:
            total_saved_chars += stats["total_chars"] - stats["relevant_chars"]
            print(f"  {pdf_path.name}: {stats['total_pages']}p → {stats['relevant_pages']}p "
                  f"({stats['total_chars']:,}字 → {stats['relevant_chars']:,}字, "
                  f"-{stats['reduction_pct']}%)")

        if not text.strip():
            if stats["relevant_pages"] == 0 and stats["total_pages"] > 0:
                print(f"  {pdf_path.name}: キーワード該当なし — APIスキップ（無料）")
            else:
                print(f"  {pdf_path.name}: テキストなし — スキップ")
            processed[str(pdf_path)] = {"status": "skipped_no_keywords", "items": 0}
            save_json(processed_file, processed)
            continue

        entries.append({
            "pdf_path": pdf_path,
            "text": text,
            "chars": len(text),
            "source_name": detect_source_name(pdf_path),
            "source_file": pdf_path.name,
            "issue_number": detect_issue_number(pdf_path),
        })

    if use_filter and total_saved_chars > 0:
        print(f"\n[フィルタ効果] 合計削減: {total_saved_chars:,}字 "
              f"(推定 {total_saved_chars // 2:,} tokens, "
              f"約${total_saved_chars / 2 / 1_000_000 * 3:.3f}節約)\n")

    if not entries:
        print("APIに送信する対象がありません。")
        return

    # --- Phase 2: バッチ結合 + API呼び出し ---
    new_count = 0
    call_count = 0

    # バッチ候補と単独処理に分類
    batch_queue: list[dict] = []
    single_queue: list[dict] = []

    for entry in entries:
        if entry["chars"] < BATCH_SINGLE_THRESHOLD:
            batch_queue.append(entry)
        else:
            single_queue.append(entry)

    # バッチ候補をグループ化
    batches: list[list[dict]] = []
    current_batch: list[dict] = []
    current_chars = 0

    for entry in batch_queue:
        if current_chars + entry["chars"] > BATCH_CHAR_LIMIT and current_batch:
            batches.append(current_batch)
            current_batch = []
            current_chars = 0
        current_batch.append(entry)
        current_chars += entry["chars"]
    if current_batch:
        batches.append(current_batch)

    total_calls = len(single_queue) + len(batches)
    print(f"API呼び出し計画: 単独 {len(single_queue)}回 + バッチ {len(batches)}回 "
          f"= {total_calls}回（元: {len(entries)}回）\n")

    # バッチ処理
    for batch in batches:
        call_count += 1
        label = ", ".join(e["source_file"] for e in batch)
        print(f"[{call_count}/{total_calls}] バッチ: {label}")

        items = analyze_batch_with_claude(batch, client)
        if items:
            candidates.extend(items)
            new_count += len(items)
            print(f"  {len(items)}件の候補を抽出")
        else:
            print("  関連情報なし")

        for entry in batch:
            processed[str(entry["pdf_path"])] = {"status": "done", "items": "batch"}
        save_json(processed_file, processed)
        save_json(output_file, candidates)

        if call_count < total_calls:
            time.sleep(2)

    # 単独処理
    for entry in single_queue:
        call_count += 1
        print(f"[{call_count}/{total_calls}] {entry['source_file']}")

        items = analyze_with_claude(
            entry["text"], entry["source_file"],
            entry["source_name"], entry["issue_number"], client
        )
        if items:
            candidates.extend(items)
            new_count += len(items)
            print(f"  {len(items)}件の候補を抽出")
        else:
            print("  関連情報なし")

        processed[str(entry["pdf_path"])] = {"status": "done", "items": len(items)}
        save_json(processed_file, processed)
        save_json(output_file, candidates)

        if call_count < total_calls:
            time.sleep(2)

    print(f"\n=== 完了 ===")
    print(f"新規抽出: {new_count}件")
    print(f"累計候補: {len(candidates)}件")
    print(f"API呼び出し: {total_calls}回（元{len(entries)}ファイル）")
    print(f"出力: {output_file}")


if __name__ == "__main__":
    main()
