# 日本産ハムシ科生態覚書 (6) 全アカウント原本監査（2026-07-12）

## 結論

- 原著 PDF の掲載19ページ（印刷頁33–51、PDF頁35–53）を目視し、全112種アカウントを台帳化した。
- 現行目録の異名欄まで照合し、全112アカウントを現行の正準分類群へ対応させた。
- 食草は206件、出現時期は103件、生態情報は95件を原本確認済みの公開対象とした。
- 亜種名のない Hemipyxis cinctipennis の種レベル情報だけを沖縄本島亜種へ共有し、明示亜種・島嶼限定記録は広げなかった。

## 原本と証拠

- 書誌: Takizawa, H. (2012), Kanagawa-Chûhô 177: 33–51
- 原本 SHA-256: `b16c29ef9ad7f9e017a0d1349c7907c013b7a6e5f53d8beae2d175230262f544`
- action ledger SHA-256: `fd2175310233b1a37c560b282321a868c08ea976065a345fa2d139c17c2ce991`
- OCR・抽出テキストは索引にのみ使い、採否は原PDFページ画像で決定した。
- 旧学名対応は[現行日本列島の甲虫全種目録](https://japanesebeetles.jimdofree.com/目録/134-ハムシ科/134-2-ヒゲナガハムシ亜科/)で確認した。
- `Chaetocnema mandschurica` は[2011年再検討](https://stevelingafelter.com/wp-content/uploads/2018/02/040-LingafelterChaetocnema-Chrysomelidae-2011.pdf)で独立種と確認し、`C. major`へ統合していない。
- p50の日本産 `Longitarsus tabidus` は[2015年原記載](https://coleoptera.sakura.ne.jp/ElytraNS/5-1_233.pdf)と[2024年再検討](https://kmkjournals.com/upload/PDF/EEJ/23/23_6_344_346_Sergeev.pdf)も照合し、`L. osimaensis`へ対応した。

## 修正の要点

- 食草: 最終206件。疑問視された記録、推測食草、非特定の「草本」、記事にない誤帰属を除外した。
- 出現時期: 現行0件から103件へ。月範囲と客観的な採集月だけを採用した。
- 生態: 95件。明示生息地と観察された幼生期のみを採用し、「と思われる」「可能性」「不明」だけの説明を公開文から除いた。
- 分類対応: 現行目録の異名欄を使い、旧学名を重複取込側ではなく正準分類群へ対応させた。Hemipyxis plagioderoides の誤帰属は正準行へ統合した。

## 再現性

- 全アカウント台帳: `data/source_audits/japanese-leaf-beetle-ecology-notes-6-all-accounts-2026-07-12.csv`
- exact action ledger: `data/source_audits/japanese-leaf-beetle-ecology-notes-6-integrity-actions-2026-07-12.json`
- build script: `scripts/_build-japanese-leaf-beetle-ecology-notes-6-audit.mjs`
