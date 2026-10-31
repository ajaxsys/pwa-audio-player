import { defineConfig } from 'vite';
import { qrcode } from 'vite-plugin-qrcode';
import path from 'node:path';

export default defineConfig({
  plugins: [qrcode()],
  server: {
    port: 5173,
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
