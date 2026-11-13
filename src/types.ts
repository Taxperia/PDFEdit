export type Lang = 'tr' | 'en'

export type Tool = 'select' | 'text' | 'rect' | 'ellipse' | 'line' | 'eraser' | 'image'

export type FontKey = 'regular' | 'bold'

/** Rectangle in page viewport space (PDF points, top-left origin). */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface PageMeta {
  id: string
  /** Index of this page in the source PDF; -1 for a blank inserted page. */
  srcIndex: number
  /** Display width in PDF points (rotation-aware viewport space). */
  width: number
  height: number
  /** Inverse of the pdf.js viewport (scale 1) transform: viewport -> PDF user space. */
  tx: [number, number, number, number, number, number]
  /** Text drawing angle in user space, degrees. */
  angle: number
}

/** One editable original text line extracted from the PDF. */
export interface TextLine {
  key: string
  rect: Rect
  baselineTop: number
  text: string
  fontSize: number
  bold: boolean
}

export interface TextEditElement {
  id: string
  kind: 'textEdit'
  pageId: string
  lineKey: string
  rect: Rect
  baselineTop: number
  /**
   * Where the original text lives on the page. The cover rectangle stays here
   * (hiding the source text) while the element itself can be dragged anywhere.
   * Optional for elements created before this field existed (HMR sessions).
   */
  origRect?: Rect
  origBaselineTop?: number
  originalText: string
  text: string
  fontSize: number
  font: FontKey
  color: string
  bg: string
}

export interface TextBoxElement {
  id: string
  kind: 'textBox'
  pageId: string
  x: number
  y: number
  width: number
  text: string
  fontSize: number
  font: FontKey
  color: string
  align: 'left' | 'center' | 'right'
}

export interface ShapeElement {
  id: string
  kind: 'shape'
  pageId: string
  shape: 'rect' | 'ellipse' | 'line'
  x: number
  y: number
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface ImageElement {
  id: string
  kind: 'image'
  pageId: string
  x: number
  y: number
  w: number
  h: number
  dataUrl: string
  bytes: Uint8Array
  format: 'png' | 'jpg'
}

export type EditElement = TextEditElement | TextBoxElement | ShapeElement | ImageElement

export interface Snapshot {
  pages: PageMeta[]
  elements: EditElement[]
  revision: string | null
}
