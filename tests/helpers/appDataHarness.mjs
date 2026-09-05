import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { INSECT_COLLECTION_KEYS } from '../../src/utils/siteTaxonomy.js';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const fixtureData = {
  ...Object.fromEntries(INSECT_COLLECTION_KEYS.map((key) => [key, [{ id: key, name: key }]])),
  hostPlants: { テスト植物: [...INSECT_COLLECTION_KEYS] },
  flowerVisitPlants: { 花: ['moths'] },
  plantDetails: { テスト植物: { family: 'ブナ科' } },
};
const counts = { ...Object.fromEntries(INSECT_COLLECTION_KEYS.map((key) => [key, 1])), hostPlants: 1 };
const files = new Map([
  ['manifest.json', { version: 'fixture-v1', counts }],
  ['full-dataset.json', { ...fixtureData, summaryCounts: counts, version: 'fixture-v1' }],
  ['index.json', fixtureData],
  ['hostplants.json', fixtureData.hostPlants],
  ['plant-details.json', fixtureData.plantDetails],
  ['flower-visit-plants.json', fixtureData.flowerVisitPlants],
  ...INSECT_COLLECTION_KEYS.flatMap((key) => [
    [key + '.json', fixtureData[key]],
    ['catalog/' + key + '.json', fixtureData[key].map((row) => ({ ...row, _detail: false }))],
  ]),
]);
// Execute the actual App effects and loader. Only rendering boundaries, browser
// APIs and network/cache transport are mocked; route planning is not stubbed.
export async function createAppHarness(initialPath, { failedFiles = [], cache = null, pausedFiles = [], filePayloads = files } = {}) {
  const hooks = [];
  let index = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const requests = [];
  const failed = new Set(failedFiles);
  const paused = new Set(pausedFiles);
  const releases = new Map();
  const cleanups = [];
  const location = { pathname: initialPath, search: '', hash: '', key: '1' };
  const noop = () => {};
  const state = {
    location,
    cache,
    React: {
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      Suspense: 'Suspense',
      useState(initial) {
        const n = index++;
        if (!(n in hooks)) hooks[n] = typeof initial === 'function' ? initial() : initial;
        return [hooks[n], (next) => {
          const value = typeof next === 'function' ? next(hooks[n]) : next;
          if (!Object.is(value, hooks[n])) { hooks[n] = value; dirty = true; }
        }];
      },
      useRef(initial) {
        const n = index++;
        if (!(n in hooks)) hooks[n] = { current: initial };
        return hooks[n];
      },
      useEffect(effect, deps) {
        const n = index++;
        const prev = hooks[n];
        if (!prev || !deps || deps.some((x, k) => !Object.is(x, prev.deps[k]))) {
          const entry = { deps, cleanup: null };
          hooks[n] = entry;
          effects.push(() => {
            prev?.cleanup?.();
            if (prev) prev.cleanup = null;
            entry.cleanup = effect();
            return () => { entry.cleanup?.(); entry.cleanup = null; };
          });
        }
      },
    },
    async fetch(url) {
      const relative = new URL(url, 'https://test.local').pathname.replace(/^\//, '');
      requests.push(relative);
      const file = relative.replace('assets/data-lite/', '');
      if (paused.has(file)) await new Promise((resolve) => releases.set(file, resolve));
      if (failed.has(file) || failed.has(path.basename(relative))) return { ok: false, status: 404 };
      const data = filePayloads.get(file);
      return data === undefined ? { ok: false, status: 404 }
        : { ok: true, status: 200, json: async () => structuredClone(data) };
    },
  };
  const exact = {
    react: 'const R=globalThis.PROBE.React; export default R; export const {useState,useEffect,useRef}=R;',
    'react-router-dom': 'export const Routes="Routes", Route="Route"; export const matchPath=()=>null; export const useLocation=()=>globalThis.PROBE.location; export const useNavigationType=()=>"POP";',
    './utils/logger': 'export default {debug(){},warn(){},error(){}};',
    './utils/lazyWithRetry': 'export default function lazy(){return "LazyComponent"}',
    './services/datasetCache': 'export const loadDatasetFromCache=async()=>globalThis.PROBE.cache; export const saveDatasetToCache=async()=>{};',
    './utils/plantMetadata': 'export const shouldDeferHeavyWork=()=>true;',
    './services/imageIndex': 'export const loadInsectImageIndexes=async()=>{};',
    './utils/fetchWithRetry': 'export default (...args)=>globalThis.PROBE.fetch(...args);',
    './utils/robotsMeta': 'export const INDEX_FOLLOW_ROBOTS="index",NOINDEX_FOLLOW_ROBOTS="noindex";export const setRobotsMetaContent=()=>{};',
    './utils/sectionNavigation': 'export const buildCurrentHashHref=()=>"#main-content"; export const findSectionTarget=()=>null,isVisibleSectionTarget=()=>false,scrollElementWithOffset=()=>{};',
    './utils/staticDocumentPaths': 'export const isStaticDocumentPath=()=>false;',
    './utils/explorerQueryParams': 'export const hasExplorerResultQuery=()=>false;',
  };
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/App.jsx')], bundle: true, write: false,
    platform: 'node', format: 'cjs', logLevel: 'silent',
    define: {'import.meta.env.DEV':'false','import.meta.env.PROD':'true','import.meta.env.BASE_URL':'"/"','__APP_BUILD_ID__':'"probe"'},
    plugins: [{name:'probe-boundaries', setup(build) {
      build.onResolve({filter: /.*/}, args => {
        if (exact[args.path]) return {path: args.path, namespace:'stub'};
        if (args.importer === path.join(ROOT,'src/App.jsx') && (args.path.includes('/components/') || args.kind === 'dynamic-import')) {
          return {path:args.path,namespace:'stub'};
        }
      });
      build.onLoad({filter:/.*/,namespace:'stub'}, args => ({contents: exact[args.path] || 'export default "Component"; export const DetailSkeleton="DetailSkeleton";'}));
    }}],
  });
  const context = {
    PROBE: state, module: {exports:{}}, exports: {}, console, URLSearchParams, AbortController,
    setTimeout: () => 1, clearTimeout: noop,
    localStorage: {getItem:()=>null,setItem:noop}, sessionStorage:{getItem:()=>null,setItem:noop},
    document:{body:{classList:{add:noop,remove:noop}},documentElement:{classList:{add:noop,remove:noop},style:{}},getElementById:()=>null},
    window:{location,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),addEventListener:noop,removeEventListener:noop,setTimeout:()=>1,clearTimeout:noop,requestIdleCallback:()=>1,cancelIdleCallback:noop,scrollTo:noop},
  };
  context.exports=context.module.exports;
  vm.createContext(context);
  vm.runInContext(result.outputFiles[0].text, context);
  const App=context.module.exports.default;
  async function settle() {
    for(let turn=0;turn<30;turn++) {
      if(dirty) {dirty=false;index=0;tree=App();const work=effects;effects=[];work.forEach(fn=>{const cleanup=fn();if(typeof cleanup==="function")cleanups.push(cleanup);});}
      await new Promise(resolve=>setImmediate(resolve));
    }
  }
  function nodes(node, out=[]) {
    if(Array.isArray(node)) node.forEach(x=>nodes(x,out));
    else if(node && typeof node==='object') {out.push(node);nodes(node.children,out);}
    return out;
  }
  const route = (pathname) => nodes(tree).find((node) => node.props.path === pathname)
    ?.props.element.children[0].children[0].props;
  await settle();
  return {
    requests, failed, route, settle,
    hasAlert: () => nodes(tree).some((node) => node.props.role === 'alert'),
    async retry() {
      const button = nodes(tree).find((node) => node.type === 'button' && node.children.includes('再読み込み'));
      if (!button) throw new Error('Retry button not rendered');
      button.props.onClick();
      await settle();
    },
    release(file) { paused.delete(file); releases.get(file)?.(); },
    dispose() { cleanups.forEach((cleanup) => cleanup()); },
    async navigate(url) {
      state.location = { ...state.location, pathname: url, key: String(Number(state.location.key) + 1) };
      context.window.location = state.location;
      dirty = true;
      await settle();
    },
  };
}
