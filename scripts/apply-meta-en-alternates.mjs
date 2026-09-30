#!/usr/bin/env node
// 日本語メタページの英語版リンク（hreflang="en"）と旧英語ガイドの転送ページを、英語ページの生成後に入れる。
// generate-meta:all の最後の工程（generate-meta-pages.js --defer-en-alternates → generate-meta:en → これ）。
// 仕組みは scripts/lib/metaEnglishAlternates.mjs を参照。
import { applyDeferredEnglishAlternates } from './lib/metaEnglishAlternates.mjs';

const result = applyDeferredEnglishAlternates();
console.log(
  `[meta-en-alternates] 英語版リンク ${result.linked}件、英語版なし ${result.cleared}件、` +
  `旧英語ガイド転送 ${result.redirects}件（英語ページ: 昆虫${result.insectMap}件・植物${result.plantMap}件）`,
);
