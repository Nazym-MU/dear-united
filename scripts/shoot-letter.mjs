import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = process.argv[2] || '/tmp/ot-letter'
const port = process.argv[3] || '5174'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium`,
  args: ['--use-angle=metal'],
})
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' })
await page.waitForTimeout(1200) // let webfonts settle

const track = await page.evaluate(() => {
  const el = document.getElementById('letter-scroll')
  return { top: el.offsetTop, len: el.offsetHeight - window.innerHeight }
})

const stops = [0, 0.1, 0.2, 0.3, 0.42, 0.55, 0.7, 0.85, 1]
for (let i = 0; i < stops.length; i++) {
  const p = stops[i]
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), track.top + track.len * p)
  await page.waitForTimeout(420)
  await page.screenshot({ path: `${outDir}/${String(i).padStart(2, '0')}-p${String(Math.round(p * 100)).padStart(3, '0')}.png` })
}

await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
await page.waitForTimeout(600)
await page.screenshot({ path: `${outDir}/90-links.png` })

await page.setViewportSize({ width: 430, height: 900 })
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/91-mobile-closed.png` })
const mtrack = await page.evaluate(() => {
  const el = document.getElementById('letter-scroll')
  return { top: el.offsetTop, len: el.offsetHeight - window.innerHeight }
})
await page.evaluate((y) => window.scrollTo(0, y), mtrack.top + mtrack.len * 0.95)
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/92-mobile-open.png` })

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
