<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { pages, pageBySlug } from '../lib/pages'
import { render } from '../lib/markdown'
import { useProgress } from '../stores/progress'
import { useTheme } from '../stores/theme'
import PageToc from '../components/PageToc.vue'

const route = useRoute()
const progress = useProgress()
const theme = useTheme()

const page = computed(() => pageBySlug(String(route.params.slug))!)
const rendered = computed(() => render(page.value.source))
const idxInList = computed(() => pages.findIndex((p) => p.slug === page.value.slug))
const prev = computed(() => pages[idxInList.value - 1])
const next = computed(() => pages[idxInList.value + 1])
const doneCount = computed(() => progress.count(page.value.slug))

const body = () => document.querySelector<HTMLElement>('.wiki-prose')

/* чекбоксы: состояние из хранилища */
function syncTasks() {
  body()?.querySelectorAll<HTMLInputElement>('.task-cb').forEach((cb) => {
    const done = progress.isDone(page.value.slug, Number(cb.dataset.task))
    cb.checked = done
    cb.closest('li')?.classList.toggle('done', done)
  })
}

/* диаграммы Mermaid: тяжёлая библиотека, грузим только когда она нужна */
async function drawDiagrams() {
  const blocks = body()?.querySelectorAll<HTMLElement>('.mermaid-block')
  if (!blocks?.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({ startOnLoad: false, theme: theme.dark ? 'dark' : 'neutral', securityLevel: 'strict' })
  let n = 0
  for (const el of blocks) {
    try {
      const { svg } = await mermaid.render(`mm-${Date.now()}-${n++}`, el.dataset.src ?? '')
      el.innerHTML = svg
    } catch (e) {
      el.textContent = 'Не удалось построить диаграмму'
      console.error(e)
    }
  }
}

async function afterRender() {
  await nextTick()
  syncTasks()
  drawDiagrams()
  const h = route.query.h
  if (typeof h === 'string') document.getElementById(h)?.scrollIntoView()
}

onMounted(afterRender)
watch(() => [page.value.slug, route.query.h], afterRender)
watch(() => theme.dark, drawDiagrams)

/* делегирование: копирование кода, чекбоксы, якоря заголовков */
function onClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  const copy = t.closest<HTMLElement>('[data-copy]')
  if (copy) {
    const code = copy.closest<HTMLElement>('.code-block')?.dataset.code ?? ''
    navigator.clipboard?.writeText(code).then(() => {
      copy.textContent = 'Скопировано'
      setTimeout(() => (copy.textContent = 'Копировать'), 1500)
    })
    return
  }
  const anchor = t.closest<HTMLElement>('[data-anchor]')
  if (anchor) {
    e.preventDefault()
    document.getElementById(anchor.dataset.anchor!)?.scrollIntoView({ behavior: 'smooth' })
    return
  }
  if (t instanceof HTMLInputElement && t.classList.contains('task-cb')) {
    progress.set(page.value.slug, Number(t.dataset.task), t.checked)
    t.closest('li')?.classList.toggle('done', t.checked)
  }
}
</script>

<template>
  <div class="flex gap-10">
    <article class="min-w-0 flex-1">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{{ page.group }}</p>
      <div v-if="rendered.tasks" class="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
        <div class="mb-1.5 flex justify-between text-sm font-medium">
          <span>Прогресс</span><span>{{ doneCount }} / {{ rendered.tasks }}</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
          <div class="h-full rounded-full bg-indigo-600 transition-all" :style="{ width: (doneCount / rendered.tasks) * 100 + '%' }" />
        </div>
        <p class="mt-1.5 text-xs text-slate-500">Отметки хранятся в этом браузере.</p>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="wiki-prose" @click="onClick" v-html="rendered.html" />

      <nav class="mt-14 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2 dark:border-slate-800">
        <RouterLink
          v-if="prev"
          :to="`/${prev.slug}`"
          class="rounded-xl border border-slate-200 p-4 hover:border-indigo-400 dark:border-slate-800"
        >
          <div class="text-xs text-slate-400">← Назад</div>
          <div class="font-medium">{{ prev.title }}</div>
        </RouterLink>
        <span v-else />
        <RouterLink
          v-if="next"
          :to="`/${next.slug}`"
          class="rounded-xl border border-slate-200 p-4 text-right hover:border-indigo-400 sm:col-start-2 dark:border-slate-800"
        >
          <div class="text-xs text-slate-400">Дальше →</div>
          <div class="font-medium">{{ next.title }}</div>
        </RouterLink>
      </nav>
    </article>

    <aside class="sticky top-20 hidden h-[calc(100vh-6rem)] w-56 shrink-0 overflow-y-auto xl:block">
      <PageToc :items="rendered.toc" />
    </aside>
  </div>
</template>
