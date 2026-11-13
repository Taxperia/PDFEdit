import { useDocStore } from '../store/useDocStore'

export function confirmReplaceDocument(message: string): boolean {
  const s = useDocStore.getState()
  if (s.busy) return false
  return s.revision === s.savedRevision || window.confirm(message)
}

export async function openLocalPdf(file: File | undefined, confirmMessage: string): Promise<void> {
  if (!file) return
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    useDocStore.getState().setError('fileType')
    return
  }
  if (!confirmReplaceDocument(confirmMessage)) return
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await useDocStore.getState().openFile(file.name, bytes)
  } catch (error) {
    console.error(error)
    useDocStore.getState().setError('open')
  }
}
