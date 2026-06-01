import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_ORIGIN = process.env.BASE_ORIGIN || 'https://orau98.github.io';
const ROOT_DIR = path.join(__dirname, '..');
const DATASET_PATH = path.join(ROOT_DIR, 'public/assets/data-lite/full-dataset.json');
const OUT_DIR = path.join(ROOT_DIR, 'public/guides/plants');
const CATEGORY_OUT_DIR = path.join(ROOT_DIR, 'public/guides/categories');
const PLANT_META_DIR = path.join(ROOT_DIR, 'public/meta/plant');

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

export const HOST_PLANT_GUIDES = [
  {
    slug: 'sakura',
    name: 'サクラ',
    variants: ['サクラ', 'サクラ類', 'サクラ属', 'サクラ属植物', '栽培サクラ', 'カスミサクラ', 'セイヨウミザクラ'],
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
    variants: ['リンゴ', 'セイヨウリンゴ', '栽培リンゴ', 'リンゴ類', 'リンゴ属'],
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
    variants: ['カエデ', 'カエデ属', 'イタヤカエデ', 'イロハモミジ', 'ウリカエデ', 'ウリハダカエデ', 'カラコギカエデ'],
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
    variants: ['バラ', 'バラ属', 'ノイバラ', 'テリハノイバラ', '栽培バラ'],
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
    variants: ['ミカン', 'ウンシュウミカン', 'ナツミカン', 'ミカン属'],
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
    variants: ['タケ', 'ササ', 'マダケ', 'メダケ', 'モウソウチク', 'ネザサ'],
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
    variants: ['スダジイ', 'シイ'],
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
    plantSlugs: ['ume', 'ringo', 'momo', 'kaki', 'nashi', 'mikan', 'kuri', 'budou', 'biwa', 'ichijiku'],
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
    plantSlugs: ['sakura', 'keyaki', 'kaede', 'enoki', 'kusunoki', 'tsubaki', 'akamegashiwa', 'yanagi'],
    searchPhrases: ['街路樹につく虫', '公園の木 幼虫 食草', '街路樹を食べる蛾'],
  },
  {
    slug: 'broadleaf-trees',
    name: '広葉樹',
    plantSlugs: ['kunugi', 'konara', 'kuri', 'buna', 'kashiwa', 'mizunara', 'arakashi', 'shirakashi', 'sudajii', 'yanagi', 'mizuki', 'keyaki', 'harunire'],
    searchPhrases: ['広葉樹につく虫', '広葉樹 幼虫 食草', '広葉樹を食べる蛾'],
  },
  {
    slug: 'oak-family',
    name: 'ブナ科・どんぐりの木',
    plantSlugs: ['kunugi', 'konara', 'kuri', 'buna', 'kashiwa', 'mizunara', 'arakashi', 'shirakashi', 'sudajii'],
    searchPhrases: ['どんぐりの木につく虫', 'ブナ科 幼虫 食草', 'クヌギ コナラにつく虫'],
  },
  {
    slug: 'weeds-and-grasses',
    name: '草本・雑草',
    plantSlugs: ['yomogi', 'susuki', 'irakusa', 'karamushi', 'itadori', 'shirotsumekusa', 'yoshi', 'ine', 'sumire'],
    searchPhrases: ['雑草につく虫', '草本 幼虫 食草', '草を食べる蛾'],
  },
  {
    slug: 'butterfly-host-plants',
    name: '蝶の食草',
    plantSlugs: ['enoki', 'mikan', 'irakusa', 'karamushi', 'cabbage', 'sumire', 'sakura', 'yanagi'],
    searchPhrases: ['蝶の食草', 'チョウ 幼虫 食草', '蝶が食べる植物'],
  },
];

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

function renderHead({ title, description, canonicalPath }) {
  const canonicalUrl = `${BASE_ORIGIN}${canonicalPath}`;
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
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
    .scientific{display:block;color:var(--muted);font-size:13px;font-style:italic;margin-top:2px}
    .small{font-size:14px;color:var(--muted)}
  </style>`;
}

function renderHeader() {
  return `<div class="top">
      <a class="brand" href="/">昆虫植物図鑑</a>
      <nav class="nav" aria-label="主要リンク">
        <a href="/guides/">調べ方ガイド</a>
        <a href="/guides/plants/">植物別ガイド</a>
        <a href="/guides/categories/">カテゴリ別ガイド</a>
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

function renderIndexPage(guides, categories = []) {
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

function main() {
  const dataset = readDataset();
  const insects = flattenInsects(dataset);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.rmSync(CATEGORY_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(CATEGORY_OUT_DIR, { recursive: true });

  const guides = HOST_PLANT_GUIDES
    .map((config) => collectGuideData(config, dataset, insects))
    .filter((guide) => guide.relatedInsects.length > 0);
  const guideBySlug = new Map(guides.map((guide) => [guide.slug, guide]));
  const categories = CATEGORY_GUIDES
    .map((config) => collectCategoryData(config, guideBySlug))
    .filter((category) => category.plantGuides.length > 0 && category.relatedInsects.length > 0);

  guides.forEach((guide) => {
    writeHtml(path.join(OUT_DIR, `${guide.slug}.html`), renderGuidePage(guide));
  });
  categories.forEach((category) => {
    writeHtml(path.join(CATEGORY_OUT_DIR, `${category.slug}.html`), renderCategoryPage(category));
  });
  writeHtml(path.join(OUT_DIR, 'index.html'), renderIndexPage(guides, categories));
  writeHtml(path.join(CATEGORY_OUT_DIR, 'index.html'), renderCategoryIndexPage(categories));

  console.log(`[guides] generated host plant guide pages: ${guides.length + 1}`);
  console.log(`[guides] generated category guide pages: ${categories.length + 1}`);
}

// 直接実行時のみ生成を走らせる。他スクリプト(generate-meta-pages.js)が
// HOST_PLANT_GUIDES を import しても副作用でページ生成が走らないようにするためのガード。
if (process.argv[1] === __filename) {
  main();
}
