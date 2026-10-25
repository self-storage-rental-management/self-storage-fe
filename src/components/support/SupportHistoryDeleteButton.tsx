import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supportError } from '../../views/support-api/presentation'

export default function SupportHistoryDeleteButton({ subject, description, disabled, onDelete }: {
  subject: string; description: string; disabled?: boolean; onDelete: () => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>()
  const confirm = async () => {
    if (busy || disabled) return
    setBusy(true); setError(undefined)
    try { await onDelete(); dialog.current?.close() }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" aria-label={`Xóa hội thoại ${subject}`} title="Xóa lịch sử trò chuyện" disabled={disabled || busy}
      onClick={() => { setError(undefined); dialog.current?.showModal() }}
      className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-[#659c7c] disabled:opacity-40">
      <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" /></svg>
    </button>
    {typeof document !== 'undefined' && createPortal(<dialog ref={dialog} aria-labelledby={titleId}
      onCancel={event => { if (busy) event.preventDefault() }}
      onClick={event => { if (!busy && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close() } }}
      className="fixed inset-0 m-auto w-[min(360px,calc(100vw-32px))] rounded-2xl border-0 bg-white p-5 text-stone-800 shadow-xl backdrop:bg-black/25">
      <h3 id={titleId} className="text-base font-semibold">Xóa lịch sử trò chuyện?</h3>
      <p className="mt-2 break-words text-sm font-medium">{subject}</p>
      <p className="mt-2 text-xs leading-5 text-stone-500">{description}</p>
      {!!error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs leading-5 text-rose-800">{supportError(error)}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="min-h-9 rounded-full px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">Giữ lại</button>
        <button type="button" disabled={busy || disabled} onClick={() => void confirm()} className="min-h-9 rounded-full bg-rose-700 px-4 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{busy ? 'Đang xóa…' : 'Xóa lịch sử'}</button>
      </div>
    </dialog>, document.body)}
  </>
}
