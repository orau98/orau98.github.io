#!/usr/bin/env bash
# ================================================================
# PDF抽出を3エージェントで並列実行
#
# Agent A: pdfs/ga-tsushin/ の No.1〜100
# Agent B: pdfs/ga-tsushin/ の No.101〜200
# Agent C: pdfs/ga-tsushin/ の No.201〜305 + 他フォルダ
#
# 使い方:
#   bash scripts/run_extract_parallel.sh
#
# 前提:
#   - ANTHROPIC_API_KEY が設定済み
#   - .venv が作成済み
#   - pdfs/ga-tsushin/ にPDFがダウンロード済み
# ================================================================

set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON=".venv/bin/python"
SCRIPT="scripts/extract_from_pdf.py"
REPORTS="reports"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "エラー: ANTHROPIC_API_KEY を設定してください"
    echo "  export ANTHROPIC_API_KEY='sk-ant-...'"
    exit 1
fi

if [ ! -f "$PYTHON" ]; then
    echo "エラー: .venv が見つかりません。先に作成してください:"
    echo "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
fi

mkdir -p "$REPORTS"

echo "=========================================="
echo " PDF抽出 並列実行（3エージェント）"
echo "=========================================="
echo ""

# --- Agent A: ga-tsushin No.1-100 ---
echo "[Agent A] ga-tsushin No.1-100 を開始..."
$PYTHON $SCRIPT pdfs/ga-tsushin/ \
    --range 1-100 \
    --output "$REPORTS/extracted_A.json" \
    --processed-file "$REPORTS/processed_A.json" \
    > "$REPORTS/extract_log_A.txt" 2>&1 &
PID_A=$!

# --- Agent B: ga-tsushin No.101-200 ---
echo "[Agent B] ga-tsushin No.101-200 を開始..."
$PYTHON $SCRIPT pdfs/ga-tsushin/ \
    --range 101-200 \
    --output "$REPORTS/extracted_B.json" \
    --processed-file "$REPORTS/processed_B.json" \
    > "$REPORTS/extract_log_B.txt" 2>&1 &
PID_B=$!

# --- Agent C: ga-tsushin No.201-305 + 他フォルダ ---
echo "[Agent C] ga-tsushin No.201-305 + 他フォルダ を開始..."
(
    # ga-tsushin No.201-305
    $PYTHON $SCRIPT pdfs/ga-tsushin/ \
        --range 201-305 \
        --output "$REPORTS/extracted_C.json" \
        --processed-file "$REPORTS/processed_C.json"

    # 他フォルダがあれば追加処理
    for dir in pdfs/cho-to-ga pdfs/elytra pdfs/tsukimushi pdfs/other; do
        if [ -d "$dir" ] && [ "$(ls -A "$dir" 2>/dev/null)" ]; then
            echo "[Agent C] $dir を処理中..."
            $PYTHON $SCRIPT "$dir" \
                --output "$REPORTS/extracted_C.json" \
                --processed-file "$REPORTS/processed_C.json"
        fi
    done
) > "$REPORTS/extract_log_C.txt" 2>&1 &
PID_C=$!

echo ""
echo "PID: A=$PID_A  B=$PID_B  C=$PID_C"
echo "ログ: reports/extract_log_{A,B,C}.txt"
echo ""
echo "完了を待機中..."

# 全プロセスの完了を待機
FAIL=0
wait $PID_A || { echo "[Agent A] 失敗（終了コード: $?）"; FAIL=1; }
echo "[Agent A] 完了"
wait $PID_B || { echo "[Agent B] 失敗（終了コード: $?）"; FAIL=1; }
echo "[Agent B] 完了"
wait $PID_C || { echo "[Agent C] 失敗（終了コード: $?）"; FAIL=1; }
echo "[Agent C] 完了"

echo ""

if [ $FAIL -ne 0 ]; then
    echo "一部のエージェントが失敗しました。ログを確認してください。"
fi

# --- 結果を統合 ---
echo "--- 結果統合 ---"
$PYTHON -c "
import json
from pathlib import Path

reports = Path('$REPORTS')
merged = []
for label in ['A', 'B', 'C']:
    f = reports / f'extracted_{label}.json'
    if f.exists():
        data = json.loads(f.read_text(encoding='utf-8'))
        if isinstance(data, list):
            merged.extend(data)
            print(f'  Agent {label}: {len(data)}件')
        else:
            print(f'  Agent {label}: 0件（空またはフォーマット不正）')
    else:
        print(f'  Agent {label}: ファイルなし')

output = reports / 'extracted_candidates.json'
output.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'\n統合結果: {len(merged)}件 → {output}')
"

echo ""
echo "=========================================="
echo " 完了"
echo "=========================================="
