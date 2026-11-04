import Fuse from 'fuse.js'
import { pages } from './pages'
import { slugify } from './markdown'

export interface Section { slug: string; page: string; heading: string; id: string; text: string }

const plain = (s: string) =>
  s.replace(/```\w*\n?/g, ' ').replace(/[`*_|>#[\]()-]+/g, ' ').replace(/\s+/g, ' ').trim()

function build(): Section[] {
  const out: Section[] = []
  for (const p of pages) {
    let heading = p.title
    let id = ''
    let buf: string[] = []
    const flush = () => {
      const text = plain(buf.join(' '))
      if (text) out.push({ slug: p.slug, page: p.title, heading, id, text })
      buf = []
    }
    for (const line of p.source.split('\n')) {
      const m = /^(#{2,3})\s+(.+)$/.exec(line)
      if (m) {
        flush()
        heading = m[2].replace(/[`*]/g, '')
        id = slugify(heading)
      } else if (!/^#\s/.test(line)) buf.push(line)
    }
    flush()
  }
  return out
}

const fuse = new Fuse(build(), {
  keys: [
    { name: 'heading', weight: 2 },
    { name: 'page', weight: 1.5 },
    { name: 'text', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
})

export const search = (q: string, limit = 10) => fuse.search(q, { limit }).map((r) => r.item)
