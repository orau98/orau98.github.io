import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const NORM = path.join(ROOT, 'normalized_data');

const INSECTS_PUB = path.join(PUB, 'insects.csv');
const INSECTS_NORM = path.join(NORM, 'insects.csv');
const HOSTPLANTS_PUB = path.join(PUB, 'hostplants.csv');
const HOSTPLANTS_NORM = path.join(NORM, 'hostplants.csv');
const NOTES_PUB = path.join(PUB, 'general_notes.csv');
const NOTES_NORM = path.join(NORM, 'general_notes.csv');

// 提供データ（日本のハマキガ2 抜粋）
const RAW = `亜科,族名,属名,和名,学名,食草,食草に関する備考,成虫の発生時期,成虫発生時期に関する備考
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,ヘリオビヒメハマキ,Cryptaspasma marginifasciata (Walsingham, 1900),"コナラ Quercus serrata, ミズナラ Q. crispula, シラカシ Q. myrsinifolia, ウバメガシ Q. phillyreoides (ブナ科)",幼虫は寄主植物の堅果に食入する,7月-11月,
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,ホソバヘリオビヒメハマキ(新称),Cryptaspasma mirabilis Kuznetzov, 1964,"コナラ Quercus serrata, クヌギ Q. acutissima (ブナ科)",幼虫は寄主の堅果に潜っている,10月,"九州南部で得られている"
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,クロサンカクモンヒメハマキ,Cryptaspasma trigonana (Walsingham, 1900),"コナラ Quercus serrata, ミズナラ Q. crispula, アラカシ Q. glauca, クヌギ Q. acutissima (ブナ科), シラカシ Q. myrsinifolia, マテバシイ Lithocarpus edulis (ブナ科)からも記録がある",幼虫は寄主の堅果に潜る,"4月-6月",
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,ヒロバクロサンカクモンヒメハマキ(新称),Cryptaspasma sp. 1,"コナラ Quercus serrata (ブナ科)",幼虫はコナラの堅果に潜り、5月に羽化した,5月,
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,ニセクロサンカクモンヒメハマキ(新称),Cryptaspasma sp. 2,未知,,6月,
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,アマミクロサンカクモンヒメハマキ(新称),Cryptaspasma sp. 3,"アマミアラカシ Quercus glauca var. amamiana, スダジイ Castanopsis sieboldii (ブナ科)",幼虫は寄主の堅果に潜る,3月-4月,"羽化成虫が得られている"
ヒメハマキガ亜科,ハラブトヒメハマキガ族,Cryptaspasma,ハラブトヒメハマキ,Cryptaspasma angulicostana (Walsingham, 1900),"タブノキ Machilus thunbergii (クスノキ科)",幼虫は寄主の実に潜る,3月,"沖縄の山原で灯火採集された個体の記録"
ヒメハマキガ亜科,クラークヒメハマキガ族,Hiroshiinoueana,ギンボシクロヒメハマキ,Hiroshiinoueana stellifera Kawabe, 1978,"タブノキ Machilus thunbergia (クスノキ科)","岐阜県では7月中旬と9月中旬に樹上のタブノキの枯葉から幼虫が得られている",,
ヒメハマキガ亜科,クラークヒメハマキガ族,Gatesclarkeana,シロテンアカマダラヒメハマキ,Gatesclarkeana idia Diakonoff, 1973,"ウラジロエノキ Trema orientalis (アサ科), チャノキ Camellia sinensis (ツバキ科), ミカン Citrus sp. (ミカン科)など",幼虫は様々な植物の葉や花を摂食する,"3月-10月","南西諸島での出現時期"
ヒメハマキガ亜科,クラークヒメハマキガ族,Asymmetrarcha,カンナヒメハマキ,Asymmetrarcha xenopa Diakonoff, 1973,"ギーマ Vaccinium wrightii (ツツジ科)",幼虫は寄主の新葉を粗くつづる,,
ヒメハマキガ亜科,クラークヒメハマキガ族,Temnolopha,モザイクヒメハマキ,Temnolopha mosaica Lower, 1901,"国内では未知. オーストラリアではDrypetes属 (ツゲモドキ科)",オーストラリアではDrypetes属の葉を摂食する,"9月,10月,12月","父島での採集記録"
ヒメハマキガ亜科,クラークヒメハマキガ族,Ukamenia,サッポロヒメハマキ,Ukamenia sapporensis (Matsumura, 1931),"ミズナラ Quercus crispula, クリ Castanea crenata (ブナ科), マンサク Hamamelis japonica (マンサク科), ナツハゼ Vaccinium oldhamii (ツツジ科)","クリタマバチの虫こぶやメイガ科幼虫の巻葉から羽化している",5月-9月,
ヒメハマキガ亜科,クラークヒメハマキガ族,Ukamenia,オスコバネマダラヒメハマキ,Ukamenia dimorpha Nasu, 2012,未知,,4月-8月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,イグサヒメハマキ,Bactra furfurana (Haworth, [1811]),"イグサ Juncus decipiens (イグサ科), アブラガヤ属 Scirpus (カヤツリグサ科)",幼虫はイグサの茎に潜り、芯枯れを起こす,5月-10月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,ウキヤガラシンムシガ,Bactra robustana (Christoph, 1872),"ウキヤガラ Bolboschoenus fluviatilis subsp. yagara, コウキヤガラ B. koshevnikovii (カヤツリグサ科)",幼虫は寄主の茎や根に潜る,5月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,トガリバヒメハマキ,Bactra festa Diakonoff, 1959,未知,成虫は渓流沿いのスゲの1種に群がる,5月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,シロテントガリバヒメハマキ,Bactra venosana (Zeller, 1847),"ハマスゲ Cyperus rotundus (カヤツリグサ科)",幼虫は寄主の茎に潜る,5月-9月,"本州での採集時期"
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,フタモントガリバヒメハマキ,Bactra hostilis Diakonoff, 1956,未知,,6月-9月,"本州での採集時期"
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,イチモジトガリバヒメハマキ,Bactra copidotis Meyrick, 1909,未知,,7月-8月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Bactra,キモントガリバヒメハマキ,Bactra cerata (Meyrick, 1909),未知,,"8月 (本州), 4-9月 (南西諸島)"
ヒメハマキガ亜科,トガリバヒメハマキガ族,Syntozyga,マエモントガリバヒメハマキ(新称),Syntozyga negligens (Diakonoff, 1973),未知,,"4月 (トカラ), 9月 (沖縄)"
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,カワラクロマダラヒメハマキ,Endothenia informalis (Meyrick, 1935),未知,,6月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,オオクロマダラヒメハマキ,Endothenia atrata (Caradja, 1926),未知,,7月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ヌマクロマダラヒメハマキ,Endothenia sp. 1,未知,"成虫は河岸沼沢地や水田付近で採れている","6月中旬-9月下旬",
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ケナガクロマダラヒメハマキ,Endothenia sp. 2,未知,,6月-8月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,クロマダラシンムシガ,Endothenia nigricostana (Haworth, [1811]),"イヌゴマ属 Stachys (シソ科)","ヨーロッパでは、幼虫はイヌゴマ属の茎や根に潜る",5月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,キヨサトヒメハマキ,Endothenia hebesana (Walker, 1863),"ヨーロッパの記録では、クマツヅラ属 Verbena, アヤメ属 Iris, イヌゴマ属 Stachys, リンドウ属 Gentiana, アキノキリンソウ属 Solidagoなどの草本類",幼虫は様々な草本類の茎、新芽、花に潜る,8月下旬,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ツマジロクロヒメハマキ,Endothenia gentianaeana (Hübner, [1799]),"ヨーロッパの記録では、ナベナ属 Dipsacus, オオバコ属 Plantago, リンドウ属 Gentiana, ナデシコ属 Dianthus","幼虫は様々な草本類の茎、新芽、花などに潜り、幼虫で越冬する",5月-10月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ホソクロマダラヒメハマキ,Endothenia ingrata Falkovitsh, 1970,未知,,6月中旬,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,サワクロマダラヒメハマキ,Endothenia sp. 3,未知,"山間の小流や水田用水路付近、丘陵斜面で採集されている",6月-8月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ウンモンクロマダラヒメハマキ,Endothenia austerana (Kennel, 1916),未知,,8月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,シソフシガ,Endothenia remigera Falkovitsh, 1970,"シソ Perilla frutescens (シソ科)","幼虫は夏から秋にかけて、シソの茎上部に虫こぶをつくる。年2-3化",6月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ニセコクロヒメハマキ,Endothenia bira Kawabe, 1976,未知,,6月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ミカエリソウヒメハマキ(新称),Endothenia sp. 4,"ミカエリソウ Comanthosphace stellipila, テンニンソウ C. japonica (シソ科)","秋に寄主の花序の軸内に潜っている幼虫が得られている",
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ハッカノネムシガ,Endothenia menthivora (Oku, 1963),"ハッカ Mentha canadensis (シソ科)","ハッカの害虫である。幼虫は地下茎内で越冬。年1化。",7月-9月,
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ニセハッカノネムシガ,Endothenia quadrimaculana (Haworth, [1811]),"イヌゴマ属 Stachys, ハッカ属 Mentha (シソ科)","ヨーロッパではシソ科植物の根あるいは地下茎に潜る",7月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Tokuana,ヤクサザナミキヒメハマキ,Tokuana imbrica Kawabe, 1978,未知,,7月-9月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Neoanathamna,スジキヒメハマキ,Neoanathamna negligens Kawabe, 1978,未知,,"近畿では5-6月",
ヒメハマキガ亜科,カギバヒメハマキガ族,Neoanathamna,スソモンサザナミキヒメハマキ,Neoanathamna pallens Kawabe, 1980,未知,,5月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Neoanathamna,チャモンサザナミキヒメハマキ,Neoanathamna cerina Kawabe, 1978,"クスノキ Cinnamomum camphora, カナクギノキ Lindera erythrocarpa (クスノキ科)",幼虫は寄主の葉をつづる,6月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Neoanathamna,ニセコシワヒメハマキ,Neoanathamna nipponica (Kawabe, 1976),枯葉,"幼虫は落葉層内で枯葉をつづって、その中に潜みながら枯葉を摂食している。おそらく幼虫越冬。",4月-6月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Sillybiphora,ハイマダラヒメハマキ,Sillybiphora devia Kuznetzov, 1964,"トモエソウ Hypericum ascyron subsp. ascyron var. ascyron (オトギリソウ科)","ロシアからはマメ科草本が記録されているため、多食性かもしれない。幼虫越冬あるいは蛹越冬と思われる。",6月-9月,"本州での出現時期"
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,マエモンマダラカギバヒメハマキ,Ancylis amplimacula Falkovitsh, 1965,未知,,5月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,クロテンマダラカギバヒメハマキ,Ancylis melanostigma Kuznetzov, 1970,未知,,6月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,マダラカギバヒメハマキ,Ancylis laetana (Fabricius, 1775),"ロシアでは、チョウセンヤマナラシ Populus tremula var. davidiana (ヤナギ科)",,6月-7月,"本州での記録"
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ナミモンカギバヒメハマキ,Ancylis geminana (Donovan, [1806]),"海外では、ヤナギ属 Salix (ヤナギ科)","渓流沿いのヤナギ林や風衝地のミネヤナギ Salix reinii 上から採集されている",6月-7月,"本州での記録"
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ナガカギバヒメハマキ,Ancylis repandana Kennel, 1901,"ロシアではモンゴリナラ Quercus mongolica (ブナ科)","成虫越冬かもしれない。幼虫はロシアではモンゴリナラの新芽につく。",3月-5月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,カギバヒメハマキ,Ancylis nemorana Kuznetzov, 1969,"ブナ Fagus crenata (ブナ科), ロシアでは、カバノキ属 Betula (カバノキ科), コナラ属 Quercus (ブナ科)","岩手県ではブナから飼育されている",5月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,カバカギバヒメハマキ,Ancylis partitana (Christoph, 1882),"コナラ Quercus serrata, ミズナラ Q. crispula (ブナ科)","幼虫は寄主植物の葉を二つ折りにして内面を摂食、そのまま落葉して、幼虫で越冬したのち蛹化する",5月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,コゲチャカギバヒメハマキ,Ancylis upupana (Treitschke, 1835),"国外では、ニレ属 Ulmus (ニレ科), カバノキ属 Betula (カバノキ科), コナラ属 Quercus (ブナ科)","シラカンバ B. platyphylla (カバノキ科) 林に多い",6月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,コカギバヒメハマキ,Ancylis loktini Kuznetzov, 1969,未知,,6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ウスベニカギバヒメハマキ,Ancylis uncella ([Denis & Schiffermüller], 1775),"国外ではカバノキ属 Betula (カバノキ科), カルーナ属 Calluna, エリカ属 Erica (ツツジ科)",,5月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,チャモンカギバヒメハマキ,Ancylis kenneli Kuznetzov, 1962,未知,,7月,"本州での記録"
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ウススジアカカギバヒメハマキ,Ancylis obtusana (Haworth, [1811]),"ヨーロッパでは、クロウメモドキ属 Rhamnus, イソノキ属 Frangula (クロウメモドキ科)",,5月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ウスキカギバヒメハマキ,Ancylis unculana (Haworth, [1811]),"海外では、ヤマナラシ属 Populus, ヤナギ属 Salix (ヤナギ科), クロウメモドキ属 Rhamnus, イソノキ属 Frangula (クロウメモドキ科), キイチゴ属 Rubus (バラ科)など",,7月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,アキニレカギバヒメハマキ,Ancylis arcitenens Meyrick, 1922,"アキニレ Ulmus parvifolia (ニレ科)","近畿では4月下旬-6月下旬に採集。8月に石川県で記録がある","4月下旬-6月下旬, 8月",
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ツマアカカギバヒメハマキ,Ancylis apicipicta Oku, 2005,未知,"ハルニレ Ulmus davidiana var. japonica 自生地で採集されている",6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ニシベツヒメハマキ,Ancylis unguicella (Linnaeus, 1758),"ヨーロッパでは、カルーナ属 Calluna, エリカ属 Erica (ツツジ科)",,6月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,イチゴカギバヒメハマキ,Ancylis comptana (Frölich, 1828),"オランダイチゴ属 Fragaria, キイチゴ属 Rubus, バラ属 Rosa など(バラ科), イブキジャコウソウ属 Thymus, ニガクサ属 Teucrium など(シソ科)","ヨーロッパではイチゴ Fragaria x ananassa (バラ科)の害虫として知られる",4月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ホソカギバヒメハマキ,Ancylis celerata (Meyrick, 1912),"ヤエヤマネコノチチ Rhamnella inaequilatera, リュウキュウクロウメモドキ Rhamnus liukiuensis (クロウメモドキ科)",,5月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ミヤマカギバヒメハマキ,Ancylis myrtillana (Treitschke, 1830),"ヨーロッパでは、スノキ属 Vaccinium (ツツジ科)",,5月-8月,"本州での出現時期"
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,セクロモンカギバヒメハマキ,Ancylis badiana ([Denis & Schiffermüller], 1775),"シロツメクサ Trifolium repens (マメ科). ロシアではクサフジ Vicia cracca, レンリソウ Lathyrus quinquenervius (マメ科)","ヨーロッパでは老熟幼虫で越冬する。おそらく年2化",4月-10月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ホソセモンカギバヒメハマキ,Ancylis paludana (Barrett, 1871),"シロツメクサ Trifolium repens, エゾノレンリソウ Lathyrus palustris var. pilosus, ハマエンドウ L. japonicus (マメ科), ハマゴウ Vitex rotundifolia (シソ科)","老熟幼虫で越冬、おそらく年数世代経過すると思われる","4月下旬-11月",
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,セモンカギバヒメハマキ,Ancylis mandarinana Walsingham, 1900,"ヤマハギ Lespedeza bicolor (マメ科)","おそらく老熟幼虫で越冬し、年3化はする",5月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,オオセモンカギバヒメハマキ,Ancylis limosa Oku, 2005,未知,,6月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,フタボシヒメハマキ,Ancylis selenana (Guenée, 1845),"カスミザクラ Cerasus leveilleana, ナシ Pyrus pyrifolia, アンズ Prunus armeniaca var. ansu, アズキナシ Aria alnifolia (バラ科)",,5月-9月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,タテスジカギバヒメハマキ,Ancylis apicella ([Denis & Schiffermüller], 1775),"ヨーロッパでは、クロウメモドキ属 Rhamnus (クロウメモドキ科), サンシュユ属 Cornus (ミズキ科), ヤチヤナギ属 Myrica (ヤマモモ科), イボタノキ属 Ligustrum (モクセイ科), スモモ属 Prunus (バラ科)",,6月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ホソバタテスジカギバヒメハマキ(新称),Ancylis sp.,未知,"年2化かもしれない",3月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Ancylis,ナツメカギバヒメハマキ,Ancylis sativa Liu, 1979,"ナツメ Ziziphus jujuba var. inermis, ケンポナシ Hovenia dulcis (クロウメモドキ科)",幼虫は寄主植物の葉の縁を折り曲げたり、つづったりする,4月-9月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Tetramoera,カンシャシンクイ,Tetramoera schistaceana (Snellen, 1891),"サトウキビ Saccharum officinarum (イネ科)","沖縄では大害虫である。幼生期は駒井ら(2011)に詳しい。","沖縄では1年中見られるが5-6月の発生が多い",
ヒメハマキガ亜科,カギバヒメハマキガ族,Tetramoera,ウスイロスジキヒメハマキ,Tetramoera bifurcvalva Nasu & Saito, 2021,未知,,10月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Tetramoera,アカスジクロヒメハマキ,Tetramoera sasakii Nasu, 2022,未知,,7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonia,ギンボシキヒメハマキ,Enarmonia major (Walsingham, 1900),未知,"樹陰の生育不良なササ原に発生する",5月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonia,コギンボシキヒメハマキ,Enarmonia decor Kawabe, 1978,未知,"日中、樹陰のネザサ Pleioblastus argenteostriatus (イネ科)間で活動する",6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonia,コナミスジキヒメハマキ,Enarmonia flammeata Kuznetzov, 1971,"チマキザサ(クマイザサ) Sasa palmata (イネ科)","幼虫は北海道ではチマキザサの幼鞘に潜っているのが発見された",5月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonia,エゾギンボシヒメハマキ,Enarmonia minuscula Kuznetzov, 1981,未知,,6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonia,アカオビギンスジヒメハマキ,Enarmonia aritai Nasu, 2012,未知,,6月-7月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonodes,クロキマダラヒメハマキ,Enarmonodes aeologlypta (Meyrick, 1936),未知,"ササ原に多い",6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Enarmonodes,アイノキマダラヒメハマキ,Enarmonodes aino Kuznetzov, 1968,未知,"ササ原に多い",6月-9月,"本州での出現時期"
ヒメハマキガ亜科,カギバヒメハマキガ族,Semnostola,ニセハギカギバヒメハマキ,Semnostola magnifica (Kuznetzov, 1964),未知,"成虫はヤチダモ Fraxinus mandshurica (モクセイ科)自生地に産する",6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Semnostola,セサンカクモンヒメハマキ,Semnostola triangulata Nasu & Kogi, 1997,未知,,7月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Semnostola,ツマアカクロヒメハマキ,Semnostola trisignifera Kuznetzov, 1970,未知,"成虫は日中、樹陰中を活発に飛行する",6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Semnostola,クチヒゲアオヒメハマキ,Semnostola shimizui Nasu, 2022,未知,"成虫は日中、活発に飛行することはない",5月-6月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Eucosmomorpha,ムルティヒメハマキ,Eucosmomorpha multicolor Kuznetzov, 1964,"クロバナヒキオコシ Isodon trichocarpus (シソ科)",,6月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Pseudacroclita,イチゴツツヒメハマキ,Pseudacroclita hapalaspis (Meyrick, 1931),"フユイチゴ Rubus buergeri, モミジイチゴ R. palmatus var. coptophyllus, クマイチゴ R. crataegifolius, ホウロクイチゴ R. sieboldii (バラ科)","幼虫は葉の裏表に貫通した巣を造り中に潜みながら、葉の表を摂食する。近畿地方では幼虫で越冬、岩手県では蛹越冬。",4月-9月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Pseudacroclita,アサダツツヒメハマキ(新称),Pseudacroclita sp.,"アサダ Ostrya japonica (カバノキ科)",,8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Pseudacroclita,ヒキオコシツツヒメハマキ,Pseudacroclita luteisupecula (Kuznetzov, 1979),"クロバナヒキオコシ Isodon trichocarpus, ヒキオコシ I. japonicus, アキチョウジ I. longitubus (シソ科)",イチゴツツヒメハマキと同様な巣を造る,7月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Pseudacroclita,ムラサキシキブツツヒメハマキ,Pseudacroclita microplaca (Meyrick, 1912),"ムラサキシキブ Callicarpa japonica (シソ科)",ヒキオコシツツヒメハマキと同様な幼虫の巣を造る,5月-8月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Loboschiza,センダンヒメハマキ,Loboschiza koenigiana (Fabricius, 1775),"センダン Melia azedarach (センダン科)",幼虫はセンダンの葉をつづる,6月-9月,
ヒメハマキガ亜科,カギバヒメハマキガ族,Anthozela,ツマアカアオヒメハマキ,Anthozela sp.,"フウトウカズラ Piper kadsura (コショウ科)","幼虫はフウトウカズラの新梢に潜る","近畿では4-5月",
ヒメハマキガ亜科,トガリバヒメハマキガ族,Endothenia,ウスチャマダラヒメハマキ(新称),Endothenia citharistis (Meyrick, 1909),未知,,4月,`;

const REF = '日本のハマキガ2';

// 小道具
const readCSV = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: true }).data;
const writeCSV = (p, rows) => {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
};

const pad = (n, w = 4) => String(n).padStart(w, '0');

// 族の和名→ラテン名の簡易マップ（既存CSVの実例に基づく）
const TRIBE_MAP = new Map([
  ['ハラブトヒメハマキガ族', 'Microcorsini'],
  ['クラークヒメハマキガ族', 'Gatesclarkeanini'],
  ['トガリバヒメハマキガ族', 'Bactrini'],
  ['カギバヒメハマキガ族', 'Enarmoniini'],
]);

// 学名の分解
function parseScientificName(scientific) {
  if (!scientific) return { genus: '', species: '', author: '', year: '', binomial: '' };
  const s = scientific.trim();
  // 末尾の著者・年 (括弧有無) を抽出
  const m = s.match(/^(.*?)\s*([A-Z][a-zA-Z.-]+)?\s*([a-z0-9.-]+(?:\s+[a-z0-9.-]+)?)?\s*(\(([^)]+)\)|[^()]*\d{3,4}.*)?$/);
  // 単純化した抽出（Genus を先頭語、残りの最初の語を species とみなす）
  const parts = s.replace(/\s*\([^)]*\)\s*$/, '').trim().split(/\s+/);
  const genus = parts[0] || '';
  const species = parts[1] ? parts.slice(1).join(' ') : '';
  // 著者・年
  let author = '';
  let year = '';
  const ay = s.match(/\(([^,]+),\s*([^\)]+)\)\s*$/) || s.match(/\s([A-Z].*?),\s*(\[?\d{3,4}\]?)\s*$/);
  if (ay) {
    author = (ay[1] || '').trim();
    year = (ay[2] || '').trim();
  }
  const binomial = genus && species ? `${genus} ${species.split(/\s+/)[0]}` : (genus ? `${genus}` : '');
  return { genus, species: species || '', author, year, binomial };
}

function normalizeJapaneseName(name) {
  if (!name) return '';
  return name.replace(/（新称）|\(新称\)/g, '').trim();
}

// 食草のパース（日本語名と科名）
function parseHostPlants(text) {
  if (!text || /未知/.test(text)) return [];
  let currentFamily = '';
  const results = [];
  const tokens = text.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
  for (let token of tokens) {
    // 科名指定がある場合は保持
    const famMatch = token.match(/\(([^)]+科)\)/);
    if (famMatch) currentFamily = famMatch[1];
    // ラテン名などを除去し、日本語名を優先
    // 例: "コナラ Quercus serrata" -> 「コナラ」
    let name = token.replace(/\s+[A-Z][a-zA-Z.\-]+.*$/, '').replace(/\s+Q\..*$/, '');
    name = name.replace(/\([^)]*科\)/g, '').replace(/からも記録がある|など$/g, '').trim();
    // 属表記（Drypetes属 など）はそのまま
    if (!name) continue;
    results.push({ plant_name: name, plant_family: currentFamily || '' });
  }
  // 重複削除
  const uniq = new Map();
  for (const r of results) {
    const key = `${r.plant_name}||${r.plant_family}`;
    if (!uniq.has(key)) uniq.set(key, r);
  }
  return Array.from(uniq.values());
}

// 部位・ステージの推定
function inferPartAndStage(note) {
  const n = note || '';
  const stage = /幼虫/.test(n) ? '幼虫' : '';
  let part = '';
  if (/堅果/.test(n)) part = '堅果';
  else if (/果|実に/.test(n)) part = '実';
  else if (/茎/.test(n)) part = '茎';
  else if (/根/.test(n)) part = '根';
  else if (/新芽/.test(n)) part = '新芽';
  else if (/花序/.test(n)) part = '花序軸';
  else if (/花/.test(n)) part = '花';
  else if (/葉/.test(n)) part = '葉';
  return { plant_part: part, life_stage: stage };
}

function nextSpeciesId(insects) {
  // mothの通常ID（species-0001..）の最大を探し、次番号を付与
  let max = 0;
  for (const r of insects) {
    const id = (r.insect_id || '').trim();
    const m = id.match(/^species-(\d{4,5})$/);
    if (m) {
      const num = parseInt(m[1], 10);
      // 蝶など2万台はスキップし、1万未満を moth とみなす
      if (num < 10000 && num > max) max = num;
    }
  }
  const next = max + 1;
  return `species-${pad(next, 4)}`;
}

function nextHostplantId(hosts) {
  let max = 0;
  for (const r of hosts) {
    const id = (r.record_id || '').trim();
    const m = id.match(/^hostplant-(\d{6})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `hostplant-${String(next).padStart(6, '0')}`;
}

function nextNoteId(notes) {
  let max = 0;
  for (const r of notes) {
    const id = (r.record_id || '').trim();
    const m = id.match(/^note-(\d{6})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `note-${String(next).padStart(6, '0')}`;
}

function buildScientificName(genus, species, author, year) {
  const bin = [genus, species].filter(Boolean).join(' ');
  if (author || year) {
    const ay = [author, year].filter(Boolean).join(', ');
    return `${bin} (${ay})`;
  }
  return bin;
}

function main() {
  const rows = Papa.parse(RAW, { header: true, skipEmptyLines: true }).data;
  const insectsPub = readCSV(INSECTS_PUB);
  const insectsNorm = readCSV(INSECTS_NORM);
  const hostsPub = readCSV(HOSTPLANTS_PUB);
  const hostsNorm = readCSV(HOSTPLANTS_NORM);
  const notesPub = readCSV(NOTES_PUB);
  const notesNorm = readCSV(NOTES_NORM);

  // 既存 index: 学名binomial → insect_id／和名 → insect_id
  const byBinomial = new Map();
  const byJapanese = new Map();
  for (const r of insectsPub) {
    const sci = (r.scientific_name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    const parts = sci.split(/\s+/);
    const bin = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || '';
    if (bin) byBinomial.set(bin, r.insect_id);
    if (r.japanese_name) byJapanese.set(r.japanese_name.trim(), r.insect_id);
  }

  let addedInsects = 0;
  let addedHosts = 0;
  let addedNotes = 0;

  for (const row of rows) {
    const subfamilyJP = (row['亜科'] || '').trim();
    const tribeJP = (row['族名'] || '').trim();
    const genus = (row['属名'] || '').trim();
    const japanese = normalizeJapaneseName(row['和名'] || '');
    const sciRaw = (row['学名'] || '').trim();
    const hostText = (row['食草'] || '').trim();
    const hostNote = (row['食草に関する備考'] || '').trim();
    const adult = (row['成虫の発生時期'] || '').trim();
    const adultNote = (row['成虫発生時期に関する備考'] || '').trim();

    const { genus: g, species, author, year, binomial } = parseScientificName(sciRaw);
    const bin = binomial || (genus ? `${genus}` : '');

    // 既存ID探索（binomial優先、なければ和名）
    let insectId = byBinomial.get(bin) || byJapanese.get(japanese) || '';

    // 存在しなければ新規作成
    if (!insectId) {
      insectId = nextSpeciesId(insectsPub);
      const subfamilyLatin = 'Olethreutinae';
      const tribeLatin = TRIBE_MAP.get(tribeJP) || '';
      const familyLatin = 'Tortricidae';
      const familyJP = 'ハマキガ科';
      const sciName = buildScientificName(g || genus, species, author, year);
      const newRow = {
        insect_id: insectId,
        family: familyLatin,
        family_jp: familyJP,
        subfamily: subfamilyLatin,
        subfamily_jp: subfamilyJP,
        tribe: tribeLatin,
        tribe_jp: tribeJP,
        genus: g || genus,
        subgenus: '',
        species: species || '',
        subspecies: '',
        author: author || '',
        year: year || '',
        japanese_name: japanese,
        old_japanese_name: '',
        alternative_name: '',
        other_names: '',
        scientific_name: sciName,
        synonyms: '',
        changes_since_standard: '',
        notes: ''
      };
      insectsPub.push(newRow);
      insectsNorm.push(newRow);
      byBinomial.set(bin, insectId);
      if (japanese) byJapanese.set(japanese, insectId);
      addedInsects++;
    }

    // 食草 -> hostplants
    const plants = parseHostPlants(hostText);
    const { plant_part, life_stage } = inferPartAndStage(hostNote);
    for (const p of plants) {
      const recId = nextHostplantId(hostsPub);
      const base = {
        record_id: recId,
        insect_id: insectId,
        plant_name: p.plant_name,
        plant_family: p.plant_family,
        observation_type: /オーストラリア|ヨーロッパ|ロシア|海外/.test(hostText) ? '文献（海外）' : '野外（国内）',
        plant_part: plant_part || '葉',
        life_stage: life_stage || (hostNote ? '幼虫' : ''),
        reference: REF,
        notes: hostNote || ''
      };
      hostsPub.push(base);
      hostsNorm.push(base);
      addedHosts++;
    }

    // 出現時期・生態情報 -> general_notes
    if (adult) {
      const recId = nextNoteId(notesPub);
      const rowN = { record_id: recId, insect_id: insectId, note_type: '出現時期', content: adult, reference: REF, page: '', year: '' };
      notesPub.push(rowN); notesNorm.push(rowN); addedNotes++;
    }
    if (adultNote) {
      const recId = nextNoteId(notesPub);
      const rowN = { record_id: recId, insect_id: insectId, note_type: '出現時期', content: adultNote, reference: REF, page: '', year: '' };
      notesPub.push(rowN); notesNorm.push(rowN); addedNotes++;
    }
    if (hostNote) {
      const recId = nextNoteId(notesPub);
      const rowN = { record_id: recId, insect_id: insectId, note_type: '生態情報', content: hostNote, reference: REF, page: '', year: '' };
      notesPub.push(rowN); notesNorm.push(rowN); addedNotes++;
    }
  }

  // 保存
  writeCSV(INSECTS_PUB, insectsPub);
  writeCSV(INSECTS_NORM, insectsNorm);
  writeCSV(HOSTPLANTS_PUB, hostsPub);
  writeCSV(HOSTPLANTS_NORM, hostsNorm);
  writeCSV(NOTES_PUB, notesPub);
  writeCSV(NOTES_NORM, notesNorm);

  console.log(`Added insects: ${addedInsects}`);
  console.log(`Added hostplants: ${addedHosts}`);
  console.log(`Added notes: ${addedNotes}`);
}

main();

