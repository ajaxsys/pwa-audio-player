import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { qrcode } from 'vite-plugin-qrcode';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react(), qrcode()],
  server: {
    port: 5174,
    host: true,
    fs: {
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '/_assets': path.resolve(__dirname, '../_assets')
    }
  }
});
