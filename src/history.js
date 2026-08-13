import './styles/history.css'
import { eras } from './data/history.js'

const section = document.getElementById('history')
const N = eras.length
const ROT_VH = 170
const STOP_VH = 130
const TRAVEL = 0.4
const ROT_FRAC = ROT_VH / (ROT_VH + N * STOP_VH)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t

function el(tag, className, text) {
  const n = document.createElement(tag)
  if (className) n.className = className
  if (text !== undefined) n.textContent = text
  return n
}

const track = el('div', 'hx-track')
const stage = el('div', 'hx-stage')
track.appendChild(stage)
section.appendChild(track)

const zoom = el('div', 'hx-zoom')
const pitch = el('div', 'hx-pitch')
const turf = el('div', 'hx-turf')
pitch.appendChild(turf)
pitch.appendChild(el('div', 'hx-turf-shade'))
zoom.appendChild(pitch)
stage.appendChild(zoom)

const grassProbe = new Image()
grassProbe.onload = () => pitch.classList.add('has-photo')
grassProbe.src = '/textures/grass.jpg'

const markers = eras.map((era) => {
  const m = el('div', 'hx-marker')
  m.style.left = `${era.x}%`
  m.style.top = `${era.y}%`
  const shield = el('div', 'hx-shield')
  const inner = el('div', 'hx-shield-in')
  inner.appendChild(el('div', 'hx-marker-num', String(era.num)))
  inner.appendChild(el('div', 'hx-marker-role', era.role))
  shield.appendChild(inner)
  m.appendChild(shield)
  pitch.appendChild(m)
  return m
})

const ARROWS = {
  up: 'M6 40 C 14 30, 16 18, 22 8 M15 12 L22 8 L23 17',
  down: 'M8 6 C 14 16, 18 28, 24 38 M16 33 L24 38 L25 29',
}

function buildEphemera(it) {
  let node
  if (it.type === 'headline') {
    node = el('div', 'hx-eph hx-head')
    if (it.paper) node.appendChild(el('div', 'hx-head-paper', it.paper))
    node.appendChild(el('h4', 'hx-head-text', it.text))
  } else if (it.type === 'ticket') {
    node = el('div', 'hx-eph hx-ticket')
    node.appendChild(el('div', 'hx-ticket-stub', it.stub))
    const main = el('div', 'hx-ticket-main')
    main.appendChild(el('div', 'hx-ticket-title', it.title))
    main.appendChild(el('div', 'hx-ticket-line', it.line))
    if (it.line2) main.appendChild(el('div', 'hx-ticket-line', it.line2))
    node.appendChild(main)
  } else if (it.type === 'score') {
    node = el('div', 'hx-eph hx-score', it.text)
  } else if (it.type === 'pennant') {
    node = el('div', 'hx-eph hx-pennant')
    node.appendChild(el('span', null, it.text))
  } else if (it.type === 'tape') {
    node = el('div', 'hx-eph hx-tape')
  } else if (it.type === 'margin') {
    node = el('div', 'hx-eph hx-margin')
    node.appendChild(el('span', null, it.text))
    if (it.arrow) {
      node.classList.add(`hx-arrow-${it.arrow}`)
      node.insertAdjacentHTML(
        'beforeend',
        `<svg class="hx-margin-arrow" viewBox="0 0 30 46" aria-hidden="true"><path d="${ARROWS[it.arrow] || ARROWS.up}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      )
    }
  } else {
    return null
  }
  node.style.setProperty('--x', `${it.x}%`)
  node.style.setProperty('--y', `${it.y}%`)
  node.style.setProperty('--rot', `${it.rot || 0}deg`)
  if (it.z) node.style.zIndex = String(it.z)
  if (it.m) node.classList.add('hx-mhide')
  return node
}

const overlays = eras.map((era) => {
  const o = el('div', `hx-era v${era.variant}${era.solemn ? ' solemn' : ''}`)

  for (const it of era.items || []) {
    const node = buildEphemera(it)
    if (node) o.appendChild(node)
  }

  const note = el('div', 'hx-note')
  note.appendChild(el('h3', 'hx-note-title', era.title))
  note.appendChild(el('p', 'hx-note-years', era.years))
  o.appendChild(note)

  const photos = el('div', 'hx-photos')
  if (era.photos.length < 3) photos.classList.add('few')
  for (const ph of era.photos) {
    const card = el('figure', 'hx-photo')
    const area = el('div', 'hx-photo-area')
    const img = document.createElement('img')
    img.alt = ph.caption
    img.loading = 'lazy'
    img.onerror = () => area.classList.add('missing')
    img.src = ph.src
    area.appendChild(img)
    card.appendChild(area)
    card.appendChild(el('figcaption', 'hx-photo-caption', ph.caption))
    photos.appendChild(card)
  }
  o.appendChild(photos)

  const scrap = el('div', 'hx-scrap')
  scrap.appendChild(el('p', null, era.body))
  o.appendChild(scrap)

  if (era.solemn) {
    const clock = el('div', 'hx-clock')
    const face = el('div', 'hx-clock-face')
    face.appendChild(el('div', 'hx-clock-hour'))
    face.appendChild(el('div', 'hx-clock-min'))
    clock.appendChild(face)
    clock.appendChild(el('div', 'hx-clock-caption', '3.04 in the afternoon, 6 February 1958'))
    o.appendChild(clock)
  }

  if (era.link) {
    const wrap = el('div', 'hx-pill-wrap')
    const a = el('a', 'hx-pill', era.link.label)
    a.href = era.link.href
    wrap.appendChild(a)
    o.appendChild(wrap)
  }

  stage.appendChild(o)
  return o
})

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let pitchW = 0
let pitchH = 0
let flatScale = 1
let ticking = false
let lastSolemn = false

function measure() {
  pitchW = pitch.offsetWidth
  pitchH = pitch.offsetHeight
}

function coverScale() {
  return Math.max(
    (window.innerWidth * 1.005) / (pitchW || 1),
    (window.innerHeight * 1.005) / (pitchH || 1),
  )
}

function coverAt(deg) {
  const r = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const vw = window.innerWidth * 1.005
  const vh = window.innerHeight * 1.005
  return Math.max((vw * c + vh * s) / (pitchW || 1), (vw * s + vh * c) / (pitchH || 1))
}

function camOf(era) {
  return { s: coverScale() * era.zoom, x: era.x / 100, y: era.y / 100 }
}

function setEraState(i, op) {
  for (let k = 0; k < N; k++) {
    const on = k === i && op > 0.01
    overlays[k].style.opacity = on ? op.toFixed(3) : '0'
    overlays[k].classList.toggle('on', on)
    overlays[k].style.pointerEvents = on && op > 0.5 ? 'auto' : 'none'
  }
}

function setMarkerStates(active) {
  for (let k = 0; k < N; k++) {
    markers[k].classList.toggle('active', k === active)
    markers[k].classList.toggle('passed', active >= 0 && k < active)
  }
}

function render() {
  ticking = false
  const rect = track.getBoundingClientRect()
  const top = rect.top + window.scrollY
  const scrollable = track.offsetHeight - window.innerHeight
  const p = scrollable > 0 ? clamp01((window.scrollY - top) / scrollable) : 0

  if (p <= ROT_FRAC) {
    const t = ROT_FRAC > 0 ? p / ROT_FRAC : 1
    const e = smooth(t)
    const angle = 90 * (1 - e)
    const zs = lerp(1, coverScale(), e)
    const s = coverAt(angle) / zs
    pitch.style.transform = `rotate(${angle.toFixed(2)}deg) scale(${s.toFixed(4)})`
    zoom.style.transform = `scale(${zs.toFixed(4)})`
    const mo = smooth(clamp01((t - 0.58) / 0.42))
    pitch.style.setProperty('--mo', mo.toFixed(3))
    setEraState(-1, 0)
    setMarkerStates(-1)
    if (lastSolemn) {
      stage.classList.remove('solemn')
      lastSolemn = false
    }
    return
  }

  pitch.style.transform = 'rotate(0deg) scale(1)'
  pitch.style.setProperty('--mo', '1')

  const q = (p - ROT_FRAC) / (1 - ROT_FRAC)
  const seg = Math.min(q * N, N - 0.0001)
  const i = Math.floor(seg)
  const local = seg - i

  const tt = smooth(Math.min(local / TRAVEL, 1))
  const from = i === 0 ? { s: coverScale(), x: 0.5, y: 0.5 } : camOf(eras[i - 1])
  const to = camOf(eras[i])
  const s = lerp(from.s, to.s, tt)
  const fx = lerp(from.x, to.x, tt)
  const fy = lerp(from.y, to.y, tt)
  const maxTx = Math.max(0, (pitchW * s - window.innerWidth) / (2 * s))
  const maxTy = Math.max(0, (pitchH * s - window.innerHeight) / (2 * s))
  const tx = Math.max(-maxTx, Math.min(maxTx, (0.5 - fx) * pitchW))
  const ty = Math.max(-maxTy, Math.min(maxTy, (0.5 - fy) * pitchH))
  zoom.style.transform = `scale(${s.toFixed(4)}) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`

  const oIn = smooth(clamp01((local - 0.36) / 0.18))
  const oOut = i < N - 1 ? 1 - smooth(clamp01((local - 0.9) / 0.1)) : 1
  const op = oIn * oOut
  setEraState(i, op)
  setMarkerStates(i)

  const solemn = !!eras[i].solemn
  if (solemn !== lastSolemn) {
    stage.classList.toggle('solemn', solemn)
    lastSolemn = solemn
  }
}

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(render)
}

function onResize() {
  measure()
  render()
}

if (prefersReduced) {
  document.body.classList.add('reduced-motion')
  pitch.style.setProperty('--mo', '1')
} else {
  track.style.height = `${100 + ROT_VH + N * STOP_VH}vh`
  measure()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  render()
}
