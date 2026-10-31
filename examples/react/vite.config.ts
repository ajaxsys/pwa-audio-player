import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
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
