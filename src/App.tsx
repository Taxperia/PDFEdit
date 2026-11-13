import { useEffect, useRef, useState } from 'react'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import PageCanvas from './components/PageCanvas'
import PropertiesPanel from './components/PropertiesPanel'
import { useDocStore } from './store/useDocStore'
import { useI18n } from './i18n/I18nContext'
import type { ImageElement } from './types'
import { uid } from './utils/misc'
import { openLocalPdf } from './utils/openFile'
import ErrorNotice from './components/ErrorNotice'

export default function App() {
  const { t, lang, setLang } = useI18n()
  const pdfDoc = useDocStore((s) => s.pdfDoc)
  const busy = useDocStore((s) => s.busy)
  const tool = useDocStore((s) => s.tool)
  const selectedId = useDocStore((s) => s.selectedId)
  const editingId = useDocStore((s) => s.editingId)

  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showPages, setShowPages] = useState(() => window.innerWidth > 900)
  const [showProps, setShowProps] = useState(() => window.innerWidth > 900)
  const dirty = useDocStore((s) => s.revision !== s.savedRevision)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // preload editor fonts so preview measurements match the embedded PDF fonts
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 16px "Noto Sans"'),
      document.fonts.load('700 16px "Noto Sans"'),
    ])
      .then(() => useDocStore.getState().setFontsReady(true))
      .catch(() => useDocStore.getState().setFontsReady(true))
  }, [])

  const openPdfFile = async (file: File) => {
    await openLocalPdf(file, t('confirmReplace'))
  }

  const loadSample = async () => {
    if (useDocStore.getState().busy) return
    useDocStore.setState({ busy: 'open', errorMsg: null })
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample.pdf`)
      if (!res.ok) throw new Error(String(res.status))
      const buf = await res.arrayBuffer()
      await useDocStore.getState().openFile('sample.pdf', new Uint8Array(buf))
    } catch (e) {
      console.error(e)
      useDocStore.getState().setError('open')
      useDocStore.setState({ busy: null })
    }
  }

  // deep link: ?file=<name under public/> opens that PDF on startup
  // (guarded: StrictMode runs effects twice and two openFile calls would race)
  const deepLinkDone = useRef(false)
  useEffect(() => {
    if (deepLinkDone.current) return
    deepLinkDone.current = true
    const q = new URLSearchParams(window.location.search).get('file')
    if (!q || useDocStore.getState().pdfDoc) return
    if (!/^[^\\/\x00-\x1f?#]+\.pdf$/i.test(q) || q.startsWith('.')) {
      useDocStore.getState().setError('fileType')
      return
    }
    const safe = q
    useDocStore.setState({ busy: 'open' })
    fetch(`${import.meta.env.BASE_URL}${encodeURIComponent(safe)}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.arrayBuffer()
      })
      .then((buf) => useDocStore.getState().openFile(safe, new Uint8Array(buf)))
      .catch((e) => {
        console.error(e)
        useDocStore.getState().setError('open')
        useDocStore.setState({ busy: null })
      })
  }, [])

  const handleImageFile = async (file: File | undefined) => {
    if (!file || useDocStore.getState().busy) return
    const sourceDoc = useDocStore.getState().pdfDoc
    try {
      const isPng = file.type === 'image/png'
      const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg'
      if (!isPng && !isJpg) throw new Error('Unsupported image type')
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const bytes = new Uint8Array(await file.arrayBuffer())
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = reject
        img.src = dataUrl
      })
      const s = useDocStore.getState()
      if (s.pdfDoc !== sourceDoc) return
      const page = s.pages[s.currentPageIdx]
      if (!page) return
      s.pushHistory()
      const maxW = 280
      const scale = Math.min(1, maxW / dims.w, page.width * 0.8 / dims.w, page.height * 0.8 / dims.h)
      const el: ImageElement = {
        id: uid(),
        kind: 'image',
        pageId: page.id,
        x: (page.width - dims.w * scale) / 2,
        y: (page.height - dims.h * scale) / 2,
        w: dims.w * scale,
        h: dims.h * scale,
        dataUrl,
        bytes,
        format: isPng ? 'png' : 'jpg',
      }
      s.addElement(el)
      useDocStore.setState({ tool: 'select' })
    } catch (error) {
      console.error(error)
      useDocStore.getState().setError('image')
    }
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useDocStore.getState()
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return
      }
      if (!s.pdfDoc || s.busy) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && k === 'y') {
        e.preventDefault()
        s.redo()
      } else if (mod && k === 'd') {
        e.preventDefault()
        if (s.selectedId) s.duplicateElement(s.selectedId)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (s.selectedId && !s.editingId) {
          s.pushHistory()
          s.deleteElement(s.selectedId)
        }
      } else if (e.key === 'Escape') {
        s.setEditing(null)
        s.select(null)
        s.setTool('select')
      } else if (!mod && k === 'v') {
        s.setTool('select')
      } else if (!mod && k === 't') {
        s.setTool('text')
      } else if (!mod && k === 'r') {
        s.setTool('rect')
      } else if (!mod && k === 'o') {
        s.setTool('ellipse')
      } else if (!mod && k === 'l') {
        s.setTool('line')
      } else if (!mod && k === 'e') {
        s.setTool('eraser')
      } else if (!mod && k === 'i') {
        imageRef.current?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!pdfDoc) {
    return (
      <div
        className={'app-empty' + (dragOver ? ' drag-over' : '')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) openPdfFile(f)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) openPdfFile(f)
            e.target.value = ''
          }}
        />
        <div className="empty-card">
          <div className="logo">P</div>
          <h1>PDFEdit</h1>
          <p className="tagline">{t('tagline')}</p>
          <div className="empty-btns">
            <button className="btn btn-primary big" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              {t('open')}
            </button>
            <button className="btn btn-ghost big" disabled={!!busy} onClick={loadSample}>
              {t('trySample')}
            </button>
          </div>
          <div className="drop-hint">⇣ {t('dropHint')} ⇣</div>
          <p className="empty-hint">{t('emptyHint')}</p>
          <p className="privacy-note">{t('privacy')}</p>
          <p className="privacy-note"><a href={`${import.meta.env.BASE_URL}LICENSE.txt`} target="_blank" rel="noreferrer">{t('licenseLabel')}</a></p>
          <button className="tb-lang" aria-label={t('language')} onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}>{lang === 'tr' ? 'EN' : 'TR'}</button>
        </div>
        {busy && <div className="busy-overlay" role="status">{t('loading')}</div>}
        <ErrorNotice />
      </div>
    )
  }

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files?.[0]
        if (f) openPdfFile(f)
      }}
    >
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => {
          handleImageFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Toolbar onAddImage={() => imageRef.current?.click()} />
      <nav className="panel-toggles" aria-label={t('appName')}>
        <button className="chip" aria-pressed={showPages} onClick={() => setShowPages(!showPages)}>{t('togglePages')}</button>
        <button className="chip" aria-pressed={showProps} onClick={() => setShowProps(!showProps)}>{t('toggleProps')}</button>
        {dirty && <span className="unsaved" role="status">● {t('unsaved')}</span>}
      </nav>
      <div className={'main' + (showPages ? '' : ' hide-pages') + (showProps ? '' : ' hide-props')}>
        <Sidebar />
        <PageCanvas />
        <PropertiesPanel />
      </div>
      {busy && <div className="busy-overlay" role="status">{busy === 'export' ? t('exporting') : t('loading')}</div>}
      <ErrorNotice />
      {tool !== 'select' && !editingId && !selectedId && (
        <div className="toast hint-toast">
          {tool === 'text'
            ? t('toolText')
            : tool === 'rect'
              ? t('toolRect')
              : tool === 'ellipse'
                ? t('toolEllipse')
                : tool === 'line'
                  ? t('toolLine')
                  : tool === 'eraser'
                    ? t('toolEraser')
                    : t('toolSelect')}
        </div>
      )}
    </div>
  )
}
