# CSVデータ品質 全量監査レポート

生成日時: 2026-07-12T17:53:45.805Z

本レポートは `scripts/audit-csv-quality.mjs` により自動生成される。判定基準はサイト表示ロジック
（`scripts/lib/dataLiteBuilders.mjs` = メタページ生成と同基準）および YList（`normalized_data/ylist-lite.json`,
サイトの権威的分類データ）を再利用しており、監査結果とサイトの実表示が一致する。

## サマリ

| 指標 | 件数 |
| --- | --- |
| hostplants 行数 | 21239 |
| 表記ゆれバケット | 2 |
| 完全重複グループ | 0 |
| 昆虫-植物ペア重複 | 667 |
| record_id 重複 | 0 |
| insect_id 重複 | 0 |
| ノート重複 | 26 |
| プロファイル重複 | 0 |
| 無効植物名（種類数） | 48 |
| 科名不整合（植物数） | 0 |
| 　└ YListで裁定可 | 0 |
| 　└ 原典・外部分類DBで裁定済み | 0 |
| 　└ 誤記(実在科へ) | 0 |
| 　└ 要判断 | 0 |
| 非標準の科名（種類数） | 48 |
| 非植物キー（種類数） | 24 |
| 孤立 hostplants(insect_id欠落) | 0 |
| 孤立 notes(insect_id欠落) | 0 |
| 列数不整合行 | 0 |

各カテゴリの全件は `reports/csv-quality/*.csv`、機械可読な全データは `reports/csv-quality-findings.json` を参照。

## 1. 表記ゆれ（正規化キー同一・生表記が複数） 上位

| key | distinct | total | variants |
| --- | --- | --- | --- |
| タカノツメ | 2 | 5 | タカノツメ (4) \| タカノツメ（樹木） (1) |
| マルメロ | 2 | 5 | マルメロ (4) \| マルメロ？ (1) |

## 2. 重複

### 完全重複行（record_id以外一致）: 0グループ
- なし

### 昆虫-植物ペア重複: 667
| insect_id | normalized_plant | count | plant_names |
| --- | --- | --- | --- |
| species-3749 | ブナ | 3 | ブナ |
| species-3749 | コナラ | 3 | コナラ |
| species-3749 | ミズナラ | 3 | ミズナラ |
| species-3749 | クヌギ | 3 | クヌギ |
| species-3749 | カシワ | 3 | カシワ |
| species-3749 | アベマキ | 3 | アベマキ |
| species-3750 | コナラ | 3 | コナラ |
| species-3750 | ミズナラ | 3 | ミズナラ |
| species-3750 | クヌギ | 3 | クヌギ |
| species-3750 | アベマキ | 3 | アベマキ |
| species-3750 | カシワ | 3 | カシワ |
| species-3877 | クヌギ | 3 | クヌギ |
| species-3877 | コナラ | 3 | コナラ |
| species-3885 | ヤシャブシ | 3 | ヤシャブシ |
| species-3885 | ドウダンツツジ | 3 | ドウダンツツジ |
| species-3885 | ミヤマキリシマ | 3 | ミヤマキリシマ |
| species-3887 | カシワ | 3 | カシワ |
| species-3887 | アベマキ | 3 | アベマキ |
| species-5791 | ケヤキ | 3 | ケヤキ |
| species-5920 | オトギリソウ | 3 | オトギリソウ |

### record_id 重複: 0 / insect_id 重複: 0

## 3. 無効植物名（サイトに表示されず静かに欠落する名前） 上位

| plant_name | normalized | normalized_would_show | count |
| --- | --- | --- | --- |
| Molinia japonica | Molinia japonica | no | 3 |
| Spiraea nipponica | Spiraea nipponica | no | 3 |
| Astragalus | Astragalus | no | 2 |
| Vicia | Vicia | no | 2 |
| Pasania glabra | Pasania glabra | no | 2 |
| 綿 | 綿 | no | 1 |
| Endospermum | Endospermum | no | 1 |
| Ficus | Ficus | no | 1 |
| Capparis heyneana | Capparis heyneana | no | 1 |
| Drypetes poilanei | Drypetes poilanei | no | 1 |
| Cocculus | Cocculus | no | 1 |
| Larix leptolepis | Larix leptolepis | no | 1 |
| Boehmeria nipononivea | Boehmeria nipononivea | no | 1 |
| Actinidia arguta | Actinidia arguta | no | 1 |
| Scaevola taccata | Scaevola taccata | no | 1 |
| Cayratia japonica | Cayratia japonica | no | 1 |
| Nerium indicum | Nerium indicum | no | 1 |
| Desmodium oryphyllum | Desmodium oryphyllum | no | 1 |
| Symplocos paniculata | Symplocos paniculata | no | 1 |
| Meliosma tenuis | Meliosma tenuis | no | 1 |

## 4. 科名不整合

合計 0 植物。うち YList権威で裁定可 0、原典・外部分類DBで裁定済み 0、誤記→実在科 0、要判断 0。

- なし

### 非標準の科名（YList-lite の科集合に無い値）: 48
注: YList-lite は収録植物に現れる科のみを持つ部分集合のため、この一覧には
(a) OCR誤記・説明混入等の真の異常値（例「，ナス科」「キネ科」「クリノキ科（推定）」）と、
(b) 部分集合外の正当な科（例「キキョウ科」「キジカクシ科」）や菌類・地衣類・非植物ホストの科（例「サルノコシカケ科」「多孔菌科」「セミ科」）が混在する。
`--fix` は植物名からYListで権威科が引ける行のみ補正し、これらの正当な非植物科・部分集合外科は変更しない。
| plant_family | ends_with_ka | count | sample_plant | sample_ylist_family |
| --- | --- | --- | --- | --- |
| キキョウ科 | yes | 36 | ツリガネニンジン |  |
| カエデ科 | yes | 9 | ヒナウチワ |  |
| アオキ科 | yes | 8 | アオキ |  |
| ワスレグサ科 | yes | 7 | ユウスゲ |  |
| サルノコシカケ科 | yes | 6 | カワラタケ |  |
| セミ科 | yes | 6 | ヒグラシ |  |
| 多孔菌科 | yes | 4 | ツリガネタケ |  |
| キシメジ科 | yes | 4 | シイタケ |  |
| キジカクシ科 | yes | 4 | ジャノヒゲ |  |
| ショウブ科 | yes | 4 | ショウブ |  |
| キンボウゲ科 | yes | 4 | ヤエヤマセンニンソウ |  |
| ツゲモドキ科 | yes | 3 | ツゲモドキ |  |
| キントラノオ科 | yes | 3 | コウシュンカズラ |  |
| ヤマゴボウ科 | yes | 3 | ヨウシュヤマゴボウ |  |
| タコノキ科 | yes | 3 | タコノキ |  |
| センリョウ科 | yes | 3 | ヒトリシズカ |  |
| スギ科 | yes | 3 | コウヨウザン |  |
| シナノキ科 | yes | 2 | シナノキ類 |  |
| ，ナス科 | yes | 2 | タパコ |  |
| ウロコゴケ綱 | no | 2 | ウニヤバネゴケ |  |

## 5. 非植物キー（植物ページに載せるべきでない記録） 上位

| plant_name | kind | count |
| --- | --- | --- |
| 枯れ葉 | substrate/resource | 17 |
| 朽ち木 | substrate/resource | 6 |
| 枯れ木 | substrate/resource | 3 |
| 枯葉 | substrate/resource | 3 |
| 魚粉などの動物質 | suspicious/ambiguous | 2 |
| 菌類に侵された枯れ木 | substrate/resource | 2 |
| 樹皮 | substrate/resource | 2 |
| カワラタケ | substrate/resource | 2 |
| カワラタケ  などの菌 | substrate/resource | 2 |
| 落ち葉 | substrate/resource | 2 |
| カワラタケ  などの菌類 | substrate/resource | 2 |
| シリアル食品や豆類などの植物性のもの | suspicious/ambiguous | 1 |
| 朽ち木・枯れ木の樹皮 | substrate/resource | 1 |
| キノコ | substrate/resource | 1 |
| トウゴマ枯れ果 | substrate/resource | 1 |
| 菌類の生葉 | substrate/resource | 1 |
| アブラナ科その他の草本など多種の植物 | suspicious/ambiguous | 1 |
| 菌類のカワラタケ | substrate/resource | 1 |
| 多種の植物 | suspicious/ambiguous | 1 |
| 菌類のカワラタケ類 | substrate/resource | 1 |

## 6. 参照整合性

孤立 hostplants: 0 / 孤立 notes: 0 / 列数不整合: 0


