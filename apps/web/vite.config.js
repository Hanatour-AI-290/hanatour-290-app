import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api 요청은 로컬 api 서버(8787)로 넘긴다
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
