// Tiny synthesised LEGO sounds (no audio files): a "click" when a brick is pulled off,
// a "snap" when it seats, a "tick" when it turns. Built with the Web Audio API on the
// first user gesture, so autoplay rules are satisfied and nothing loads up front.
let ctx = null
let master = null
let muted = false
let noise = null

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.35
  master.connect(ctx.destination)
  // 60 ms of white noise, reused for every click
  const n = Math.floor(ctx.sampleRate * 0.06)
  noise = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** Call from a pointer/touch handler so the context can start (Safari needs a gesture). */
export function unlock() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function setMuted(v) { muted = !!v }
export function isMuted() { return muted }

function burst(t, { freq, q = 8, gain, ms }) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000)
  src.connect(bp).connect(g).connect(master)
  src.start(t); src.stop(t + ms / 1000 + 0.02)
}

function tone(t, { freq, type = 'sine', gain, ms, slide = 0 }) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + ms / 1000)
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000)
  o.connect(g).connect(master)
  o.start(t); o.stop(t + ms / 1000 + 0.02)
}

const jitter = (k) => 1 + (Math.random() * 2 - 1) * k

/**
 * kind: 'lift' (pull a brick off), 'snap' (seat it), 'tick' (rotate), 'place' (a wall
 * brick lands — a heavier snap).
 */
export function play(kind = 'snap') {
  if (muted) return
  const c = ensure()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const t = c.currentTime + 0.005
  switch (kind) {
    case 'lift':
      // plastic release: bright click, slightly softer, with a short scrape
      burst(t, { freq: 4200 * jitter(0.08), q: 6, gain: 0.5, ms: 28 })
      burst(t + 0.012, { freq: 2600 * jitter(0.1), q: 3, gain: 0.18, ms: 60 })
      break
    case 'tick':
      burst(t, { freq: 3600 * jitter(0.1), q: 10, gain: 0.3, ms: 18 })
      break
    case 'place':
      burst(t, { freq: 3000 * jitter(0.08), q: 6, gain: 0.7, ms: 26 })
      tone(t, { freq: 150 * jitter(0.06), gain: 0.35, ms: 110, slide: 0.55 })
      break
    case 'snap':
    default:
      // the LEGO click: sharp bright transient + a hollow low "thock" from the brick body
      burst(t, { freq: 3400 * jitter(0.08), q: 7, gain: 0.7, ms: 22 })
      tone(t, { freq: 1900 * jitter(0.05), type: 'triangle', gain: 0.12, ms: 30, slide: 0.6 })
      tone(t + 0.004, { freq: 210 * jitter(0.06), gain: 0.28, ms: 85, slide: 0.6 })
      break
  }
}
