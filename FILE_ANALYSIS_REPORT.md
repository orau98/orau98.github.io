# ListMJファイル群の分析と統合提案

## 現状のファイル一覧と特徴

### 1. 基本ファイル
- `ListMJ_hostplants0616.csv` (6580行) - 2024年6月16日版の基本データ
  - BOM付きCSV
  - 備考列なし
  - アオバシャチホコ: `ヤマボウシ; ミズキ; クマノミズキ(以上ミズキ科)` ✅正しい形式
  - カバシタムクゲエダシャク: `不明`

### 2. 統合版ファイル
- **ルート**: `ListMJ_hostplants_integrated_with_bokutou.csv` (6748行) ⭐最多データ
  - ボクトウガ科データを追加統合 (+168行)
  - BOM付きCSV、備考列あり
  - アオバシャチホコ: `ヤマボウシ; ミズキ; クマノミズキ(以上ミズキ科)` ✅正しい形式
  - カバシタムクゲエダシャク: `不明`

- **public**: `ListMJ_hostplants_integrated_with_bokutou.csv` (6525行) ❌データ欠損版
  - データが一部失われている (-55行)
  - アオバシャチホコ: `ヤマボウシ、ミズキ、クマノミズキ` ❌形式破損
  - カバシタムクゲエダシャク: 詳細な食草データあり（フユシャクCSVから？）

- **public**: `ListMJ_hostplants_integrated_with_kiriga.csv` (6578行) ❌重複問題
  - キリガデータ統合済み
  - アオバシャチホコ: 重複多数 `クマノミズキ (以上ミズキ科); ヤマボウシ; ミズキ; ヤマボウシ; ミズキ; ...`

### 3. 処理済みファイル
- **現在使用**: `public/ListMJ_hostplants_cleaned_comprehensive.csv` (6577行) ⭐現在使用中
  - 重複削除処理済み
  - BOMなし、備考列なし
  - アオバシャチホコ: `クマノミズキ (以上ミズキ科); ヤマボウシ; ミズキ` ✅重複削除済み
  - カバシタムクゲエダシャク: `不明`

- **バックアップ**: `public/ListMJ_hostplants_cleaned_comprehensive_backup.csv` (6578行)

### 4. バックアップファイル
- `backups/ListMJ_hostplants_2025-07-17T13-57-59-642Z.csv` (6580行)

## 問題点

1. **ファイルの重複** - 同様のデータを持つファイルが多数存在
2. **データの不整合** - 同じ種でも異なるファイルで異なるデータ
3. **データ欠損** - publicディレクトリの一部ファイルでデータが失われている
4. **重複データ** - 統合処理時に生成された重複エントリ
5. **使用ファイルの不明確さ** - どのファイルが正式版か不明

## 統合提案

### 推奨アプローチ: 単一マスターファイル方式

1. **マスターファイルとして使用**:
   - `ListMJ_hostplants_integrated_with_bokutou.csv` (ルートディレクトリ版, 6748行)
   - 理由: 最も多くのデータを含む、データ整合性が保たれている

2. **統合処理**:
   - マスターファイルに対して重複削除処理を適用
   - フユシャクデータ、キリガデータの統合を改めて実行
   - BOM除去と列構成の正規化

3. **最終ファイル**:
   - `public/ListMJ_hostplants_final.csv` として新規作成
   - 全ての統合データを含む
   - 重複削除処理済み
   - 標準化された形式

### 削除対象ファイル

以下のファイルは統合後に削除可能:
- `ListMJ_hostplants0616.csv` (古いバージョン)
- `public/ListMJ_hostplants_integrated_with_bokutou.csv` (データ欠損版)
- `public/ListMJ_hostplants_integrated_with_kiriga.csv` (重複問題版)
- `public/ListMJ_hostplants_cleaned_comprehensive_backup.csv` (バックアップ)

### 保持するファイル

- `backups/` ディレクトリ内のタイムスタンプ付きファイル（履歴保持）
- 統合後の最終ファイル1つのみ

## 実装手順

1. ルートディレクトリの `ListMJ_hostplants_integrated_with_bokutou.csv` をベースとする
2. 重複削除処理スクリプトを実行
3. フユシャク・キリガデータの再統合
4. 最終ファイルを `public/ListMJ_hostplants_master.csv` として保存
5. アプリケーションコードの参照先を更新
6. 不要ファイルの削除

この統合により、データの整合性を保ちながらファイル数を大幅に削減できます。