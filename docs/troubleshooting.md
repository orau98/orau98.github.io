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
1. `isValidPlantName`関数の強化（正規表現の正はコード側: `scripts/lib/dataLiteBuilders.mjs`。data-lite とメタページ生成が共用）
2. 無効なファイルの削除
3. メタページとサイトマップの再生成
4. サイトの再デプロイ

### 問題: JavaScript 実行後に canonical・タイトルが静的HTMLと食い違う（2026年10月）

**症状**: 静的HTMLの head は正しいのに、ブラウザで JavaScript が動いた後に別の内容へ書き換わっていた。
- 一覧ページ（`/moth/`・`/plant/`・`/en/moth/`・`/en/plant/`）の canonical がトップ（`/`・`/en`）を指し、タイトルもトップと同じになる
  （`/moth/` の末尾スラッシュのせいで一覧ページと判定されていなかった）
- 種・植物ページのタイトル・説明文がアプリ側の文言に置き換わり、hreflang が2組（x-default が日本語版と英語版で食い違い）、構造化データが二重になる
- robots がアプリの判定で変わる（写真や植物プロフィールだけで index にしている植物ページが noindex に、noindex の別名ページが index に）

Google は JavaScript 実行後のページを登録に使うため、静的HTMLだけを調べる `audit:seo` では見つからなかった。

**解決策**:
1. 静的な head と同じページを表示している間はアプリが head を書き換えない（`src/utils/prerenderedHead.js`）
2. 一覧ページの判定を末尾スラッシュに関係なく行い、canonical・hreflang を静的HTMLと同じ末尾スラッシュ付きURL・x-default=日本語版にそろえる
3. `npm run check:browser` で、JavaScript 実行後の SEO 情報が静的HTMLと一致するかを確かめる
