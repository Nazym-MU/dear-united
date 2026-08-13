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

let ticking = false

function render() {
  ticking = false

  const trackTop = scrollEl.offsetTop
  const trackLen = scrollEl.offsetHeight - window.innerHeight
  const p = trackLen > 0 ? clamp01((window.scrollY - trackTop) / trackLen) : 0

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

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(render)
}

function onResize() {
  sizeSheet()
  render()
}

if (prefersReduced) {
  document.body.classList.add('reduced-motion')
  scrollEl.style.height = 'auto'
  stageEl.style.position = 'relative'
} else {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  sizeSheet()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  if (document.fonts?.ready) document.fonts.ready.then(onResize)
  render()
}
