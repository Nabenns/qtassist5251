import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development, the bot's Express server runs on WEB_PORT (default 3000).
// `npm run dev` here serves the SPA on 5173 and proxies /api/* to the bot,
// so cookies stay same-origin from the browser's perspective.
const BOT_API = process.env.VITE_BOT_API || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BOT_API,
        changeOrigin: false,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true
  }
});
