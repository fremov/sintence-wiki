import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// base = имя репозитория: сайт живёт на https://<user>.github.io/sintence-wiki/
export default defineConfig({
  base: process.env.WIKI_BASE ?? '/sintence-wiki/',
  plugins: [vue(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1500 },
})
