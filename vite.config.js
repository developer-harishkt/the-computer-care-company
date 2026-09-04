import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        v1: resolve(import.meta.dirname, 'index_v1.html'),
        dual_tone: resolve(import.meta.dirname, 'dual_tone.html'),
        saas: resolve(import.meta.dirname, 'saas.html'),
        nordic: resolve(import.meta.dirname, 'nordic.html'),
      },
    },
  },
});
