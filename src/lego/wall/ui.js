// Fan-wall UI: a floating "Add your brick" button, the compose sheet, and the
// message card shown when a wall brick is clicked. Pure DOM; styles in wall.css.
import { COLORS, MAX_MESSAGE, MAX_NAME, addBrick, isLive } from './store.js'

const SWATCH = {
  red: '#c8102e', white: '#f2ede4', black: '#2a2d36', gray: '#8d9099',
  yellow: '#f2c14e', blue: '#1b4fb5', green: '#2e8b3a', beige: '#d9b072',
}

export function mountWallUI({ root = document.body, onAdded, onOpen, onClose } = {}) {
  const el = document.createElement('div')
  el.className = 'wall-ui'
  el.innerHTML = `
    <button class="wall-add" type="button">+ Add your brick</button>
    <form class="wall-sheet" hidden>
      <div class="wall-sheet-head">
        <span class="wall-kicker">FAN WALL · 1×2×3</span>
        <button class="wall-close" type="button" aria-label="Close">✕</button>
      </div>
      <h2 class="wall-title">Leave a brick on the wall</h2>
      <p class="wall-hint">A memory, a chant, a thank-you. Any language.</p>
      <div class="wall-colors" role="radiogroup" aria-label="Brick colour">
        ${COLORS.map((c, i) => `
          <label class="wall-swatch" style="--c:${SWATCH[c]}">
            <input type="radio" name="color" value="${c}" ${i === 0 ? 'checked' : ''}>
            <span></span>
          </label>`).join('')}
      </div>
      <textarea name="message" maxlength="${MAX_MESSAGE}" rows="4" required
        placeholder="What does Manchester mean to you?"></textarea>
      <div class="wall-row">
        <input name="name" maxlength="${MAX_NAME}" placeholder="Your name (optional)">
        <span class="wall-count">0/${MAX_MESSAGE}</span>
      </div>
      <input name="website" class="wall-hp" tabindex="-1" autocomplete="off">
      <div class="wall-actions">
        <button class="wall-submit" type="submit">PLACE BRICK</button>
        <span class="wall-status" aria-live="polite"></span>
      </div>
    </form>
    <aside class="wall-card" hidden>
      <div class="wall-card-head">
        <span class="wall-card-when"></span>
        <span class="wall-card-color"></span>
        <button class="wall-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="wall-card-message"></p>
      <div class="wall-card-who"></div>
    </aside>`
  root.appendChild(el)

  const addBtn = el.querySelector('.wall-add')
  const sheet = el.querySelector('.wall-sheet')
  const card = el.querySelector('.wall-card')
  const status = el.querySelector('.wall-status')
  const count = el.querySelector('.wall-count')
  const ta = sheet.querySelector('textarea')
  let lastSubmit = 0

  const open = () => { card.hidden = true; sheet.hidden = false; ta.focus(); onOpen?.() }
  const close = () => { sheet.hidden = true; card.hidden = true; status.textContent = ''; onClose?.() }
  addBtn.addEventListener('click', open)
  el.querySelectorAll('.wall-close').forEach((b) => b.addEventListener('click', close))
  ta.addEventListener('input', () => { count.textContent = `${ta.value.length}/${MAX_MESSAGE}` })
  sheet.addEventListener('keydown', (e) => e.stopPropagation()) // keep WASD out of the fly controls

  sheet.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (sheet.website.value) return // honeypot
    if (lastSubmit && performance.now() - lastSubmit < 15000) { status.textContent = 'One brick at a time.'; return }
    const fd = new FormData(sheet)
    status.textContent = 'Placing…'
    sheet.querySelector('.wall-submit').disabled = true
    try {
      const saved = await addBrick({
        color: fd.get('color'), message: fd.get('message'), name: fd.get('name'), lang: navigator.language,
      })
      lastSubmit = performance.now()
      sheet.reset(); count.textContent = `0/${MAX_MESSAGE}`
      status.textContent = isLive() ? 'On the wall.' : 'On the wall (saved on this device only).'
      onAdded?.(saved)
      setTimeout(close, 900)
    } catch (err) {
      status.textContent = err.message || 'Something went wrong.'
    } finally {
      sheet.querySelector('.wall-submit').disabled = false
    }
  })

  function showBrick(brick) {
    sheet.hidden = true
    card.hidden = false
    const d = brick.created_at ? new Date(brick.created_at) : null
    card.querySelector('.wall-card-when').textContent = d
      ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase() : ''
    card.querySelector('.wall-card-color').textContent = (brick.color || '').toUpperCase()
    card.querySelector('.wall-card-color').style.setProperty('--c', SWATCH[brick.color] || '#888')
    card.querySelector('.wall-card-message').textContent = brick.message
    card.querySelector('.wall-card-who').textContent = brick.name ? `— ${brick.name}` : '— a fan'
    onOpen?.()
  }

  return { el, open, close, showBrick }
}
