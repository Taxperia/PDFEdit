import type { Rect } from '../types'

export type Mat = [number, number, number, number, number, number]

/** Invert the PDF -> viewport transform supplied by pdf.js (including CropBox offsets). */
export function invertTransform([a, b, c, d, e, f]: Mat): Mat {
  const det = a * d - b * c
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new Error('Invalid page transform')
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

/** Map a point from page viewport space (top-left origin, PDF pts) to PDF user space. */
export function vpToPdf(tx: Mat, x: number, y: number): { x: number; y: number } {
  return { x: tx[0] * x + tx[2] * y + tx[4], y: tx[1] * x + tx[3] * y + tx[5] }
}

/** Angle (degrees) that horizontal text in viewport space maps to in user space. */
export function vpAngleDeg(tx: Mat): number {
  return (Math.atan2(tx[1], tx[0]) * 180) / Math.PI
}

/**
 * Map an axis-aligned viewport rect to a user-space rect.
 * Exact for page rotations that are multiples of 90 degrees.
 */
export function vpRectToPdfRect(tx: Mat, r: Rect): { x: number; y: number; w: number; h: number } {
  const pts = [
    vpToPdf(tx, r.x, r.y),
    vpToPdf(tx, r.x + r.w, r.y),
    vpToPdf(tx, r.x, r.y + r.h),
    vpToPdf(tx, r.x + r.w, r.y + r.h),
  ]
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
