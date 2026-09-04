import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildInsectPath } from '../utils/insectSlug';
import { isEnglishLocale } from '../utils/locale';
import { makeDetailLinkState } from '../utils/navState';
import { buildPlantPath } from '../utils/siteTaxonomy';
import { buildJapaneseReferenceLabel, getPrimaryEnglishName } from '../utils/englishNaming';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import ImageWithFallback from './ImageWithFallback';
import { resolvePlaceholderSubject } from '../utils/placeholderSubject';
import useInsectImageCandidates from '../hooks/useInsectImageCandidates';

const RelatedInsectsSection = ({ relatedMothsByPlant, allInsects, locale = 'ja', plantDetails = {} }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  // 各植物の展開状態を管理
  const [expandedPlants, setExpandedPlants] = useState(new Set());
  
  // 植物の展開状態をトグル
  const togglePlantExpansion = (plant) => {
    const newExpanded = new Set(expandedPlants);
    if (newExpanded.has(plant)) {
      newExpanded.delete(plant);
    } else {
      newExpanded.add(plant);
    }
    setExpandedPlants(newExpanded);
  };
  
  // 折りたたみ時に表示する写真カード数（モバイル2列×3行）。
  // 横スクロールはモバイルで操作しづらいため使わず、常に折り返しグリッドで表示する
  const COLLAPSED_PHOTO_COUNT = 6;

  // 写真なしチップの種別ドット色（写真カードの枠色と同じ系統で揃える）
  const typeDotClass = (type) => (
    type === 'moth' ? 'bg-blue-400' :
    type === 'butterfly' ? 'bg-pink-400' :
    type === 'beetle' ? 'bg-emerald-400' :
    type === 'longhornbeetle' ? 'bg-teal-400' :
    type === 'barkbeetle' ? 'bg-stone-500' :
    'bg-amber-400'
  );

  const { placeholderSrc, getImageCandidates } = useInsectImageCandidates();

  if (Object.keys(relatedMothsByPlant).length === 0) {
    return null;
  }

  return (
    <div className="related-insects-section bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/70 dark:border-slate-700/50 overflow-hidden">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 border-b border-blue-200/30 dark:border-blue-700/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {isEnglish ? 'Insects sharing the same host plant' : '同じ食草の昆虫'}
          </h2>
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        {Object.entries(relatedMothsByPlant).map(([plant, relatedMothNames]) => {
          // 写真あり種はカード、写真なし種はコンパクトなチップに分ける
          // （写真なしの大きな空カードが並ぶのを避ける）
          const resolvedInsects = relatedMothNames
            .map((name) => {
              let insect = allInsects.find((m) => m.name === name);
              if (!insect) {
                const alt = name.replace(/類$/, '');
                insect = allInsects.find((m) => m.name === alt);
              }
              if (!insect) return null;
              const candidates = getImageCandidates(insect);
              return { name, insect, candidates, hasImage: candidates.length > 0 };
            })
            .filter(Boolean);
          const withPhoto = resolvedInsects.filter((r) => r.hasImage);
          const withoutPhoto = resolvedInsects.filter((r) => !r.hasImage);

          const isExpanded = expandedPlants.has(plant);
          const displayCount = isExpanded ? withPhoto.length : COLLAPSED_PHOTO_COUNT;
          const hiddenPhotoCount = Math.max(0, withPhoto.length - COLLAPSED_PHOTO_COUNT);
          const showExpandButton = hiddenPhotoCount > 0;
          // 英語版では植物チップも学名を優先する（昆虫名だけ英語化されて和名が混在しないように）
          const plantScientificName = plantDetails?.[plant]?.scientificName || '';
          const plantLabel = isEnglish
            ? getPrimaryEnglishName({
                scientificName: plantScientificName,
                japaneseName: plant,
                fallback: plant,
              })
            : plant;

          return (
            <div key={plant} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link
                    to={buildPlantPath(plant, locale)}
                    state={makeDetailLinkState(location)}
                    className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all duration-200 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-300 dark:hover:border-emerald-600"
                  >
                    {isEnglish && plantScientificName
                      ? formatScientificNameReact(plantLabel)
                      : plantLabel}
                  </Link>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {/* 「20種」なのにカードが数枚だと混乱するため、写真あり件数を分けて明示する */}
                    {withPhoto.length > 0 && withoutPhoto.length > 0
                      ? (isEnglish
                        ? `(${relatedMothNames.length} species, ${withPhoto.length} with photos)`
                        : `(全${relatedMothNames.length}種・写真あり${withPhoto.length}種)`)
                      : (isEnglish ? `(${relatedMothNames.length} species)` : `(${relatedMothNames.length}種)`)}
                  </span>
                </div>
                
                {/* 展開/折りたたみボタン */}
                {showExpandButton && (
                  <button
                    onClick={() => togglePlantExpansion(plant)}
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200"
                  >
                    <span>
                      {isExpanded
                        ? (isEnglish ? 'Show less' : '少なく表示')
                        : (isEnglish ? `Show ${hiddenPhotoCount} more` : `残り${hiddenPhotoCount}種を表示`)}
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            
            {/* 写真あり種: コンテナ幅に自動追従する折り返しグリッド。
                この列は写真パネル有無で幅が大きく変わる（狭いサイド列⇔全幅）ため、
                ビューポート基準のbreakpointではなくauto-fillでカード幅を一定に保つ。
                横スクロールはモバイルで操作しづらいため廃止 */}
            {withPhoto.length > 0 && (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                {withPhoto.slice(0, displayCount).map(({ name: relatedMothName, insect: relatedMoth, candidates }) => {
                  const primaryName = isEnglish
                    ? getPrimaryEnglishName({
                        scientificName: relatedMoth.scientificName,
                        japaneseName: relatedMothName,
                        fallback: relatedMothName,
                      })
                    : relatedMothName;
                  const secondaryName = isEnglish ? buildJapaneseReferenceLabel(relatedMothName) : '';
                  const primarySrc = candidates[0] || placeholderSrc;

                  return (
                    <Link
                      key={relatedMoth.id}
                      to={buildInsectPath(relatedMoth, locale)}
                      state={makeDetailLinkState(location)}
                      className="insect-card group w-full"
                    >
                      <div className={`relative bg-white dark:bg-slate-800 rounded-xl overflow-hidden border shadow-sm transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 ${
                        relatedMoth.type === 'moth' ? 'border-blue-200/60 dark:border-blue-700/60 hover:border-blue-400/80 dark:hover:border-blue-500/80 hover:shadow-blue-500/20' :
                        relatedMoth.type === 'butterfly' ? 'border-pink-200/60 dark:border-pink-700/60 hover:border-pink-400/80 dark:hover:border-pink-500/80 hover:shadow-pink-500/20' :
                        relatedMoth.type === 'beetle' ? 'border-emerald-200/60 dark:border-emerald-700/60 hover:border-emerald-400/80 dark:hover:border-emerald-500/80 hover:shadow-emerald-500/20' :
                        relatedMoth.type === 'longhornbeetle' ? 'border-teal-200/60 dark:border-teal-700/60 hover:border-teal-400/80 dark:hover:border-teal-500/80 hover:shadow-teal-500/20' :
                        relatedMoth.type === 'barkbeetle' ? 'border-stone-200/60 dark:border-stone-700/60 hover:border-stone-400/80 dark:hover:border-stone-500/80 hover:shadow-stone-500/20' :
                        'border-amber-200/60 dark:border-amber-700/60 hover:border-amber-400/80 dark:hover:border-amber-500/80 hover:shadow-amber-500/20'
                      }`}>
                        <div className="relative w-full aspect-[3/2] overflow-hidden">
                          <ImageWithFallback
                            src={primarySrc}
                            candidates={candidates.slice(1)}
                            fallbackSrc={placeholderSrc}
                            subject={resolvePlaceholderSubject(relatedMoth.type)}
                            alt={isEnglish ? `${primaryName} photograph` : `${relatedMothName}（${relatedMoth.scientificName}）の写真`}
                            width="600"
                            height="400"
                            className="w-full h-full"
                            imgClassName="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                            fit="cover"
                            loading="lazy"
                            decoding="async"
                            errorLabel={isEnglish ? 'No image' : '画像なし'}
                          />
                          {/* 画像上に昆虫名をオーバーレイ表示（h5だとh2から見出しレベルが飛ぶため見出しにしない） */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-4">
                            <p className="text-white font-semibold text-xs leading-snug line-clamp-2 drop-shadow-lg">
                              {isEnglish && relatedMoth.scientificName
                                ? formatScientificNameReact(primaryName)
                                : primaryName}
                            </p>
                            {secondaryName && (
                              <p className="mt-0.5 text-[11px] leading-tight text-white/90 line-clamp-1 drop-shadow-lg">
                                {secondaryName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 写真なし種: 大きな空カードの羅列を避けつつ、写真カードと同系統の
                見た目（角丸・枠・種別カラーのドット・ホバー挙動）で統一感を持たせる */}
            {withoutPhoto.length > 0 && (
              <div>
                {withPhoto.length > 0 && (
                  <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {isEnglish ? 'No photo yet:' : '写真未登録:'}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {withoutPhoto.map(({ name: relatedMothName, insect: relatedMoth }) => {
                    const chipName = isEnglish
                      ? getPrimaryEnglishName({
                          scientificName: relatedMoth.scientificName,
                          japaneseName: relatedMothName,
                          fallback: relatedMothName,
                        })
                      : relatedMothName;
                    return (
                      <Link
                        key={relatedMoth.id}
                        to={buildInsectPath(relatedMoth, locale)}
                        state={makeDetailLinkState(location)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                      >
                        <span
                          className={`h-2 w-2 flex-shrink-0 rounded-full ${typeDotClass(relatedMoth.type)}`}
                          aria-hidden="true"
                        />
                        {isEnglish && relatedMoth.scientificName
                          ? formatScientificNameReact(chipName)
                          : chipName}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedInsectsSection;
