import { useEffect } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useI18n } from '../i18n/I18nContext'

export default function Sidebar() {
  const { t } = useI18n()
  const pages = useDocStore((s) => s.pages)
  const thumbs = useDocStore((s) => s.thumbs)
  const currentPageIdx = useDocStore((s) => s.currentPageIdx)
  const setCurrentPageIdx = useDocStore((s) => s.setCurrentPageIdx)
  const elements = useDocStore((s) => s.elements)

  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const p of pages) {
        if (!alive) return
        if (!useDocStore.getState().thumbs[p.id]) {
          try {
            await useDocStore.getState().getThumb(p.id)
          } catch (error) {
            if (alive) { console.error(error); useDocStore.getState().setError('render') }
          }
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [pages])

  return (
    <aside className="sidebar">
      <div className="sidebar-title">{t('pages')}</div>
      <div className="thumb-list">
        {pages.map((p, i) => {
          const count = elements.filter((e) => e.pageId === p.id).length
          return (
            <div
              key={p.id}
              className={'thumb-item' + (i === currentPageIdx ? ' active' : '')}
              onClick={() => setCurrentPageIdx(i)}
              role="button"
              tabIndex={0}
              aria-current={i === currentPageIdx ? 'page' : undefined}
              aria-label={`${t('page')} ${i + 1}`}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentPageIdx(i) }
              }}
            >
              <div className="thumb-frame">
                {thumbs[p.id] ? (
                  <img src={thumbs[p.id]} alt={`${t('page')} ${i + 1}`} draggable={false} />
                ) : (
                  <div className="thumb-loading" />
                )}
              </div>
              <div className="thumb-caption">
                <span>
                  {t('page')} {i + 1}
                </span>
                {count > 0 && (
                  <span className="badge" title={`${count} ${t('editsOnPage')}`}>
                    {count}
                  </span>
                )}
              </div>
              <div className="thumb-ops" onClick={(e) => e.stopPropagation()}>
                <button title={t('addPage')} onClick={() => useDocStore.getState().addBlankPage(i)}>
                  +
                </button>
                <button
                  title={t('moveUp')}
                  disabled={i === 0}
                  onClick={() => useDocStore.getState().movePage(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  title={t('moveDown')}
                  disabled={i === pages.length - 1}
                  onClick={() => useDocStore.getState().movePage(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  title={t('deletePage')}
                  disabled={pages.length <= 1}
                  onClick={() => {
                    if (confirm(t('confirmDeletePage'))) useDocStore.getState().deletePage(i)
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
