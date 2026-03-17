# 甲虫データ参照監査メモ（2026-03-17）

参照元:

- https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/117-%E3%82%BF%E3%83%9E%E3%83%A0%E3%82%B7%E7%A7%91/
- https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/130-%E3%83%8F%E3%83%A0%E3%82%B7%E7%A7%91/
- https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/131-%E3%82%AB%E3%83%9F%E3%82%AD%E3%83%AA%E3%83%A0%E3%82%B7%E7%A7%91/

比較対象:

- `normalized_data/insects.csv`
- `public/insects.csv`

## 今回適用した確定修正

- ハムシ科ヒゲナガハムシ亜科のラテン名を `Alticinae` から `Galerucinae` に統一
- `species-H352` `Syneta adamsi Baly, 1877` を `Criocerinae` から `Synetinae` へ修正
- タマムシ科 `Buprestinae` の和名を `クロタマムシ亜科` から `タマムシ亜科` へ修正

## 参照サイトとの差分サマリ

### タマムシ科 Buprestidae

| 亜科 | ローカル | 参照 | 差分 |
| --- | ---: | ---: | ---: |
| Chrysochroinae | 24 | 32 | -8 |
| Buprestinae | 20 | 31 | -11 |
| Polycestinae | 6 | 8 | -2 |
| Agrilinae | 117 | 195 | -78 |

ローカル合計 167 行。参照側は 227 種 39 亜種で、少なくとも 99 タクサ分の未収録がある。

### カミキリムシ科 Cerambycidae

| 亜科 | ローカル | 参照 | 差分 |
| --- | ---: | ---: | ---: |
| Prioninae | 28 | 28 | 0 |
| Necydalinae | 0 | 2 | -2 |
| Cerambycinae | 0 | 643 | -643 |
| Lamiinae | 0 | 368 | -368 |
| Lepturinae | 0 | 161 | -161 |

ローカルはノコギリカミキリ亜科のみ収録で、他亜科が未収録。

### ハムシ科 Chrysomelidae

| 亜科 | ローカル | 参照 | 差分 |
| --- | ---: | ---: | ---: |
| Sagrinae | 1 | 1 | 0 |
| Bruchinae | 25 | 26 | -1 |
| Donaciinae | 26 | 26 | 0 |
| Criocerinae | 41 | 35 | +6 |
| Cassidinae | 47 | 51 | -4 |
| Eumolpinae | 76 | 74 | +2 |
| Lamprosomatinae | 7 | 6 | +1 |
| Cryptocephalinae | 67 | 71 | -4 |
| Chrysomelinae | 11 | 67 | -56 |
| Synetinae | 1 | 1 | 0 |
| Galerucinae | 360 | 369 | -9 |

プラス差分は 2013 年版参照目録以後の追加や分類更新の可能性があるため、今回は削除対象にしていない。

## 次に詰めるべき点

- タマムシ科: 亜種分割漏れの確認と追加
- カミキリムシ科: `Prioninae` 以外の未収録データ補完
- ハムシ科: `Chrysomelinae` と `Galerucinae` の欠落タクサ補完
