import { Util } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { Rect, TextLine } from '../types'

interface RawItem {
  x0: number // baseline start, viewport space (top-left origin, PDF pts)
  y0: number // baseline y
  x1: number // baseline end x
  fs: number
  str: string
  ascent: number // fraction of fs above baseline
  descent: number // fraction of fs below baseline (positive)
  bold: boolean
  idx: number // index in the raw items array (for stable keys)
}

const MAX_GAP_FACTOR = 1.9 // split the line when the gap exceeds fs * this
const SPACE_FACTOR = 0.22 // insert a space when gap exceeds fs * this

/**
 * Extract text from a page and group items into clickable "lines".
 * Items on the same baseline (and similar font size) are merged; very wide
 * gaps start a new chunk so independent columns stay separately editable.
 */
export async function extractTextLines(
  doc: PDFDocumentProxy,
  pageIndex: number,
): Promise<TextLine[]> {
  const page = await doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const styles = (tc.styles ?? {}) as Record<
    string,
    { fontFamily?: string; ascent?: number; descent?: number } | undefined
  >

  const raws: RawItem[] = []
  const items = tc.items
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx]
    if (!('str' in it)) continue
    const ti = it as TextItem
    if (!ti.str || !ti.str.trim()) continue
    const tx = Util.transform(viewport.transform, ti.transform)
    const fs = Math.hypot(tx[2], tx[3])
    if (fs < 0.5) continue
    const dirLen = Math.hypot(tx[0], tx[1]) || 1
    const dx = tx[0] / dirLen
    const dy = tx[1] / dirLen
    // The inline editor is horizontal. Do not offer a misleading hit box for
    // vertical, upside-down or angled source text; overlays still work there.
    if (dx < 0.999 || Math.abs(dy) > 0.01) continue
    const style = styles[ti.fontName]
    const ascent = clampNum(style?.ascent ?? 0.8, 0.5, 1.2)
    const descent = clampNum(-(style?.descent ?? 0.22), 0.08, 0.45)
    const fam = style?.fontFamily ?? ''
    const bold = /bold|black|heavy|semibold|[-_]bd\b/i.test(fam)
    raws.push({
      x0: tx[4],
      y0: tx[5],
      x1: tx[4] + dx * ti.width,
      fs,
      str: ti.str,
      ascent,
      descent,
      bold,
      idx,
    })
  }

  // 1) cluster by baseline
  raws.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  const clusters: RawItem[][] = []
  let cur: RawItem[] = []
  for (const r of raws) {
    if (cur.length === 0) {
      cur = [r]
      continue
    }
    const ref = cur[0]
    if (Math.abs(r.y0 - ref.y0) <= Math.max(2, ref.fs * 0.25)) {
      cur.push(r)
    } else {
      clusters.push(cur)
      cur = [r]
    }
  }
  if (cur.length) clusters.push(cur)

  // 2) within each baseline cluster, split into chunks on wide gaps
  const lines: TextLine[] = []
  for (const cluster of clusters) {
    cluster.sort((a, b) => a.x0 - b.x0)
    let chunk: RawItem[] = [cluster[0]]
    const flush = () => {
      if (chunk.length) {
        lines.push(chunkToLine(chunk, pageIndex))
        chunk = []
      }
    }
    for (let i = 1; i < cluster.length; i++) {
      const prev = chunk[chunk.length - 1]
      const item = cluster[i]
      const gap = item.x0 - prev.x1
      const fsRef = prev.fs
      if (gap > fsRef * MAX_GAP_FACTOR || Math.abs(item.fs - chunk[0].fs) > chunk[0].fs * 0.3) {
        flush()
        chunk = [item]
      } else {
        chunk.push(item)
      }
    }
    flush()
  }

  lines.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
  return lines
}

function chunkToLine(chunk: RawItem[], pageIndex: number): TextLine {
  const first = chunk[0]
  const last = chunk[chunk.length - 1]
  let text = ''
  let endX = first.x0
  for (const item of chunk) {
    const needsSpace =
      text.length > 0 &&
      !/\s$/.test(text) &&
      !/^\s/.test(item.str) &&
      item.x0 - endX > item.fs * SPACE_FACTOR
    if (needsSpace) text += ' '
    text += item.str
    endX = Math.max(endX, item.x1)
  }

  const fontSize = first.fs
  const ascentPx = first.ascent * fontSize
  const descentPx = first.descent * fontSize
  const rect: Rect = {
    x: first.x0,
    y: first.y0 - ascentPx,
    w: Math.max(1, last.x1 - first.x0),
    h: ascentPx + descentPx,
  }
  return {
    key: `p${pageIndex}i${first.idx}`,
    rect,
    baselineTop: first.y0,
    text: text.replace(/\s+$/, ''),
    fontSize,
    bold: chunk.some((c) => c.bold),
  }
}

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
