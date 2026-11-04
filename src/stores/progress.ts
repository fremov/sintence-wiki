import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'wiki.progress'

function load(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Прогресс лесенки задач: отметки живут в localStorage этого браузера.
export const useProgress = defineStore('progress', () => {
  const done = ref<Record<string, boolean>>(load())
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(done.value))
    } catch {
      /* ignore */
    }
  }
  const key = (slug: string, n: number) => `${slug}:${n}`
  const isDone = (slug: string, n: number) => !!done.value[key(slug, n)]
  const set = (slug: string, n: number, v: boolean) => {
    if (v) done.value[key(slug, n)] = true
    else delete done.value[key(slug, n)]
    save()
  }
  const count = (slug: string) => Object.keys(done.value).filter((k) => k.startsWith(slug + ':')).length
  return { done, isDone, set, count }
})
