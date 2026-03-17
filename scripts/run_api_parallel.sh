#!/usr/bin/env bash
# ================================================================
# API検索を3エージェントで並列実行
#
# insects.csv を3等分して並列検索:
#   Agent A: 前1/3
#   Agent B: 中1/3
#   Agent C: 後1/3
#
# 使い方:
#   bash scripts/run_api_parallel.sh
#
# 前提:
#   - .venv が作成済み
# ================================================================

set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON=".venv/bin/python"
SCRIPT="scripts/check_updates_api.py"
REPORTS="reports"

if [ ! -f "$PYTHON" ]; then
    echo "エラー: .venv が見つかりません。先に作成してください:"
    echo "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
fi

mkdir -p "$REPORTS"

# insects.csv の行数を取得してスライスを計算
TOTAL=$($PYTHON -c "
import csv
from pathlib import Path
root = Path('.')
for d in ['normalized_data', 'public']:
    p = Path(d) / 'insects.csv'
    if p.exists():
        with open(p, encoding='utf-8') as f:
            print(sum(1 for _ in csv.DictReader(f)))
        break
")

if [ -z "$TOTAL" ] || [ "$TOTAL" -eq 0 ]; then
    echo "エラー: insects.csv の行数を取得できません"
    exit 1
fi

THIRD=$(( TOTAL / 3 ))
SLICE_A="0:${THIRD}"
SLICE_B="${THIRD}:$(( THIRD * 2 ))"
SLICE_C="$(( THIRD * 2 )):${TOTAL}"

echo "=========================================="
echo " API検索 並列実行（3エージェント）"
echo "=========================================="
echo ""
echo "全種数: $TOTAL"
echo "  Agent A: [$SLICE_A]  (${THIRD}種)"
echo "  Agent B: [$SLICE_B]  (${THIRD}種)"
echo "  Agent C: [$SLICE_C]  ($(( TOTAL - THIRD * 2 ))種)"
echo ""

# --- Agent A ---
echo "[Agent A] スライス [$SLICE_A] を開始..."
$PYTHON $SCRIPT \
    --slice "$SLICE_A" \
    --output "$REPORTS/api_A.csv" \
    --progress-file "$REPORTS/api_progress_A.json" \
    > "$REPORTS/api_log_A.txt" 2>&1 &
PID_A=$!

# --- Agent B ---
echo "[Agent B] スライス [$SLICE_B] を開始..."
$PYTHON $SCRIPT \
    --slice "$SLICE_B" \
    --output "$REPORTS/api_B.csv" \
    --progress-file "$REPORTS/api_progress_B.json" \
    > "$REPORTS/api_log_B.txt" 2>&1 &
PID_B=$!

# --- Agent C ---
echo "[Agent C] スライス [$SLICE_C] を開始..."
$PYTHON $SCRIPT \
    --slice "$SLICE_C" \
    --output "$REPORTS/api_C.csv" \
    --progress-file "$REPORTS/api_progress_C.json" \
    > "$REPORTS/api_log_C.txt" 2>&1 &
PID_C=$!

echo ""
echo "PID: A=$PID_A  B=$PID_B  C=$PID_C"
echo "ログ: reports/api_log_{A,B,C}.txt"
echo ""
echo "完了を待機中..."

# 完了待機
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
import csv
from pathlib import Path

reports = Path('$REPORTS')
fieldnames = [
    'insect_id', 'japanese_name', 'scientific_name', 'change_type',
    'current_value', 'proposed_value', 'source', 'source_url',
    'confidence', 'review_required', 'note',
]

all_rows = []
for label in ['A', 'B', 'C']:
    f = reports / f'api_{label}.csv'
    if f.exists():
        with open(f, encoding='utf-8') as fh:
            rows = list(csv.DictReader(fh))
            all_rows.extend(rows)
            print(f'  Agent {label}: {len(rows)}件')
    else:
        print(f'  Agent {label}: ファイルなし')

output = reports / 'api_update_candidates.csv'
with open(output, 'w', encoding='utf-8', newline='') as fh:
    writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(all_rows)

print(f'\n統合結果: {len(all_rows)}件 → {output}')
"

echo ""
echo "=========================================="
echo " 完了"
echo "=========================================="
