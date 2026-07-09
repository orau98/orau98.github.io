# 昆虫植物図鑑（昆虫食草図鑑） - 開発ガイド（AIエージェント用メモリ）

このファイルは Claude Code（CLAUDE.md）と Codex（AGENTS.md → 本ファイルへのシンボリックリンク）が共有する開発ガイドです。編集は本ファイル（CLAUDE.md）に対して行うこと。

## プロジェクト概要
昆虫と食草（寄主植物）の関係を詳細に記録・表示するReactベースのWebアプリケーションです。日本の蛾・蝶・タマムシ・カミキリムシ・ハムシ・アブラムシと植物の相互作用を可視化しています。

## 技術スタック
- **フロントエンド**: React, Vite, Tailwind CSS
- **デプロイ**: GitHub Pages（GitHub Actions。`main` への push で自動デプロイ）
- **データ**: CSV形式の昆虫・植物データベース
- **SEO**: 静的メタページ生成システム（日本語 + 英語）

## データフローの鉄則（最重要）

- **一次データ（ソース・オブ・トゥルース）は `normalized_data/*.csv`**（`insects.csv` / `hostplants.csv` / `general_notes.csv` / `plant_profiles.csv`）と `normalized_data/ylist-lite.json`。
- `public/insects.csv` / `public/hostplants.csv` / `public/general_notes.csv` は `npm run sync:public-insects` が `normalized_data/` からコピーする**同期成果物**。**`public/*.csv` を直接編集しないこと**（次のビルドで上書きされる）。
- `public/assets/data-lite/*.json`・`public/meta/`・`public/en/` などの生成物はGit管理外で、CI/デプロイが毎回再生成する。
- 詳細は `docs/data-structure.md`（構造）と `docs/data-management.md`（管理ポリシー）を参照。

## 重要なディレクトリ構造
```
/
├── normalized_data/           # ★一次データ（CSVはここを編集する）
│   ├── insects.csv           # 昆虫の実体（主キー: insect_id）
│   ├── hostplants.csv        # 昆虫×植物の関係行（record_id, insect_id）
│   ├── general_notes.csv     # 昆虫単位の備考（note_type別）
│   ├── plant_profiles.csv    # 植物プロフィール（『日本の野生植物』由来等）
│   └── ylist-lite.json       # YList由来の植物分類・別名索引（事実上の一次データ）
├── public/                    # 静的ファイル
│   ├── *.csv                 # normalized_data からの同期成果物（直接編集禁止）
│   ├── meta/                 # SEO用静的メタページ（生成物・Git管理外）
│   │                         #   plant/ moth/ butterfly/ beetle/
│   │                         #   longhornbeetle/ leafbeetle/ aphid/
│   ├── en/                   # 英語版メタページ（生成物・Git管理外）
│   ├── images/               # 画像（insects/ plants/ resized/）
│   └── sitemap*.xml          # 分割サイトマップ（generate-sitemap で再生成）
├── src/                       # Reactソースコード
├── scripts/                   # ビルド・監査スクリプト
│   ├── generate-meta-pages.js      # メタページ生成（日本語）
│   ├── generate-meta-en-pages.mjs  # メタページ生成（英語）
│   ├── generate-sitemap-split.js   # 分割サイトマップ生成
│   ├── build-data-lite.mjs         # CSV→軽量JSON生成
│   ├── sync-public-insects-csv.mjs # normalized_data→public 同期
│   ├── validate-normalized.mjs     # 参照整合性検証
│   └── lib/                        # 共有ロジック（dataLiteBuilders 等）
├── docs/                      # データ構造・運用ドキュメント
├── tests/                     # node --test（依存パッケージ不要）
├── reports/                   # 監査レポート（多くはGit管理外）
└── dist/                      # ビルド出力
```

## データ形式
### CSVファイル
- 各昆虫種の詳細情報（学名、食草、観察記録等）
- 植物名は「植物名(科名)」形式で統一
- 備考欄には詳細な食草情報や生態情報
- IDは非連番（欠番は仕様）。ハムシの種IDは `species-H###` が正規（LB/CR系は統合済み）

## メタページ生成システム

### 植物名バリデーション
`scripts/generate-meta-pages.js` の `isValidPlantName` 関数が無効な植物名（説明文の断片、括弧の片割れ、「〜科が」等）をフィルタリングする。**正規表現の正はコード側**なので、パターンを変更・追加する場合は同関数を直接参照・編集すること（このファイルに正規表現をコピーして二重管理しない）。

過去の障害事例（広告プレビューでの404等）と対処は `docs/troubleshooting.md` を参照。

## ビルド・デプロイプロセス

### 開発コマンド
```bash
npm run dev          # 開発サーバー起動（predevが不足データを自動生成）
npm run build        # プロダクションビルド（prebuildで前処理一式が走る）
npm run preview      # ビルド結果のプレビュー
npm test             # ユニットテスト（node --test tests/*.test.mjs）
npm run lint         # ESLint
```

### ビルド前処理（`npm run build` の prebuild で自動実行）
```bash
npm run sync:public-insects       # normalized_data → public へCSV同期
npm run validate-normalized       # 参照整合性検証（→ reports/missing_ids.csv）
npm run build:data-lite           # 軽量JSON生成
npm run build:image-index         # 画像索引生成
npm run build:plant-image-index   # 植物画像ファイル名索引
npm run build:images:responsive   # レスポンシブ画像生成
npm run generate-meta:all         # メタページ生成（日本語 + 英語）
npm run generate-sitemap          # 分割サイトマップ生成
```

### デプロイ
- `main` ブランチへの push で GitHub Actions（`.github/workflows/deploy.yml`）が自動デプロイする。
- `npm run deploy` はローカルからはデプロイしない（案内メッセージを表示するだけ）。

## データメンテナンス

### CSVデータの更新手順
定型手順は `/csv-data-update` スキル（`.claude/skills/csv-data-update/SKILL.md`）を参照。
要点: `normalized_data/*.csv` を編集 → `validate-normalized` → `audit:csv-quality` → `npm test` → `main` へ push で自動デプロイ。

### 植物名の正規化
- 重複データの統合（例：「オニグルミ」→「オニグルミ(クルミ科)」）
- エイリアス作成で検索性向上
- 無効な植物名の除外

## SEO対策

### メタページ機能
- 各植物・昆虫に個別の静的HTMLページ（`public/meta/{type}/{insect_id}.html`、英語版は `public/en/`）
- 構造化データ（JSON-LD）によるリッチスニペット対応
- Open Graph/Twitter Card対応
- 適切なcanonical URL設定

### サイトマップ
- 植物、蛾、蝶、タマムシ、カミキリムシ、ハムシ、アブラムシ別 + 英語版（`sitemap-en-*.xml`）の分割サイトマップ
- インデックスは `public/sitemap.xml`
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

よくある問題（植物ページ未生成・ビルド/デプロイ失敗・devサーバーへのCSV反映等）の対処は `docs/troubleshooting.md` を参照。

## エージェント設定（.claude/）

- `.claude/settings.json`: 共有設定。SessionStartフック（Webセッションで `npm install` を自動実行）と、開発コマンドの許可リストを定義。
- `.claude/hooks/session-start.sh`: Web（リモート）セッション専用の依存導入フック。ローカルでは何もしない。
- `.claude/skills/csv-data-update/`: CSVデータ更新の定型ワークフロースキル（`/csv-data-update` で呼び出し可能）。
- `.claude/settings.local.json`: 個人設定（Git管理外）。共有すべき設定は `settings.json` へ。

## 言語設定
- **UI言語**: 日本語
- **データ**: 日本語（学名は英語・ラテン語）
- **出力**: 全て日本語での説明・エラーメッセージ
