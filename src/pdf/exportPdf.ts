import { PDFDocument, degrees, rgb, type PDFImage, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { EditElement, ImageElement, PageMeta, ShapeElement, TextBoxElement, TextEditElement } from '../types'
import { vpRectToPdfRect, vpToPdf } from '../utils/coords'
import { ASCENT_RATIO, LINE_HEIGHT_RATIO, wrapText } from '../utils/textLayout'
import { hexToRgb } from '../utils/misc'

let fontRegBytes: Uint8Array | null = null
let fontBoldBytes: Uint8Array | null = null

async function loadFontBytes(bold: boolean): Promise<Uint8Array> {
  const cached = bold ? fontBoldBytes : fontRegBytes
  if (cached) return cached
  const file = bold ? 'NotoSans-Bold.ttf' : 'NotoSans-Regular.ttf'
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
  if (!res.ok) throw new Error(`Font not found: ${file}`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  if (bold) fontBoldBytes = bytes
  else fontRegBytes = bytes
  return bytes
}

function color(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return rgb(r / 255, g / 255, b / 255)
}

export interface ExportInput {
  pdfBytes: Uint8Array
  pages: PageMeta[]
  elements: EditElement[]
}

/** Apply all edits to a copy of the source PDF and return the result. */
export async function buildExportedPdf(input: ExportInput): Promise<Uint8Array> {
  const src = await PDFDocument.load(input.pdfBytes)
  const out = await PDFDocument.create()
  out.registerFontkit(fontkit)
  const [reg, bold] = await Promise.all([loadFontBytes(false), loadFontBytes(true)])
  const fontReg = await out.embedFont(reg, { subset: true })
  const fontBold = await out.embedFont(bold, { subset: true })

  // pre-embed images (async) so the draw pass can stay synchronous
  const imageCache = new Map<string, PDFImage>()
  for (const el of input.elements) {
    if (el.kind === 'image' && !imageCache.has(el.id)) {
      const img = el.format === 'png' ? await out.embedPng(el.bytes) : await out.embedJpg(el.bytes)
      imageCache.set(el.id, img)
    }
  }

  const outPages: PDFPage[] = []
  for (const meta of input.pages) {
    if (meta.srcIndex >= 0) {
      const [copied] = await out.copyPages(src, [meta.srcIndex])
      out.addPage(copied)
    } else {
      out.addPage([meta.width, meta.height])
    }
    outPages.push(out.getPage(out.getPageCount() - 1))
  }

  for (let i = 0; i < input.pages.length; i++) {
    const meta = input.pages[i]
    const els = input.elements.filter((e) => e.pageId === meta.id)
    if (!els.length) continue
    const page = outPages[i]
    for (const el of els) {
      drawElement(page, el, meta, { fontReg, fontBold }, imageCache)
    }
  }

  return out.save()
}

interface Fonts {
  fontReg: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>
}

function drawElement(
  page: PDFPage,
  el: EditElement,
  meta: PageMeta,
  fonts: Fonts,
  imageCache: Map<string, PDFImage>,
): void {
  const tx = meta.tx
  const angle = degrees(meta.angle)
  switch (el.kind) {
    case 'textEdit': {
      drawTextEdit(page, el, tx, angle, fonts)
      break
    }
    case 'textBox': {
      drawTextBox(page, el, tx, angle, fonts)
      break
    }
    case 'shape': {
      drawShape(page, el, tx)
      break
    }
    case 'image': {
      drawImageEl(page, el, tx, angle, imageCache)
      break
    }
  }
}

function drawTextEdit(
  page: PDFPage,
  el: TextEditElement,
  tx: PageMeta['tx'],
  angle: ReturnType<typeof degrees>,
  fonts: Fonts,
): void {
  // cover stays at the original location (hides the source text),
  // the replacement text is drawn wherever the element was dragged
  const orig = el.origRect ?? el.rect
  const cover = vpRectToPdfRect(tx, orig)
  if (el.bg) {
    page.drawRectangle({
      x: cover.x,
      y: cover.y,
      width: cover.w,
      height: cover.h,
      color: color(el.bg),
    })
  }
  const baseline = vpToPdf(tx, el.rect.x, el.baselineTop)
  page.drawText(el.text, {
    x: baseline.x,
    y: baseline.y,
    size: el.fontSize,
    font: el.font === 'bold' ? fonts.fontBold : fonts.fontReg,
    color: color(el.color),
    rotate: angle,
  })
}

function drawTextBox(
  page: PDFPage,
  el: TextBoxElement,
  tx: PageMeta['tx'],
  angle: ReturnType<typeof degrees>,
  fonts: Fonts,
): void {
  const font = el.font === 'bold' ? fonts.fontBold : fonts.fontReg
  const lines = wrapText(el.text, el.fontSize, el.width, el.font === 'bold')
  lines.forEach((line, i) => {
    if (!line) return
    const lineW = font.widthOfTextAtSize(line, el.fontSize)
    const xLeft =
      el.align === 'left'
        ? el.x
        : el.align === 'center'
          ? el.x + (el.width - lineW) / 2
          : el.x + el.width - lineW
    const yTop = el.y + ASCENT_RATIO * el.fontSize + i * el.fontSize * LINE_HEIGHT_RATIO
    const at = vpToPdf(tx, xLeft, yTop)
    page.drawText(line, {
      x: at.x,
      y: at.y,
      size: el.fontSize,
      font,
      color: color(el.color),
      rotate: angle,
    })
  })
}

function drawShape(page: PDFPage, el: ShapeElement, tx: PageMeta['tx']): void {
  if (el.shape === 'line') {
    const a = vpToPdf(tx, el.x, el.y)
    const b = vpToPdf(tx, el.x + el.w, el.y + el.h)
    page.drawLine({
      start: a,
      end: b,
      thickness: Math.max(0.1, el.strokeWidth),
      color: color(el.stroke || el.fill || '#111111'),
    })
    return
  }
  const r = vpRectToPdfRect(tx, el)
  const hasFill = !!el.fill
  const hasStroke = !!el.stroke && el.strokeWidth > 0
  if (!hasFill && !hasStroke) return
  if (el.shape === 'rect') {
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      color: hasFill ? color(el.fill) : undefined,
      borderColor: hasStroke ? color(el.stroke) : undefined,
      borderWidth: hasStroke ? el.strokeWidth : undefined,
    })
  } else {
    page.drawEllipse({
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      xScale: Math.max(0.5, r.w / 2),
      yScale: Math.max(0.5, r.h / 2),
      color: hasFill ? color(el.fill) : undefined,
      borderColor: hasStroke ? color(el.stroke) : undefined,
      borderWidth: hasStroke ? el.strokeWidth : undefined,
    })
  }
}

function drawImageEl(
  page: PDFPage,
  el: ImageElement,
  tx: PageMeta['tx'],
  angle: ReturnType<typeof degrees>,
  imageCache: Map<string, PDFImage>,
): void {
  const img = imageCache.get(el.id)
  if (!img) return
  // anchor: bottom-left corner of the element in viewport space
  const anchor = vpToPdf(tx, el.x, el.y + el.h)
  page.drawImage(img, {
    x: anchor.x,
    y: anchor.y,
    width: el.w,
    height: el.h,
    rotate: angle,
  })
}
