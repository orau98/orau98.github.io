# トラブルシューティング

よくある問題と過去の障害事例の対処メモ（CLAUDE.md から移設）。データ構造は `docs/data-structure.md`、運用ポリシーは `docs/data-management.md` を参照。

## よくある問題

1. **植物ページが見つからない**
   - `npm run generate-meta`でメタページ再生成
   - 植物名に無効文字が含まれていないか確認
   - `npm run audit:csv-quality` で科名不整合・無効植物名を検出

2. **ビルドエラー**
   - CSVファイルの文字エンコーディング確認（UTF-8）
   - `normalized_data/ylist-lite.json` の存在確認（無いと `build:data-lite` が失敗し得る）
   - 無効な植物名パターンの追加確認

3. **デプロイ失敗**
   - GitHub Actions（deploy.yml）の実行ログ確認
   - `dist`ディレクトリのファイル生成確認・`npm run smoke:dist`

4. **devサーバーにCSV編集が反映されない**
   - `npm run sync:public-insects && npm run build:data-lite` を実行（predevは「不足分の生成」のみで、既存の古い生成物は作り直さない）

## 過去の障害事例と解決策

### 問題: 広告プレビューでの「ページが見つかりません」エラー

**原因**: 不正な植物名（例：「キョウチクトウ科が」「アブラナ科(オオアラセイトウ」）が無効なHTMLファイルを生成

**解決策**:
1. `isValidPlantName`関数の強化（正規表現の正はコード側: `scripts/generate-meta-pages.js`）
2. 無効なファイルの削除
3. メタページとサイトマップの再生成
4. サイトの再デプロイ
