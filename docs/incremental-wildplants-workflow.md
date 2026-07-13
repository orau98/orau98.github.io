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

日本の野生植物PDFはスキャン画像なので、macOS Vision OCRでページごとにテキスト化し、植物名・学名・科・生活型・花期・分布・生育環境の**レビュー候補**を `work/wildplant_profile_candidates.csv` に保存する。OCR候補を `normalized_data/` や `public/` へ直接書き出すことは禁止する。本文の長文転載はしない。類似種との見分け方もOCRから自動掲載せず、原PDF画像で対象種・比較対象・形質・冊子ページを確認した監査台帳の短い客観的要約だけを `distinguishing_features` へ反映する。

```bash
npm run extract:wildplants -- /path/to/jp_wild_plants_1.pdf --pages 17-83 --split-spreads --printed-pages 33-165
npm run extract:wildplants -- /path/to/jp_wild_plants_1.pdf --pages 84-133 --split-spreads --printed-pages 166-265
```

まとまった範囲を処理し終えたら、キャッシュ済みOCRを使って候補CSVを全範囲で作り直し、レポートも全体版に揃える。

```bash
npm run extract:wildplants -- /path/to/jp_wild_plants_1.pdf --pages 17-305 --split-spreads --printed-pages 33-608 --replace --require-profile-facts
npm run extract:wildplants -- /path/to/jp_wild_plants_2.pdf --pages 16-316 --split-spreads --printed-pages 31-630 --source-label "日本の野生植物 第2巻" --replace-source --require-profile-facts
```

第1巻はPDF p.17-305、第2巻はPDF p.16-316が本文である。これより後は図版・索引なので、種プロフィールの全量再生成へ含めない。PDFは1ページに冊子2ページを収録しているため、公開引用には `printed_page` を使い、未確認時の `page` は `PDF p.X` と明示する。既存プロフィールと識別文が別ページにまたがる場合は、`page` と `printed_page` の既知値をそれぞれ `;` 区切りの和集合として保持する。冊子ページに対応しない既存PDFページは、出典表示から消さず併記する。

候補を原PDFで確認した後、採否、承認済みの短い要約、PDFページ、冊子ページ、原本ハッシュを `data/source_audits/japanese-wild-plants-*.csv` に記録する。公開CSVへの反映は専用の監査適用スクリプトだけで行う。同じ植物の識別文は1台帳だけを正本とし、完全性・識別・整合修正台帳の複数から同時に供給しない。重複候補は原PDFで再確認した1つの正本文へ統合し、適用検査で複数所有を拒否する。YListとの差は候補化にだけ用い、原本の旧分類体系・併記名は誤り扱いしない。和名・学名・科名・属名の訂正は `japanese-wild-plants-taxonomy-followup-*.csv` の全候補判断と `japanese-wild-plants-name-integrity-*.csv` の変更前後を対応させる。

既存行の修正は `japanese-wild-plants-profile-integrity-*.csv` に変更前欄全体と変更後欄全体を保存する。和文内の段組み空白は意味不変のレイアウト正規化として全件処理できるが、文字の置換、見出し除去、推測文の切り分けは原PDFの左右冊子ページを確定してから行う。同じOCR字形誤読を一括訂正する場合も、代表原画像は候補探索にしか使わない。公開対象となる各欄について対象種欄全体を原PDF画像で個別に読み直し、別種本文、同じ欄の別のOCR誤り、類似種との比較情報まで確認する。完了行は `verification_method=original_pdf_full_field_visual_review` とし、代表字形だけを確認した行は適用処理が拒否する。

```bash
npm run apply:wildplants-audit -- --dry-run
npm run apply:wildplants-audit
npm run check:wildplants-audit
```

原PDFがローカルにある監査時は、`WILDPLANTS_VOLUME1_PDF_PATH` と `WILDPLANTS_VOLUME2_PDF_PATH` に実ファイルを指定する。適用処理は台帳に固定したSHA-256と照合し、不一致なら書き込み前に停止する。

監査適用後はサイト用軽量JSONに反映する。

```bash
npm run build:data-lite
```

客観プロフィールがある植物は、昆虫との食草関係が未登録でも `plantDetails` に含め、SPAの植物検索から到達できるようにする。追加の静的メタページは、容量上限を守るため、既存の食草植物に加えて具体的な `distinguishing_features` があるプロフィールだけを生成する。基本プロフィールだけの植物を静的ページ化しなくても、サイト内検索と詳細表示からは除外しない。

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
