import { useEffect, useRef, useState } from 'react'
import { useDocStore } from '../store/useDocStore'
import { renderPage } from '../pdf/loadPdf'
import ContentSvg from './ContentSvg'
import HitLayer from './HitLayer'
import InlineTextEditor from './InlineTextEditor'
import { useI18n } from '../i18n/I18nContext'

export default function PageCanvas() {
  const { t } = useI18n()
  const pdfDoc = useDocStore((s) => s.pdfDoc)
  const pages = useDocStore((s) => s.pages)
  const currentPageIdx = useDocStore((s) => s.currentPageIdx)
  const zoom = useDocStore((s) => s.zoom)
  const elements = useDocStore((s) => s.elements)
  const editingId = useDocStore((s) => s.editingId)
  const fileName = useDocStore((s) => s.fileName)
  const page = pages[currentPageIdx]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const fittedFor = useRef<unknown>(null)
  const [rendering, setRendering] = useState(false)
  const [renderFailed, setRenderFailed] = useState(false)

  // fit zoom once per opened document (keyed on the pdfDoc object so a
  // re-opened file always re-fits, even under StrictMode double effects)
  useEffect(() => {
    if (pdfDoc && areaRef.current && fittedFor.current !== pdfDoc) {
      fittedFor.current = pdfDoc
      useDocStore.getState().setZoomFit(areaRef.current.clientWidth)
    }
  }, [pdfDoc, fileName])

  // Ctrl + mouse wheel zooms; plain wheel scrolls (native listener so we can
  // preventDefault outside React's passive wheel handler)
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const s = useDocStore.getState()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      s.setZoom(s.zoom * factor)
    }
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => area.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const canvas = canvasRef.current
      if (!canvas || !pdfDoc || !page) return
      setRendering(true)
      setRenderFailed(false)
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      try {
        if (page.srcIndex < 0) {
          const dpr = window.devicePixelRatio || 1
          canvas.width = Math.max(1, Math.round(page.width * zoom * dpr))
          canvas.height = Math.max(1, Math.round(page.height * zoom * dpr))
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
        } else {
          const rendered = await renderPage(pdfDoc, page.srcIndex, zoom, window.devicePixelRatio || 1)
          if (cancelled || !rendered) return
          canvas.width = rendered.width
          canvas.height = rendered.height
          canvas.getContext('2d')?.drawImage(rendered, 0, 0)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          setRenderFailed(true)
          useDocStore.getState().setError('render')
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, page?.id, page?.srcIndex, zoom])

  if (!page) return null

  return (
    <div className="canvas-area" ref={areaRef}>
      <div className="page-outer">
        <div
          className="page-shell"
          style={{ width: page.width * zoom, height: page.height * zoom }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <ContentSvg page={page} elements={elements} hideIds={editingId ? [editingId] : []} />
          <HitLayer page={page} zoom={zoom} canvasRef={canvasRef} />
          <InlineTextEditor page={page} zoom={zoom} />
          {rendering && <div className="page-loading" role="status">{t('loading')}</div>}
          {renderFailed && <div className="page-loading" role="alert">{t('errorRender')}</div>}
        </div>
      </div>
    </div>
  )
}
