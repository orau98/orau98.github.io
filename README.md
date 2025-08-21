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