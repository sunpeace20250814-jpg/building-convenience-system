import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src')
    }
  },
  // ★ Phase 9：移除 optimizeDeps.exclude: ['sql.js']
  //   V4 已不再使用 sql.js WASM（見 ERR-014）
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 9527,
    host: true,
    // ★ 前後端分離：把 /api/* 代理到 Fastify server (port 3001)
    // dev 模式下讓 client fetch('/api/...') 自動打到 :3001
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // ★ preview 模式（生產 build 測試）也加 proxy — vite preview serve SPA 時打 /api 會自動轉 :3001
  // + 強制 no-cache header（避免 Edge HTTP cache 卡住舊 build 阻擋 schema 自動修復）
  preview: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // GitHub Pages 部署時的路徑前綴
  base: './'
});
