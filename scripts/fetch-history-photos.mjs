import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(import.meta.dirname, '../public/photos/history')
fs.mkdirSync(OUT, { recursive: true })

const UA = 'OldTraffordFanSite/1.0 (personal fan project; contact: local)'
const API = 'https://en.wikipedia.org/w/api.php'

const SLOTS = {
  'newton-heath-1': 'Lancashire and Yorkshire Railway',
  'newton-heath-2': 'North Road (football ground)',
  'newton-heath-3': 'Bank Street (football ground)',
  'newton-heath-4': 'Harry Stafford',
  'mangnall-1': 'Ernest Mangnall',
  'mangnall-2': 'Billy Meredith',
  'mangnall-3': 'Charlie Roberts',
  'mangnall-4': 'Sandy Turnbull',
  'old-trafford-1': 'Old Trafford',
  'old-trafford-2': 'John Henry Davies',
  'old-trafford-3': 'Archibald Leitch',
  'wilderness-1': 'Maine Road',
  'wilderness-2': 'Manchester Blitz',
  'wilderness-3': 'James W. Gibson',
  'busby-babes-1': 'Matt Busby',
  'busby-babes-2': 'Duncan Edwards',
  'busby-babes-3': 'Tommy Taylor (footballer)',
  'busby-babes-4': 'Roger Byrne',
  'munich-1': 'Munich air disaster',
  'munich-2': 'Duncan Edwards',
  'european-glory-1': 'Bobby Charlton',
  'european-glory-2': 'George Best',
  'european-glory-3': 'Denis Law',
  'european-glory-4': 'Alex Stepney',
  'seventies-1': 'Tommy Docherty',
  'seventies-2': 'Steve Coppell',
  'seventies-3': 'Ron Atkinson',
  'seventies-4': 'Bryan Robson',
  'ferguson-1': 'Alex Ferguson',
  'ferguson-2': 'Eric Cantona',
  'ferguson-3': 'Roy Keane',
  'ferguson-4': 'Cristiano Ronaldo',
  'post-ferguson-1': 'David Moyes',
  'post-ferguson-2': 'José Mourinho',
  'post-ferguson-3': 'Marcus Rashford',
  'post-ferguson-4': 'Erik ten Hag',
  'now-1': 'Michael Carrick',
  'now-2': 'Old Trafford',
  'now-3': 'Bruno Fernandes',
}

const force = process.argv.includes('--force')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if ((res.status === 429 || res.status === 403) && attempt < 5) {
    await sleep(8000 * 2 ** attempt)
    return api(params, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function download(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 && attempt < 4) {
    await sleep(8000 * 2 ** attempt)
    return download(url, attempt + 1)
  }
  if (!res.ok) throw new Error(res.status)
  return Buffer.from(await res.arrayBuffer())
}

const pending = Object.entries(SLOTS).filter(
  ([slot]) => force || !fs.existsSync(path.join(OUT, `${slot}.jpg`))
)

const titles = [...new Set(pending.map(([, t]) => t))]
const images = new Map()

for (let i = 0; i < titles.length; i += 40) {
  const data = await api({
    action: 'query',
    titles: titles.slice(i, i + 40).join('|'),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '640',
    redirects: '2',
  })
  const back = new Map()
  for (const r of data.query?.redirects ?? []) back.set(r.to, r.from)
  for (const n of data.query?.normalized ?? []) back.set(n.to, n.from)
  for (const page of Object.values(data.query?.pages ?? {})) {
    let t = page.title
    while (back.has(t)) t = back.get(t)
    if (page.thumbnail?.source) images.set(t, page.thumbnail.source)
  }
  await sleep(1500)
}

let saved = 0
const misses = []
for (const [slot, title] of pending) {
  const url = images.get(title)
  if (!url) {
    misses.push(`${slot} — ${title}`)
    continue
  }
  try {
    fs.writeFileSync(path.join(OUT, `${slot}.jpg`), await download(url))
    saved++
    await sleep(5000)
  } catch (e) {
    misses.push(`${slot} — ${title} — download ${e.message}`)
  }
}

console.log(`saved ${saved}, ${Object.keys(SLOTS).length - misses.length}/${Object.keys(SLOTS).length} covered`)
if (misses.length) {
  console.log('missing:')
  for (const m of misses) console.log(`  ${m}`)
}
