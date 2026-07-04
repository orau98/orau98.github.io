// 画像資産スクリプト共通の定数。
// 索引生成(build-image-index)と変換(build-responsive-images)で対象拡張子や
// 閾値が食い違うと「索引には載るのにリサイズ版が無い」404連鎖の温床になるため、
// 必ずここで一元管理する。

// これ未満のファイルは壊れた出力とみなす（sharpの変換もスキップされるサイズ）
export const MIN_IMAGE_BYTES = 100;

// 索引・変換の両方が対象とする元画像の拡張子（小文字比較で使うこと）
export const SOURCE_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// レスポンシブ画像の生成幅（サイトの srcset と対応）
export const RESIZED_WIDTHS = [320, 640, 1024];
