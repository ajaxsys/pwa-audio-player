import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5175,
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
