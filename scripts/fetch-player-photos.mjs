import fs from 'node:fs'
import path from 'node:path'
import { seasons } from '../src/data/album.js'

const OUT = path.resolve(import.meta.dirname, '../public/photos/players')
const CACHE = path.resolve(import.meta.dirname, '.photo-cache.json')
fs.mkdirSync(OUT, { recursive: true })

const UA = 'OldTraffordFanSite/1.0 (personal fan project; contact: local)'
const API = 'https://en.wikipedia.org/w/api.php'

const people = new Map()
for (const s of seasons) {
  for (const p of s.players) people.set(p.slug, p.name)
  for (const p of s.squad ?? []) people.set(p.slug, p.name)
  if (s.manager) people.set(s.manager.slug, s.manager.name)
}

const force = process.argv.includes('--force')
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if ((res.status === 429 || res.status === 403) && attempt < 3) {
    await sleep(6000 * 2 ** attempt)
    return api(params, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function thumbFor(title, attempt = 0) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    { headers: { 'User-Agent': UA } },
  )
  if (res.status === 429 && attempt < 3) {
    await sleep(5000 * 2 ** attempt)
    return thumbFor(title, attempt + 1)
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return data.thumbnail?.source?.replace(/\/\d+px-/, '/640px-') ?? null
}

async function resolve(name) {
  let url = await thumbFor(name)
  if (url) return url
  await sleep(1500)
  const s = await api({
    action: 'query',
    list: 'search',
    srsearch: `${name} footballer Manchester United`,
    srlimit: '1',
  })
  const title = s.query?.search?.[0]?.title
  if (!title) return null
  await sleep(1500)
  return thumbFor(title)
}

async function download(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 && attempt < 3) {
    await sleep(6000 * 2 ** attempt)
    return download(url, attempt + 1)
  }
  if (!res.ok) throw new Error(res.status)
  return Buffer.from(await res.arrayBuffer())
}

let saved = 0
for (const [slug, name] of people) {
  const file = path.join(OUT, `${slug}.jpg`)
  if (!force && fs.existsSync(file)) continue
  try {
    if (!(slug in cache)) {
      cache[slug] = await resolve(name)
      saveCache()
      await sleep(1500)
    }
    if (!cache[slug]) continue
    fs.writeFileSync(file, await download(cache[slug]))
    saved++
    console.log(`ok  ${slug}`)
    await sleep(5000)
  } catch (e) {
    console.log(`err ${slug} — ${e.message}`)
  }
}

const have = fs.readdirSync(OUT).filter((f) => f.endsWith('.jpg')).length
const noImage = [...people.entries()].filter(([slug]) => slug in cache && !cache[slug])
console.log(`\nsaved ${saved} new · ${have}/${people.size} on disk`)
if (noImage.length) {
  console.log(`no wikipedia image (${noImage.length}):`)
  for (const [slug, name] of noImage) console.log(`  ${name} (${slug})`)
}
