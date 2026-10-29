import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: path.resolve(__dirname, '..'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '..') } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '/tmp/ruda-modaui-build',
    emptyOutDir: true,
    copyPublicDir: false,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, '..', 'src', 'apps', 'merchant-admin-mobile', 'main.tsx'),
      formats: ['es'],
      fileName: 'app',
      cssFileName: 'app'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
