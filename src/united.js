// Embeds the LEGO stadium as the letter page's continuation: scroll past the
// letter and the ground assembles itself brick by brick, then hands the camera
// to the visitor (drag to turn, scroll to zoom, click a brick to lift it).
//
// Nothing 3D happens while the letter is being read: the stadium module (three
// + the engine) is only imported, and the model only fetched, once the section
// is a viewport away, so the envelope animation never fights them for the main
// thread. The drop starts when the section is 35% on screen, and the render loop
// only runs while it is visible.

const section    = document.getElementById('stadium-live')
const canvas     = document.getElementById('stadium-canvas')
const loadingEl  = document.getElementById('stadium-loading')
const loadingBar = document.getElementById('stadium-loading-bar')
const hintEl     = document.getElementById('stadium-hint')

const coarse = window.matchMedia('(pointer: coarse)').matches
hintEl.textContent = coarse
  ? 'drag to turn · pinch to zoom · tap a brick to lift it'
  : 'drag to turn · scroll to zoom · click a brick to lift it'

let stadium = null     // resolved API
let booting = null     // Promise<API>
let wantStart = false
let visible = true

function boot() {
  if (booting) return booting
  booting = import('./stadium.js').then(({ initStadium }) => {
    stadium = initStadium(canvas, {
      root: section,
      autoStart: false,
      onProgress: (p) => {
        loadingBar.style.width = `${Math.round(p * 100)}%`
        if (p >= 1) loadingEl.classList.add('done')
      },
      onAssemblyDone: () => {
        stadium.enableOrbit()
        section.classList.add('assembled')
        hintEl.classList.add('visible')
        setTimeout(() => hintEl.classList.remove('visible'), 3500)
      },
    })
    stadium.setActive(visible)
    if (wantStart) stadium.start()

    // Render only while the section is actually on screen.
    new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting)
        stadium.setActive(visible)
      },
      { rootMargin: '15% 0px' },
    ).observe(section)
    return stadium
  })
  booting.catch((err) => console.error('[stadium] failed to start', err))
  return booting
}

// Start fetching once the reader is most of the way through the letter (a
// viewport before the section), and drop the bricks when it is properly on screen.
const nearIO = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      boot()
      nearIO.disconnect()
    }
  },
  { rootMargin: '100% 0px' },
)
nearIO.observe(section)

const startIO = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      wantStart = true
      boot()
      stadium?.start()
      startIO.disconnect()
    }
  },
  { threshold: 0.35 },
)
startIO.observe(section)

// A tap hurries the drop along.
canvas.addEventListener('pointerdown', () => stadium?.hurryAssembly())
