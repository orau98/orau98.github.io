
import React from 'react';

const SkeletonCard = () => (
  <div className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-xl shadow-lg animate-pulse">
    <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-6"></div>
    <div className="space-y-4">
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/6"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
    </div>
  </div>
);

const SkeletonLoader = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
};

export default SkeletonLoader;
