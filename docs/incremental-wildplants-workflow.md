# 日本の野生植物 反映ワークフロー

この作業は、一度にPDF・OCR・候補CSV・反映・ビルドまで扱うとチャットとリポジトリが重くなる。以後は「1チャット = 1小バッチ」で進める。

## 基本ルール

- PDFやページ画像などの大きい一次資料はリポジトリ外に置く。
- リポジトリ内に残すのは、確認済みの小さいCSV、反映結果、検証レポートだけにする。
- 1回で扱う候補は原則25件以下にする。
- スキャンPDFのOCR結果は `~/Codex_offload/wildplant_ocr_cache/` に置き、リポジトリに入れない。
- 各バッチは、反映前に `--dry-run`、反映後に `validate-normalized` まで確認する。
- `npm run build` は毎バッチでは実行せず、数バッチごとの区切りで実行する。

## PDFから植物プロフィールを抽出する

日本の野生植物PDFはスキャン画像なので、macOS Vision OCRでページごとにテキスト化し、植物名・学名・科・生活型・花期・分布・生育環境だけを `normalized_data/plant_profiles.csv` に保存する。本文の長文転載はしない。

```bash
npm run extract:wildplants -- /path/to/jp_wild_plants_1.pdf --pages 34-133 --replace
```

抽出後はサイト用軽量JSONに反映する。

```bash
npm run build:data-lite
```

## 既存候補CSVの分割

承認済みで、反映スクリプトが扱える候補だけを25件ずつに分ける。

```bash
npm run split:update-batches -- --mode approved --apply-supported-only --require-insect-id --batch-size 25 --fresh
```

出力先は `reports/update_batches/`。このディレクトリは生成物として `.gitignore` 済み。

## 1バッチだけ反映する

まず表示だけ確認する。

```bash
npm run apply:updates -- reports/update_batches/approved-batch-001.csv --dry-run
```

問題なければ、ビルド確認を省いて軽く反映する。

```bash
npm run apply:updates -- reports/update_batches/approved-batch-001.csv --skip-build
```

学名変更・和名変更を含むバッチは危険度が高いため、内容確認後にだけ `--force` を付ける。

```bash
npm run apply:updates -- reports/update_batches/approved-batch-001.csv --force --skip-build
```

## 区切りごとの確認

数バッチ進めたら、まとめて軽い検証を行う。

```bash
npm run validate-normalized
npm run build:data-lite
```

公開物まで確認する区切りでは、最後に通常ビルドを実行する。

```bash
npm run build
```

## チャットの進め方

次回以降は「`reports/update_batches/approved-batch-001.csv` だけ反映して」のように、対象バッチ名を指定する。Codex側では全PDFや全候補を読み直さず、そのCSVと関係するCSVだけを見る。
