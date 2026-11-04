import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useTheme = defineStore('theme', () => {
  const dark = ref(document.documentElement.classList.contains('dark'))
  watch(dark, (v) => {
    document.documentElement.classList.toggle('dark', v)
    try {
      localStorage.setItem('wiki.theme', v ? 'dark' : 'light')
    } catch {
      /* приватное окно — тема просто не запомнится */
    }
  })
  const toggle = () => {
    dark.value = !dark.value
  }
  return { dark, toggle }
})
