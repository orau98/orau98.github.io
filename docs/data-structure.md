# 植物昆虫図鑑のデータ構造

このメモは、現在の表示を変えずにデータを保守するための構造メモです。一次データは `normalized_data/*.csv`、表示用の生成物は `public/assets/data-lite/*.json` です。

## 一次データ

- `normalized_data/insects.csv`: 昆虫の実体。主キーは `insect_id`。和名、別名、分類、学名、シノニム、分類変更メモを持つ。
- `normalized_data/hostplants.csv`: 昆虫と植物・資源の関係行。`insect_id` で昆虫に接続し、植物名、科名、観察タイプ、利用部位、ステージ、出典、備考を持つ。
- `normalized_data/general_notes.csv`: 昆虫単位の備考。出現時期、生態情報、保全状況などを `note_type` で分ける。
- `normalized_data/plant_profiles.csv`: 植物単位のプロフィール。和名、学名、科、属、生活型、花期、分布、生育環境、類似種との識別形質、PDF見開き番号、冊子ページを持つ。`page` と `printed_page` はそれぞれ既知の証拠ページ集合で、複数値は `;` 区切りとする。両列を位置対応配列とはみなさず、正確なPDF・冊子ページ対は原PDF監査台帳を正本とする。
- `normalized_data/ylist-lite.json`: YList由来の植物分類・別名索引の正式スナップショット。元のYList CSV（`public/20210514YList_download.csv`）はリポジトリに存在しないため、このスナップショットが事実上の一次データ。`build:data-lite` はこのファイルが無く、かつ既存出力も無い場合にビルドを失敗させる。

`npm run sync:public-insects` が `insects.csv` / `hostplants.csv` / `general_notes.csv` を `normalized_data/` から `public/` へコピーする（アプリが実行時にfetchするランタイム契約。CI/デプロイ両方で実行される）。

## 生成物

生成物はgit管理外（`.gitignore`）で、CI/デプロイが毎回 `normalized_data/` と `public/images/` から再生成する。対象: `public/assets/data-lite/`、`public/meta/`、`public/en/`、ルートシェル各ディレクトリ（`public/{moth,plant,butterfly,beetle,longhornbeetle,barkbeetle,leafbeetle,aphid}/`）、`public/seo-route-map.*.json`。ローカル開発では `npm run dev` 起動時に `predev`（`scripts/ensure-dev-data.mjs`）が不足分を自動生成する。※`public/images/resized/` のみ、デプロイ時間維持のため当面コミットを継続。

`npm run build:data-lite` が、正規化CSVから以下を生成する。

- `public/assets/data-lite/{moths,butterflies,beetles,longhornbeetles,barkbeetles,leafbeetles,aphids}.json`: 分類群別の昆虫一覧。
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

### 読み込みと欠損値の契約

- `src/utils/hostRecord.js` が正規化CSVの食草行を変換する共通入口。観察区分・利用部位・発育段階の空欄には、国内・葉・幼虫などの既定値を補わない。`recordId` と出典を保持する。
- 訪花の判定は `src/utils/flowerVisitPlants.js` を画面・カード・関係図・生成処理で共有する。段階不明の花利用を成虫の訪花へ昇格させない。
- `src/services/dataPartitionLoader.js` は7分類それぞれの `catalog` / `full` と3つの植物JSONの取得成否を管理する。空配列の取得成功と未取得・失敗を区別する。
- `App` は初回だけでなく経路変更時にも `planInitialDataLoad` の要求を適用する。植物詳細・クイズには全分類、昆虫詳細には当該分類の `full` が必要。必須データの不足中は、0件や部分集合を完成した詳細ページとして表示しない。
- 昆虫詳細の本文を先に表示し、続いて全分類のcatalogを取得する。「同じ食草の昆虫」と関係図は全分類がそろってから表示し、特定分類だけの部分集合を確定結果にしない。
- 成功した分類・植物JSONは他ファイルの失敗時にも保持し、再読み込みでは失敗部分を再試行する。全分類と3つの植物JSONがそろった版だけをキャッシュに保存し、マニフェストの版が一致する完全キャッシュだけを復元する。一括JSONにも同じ完全性条件を適用する。
- 開発時も `predev` で生成したdata-liteを用いる。ブラウザで旧CSVパイプラインへ暗黙にフォールバックしない。
- 昆虫画像索引は `buildImageIndex` を専用コマンドとメタページ生成で共用する。出現時期の解釈は表示から分けた `src/utils/emergenceTime.js` で検証する。

### 公開の必須検査

- `npm run check:source`: 警告もエラー扱いのコード検査、全回帰テスト、正規化CSV検証。
- `npm run check:dist`: 生成後の経路・ファイル検査、画像解像度監査、SEO監査。
- PRのCIとmainの公開処理は同じ2つの検査を使用する。公開処理は検査に成功した成果物だけをアップロードする。
- 未知・空欄の参照先ID、必須の正規化CSV欠落は常に検証失敗。環境変数で検証を緩めたりpublicコピーで代用したりしない。

### データ自体を変更する場合

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
