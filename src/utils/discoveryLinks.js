import { isEnglishLocale, stripLocalePrefix } from './locale.js';
import { hasExplorerResultQuery } from './explorerQueryParams.js';

export const DISCOVERY_HUB_LINKS = Object.freeze({
  ja: Object.freeze([
    Object.freeze({
      path: '/meta/butterfly/index.html',
      label: '蝶の食草一覧',
      description: '植物名から蝶を逆引き',
    }),
    Object.freeze({
      path: '/meta/moth/index.html',
      label: '蛾の食草一覧',
      description: '蛾の種名から食草を調べる',
    }),
    Object.freeze({
      path: '/meta/plant/index.html',
      label: '植物から昆虫を探す',
      description: '食草・寄主植物を科別に見る',
    }),
  ]),
  en: Object.freeze([
    Object.freeze({
      path: '/en/meta/butterfly/index.html',
      label: 'Butterflies and host plants',
      description: 'Browse butterfly records by species',
    }),
    Object.freeze({
      path: '/en/meta/moth/index.html',
      label: 'Moths and host plants',
      description: 'Browse moth records by species',
    }),
    Object.freeze({
      path: '/en/meta/plant/index.html',
      label: 'Browse by host plant',
      description: 'Find insects linked to each plant',
    }),
  ]),
});

// Google候補と既存流入で需要が確認でき、かつcanonical植物ページが
// indexable な項目だけをトップの入口にする。URLを増やさず既存ページへ集約する。
export const JAPANESE_PLANT_DISCOVERY_LINKS = Object.freeze([
  Object.freeze({ plantName: 'クヌギ', label: 'クヌギにつく虫' }),
  Object.freeze({ plantName: 'コナラ', label: 'コナラにつく虫' }),
  Object.freeze({ plantName: 'アカメガシワ', label: 'アカメガシワにつく虫' }),
  Object.freeze({ plantName: 'ヨモギ', label: 'ヨモギを食べる虫' }),
  Object.freeze({ plantName: 'ケヤキ', label: 'ケヤキにつく虫' }),
  Object.freeze({ plantName: 'エゴノキ', label: 'エゴノキにつく虫' }),
  Object.freeze({ plantName: 'サクラ', label: 'サクラにつく虫・毛虫' }),
  Object.freeze({ plantName: 'カエデ', label: 'カエデにつく虫・毛虫' }),
  Object.freeze({ plantName: 'サンショウ', label: 'サンショウにつく幼虫' }),
  Object.freeze({ plantName: 'クチナシ', label: 'クチナシにつく幼虫' }),
  Object.freeze({ plantName: 'ウンシュウミカン', label: 'ミカンの木につく幼虫' }),
  Object.freeze({ plantName: 'ツワブキ', label: 'ツワブキを食べる虫' }),
].map((item) => Object.freeze({
  ...item,
  path: `/meta/plant/${encodeURIComponent(item.plantName)}.html`,
})));

export const getDiscoveryHubLinks = (locale = 'ja') =>
  isEnglishLocale(locale) ? DISCOVERY_HUB_LINKS.en : DISCOVERY_HUB_LINKS.ja;

export const shouldShowDiscoveryLinks = (
  pathname = '/',
  searchTerm = '',
  queryString = '',
) => {
  return stripLocalePrefix(String(pathname || '/')) === '/' &&
    !String(searchTerm || '').trim() &&
    !hasExplorerResultQuery(queryString);
};
