import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true
      }
    })
  ],
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
