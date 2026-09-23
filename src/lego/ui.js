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

export function createUI({ root, info = {}, onResetView, onResetBricks, onFlyTo, onBack, onHoldAction } = {}) {
  const bar = document.createElement('div')
  bar.className = 'lego-bar'
  bar.innerHTML = `
    <button class="lego-pill lego-back" type="button">↑ Back to the letter</button>
    <div class="lego-actions">
      <button class="lego-chip lego-reset-bricks" type="button" hidden>Reset bricks</button>
      <button class="lego-chip lego-reset-view" type="button">Reset view</button>
      <button class="lego-chip lego-help-btn" type="button" aria-label="How to play">?</button>
    </div>`
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const help = document.createElement('aside')
  help.className = 'lego-help'
  help.setAttribute('aria-hidden', 'true')
  help.innerHTML = coarse
    ? `
    <div class="lego-help-head"><span>HOW TO PLAY</span><button class="lego-help-close" type="button" aria-label="Close">✕</button></div>
    <dl class="lego-help-list">
      <dt>Drag</dt><dd>turn the stadium</dd>
      <dt>Pinch</dt><dd>zoom · two fingers slide</dd>
      <dt>Double-tap</dt><dd>zoom in on a spot</dd>
      <dt>Tap a brick</dt><dd>lift it, drag to carry, tap to drop</dd>
      <dt>While holding</dt><dd>buttons appear to rotate, raise, lower or put it back</dd>
      <dt>Reset bricks</dt><dd>rebuilds the stadium</dd>
    </dl>`
    : `
    <div class="lego-help-head"><span>HOW TO PLAY</span><button class="lego-help-close" type="button" aria-label="Close">✕</button></div>
    <dl class="lego-help-list">
      <dt>Drag</dt><dd>turn the stadium</dd>
      <dt>Scroll</dt><dd>zoom · right-drag slides · WASD flies</dd>
      <dt>Double-click</dt><dd>zoom in on a spot</dd>
      <dt>Click a brick</dt><dd>lift it, move the mouse to carry it, click to drop</dd>
      <dt>R · ← →</dt><dd>rotate the brick you're holding</dd>
      <dt>Scroll · ↑ ↓</dt><dd>raise or lower it, one plate at a time</dd>
      <dt>Esc</dt><dd>put it back where it was</dd>
      <dt>Reset bricks</dt><dd>rebuilds the whole stadium</dd>
    </dl>`
  const hold = document.createElement('div')
  hold.className = 'lego-hold'
  hold.setAttribute('aria-hidden', 'true')
  hold.innerHTML = `
    <span class="lego-hold-label">HOLDING A BRICK</span>
    <button class="lego-mono-btn" data-act="rotate" type="button">↻ Rotate${coarse ? '' : ' (R)'}</button>
    <button class="lego-mono-btn" data-act="up" type="button">▲ Raise</button>
    <button class="lego-mono-btn" data-act="down" type="button">▼ Lower</button>
    <button class="lego-mono-btn" data-act="drop" type="button">Drop${coarse ? '' : ' (click)'}</button>
    <button class="lego-mono-btn" data-act="cancel" type="button">Put back${coarse ? '' : ' (Esc)'}</button>`
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
  root.append(tagsEl, card, hold, help, bar)

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
  for (const el of [bar, card, help, hold]) el.addEventListener('pointerdown', (e) => e.stopPropagation())
  q(bar, '.lego-help-btn').addEventListener('click', () => (help.classList.contains('open') ? closeHelp() : openHelp()))
  q(help, '.lego-help-close').addEventListener('click', () => closeHelp(true))
  hold.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (b) onHoldAction?.(b.dataset.act)
  })

  const HELP_KEY = 'dear-united:lego-help-seen'
  function openHelp() { help.classList.add('open'); help.setAttribute('aria-hidden', 'false') }
  function closeHelp(remember = false) {
    help.classList.remove('open'); help.setAttribute('aria-hidden', 'true')
    if (remember) { try { localStorage.setItem(HELP_KEY, '1') } catch { /* private mode */ } }
  }
  /** Show the how-to once per browser; the ? chip reopens it any time. */
  function showHelpOnce() {
    let seen = false
    try { seen = localStorage.getItem(HELP_KEY) === '1' } catch { /* ignore */ }
    if (!seen) openHelp()
  }
  function setHolding(v) { hold.classList.toggle('open', !!v); hold.setAttribute('aria-hidden', v ? 'false' : 'true') }

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

  return { setTags, pushTag, updateTags, openCard, closeCard, setMovedCount, openHelp, closeHelp, showHelpOnce, setHolding, el: { bar, tags: tagsEl, card, help, hold } }
}
