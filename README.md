# 昆虫と食草の図鑑

7000種以上の蛾、蝶、タマムシと食草の関係を網羅した日本最大級の昆虫図鑑です。

## 🌐 サイトURL

https://orau98.github.io/

## 📋 概要

このプロジェクトは、日本産昆虫と寄主植物（食草）の関係を詳細に記録・表示するReactベースのWebアプリケーションです。

### 主な機能

- 7000種以上の昆虫データベース
- 植物と昆虫の相互関係検索
- 詳細な食草情報
- レスポンシブデザイン
- SEO最適化済み

## 🔧 技術スタック

- **フロントエンド**: React + Vite
- **ホスティング**: GitHub Pages
- **データ**: CSV形式の昆虫・植物データベース
- **スタイリング**: Tailwind CSS

## 🆔 ID仕様について

- IDは非連番です（連番の欠番は仕様）。運用上の削除・統合・系統の分離や、複数スキームの混在により、数値が飛ぶことがあります。
- `insects.csv` の `insect_id` は主に `species-####` ですが、分類群により `species-H###`、`species-CR###`、`species-LB###` 等の接頭辞IDが混在します。
- `hostplants.csv` の `record_id` はユニーク識別子で、分割処理由来の `-2` などの派生IDが存在します。連続性は保証しません。
- 参照整合性（食草・備考が存在しない昆虫IDを参照していないか）は、`node scripts/validate-normalized.mjs` で検証し、結果は `reports/missing_ids.csv` に出力されます。
- 欠番自体は問題ではありませんが、参照整合性エラー（unknown insect_id）は修正対象です。

## 📸 Instagram埋め込みの設定

トップページ右側の「Instagram 最新投稿」には、投稿のパーマリンクを1件埋め込み表示します。

- 表示方法は次のどちらかを設定してください。
  - `public/instagram_latest.txt` に最新投稿のURLを1行で記載
  - もしくは環境変数 `VITE_INSTAGRAM_URL` に投稿URLを設定

例: `public/instagram_latest.txt`

```
https://www.instagram.com/p/XXXXXXXXXXX/
```

注意: Instagram公式は「アカウントのタイムライン埋め込み」を提供していません。複数投稿を並べたい場合は、`public/instagram_posts.txt` などに複数URLを用意しコンポーネント拡張で対応してください（要望があれば実装します）。

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
  - 例: `public/meta/butterfly/species-20179.html`、`public/meta/moth/species-0123.html`
- サイトマップはメタページのみを対象に分割出力し、粒度を「種ページ」に統一しています。
  - 出力先: `public/sitemap-moth.xml`、`public/sitemap-butterfly.xml`、`public/sitemap-leafbeetle.xml`、`public/sitemap-plant.xml`、およびインデックス `public/sitemap_index.xml`（エイリアスとして `public/sitemap.xml` も出力）
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
  - 旧 `species-LB###`（一部のレガシー採番）は、学名/和名照合のうえ `H###` に移行しました。
  - Criocerinae（クビボソハムシ亜科）の `species-CR###` も `H###` へ統合済みです。
- 参照の自動置換スクリプト：
  - `scripts/unify_leafbeetle_ids.mjs`（LB→H）
  - `scripts/unify_criocerinae_ids.mjs`（CR→H）
- 実行後は `scripts/sort_insects_by_id.mjs` でID整列とレポート更新、必要に応じてメタ/サイトマップを再生成してください。


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
