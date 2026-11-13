import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { useDocStore } from '../store/useDocStore'
import type { EditElement, PageMeta, ShapeElement, TextLine, TextBoxElement, Tool } from '../types'
import { sampleRegionBg } from '../utils/colorSample'
import { textBoxHeight } from '../utils/textLayout'
import { uid } from '../utils/misc'

interface Props {
  page: PageMeta
  zoom: number
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

interface DragState {
  id: string
  kind: 'move' | 'resize'
  handle?: string
  startClientX: number
  startClientY: number
  orig: EditElement
  isTextEdit: boolean
  /** history snapshot is taken lazily, on the first real movement */
  historyPushed: boolean
}

interface Preview {
  sx: number
  sy: number
  ex: number
  ey: number
}

function normBox(el: EditElement): { x: number; y: number; w: number; h: number } {
  if (el.kind === 'textEdit') return el.rect
  if (el.kind === 'textBox')
    return {
      x: el.x,
      y: el.y,
      w: el.width,
      h: Math.max(textBoxHeight(el.text || ' ', el.fontSize, el.width, el.font), el.fontSize * 1.2),
    }
  if (el.kind === 'image') return { x: el.x, y: el.y, w: el.w, h: el.h }
  return {
    x: Math.min(el.x, el.x + el.w),
    y: Math.min(el.y, el.y + el.h),
    w: Math.abs(el.w),
    h: Math.abs(el.h),
  }
}

function handlesFor(el: EditElement): string[] {
  if (el.kind === 'textBox') return ['w', 'e']
  if (el.kind === 'shape' && el.shape === 'line') return ['start', 'end']
  if (el.kind === 'shape' || el.kind === 'image')
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  return [] // textEdit: resizable via properties panel only
}

function handleCursor(handle: string): string {
  if (handle === 'start' || handle === 'end') return 'move'
  if (handle === 'nw' || handle === 'se') return 'nwse-resize'
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize'
  if (handle === 'n' || handle === 's') return 'ns-resize'
  return 'ew-resize'
}

function handleStyle(handle: string, el: EditElement, box: { x: number; y: number }, zoom: number): CSSProperties {
  if (el.kind === 'shape' && el.shape === 'line') {
    const isStart = handle === 'start'
    const px = (isStart ? el.x : el.x + el.w) - box.x
    const py = (isStart ? el.y : el.y + el.h) - box.y
    return { left: px * zoom - 5, top: py * zoom - 5 }
  }
  const map: Record<string, CSSProperties> = {
    nw: { left: -5, top: -5 },
    n: { left: 'calc(50% - 5px)', top: -5 },
    ne: { left: 'calc(100% - 5px)', top: -5 },
    e: { left: 'calc(100% - 5px)', top: 'calc(50% - 5px)' },
    se: { left: 'calc(100% - 5px)', top: 'calc(100% - 5px)' },
    s: { left: 'calc(50% - 5px)', top: 'calc(100% - 5px)' },
    sw: { left: -5, top: 'calc(100% - 5px)' },
    w: { left: -5, top: 'calc(50% - 5px)' },
  }
  return map[handle] ?? {}
}

function applyResize(o: EditElement, handle: string, dx: number, dy: number): Partial<EditElement> | null {
  if (o.kind === 'textBox') {
    if (handle === 'e') return { width: Math.max(30, o.width + dx) }
    if (handle === 'w') {
      const width = Math.max(30, o.width - dx)
      return { x: o.x + (o.width - width), width }
    }
    return null
  }
  if (o.kind === 'shape' && o.shape === 'line') {
    if (handle === 'start') return { x: o.x + dx, y: o.y + dy, w: o.w - dx, h: o.h - dy }
    if (handle === 'end') return { w: o.w + dx, h: o.h + dy }
    return null
  }
  if (o.kind === 'shape' || o.kind === 'image') {
    const east = handle.includes('e')
    const west = handle.includes('w')
    const north = handle.includes('n')
    const south = handle.includes('s')
    if (o.kind === 'image' && east !== west && north !== south) {
      // corner resize keeps aspect ratio
      const ratio = o.h / Math.max(0.01, o.w)
      let newW = east ? Math.max(12, o.w + dx) : Math.max(12, o.w - dx)
      let newH = newW * ratio
      if (newH < 12) {
        newH = 12
        newW = 12 / Math.max(0.01, ratio)
      }
      return {
        x: west ? o.x + (o.w - newW) : o.x,
        y: north ? o.y + (o.h - newH) : o.y,
        w: newW,
        h: newH,
      }
    }
    let { x, y, w, h } = o
    if (east) w = Math.max(6, o.w + dx)
    if (west) {
      const nw = Math.max(6, o.w - dx)
      x = o.x + (o.w - nw)
      w = nw
    }
    if (north) {
      const nh = Math.max(6, o.h - dy)
      y = o.y + (o.h - nh)
      h = nh
    }
    if (south) h = Math.max(6, o.h + dy)
    return { x, y, w, h }
  }
  return null
}

export default function HitLayer({ page, zoom, canvasRef }: Props) {
  const tool = useDocStore((s) => s.tool)
  const elements = useDocStore((s) => s.elements)
  const selectedId = useDocStore((s) => s.selectedId)
  const editingId = useDocStore((s) => s.editingId)
  const [lines, setLines] = useState<TextLine[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let alive = true
    setLines([])
    useDocStore
      .getState()
      .getTextLinesFor(page.id)
      .then((ls) => {
        if (alive) setLines(ls)
      })
      .catch((error) => {
        if (alive) { console.error(error); useDocStore.getState().setError('render') }
      })
    return () => {
      alive = false
    }
  }, [page.id])

  const pageEls = elements.filter((e) => e.pageId === page.id)
  const editedKeys = new Set(
    pageEls.filter((e): e is EditElement & { lineKey: string } => e.kind === 'textEdit').map((e) => e.lineKey),
  )
  const selectedEl = pageEls.find((e) => e.id === selectedId) ?? null

  const toPagePt = (e: RPointerEvent<HTMLElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
  }

  // ---- page-level interactions: deselect / draw / create text ----
  const onPagePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const s = useDocStore.getState()
    // the page canvas never needs native default behavior (focus/selection),
    // and canceling it keeps newly opened inline editors from being blurred
    e.preventDefault()
    const pt = toPagePt(e)
    if (s.tool === 'select') {
      s.select(null)
      if (s.editingId) s.setEditing(null)
      return
    }
    if (s.tool === 'text') {
      s.pushHistory()
      const el: TextBoxElement = {
        id: uid(),
        kind: 'textBox',
        pageId: page.id,
        x: pt.x,
        y: pt.y - 12,
        width: 220,
        text: '',
        fontSize: 16,
        font: 'regular',
        color: '#111827',
        align: 'left',
      }
      s.addElement(el)
      s.setTool('select')
      // Creation already recorded its own undo step.
      useDocStore.setState({ editingId: el.id, selectedId: el.id })
      return
    }
    // rect / ellipse / line: start a draw gesture
    drawStartRef.current = { x: pt.x, y: pt.y }
    setPreview({ sx: pt.x, sy: pt.y, ex: pt.x, ey: pt.y })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPagePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const st = drawStartRef.current
    if (!st) return
    const pt = toPagePt(e)
    setPreview({ sx: st.x, sy: st.y, ex: pt.x, ey: pt.y })
  }

  const onPagePointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const s = useDocStore.getState()
    const st = drawStartRef.current
    const shapeTool = s.tool as Tool
    if (st && shapeTool === 'eraser') {
      const pt = toPagePt(e)
      let w = Math.abs(pt.x - st.x)
      let h = Math.abs(pt.y - st.y)
      let x = Math.min(st.x, pt.x)
      let y = Math.min(st.y, pt.y)
      if (w < 4 && h < 4) {
        // a bare click still erases a small patch
        w = 30
        h = 14
        x = st.x - 15
        y = st.y - 7
      }
      s.pushHistory()
      const pixelScale = canvasRef.current ? canvasRef.current.width / page.width : zoom
      const bg = sampleRegionBg(canvasRef.current, { x, y, w, h }, pixelScale)
      const el: ShapeElement = {
        id: uid(),
        kind: 'shape',
        pageId: page.id,
        shape: 'rect',
        x,
        y,
        w,
        h,
        fill: bg,
        stroke: '',
        strokeWidth: 0,
      }
      s.addElement(el)
      s.setTool('select')
    } else if (st && (shapeTool === 'rect' || shapeTool === 'ellipse' || shapeTool === 'line')) {
      const pt = toPagePt(e)
      if (shapeTool === 'line') {
        let w = pt.x - st.x
        let h = pt.y - st.y
        if (Math.abs(w) < 8 && Math.abs(h) < 8) {
          w = 120
          h = 0
        }
        s.pushHistory()
        const el: ShapeElement = {
          id: uid(),
          kind: 'shape',
          pageId: page.id,
          shape: 'line',
          x: st.x,
          y: st.y,
          w,
          h,
          fill: '',
          stroke: '#e5322d',
          strokeWidth: 2,
        }
        s.addElement(el)
      } else {
        let w = Math.abs(pt.x - st.x)
        let h = Math.abs(pt.y - st.y)
        let x = Math.min(st.x, pt.x)
        let y = Math.min(st.y, pt.y)
        if (w < 8 && h < 8) {
          w = 140
          h = 90
          x = st.x - 70
          y = st.y - 45
        }
        s.pushHistory()
        const el: ShapeElement = {
          id: uid(),
          kind: 'shape',
          pageId: page.id,
          shape: shapeTool,
          x,
          y,
          w,
          h,
          fill: '#fbbf24',
          stroke: '#b45309',
          strokeWidth: 1,
        }
        s.addElement(el)
      }
      s.setTool('select')
    }
    drawStartRef.current = null
    setPreview(null)
  }

  // ---- element drag / resize ----
  const startMove = (e: RPointerEvent<HTMLDivElement>, el: EditElement) => {
    if (editingId) return
    e.stopPropagation()
    dragRef.current = {
      id: el.id,
      kind: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      orig: structuredClone(el),
      isTextEdit: el.kind === 'textEdit',
      historyPushed: false,
    }
    useDocStore.getState().select(el.id)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const startResize = (e: RPointerEvent<HTMLDivElement>, el: EditElement, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      id: el.id,
      kind: 'resize',
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      orig: structuredClone(el),
      isTextEdit: false,
      historyPushed: false,
    }
    useDocStore.getState().select(el.id)
    const frame = (e.currentTarget as HTMLElement).closest('.sel-frame') as HTMLElement | null
    if (frame) frame.setPointerCapture(e.pointerId)
  }

  const onDragMove = (e: RPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startClientX) / zoom
    const dy = (e.clientY - drag.startClientY) / zoom
    // only commit a history snapshot (and start moving) after a real gesture,
    // so a plain click on an element doesn't pollute undo history
    if (!drag.historyPushed) {
      if (Math.abs(dx) * zoom < 3 && Math.abs(dy) * zoom < 3) return
      useDocStore.getState().pushHistory()
      drag.historyPushed = true
    }
    const o = drag.orig
    if (drag.kind === 'move') {
      if (o.kind === 'textEdit') {
        useDocStore.getState().updateElement(o.id, {
          rect: { ...o.rect, x: o.rect.x + dx, y: o.rect.y + dy },
          baselineTop: o.baselineTop + dy,
        })
      } else {
        useDocStore.getState().updateElement(o.id, { x: o.x + dx, y: o.y + dy })
      }
    } else {
      const patch = applyResize(o, drag.handle ?? '', dx, dy)
      if (patch) useDocStore.getState().updateElement(o.id, patch)
    }
  }

  const onDragUp = () => {
    const drag = dragRef.current
    // a textEdit released without any movement means "open the editor"
    if (drag?.isTextEdit && !drag.historyPushed) {
      useDocStore.getState().setEditing(drag.id)
    }
    dragRef.current = null
  }

  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair'

  return (
    <div
      className="page-hit"
      style={{ cursor }}
      onPointerDown={onPagePointerDown}
      onPointerMove={onPagePointerMove}
      onPointerUp={onPagePointerUp}
      onPointerCancel={() => { drawStartRef.current = null; dragRef.current = null; setPreview(null) }}
    >
      {/* clickable original text lines (only where not already covered by a textEdit) */}
      {tool === 'select' &&
        lines.map((line) =>
          editedKeys.has(line.key) ? null : (
            <div
              key={line.key}
              className="orig-line"
              title={line.text}
              style={{
                left: (line.rect.x - 1) * zoom,
                top: (line.rect.y - 1) * zoom,
                width: (line.rect.w + 2) * zoom,
                height: (line.rect.h + 2) * zoom,
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                // prevent the subsequent mousedown from blurring the inline
                // editor that opens with this gesture
                e.preventDefault()
                useDocStore
                  .getState()
                  .createTextEditForLine(page.id, line, canvasRef.current, canvasRef.current ? canvasRef.current.width / page.width : zoom)
              }}
            />
          ),
        )}

      {/* element hit boxes */}
      {tool === 'select' &&
        pageEls.map((el) => {
          const box = normBox(el)
          const isTextEdit = el.kind === 'textEdit'
          const isEditing = el.id === editingId
          if (isEditing) return null
          return (
            <div
              key={el.id}
              className={'el-hit' + (el.id === selectedId ? ' selected' : '')}
              style={{
                left: box.x * zoom,
                top: box.y * zoom,
                width: box.w * zoom,
                height: box.h * zoom,
                cursor: 'move',
              }}
              title={isTextEdit ? 'textEdit' : undefined}
              onPointerDown={(e) => {
                e.stopPropagation()
                if (isTextEdit) {
                  // keep the focus-protect for the inline editor opened on a
                  // clean (non-dragged) release
                  e.preventDefault()
                }
                startMove(e, el)
              }}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
              onDoubleClick={() => {
                if (el.kind === 'textBox') useDocStore.getState().setEditing(el.id)
              }}
            />
          )
        })}

      {/* selection frame with resize handles */}
      {tool === 'select' && selectedEl && selectedEl.id !== editingId && (
        <div
          className="sel-frame"
          style={(() => {
            const b = normBox(selectedEl)
            return {
              left: b.x * zoom,
              top: b.y * zoom,
              width: b.w * zoom,
              height: b.h * zoom,
            }
          })()}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
        >
          {handlesFor(selectedEl).map((h) => (
            <div
              key={h}
              className={'sel-handle ' + handleCursor(h)}
              style={handleStyle(h, selectedEl, normBox(selectedEl), zoom)}
              onPointerDown={(e) => startResize(e, selectedEl, h)}
            />
          ))}
        </div>
      )}

      {/* draw preview */}
      {preview && (tool === 'line' ? (
        <svg className="preview-svg">
          <line
            x1={preview.sx * zoom}
            y1={preview.sy * zoom}
            x2={preview.ex * zoom}
            y2={preview.ey * zoom}
            stroke="#2563eb"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        </svg>
      ) : tool === 'rect' || tool === 'ellipse' || tool === 'eraser' ? (
        <div
          className="preview-shape"
          style={{
            left: Math.min(preview.sx, preview.ex) * zoom,
            top: Math.min(preview.sy, preview.ey) * zoom,
            width: Math.abs(preview.ex - preview.sx) * zoom,
            height: Math.abs(preview.ey - preview.sy) * zoom,
            borderRadius: tool === 'ellipse' ? '50%' : '2px',
          }}
        />
      ) : null)}
    </div>
  )
}
