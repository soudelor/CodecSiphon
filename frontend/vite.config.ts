import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version ?? '0.0.0'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    /** 允许局域网 IP 访问 dev；配合下方 proxy 避免 CORS 导致验证码等接口失败 */
    host: true,
    proxy: {
      '/auth': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/tasks': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/settings': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/subscriptions': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/url-extract': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
});
