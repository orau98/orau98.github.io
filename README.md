# 昆虫植物図鑑（昆虫食草図鑑）

9700種超の蛾・蝶・タマムシ・カミキリムシ・ハムシ・アブラムシと食草の関係を網羅した日本最大級の昆虫植物図鑑です。

## 🌐 サイトURL

https://orau98.github.io/

## 📋 概要

このプロジェクトは、日本産昆虫と寄主植物（食草）の関係を詳細に記録・表示するReactベースのWebアプリケーションです。

### 主な機能

- 6分類群を収録（蛾・蝶・タマムシ・カミキリムシ・ハムシ・アブラムシ／計9,700種超）
- 和名・学名・分類群・食草のキーワード高速検索
- 「食草あり／なし（プレースホルダー除外）」「科」「属」「出現期」での複合フィルタとヒット件数のリアルタイム表示
- 出現期の正規化（「初旬→上旬」「頃」削除・全角/半角/波ダッシュ統一）とガントチャート表示
- 画像の遅延読込＋レスポンシブsrcset（優先カードのみpreload）
- スティッキーヘッダーで検索ボックスとタブを常時利用可能

## 🔧 技術スタック

- **フロントエンド**: React + Vite
- **ホスティング**: GitHub Pages
- **データ**: CSV形式の昆虫・植物データベース
- **スタイリング**: Tailwind CSS

## 🛠️ データ生成とビルドフロー

- ソースデータは `public/*.csv`（昆虫・食草・備考）。
- `prebuild` フックで以下を自動生成してから `vite build` を実行します。
  - `assets/data-lite/*.json`（moths/butterflies/beetles/longhornbeetles/leafbeetles/hostplants/full-dataset 等の軽量化データ）
  - `assets/data-lite/ylist-lite.json`（植物データの科名補完用ライト版）
  - `assets/data-lite/image-index.json` + `public/images/**` のリサイズ画像
  - メタページとサイトマップ（`public/meta/**` と `public/sitemap*.xml`）
- いずれもGit管理外の再生成物です。CSVを更新したら `npm run build`（内部でprebuild実行）だけでOKです。

### 開発時の注意

- `npm run dev` は既存の `assets/data-lite/*.json` をそのまま読み込みます。CSVを書き換えた場合は一度 `npm run build:data-lite` などを走らせると反映されます。
- 大量画像のリサイズが走るため、変更が無いときは `npm run build:images:responsive` を省略しても構いません。

## 🆔 ID仕様について

- IDは非連番です（連番の欠番は仕様）。運用上の削除・統合・系統の分離や、複数スキームの混在により、数値が飛ぶことがあります。
- `insects.csv` の `insect_id` は主に `species-####` ですが、分類群により `species-H###`、`species-CR###`、`species-LB###` 等の接頭辞IDが混在します。
- `hostplants.csv` の `record_id` はユニーク識別子で、分割処理由来の `-2` などの派生IDが存在します。連続性は保証しません。
- 参照整合性（食草・備考が存在しない昆虫IDを参照していないか）は、`node scripts/validate-normalized.mjs` で検証し、結果は `reports/missing_ids.csv` に出力されます。
- 欠番自体は問題ではありませんが、参照整合性エラー（unknown insect_id）は修正対象です。

## 🔍 検索・フィルタの仕様メモ

- 出現期フィルタは `general_notes.csv` の「成虫出現期」を正規化して利用します。波ダッシュ/全角ハイフン/「初旬」「頃」などは正規化・除去し、空欄は「指定なし」としてまとめています。
- 食草あり／なし判定時は、`[不明, 未知, 不詳, 未確認, 未記載, なし, 未登録, 不詳種, 不明種]` をプレースホルダーとして無視します（`MothList.jsx` の `HOST_PLACEHOLDERS`）。
- 科・属フィルタは昆虫データ側の分類列を使用します（植物の科ではありません）。

## 📸 Instagram埋め込みの設定

トップページ右側のウィジェットは次の優先順で読み込みます。

1. `public/instagram_posts.txt` … 1行1URLで最大10件まで表示（`/p/`・`/reel/`・`/tv/` のいずれか）。
2. `public/instagram_latest.txt` … 単一URLを表示。
3. 環境変数 `VITE_INSTAGRAM_URL` … Netlify/Vercel等の環境でも利用可。

サンプル（複数投稿）

```
https://www.instagram.com/p/XXXXXXXXXXX/
https://www.instagram.com/reel/YYYYYYYYYYY/
```

任意で `public/instagram_widget.html` を置けば、提供元の埋め込みコードもそのまま描画します。404を防ぐため `instagram_posts.txt` は空ファイルでも配置してください。

## 🚀 デプロイ

このプロジェクトは GitHub Actions で自動デプロイされます。

- トリガー: `main` ブランチへの push（`.github/workflows/deploy.yml`）
- 流れ: `npm ci` → `npm run build` → `dist/` を Pages へ公開
- 手動実行: Actions 画面から「Deploy with GitHub Actions Pages」を `workflow_dispatch` で実行可能

ローカルから `npm run deploy` を実行してもデプロイは行いません（Actions を利用してください）。

## 🌐 SPA深いURL直アクセスへの対応

GitHub Pages は静的ホスティングのため、`/plant/ノイバラ` や `/moth/species-0123` のような深いURLへ直接アクセスすると、対応する物理ファイルが無く 404 になります。

本プロジェクトでは、ビルド後処理（`scripts/postbuild-cleanup.mjs` の `ensureSpa404`）で `dist/index.html` をそのまま `dist/404.html` に複製します（`noindex` メタと SPA フラグのみ付与）。GitHub Pages は存在しないパスに対して 404.html＝同じ SPA シェルを返すため、React Router がそのままルートを解決します。

- リダイレクト（`?redirect=` への往復）は行いません。アドレスバーの URL はそのまま維持されます。
- SEO 向けには、クロール可能な静的メタページ（`/meta/.../*.html`）を別途生成しています（後述）。
- プロジェクトページ（`https://username.github.io/repo-name/`）へ移す場合は、`vite.config.js` の `base` と `BrowserRouter` の `basename`（`src/main.jsx` は `import.meta.env.BASE_URL` を使用）を合わせて変更してください。

## 🧭 メタページとサイトマップ（種ID粒度）

- 種IDページは静的に生成し、`public/meta/{type}/{insect_id}.html` に出力します。
  - 例: `public/meta/butterfly/species-20179.html`、`public/meta/moth/species-0123.html`、`public/meta/longhornbeetle/species-10001.html`
- サイトマップはメタページのみを対象に分割出力し、粒度を「種ページ」に統一しています。
  - 出力先: `public/sitemap-main.xml`、`public/sitemap-moth.xml`、`public/sitemap-butterfly.xml`、`public/sitemap-beetle.xml`、`public/sitemap-longhornbeetle.xml`、`public/sitemap-leafbeetle.xml`、`public/sitemap-plant.xml`、およびインデックス `public/sitemap.xml`
- 生成コマンド（手動実行）

```bash
# 種IDメタページの生成（既存ファイルは再生成）
npm run generate-meta

# メタページベースの分割サイトマップ生成
npm run generate-sitemap
```

- ビルド時は `prebuild` フックで自動実行されます。
  - `npm run build` 実行時に `generate-meta` → `generate-sitemap` を含む一連の前処理が走ります。

注: SPAのハッシュ/深いURL（`/#/butterfly/...` 等）はサイトマップに含めず、検索エンジン向けにはクロール可能なメタページURL（`/meta/.../*.html`）のみを掲載しています。

## 🆔 IDポリシー（ハムシの統一）

- ハムシ科（Chrysomelidae）の種IDは `species-H###` を正規とします。
  - 旧 `species-LB###`（一部のレガシー採番）は、学名/和名照合のうえ `H###` に移行済みです。
  - Criocerinae（クビボソハムシ亜科）の `species-CR###` も `H###` へ統合済みです。
- この統一は適用済みで、一度きりの移行スクリプトは役目を終えたため撤去しています（変更履歴は Git に残存）。今後 ID を追加する際は `species-H###` の採番規則に従ってください。


## 📝 開発・デバッグ

### ローカル開発

```bash
npm install
npm run dev
```

### ビルド

```bash
npm run build
npm run preview
```

## 📄 ライセンス

本プロジェクトのソースコードはMITライセンスの下で公開されています。
昆虫データは各種図鑑・文献からの学術利用を目的とした引用です。

---

**📞 お問い合わせ**: 技術的な質問やバグ報告は、GitHubのIssuesからお気軽にどうぞ。
