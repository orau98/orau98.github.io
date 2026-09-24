# scripts/_archive

過去に一度だけ実行した**データ移行用スクリプト**の保管場所です。ビルド・テスト・ワークフローからは呼ばれていません。

- 作業の記録として残しているもので、そのまま再実行することは想定していません。
- 多くは当時のデータ構成を前提にしています。`public/*.csv` を直接書き換えるものもあります（現在は `normalized_data/*.csv` が一次データで、`public/*.csv` は同期で上書きされる生成物です。詳しくは `CLAUDE.md`）。
- 置き場所が1つ深くなったので、`scripts/lib` などへの相対パスはずれています。

似た処理がまた必要になったら、ここのファイルを参考にしてください。新しいスクリプトは `scripts/` に作り、`normalized_data/` を対象にしてから `npm run validate-normalized` と `npm run audit:csv-quality` で確認します。

| ファイル | 当時の目的 |
|---|---|
| `dedupe_general_notes_fuzzy.mjs` | 備考（general_notes）のほぼ重複する行を統合 |
| `fill_missing_hostplant_family_from_existing.mjs` | 同じ植物名の他の行から、空の科名を補完 |
| `fill_missing_hostplant_family_with_ylist.mjs` | YList から、空の科名を補完（現在は `audit-csv-quality --fix` が科名を整列する） |
| `migrate_habitat_from_hostplants.mjs` | 食草欄に紛れた生息環境の記述を備考へ移動 |
| `migrate_standard_label_in_names.mjs` | 名前欄の「標準図鑑：…」を changes_since_standard へ移動 |
| `shorten_general_note_ids.mjs` | 備考 ID の短縮 |
| `split_general_notes_by_type.mjs` | 出現時期と生態情報が混ざった備考を種類ごとに分割 |
