import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EN_SITE_NAME,
  EN_TYPE_LABELS,
  EN_TYPE_PLURALS,
  buildJapaneseReferenceLabel,
  getPrimaryEnglishName,
  slugifyScientificLabel,
} from './lib/englishNaming.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_ORIGIN = process.env.BASE_ORIGIN || 'https://orau98.github.io';
const ROOT_DIR = path.join(__dirname, '..');
const DATASET_PATH = path.join(ROOT_DIR, 'public/assets/data-lite/full-dataset.json');
const GUIDES_DIR = path.join(ROOT_DIR, 'public/guides');
const OUT_DIR = path.join(ROOT_DIR, 'public/guides/plants');
const CATEGORY_OUT_DIR = path.join(ROOT_DIR, 'public/guides/categories');
const FAMILY_OUT_DIR = path.join(ROOT_DIR, 'public/guides/families');
const EN_GUIDES_DIR = path.join(ROOT_DIR, 'public/en/guides');
const EN_OUT_DIR = path.join(EN_GUIDES_DIR, 'plants');
const EN_CATEGORY_OUT_DIR = path.join(EN_GUIDES_DIR, 'categories');
const EN_FAMILY_OUT_DIR = path.join(EN_GUIDES_DIR, 'families');
const PLANT_META_DIR = path.join(ROOT_DIR, 'public/meta/plant');
const SEO_ROUTE_MAP_INSECTS_PATH = path.join(ROOT_DIR, 'public/seo-route-map.insects.json');
const SEO_ROUTE_MAP_PLANTS_PATH = path.join(ROOT_DIR, 'public/seo-route-map.plants.json');
const ADSENSE_CLIENT = process.env.VITE_ADSENSE_CLIENT || 'ca-pub-6982051533473293';
const ADSENSE_HEAD_TAGS = `<meta name="google-adsense-account" content="${ADSENSE_CLIENT}">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;
const ADSENSE_SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
const STATIC_GUIDE_HTML_PATHS = Object.freeze([
  path.join(GUIDES_DIR, 'index.html'),
  path.join(GUIDES_DIR, 'insect-plant-database.html'),
  path.join(GUIDES_DIR, 'what-is-host-plant.html'),
  path.join(GUIDES_DIR, 'host-plant-search.html'),
  path.join(GUIDES_DIR, 'caterpillar-host-plant.html'),
  path.join(GUIDES_DIR, 'garden-tree-caterpillars.html'),
  path.join(GUIDES_DIR, 'weeds-caterpillars.html'),
  path.join(EN_GUIDES_DIR, 'index.html'),
  path.join(EN_GUIDES_DIR, 'what-is-host-plant.html'),
  path.join(EN_GUIDES_DIR, 'host-plant-search.html'),
]);

const TYPE_CONFIGS = [
  ['moth', '蛾', '/meta/moth/'],
  ['butterfly', '蝶', '/meta/butterfly/'],
  ['beetle', 'タマムシ', '/meta/beetle/'],
  ['longhornbeetle', 'カミキリムシ', '/meta/longhornbeetle/'],
  ['leafbeetle', 'ハムシ', '/meta/leafbeetle/'],
  ['aphid', 'アブラムシ', '/meta/aphid/'],
];

const TYPE_LABELS = Object.fromEntries(TYPE_CONFIGS.map(([key, label]) => [key, label]));
const TYPE_ROUTE_PREFIXES = Object.fromEntries(TYPE_CONFIGS.map(([key, , prefix]) => [key, prefix]));
const TYPE_ORDER = Object.fromEntries(TYPE_CONFIGS.map(([key], index) => [key, index]));
const AUTO_HOST_PLANT_GUIDE_TARGET = 340;
const AUTO_HOST_PLANT_GUIDE_MIN_RELATED = 6;
const AUTO_HOST_PLANT_GUIDE_MAX_VARIANTS = 8;
const AUTO_HOST_PLANT_REJECT_PATTERNS = Object.freeze([
  /[?？<>"'&/\\]/u,
  /^(不明|不詳|なし|無し|その他|各種|種名|和名|植物)$/u,
  /(など|の一種)$/u,
  /(類|属|科)$/u,
  /(広葉樹|針葉樹|常緑樹|落葉樹|樹木|草本|木本|雑草|牧草|作物|野菜|果樹|植物|葉|花|芽|枝|幹|茎|根|果実|種子|穂|樹皮|枯|朽|材|落葉|落ち葉|倒木|腐|菌|地衣|蘚苔|苔|コケ|ゴケ|キノコ|カワラタケ)/u,
]);

export const HOST_PLANT_GUIDES = [
  {
    slug: 'sakura',
    name: 'サクラ',
    variants: [
      'サクラ',
      'サクラ類',
      'サクラ属',
      'サクラ属植物',
      '栽培サクラ',
      'カスミサクラ',
      'セイヨウミザクラ',
      'ソメイヨシノ',
      'ウワミズザクラ',
    ],
    searchPhrases: ['サクラにつく虫', '桜の幼虫 食草', 'サクラを食べる蛾'],
  },
  {
    slug: 'ume',
    name: 'ウメ',
    variants: ['ウメ', 'ブンゴウメ'],
    searchPhrases: ['ウメにつく虫', '梅の木 幼虫 食草', 'ウメを食べる蛾'],
  },
  {
    slug: 'ringo',
    name: 'リンゴ',
    variants: ['リンゴ', 'セイヨウリンゴ', '栽培リンゴ', 'リンゴ類', 'リンゴ属', 'ズミ'],
    searchPhrases: ['リンゴにつく虫', 'リンゴ 幼虫 食草', 'リンゴを食べる蛾'],
  },
  {
    slug: 'kunugi',
    name: 'クヌギ',
    variants: ['クヌギ'],
    searchPhrases: ['クヌギにつく虫', 'クヌギ 幼虫 食草', 'クヌギを食べる蛾'],
  },
  {
    slug: 'konara',
    name: 'コナラ',
    variants: ['コナラ', 'コナラ属', 'コナラ類'],
    searchPhrases: ['コナラにつく虫', 'コナラ 幼虫 食草', 'コナラを食べる蛾'],
  },
  {
    slug: 'kuri',
    name: 'クリ',
    variants: ['クリ', 'クリ類', '栽培クリ'],
    searchPhrases: ['クリにつく虫', '栗の木 幼虫 食草', 'クリを食べる蛾'],
  },
  {
    slug: 'buna',
    name: 'ブナ',
    variants: ['ブナ', 'イヌブナ'],
    searchPhrases: ['ブナにつく虫', 'ブナ 幼虫 食草', 'ブナを食べる蛾'],
  },
  {
    slug: 'shirakanba',
    name: 'シラカンバ',
    variants: ['シラカンバ', 'ダケカンバ'],
    searchPhrases: ['シラカンバにつく虫', 'シラカンバ 幼虫 食草', 'カンバを食べる蛾'],
  },
  {
    slug: 'hannoki',
    name: 'ハンノキ',
    variants: ['ハンノキ', 'ヤマハンノキ', 'ミヤマハンノキ', 'ハンノキ属', 'タニガワハンノキ'],
    searchPhrases: ['ハンノキにつく虫', 'ハンノキ 幼虫 食草', 'ハンノキを食べる蛾'],
  },
  {
    slug: 'yanagi',
    name: 'ヤナギ',
    variants: ['ヤナギ', 'ヤナギ類', 'ヤナギ属', 'ネコヤナギ', 'バッコヤナギ', 'シダレヤナギ', 'コゴメヤナギ', 'シバヤナギ'],
    searchPhrases: ['ヤナギにつく虫', '柳 幼虫 食草', 'ヤナギを食べる蛾'],
  },
  {
    slug: 'enoki',
    name: 'エノキ',
    variants: ['エノキ', 'エゾエノキ', 'オオエノキ', 'クワノハエノキ'],
    searchPhrases: ['エノキにつく虫', 'エノキ 幼虫 食草', 'エノキを食べる蝶'],
  },
  {
    slug: 'mizuki',
    name: 'ミズキ',
    variants: ['ミズキ', 'クマノミズキ', 'ミズキ類'],
    searchPhrases: ['ミズキにつく虫', 'ミズキ 幼虫 食草', 'ミズキを食べる蛾'],
  },
  {
    slug: 'akamegashiwa',
    name: 'アカメガシワ',
    variants: ['アカメガシワ', 'ウラジロアカメガシワ'],
    searchPhrases: ['アカメガシワにつく虫', 'アカメガシワ 幼虫 食草', 'アカメガシワを食べる蛾'],
  },
  {
    slug: 'nurude',
    name: 'ヌルデ',
    variants: ['ヌルデ'],
    searchPhrases: ['ヌルデにつく虫', 'ヌルデ 幼虫 食草', 'ヌルデを食べる昆虫'],
  },
  {
    slug: 'kaede',
    name: 'カエデ',
    variants: [
      'カエデ',
      'カエデ属',
      'イタヤカエデ',
      'イロハモミジ',
      'ヤマモミジ',
      'ウリカエデ',
      'ウリハダカエデ',
      'カラコギカエデ',
    ],
    searchPhrases: ['カエデにつく虫', 'モミジ 幼虫 食草', 'カエデを食べる蛾'],
  },
  {
    slug: 'yomogi',
    name: 'ヨモギ',
    variants: ['ヨモギ', 'オオヨモギ', 'ヨモギ属', 'ヨモギ類', 'オトコヨモギ'],
    searchPhrases: ['ヨモギにつく虫', 'ヨモギを食べる蛾', 'ヨモギ 幼虫 食草'],
  },
  {
    slug: 'susuki',
    name: 'ススキ',
    variants: ['ススキ', 'オオススキ', 'ハチジョウススキ'],
    searchPhrases: ['ススキにつく虫', 'ススキ 幼虫 食草', 'ススキを食べる蛾'],
  },
  {
    slug: 'irakusa',
    name: 'イラクサ',
    variants: ['イラクサ', 'エゾイラクサ', 'ホソバイラクサ', 'ミヤマイラクサ', 'ムカゴイラクサ'],
    searchPhrases: ['イラクサにつく虫', 'イラクサ 幼虫 食草', 'イラクサを食べる蝶'],
  },
  {
    slug: 'karamushi',
    name: 'カラムシ',
    variants: ['カラムシ', 'ナンバンカラムシ'],
    searchPhrases: ['カラムシにつく虫', 'カラムシ 幼虫 食草', 'カラムシを食べる蝶'],
  },
  {
    slug: 'ajisai',
    name: 'アジサイ',
    variants: ['アジサイ', 'ガクアジサイ', 'ヤマアジサイ', 'タマアジサイ', 'ツルアジサイ', 'コアジサイ'],
    searchPhrases: ['アジサイにつく虫', 'アジサイ 幼虫 食草', 'アジサイを食べる蛾'],
  },
  {
    slug: 'tsutsuji',
    name: 'ツツジ',
    variants: ['ツツジ', 'ツツジ類', 'ツツジ属', 'ヤマツツジ', 'モチツツジ', 'レンゲツツジ'],
    searchPhrases: ['ツツジにつく虫', 'ツツジ 幼虫 食草', 'ツツジを食べる蛾'],
  },
  {
    slug: 'bara',
    name: 'バラ',
    variants: ['バラ', 'バラ属', 'ノイバラ', 'テリハノイバラ', 'ハマナス', '栽培バラ'],
    searchPhrases: ['バラにつく虫', 'バラ 幼虫 食草', 'バラを食べる蛾'],
  },
  {
    slug: 'daizu',
    name: 'ダイズ',
    variants: ['ダイズ', 'ダイズ属'],
    searchPhrases: ['ダイズにつく虫', '大豆 害虫 幼虫', 'ダイズ 食草 昆虫'],
  },
  {
    slug: 'cabbage',
    name: 'キャベツ',
    variants: ['キャベツ', 'ハナキャベツ', 'キャベツなどアブラナ科', 'キャベツなど'],
    searchPhrases: ['キャベツにつく虫', 'キャベツ 青虫 食草', 'キャベツを食べる幼虫'],
  },
  {
    slug: 'negi',
    name: 'ネギ',
    variants: ['ネギ', 'タマネギ', 'ノビル'],
    searchPhrases: ['ネギにつく虫', 'ネギ 幼虫 食草', 'タマネギを食べる昆虫'],
  },
  {
    slug: 'mikan',
    name: 'ミカン',
    variants: ['ミカン', 'ウンシュウミカン', 'ナツミカン', 'ミカン属', 'キハダ'],
    searchPhrases: ['ミカンにつく虫', 'ミカン 幼虫 食草', 'ミカンを食べる蝶'],
  },
  {
    slug: 'chanoki',
    name: 'チャノキ',
    variants: ['チャノキ', 'インドチャノキ'],
    searchPhrases: ['チャノキにつく虫', '茶の木 幼虫 食草', 'チャノキを食べる蛾'],
  },
  {
    slug: 'kaki',
    name: 'カキ',
    variants: ['カキノキ'],
    searchPhrases: ['カキにつく虫', '柿の木 幼虫 食草', 'カキを食べる蛾'],
  },
  {
    slug: 'nashi',
    name: 'ナシ',
    variants: ['ナシ', 'ミチノクナシ'],
    searchPhrases: ['ナシにつく虫', '梨の木 幼虫 食草', 'ナシを食べる蛾'],
  },
  {
    slug: 'momo',
    name: 'モモ',
    variants: ['モモ', 'スモモ', 'スモモ類'],
    searchPhrases: ['モモにつく虫', '桃の木 幼虫 食草', 'スモモにつく虫'],
  },
  {
    slug: 'kuwa',
    name: 'クワ',
    variants: ['クワ', 'ヤマグワ', 'マグワ', 'クワ属'],
    searchPhrases: ['クワにつく虫', '桑 幼虫 食草', 'クワを食べる蛾'],
  },
  {
    slug: 'take-sasa',
    name: 'タケ・ササ',
    variants: ['タケ', 'ササ', 'マダケ', 'メダケ', 'モウソウチク', 'ハチク', 'ネザサ', 'タケ類'],
    searchPhrases: ['タケにつく虫', 'ササ 幼虫 食草', '竹を食べる昆虫'],
  },
  {
    slug: 'keyaki',
    name: 'ケヤキ',
    variants: ['ケヤキ'],
    searchPhrases: ['ケヤキにつく虫', 'ケヤキ 幼虫 食草', 'ケヤキを食べる蛾'],
  },
  {
    slug: 'harunire',
    name: 'ハルニレ',
    variants: ['ハルニレ', 'アキニレ'],
    searchPhrases: ['ハルニレにつく虫', 'ニレ 幼虫 食草', 'ニレを食べる蛾'],
  },
  {
    slug: 'itadori',
    name: 'イタドリ',
    variants: ['イタドリ', 'オオイタドリ'],
    searchPhrases: ['イタドリにつく虫', 'イタドリ 幼虫 食草', 'イタドリを食べる蛾'],
  },
  {
    slug: 'fuji',
    name: 'フジ',
    variants: ['フジ', 'ナツフジ', 'クサフジ', 'ツルフジバカマ'],
    searchPhrases: ['フジにつく虫', '藤 幼虫 食草', 'フジを食べる蛾'],
  },
  {
    slug: 'tsubaki',
    name: 'ツバキ・サザンカ',
    variants: ['ツバキ', 'ヤブツバキ', 'サザンカ', 'ツバキ類', 'ユキツバキ', 'ナツツバキ'],
    searchPhrases: ['ツバキにつく虫', 'サザンカにつく虫', 'ツバキ 幼虫 食草'],
  },
  {
    slug: 'kashiwa',
    name: 'カシワ',
    variants: ['カシワ'],
    searchPhrases: ['カシワにつく虫', 'カシワ 幼虫 食草', 'カシワを食べる蛾'],
  },
  {
    slug: 'mizunara',
    name: 'ミズナラ',
    variants: ['ミズナラ', 'フモトミズナラ'],
    searchPhrases: ['ミズナラにつく虫', 'ミズナラ 幼虫 食草', 'ミズナラを食べる蛾'],
  },
  {
    slug: 'arakashi',
    name: 'アラカシ',
    variants: ['アラカシ', 'アマミアラカシ'],
    searchPhrases: ['アラカシにつく虫', 'アラカシ 幼虫 食草', 'アラカシを食べる蛾'],
  },
  {
    slug: 'shirakashi',
    name: 'シラカシ',
    variants: ['シラカシ'],
    searchPhrases: ['シラカシにつく虫', 'シラカシ 幼虫 食草', 'シラカシを食べる蛾'],
  },
  {
    slug: 'sudajii',
    name: 'スダジイ',
    variants: ['スダジイ', 'シイ', 'ツブラジイ'],
    searchPhrases: ['スダジイにつく虫', 'シイにつく虫', 'スダジイ 幼虫 食草'],
  },
  {
    slug: 'jagaimo',
    name: 'ジャガイモ',
    variants: ['ジャガイモ'],
    searchPhrases: ['ジャガイモにつく虫', 'じゃがいも 害虫 幼虫', 'ジャガイモ 食草 昆虫'],
  },
  {
    slug: 'nasu',
    name: 'ナス',
    variants: ['ナス'],
    searchPhrases: ['ナスにつく虫', 'なす 害虫 幼虫', 'ナスを食べる昆虫'],
  },
  {
    slug: 'tomato',
    name: 'トマト',
    variants: ['トマト'],
    searchPhrases: ['トマトにつく虫', 'トマト 害虫 幼虫', 'トマトを食べる昆虫'],
  },
  {
    slug: 'daikon',
    name: 'ダイコン',
    variants: ['ダイコン', 'アオクビダイコン'],
    searchPhrases: ['ダイコンにつく虫', '大根 青虫 食草', 'ダイコンを食べる幼虫'],
  },
  {
    slug: 'budou',
    name: 'ブドウ',
    variants: ['ブドウ', 'ヤマブドウ', 'ヨーロッパブドウ', '栽培ブドウ', 'ノブドウ'],
    searchPhrases: ['ブドウにつく虫', 'ぶどう 幼虫 食草', 'ブドウを食べる蛾'],
  },
  {
    slug: 'biwa',
    name: 'ビワ',
    variants: ['ビワ'],
    searchPhrases: ['ビワにつく虫', 'ビワ 幼虫 食草', 'ビワを食べる蛾'],
  },
  {
    slug: 'ichijiku',
    name: 'イチジク',
    variants: ['イチジク', 'イヌビワ'],
    searchPhrases: ['イチジクにつく虫', 'イチジク 幼虫 食草', 'イチジクを食べる昆虫'],
  },
  {
    slug: 'sumire',
    name: 'スミレ',
    variants: ['スミレ', 'タチツボスミレ', 'オオタチツボスミレ', 'ミヤマスミレ', 'マルバスミレ'],
    searchPhrases: ['スミレにつく虫', 'スミレ 食草 蝶', 'スミレを食べる幼虫'],
  },
  {
    slug: 'shirotsumekusa',
    name: 'シロツメクサ',
    variants: ['シロツメクサ', 'ムラサキツメクサ'],
    searchPhrases: ['シロツメクサにつく虫', 'クローバー 幼虫 食草', 'シロツメクサを食べる昆虫'],
  },
  {
    slug: 'yoshi',
    name: 'ヨシ',
    variants: ['ヨシ', 'ツルヨシ', 'クサヨシ'],
    searchPhrases: ['ヨシにつく虫', 'ヨシ 幼虫 食草', 'ヨシを食べる蛾'],
  },
  {
    slug: 'ine',
    name: 'イネ',
    variants: ['イネ', 'イネ科植物', 'イネ科'],
    searchPhrases: ['イネにつく虫', '稲 害虫 幼虫', 'イネを食べる昆虫'],
  },
  {
    slug: 'kusunoki',
    name: 'クスノキ',
    variants: ['クスノキ', 'シロダモ', 'アブラチャン'],
    searchPhrases: ['クスノキにつく虫', 'クスノキ 幼虫 食草', 'クスノキを食べる蝶'],
  },
  {
    slug: 'shirobai',
    name: 'シロバイ',
    variants: ['シロバイ', 'クロバイ', 'サワフタギ', 'タンナサワフタギ'],
    searchPhrases: ['シロバイにつく虫', 'シロバイ 幼虫 食草', 'ハイノキ科を食べる蛾'],
  },
  {
    slug: 'isunoki',
    name: 'イスノキ',
    variants: ['イスノキ'],
    searchPhrases: ['イスノキにつく虫', 'イスノキ 幼虫 食草', 'イスノキを食べる蛾'],
  },
  {
    slug: 'mamegaki',
    name: 'マメガキ',
    variants: ['マメガキ', 'リュウキュウマメガキ'],
    searchPhrases: ['マメガキにつく虫', 'マメガキ 幼虫 食草', 'カキノキ科を食べる蛾'],
  },
  {
    slug: 'sansho',
    name: 'カラスザンショウ・サンショウ',
    variants: ['カラスザンショウ', 'サンショウ', 'イヌザンショウ', 'フユザンショウ', 'サンショウ属'],
    searchPhrases: ['カラスザンショウにつく虫', 'サンショウ 幼虫 食草', 'ミカン科を食べる蝶'],
  },
  {
    slug: 'shakuyaku',
    name: 'シャクヤク',
    variants: ['シャクヤク', 'ボタン'],
    searchPhrases: ['シャクヤクにつく虫', 'シャクヤク 幼虫 食草', 'ボタン科を食べる蛾'],
  },
  {
    slug: 'kiri',
    name: 'キリ',
    variants: ['キリ', 'キリ属'],
    searchPhrases: ['キリにつく虫', 'キリ 幼虫 食草', 'キリを食べる蛾'],
  },
  {
    slug: 'shoben-noki',
    name: 'ショウベンノキ',
    variants: ['ショウベンノキ'],
    searchPhrases: ['ショウベンノキにつく虫', 'ショウベンノキ 幼虫 食草', 'ミツバウツギ科を食べる昆虫'],
  },
  {
    slug: 'shiraki',
    name: 'シラキ',
    variants: ['シラキ'],
    searchPhrases: ['シラキにつく虫', 'シラキ 幼虫 食草', 'トウダイグサ科を食べる蛾'],
  },
  {
    slug: 'shinano-ki',
    name: 'シナノキ',
    variants: ['シナノキ', 'オオバボダイジュ', 'ボダイジュ'],
    searchPhrases: ['シナノキにつく虫', 'シナノキ 幼虫 食草', 'アオイ科を食べる蛾'],
  },
  {
    slug: 'abemaki',
    name: 'アベマキ',
    variants: ['アベマキ'],
    searchPhrases: ['アベマキにつく虫', 'アベマキ 幼虫 食草', 'ブナ科を食べる蛾'],
  },
  {
    slug: 'egonoki',
    name: 'エゴノキ',
    variants: ['エゴノキ'],
    searchPhrases: ['エゴノキにつく虫', 'エゴノキ 幼虫 食草', 'エゴノキを食べる蛾'],
  },
  {
    slug: 'hasunohagiri',
    name: 'ハスノハギリ',
    variants: ['ハスノハギリ'],
    searchPhrases: ['ハスノハギリにつく虫', 'ハスノハギリ 幼虫 食草', 'ハスノハギリを食べる昆虫'],
  },
  {
    slug: 'harigiri',
    name: 'ハリギリ',
    variants: ['ハリギリ'],
    searchPhrases: ['ハリギリにつく虫', 'ハリギリ 幼虫 食草', 'ウコギ科を食べる昆虫'],
  },
  {
    slug: 'kusagi',
    name: 'クサギ',
    variants: ['クサギ'],
    searchPhrases: ['クサギにつく虫', 'クサギ 幼虫 食草', 'シソ科を食べる昆虫'],
  },
  {
    slug: 'onigurumi',
    name: 'オニグルミ',
    variants: ['オニグルミ', 'クルミ'],
    searchPhrases: ['オニグルミにつく虫', 'クルミ 幼虫 食草', 'クルミを食べる蛾'],
  },
  {
    slug: 'kibushi',
    name: 'キブシ',
    variants: ['キブシ'],
    searchPhrases: ['キブシにつく虫', 'キブシ 幼虫 食草', 'キブシを食べる蛾'],
  },
  {
    slug: 'mizosoba',
    name: 'ミゾソバ',
    variants: ['ミゾソバ'],
    searchPhrases: ['ミゾソバにつく虫', 'ミゾソバ 幼虫 食草', 'タデ科を食べる昆虫'],
  },
  {
    slug: 'poplar',
    name: 'ポプラ・ヤマナラシ',
    variants: ['ポプラ', 'ヤマナラシ', 'ドロノキ', 'セイヨウハコヤナギ'],
    searchPhrases: ['ポプラにつく虫', 'ヤマナラシ 幼虫 食草', 'ヤナギ科を食べる蛾'],
  },
  {
    slug: 'ubamegashi',
    name: 'ウバメガシ',
    variants: ['ウバメガシ'],
    searchPhrases: ['ウバメガシにつく虫', 'ウバメガシ 幼虫 食草', 'ブナ科を食べる蛾'],
  },
  {
    slug: 'toneri',
    name: 'トネリコ類',
    variants: ['トネリコ', 'シオジ', 'ヤチダモ', 'アオダモ'],
    searchPhrases: ['トネリコにつく虫', 'トネリコ 幼虫 食草', 'モクセイ科を食べる昆虫'],
  },
  {
    slug: 'gishigishi',
    name: 'ギシギシ・スイバ',
    variants: ['ギシギシ', 'スイバ'],
    searchPhrases: ['ギシギシにつく虫', 'スイバ 幼虫 食草', 'タデ科を食べる昆虫'],
  },
  {
    slug: 'karamatsu',
    name: 'カラマツ',
    variants: ['カラマツ'],
    searchPhrases: ['カラマツにつく虫', 'カラマツ 幼虫 食草', 'マツ科を食べる蛾'],
  },
  {
    slug: 'nanakamado',
    name: 'ナナカマド',
    variants: ['ナナカマド'],
    searchPhrases: ['ナナカマドにつく虫', 'ナナカマド 幼虫 食草', 'バラ科を食べる蛾'],
  },
  {
    slug: 'ryoubu',
    name: 'リョウブ',
    variants: ['リョウブ'],
    searchPhrases: ['リョウブにつく虫', 'リョウブ 幼虫 食草', 'リョウブを食べる蛾'],
  },
  {
    slug: 'ibotanoki',
    name: 'イボタノキ',
    variants: ['イボタノキ', 'ネズミモチ', 'トウネズミモチ'],
    searchPhrases: ['イボタノキにつく虫', 'イボタノキ 幼虫 食草', 'モクセイ科を食べる昆虫'],
  },
  {
    slug: 'momi',
    name: 'モミ',
    variants: ['モミ', 'シラビソ'],
    searchPhrases: ['モミにつく虫', 'モミ 幼虫 食草', 'マツ科を食べる蛾'],
  },
  {
    slug: 'kumashide',
    name: 'クマシデ類',
    variants: ['クマシデ', 'イヌシデ', 'アカシデ'],
    searchPhrases: ['クマシデにつく虫', 'シデ 幼虫 食草', 'カバノキ科を食べる蛾'],
  },
  {
    slug: 'mayumi',
    name: 'マユミ',
    variants: ['マユミ', 'ツリバナ', 'ニシキギ'],
    searchPhrases: ['マユミにつく虫', 'マユミ 幼虫 食草', 'ニシキギ科を食べる昆虫'],
  },
  {
    slug: 'akamatsu',
    name: 'アカマツ',
    variants: ['アカマツ', 'クロマツ'],
    searchPhrases: ['アカマツにつく虫', '松 幼虫 食草', 'マツを食べる蛾'],
  },
  {
    slug: 'oobako',
    name: 'オオバコ',
    variants: ['オオバコ', 'ヘラオオバコ'],
    searchPhrases: ['オオバコにつく虫', 'オオバコ 幼虫 食草', 'オオバコを食べる昆虫'],
  },
  {
    slug: 'momijiichigo',
    name: 'モミジイチゴ・キイチゴ類',
    variants: ['モミジイチゴ', 'クマイチゴ', 'キイチゴ'],
    searchPhrases: ['モミジイチゴにつく虫', 'キイチゴ 幼虫 食草', 'キイチゴを食べる蛾'],
  },
  {
    slug: 'hakuunboku',
    name: 'ハクウンボク',
    variants: ['ハクウンボク', 'アサガラ'],
    searchPhrases: ['ハクウンボクにつく虫', 'ハクウンボク 幼虫 食草', 'エゴノキ科を食べる蛾'],
  },
  {
    slug: 'utsugi',
    name: 'ウツギ',
    variants: ['ウツギ'],
    searchPhrases: ['ウツギにつく虫', 'ウツギ 幼虫 食草', 'アジサイ科を食べる蛾'],
  },
  {
    slug: 'yamahagi',
    name: 'ヤマハギ・ハギ類',
    variants: ['ヤマハギ', 'ハギ', 'マルバハギ', 'メドハギ', 'ヌスビトハギ'],
    searchPhrases: ['ヤマハギにつく虫', 'ハギ 幼虫 食草', 'ハギを食べる蛾'],
  },
  {
    slug: 'kuzu',
    name: 'クズ',
    variants: ['クズ'],
    searchPhrases: ['クズにつく虫', 'クズ 幼虫 食草', '葛を食べる昆虫'],
  },
  {
    slug: 'kuroki',
    name: 'クロキ・ハイノキ類',
    variants: ['クロキ', 'ハイノキ', 'ミミズバイ'],
    searchPhrases: ['クロキにつく虫', 'ハイノキ 幼虫 食草', 'ハイノキ科を食べる蛾'],
  },
  {
    slug: 'asebi',
    name: 'アセビ・ツツジ科低木',
    variants: ['アセビ', 'ネジキ', 'シャシャンボ', 'クロマメノキ', 'コケモモ'],
    searchPhrases: ['アセビにつく虫', 'アセビ 幼虫 食草', 'ツツジ科低木を食べる蛾'],
  },
  {
    slug: 'taranoki-yatsude',
    name: 'タラノキ・ヤツデ',
    variants: ['タラノキ', 'ヤツデ', 'カクレミノ'],
    searchPhrases: ['タラノキにつく虫', 'ヤツデにつく虫', 'ウコギ科を食べる昆虫'],
  },
  {
    slug: 'kamatsuka',
    name: 'カマツカ',
    variants: ['カマツカ', 'アズキナシ'],
    searchPhrases: ['カマツカにつく虫', 'カマツカ 幼虫 食草', 'バラ科低木を食べる蛾'],
  },
  {
    slug: 'nishikigi-shrubs',
    name: 'コマユミ・ツルウメモドキ',
    variants: ['コマユミ', 'ツルウメモドキ', 'マサキ', 'クロウメモドキ'],
    searchPhrases: ['コマユミにつく虫', 'ツルウメモドキ 幼虫 食草', 'ニシキギ科を食べる昆虫'],
  },
  {
    slug: 'todomatsu',
    name: 'トドマツ・針葉樹',
    variants: ['トドマツ', 'エゾマツ', 'ヒマラヤスギ', 'マツ'],
    searchPhrases: ['トドマツにつく虫', '針葉樹 幼虫 食草', 'マツ科を食べる蛾'],
  },
  {
    slug: 'hisakaki',
    name: 'ヒサカキ・サカキ',
    variants: ['ヒサカキ', 'サカキ'],
    searchPhrases: ['ヒサカキにつく虫', 'サカキ 幼虫 食草', 'サカキ科を食べる蛾'],
  },
  {
    slug: 'sawagurumi',
    name: 'サワグルミ',
    variants: ['サワグルミ'],
    searchPhrases: ['サワグルミにつく虫', 'サワグルミ 幼虫 食草', 'クルミ科を食べる昆虫'],
  },
  {
    slug: 'tabunoki',
    name: 'タブノキ',
    variants: ['タブノキ'],
    searchPhrases: ['タブノキにつく虫', 'タブノキ 幼虫 食草', 'クスノキ科を食べる蛾'],
  },
  {
    slug: 'kashi-evergreen',
    name: 'カシ類',
    variants: ['ウラジロガシ', 'アカガシ', 'カシ', 'カシ類'],
    searchPhrases: ['カシにつく虫', 'ウラジロガシ 幼虫 食草', '常緑カシを食べる蛾'],
  },
  {
    slug: 'naragashiwa',
    name: 'ナラガシワ',
    variants: ['ナラガシワ'],
    searchPhrases: ['ナラガシワにつく虫', 'ナラガシワ 幼虫 食草', 'ブナ科を食べる蛾'],
  },
  {
    slug: 'gamazumi',
    name: 'ガマズミ・ニワトコ類',
    variants: ['ガマズミ', 'ニワトコ', 'サンゴジュ', 'オオカメノキ'],
    searchPhrases: ['ガマズミにつく虫', 'ニワトコ 幼虫 食草', 'ガマズミ科を食べる昆虫'],
  },
  {
    slug: 'tanpopo',
    name: 'タンポポ・キク科草本',
    variants: ['タンポポ', 'セイヨウタンポポ', 'フキ', 'ノゲシ', 'ゴボウ'],
    searchPhrases: ['タンポポにつく虫', 'キク科草本 幼虫 食草', 'タンポポを食べる昆虫'],
  },
  {
    slug: 'seitaka-awadachiso',
    name: 'セイタカアワダチソウ',
    variants: ['セイタカアワダチソウ', 'オオアワダチソウ'],
    searchPhrases: ['セイタカアワダチソウにつく虫', 'セイタカアワダチソウ 幼虫 食草', '外来雑草を食べる蛾'],
  },
  {
    slug: 'hiyodoribana',
    name: 'ヒヨドリバナ・フジバカマ類',
    variants: ['ヒヨドリバナ', 'ヒヨドリバナ類', 'サワヒヨドリ', 'ヨツバヒヨドリ', 'フジバカマ'],
    searchPhrases: ['ヒヨドリバナにつく虫', 'フジバカマ 幼虫 食草', 'ヒヨドリバナを食べる蛾'],
  },
  {
    slug: 'akigumi',
    name: 'アキグミ・グミ類',
    variants: ['アキグミ', 'ツルグミ', 'ナツグミ', 'ナワシログミ', 'グミ', 'グミ類'],
    searchPhrases: ['アキグミにつく虫', 'グミ 幼虫 食草', 'グミ科を食べる昆虫'],
  },
  {
    slug: 'tsuwabuki',
    name: 'ツワブキ',
    variants: ['ツワブキ'],
    searchPhrases: ['ツワブキにつく虫', 'ツワブキ 幼虫 食草', 'ツワブキを食べる蛾'],
  },
  {
    slug: 'oomatsuyoigusa',
    name: 'オオマツヨイグサ・マツヨイグサ類',
    variants: ['オオマツヨイグサ', 'アレチマツヨイグサ', 'メマツヨイグサ'],
    searchPhrases: ['オオマツヨイグサにつく虫', 'マツヨイグサ 幼虫 食草', 'アカバナ科を食べる蛾'],
  },
  {
    slug: 'cosmos',
    name: 'コスモス',
    variants: ['コスモス'],
    searchPhrases: ['コスモスにつく虫', 'コスモス 幼虫 食草', 'コスモスを食べる昆虫'],
  },
  {
    slug: 'otokoeshi',
    name: 'オトコエシ・オミナエシ類',
    variants: ['オトコエシ', 'オミナエシ'],
    searchPhrases: ['オトコエシにつく虫', 'オミナエシ 幼虫 食草', 'スイカズラ科草本を食べる蛾'],
  },
  {
    slug: 'nokongiku',
    name: 'ノコンギク・野菊類',
    variants: ['ノコンギク', 'シロヨメナ', 'ノギク'],
    searchPhrases: ['ノコンギクにつく虫', '野菊 幼虫 食草', 'ノギクを食べる蛾'],
  },
  {
    slug: 'tsurigane-ninjin',
    name: 'ツリガネニンジン',
    variants: ['ツリガネニンジン'],
    searchPhrases: ['ツリガネニンジンにつく虫', 'ツリガネニンジン 幼虫 食草', 'キキョウ科を食べる蛾'],
  },
  {
    slug: 'tobera',
    name: 'トベラ',
    variants: ['トベラ', 'シロトベラ', 'オキナワトベラ'],
    searchPhrases: ['トベラにつく虫', 'トベラ 幼虫 食草', 'トベラ科を食べる昆虫'],
  },
  {
    slug: 'okatoranoo',
    name: 'オカトラノオ',
    variants: ['オカトラノオ', 'ヌマトラノオ', 'オカトラノオ属'],
    searchPhrases: ['オカトラノオにつく虫', 'オカトラノオ 幼虫 食草', 'サクラソウ科を食べる昆虫'],
  },
  {
    slug: 'yakushiso',
    name: 'ヤクシソウ',
    variants: ['ヤクシソウ'],
    searchPhrases: ['ヤクシソウにつく虫', 'ヤクシソウ 幼虫 食草', 'キク科を食べる蛾'],
  },
  {
    slug: 'yanagiran',
    name: 'ヤナギラン',
    variants: ['ヤナギラン'],
    searchPhrases: ['ヤナギランにつく虫', 'ヤナギラン 幼虫 食草', 'アカバナ科を食べる昆虫'],
  },
  {
    slug: 'himejoon',
    name: 'ヒメジョオン・ハルジオン',
    variants: ['ヒメジョオン', 'ハルジオン'],
    searchPhrases: ['ヒメジョオンにつく虫', 'ハルジオン 幼虫 食草', '道ばたの雑草を食べる昆虫'],
  },
  {
    slug: 'akino-kirinsou',
    name: 'アキノキリンソウ類',
    variants: ['アキノキリンソウ', 'ミヤマアキノキリンソウ', 'オオアキノキリンソウ'],
    searchPhrases: ['アキノキリンソウにつく虫', 'アキノキリンソウ 幼虫 食草', 'キク科を食べる昆虫'],
  },
  {
    slug: 'kosendangusa',
    name: 'コセンダングサ・センダングサ類',
    variants: ['コセンダングサ', 'アメリカセンダングサ', 'タチアワユキセンダングサ', 'オオバナセンダングサ', 'オオバナノセンダングサ'],
    searchPhrases: ['コセンダングサにつく虫', 'センダングサ 幼虫 食草', '外来雑草を食べる蛾'],
  },
  {
    slug: 'azami',
    name: 'アザミ類',
    variants: ['ノアザミ', 'ヨシノアザミ', 'ヒメアザミ', 'アザミ', 'アザミ属', 'アザミ類', 'チシマアザミ'],
    searchPhrases: ['アザミにつく虫', 'アザミ 幼虫 食草', 'アザミを食べる昆虫'],
  },
  {
    slug: 'kugaiso',
    name: 'クガイソウ',
    variants: ['クガイソウ'],
    searchPhrases: ['クガイソウにつく虫', 'クガイソウ 幼虫 食草', 'オオバコ科を食べる昆虫'],
  },
  {
    slug: 'teikakazura',
    name: 'テイカカズラ',
    variants: ['テイカカズラ'],
    searchPhrases: ['テイカカズラにつく虫', 'テイカカズラ 幼虫 食草', 'キョウチクトウ科を食べる昆虫'],
  },
  {
    slug: 'yashabushi',
    name: 'ヤシャブシ',
    variants: ['ヤシャブシ'],
    searchPhrases: ['ヤシャブシにつく虫', 'ヤシャブシ 幼虫 食草', 'カバノキ科を食べる蛾'],
  },
  {
    slug: 'tsunohashibami',
    name: 'ツノハシバミ',
    variants: ['ツノハシバミ'],
    searchPhrases: ['ツノハシバミにつく虫', 'ツノハシバミ 幼虫 食草', 'カバノキ科を食べる昆虫'],
  },
  {
    slug: 'inutade',
    name: 'イヌタデ',
    variants: ['イヌタデ'],
    searchPhrases: ['イヌタデにつく虫', 'イヌタデ 幼虫 食草', 'タデ科を食べる昆虫'],
  },
  {
    slug: 'suikazura',
    name: 'スイカズラ・タニウツギ',
    variants: ['スイカズラ', 'タニウツギ', 'ハコネウツギ'],
    searchPhrases: ['スイカズラにつく虫', 'タニウツギ 幼虫 食草', 'スイカズラ科を食べる昆虫'],
  },
  {
    slug: 'nemunoki',
    name: 'ネムノキ',
    variants: ['ネムノキ'],
    searchPhrases: ['ネムノキにつく虫', 'ネムノキ 幼虫 食草', 'マメ科樹木を食べる蛾'],
  },
  {
    slug: 'yamamomo',
    name: 'ヤマモモ',
    variants: ['ヤマモモ'],
    searchPhrases: ['ヤマモモにつく虫', 'ヤマモモ 幼虫 食草', 'ヤマモモを食べる昆虫'],
  },
  {
    slug: 'hinoki-sugi',
    name: 'ヒノキ・スギ',
    variants: ['ヒノキ', 'スギ'],
    searchPhrases: ['ヒノキにつく虫', 'スギ 幼虫 食草', 'ヒノキ科を食べる蛾'],
  },
];

const CATEGORY_GUIDES = [
  {
    slug: 'garden-trees',
    name: '庭木',
    plantSlugs: ['sakura', 'ume', 'momo', 'kaki', 'mikan', 'tsubaki', 'tsutsuji', 'ajisai', 'bara', 'kaede', 'keyaki', 'enoki'],
    searchPhrases: ['庭木につく虫', '庭木 幼虫 食草', '庭の木につく蛾'],
  },
  {
    slug: 'fruit-trees',
    name: '果樹',
    plantSlugs: ['ume', 'ringo', 'momo', 'kaki', 'mamegaki', 'nashi', 'mikan', 'kuri', 'budou', 'biwa', 'ichijiku'],
    searchPhrases: ['果樹につく虫', '果樹 害虫 幼虫', '果物の木を食べる蛾'],
  },
  {
    slug: 'vegetables',
    name: '野菜',
    plantSlugs: ['cabbage', 'daizu', 'negi', 'jagaimo', 'nasu', 'tomato', 'daikon'],
    searchPhrases: ['野菜につく虫', '野菜 害虫 幼虫', '野菜を食べる昆虫'],
  },
  {
    slug: 'street-trees',
    name: '街路樹・公園樹',
    plantSlugs: [
      'sakura',
      'keyaki',
      'kaede',
      'enoki',
      'kusunoki',
      'tsubaki',
      'akamegashiwa',
      'yanagi',
      'shinano-ki',
      'egonoki',
      'harigiri',
    ],
    searchPhrases: ['街路樹につく虫', '公園の木 幼虫 食草', '街路樹を食べる蛾'],
  },
  {
    slug: 'broadleaf-trees',
    name: '広葉樹',
    plantSlugs: [
      'kunugi',
      'konara',
      'kuri',
      'buna',
      'kashiwa',
      'mizunara',
      'arakashi',
      'shirakashi',
      'sudajii',
      'abemaki',
      'ubamegashi',
      'yanagi',
      'mizuki',
      'keyaki',
      'harunire',
      'shirobai',
      'isunoki',
      'mamegaki',
      'sansho',
      'kiri',
      'shoben-noki',
      'shiraki',
      'shinano-ki',
      'egonoki',
      'hasunohagiri',
      'harigiri',
      'kusagi',
      'onigurumi',
      'kibushi',
      'poplar',
      'toneri',
      'nanakamado',
      'ryoubu',
      'ibotanoki',
      'kumashide',
      'mayumi',
      'momijiichigo',
      'hakuunboku',
      'yamahagi',
      'kuzu',
      'kuroki',
      'asebi',
      'taranoki-yatsude',
      'kamatsuka',
      'nishikigi-shrubs',
      'hisakaki',
      'sawagurumi',
      'tabunoki',
      'kashi-evergreen',
      'gamazumi',
      'teikakazura',
      'yashabushi',
      'tsunohashibami',
      'suikazura',
      'nemunoki',
      'yamamomo',
      'akigumi',
      'tobera',
    ],
    searchPhrases: ['広葉樹につく虫', '広葉樹 幼虫 食草', '広葉樹を食べる蛾'],
  },
  {
    slug: 'forest-trees',
    name: '森林樹木',
    plantSlugs: [
      'shirobai',
      'isunoki',
      'sakura',
      'kaede',
      'kunugi',
      'konara',
      'mizunara',
      'abemaki',
      'ubamegashi',
      'shiraki',
      'kiri',
      'egonoki',
      'harigiri',
      'kusagi',
      'onigurumi',
      'kibushi',
      'poplar',
      'shinano-ki',
      'toneri',
      'nanakamado',
      'ryoubu',
      'kumashide',
      'momi',
      'hakuunboku',
      'utsugi',
      'kuroki',
      'asebi',
      'taranoki-yatsude',
      'hisakaki',
      'sawagurumi',
      'tabunoki',
      'kashi-evergreen',
      'gamazumi',
      'yashabushi',
      'tsunohashibami',
      'nemunoki',
      'yamamomo',
      'hinoki-sugi',
      'akigumi',
      'tobera',
    ],
    searchPhrases: ['森林樹木につく虫', '雑木林 幼虫 食草', '森の木を食べる蛾'],
  },
  {
    slug: 'shrubs-and-vines',
    name: '低木・つる植物',
    plantSlugs: [
      'asebi',
      'utsugi',
      'hisakaki',
      'gamazumi',
      'suikazura',
      'teikakazura',
      'nishikigi-shrubs',
      'kuroki',
      'yamamomo',
      'taranoki-yatsude',
      'yamahagi',
      'kuzu',
      'akigumi',
      'tobera',
    ],
    searchPhrases: ['低木につく虫', 'つる植物 幼虫 食草', '低木を食べる蛾'],
  },
  {
    slug: 'wildflowers',
    name: '野草・草花',
    plantSlugs: [
      'yomogi',
      'tanpopo',
      'inutade',
      'mizosoba',
      'gishigishi',
      'oobako',
      'sumire',
      'itadori',
      'shirotsumekusa',
      'yoshi',
      'seitaka-awadachiso',
      'hiyodoribana',
      'tsuwabuki',
      'oomatsuyoigusa',
      'cosmos',
      'otokoeshi',
      'nokongiku',
      'tsurigane-ninjin',
      'okatoranoo',
      'yakushiso',
      'yanagiran',
      'himejoon',
      'akino-kirinsou',
      'kosendangusa',
      'azami',
      'kugaiso',
    ],
    searchPhrases: ['野草につく虫', '草花 幼虫 食草', '道ばたの草を食べる昆虫'],
  },
  {
    slug: 'asteraceae-wildflowers',
    name: 'キク科野草',
    plantSlugs: [
      'yomogi',
      'tanpopo',
      'seitaka-awadachiso',
      'hiyodoribana',
      'tsuwabuki',
      'nokongiku',
      'yakushiso',
      'himejoon',
      'akino-kirinsou',
      'kosendangusa',
      'azami',
      'cosmos',
    ],
    searchPhrases: ['キク科野草につく虫', 'キク科 幼虫 食草', '道ばたのキク科を食べる蛾'],
  },
  {
    slug: 'evergreen-trees',
    name: '常緑樹',
    plantSlugs: [
      'kashi-evergreen',
      'sudajii',
      'tabunoki',
      'kusunoki',
      'hisakaki',
      'shirobai',
      'isunoki',
      'tsubaki',
      'mikan',
    ],
    searchPhrases: ['常緑樹につく虫', '常緑樹 幼虫 食草', '照葉樹を食べる蛾'],
  },
  {
    slug: 'conifers',
    name: '針葉樹',
    plantSlugs: ['akamatsu', 'karamatsu', 'momi', 'todomatsu', 'hinoki-sugi'],
    searchPhrases: ['針葉樹につく虫', 'マツ科 幼虫 食草', 'ヒノキ スギにつく虫'],
  },
  {
    slug: 'oak-family',
    name: 'ブナ科・どんぐりの木',
    plantSlugs: ['kunugi', 'konara', 'kuri', 'buna', 'kashiwa', 'mizunara', 'arakashi', 'shirakashi', 'sudajii', 'abemaki', 'ubamegashi', 'kashi-evergreen', 'naragashiwa'],
    searchPhrases: ['どんぐりの木につく虫', 'ブナ科 幼虫 食草', 'クヌギ コナラにつく虫'],
  },
  {
    slug: 'weeds-and-grasses',
    name: '草本・雑草',
    plantSlugs: [
      'yomogi',
      'susuki',
      'irakusa',
      'karamushi',
      'itadori',
      'shirotsumekusa',
      'yoshi',
      'ine',
      'sumire',
      'mizosoba',
      'gishigishi',
      'oobako',
      'tanpopo',
      'inutade',
      'seitaka-awadachiso',
      'hiyodoribana',
      'oomatsuyoigusa',
      'himejoon',
      'kosendangusa',
      'azami',
      'kugaiso',
    ],
    searchPhrases: ['雑草につく虫', '草本 幼虫 食草', '草を食べる蛾'],
  },
  {
    slug: 'butterfly-host-plants',
    name: '蝶の食草',
    plantSlugs: ['enoki', 'mikan', 'sansho', 'irakusa', 'karamushi', 'cabbage', 'sumire', 'sakura', 'yanagi'],
    searchPhrases: ['蝶の食草', 'チョウ 幼虫 食草', '蝶が食べる植物'],
  },
];

const FAMILY_GUIDES = [
  {
    slug: 'rosaceae',
    name: 'バラ科',
    searchPhrases: ['バラ科につく虫', 'バラ科 食草', 'バラ科を食べる幼虫'],
  },
  {
    slug: 'fagaceae',
    name: 'ブナ科',
    searchPhrases: ['ブナ科につく虫', 'ブナ科 幼虫 食草', 'どんぐりの木 食草'],
  },
  {
    slug: 'fabaceae',
    name: 'マメ科',
    searchPhrases: ['マメ科につく虫', 'マメ科 食草', 'ダイズ クローバー につく虫'],
  },
  {
    slug: 'poaceae',
    name: 'イネ科',
    searchPhrases: ['イネ科につく虫', 'イネ科 食草', 'イネ科を食べる蛾'],
  },
  {
    slug: 'asteraceae',
    name: 'キク科',
    searchPhrases: ['キク科につく虫', 'キク科 食草', 'ヨモギ タンポポ につく虫'],
  },
  {
    slug: 'brassicaceae',
    name: 'アブラナ科',
    searchPhrases: ['アブラナ科につく虫', 'アブラナ科 食草', 'キャベツ ダイコン につく虫'],
  },
  {
    slug: 'solanaceae',
    name: 'ナス科',
    searchPhrases: ['ナス科につく虫', 'ナス科 食草', 'トマト ナス ジャガイモ につく虫'],
  },
  {
    slug: 'malvaceae',
    name: 'アオイ科',
    searchPhrases: ['アオイ科につく虫', 'アオイ科 食草', 'アオイ科 野菜 一覧'],
  },
  {
    slug: 'rutaceae',
    name: 'ミカン科',
    searchPhrases: ['ミカン科につく虫', 'ミカン科 食草', 'サンショウ ミカン につく虫'],
  },
  {
    slug: 'betulaceae',
    name: 'カバノキ科',
    searchPhrases: ['カバノキ科につく虫', 'カバノキ科 食草', 'シラカンバ ハンノキ につく虫'],
  },
  {
    slug: 'salicaceae',
    name: 'ヤナギ科',
    searchPhrases: ['ヤナギ科につく虫', 'ヤナギ科 食草', 'ヤナギ ポプラ につく虫'],
  },
  {
    slug: 'ericaceae',
    name: 'ツツジ科',
    searchPhrases: ['ツツジ科につく虫', 'ツツジ科 食草', 'ツツジ アセビ につく虫'],
  },
  {
    slug: 'hydrangeaceae',
    name: 'アジサイ科',
    searchPhrases: ['アジサイ科につく虫', 'アジサイ科 食草', 'ウツギ アジサイ につく虫'],
  },
  {
    slug: 'araliaceae',
    name: 'ウコギ科',
    searchPhrases: ['ウコギ科につく虫', 'ウコギ科 食草', 'タラノキ ヤツデ につく虫'],
  },
  {
    slug: 'lauraceae',
    name: 'クスノキ科',
    searchPhrases: ['クスノキ科につく虫', 'クスノキ科 食草', 'タブノキ クスノキ につく虫'],
  },
  {
    slug: 'celastraceae',
    name: 'ニシキギ科',
    searchPhrases: ['ニシキギ科につく虫', 'ニシキギ科 食草', 'コマユミ ツルウメモドキ につく虫'],
  },
  {
    slug: 'viburnaceae',
    name: 'ガマズミ科',
    searchPhrases: ['ガマズミ科につく虫', 'ガマズミ科 食草', 'ガマズミ ニワトコ につく虫'],
  },
  {
    slug: 'symplocaceae',
    name: 'ハイノキ科',
    searchPhrases: ['ハイノキ科につく虫', 'ハイノキ科 食草', 'シロバイ クロキ につく虫'],
  },
  {
    slug: 'pinaceae',
    name: 'マツ科',
    searchPhrases: ['マツ科につく虫', 'マツ科 食草', 'マツ カラマツ モミ につく虫'],
  },
  {
    slug: 'cupressaceae',
    name: 'ヒノキ科',
    searchPhrases: ['ヒノキ科につく虫', 'ヒノキ科 食草', 'ヒノキ スギ につく虫'],
  },
  {
    slug: 'apocynaceae',
    name: 'キョウチクトウ科',
    searchPhrases: ['キョウチクトウ科につく虫', 'キョウチクトウ科 食草', 'テイカカズラ につく虫'],
  },
  {
    slug: 'oleaceae',
    name: 'モクセイ科',
    searchPhrases: ['モクセイ科につく虫', 'モクセイ科 食草', 'トネリコ ネズミモチ につく虫'],
  },
  {
    slug: 'hamamelidaceae',
    name: 'マンサク科',
    searchPhrases: ['マンサク科につく虫', 'マンサク科 食草', 'イスノキ マンサク につく虫'],
  },
  {
    slug: 'caprifoliaceae',
    name: 'スイカズラ科',
    searchPhrases: ['スイカズラ科につく虫', 'スイカズラ科 食草', 'オトコエシ スイカズラ につく虫'],
  },
  {
    slug: 'onagraceae',
    name: 'アカバナ科',
    searchPhrases: ['アカバナ科につく虫', 'アカバナ科 食草', 'マツヨイグサ ヤナギラン につく虫'],
  },
  {
    slug: 'elaeagnaceae',
    name: 'グミ科',
    searchPhrases: ['グミ科につく虫', 'グミ科 食草', 'アキグミ ツルグミ につく虫'],
  },
  {
    slug: 'pittosporaceae',
    name: 'トベラ科',
    searchPhrases: ['トベラ科につく虫', 'トベラ科 食草', 'トベラ につく虫'],
  },
  {
    slug: 'primulaceae',
    name: 'サクラソウ科',
    searchPhrases: ['サクラソウ科につく虫', 'サクラソウ科 食草', 'オカトラノオ につく虫'],
  },
  {
    slug: 'campanulaceae',
    name: 'キキョウ科',
    searchPhrases: ['キキョウ科につく虫', 'キキョウ科 食草', 'ツリガネニンジン につく虫'],
  },
  {
    slug: 'plantaginaceae',
    name: 'オオバコ科',
    searchPhrases: ['オオバコ科につく虫', 'オオバコ科 食草', 'オオバコ クガイソウ につく虫'],
  },
];

export const ENGLISH_GUIDE_LABELS = Object.freeze({
  sakura: 'Cherry trees (Cerasus / Prunus)',
  ume: 'Japanese apricot (Prunus mume)',
  ringo: 'Apple trees (Malus)',
  kunugi: 'Quercus acutissima',
  konara: 'Quercus serrata',
  kuri: 'Japanese chestnut (Castanea crenata)',
  buna: 'Japanese beech (Fagus crenata)',
  shirakanba: 'Japanese white birch (Betula)',
  hannoki: 'Alders (Alnus)',
  yanagi: 'Willows (Salix)',
  enoki: 'Hackberries (Celtis)',
  mizuki: 'Cornus trees',
  akamegashiwa: 'Mallotus japonicus',
  nurude: 'Rhus javanica',
  kaede: 'Maples (Acer)',
  yomogi: 'Mugwort (Artemisia)',
  susuki: 'Miscanthus sinensis',
  irakusa: 'Nettles (Urtica)',
  karamushi: 'Boehmeria nivea and relatives',
  ajisai: 'Hydrangea',
  tsutsuji: 'Azaleas (Rhododendron)',
  bara: 'Roses (Rosa)',
  daizu: 'Soybean (Glycine max)',
  cabbage: 'Cabbage and Brassica crops',
  negi: 'Welsh onion and Allium crops',
  mikan: 'Citrus trees',
  chanoki: 'Tea plant (Camellia sinensis)',
  kaki: 'Persimmon (Diospyros kaki)',
  nashi: 'Japanese pear (Pyrus pyrifolia)',
  momo: 'Peach and plum trees (Prunus)',
  kuwa: 'Mulberries (Morus)',
  'take-sasa': 'Bamboo and dwarf bamboo',
  keyaki: 'Zelkova serrata',
  harunire: 'Elms (Ulmus)',
  itadori: 'Japanese knotweed (Reynoutria japonica)',
  fuji: 'Wisteria',
  tsubaki: 'Camellia',
  kashiwa: 'Quercus dentata',
  mizunara: 'Quercus crispula',
  arakashi: 'Quercus glauca',
  shirakashi: 'Quercus myrsinifolia',
  sudajii: 'Castanopsis sieboldii',
  jagaimo: 'Potato (Solanum tuberosum)',
  nasu: 'Eggplant (Solanum melongena)',
  tomato: 'Tomato (Solanum lycopersicum)',
  daikon: 'Daikon radish (Raphanus sativus)',
  budou: 'Grapes (Vitis)',
  biwa: 'Loquat (Eriobotrya japonica)',
  ichijiku: 'Figs (Ficus and relatives)',
  sumire: 'Violets (Viola)',
  shirotsumekusa: 'Clovers (Trifolium)',
  yoshi: 'Common reed (Phragmites)',
  ine: 'Rice and grasses (Poaceae)',
  kusunoki: 'Camphor tree and Lauraceae',
  shirobai: 'Symplocos trees',
  isunoki: 'Distylium racemosum',
  mamegaki: 'Wild persimmons (Diospyros)',
  sansho: 'Japanese pepper and Zanthoxylum',
  shakuyaku: 'Peonies (Paeonia)',
  kiri: 'Paulownia trees',
  'shoben-noki': 'Turpinia ternata',
  shiraki: 'Sapium japonicum',
  'shinano-ki': 'Lindens (Tilia)',
  abemaki: 'Quercus variabilis',
  egonoki: 'Styrax japonicus',
  hasunohagiri: 'Hernandia nymphaeifolia',
  harigiri: 'Kalopanax septemlobus',
  kusagi: 'Clerodendrum trichotomum',
  onigurumi: 'Japanese walnut (Juglans)',
  kibushi: 'Stachyurus praecox',
  mizosoba: 'Persicaria thunbergii',
  poplar: 'Poplars and aspens',
  ubamegashi: 'Quercus phillyreoides',
  toneri: 'Ash trees (Fraxinus)',
  gishigishi: 'Docks and sorrels (Rumex)',
  karamatsu: 'Japanese larch (Larix kaempferi)',
  nanakamado: 'Rowans (Sorbus)',
  ryoubu: 'Clethra barbinervis',
  ibotanoki: 'Ligustrum shrubs',
  momi: 'Japanese firs (Abies)',
  kumashide: 'Hornbeams (Carpinus)',
  mayumi: 'Spindle trees (Euonymus)',
  akamatsu: 'Japanese red pine (Pinus densiflora)',
  oobako: 'Plantains (Plantago)',
  momijiichigo: 'Rubus berries',
  hakuunboku: 'Hakuunboku and related Styracaceae',
  utsugi: 'Deutzia crenata',
  yamahagi: 'Japanese bush clovers (Lespedeza)',
  kuzu: 'Kudzu (Pueraria)',
  kuroki: 'Symplocos shrubs',
  asebi: 'Pieris and Ericaceae shrubs',
  'taranoki-yatsude': 'Aralia, Fatsia and related Araliaceae',
  kamatsuka: 'Pourthiaea and Aria shrubs',
  'nishikigi-shrubs': 'Euonymus and Celastraceae shrubs',
  todomatsu: 'Firs, spruces and cedars',
  hisakaki: 'Eurya and Cleyera shrubs',
  sawagurumi: 'Pterocarya rhoifolia',
  tabunoki: 'Machilus thunbergii',
  'kashi-evergreen': 'Evergreen oaks',
  naragashiwa: 'Quercus aliena',
  gamazumi: 'Viburnum and Sambucus shrubs',
  tanpopo: 'Dandelions and Asteraceae herbs',
  teikakazura: 'Trachelospermum asiaticum',
  yashabushi: 'Alnus firma',
  tsunohashibami: 'Corylus sieboldiana',
  inutade: 'Persicaria longiseta',
  suikazura: 'Lonicera and Weigela shrubs',
  nemunoki: 'Silk tree (Albizia julibrissin)',
  yamamomo: 'Morella rubra',
  'hinoki-sugi': 'Japanese cypress and cedar',
  'seitaka-awadachiso': 'Tall goldenrod (Solidago altissima)',
  hiyodoribana: 'Eupatorium and thoroughworts',
  akigumi: 'Elaeagnus shrubs',
  tsuwabuki: 'Farfugium japonicum',
  oomatsuyoigusa: 'Evening primroses (Oenothera)',
  cosmos: 'Cosmos',
  otokoeshi: 'Patrinia and valerian relatives',
  nokongiku: 'Aster and wild chrysanthemum relatives',
  'tsurigane-ninjin': 'Adenophora triphylla',
  tobera: 'Pittosporum tobira',
  okatoranoo: 'Lysimachia clethroides',
  yakushiso: 'Crepidiastrum denticulatum',
  yanagiran: 'Chamaenerion angustifolium',
  himejoon: 'Erigeron weeds',
  'akino-kirinsou': 'Goldenrods (Solidago)',
  kosendangusa: 'Bidens weeds',
  azami: 'Thistles (Cirsium)',
  kugaiso: 'Veronicastrum japonicum',
});

const ENGLISH_CATEGORY_LABELS = Object.freeze({
  'garden-trees': 'Garden trees',
  'fruit-trees': 'Fruit trees',
  vegetables: 'Vegetables',
  'street-trees': 'Street and park trees',
  'broadleaf-trees': 'Broadleaf trees',
  'forest-trees': 'Forest trees',
  'shrubs-and-vines': 'Shrubs and vines',
  wildflowers: 'Wildflowers and herbaceous plants',
  'evergreen-trees': 'Evergreen trees',
  conifers: 'Conifers',
  'asteraceae-wildflowers': 'Asteraceae wildflowers and weeds',
  'oak-family': 'Fagaceae and acorn-bearing trees',
  'weeds-and-grasses': 'Weeds and grasses',
  'butterfly-host-plants': 'Butterfly host plants',
});

const ENGLISH_FAMILY_LABELS = Object.freeze({
  rosaceae: 'Rosaceae (rose family)',
  fagaceae: 'Fagaceae (beech and oak family)',
  fabaceae: 'Fabaceae (legume family)',
  poaceae: 'Poaceae (grass family)',
  asteraceae: 'Asteraceae (aster family)',
  brassicaceae: 'Brassicaceae (mustard family)',
  solanaceae: 'Solanaceae (nightshade family)',
  malvaceae: 'Malvaceae (mallow family)',
  rutaceae: 'Rutaceae (citrus family)',
  betulaceae: 'Betulaceae (birch family)',
  salicaceae: 'Salicaceae (willow family)',
  ericaceae: 'Ericaceae (heath family)',
  hydrangeaceae: 'Hydrangeaceae (hydrangea family)',
  araliaceae: 'Araliaceae (ginseng family)',
  lauraceae: 'Lauraceae (laurel family)',
  celastraceae: 'Celastraceae (spindle tree family)',
  viburnaceae: 'Viburnaceae (viburnum family)',
  symplocaceae: 'Symplocaceae (sweetleaf family)',
  pinaceae: 'Pinaceae (pine family)',
  cupressaceae: 'Cupressaceae (cypress family)',
  apocynaceae: 'Apocynaceae (dogbane family)',
  oleaceae: 'Oleaceae (olive family)',
  hamamelidaceae: 'Hamamelidaceae (witch-hazel family)',
  caprifoliaceae: 'Caprifoliaceae (honeysuckle family)',
  onagraceae: 'Onagraceae (evening primrose family)',
  elaeagnaceae: 'Elaeagnaceae (oleaster family)',
  pittosporaceae: 'Pittosporaceae (pittosporum family)',
  primulaceae: 'Primulaceae (primrose family)',
  campanulaceae: 'Campanulaceae (bellflower family)',
  plantaginaceae: 'Plantaginaceae (plantain family)',
});

const EN_TYPE_ORDER = Object.fromEntries(Object.keys(EN_TYPE_PLURALS).map((key, index) => [key, index]));

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function writeHtml(filePath, content) {
  fs.writeFileSync(filePath, content.replace(/[ \t]+$/gm, ''), 'utf-8');
}

function ensureAdsenseHeadTags(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, 'utf-8');
  if (html.includes(ADSENSE_SCRIPT_URL)) return false;

  const adsenseBlock = `  ${ADSENSE_HEAD_TAGS}\n`;
  const nextHtml = html.replace(
    /(<meta\s+name="description"\s+content="[^"]*"\s*>\n)/i,
    `$1${adsenseBlock}`,
  );
  if (nextHtml === html) return false;
  writeHtml(filePath, nextHtml);
  return true;
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function truncate(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function normalizePlantName(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（(][^)）]*科[)）]$/u, '')
    .replace(/\s+/g, '')
    .trim();
}

function hasJapanesePlantName(value = '') {
  return /[一-龯ぁ-んァ-ヶ]/u.test(String(value || ''));
}

function isConcretePlantLabel(value = '') {
  const name = normalizePlantName(value);
  if (!name || name.length < 2 || name.length > 24) return false;
  if (!hasJapanesePlantName(name)) return false;
  return !AUTO_HOST_PLANT_REJECT_PATTERNS.some((pattern) => pattern.test(name));
}

function getPlantDetail(dataset, rawName, normalizedName = normalizePlantName(rawName)) {
  const plantDetails = dataset?.plantDetails || {};
  return plantDetails[rawName] || plantDetails[normalizedName] || {};
}

function isConcreteAutoGuidePlantName(name, detail = {}) {
  return isConcretePlantLabel(name) && Boolean(detail.familyName || detail.family || detail.scientificName);
}

function hashToBase36(value = '') {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createAutoHostPlantGuideSlug(name, detail = {}, usedSlugs = new Set()) {
  const scientificSlug = slugifyScientificLabel(detail.scientificName);
  const fallbackSlug = `plant-${hashToBase36(name)}`;
  const baseSlug = scientificSlug || fallbackSlug;
  let slug = baseSlug;
  let index = 2;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

function collectAutoHostPlantCandidates(dataset = {}) {
  const hostPlants = dataset?.hostPlants || {};
  const candidatesByName = new Map();

  Object.entries(hostPlants).forEach(([rawName, relatedIds]) => {
    const name = normalizePlantName(rawName);
    const detail = getPlantDetail(dataset, rawName, name);
    if (!isConcreteAutoGuidePlantName(name, detail)) return;

    const entry = candidatesByName.get(name) || {
      name,
      detail,
      relatedIds: new Set(),
      aliases: new Set(),
    };
    (Array.isArray(relatedIds) ? relatedIds : []).forEach((id) => entry.relatedIds.add(id));
    entry.aliases.add(name);
    if (Array.isArray(detail.aliases)) {
      detail.aliases
        .map(normalizePlantName)
        .filter(isConcretePlantLabel)
        .forEach((alias) => entry.aliases.add(alias));
    }
    candidatesByName.set(name, entry);
  });

  return [...candidatesByName.values()]
    .map((candidate) => ({
      ...candidate,
      relatedCount: candidate.relatedIds.size,
    }))
    .filter((candidate) => candidate.relatedCount >= AUTO_HOST_PLANT_GUIDE_MIN_RELATED)
    .sort((a, b) => {
      if (b.relatedCount !== a.relatedCount) return b.relatedCount - a.relatedCount;
      return a.name.localeCompare(b.name, 'ja');
    });
}

export function buildHostPlantGuideConfigs(dataset = {}, options = {}) {
  const target = options.target ?? AUTO_HOST_PLANT_GUIDE_TARGET;
  const manualConfigs = options.manualConfigs ?? HOST_PLANT_GUIDES;
  const manualNameSet = new Set();
  const usedSlugs = new Set();

  manualConfigs.forEach((guide) => {
    usedSlugs.add(guide.slug);
    [guide.name, ...(Array.isArray(guide.variants) ? guide.variants : [])]
      .map(normalizePlantName)
      .filter(Boolean)
      .forEach((name) => manualNameSet.add(name));
  });

  const autoLimit = Math.max(0, target - manualConfigs.length);
  const autoConfigs = [];
  for (const candidate of collectAutoHostPlantCandidates(dataset)) {
    if (autoConfigs.length >= autoLimit) break;
    if (manualNameSet.has(candidate.name)) continue;

    const variants = [...candidate.aliases]
      .filter((variant) => !manualNameSet.has(variant))
      .slice(0, AUTO_HOST_PLANT_GUIDE_MAX_VARIANTS);
    if (variants.length === 0) variants.push(candidate.name);

    autoConfigs.push({
      slug: createAutoHostPlantGuideSlug(candidate.name, candidate.detail, usedSlugs),
      name: candidate.name,
      variants,
      searchPhrases: [
        `${candidate.name}につく虫`,
        `${candidate.name} 幼虫 食草`,
        `${candidate.name}を食べる蛾`,
      ],
      autoGenerated: true,
      relatedCountHint: candidate.relatedCount,
    });
  }

  return [...manualConfigs, ...autoConfigs];
}

function getInsectType(insect) {
  const family = `${insect.familyJapanese || ''} ${insect.classification?.familyJapanese || ''}`;
  if (family.includes('アブラムシ')) return 'aphid';
  return insect.type || 'moth';
}

function getInsectRoute(insect) {
  const type = getInsectType(insect);
  return `${TYPE_ROUTE_PREFIXES[type] || '/meta/moth/'}${encodePathSegment(insect.id)}.html`;
}

function readDataset() {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`full-dataset.json not found: ${DATASET_PATH}`);
  }
  return JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
}

function flattenInsects(dataset) {
  return [
    ...(dataset.moths || []),
    ...(dataset.butterflies || []),
    ...(dataset.beetles || []),
    ...(dataset.longhornbeetles || []),
    ...(dataset.leafbeetles || []),
    ...(dataset.aphids || []),
  ].map((insect) => ({
    ...insect,
    type: getInsectType(insect),
  }));
}

function findPlantMetaHref(plantName, plantDetails = {}) {
  const detail = plantDetails[plantName] || {};
  const candidates = [
    detail.familyName ? `${plantName}(${detail.familyName}).html` : '',
    detail.family ? `${plantName}(${detail.family}).html` : '',
    `${plantName}.html`,
  ].filter(Boolean);

  const filename = candidates.find((candidate) => fs.existsSync(path.join(PLANT_META_DIR, candidate)));
  if (!filename) return '/meta/plant/index.html';
  return `/meta/plant/${encodePathSegment(filename)}`;
}

function collectGuideData(config, dataset, insects) {
  const variantSet = new Set(config.variants.map(normalizePlantName));
  const matchedVariants = config.variants
    .filter((variant) => Array.isArray(dataset.hostPlants?.[variant]) && dataset.hostPlants[variant].length > 0)
    .map((variant) => ({
      name: variant,
      count: new Set(dataset.hostPlants[variant]).size,
      href: findPlantMetaHref(variant, dataset.plantDetails),
    }));

  const relatedById = new Map();
  insects.forEach((insect) => {
    const hostPlants = Array.isArray(insect.hostPlantsDetailed) ? insect.hostPlantsDetailed : [];
    const matches = hostPlants.some((hostPlant) => {
      const names = [
        hostPlant?.name,
        hostPlant?.displayName,
        normalizePlantName(hostPlant?.name),
        normalizePlantName(hostPlant?.displayName),
      ].filter(Boolean).map(normalizePlantName);
      return names.some((name) => variantSet.has(name));
    });
    if (matches) relatedById.set(insect.id, insect);
  });

  const relatedInsects = [...relatedById.values()].sort((a, b) => {
    const typeDiff = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    return String(a.name || a.japaneseName || '').localeCompare(String(b.name || b.japaneseName || ''), 'ja');
  });

  const typeCounts = Object.fromEntries(TYPE_CONFIGS.map(([type]) => [type, 0]));
  relatedInsects.forEach((insect) => {
    typeCounts[insect.type] = (typeCounts[insect.type] || 0) + 1;
  });

  const primaryVariant = [...matchedVariants].sort((a, b) => b.count - a.count)[0];
  return {
    ...config,
    matchedVariants,
    primaryPlantHref: primaryVariant?.href || '/meta/plant/index.html',
    relatedInsects,
    typeCounts,
  };
}

function collectCategoryData(config, guideBySlug) {
  const plantGuides = config.plantSlugs
    .map((slug) => guideBySlug.get(slug))
    .filter(Boolean);
  const relatedById = new Map();
  plantGuides.forEach((guide) => {
    guide.relatedInsects.forEach((insect) => relatedById.set(insect.id, insect));
  });
  const relatedInsects = [...relatedById.values()].sort((a, b) => {
    const typeDiff = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    return String(a.name || a.japaneseName || '').localeCompare(String(b.name || b.japaneseName || ''), 'ja');
  });
  const typeCounts = Object.fromEntries(TYPE_CONFIGS.map(([type]) => [type, 0]));
  relatedInsects.forEach((insect) => {
    typeCounts[insect.type] = (typeCounts[insect.type] || 0) + 1;
  });
  return {
    ...config,
    plantGuides,
    relatedInsects,
    typeCounts,
  };
}

function normalizeFamilyName(value = '') {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();
}

function collectFamilyData(config, dataset, insects) {
  const targetFamily = normalizeFamilyName(config.name);
  const plantDetails = dataset.plantDetails || {};
  const plantRows = Object.entries(dataset.hostPlants || {})
    .map(([plantName, insectIds]) => {
      const detail = normalizeEnglishPlantDetail(plantName, plantDetails);
      const familyName = normalizeFamilyName(detail.familyName || detail.family || '');
      if (familyName !== targetFamily) return null;
      const ids = Array.from(new Set((Array.isArray(insectIds) ? insectIds : []).filter(Boolean)));
      if (ids.length === 0) return null;
      return {
        name: plantName,
        href: findPlantMetaHref(plantName, plantDetails),
        count: ids.length,
        aliases: Array.isArray(detail.aliases) ? detail.aliases : [],
        familyLatin: detail.familyLatin || '',
        scientificName: detail.scientificName || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'ja');
    });

  const relatedById = new Map();
  const familyPlantNames = new Set(
    plantRows.flatMap((row) => [row.name, ...row.aliases].filter(Boolean).map(normalizePlantName)),
  );
  insects.forEach((insect) => {
    const hostPlants = Array.isArray(insect.hostPlantsDetailed) ? insect.hostPlantsDetailed : [];
    const matches = hostPlants.some((hostPlant) => {
      const names = [
        hostPlant?.name,
        hostPlant?.displayName,
        normalizePlantName(hostPlant?.name),
        normalizePlantName(hostPlant?.displayName),
      ].filter(Boolean).map(normalizePlantName);
      return names.some((name) => familyPlantNames.has(name));
    });
    if (matches) relatedById.set(insect.id, insect);
  });

  const relatedInsects = [...relatedById.values()].sort((a, b) => {
    const typeDiff = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    return String(a.name || a.japaneseName || '').localeCompare(String(b.name || b.japaneseName || ''), 'ja');
  });

  const typeCounts = Object.fromEntries(TYPE_CONFIGS.map(([type]) => [type, 0]));
  relatedInsects.forEach((insect) => {
    typeCounts[insect.type] = (typeCounts[insect.type] || 0) + 1;
  });

  return {
    ...config,
    familyLatin: plantRows.find((row) => row.familyLatin)?.familyLatin || '',
    plantRows,
    relatedInsects,
    typeCounts,
  };
}

function readJsonIfExists(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.warn(`[guides] JSON読み込み失敗: ${path.relative(ROOT_DIR, filePath)} (${error.message})`);
    return fallback;
  }
}

function normalizeEnglishPlantDetail(plantName, plantDetails = {}) {
  return plantDetails?.[plantName] || {
    name: plantName,
    familyName: '',
    familyLatin: '',
    scientificName: '',
    aliases: [plantName],
  };
}

function findRepresentativePlantDetail(guide, plantDetails = {}) {
  const candidates = [
    ...guide.matchedVariants.map((variant) => variant.name),
    ...guide.variants,
    guide.name,
  ];
  for (const name of candidates) {
    const detail = normalizeEnglishPlantDetail(name, plantDetails);
    if (detail?.scientificName || detail?.familyLatin || detail?.familyName) {
      return { name, detail };
    }
  }
  return { name: guide.name, detail: normalizeEnglishPlantDetail(guide.name, plantDetails) };
}

function buildEnglishGuideDisplay(guide, plantDetails = {}) {
  const representative = findRepresentativePlantDetail(guide, plantDetails);
  const label = ENGLISH_GUIDE_LABELS[guide.slug] || getPrimaryEnglishName({
    scientificName: representative.detail?.scientificName,
    japaneseName: representative.name || guide.name,
    fallback: guide.name,
  });
  return {
    label,
    japaneseName: guide.name,
    scientificName: representative.detail?.scientificName || '',
    familyLatin: representative.detail?.familyLatin || '',
    familyJapanese: representative.detail?.familyName || representative.detail?.family || '',
  };
}

function buildEnglishCategoryDisplay(category) {
  return {
    label: ENGLISH_CATEGORY_LABELS[category.slug] || category.name,
    japaneseName: category.name,
  };
}

function buildEnglishFamilyDisplay(family) {
  return {
    label: ENGLISH_FAMILY_LABELS[family.slug] || family.familyLatin || family.name,
    japaneseName: family.name,
    familyLatin: family.familyLatin || '',
  };
}

function buildRouteMaps() {
  return {
    insects: readJsonIfExists(SEO_ROUTE_MAP_INSECTS_PATH, {}),
    plants: readJsonIfExists(SEO_ROUTE_MAP_PLANTS_PATH, {}),
  };
}

function resolveEnglishPlantHref(guide, routeMaps = {}, plantDetails = {}) {
  const candidates = Array.from(new Set([
    guide.name,
    ...guide.matchedVariants.map((variant) => variant.name),
    ...guide.variants,
  ].filter(Boolean)));

  for (const name of candidates) {
    if (routeMaps.plants?.[name]) return routeMaps.plants[name];
    const detail = normalizeEnglishPlantDetail(name, plantDetails);
    if (detail?.scientificName && routeMaps.plants?.[detail.scientificName]) {
      return routeMaps.plants[detail.scientificName];
    }
  }
  return '/en/meta/plant/index.html';
}

function resolveEnglishFamilyPlantHref(row, routeMaps = {}) {
  if (routeMaps.plants?.[row.name]) return routeMaps.plants[row.name];
  if (row.scientificName && routeMaps.plants?.[row.scientificName]) {
    return routeMaps.plants[row.scientificName];
  }
  return '/en/meta/plant/index.html';
}

function resolveEnglishInsectHref(insect, routeMaps = {}) {
  return routeMaps.insects?.[insect.id] || getInsectRoute(insect);
}

function buildEnglishSearchPhrases(label, localName, context = 'host plant insects') {
  const primary = String(label || '').replace(/\s*\([^)]*\)/g, '').trim() || localName;
  return Array.from(new Set([
    `${primary} ${context} Japan`,
    `Japanese insects on ${primary}`,
    `${primary} larval host plants`,
    localName ? `${localName} host plant insects` : '',
  ].filter(Boolean)));
}

function renderEnglishHead({ title, description, canonicalPath, japanesePath, ogType = 'article' }) {
  const canonicalUrl = `${BASE_ORIGIN}${canonicalPath}`;
  const japaneseUrl = japanesePath ? `${BASE_ORIGIN}${japanesePath}` : '';
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${ADSENSE_HEAD_TAGS}
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  ${japaneseUrl ? `<link rel="alternate" hreflang="ja" href="${escapeHtml(japaneseUrl)}">` : ''}
  <link rel="alternate" hreflang="en" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:site_name" content="${escapeHtml(EN_SITE_NAME)}">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">`;
}

function renderHead({ title, description, canonicalPath }) {
  const canonicalUrl = `${BASE_ORIGIN}${canonicalPath}`;
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${ADSENSE_HEAD_TAGS}
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="ja" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:site_name" content="昆虫植物図鑑">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">`;
}

function renderStyle() {
  return `<style>
    :root{color-scheme:light;--ink:#0f172a;--muted:#475569;--line:#dbe4ea;--panel:#fff;--accent:#047857;--bg:#f8fafc}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;line-height:1.75}
    .wrap{max-width:1040px;margin:0 auto;padding:28px 18px 48px}
    .top{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:28px}
    .brand{font-weight:800;color:var(--accent);text-decoration:none}
    .nav{display:flex;flex-wrap:wrap;gap:12px;font-size:14px}
    a{color:#0369a1;text-decoration:none}
    a:hover{text-decoration:underline}
    h1{font-size:clamp(30px,5vw,44px);line-height:1.2;margin:0 0 12px}
    h2{font-size:23px;margin:32px 0 12px}
    h3{font-size:18px;margin:0 0 8px}
    p{margin:0 0 12px}
    .lead{font-size:17px;color:var(--muted);max-width:780px}
    .badge{display:inline-flex;margin-bottom:10px;padding:3px 10px;border:1px solid #bbf7d0;border-radius:999px;background:#f0fdf4;color:#166534;font-size:12px;font-weight:700}
    .panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin-top:18px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px}
    .count{font-size:30px;font-weight:800;color:#14532d;line-height:1}
    .muted{color:var(--muted)}
    .chips{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
    .chips li{border:1px solid #bae6fd;background:#ecfeff;border-radius:999px;padding:4px 10px;font-size:14px}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
    th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    th{background:#f1f5f9}
    tr:last-child td{border-bottom:0}
    .insect-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;padding:0;list-style:none}
    .insect-list li{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px}
    .faq{display:grid;gap:14px;margin:0}
    .faq dt{font-weight:800}
    .faq dd{margin:4px 0 0;color:var(--muted)}
    .scientific{display:block;color:var(--muted);font-size:13px;font-style:italic;margin-top:2px}
    .small{font-size:14px;color:var(--muted)}
  </style>`;
}

function renderHeader() {
  return `<div class="top">
      <a class="brand" href="/">昆虫植物図鑑</a>
      <nav class="nav" aria-label="主要リンク">
        <a href="/guides/">調べ方ガイド</a>
        <a href="/guides/insect-plant-database.html">昆虫植物図鑑とは</a>
        <a href="/guides/what-is-host-plant.html">食草とは</a>
        <a href="/guides/plants/">植物別ガイド</a>
        <a href="/guides/categories/">カテゴリ別ガイド</a>
        <a href="/guides/families/">科別ガイド</a>
        <a href="/meta/plant/index.html">植物一覧</a>
        <a href="/meta/moth/index.html">昆虫一覧</a>
      </nav>
    </div>`;
}

function renderGuidePage(guide) {
  const canonicalPath = `/guides/plants/${guide.slug}.html`;
  const count = guide.relatedInsects.length;
  const typeSummary = TYPE_CONFIGS
    .filter(([type]) => guide.typeCounts[type] > 0)
    .map(([type, label]) => `${label}${guide.typeCounts[type]}種`)
    .join('、');
  const representativeNames = guide.relatedInsects.slice(0, 4).map((insect) => insect.name || insect.japaneseName).join('、');
  const title = `${guide.name}につく虫・幼虫の食草一覧 | 昆虫植物図鑑`;
  const description = truncate(`${guide.name}を食草・寄主植物として利用する昆虫をデータから整理。${typeSummary || `計${count}種`}、代表例は${representativeNames}など。植物名から幼虫や関連昆虫を調べられます。`, 155);
  const variantsText = guide.matchedVariants.map((variant) => variant.name).join('、');
  const shownInsects = guide.relatedInsects.slice(0, 48);
  const mothCount = guide.typeCounts.moth || 0;
  const butterflyCount = guide.typeCounts.butterfly || 0;
  const larvalTypeText = [
    mothCount > 0 ? `蛾${mothCount}種` : '',
    butterflyCount > 0 ? `蝶${butterflyCount}種` : '',
  ].filter(Boolean).join('、');
  const faqItems = [
    {
      question: `${guide.name}につく虫は何種ありますか？`,
      answer: `昆虫植物図鑑の整理済みデータでは、${guide.name}を食草・寄主植物として利用する昆虫を${count}種掲載しています。内訳は${typeSummary || `計${count}種`}です。`,
    },
    {
      question: `${guide.name}を食べる幼虫や毛虫を調べるには？`,
      answer: `${guide.name}についていた幼虫や毛虫は、まずこのページの代表的な関連昆虫を確認してください。${larvalTypeText ? `幼虫期に植物を食べる分類群として${larvalTypeText}が含まれます。` : '関連昆虫の候補から各種ページへ進むと、食草や出典を確認できます。'}`,
    },
    {
      question: `${guide.name}の食草記録を詳しく確認するには？`,
      answer: `全件は${guide.name}の植物ページと各昆虫ページで確認できます。近縁種や表記ゆれを含む場合があるため、報告や同定に使う場合は各ページの出典を確認してください。`,
    },
  ];
  const itemList = shownInsects.slice(0, 20).map((insect, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'WebPage',
      name: insect.name || insect.japaneseName,
      url: `${BASE_ORIGIN}${getInsectRoute(insect)}`,
    },
  }));
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${guide.name}につく虫・幼虫の食草一覧`,
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'ja',
    isPartOf: {
      '@type': 'WebSite',
      name: '昆虫植物図鑑',
      url: `${BASE_ORIGIN}/`,
    },
    about: {
      '@type': 'Thing',
      name: `${guide.name}と昆虫の食草関係`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: count,
      itemListElement: itemList,
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '昆虫植物図鑑', item: `${BASE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: '調べ方ガイド', item: `${BASE_ORIGIN}/guides/` },
      { '@type': 'ListItem', position: 3, name: '植物別ガイド', item: `${BASE_ORIGIN}/guides/plants/` },
      { '@type': 'ListItem', position: 4, name: `${guide.name}につく虫`, item: `${BASE_ORIGIN}${canonicalPath}` },
    ],
  };
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  ${renderHead({ title, description, canonicalPath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  <script type="application/ld+json">${escapeJson(breadcrumbData)}</script>
  <script type="application/ld+json">${escapeJson(faqData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderHeader()}
    <header>
      <span class="badge">植物別ガイド</span>
      <h1>${escapeHtml(guide.name)}につく虫・幼虫の食草一覧</h1>
      <p class="lead">${escapeHtml(guide.name)}を食べる幼虫や、寄主植物として利用する昆虫を、昆虫植物図鑑のデータからまとめた入口ページです。</p>
    </header>

    <main>
      <section class="panel">
        <div class="grid">
          <div class="card">
            <div class="count">${count}</div>
            <p class="muted">関連昆虫数</p>
          </div>
          <div class="card">
            <h2>対象に含めた植物名</h2>
            <p>${escapeHtml(variantsText || guide.name)}</p>
            <p class="small">近縁・表記ゆれを含むため、厳密な同定や報告では各植物ページと出典を確認してください。</p>
          </div>
          <div class="card">
            <h2>詳しい一覧</h2>
            <p><a href="${escapeHtml(guide.primaryPlantHref)}">${escapeHtml(guide.name)}の植物ページで全件を見る</a></p>
          </div>
        </div>
      </section>

      <section aria-labelledby="type-breakdown">
        <h2 id="type-breakdown">分類群別の内訳</h2>
        <table>
          <thead><tr><th>分類群</th><th>記録数</th></tr></thead>
          <tbody>
            ${TYPE_CONFIGS
              .filter(([type]) => guide.typeCounts[type] > 0)
              .map(([type, label]) => `<tr><td>${label}</td><td>${guide.typeCounts[type]}種</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="representatives">
        <h2 id="representatives">代表的な関連昆虫</h2>
        <ul class="insect-list">
          ${shownInsects.map((insect) => `
          <li>
            <a href="${escapeHtml(getInsectRoute(insect))}">${escapeHtml(insect.name || insect.japaneseName)}</a>
            <span class="small">（${escapeHtml(TYPE_LABELS[insect.type] || '昆虫')}）</span>
            ${insect.scientificName ? `<span class="scientific">${escapeHtml(insect.scientificName)}</span>` : ''}
          </li>`).join('')}
        </ul>
        ${count > shownInsects.length ? `<p class="small">表示は一部です。全${count}種は <a href="${escapeHtml(guide.primaryPlantHref)}">${escapeHtml(guide.name)}の植物ページ</a> で確認できます。</p>` : ''}
      </section>

      <section class="panel" aria-labelledby="faq">
        <h2 id="faq">よくある疑問</h2>
        <dl class="faq">
          ${faqItems.map((item) => `
          <div>
            <dt>${escapeHtml(item.question)}</dt>
            <dd>${escapeHtml(item.answer)}</dd>
          </div>`).join('')}
        </dl>
      </section>

      <section class="panel" aria-labelledby="search-terms">
        <h2 id="search-terms">このページが対応する検索語</h2>
        <ul class="chips">
          ${guide.searchPhrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}
        </ul>
      </section>

      <section aria-labelledby="variants">
        <h2 id="variants">植物名別の詳細ページ</h2>
        <ul>
          ${guide.matchedVariants.map((variant) => `
          <li><a href="${escapeHtml(variant.href)}">${escapeHtml(variant.name)}</a>（${variant.count}種）</li>`).join('')}
        </ul>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderCategoryPage(category) {
  const canonicalPath = `/guides/categories/${category.slug}.html`;
  const count = category.relatedInsects.length;
  const typeSummary = TYPE_CONFIGS
    .filter(([type]) => category.typeCounts[type] > 0)
    .map(([type, label]) => `${label}${category.typeCounts[type]}種`)
    .join('、');
  const plantNames = category.plantGuides.slice(0, 6).map((guide) => guide.name).join('、');
  const title = `${category.name}につく虫・幼虫の食草ガイド | 昆虫植物図鑑`;
  const description = truncate(`${category.name}につく虫を、${plantNames}などの植物別データから整理。${typeSummary || `計${count}種`}を植物名から調べられます。`, 155);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name}につく虫・幼虫の食草ガイド`,
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'ja',
    isPartOf: {
      '@type': 'WebSite',
      name: '昆虫植物図鑑',
      url: `${BASE_ORIGIN}/`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: category.plantGuides.length,
      itemListElement: category.plantGuides.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${guide.name}につく虫`,
          url: `${BASE_ORIGIN}/guides/plants/${guide.slug}.html`,
        },
      })),
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '昆虫植物図鑑', item: `${BASE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: '調べ方ガイド', item: `${BASE_ORIGIN}/guides/` },
      { '@type': 'ListItem', position: 3, name: 'カテゴリ別ガイド', item: `${BASE_ORIGIN}/guides/categories/` },
      { '@type': 'ListItem', position: 4, name: `${category.name}につく虫`, item: `${BASE_ORIGIN}${canonicalPath}` },
    ],
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  ${renderHead({ title, description, canonicalPath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  <script type="application/ld+json">${escapeJson(breadcrumbData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderHeader()}
    <header>
      <span class="badge">カテゴリ別ガイド</span>
      <h1>${escapeHtml(category.name)}につく虫・幼虫の食草ガイド</h1>
      <p class="lead">${escapeHtml(category.name)}としてよく調べられる植物をまとめ、植物別の食草・寄主植物データへ進める入口です。</p>
    </header>

    <main>
      <section class="panel">
        <div class="grid">
          <div class="card">
            <div class="count">${count}</div>
            <p class="muted">重複を除いた関連昆虫数</p>
          </div>
          <div class="card">
            <div class="count">${category.plantGuides.length}</div>
            <p class="muted">植物別ガイド数</p>
          </div>
          <div class="card">
            <h2>検索語</h2>
            <ul class="chips">
              ${category.searchPhrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="plant-guides">
        <h2 id="plant-guides">${escapeHtml(category.name)}の植物別ガイド</h2>
        <div class="grid">
          ${category.plantGuides.map((guide) => `
          <article class="card">
            <h3><a href="/guides/plants/${guide.slug}.html">${escapeHtml(guide.name)}につく虫</a></h3>
            <p>${guide.relatedInsects.length}種の関連昆虫を掲載。</p>
            <p class="small">${escapeHtml(guide.searchPhrases.slice(0, 2).join(' / '))}</p>
          </article>`).join('')}
        </div>
      </section>

      <section aria-labelledby="type-breakdown">
        <h2 id="type-breakdown">分類群別の内訳</h2>
        <table>
          <thead><tr><th>分類群</th><th>記録数</th></tr></thead>
          <tbody>
            ${TYPE_CONFIGS
              .filter(([type]) => category.typeCounts[type] > 0)
              .map(([type, label]) => `<tr><td>${label}</td><td>${category.typeCounts[type]}種</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderFamilyPage(family) {
  const canonicalPath = `/guides/families/${family.slug}.html`;
  const count = family.relatedInsects.length;
  const typeSummary = TYPE_CONFIGS
    .filter(([type]) => family.typeCounts[type] > 0)
    .map(([type, label]) => `${label}${family.typeCounts[type]}種`)
    .join('、');
  const plantNames = family.plantRows.slice(0, 8).map((row) => row.name).join('、');
  const title = `${family.name}につく虫・食草植物一覧 | 昆虫植物図鑑`;
  const description = truncate(`${family.name}の植物につく虫を、${plantNames}などの植物別データから整理。${family.plantRows.length}植物、${typeSummary || `計${count}種`}を確認できます。`, 155);
  const shownPlants = family.plantRows.slice(0, 80);
  const shownInsects = family.relatedInsects.slice(0, 48);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${family.name}につく虫・食草植物一覧`,
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'ja',
    isPartOf: {
      '@type': 'WebSite',
      name: '昆虫植物図鑑',
      url: `${BASE_ORIGIN}/`,
    },
    about: {
      '@type': 'Thing',
      name: `${family.name}の植物と昆虫の食草関係`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: family.plantRows.length,
      itemListElement: shownPlants.slice(0, 30).map((row, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${row.name}につく虫`,
          url: `${BASE_ORIGIN}${row.href}`,
        },
      })),
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '昆虫植物図鑑', item: `${BASE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: '調べ方ガイド', item: `${BASE_ORIGIN}/guides/` },
      { '@type': 'ListItem', position: 3, name: '科別ガイド', item: `${BASE_ORIGIN}/guides/families/` },
      { '@type': 'ListItem', position: 4, name: `${family.name}につく虫`, item: `${BASE_ORIGIN}${canonicalPath}` },
    ],
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  ${renderHead({ title, description, canonicalPath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  <script type="application/ld+json">${escapeJson(breadcrumbData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderHeader()}
    <header>
      <span class="badge">科別ガイド</span>
      <h1>${escapeHtml(family.name)}につく虫・食草植物一覧</h1>
      <p class="lead">${escapeHtml(family.name)}に含まれる植物から、食草・寄主植物として記録された昆虫へ進むための静的な入口ページです。</p>
    </header>

    <main>
      <section class="panel">
        <div class="grid">
          <div class="card">
            <div class="count">${family.plantRows.length}</div>
            <p class="muted">データに含まれる植物数</p>
          </div>
          <div class="card">
            <div class="count">${count}</div>
            <p class="muted">重複を除いた関連昆虫数</p>
          </div>
          <div class="card">
            <h2>検索語</h2>
            <ul class="chips">
              ${family.searchPhrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="plants">
        <h2 id="plants">${escapeHtml(family.name)}の植物と関連昆虫数</h2>
        <table>
          <thead><tr><th>植物名</th><th>関連昆虫数</th></tr></thead>
          <tbody>
            ${shownPlants.map((row) => `
            <tr>
              <td><a href="${escapeHtml(row.href)}">${escapeHtml(row.name)}</a>${row.scientificName ? `<span class="scientific">${escapeHtml(row.scientificName)}</span>` : ''}</td>
              <td>${row.count}種</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${family.plantRows.length > shownPlants.length ? `<p class="small">表示は関連昆虫数の多い上位${shownPlants.length}植物です。</p>` : ''}
      </section>

      <section aria-labelledby="type-breakdown">
        <h2 id="type-breakdown">分類群別の内訳</h2>
        <table>
          <thead><tr><th>分類群</th><th>記録数</th></tr></thead>
          <tbody>
            ${TYPE_CONFIGS
              .filter(([type]) => family.typeCounts[type] > 0)
              .map(([type, label]) => `<tr><td>${label}</td><td>${family.typeCounts[type]}種</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="representatives">
        <h2 id="representatives">代表的な関連昆虫</h2>
        <ul class="insect-list">
          ${shownInsects.map((insect) => `
          <li>
            <a href="${escapeHtml(getInsectRoute(insect))}">${escapeHtml(insect.name || insect.japaneseName)}</a>
            <span class="small">（${escapeHtml(TYPE_LABELS[insect.type] || '昆虫')}）</span>
            ${insect.scientificName ? `<span class="scientific">${escapeHtml(insect.scientificName)}</span>` : ''}
          </li>`).join('')}
        </ul>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderFamilyIndexPage(families) {
  const canonicalPath = '/guides/families/';
  const title = '科別につく虫・食草植物を調べる | 昆虫植物図鑑';
  const description = 'バラ科、ブナ科、マメ科、イネ科、キク科、アオイ科など、植物の科名からその植物につく虫・幼虫・食草関係を調べるためのガイド一覧です。';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '科別につく虫・食草植物を調べる',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'ja',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: families.length,
      itemListElement: families.map((family, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${family.name}につく虫`,
          url: `${BASE_ORIGIN}/guides/families/${family.slug}.html`,
        },
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  ${renderHead({ title, description, canonicalPath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderHeader()}
    <header>
      <span class="badge">科別ガイド</span>
      <h1>科名から、その植物につく虫を調べる</h1>
      <p class="lead">植物名が分からない場合や「アオイ科」「バラ科」のような科名検索から、関連昆虫と植物ページへ進むための入口です。</p>
    </header>

    <main>
      <section class="grid" aria-label="科別ガイド一覧">
        ${families.map((family) => `
        <article class="card">
          <h2><a href="/guides/families/${family.slug}.html">${escapeHtml(family.name)}につく虫</a></h2>
          <p>${family.plantRows.length}植物、${family.relatedInsects.length}種の関連昆虫を掲載。</p>
          <p class="small">${escapeHtml(family.searchPhrases.slice(0, 2).join(' / '))}</p>
        </article>`).join('')}
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderCategoryIndexPage(categories) {
  const canonicalPath = '/guides/categories/';
  const title = 'カテゴリ別につく虫を調べる | 昆虫植物図鑑';
  const description = '庭木、果樹、野菜、広葉樹、雑草など、植物カテゴリからその植物につく虫・幼虫・食草関係を調べるためのガイド一覧です。';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'カテゴリ別につく虫を調べる',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'ja',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: categories.length,
      itemListElement: categories.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${category.name}につく虫`,
          url: `${BASE_ORIGIN}/guides/categories/${category.slug}.html`,
        },
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  ${renderHead({ title, description, canonicalPath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderHeader()}
    <header>
      <span class="badge">カテゴリ別ガイド</span>
      <h1>カテゴリから、その植物につく虫を調べる</h1>
      <p class="lead">庭木、果樹、野菜、広葉樹など、植物名がまだ絞れていない検索から入れるようにしたガイドです。</p>
    </header>

    <main>
      <section class="grid" aria-label="カテゴリ別ガイド一覧">
        ${categories.map((category) => `
        <article class="card">
          <h2><a href="/guides/categories/${category.slug}.html">${escapeHtml(category.name)}につく虫</a></h2>
          <p>${category.plantGuides.length}件の植物別ガイド、${category.relatedInsects.length}種の関連昆虫を掲載。</p>
          <p class="small">${escapeHtml(category.searchPhrases.slice(0, 2).join(' / '))}</p>
        </article>`).join('')}
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderIndexPage(guides, categories = [], families = []) {
  const canonicalPath = '/guides/plants/';
  const title = '植物別につく虫を調べる | 昆虫植物図鑑';
  const description = 'サクラ、クヌギ、コナラ、ヨモギなど、植物名からその植物につく虫・幼虫・食草関係を調べるための植物別ガイド一覧です。';
  const categorySection = categories.length > 0
    ? `      <section class="panel" aria-labelledby="category-guides">
        <h2 id="category-guides">カテゴリから探す</h2>
        <p>植物名がまだ分からない場合は、庭木、果樹、野菜、広葉樹などのカテゴリから入れます。</p>
        <p><a href="/guides/categories/">カテゴリ別につく虫を調べる</a></p>
      </section>

`
    : '';
  const familySection = families.length > 0
    ? `      <section class="panel" aria-labelledby="family-guides">
        <h2 id="family-guides">科名から探す</h2>
        <p>植物名が分からない場合は、バラ科、ブナ科、アオイ科などの科名から入れます。</p>
        <p><a href="/guides/families/">科別につく虫・食草植物を調べる</a></p>
      </section>

`
    : '';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '植物別につく虫を調べる',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'ja',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: guides.length,
      itemListElement: guides.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${guide.name}につく虫`,
          url: `${BASE_ORIGIN}/guides/plants/${guide.slug}.html`,
        },
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  ${renderHead({ title, description, canonicalPath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderHeader()}
    <header>
      <span class="badge">植物別ガイド</span>
      <h1>植物名から、その植物につく虫を調べる</h1>
      <p class="lead">検索されやすい植物について、幼虫の食草・寄主植物として利用する昆虫を一覧できる入口をまとめました。</p>
    </header>

    <main>
${categorySection}
${familySection}
      <section class="grid" aria-label="植物別ガイド一覧">
        ${guides.map((guide) => `
        <article class="card">
          <h2><a href="/guides/plants/${guide.slug}.html">${escapeHtml(guide.name)}につく虫</a></h2>
          <p>${guide.relatedInsects.length}種の関連昆虫を掲載。</p>
          <p class="small">${escapeHtml(guide.searchPhrases.slice(0, 2).join(' / '))}</p>
        </article>`).join('')}
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishHeader(japanesePath = '/guides/') {
  return `<div class="top">
      <a class="brand" href="/en/">${escapeHtml(EN_SITE_NAME)}</a>
      <nav class="nav" aria-label="Primary links">
        <a href="/en/guides/">Search guides</a>
        <a href="/en/guides/what-is-host-plant.html">Host plant basics</a>
        <a href="/en/guides/plants/">Host plant guides</a>
        <a href="/en/guides/categories/">Category guides</a>
        <a href="/en/guides/families/">Family guides</a>
        <a href="/en/meta/plant/index.html">Plants</a>
        <a href="/en/meta/moth/index.html">Insects</a>
        <a href="${escapeHtml(japanesePath)}">日本語</a>
      </nav>
    </div>`;
}

function formatEnglishTypeSummary(typeCounts = {}) {
  return Object.keys(typeCounts)
    .filter((type) => typeCounts[type] > 0)
    .sort((a, b) => (EN_TYPE_ORDER[a] ?? 99) - (EN_TYPE_ORDER[b] ?? 99))
    .map((type) => `${typeCounts[type]} ${typeCounts[type] === 1 ? EN_TYPE_LABELS[type] : EN_TYPE_PLURALS[type]}`)
    .join(', ');
}

function renderEnglishTypeBreakdown(typeCounts = {}) {
  return Object.keys(typeCounts)
    .filter((type) => typeCounts[type] > 0)
    .sort((a, b) => (EN_TYPE_ORDER[a] ?? 99) - (EN_TYPE_ORDER[b] ?? 99))
    .map((type) => `
            <tr><td>${escapeHtml(typeCounts[type] === 1 ? EN_TYPE_LABELS[type] : EN_TYPE_PLURALS[type])}</td><td>${typeCounts[type]}</td></tr>`)
    .join('');
}

function buildEnglishInsectListItem(insect, routeMaps) {
  const href = resolveEnglishInsectHref(insect, routeMaps);
  const primaryName = getPrimaryEnglishName({
    scientificName: insect.scientificName,
    japaneseName: insect.name || insect.japaneseName,
    fallback: insect.id,
  });
  const japaneseReference = buildJapaneseReferenceLabel(insect.name || insect.japaneseName);
  return `
          <li>
            <a href="${escapeHtml(href)}">${escapeHtml(primaryName)}</a>
            <span class="small">(${escapeHtml(EN_TYPE_LABELS[insect.type] || 'Insect')})</span>
            ${japaneseReference ? `<span class="scientific">${escapeHtml(japaneseReference)}</span>` : ''}
          </li>`;
}

function renderEnglishGuidePage(guide, routeMaps, plantDetails = {}) {
  const canonicalPath = `/en/guides/plants/${guide.slug}.html`;
  const japanesePath = `/guides/plants/${guide.slug}.html`;
  const display = buildEnglishGuideDisplay(guide, plantDetails);
  const count = guide.relatedInsects.length;
  const typeSummary = formatEnglishTypeSummary(guide.typeCounts);
  const shownInsects = guide.relatedInsects.slice(0, 48);
  const englishPlantHref = resolveEnglishPlantHref(guide, routeMaps, plantDetails);
  const variantsText = guide.matchedVariants.map((variant) => variant.name).join(', ');
  const searchPhrases = buildEnglishSearchPhrases(display.label, guide.name);
  const representativeNames = shownInsects
    .slice(0, 4)
    .map((insect) => insect.scientificName || insect.name || insect.japaneseName)
    .filter(Boolean)
    .join(', ');
  const title = `${display.label} host plant insects in Japan | ${EN_SITE_NAME}`;
  const description = truncate(
    `${count} Japanese insect records are associated with ${display.label}. Groups include ${typeSummary || 'multiple insect groups'}. Representative pages include ${representativeNames}.`,
    155,
  );
  const itemList = shownInsects.slice(0, 20).map((insect, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'WebPage',
      name: getPrimaryEnglishName({
        scientificName: insect.scientificName,
        japaneseName: insect.name || insect.japaneseName,
        fallback: insect.id,
      }),
      url: `${BASE_ORIGIN}${resolveEnglishInsectHref(insect, routeMaps)}`,
    },
  }));
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${display.label} host plant insects in Japan`,
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: EN_SITE_NAME,
      url: `${BASE_ORIGIN}/en/`,
    },
    about: {
      '@type': 'Thing',
      name: `${display.label} and plant-insect records from Japan`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: count,
      itemListElement: itemList,
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: EN_SITE_NAME, item: `${BASE_ORIGIN}/en/` },
      { '@type': 'ListItem', position: 2, name: 'Search guides', item: `${BASE_ORIGIN}/en/guides/` },
      { '@type': 'ListItem', position: 3, name: 'Host plant guides', item: `${BASE_ORIGIN}/en/guides/plants/` },
      { '@type': 'ListItem', position: 4, name: display.label, item: `${BASE_ORIGIN}${canonicalPath}` },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  <script type="application/ld+json">${escapeJson(breadcrumbData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Host plant guide</span>
      <h1>${escapeHtml(display.label)} host plant insects in Japan</h1>
      <p class="lead">A static entry page for finding insects recorded from this plant or plant group in the Japanese source dataset.</p>
    </header>

    <main>
      <section class="panel">
        <div class="grid">
          <div class="card">
            <div class="count">${count}</div>
            <p class="muted">Related insect records</p>
          </div>
          <div class="card">
            <h2>Plant reference</h2>
            <p>${escapeHtml(buildJapaneseReferenceLabel(display.japaneseName))}</p>
            ${display.scientificName ? `<p><em>${escapeHtml(display.scientificName)}</em></p>` : ''}
            ${display.familyLatin || display.familyJapanese ? `<p class="small">${escapeHtml([display.familyLatin, display.familyJapanese].filter(Boolean).join(' / '))}</p>` : ''}
          </div>
          <div class="card">
            <h2>Detailed plant page</h2>
            <p><a href="${escapeHtml(englishPlantHref)}">Open the English plant profile or plant index</a></p>
          </div>
        </div>
      </section>

      <section aria-labelledby="type-breakdown">
        <h2 id="type-breakdown">Breakdown by insect group</h2>
        <table>
          <thead><tr><th>Group</th><th>Records</th></tr></thead>
          <tbody>${renderEnglishTypeBreakdown(guide.typeCounts)}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="representatives">
        <h2 id="representatives">Representative linked insect pages</h2>
        <ul class="insect-list">
          ${shownInsects.map((insect) => buildEnglishInsectListItem(insect, routeMaps)).join('')}
        </ul>
        ${count > shownInsects.length ? `<p class="small">This page shows the first ${shownInsects.length} records. Open the linked plant profile for the full list when available.</p>` : ''}
      </section>

      <section class="panel" aria-labelledby="search-terms">
        <h2 id="search-terms">Search intents covered</h2>
        <ul class="chips">
          ${searchPhrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}
        </ul>
      </section>

      <section aria-labelledby="variants">
        <h2 id="variants">Japanese plant-name variants included</h2>
        <p>${escapeHtml(variantsText || guide.name)}</p>
        <p class="small">For research or identification use, verify the source references on the linked profile pages.</p>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishCategoryPage(category, routeMaps, plantDetails = {}) {
  const canonicalPath = `/en/guides/categories/${category.slug}.html`;
  const japanesePath = `/guides/categories/${category.slug}.html`;
  const display = buildEnglishCategoryDisplay(category);
  const count = category.relatedInsects.length;
  const typeSummary = formatEnglishTypeSummary(category.typeCounts);
  const plantNames = category.plantGuides.slice(0, 6).map((guide) => buildEnglishGuideDisplay(guide, plantDetails).label).join(', ');
  const title = `${display.label} host plant insects in Japan | ${EN_SITE_NAME}`;
  const description = truncate(
    `${display.label} guide for Japanese plant-insect records. It links ${category.plantGuides.length} host plant guides, including ${plantNames}. ${typeSummary || `${count} records`} are summarized.`,
    155,
  );
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${display.label} host plant insects in Japan`,
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: EN_SITE_NAME,
      url: `${BASE_ORIGIN}/en/`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: category.plantGuides.length,
      itemListElement: category.plantGuides.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${buildEnglishGuideDisplay(guide, plantDetails).label} host plant insects`,
          url: `${BASE_ORIGIN}/en/guides/plants/${guide.slug}.html`,
        },
      })),
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: EN_SITE_NAME, item: `${BASE_ORIGIN}/en/` },
      { '@type': 'ListItem', position: 2, name: 'Search guides', item: `${BASE_ORIGIN}/en/guides/` },
      { '@type': 'ListItem', position: 3, name: 'Category guides', item: `${BASE_ORIGIN}/en/guides/categories/` },
      { '@type': 'ListItem', position: 4, name: display.label, item: `${BASE_ORIGIN}${canonicalPath}` },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  <script type="application/ld+json">${escapeJson(breadcrumbData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Category guide</span>
      <h1>${escapeHtml(display.label)} host plant insects in Japan</h1>
      <p class="lead">A data-driven entry page that groups host plants before sending visitors to plant and insect profile pages.</p>
    </header>

    <main>
      <section class="panel">
        <div class="grid">
          <div class="card">
            <div class="count">${count}</div>
            <p class="muted">Deduplicated related insect records</p>
          </div>
          <div class="card">
            <div class="count">${category.plantGuides.length}</div>
            <p class="muted">Host plant guide pages</p>
          </div>
          <div class="card">
            <h2>Japanese reference</h2>
            <p>${escapeHtml(buildJapaneseReferenceLabel(display.japaneseName))}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="plant-guides">
        <h2 id="plant-guides">Host plant guides in this category</h2>
        <div class="grid">
          ${category.plantGuides.map((guide) => {
            const guideDisplay = buildEnglishGuideDisplay(guide, plantDetails);
            return `
          <article class="card">
            <h3><a href="/en/guides/plants/${guide.slug}.html">${escapeHtml(guideDisplay.label)}</a></h3>
            <p>${guide.relatedInsects.length} related insect records.</p>
            <p class="small">${escapeHtml(buildJapaneseReferenceLabel(guide.name))}</p>
          </article>`;
          }).join('')}
        </div>
      </section>

      <section aria-labelledby="type-breakdown">
        <h2 id="type-breakdown">Breakdown by insect group</h2>
        <table>
          <thead><tr><th>Group</th><th>Records</th></tr></thead>
          <tbody>${renderEnglishTypeBreakdown(category.typeCounts)}
          </tbody>
        </table>
      </section>

      <section class="panel" aria-labelledby="search-terms">
        <h2 id="search-terms">Search intents covered</h2>
        <ul class="chips">
          ${buildEnglishSearchPhrases(display.label, category.name, 'host plant insects').map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}
        </ul>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishFamilyPage(family, routeMaps) {
  const canonicalPath = `/en/guides/families/${family.slug}.html`;
  const japanesePath = `/guides/families/${family.slug}.html`;
  const display = buildEnglishFamilyDisplay(family);
  const count = family.relatedInsects.length;
  const typeSummary = formatEnglishTypeSummary(family.typeCounts);
  const shownPlants = family.plantRows.slice(0, 80);
  const shownInsects = family.relatedInsects.slice(0, 48);
  const plantNames = shownPlants.slice(0, 8).map((row) => row.name).join(', ');
  const title = `${display.label} host plant insects in Japan | ${EN_SITE_NAME}`;
  const description = truncate(
    `${display.label} guide for Japanese plant-insect records. It covers ${family.plantRows.length} plants including ${plantNames}, with ${typeSummary || `${count} related insect records`}.`,
    155,
  );
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${display.label} host plant insects in Japan`,
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: EN_SITE_NAME,
      url: `${BASE_ORIGIN}/en/`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: family.plantRows.length,
      itemListElement: shownPlants.slice(0, 30).map((row, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: row.scientificName || row.name,
          url: `${BASE_ORIGIN}${resolveEnglishFamilyPlantHref(row, routeMaps)}`,
        },
      })),
    },
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: EN_SITE_NAME, item: `${BASE_ORIGIN}/en/` },
      { '@type': 'ListItem', position: 2, name: 'Search guides', item: `${BASE_ORIGIN}/en/guides/` },
      { '@type': 'ListItem', position: 3, name: 'Family guides', item: `${BASE_ORIGIN}/en/guides/families/` },
      { '@type': 'ListItem', position: 4, name: display.label, item: `${BASE_ORIGIN}${canonicalPath}` },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  <script type="application/ld+json">${escapeJson(breadcrumbData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Family guide</span>
      <h1>${escapeHtml(display.label)} host plant insects in Japan</h1>
      <p class="lead">A data-driven entry page for moving from a plant family to Japanese plant and insect profile pages.</p>
    </header>

    <main>
      <section class="panel">
        <div class="grid">
          <div class="card">
            <div class="count">${family.plantRows.length}</div>
            <p class="muted">Plants in the dataset</p>
          </div>
          <div class="card">
            <div class="count">${count}</div>
            <p class="muted">Deduplicated related insect records</p>
          </div>
          <div class="card">
            <h2>Japanese reference</h2>
            <p>${escapeHtml(buildJapaneseReferenceLabel(display.japaneseName))}</p>
            ${display.familyLatin ? `<p><em>${escapeHtml(display.familyLatin)}</em></p>` : ''}
          </div>
        </div>
      </section>

      <section aria-labelledby="plants">
        <h2 id="plants">Plants and related insect counts</h2>
        <table>
          <thead><tr><th>Plant</th><th>Related records</th></tr></thead>
          <tbody>
            ${shownPlants.map((row) => `
            <tr>
              <td><a href="${escapeHtml(resolveEnglishFamilyPlantHref(row, routeMaps))}">${escapeHtml(row.scientificName || row.name)}</a><span class="small">${escapeHtml(buildJapaneseReferenceLabel(row.name))}</span></td>
              <td>${row.count}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="type-breakdown">
        <h2 id="type-breakdown">Breakdown by insect group</h2>
        <table>
          <thead><tr><th>Group</th><th>Records</th></tr></thead>
          <tbody>${renderEnglishTypeBreakdown(family.typeCounts)}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="representatives">
        <h2 id="representatives">Representative linked insect pages</h2>
        <ul class="insect-list">
          ${shownInsects.map((insect) => buildEnglishInsectListItem(insect, routeMaps)).join('')}
        </ul>
      </section>

      <section class="panel" aria-labelledby="search-terms">
        <h2 id="search-terms">Search intents covered</h2>
        <ul class="chips">
          ${buildEnglishSearchPhrases(display.label, family.name, 'host plant insects').map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}
        </ul>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishFamilyIndexPage(families) {
  const canonicalPath = '/en/guides/families/';
  const japanesePath = '/guides/families/';
  const title = `Plant family host plant guides | ${EN_SITE_NAME}`;
  const description = 'Browse Japanese plant-insect records by plant family, including Rosaceae, Fagaceae, Fabaceae, Poaceae, Asteraceae, Brassicaceae, and Malvaceae.';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Plant family host plant guides',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: families.length,
      itemListElement: families.map((family, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${buildEnglishFamilyDisplay(family).label} host plant insects`,
          url: `${BASE_ORIGIN}/en/guides/families/${family.slug}.html`,
        },
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath, ogType: 'website' })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Family guides</span>
      <h1>Browse host plants by family</h1>
      <p class="lead">Family pages group plant records before linking to detailed host plant and insect pages.</p>
    </header>

    <main>
      <section class="grid" aria-label="Plant family guide list">
        ${families.map((family) => {
          const display = buildEnglishFamilyDisplay(family);
          return `
        <article class="card">
          <h2><a href="/en/guides/families/${family.slug}.html">${escapeHtml(display.label)}</a></h2>
          <p>${family.plantRows.length} plants and ${family.relatedInsects.length} related insect records.</p>
          <p class="small">${escapeHtml(buildJapaneseReferenceLabel(family.name))}</p>
        </article>`;
        }).join('')}
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishPlantIndexPage(guides, categories, families, plantDetails = {}) {
  const canonicalPath = '/en/guides/plants/';
  const japanesePath = '/guides/plants/';
  const title = `Host plant guides for Japanese insects | ${EN_SITE_NAME}`;
  const description = 'Static host plant guide pages for Japanese insect records. Start from plants such as cherry, oak, willow, mugwort, grasses, citrus, or vegetables.';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Host plant guides for Japanese insects',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: guides.length,
      itemListElement: guides.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${buildEnglishGuideDisplay(guide, plantDetails).label} host plant insects`,
          url: `${BASE_ORIGIN}/en/guides/plants/${guide.slug}.html`,
        },
      })),
    },
  };
  const categorySection = categories.length > 0
    ? `      <section class="panel" aria-labelledby="category-guides">
        <h2 id="category-guides">Browse by category</h2>
        <p>Use category guides when the plant name is not the first search term.</p>
        <p><a href="/en/guides/categories/">Open category guides</a></p>
      </section>

`
    : '';
  const familySection = families.length > 0
    ? `      <section class="panel" aria-labelledby="family-guides">
        <h2 id="family-guides">Browse by plant family</h2>
        <p>Use family guides for searches such as Rosaceae host plants, Poaceae insects, or Malvaceae food plants.</p>
        <p><a href="/en/guides/families/">Open family guides</a></p>
      </section>

`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath, ogType: 'website' })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Host plant guides</span>
      <h1>Find Japanese insects from host plants</h1>
      <p class="lead">These pages create stable, crawlable entry points from plant names to insect profile pages.</p>
    </header>

    <main>
${categorySection}
${familySection}
      <section class="grid" aria-label="Host plant guide list">
        ${guides.map((guide) => {
          const display = buildEnglishGuideDisplay(guide, plantDetails);
          return `
        <article class="card">
          <h2><a href="/en/guides/plants/${guide.slug}.html">${escapeHtml(display.label)}</a></h2>
          <p>${guide.relatedInsects.length} related insect records.</p>
          <p class="small">${escapeHtml(buildJapaneseReferenceLabel(guide.name))}</p>
        </article>`;
        }).join('')}
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishCategoryIndexPage(categories, plantDetails = {}) {
  const canonicalPath = '/en/guides/categories/';
  const japanesePath = '/guides/categories/';
  const title = `Host plant categories for Japanese insects | ${EN_SITE_NAME}`;
  const description = 'Browse Japanese plant-insect records by practical plant categories such as garden trees, fruit trees, vegetables, broadleaf trees, and grasses.';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Host plant categories for Japanese insects',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: categories.length,
      itemListElement: categories.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: `${buildEnglishCategoryDisplay(category).label} host plant insects`,
          url: `${BASE_ORIGIN}/en/guides/categories/${category.slug}.html`,
        },
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath, ogType: 'website' })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Category guides</span>
      <h1>Browse host plants by category</h1>
      <p class="lead">Category pages group practical plant searches before linking to detailed host plant guide pages.</p>
    </header>

    <main>
      <section class="grid" aria-label="Host plant category guide list">
        ${categories.map((category) => {
          const display = buildEnglishCategoryDisplay(category);
          return `
        <article class="card">
          <h2><a href="/en/guides/categories/${category.slug}.html">${escapeHtml(display.label)}</a></h2>
          <p>${category.plantGuides.length} host plant guides and ${category.relatedInsects.length} related insect records.</p>
          <p class="small">${escapeHtml(category.plantGuides.slice(0, 4).map((guide) => buildEnglishGuideDisplay(guide, plantDetails).label).join(' / '))}</p>
        </article>`;
        }).join('')}
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderEnglishGuideIndexPage(guides, categories, families) {
  const canonicalPath = '/en/guides/';
  const japanesePath = '/guides/';
  const title = `Search guides | ${EN_SITE_NAME}`;
  const description = 'Search guide entry points for Japanese insect and host plant records, including host plant guides, category guides, and the host plant search method.';
  const items = [
    { name: 'What is a host plant?', url: `${BASE_ORIGIN}/en/guides/what-is-host-plant.html` },
    { name: 'Host plant guides', url: `${BASE_ORIGIN}/en/guides/plants/` },
    { name: 'Category guides', url: `${BASE_ORIGIN}/en/guides/categories/` },
    { name: 'Plant family guides', url: `${BASE_ORIGIN}/en/guides/families/` },
    { name: 'Find insects by host plant', url: `${BASE_ORIGIN}/en/guides/host-plant-search.html` },
  ];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Search guides',
    description,
    url: `${BASE_ORIGIN}${canonicalPath}`,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: EN_SITE_NAME,
      url: `${BASE_ORIGIN}/en/`,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: item.name,
          url: item.url,
        },
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderEnglishHead({ title, description, canonicalPath, japanesePath, ogType: 'website' })}
  <script type="application/ld+json">${escapeJson(structuredData)}</script>
  ${renderStyle()}
</head>
<body>
  <div class="wrap">
    ${renderEnglishHeader(japanesePath)}
    <header>
      <span class="badge">Search guides</span>
      <h1>Start from a plant, category, or insect group</h1>
      <p class="lead">These static pages give search visitors a clearer route into indexed species and plant profile pages.</p>
    </header>

    <main>
      <div class="grid">
        <article class="card">
          <h2><a href="/en/guides/what-is-host-plant.html">What is a host plant?</a></h2>
          <p>Read a short explanation of host plants, larval food plants, and how Japanese insect-plant records are organized.</p>
        </article>

        <article class="card">
          <h2><a href="/en/guides/plants/">Host plant guides</a></h2>
          <p>${guides.length} plant-based guide pages link plant names to recorded Japanese insects.</p>
        </article>

        <article class="card">
          <h2><a href="/en/guides/categories/">Category guides</a></h2>
          <p>${categories.length} category pages cover practical searches such as garden trees, fruit trees, vegetables, grasses, and broadleaf trees.</p>
        </article>

        <article class="card">
          <h2><a href="/en/guides/families/">Plant family guides</a></h2>
          <p>${families.length} family pages cover searches such as Rosaceae, Fagaceae, Poaceae, Brassicaceae, and Malvaceae host plants.</p>
        </article>

        <article class="card">
          <h2><a href="/en/guides/host-plant-search.html">Find insects by host plant</a></h2>
          <p>Use plant names, scientific names, or Japanese local names to reach the corresponding insect-plant relationship pages.</p>
        </article>

        <article class="card">
          <h2><a href="/en/meta/plant/index.html">Browse plant pages</a></h2>
          <p>Open indexed plant pages and review the insects recorded from each host plant or flower-visit plant.</p>
        </article>

        <article class="card">
          <h2><a href="/en/meta/moth/index.html">Browse insect pages</a></h2>
          <p>Open static insect profile pages for moths, butterflies, beetles, and aphids.</p>
        </article>
      </div>
    </main>
  </div>
</body>
</html>
`;
}

function main() {
  const dataset = readDataset();
  const insects = flattenInsects(dataset);
  const routeMaps = buildRouteMaps();
  const plantDetails = dataset.plantDetails || {};
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.rmSync(CATEGORY_OUT_DIR, { recursive: true, force: true });
  fs.rmSync(FAMILY_OUT_DIR, { recursive: true, force: true });
  fs.rmSync(EN_OUT_DIR, { recursive: true, force: true });
  fs.rmSync(EN_CATEGORY_OUT_DIR, { recursive: true, force: true });
  fs.rmSync(EN_FAMILY_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(CATEGORY_OUT_DIR, { recursive: true });
  fs.mkdirSync(FAMILY_OUT_DIR, { recursive: true });
  fs.mkdirSync(EN_OUT_DIR, { recursive: true });
  fs.mkdirSync(EN_CATEGORY_OUT_DIR, { recursive: true });
  fs.mkdirSync(EN_FAMILY_OUT_DIR, { recursive: true });
  fs.mkdirSync(EN_GUIDES_DIR, { recursive: true });

  const guideConfigs = buildHostPlantGuideConfigs(dataset);
  const autoGuideConfigCount = guideConfigs.filter((guide) => guide.autoGenerated).length;
  const guides = guideConfigs
    .map((config) => collectGuideData(config, dataset, insects))
    .filter((guide) => guide.relatedInsects.length > 0);
  const guideBySlug = new Map(guides.map((guide) => [guide.slug, guide]));
  const categories = CATEGORY_GUIDES
    .map((config) => collectCategoryData(config, guideBySlug))
    .filter((category) => category.plantGuides.length > 0 && category.relatedInsects.length > 0);
  const families = FAMILY_GUIDES
    .map((config) => collectFamilyData(config, dataset, insects))
    .filter((family) => family.plantRows.length > 0 && family.relatedInsects.length > 0);

  guides.forEach((guide) => {
    writeHtml(path.join(OUT_DIR, `${guide.slug}.html`), renderGuidePage(guide));
    writeHtml(path.join(EN_OUT_DIR, `${guide.slug}.html`), renderEnglishGuidePage(guide, routeMaps, plantDetails));
  });
  categories.forEach((category) => {
    writeHtml(path.join(CATEGORY_OUT_DIR, `${category.slug}.html`), renderCategoryPage(category));
    writeHtml(path.join(EN_CATEGORY_OUT_DIR, `${category.slug}.html`), renderEnglishCategoryPage(category, routeMaps, plantDetails));
  });
  families.forEach((family) => {
    writeHtml(path.join(FAMILY_OUT_DIR, `${family.slug}.html`), renderFamilyPage(family));
    writeHtml(path.join(EN_FAMILY_OUT_DIR, `${family.slug}.html`), renderEnglishFamilyPage(family, routeMaps));
  });
  writeHtml(path.join(OUT_DIR, 'index.html'), renderIndexPage(guides, categories, families));
  writeHtml(path.join(CATEGORY_OUT_DIR, 'index.html'), renderCategoryIndexPage(categories));
  writeHtml(path.join(FAMILY_OUT_DIR, 'index.html'), renderFamilyIndexPage(families));
  writeHtml(path.join(EN_OUT_DIR, 'index.html'), renderEnglishPlantIndexPage(guides, categories, families, plantDetails));
  writeHtml(path.join(EN_CATEGORY_OUT_DIR, 'index.html'), renderEnglishCategoryIndexPage(categories, plantDetails));
  writeHtml(path.join(EN_FAMILY_OUT_DIR, 'index.html'), renderEnglishFamilyIndexPage(families));
  writeHtml(path.join(EN_GUIDES_DIR, 'index.html'), renderEnglishGuideIndexPage(guides, categories, families));
  const patchedStaticGuideCount = STATIC_GUIDE_HTML_PATHS
    .filter((filePath) => ensureAdsenseHeadTags(filePath))
    .length;

  console.log(`[guides] auto host plant guide configs: ${autoGuideConfigCount}`);
  console.log(`[guides] generated host plant guide pages: ${guides.length + 1}`);
  console.log(`[guides] generated category guide pages: ${categories.length + 1}`);
  console.log(`[guides] generated family guide pages: ${families.length + 1}`);
  console.log(`[guides] generated English host plant guide pages: ${guides.length + 1}`);
  console.log(`[guides] generated English category guide pages: ${categories.length + 1}`);
  console.log(`[guides] generated English family guide pages: ${families.length + 1}`);
  console.log(`[guides] patched static guide AdSense tags: ${patchedStaticGuideCount}`);
}

// 直接実行時のみ生成を走らせる。他スクリプト(generate-meta-pages.js)が
// HOST_PLANT_GUIDES を import しても副作用でページ生成が走らないようにするためのガード。
if (process.argv[1] === __filename) {
  main();
}
