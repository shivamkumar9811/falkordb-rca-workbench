import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      '.preview.emergentagent.com',
      '.preview.emergentcf.cloud',
      'localhost',
      '127.0.0.1',
    ],
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
});
