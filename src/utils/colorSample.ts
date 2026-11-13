import type { Rect } from '../types'
import { rgbToHex } from './misc'

const Q = 0xf0 // quantize each channel to 16 levels (bucket key)

interface Bucket {
  n: number
  r: number
  g: number
  b: number
}

function bump(counts: Map<number, Bucket>, r: number, g: number, b: number): void {
  const key = ((Q & r) << 8) | ((Q & g) << 4) | (Q & b)
  const cur = counts.get(key)
  if (cur) {
    cur.n++
    cur.r += r
    cur.g += g
    cur.b += b
  } else {
    counts.set(key, { n: 1, r, g, b })
  }
}

/** Average real pixel value of the most frequent bucket — exact color, no quantization offset. */
function dominantColor(counts: Map<number, Bucket>): string | null {
  let best: Bucket | null = null
  for (const b of counts.values()) {
    if (!best || b.n > best.n) best = b
  }
  if (!best) return null
  return rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n)
}

/**
 * Sample the rendered page canvas around a text line rect to estimate the
 * background fill color (so the cover rectangle blends in) and the text color.
 */
export function sampleColors(
  canvas: HTMLCanvasElement | null,
  rect: Rect,
  zoom: number,
): { bg: string; text: string } {
  const fallback = { bg: '#ffffff', text: '#111111' }
  if (!canvas || canvas.width === 0 || canvas.height === 0) return fallback
  const ctx = canvas.getContext('2d')
  if (!ctx) return fallback

  const sx = Math.max(0, Math.floor(rect.x * zoom))
  const sy = Math.max(0, Math.floor(rect.y * zoom))
  const sw = Math.min(canvas.width - sx, Math.ceil(rect.w * zoom))
  const sh = Math.min(canvas.height - sy, Math.ceil(rect.h * zoom))
  if (sw <= 2 || sh <= 2) return fallback

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(sx, sy, sw, sh).data
  } catch {
    return fallback
  }

  const px = (ix: number, iy: number): [number, number, number, number] => {
    const i = (iy * sw + ix) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }

  // --- background: rows near the top and bottom edges of the line box ---
  const bgCounts = new Map<number, Bucket>()
  const bgRows = [0.08, 0.15, 0.88, 0.95].map((f) =>
    Math.min(sh - 1, Math.max(0, Math.round(f * (sh - 1)))),
  )
  for (const iy of bgRows) {
    for (let ix = 0; ix < sw; ix += 2) {
      const [r, g, b, a] = px(ix, iy)
      if (a < 200) continue
      bump(bgCounts, r, g, b)
    }
  }

  // --- text color: dominant glyph-colored pixel cluster in the middle band ---
  const textCounts = new Map<number, Bucket>()
  const midRows = [0.35, 0.5, 0.65].map((f) => Math.round(f * (sh - 1)))
  for (const iy of midRows) {
    for (let ix = 0; ix < sw; ix++) {
      const [r, g, b, a] = px(ix, iy)
      if (a < 200) continue
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (lum > 200) continue
      bump(textCounts, r, g, b)
    }
  }

  return {
    bg: dominantColor(bgCounts) ?? fallback.bg,
    text: dominantColor(textCounts) ?? fallback.text,
  }
}

/**
 * Estimate the background color AROUND a drawn region by sampling a ring of
 * pixels just outside its edges (the "eraser" tool fills with this color so
 * the region blends with its surroundings).
 */
export function sampleRegionBg(
  canvas: HTMLCanvasElement | null,
  rect: Rect,
  zoom: number,
): string {
  const fallback = '#ffffff'
  if (!canvas || canvas.width === 0 || canvas.height === 0) return fallback
  const ctx = canvas.getContext('2d')
  if (!ctx) return fallback

  const cx = rect.x * zoom
  const cy = rect.y * zoom
  const cw = rect.w * zoom
  const ch = rect.h * zoom
  const pad = 4
  const pts: Array<[number, number]> = []
  for (let f = 0.1; f < 1; f += 0.12) {
    pts.push([cx + cw * f, cy - pad], [cx + cw * f, cy + ch + pad])
    pts.push([cx - pad, cy + ch * f], [cx + cw + pad, cy + ch * f])
  }
  // also a few points inside the very edges (when surroundings are clipped)
  pts.push([cx + 2, cy + 2], [cx + cw - 2, cy + 2], [cx + 2, cy + ch - 2], [cx + cw - 2, cy + ch - 2])

  const counts = new Map<number, Bucket>()
  for (const [x, y] of pts) {
    const sx = Math.round(Math.min(Math.max(x, 0), canvas.width - 1))
    const sy = Math.round(Math.min(Math.max(y, 0), canvas.height - 1))
    let d: Uint8ClampedArray
    try {
      d = ctx.getImageData(sx, sy, 1, 1).data
    } catch {
      return fallback
    }
    const [r, g, b, a] = [d[0], d[1], d[2], d[3]]
    if (a < 200) continue
    bump(counts, r, g, b)
  }
  return dominantColor(counts) ?? fallback
}
