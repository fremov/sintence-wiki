<script setup lang="ts">
import { groups } from '../lib/pages'
</script>

<template>
  <nav class="space-y-6 text-sm">
    <div v-for="g in groups" :key="g.name">
      <p class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{{ g.name }}</p>
      <ul class="space-y-0.5">
        <li v-for="p in g.items" :key="p.slug">
          <RouterLink
            :to="`/${p.slug}`"
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
            active-class="!bg-indigo-50 !text-indigo-700 font-medium dark:!bg-indigo-950/60 dark:!text-indigo-300"
          >
            <span class="w-5 shrink-0 text-right font-mono text-xs text-slate-400">{{ p.num === 99 ? '—' : p.num }}</span>
            {{ p.title }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
