import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { earlyRouteResourcesPlugin } from './scripts/lib/earlyRouteResources.mjs';

const appBuildId = process.env.GITHUB_SHA?.slice(0, 12) || String(Date.now());
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // earlyRouteResourcesPlugin: 起動直後に読むデータ（manifest・トップの最初の48件）を HTML の時点で先読みさせる
  plugins: [react(), earlyRouteResourcesPlugin({ appBuildId, rootDir })],
  base: '/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // 大きな依存をvendorチャンクへ分離し、アプリ更新時もライブラリ側の
        // ブラウザキャッシュが効くようにする（初回・再訪のダウンロード量削減）
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-force-graph') || id.includes('force-graph') || id.includes('/d3-')) {
            return 'vendor-graph';
          }
          if (id.includes('papaparse')) {
            return 'vendor-csv';
          }
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('react-router')
          ) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
});
