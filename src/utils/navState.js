export const buildCurrentPath = (location) => {
  if (!location) return '';
  const pathname = location.pathname || '';
  const search = location.search || '';
  const hash = location.hash || '';
  return `${pathname}${search}${hash}`;
};

// For links that navigate to a detail page:
// - `from`: always points to the current URL (for back/restore)
// - `fromList`: when available, pins the "list page URL" so detail-to-detail
//   navigation still allows "ホームに戻る" to return to the original list state.
export const makeDetailLinkState = (location, { setFromList = false } = {}) => {
  const from = buildCurrentPath(location);
  const existingFromList =
    typeof location?.state?.fromList === 'string' ? location.state.fromList : '';
  const fromList = setFromList ? from : existingFromList;

  const state = { from };
  if (fromList) state.fromList = fromList;
  return state;
};

export const getBackTarget = (location, fallback = '/') => {
  const state = location?.state || {};
  if (typeof state.fromList === 'string' && state.fromList) return state.fromList;
  if (typeof state.from === 'string' && state.from) return state.from;
  return fallback;
};

export const buildExplorerListPath = ({
  pathname = '/',
  searchParams = '',
  activeTab = 'insects',
  searchTerm = '',
} = {}) => {
  const params = new URLSearchParams(searchParams);
  params.set('tab', activeTab === 'plants' ? 'plants' : 'insects');

  const query = String(searchTerm || '');
  if (query) params.set('q', query);
  else params.delete('q');

  const serialized = params.toString();
  return `${pathname || '/'}${serialized ? `?${serialized}` : ''}`;
};

export const buildExplorerDetailContext = ({
  pathname = '/',
  searchParams = '',
  activeTab = 'insects',
  searchTerm = '',
  targetPath = '',
  scrollY = 0,
  timestamp = Date.now(),
} = {}) => {
  const returnPath = buildExplorerListPath({
    pathname,
    searchParams,
    activeTab,
    searchTerm,
  });

  return {
    returnPath,
    navigationState: {
      from: returnPath,
      fromList: returnPath,
    },
    scrollRestore: {
      y: Number.isFinite(Number(scrollY)) ? Number(scrollY) : 0,
      tab: activeTab === 'plants' ? 'plants' : 'insects',
      from: returnPath,
      to: String(targetPath || ''),
      ts: Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now(),
    },
  };
};
