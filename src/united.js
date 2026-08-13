// Embeds the stadium as the letter page's continuation: scroll past the
// letter and the ground assembles itself, then hands the camera to the
// visitor — drag (mouse or finger) rotates around it. No story, no buttons.
import { initStadium } from './stadium.js'

const section    = document.getElementById('stadium-live')
const canvas     = document.getElementById('stadium-canvas')
const loadingEl  = document.getElementById('stadium-loading')
const loadingBar = document.getElementById('stadium-loading-bar')
const hintEl     = document.getElementById('stadium-hint')

const stadium = initStadium(canvas, {
  autoStart: false,
  onProgress: (p) => {
    loadingBar.style.width = `${Math.round(p * 100)}%`
    if (p >= 1) loadingEl.classList.add('done')
  },
  onAssemblyDone: () => {
    stadium.enableOrbit()
    hintEl.classList.add('visible')
    section.classList.add('assembled')
  },
})

// Same settle-from-wide framing the stadium page uses, ending on the
// explore camera; both waypoints identical so scroll never moves it.
const view = { position: [0.55, 0.42, 0.55], lookAt: [0.04, 0.1, 0.1] }
stadium.setPath([view, { ...view }])

// The drop starts the first time the section is properly on screen.
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        stadium.start()
        io.disconnect()
      }
    }
  },
  { threshold: 0.35 },
)
io.observe(section)

// A tap hurries the drop along, same as the stadium page.
canvas.addEventListener('pointerdown', () => stadium.hurryAssembly())
