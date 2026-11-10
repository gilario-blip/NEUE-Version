import { defineConfig } from 'vite';

// "npm run build" erstellt den Ordner dist/, den Vercel veröffentlicht.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
