import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ShapeElement, TextEditElement } from '../src/types'

vi.mock('../src/pdf/loadPdf', () => ({
  openPdfDoc: vi.fn(), renderThumb: vi.fn(), blankThumb: vi.fn(),
}))
vi.mock('../src/pdf/extractText', () => ({ extractTextLines: vi.fn() }))
import { openPdfDoc } from '../src/pdf/loadPdf'
import { useDocStore } from '../src/store/useDocStore'

const S = useDocStore.getState
const shape: ShapeElement = {
  id: 'shape', kind: 'shape', pageId: 'page', shape: 'rect',
  x: 10, y: 20, w: 30, h: 40, fill: '#ffffff', stroke: '', strokeWidth: 0,
}
function doc() {
  return {
    numPages: 1, destroy: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockResolvedValue({ getViewport: () => ({ width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] }) }),
  } as unknown as PDFDocumentProxy
}
beforeEach(() => {
  S().closeFile()
  useDocStore.setState({ revision: 'initial', savedRevision: 'initial' })
})

describe('document history and changes', () => {
  it('tracks exports correctly across undo and redo', () => {
    S().pushHistory(); S().addElement(shape)
    expect(S().revision).not.toBe(S().savedRevision)
    S().markExported(S().revision)
    S().undo()
    expect(S().elements).toHaveLength(0)
    expect(S().revision).not.toBe(S().savedRevision)
    S().redo()
    expect(S().elements).toHaveLength(1)
    expect(S().revision).toBe(S().savedRevision)
  })
  it('does not mark an unchanged focus snapshot as dirty', () => {
    S().pushHistory()
    expect(S().revision).toBe(S().savedRevision)
  })
  it('undoes stacking changes', () => {
    S().addElement(shape); S().addElement({ ...shape, id: 'other' })
    S().reorderElement('shape', 'front')
    expect(S().elements.map((e) => e.id)).toEqual(['other', 'shape'])
    S().undo()
    expect(S().elements.map((e) => e.id)).toEqual(['shape', 'other'])
  })
  it('duplicates replacement text without another original-text cover', () => {
    const edit: TextEditElement = {
      id: 'edit', kind: 'textEdit', pageId: 'page', lineKey: 'line',
      rect: { x: 10, y: 20, w: 100, h: 20 }, baselineTop: 36,
      originalText: 'Original', text: 'Yeni', fontSize: 16, font: 'regular', color: '#000000', bg: '#ffffff',
    }
    S().addElement(edit); S().duplicateElement('edit')
    expect(S().elements[1]).toMatchObject({ kind: 'textBox', text: 'Yeni', x: 24 })
    S().pushHistory(); S().deleteElement('edit')
    expect(S().elements.some((e) => e.kind === 'textEdit')).toBe(false)
  })
  it('preserves page edits through delete and undo', () => {
    S().addBlankPage(-1)
    const first = S().pages[0]
    S().addBlankPage(0)
    S().addElement({ ...shape, pageId: first.id })
    S().deletePage(0)
    expect(S().elements).toHaveLength(0)
    S().undo()
    expect(S().pages).toHaveLength(2)
    expect(S().elements[0].pageId).toBe(first.id)
    S().deletePage(99)
    expect(S().pages).toHaveLength(2)
  })
})

describe('asynchronous document loading', () => {
  it('keeps the latest file when an earlier load finishes later', async () => {
    let resolveFirst!: (value: PDFDocumentProxy) => void
    const first = doc(), second = doc()
    vi.mocked(openPdfDoc).mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve })).mockResolvedValueOnce(second)
    const pending = S().openFile('first.pdf', new Uint8Array())
    await S().openFile('second.pdf', new Uint8Array())
    resolveFirst(first); await pending
    expect(S().fileName).toBe('second.pdf')
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(S().busy).toBeNull()
  })
  it('cancels a load when the document is closed', async () => {
    let resolve!: (value: PDFDocumentProxy) => void
    const pendingDoc = doc()
    vi.mocked(openPdfDoc).mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const pending = S().openFile('pending.pdf', new Uint8Array())
    S().closeFile(); resolve(pendingDoc); await pending
    expect(S().pdfDoc).toBeNull()
    expect(S().busy).toBeNull()
    expect(pendingDoc.destroy).toHaveBeenCalledOnce()
  })
  it('preserves the current document and edits when a new PDF fails', async () => {
    const current = doc()
    vi.mocked(openPdfDoc).mockResolvedValueOnce(current)
    await S().openFile('current.pdf', new Uint8Array())
    S().addElement(shape)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(openPdfDoc).mockRejectedValueOnce(new Error('Invalid PDF'))
    await S().openFile('broken.pdf', new Uint8Array())
    expect(S().pdfDoc).toBe(current)
    expect(S().elements).toHaveLength(1)
    expect(S().errorMsg).toBe('open')
    expect(current.destroy).not.toHaveBeenCalled()
  })
})
