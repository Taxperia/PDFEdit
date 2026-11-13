import { useDocStore } from '../store/useDocStore'
import type { PageMeta } from '../types'
import { LINE_HEIGHT_RATIO, textBoxHeight, measureWidth } from '../utils/textLayout'
import { useI18n } from '../i18n/I18nContext'

interface Props {
  page: PageMeta
  zoom: number
}

/**
 * Inline editor overlay for the element currently being edited.
 * For textEdit: a single-line input aligned to the original baseline.
 * For textBox: a multi-line textarea sized to the box.
 */
export default function InlineTextEditor({ page, zoom }: Props) {
  const { t } = useI18n()
  const el = useDocStore((s) => s.elements.find((e) => e.id === s.editingId))
  if (!el || el.pageId !== page.id) return null

  if (el.kind === 'textEdit') {
    const fs = el.fontSize
    const minW = Math.max(el.rect.w * zoom, measureWidth(el.text || el.originalText, fs, el.font === 'bold') * zoom + 14)
    return (
      <input
        key={el.id}
        className="inline-edit"
        aria-label={t('textLabel')}
        autoFocus
        spellCheck={false}
        style={{
          left: el.rect.x * zoom,
          top: (el.baselineTop - fs * 1.02) * zoom,
          width: minW,
          height: fs * zoom * 1.45,
          fontSize: fs * zoom,
          fontWeight: el.font === 'bold' ? 700 : 400,
          color: el.color,
          background: el.bg,
        }}
        value={el.text}
        onChange={(e) => useDocStore.getState().updateElement(el.id, { text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            useDocStore.getState().setEditing(null)
          }
        }}
        onBlur={() => useDocStore.getState().setEditing(null)}
      />
    )
  }

  if (el.kind === 'textBox') {
    const h = Math.max(textBoxHeight(el.text || ' ', el.fontSize, el.width, el.font), el.fontSize * 1.3)
    return (
      <textarea
        key={el.id}
        className="inline-edit ta"
        aria-label={t('textLabel')}
        autoFocus
        spellCheck={false}
        style={{
          left: el.x * zoom,
          top: el.y * zoom,
          width: el.width * zoom,
          height: h * zoom + el.fontSize * zoom * 0.35,
          fontSize: el.fontSize * zoom,
          fontWeight: el.font === 'bold' ? 700 : 400,
          color: el.color,
          lineHeight: LINE_HEIGHT_RATIO,
        }}
        value={el.text}
        onChange={(e) => useDocStore.getState().updateElement(el.id, { text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            useDocStore.getState().setEditing(null)
          }
        }}
        onBlur={() => useDocStore.getState().setEditing(null)}
      />
    )
  }
  return null
}
