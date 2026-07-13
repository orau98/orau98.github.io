import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExplorerDetailContext,
  buildExplorerListPath,
} from '../src/utils/navState.js';

test('suggestion return path preserves filters and the current typed query', () => {
  const returnPath = buildExplorerListPath({
    pathname: '/en/',
    searchParams: 'tab=insects&classification=Lepidoptera&page=3&q=old',
    activeTab: 'plants',
    searchTerm: 'Quercus serrata',
  });
  const url = new URL(returnPath, 'https://example.test');

  assert.equal(url.pathname, '/en/');
  assert.equal(url.searchParams.get('tab'), 'plants');
  assert.equal(url.searchParams.get('q'), 'Quercus serrata');
  assert.equal(url.searchParams.get('classification'), 'Lepidoptera');
  assert.equal(url.searchParams.get('page'), '3');
});

test('empty suggestion query is removed from the restored list URL', () => {
  assert.equal(
    buildExplorerListPath({
      pathname: '/',
      searchParams: 'tab=plants&q=old',
      activeTab: 'insects',
      searchTerm: '',
    }),
    '/?tab=insects',
  );
});

test('suggestion detail context restores the same list for browser and in-page back actions', () => {
  const context = buildExplorerDetailContext({
    pathname: '/',
    searchParams: 'tab=insects&image=with-photo',
    activeTab: 'insects',
    searchTerm: 'アオアツバ',
    targetPath: '/moth/species-5155',
    scrollY: 742,
    timestamp: 123456,
  });

  assert.equal(context.returnPath, '/?tab=insects&image=with-photo&q=%E3%82%A2%E3%82%AA%E3%82%A2%E3%83%84%E3%83%90');
  assert.deepEqual(context.navigationState, {
    from: context.returnPath,
    fromList: context.returnPath,
  });
  assert.deepEqual(context.scrollRestore, {
    y: 742,
    tab: 'insects',
    from: context.returnPath,
    to: '/moth/species-5155',
    ts: 123456,
  });
});
