import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  EditElement,
  ImageElement,
  PageMeta,
  Snapshot,
  TextEditElement,
  TextLine,
  Tool,
} from '../types'
import { blankThumb, openPdfDoc, renderThumb } from '../pdf/loadPdf'
import { extractTextLines } from '../pdf/extractText'
import { sampleColors } from '../utils/colorSample'
import { invertTransform, vpAngleDeg, type Mat } from '../utils/coords'
import { uid } from '../utils/misc'

const clone = <T,>(v: T): T => structuredClone(v)
let openRequest = 0
const disposeDoc = (doc: PDFDocumentProxy | null) => {
  if (doc) void doc.destroy().catch(console.error)
}

interface DocStore {
  fileName: string | null
  pdfBytes: Uint8Array | null
  pdfDoc: PDFDocumentProxy | null
  pages: PageMeta[]
  elements: EditElement[]
  textLines: Record<string, TextLine[]> // pageId -> lines (cache, not undoable)
  thumbs: Record<string, string> // pageId -> dataURL (cache, not undoable)
  fontsReady: boolean
  tool: Tool
  selectedId: string | null
  editingId: string | null
  zoom: number
  currentPageIdx: number
  busy: 'open' | 'export' | null
  errorMsg: 'open' | 'export' | 'image' | 'render' | 'fileType' | null
  revision: string | null
  savedRevision: string | null
  markExported: (revision: string | null) => void
  past: Snapshot[]
  future: Snapshot[]

  openFile: (name: string, bytes: Uint8Array) => Promise<void>
  closeFile: () => void
  setFontsReady: (v: boolean) => void
  setTool: (t: Tool) => void
  setZoom: (z: number) => void
  setZoomFit: (containerWidth: number) => void
  setCurrentPageIdx: (i: number) => void
  select: (id: string | null) => void
  setEditing: (id: string | null) => void
  setError: (e: DocStore['errorMsg']) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  addElement: (el: EditElement) => void
  updateElement: (id: string, patch: Partial<EditElement>) => void
  deleteElement: (id: string) => void
  duplicateElement: (id: string) => void
  reorderElement: (id: string, dir: 'front' | 'back') => void
  addBlankPage: (afterIdx: number) => void
  deletePage: (idx: number) => void
  movePage: (from: number, to: number) => void
  getTextLinesFor: (pageId: string) => Promise<TextLine[]>
  getThumb: (pageId: string) => Promise<string | undefined>
  createTextEditForLine: (
    pageId: string,
    line: TextLine,
    canvas: HTMLCanvasElement | null,
    zoom: number,
  ) => string | null
  addImageFromDataUrl: (
    pageId: string,
    dataUrl: string,
    bytes: Uint8Array,
    format: 'png' | 'jpg',
    naturalW: number,
    naturalH: number,
  ) => void
}

export const useDocStore = create<DocStore>((set, get) => ({
  fileName: null,
  pdfBytes: null,
  pdfDoc: null,
  pages: [],
  elements: [],
  textLines: {},
  thumbs: {},
  fontsReady: false,
  tool: 'select',
  selectedId: null,
  editingId: null,
  zoom: 1,
  currentPageIdx: 0,
  busy: null,
  errorMsg: null,
  revision: null,
  savedRevision: null,
  markExported: (revision) => set({ savedRevision: revision }),
  past: [],
  future: [],

  async openFile(name, bytes) {
    const request = ++openRequest
    let doc: PDFDocumentProxy | null = null
    set({ busy: 'open', errorMsg: null })
    try {
      doc = await openPdfDoc(bytes)
      if (request !== openRequest) {
        disposeDoc(doc)
        return
      }
      const pages: PageMeta[] = []
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1)
        const vp = page.getViewport({ scale: 1 })
        const tx = invertTransform(vp.transform as Mat)
        pages.push({
          id: uid(),
          srcIndex: i,
          width: vp.width,
          height: vp.height,
          tx,
          angle: vpAngleDeg(tx),
        })
      }
      if (request !== openRequest) {
        disposeDoc(doc)
        return
      }
      const previousDoc = get().pdfDoc
      const revision = uid()
      set({
        fileName: name,
        pdfBytes: bytes,
        pdfDoc: doc,
        pages,
        elements: [],
        textLines: {},
        thumbs: {},
        selectedId: null,
        editingId: null,
        tool: 'select',
        currentPageIdx: 0,
        zoom: 1,
        past: [],
        future: [],
        busy: null,
        revision,
        savedRevision: revision,
      })
      disposeDoc(previousDoc)
    } catch (e) {
      disposeDoc(doc)
      if (request === openRequest) {
        console.error(e)
        set({ busy: null, errorMsg: 'open' })
      }
    }
  },

  closeFile() {
    ++openRequest
    disposeDoc(get().pdfDoc)
    set({
      fileName: null,
      pdfBytes: null,
      pdfDoc: null,
      pages: [],
      elements: [],
      textLines: {},
      thumbs: {},
      selectedId: null,
      editingId: null,
      tool: 'select',
      currentPageIdx: 0,
      past: [],
      future: [],
      busy: null,
      errorMsg: null,
      revision: null,
      savedRevision: null,
    })
  },

  setFontsReady: (v) => set({ fontsReady: v }),
  setTool: (t) => set({ tool: t, selectedId: null, editingId: null }),
  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.1, z)) }),
  setZoomFit: (containerWidth) => {
    const page = get().pages[get().currentPageIdx]
    if (!page || containerWidth <= 0) return
    const z = (containerWidth - 64) / page.width
    set({ zoom: Math.min(4, Math.max(0.1, z)) })
  },
  setCurrentPageIdx: (i) =>
    set((s) => ({ currentPageIdx: Math.min(Math.max(0, i), s.pages.length - 1), selectedId: null, editingId: null })),
  select: (id) => set({ selectedId: id }),
  setEditing: (id) => {
    if (id && get().editingId !== id) get().pushHistory()
    set({ editingId: id, selectedId: id ?? get().selectedId })
  },
  setError: (e) => set({ errorMsg: e }),

  pushHistory() {
    const { pages, elements, revision } = get()
    set((s) => ({
      past: [...s.past.slice(-99), { pages: clone(pages), elements: clone(elements), revision }],
      future: [],
    }))
  },

  undo() {
    const { past, future, pages, elements, currentPageIdx } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [...future, { pages: clone(pages), elements: clone(elements), revision: get().revision }].slice(-100),
      revision: prev.revision,
      pages: prev.pages,
      elements: prev.elements,
      selectedId: null,
      editingId: null,
      currentPageIdx: Math.min(currentPageIdx, prev.pages.length - 1),
    })
  },

  redo() {
    const { past, future, pages, elements, currentPageIdx } = get()
    if (!future.length) return
    const next = future[future.length - 1]
    set({
      future: future.slice(0, -1),
      past: [...past, { pages: clone(pages), elements: clone(elements), revision: get().revision }].slice(-100),
      revision: next.revision,
      pages: next.pages,
      elements: next.elements,
      selectedId: null,
      editingId: null,
      currentPageIdx: Math.min(currentPageIdx, next.pages.length - 1),
    })
  },

  addElement(el) {
    set((s) => ({ elements: [...s.elements, el], selectedId: el.id, revision: uid() }))
  },

  updateElement(id, patch) {
    if (!get().elements.some((e) => e.id === id)) return
    set((s) => ({
      revision: uid(),
      elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as EditElement) : e)),
    }))
  },

  deleteElement(id) {
    if (!get().elements.some((e) => e.id === id)) return
    set((s) => ({
      revision: uid(),
      elements: s.elements.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      editingId: s.editingId === id ? null : s.editingId,
    }))
  },

  duplicateElement(id) {
    const src = get().elements.find((e) => e.id === id)
    if (!src) return
    get().pushHistory()
    const copy = clone(src) as EditElement
    copy.id = uid()
    if (copy.kind === 'textEdit') {
      // A duplicate is new content; it must not cover the source text a second time.
      get().addElement({
        id: copy.id, kind: 'textBox', pageId: copy.pageId,
        x: copy.rect.x + 14, y: copy.baselineTop - copy.fontSize * 0.8 + 14,
        width: Math.max(30, copy.rect.w), text: copy.text,
        fontSize: copy.fontSize, font: copy.font, color: copy.color, align: 'left',
      })
      return
    } else {
      copy.x += 14
      copy.y += 14
    }
    set((s) => {
      const idx = s.elements.findIndex((e) => e.id === id)
      const next = [...s.elements]
      next.splice(idx + 1, 0, copy)
      return { elements: next, selectedId: copy.id, revision: uid() }
    })
  },

  reorderElement(id, dir) {
    if (!get().elements.some((e) => e.id === id)) return
    get().pushHistory()
    set((s) => {
      const idx = s.elements.findIndex((e) => e.id === id)
      if (idx < 0) return {}
      const el = s.elements[idx]
      const rest = s.elements.filter((_, i) => i !== idx)
      return { elements: dir === 'front' ? [...rest, el] : [el, ...rest], revision: uid() }
    })
  },

  addBlankPage(afterIdx) {
    get().pushHistory()
    const { pages } = get()
    const ref = pages[afterIdx]
    const width = ref?.width ?? 595
    const height = ref?.height ?? 842
    const np: PageMeta = {
      id: uid(),
      srcIndex: -1,
      width,
      height,
      tx: [1, 0, 0, -1, 0, height],
      angle: 0,
    }
    const next = [...pages]
    next.splice(afterIdx + 1, 0, np)
    set({ pages: next, currentPageIdx: afterIdx + 1, selectedId: null, editingId: null, revision: uid() })
  },

  deletePage(idx) {
    const { pages, elements } = get()
    if (pages.length <= 1 || !pages[idx]) return
    get().pushHistory()
    const pid = pages[idx].id
    const next = pages.filter((_, i) => i !== idx)
    set({
      pages: next,
      elements: elements.filter((e) => e.pageId !== pid),
      currentPageIdx: Math.max(0, Math.min(idx, next.length - 1)),
      selectedId: null,
      editingId: null,
      revision: uid(),
    })
  },

  movePage(from, to) {
    const { pages } = get()
    if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return
    get().pushHistory()
    const next = [...pages]
    const [p] = next.splice(from, 1)
    next.splice(to, 0, p)
    set({ pages: next, currentPageIdx: to, selectedId: null, editingId: null, revision: uid() })
  },

  async getTextLinesFor(pageId) {
    const cached = get().textLines[pageId]
    if (cached) return cached
    const { pdfDoc, pages } = get()
    const p = pages.find((pp) => pp.id === pageId)
    if (!pdfDoc || !p || p.srcIndex < 0) return []
    const lines = await extractTextLines(pdfDoc, p.srcIndex)
    if (get().pdfDoc !== pdfDoc) return []
    set((s) => ({ textLines: { ...s.textLines, [pageId]: lines } }))
    return lines
  },

  async getThumb(pageId) {
    const cached = get().thumbs[pageId]
    if (cached) return cached
    const { pdfDoc, pages } = get()
    const p = pages.find((pp) => pp.id === pageId)
    if (!p) return undefined
    const url = p.srcIndex < 0 ? blankThumb(p.width, p.height) : await renderThumb(pdfDoc!, p.srcIndex)
    if (get().pdfDoc !== pdfDoc) return undefined
    if (!url) return undefined
    set((s) => ({ thumbs: { ...s.thumbs, [pageId]: url } }))
    return url
  },

  createTextEditForLine(pageId, line, canvas, zoom) {
    const existing = get().elements.find(
      (e) => e.kind === 'textEdit' && e.pageId === pageId && e.lineKey === line.key,
    )
    if (existing && existing.kind === 'textEdit') {
      get().pushHistory()
      set({ selectedId: existing.id, editingId: existing.id })
      return existing.id
    }
    const { bg, text: textColor } = sampleColors(canvas, line.rect, zoom)
    get().pushHistory()
    const el: TextEditElement = {
      id: uid(),
      kind: 'textEdit',
      pageId,
      lineKey: line.key,
      rect: { ...line.rect },
      baselineTop: line.baselineTop,
      origRect: { ...line.rect },
      origBaselineTop: line.baselineTop,
      originalText: line.text,
      text: line.text,
      fontSize: line.fontSize,
      font: line.bold ? 'bold' : 'regular',
      color: textColor,
      bg,
    }
    set((s) => ({ elements: [...s.elements, el], selectedId: el.id, editingId: el.id, revision: uid() }))
    return el.id
  },

  addImageFromDataUrl(pageId, dataUrl, bytes, format, naturalW, naturalH) {
    get().pushHistory()
    const maxW = 280
    const scale = Math.min(1, maxW / naturalW)
    const page = get().pages[get().currentPageIdx]
    const w = naturalW * scale
    const h = naturalH * scale
    const el: ImageElement = {
      id: uid(),
      kind: 'image',
      pageId: page?.id ?? pageId,
      x: ((page?.width ?? 595) - w) / 2,
      y: ((page?.height ?? 842) - h) / 2,
      w,
      h,
      dataUrl,
      bytes,
      format,
    }
    set((s) => ({ elements: [...s.elements, el], selectedId: el.id, tool: 'select', revision: uid() }))
  },
}))
