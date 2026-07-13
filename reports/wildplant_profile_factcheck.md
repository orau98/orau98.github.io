# Wild Plant Profile Fact Check

Generated: 2026-07-13T03:04:14

This report audits the OCR-derived `normalized_data/plant_profiles.csv` data for likely hallucinations or OCR/parser artifacts. It is a review list, not an automatic deletion list.

Display safety rules: taxonomy-only OCR fragments are excluded from site profile output, and YList taxonomy is preferred over OCR taxonomy when the plant is already known to the site.

## Summary

- Audited rows: 4884
- Profile candidate rows with factual fields: 4884
- Findings: 3773
- Original-PDF taxonomy review ledger rows: 557
- Reviewed taxonomy findings excluded from this unresolved list: 104
- High-priority findings (score >= 80): 0
- High-priority profile-candidate findings: 0
- OCR caches: 日本の野生植物 第1巻: /Users/akimotohiroki/Codex_offload/wildplant_ocr_cache/jp_wild_plants_1

## Source Counts

| Source | Rows | Profile candidate rows | High-priority profile-candidate findings |
| --- | ---: | ---: | ---: |
| 日本の野生植物 第1巻 | 2487 | 2487 | 0 |
| 日本の野生植物 第2巻 | 2397 | 2397 | 0 |

## High-Priority Profile-Candidate Findings By Source

| Source | Category | Count |
| --- | --- | ---: |

## Category Counts

| Category | Count |
| --- | ---: |
| ocr_page_missing | 2397 |
| genus_scientific_conflicts_with_scientific_name | 1292 |
| ylist_scientific_name_conflict | 84 |

## Profile-Candidate Category Counts

| Category | Count |
| --- | ---: |
| ocr_page_missing | 2397 |
| genus_scientific_conflicts_with_scientific_name | 1292 |
| ylist_scientific_name_conflict | 84 |

## Top 100 Profile-Candidate Findings

| Score | Category | Plant | Scientific name | Family | Page | Reason | Expected/check |
| ---: | --- | --- | --- | --- | ---: | --- | --- |
| 78 | genus_scientific_conflicts_with_scientific_name | アイナエ | Mitrasaeme pygmaea | マチン科 | 158 | The row's genus field should match the first word of the scientific name. | mitrasaeme |
| 78 | genus_scientific_conflicts_with_scientific_name | アイヌソモソモ | Poa fauriei | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | genus_scientific_conflicts_with_scientific_name | アオイカズラ | Streptolirion lineare | ツユクサ科 | 103 | The row's genus field should match the first word of the scientific name. | streptolirion |
| 78 | genus_scientific_conflicts_with_scientific_name | アオイチゴツナギ | Poa alta | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | genus_scientific_conflicts_with_scientific_name | アオウキクサ | Lemna aoukikusa | サトイモ科 | 44 | The row's genus field should match the first word of the scientific name. | lemna |
| 78 | genus_scientific_conflicts_with_scientific_name | アオガヤツリ | Cyperus nipponieus | カヤツリグサ科 | 131 | The row's genus field should match the first word of the scientific name. | cyperus |
| 78 | genus_scientific_conflicts_with_scientific_name | アオキラン | Epipogium japonieum | ラン科 | 77 | The row's genus field should match the first word of the scientific name. | epipogium |
| 78 | genus_scientific_conflicts_with_scientific_name | アオギリ | Firmiana simnplex | アオイ科 | 61 | The row's genus field should match the first word of the scientific name. | firmiana |
| 78 | genus_scientific_conflicts_with_scientific_name | アオスゲ | Cares leueochlora | カヤツリグサ科 | 123 | The row's genus field should match the first word of the scientific name. | cares |
| 78 | genus_scientific_conflicts_with_scientific_name | アオチドリ | Dactylorhiza viridis | ラン科 | 76 | The row's genus field should match the first word of the scientific name. | dactylorhiza |
| 78 | genus_scientific_conflicts_with_scientific_name | アオテンツキ | Fimnbristylis dipsacea | カヤツリグサ科 | 134 | The row's genus field should match the first word of the scientific name. | fimnbristylis |
| 78 | genus_scientific_conflicts_with_scientific_name | アオノイワレンゲ | Orostachys malacophylla | ベンケイソウ科 | 213 | The row's genus field should match the first word of the scientific name. | orostachys |
| 78 | genus_scientific_conflicts_with_scientific_name | アオノツガザクラ | Plyllodoce aleutica | ツツジ科 | 133 | The row's genus field should match the first word of the scientific name. | plyllodoce |
| 78 | genus_scientific_conflicts_with_scientific_name | アオバナハイノキ | Symplocos liukiuensis | ハイノキ科 | 126 | The row's genus field should match the first word of the scientific name. | symplocos |
| 78 | genus_scientific_conflicts_with_scientific_name | アオバノキ | Symplocos cochinchinensis | ハイノキ科 | 126 | The row's genus field should match the first word of the scientific name. | symplocos |
| 78 | genus_scientific_conflicts_with_scientific_name | アオミズ | Pilea pumila | イラクサ科 | 259 | The row's genus field should match the first word of the scientific name. | pilea |
| 78 | genus_scientific_conflicts_with_scientific_name | アオヤギソウ | Veratrum maackii | シュロソウ科 | 63 | The row's genus field should match the first word of the scientific name. | veratrum |
| 78 | genus_scientific_conflicts_with_scientific_name | アカササゲ | Vigna vexillata | ハマビシ科 | 243 | The row's genus field should match the first word of the scientific name. | vigna |
| 78 | genus_scientific_conflicts_with_scientific_name | アカミズキ | Wendlandia formosana | アカネ科 | 153 | The row's genus field should match the first word of the scientific name. | wendlandia |
| 78 | genus_scientific_conflicts_with_scientific_name | アカミノイヌホオズキ | Solanum villlosum | ナス科 | 173 | The row's genus field should match the first word of the scientific name. | solanum |
| 78 | genus_scientific_conflicts_with_scientific_name | アカミノルイヨウショウマ | Actaea erythroearpa | キンポウゲ科 | 185 | The row's genus field should match the first word of the scientific name. | actaea |
| 78 | genus_scientific_conflicts_with_scientific_name | アカモノ | Gaultheria adenothrix | ツツジ科 | 140 | The row's genus field should match the first word of the scientific name. | gaultheria |
| 78 | genus_scientific_conflicts_with_scientific_name | アカヤシオ | Rhododendron pentaphyllum | ツツジ科 | 136 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | genus_scientific_conflicts_with_scientific_name | アキザキナギラン | Cymbidium aspidistrifolium | ラン科 | 75 | The row's genus field should match the first word of the scientific name. | cymbidium |
| 78 | genus_scientific_conflicts_with_scientific_name | アキニレ | Ulmus parvifolia | ニレ科 | 250 | The row's genus field should match the first word of the scientific name. | ulmus |
| 78 | genus_scientific_conflicts_with_scientific_name | アキノコハマギク | Chrysanthemum arcticum | キク科 | 282 | The row's genus field should match the first word of the scientific name. | chrysanthemum |
| 78 | genus_scientific_conflicts_with_scientific_name | アキノハハコグサ | Pseudognaphalium lypoleucum | キク科 | 287 | The row's genus field should match the first word of the scientific name. | pseudognaphalium |
| 78 | genus_scientific_conflicts_with_scientific_name | アギナシ | Sagittaria aginashi | オモダカ科 | 48 | The row's genus field should match the first word of the scientific name. | sagittaria |
| 78 | genus_scientific_conflicts_with_scientific_name | アクシバ | Vaecinium japonieu | ツツジ科 | 142 | The row's genus field should match the first word of the scientific name. | vaecinium |
| 78 | genus_scientific_conflicts_with_scientific_name | アケボノソウ | Swertia bimaculata | アカネ科 | 157 | The row's genus field should match the first word of the scientific name. | swertia |
| 78 | genus_scientific_conflicts_with_scientific_name | アサガオガラクサ | Evolvulus alsinoides | キョウチクトウ科 | 166 | The row's genus field should match the first word of the scientific name. | evolvulus |
| 78 | genus_scientific_conflicts_with_scientific_name | アサマリンドウ | Gentiana sikokiana | アカネ科 | 155 | The row's genus field should match the first word of the scientific name. | gentiana |
| 78 | genus_scientific_conflicts_with_scientific_name | アシカキ | Leersia japoniea | イネ科 | 147 | The row's genus field should match the first word of the scientific name. | leersia |
| 78 | genus_scientific_conflicts_with_scientific_name | アシタカツツジ | Rhododendron komiyamae | ツツジ科 | 137 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | genus_scientific_conflicts_with_scientific_name | アシボン | Mierostegium vimineum | イネ科 | 169 | The row's genus field should match the first word of the scientific name. | mierostegium |
| 78 | genus_scientific_conflicts_with_scientific_name | アズマザサ | Sasaella ramosa | イネ科 | 146 | The row's genus field should match the first word of the scientific name. | sasaella |
| 78 | genus_scientific_conflicts_with_scientific_name | アズマシャクナゲ | Rhododendron degronianum | ツツジ科 | 136 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | genus_scientific_conflicts_with_scientific_name | アズマツメクサ | Tillaea aguatiea | ベンケイソウ科 | 215 | The row's genus field should match the first word of the scientific name. | tillaea |
| 78 | genus_scientific_conflicts_with_scientific_name | アズマネザサ | Pleioblastus chino | イネ科 | 145 | The row's genus field should match the first word of the scientific name. | pleioblastus |
| 78 | genus_scientific_conflicts_with_scientific_name | アズマホシクサ | Erioeanlon takae | ホシクサ科 | 108 | The row's genus field should match the first word of the scientific name. | erioeanlon |
| 78 | genus_scientific_conflicts_with_scientific_name | アズマレイジンソウ | Aconitum pteroeaule | キンポウゲ科 | 184 | The row's genus field should match the first word of the scientific name. | aconitum |
| 78 | genus_scientific_conflicts_with_scientific_name | アズミトリカブト | Aconitum azumiense | キンポウゲ科 | 184 | The row's genus field should match the first word of the scientific name. | aconitum |
| 78 | genus_scientific_conflicts_with_scientific_name | アセビ | Pieris japonica | ツツジ科 | 141 | The row's genus field should match the first word of the scientific name. | pieris |
| 78 | genus_scientific_conflicts_with_scientific_name | アダン | Pandanus odoratissimus | タコノキ科 | 61 | The row's genus field should match the first word of the scientific name. | pandanus |
| 78 | genus_scientific_conflicts_with_scientific_name | アツバクコ | Lycium sandwicense | ナス科 | 170 | The row's genus field should match the first word of the scientific name. | lycium |
| 78 | genus_scientific_conflicts_with_scientific_name | アツバシマザクラ | Leptopetalum paclyplyllam | アカネ科 | 150 | The row's genus field should match the first word of the scientific name. | leptopetalum |
| 78 | genus_scientific_conflicts_with_scientific_name | アツモリソウ | Cypripedium macranthos | ラン科 | 75 | The row's genus field should match the first word of the scientific name. | cypripedium |
| 78 | genus_scientific_conflicts_with_scientific_name | アプノメ | Dopatrium junceum | オオバコ科 | 185 | The row's genus field should match the first word of the scientific name. | dopatrium |
| 78 | genus_scientific_conflicts_with_scientific_name | アベトウヒレン | Saussurea kurosawae | キク科 | 258 | The row's genus field should match the first word of the scientific name. | saussurea |
| 78 | genus_scientific_conflicts_with_scientific_name | アマギツツジ | Rhododendron amagianum | ツツジ科 | 137 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | genus_scientific_conflicts_with_scientific_name | アマクサミツバツツジ | Rhododendron amakusaense | ツツジ科 | 138 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | genus_scientific_conflicts_with_scientific_name | アマシバ | Symplocos formosana | ハイノキ科 | 126 | The row's genus field should match the first word of the scientific name. | symplocos |
| 78 | genus_scientific_conflicts_with_scientific_name | アマミイケマ | Cynanchum boudieri | キョウチクトウ科 | 160 | The row's genus field should match the first word of the scientific name. | cynanchum |
| 78 | genus_scientific_conflicts_with_scientific_name | アマミチャルメルソウ | Mitella amamiana | ユキノシタ科 | 208 | The row's genus field should match the first word of the scientific name. | mitella |
| 78 | genus_scientific_conflicts_with_scientific_name | アマミナキリスゲ | Cares tabatae | カヤツリグサ科 | 118 | The row's genus field should match the first word of the scientific name. | cares |
| 78 | genus_scientific_conflicts_with_scientific_name | アマミナツヅタ | Parthenocissus heterophylla | ブドウ科 | 218 | The row's genus field should match the first word of the scientific name. | parthenocissus |
| 78 | genus_scientific_conflicts_with_scientific_name | アミガサギリ | Alchornea liukiuensis | トウダイグサ科 | 297 | The row's genus field should match the first word of the scientific name. | alchornea |
| 78 | genus_scientific_conflicts_with_scientific_name | アラゲタデ | Persiearia pulehra | タデ科 | 87 | The row's genus field should match the first word of the scientific name. | persiearia |
| 78 | genus_scientific_conflicts_with_scientific_name | アラゲナツハゼ | Vaecinfum cilatum | ツツジ科 | 142 | The row's genus field should match the first word of the scientific name. | vaecinfum |
| 78 | genus_scientific_conflicts_with_scientific_name | アラゲヒョウタンボク | Lonicera strophiophora | スイカズラ科 | 313 | The row's genus field should match the first word of the scientific name. | lonicera |
| 78 | genus_scientific_conflicts_with_scientific_name | アラサワトウヒレン | Saussurea yanagitae | キク科 | 257 | The row's genus field should match the first word of the scientific name. | saussurea |
| 78 | genus_scientific_conflicts_with_scientific_name | アラシグサ | Boykinia lyeoetonifolia | ユキノシタ科 | 206 | The row's genus field should match the first word of the scientific name. | boykinia |
| 78 | genus_scientific_conflicts_with_scientific_name | アリドオシ | Damnaeantihus indieus | アカネ科 | 146 | The row's genus field should match the first word of the scientific name. | damnaeantihus |
| 78 | genus_scientific_conflicts_with_scientific_name | アリドオシラン | Myrmechis japoniea | ラン科 | 83 | The row's genus field should match the first word of the scientific name. | myrmechis |
| 78 | genus_scientific_conflicts_with_scientific_name | アリノトウグサ | Gonoearpus mieranthus | アリノトウグサ科 | 216 | The row's genus field should match the first word of the scientific name. | gonoearpus |
| 78 | genus_scientific_conflicts_with_scientific_name | アリマグミ | Elaeagaus murakamiana | グミ科 | 246 | The row's genus field should match the first word of the scientific name. | elaeagaus |
| 78 | genus_scientific_conflicts_with_scientific_name | アリモリソウ | Codonacantlus pauciflorus | キツネノマゴ科 | 223 | The row's genus field should match the first word of the scientific name. | codonacantlus |
| 78 | genus_scientific_conflicts_with_scientific_name | アワガエリ | Pheum panieulatum | イネ科 | 156 | The row's genus field should match the first word of the scientific name. | pheum |
| 78 | genus_scientific_conflicts_with_scientific_name | アワムヨウラン | Leeanorehis trachyeaula | ラン科 | 82 | The row's genus field should match the first word of the scientific name. | leeanorehis |
| 78 | genus_scientific_conflicts_with_scientific_name | アンズ | Prunus armeniaca | バラ科 | 276 | The row's genus field should match the first word of the scientific name. | prunus |
| 78 | genus_scientific_conflicts_with_scientific_name | イイデトリカブト | Aconitum idemontanum | キンポウゲ科 | 184 | The row's genus field should match the first word of the scientific name. | aconitum |
| 78 | genus_scientific_conflicts_with_scientific_name | イイヌマムカゴ | Platanthera iinumae | ラン科 | 86 | The row's genus field should match the first word of the scientific name. | platanthera |
| 78 | genus_scientific_conflicts_with_scientific_name | イガガヤツリ | Cyperus polystachyos | カヤツリグサ科 | 130 | The row's genus field should match the first word of the scientific name. | cyperus |
| 78 | genus_scientific_conflicts_with_scientific_name | イシガキカラスウリ | Trichosanthes homophylla | ウリ科 | 290 | The row's genus field should match the first word of the scientific name. | trichosanthes |
| 78 | genus_scientific_conflicts_with_scientific_name | イシモチソウ | Drosera peltata | タデ科 | 91 | The row's genus field should match the first word of the scientific name. | drosera |
| 78 | genus_scientific_conflicts_with_scientific_name | イズカニコウモリ | Parasenecio amagiensis | キク科 | 271 | The row's genus field should match the first word of the scientific name. | parasenecio |
| 78 | genus_scientific_conflicts_with_scientific_name | イズセンリョウ | Maesa japonica | サクラソウ科 | 121 | The row's genus field should match the first word of the scientific name. | maesa |
| 78 | genus_scientific_conflicts_with_scientific_name | イズドコロ | Dioseorea izuensis | ヤマノイモ科 | 59 | The row's genus field should match the first word of the scientific name. | dioseorea |
| 78 | genus_scientific_conflicts_with_scientific_name | イゼナガヤ | Eriachne armitti | イネ科 | 163 | The row's genus field should match the first word of the scientific name. | eriachne |
| 78 | genus_scientific_conflicts_with_scientific_name | イソギク | Chrysanthemum pacificum | キク科 | 283 | The row's genus field should match the first word of the scientific name. | chrysanthemum |
| 78 | genus_scientific_conflicts_with_scientific_name | イソツツジ | Rhododendron diversipilosum | ツツジ科 | 135 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | genus_scientific_conflicts_with_scientific_name | イソフジ | Sophora tomentosa | ハマビシ科 | 239 | The row's genus field should match the first word of the scientific name. | sophora |
| 78 | genus_scientific_conflicts_with_scientific_name | イソホウキギ | Bassia seoparia | ヒユ科 | 101 | The row's genus field should match the first word of the scientific name. | bassia |
| 78 | genus_scientific_conflicts_with_scientific_name | イタチガヤ | Pogonatherum crinitum | イネ科 | 172 | The row's genus field should match the first word of the scientific name. | pogonatherum |
| 78 | genus_scientific_conflicts_with_scientific_name | イチゲイチヤクソウ | Moneses unillora | ツツジ科 | 131 | The row's genus field should match the first word of the scientific name. | moneses |
| 78 | genus_scientific_conflicts_with_scientific_name | イチゴツナギ | Poa sphondylodes | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | genus_scientific_conflicts_with_scientific_name | イチジク | Ficus carica | クワ科 | 254 | The row's genus field should match the first word of the scientific name. | ficus |
| 78 | genus_scientific_conflicts_with_scientific_name | イチョウバイカモ | Ranunculus nipponieus | キンポウゲ科 | 193 | The row's genus field should match the first word of the scientific name. | ranunculus |
| 78 | genus_scientific_conflicts_with_scientific_name | イトイチゴツナギ | Poa matsumurne | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | genus_scientific_conflicts_with_scientific_name | イトイヌノハナヒゲ | Rhyuchospora faberi | カヤツリグサ科 | 136 | The row's genus field should match the first word of the scientific name. | rhyuchospora |
| 78 | genus_scientific_conflicts_with_scientific_name | イトキンスゲ | Cares hakkodensis | カヤツリグサ科 | 115 | The row's genus field should match the first word of the scientific name. | cares |
| 78 | genus_scientific_conflicts_with_scientific_name | イトハナビテンツキ | Bulbostylis densa | カヤツリグサ科 | 113 | The row's genus field should match the first word of the scientific name. | bulbostylis |
| 78 | genus_scientific_conflicts_with_scientific_name | イトモ | Potamogeton berehtoldii | ヒルムシロ科 | 53 | The row's genus field should match the first word of the scientific name. | potamogeton |
| 78 | genus_scientific_conflicts_with_scientific_name | イトラッキョウ | Allum virgunculae | ヒガンバナ科 | 94 | The row's genus field should match the first word of the scientific name. | allum |
| 78 | genus_scientific_conflicts_with_scientific_name | イナトウヒレン | Saussurea inaensis | キク科 | 256 | The row's genus field should match the first word of the scientific name. | saussurea |
| 78 | genus_scientific_conflicts_with_scientific_name | イナモリソウ | Pseudopysis depressa | アカネ科 | 151 | The row's genus field should match the first word of the scientific name. | pseudopysis |
| 78 | genus_scientific_conflicts_with_scientific_name | イヌイトモ | Potamogeton obtusifolius | ヒルムシロ科 | 53 | The row's genus field should match the first word of the scientific name. | potamogeton |
| 78 | genus_scientific_conflicts_with_scientific_name | イヌガシ | Neolitsea aciculata | クスノキ科 | 38 | The row's genus field should match the first word of the scientific name. | neolitsea |
| 78 | genus_scientific_conflicts_with_scientific_name | イヌセンプリ | Swertia tosaensis | アカネ科 | 157 | The row's genus field should match the first word of the scientific name. | swertia |
| 78 | genus_scientific_conflicts_with_scientific_name | イヌノハナヒゲ | Rlyuchospora japonica | カヤツリグサ科 | 136 | The row's genus field should match the first word of the scientific name. | rlyuchospora |

## Top 100 Raw CSV Findings

| Score | Scope | Category | Plant | Scientific name | Family | Page | Reason | Expected/check |
| ---: | --- | --- | --- | --- | --- | ---: | --- | --- |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アイナエ | Mitrasaeme pygmaea | マチン科 | 158 | The row's genus field should match the first word of the scientific name. | mitrasaeme |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アイヌソモソモ | Poa fauriei | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオイカズラ | Streptolirion lineare | ツユクサ科 | 103 | The row's genus field should match the first word of the scientific name. | streptolirion |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオイチゴツナギ | Poa alta | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオウキクサ | Lemna aoukikusa | サトイモ科 | 44 | The row's genus field should match the first word of the scientific name. | lemna |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオガヤツリ | Cyperus nipponieus | カヤツリグサ科 | 131 | The row's genus field should match the first word of the scientific name. | cyperus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオキラン | Epipogium japonieum | ラン科 | 77 | The row's genus field should match the first word of the scientific name. | epipogium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオギリ | Firmiana simnplex | アオイ科 | 61 | The row's genus field should match the first word of the scientific name. | firmiana |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオスゲ | Cares leueochlora | カヤツリグサ科 | 123 | The row's genus field should match the first word of the scientific name. | cares |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオチドリ | Dactylorhiza viridis | ラン科 | 76 | The row's genus field should match the first word of the scientific name. | dactylorhiza |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオテンツキ | Fimnbristylis dipsacea | カヤツリグサ科 | 134 | The row's genus field should match the first word of the scientific name. | fimnbristylis |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオノイワレンゲ | Orostachys malacophylla | ベンケイソウ科 | 213 | The row's genus field should match the first word of the scientific name. | orostachys |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオノツガザクラ | Plyllodoce aleutica | ツツジ科 | 133 | The row's genus field should match the first word of the scientific name. | plyllodoce |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオバナハイノキ | Symplocos liukiuensis | ハイノキ科 | 126 | The row's genus field should match the first word of the scientific name. | symplocos |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオバノキ | Symplocos cochinchinensis | ハイノキ科 | 126 | The row's genus field should match the first word of the scientific name. | symplocos |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオミズ | Pilea pumila | イラクサ科 | 259 | The row's genus field should match the first word of the scientific name. | pilea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アオヤギソウ | Veratrum maackii | シュロソウ科 | 63 | The row's genus field should match the first word of the scientific name. | veratrum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アカササゲ | Vigna vexillata | ハマビシ科 | 243 | The row's genus field should match the first word of the scientific name. | vigna |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アカミズキ | Wendlandia formosana | アカネ科 | 153 | The row's genus field should match the first word of the scientific name. | wendlandia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アカミノイヌホオズキ | Solanum villlosum | ナス科 | 173 | The row's genus field should match the first word of the scientific name. | solanum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アカミノルイヨウショウマ | Actaea erythroearpa | キンポウゲ科 | 185 | The row's genus field should match the first word of the scientific name. | actaea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アカモノ | Gaultheria adenothrix | ツツジ科 | 140 | The row's genus field should match the first word of the scientific name. | gaultheria |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アカヤシオ | Rhododendron pentaphyllum | ツツジ科 | 136 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アキザキナギラン | Cymbidium aspidistrifolium | ラン科 | 75 | The row's genus field should match the first word of the scientific name. | cymbidium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アキニレ | Ulmus parvifolia | ニレ科 | 250 | The row's genus field should match the first word of the scientific name. | ulmus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アキノコハマギク | Chrysanthemum arcticum | キク科 | 282 | The row's genus field should match the first word of the scientific name. | chrysanthemum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アキノハハコグサ | Pseudognaphalium lypoleucum | キク科 | 287 | The row's genus field should match the first word of the scientific name. | pseudognaphalium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アギナシ | Sagittaria aginashi | オモダカ科 | 48 | The row's genus field should match the first word of the scientific name. | sagittaria |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アクシバ | Vaecinium japonieu | ツツジ科 | 142 | The row's genus field should match the first word of the scientific name. | vaecinium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アケボノソウ | Swertia bimaculata | アカネ科 | 157 | The row's genus field should match the first word of the scientific name. | swertia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アサガオガラクサ | Evolvulus alsinoides | キョウチクトウ科 | 166 | The row's genus field should match the first word of the scientific name. | evolvulus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アサマリンドウ | Gentiana sikokiana | アカネ科 | 155 | The row's genus field should match the first word of the scientific name. | gentiana |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アシカキ | Leersia japoniea | イネ科 | 147 | The row's genus field should match the first word of the scientific name. | leersia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アシタカツツジ | Rhododendron komiyamae | ツツジ科 | 137 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アシボン | Mierostegium vimineum | イネ科 | 169 | The row's genus field should match the first word of the scientific name. | mierostegium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズマザサ | Sasaella ramosa | イネ科 | 146 | The row's genus field should match the first word of the scientific name. | sasaella |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズマシャクナゲ | Rhododendron degronianum | ツツジ科 | 136 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズマツメクサ | Tillaea aguatiea | ベンケイソウ科 | 215 | The row's genus field should match the first word of the scientific name. | tillaea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズマネザサ | Pleioblastus chino | イネ科 | 145 | The row's genus field should match the first word of the scientific name. | pleioblastus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズマホシクサ | Erioeanlon takae | ホシクサ科 | 108 | The row's genus field should match the first word of the scientific name. | erioeanlon |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズマレイジンソウ | Aconitum pteroeaule | キンポウゲ科 | 184 | The row's genus field should match the first word of the scientific name. | aconitum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アズミトリカブト | Aconitum azumiense | キンポウゲ科 | 184 | The row's genus field should match the first word of the scientific name. | aconitum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アセビ | Pieris japonica | ツツジ科 | 141 | The row's genus field should match the first word of the scientific name. | pieris |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アダン | Pandanus odoratissimus | タコノキ科 | 61 | The row's genus field should match the first word of the scientific name. | pandanus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アツバクコ | Lycium sandwicense | ナス科 | 170 | The row's genus field should match the first word of the scientific name. | lycium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アツバシマザクラ | Leptopetalum paclyplyllam | アカネ科 | 150 | The row's genus field should match the first word of the scientific name. | leptopetalum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アツモリソウ | Cypripedium macranthos | ラン科 | 75 | The row's genus field should match the first word of the scientific name. | cypripedium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アプノメ | Dopatrium junceum | オオバコ科 | 185 | The row's genus field should match the first word of the scientific name. | dopatrium |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アベトウヒレン | Saussurea kurosawae | キク科 | 258 | The row's genus field should match the first word of the scientific name. | saussurea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマギツツジ | Rhododendron amagianum | ツツジ科 | 137 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマクサミツバツツジ | Rhododendron amakusaense | ツツジ科 | 138 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマシバ | Symplocos formosana | ハイノキ科 | 126 | The row's genus field should match the first word of the scientific name. | symplocos |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマミイケマ | Cynanchum boudieri | キョウチクトウ科 | 160 | The row's genus field should match the first word of the scientific name. | cynanchum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマミチャルメルソウ | Mitella amamiana | ユキノシタ科 | 208 | The row's genus field should match the first word of the scientific name. | mitella |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマミナキリスゲ | Cares tabatae | カヤツリグサ科 | 118 | The row's genus field should match the first word of the scientific name. | cares |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アマミナツヅタ | Parthenocissus heterophylla | ブドウ科 | 218 | The row's genus field should match the first word of the scientific name. | parthenocissus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アミガサギリ | Alchornea liukiuensis | トウダイグサ科 | 297 | The row's genus field should match the first word of the scientific name. | alchornea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アラゲタデ | Persiearia pulehra | タデ科 | 87 | The row's genus field should match the first word of the scientific name. | persiearia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アラゲナツハゼ | Vaecinfum cilatum | ツツジ科 | 142 | The row's genus field should match the first word of the scientific name. | vaecinfum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アラゲヒョウタンボク | Lonicera strophiophora | スイカズラ科 | 313 | The row's genus field should match the first word of the scientific name. | lonicera |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アラサワトウヒレン | Saussurea yanagitae | キク科 | 257 | The row's genus field should match the first word of the scientific name. | saussurea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アラシグサ | Boykinia lyeoetonifolia | ユキノシタ科 | 206 | The row's genus field should match the first word of the scientific name. | boykinia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アリドオシ | Damnaeantihus indieus | アカネ科 | 146 | The row's genus field should match the first word of the scientific name. | damnaeantihus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アリドオシラン | Myrmechis japoniea | ラン科 | 83 | The row's genus field should match the first word of the scientific name. | myrmechis |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アリノトウグサ | Gonoearpus mieranthus | アリノトウグサ科 | 216 | The row's genus field should match the first word of the scientific name. | gonoearpus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アリマグミ | Elaeagaus murakamiana | グミ科 | 246 | The row's genus field should match the first word of the scientific name. | elaeagaus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アリモリソウ | Codonacantlus pauciflorus | キツネノマゴ科 | 223 | The row's genus field should match the first word of the scientific name. | codonacantlus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アワガエリ | Pheum panieulatum | イネ科 | 156 | The row's genus field should match the first word of the scientific name. | pheum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アワムヨウラン | Leeanorehis trachyeaula | ラン科 | 82 | The row's genus field should match the first word of the scientific name. | leeanorehis |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | アンズ | Prunus armeniaca | バラ科 | 276 | The row's genus field should match the first word of the scientific name. | prunus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イイデトリカブト | Aconitum idemontanum | キンポウゲ科 | 184 | The row's genus field should match the first word of the scientific name. | aconitum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イイヌマムカゴ | Platanthera iinumae | ラン科 | 86 | The row's genus field should match the first word of the scientific name. | platanthera |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イガガヤツリ | Cyperus polystachyos | カヤツリグサ科 | 130 | The row's genus field should match the first word of the scientific name. | cyperus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イシガキカラスウリ | Trichosanthes homophylla | ウリ科 | 290 | The row's genus field should match the first word of the scientific name. | trichosanthes |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イシモチソウ | Drosera peltata | タデ科 | 91 | The row's genus field should match the first word of the scientific name. | drosera |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イズカニコウモリ | Parasenecio amagiensis | キク科 | 271 | The row's genus field should match the first word of the scientific name. | parasenecio |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イズセンリョウ | Maesa japonica | サクラソウ科 | 121 | The row's genus field should match the first word of the scientific name. | maesa |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イズドコロ | Dioseorea izuensis | ヤマノイモ科 | 59 | The row's genus field should match the first word of the scientific name. | dioseorea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イゼナガヤ | Eriachne armitti | イネ科 | 163 | The row's genus field should match the first word of the scientific name. | eriachne |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イソギク | Chrysanthemum pacificum | キク科 | 283 | The row's genus field should match the first word of the scientific name. | chrysanthemum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イソツツジ | Rhododendron diversipilosum | ツツジ科 | 135 | The row's genus field should match the first word of the scientific name. | rhododendron |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イソフジ | Sophora tomentosa | ハマビシ科 | 239 | The row's genus field should match the first word of the scientific name. | sophora |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イソホウキギ | Bassia seoparia | ヒユ科 | 101 | The row's genus field should match the first word of the scientific name. | bassia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イタチガヤ | Pogonatherum crinitum | イネ科 | 172 | The row's genus field should match the first word of the scientific name. | pogonatherum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イチゲイチヤクソウ | Moneses unillora | ツツジ科 | 131 | The row's genus field should match the first word of the scientific name. | moneses |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イチゴツナギ | Poa sphondylodes | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イチジク | Ficus carica | クワ科 | 254 | The row's genus field should match the first word of the scientific name. | ficus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イチョウバイカモ | Ranunculus nipponieus | キンポウゲ科 | 193 | The row's genus field should match the first word of the scientific name. | ranunculus |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イトイチゴツナギ | Poa matsumurne | イネ科 | 157 | The row's genus field should match the first word of the scientific name. | poa |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イトイヌノハナヒゲ | Rhyuchospora faberi | カヤツリグサ科 | 136 | The row's genus field should match the first word of the scientific name. | rhyuchospora |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イトキンスゲ | Cares hakkodensis | カヤツリグサ科 | 115 | The row's genus field should match the first word of the scientific name. | cares |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イトハナビテンツキ | Bulbostylis densa | カヤツリグサ科 | 113 | The row's genus field should match the first word of the scientific name. | bulbostylis |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イトモ | Potamogeton berehtoldii | ヒルムシロ科 | 53 | The row's genus field should match the first word of the scientific name. | potamogeton |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イトラッキョウ | Allum virgunculae | ヒガンバナ科 | 94 | The row's genus field should match the first word of the scientific name. | allum |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イナトウヒレン | Saussurea inaensis | キク科 | 256 | The row's genus field should match the first word of the scientific name. | saussurea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イナモリソウ | Pseudopysis depressa | アカネ科 | 151 | The row's genus field should match the first word of the scientific name. | pseudopysis |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イヌイトモ | Potamogeton obtusifolius | ヒルムシロ科 | 53 | The row's genus field should match the first word of the scientific name. | potamogeton |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イヌガシ | Neolitsea aciculata | クスノキ科 | 38 | The row's genus field should match the first word of the scientific name. | neolitsea |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イヌセンプリ | Swertia tosaensis | アカネ科 | 157 | The row's genus field should match the first word of the scientific name. | swertia |
| 78 | profile_candidate | genus_scientific_conflicts_with_scientific_name | イヌノハナヒゲ | Rlyuchospora japonica | カヤツリグサ科 | 136 | The row's genus field should match the first word of the scientific name. | rlyuchospora |
