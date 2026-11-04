import MarkdownIt from 'markdown-it'
import { createHighlighter } from 'shiki'

const LANGS = ['cpp', 'powershell', 'json', 'typescript', 'bash', 'python', 'sql', 'yaml', 'cmake', 'vue', 'text']
let hl: Awaited<ReturnType<typeof createHighlighter>> | null = null

export async function initMarkdown() {
  hl = await createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS })
}

export interface TocItem { id: string; text: string; level: number }
export interface Rendered { html: string; toc: TocItem[]; tasks: number }
interface Env { toc: TocItem[]; tasks: number; [k: string]: unknown }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

const md = new MarkdownIt({ html: false, linkify: true, typographer: false })

// --- код и диаграммы ---
md.renderer.rules.fence = (tokens, idx) => {
  const t = tokens[idx]
  const lang = t.info.trim().split(/\s+/)[0] || 'text'
  if (lang === 'mermaid') {
    return `<div class="mermaid-block" data-src="${esc(t.content)}"></div>`
  }
  const known = LANGS.includes(lang) ? lang : 'text'
  const body = hl
    ? hl.codeToHtml(t.content.replace(/\n$/, ''), {
        lang: known,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      })
    : `<pre class="shiki"><code>${esc(t.content)}</code></pre>`
  return (
    `<div class="code-block" data-code="${esc(t.content)}">` +
    `<span class="code-lang">${esc(lang === 'text' ? '' : lang)}</span>` +
    `<button type="button" class="copy-btn" data-copy>Копировать</button>${body}</div>`
  )
}

// --- таблицы с горизонтальной прокруткой ---
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>'
md.renderer.rules.table_close = () => '</table></div>'

// --- заголовки: id, якоря, оглавление ---
md.renderer.rules.heading_open = (tokens, idx, _o, rawEnv) => {
  const env = rawEnv as unknown as Env
  const t = tokens[idx]
  const level = Number(t.tag.slice(1))
  const text = tokens[idx + 1].children?.map((c) => c.content).join('') ?? ''
  const id = slugify(text)
  t.attrSet('id', id)
  if (level === 2 || level === 3) env.toc.push({ id, text, level })
  return `<${t.tag} id="${id}">`
}
md.renderer.rules.heading_close = (tokens, idx) => {
  const t = tokens[idx]
  let id = ''
  for (let i = idx - 1; i >= 0; i--) {
    if (tokens[i].type === 'heading_open') { id = String(tokens[i].attrGet('id') ?? ''); break }
  }
  const lvl = Number(t.tag.slice(1))
  const anchor = lvl >= 2 && lvl <= 3 ? `<a class="anchor" href="#${id}" data-anchor="${id}">#</a>` : ''
  return `${anchor}</${t.tag}>\n`
}

// --- ссылки: страницы вики внутри сайта, внешние в новой вкладке ---
md.core.ruler.push('wiki_links', (state) => {
  for (const blk of state.tokens) {
    for (const ch of blk.children ?? []) {
      if (ch.type !== 'link_open') continue
      const href = String(ch.attrGet('href') ?? '')
      const m = /^(\d+-[\w-]+)\.md(#.*)?$/.exec(href)
      if (m) ch.attrSet('href', `#/${m[1]}`)
      else if (/^https?:/.test(href)) {
        ch.attrSet('target', '_blank')
        ch.attrSet('rel', 'noopener')
      }
    }
  }
})

// --- чек-листы «- [ ] текст» ---
md.core.ruler.push('wiki_tasks', (state) => {
  const env = state.env as unknown as Env
  const toks = state.tokens
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (t.type !== 'inline' || !t.content.startsWith('[ ] ') || toks[i - 2]?.type !== 'list_item_open') continue
    const n = env.tasks++
    toks[i - 2].attrJoin('class', 'task')
    t.content = t.content.slice(4)
    const first = t.children?.[0]
    if (first && first.type === 'text') first.content = first.content.replace(/^\[ \] /, '')
    const box = new state.Token('html_inline', '', 0)
    box.content = `<input type="checkbox" class="task-cb" data-task="${n}">`
    t.children?.unshift(box)
  }
})

export function render(source: string): Rendered {
  const env: Env = { toc: [], tasks: 0 }
  const html = md.render(source, env as never)
  return { html, toc: env.toc, tasks: env.tasks }
}
