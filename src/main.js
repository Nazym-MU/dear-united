import './styles/global.css'
import { initStadium } from './stadium.js'
import { hero, chapters, explore, heroCamera, standCaptions } from './data/story.js'

// How far (in world units) the model is nudged sideways so it sits beside the
// text column rather than behind it.
const PANEL_SHIFT = 0.13

// ── Elements ──────────────────────────────────────────────────────────────────
const loadingEl      = document.getElementById('loading')
const loadingBar     = document.getElementById('loading-bar')
const loadingPercent = document.getElementById('loading-percent')
const threeCanvas    = document.getElementById('three-canvas')
const storyEl        = document.getElementById('story')
const dotsEl         = document.getElementById('dots')
const uiEl           = document.getElementById('ui')
const standCaption   = document.getElementById('stand-caption')
const zoomSlider     = document.getElementById('zoom-slider')
const rotateSlider   = document.getElementById('rotate-slider')

// ── Build the story DOM from data ────────────────────────────────────────────
function el(tag, className, text) {
  const n = document.createElement(tag)
  if (className) n.className = className
  if (text !== undefined) n.textContent = text
  return n
}

function buildPolaroids(photos) {
  const wrap = el('div', 'polaroids')
  photos.forEach((p, i) => {
    const card = el('figure', 'polaroid')
    card.style.setProperty('--rot', `${p.rot}deg`)
    card.style.setProperty('--i', i)
    const ph = el('div', 'photo-area')
    const img = document.createElement('img')
    img.alt = p.caption
    img.loading = 'lazy'
    img.addEventListener('load', () => card.classList.add('has-photo'))
    img.src = p.src
    ph.appendChild(img)
    card.appendChild(ph)
    card.appendChild(el('figcaption', 'polaroid-caption', p.caption))
    wrap.appendChild(card)
  })
  return wrap
}

// Hero
const heroSection = el('section', 'section hero')
const heroInner = el('div', 'hero-inner')
heroInner.appendChild(el('p', 'kicker', hero.kicker))
heroInner.appendChild(el('h1', 'hero-title', hero.title))
heroInner.appendChild(el('p', 'hero-subtitle', hero.subtitle))
heroSection.appendChild(heroInner)
const cue = el('div', 'scroll-cue')
cue.appendChild(el('span', 'scroll-cue-label', hero.cue))
cue.appendChild(el('span', 'scroll-cue-line'))
heroSection.appendChild(cue)
storyEl.appendChild(heroSection)

// Chapters
for (const ch of chapters) {
  const section = el('section', `section chapter side-${ch.side}`)
  const panel = el('div', 'panel')
  panel.appendChild(el('p', 'kicker', ch.kicker))
  panel.appendChild(el('h2', 'chapter-title', ch.title))
  for (const para of ch.body) panel.appendChild(el('p', 'chapter-body', para))
  if (ch.stat) panel.appendChild(el('p', 'chapter-stat', ch.stat))
  if (ch.photos?.length) panel.appendChild(buildPolaroids(ch.photos))
  section.appendChild(panel)
  storyEl.appendChild(section)
}

// Explore
const exploreSection = el('section', 'section explore')
const explorePanel = el('div', 'panel explore-panel')
explorePanel.appendChild(el('p', 'kicker', explore.kicker))
explorePanel.appendChild(el('h2', 'chapter-title', explore.title))
explorePanel.appendChild(el('p', 'chapter-body', explore.body))
exploreSection.appendChild(explorePanel)
storyEl.appendChild(exploreSection)

const sections = [...storyEl.querySelectorAll('.section')]
const panels = sections.map(s => s.querySelector('.hero-inner, .panel'))

// Chapter dots
sections.forEach((s, i) => {
  const dot = el('button', 'dot')
  dot.setAttribute('aria-label', `Chapter ${i}`)
  dot.addEventListener('click', () => s.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  dotsEl.appendChild(dot)
})
const dots = [...dotsEl.children]

// ── Stadium ───────────────────────────────────────────────────────────────────
let assembled = false

const stadium = initStadium(threeCanvas, {
  onProgress(progress) {
    const pct = Math.round(progress * 100)
    loadingBar.style.width = `${pct}%`
    loadingPercent.textContent = `${pct}%`
    if (progress >= 1) loadingEl.classList.add('hidden')
  },
  onAssemblyDone() {
    assembled = true
    document.body.classList.remove('locked')
    heroSection.classList.add('assembled')
  },
})

// On narrow screens the text overlays the model, so no sideways nudge.
function applyPath() {
  const shiftMag = window.innerWidth < 820 ? 0 : PANEL_SHIFT
  const sideShift = (side) => (side === 'left' ? shiftMag : -shiftMag)
  stadium.setPath([
    { ...heroCamera, shift: 0 },
    ...chapters.map(ch => ({ ...ch.camera, shift: sideShift(ch.side) })),
    { ...explore.camera, shift: 0 },
  ])
}
applyPath()
window.addEventListener('resize', applyPath)

// Impatient scrolling during assembly speeds it up rather than fighting it.
window.addEventListener('wheel', () => { if (!assembled) stadium.hurryAssembly() }, { passive: true })
window.addEventListener('touchmove', () => { if (!assembled) stadium.hurryAssembly() }, { passive: true })

// ── Scroll → camera + panel visibility ────────────────────────────────────────
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

let anchors = []
function measure() {
  anchors = sections.map(s => s.offsetTop + s.offsetHeight / 2)
}
measure()
window.addEventListener('resize', measure)

let exploreActive = false

function setExplore(on) {
  if (on === exploreActive) return
  exploreActive = on
  uiEl.classList.toggle('visible', on)
  if (!on) {
    // Walk back to the story cleanly: neutral orbit and zoom.
    stadium.setExploreYaw(0)
    stadium.setYawOffset(0)
    stadium.setFovOffset(0)
    rotateSlider.value = 0
    zoomSlider.value = 45
    standButtons.forEach(b => b.classList.remove('active'))
    standButtons[0].classList.add('active')
    standCaption.textContent = standCaptions.all
  }
}

function onFrame() {
  requestAnimationFrame(onFrame)
  const sc = window.scrollY + window.innerHeight / 2

  // Continuous position along the chapter anchors → camera path parameter.
  let u = 0
  if (sc <= anchors[0]) u = 0
  else if (sc >= anchors[anchors.length - 1]) u = anchors.length - 1
  else {
    let i = 0
    while (sc > anchors[i + 1]) i++
    u = i + (sc - anchors[i]) / (anchors[i + 1] - anchors[i])
  }
  stadium.setScrollU(u)

  // Panels fade by distance from the viewport centre.
  const vh = window.innerHeight
  panels.forEach((p, i) => {
    const d = Math.abs(anchors[i] - sc) / (vh * 0.62)
    const vis = Math.max(0, 1 - d)
    const e = vis * vis * (3 - 2 * vis)
    p.style.opacity = e.toFixed(3)
    p.style.transform = `translateY(${((1 - e) * 26).toFixed(1)}px)`
    p.style.visibility = e < 0.01 ? 'hidden' : 'visible'
  })

  const nearest = anchors.reduce((best, a, i) => Math.abs(a - sc) < Math.abs(anchors[best] - sc) ? i : best, 0)
  dots.forEach((d, i) => d.classList.toggle('active', i === nearest))
  dotsEl.classList.toggle('visible', assembled && window.scrollY > 10)

  setExplore(assembled && u > anchors.length - 1.45)
}
requestAnimationFrame(onFrame)

// ── Explore controls ──────────────────────────────────────────────────────────
// Stand buttons are camera presets: each orbits the camera round to face that
// stand, using the same headings as the story chapters.
const CTR = { x: 0.04, z: 0.10 }
const headingOf = (cam) => Math.atan2(cam.position[2] - CTR.z, cam.position[0] - CTR.x)
const overviewHeading = headingOf(explore.camera)
const chapterHeading = (id) => headingOf(chapters.find(c => c.id === id).camera)
const yawTo = (heading) => {
  let d = heading - overviewHeading
  while (d >  Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
const STAND_YAWS = {
  all:   0,
  east:  yawTo(chapterHeading('east')),
  north: yawTo(chapterHeading('stretford')),
  west:  yawTo(chapterHeading('saf')),
  south: yawTo(chapterHeading('bobby')),
}

const standButtons = [...document.querySelectorAll('.stand-btn')]
standCaption.textContent = standCaptions.all

standButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    standButtons.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    stadium.setExploreYaw(STAND_YAWS[btn.dataset.stand])
    standCaption.textContent = standCaptions[btn.dataset.stand]
  })
})

zoomSlider.addEventListener('input', () => stadium.setFovOffset(parseInt(zoomSlider.value) - 45))
rotateSlider.addEventListener('input', () => stadium.setYawOffset((parseInt(rotateSlider.value) * Math.PI) / 180))

window.__stadium = stadium
