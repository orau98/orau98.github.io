# Wild Plant Profile Fact Check

Generated: 2026-05-08T00:56:44

This report audits the OCR-derived `normalized_data/plant_profiles.csv` data for likely hallucinations or OCR/parser artifacts. It is a review list, not an automatic deletion list.

Display safety rules: taxonomy-only OCR fragments are excluded from site profile output, and YList taxonomy is preferred over OCR taxonomy when the plant is already known to the site.

## Summary

- Audited rows: 5928
- Profile candidate rows with factual fields: 4036
- Findings: 8188
- High-priority findings (score >= 80): 3187
- High-priority profile-candidate findings: 434
- OCR caches: 日本の野生植物 第1巻: /Users/akimotohiroki/Codex_offload/wildplant_ocr_cache/jp_wild_plants_1; 日本の野生植物 第2巻: /Users/akimotohiroki/Codex_offload/wildplant_ocr_cache/jp_wild_plants_2

## Source Counts

| Source | Rows | Profile candidate rows | High-priority profile-candidate findings |
| --- | ---: | ---: | ---: |
| 日本の野生植物 第1巻 | 3963 | 2071 | 251 |
| 日本の野生植物 第2巻 | 1965 | 1965 | 183 |

## High-Priority Profile-Candidate Findings By Source

| Source | Category | Count |
| --- | --- | ---: |
| 日本の野生植物 第1巻 | possible_ocr_latin_typo_against_ylist | 162 |
| 日本の野生植物 第1巻 | ylist_family_conflict | 89 |
| 日本の野生植物 第2巻 | possible_ocr_latin_typo_against_ylist | 170 |
| 日本の野生植物 第2巻 | ylist_family_conflict | 13 |

## Category Counts

| Category | Count |
| --- | ---: |
| duplicate_name_scientific_conflict | 2015 |
| low_information_profile | 1707 |
| genus_scientific_conflicts_with_scientific_name | 1584 |
| duplicate_low_information_row_shadowed | 1008 |
| possible_ocr_latin_typo_against_ylist | 633 |
| duplicate_name_family_conflict | 559 |
| ylist_family_latin_conflict | 279 |
| ylist_family_conflict | 258 |
| ylist_scientific_name_conflict | 137 |
| family_latin_outlier_for_japanese_family | 8 |

## Profile-Candidate Category Counts

| Category | Count |
| --- | ---: |
| genus_scientific_conflicts_with_scientific_name | 1562 |
| duplicate_name_scientific_conflict | 993 |
| possible_ocr_latin_typo_against_ylist | 332 |
| duplicate_name_family_conflict | 277 |
| ylist_family_latin_conflict | 122 |
| ylist_family_conflict | 102 |
| ylist_scientific_name_conflict | 77 |

## Top 80 Profile-Candidate Findings

| Score | Category | Plant | Scientific name | Family | Page | Reason | Expected/check |
| ---: | --- | --- | --- | --- | ---: | --- | --- |
| 88 | possible_ocr_latin_typo_against_ylist | アオハダ | Ilex maeropoda | モチノキ科 | 229 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Ilex macropoda |
| 88 | possible_ocr_latin_typo_against_ylist | アカガシ | Quereus aeuta | ブナ科 | 282 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Quercus acuta |
| 88 | possible_ocr_latin_typo_against_ylist | アカギ | Bischofa javaniea | コミカンソウ科 | 303 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Bischofia javanica |
| 88 | possible_ocr_latin_typo_against_ylist | アカメガシワ | Mallotus japonieus | トウダイグサ科 | 301 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Mallotus japonicus |
| 88 | possible_ocr_latin_typo_against_ylist | アキカラマツ | Thalietrum minus | キンポウゲ科 | 196 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Thalictrum minus var. hypoleucum |
| 88 | possible_ocr_latin_typo_against_ylist | アキニレ | UImus parvifolia | ニレ科 | 250 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Ulmus parvifolia |
| 88 | possible_ocr_latin_typo_against_ylist | アキノタムラソウ | Salvia japoniea | シソ科 | 212 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Salvia japonica |
| 88 | possible_ocr_latin_typo_against_ylist | アキノノゲシ | Lactuea indica | キク科 | 263 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Lactuca indica var. laciniata |
| 88 | possible_ocr_latin_typo_against_ylist | アキメヒシバ | Digitaria violaseens | イネ科 | 167 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Digitaria violascens |
| 88 | possible_ocr_latin_typo_against_ylist | アズマイチゲ | Auemone raddeana | キンポウゲ科 | 187 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Anemone raddeana |
| 88 | possible_ocr_latin_typo_against_ylist | アズマシャクナゲ | Rhododendron degroniamum | ツツジ科 | 136 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Rhododendron degronianum |
| 88 | possible_ocr_latin_typo_against_ylist | アゼスゲ | Carex thunbergil | カヤツリグサ科 | 119 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Carex thunbergii |
| 88 | possible_ocr_latin_typo_against_ylist | アブラシバ | Cares satsumensis | カヤツリグサ科 | 117 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Carex satsumensis |
| 88 | possible_ocr_latin_typo_against_ylist | アベマキ | Quereus variabills | ブナ科 | 281 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Quercus variabilis |
| 88 | possible_ocr_latin_typo_against_ylist | アマシバ | Symploeos formosana | ハイノキ科 | 126 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Symplocos formosana |
| 88 | possible_ocr_latin_typo_against_ylist | アマチャヅル | Gynostemma pentaplyllum | ウリ科 | 289 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Gynostemma pentaphyllum |
| 88 | possible_ocr_latin_typo_against_ylist | アメリカセンダングサ | Bideus frondosa | キク科 | 290 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Bidens frondosa |
| 88 | possible_ocr_latin_typo_against_ylist | アラカシ | Quereus glauea | ブナ科 | 282 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Quercus glauca |
| 88 | possible_ocr_latin_typo_against_ylist | アリアケスミレ | Viola betonieifolia | スミレ科 | 29 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Viola betonicifolia var. albescens |
| 88 | possible_ocr_latin_typo_against_ylist | アンズ | Prunus armeninca | バラ科 | 276 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Prunus armeniaca |
| 88 | possible_ocr_latin_typo_against_ylist | イイギリ | Idesia polyearpa | ヤナギ科 | 19 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Idesia polycarpa |
| 88 | possible_ocr_latin_typo_against_ylist | イケマ | Cyuanchum candatum | キョウチクトウ科 | 160 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Cynanchum caudatum |
| 88 | possible_ocr_latin_typo_against_ylist | イソヤマアオキ | Coceulus laurifolius | ツヅラフジ科 | 179 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Cocculus laurifolius |
| 88 | possible_ocr_latin_typo_against_ylist | イタチササゲ | Lathyrus davidi | ハマビシ科 | 233 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Lathyrus davidii |
| 88 | possible_ocr_latin_typo_against_ylist | イタドリ | Fallopia japoniea | タデ科 | 85 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Fallopia japonica |
| 88 | possible_ocr_latin_typo_against_ylist | イタビカズラ | Fieus sarmentosa | アサ科 | 254 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Ficus sarmentosa subsp. nipponica |
| 88 | possible_ocr_latin_typo_against_ylist | イチイガシ | Quereus gilva | ブナ科 | 282 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Quercus gilva |
| 88 | possible_ocr_latin_typo_against_ylist | イヌコウジュ | Mosla seabra | シソ科 | 208 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Mosla scabra |
| 88 | possible_ocr_latin_typo_against_ylist | イヌザンショウ | Zanthosylum sehinifolium | ミカン科 | 58 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Zanthoxylum schinifolium var. schinifolium |
| 88 | possible_ocr_latin_typo_against_ylist | イヌブナ | Fagus japoniea | ブナ科 | 280 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Fagus japonica |
| 88 | possible_ocr_latin_typo_against_ylist | イワガネ | Oreoenide frutescens | イラクサ科 | 258 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Oreocnide frutescens |
| 88 | possible_ocr_latin_typo_against_ylist | イワシモツケ | Spiraea nipponiea | バラ科 | 279 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Spiraea niopponica var. nipponica |
| 88 | possible_ocr_latin_typo_against_ylist | イワスゲ | Cares stenantha | カヤツリグサ科 | 124 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Carex stenantha var. stenantha |
| 88 | possible_ocr_latin_typo_against_ylist | イワダレソウ | Plyla nodiflora | クマツヅラ科 | 226 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Phyla nodiflora |
| 88 | possible_ocr_latin_typo_against_ylist | イワヒゲ | Cassiope lyeopodioides | ツツジ科 | 143 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Cassiope lycopodioides |
| 88 | possible_ocr_latin_typo_against_ylist | ウキヤガラ | Bollbosehoenus fluviatills | カヤツリグサ科 | 113 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Bolboschoenus fluviatilis subsp. yagara |
| 88 | possible_ocr_latin_typo_against_ylist | ウシノケグサ | Festuea ovina | イネ科 | 153 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Festuca ovina |
| 88 | possible_ocr_latin_typo_against_ylist | ウシハコベ | Stellaria aguatiea | ナデシコ科 | 97 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Stellaria aquatica |
| 88 | possible_ocr_latin_typo_against_ylist | ウバメガシ | Quereus phillyreoides | ブナ科 | 281 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Quercus phillyraeoides |
| 88 | possible_ocr_latin_typo_against_ylist | ウメモドキ | Iles serrata | モチノキ科 | 229 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Ilex serrata |
| 88 | possible_ocr_latin_typo_against_ylist | ウラシマツツジ | Aretous alpinus | ツツジ科 | 139 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Arctous alpinus var. japonicus |
| 88 | possible_ocr_latin_typo_against_ylist | ウラジロウツギ | Deutzia maximowieziana | アジサイ科 | 110 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Deutzia maximovicziana |
| 88 | possible_ocr_latin_typo_against_ylist | ウラジロエノキ | Tvema orientalis | アサ科 | 252 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Trema orientalis |
| 88 | possible_ocr_latin_typo_against_ylist | ウラジロガシ | Quereus salieina | ブナ科 | 282 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Quercus salicina |
| 88 | possible_ocr_latin_typo_against_ylist | ウラジロヨウラク | Rhododendron multillorum | ツツジ科 | 136 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Rhododendron multiflorum |
| 88 | possible_ocr_latin_typo_against_ylist | ウワバミソウ | Elatostema involueratum | イラクサ科 | 257 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Elatostema involucratum |
| 88 | possible_ocr_latin_typo_against_ylist | エゾイラクサ | Urtiea platyplylla | イラクサ科 | 259 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Urtica platyphylla |
| 88 | possible_ocr_latin_typo_against_ylist | エゾタチカタバミ | Oxalis strieta | カタバミ科 | 294 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Oxalis stricta |
| 88 | possible_ocr_latin_typo_against_ylist | エゾノキヌヤナギ | Salix sclwerinii | ヤナギ科 | 24 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Salix schwerinii |
| 88 | possible_ocr_latin_typo_against_ylist | エゾノコリンゴ | Malus baceata | バラ科 | 274 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Malus baccata var. mandshurica |
| 88 | possible_ocr_latin_typo_against_ylist | エゾノサワアザミ | Cirsium peetinellum | キク科 | 249 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Cirsium pectinellum |
| 88 | possible_ocr_latin_typo_against_ylist | エゾハタザオ | Catolobus pendulus | アブラナ科 | 73 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Catolobus pendula |
| 88 | possible_ocr_latin_typo_against_ylist | エゾヒナノウスツボ | Serophularia alata | ゴマノハグサ科 | 193 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Scrophularia alata |
| 88 | possible_ocr_latin_typo_against_ylist | エゾリンドウ | Gentiana trilora | アカネ科 | 155 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Gentiana triflora var. japonica |
| 88 | possible_ocr_latin_typo_against_ylist | エビスグサ | Semna obtusifolia | ハマビシ科 | 225 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Senna obtusifolia |
| 88 | possible_ocr_latin_typo_against_ylist | エビヅル | Vitis fieifolia | ブドウ科 | 218 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Vitis ficifolia |
| 88 | possible_ocr_latin_typo_against_ylist | エンジュ | Styphonolobium japonieum | ハマビシ科 | 240 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Styphnolobium japonicum |
| 88 | possible_ocr_latin_typo_against_ylist | オオイタビ | Fieus pumila | アサ科 | 254 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Ficus pumila |
| 88 | possible_ocr_latin_typo_against_ylist | オオカモメヅル | Vincetosieum aristolochioides | キョウチクトウ科 | 163 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Vincetoxicum aristolochioides |
| 88 | possible_ocr_latin_typo_against_ylist | オオクサキビ | Panicum dichotomillorum | イネ科 | 171 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Panicum dichotomiflorum |
| 88 | possible_ocr_latin_typo_against_ylist | オオシマザクラ | Cerasls speciosa | バラ科 | 272 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Cerasus speciosa |
| 88 | possible_ocr_latin_typo_against_ylist | オオバイヌビワ | Fieus septiea | アサ科 | 254 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Ficus septica |
| 88 | possible_ocr_latin_typo_against_ylist | オオバギ | Maearanga tanarius | トウダイグサ科 | 301 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Macaranga tanarius var. tomentosa |
| 88 | possible_ocr_latin_typo_against_ylist | オオバシマムラサキ | Calliearpa subpubescens | シソ科 | 198 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Callicarpa subpubescens |
| 88 | possible_ocr_latin_typo_against_ylist | オオバセンキュウ | Angeliea gennflexa | セリ科 | 302 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Angelica genuflexa |
| 88 | possible_ocr_latin_typo_against_ylist | オオバルリミノキ | Lasianthus vertieilatus | アカネ科 | 149 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Lasianthus verticillatus |
| 88 | possible_ocr_latin_typo_against_ylist | オオベンケイソウ | Hylotelephium speetabile | ベンケイソウ科 | 212 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Hylotelephium spectabile |
| 88 | possible_ocr_latin_typo_against_ylist | オオルリソウ | Cynoglossum fureatum | ムラサキ科 | 177 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Cynoglossum furcatum var. villosulum |
| 88 | possible_ocr_latin_typo_against_ylist | オカトラノオ | Lysimaehia clethroides | サクラソウ科 | 121 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Lysimachia clethroides |
| 88 | possible_ocr_latin_typo_against_ylist | オガサワラコミカンソウ | Phyllanthus debilis | コミカンソウ科 | 305 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Phyllanthus deblis |
| 88 | possible_ocr_latin_typo_against_ylist | オギ | Miseanthus saechariflorus | イネ科 | 170 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Miscanthus sacchariflorus |
| 88 | possible_ocr_latin_typo_against_ylist | オグルマ | Iaula britamniea | キク科 | 289 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Inula britannica subsp. japonica |
| 88 | possible_ocr_latin_typo_against_ylist | オトギリソウ | Eyperieum erectum | オトギリソウ科 | 37 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Hypericum erectum |
| 88 | possible_ocr_latin_typo_against_ylist | オトコヨモギ | Artemisia japoniea | キク科 | 281 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Artemisia japonica |
| 88 | possible_ocr_latin_typo_against_ylist | オニシモツケ | Fillipendula camtschatiea | バラ科 | 262 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Filipendula camtschatica |
| 88 | possible_ocr_latin_typo_against_ylist | オランダイチゴ | Fragaria xananassa | バラ科 | 263 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Fragaria ananassa |
| 88 | possible_ocr_latin_typo_against_ylist | オランダガラシ | Nasturtium offeinale | アブラナ科 | 76 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Nasturtium officinale |
| 88 | possible_ocr_latin_typo_against_ylist | カエデドコロ | Dioscorea quinguelobata | ヤマノイモ科 | 59 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Dioscorea quinquelobata |
| 88 | possible_ocr_latin_typo_against_ylist | カギカズラ | Unearia rlynchophylla | アカネ科 | 153 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Uncaria rhynchophylla |
| 88 | possible_ocr_latin_typo_against_ylist | カゴノキ | Lisea coreana | クスノキ科 | 37 | The scientific name is very close to YList but not identical, which is typical of OCR letter errors. | Litsea coreana |

## Top 80 Raw CSV Findings

| Score | Scope | Category | Plant | Scientific name | Family | Page | Reason | Expected/check |
| ---: | --- | --- | --- | --- | --- | ---: | --- | --- |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アオツヅラフジ | Cocculus orbiculatus | ケシ科 | 472 | The same Japanese plant name appears with multiple families. | ケシ科 / ツヅラフジ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アオノリュウゼツラン | Agave americana | ヒガンバナ科 | 392 | The same Japanese plant name appears with multiple families. | クサスギカズラ科 / ヒガンバナ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アカギ | Biscbofa iavanica | トウダイグサ科 | 636 | The same Japanese plant name appears with multiple families. | コミカンソウ科 / トウダイグサ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アカミノルイヨウショウマ | Actnea erythurocarpa | メギ科 | 476 | The same Japanese plant name appears with multiple families. | キンポウゲ科 / メギ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アキカラマツ | Thalictrun mumnss var | キンボウゲ科 | 495 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アキグミ | Elneagnus unbellata var. ubellata | ヒメハギ科 | 548 | The same Japanese plant name appears with multiple families. | グミ科 / ヒメハギ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アキニレ | Ulmus parvifolia | クロウメモドキ科 | 557 | The same Japanese plant name appears with multiple families. | クロウメモドキ科 / ニレ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アギナシ | Sagittaria aginasti | チシマゼキショウ科 | 349 | The same Japanese plant name appears with multiple families. | オモダカ科 / チシマゼキショウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アケビ | Akebia guinsta | ケシ科 | 471 | The same Japanese plant name appears with multiple families. | アケビ科 / ケシ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アズマツメクサ | Tillaea aquatica | ユキノシタ科 | 514 | The same Japanese plant name appears with multiple families. | ベンケイソウ科 / ユキノシタ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アズマレイジンソウ | Aconitusn pterocaule vas | キンボウゲ科 | 477 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アダン | Pandanus odoratissimuus | ホンゴウソウ科 | 357 | The same Japanese plant name appears with multiple families. | タコノキ科 / ホンゴウソウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | アマモ | Zostera maina | トチカガミ科 | 352 | The same Japanese plant name appears with multiple families. | アマモ科 / トチカガミ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イイデトリカブト | Aconitun iidemontantm | キンボウゲ科 | 478 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イシガキカラスウリ | Trichosantbes homophylla var. ishigakiensis | ドクウツギ科 | 619 | The same Japanese plant name appears with multiple families. | ウリ科 / ドクウツギ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イシガキソウ | Sciaphila multiflora | ヤマノイモ科 | 356 | The same Japanese plant name appears with multiple families. | ホンゴウソウ科 / ヤマノイモ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イソフジ | Sophota tomentosa | ブドウ科 | 526 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イタチササゲ | Lathynus davidii | ブドウ科 | 531 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イタビカズラ | Ficus stumentosa subep | クワ科 | 559 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イチハツ | Iris tectonum | ラン科 | 388 | The same Japanese plant name appears with multiple families. | アヤメ科 / ラン科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イチョウバイカモ | Ramuaculus tppoacus vat | キンボウゲ科 | 490 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イトキンスゲ | Carex hakkodensis | イグサ科 | 408 | The same Japanese plant name appears with multiple families. | イグサ科 / カヤツリグサ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イトキンボウゲ | Rantnculus reptans | キンボウゲ科 | 490 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イトラッキョウ | Alliuun vir gunculae | ススキノキ科 | 390 | The same Japanese plant name appears with multiple families. | ススキノキ科 / ヒガンバナ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イヌハギ | Lespedeza tomeatosa | ブドウ科 | 545 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イラクサ | Urtica thuabergians | クワ科 | 563 | The same Japanese plant name appears with multiple families. | イラクサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イリオモテクマタケラン | Alpinia fabellata | タヌキアヤメ科 | 402 | The same Japanese plant name appears with multiple families. | ショウガ科 / タヌキアヤメ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | イワネコノメソウ | Churysospleniamn echints | スグリ科 | 506 | The same Japanese plant name appears with multiple families. | スグリ科 / ユキノシタ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | ウチワツナギ | Plyllodium pulchellum | ブドウ科 | 547 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | ウミショウブ | Enhiatus acoroides | オモダカ科 | 350 | The same Japanese plant name appears with multiple families. | オモダカ科 / トチカガミ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | ウミヒルモ | Haloplita ovalis | オモダカ科 | 350 | The same Japanese plant name appears with multiple families. | オモダカ科 / トチカガミ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | ウリカワ | Sagittaria pygnses | チシマゼキショウ科 | 349 | The same Japanese plant name appears with multiple families. | オモダカ科 / チシマゼキショウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エゾノホソバトリカブト | Acotitm yuparense var | キンボウゲ科 | 477 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エゾノリュウキンカ | Calttha fstulosa | キンボウゲ科 | 481 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エゾノレンリソウ | Lathvmuss palustris | ブドウ科 | 532 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エダウチタヌキマメ | Crotalaria wcinella subsp. elliptica | ブドウ科 | 528 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エノキマメ | Flemingia mscroplylla var | ブドウ科 | 537 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エビアマモ | Plyilospadix japcaicus | トチカガミ科 | 352 | The same Japanese plant name appears with multiple families. | アマモ科 / トチカガミ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エビスグサ | Senna obtusifolia | ブドウ科 | 525 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エビラフジ | Vicin venosa subsp. cuspidata | ブドウ科 | 531 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | エンジュ | Styphonolobta japonscum | ブドウ科 | 527 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオイタビ | Ficus punila | クワ科 | 560 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオクサボタン | Clemstis speciosa | キンボウゲ科 | 484 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオゴカヨウオウレン | Coptis mantose | キンボウゲ科 | 483 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオバアコウ | Ficus caulocarpa | クワ科 | 559 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオバタケシマラン | Strepopus amplexifolits var | サルトリイバラ科 | 362 | The same Japanese plant name appears with multiple families. | サルトリイバラ科 / ユリ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオバタンキリマメ | Rlyuchosia acumninatifolia | ブドウ科 | 538 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオバノセンナ | Seuna sophaera | ブドウ科 | 525 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオヤマイチジク | Ficus iidana | クワ科 | 561 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オオレイジンソウ | Aconittan inuauae | キンボウゲ科 | 477 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オカメザサ | Shibataea kuaasaca | カヤツリグサ科 | 441 | The same Japanese plant name appears with multiple families. | イネ科 / カヤツリグサ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オガサワラグワ | Monus boninensis | クワ科 | 561 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オキナワセンニンソウ | Cleastis alsomitnifolis | キンボウゲ科 | 486 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オグラノフサモ | Myriophaylfumn oguaeuse | ベンケイソウ科 | 520 | The same Japanese plant name appears with multiple families. | アリノトウグサ科 / ベンケイソウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オモダカ | Sagitaria trifolia | チシマゼキショウ科 | 349 | The same Japanese plant name appears with multiple families. | オモダカ科 / チシマゼキショウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | オヤマノエンドウ | Oxytropts japonica vat | ブドウ科 | 534 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カカツガユ | Maclura cochunchunensts | クワ科 | 561 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カキノハグサ | Polygala reini | ブドウ科 | 548 | The same Japanese plant name appears with multiple families. | ヒメハギ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カジノキ | Broussonetia papynifera | クワ科 | 562 | The same Japanese plant name appears with multiple families. | アサ科 / クワ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カスマグサ | Vicaa tetrasperma | ブドウ科 | 530 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カタバミ | Oxalis comiculata | ニシキギ科 | 627 | The same Japanese plant name appears with multiple families. | カタバミ科 / ニシキギ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カナムグラ | Humaulus scandens | ニレ科 | 557 | The same Japanese plant name appears with multiple families. | アサ科 / ニレ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カラスキバサンキライ | Heterosmilax japcnuca | シュロソウ科 | 360 | The same Japanese plant name appears with multiple families. | サルトリイバラ科 / シュロソウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カラハナソウ | Hunlus lupalus var | ニレ科 | 557 | The same Japanese plant name appears with multiple families. | アサ科 / ニレ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カラフトイワスゲ | Cares nupestis | イグサ科 | 408 | The same Japanese plant name appears with multiple families. | イグサ科 / カヤツリグサ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カラマツソウ | Thnlictnun aguilegifoliama var. intermiediumn | キンボウゲ科 | 493 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | カワツルモ | Ruppia martimn | アマモ科 | 353 | The same Japanese plant name appears with multiple families. | アマモ科 / カワツルモ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | ガシャモク | Potamogeton fucens | アマモ科 | 352 | The same Japanese plant name appears with multiple families. | アマモ科 / ヒルムシロ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | ガッサントリカブト | Aconituan gassanense | キンボウゲ科 | 478 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キイイトラッキョウ | Alliumn kiense | ススキノキ科 | 390 | The same Japanese plant name appears with multiple families. | ススキノキ科 / ヒガンバナ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キカラスウリ | Thichosanthes kirilowii vas | ドクウツギ科 | 619 | The same Japanese plant name appears with multiple families. | ウリ科 / ドクウツギ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キタダケキンボウゲ | Rantnculus kitadakeanus | キンボウゲ科 | 491 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キタヤマオウレン | Copbs iitayamensts | キンボウゲ科 | 483 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キツネノボタン | Rantnculus silerifolinus vat | キンボウゲ科 | 493 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キハギ | Leipedeza buergeni | ブドウ科 | 544 | The same Japanese plant name appears with multiple families. | ハマビシ科 / ブドウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キバナサバノオ | Dichocarpum pterigionocaudatum | キンボウゲ科 | 482 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キバナチゴユリ | Disporum futescens | シュロソウ科 | 360 | The same Japanese plant name appears with multiple families. | イヌサフラン科 / シュロソウ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キバナノアツモリソウ | Cypripedinum yataleantmn | ユリ科 | 367 | The same Japanese plant name appears with multiple families. | ユリ科 / ラン科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キヨミトリカブト | Aconittam kiyomiense | キンボウゲ科 | 478 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
| 90 | raw_only_no_profile_facts | duplicate_name_family_conflict | キリギシソウ | Calliaathemmum kinigisbiense | キンボウゲ科 | 489 | The same Japanese plant name appears with multiple families. | キンボウゲ科 / キンポウゲ科 |
