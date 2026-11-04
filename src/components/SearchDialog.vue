<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { search } from '../lib/search'

const open = defineModel<boolean>('open', { default: false })
const router = useRouter()
const q = ref('')
const idx = ref(0)
const input = ref<HTMLInputElement | null>(null)

const results = computed(() => (q.value.trim().length >= 2 ? search(q.value.trim()) : []))
watch(q, () => (idx.value = 0))
watch(open, async (v) => {
  if (v) {
    q.value = ''
    await nextTick()
    input.value?.focus()
  }
})

function go(i: number) {
  const r = results.value[i]
  if (!r) return
  router.push({ path: `/${r.slug}`, query: r.id ? { h: r.id } : {} })
  open.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    idx.value = Math.min(idx.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    idx.value = Math.max(idx.value - 1, 0)
  } else if (e.key === 'Enter') go(idx.value)
  else if (e.key === 'Escape') open.value = false
}

const snippet = (t: string) => (t.length > 140 ? t.slice(0, 140) + '…' : t)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" @click.self="open = false">
    <div class="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <input
        ref="input"
        v-model="q"
        type="text"
        placeholder="Поиск по вики: ASan, lockfile, kApiVersion…"
        class="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-base outline-none dark:border-slate-700"
        @keydown="onKey"
      />
      <ul v-if="results.length" class="max-h-[50vh] overflow-y-auto p-2">
        <li v-for="(r, i) in results" :key="i">
          <button
            class="w-full rounded-lg px-3 py-2 text-left"
            :class="i === idx ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''"
            @mouseenter="idx = i"
            @click="go(i)"
          >
            <div class="text-sm font-medium">
              {{ r.heading }} <span class="text-xs font-normal text-slate-400">· {{ r.page }}</span>
            </div>
            <div class="mt-0.5 text-xs text-slate-500">{{ snippet(r.text) }}</div>
          </button>
        </li>
      </ul>
      <p v-else class="px-4 py-6 text-center text-sm text-slate-400">
        {{ q.trim().length < 2 ? 'Введи хотя бы два символа' : 'Ничего не найдено' }}
      </p>
    </div>
  </div>
</template>
