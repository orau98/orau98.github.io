# UI改善点 ゼロベース分析レポート

作成日: 2026-07-02
分析方法: 全UIコードの精読（4観点並列調査）＋ 開発サーバー起動によるスクリーンショット実機確認（デスクトップ1440px／モバイル390px × ライト／ダーク × 主要7画面）

過去のUX改善（PR #45〜#53）で対応済みの点は除外し、現時点で残っている改善点のみを優先度順に整理した。

## 実施状況（2026-07-02 実装コミット）

以下は本ブランチで実装済み。いずれもビルド・回帰テスト（79件）・Playwright実機検証（ライトボックス開閉／FOUC／モバイルドロワー／チョウ発生時期）を通過。

- ✅ **H-1** FOUC防止: `index.html`にプリペイントスクリプト追加、`App.jsx`でinline color-scheme追従
- ✅ **H-2** z-index衝突: `ImageModal`を共通化し`z-[90]`（FABより上）へ
- ✅ **H-3** 昆虫写真ライトボックス: `src/components/ImageModal.jsx`に抽出し`MothDetail`へ導入（メイン＋追加画像、拡大ヒント付き）
- ✅ **H-4** 発生時期チャート: 常時表示の凡例を追加、アクティブ帯の不透明度を100%に
- ✅ **H-5** モバイルフィルタ: ドロワー内に有効フィルタチップ＋「すべてリセット」を表示
- ✅ **H-6** reduced-motion: `animate-pulse`/`animate-spin`/全transitionを抑制対象に追加
- ✅ **H-7** コントラスト: ライトモードの`text-slate-400`/`text-gray-400`を500相当へ補正
- ✅ **M-2** 植物リストにローディングスケルトン追加（0件画面との誤認防止）
- ✅ **M-4** 発生時期セクションをチョウにも表示（`geographicalRemarks`から抽出）
- ✅ **M-5** ページ送りスクロール先に`scroll-mt-24`付与（両リスト）
- ✅ **M-7** FABメニュー: `aria-expanded`/`aria-controls`/閉時`inert`
- ✅ **M-8** テーマトグルを`ThemeToggle`コンポーネントに集約（動的ラベル＋`aria-pressed`、3実装→1）
- ✅ **M-11** スケルトンに`role="status"`+SRテキスト
- ✅ **L-2** 植物カードのアニメ遅延クランプ（昆虫側と統一）
- ✅ **L-5** クイズ回答後に「次へ」へフォーカス移動
- ✅ **L-6** `SearchableSelect`のoptionに`tabIndex={-1}`
- ✅ **L-9** theme-colorのダーク対応（media分岐）
- ✅ **L-13** 検索履歴ボタンの44pxタッチ領域確保

第2弾で追加実装:

- ✅ **M-1** 詳細ページ専用スケルトン（`DetailSkeleton`）を追加し、`MothDetail`のスピナー全画面とSuspense/データ待ちフォールバックをルート別に出し分け
- ✅ **M-6** 関連昆虫の件数を「全N種・写真ありM種」表記に（昆虫詳細・植物詳細の両方）
- ✅ **M-10** 「植物数順」「出現期順」ソートの重い再計算を種IDでメモ化

第3弾（ユーザーフィードバック反映）:

- ✅ 詳細ページ上部のセクションナビ（`DetailSectionNav`）を削除し、目次機能をFABに一本化
  （FAB目次と機能重複との指摘による。FABは詳細ページで常時表示に変更し、
  ページ先頭からもセクションへジャンプ可能。L-15のstickyオフセット問題も同時解消）
- ✅ 食草カードの和名と科名のベースラインずれを修正（`items-start`→`items-baseline`＋折返し対応）
- ✅ **トップ画面の上スクロール時のガタつき（自励発振）を修正**:
  `StickyHeader`のスペーサーがヒーローより上のDOMで伸縮し、表示判定
  （ヒーローのIntersectionObserver）と相互作用して「表示→ヒーロー押し下げで再進入→
  非表示→収縮で退出→表示…」のループを形成していた。Playwrightで再現
  （境界位置で2.2秒間に19回出没・40pxバウンス）した後、スペーサーを削除して
  fixedオーバーレイのみとし、修正後は切替1回・コンテンツ移動0pxを確認。

未実施（今後の候補）: M-3（グローバル検索）、M-9（デザイントークン全面浸透）、M-12（alt監査）、残りのLOW項目（L-1 モバイルパンくず、L-16 ネットワーク図凡例の色重複など）。

---

## 前提: すでに良くできている点（維持推奨）

誤った再修正を避けるため、確認済みの強みを先に明記する。

- **URL状態永続化が強力**: 検索語・タブ・ページ・全フィルタ・並び順・表示密度がクエリパラメータに保存され、リロード/共有/戻るで復元される（`MothList.jsx:732-763`, `HostPlantList.jsx:622-641`）
- **スクロール位置復元**: sessionStorageで実装済み（`InsectsHostPlantExplorer.jsx:731-850`）
- **空状態UI**: イラスト＋例示チップ＋条件別ヒント＋リセット導線が充実
- **基礎アクセシビリティ**: スキップリンク、focus-visibleトークン、IME対応、`/`・Cmd+K ショートカット、ページャ44pxタッチターゲット、FoodWebGraphのsr-only説明
- **エラー復旧**: CSV取得失敗時の指数バックオフ＋リトライUI、チャンク404時のハードリロード復旧（`ChunkErrorBoundary`）
- **404ページ**: 検索ボックス＋一覧への導線あり（実機確認済み）
- **ダークモード**: 主要画面で破綻なし（実機確認済み）

---

## 🔴 HIGH（優先度: 高）

### H-1. ダークモード初回ロードのFOUC（ライト画面フラッシュ）
- **場所**: `index.html`（プリペイントスクリプトなし）、`src/App.jsx:225-236`（`.dark`付与が`useEffect`）、`src/index.css:89`（`color-scheme: light`固定）
- **問題**: `.dark`クラス付与がReactマウント後のため、ダーク設定ユーザーは**毎回ライト背景が一瞬フラッシュ**してからダークに反転する。`index.html`を直接grepし、ペイント前スクリプトが無いことを確認済み。
- **改善案**: `<head>`先頭に`localStorage.theme`/`prefers-color-scheme`を読んで`document.documentElement.classList.add('dark')`する数行のインラインスクリプトを追加。

### H-2. 画像ライトボックスよりFAB「目次」ボタンが前面に残る（z-index衝突）
- **場所**: `HostPlantDetail.jsx:224`（画像モーダル`z-50`）vs `FloatingActionButton.jsx:137`（FAB`z-[70]`）
- **問題**: 植物詳細で写真を全画面表示しても、FABがモーダルの上に被って残る（コードで両方の値を確認済み）。z-index値が`z-[9999]`〜`z-30`まで規約なく散在（LoadingBar 9999 / InfoPopover 120 / skipリンク 100 / FAB 70 / StickyHeader 60 / モーダル 50 / Header 40 / DetailSectionNav 30）。
- **改善案**: z-indexを意味レイヤ（base/sticky/popover/modal/toast）でトークン化。モーダル表示中はFABを隠すか、モーダルを最上位レイヤへ。

### H-3. 昆虫詳細のメイン写真が拡大（ライトボックス）できない — 植物ページとの機能非対称
- **場所**: `MothDetail.jsx:1259-1324`（クリックハンドラなし）vs `HostPlantDetail.jsx:96-301`（`ImageModal`完備: キーボード操作・フォーカストラップ・前後ナビ付き）
- **問題**: 植物写真はタップで全画面拡大できるのに、昆虫写真はできない。昆虫は微小な斑紋・翅脈で同定するため拡大ニーズは植物以上に高い。
- **改善案**: 既存`ImageModal`を昆虫詳細に再利用し、メイン＋追加画像を1つのギャラリーに統合。

### H-4. 発生時期チャートに凡例がなく、モバイルでは意味が伝わらない
- **場所**: `src/components/EmergenceTimeDisplay.jsx`（凡例なし、説明は`title`ツールチップのみ: L792, L851）
- **問題**: 「発生期（実線）」と「幅のある記述（グラデーション）」の区別が`title`属性頼みで、**タッチ端末ではツールチップが出ない**。アクティブ帯も`opacity-60〜70`で薄い。実機スクリーンショットでも「10月だけ薄いオレンジのセル」で意味が読み取りにくいことを確認。
- **改善案**: バー直下に常時表示の小さな凡例行を追加し、アクティブ帯の不透明度を上げる。

### H-5. モバイルのフィルタドロワー内に「有効フィルタ一覧」と「すべてリセット」が出ない
- **場所**: `ListFilterPanel.jsx:27-96`（ヘッダーブロックが`hideHeader`で非表示）、呼び出し側 `MothList.jsx:1724`・`HostPlantList.jsx:1347`（`hideHeader={mobileInline}`）
- **問題**: モバイルでは「条件N」バッジしか出ず、**どのフィルタが効いているか一覧できず、一括解除もできない**。クイック絞り込みチップ（食草あり/写真あり/季節）もモバイルではドロワー内に埋没（`MothList.jsx:1799`、実機スクリーンショットで非表示を確認）。主要トラフィックであろうモバイルで絞り込み状態の把握・解除コストが高い。
- **改善案**: モバイルでもドロワー先頭に有効フィルタチップ＋「すべてリセット」を表示。クイックチップは横スクロールでドロワー外に常設する。

### H-6. `prefers-reduced-motion`対応にTailwind標準アニメが漏れている
- **場所**: `src/index.css:560-571`（独自クラスのみ無効化。`.animate-pulse`/`.animate-spin`/`transition-*`が対象外）
- **問題**: reduced-motion設定でも全ローディングスピナー（`ImageWithFallback.jsx:242-243`, `MothDetail.jsx:913-914`, `ChunkErrorBoundary.jsx:147`など）とFABの開閉アニメが動き続ける。前庭障害ユーザーへの配慮が不完全。
- **改善案**: reduced-motionブロックに`.animate-pulse, .animate-spin`を追加、またはグローバルに`animation-duration/transition-duration: 0.01ms !important`を適用。

### H-7. ライトモードの`text-slate-400`がコントラストAA未達（約2.6:1）
- **場所**: `src/index.css:274-280`にダーク用補正のみ存在。ライト用補正なし。使用箇所は25ファイル・約140箇所。
- **問題**: 「一致する候補がありません」（`SearchInput.jsx:604`）、「他N件—入力で絞り込めます」（`SearchableSelect.jsx:186`）、検索例ラベル、画像エラー表示など**読ませたい補助テキスト**が白背景で4.5:1を大きく下回る。
- **改善案**: ライト用にも`slate-500`相当への補正を入れるか、補助テキストの既定を`text-slate-500`に統一。

---

## 🟠 MEDIUM（優先度: 中）

### M-1. 詳細ページのローディングが「スピナー1個の全画面」＋Suspenseフォールバックのレイアウト不一致
- **場所**: `MothDetail.jsx:909-928`（中央スピナーのみ）、`App.jsx:922, 1074-1075`（一覧用`SkeletonLoader`を詳細/クイズにも流用）
- **問題**: 実レイアウトと違う骨格が出るため、コンテンツ到着時に大きなレイアウトシフトが発生。詳細ページ用スケルトン（写真枠＋見出し＋本文行）を用意しルート別に出し分けるべき。

### M-2. 植物リストにローディングスケルトンがなく、データ未着時に「0件」画面と見分けがつかない
- **場所**: `HostPlantList.jsx:1484-1550`（スケルトン分岐なし）vs `MothList.jsx:1886-1901`（スケルトンあり）
- **問題**: 植物タブ初回表示や低速回線で「検索したが見つからなかった」と誤認させる。昆虫タブと体験が非対称。
- **改善案**: 昆虫リストと同じスケルトングリッドを追加し、空状態UIはフィルタ/検索がある場合のみ表示。

### M-3. 検索がホーム以外から使えない
- **場所**: `SearchInput`の使用はExplorer系のみ。グローバル`Header.jsx`に検索なし（L99のコメントで意図的と明記）。
- **問題**: 詳細ページから別種を調べるには一度ホームへ戻る必要がある。図鑑の中核動線「連続して調べる」に摩擦。
- **改善案**: ヘッダーに検索アイコン（展開式ミニ検索）を常設。

### M-4. 発生時期セクションが蛾・ハムシ限定でチョウ等に出ない
- **場所**: `MothDetail.jsx:1894`（`moth.type === 'leafbeetle' || moth.type === 'moth'`のみ。コードで確認済み）
- **問題**: 一覧カード側はチョウの発生時期を表示しているのに、詳細ページでは描画されない不整合。
- **改善案**: 少なくともチョウを対象に含める。

### M-5. ページ送り時のスクロール先がスティッキーヘッダー分オフセットされない
- **場所**: `MothList.jsx:1587-1599`（`listTopRef`へ`scrollIntoView({block:'start'})`、`scroll-mt`なし）。`#explorer-results`には`scroll-mt-24`があるのに使われていない。
- **改善案**: スクロール先を`#explorer-results`に統一するか`listTopRef`に`scroll-mt`を付与。

### M-6. 関連昆虫の「N種」表示と実際のカード数が食い違う
- **場所**: `RelatedInsectsSection.jsx:89-104`（見出しは総数、カードは写真あり最大6件）、`HostPlantDetail.jsx`関連昆虫も同構造
- **問題**: 実機確認で「19種」の見出しに対しカード1枚＋グレーのチップ18個という画面を確認。「写真未登録」ラベルも小さく薄い。
- **改善案**: 「写真あり◯種／全◯種」の分離表記、チップ列の視覚改善。

### M-7. FABメニュー（モバイル目次）のフォーカス管理とARIA
- **場所**: `FloatingActionButton.jsx:139-206`
- **問題**: (1) トグルに`aria-expanded`/`aria-controls`がない。(2) 閉状態メニューが`opacity-0 + pointer-events-none`のみで`hidden`/`inert`がなく、**不可視の目次項目にTabフォーカスが入る**。(3) DetailSectionNav（デスクトップ目次）ともどもスクロールスパイ（現在セクション強調）がない。
- **改善案**: `aria-expanded`付与、閉時`inert`、IntersectionObserverで現在地強調。

### M-8. テーマトグルが3実装で重複・不整合
- **場所**: `Header.jsx:230-243`、`StickyHeader.jsx:194-211`、`ExplorerHero.jsx:96-120`（各々別スタイル・別アイコン）
- **改善案**: `ThemeToggle`コンポーネント1つに集約。あわせて`aria-pressed`か動的ラベル（現状は常に「テーマを切り替え」）を付与。

### M-9. デザイントークンの未浸透（Phase 0で停止）
- **場所**: `src/components/ui/Chip.jsx`・`Button.jsx`・`SectionHeader.jsx`は**どこからもimportされていない**。トークン系クラス使用は37箇所に対し、生の`rounded-*`は288箇所/35ファイル。`index.css:10`のコメント自身が未完了を明言。
- **問題**: `MothDetail.jsx`/`HostPlantDetail.jsx`（各113KB）が色・角丸・影をハードコードし、一括調整が効かない。クイズの主ボタンがslate-900系でブランドのemeraldと不一致（実機確認済み）。
- **改善案**: uiプリミティブを詳細ページへ実際に適用し、段階的に置換。

### M-10. 「植物数順」「出現期順」ソートがコンパレータ内で重い再計算
- **場所**: `MothList.jsx:1484-1519`（`buildPlantDisplayData`/出現期抽出をソート比較のたびに実行、対象約9700件）
- **改善案**: `insect.id → {plantCount, firstMonth}`のMapを前計算してから並べ替え。

### M-11. スクリーンリーダー向けのローディング通知が不足
- **場所**: `SkeletonLoader.jsx`（`role`/`aria`属性なし）、`ChunkErrorBoundary.jsx:130-153`（自動リトライ進行がライブリージョン外）
- **改善案**: スケルトンに`role="status" aria-busy="true"`＋sr-onlyの「読み込み中」、リトライ進行を`role="status"`で通知。

### M-12. `ImageWithFallback`の`alt`既定が空文字
- **場所**: `ImageWithFallback.jsx:47`
- **問題**: 呼び出し側がaltを渡し忘れると、昆虫・植物の主要写真がスクリーンリーダーから完全に不可視になる。
- **改善案**: 主要写真の呼び出し側を監査し、和名・学名のaltを必須化。

---

## 🟡 LOW（優先度: 低・磨き込み）

| # | 内容 | 場所 |
|---|------|------|
| L-1 | パンくずがモバイル非表示（`hidden md:block`）、クイズにパンくず/戻り導線なし（実機確認済み）。`BreadcrumbList` JSON-LD未出力 | `MothDetail.jsx:1145`, `Breadcrumb.jsx` |
| L-2 | 植物カードのフェードイン遅延が`index*0.05s`で上限なし（100件表示で最大約5秒）。昆虫側は12でクランプ済みと非対称 | `HostPlantList.jsx:1531` vs `MothList.jsx:1917` |
| L-3 | モバイル/タブレットで亜科チップ（`lg:inline-flex`）・族チップ（`xl:inline-flex`）が決して表示されない | `MothDetail.jsx:1208,1219` |
| L-4 | フィルタUI一式がモバイル用・デスクトップ用に二重マウント（`SearchableSelect`が常時2セット） | `MothList.jsx:1829-1852` |
| L-5 | QuizPage: 回答後に選択肢が`disabled`になりフォーカスがbodyへ落ちる。「次へ」へフォーカス移動すべき | `QuizPage.jsx:1071` |
| L-6 | `SearchableSelect`のoptionに`tabIndex={-1}`がなくTab順に入る（`SearchInput`は対応済みで非対称） | `SearchableSelect.jsx:163-178` |
| L-7 | 「写真あり」フィルタが画像インデックス読込前は無言で無視される | `MothList.jsx:1495` |
| L-8 | 結果件数に母数がない（「120件」→「120 / 9,738件」が望ましい） | `MothList.jsx:625` |
| L-9 | theme-colorが`#2c5530`固定でブランド色ともダークとも不一致 | `index.html:14` |
| L-10 | Footerだけ`neutral`系パレット＋リンク色2系統混在。恒常情報（ポリシー等）薄い | `Footer.jsx:51-83` |
| L-11 | Instagram埋め込みのプレースホルダ高さ未確保でCLS | `InstagramEmbed.jsx`, `MothDetail.jsx:1263-1266` |
| L-12 | メイン画像`contain`／追加画像`cover`でトリミング基準不統一 | `MothDetail.jsx:1268,1318` |
| L-13 | 検索履歴の削除ボタンが44px未満 | `SearchInput.jsx:483-524` |
| L-14 | 日本語テキストに負のletter-spacing＋`palt`併用で窮屈になりやすい | `index.css:166-228` |
| L-15 | `DetailSectionNav`のsticky topが非stickyヘッダーの高さ基準で無駄な空白帯 | `DetailSectionNav.jsx:37` |
| L-16 | FoodWebGraph凡例で色が重複（amber-400が訪花植物と訪花昆虫、sky-400が食草昆虫と関連昆虫） | `FoodWebGraph.jsx:1789-1861` |
| L-17 | 結果件数の`aria-live`領域がデスクトップ/モバイルで併存し二重読み上げの可能性 | `ListFilterPanel.jsx:84-92`, `MothList.jsx:1831` |
| L-18 | ページ送りが`replace:true`で履歴に残らず「戻る」で一覧を離脱 | `MothList.jsx:676-687` |
| L-19 | `InfoPopover`がhoverで`role="dialog"`を開く非典型パターン、`aria-labelledby`未関連付け | `InfoPopover.jsx:156-203` |
| L-20 | 空データ表示のトーン不統一（昆虫ページはセクションごと消滅、植物ページは明示メッセージ） | `RelatedInsectsSection.jsx:49-51` vs `HostPlantDetail.jsx:2256-2259` |

---

## 推奨着手順

**第1弾（小さい修正で効果大）**: H-1 FOUC、H-2 z-index、H-6 reduced-motion、H-7 コントラスト
— いずれも局所的なCSS/HTML修正で、全ページに効く。

**第2弾（中核体験の底上げ）**: H-3 昆虫写真ライトボックス、H-4 発生時期凡例、H-5 モバイルフィルタ可視化
— 詳細ページと一覧の主要動線を直接改善。

**第3弾（品質の均し込み）**: M-1/M-2 スケルトン統一、M-3 グローバル検索、M-8/M-9 コンポーネント集約
— ページ種別間の体験非対称を解消し、以後の保守コストを下げる。
