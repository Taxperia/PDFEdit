import { describe, expect, it } from 'vitest'
import { invertTransform, vpAngleDeg, vpRectToPdfRect, vpToPdf, type Mat } from '../src/utils/coords'

describe('PDF viewport coordinates', () => {
  // A cropped page with a nonzero origin, at each supported rotation.
  const cases: [number, Mat][] = [
    [0, [1, 0, 0, -1, -20, 820]],
    [90, [0, 1, 1, 0, -30, -20]],
    [180, [-1, 0, 0, 1, 620, -30]],
    [270, [0, -1, -1, 0, 820, 620]],
  ]
  it.each(cases)('round-trips coordinates at %i degrees with CropBox offsets', (_, forward) => {
    const inverse = invertTransform(forward)
    const display = vpToPdf(forward, 140, 230)
    const point = vpToPdf(inverse, display.x, display.y)
    expect(point.x).toBeCloseTo(140)
    expect(point.y).toBeCloseTo(230)
    const angle = vpAngleDeg(inverse) * Math.PI / 180
    const anchor = vpToPdf(inverse, 70, 90)
    const right = vpToPdf(inverse, 80, 90)
    expect(right.x - anchor.x).toBeCloseTo(10 * Math.cos(angle))
    expect(right.y - anchor.y).toBeCloseTo(10 * Math.sin(angle))
    const box = vpRectToPdfRect(inverse, { x: 70, y: 90, w: 40, h: 20 })
    expect(box.w * box.h).toBeCloseTo(800)
  })
  it('rejects a singular transform', () => {
    expect(() => invertTransform([0, 0, 0, 0, 0, 0])).toThrow()
  })
})
