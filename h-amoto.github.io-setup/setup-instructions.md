# h-amoto.github.io セットアップ手順

## 1. GitHub上で新規リポジトリ作成
- リポジトリ名: `h-amoto.github.io` (正確にこの名前)
- Public設定
- README追加

## 2. ローカルでのセットアップ
```bash
cd ~
git clone https://github.com/H-Amoto/h-amoto.github.io.git
cd h-amoto.github.io
```

## 3. ファイルのコピー
このディレクトリ内の以下のファイルをh-amoto.github.ioリポジトリにコピー:
- index.html
- ads.txt

## 4. コミット・プッシュ
```bash
git add .
git commit -m "Initial setup for AdSense"
git push origin main
```

## 5. GitHub Pages設定
- リポジトリ設定 → Pages
- Source: Deploy from a branch
- Branch: main / (root)

## 6. AdSense申請
URL: `https://h-amoto.github.io/`

## 注意
数分待ってからhttps://h-amoto.github.io/にアクセスして動作確認してください。