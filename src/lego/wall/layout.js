// Deterministic running-bond layout for a wall of 1x2x3 bricks.
// Brick n (0-based, in insertion order) → row/col. Each row fills from the
// CENTRE outwards (centre, right, left, right, left…) so a young wall reads as
// a small pile in front of the stadium rather than a lonely brick at one end;
// odd rows shift by one stud so vertical joints never line up, like real
// brickwork. Positions depend only on n, so nothing is stored.
//
// Units: studs along the wall (x), plates up (y). A 1x2x3 brick is 2 studs
// wide and 3 plates tall. Row r sits at y = 3r plates.

export const BRICK_STUDS = 2
export const BRICK_PLATES = 3

function centreOut(k, width) {
  // k-th brick of a row → column index, alternating around the middle
  const mid = Math.floor((width - 1) / 2)
  const step = Math.ceil(k / 2)
  return k % 2 ? mid + step : mid - step
}

export function slot(n, width = 16) {
  const row = Math.floor(n / width)
  const col = centreOut(n % width, width)
  const shift = row % 2 ? 1 : 0 // studs
  return {
    row,
    col,
    x: col * BRICK_STUDS + shift, // left edge, in studs
    y: row * BRICK_PLATES, // bottom edge, in plates
  }
}

export function wallExtent(count, width = 16) {
  const rows = Math.max(1, Math.ceil(count / width))
  return { studs: width * BRICK_STUDS + 1, plates: rows * BRICK_PLATES, rows }
}
