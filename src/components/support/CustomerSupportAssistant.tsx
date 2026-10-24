import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SUPPORT_ASSISTANT_FAQS } from '../../services/supportAssistantFaq'
import { getAuthenticatedActor } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import SupportReplyText from './SupportReplyText'
import SupportLiveConversation from './SupportLiveConversation'
import type { SupportCreate } from '../../types/supportApi'
import { newSupportAiRequestId, requestSupportAiReply, supportAiErrorMessage, type SupportAiHistoryMessage, type SupportAiRequest } from '../../services/supportAiApi'
import type { ChatSessionMessage } from '../../services/customerChatSessionApi'

type AssistantMessage = ChatSessionMessage
type Attempt = { key: string; body: SupportAiRequest; messageId: number; startedAt: number }

export default function CustomerSupportAssistant({ actorId, active, onMeetStaff, staffRequest, staffTicketId, onStaffStatus, onStaffLocked, onStaffResolved, onStaffRequestAgain, initialMessages = [], onMessagesChange, staffActive = !!staffTicketId }: {
  actorId: string; active: boolean; onMeetStaff?: (question: string, history: NonNullable<SupportCreate['handoffMessages']>) => void; staffRequest?: ReactNode;
  staffTicketId?: string; onStaffStatus: (status: string) => void; onStaffLocked: (locked: boolean) => void
  onStaffResolved?: () => void
  onStaffRequestAgain?: () => void
  staffActive?: boolean
  initialMessages?: AssistantMessage[]
  onMessagesChange?: (messages: AssistantMessage[]) => void
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages.length ? initialMessages.map(message => ({ ...message, status: message.status === 'pending' ? 'failed' as const : message.status })) : staffActive ? [] : [
    { id: 0, role: 'assistant', body: 'Xin chào! Mình có thể hướng dẫn bạn về đặt kho, thanh toán và hồ sơ thuê. Bạn cần hỗ trợ điều gì?' },
  ])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const failedAttempt = useRef<Attempt | undefined>(undefined)
  const inFlight = useRef(false)
  const alive = useRef(true)
  const nextId = useRef(Math.max(0, ...messages.map(message => message.id)) + 1)
  const changeListener = useRef(onMessagesChange)
  changeListener.current = onMessagesChange
  useEffect(() => { changeListener.current?.(messages) }, [messages])
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (active && log.current) log.current.scrollTop = messages.length === 1 && !staffRequest ? 0 : log.current.scrollHeight
  }, [active, messages, busy, error, staffRequest])
  const send = async (attempt: Attempt) => {
    if (inFlight.current || getAuthenticatedActor()?.id !== actorId) return
    inFlight.current = true
    setBusy(true)
    setError(undefined)
    try {
      const reply = await requestSupportAiReply(attempt.body, attempt.key)
      if (!alive.current || getAuthenticatedActor()?.id !== actorId) return
      const answerId = nextId.current++
      setMessages(previous => [
        ...previous.map(message => message.id === attempt.messageId ? { ...message, status: undefined } : message),
        { id: answerId, role: 'assistant', body: reply.answer, truncated: reply.truncated, source: reply.source },
      ])
      failedAttempt.current = undefined
    } catch (failure) {
      if (!alive.current || getAuthenticatedActor()?.id !== actorId) return
      setError(supportAiErrorMessage(failure))
      failedAttempt.current = !(failure instanceof ApiClientError) || failure.status === null || failure.code === 'CONFLICT'
        ? attempt : undefined
      setMessages(previous => previous.map(message => message.id === attempt.messageId ? { ...message, status: 'failed' } : message))
    } finally {
      inFlight.current = false
      if (alive.current && getAuthenticatedActor()?.id === actorId) setBusy(false)
    }
  }
  const ask = (question: string) => {
    const body = question.trim()
    if (!body || body.length > 1000 || inFlight.current || staffRequest || staffActive) return
    if (messages.length > 198 || messages.reduce((sum, message) => sum + message.body.length, 0) + body.length + 4000 > 200000) {
      setError('Phiên chat đã đạt giới hạn lưu trữ. Bạn có thể gặp nhân viên để tiếp tục được hỗ trợ.')
      return
    }
    // A manual resubmission of an uncertain transport attempt checks the original
    // request instead of creating another provider call. No automatic retries.
    const previous = failedAttempt.current
    if (previous && previous.body.message === body && Date.now() - previous.startedAt < 9 * 60_000) {
      setMessages(items => items.map(message => message.id === previous.messageId ? { ...message, status: 'pending' } : message))
      setDraft('')
      void send(previous)
      return
    }
    // Use only successful exchanges, with the same count/size limits as BE.
    const history: SupportAiHistoryMessage[] = messages.filter(message => message.id !== 0 && !message.status)
      .slice(-10).map(message => ({ role: message.role === 'customer' ? 'user' : 'assistant', content: message.body.slice(0, 1000) }))
    while (body.length + history.reduce((sum, message) => sum + message.content.length, 0) > 8000) history.shift()
    const customerId = nextId.current++
    const attempt: Attempt = { key: newSupportAiRequestId(), body: { message: body, history }, messageId: customerId, startedAt: Date.now() }
    setMessages(previous => [...previous, { id: customerId, role: 'customer', body, status: 'pending' }])
    setDraft('')
    void send(attempt)
  }

  const messageBubbles = messages.map(message => <div key={message.id} className={`flex flex-col ${message.role === 'customer' ? 'items-end' : 'items-start'}`}>
        <span className="mb-1 px-1 text-[10px] font-medium text-stone-500">{message.role === 'customer' ? 'Bạn' : message.source === 'FAQ' ? 'Hướng dẫn nhanh' : 'Trợ lý StorageHub'}</span>
        <div className={`support-bubble text-sm ${message.role === 'customer' ? 'support-bubble--sent whitespace-pre-wrap' : 'support-bubble--received'}`}>{message.role === 'customer' ? message.body : <SupportReplyText text={message.body} />}</div>
        {message.status === 'failed' && <span className="mt-1 px-1 text-[10px] text-stone-500">Chưa có câu trả lời</span>}
        {message.truncated && <span className="mt-1 px-1 text-[10px] text-stone-500">Câu trả lời đã đạt giới hạn độ dài. Bạn có thể hỏi tiếp.</span>}
      </div>)
  const assistantContent = <>
      {messageBubbles}
      {busy && <p role="status" className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-500">Trợ lý đang trả lời…</p>}
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-5 text-stone-700">
        <p>{error}</p>
      </div>}
      {messages.length === 1 && !staffRequest && <div className="flex flex-wrap gap-2" aria-label="Gợi ý câu hỏi">
        {([
          ['capacity', 'Chọn kho'], ['renewal', 'Gia hạn'], ['payment', 'Thanh toán'], ['return', 'Trả kho'],
        ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => {
          const faq = SUPPORT_ASSISTANT_FAQS.find(item => item.id === id)
          if (faq) ask(faq.question)
        }} className="min-h-9 rounded-full border border-[#dce8df] bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:border-[#a8cbb4] hover:bg-[#eff7f1] hover:text-[#335b44] focus-visible:outline-2 focus-visible:outline-[#659c7c]">{label}</button>)}
      </div>}
      {staffRequest}
  </>
  const composer = <div className="border-0 bg-transparent px-3 py-1.5">
      <form onSubmit={event => { event.preventDefault(); ask(draft) }} className="flex items-center gap-1.5 rounded-2xl border-0 bg-stone-100 px-2 py-1 focus-within:ring-2 focus-within:ring-[#dfefe4]">
        {onMeetStaff && !staffRequest && <span className="group relative inline-flex shrink-0">
          <button type="button" disabled={busy}
          aria-label="Gặp nhân viên"
          onClick={() => {
            const question = [...messages].reverse().find(message => message.role === 'customer')?.body ?? ''
            onMeetStaff(question, messages.filter(message => message.status !== 'pending').map(message => ({ role: message.role === 'customer' ? 'CUSTOMER' : 'ASSISTANT', body: message.body })))
          }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#44745c] transition-colors hover:bg-[#e4f1e8] focus-visible:outline-2 focus-visible:outline-[#659c7c] disabled:opacity-40">
          <svg aria-hidden="true" className="show-icon h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 13V10a8 8 0 0 1 16 0v3M6 11V9c3 0 6-1 8-3 1 2 2 3 4 3v2M7 16c1 3 3 5 5 5s4-2 5-5" />
            <rect x="2" y="11" width="4" height="6" rx="2" /><rect x="18" y="11" width="4" height="6" rx="2" />
            <path d="M20 17v1a2 2 0 0 1-2 2h-4" /><rect x="10" y="18.5" width="4" height="3" rx="1.5" />
          </svg>
          </button>
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 whitespace-nowrap rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">Gặp nhân viên</span>
        </span>}
        <textarea aria-label="Câu hỏi cho trợ lý" disabled={!!staffRequest} placeholder={staffRequest ? 'Chọn cơ sở trong cuộc trò chuyện…' : 'Nhập câu hỏi của bạn…'} value={draft} maxLength={1000} rows={1}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(draft) } }}
          onChange={event => setDraft(event.target.value)}
          className="max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm leading-5 text-stone-800 placeholder:text-stone-400 focus:outline-none" />
        <button type="submit" aria-label="Gửi câu hỏi" disabled={!draft.trim() || busy || !!staffRequest} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-[#b9dec8] text-[#2e503b] transition-colors hover:bg-[#a8d3b9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#659c7c] disabled:bg-stone-100 disabled:text-stone-400">
          <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7M12 5v14" /></svg>
        </button>
      </form>
    </div>
  if (staffTicketId) return <SupportLiveConversation key={staffTicketId} actorId={actorId} id={staffTicketId} active={active}
    fallback={<p role="status" className="text-xs text-stone-500">Đang tải cuộc trò chuyện…</p>}
    onStatus={onStaffStatus} onLocked={onStaffLocked} onResolved={onStaffResolved} onRequestAgain={onStaffRequestAgain}
    assistantContent={!staffActive ? assistantContent : undefined} assistantComposer={!staffActive ? composer : undefined} />
  return <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
    <div ref={log} role="log" aria-label="Trao đổi với trợ lý StorageHub" aria-live="polite" aria-relevant="additions" className="min-h-0 space-y-3.5 overflow-y-auto overscroll-contain bg-[#fcfefc] px-4 py-5">{assistantContent}</div>
    {composer}
  </div>
}
