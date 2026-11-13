import type { FontKey } from '../types'

export const ASCENT_RATIO = 0.8 // portion of font size above the baseline
export const LINE_HEIGHT_RATIO = 1.3
export const FONT_FAMILY = "'Noto Sans', sans-serif"

let mctx: CanvasRenderingContext2D | null = null
function getCtx(): CanvasRenderingContext2D | null {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d')
  return mctx
}

export function measureWidth(text: string, fontSize: number, bold: boolean): number {
  const ctx = getCtx()
  if (!ctx) return text.length * fontSize * 0.55
  ctx.font = `${bold ? '700' : '400'} ${fontSize}px 'Noto Sans', sans-serif`
  return ctx.measureText(text).width
}

/** Wrap text into lines that fit maxWidth (PDF points). '\n' forces a break. */
export function wrapText(text: string, fontSize: number, maxWidth: number, bold: boolean): string[] {
  if (maxWidth <= 0) return text.split('\n')
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('')
      continue
    }
    let cur = ''
    for (const w of para.split(' ')) {
      const cand = cur ? cur + ' ' + w : w
      if (measureWidth(cand, fontSize, bold) <= maxWidth) {
        cur = cand
      } else {
        if (cur) out.push(cur)
        if (measureWidth(w, fontSize, bold) <= maxWidth) {
          cur = w
        } else {
          // break an over-long word by characters
          let chunk = ''
          for (const ch of w) {
            if (chunk && measureWidth(chunk + ch, fontSize, bold) > maxWidth) {
              out.push(chunk)
              chunk = ch
            } else {
              chunk += ch
            }
          }
          cur = chunk
        }
      }
    }
    if (cur) out.push(cur)
  }
  return out.length ? out : ['']
}

export function textBoxHeight(text: string, fontSize: number, width: number, font: FontKey): number {
  return wrapText(text, fontSize, width, font === 'bold').length * fontSize * LINE_HEIGHT_RATIO
}

export function fontCssWeight(font: FontKey): number {
  return font === 'bold' ? 700 : 400
}
