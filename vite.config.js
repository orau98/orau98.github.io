import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // Allow overriding base path for GitHub Pages project sites.
  // Example: set VITE_BASE_PATH="/insects-host-plant-explorer/" for deployment under a subpath.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    headers: {
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('papaparse')) return 'vendor-papaparse';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          }
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return `assets/[name]-[hash].css`;
          }
          return `assets/[name]-[hash].[ext]`;
        },
      },
    },
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // Avoid identifier minification to prevent TDZ collisions on Pages
    minifyIdentifiers: false
  }
}))
