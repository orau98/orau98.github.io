import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

/**
 * Fix insect_id of aphid hostplant records (日本原色アブラムシ図鑑) that were imported with
 * placeholder IDs (species-21568..). Those IDs do not exist in insects.csv, so hostplants appear missing.
 *
 * Strategy:
 * - The placeholder insect_id encodes the atlas "No." as: no = numericId - 21567 (e.g., species-21721 -> No.154).
 * - Use the provided atlas No->(name,sci) mapping below to resolve each placeholder ID to a real insect_id
 *   in public/insects.csv by matching scientific name (binomial/trinomial) against:
 *   - genus/species/subspecies columns
 *   - scientific_name field
 *   - synonyms field
 *   - scientific-name fragments embedded in japanese_name (rare but exists: e.g., "Aphis citricola")
 *
 * Outputs:
 * - Updates both public/hostplants.csv and normalized_data/hostplants.csv in-place.
 * - Prints a summary and writes a non-committed report to reports/aphid_hostplant_id_fix_report.csv
 */

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const NORMALIZED_DIR = path.join(ROOT, 'normalized_data');
const REPORTS_DIR = path.join(ROOT, 'reports');

const INSECTS_CSV = path.join(PUBLIC_DIR, 'insects.csv');
const TARGET_HOSTPLANT_FILES = [
  path.join(PUBLIC_DIR, 'hostplants.csv'),
  path.join(NORMALIZED_DIR, 'hostplants.csv'),
];

const ATLAS_REF = '日本原色アブラムシ図鑑';
const ATLAS_ID_BASE = 21567; // species-(ATLAS_ID_BASE + No.)

// Raw mapping (first 3 columns from the atlas list provided by the user).
// Format: No,種名,学名 (some rows were malformed in the source list; we auto-repair those).
const ATLAS_NO_NAME_SCI_RAW = `
1,ネズミサシオオアブラムシ,Cinara juniperi (de Geer)
2,ハネナガオオアブラムシ,Cinara longipennis (Matsumura)
3,マツオオアブラムシ,Cinara pini (Linné)
4,ヒメコマツオオアブラムシ,Cinara shinjii (Inoue)
5,マツノホソアブラムシ,Eulachnus thunbergii (Wilson)
6,クリオオアブラムシ,Lachnus tropicalis (van der Goot)
7,ナシミドリオオアブラムシ,Nippolachnus piri Matsumura
8,ヤナギコブオオアブラムシ,Tuberolachnus salignus (Gmelin)
9,カバノハチビマダラアブラムシ,Callipterinella calliptera (Hartig)
10,モクレンヒゲナガマダラアブラムシ,Neocalaphis magnoliae (Essig et Kuwana)
11,ホオノキヒゲナガマダラアブラムシ,Neocalaphis magnolicolens (Takahashi)
12,イヌシデクロマダラアブラムシ,Neochromaphis carpinicola (Takahashi)
13,クリヒゲマダラアブラムシ,Myzocallis kuricola (Matsumura)
14,アルファルファアブラムシ,Therioaphis trifolii (Monell)
15,エノキワタアブラムシ,Shivaphis celti Das
16,タケヒゲナガブチアブラムシ,Takecallis arundicolens (Clarke)
17,タケクロスジヒゲナガアブラムシ,Takecallis arundinariae (Essig)
18,サルスベリヒゲマダラアブラムシ,Tinocallis kahawaluokalani (Kirkaldy)
19,タカチホヒゲマダラアブラムシ,Tinocallis takachihoensis Higuchi
20,ニレヒゲマダラアブラムシ,Tinocallis ulmiparvifoliae Matsumura
21,ケヤキヒゲマダラアブラムシ,Tinocallis zelkowae (Takahashi)
22,クヌギトゲマダラアブラムシ,Tuberculatus capitatus (Essig et Kuwana)
23,カバイロトゲマダラアブラムシ,Tuberculatus fulviabdominalis (Shinji)
24,クロトゲマダラアブラムシ,Tuberculatus stigmatus (Matsumura)
25,カシワトゲマダラアブラムシ,Tuberculatus yokoyamai (Takahashi)
26,Tuberculatus sp. A,コナラ
27,Tuberculatus sp. B,シリブカガシ
28,クヌギハアブラムシ,Phloeomyzus quercus (Takahashi)
29,トウキョウカマガタアブラムシ,Yamatocallis tokyoensis (Takahashi)
30,ヤナギクロケアブラムシ,Chaitophorus saliniger Shinji
31,Chaitophorus sp.,ポプラ
32,モミジニタイケアブラムシ,Periphyllus californiensis (Shinji)
33,マキシンハアブラムシ,Neophyllaphis podocarpi Takahashi
34,オニグルミトゲアブラムシ,Dasyaphis onigurumi (Shinji)
35,クヌギクチナガオオアブラムシ,Stomaphis quercica Takahashi
36,ヤノクチナガオオアブラムシ,Stomaphis yanonis Takahashi
37,ムギヒゲナガアブラムシ,Macrosiphum avenae akebiae Shinji
38,クマヤナギヒゲナガアブラムシ,Macrosiphum berchemiae (Shinji)
39,ハンショウヅルヒゲナガアブラムシ,Macrosiphum clematifoliae Shinji
40,ヤマボウシヒゲナガアブラムシ,Macrosiphum cornifoliae Shinji
41,チューリップヒゲナガアブラムシ,Macrosiphum euphorbiae (Thomas)
42,イバラヒゲナガアブラムシ,Macrosiphum rosae ibarae Matsumura
43,アブラススキヒゲナガアブラムシ,Macrosiphum yasumatsui Moritsu
44,ハシバミヒゲナガアブラムシ,Unisitobion corylicola (Shinji)?
45,ヨモギオナガヒメヒゲナガアブラムシ,Macrosiphoniella grandicauda Takahashi et Moritsu
46,ヒコサンヒメヒゲナガアブラムシ,Macrosiphoniella hikosanensis Moritsu
47,クワヤマヒメヒゲナガアブラムシ,Macrosiphoniella kuwayamai Takahashi
48,キクヒメヒゲナガアブラムシ,Macrosiphoniella sanborni (Gillette)
49,ヨメナヒメヒゲナガアブラムシ,Macrosiphoniella yomenae (Shinji)
50,アオヒメヒゲナガアブラムシ,Macrosiphoniella yomogifoliae (Shinji)
51,シャジンヒゲナガアブラムシ,Dactynotus adenophorae (Matsumura)
52,アマミヒゲナガアブラムシ,Dactynotus amamianus (Takahashi)
53,ノゲシヒゲナガアブラムシ,Dactynotus cephalonopli Takahashi
54,タイワンヒゲナガアブラムシ,Dactynotus formosanus (Takahashi)
55,アザミヒゲナガアブラムシ,Dactynotus giganteus (Matsumura)
56,ゴボウヒゲナガアブラムシ,Dactynotus gobonis (Matsumura)
57,キキョウヒゲナガアブラムシ,Dactynotus kikioensis (Shinji)
58,アキノキリンソウクロヒゲナガアブラムシ,Dactynotus lactucicola (Strand)
59,シロヤマギクヒゲナガアブラムシ,Dactynotus monticola (Takahashi)
60,コウゾリナヒゲナガアブラムシ,Dactynotus picridis (Fabricius)
61,アキノキリンソウヒゲナガアブラムシ,Dactynotus solidaginis (Fabricius)?
62,ゴンズイノフクレアブラムシ,Indomegoura indica (van der Goot)
63,ソラマメヒゲナガアブラムシ,Megoura crassicauda Mordvilko
64,ハギオナガヒゲナガアブラムシ,Megoura lespedezae (Essig et Kuwana)
65,クスオナガアブラムシ,Sinomegoura citricola (van der Goot)
66,カナメモチオナガアブラムシ,Sinomegoura photiniae (Takahashi)
67,ヨメナアミナシヒゲナガアブラムシ,Acyrthosiphon asteris (Takahashi)
68,アザミアミナシヒゲナガアブラムシ,Acyrthosiphon cirsicola (Takahashi)
69,カキドオシヒゲナガアブラムシ,Acyrthosiphon glechomae (Takahashi)
70,ヤマブキヒゲナガアブラムシ,Acyrthosiphon kerriae (Shinji)
71,コンドウヒゲナガアブラムシ,Acyrthosiphon kondoi Shinji
72,アオキコブアブラムシ,Acyrthosiphon linderae (Shinji)
73,ニワトコフクレアブラムシ,Acyrthosiphon magnoliae (Essig et Kuwana)
74,アブラチャンコブアブラムシ,Acyrthosiphon muradachi (Shinji)
75,カワラヨモギヒゲナガアブラムシ,Acyrthosiphon neoartemisiae (Takahashi)
76,ヘクソカズラヒゲナガアブラムシ,Acyrthosiphon nipponicus (Essig et Kuwana)
77,シソヒゲナガアブラムシ,Acyrthosiphon perillae (Shinji)
78,エンドウヒゲナガアブラムシ,Acyrthosiphon pisum (Harris)
79,ジャガイモヒゲナガアブラムシ,Acyrthosiphon solani (Kaltenbach)
80,アザミキイロヒゲナガアブラムシ,Acyrthosiphon vandenboschi Hille Ris Lambers
81,Acyrthosiphon sp. A,シラヤマギク
82,Acyrthosiphon sp. B,不明
83,ノゲシフクレアブラムシ,Hyperomyzus carduellinus (Theobald)
84,ホウセンカヒゲナガアブラムシ,Impatientinum impatiens (Shinji)
85,ゲンノショウココブアブラムシ,Cryptaphis geranicola (Shinji)
86,ヤマハッカコブアブラムシ,Cryptaphis menthae Takahashi
87,ハナトラノオコブアブラムシ,Cryptomyzus taoi Hille Ris Lambers
88,ツリフネソウアブラムシ,Hydronaphis impatiens Shinji
89,Hydronaphis sp.,ジャノヒゲ
90,ウツギトックリアブラムシ,Rhopalosiphoninus deutzifoliae Shinji
91,Rhopalosiphoninus sp.,イボクサ
92,キククギケアブラムシ,Pleotrichophorus chrysanthemi (Theobald)
93,ヨメナコブアブラムシ,Myzus asteriae Shinji
94,カラムシコブアブラムシ,Myzus boehmeriae Takahashi
95,ニワウメクロコブアブラムシ,Myzus cerasi (Fabricius)
96,カンゾウコブアブラムシ,Myzus hemerocallidis Takahashi
97,ワダンコブアブラムシ,Myzus lactucicola Takahashi
98,リンゴコブアブラムシ,Myzus malisuctus Matsumura
99,ウメコブアブラムシ,Myzus mumecola (Matsumura)
100,ムシャコブアブラムシ,Myzus mushaensis Takahashi
101,モモアカアブラムシ,Myzus persicae (Sulzer)
102,ウマノアシガタコブアブラムシ,Myzus ranunculinus (Walker)
103,ヒキオコシコブアブラムシ,Myzus siegesbeckiae Takahashi
104,ハンショウヅルコブアブラムシ,Myzus varians Davidson
105,Myzus sp.,イネ科の一種
106,クワクサヒゲナガアブラムシ,Eomyzus kuwanusae (Uye)
107,シソコブアブラムシ,Eomyzus nipponicus (Moritsu)
108,オシダコブアブラムシ,Macromyzus woodwardiae (Takahashi)
109,ハッカイコブアブラムシ,Ovatus crataegarius (Walker)
110,ゴボウクギケアブラムシ,Capitophorus elaeagni (Del Guercio)
111,ヨモギクギケアブラムシ,Capitophorus formosartemisiae (Takahashi)
112,イチゴケナガアブラムシ,Capitophorus fragariaefolii (Cockerell)
113,タデクギケアブラムシ,Capitophorus hippophaes (Walker)
114,アキノタムラソウコブアブラムシ,Chaetomyzus hirticornis Takahashi
115,シクラメンコブアブラムシ,Neomyzus circumflexus (Buckton)
116,ホップイボアブラムシ,Phorodon humuli Schrank
117,ネギアブラムシ,Neotoxoptera formosana (Takahashi)
118,Neotoxoptera sp.,クサノオウ
119,ウツギアブラムシ,Micromyzus diervillae (Matsumura)
120,ニッコウコブアブラムシ,Micromyzus nikkoensis Miyazaki ?
121,アシボソヒゲナガアブラムシ,Kaochiaoja arthraxonis (Takahashi)
122,ヨモギキイロコブアブラムシ,Tuberocephalus artemisiae Shinji
123,サクラコブアブラムシ,Tuberocephalus sakurae (Matsumura)
124,サクラフシアブラムシ,Tuberocephalus sasakii (Matsumura)
125,Tuberocephalus sp.,チュウゴクオウトウ
126,ワラビツメナシアブラムシ,Shinjia orientalis (Mordvilko)
127,ツリフネソウコブアブラムシ,Eumyzus gallicola Takahashi
128,ホウセンカコブアブラムシ,Eumyzus impatiensae (Shinji)
129,ヤマハッカアブラムシ,Eumyzus plectranthi (Shinji)
130,オオダイヨソオアブラムシ,Akkaia odaiensis Takahashi
131,タデヨソオヒゲナガアブラムシ,Akkaia polygoni Takahashi
132,ウドフタオアブラムシ,Cavariella araliae Takahashi
133,カクレミノフタオアブラムシ,Cavariella gilibertiae Takahashi
134,シラネセンキュウフタオアブラムシ,Cavariella japonica (Essig et Kuwana)
135,ヤナギフタオアブラムシ,Cavariella salicicola (Matsumura)
136,イチゴトゲアブラムシ,Matsumuraja rubi (Matsumura)
137,イチゴハトゲアブラムシ,Matsumuraja rubifoliae Takahashi
138,ナガバイチゴトゲアブラムシ,Matsumuraja rubiphila Takahashi
139,イシミカワイボアブラムシ,Trichosiphonaphis ishimikawae (Shinji)
140,スイカズラヒゲナガアブラムシ,Trichosiphonaphis lonicerae (Uye)
141,タデイボアブラムシ,Trichosiphonaphis polygoni (van der Goot)
142,タデケクダヒゲナガアブラムシ,Trichosiphonaphis polygoniformosanus (Takahashi)
143,タデヒゲナガアブラムシ,Trichosiphonaphis tade (Shinji)
144,ツツジアブラムシ,Vesiculaphis caricis (Fullaway)
145,ナシマルアブラムシ,Sappaphis piri Matsumura
146,フウロケマンアブラムシ,Hyalopteroides corydalisicola (Tao)
147,ウメモドキオマルアブラムシ,Macchiatiella ilexis (Moritsu)
148,イタドリオマルアブラムシ,Macchiatiella itadori (Shinji)
149,オオバコアブラムシ,Dysaphis plantaginea (Passerini)
150,キュウコンネアブラムシ,Dysaphis tulipae (Boyer de Fonscolombe)
151,ニセダイコンアブラムシ,Lipaphis erysimi (Kaltenbach)
152,ハマナスオナガアブラムシ,Longicaudus trirhodus (Walker)
153,ムギワラギクオマルアブラムシ,Brachycaudus helichrysi (Kaltenbach)
154,ダイコンアブラムシ,Brevicoryne brassicae (Linné)
155,ヨモギクレアブラムシ,Coloradoa artemisiae (Del Guercio)
156,キククレアブラムシ,Coloradoa rufomaculata (Wilson)
157,ヨモギコアブラムシ,Micraphis artemisiae (Takahashi)
158,ハナウドチビクダアブラムシ,Semiaphis heraclei (Takahashi)
159,ヨモギクダナシアブラムシ,Cryptosiphum artemisiae Buckton
160,ミカンミドリアブラムシ,Aphis citricola van der Goot
161,クサギアブラムシ,Aphis clerodendri Matsumura
162,ツユクサアブラムシ,Aphis commelinae Shinji
163,マメアブラムシ,Aphis craccivora Koch
164,エゴマアブラムシ,Aphis egomae Shinji
165,ヤナギアブラムシ,Aphis farinosa Gmelin
166,イチゴネアブラムシ,Aphis forbesi Weed
167,フキアブラムシ,Aphis fukii Shinji
168,ダイズアブラムシ,Aphis glycines Matsumura
169,ワタアブラムシ,Aphis gossypii Glover
170,カダイチゴアブラムシ,Aphis ichigocola Shinji
171,ボタイチゴアブラムシ,Aphis ichigoicola Shinji
172,キツネノマゴアブラムシ,Aphis justiceae Shinji
173,ヨモギヘアブラムシ,Aphis kurosawai Takahashi
174,ミズタガラシアブラムシ,Aphis mizutakarashi Shinji
175,キョウチクトウアブラムシ,Aphis nerii Boyer de Fonscolombe
176,オドリコソウアブラムシ,Aphis odorikonis Matsumura
177,スベリヒユアブラムシ,Aphis portulaceae Shinji
178,ギシギシアブラムシ,Aphis rumicis Linné
179,ニワトコアブラムシ,Aphis sambuci Linné
180,サルトリイバラアブラムシ,Aphis smilacifoliae Takahashi
181,スミレアブラムシ,Aphis sumire Moritsu
182,Aphis sp.,アキノタムラソウ
183,モモコフキアブラムシ,Hyalopterus pruni (Geoffroy)
184,タケノアブラムシ,Melanaphis bambusae (Fullaway)
185,タイワンススキアブラムシ,Melanaphis formosana (Takahashi)
186,ススキアブラムシ,Melanaphis japonica (Takahashi)
187,ススキアカイアブラムシ,Melanaphis montana (Sorin)?
188,ヒエノアブラムシ,Melanaphis sacchari (Zehntner)
189,Melanaphis sp.,チカラシバ
190,ムギミドリアブラムシ,Schizaphis graminum (Rondani)
191,ナシアブラムシ,Schizaphis piricola (Matsumura)
192,ショウブアブラムシ,Schizaphis rotundiventris (Signoret)
193,コミカンアブラムシ,Toxoptera aurantii (Boyer de Fonscolombe)
194,ミカンクロアブラムシ,Toxoptera citricidus (Kirkaldy)
195,ハゼアブラムシ,Toxoptera odinae (van der Goot)
196,Toxoptera sp. A,クチナシ
197,Toxoptera sp. B,シャシャンボ
198,キビクビレアブラムシ,Rhopalosiphum maidis (Fitch)
199,クワイクビレアブラムシ,Rhopalosiphum nymphaeae (Linné)
200,ムギクビレアブラムシ,Rhopalosiphum padi (Linné)
201,オカボアカアブラムシ,Rhopalosiphum rufiabdominalis (Sasaki)
202,ヤナギミキアブラムシ,Pterocomma pilosum Buckton
203,クヌギトゲアブラムシ,Cervaphis quercus Takahashi
204,コケブカアブラムシ,Eutrichosiphum pasaniae (Okajima)
205,シイケクダアブラムシ,Eutrichosiphum sinense Chaudhuri
206,クワナケブカアブラムシ,Greenidea kuwanai (Pergande)
207,ニホンケブカアブラムシ,Greenidea nipponica Suenaga
208,オカジマケブカアブラムシ,Greenidea okajimai Suenaga
209,クロオビケブカアブラムシ,Mollitrichosiphum nigrofasciatum (Maki)
210,ヤブタバココナジラミモドキ,Aleurodaphis blumeae van der Goot
211,Aleurodaphis sp.,ツリフネソウ、オタカラコウ
212,ミズキヒラタアブラムシ,Anoecia corni (Fabricius)
213,カンショワタムシ,Ceratovacuna lanigera Zehntner
214,エゴノネコフシアブラムシ,Ceratovacuna nekoashi (Sasaki)
215,イスノフキアブラムシ,Nipponaphis autumnalis Monzen
216,シイムネアブラムシ,Nipponaphis cuspidatae Essig et Kuwana
217,イスノオオムネアブラムシ,Nipponaphis distychii Pergande
218,イスノフシアブラムシ,Nipponaphis distyliicola Monzen
219,イスノタマフシアブラムシ,Nipponaphis globuli (Monzen)
220,タブノキコムネアブラムシ,Nipponaphis machilicola (Shinji)
221,モンゼンイスアブラムシ,Nipponaphis monzeni Takahashi
222,ヤノイスフシアブラムシ,Nipponaphis yanonis (Matsumura)
223,クスマルアブラムシ,Thoracaphis kashifoliae Uye?
224,トドマツワタムシ,Mindarus abietinus japonicus Takahashi
225,サワグルミミツアブラムシ,Glyphina onigurumi (Shinji)
226,クヌギミツアブラムシ,Glyphina onigurumi querciphila Takahashi
227,ササマルアブラムシ,Glyphinaphis bambusae van der Goot
228,カンスゲワタムシ,Colopha kansugei (Uye)
229,ケヤキフシアブラムシ,Colopha moriokaensis (Monzen)
230,ハンショウヅルノオオワタムシ,Eriosoma clematis (Shinji)
231,ニレワタムシ,Eriosoma japonica (Matsumura)
232,Eriosoma sp.,イチゴ
233,ハンショウヅルコワタムシ,Prociphilus clematicola (Shinji)?
234,ヒイラギハマキワタムシ,Prociphilus osmanthae Essig et Kuwana
235,ウシコロシハワタムシ,Prociphilus ushikoroshi Shinji
236,ヌルデノオオミミフシアブラムシ,Schlechtendalia chinensis (Bell)
237,パイクヨスジメンチュウ,Tetraneura paiki Hille Ris Lambers
238,ニレナガフシヨスジメンチュウ,Tetraneura sorini Hille Ris Lambers
239,ニシヤワタアブラムシ,Watabura nishiyae Matsumura
240,クリイガアブラムシ,Moritziella castaneivora Miyazaki
`.trim();

const cleanString = (v) => (v == null ? '' : String(v)).trim();

const normalizeSpaces = (s) => cleanString(s).replace(/\s+/g, ' ');

const jpContainsAsToken = (haystack, needle) => {
  const h = cleanString(haystack);
  const n = cleanString(needle);
  if (!h || !n) return false;

  const delims = new Set([
    ' ',
    '\t',
    '\n',
    '\r',
    '　',
    '（',
    '）',
    '(',
    ')',
    '、',
    '・',
    '／',
    '/',
    ',',
    ';',
    '「',
    '」',
    '『',
    '』',
    '[',
    ']',
    '{',
    '}',
    '【',
    '】',
  ]);

  let idx = -1;
  while ((idx = h.indexOf(n, idx + 1)) !== -1) {
    const before = idx > 0 ? h[idx - 1] : '';
    const afterIdx = idx + n.length;
    const after = afterIdx < h.length ? h[afterIdx] : '';
    const beforeOk = !before || delims.has(before);
    const afterOk = !after || delims.has(after);
    if (beforeOk && afterOk) return true;
  }
  return false;
};

const looksLikeScientificName = (s) => {
  const t = normalizeSpaces(s);
  // allow "Genus species", "Genus sp.", "Genus (Subgenus) species"
  return /^[A-Z][a-z]+(?:\s+\([A-Z][a-z]+\))?\s+(?:[a-z][a-z-]+|sp\.?)(?:\s+[A-Za-z0-9-]+|[a-z][a-z-]+)?/.test(t);
};

const extractTaxonKey = (sciRaw) => {
  const raw = normalizeSpaces(sciRaw)
    .replace(/[?？]+/g, '')
    .replace(/^[\"'“”]+|[\"'“”]+$/g, '')
    // Drop any parenthetical fragments (subgenus/authors).
    .replace(/\([^)]*\)/g, '')
    // Drop commas often used before years.
    .replace(/,/g, '')
    .trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const genus = tokens[0];
  if (!/^[A-Z][a-z]+$/.test(genus)) return null;
  let species = tokens[1];
  let subspecies = '';

  // Handle "sp." variants: "Genus sp. A" / "Genus sp. B"
  if (/^sp\.?$/i.test(species)) {
    const next = tokens[2] || '';
    species = next ? `sp. ${next}` : 'sp.';
    return `${genus} ${species}`.trim();
  }

  // Canonical binomial: Genus species
  if (!/^[a-z][a-z-]+$/.test(species)) return null;

  // Optional trinomial: Genus species subspecies
  const maybeSub = tokens[2] || '';
  const authorParticles = new Set([
    'van',
    'von',
    'de',
    'del',
    'der',
    'di',
    'da',
    'du',
    'la',
    'le',
    'et',
    'al',
    'ex',
  ]);
  if (maybeSub && /^[a-z][a-z-]+$/.test(maybeSub) && !authorParticles.has(maybeSub.toLowerCase())) {
    subspecies = maybeSub;
  }

  const key = [genus, species, subspecies].filter(Boolean).join(' ').trim();
  return key || null;
};

const extractKeysFromTextLoose = (text) => {
  const out = new Set();
  const t = normalizeSpaces(text);
  if (!t) return out;
  // Find scientific-name-like snippets inside mixed text.
  // Examples:
  // - "Aphis citricola van der Goot"
  // - "Cinara (Cinara) abietinus"
  // - "Genus sp. A"
  const re = /\b([A-Z][a-z]+(?:\s+\([A-Z][a-z]+\))?\s+(?:sp\.?|[a-z][a-z-]+)(?:\s+[a-z][a-z-]+)?)\b/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const key = extractTaxonKey(m[1]);
    if (key) out.add(key);
  }
  return out;
};

const parseAtlasList = () => {
  const rows = ATLAS_NO_NAME_SCI_RAW.split('\n').map(line => line.trim()).filter(Boolean);
  const byNo = new Map();
  for (const line of rows) {
    // We only stored the first 3 CSV fields; keep it simple.
    const parts = line.split(',');
    const no = Number(parts[0]);
    const name = cleanString(parts[1]);
    const sci = cleanString(parts.slice(2).join(',')); // in case sci itself contains commas

    if (!Number.isFinite(no) || no <= 0) continue;

    // Auto-repair malformed rows where the scientific name is in the "name" column (latin),
    // and the 3rd column is a host plant (Japanese).
    let japaneseName = name;
    let scientificName = sci;
    if (!looksLikeScientificName(scientificName) && looksLikeScientificName(japaneseName)) {
      scientificName = japaneseName;
      japaneseName = '';
    }

    byNo.set(no, {
      no,
      japaneseName: japaneseName,
      scientificName: scientificName,
      taxonKey: extractTaxonKey(scientificName)
    });
  }
  return byNo;
};

const loadCsv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return Array.isArray(parsed.data) ? parsed.data : [];
};

const writeCsv = (filePath, rows) => {
  const csv = Papa.unparse(rows, { header: true });
  fs.writeFileSync(filePath, csv, 'utf8');
};

const buildAphidIndex = (insectsRows) => {
  const aphids = insectsRows.filter(r => cleanString(r.family) === 'Aphididae' || cleanString(r.family_jp).includes('アブラムシ'));

  const byId = new Map();
  aphids.forEach(r => {
    const id = cleanString(r.insect_id);
    if (id) byId.set(id, r);
  });

  // keyLower -> Set(insect_id)
  const index = new Map();
  const add = (key, insectId) => {
    const k = cleanString(key).toLowerCase();
    if (!k) return;
    if (!index.has(k)) index.set(k, new Set());
    index.get(k).add(insectId);
  };

  aphids.forEach(r => {
    const id = cleanString(r.insect_id);
    if (!id) return;

    const genus = cleanString(r.genus);
    const species = cleanString(r.species);
    const subspecies = cleanString(r.subspecies);

    if (genus && species) {
      add([genus, species, subspecies].filter(Boolean).join(' '), id);
      add([genus, species].join(' '), id);
    }

    const sci = cleanString(r.scientific_name);
    const syn = cleanString(r.synonyms);
    const nameJp = cleanString(r.japanese_name);

    const sciKey = extractTaxonKey(sci);
    if (sciKey) add(sciKey, id);
    extractKeysFromTextLoose(sci).forEach(k => add(k, id));

    if (syn) {
      syn.split(/;\s*/).map(s => s.trim()).filter(Boolean).forEach(s => {
        const k = extractTaxonKey(s);
        if (k) add(k, id);
        extractKeysFromTextLoose(s).forEach(x => add(x, id));
      });
    }

    // Some rows embed scientific names inside the Japanese name string.
    extractKeysFromTextLoose(nameJp).forEach(k => add(k, id));
  });

  return { byId, index, aphids };
};

const resolveInsectIdForAtlasEntry = (atlasEntry, aphidIndex) => {
  const { byId, index, aphids } = aphidIndex;

  const primaryKey = atlasEntry?.taxonKey;
  const jp = cleanString(atlasEntry?.japaneseName);
  if (!primaryKey) {
    if (!jp) return { id: '', reason: 'missing scientific name' };
    // Fallback: try Japanese name when scientific name is missing.
    const jpHits = aphids
      .filter(r => jpContainsAsToken(r.japanese_name, jp))
      .map(r => cleanString(r.insect_id))
      .filter(Boolean);
    const uniq = Array.from(new Set(jpHits));
    if (uniq.length === 1) return { id: uniq[0], reason: 'ok (matched by japanese name)' };
    if (uniq.length > 1) return { id: '', reason: `ambiguous match (${uniq.length} candidates) by japanese name` };
    return { id: '', reason: 'missing scientific name' };
  }

  const normalized = primaryKey.toLowerCase();
  const keysToTry = [];

  // Prefer trinomial, then binomial.
  keysToTry.push(normalized);
  const parts = normalized.split(/\s+/);
  if (parts.length >= 2) keysToTry.push(`${parts[0]} ${parts[1]}`);

  // Some records have canonical subspecies variants; try stripping "sp. X" normalization too.
  if (parts[1] === 'sp.' && parts[2]) keysToTry.push(`${parts[0]} sp. ${parts[2]}`);

  for (const k of keysToTry) {
    const hit = index.get(k);
    if (!hit || hit.size === 0) continue;
    if (hit.size === 1) return { id: Array.from(hit)[0], reason: 'ok' };

    // When matching a binomial ("Genus species") but multiple subspecies exist, prefer the
    // species-level row (subspecies empty) to avoid false ambiguity.
    const tokenCount = k.split(/\s+/).filter(Boolean).length;
    if (tokenCount === 2) {
      const preferred = Array.from(hit).filter((candidateId) => {
        const row = byId.get(candidateId);
        return cleanString(row?.subspecies) === '';
      });
      if (preferred.length === 1) return { id: preferred[0], reason: 'ok (preferred species-level record)' };
    }

    // Disambiguate by Japanese name when possible
    if (jp) {
      const matches = Array.from(hit).filter((candidateId) => {
        const row = byId.get(candidateId);
        const name = cleanString(row?.japanese_name);
        return name && jpContainsAsToken(name, jp);
      });
      if (matches.length === 1) return { id: matches[0], reason: 'ok (disambiguated by japanese name)' };
    }

    return { id: '', reason: `ambiguous match (${hit.size} candidates) for ${k}` };
  }

  // Fallback: try Japanese name token match (helps when taxonomy changed but JP name stayed).
  if (jp) {
    const jpHits = aphids
      .filter(r => jpContainsAsToken(r.japanese_name, jp))
      .map(r => cleanString(r.insect_id))
      .filter(Boolean);
    const uniq = Array.from(new Set(jpHits));
    if (uniq.length === 1) return { id: uniq[0], reason: 'ok (matched by japanese name)' };
    if (uniq.length > 1) return { id: '', reason: `ambiguous match (${uniq.length} candidates) by japanese name` };
  }

  return { id: '', reason: `no match for ${primaryKey}` };
};

const main = async () => {
  if (!fs.existsSync(INSECTS_CSV)) {
    console.error('Missing insects.csv:', INSECTS_CSV);
    process.exit(1);
  }

  const atlasByNo = parseAtlasList();
  const insects = loadCsv(INSECTS_CSV);
  const aphidIndex = buildAphidIndex(insects);

  const placeholderToResolved = new Map(); // srcId -> {dstId, reason, no, sci}
  const placeholderCounts = new Map(); // srcId -> count

  const isPlaceholderId = (id) => {
    const m = cleanString(id).match(/^species-(\d+)$/);
    if (!m) return false;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > ATLAS_ID_BASE;
  };

  // First pass: build mapping per placeholder insect_id based on atlas no.
  // We do this once so both public/normalized hostplants apply the same mapping.
  for (const hostFile of TARGET_HOSTPLANT_FILES) {
    if (!fs.existsSync(hostFile)) continue;
    const rows = loadCsv(hostFile);
    rows.forEach(r => {
      const ref = cleanString(r.reference);
      if (!ref.includes(ATLAS_REF)) return;
      const srcId = cleanString(r.insect_id);
      if (!isPlaceholderId(srcId)) return;
      placeholderCounts.set(srcId, (placeholderCounts.get(srcId) || 0) + 1);
    });
  }

  const srcIds = Array.from(placeholderCounts.keys()).sort((a, b) => a.localeCompare(b));
  for (const srcId of srcIds) {
    const m = srcId.match(/^species-(\d+)$/);
    const numeric = Number(m[1]);
    const no = numeric - ATLAS_ID_BASE;
    const atlas = atlasByNo.get(no);
    const sci = cleanString(atlas?.scientificName);
    const jp = cleanString(atlas?.japaneseName);

    if (!atlas) {
      placeholderToResolved.set(srcId, { dstId: '', reason: `no mapping entry for No.${no}`, no, sci, jp });
      continue;
    }

    const resolved = resolveInsectIdForAtlasEntry(atlas, aphidIndex);
    placeholderToResolved.set(srcId, { dstId: resolved.id, reason: resolved.reason, no, sci, jp });
  }

  // Apply mapping to both hostplant files.
  const appliedStats = [];
  for (const hostFile of TARGET_HOSTPLANT_FILES) {
    if (!fs.existsSync(hostFile)) continue;
    const rows = loadCsv(hostFile);
    let changed = 0;
    rows.forEach(r => {
      const ref = cleanString(r.reference);
      if (!ref.includes(ATLAS_REF)) return;
      const srcId = cleanString(r.insect_id);
      const map = placeholderToResolved.get(srcId);
      if (!map?.dstId) return;
      if (srcId !== map.dstId) {
        r.insect_id = map.dstId;
        changed++;
      }
    });
    if (changed > 0) {
      writeCsv(hostFile, rows);
    }
    appliedStats.push({ file: path.relative(ROOT, hostFile), changed });
  }

  // Report
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportRows = [];
  let okIds = 0;
  let okRows = 0;
  let missIds = 0;
  let missRows = 0;

  for (const [srcId, info] of placeholderToResolved.entries()) {
    const count = placeholderCounts.get(srcId) || 0;
    const ok = Boolean(info.dstId);
    if (ok) { okIds++; okRows += count; } else { missIds++; missRows += count; }
    reportRows.push({
      src_insect_id: srcId,
      dst_insect_id: info.dstId,
      no: info.no,
      japanese_name: info.jp,
      scientific_name: info.sci,
      hostplant_rows: count,
      reason: info.reason,
    });
  }

  const reportPath = path.join(REPORTS_DIR, 'aphid_hostplant_id_fix_report.csv');
  fs.writeFileSync(reportPath, Papa.unparse(reportRows, { header: true }), 'utf8');

  console.log('[aphid-hostplant-id-fix] atlas placeholder IDs:', srcIds.length);
  console.log('[aphid-hostplant-id-fix] mapped IDs:', okIds, 'unmapped IDs:', missIds);
  console.log('[aphid-hostplant-id-fix] mapped rows:', okRows, 'unmapped rows:', missRows);
  appliedStats.forEach(s => console.log('[aphid-hostplant-id-fix] updated', s.file, 'rows:', s.changed));
  console.log('[aphid-hostplant-id-fix] report:', path.relative(ROOT, reportPath));

  // Also print a small unmapped sample for quick debugging.
  const sampleUnmapped = reportRows.filter(r => !r.dst_insect_id).slice(0, 12);
  if (sampleUnmapped.length > 0) {
    console.log('[aphid-hostplant-id-fix] unmapped sample (first 12):');
    sampleUnmapped.forEach(r => {
      console.log(`- No.${r.no} ${r.japanese_name || ''} ${r.scientific_name || ''} -> ${r.reason} (${r.src_insect_id}, rows=${r.hostplant_rows})`);
    });
  }
};

main().catch((e) => {
  console.error('[aphid-hostplant-id-fix] failed:', e);
  process.exit(1);
});
