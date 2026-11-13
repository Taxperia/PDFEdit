import { useDocStore } from '../store/useDocStore'
import { useI18n } from '../i18n/I18nContext'
import type { TKey } from '../i18n/translations'

export default function ErrorNotice() {
  const error = useDocStore((s) => s.errorMsg)
  const { t } = useI18n()
  if (!error) return null
  const messages: Record<typeof error, TKey> = {
    open: 'errorOpen', export: 'errorExport', image: 'errorImage',
    render: 'errorRender', fileType: 'errorFileType',
  }
  return <div className="toast error" role="alert">
    <span>{t(messages[error])}</span>
    <button className="notice-close" aria-label={t('dismiss')} onClick={() => useDocStore.getState().setError(null)}>×</button>
  </div>
}
