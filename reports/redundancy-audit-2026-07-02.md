# 冗長性・階層性 監査レポート（2026-07-02）

リポジトリ全体（data / normalized_data / public / scripts / src / reports / archive / docs / CI）を対象に、重複・冗長・階層構造の乱れを洗い出したもの。各項目は md5 照合・grep・参照追跡で裏取り済み。

**このレポートは現状の棚卸しであり、修正は未実施。** 実施可否は項目ごとにユーザー判断とする。

---

## エグゼクティブサマリ（影響の大きい順）

| # | 問題 | 規模 | 種別 |
|---|---|---|---|
| 1 | `public/images/resized/` がビルド成果物なのにコミット | **285MB / 6654ファイル** | リポジトリ肥大 |
| 2 | `public/{insects,hostplants,general_notes}.csv` が `normalized_data/` と byte 完全一致で二重コミット | 約5.2MB | データ二重保持 |
| 3 | サイトマップ/SEO ファイルの完全重複＋参照ゼロのデッド | 4系統・約3MB | 生成物の氾濫 |
| 4 | `CLAUDE.md` がデータフロー・デプロイ・スクリプト名で現状と**矛盾** | 誤情報 | ドキュメント陳腐化 |
| 5 | ビルド手順が prebuild / ci.yml / deploy.yml の**3箇所で三重定義** | ドリフト危険 | CI 冗長 |
| 6 | 植物名「科名」正規化ロジックが5実装に散在／詳細ページ間で約200行コピペ | 保守コスト | コード重複 |
| 7 | one-off インポートスクリプト約17本が入力消失で実行不能なまま残存 | scripts/ の肥大 | 歴史的残骸 |
| 8 | `archive/` に参照ゼロ1.9MB＋壊れた参照、README が実在しない5ファイルを記載 | 3.4MB | 死蔵・陳腐化 |

---

## 1. データレイヤー（source of truth の二重化）

**正**: `docs/data-management.md` / `data-structure.md` が `normalized_data/*.csv` を唯一の一次データと規定。`public/*.csv` は `scripts/sync-public-insects-csv.mjs` が `copyFileSync` で生成するコピー。

- **`public/{insects,hostplants,general_notes}.csv` は `normalized_data/` と md5 完全一致**（insects `22d17ed…`, hostplants `cbef5d0…`）で、**両方が git 追跡済み**（約5.2MB の二重コミット）。
  - `public/` 側は `prebuild` の先頭 `sync:public-insects` で毎回再生成されるため、原理上はコミット不要。
  - **ただし即削除は不可**: `src/MothDetail.jsx:271` が本番でも `public/hostplants.csv` を直接 fetch、DEV の `src/services/legacyCsvPipeline.js` も生 CSV をパースする。gitignore 化するにはこれらの実消費経路を data-lite JSON へ寄せる前提整理が要る。
- **`data/moth_ecology_book*.csv`（9本・約390KB, 追跡済み）**: `scripts/add_book*.mjs` のインポート入力。すでに `general_notes.csv`/`hostplants.csv` へ取り込み済みで、ランタイム・prebuild からは未参照。provenance 用途以外はデッド。batch3/batch4 の csv は対応スクリプトが既に無く入力だけ残存。
- **正しい派生関係（重複ではない）**: `normalized_data/ylist-lite.json`（一次）→ `public/assets/data-lite/ylist-lite.json`（gitignore 済み生成物）。`plant_profiles.csv` も同様に単一。

### 壊れた fetch パス（存在しないファイルを読もうとする残骸）
- `src/HostPlantDetail.jsx` / `legacyCsvPipeline.js` / `generate-meta-pages.js` が `public/ListMJ_hostplants_master.csv`・`public/20210514YList_download.csv`・`public/genus_mapping.csv` を参照 → いずれも public に**存在しない**（YList は ylist-lite.json へ移行済み）。DEV レガシー経路・SEO 生成の残骸。

---

## 2. public/ の生成物氾濫（2.9GB / 7495ファイル、全追跡）

### 2-1. サイトマップ／SEO（生成元はすべて `scripts/generate-sitemap-split.js`）

md5 照合で確認した完全重複グループとデッド:

| 内容 | 同一の複製 | 状態 |
|---|---|---|
| 詳細XML(16KB) | `search-console-submit.xml`(正) = `search-console-sitemap.xml` = `google-sitemap.xml` = `gsc-sitemap.xml` | 後2つ参照ゼロ=**デッド** |
| indexXML(2KB) | `sitemap.xml`(正) = `sitemap-index.xml` = `sitemap_index.xml` | `sitemap_index.xml`(旧名)=**デッド** |
| txt(4.4KB) | `google-sitemap.txt` = `gsc-sitemap.txt` = `search-console-sitemap.txt` = `search-console-submit.txt`（md5 `18bcd19…`） | **4本とも参照ゼロ=デッド** |
| 全URLtxt(≈1MB) | `sitemap.txt` = `sitemap-all.txt` | **2本とも参照ゼロ=デッド（約1MBの純粋な無駄）** |

- **デッド一覧**（robots.txt / index.html / sitemap-index / scripts / src のどこからも到達不能なのに毎回生成・コミット）: `google-sitemap.xml/.txt`, `gsc-sitemap.xml/.txt`, `gsc-index-sitemap.xml`, `search-console-sitemap.txt`, `search-console-submit.txt`, `sitemap.txt`, `sitemap-all.txt`, `sitemap_index.xml`。
- **正当（参照あり・残す）**: `sitemap-core.xml`, カテゴリ別 `sitemap-{moth,butterfly,…}.xml` と `sitemap-en-*`, `sitemap-main.xml`, `google-feed.xml`/`google-atom.xml`, `sitemap.html`。

### 2-2. 画像（最大の肥大）

| ディレクトリ | サイズ | 数 | 内容 |
|---|---|---|---|
| images/insects | 2.3GB | 480 | 原本 |
| images/plants | 303MB | 266 | 原本 |
| **images/resized** | **285MB** | **6654** | `build-responsive-images.mjs` の派生（avif/jpg/webp × 各解像度） |

- `resized/` は**再生成可能なビルド成果物**。`.gitignore` に「増分ビルド未整備のため当面コミット維持」と明記されており、作者も暫定と認識済み。**最大の削減余地**。
- インデックス（`image_filenames.txt`, `image_extensions.json`, `plant_image_filenames.txt`）はランタイム fetch されるが prebuild で毎回再生成 → コミットは利便目的の重複。

### 2-3. その他
- **Instagram**: `instagram_posts.json`(構造化) / `instagram_posts.txt`(URL列・フォールバック) / `instagram_latest.txt`(1件) は同一元データの3表現。`instagram_latest.txt` は生成元・消費者ともコード内参照なし=**実質デッド**。画像10枚とjson参照は過不足なし。
- **`public/moth-monitoring/`（8.2MB・27ファイル）**: 蛾類モニタリングの独立静的サイト。図鑑本体（scripts/src/index.html）からリンク・参照ゼロで**完全に孤立**。同ドメイン相乗りの別サブサイト。

---

## 3. scripts/（76本＋lib3＋tools1）

### 3-1. 実行不能なまま残る one-off（入力消失、archiving 最優先）
PDF/OCR/中間レポートを入力とするが `pdfs/` がリポジトリに無く再実行不可。ハードコードされた `/Users/akimotohiroki/…` 絶対パスも多数。

- 約17本: `import-aburamushi-notes.py`, `import_hamakiga3_from_pdf.py`, `fix_hamakiga1_import.py`, `extract_butterfly_emergence_from_book.py`, `extract_zukan1p2.py`, `extract_zukan3_hostplants.py`, `extract_zukan_ecology.py`, `extract_kamikiri_emergence.py`, `ocr_scanned_pdf.py`, `crop_zukan2_species_blocks.py`, `apply_zukan2_*.py`(3本), `audit_zukan2_*.py`(2本), `fix_butterfly_book_import.py`, `sync_missing_insects_from_listmj.py`, `run_extract.ipynb`。
- `apply_zukan2_*` / `fix_butterfly_book_import.py` は入力レポート（`reports/zukan2_*`, `butterfly_book_audit_report.json`）自体が**現存しない**。

### 3-2. 上位互換に置換済み（デッド重複）
- **`extract_kamikiri_hostplants.py` → `.mjs`**: 目的・入出力同一。`.mjs` が npm `extract:kamikiri-hostplants` に wired、`.py`（絶対パス埋め込み）は未参照。
- **`ocr_images_with_vision.swift` → `_boxes.swift`**: plain 版はテキスト連結のみ、boxes 版が text+confidence+bbox の上位互換。plain 版は未参照。
- **zukan2 の text版 ↔ box版**（`apply_zukan2_missing_emergence.py` ↔ `_boxes.py` 等）: box 座標版が後発で text 版を実質置換。
- **`fill_missing_hostplant_family_from_existing.mjs` ↔ `_with_ylist.mjs`**: 同一目的（空 plant_family 補完）のソース違い並行2実装。

### 3-3. コピペされた共有ヘルパ（lib 化余地）
- **Python `read_csv`/`write_csv`**（DictReader/Writer）が10本超で各自定義: `fix_hamakiga1_import.py:197,202` ほか。
- **mjs `loadCsv`/`writeCsv`**（Papa.parse ラッパ）が13本超で重複。
- **`add_book*.mjs` 5本は関数ブロック単位でほぼ逐語コピー**（`loadCsv`+`writeCsv`+`buildInsectIndex`+`guessInsectId`+`normalizeContent`）。1本を lib 化すれば5本が数十行に縮小。
- **`lib/` 内部でも二重定義**: `cleanString` が `lib/taxonomyAssertions.mjs:1` と `lib/dataLiteBuilders.mjs:5` の両方に。
- **JP/EN メタ生成の分岐**: `generate-meta-en-pages.mjs` は `lib/dataLiteBuilders.mjs` を共有するが、**`generate-meta-pages.js`(JP) は lib を使わず `loadCSV`/`normalizePlantName` を自前再実装** → 同種ロジックの二重管理（構造的リスク）。

### 3-4. 脆い暗黙依存・配置の乱れ
- `fix_aphid_nonaphid_links.mjs:12` が別スクリプト `fix_aphid_hostplant_ids.mjs` の**ソースを読んで**内蔵対応表を正規表現で吸い出す（片方を消すと壊れる）。
- `tools/migrate_ambiguous_notes.cjs` は `scripts/` の B 群と同類の one-off なのに `tools/` に1本だけ切り出され、配置基準が不明。
- **`optimize-images.yml` は存在しない `scripts/optimize-images.mjs` を呼ぶ**（`if [ -f ]` ガードで常時スキップ=no-op）。ワークフローかスクリプトのどちらかが陳腐化。

---

## 4. src/（コード重複・階層の乱れ）

### 4-1. 肥大化コンポーネント（行数上位）
| 行数 | ファイル | 問題 |
|---|---|---|
| 5570 | `services/legacyCsvPipeline.js` | DEV専用の巨大パイプライン。本番未実行だが正規化ロジック重複の発生源 |
| 2753 | `components/FoodWebGraph.jsx` | God コンポーネント |
| 2473 | `InsectsHostPlantExplorer.jsx` | タブ/Instagram/統計/URL同期を1ファイル内包 |
| 2333 | `HostPlantDetail.jsx` | ImageModal 内包＋実行時 CSV parse |
| 2136 | `MothDetail.jsx` | 全昆虫分類の詳細を1コンポーネントで処理（命名と責務の不一致） |
| 1083 | `App.jsx` | ルーティング＋約400行の `fetchData` useEffect＋状態14個＋テーマ＋SEO を単一責任逸脱で内包。747-839行にコメントアウト済みデッド約90行 |

### 4-2. 具体的な重複ペア
- **植物名「科名」除去が5実装に散在**（正規版 `src/utils/plantNameUtils.js` があるのに）: `legacyCsvPipeline.js:1115-1160`（約40行コピー）, `MothDetail.jsx:609-612`, `utils/quiz.js:34-38`（MothDetail と同一正規表現）, `FoodWebGraph.jsx:119-124`。
- **`extractFamily`（科名抽出）が3実装**: `plantNameUtils.js:74`（正）, `integratedDataParser.js:228-230`, `EnhancedHostPlantDisplay.jsx:658-661`（後2つは一字一句同一）。
- **`isFlowerVisitRecord`（訪花判定）が2実装**: `MothDetail.jsx:614-622` ↔ `FoodWebGraph.jsx:126-133`。
- **MothDetail.jsx ↔ HostPlantDetail.jsx のコピペ約200行**: シェア/コピーリンク処理（約90行）、useSeoMeta options 構築（約18行）、画像インデックス解決（既存 `hooks/useInsectImageCandidates.js` を使わず手書き再実装 約20-40行）、FoodWebGraph 遅延ラッパ（約25行）、loading/notfound の巨大 JSX（約50行×2）。
- **実行時 CSV parse の孤立**: `HostPlantDetail.jsx` が `genus_mapping.csv`(62-65) と YList CSV(1641-1643) を単独で papaparse（App.jsx の一元ローディングの外側）。

### 4-3. デッドコード・配置不整合
- **未使用 UI コンポーネント**: `components/ui/` の `Button.jsx`・`Chip.jsx`・`SectionHeader.jsx` はどこからも import されず（`{ Button }`/`{ Chip }`/`{ SectionHeader }` の利用ゼロ）。定義・export のみのデッド。
- **pages vs components の分離が未徹底**: ページ相当が src/直下（App/Explorer/MothDetail/HostPlantDetail/QuizPage）と `components/`（`NotFoundPage.jsx`, `MothList.jsx`(2004行), `HostPlantList.jsx`(1541行)）に二分。`pages/` ディレクトリは無し。`App.jsx` の `fetchData`（本番データ取得の本体・約400行）が `services/` でなく App 内インライン。

---

## 5. ドキュメント・CI・archive

### 5-1. CLAUDE.md の矛盾（実害のある誤情報）
- **データフロー矛盾**: CLAUDE.md「1. `public/*.csv` ファイルを更新」(83行) ↔ docs「`normalized_data/*.csv` が source of truth」。CLAUDE.md が旧モデルのまま。
- **デプロイ矛盾**: CLAUDE.md「`npm run deploy` でデプロイ」(71,86行) ↔ 実体は `echo 'Use GitHub Actions...'`、README も「deploy してもデプロイしない」と明記。
- **スクリプト名陳腐化**: CLAUDE.md「`generate-sitemap.js`」(29行) ↔ 実体は `generate-sitemap-split.js`（`generate-sitemap.js` は存在しない）。normalized_data/ への言及もゼロ。

### 5-2. README.md の死んだ手順
- 「🔎 データ整合性」節が `scripts/prune_unknown_insect_refs.mjs`＋`npm run prune-unknown`(206,212行) を案内するが、**スクリプト不在・npm 未登録**の丸ごと死んだ手順。

### 5-3. CI 三重定義
- **ci.yml と deploy.yml が同一ビルド順序を各自列挙**（validate→sync→image-index→data-lite→meta→build→sitemap→postbuild→smoke）。同じ順序は package.json `prebuild` にも存在 → **prebuild・ci.yml・deploy.yml の3箇所でドリフトし得る**。両ワークフローが `npm run build`(prebuild経由) でなく `build:app`(vite単体) を呼び prebuild 相当を手動展開しているのが原因。
- `sitemap.yml` は deploy と生成が重複（ただしクローラ型HTMLサイトマップ追加という独自機能あり）。

### 5-4. reports/（57ファイル・6.6MB、全追跡）
- **まだ入力参照あり（残す）**: `update_candidates.csv`(441KB, `apply_updates.py`/`split_update_candidates.py` が読む)、`migrated_general_notes_ambiguous.json`(`tools/migrate_ambiguous_notes.cjs` が読む)。
- **アーカイブ可能な歴史的成果物 約55本**: 日付入り完了スナップショット（`beetle-reference-*-2026-03-17.*`, `*_ylist_2026-05-01.csv`）、`migrated_*` 事後ログ（修正は normalized_data 反映済み）、大型ワンオフ抽出JSON（`kamikiri_hostplant_list.json` 545KB 等）、大型監査（**`wildplant_profile_factcheck.csv` 3.0MB＝全体の約半分**）。
- **空(0バイト)なのにコミット3本**: `alias_suggestions_from_unmatched.csv`, `alias_suggestions_safe.csv`, `book1_species_without_emergence.csv`（削除候補）。
- src/CI/package.json/prebuild は reports/ を一切参照しない（手動 one-off 専用の書き出し先）。

### 5-5. archive/（3ファイル・3.4MB、全追跡）
- **`insects_integrated_master.csv`(1.9MB) は参照ゼロで完全デッド**。
- `ListMJ_hostplants_master.csv`(1.5MB) は `sync_missing_insects_from_listmj.py:7` が `public/archive/legacy-data/…` を参照するが**実体は `archive/public-archive/legacy-data/…`（パス不整合で機能せず）**。
- `manual-notes/README.md` が実在しない5ファイルと存在しない `scripts/ingest_book1_manual.mjs` を「ここにある」と記述（**陳腐化**）。archive の目的はトップ README/CLAUDE に記載なし。

### 5-6. その他ルートファイル
- `.env.production`: **秘密情報なし**（AdSense 公開ID・アセットバージョンのみ。IG トークンは GitHub Secrets 管理）。
- `requirements.txt`: macOS Vision OCR 依存（pyobjc: `Foundation`/`Quartz`/`Vision`）が未記載。CI は Python 非実行のため実害は限定的だが記載ギャップ。
- `tests/`(13本): `npm test`＝`ci.yml` で確実に走る。陳腐化なし。

---

## 推奨アクション（優先度順）

**A. 低リスク・高効果（すぐ着手可）**
1. デッドサイトマップ削除＋生成側 `generate-sitemap-split.js` から該当出力を止める（`google-*`, `gsc-*`, `search-console-*.txt`, `sitemap.txt`, `sitemap-all.txt`, `sitemap_index.xml`）。約3MB削減。
2. CLAUDE.md の3矛盾を修正（データソース＝normalized_data、`npm run deploy` はデプロイしない、`generate-sitemap-split.js`）。
3. README.md の「prune-unknown」死節を削除。
4. 空コミットの reports 3本を削除。archive の陳腐化 README 修正＋`insects_integrated_master.csv`(参照ゼロ)の扱い決定。
5. 未使用 UI コンポーネント3本（Button/Chip/SectionHeader）削除。

**B. 中リスク（設計判断を伴う）**
6. `public/images/resized/`(285MB) を gitignore 化＋deploy 時の増分生成整備（最大の肥大解消）。
7. one-off スクリプト（3-1/3-2 の約19本）を `scripts/_archive/` へ隔離。壊れた `optimize-images.yml` の要否決定。
8. reports/ の完了済み55本を `reports/archive/` へ移動（特に `wildplant_profile_factcheck.csv` 3.0MB）。
9. 植物名正規化を `plantNameUtils` に一本化（4-2）。scripts の CSV ヘルパを `scripts/lib/csv.mjs` / Python 共有 util に集約。

**C. 大リファクタ（要計画）**
10. CI: prebuild/ci.yml/deploy.yml の三重定義を単一の合成コマンド（例 `npm run build:full`）へ集約。
11. `public/*.csv` の gitignore 化（前提: `MothDetail.jsx`/`legacyCsvPipeline.js` の生CSV依存を data-lite JSON へ移行）。
12. 詳細ページ共通部（share/copy・SEO options・画像解決・FoodWebGraph ラッパ・loading/notfound UI）を hooks/共通コンポーネントへ抽出。`App.jsx` の `fetchData` を `services/` へ移設。ページ配置を `pages/` へ統一。
