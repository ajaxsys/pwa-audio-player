import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { qrcode } from 'vite-plugin-qrcode';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [svelte(), qrcode()],
  server: {
    port: 5176,
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
