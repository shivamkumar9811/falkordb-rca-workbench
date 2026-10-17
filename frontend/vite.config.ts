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
    allowedHosts: ['agent-orchestra-35.cluster-16.preview.emergentcf.cloud'],
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
});

