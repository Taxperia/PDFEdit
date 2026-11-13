import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function openPdfDoc(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdf.js takes ownership of the buffer it receives, so pass a copy
  // and keep the original bytes pristine for pdf-lib export.
  const task = pdfjsLib.getDocument({ data: bytes.slice() })
  try {
    return await task.promise
  } catch (error) {
    await task.destroy().catch(console.error)
    throw error
  }
}

/** Render a source page to a fresh offscreen canvas. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageIndex: number,
  zoom: number,
  dpr: number,
): Promise<HTMLCanvasElement | null> {
  const page = await doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: zoom * dpr })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

/** Render a source page to a small PNG data URL for the sidebar thumbnails. */
export async function renderThumb(
  doc: PDFDocumentProxy,
  pageIndex: number,
  targetWidth = 150,
): Promise<string | null> {
  const page = await doc.getPage(pageIndex + 1)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.max(0.05, targetWidth / base.width)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png')
}

export function blankThumb(width: number, height: number, targetWidth = 150): string {
  const canvas = document.createElement('canvas')
  const scale = targetWidth / width
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  return canvas.toDataURL('image/png')
}
