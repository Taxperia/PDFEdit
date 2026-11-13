import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import { getDocument, Util } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildExportedPdf } from '../src/pdf/exportPdf'
import { invertTransform, vpAngleDeg, type Mat } from '../src/utils/coords'
import type { PageMeta, TextEditElement } from '../src/types'

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    expect(input).toMatch(new RegExp(`^${import.meta.env.BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}fonts/NotoSans-(Regular|Bold)\\.ttf$`))
    const name = input.split('/').at(-1)
    const bytes = await readFile(new URL(`../public/fonts/${name}`, import.meta.url))
    return new Response(Uint8Array.from(bytes).buffer)
  }))
})

describe('real PDF export', () => {
  it.each([0, 90, 180, 270])('places Turkish text at the requested viewport baseline on a cropped %i° page', async (rotation) => {
    const original = await PDFDocument.create()
    const sourcePage = original.addPage([640, 840])
    sourcePage.setCropBox(20, 30, 600, 790)
    sourcePage.setRotation(degrees(rotation))
    sourcePage.drawText('Source text', { x: 60, y: 700, font: await original.embedFont(StandardFonts.Helvetica) })
    const sourceBytes = await original.save()
    const source = await getDocument({ data: sourceBytes.slice() }).promise
    const viewport = (await source.getPage(1)).getViewport({ scale: 1 })
    const tx = invertTransform(viewport.transform as Mat)
    const meta: PageMeta = { id: 'page', srcIndex: 0, width: viewport.width, height: viewport.height, tx, angle: vpAngleDeg(tx) }
    const edit: TextEditElement = {
      id: 'edit', kind: 'textEdit', pageId: meta.id, lineKey: 'test',
      rect: { x: 75, y: 95, w: 200, h: 25 }, baselineTop: 115,
      originalText: '', text: 'Türkçe: Şğİıöü', fontSize: 16, font: 'regular', color: '#123456', bg: '#ffffff',
    }
    const bytes = await buildExportedPdf({ pdfBytes: sourceBytes, pages: [meta], elements: [edit] })
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
    expect(reloaded.getPage(0).getRotation().angle).toBe(rotation)
    expect(reloaded.getPage(0).getCropBox()).toEqual(sourcePage.getCropBox())
    const exported = await getDocument({ data: bytes.slice() }).promise
    try {
      const page = await exported.getPage(1)
      const text = await page.getTextContent()
      const replacement = text.items.find((item) => 'str' in item && item.str === edit.text)
      expect(replacement).toBeDefined()
      if (!replacement || !('str' in replacement)) throw new Error('Replacement text missing')
      const position = Util.transform(page.getViewport({ scale: 1 }).transform, replacement.transform)
      expect(position[4]).toBeCloseTo(75, 2)
      expect(position[5]).toBeCloseTo(115, 2)
      expect(position[1]).toBeCloseTo(0, 2)
      expect(sourceBytes.byteLength).toBeGreaterThan(0)
    } finally {
      await source.destroy(); await exported.destroy()
    }
  })

  it('keeps the requested page order and inserted blank-page dimensions', async () => {
    const source = await PDFDocument.create()
    source.addPage([200, 300]); source.addPage([400, 500])
    const page = (id: string, srcIndex: number, width: number, height: number): PageMeta => ({ id, srcIndex, width, height, tx: [1, 0, 0, -1, 0, height], angle: 0 })
    const bytes = await buildExportedPdf({
      pdfBytes: await source.save(), elements: [],
      pages: [page('second', 1, 400, 500), page('blank', -1, 600, 700), page('first', 0, 200, 300)],
    })
    const result = await PDFDocument.load(bytes)
    expect(result.getPages().map((p) => p.getSize())).toEqual([
      { width: 400, height: 500 }, { width: 600, height: 700 }, { width: 200, height: 300 },
    ])
  })
})
