import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appBuildId = process.env.GITHUB_SHA?.slice(0, 12) || String(Date.now());

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  build: {
    outDir: 'dist',
  },
});
