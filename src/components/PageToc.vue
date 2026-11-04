<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TocItem } from '../lib/markdown'

const props = defineProps<{ items: TocItem[] }>()
const active = ref('')
let obs: IntersectionObserver | null = null

function observe() {
  obs?.disconnect()
  obs = new IntersectionObserver(
    (entries) => {
      const vis = entries.filter((e) => e.isIntersecting)
      if (vis.length) active.value = vis[0].target.id
    },
    { rootMargin: '-72px 0px -70% 0px' },
  )
  props.items.forEach((i) => {
    const el = document.getElementById(i.id)
    if (el) obs!.observe(el)
  })
}

onMounted(() => setTimeout(observe, 50))
watch(() => props.items, () => setTimeout(observe, 50))
onBeforeUnmount(() => obs?.disconnect())

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <nav v-if="items.length" class="text-sm">
    <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">На странице</p>
    <ul class="space-y-1 border-l border-slate-200 dark:border-slate-800">
      <li v-for="i in items" :key="i.id">
        <a
          :href="`#${i.id}`"
          class="-ml-px block border-l py-0.5 pr-2 transition-colors"
          :class="[
            i.level === 3 ? 'pl-6 text-[13px]' : 'pl-3',
            active === i.id
              ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100',
          ]"
          @click.prevent="jump(i.id)"
          >{{ i.text }}</a
        >
      </li>
    </ul>
  </nav>
</template>
