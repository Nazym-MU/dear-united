// Screenshot harness for visual verification (dev use only).
// Usage: node scripts/shoot.mjs [outDir]
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = process.argv[2] || '/tmp/ot-shots'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium`,
  args: ['--use-angle=metal'],
})
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto('http://localhost:5199', { waitUntil: 'load' })

// Loading + assembly frames
await page.waitForTimeout(2500)
await page.screenshot({ path: `${outDir}/01-assembly-early.png` })
await page.waitForTimeout(2000)
await page.screenshot({ path: `${outDir}/02-assembly-mid.png` })
await page.waitForTimeout(2000)
await page.screenshot({ path: `${outDir}/03-assembly-late.png` })

// Wait until assembled (body unlocked)
await page.waitForFunction(() => !document.body.classList.contains('locked'), { timeout: 30000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}/04-hero-assembled.png` })

// Scroll through each section center
const anchors = await page.evaluate(() =>
  [...document.querySelectorAll('.section')].map((s) => s.offsetTop + s.offsetHeight / 2 - window.innerHeight / 2),
)
for (let i = 0; i < anchors.length; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), anchors[i])
  await page.waitForTimeout(2600) // let camera settle
  await page.screenshot({ path: `${outDir}/1${i}-section-${i}.png` })
}

// Explore: isolate a stand
await page.click('[data-stand="west"]')
await page.waitForTimeout(1800)
await page.screenshot({ path: `${outDir}/20-explore-west.png` })
await page.click('[data-stand="north"]')
await page.waitForTimeout(1800)
await page.screenshot({ path: `${outDir}/21-explore-north.png` })

// Sliders
await page.fill('#rotate-slider', '120')
await page.dispatchEvent('#rotate-slider', 'input')
await page.waitForTimeout(1600)
await page.screenshot({ path: `${outDir}/22-explore-rotated.png` })

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
