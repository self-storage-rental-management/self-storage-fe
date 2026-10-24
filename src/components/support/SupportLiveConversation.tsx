import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { useSupportCommand } from '../../hooks/useSupportCommand'
import { getSupportTicket, listSupportMessages } from '../../services/supportApi'
import { getAuthenticatedActor } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import type { SupportMessage, SupportTicket } from '../../types/supportApi'
import { supportActions, supportError, supportTicketVisible } from '../../views/support-api/presentation'
import { EvidenceDownload, EvidenceUpload } from '../../views/rental-support-integration/EvidenceControls'
import SupportReplyText from './SupportReplyText'
import { useSupportMessageReads } from '../../hooks/useSupportMessageReads'

export default function SupportLiveConversation({ actorId, id, active, fallback, onStatus, onLocked, onResolved, onRequestAgain, assistantContent, assistantComposer }: {
  actorId: string; id: string; active: boolean; fallback: ReactNode;
  onStatus: (status: string) => void; onLocked: (locked: boolean) => void
  onResolved?: () => void
  onRequestAgain?: () => void
  assistantContent?: ReactNode
  assistantComposer?: ReactNode
}) {
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = input.current
    if (!field) return
    field.style.height = '32px'
    const height = Math.min(120, Math.max(32, field.scrollHeight))
    field.style.height = `${height}px`
    field.style.overflowY = field.scrollHeight > height ? 'auto' : 'hidden'
  }, [draft, assistantComposer])
  const [files, setFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [lastGood, setLastGood] = useState<{ ticket: SupportTicket; messages: SupportMessage[] }>()
  const log = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const read = useRentalApiResource(`${actorId}:live-support:${id}`, async () => {
    const [ticket, first] = await Promise.all([getSupportTicket('customer', id), listSupportMessages('customer', id, 0, 100, 'PUBLIC')])
    const messages = [...first.data]
    for (let page = 1; page < first.pagination.totalPages; page++) {
      const next = await listSupportMessages('customer', id, page, 100, 'PUBLIC')
      messages.push(...next.data)
    }
    return { ticket, messages: [...new Map(messages.map(message => [message.id, message])).values()] }
  }, { retainDataOnRefresh: true })
  const command = useSupportCommand(`${actorId}:support:customer`, submission => {
    if (submission.kind === 'command' && submission.command.kind === 'message') { setDraft(''); setFiles([]) }
    nearBottom.current = true
    read.refresh()
  })
  const locked = command.locked || uploading
  useEffect(() => { onLocked(locked); return () => onLocked(false) }, [locked, onLocked])
  useEffect(() => { if (read.data) setLastGood(read.data) }, [read.data])
  const unavailable = read.error instanceof ApiClientError && [401, 403, 404].includes(read.error.status ?? 0)
  const data = unavailable ? undefined : read.data ?? lastGood
  const ticket = data?.ticket
  const status = unavailable ? 'Không thể truy cập cuộc trò chuyện' : ticket?.status === 'closed' ? 'Cuộc trò chuyện đã kết thúc' : ticket?.status === 'resolved' ? 'Nhân viên đã xử lý' : !ticket?.acceptedAt ? 'Đang chờ nhân viên' : `${ticket.assignedStaffName?.trim() || 'Nhân viên'} đang hỗ trợ`
  useEffect(() => { onStatus(status) }, [status, onStatus])
  useEffect(() => {
    if (!active || locked || read.loading) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') read.refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [active, locked, read.loading, read.refresh])
  useEffect(() => { if (active && nearBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight }, [active, data, command.error, assistantContent])
  const actor = getAuthenticatedActor()
  const visible = !!(ticket && actor && actor.id === actorId && supportTicketVisible(actor, 'customer', ticket))
  const actions = visible ? supportActions(getAuthenticatedActor(), 'customer', ticket) : []
  useSupportMessageReads('customer', id, data?.messages ?? [], active && visible, log)
  useEffect(() => {
    if (active && visible && !locked && (ticket?.status === 'resolved' || ticket?.status === 'closed')) onResolved?.()
  }, [active, visible, locked, ticket?.status, onResolved])
  const send = () => {
    if (!ticket || !visible || locked || command.conflict || !actions.includes('message') || (!draft.trim() && !files.length) || getAuthenticatedActor()?.id !== actorId) return
    void command.run({ kind: 'command', role: 'customer', id, command: { kind: 'message', body: draft.trim(), expectedVersion: ticket.version!, evidenceFileIds: files } })
  }
  return <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
    <div ref={log} role="log" aria-label="Cuộc trò chuyện hỗ trợ" aria-live="polite" aria-relevant="additions" onScroll={() => { const area = log.current; if (area) nearBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 120 }} className="min-h-0 space-y-3.5 overflow-y-auto overscroll-contain bg-[#fcfefc] px-4 py-5">
      {!data && !unavailable && fallback}
      {visible && data?.messages.map(message => {
        const ai = message.authorRole === 'AI_CONTEXT'
        const customer = !ai && message.authorId === actorId
        return <div key={message.id} data-support-message-id={message.id} className={`flex flex-col ${customer ? 'items-end' : 'items-start'}`}>
          <span className="mb-1 px-1 text-[10px] font-medium text-stone-500">{ai ? 'Trợ lý StorageHub · Lịch sử chuyển tiếp' : customer ? 'Bạn' : message.authorRole === 'MANAGER' ? 'Quản lý' : ticket.assignedStaffName || 'Nhân viên hỗ trợ'}</span>
          {!!message.body.trim() && <div className={`support-bubble text-sm ${customer ? 'support-bubble--sent' : 'support-bubble--received'}`}>
            {ai ? <SupportReplyText text={message.body} /> : <p className="whitespace-pre-wrap">{message.body}</p>}
          </div>}
          {!!message.evidenceFileIds?.length && <div className={`mt-2 flex max-w-full flex-col gap-2 ${customer ? 'items-end' : 'items-start'}`}>{message.evidenceFileIds.map((file, index) => <EvidenceDownload key={file} id={file} index={index + 1} asLink chatFile />)}</div>}
        </div>
      })}
      {visible && <p role="status" className="rounded-xl bg-[#f0f5f1] px-3.5 py-2.5 text-xs leading-5 text-stone-600">{ticket.status === 'closed' ? 'Cuộc trò chuyện đã kết thúc. Bạn vẫn có thể xem lại lịch sử.' : ticket.status === 'resolved' ? 'Nhân viên đã xử lý yêu cầu. Bạn có thể xem lại lịch sử hoặc nhấn Gặp nhân viên để yêu cầu hỗ trợ lại.' : !ticket.acceptedAt ? 'Mình đã chuyển yêu cầu đến nhân viên tại cơ sở bạn chọn. Bạn vui lòng chờ phản hồi nhé. Trong lúc chờ, bạn vẫn có thể nhắn thêm thông tin.' : 'Nhân viên đã tiếp nhận. Bạn có thể tiếp tục trao đổi ngay tại đây.'}</p>}
      {!!read.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5"><p>{supportError(read.error)}</p><button type="button" onClick={read.refresh} className="mt-2 underline">Tải lại cuộc trò chuyện</button></div>}
      {!!command.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs leading-5">{supportError(command.error)}</p>}
      {command.uncertain && <button type="button" disabled={command.busy} onClick={command.retry} className="min-h-9 text-xs text-[#44745c] underline">Thử lại tin nhắn đã gửi</button>}
      {command.conflict && <button type="button" onClick={() => { command.clearError(); read.refresh() }} className="min-h-9 text-xs underline">Cập nhật trạng thái</button>}
      {assistantContent}
    </div>
    {assistantComposer ?? <div className="border-0 bg-transparent px-3 py-1.5">
      {visible && ['resolved', 'closed'].includes(ticket.status) && onRequestAgain && <button type="button" disabled={locked} onClick={onRequestAgain} className="mb-2 min-h-8 rounded-full border-0 bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50">Gặp nhân viên</button>}
      {!ticket || !["resolved", "closed"].includes(ticket.status) ? <form onSubmit={event => { event.preventDefault(); send() }} className="support-live-composer flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 focus-within:border-[#91bd9f] focus-within:ring-2 focus-within:ring-[#dfefe4]">
        {visible && actions.includes('message') && <EvidenceUpload compact iconOnly label="Đính kèm tệp" entityType="DUONG_SUPPORT_PUBLIC" value={files} onChange={setFiles} disabled={locked} onBusy={setUploading} />}
        <textarea ref={input} aria-label="Tin nhắn cho nhân viên" placeholder={ticket?.status === 'closed' ? 'Cuộc trò chuyện đã kết thúc' : 'Nhắn thêm cho nhân viên…'} value={draft} maxLength={4000} rows={1} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }} disabled={locked || !actions.includes('message')} onChange={event => setDraft(event.target.value)} className="h-9 max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-stone-800 placeholder:text-stone-400 focus:outline-none" />
        <button type="submit" aria-label="Gửi tin nhắn" disabled={locked || command.conflict || (!draft.trim() && !files.length) || !actions.includes('message')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#a8cfb5] bg-[#b9dec8] text-[#2e503b] hover:bg-[#a8d3b9] focus-visible:outline-2 focus-visible:outline-[#659c7c] disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400"><svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7M12 5v14" /></svg></button>
      </form> : null}
      {command.busy && <p role="status" className="mt-1 text-[11px] text-stone-500">Đang gửi…</p>}
    </div>}
  </div>
}
