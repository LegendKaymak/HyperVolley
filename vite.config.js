import { defineConfig } from 'vite';

// base: './' → build çıktısı göreli yollarla üretilir; böylece hem Netlify'da
// kök dizinde hem de GitHub Pages'te alt klasörde (kullanici.github.io/repo/) çalışır.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
