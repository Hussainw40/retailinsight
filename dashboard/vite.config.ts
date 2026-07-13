import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local `npm run dev`, proxy API calls to the running services so the
// dev server behaves like the nginx reverse proxy used in production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/ai': { target: 'http://localhost:3003', changeOrigin: true, rewrite: (p) => p.replace(/^\/ai/, '') },
    },
  },
});
