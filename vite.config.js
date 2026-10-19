import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        schedule: 'schedule-visit.html',
        privacy: 'privacy.html',
        terms: 'terms.html'
      }
    }
  }
});