import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './server/index.js';

// /api/* 는 server/ 폴더가 처리한다 (server/index.js 참고)
// BK_CACHE: 여러 개발 서버를 동시에 띄울 때 캐시 폴더가 겹치지 않게 한다
export default defineConfig({
  // 공개 사이트의 하위 폴더(예: https://이름.github.io/bangkkumi/)에서도 열리도록 주소를 상대 경로로 만든다
  base: './',
  build: { rollupOptions: { input: ['index.html', 'home.html'] } }, // 집 전체 꾸미기 화면도 함께 만든다
  plugins: [react(), apiPlugin],
  cacheDir: process.env.BK_CACHE || 'node_modules/.vite',
});
