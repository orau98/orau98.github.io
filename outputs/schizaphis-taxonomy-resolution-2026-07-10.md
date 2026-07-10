# Schizaphis acori / S. rotundiventris 分類・寄主解決記録

作成日: 2026-07-10

## 結論

`Schizaphis (Paraschizaphis) acori` と `Schizaphis rotundiventris` は別種である。1983年の『日本原色アブラムシ図鑑』は、「ショウブアブラムシ `S. rotundiventris`」の異名に `Toxoptera acori` Shinji を含めており、これが種IDと寄主の対応を不明確にした。現行モノグラフはこの同物異名化を明示的に誤りとしている。したがって、主因はOCRの読み落としではなく、原典自体の旧分類である。

そのため、次のように解決した。

| DB種ID | 現行名 | 和名 | 寄主処理 |
| --- | --- | --- | --- |
| `species-21313` | `Schizaphis (Paraschizaphis) acori (Shinji, 1922)` | ショウブアブラムシ | 確実なショウブ1件を追加 |
| `species-21323` | `Schizaphis (Schizaphis) rotundiventris (Signoret, 1860)` | ニセナシアブラムシ | ショウブ、オニガヤツリ、ガマの3件を維持 |

## 根拠

### 和名と種IDの対応

- 『日本昆虫目録 第4巻 準新翅類』134-135頁の原本画像を確認した。`Schizaphis` 属の `Paraschizaphis` 亜属に `acori (Shinji, 1922)` ショウブアブラムシ、`Schizaphis` 亜属に `rotundiventris (Signoret, 1860)` ニセナシアブラムシが別々に掲載される。したがって、`species-21313` と `species-21323` の現行和名・学名対応は正しい。[日本昆虫学会の各巻紹介](https://entsoc.jp/publications/Catalogue_of_the_Insects_of_Japan/) / [NDL書誌](https://ndlsearch.ndl.go.jp/books/R100000002-I027310173)

### S. acoriの有効性とショウブ寄主

- Blackman & Eastopの現行モノグラフは `S. (Paraschizaphis) acori` を有効種とし、日本の `Acorus calamus` 上に生息すると記載する。同時に、本種が `S. rotundiventris` の異名とされてきたのは誤りと明記する。[Schizaphis species account](https://aphidsonworldsplants.info/d_aphids_s/)
- 松本（2005）は赤坂御用地で `Paraschizaphis acori` をショウブの葉身から2003年5月30日、6月20日、7月18日の3回採集し、植物別表でも `Acorus calamus var. angustatus` との対応を示す。これを `species-21313` の寄主レコードの一次根拠とした。[松本嘉幸 2005 PDF](https://www.kahaku.go.jp/albums/abm.php?d=4893&f=abm00003991.pdf&n=p409.pdf)
- 松本（2005）は和名を「ショウブノハアブラムシ（改称）」とするが、2019年の地域目録は `Schizaphis acori` に「ショウブアブラムシ」を用いる。DBでは現行の和名を維持し、松本の和名を別名として追加した。[山口県産アブラムシ類目録 2019 PDF](https://www.city.shimonoseki.lg.jp/uploaded/attachment/16903.pdf)

### S. rotundiventrisの有効性と寄主

- Miyazaki（1988）は `S. rotundiventris` を日本初記録の有効種とし、`Toxoptera cyperi` van der Goot を異名とした。日本産標本は沖縄の `Cyperus` sp. と `Scirpus` sp. から得られている。[Miyazaki 1988, NDL](https://dl.ndl.go.jp/pid/10653578)
- Aphid Species Fileは `S. rotundiventris` の異名に `acori (Theobald, 1923)` を収録する。これは `S. acori` の原記載名 `Toxoptera acori` Shinji, 1922と著者・年が異なる。異名判定では種小名だけでなく著者と年を保持する必要がある。[Aphid Species File](https://aphid.archive.speciesfile.org/Common/basic/Taxa.aspx?TaxonNameID=1166104)
- Blackman & Eastopは `S. rotundiventris` の主要寄主を `Cyperus` 類とし、`Acorus` と `Typha` の記録も認める。寄主別索引ではオニガヤツリ `Cyperus pilosus` と本種の対応も確認できる。[Aphids on the World's Plants 寄主別索引](https://aphidsonworldsplants.info/c_hosts_cra_cyt/)
- 中谷ほか（2016）の宗林正人コレクション目録には、日光、鶴来、津で `Typha latifolia`（ガマ）から得られた `S. rotundiventris` のプレパラート標本が掲載される。[中谷ほか 2016 PDF](https://repository.naro.go.jp/record/3150/files/niaes_report_No37p57-132p.pdf)

### 植物分類

- YListはショウブの標準名を `Acorus calamus L.`、科を Acoraceae（ショウブ科）とする。松本（2005）の `A. calamus var. angustatus` もショウブの異名として収録される。YList優先方針に従い、旧分類のサトイモ科を含むDB内の「ショウブ」全件をショウブ科に統一した。[YList pass=3213](http://ylist.info/ylist_detail_display.php?pass=3213)

## DB修正

1. `species-21313` に「ショウブ」「ショウブ科」「葉身」「松本嘉幸 (2005)」の1レコードを追加した。
2. `species-21313` に別名「ショウブノハアブラムシ」、異名 `Paraschizaphis acori` と `Toxoptera acori` Shinji を追加した。
3. `species-21323` に原組合せ `Schizoneura rotundiventris`、`Aphis acori` Theobald, 1923、`Acaudus calami` Theobald, 1923、`Toxoptera cyperi`、`T. punjabipyri` を追加し、Shinjiの `Toxoptera acori` と同一視しない注記を両種に追加した。
4. `species-21323` の旧図鑑由来の3寄主は維持し、現行モノグラフまたは日本産標本による裏づけを本報告に記録した。
5. DB内の植物名が完全一致する「ショウブ」4レコードの科名をショウブ科に統一し、将来の自動修正にもYList裁定を追加した。
6. 分類対応、寄主、科名、出典リンクを固定する回帰テストを追加した。

## 採用しなかった情報

- `Cyperus difformis` はBlackman & Eastopが「`S. acori` かもしれない」とするにとどまるため、確定寄主に追加していない。
- Higuchi & Miyazaki（1969）などの旧目録にはTheobaldとShinjiの `acori` を併記する処理がある。今回はAphid Species Fileの著者・年とBlackman & Eastopの種概説を優先し、`Aphis acori` Theobald, 1923は `S. rotundiventris`、`Toxoptera acori` Shinji, 1922は `S. acori` に分けた。
- 2019年の山口県目録には過去の `S. rotundiventris` 記録を `S. acori` とした例があるが、個々の標本の再同定根拠が記されないため寄主追加には使用していない。
