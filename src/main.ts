import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { initMarkdown } from './lib/markdown'
import './style.css'

// подсветка кода нужна синхронно при рендере страницы — грузим её до старта
await initMarkdown()
createApp(App).use(createPinia()).use(router).mount('#app')
