import fs from 'node:fs'
import path from 'node:path'
import { seasons } from '../src/data/album.js'

const OUT = path.resolve(import.meta.dirname, '../public/photos/players')
const CACHE = path.resolve(import.meta.dirname, '.photo-cache.json')
const UA = { headers: { 'User-Agent': 'OldTraffordFanSite/1.0 (personal fan project; contact: local)' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const people = new Map()
for (const s of seasons) {
  for (const p of s.players) people.set(p.slug, p.name)
  for (const p of s.squad ?? []) people.set(p.slug, p.name)
  if (s.manager) people.set(s.manager.slug, s.manager.name)
}

// prune null cache entries so resolution retries
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
for (const k of Object.keys(cache)) if (!cache[k]) delete cache[k]
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1))
saveCache()

async function thumbFor(title, attempt = 0) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`, UA)
  if ((res.status === 429 || res.status === 403) && attempt < 3) {
    await sleep(6000 * 2 ** attempt)
    return thumbFor(title, attempt + 1)
  }
  if (!res.ok) return null
  const data = await res.json()
  return data.thumbnail?.source?.replace(/\/\d+px-/, '/640px-') ?? null
}

async function resolve(name) {
  let url = await thumbFor(name)
  if (url) return url
  await sleep(1500)
  const s = await fetch(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      format: 'json', action: 'query', list: 'search',
      srsearch: `${name} footballer Manchester United`, srlimit: '1',
    })}`, UA).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  const title = s?.query?.search?.[0]?.title
  if (!title) return null
  await sleep(1500)
  return thumbFor(title)
}

function candidates(url) {
  const out = [url, url.replace('/640px-', '/320px-'), url.replace('/640px-', '/250px-')]
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/\w+)\/thumb\/(.+)\/\d+px-[^/?]+/)
  if (m) out.push(`${m[1]}/${m[2]}`)   // original file
  return out
}

async function grab(url, file) {
  for (const c of candidates(url)) {
    try {
      const r = await fetch(c, UA)
      if (!r.ok) continue
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
      return true
    } catch {}
    await sleep(800)
  }
  return false
}

let saved = 0
for (const [slug, name] of people) {
  const file = path.join(OUT, `${slug}.jpg`)
  if (fs.existsSync(file)) continue
  try {
    if (!(slug in cache)) {
      cache[slug] = await resolve(name)
      saveCache()
      await sleep(1500)
    }
    if (!cache[slug]) { console.log(`none ${slug}`); continue }
    if (await grab(cache[slug], file)) { saved++; console.log(`ok  ${slug}`) }
    else console.log(`fail ${slug}`)
    await sleep(3000)
  } catch (e) {
    console.log(`err ${slug} — ${e.message}`)
  }
}

// era photos recoverable via exact article titles
const HIST = path.resolve(import.meta.dirname, '../public/photos/history')
for (const [slot, title] of [
  ['old-trafford-3', 'Archibald Leitch'],
  ['wilderness-1', 'Maine Road'],
]) {
  const file = path.join(HIST, `${slot}.jpg`)
  if (fs.existsSync(file)) continue
  const url = await thumbFor(title)
  if (url && (await grab(url, file))) console.log(`hist ok ${slot}`)
  else console.log(`hist fail ${slot}`)
  await sleep(3000)
}

const have = fs.readdirSync(OUT).filter((f) => f.endsWith('.jpg')).length
console.log(`\nmop-up saved ${saved} · ${have}/${people.size} players on disk`)
