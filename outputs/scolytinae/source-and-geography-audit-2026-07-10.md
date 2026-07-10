# キクイムシ亜科 目録・寄主情報監査

監査日: 2026-07-10

## 目録

- 種リスト: [日本列島の甲虫全種目録 2026年版 キクイムシ亜科](https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/129-%E3%82%BE%E3%82%A6%E3%83%A0%E3%82%B7%E7%A7%91/129-17-%E3%82%AD%E3%82%AF%E3%82%A4%E3%83%A0%E3%82%B7%E4%BA%9C%E7%A7%91/)
- 取込種数: 322種
- 分類: Curculionidae / Scolytinae（ゾウムシ科 / キクイムシ亜科）
- 国内分布欄と国外分布欄は、目録のセミコロンを境に別々に保存した。
- 原ページの `2144 Scolytus esuriens` は213と215の間にあるため、連番監査で214へ補正した。原値も監査JSONに保存した。

## 寄主文献

公式配布PDFの原著論文を確認した。

1. [Nobuchi (1964), Studies on Scolytidae III](https://www.ffpri.go.jp/pubs/bulletin/151/documents/171-3.pdf), Bulletin of the Government Forest Experiment Station 171: 129-134.
2. [Nobuchi (1973), Studies on Scolytidae XI](https://www.ffpri.go.jp/pubs/bulletin/251/documents/258-2.pdf), Scolytus, Bulletin of the Government Forest Experiment Station 258.
3. [Nobuchi (1974), Studies on Scolytidae XII](https://www.ffpri.go.jp/pubs/bulletin/251/documents/266-4.pdf), Ipini, Bulletin of the Government Forest Experiment Station 266: 33-60.
4. [Nobuchi (1975), Studies on Scolytidae XIII](https://www.ffpri.go.jp/pubs/bulletin/251/documents/277-3.pdf), Cryphalini, Bulletin of the Government Forest Experiment Station 277: 41-61.
5. [Nobuchi (1979), Studies on Scolytidae XVIII](https://www.ffpri.go.jp/pubs/bulletin/301/documents/308-1.pdf), Polygraphini, Bulletin of the Government Forest Experiment Station 308: 1-16.
6. [Nobuchi (1981), Revision of the genus Xylosandrus from Japan](https://www.ffpri.go.jp/pubs/bulletin/301/documents/314-4.pdf), Bulletin of the Forestry and Forest Products Research Institute 314: 27-37.

これらは原著論文だが、各種の `Host(s)` 欄には先行文献を集約した記録も含まれる。したがって、タイプ標本ラベルや本文が直接示す記録と、産地を伴わない寄主一覧を同じ確度として扱っていない。

## 採否

- 調査した寄主候補: 394件
- 公開データへ採用: 372件（61昆虫種、203植物名）
- 除外・保留: 22件

地域区分:

| 区分 | 件数 | 判定基準 |
|---|---:|---|
| 日本・明記 | 191 | タイプ標本ラベル、採集地、または本文が日本での当該寄主を直接示す |
| 日本・論文範囲 | 93 | 日本産節の寄主欄だが、植物ごとの採集地はない |
| 海外・明記 | 2 | 原著が国外地域を寄主欄へ直接付記する |
| 地域不明 | 86 | 日本と海外を含む分布域から寄主記録の国を分離できない |

地域不明の86件を国内記録へ繰り上げないことが重要である。サイト上でも `文献（地域不明）` として表示する。

Nobuchi (1964) からは、植物名と日本の採集地が同じタイプ標本・標本記録に記された20件だけを国内明記として追加した。OCRだけに依存せずPDF画像を再確認し、原紙上の `1458`、`Acacia mollisima`、`Hylurops longipilis` という表記もそのまま監査した。`Hylesinus oleiperda` - ヤチダモは国内標本記録だが、現行目録の H. toranio への対応を一次分類文献で確定できなかったため保留した。

Nobuchi (1975) からは、タイプ標本・パラタイプの日本産地と `in [植物名]` が同時に記された17件だけを国内明記として追加した。Nobuchi (1981) の Xylosandrus germanus は本文が日本での寄主と明記するため146件を国内明記とした。同論文の X. brevis 18件と X. compactus 18件は国別対応がないため地域不明とし、X. compactus - Camellia sinensis の1件だけはRemarks欄の日本記録により国内明記とした。

Nobuchi (1981) は X. germanus が日本で156植物種から見つかったと本文で述べるが、実際の `Hosts` 欄で列挙を確認できるのは146分類単位だった。差の10件を推測で補わず、列挙された146件だけを収録した。

## 除外理由

- Scolytus chikisanii / S. betulae: 1973年論文は同物異名として一括するが、2026年目録は別種として採用しているため2件を保留。
- Scolytus esuriens / S. trispinosus: 同様に現行目録と原著の種概念が一致せず4件を保留。
- Ips cembrae / I. subelongatus: 1974年論文は一括するが現行目録は別種のため7件を保留。
- 現行目録へ一意に対応しない Scolytus ussuriensis、Pityokteines curvidens、Polygraphus magnus の7件を保留。
- Orthotomicus angulatus - Quercus gilva: 原著自身が寄主記録の誤りかもしれないと注記するため1件を除外。
- Hylesinus oleiperda - Fraxinus mandshurica var. japonica: 国内標本記録自体は明確だが、現行目録の H. toranio への対応を一次分類文献で確定できないため1件を保留。

## 植物名

- 和名・科名・採用学名はYListを優先し、2026-07-10に照合した。
- 旧学名（例: `Larix leptolepis`）は原著植物名として残し、YList採用名（`Larix kaempferi`）を別フィールドに保存した。
- `Neohyorrhynchus niisimai` は[2024年の Sueus 属再検討](https://www.mapress.com/zt/article/download/zootaxa.5477.4.5/53943)で `Sueus niisimai` の異名として明記されるため現行種へ対応した。原著植物名 `Carpinus carpinoides`、`Quercus sieboldiana`、`Styrax japonica`、`Prunus donarium` は原綴りを保存し、YList採用名へ別途正規化した。
- `Quercus sieboldiana` から `Lithocarpus glaber` への対応は[Ohba et al. (2009)](https://www.jstage.jst.go.jp/article/jjapbot/84/4/84_84_4_10148/_pdf/-char/ja)、`Prunus donarium` から `Cerasus jamasakura` への対応は[Ohba & Akiyama (2019)](https://www.kahaku.go.jp/albums/abm.php?d=4698&f=abm00001727.pdf&n=L_BNMNS_B45-4_147.pdf)でも再確認した。
- 1964年原著の `Acacia mollisima Willd.` は、YListで `Acacia mollissima auct. non Willd.` とされるモリシマアカシアへ正規化した。ただし著者名表記との不整合を注記し、原綴りを失わないようにした。
- 種まで同定されていない `Picea sp.`、`Prunus sp.`、`Alnus spp.`、`Acer sp.` は、属レベル記録として扱い、種へ推定しなかった。
- `タカノツメ` はベンケイソウ科植物の別名と同名になるため、樹木側を `タカノツメ（樹木）`（`Gamblea innovans`、ウコギ科）として分離した。

## 再現性

- `scripts/import-scolytinae-catalog.mjs`: 目録HTMLの再取込、322種・連番・学名重複の検査。
- `data/scolytinae_host_record_groups.json`: 原著の寄主候補、地域根拠、採否理由。
- `data/scolytinae_nobuchi_1964_hosts.json`: 1964年論文の画像照合済み標本記録と保留記録。
- `data/scolytinae_xylosandrus_1981_hosts.json`: Xylosandrus 3種のHosts欄とYList照合結果。
- `scripts/import-scolytinae-host-records.mjs`: 現行種ID、地域区分、YList科名を検証して正規化CSVへ反映。
- `outputs/scolytinae/catalog-audit-2026.json`: 目録取込監査。
- `outputs/scolytinae/host-records-audit-2026.json`: 寄主記録の採否監査。

## 未調査範囲

今回の372件は全322種の完全な寄主目録ではない。Nobuchiの他の各報、種別の原記載・生態論文、加辺（1959, 1960）に遡る必要がある。加辺（1959）は国立国会図書館の個人送信対象であり、公開PDFとして一括取得できないため、今回の自動取込には使用していない。
