import './styles/letter.css'
import { letter } from './data/letter.js'

const scrollEl   = document.getElementById('letter-scroll')
const stageEl    = document.getElementById('letter-stage')
const sheetEl    = document.getElementById('letter-sheet')
const envelopeEl = document.getElementById('envelope')

function el(tag, className, text) {
  const n = document.createElement(tag)
  if (className) n.className = className
  if (text !== undefined) n.textContent = text
  return n
}

document.getElementById('env-addressee').textContent = letter.envelope.addressee
const addrLines = document.getElementById('env-address-lines')
for (const line of letter.envelope.address) addrLines.appendChild(el('p', 'env-address-line', line))

document.getElementById('sheet-salutation').textContent = letter.salutation
const bodyEl = document.getElementById('sheet-body')
for (const para of letter.paragraphs) bodyEl.appendChild(el('p', 'sheet-para', para))
document.getElementById('sheet-signoff').textContent = letter.signoff
document.getElementById('sheet-signature').textContent = letter.signature

const PHASES = {
  flap: [0.06, 0.44],
  pull: [0.38, 1.00],
}

const PULL_DISTANCE = 0.94
const TUCK_RATIO = 0.055

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const phase = (p, [a, b]) => clamp01((p - a) / (b - a))
const ease = (t) => t * t * (3 - 2 * t)
const easeOutBack = (t) => {
  const c = 1.10
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

let sheetH = 0
let envH = 0
let risenH = 0
let openH = 0
let stageScale = 1

function sizeSheet() {
  envH = envelopeEl.offsetHeight
  if (!envH) return
  const inner = sheetEl.querySelector('.sheet-inner')
  const pad = parseFloat(getComputedStyle(sheetEl).paddingTop) * 2
  const vh = window.innerHeight
  sheetH = Math.max(envH * 1.35, inner.scrollHeight + pad + envH * 0.16)
  sheetEl.style.setProperty('--sheet-h', `${Math.round(sheetH)}px`)
  sheetEl.style.setProperty('--tuck', `${Math.round(envH * TUCK_RATIO)}px`)

  risenH = Math.max(0, sheetH - envH * 0.14)
  openH = risenH + envH
  stageScale = Math.min(1, (vh - 96) / openH)
  stageEl.style.setProperty('--stage-scale', stageScale.toFixed(3))

  scrollEl.style.height = `${Math.round(vh + sheetH * 2.6)}px`
}

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function render(p) {
  const f = ease(phase(p, PHASES.flap))
  envelopeEl.style.setProperty('--flap-angle', `${(f * 190).toFixed(2)}deg`)
  envelopeEl.style.setProperty('--seal-opacity', (1 - ease(clamp01((f - 0.3) / 0.17))).toFixed(3))
  envelopeEl.classList.toggle('flap-open', f > 0.5)

  const rawPull = phase(p, PHASES.pull)
  const t = rawPull < 1 ? ease(rawPull) : easeOutBack(rawPull)
  envelopeEl.style.setProperty('--flap-opacity', (1 - ease(clamp01(rawPull / 0.4))).toFixed(3))
  const restY = sheetH - envH * 0.92
  const openY = -(envH - envH * 0.14)
  sheetEl.style.setProperty('--pull', t.toFixed(4))
  sheetEl.style.setProperty('--sheet-y', `${Math.round(restY + (openY - restY) * t)}px`)

  const closedTop = (window.innerHeight - envH * stageScale) / 2
  const openTop = Math.max(
    risenH * stageScale + 16,
    (window.innerHeight - openH * stageScale) / 2 + risenH * stageScale,
  )
  const wrapTop = closedTop + (openTop - closedTop) * ease(clamp01(p / 0.55))
  stageEl.style.setProperty('--wrap-offset', `${Math.round(wrapTop)}px`)
}

// Scroll wheels and flicked momentum deliver the scroll position in coarse
// steps; rendering straight from scroll events makes the flap and sheet move
// in visible jumps. A continuous loop instead eases a smoothed progress
// toward the live scroll position every frame, so steps become glides.
let curP = 0
let renderedP = -1
let prevT = performance.now()

function targetP() {
  const trackTop = scrollEl.offsetTop
  const trackLen = scrollEl.offsetHeight - window.innerHeight
  return trackLen > 0 ? clamp01((window.scrollY - trackTop) / trackLen) : 0
}

function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  const dt = Math.min((now - prevT) / 1000, 0.05)
  prevT = now
  const target = targetP()
  curP = target + (curP - target) * Math.pow(0.00002, dt)   // ~90ms settle
  if (Math.abs(curP - target) < 0.0004) curP = target
  if (curP !== renderedP) {
    render(curP)
    renderedP = curP
  }
}

function onResize() {
  sizeSheet()
  render(curP)
  renderedP = curP
}

// The envelope is measured with fallback fonts first and again once the real
// faces arrive, so the page stays behind the boot loader until layout is
// final — no flash of the unscaled envelope.
const bootEl = document.getElementById('boot')
const shownAt = performance.now()
let revealed = false

function reveal() {
  if (revealed) return
  revealed = true
  const wait = Math.max(0, 600 - (performance.now() - shownAt))
  setTimeout(() => {
    // Measure, then measure again a frame later — the second pass catches
    // any late font swap or reflow — and only then show the page.
    onResize()
    requestAnimationFrame(() => {
      onResize()
      document.body.classList.add('ready')
      bootEl.classList.add('hide')
      setTimeout(() => bootEl.remove(), 700)
    })
  }, wait)
}

if (prefersReduced) {
  document.body.classList.add('reduced-motion')
  scrollEl.style.height = 'auto'
  stageEl.style.position = 'relative'
  reveal()
} else {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  sizeSheet()
  window.addEventListener('resize', onResize)
  render(0)
  requestAnimationFrame(frame)
  // Safari's fonts.ready/fonts.load can resolve before faces actually render
  // (a long-standing WebKit bug), so the gate measures instead: a hidden
  // probe is laid out in a fallback font, switched to the real face, and
  // polled until its width changes — proof the face is painting. The probe
  // also forces the face to start downloading. 2.6s cap per face.
  function fontSettled(family, weight) {
    return new Promise((resolve) => {
      const probe = document.createElement('span')
      probe.textContent = 'MU Old Trafford 1878 wm'
      probe.style.cssText =
        'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:48px;font-family:monospace'
      probe.style.fontWeight = weight
      document.body.appendChild(probe)
      const base = probe.offsetWidth
      probe.style.fontFamily = `"${family}", monospace`
      const t0 = performance.now()
      ;(function check() {
        if (probe.offsetWidth !== base || performance.now() - t0 > 2600) {
          probe.remove()
          resolve()
        } else {
          setTimeout(check, 40)
        }
      })()
    })
  }

  const winLoad = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((r) => window.addEventListener('load', r, { once: true }))
  winLoad
    .then(() => Promise.all([
      fontSettled('Homemade Apple', '400'),
      fontSettled('Nerko One', '400'),
      fontSettled('Nunito', '600'),
      fontSettled('Nunito', '700'),
      fontSettled('Nunito', '800'),
    ]))
    .then(reveal, reveal)
}
