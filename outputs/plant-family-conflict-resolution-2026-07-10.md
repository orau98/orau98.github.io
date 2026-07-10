# 植物科名不整合11件の再調査・解消報告

調査日: 2026-07-10

## 結論

同一植物名に複数の科名が付いていた11件を全件裁定した。被子植物はYListのAPG科名を優先し、YListで直接扱えない総称は同属種とKew Plants of the World Online (POWO)、菌類はNCBI TaxonomyとGBIF、抽出異常は元文献OCRを照合した。

- 10植物は全レコードの `plant_family` を統一した。
- 科名空欄8件も同じ裁定値で補完した。
- 「トモエウツギ」2件は元文献に存在しない誤抽出で、正しい「トモエソウ」行が既存だったため削除した。
- 論理40セルを修正し、誤抽出2行を削除した。`public/hostplants.csv` と `normalized_data/hostplants.csv` は同一内容である。
- 全量監査の科名競合は11件から0件になった。

## 裁定結果

| 植物名 | 競合していた科 | 採用した科 | 判定 |
| --- | --- | --- | --- |
| アオキ | アオキ科 / ミズキ科 | **アオキ科** | [YList](https://ylist.info/ylist_detail_display.php?pass=44)はAPGでアオキ科、ミズキ科は旧体系。なお[POWO](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A271451-1)はGarryaceaeを採用しており国際DB間にも差があるため、本DBの方針どおりYListを優先した。 |
| カエデ類 | ムクロジ科 / カエデ科 | **ムクロジ科** | [YListのAcer palmatum](https://ylist.info/ylist_detail_display.php?pass=653)と[POWOのAcer属](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A328248-2)はいずれもSapindaceae。カエデ科は旧体系。 |
| ガマズミ属 | レンプクソウ科 / スイカズラ科 | **ガマズミ科** | [YList](https://ylist.info/ylist_detail_display.php?pass=1730)と[POWO](https://powo.science.kew.org/taxon/927323-1)はいずれもViburnaceae。原典2冊はそれぞれ旧体系のレンプクソウ科・スイカズラ科を使用していた。 |
| ササ | イネ科 / ササ類などのイネ科 | **イネ科** | 後者は説明文の科名欄への混入。[POWOのSasa属](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A18942-1)もPoaceae。 |
| シロバナエンレイソウ | ユリ科 / シュロソウ科 | **シュロソウ科** | YList検索はMelanthiaceaeを返し、標準名側の[YList](https://ylist.info/ylist_detail_display.php?pass=6234)と[POWO](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A542611-1)も一致。ユリ科は原典の旧体系。 |
| ツリガネタケ | 多孔菌科 / ブナ科 | **多孔菌科** | 元文献は「ツリガネタケのついているブナの枯れ木」と記述し、菌と基質を別にしている。[鳥取大学の菌株DB](https://fungusdb.muses.tottori-u.ac.jp/catalog/info?id=33594)、[NCBI Taxonomy](https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=40442)、[GBIF](https://www.gbif.org/species/8068867)で `Fomes fomentarius` / Polyporaceaeを確認。日本語科名は資料により多孔菌科・サルノコシカケ科・タマチョレイタケ科と揺れるため、原典と既存DBの「多孔菌科」を維持し、明白に不適切なブナ科だけを除いた。 |
| テリハハマボウ | オトギリソウ科 / アオイ科 | **アオイ科** | 元文献では「テリハハマボウ（アオイ科）」の直後に別植物「テリハボク（オトギリソウ科）」があり、科名が隣接項目から混入していた。[YList](https://ylist.info/ylist_detail_display.php?pass=6524)と[POWO](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A560290-1)もMalvaceae。 |
| トモエウツギ | セリ科 / アジサイ科 | **行を削除** | 元文献のネジロマルハキバガとコチャマダラマルハキバガはいずれも「トモエソウ（オトギリソウ科）」。正しい2行が既存だったため、誤抽出2行を削除した。[YListのトモエソウ](https://ylist.info/ylist_detail_display.php?pass=4305)もHypericaceae。 |
| ハンノキ属 | カバノキ科 / ハンノキ科 | **カバノキ科** | [YList](https://ylist.info/ylist_detail_display.php?pass=5073)と[POWO](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A294936-1)はいずれもBetulaceae。原典OCR内でも「ハンノキ（カバノキ科）」と「ハンノキ属（ハンノキ科）」が同一段落にあり、後者を誤記と判定した。 |
| ヒナウチワカエデ | ムクロジ科 / カエデ科 | **ムクロジ科** | [YList](https://ylist.info/ylist_detail_display.php?pass=5163)と[POWO](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A56830-1)はいずれもSapindaceae。カエデ科は旧体系。 |
| ユウスゲ | ワスレグサ科 / ユリ科 | **ワスレグサ科** | [YList](https://ylist.info/ylist_detail_display.php?pass=6840)と[POWO](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A77188285-1)はいずれもAsphodelaceae。『日本産カミキリムシ』は旧体系のユリ科を明記しており、OCR誤読ではない。 |

## 元文献の再確認

元OCRでは次を確認した。

- 『日本産蛾類標準図鑑3』: ネジロマルハキバガはOCR 11613-11625行、コチャマダラマルハキバガは11741-11763行に「トモエソウ（オトギリソウ科）」とある。
- 『日本産蛾類標準図鑑2』: OCR 11352-11354行でテリハハマボウとテリハボクが連続し、それぞれアオイ科とオトギリソウ科に分けられている。
- 『日本産蛾類標準図鑑3』: OCR 5090-5092行では、ツリガネタケは菌名、ブナは付着基質として記述されている。
- 『日本産カミキリムシ』: OCR 9694-9698行はユウスゲをユリ科として明記しており、旧分類の保持が原因だった。

## 再発防止

- `reports/csv-quality/fix-decisions.json` に10植物の検証済み裁定と根拠を追加した。
- `scripts/audit-csv-quality.mjs --fix` が検証済み裁定を使って科名空欄も補完するようにした。
- 回帰テストで、10植物の全行一致、科名競合0件、「トモエウツギ」不在、正しいトモエソウ2行の保持を固定した。

## 別カテゴリの残件

監査の「非標準科42件」は今回の「同一植物名に複数科」とは別指標である。YList-liteが全YListではなく部分集合のため、正当な植物科、菌類・地衣類・昆虫の科も未登録扱いになる一方、「，ナス科」「キネ科」など単発OCR異常も混在している。今回の11競合は解消済みだが、この42種類の精査は別のデータ品質課題として残る。
