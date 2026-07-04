# 昆虫植物図鑑（昆虫食草図鑑） - Claude開発ガイド

## プロジェクト概要
昆虫と食草（寄主植物）の関係を詳細に記録・表示するReactベースのWebアプリケーションです。日本の蛾・蝶・タマムシ・カミキリムシ・ハムシ・アブラムシと植物の相互作用を可視化しています。

## 技術スタック
- **フロントエンド**: React, Vite
- **デプロイ**: GitHub Pages
- **データ**: CSV形式の昆虫・植物データベース
- **SEO**: 静的メタページ生成システム

## 重要なディレクトリ構造
```
/
├── public/                    # 静的ファイル
│   ├── *.csv                 # 昆虫データベース
│   ├── meta/                 # SEO用静的メタページ
│   │   ├── plant/           # 植物詳細ページ
│   │   ├── moth/            # 蛾詳細ページ
│   │   ├── butterfly/       # 蝶詳細ページ
│   │   ├── beetle/          # タマムシ詳細ページ
│   │   ├── longhornbeetle/  # カミキリムシ詳細ページ
│   │   └── leafbeetle/      # ハムシ詳細ページ
│   ├── images/              # 画像ファイル
│   └── sitemap.xml          # サイトマップ
├── src/                      # Reactソースコード
├── scripts/                  # ビルドスクリプト
│   ├── generate-meta-pages.js # メタページ生成
│   └── generate-sitemap.js    # サイトマップ生成
└── dist/                     # ビルド出力
```

## データ形式
### CSVファイル
- 各昆虫種の詳細情報（学名、食草、観察記録等）
- 植物名は「植物名(科名)」形式で統一
- 備考欄には詳細な食草情報や生態情報

## メタページ生成システム

### 植物名バリデーション
`scripts/generate-meta-pages.js`の`isValidPlantName`関数で無効な植物名をフィルタリング：

```javascript
const invalidPatterns = [
  /科が$/,           // 「科が」で終わる
  /^記録[）)]?$/,    // 「記録」「記録）」
  /^が記録[）)]?$/,  // 「が記録」「が記録）」
  /^\)[^(]*$/,       // 「）」で始まる（括弧の後半のみ）
  /^[（(][^）)]*$/   // 「（」で始まり「）」で終わらない（括弧の前半のみ）
];
```

### 重要な問題と解決策

#### 問題: 広告プレビューでの「ページが見つかりません」エラー
**原因**: 不正な植物名（例：「キョウチクトウ科が」「アブラナ科(オオアラセイトウ」）が無効なHTMLファイルを生成

**解決策**:
1. `isValidPlantName`関数の強化
2. 無効なファイル（104件）の削除
3. メタページとサイトマップの再生成
4. サイトの再デプロイ

## ビルド・デプロイプロセス

### 開発コマンド
```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド（prebuildでデータ・メタ・サイトマップを再生成）
```

デプロイは `main` への push で GitHub Actions が自動実行する（`npm run deploy` は実行せず案内メッセージを出すだけ）。

### ビルド前処理
```bash
npm run generate-meta     # メタページ生成
npm run generate-sitemap  # サイトマップ生成
```

## データメンテナンス

### CSVデータの更新
1. `normalized_data/*.csv`（ソース・オブ・トゥルース）を更新（`public/*.csv`はビルド時に同期される生成物）
2. `npm run audit:csv-quality`で不整合を確認
3. `npm run build`でビルド（prebuildがメタページ・サイトマップも再生成）
4. `main`へpushしてGitHub Actionsでデプロイ

### 植物名の正規化
- 重複データの統合（例：「オニグルミ」→「オニグルミ(クルミ科)」）
- エイリアス作成で検索性向上
- 無効な植物名の除外

## SEO対策

### メタページ機能
- 各植物・昆虫に個別の静的HTMLページ
- 構造化データ（JSON-LD）によるリッチスニペット対応
- Open Graph/Twitter Card対応
- 適切なcanonical URL設定

### サイトマップ
- 植物、蛾、蝶、タマムシ、カミキリムシ、ハムシ別のサイトマップ分割
- 毎日の更新日付自動設定

## データ品質監査（CSV）

`scripts/audit-csv-quality.mjs`（`npm run audit:csv-quality`）で
`insects.csv`/`hostplants.csv`/`general_notes.csv`/`plant_profiles.csv` を全量走査し、
表記ゆれ・重複・無効植物名・科名不整合・非植物キー・参照整合性を検出する。
判定基準はサイト表示ロジック（`scripts/lib/dataLiteBuilders.mjs`）と YList を再利用するため、
監査結果とサイトの実表示が一致する。依存パッケージ不要（RFC4180パーサは `scripts/lib/csvQuality.mjs`）。

```bash
npm run audit:csv-quality              # 監査（読み取り専用）→ reports/csv-quality-audit.md, reports/csv-quality/*.csv, reports/csv-quality-findings.json
node scripts/audit-csv-quality.mjs --fix  # 高信頼の決定的修正を適用（reports/csv-quality/fix-decisions.json を反映）
```

- `--fix` は **表示不変（サイト出力を変えない）修正のみ** を自動適用する:
  科名のYList権威値への整列（サイトは元々YListで科名を上書き表示）、括弧注記の正規化
  （`normalizePlantNameLite` が元々除去）、説明的接頭辞の除去、検証済みの手動裁定（`fix-decisions.json`）。
- 判断を要する残件は `reports/csv-quality-fixes.md` に提案として整理する。
- 回帰テスト: `tests/csv-quality-regression.test.mjs`（既知障害の再発防止・科名整合・参照整合・public/normalized同期を固定、依存パッケージ不要）。
- CSVデータ更新後は `npm run audit:csv-quality` を実行し、新たな不整合が入っていないか確認すること。

## トラブルシューティング

### よくある問題

1. **植物ページが見つからない**
   - `npm run generate-meta`でメタページ再生成
   - 植物名に無効文字が含まれていないか確認
   - `npm run audit:csv-quality` で科名不整合・無効植物名を検出

2. **ビルドエラー**
   - CSVファイルの文字エンコーディング確認（UTF-8）
   - 無効な植物名パターンの追加確認

3. **デプロイ失敗**
   - GitHub Pagesの設定確認
   - `dist`ディレクトリのファイル生成確認

## 言語設定
- **UI言語**: 日本語
- **データ**: 日本語（学名は英語・ラテン語）
- **出力**: 全て日本語での説明・エラーメッセージ
