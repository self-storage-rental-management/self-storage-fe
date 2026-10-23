import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAuthenticatedActor } from '../../services/authApi'
import { listSupportTickets } from '../../services/supportApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { useSupportCommand } from '../../hooks/useSupportCommand'
import { isUuid } from '../../services/renewalOperationsApi'
import type { SupportTicket } from '../../types/supportApi'
import SupportCreateForm from '../../views/support-api/SupportCreateForm'
import SupportTicketDetail from '../../views/support-api/SupportTicketDetail'
import SupportReadState from '../../views/support-api/SupportReadState'
import type { SupportDraft } from '../../views/support-api/SupportActionForm'
import { canReadSupport, supportError, supportStatusLabels, supportTicketVisible } from '../../views/support-api/presentation'
import { Button } from '../ui'
import CustomerSupportAssistant from './CustomerSupportAssistant'
import SupportChannelInfo from './SupportChannelInfo'

function ChatIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return <svg aria-hidden="true" className={`show-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2V11.5A7.5 7.5 0 0 1 11.5 4h1a7.5 7.5 0 0 1 7.5 7.5Z" />
    <path d="M8.5 10h7M8.5 13.5h4.5" />
  </svg>
}

/** API support only. The separate demo chatbot is deliberately not used here. */
export default function CustomerSupportWidget() {
  const actor = getAuthenticatedActor()
  if (!actor || !canReadSupport(actor, 'customer')) return null
  return <WidgetSession key={actor.id} actorId={actor.id} />
}

function WidgetSession({ actorId }: { actorId: string }) {
  const [open, setOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [view, setView] = useState<'assistant' | 'staff'>('assistant')
  const [staffStarted, setStaffStarted] = useState(false)
  const panelId = useId()
  const titleId = useId()
  const launcher = useRef<HTMLButtonElement>(null)
  const minimize = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) minimize.current?.focus()
    else if (started) launcher.current?.focus()
  }, [open, started])
  const hide = () => { setOpen(false) }

  return createPortal(<>
    <button ref={launcher} type="button" aria-label="Mở chat hỗ trợ" title="Chat hỗ trợ"
      aria-expanded={open} aria-controls={started ? panelId : undefined} aria-haspopup="dialog"
      hidden={open} data-expanded={open} aria-hidden={open} inert={open}
      onClick={() => { setStarted(true); setOpen(true) }}
      className="support-chat-launcher fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400 bg-amber-500 text-stone-950 shadow-lg shadow-stone-900/10 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 sm:bottom-6 sm:right-6">
      <ChatIcon className="h-6 w-6" />
    </button>
    {started && <section id={panelId} role="dialog" aria-labelledby={titleId} aria-hidden={!open} inert={!open} data-open={open}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); hide() } }}
      className="support-chat-panel fixed bottom-3 right-3 z-40 flex h-[min(680px,calc(100dvh-24px))] w-[calc(100vw-24px)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-800 shadow-[0_12px_48px_rgba(41,37,36,0.14)] sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100dvh-48px))]">
      <header className="flex shrink-0 items-center gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-800"><ChatIcon /></span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-semibold text-stone-900">{view === 'assistant' ? 'Trợ lý StorageHub' : 'Hỗ trợ StorageHub'}</h2>
          <p className="mt-0.5 text-xs text-stone-500">{view === 'assistant' ? 'Trợ lý AI · Hướng dẫn sử dụng' : 'Trao đổi với nhân viên cơ sở'}</p>
        </div>
        <button ref={minimize} type="button" aria-label="Thu nhỏ chat" title="Thu nhỏ" onClick={hide}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-amber-600">
          <svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 12h12" /></svg>
        </button>
        <button type="button" aria-label="Đóng chat" title="Đóng chat" onClick={hide}
          className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-amber-600">
          <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="flex shrink-0 gap-5 border-b border-stone-200 bg-white px-5" role="group" aria-label="Chọn kênh hỗ trợ">
        {(['assistant', 'staff'] as const).map(channel => <button key={channel} type="button" aria-pressed={view === channel}
          onClick={() => { setView(channel); if (channel === 'staff') setStaffStarted(true) }}
          className={`-mb-px min-h-10 border-b-2 px-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-600 ${view === channel ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          {channel === 'assistant' ? 'Trợ lý' : 'Nhân viên'}
        </button>)}
        <SupportChannelInfo key={`${view}:${open}`} channel={view} />
      </div>
      <div hidden={view !== 'assistant'} className={`${view === 'assistant' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col bg-stone-50/70`}>
        <CustomerSupportAssistant actorId={actorId} active={open && view === 'assistant'} />
      </div>
      {staffStarted && <div hidden={view !== 'staff'} className={`${view === 'staff' ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto overscroll-contain bg-stone-50/70 p-4 sm:p-5`}>
        <SupportWidgetContent actorId={actorId} active={open && view === 'staff'} />
      </div>}
      <footer className="shrink-0 border-t border-stone-100 bg-white px-5 py-2.5 text-center text-[11px] text-stone-500">{view === 'assistant' ? 'Nội dung trợ lý được giữ trong phiên hiện tại.' : 'Cuộc trò chuyện với nhân viên được lưu trong tài khoản.'}</footer>
    </section>}
  </>, document.body)
}

function SupportWidgetContent({ actorId, active }: { actorId: string; active: boolean }) {
  const actor = getAuthenticatedActor()
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string>()
  const [creation, setCreation] = useState<{ parent?: SupportTicket }>()
  const [revision, setRevision] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, SupportDraft>>({})
  const [messageFocus, setMessageFocus] = useState<{ ticketId: string; channel: 'messages'; messageId?: string }>()
  const read = useRentalApiResource(`${actorId}:widget:${page}`, () => listSupportTickets('customer', { page, size: 10, sort: 'updatedAt,desc' }), { retainDataOnRefresh: true })
  const command = useSupportCommand(`${actorId}:support:customer`, (submission, result) => {
    if (submission.kind === 'create' && result && typeof result === 'object' && 'id' in result && isUuid(result.id)) {
      setSelected(result.id)
      setCreation(undefined)
    }
    if (submission.kind === 'command' && submission.command.kind === 'message') {
      setDrafts(previous => ({ ...previous, [submission.id]: { body: '', files: [] } }))
      const messageId = result && typeof result === 'object' && 'id' in result && isUuid(result.id) ? result.id : undefined
      setMessageFocus({ ticketId: submission.id, channel: 'messages', messageId })
    }
    read.refresh()
    setRevision(value => value + 1)
  })
  const locked = command.locked || uploading
  useEffect(() => {
    if (!active || locked) return
    read.refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') read.refresh() }, 8000)
    return () => window.clearInterval(timer)
  }, [active, locked, read.refresh])
  const tickets = read.data?.data.filter(ticket => actor && supportTicketVisible(actor, 'customer', ticket)) ?? []
  const formCommand = { ...command, locked }

  return <div className="space-y-4">
    {(selected || creation) && <button type="button" disabled={locked} onClick={() => { setSelected(undefined); setCreation(undefined); command.clearError() }}
      className="flex min-h-9 items-center gap-2 text-xs font-medium text-stone-600 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-50">
      <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
      Các cuộc trò chuyện
    </button>}
    {uploading && <p role="status" className="text-xs text-stone-600">Đang lưu tệp…</p>}
    {command.busy && <p role="status" className="text-xs text-stone-600">Đang gửi…</p>}
    {!!command.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{supportError(command.error)}</p>}
    {command.conflict && <Button size="sm" variant="outline" onClick={() => { command.clearError(); read.refresh(); setRevision(value => value + 1) }}>Tải lại trạng thái</Button>}
    {command.uncertain && <div role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
      <p>Chưa xác nhận được kết quả gửi. Thử lại yêu cầu cũ để tránh gửi trùng.</p>
      <Button size="sm" disabled={command.busy} onClick={command.retry}>Kiểm tra lại</Button>
    </div>}
    {creation ? <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-stone-900">Bắt đầu cuộc trò chuyện</h3>
      <p className="mb-4 text-xs leading-5 text-stone-500">Chọn cơ sở hoặc hồ sơ liên quan để gửi đúng nơi hỗ trợ.</p>
      <SupportCreateForm command={formCommand} parent={creation.parent} onUploadBusy={setUploading} />
    </div> : selected ? <SupportTicketDetail key={`${selected}:${revision}`} role="customer" id={selected} command={formCommand} chatLayout
      onUploadBusy={setUploading} drafts={{ messages: drafts[selected] ?? { body: '', files: [] } }}
      onDraftChange={(_channel, draft) => setDrafts(previous => ({ ...previous, [selected]: draft }))}
      messageFocus={messageFocus?.ticketId === selected ? messageFocus : undefined}
      onFollowUp={parent => { if (!locked) { setSelected(undefined); setCreation({ parent }) } }} /> : <>
      <div>
        <button type="button" disabled={locked} onClick={() => { command.clearError(); setCreation({}) }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50">
          <ChatIcon className="h-4 w-4" />Cuộc trò chuyện mới
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-xs font-semibold text-stone-600">Cuộc trò chuyện của bạn</h3>
        <button type="button" disabled={locked || read.loading} onClick={read.refresh} className="min-h-8 text-xs text-stone-500 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-50">Làm mới</button>
      </div>
      <SupportReadState {...read} loading={read.loading && !read.data} retry={read.refresh} />
      {tickets.length > 0 && <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {tickets.map(ticket => <button key={ticket.id} type="button" disabled={locked} onClick={() => { command.clearError(); setSelected(ticket.id) }}
          className="block w-full space-y-2 p-4 text-left transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50">
          <div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-medium text-stone-500">{ticket.displayCode || `#${ticket.id.slice(0, 8)}`}</span><span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600">{supportStatusLabels[ticket.status]}</span></div>
          <p className="line-clamp-2 break-words text-sm font-medium leading-5 text-stone-800">{ticket.subject}</p>
        </button>)}
      </div>}
      {read.data && !read.error && !tickets.length && <p className="rounded-xl border border-dashed border-stone-200 px-5 py-6 text-center text-xs leading-5 text-stone-500">Chưa có cuộc trò chuyện nào.<br />Các trao đổi của bạn sẽ xuất hiện ở đây.</p>}
      {read.data && read.data.pagination.totalPages > 1 && <nav aria-label="Trang hội thoại" className="flex items-center justify-between gap-3">
        <Button size="sm" variant="ghost" disabled={locked || page === 0} onClick={() => setPage(value => value - 1)}>Trước</Button>
        <span className="text-xs text-stone-500">Trang {page + 1} / {read.data.pagination.totalPages}</span>
        <Button size="sm" variant="ghost" disabled={locked || page + 1 >= read.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Sau</Button>
      </nav>}
    </>}
  </div>
}
