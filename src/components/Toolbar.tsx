import { useRef } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useI18n } from '../i18n/I18nContext'
import type { Tool } from '../types'
import { downloadBlob } from '../utils/misc'
import { openLocalPdf } from '../utils/openFile'

function IconTool({ tool }: { tool: Tool }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (tool) {
    case 'select':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M6 3l12 11-5.5 1 3 6-2.5 1-3-6L6 20z" {...p} />
        </svg>
      )
    case 'text':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M5 5h14M12 5v14M9 19h6" {...p} />
        </svg>
      )
    case 'rect':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect x="4" y="6" width="16" height="12" rx="1" {...p} />
        </svg>
      )
    case 'ellipse':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <ellipse cx="12" cy="12" rx="8" ry="6" {...p} />
        </svg>
      )
    case 'line':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M5 19L19 5" {...p} />
        </svg>
      )
    case 'eraser':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M15.5 4.5l4 4L9 19H5v-4z" {...p} />
          <path d="M12.5 7.5l4 4" {...p} />
        </svg>
      )
    default:
      return null
  }
}

function Icon({ name }: { name: string }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'undo':
      return (
        <svg viewBox="0 0 24 24" width="17" height="17">
          <path d="M9 14L4 9l5-5" {...p} />
          <path d="M4 9h10a6 6 0 016 6v0a6 6 0 01-6 6h-3" {...p} />
        </svg>
      )
    case 'redo':
      return (
        <svg viewBox="0 0 24 24" width="17" height="17">
          <path d="M15 14l5-5-5-5" {...p} />
          <path d="M20 9H10a6 6 0 00-6 6v0a6 6 0 006 6h3" {...p} />
        </svg>
      )
    case 'zoom-out':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="10.5" cy="10.5" r="6.5" {...p} />
          <path d="M15.5 15.5L21 21M7.5 10.5h6" {...p} />
        </svg>
      )
    case 'zoom-in':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="10.5" cy="10.5" r="6.5" {...p} />
          <path d="M15.5 15.5L21 21M7.5 10.5h6M10.5 7.5v6" {...p} />
        </svg>
      )
    case 'fit':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...p} />
        </svg>
      )
    case 'image':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect x="3.5" y="5" width="17" height="14" rx="2" {...p} />
          <circle cx="9" cy="10" r="1.6" {...p} />
          <path d="M3.5 16.5l5-4.5 4 3.5 3-2.5 5 4" {...p} />
        </svg>
      )
    default:
      return null
  }
}

export default function Toolbar({ onAddImage }: { onAddImage: () => void }) {
  const { t, lang, setLang } = useI18n()
  const fileName = useDocStore((s) => s.fileName)
  const tool = useDocStore((s) => s.tool)
  const setTool = useDocStore((s) => s.setTool)
  const zoom = useDocStore((s) => s.zoom)
  const setZoom = useDocStore((s) => s.setZoom)
  const setZoomFit = useDocStore((s) => s.setZoomFit)
  const busy = useDocStore((s) => s.busy)
  const canUndo = useDocStore((s) => s.past.length > 0)
  const canRedo = useDocStore((s) => s.future.length > 0)
  const undo = useDocStore((s) => s.undo)
  const redo = useDocStore((s) => s.redo)
  const pdfDoc = useDocStore((s) => s.pdfDoc)
  const setError = useDocStore((s) => s.setError)

  const fileRef = useRef<HTMLInputElement>(null)

  const onOpenFile = async (file: File | undefined) => {
    await openLocalPdf(file, t('confirmReplace'))
  }

  const doExport = async () => {
    const s = useDocStore.getState()
    if (!s.pdfBytes || s.busy) return
    useDocStore.setState({ busy: 'export', editingId: null })
    s.setError(null)
    try {
      const { buildExportedPdf } = await import('../pdf/exportPdf')
      const bytes = await buildExportedPdf({ pdfBytes: s.pdfBytes, pages: s.pages, elements: s.elements })
      const base = (s.fileName ?? 'document').replace(/\.pdf$/i, '')
      downloadBlob(`${base}-edited.pdf`, new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      if (useDocStore.getState().pdfDoc === s.pdfDoc) useDocStore.getState().markExported(s.revision)
    } catch (e) {
      console.error(e)
      setError('export')
    } finally {
      useDocStore.setState({ busy: null })
    }
  }

  const exporting = busy === 'export'

  return (
    <header className="toolbar">
      <div className="tb-group">
        <button className="btn btn-primary" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {t('open')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            onOpenFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span className="fname" title={fileName ?? ''}>
          {fileName}
        </span>
      </div>

      <div className="tb-sep" />

      <div className="tb-group tools">
        {(['select', 'text', 'rect', 'ellipse', 'line', 'eraser'] as Tool[]).map((tl) => (
          <button
            key={tl}
            aria-pressed={tool === tl}
            className={'tb-btn' + (tool === tl ? ' active' : '')}
            title={t(
              tl === 'select'
                ? 'toolSelect'
                : tl === 'text'
                  ? 'toolText'
                  : tl === 'rect'
                    ? 'toolRect'
                    : tl === 'ellipse'
                      ? 'toolEllipse'
                      : tl === 'line'
                        ? 'toolLine'
                        : 'toolEraser',
            )}
            onClick={() => setTool(tl)}
          >
            <IconTool tool={tl} />
          </button>
        ))}
        <button
          className={'tb-btn' + (tool === 'image' ? ' active' : '')}
          title={t('toolImage')}
          onClick={onAddImage}
        >
          <Icon name="image" />
        </button>
      </div>

      <div className="tb-sep" />

      <div className="tb-group">
        <button className="tb-btn" title={t('undo')} disabled={!canUndo} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button className="tb-btn" title={t('redo')} disabled={!canRedo} onClick={redo}>
          <Icon name="redo" />
        </button>
      </div>

      <div className="tb-sep" />

      <div className="tb-group zoom-group">
        <button className="tb-btn" title={t('zoomOut')} onClick={() => setZoom(zoom - 0.15)}>
          <Icon name="zoom-out" />
        </button>
        <button className="zoom-label" title={t('fit')} onClick={() => setZoomFit(document.querySelector('.canvas-area')?.clientWidth ?? window.innerWidth)}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="tb-btn" title={t('zoomIn')} onClick={() => setZoom(zoom + 0.15)}>
          <Icon name="zoom-in" />
        </button>
        <button className="tb-btn" title={t('fit')} onClick={() => setZoomFit(document.querySelector('.canvas-area')?.clientWidth ?? window.innerWidth)}>
          <Icon name="fit" />
        </button>
      </div>

      <div className="tb-spacer" />

      <button className="tb-lang" aria-label={t('language')} onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}>
        {lang === 'tr' ? 'EN' : 'TR'}
      </button>

      <button
        className="btn btn-accent"
        onClick={doExport}
        disabled={!pdfDoc || exporting || busy === 'open'}
      >
        {exporting ? t('exporting') : t('export')}
      </button>
    </header>
  )
}
