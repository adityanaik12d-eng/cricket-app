import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = process.env.BACKEND_PORT || '3333';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8133,
    host: '127.0.0.1',
    proxy: {
      '/matches': { target: `http://localhost:${backend}`, changeOrigin: true, secure: false },
      '/auth': { target: `http://localhost:${backend}`, changeOrigin: true, secure: false },
      '/healthz': { target: `http://localhost:${backend}`, changeOrigin: true, secure: false },
    },
  },
});
