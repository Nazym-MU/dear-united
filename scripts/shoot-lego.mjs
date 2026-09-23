// Screenshot harness for the LEGO stadium section of the letter page (dev use only).
// Start the dev server first:  npx vite --port 5199
// Usage: node scripts/shoot-lego.mjs [url] [outDir]
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.argv[2] || 'http://localhost:5199/'
const outDir = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), '..', 'tools-shots')
fs.mkdirSync(outDir, { recursive: true })

const HOME = process.env.HOME
const executablePath = [
  `${HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  `${HOME}/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium`,
].find((p) => fs.existsSync(p))

const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`)
  else if (m.text().startsWith('[lego]')) console.log('  page:', m.text())
})
const shot = (name) => page.screenshot({ path: join(outDir, name) })

await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 30000 })
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = 'auto'
  document.getElementById('stadium-live').scrollIntoView({ block: 'start' })
})

// mid-assembly: ~2 s after the drop starts
await page.waitForFunction(() => window.__stadium && window.__stadium.bricks.count > 0, null, { timeout: 30000 })
await page.waitForTimeout(2000)
await shot('09-mid-assembly.png')

const t0 = Date.now()
await page.waitForSelector('#stadium-live.assembled', { timeout: 40000 })
console.log(`assembled after ${((Date.now() - t0) / 1000 + 2).toFixed(1)} s (from the mid shot)`)
await page.waitForTimeout(2500) // wall bricks drop in, hint shows
await shot('10-assembled.png')

// click-lift a red brick near the centre (its own pick must return itself)
const target = await page.evaluate(() => {
  const { THREE, camera, bricks } = window.__stadium
  const canvas = document.getElementById('stadium-canvas')
  const r = canvas.getBoundingClientRect()
  const rc = new THREE.Raycaster(), v = new THREE.Vector3(), ndc = new THREE.Vector2()
  const list = []
  for (let i = 0; i < bricks.count; i++) {
    bricks.centre(i, v).project(camera)
    const d = Math.hypot(v.x, v.y + 0.1)
    if (d < 0.35) list.push([d, i])
  }
  list.sort((a, b) => a[0] - b[0])
  for (const [, i] of list.slice(0, 400)) {
    const b = new THREE.Box3()
    bricks.worldBox(i, b)
    b.getCenter(v)
    v.y = b.max.y
    v.project(camera)
    ndc.set(v.x, v.y)
    rc.setFromCamera(ndc, camera)
    const hit = bricks.pick(rc.ray)
    if (hit && hit.index === i && bricks.model.materials[bricks.model.bricks[3 * i + 1]].name === 'red') {
      return { i, x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, type: bricks.typeOf(i).name }
    }
  }
  return null
})
console.log('target brick:', target)
if (target) {
  await page.mouse.move(target.x - 20, target.y - 20)
  await page.mouse.move(target.x, target.y, { steps: 4 })
  await page.waitForTimeout(200)
  await page.mouse.click(target.x, target.y)
  await page.waitForTimeout(350)
  const held = await page.evaluate(() => {
    const it = window.__stadium.interaction
    return it.held ? { i: it.held.i, lift: +it.held.lift.toFixed(2) } : null
  })
  console.log('held:', held)
  await shot('11-lifted.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

// wheel capture: the section fills the viewport, so the wheel should fly, not scroll
const scrollBefore = await page.evaluate(() => window.scrollY)
await page.mouse.move(720, 500)
await page.mouse.wheel(0, -200)
await page.waitForTimeout(300)
console.log('wheel while engaged: page scroll', scrollBefore, '->', await page.evaluate(() => window.scrollY))

// fan wall sheet
await page.click('.wall-add')
await page.waitForTimeout(400)
await shot('12-wall-sheet.png')
const wallInfo = await page.evaluate(() => ({ bricks: window.__stadium.wall?.bricks.length, tag: [...document.querySelectorAll('.lego-tag')].map((t) => t.textContent) }))
console.log('wall:', wallInfo)

// wheel must scroll the page when the section is only partly in view
await page.evaluate(() => window.__stadium.wallUI.close())
await page.evaluate(() => window.scrollBy(0, -400))
await page.waitForTimeout(300)
const y0 = await page.evaluate(() => window.scrollY)
await page.mouse.move(720, 700)
await page.mouse.wheel(0, 120)
await page.waitForTimeout(400)
console.log('wheel while partly visible: page scroll', y0, '->', await page.evaluate(() => window.scrollY))

console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'console errors: none')
await browser.close()
