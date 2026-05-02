import { useEffect, useRef } from 'react'
import { prepare, layout, prepareWithSegments, layoutNextLineRange, materializeLineRange } from '@chenglou/pretext'

// One text block per camera stop (10 total, matching stops in stands.js).
// Text is split across multiple lines with \n so pretext can fit-to-screen.
const QUOTES = [
  // 0 — wide aerial overview
  {
    text: 'OLD\nTRAFFORD\nOPENED\n19 FEB\n1910.\nCAPACITY:\n74,310.\nTHE LARGEST\nCLUB STADIUM\nIN ENGLAND.',
    attribution: 'The Theatre of Dreams — Est. 1910',
  },
  // 1 — East Stand, mid-height
  {
    text: 'THE EAST\nSTAND.\nBUILT 1965.\nBOMBED\nBY THE\nLUFTWAFFE\nIN 1941.\nREBUILT\nFROM\nTHE ASHES.',
    attribution: 'East Stand — Capacity 11,500',
  },
  // 2 — East Stand, low dramatic
  {
    text: 'THE\nMANCHESTER\nUNITED\nMUSEUM\nHOLDS\n20 LEAGUE\nTITLES.\n3 EUROPEAN\nCUPS.\n1 CENTURY\nOF GLORY.',
    attribution: 'Manchester United Museum & Tour Centre',
  },
  // 3 — Stretford End, front-on
  {
    text: 'THE\nSTRETFORD\nEND.\nTHE MOST\nFEARED\nTERRACE\nIN ENGLISH\nFOOTBALL.\n16,000\nVOICES\nAS ONE.',
    attribution: 'Stretford End — Capacity 16,000',
  },
  // 4 — Stretford End, high corner
  {
    text: 'I NEVER\nWANTED\nMANCHESTER\nUNITED\nTO BE\nSECOND\nTO\nANYBODY.\nONLY THE\nBEST WOULD\nBE GOOD\nENOUGH.',
    attribution: '— Sir Alex Ferguson',
  },
  // 5 — Sir Alex Ferguson Stand, opposite side
  {
    text: 'SIR ALEX\nFERGUSON.\n26 YEARS.\n13 PREMIER\nLEAGUE\nTITLES.\n5 FA CUPS.\n2 CHAMPIONS\nLEAGUES.\nNEVER\nSECOND.',
    attribution: 'Sir Alex Ferguson Stand — Capacity 25,500',
  },
  // 6 — SAF Stand, high sweep
  {
    text: 'NOVEMBER\n1986.\nFERGUSON\nARRIVED.\nUNITED\nWERE\nBOTTOM\nHALF.\nHE LEFT\nTHEM\nTHE\nGREATEST\nCLUB\nON EARTH.',
    attribution: 'Sir Alex Ferguson, 1986–2013',
  },
  // 7 — Sir Bobby Charlton Stand
  {
    text: 'SIR BOBBY\nCHARLTON.\nMUNICH\nSURVIVOR.\nWORLD CUP\nWINNER.\n249 GOALS\nFOR UNITED.\nA BRONZE\nSTATUE AND\nAN ETERNAL\nFLAME.',
    attribution: 'Sir Bobby Charlton Stand — 6 Feb 1958',
  },
  // 8 — Pitch level, dramatic low
  {
    text: 'THIS\nPITCH.\nBEST,\nLAW AND\nCHARLTON\nDANCED\nHERE.\nCRUYFF\nFELL HERE.\nRONALDO\nWAS BORN\nHERE.',
    attribution: 'The Pitch, Old Trafford',
  },
  // 9 — Pure aerial outro
  {
    text: '74,310\nSEATS.\n115 YEARS.\n20 LEAGUES.\n3 EUROPEAN\nCUPS.\n1 DREAM.\nNEVER\nFORGET\nWHERE\nYOU CAME\nFROM.',
    attribution: '',
  },
]

const FADE_ZONE = 0.3  // fraction of each segment used for crossfade

/**
 * Use pretext to binary-search the largest font size where the full
 * text fits within (availW × availH). Returns the font size in px.
 *
 * prepare() does the one-time measurement; layout() is pure arithmetic —
 * no DOM reflow, no getBoundingClientRect.
 */
function fitFontSize(text, availW, availH, fontFamily, minSize = 18, maxSize = 300) {
  // Replace \n with spaces for single-block measurement — pretext treats \n as hard break
  let lo = minSize
  let hi = maxSize
  let best = minSize

  for (let iter = 0; iter < 14; iter++) {
    const mid = Math.floor((lo + hi) / 2)
    const font = `900 ${mid}px ${fontFamily}`
    // Use lineHeight = mid * 1.05 for tight fit
    const lineH = mid * 1.05
    const prepared = prepare(text, font, { whiteSpace: 'pre-wrap' })
    const { height } = layout(prepared, availW, lineH)

    if (height <= availH) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return best
}

/**
 * Draw one quote onto the canvas using pretext layoutNextLineRange
 * for variable-width flow around a circular exclusion zone (the 3D model).
 * Font size is auto-fit so the full text fills the available area.
 */
function drawQuote(ctx, W, H, quote, attribution, alpha) {
  if (alpha < 0.004) return

  const padX = W * 0.06
  const padY = H * 0.06
  const availW = W - padX * 2
  const availH = H - padY * 2 - (attribution ? 40 : 0)

  // Binary-search the font size that fills the viewport
  const FAMILY = "'Playfair Display', Georgia, serif"
  const fontSize = fitFontSize(quote.text, availW, availH, FAMILY)
  const lineH = fontSize * 1.05
  const font = `900 ${fontSize}px ${FAMILY}`

  // Exclusion circle — where the 3D model sits
  const cx = W * 0.62
  const cy = H * 0.50
  const R  = Math.min(W, H) * 0.28

  ctx.font = font
  ctx.textBaseline = 'top'

  const prepared = prepareWithSegments(quote.text, font, { whiteSpace: 'pre-wrap' })
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = padY

  while (y < H - lineH * 0.5) {
    const midY = y + lineH * 0.5
    const dy = midY - cy
    const chordHalf = Math.abs(dy) < R ? Math.sqrt(R * R - dy * dy) : 0
    const circleLeft  = cx - chordHalf - 6
    const circleRight = cx + chordHalf + 6

    const leftW  = Math.max(0, circleLeft - padX)
    const rightW = Math.max(0, W - padX - circleRight)

    let advanced = false

    if (leftW >= fontSize * 1.2) {
      const range = layoutNextLineRange(prepared, cursor, leftW)
      if (range === null) break

      const line = materializeLineRange(prepared, range)
      ctx.fillStyle = `rgba(240, 236, 226, ${alpha * 0.22})`
      ctx.fillText(line.text, padX, y)
      cursor = range.end
      advanced = true

      // Continue same row on the right of the circle
      if (rightW >= fontSize * 1.2) {
        const rRange = layoutNextLineRange(prepared, cursor, rightW)
        if (rRange !== null) {
          const rLine = materializeLineRange(prepared, rRange)
          ctx.fillText(rLine.text, circleRight, y)
          cursor = rRange.end
        }
      }
    } else if (rightW >= fontSize * 1.2) {
      const range = layoutNextLineRange(prepared, cursor, rightW)
      if (range === null) break

      const line = materializeLineRange(prepared, range)
      ctx.fillStyle = `rgba(240, 236, 226, ${alpha * 0.22})`
      ctx.fillText(line.text, circleRight, y)
      cursor = range.end
      advanced = true
    }

    // If both sides blocked by circle at this row — skip the row
    if (!advanced) {
      y += lineH
      continue
    }

    y += lineH
  }

  // Attribution label
  if (attribution) {
    const aSize = Math.max(12, Math.round(fontSize * 0.22))
    ctx.font = `400 italic ${aSize}px ${FAMILY}`
    ctx.fillStyle = `rgba(197, 165, 90, ${alpha * 0.7})`
    ctx.fillText(attribution, padX, H - padY - aSize)
  }
}

// ─── Animated state (lives outside React to survive re-renders) ──────────────
let animAlphaA = 1   // alpha of quote A
let animAlphaB = 0   // alpha of quote B
let animIdxA = 0     // which quote is A
let animIdxB = 0     // which quote is B
let rafId = null

export default function TextCanvas({ scrollProgress }) {
  const canvasRef = useRef()
  // Track the "target" quote derived from scroll
  const targetIdxRef = useRef(0)
  const scrollRef = useRef(scrollProgress)

  // Update scroll ref synchronously on every render
  scrollRef.current = scrollProgress

  // Derive target index from scroll
  const n = QUOTES.length
  const raw = Math.max(0, Math.min(scrollProgress, 0.9999)) * (n - 1)
  const targetIdx = Math.round(raw)  // snap to nearest quote
  targetIdxRef.current = targetIdx

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function draw() {
      const W = canvas.width
      const H = canvas.height

      // Determine target from scroll
      const n = QUOTES.length
      const rawIdx = Math.max(0, Math.min(scrollRef.current, 0.9999)) * (n - 1)
      const target = Math.round(rawIdx)

      // If target changed, start crossfade: B becomes new quote, fade out A → fade in B
      if (target !== animIdxB) {
        // Swap: A takes over B's current values so fade-out continues smoothly
        animIdxA  = animIdxB
        animAlphaA = animAlphaB
        animIdxB  = target
        animAlphaB = 0
      }

      // Animate alphas
      const SPEED = 0.035
      animAlphaA = Math.max(0, animAlphaA - SPEED)
      animAlphaB = Math.min(1, animAlphaB + SPEED)

      // Draw
      ctx.clearRect(0, 0, W, H)
      if (animAlphaA > 0.004) drawQuote(ctx, W, H, QUOTES[animIdxA], QUOTES[animIdxA].attribution, animAlphaA)
      if (animAlphaB > 0.004) drawQuote(ctx, W, H, QUOTES[animIdxB], QUOTES[animIdxB].attribution, animAlphaB)

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
