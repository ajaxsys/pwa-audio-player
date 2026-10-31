import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { qrcode } from 'vite-plugin-qrcode';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), qrcode()],
  server: {
    port: 5174,
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
