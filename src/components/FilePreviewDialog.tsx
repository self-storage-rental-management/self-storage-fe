import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type FilePreview = { url: string; name: string; type: string }

/** The caller owns/revokes the blob URL; native dialog keeps nested previews above modals. */
export default function FilePreviewDialog({ file, onClose }: { file: FilePreview; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pdf = file.type === 'application/pdf'
  useEffect(() => { dialog.current?.showModal() }, [])
  return createPortal(<dialog ref={dialog} aria-label={`Xem trước ${file.name}`} onCancel={onClose} onClose={onClose}
    onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close() }}
    className="fixed inset-0 m-auto flex max-h-[90dvh] w-[min(820px,calc(100vw-24px))] max-w-none flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-0 text-stone-800 shadow-2xl backdrop:bg-stone-950/45 backdrop:backdrop-blur-sm">
    <header className="flex shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-800"><svg className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h6" /></svg></span>
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold" title={file.name}>{file.name}</h2><p className="mt-0.5 text-[11px] text-stone-500">{pdf ? 'Tài liệu PDF · Vừa chiều rộng' : 'Xem trước tài liệu'}</p></div>
      <a href={file.url} download={file.name} className="shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600">Tải xuống</a>
      <button type="button" autoFocus aria-label="Đóng xem trước" onClick={() => dialog.current?.close()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-600"><svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    </header>
    <div className={`min-h-0 overflow-auto bg-stone-100 p-2 sm:p-3 ${pdf ? 'h-[min(680px,calc(90dvh-80px))]' : ''}`}>
      {pdf ? <iframe title={`Xem PDF: ${file.name}`} src={`${file.url}#view=FitH&zoom=page-width&navpanes=0`} className="h-full w-full rounded-lg border-0 bg-white" />
        : file.type.startsWith('image/') ? <img src={file.url} alt={file.name} className="mx-auto block max-h-[calc(90dvh-108px)] max-w-full rounded-lg object-contain" />
          : <p className="p-6 text-center text-sm text-stone-500">Định dạng này chưa hỗ trợ xem trước. Bạn có thể tải tệp xuống để xem.</p>}
    </div>
  </dialog>, document.body)
}
