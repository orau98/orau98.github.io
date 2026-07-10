# 昆虫植物図鑑（昆虫食草図鑑）

10,000種超の蛾・蝶・タマムシ・カミキリムシ・キクイムシ・ハムシ・アブラムシと食草の関係を収録した昆虫植物図鑑です。

## 🌐 サイトURL

https://orau98.github.io/

## 📋 概要

このプロジェクトは、日本産昆虫と寄主植物（食草）の関係を詳細に記録・表示するReactベースのWebアプリケーションです。

### 主な機能

- 7分類群を収録（蛾・蝶・タマムシ・カミキリムシ・キクイムシ・ハムシ・アブラムシ／計10,000種超）
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

- ソースデータ（ソース・オブ・トゥルース）は `normalized_data/*.csv`（昆虫・食草・備考・植物プロフィール）。`public/*.csv` は `npm run sync:public-insects` が同期する成果物なので直接編集しません（詳細: `docs/data-structure.md`）。
- `prebuild` フックで以下を自動生成してから `vite build` を実行します。
  - `assets/data-lite/*.json`（moths/butterflies/beetles/longhornbeetles/barkbeetles/leafbeetles/hostplants/full-dataset 等の軽量化データ）
  - `assets/data-lite/ylist-lite.json`（植物データの科名補完用ライト版）
  - `assets/data-lite/image-index.json` + `public/images/**` のリサイズ画像
  - メタページとサイトマップ（`public/meta/**` と `public/sitemap*.xml`）
- いずれもGit管理外の再生成物です。CSVを更新したら `npm run build`（内部でprebuild実行）だけでOKです。

### 開発時の注意

- `npm run dev` は起動時に `predev`（`scripts/ensure-dev-data.mjs`）が不足している生成データだけを自動生成します。既存の `assets/data-lite/*.json` は作り直さないため、CSVを書き換えた場合は `npm run sync:public-insects && npm run build:data-lite` を走らせると反映されます。
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

## 🚀 SPA深いURL直アクセス対応について

### 問題の背景

GitHub PagesでSPA（Single Page Application）を運用する場合、以下のような深いURLに直接アクセスすると404エラーが発生します：

```
https://orau98.github.io/plant/ノイバラ
https://orau98.github.io/moth/catalog-3123
```

これは、GitHub Pagesが静的ファイルホスティングサービスのため、実際の `/plant/ノイバラ.html` ファイルが存在しないためです。

### 解決方法：リダイレクトハック

本プロジェクトでは、以下の2段階のリダイレクトハックを実装して、この問題を解決しています：

#### 📊 動作フロー図

```
1. ユーザーが深いURLに直アクセス
   https://orau98.github.io/plant/ノイバラ
   ↓
2. GitHub Pagesが404.htmlを表示
   ↓
3. 404.htmlのスクリプトが動作
   元のURL (/plant/ノイバラ) を保存
   ↓
4. index.html?redirect=%2Fplant%2F%E3%83%8E%E3%82%A4%E3%83%90%E3%83%A9 にリダイレクト
   ↓
5. index.htmlの復元スクリプトが動作
   URLを /plant/ノイバラ に復元
   ↓
6. React Routerが正常にページを表示
```

#### 🔧 実装詳細

**1. 404.html のリダイレクトスクリプト**

```javascript
// 深いURLを検出してindex.htmlに転送
var original = location.pathname + location.search + location.hash;
var dest = '/' + 'index.html?redirect=' + encodeURIComponent(original);
location.replace(dest); // 履歴に404を残さない
```

**2. index.html のURL復元スクリプト**

```javascript
// ?redirect= パラメータから元のURLを復元
var params = new URLSearchParams(location.search);
var redirectUrl = params.get('redirect');
if (redirectUrl) {
  var originalUrl = decodeURIComponent(redirectUrl);
  history.replaceState(null, '', originalUrl); // アドレスバーを復元
}
```

### 🎯 メリット

- ✅ **SEO維持**: 検索エンジンには適切なURLが表示される
- ✅ **ユーザー体験**: アドレスバーに `?redirect=` が残らない
- ✅ **ブラウザ履歴**: 戻るボタンで404に戻らない
- ✅ **シェア対応**: URLをコピー&シェアしても正常に動作

### ⚙️ 設定変更が必要な場合

#### プロジェクトページへの移行

もしこのサイトをプロジェクトページ (`https://username.github.io/repo-name/`) に移行する場合は、以下の変更が必要です：

**404.html と index.html の BASE_PATH を変更：**

```javascript
// 変更前（ユーザーサイト）
var BASE_PATH = '/';

// 変更後（プロジェクトページ）
var BASE_PATH = '/repo-name/';
```

**React Router の basename も合わせて変更：**

```javascript
<BrowserRouter basename="/repo-name">
```

## 🔮 将来の改善予定

現在のリダイレクトハックは暫定対策です。より安定したSEO対応のため、以下への移行を検討中：

- **SSG (Static Site Generation)**: Next.js、Gatsby等
- **SSR (Server Side Rendering)**: Vercel、Netlify等
- **プリレンダリング**: react-snap等での静的ファイル事前生成

## 🧭 メタページとサイトマップ（種ID粒度）

- 種IDページは静的に生成し、`public/meta/{type}/{insect_id}.html` に出力します。
  - 例: `public/meta/butterfly/species-20179.html`、`public/meta/moth/species-0123.html`、`public/meta/longhornbeetle/species-10001.html`
- サイトマップはメタページのみを対象に分割出力し、粒度を「種ページ」に統一しています。
  - 出力先: `public/sitemap-main.xml`、`public/sitemap-moth.xml`、`public/sitemap-butterfly.xml`、`public/sitemap-beetle.xml`、`public/sitemap-longhornbeetle.xml`、`public/sitemap-barkbeetle.xml`、`public/sitemap-leafbeetle.xml`、`public/sitemap-aphid.xml`、`public/sitemap-plant.xml`、英語版 `public/sitemap-en-*.xml`、およびインデックス `public/sitemap.xml`
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

## 🔎 データ整合性: 不明な昆虫ID参照の検証

外部ソース統合やID再編により、`hostplants.csv` / `general_notes.csv` が現行の `insects.csv` に存在しない `insect_id` を参照する場合があります。

- 検証: `npm run validate-normalized`（結果は `reports/missing_ids.csv` に出力。ビルド前にも自動実行）
- 品質監査: `npm run audit:csv-quality`（参照整合性を含む全量監査）
- 不整合が見つかった場合は `normalized_data/*.csv` 側を修正します。旧ID→現行IDの対応が判明している場合は、行削除ではなく「置換（移行）」を優先してください。

## 🆔 IDポリシー（ハムシの統一）

- ハムシ科（Chrysomelidae）の種IDは `species-H###` を正規とします。
  - 旧 `species-LB###`（一部のレガシー採番）は、学名/和名照合のうえ `H###` に移行済みです。
  - Criocerinae（クビボソハムシ亜科）の `species-CR###` も `H###` へ統合済みです。
- 移行は完了しており、当時使用した一括置換スクリプトはリポジトリ整理（#61）で削除済みです。新たなID再編が必要になった場合は、`normalized_data/` を対象にスクリプトを新規作成し、実行後にメタ/サイトマップを再生成してください。


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

### リダイレクトハックのデバッグ

ブラウザの開発者ツールのConsoleタブで、以下のログを確認できます：

```
[SPA Redirect] 404ページでリダイレクト処理開始
[SPA Redirect] 元のURL: /plant/ノイバラ
[SPA Redirect] リダイレクト先: /index.html?redirect=%2Fplant%2F%E3%83%8E%E3%82%A4%E3%83%90%E3%83%A9

[SPA Restore] URL復元処理開始
[SPA Restore] 復元対象URL: /plant/ノイバラ
[SPA Restore] URL復元完了。SPAルーターが処理を引き継ぎます。
```

## 📄 ライセンス

本プロジェクトのソースコードはMITライセンスの下で公開されています。
昆虫データは各種図鑑・文献からの学術利用を目的とした引用です。

---

**📞 お問い合わせ**: 技術的な質問やバグ報告は、GitHubのIssuesからお気軽にどうぞ。
