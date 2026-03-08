import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: __dirname,
  server: {
    port: 3002,
    proxy: { '/api/': 'http://localhost:19434' },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@plannotator/ui': path.resolve(__dirname, '../../../packages/ui'),
      '@plannotator/editor/styles': path.resolve(__dirname, '../../../packages/editor/index.css'),
    },
  },
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true,
  },
});
