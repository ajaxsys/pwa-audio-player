import { defineConfig } from 'vite';
import { qrcode } from 'vite-plugin-qrcode';

export default defineConfig({
  base: './',
  plugins: [qrcode()],
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ['../..']
    }
  }
});
