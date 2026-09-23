// DOM chrome for the embedded stadium: a small top bar (back to the letter, reset
// bricks, reset view), projected name tags, and the slide-in info card. Everything
// is created inside `root` (the #stadium-live section) and styled by
// src/styles/stadium.css, so nothing leaks into the letter page.
import * as THREE from 'three'

export const PRETTY = {
  'SAF-stand': 'Sir Alex Ferguson Stand',
  'SBC-stand': 'Sir Bobby Charlton Stand',
  'Stretford-End': 'Stretford End',
  'East-Stand': 'East Stand',
  'Field': 'The Pitch',
}

const _v = new THREE.Vector3()

export function createUI({ root, info = {}, onResetView, onResetBricks, onFlyTo, onBack } = {}) {
  const bar = document.createElement('div')
  bar.className = 'lego-bar'
  bar.innerHTML = `
    <button class="lego-pill lego-back" type="button">↑ Back to the letter</button>
    <div class="lego-actions">
      <button class="lego-chip lego-reset-bricks" type="button" hidden>Reset bricks</button>
      <button class="lego-chip lego-reset-view" type="button">Reset view</button>
    </div>`
  const tagsEl = document.createElement('div')
  tagsEl.className = 'lego-tags'
  tagsEl.setAttribute('aria-label', 'Stands')
  const card = document.createElement('aside')
  card.className = 'lego-card'
  card.setAttribute('aria-hidden', 'true')
  card.innerHTML = `
    <div class="lego-card-img"><span class="lego-card-img-label"></span></div>
    <div class="lego-card-body">
      <p class="lego-card-kicker"></p>
      <h2 class="lego-card-title"></h2>
      <p class="lego-card-text"></p>
      <p class="lego-card-meta"></p>
      <div class="lego-card-buttons">
        <button class="lego-mono-btn lego-card-fly" type="button">Fly here</button>
        <button class="lego-mono-btn lego-card-close" type="button">Close</button>
      </div>
    </div>`
  // tags sit under the bar and the card so those always win clicks
  root.append(tagsEl, card, bar)

  const q = (el, sel) => el.querySelector(sel)
  const resetBricksBtn = q(bar, '.lego-reset-bricks')
  let tags = []
  let active = null

  q(bar, '.lego-reset-view').addEventListener('click', () => onResetView?.())
  resetBricksBtn.addEventListener('click', () => onResetBricks?.())
  q(bar, '.lego-back').addEventListener('click', () => onBack?.())
  q(card, '.lego-card-close').addEventListener('click', () => closeCard())
  q(card, '.lego-card-fly').addEventListener('click', () => active && onFlyTo?.(active))
  // keep clicks on the chrome from reaching the canvas' fly controls
  for (const el of [bar, card]) el.addEventListener('pointerdown', (e) => e.stopPropagation())

  /**
   * list: [{ key, label0, position, centroid, count, onClick?, label?() }]
   * A tag with `label()` shows that text as-is; otherwise "<label0> · <distance> m".
   */
  function setTags(list) {
    for (const t of tags) t.el.remove()
    tags = list.map((t) => addTag(t))
  }

  function addTag(t) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'lego-tag'
    const tag = { ...t, el, text: '' }
    el.addEventListener('click', (e) => { e.stopPropagation(); tag.onClick ? tag.onClick(tag) : openCard(tag) })
    el.addEventListener('pointerdown', (e) => e.stopPropagation())
    tagsEl.appendChild(el)
    return tag
  }

  function pushTag(t) {
    const tag = addTag(t)
    tags.push(tag)
    return tag
  }

  /** Project tags every frame. metresPerUnit converts world distance to the displayed number. */
  const NARROW_TAG_METRES = 260
  function updateTags(camera, width, height, metresPerUnit) {
    for (const t of tags) {
      if (t.hidden) { if (t.el.style.display !== 'none') t.el.style.display = 'none'; continue }
      _v.copy(t.position).project(camera)
      const behind = _v.z > 1 || _v.z < -1
      const x = (_v.x * 0.5 + 0.5) * width, y = (-_v.y * 0.5 + 0.5) * height
      const off = behind || x < -200 || x > width + 200 || y < -60 || y > height + 60
      if (off) { if (t.el.style.display !== 'none') t.el.style.display = 'none'; continue }
      if (t.el.style.display === 'none') t.el.style.display = ''
      let text
      const metres = Math.round(camera.position.distanceTo(t.position) * metresPerUnit)
      // On a phone the stand tags pile up in the overview; show them only once you fly closer.
      if (!t.label && width < 640 && metres > NARROW_TAG_METRES) { t.el.style.display = 'none'; continue }
      if (t.label) text = t.label()
      else text = `${t.label0} · ${metres} m`
      if (text !== t.text) { t.el.textContent = text; t.text = text }
      t.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, calc(-100% - 8px))`
      t.el.style.zIndex = String(1000 - Math.round(_v.z * 900))
    }
  }

  function openCard(tag) {
    active = tag
    for (const t of tags) t.el.classList.toggle('active', t === tag)
    const inf = info[tag.key] || {}
    q(card, '.lego-card-title').textContent = inf.title || tag.label0
    q(card, '.lego-card-kicker').textContent = inf.kicker || ''
    q(card, '.lego-card-text').textContent = inf.body || ''
    q(card, '.lego-card-img-label').textContent = tag.key
    q(card, '.lego-card-meta').textContent = `BRICKS · ${tag.count.toLocaleString('en')}`
    card.classList.add('open')
    card.setAttribute('aria-hidden', 'false')
  }

  function closeCard() {
    if (!card.classList.contains('open')) return false
    active = null
    for (const t of tags) t.el.classList.remove('active')
    card.classList.remove('open')
    card.setAttribute('aria-hidden', 'true')
    return true
  }

  function setMovedCount(n) {
    resetBricksBtn.hidden = n === 0
    resetBricksBtn.textContent = `Reset bricks (${n})`
  }

  return { setTags, pushTag, updateTags, openCard, closeCard, setMovedCount, el: { bar, tags: tagsEl, card } }
}
