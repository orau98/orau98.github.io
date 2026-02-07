import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildInsectPath } from '../utils/insectSlug';
import { makeDetailLinkState } from '../utils/navState';
import ImageWithFallback from './ImageWithFallback';
import useInsectImageCandidates from '../hooks/useInsectImageCandidates';

const InsectCarousel = ({ insects, title, type = 'default' }) => {
  const location = useLocation();
  const { placeholderSrc, getImageCandidates } = useInsectImageCandidates({
    useAssetVersionInProd: true,
  });

  if (!insects || insects.length === 0) return null;

  return (
    <div className="mt-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-slate-700/50 overflow-hidden">
      <div className="p-4 bg-indigo-500/10 dark:bg-indigo-500/20 border-b border-indigo-200/30 dark:border-indigo-700/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {title}
          </h2>
        </div>
      </div>
      
      <div className="p-4">
        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-indigo-100 dark:scrollbar-thumb-indigo-600 dark:scrollbar-track-indigo-900/20">
          <div className="flex space-x-4 min-w-max">
            {insects.map(insect => {
              return (
                <Link
                  key={insect.id}
                  to={buildInsectPath(insect)}
                  state={makeDetailLinkState(location)}
                  className="flex-shrink-0 w-48 group"
                >
                    <div className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02] ${
                      insect.type === 'moth' ? 'border-blue-300 dark:border-blue-600 group-hover:border-blue-500 dark:group-hover:border-blue-400' :
                      insect.type === 'butterfly' ? 'border-pink-300 dark:border-pink-600 group-hover:border-pink-500 dark:group-hover:border-pink-400' :
                      insect.type === 'beetle' ? 'border-green-300 dark:border-green-600 group-hover:border-green-500 dark:group-hover:border-green-400' :
                      insect.type === 'longhornbeetle' ? 'border-teal-300 dark:border-teal-600 group-hover:border-teal-500 dark:group-hover:border-teal-400' :
                      'border-amber-300 dark:border-amber-600 group-hover:border-amber-500 dark:group-hover:border-amber-400'
                  }`}>
                    <div className="relative w-full aspect-[3/2] overflow-hidden">
                      {(() => {
                        const candidates = getImageCandidates(insect);
                        const primarySrc = candidates[0] || placeholderSrc;
                        return (
                          <ImageWithFallback
                            src={primarySrc}
                            candidates={candidates.slice(1)}
                            fallbackSrc={placeholderSrc}
                            alt={`${insect.name}の写真`}
                            width="400"
                            height="300"
                            className="w-full h-full"
                            imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                            fit="cover"
                            loading="lazy"
                            decoding="async"
                          />
                        );
                      })()}
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
                        <h5 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-lg">
                          {insect.name}
                        </h5>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsectCarousel;
