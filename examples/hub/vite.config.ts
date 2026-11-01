import { defineConfig } from 'vite';
import { qrcode } from 'vite-plugin-qrcode';

export default defineConfig({
  base: './',
  plugins: [qrcode()],
  server: {
    port: 5170,
    host: true
  }
});
