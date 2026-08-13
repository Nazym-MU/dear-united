// Embeds the stadium as the letter page's continuation: scroll past the
// letter and the ground assembles itself, then hands the camera to the
// visitor — drag rotates, pinch (or trackpad pinch / ctrl+wheel) zooms.
//
// Nothing 3D happens while the letter is being read: the module, model
// fetch, and render loop all wait until the stadium section approaches,
// so the envelope animation never fights the GLB parse for the main
// thread.
import { initStadium } from './stadium.js'

const section    = document.getElementById('stadium-live')
const canvas     = document.getElementById('stadium-canvas')
const loadingEl  = document.getElementById('stadium-loading')
const loadingBar = document.getElementById('stadium-loading-bar')
const hintEl     = document.getElementById('stadium-hint')

let stadium = null

function boot() {
  if (stadium) return
  stadium = initStadium(canvas, {
    autoStart: false,
    onProgress: (p) => {
      loadingBar.style.width = `${Math.round(p * 100)}%`
      if (p >= 1) loadingEl.classList.add('done')
    },
    onAssemblyDone: () => {
      stadium.enableOrbit()
      section.classList.add('assembled')
      hintEl.classList.add('visible')
      setTimeout(() => hintEl.classList.remove('visible'), 2000)
    },
  })

  // Same settle-from-wide framing the stadium page uses, ending on the
  // explore camera; both waypoints identical so scroll never moves it.
  const view = { position: [0.55, 0.42, 0.55], lookAt: [0.04, 0.1, 0.1] }
  stadium.setPath([view, { ...view }])

  // Render only while the section is actually on screen.
  new IntersectionObserver(
    (entries) => stadium.setActive(entries.some((e) => e.isIntersecting)),
    { rootMargin: '15% 0px' },
  ).observe(section)
}

// Start fetching the model once the reader is most of the way through the
// letter (a viewport before the section), and drop the pieces when it is
// properly on screen.
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
      boot()
      stadium.start()
      startIO.disconnect()
    }
  },
  { threshold: 0.35 },
)
startIO.observe(section)

// A tap hurries the drop along, same as the stadium page.
canvas.addEventListener('pointerdown', () => stadium?.hurryAssembly())
