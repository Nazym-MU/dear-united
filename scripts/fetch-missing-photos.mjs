import fs from 'node:fs'
import path from 'node:path'
import { seasons } from '../src/data/album.js'

const OUT = path.resolve(import.meta.dirname, '../public/photos/players')
const CACHE = path.resolve(import.meta.dirname, '.photo-cache2.json')
const UA = 'OldTraffordFanSite/1.0 (personal fan project; contact: local)'
const API = 'https://en.wikipedia.org/w/api.php'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'

const people = new Map()
for (const s of seasons) {
  for (const p of s.players) people.set(p.slug, p.name)
  if (s.manager) people.set(s.manager.slug, s.manager.name)
  for (const p of s.squad || []) people.set(p.slug, p.name)
}

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function getJson(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if ((res.status === 429 || res.status === 403) && attempt < 3) {
    await sleep(6000 * 2 ** attempt)
    return getJson(url, attempt + 1)
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const apiUrl = (base, params) => `${base}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`

async function findTitle(name) {
  const data = await getJson(apiUrl(API, {
    action: 'query', list: 'search',
    srsearch: `${name} footballer Manchester United`, srlimit: '3',
  }))
  const hits = data?.query?.search ?? []
  const surname = fold(name.split(/\s+/).pop())
  for (const h of hits) {
    if (fold(h.title).includes(surname) || fold(h.title).includes(fold(name.split(/\s+/)[0]))) return h.title
  }
  return hits[0]?.title ?? null
}

async function summary(title) {
  return getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`)
}

function isFootballPerson(sum) {
  const d = `${sum?.description ?? ''} ${sum?.extract ?? ''}`.toLowerCase()
  return /footballer|football player|football manager|soccer/.test(d)
}

async function articleImages(title, surname) {
  const data = await getJson(apiUrl(API, { action: 'query', prop: 'images', titles: title, imlimit: '50' }))
  const page = Object.values(data?.query?.pages ?? {})[0]
  const files = (page?.images ?? []).map((i) => i.title)
    .filter((t) => /\.(jpe?g|png)$/i.test(t) && fold(t).includes(surname))
  if (!files.length) return null
  const info = await getJson(apiUrl(API, {
    action: 'query', prop: 'imageinfo', titles: files[0], iiprop: 'url', iiurlwidth: '640',
  }))
  const p = Object.values(info?.query?.pages ?? {})[0]
  return p?.imageinfo?.[0]?.thumburl ?? p?.imageinfo?.[0]?.url ?? null
}

async function commonsImage(name, surname) {
  const data = await getJson(apiUrl(COMMONS, {
    action: 'query', generator: 'search', gsrsearch: `${name} footballer`,
    gsrnamespace: '6', gsrlimit: '10', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '640',
  }))
  const pages = Object.values(data?.query?.pages ?? {})
  const hit = pages.find((p) => /\.(jpe?g|png)$/i.test(p.title) && fold(p.title).includes(surname))
  return hit?.imageinfo?.[0]?.thumburl ?? hit?.imageinfo?.[0]?.url ?? null
}

async function download(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 && attempt < 3) {
    await sleep(6000 * 2 ** attempt)
    return download(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`dl ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function saveFrom(url, file) {
  const variants = [url]
  const m = url.match(/\/(\d+)px-/)
  if (m) for (const px of [640, 480, 320, 250]) {
    const v = url.replace(/\/\d+px-/, `/${px}px-`)
    if (!variants.includes(v)) variants.push(v)
  }
  for (const v of variants) {
    try {
      const buf = await download(v)
      if (buf.length > 2000) { fs.writeFileSync(file, buf); return true }
    } catch {}
    await sleep(700)
  }
  return false
}

let saved = 0
const misses = []
for (const [slug, name] of people) {
  const file = path.join(OUT, `${slug}.jpg`)
  if (fs.existsSync(file)) continue
  const surname = fold(name.split(/\s+/).pop())
  try {
    let url = cache[slug]
    if (url === undefined) {
      url = null
      const title = await findTitle(name)
      await sleep(1200)
      if (title) {
        const sum = await summary(title)
        await sleep(1200)
        if (sum && isFootballPerson(sum)) {
          url = sum.thumbnail?.source ?? null
          if (!url) {
            url = await articleImages(title, surname)
            await sleep(1200)
          }
        }
      }
      if (!url) {
        url = await commonsImage(name, surname)
        await sleep(1200)
      }
      cache[slug] = url
      saveCache()
    }
    if (!url) { misses.push(`${name} (${slug})`); continue }
    if (await saveFrom(url, file)) {
      saved++
      console.log(`ok  ${slug}`)
    } else {
      console.log(`err ${slug} — all download variants failed`)
    }
    await sleep(1800)
  } catch (e) {
    console.log(`err ${slug} — ${e.message}`)
  }
}

const have = fs.readdirSync(OUT).filter((f) => f.endsWith('.jpg')).length
console.log(`\nsaved ${saved} new · ${have}/${people.size} on disk`)
if (misses.length) {
  console.log(`still no image (${misses.length}):`)
  for (const m of misses) console.log(`  ${m}`)
}
