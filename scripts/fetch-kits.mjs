import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { seasons } from '../src/data/album.js'

const OUT = path.resolve(import.meta.dirname, '../public/photos/kits')
fs.mkdirSync(OUT, { recursive: true })

const force = process.argv.includes('--force')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function articleFor(slug) {
  const start = parseInt(slug.slice(0, 4), 10)
  const end = start + 1
  const endPart = end % 100 === 0 ? String(end) : String(end).slice(2)
  return `${start}–${endPart} Manchester United F.C. season`
}

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium`,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })

const misses = []
let saved = 0

for (const s of seasons) {
  const file = path.join(OUT, `${s.slug}.png`)
  if (!force && fs.existsSync(file)) continue
  const title = articleFor(s.slug)
  try {
    await page.goto(`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    const kit = page
      .locator('xpath=//div[normalize-space(.)="Home colours"]/preceding-sibling::div[1]')
      .first()
    await kit.waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForTimeout(600)
    await kit.screenshot({ path: file })
    saved++
    console.log(`ok  ${s.slug}`)
  } catch (e) {
    misses.push(`${s.slug} — ${title} — ${e.message.split('\n')[0]}`)
  }
  await sleep(1200)
}

await browser.close()
console.log(`\nsaved ${saved} kits`)
if (misses.length) {
  console.log(`missing (${misses.length}):`)
  for (const m of misses) console.log(`  ${m}`)
}
