#!/bin/bash
# Claude Code on the web 用 SessionStart フック。
# リモートセッションのコンテナには node_modules が無いため、依存を導入して
# npm test / npm run lint / npm run build:data-lite 等を最初から実行可能にする。
# Python系スクリプト（.venv / requirements.txt）はローカル専用の任意ツールなのでここでは導入しない。
set -euo pipefail

# Web（リモート）セッション以外では何もしない
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# npm ci ではなく npm install を使う（コンテナキャッシュを活かし、冪等・高速）
npm install --no-audit --no-fund
