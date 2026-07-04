---
name: csv-data-update
description: 昆虫・食草CSVデータの更新ワークフロー。normalized_data/*.csv への種・食草・備考・植物プロフィールの追加や修正、表記ゆれの正規化、更新後の検証を行うときに使用する。「CSVを更新して」「食草を追加して」「データを直して」等の依頼で発動。
---

# CSVデータ更新ワークフロー

昆虫・食草データを安全に更新するための定型手順。詳細な背景は `CLAUDE.md` と `docs/data-structure.md` を参照。

## 鉄則

- **編集するのは `normalized_data/*.csv` のみ**。`public/*.csv` は同期成果物なので絶対に直接編集しない（次のビルドで上書きされる）。
- `public/assets/data-lite/*.json`・`public/meta/`・`public/en/` は生成物（Git管理外）。手で編集しない。
- IDは非連番が仕様。欠番を「詰める」ような変更はしない。ハムシの種IDは `species-H###` が正規。
- 植物名は「植物名(科名)」形式。科名の権威は YList（`normalized_data/ylist-lite.json`）。

## 手順

1. 対象ファイルを特定して編集する
   - 昆虫の実体: `normalized_data/insects.csv`（主キー `insect_id`）
   - 昆虫×植物の関係: `normalized_data/hostplants.csv`（`record_id`, `insect_id`）
   - 昆虫単位の備考: `normalized_data/general_notes.csv`（`note_type` 別）
   - 植物プロフィール: `normalized_data/plant_profiles.csv`
2. 参照整合性を検証する
   ```bash
   npm run validate-normalized   # unknown insect_id 等 → reports/missing_ids.csv
   ```
3. データ品質監査を実行し、新たな不整合が入っていないか確認する
   ```bash
   npm run audit:csv-quality     # → reports/csv-quality-audit.md
   ```
   - 高信頼の決定的修正のみ自動適用したい場合: `node scripts/audit-csv-quality.mjs --fix`
4. 回帰テストを実行する
   ```bash
   npm test
   ```
5. devサーバーで表示確認する場合は、同期と軽量JSONを再生成する
   ```bash
   npm run sync:public-insects && npm run build:data-lite
   ```
6. コミットする。`main` にマージされると GitHub Actions が自動デプロイする（`npm run build` の prebuild が同期・生成・検証を全て実行する）。

## 検証で問題が出たとき

- `unknown insect_id`: `hostplants.csv` / `general_notes.csv` が存在しない昆虫を参照している。旧ID→現行IDの対応が分かる場合は置換、不明なら行を削除する前にユーザーに確認する。
- 科名不整合: YList の科名が正。`npm run audit:csv-quality` の指摘に従う。
- 無効な植物名（説明文の断片・括弧の片割れ等）: `scripts/generate-meta-pages.js` の `isValidPlantName` が除外基準。データ側を修正する。
