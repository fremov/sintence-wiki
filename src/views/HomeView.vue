<script setup lang="ts">
import { computed } from 'vue'
import { groups, pageBySlug, taskCount } from '../lib/pages'
import { useProgress } from '../stores/progress'

const progress = useProgress()
const ladder = pageBySlug('12-pervye-zadachi')!
const total = taskCount(ladder.source)
const done = computed(() => progress.count(ladder.slug))

const facts = [
  { k: 'C++23', v: 'приложение: MSVC, CMake, vcpkg' },
  { k: '4 слоя', v: 'core, data, analysis, app' },
  { k: '3 источника', v: 'игра, клиент League, сервер' },
  { k: '1 exe', v: 'portable, с интерфейсом внутри' },
]
</script>

<template>
  <section class="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 px-6 py-12 text-white sm:px-12 sm:py-16">
    <p class="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-200">Учебная вики</p>
    <h1 class="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Как устроен Sintence — и с чего начать его дорабатывать</h1>
    <p class="mt-5 max-w-2xl text-lg text-indigo-100">
      Путеводитель для тех, кто знает основы C++: инструменты, карта кода, путь данных от игры до экрана,
      правила Riot и лесенка первых задач.
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <RouterLink to="/01-obzor" class="rounded-lg bg-white px-5 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50">Начать с обзора</RouterLink>
      <RouterLink to="/12-pervye-zadachi" class="rounded-lg border border-white/40 px-5 py-2.5 font-semibold hover:bg-white/10">Первые задачи</RouterLink>
    </div>
  </section>

  <section class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
    <div v-for="f in facts" :key="f.k" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ f.k }}</div>
      <div class="mt-1 text-sm text-slate-500">{{ f.v }}</div>
    </div>
  </section>

  <section v-if="total" class="mt-8 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
    <div class="mb-2 flex justify-between text-sm font-medium">
      <span>Лесенка задач</span><span>{{ done }} / {{ total }}</span>
    </div>
    <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div class="h-full rounded-full bg-indigo-600 transition-all" :style="{ width: (done / total) * 100 + '%' }" />
    </div>
  </section>

  <section v-for="g in groups" :key="g.name" class="mt-10">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">{{ g.name }}</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <RouterLink
        v-for="p in g.items"
        :key="p.slug"
        :to="`/${p.slug}`"
        class="group rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-lg dark:border-slate-800"
      >
        <div class="font-mono text-xs text-slate-400">{{ p.num === 99 ? '—' : String(p.num).padStart(2, '0') }}</div>
        <div class="mt-1 text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{{ p.title }}</div>
      </RouterLink>
    </div>
  </section>
</template>
