<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SidebarNav from './components/SidebarNav.vue'
import SearchDialog from './components/SearchDialog.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const route = useRoute()
const menuOpen = ref(false)
const searchOpen = ref(false)

watch(() => route.fullPath, () => (menuOpen.value = false))

function onKey(e: KeyboardEvent) {
  const typing = (e.target as HTMLElement)?.matches?.('input, textarea')
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchOpen.value = true
  } else if (e.key === '/' && !typing) {
    e.preventDefault()
    searchOpen.value = true
  }
}
window.addEventListener('keydown', onKey)
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
  >
    <div class="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4">
      <button
        class="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Меню"
        @click="menuOpen = !menuOpen"
      >
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
        </svg>
      </button>
      <RouterLink to="/" class="flex items-center gap-2 font-bold tracking-tight">
        <span class="grid size-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">S</span>
        <span>Sintence <span class="font-normal text-slate-500">Wiki</span></span>
      </RouterLink>
      <div class="flex-1" />
      <button
        class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
        @click="searchOpen = true"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" />
        </svg>
        <span class="hidden sm:inline">Поиск</span>
        <kbd class="hidden rounded bg-slate-200 px-1.5 text-[11px] sm:inline dark:bg-slate-700">Ctrl K</kbd>
      </button>
      <ThemeToggle />
    </div>
  </header>

  <div class="mx-auto flex max-w-[90rem] px-4">
    <!-- боковая навигация: на мобильных — выезжающая панель -->
    <aside
      class="fixed inset-y-0 left-0 z-20 w-72 -translate-x-full overflow-y-auto border-r border-slate-200 bg-white px-4 pb-8 pt-20 transition-transform lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100vh-3.5rem)] lg:w-64 lg:shrink-0 lg:translate-x-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-6 dark:border-slate-800 dark:bg-slate-950"
      :class="{ 'translate-x-0': menuOpen }"
    >
      <SidebarNav />
    </aside>
    <div v-if="menuOpen" class="fixed inset-0 z-10 bg-black/40 lg:hidden" @click="menuOpen = false" />

    <main class="min-w-0 flex-1 py-8 lg:pl-10">
      <RouterView />
    </main>
  </div>

  <SearchDialog v-model:open="searchOpen" />
</template>
