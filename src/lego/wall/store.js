// Fan-wall storage. Talks to Supabase's REST endpoint directly (no SDK), and
// falls back to localStorage when no Supabase config is present so the wall
// works in dev and in previews.
//
// Config lives in ./config.js (public URL + anon key; RLS does the protecting).

export const COLORS = ['red', 'white', 'black', 'gray', 'yellow', 'blue', 'green', 'beige']
export const MAX_MESSAGE = 280
export const MAX_NAME = 40

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
// Accept the project URL with or without a trailing /rest/v1/ (both get pasted).
const URL = String(SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const KEY = String(SUPABASE_ANON_KEY || '').trim()
const TABLE = 'wall_bricks'
const LS_KEY = 'lego-trafford:wall'

export const FOUNDING_BRICK = {
  id: 1,
  color: 'red',
  message: 'Manchester is my heaven.',
  name: 'Nazym',
  lang: 'en',
  created_at: '2026-09-22T00:00:00Z',
}

export function isLive() {
  return Boolean(URL && KEY)
}

function headers(extra = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export function sanitize({ color, message, name, lang }) {
  const c = COLORS.includes(color) ? color : 'red'
  const m = String(message || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE)
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || null
  const l = String(lang || navigator.language || 'en').slice(0, 12)
  if (!m) throw new Error('Write something first.')
  return { color: c, message: m, name: n, lang: l }
}

export async function listBricks() {
  if (!isLive()) return readLocal()
  const res = await fetch(`${URL}/rest/v1/${TABLE}?select=id,color,message,name,lang,created_at&order=id.asc`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`wall load failed (${res.status})`)
  const rows = await res.json()
  return rows.length ? rows : [FOUNDING_BRICK]
}

export async function addBrick(input) {
  const row = sanitize(input)
  if (!isLive()) return writeLocal(row)
  const res = await fetch(`${URL}/rest/v1/${TABLE}?select=id,color,message,name,lang,created_at`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    let msg = `could not add brick (${res.status})`
    try { msg = (await res.json()).message || msg } catch { /* keep default */ }
    throw new Error(msg)
  }
  const [saved] = await res.json()
  return saved
}

// ---- localStorage fallback -------------------------------------------------

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const rows = raw ? JSON.parse(raw) : []
    return [FOUNDING_BRICK, ...rows]
  } catch {
    return [FOUNDING_BRICK]
  }
}

function writeLocal(row) {
  const rows = readLocal().slice(1)
  const saved = { ...row, id: rows.length + 2, created_at: new Date().toISOString() }
  rows.push(saved)
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)) } catch { /* private mode */ }
  return saved
}
