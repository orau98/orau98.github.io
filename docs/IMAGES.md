# 画像最適化ガイド

- フォーマット優先度: AVIF > WebP > JPEG/PNG（`<picture>` でフォールバックを構成）
- サイズ: 表示サイズに合わせて適切にリサイズ（横幅1200px程度を上限）
- 圧縮: 劣化の少ない圧縮を施す（AVIF/WebPで80%目安）
- alt属性: 和名 + 学名 + 文脈（例: 「オオムラサキ（Sasakia charonda）の成虫」）
- CLS対策: `<img>` に `width` と `height` を必ず指定
- キャッシュ: GitHub Pagesではファイル名にハッシュを付けるか、ビルドで `?v=` を付与して更新反映
- ディレクトリ: `images/<カテゴリ>/<種名>/` で整理（例: `images/sasakia-charonda/cover.jpg`）

