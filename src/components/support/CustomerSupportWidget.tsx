import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { isUuid } from '../../services/renewalOperationsApi'
import type { SupportCreate } from '../../types/supportApi'
import { canReadSupport } from '../../views/support-api/presentation'
import CustomerSupportAssistant from './CustomerSupportAssistant'
import SupportChannelInfo from './SupportChannelInfo'
import SupportStaffHandoff from './SupportStaffHandoff'
import { loadCustomerChatSession, type CustomerChatSession } from '../../services/customerChatSessionApi'
import { useCustomerChatPersistence } from '../../hooks/useCustomerChatPersistence'
import { ApiClientError } from '../../services/apiClient'
import { getSupportTicket } from '../../services/supportApi'
import { useSupportUnread } from '../../hooks/useSupportMessageReads'

type ChatOpenRequest = { request: number; ticketId?: string }

function ChatIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return <svg aria-hidden="true" className={`show-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2V11.5A7.5 7.5 0 0 1 11.5 4h1a7.5 7.5 0 0 1 7.5 7.5Z" />
    <path d="M8.5 10h7M8.5 13.5h4.5" />
  </svg>
}

/** API support only. The separate demo chatbot is deliberately not used here. */
export default function CustomerSupportWidget({ openRequest }: { openRequest?: ChatOpenRequest } = {}) {
  const actor = getAuthenticatedActor()
  if (!actor || !canReadSupport(actor, 'customer')) return null
  return <ChatSessionBoundary key={actor.id} actorId={actor.id} openRequest={openRequest} />
}

function ChatSessionBoundary({ actorId, openRequest }: { actorId: string; openRequest?: ChatOpenRequest }) {
  const read = useRentalApiResource(`${actorId}:restore-chat-session`, loadCustomerChatSession)
  if (!read.data) return <div className="fixed bottom-5 right-5 z-40 max-w-[300px] rounded-2xl bg-white p-3 text-xs text-stone-600 shadow-lg">
    {read.loading ? <p role="status">Đang khôi phục chat…</p> : <><p role="alert">Chưa tải được phiên chat đã lưu. Vui lòng thử lại để tiếp tục cuộc trò chuyện cũ.</p><button type="button" onClick={read.refresh} className="mt-2 min-h-8 rounded-full bg-[#d2eadb] px-3 text-[#335b44]">Tải lại chat</button></>}
  </div>
  return <WidgetSession actorId={actorId} initialSession={read.data} onReload={read.refresh} openRequest={openRequest} />
}

function WidgetSession({ actorId, initialSession, onReload, openRequest }: { actorId: string; initialSession: CustomerChatSession; onReload: () => void; openRequest?: ChatOpenRequest }) {
  const [open, setOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [handoff, setHandoff] = useState<{ question: string; history: NonNullable<SupportCreate['handoffMessages']> }>()
  const [liveStatus, setLiveStatus] = useState('Đang chờ nhân viên')
  const [handoffTicketId, setHandoffTicketId] = useState<string | undefined>(initialSession.snapshot.ticketId ?? undefined)
  const [handedOff, setHandedOff] = useState(!!initialSession.snapshot.ticketId && initialSession.snapshot.autoReturn)
  const [staffLocked, setStaffLocked] = useState(false)
  const [assistantSession, setAssistantSession] = useState(0)
  const [autoReturn, setAutoReturn] = useState(initialSession.snapshot.autoReturn)
  const [resolutionNotice, setResolutionNotice] = useState(false)
  const [aiMessages, setAiMessages] = useState(initialSession.snapshot.messages)
  const currentUnread = useSupportUnread('customer', handoffTicketId ? [handoffTicketId] : [])
  const unreadCount = handoffTicketId ? currentUnread.get(handoffTicketId)?.unreadCount ?? 0 : 0
  const persistence = useCustomerChatPersistence(actorId, initialSession)
  useEffect(() => { persistence.save({ messages: aiMessages, ticketId: handoffTicketId ?? null, autoReturn }) }, [aiMessages, handoffTicketId, autoReturn, persistence.save])
  const panelId = useId()
  const titleId = useId()
  const launcher = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const consumedRequest = useRef<number | undefined>(undefined)
  const [openError, setOpenError] = useState<string>()
  useEffect(() => {
    if (!openRequest || consumedRequest.current === openRequest.request || staffLocked) return
    consumedRequest.current = openRequest.request
    setOpen(true); setStarted(true); setOpenError(undefined)
    if (!openRequest.ticketId || !isUuid(openRequest.ticketId)) return
    let current = true
    void getSupportTicket('customer', openRequest.ticketId).then(ticket => {
      if (!current || getAuthenticatedActor()?.id !== actorId) return
      setHandoffTicketId(ticket.id); setHandedOff(!['resolved', 'closed'].includes(ticket.status)); setHandoff(undefined)
      setAutoReturn(!['resolved', 'closed'].includes(ticket.status))
    }).catch(() => { if (current && getAuthenticatedActor()?.id === actorId) setOpenError('Không thể mở cuộc trò chuyện này. Yêu cầu có thể đã hết hạn lưu trữ hoặc bạn không còn quyền truy cập.') })
    return () => { current = false }
  }, [actorId, openRequest, staffLocked])
  useEffect(() => {
    if (open) closeButton.current?.focus()
    else if (started) launcher.current?.focus()
  }, [open, started])
  const hide = () => { setOpen(false) }

  return createPortal(<>
    <button ref={launcher} type="button" aria-label="Mở chat hỗ trợ" title="Chat hỗ trợ"
      aria-expanded={open} aria-controls={started ? panelId : undefined} aria-haspopup="dialog"
      hidden={open} data-expanded={open} aria-hidden={open} inert={open}
      onClick={() => { setStarted(true); setOpen(true) }}
      className="support-chat-launcher fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#a8d1b8] bg-[#c2e2cf] text-[#335b44] shadow-lg shadow-stone-900/10 hover:bg-[#aed7bf] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#659c7c] sm:bottom-6 sm:right-6">
      <ChatIcon className="h-6 w-6" />
      {unreadCount > 0 && <span aria-label={`${unreadCount} tin chưa đọc`} className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#335b44] px-1 text-[10px] font-semibold text-white">{Math.min(unreadCount, 99)}</span>}
    </button>
    {started && <section id={panelId} role="dialog" aria-labelledby={titleId} aria-hidden={!open} inert={!open} data-open={open}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); hide() } }}
      className="support-chat-panel fixed bottom-3 right-3 z-40 flex h-[min(680px,calc(100dvh-24px))] w-[calc(100vw-24px)] max-w-[440px] flex-col overflow-hidden rounded-2xl border-0 bg-white text-stone-800 shadow-[0_12px_48px_rgba(41,37,36,0.14)] sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100dvh-48px))]">
      <header className="relative z-20 flex shrink-0 items-center gap-3 border-0 bg-[#f1f8f3] px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0 bg-[#dfefe4] text-[#44745c]"><ChatIcon /></span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-semibold text-stone-900">{handedOff ? 'Hỗ trợ StorageHub' : 'Trợ lý StorageHub'}</h2>
          <p className="mt-0.5 text-xs text-stone-500">{handedOff ? liveStatus : 'Trợ lý AI · Hướng dẫn sử dụng'}</p>
        </div>
        {handedOff && <span className="group relative inline-flex shrink-0">
          <button type="button" aria-label="Quay về chat AI" disabled={staffLocked}
            onClick={() => { if (staffLocked) return; setHandedOff(false); setAutoReturn(false); setResolutionNotice(false); setHandoff(undefined); setAssistantSession(value => value + 1) }}
            className="flex h-9 w-9 items-center justify-center rounded-full border-0 text-[#44745c] hover:bg-[#e6f3ea] focus-visible:outline-2 focus-visible:outline-[#659c7c] disabled:opacity-40">
            <svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6-6 6 6 6M3 12h10a7 7 0 0 1 7 7" /></svg>
          </button>
          <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden whitespace-nowrap rounded-lg bg-stone-800 px-2.5 py-1.5 text-[11px] text-white shadow-sm group-hover:block group-focus-within:block">Quay về chat AI</span>
        </span>}
        <SupportChannelInfo key={`${open}:${handedOff}`} channel={handedOff ? 'staff' : 'assistant'} />
        <button ref={closeButton} type="button" aria-label="Đóng chat" title="Đóng chat" onClick={hide}
          className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-[#659c7c]">
          <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      {openError && <p role="alert" className="bg-amber-50 px-4 py-2 text-xs leading-5 text-stone-700">{openError}</p>}
      {!!persistence.error && <div role="alert" className="bg-amber-50 px-4 py-2 text-xs leading-5 text-stone-700">
        <p>{persistence.error instanceof ApiClientError && persistence.error.status === 409 ? 'Phiên chat đã thay đổi ở cửa sổ khác. Tải lại để tiếp tục phiên mới nhất.' : 'Chưa lưu được thay đổi mới nhất. Hãy thử lưu lại trước khi đăng xuất.'}</p>
        <button type="button" onClick={() => persistence.error instanceof ApiClientError && persistence.error.status === 409 ? onReload() : void persistence.retry()} className="min-h-8 font-medium underline">{persistence.error instanceof ApiClientError && persistence.error.status === 409 ? 'Tải lại phiên' : 'Lưu lại'}</button>
      </div>}
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50/70">
        {resolutionNotice && !handedOff && <p role="status" className="border-b border-stone-100 bg-orange-50 px-4 py-2.5 text-xs leading-5 text-stone-700">Nhân viên đã xử lý yêu cầu. Bạn có thể tiếp tục với trợ lý hoặc nhấn Gặp nhân viên để yêu cầu hỗ trợ lại.</p>}
        <CustomerSupportAssistant key={assistantSession} actorId={actorId} initialMessages={aiMessages} onMessagesChange={setAiMessages} active={open} staffActive={handedOff} staffTicketId={handoffTicketId} onStaffStatus={setLiveStatus} onStaffLocked={setStaffLocked}
          onStaffResolved={autoReturn ? () => { setHandedOff(false); setHandoff(undefined); setAutoReturn(false); setStaffLocked(false); setResolutionNotice(true); setAiMessages([]); setAssistantSession(value => value + 1) } : undefined}
          onStaffRequestAgain={() => { setHandedOff(false); setAutoReturn(false); setResolutionNotice(false); setHandoff({ question: '', history: [] }) }}
          onMeetStaff={handedOff ? undefined : (question, history) => { setResolutionNotice(false); setHandoff({ question, history }) }}
          staffRequest={handoff && <SupportStaffHandoff actorId={actorId} question={handoff.question} history={handoff.history} onLocked={setStaffLocked} onCancel={() => setHandoff(undefined)} onCreated={id => {
            setHandoffTicketId(id); setHandedOff(true); setHandoff(undefined); setAutoReturn(true); setResolutionNotice(false); setAiMessages([]); setAssistantSession(value => value + 1)
          }} />} />
      </div>
      <footer className="shrink-0 border-0 bg-[#fbfdfb] px-4 py-2 text-center text-[10px] text-stone-500">Chat được lưu theo tài khoản và tự xóa sau 10 ngày không có tin nhắn mới.</footer>
    </section>}
  </>, document.body)
}
