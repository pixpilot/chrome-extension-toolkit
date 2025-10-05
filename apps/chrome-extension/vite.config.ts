import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { getManifest } from './src/manifest';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    emptyOutDir: true,
    outDir: 'build',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
      },
    },
  },
  plugins: [
    tailwindcss(),
    crx({
      manifest: getManifest(mode === 'development'),
      contentScripts: {
        injectCss: true,
      },
    }),
    react(),
  ],
  define: {
    __DEV__: mode === 'development',
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
}));
