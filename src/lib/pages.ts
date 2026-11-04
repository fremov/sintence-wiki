// Страницы вики: все content/*.md подтягиваются на сборке как сырой текст.
const raw = import.meta.glob('/content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface WikiPage {
  slug: string // 01-obzor
  num: number // 1
  title: string // «Обзор»
  group: string
  source: string
}

function groupOf(num: number): string {
  if (num <= 4) return 'Старт'
  if (num <= 8) return 'Подсистемы'
  if (num <= 12) return 'Практика'
  return 'Справочник'
}

export const pages: WikiPage[] = Object.entries(raw)
  .map(([path, source]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '')
    const num = parseInt(slug, 10)
    const h1 = /^#\s+(.+)$/m.exec(source)?.[1] ?? slug
    return { slug, num, title: h1.replace(/^\d+\.\s*/, ''), group: groupOf(num), source }
  })
  .sort((a, b) => a.num - b.num)

export const pageBySlug = (slug: string) => pages.find((p) => p.slug === slug)

export const groups = [...new Set(pages.map((p) => p.group))].map((name) => ({
  name,
  items: pages.filter((p) => p.group === name),
}))

export const taskCount = (source: string) => (source.match(/^\s*- \[ \] /gm) ?? []).length
