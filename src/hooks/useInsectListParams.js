import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { INSECT_SECTION_CONFIGS } from '../utils/siteTaxonomy';

// 昆虫一覧のURLクエリ（i*系パラメータと q / classification）の
// 読み取り・更新を集約するフック。
// 内容フィルタ・並び替え・ページ送りなどユーザーの明示的操作は push で
// ブラウザ履歴に積み（＝「戻る」で直前の絞り込み状態に戻せる）、
// 逐次検索・プログラム的リセット・表示専用の切替は replace で履歴を汚さない。
export default function useInsectListParams({ perPageOptions = [20, 50, 100] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // push:true でブラウザ履歴に積む。既定は replace。
  const updateSearchParams = useCallback((mutate, { push = false } = {}) => {
    let next;
    try {
      next = new URLSearchParams(window.location.search || '');
    } catch {
      next = new URLSearchParams(searchParams);
    }
    try {
      mutate(next);
    } catch {}
    setSearchParams(next, { replace: !push });
  }, [searchParams, setSearchParams]);

  const currentPage = useMemo(() => {
    const raw = searchParams.get('ipage');
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [searchParams]);

  const hostFilter = useMemo(() => {
    const v = (searchParams.get('ihost') || '').toLowerCase();
    return v === 'has' || v === 'none' ? v : 'all';
  }, [searchParams]);
  const familyFilter = useMemo(() => searchParams.get('ifamily') || '', [searchParams]);
  const genusFilter = useMemo(() => searchParams.get('igenus') || '', [searchParams]);
  const emergenceFilter = useMemo(() => searchParams.get('imonth') || '', [searchParams]);
  const seasonFilter = useMemo(() => {
    const v = (searchParams.get('iseason') || '').toLowerCase();
    return ['spring', 'summer', 'autumn', 'winter'].includes(v) ? v : '';
  }, [searchParams]);
  const photoFilter = useMemo(() => (searchParams.get('iphoto') === 'has' ? 'has' : 'all'), [searchParams]);
  // 昆虫グループ（蛾/蝶/タマムシ/カミキリムシ/ハムシ/アブラムシ）のワンタップ絞り込み
  const groupFilter = useMemo(() => {
    const v = (searchParams.get('igroup') || '').toLowerCase();
    return INSECT_SECTION_CONFIGS.some((section) => section.type === v) ? v : '';
  }, [searchParams]);
  const viewMode = useMemo(() => (searchParams.get('iview') === 'compact' ? 'compact' : 'cards'), [searchParams]);
  const sortMode = useMemo(() => {
    const v = searchParams.get('isort') || 'image';
    return ['image', 'name', 'family', 'plantCount', 'season'].includes(v) ? v : 'image';
  }, [searchParams]);
  const requestedItemsPerPage = useMemo(() => {
    const n = parseInt(searchParams.get('iper') || '', 10);
    return perPageOptions.includes(n) ? n : null;
  }, [searchParams, perPageOptions]);

  // ユーザーのページ送りは push（戻るで前ページへ）、フィルタ変更に伴う
  // 自動リセット setIPage(1) は replace（履歴を増やさない）。
  const setIPage = useCallback((page, opts) => {
    updateSearchParams((p) => {
      const n = parseInt(page, 10);
      if (Number.isFinite(n) && n > 1) p.set('ipage', String(n));
      else p.delete('ipage');
    }, opts);
  }, [updateSearchParams]);

  const setIHostFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').toLowerCase();
      if (v === 'has' || v === 'none') p.set('ihost', v);
      else p.delete('ihost');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIFamilyFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('ifamily', v);
      else p.delete('ifamily');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIGenusFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('igenus', v);
      else p.delete('igenus');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIEmergenceFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (v) p.set('imonth', v);
      else p.delete('imonth');
      p.delete('iseason');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setISeasonFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').trim();
      if (['spring', 'summer', 'autumn', 'winter'].includes(v)) p.set('iseason', v);
      else p.delete('iseason');
      p.delete('imonth');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIPhotoFilter = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'has') p.set('iphoto', 'has');
      else p.delete('iphoto');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIGroupFilter = useCallback((value) => {
    updateSearchParams((p) => {
      const v = (value || '').toLowerCase();
      if (INSECT_SECTION_CONFIGS.some((section) => section.type === v)) p.set('igroup', v);
      else p.delete('igroup');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIViewMode = useCallback((value) => {
    updateSearchParams((p) => {
      if (value === 'compact') p.set('iview', 'compact');
      else p.delete('iview');
    });
  }, [updateSearchParams]);

  const setISortMode = useCallback((value) => {
    updateSearchParams((p) => {
      if (value && value !== 'image') p.set('isort', value);
      else p.delete('isort');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const setIItemsPerPage = useCallback((value) => {
    updateSearchParams((p) => {
      const n = parseInt(value, 10);
      if (perPageOptions.includes(n)) p.set('iper', String(n));
      else p.delete('iper');
      p.delete('ipage');
    });
  }, [updateSearchParams, perPageOptions]);

  const clearClassification = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('classification');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const clearFilters = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('ihost');
      p.delete('ifamily');
      p.delete('igenus');
      p.delete('imonth');
      p.delete('iseason');
      p.delete('iphoto');
      p.delete('classification');
      p.delete('ipage');
    }, { push: true });
  }, [updateSearchParams]);

  const clearSearch = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('q');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const resetAll = useCallback(() => {
    updateSearchParams((p) => {
      p.delete('ihost');
      p.delete('ifamily');
      p.delete('igenus');
      p.delete('imonth');
      p.delete('iseason');
      p.delete('iphoto');
      p.delete('igroup');
      p.delete('classification');
      p.delete('q');
      p.delete('ipage');
    });
  }, [updateSearchParams]);

  const classificationFilter = searchParams.get('classification');
  const searchQuery = useMemo(() => (searchParams.get('q') || '').trim(), [searchParams]);

  return {
    searchParams,
    updateSearchParams,
    currentPage,
    hostFilter,
    familyFilter,
    genusFilter,
    emergenceFilter,
    seasonFilter,
    photoFilter,
    groupFilter,
    viewMode,
    sortMode,
    requestedItemsPerPage,
    classificationFilter,
    searchQuery,
    setIPage,
    setIHostFilter,
    setIFamilyFilter,
    setIGenusFilter,
    setIEmergenceFilter,
    setISeasonFilter,
    setIPhotoFilter,
    setIGroupFilter,
    setIViewMode,
    setISortMode,
    setIItemsPerPage,
    clearClassification,
    clearFilters,
    clearSearch,
    resetAll,
  };
}
