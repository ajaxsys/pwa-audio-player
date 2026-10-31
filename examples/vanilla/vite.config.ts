import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  server: {
    port: 5173,
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
