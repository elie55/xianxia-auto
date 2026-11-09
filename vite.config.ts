import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { fileURLToPath, URL } from 'node:url';
import { devAssetInbox } from './scripts/dev-asset-inbox';

export default defineConfig({
  // Relative base so the same build works in Electron (file://) and Capacitor.
  base: './',
  plugins: [preact(), devAssetInbox(fileURLToPath(new URL('.', import.meta.url)))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    // Let the AutoSprite web app POST generated sheets into the dev asset inbox (scripts/dev-asset-inbox.ts).
    cors: { origin: ['https://www.autosprite.io', 'http://localhost:5173', 'http://127.0.0.1:5173'], preflightContinue: true },
    // electron-builder writes locked binaries into release/ while the dev server runs; don't watch build outputs.
    watch: { ignored: ['**/release/**', '**/dist/**', '**/.autosprite-inbox/**', '**/reference/**'] },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js', 'pixi-filters'],
          vendor: ['preact', '@preact/signals', 'gsap', 'howler'],
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
