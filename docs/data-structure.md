# 植物昆虫図鑑のデータ構造

このメモは、現在の表示を変えずにデータを保守するための構造メモです。一次データは `normalized_data/*.csv`、表示用の生成物は `public/assets/data-lite/*.json` です。

## 一次データ

- `normalized_data/insects.csv`: 昆虫の実体。主キーは `insect_id`。和名、別名、分類、学名、シノニム、分類変更メモを持つ。
- `normalized_data/hostplants.csv`: 昆虫と植物・資源の関係行。`insect_id` で昆虫に接続し、植物名、科名、観察タイプ、利用部位、ステージ、出典、備考を持つ。
- `normalized_data/general_notes.csv`: 昆虫単位の備考。出現時期、生態情報、保全状況などを `note_type` で分ける。
- `normalized_data/plant_profiles.csv`: 植物単位のプロフィール。和名、学名、科、属、生活型、花期、分布、生育環境、出典ページを持つ。
- `normalized_data/ylist-lite.json`: YList由来の植物分類・別名索引の正式スナップショット。元のYList CSV（`public/20210514YList_download.csv`）はリポジトリに存在しないため、このスナップショットが事実上の一次データ。`build:data-lite` はこのファイルが無く、かつ既存出力も無い場合にビルドを失敗させる。

`npm run sync:public-insects` が `insects.csv` / `hostplants.csv` / `general_notes.csv` を `normalized_data/` から `public/` へコピーする（アプリが実行時にfetchするランタイム契約。CI/デプロイ両方で実行される）。

## 生成物

`npm run build:data-lite` が、正規化CSVから以下を生成する。

- `public/assets/data-lite/{moths,butterflies,beetles,longhornbeetles,leafbeetles,aphids}.json`: 分類群別の昆虫一覧。
- `public/assets/data-lite/full-dataset.json`: 詳細ページ用の統合データ。
- `public/assets/data-lite/hostplants.json`: 植物名から関連昆虫名への逆引き。
- `public/assets/data-lite/flower-visit-plants.json`: 訪花関係の逆引き。
- `public/assets/data-lite/plant-details.json`: 植物の分類・学名・プロフィール・別名。
- `public/assets/data-lite/ylist-lite.json`: YList由来の植物分類と別名索引。

画像はCSVとは別に、ファイル名索引で管理される。

- 昆虫写真: `public/images/insects/` と `public/assets/data-lite/image-index.json`
- 植物写真: `public/images/plants/` と `public/plant_image_filenames.txt`
- レスポンシブ画像: `public/images/resized/{insects,plants}/`

## 安全に改善する順序

1. 表示ロジックを変える前に、`npm run audit:data-structure` で重複、表記ゆれ、科名衝突、OCR由来の疑いを確認する。
2. 明らかな完全重複から直す。昆虫・植物の関連数やページの見え方が変わりにくい。
3. 次に植物名の表記ゆれを直す。植物名はURL、写真解決、逆引きのキーにも使われるため、別名や画像ファイル名との対応を確認してから進める。
4. `枯れ葉`、`朽ち木`、`樹皮`、菌類など植物名ではない資源は、昆虫詳細では「植物以外の利用資源」として表示し、植物索引・植物検索・訪花索引には混ぜない。
5. 将来的には `plant_id`、`photo_id`、`reference_id` を導入し、表示名ではなくIDで関係を張る。

## 監査コマンド

```sh
npm run audit:data-structure
```

レポートをファイルに残す場合:

```sh
npm run audit:data-structure -- --write reports/data-structure-audit.md
```
