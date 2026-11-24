import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend has no CORS middleware, so the dev server proxies /api to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:5000' },
  },
});
