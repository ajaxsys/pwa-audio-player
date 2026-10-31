import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { qrcode } from 'vite-plugin-qrcode';
import path from 'node:path';

export default defineConfig({
  plugins: [vue(), qrcode()],
  server: {
    port: 5175,
    host: true,
    fs: {
      allow: ['../..']
    }
  },
  resolve: {
    alias: {
      '/demo-assets': path.resolve(__dirname, '../../demo-assets')
    }
  }
});
