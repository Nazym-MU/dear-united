import './styles/album.css'
import { seasons } from './data/album.js'

const LINES = {
  GK: 0,
  RB: 1, LB: 1, CB: 1, CH: 1,
  RH: 2, LH: 2, CM: 2, CDM: 2, CAM: 2,
  OR: 3, IR: 3, CF: 3, IL: 3, OL: 3, RW: 3, LW: 3, ST: 3, FW: 3, SS: 3
}

const TILTS = [-2.2, 1.6, -1.1, 2.4, -1.8, 1.2, -2.6, 2, -1.4, 1.9, -2.1]
const BUILD_RADIUS = 3
const RIFFLE_MAX = 8
const RIFFLE_STAGGER = 70

const book = document.getElementById('book')

// iPadOS/iOS WebKit renders 3D backfaces it should hide, so touch devices
// get a flat book: pages switch instantly, no rotateY anywhere.
const FLAT = window.matchMedia('(pointer: coarse)').matches ||
  (navigator.maxTouchPoints > 1 && /iPad|Macintosh/.test(navigator.userAgent))
if (FLAT) book.classList.add('flat')
const shift = document.getElementById('book-shift')
const scaleWrap = document.getElementById('book-scale')
const stage = document.getElementById('album-stage')
const carousel = document.getElementById('year-carousel')

const maxFlips = seasons.length
let flips = 0
let animating = false

function initials(name) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function surname(name) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]
}

function playerCard(p) {
  return `
    <article class="pcard" style="--tilt:${TILTS[p.tiltIndex % TILTS.length]}deg">
      <div class="pcard-top">
        <span class="pcard-num">${p.number}</span>
        <span class="pcard-pos">${p.position}</span>
      </div>
      <div class="pcard-photo">
        <div class="monogram">${initials(p.name)}</div>
        ${p.captain ? '<span class="capt-chip">C</span>' : ''}
        <img src="photos/players/${p.slug}.jpg" alt="${p.name}" loading="lazy" />
      </div>
      <div class="pcard-name" title="${p.name}">${surname(p.name)}</div>
    </article>`
}

function managerCard(m) {
  return `
    <article class="pcard manager-card">
      <span class="manager-tag">Manager</span>
      <div class="pcard-photo">
        <div class="monogram">${initials(m.name)}</div>
        <img src="photos/players/${m.slug}.jpg" alt="${m.name}" loading="lazy" />
      </div>
      <div class="pcard-name">${m.name}</div>
    </article>`
}

function jerseySvg(kit) {
  const [body, trim] = kit.colors
  const squeeze = kit.sponsor.length > 5 ? ' textLength="46" lengthAdjust="spacingAndGlyphs"' : ''
  const sponsor = kit.sponsor
    ? `<text x="70" y="80" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="11" fill="${trim}"${squeeze}>${kit.sponsor.toUpperCase()}</text>`
    : `<circle cx="70" cy="76" r="9" fill="none" stroke="${trim}" stroke-width="2.5" />`
  return `
    <svg viewBox="0 0 140 140" aria-hidden="true">
      <path d="M46 16 L58 8 C61 16 79 16 82 8 L94 16 L119 35 L107 60 L94 51 L94 124 L46 124 L46 51 L33 60 L21 35 Z"
        fill="${body}" stroke="${trim}" stroke-width="3" stroke-linejoin="round" />
      <path d="M58 8 C61 16 79 16 82 8" fill="none" stroke="${trim}" stroke-width="4" stroke-linecap="round" />
      <path d="M25 41 L36 49 M115 41 L104 49" stroke="${trim}" stroke-width="2.5" stroke-linecap="round" />
      ${sponsor}
    </svg>`
}

function chipName(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  let i = parts.length - 1
  while (i - 1 > 0 && /^[a-z]/.test(parts[i - 1])) i--
  return parts.slice(i).join(' ')
}

function squadChip(p) {
  return `
    <div class="squad-chip" title="${p.name}">
      <span class="squad-chip-photo">
        <span class="monogram">${initials(p.name)}</span>
        <img src="photos/players/${p.slug}.jpg" alt="${p.name}" loading="lazy" />
      </span>
      <span class="squad-chip-meta">
        <span class="squad-chip-name">${chipName(p.name)}</span>
        <span class="squad-chip-pos">${p.pos}</span>
      </span>
    </div>`
}

function leftPage(season) {
  const kitCaption = ['Home kit', season.kit.maker, season.kit.sponsor].filter(Boolean).join(' · ')
  const squad = season.squad || []
  const squadHtml = squad.length
    ? `
      <div class="squad-strip">
        <span class="squad-label">Also in the squad</span>
        <div class="squad-grid">${squad.map(squadChip).join('')}</div>
      </div>`
    : ''
  return `
    <div class="season-left">
      <p class="season-eyebrow">Manchester United</p>
      <h2 class="season-title">${season.title}</h2>
      <p class="season-caption">${season.caption}</p>
      <div class="kit-block">
        <div class="kit-media">
          ${jerseySvg(season.kit)}
          <img src="photos/kits/${season.slug}.png" alt="${season.title} home kit" loading="lazy" />
        </div>
        <p class="kit-caption">${kitCaption}</p>
      </div>
      ${squadHtml}
    </div>`
}

function rightPage(season) {
  const rows = [[], [], [], []]
  season.players.forEach((p, i) => {
    rows[LINES[p.position] ?? 3].push({ ...p, tiltIndex: i })
  })
  const ordered = [rows[3], rows[2], rows[1], rows[0]]
  const rowHtml = ordered
    .map((row, i) => {
      const cls = ['xi-row']
      if (row.length >= 5) cls.push('dense')
      if (i === 3) cls.push('line-gk')
      return `<div class="${cls.join(' ')}">${row.map(playerCard).join('')}</div>`
    })
    .join('')
  return `
    <div class="season-right">
      <span class="xi-label">Starting XI</span>
      <div class="xi">${rowHtml}</div>
      ${managerCard(season.manager)}
    </div>`
}

function coverPage() {
  return `
    <div class="cover-inner">
      <img class="cover-crest" src="crest.png" alt="Manchester United crest" />
      <h1 class="cover-title">Player Album</h1>
      <div class="cover-rule"></div>
      <p class="cover-club">Manchester United</p>
    </div>
    <p class="cover-hint">Open the album &rarr;</p>`
}

const base = document.createElement('div')
base.id = 'book-base'
book.appendChild(base)

const sheetEls = []
const built = new Set()

for (let i = 0; i <= seasons.length; i++) {
  const sheet = document.createElement('section')
  sheet.className = 'sheet'
  const front = document.createElement('div')
  front.className = 'face front'
  const back = document.createElement('div')
  back.className = 'face back'
  if (i === 0) front.classList.add('cover-face')
  if (i === seasons.length) back.classList.add('inner-board')
  sheet.appendChild(front)
  sheet.appendChild(back)
  book.appendChild(sheet)
  sheetEls.push(sheet)
}

function buildSheet(i) {
  if (built.has(i)) return
  const sheet = sheetEls[i]
  const front = sheet.firstElementChild
  const back = sheet.lastElementChild
  if (i === 0) {
    front.innerHTML = coverPage()
  } else {
    front.innerHTML = rightPage(seasons[i - 1])
  }
  if (i < seasons.length) {
    back.innerHTML = leftPage(seasons[i])
  }
  built.add(i)
}

function clearSheet(i) {
  if (!built.has(i)) return
  const sheet = sheetEls[i]
  sheet.firstElementChild.innerHTML = ''
  sheet.lastElementChild.innerHTML = ''
  built.delete(i)
}

function ensureWindow(center) {
  const lo = Math.max(0, center - BUILD_RADIUS)
  const hi = Math.min(seasons.length, center + BUILD_RADIUS)
  for (const i of [...built]) {
    if (i !== 0 && (i < lo || i > hi)) clearSheet(i)
  }
  buildSheet(0)
  for (let i = lo; i <= hi; i++) buildSheet(i)
}

book.addEventListener('click', (e) => {
  if (e.target.closest('.cover-face')) flipNext()
})

const hotLeft = document.createElement('button')
hotLeft.className = 'edge-hot left'
hotLeft.type = 'button'
hotLeft.setAttribute('aria-label', 'Previous page')
hotLeft.addEventListener('click', () => flipPrev())
const hotRight = document.createElement('button')
hotRight.className = 'edge-hot right'
hotRight.type = 'button'
hotRight.setAttribute('aria-label', 'Next page')
hotRight.addEventListener('click', () => flipNext())
book.appendChild(hotLeft)
book.appendChild(hotRight)

document.addEventListener(
  'error',
  (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement)) return
    const card = img.closest('.pcard')
    if (card) card.classList.add('no-photo')
    const chip = img.closest('.squad-chip')
    if (chip) chip.classList.add('no-photo')
    const kit = img.closest('.kit-media')
    if (kit) kit.classList.add('no-photo')
  },
  true
)

const yearBtns = []
seasons.forEach((season, i) => {
  const startYear = parseInt(season.slug, 10)
  if (i > 0 && startYear % 10 === 0) {
    const mark = document.createElement('span')
    mark.className = 'decade-mark'
    mark.setAttribute('aria-hidden', 'true')
    mark.innerHTML = `<i></i>${String(startYear).slice(2)}s`
    carousel.appendChild(mark)
  }
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'year-btn'
  btn.textContent = season.title.slice(2)
  btn.setAttribute('aria-label', `Season ${season.title}`)
  btn.addEventListener('click', () => goToSeason(i))
  carousel.appendChild(btn)
  yearBtns.push(btn)
})

function centerActiveYear() {
  const btn = yearBtns[flips - 1]
  if (!btn) {
    carousel.scrollTo({ left: 0, behavior: 'smooth' })
    return
  }
  carousel.scrollTo({
    left: btn.offsetLeft - carousel.clientWidth / 2 + btn.offsetWidth / 2,
    behavior: 'smooth'
  })
}

function cullSheets() {
  const lo = flips - BUILD_RADIUS - 1
  const hi = flips + BUILD_RADIUS + 1
  sheetEls.forEach((el, i) => {
    const keep = (i >= lo && i <= hi) || el.classList.contains('riffle')
    el.classList.toggle('offstage', !keep)
  })
}

function applyZ() {
  sheetEls.forEach((el, i) => {
    el.style.zIndex = el.classList.contains('flipped') ? i + 1 : sheetEls.length - i
  })
  cullSheets()
}

function render() {
  sheetEls.forEach((el, i) => el.classList.toggle('flipped', i < flips))
  if (FLAT) {
    sheetEls.forEach((el, i) => {
      el.classList.toggle('cur-left', i === flips - 1)
      el.classList.toggle('cur-right', i === flips)
    })
  }
  book.classList.toggle('closed', flips === 0)
  shift.classList.toggle('centered-cover', flips === 0)
  hotLeft.hidden = flips === 0
  hotRight.hidden = flips === maxFlips
  yearBtns.forEach((btn, i) => {
    const active = i === flips - 1
    btn.classList.toggle('active', active)
    if (active) btn.setAttribute('aria-current', 'true')
    else btn.removeAttribute('aria-current')
  })
  cullSheets()
  centerActiveYear()
}

function settle(sheet) {
  if (FLAT) {
    applyZ()
    ensureWindow(flips)
    return
  }
  animating = true
  const done = () => {
    sheet.removeEventListener('transitionend', done)
    clearTimeout(timer)
    animating = false
    applyZ()
    ensureWindow(flips)
  }
  const timer = setTimeout(done, 1150)
  sheet.addEventListener('transitionend', done)
}

function flipNext() {
  if (animating || flips >= maxFlips) return
  ensureWindow(flips + 1)
  const sheet = sheetEls[flips]
  sheet.style.zIndex = 80
  flips++
  render()
  settle(sheet)
}

function flipPrev() {
  if (animating || flips <= 0) return
  ensureWindow(flips - 1)
  const sheet = sheetEls[flips - 1]
  sheet.style.zIndex = 80
  flips--
  render()
  settle(sheet)
}

function goToSeason(i) {
  const target = i + 1
  if (animating || target === flips) return
  if (Math.abs(target - flips) === 1) {
    if (target > flips) flipNext()
    else flipPrev()
    return
  }
  jumpTo(target)
}

function jumpTo(target) {
  if (FLAT) {
    ensureWindow(target)
    flips = target
    render()
    applyZ()
    return
  }
  animating = true
  const from = flips
  const dir = target > from ? 1 : -1
  const indices = []
  if (dir > 0) {
    for (let i = from; i < target; i++) indices.push(i)
  } else {
    for (let i = from - 1; i >= target; i--) indices.push(i)
  }
  const animCount = Math.min(indices.length, RIFFLE_MAX)
  const snapIdx = indices.slice(0, indices.length - animCount)
  const animIdx = indices.slice(indices.length - animCount)
  const holdIdx = [from - 1, from].filter(
    (i) => i >= 0 && i < sheetEls.length && !indices.includes(i)
  )
  ensureWindow(target)
  holdIdx.forEach((i) => sheetEls[i].classList.add('riffle'))
  snapIdx.forEach((i) => sheetEls[i].classList.add('snap'))
  animIdx.forEach((i, k) => {
    const el = sheetEls[i]
    el.classList.add('riffle')
    el.classList.remove('offstage')
    el.style.transitionDelay = `${k * RIFFLE_STAGGER}ms`
    el.style.zIndex = 90 + k
  })
  void book.offsetWidth
  flips = target
  render()
  const total = animCount * RIFFLE_STAGGER + 380
  setTimeout(() => {
    indices.concat(holdIdx).forEach((i) => {
      const el = sheetEls[i]
      el.classList.remove('snap', 'riffle')
      el.style.transitionDelay = ''
    })
    animating = false
    applyZ()
  }, total)
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') flipNext()
  if (e.key === 'ArrowLeft') flipPrev()
})

let wheelAcc = 0
let wheelTimer = null
window.addEventListener(
  'wheel',
  (e) => {
    if (e.target instanceof Element && e.target.closest('#year-carousel')) return
    e.preventDefault()
    if (animating) return
    const d = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    wheelAcc += d
    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(() => {
      wheelAcc = 0
    }, 220)
    if (wheelAcc > 140) {
      wheelAcc = 0
      flipNext()
    } else if (wheelAcc < -140) {
      wheelAcc = 0
      flipPrev()
    }
  },
  { passive: false }
)

let touchX = null
stage.addEventListener(
  'touchstart',
  (e) => {
    if (e.target instanceof Element && e.target.closest('#year-carousel')) {
      touchX = null
      return
    }
    touchX = e.touches[0].clientX
  },
  { passive: true }
)
stage.addEventListener(
  'touchend',
  (e) => {
    if (touchX === null) return
    const dx = e.changedTouches[0].clientX - touchX
    touchX = null
    if (dx < -42) flipNext()
    if (dx > 42) flipPrev()
  },
  { passive: true }
)

function fit() {
  const s = Math.min(1, (window.innerWidth - 32) / 1060, (window.innerHeight - 214) / 640)
  scaleWrap.style.transformOrigin = 'top left'
  scaleWrap.style.transform = `scale(${s})`
  scaleWrap.style.width = `${1000 * s}px`
  scaleWrap.style.height = `${640 * s}px`
}

window.addEventListener('resize', fit)
fit()
ensureWindow(0)
applyZ()
render()
