import { parseVietnamDate } from '../../utils/vietnamTime'
import { useManagerPresentation } from "../manager/managerPresentation"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from 'react-dom'
import { useSupportMessageReads } from '../../hooks/useSupportMessageReads'
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getSupportTicket,
  listSupportMessages,
} from "../../services/supportApi"
import type {
  SupportMessage,
  SupportPage,
  SupportRole,
  SupportTicket,
} from "../../types/supportApi"
import ApiPager from "../rental-api/ApiPager"
import SupportActionForm, { type SupportDraft } from "./SupportActionForm"
import SupportNotificationReceipts from "../rental-support-integration/SupportNotificationReceipts"
import { EvidenceDownload } from "../rental-support-integration/EvidenceControls"
import SupportReplyText from '../../components/support/SupportReplyText'
import SupportReadState from "./SupportReadState"
import {
  supportActions,
  supportStatusLabels,
  supportPriorityLabels,
  supportLinkLabels,
  supportTicketVisible,
  supportAssigneeLabel,
} from "./presentation"

export function SupportTicketSummary({ ticket: t, role = "customer" }: { ticket: SupportTicket; role?: SupportRole }) {
  const { copy } = useManagerPresentation()
  const [copied, setCopied] = useState(false)
  const facilityName = t.facilityId ? getAuthenticatedActor()?.facilityNames?.[t.facilityId] : undefined
  const otherFields: [string, string][] = [
    ["Tạo lúc", supportDetailDate(t.createdAt)],
    ...(t.facilityId ? [["Cơ sở", facilityName || `#${t.facilityId.slice(0, 8)}`] as [string, string]] : []),
    ...(t.linkedId ? [["Hồ sơ liên kết", `${supportLinkLabels[t.linkedType || ""] || "Hồ sơ"} #${t.linkedId.slice(0, 8)}`] as [string, string]] : []),
    ...(role === "customer" ? [] : [["Mã khách hàng", t.customerId] as [string, string]]),
    ["Nhân viên phụ trách", supportAssigneeLabel(t, role)],
    ...(t.parentTicketId ? [["Yêu cầu gốc", `#${t.parentTicketId.slice(0, 8)}`] as [string, string]] : []),
    ...(t.resolvedBy && role !== "customer" ? [["Người xử lý xong", t.resolvedBy] as [string, string]] : []),
    ...([
      ["Phân công lúc", t.assignedAt],
      ["Nhân viên nhận lúc", t.acceptedAt],
      ["Xử lý xong lúc", t.resolvedAt],
      ["Đóng lúc", t.closedAt],
    ] as const).filter(([, date]) => Boolean(date)).map(([label, date]) => [label, supportDetailDate(date)] as [string, string]),
  ]

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="break-words text-lg font-semibold text-stone-900">{t.subject}</h3>
          <span className="inline-flex items-center gap-1 text-xs text-stone-500" title={t.id}>Mã yêu cầu: <span className="font-mono">{t.displayCode || `#${t.id.slice(0, 8)}`}</span>
            <button type="button" className="rounded p-0.5 hover:bg-stone-100 hover:text-stone-900" title={copied ? "Đã sao chép" : "Sao chép mã yêu cầu"} aria-label="Sao chép mã yêu cầu" onClick={async () => {
              try { await navigator.clipboard.writeText(t.displayCode || t.id); setCopied(true) }
              catch { setCopied(false) }
            }}>{copied ? "✓" : "⧉"}</button>
          </span>
        </div>
        <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${t.status === "open" ? "bg-slate-100 text-slate-700" : t.status === "in_progress" ? "bg-blue-50 text-blue-700" : t.status === "resolved" || t.status === "closed" ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-800"}`}>{copy(supportStatusLabels[t.status])}</span>
      </div>
      <div className="space-y-1 rounded-lg bg-stone-50 px-3 py-2">
        <p className="text-xs text-stone-500">Nội dung yêu cầu</p>
        <p className="whitespace-pre-wrap break-words leading-relaxed text-stone-800 [overflow-wrap:anywhere]">{t.description}</p>
      </div>
      <details className="rounded-lg border border-stone-200 px-3 py-2 text-stone-700">
        <summary className="cursor-pointer font-medium">Thông tin chi tiết</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{otherFields.map(([label, value]) => <div key={label} className="min-w-0">
          <dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-words font-medium leading-relaxed text-stone-900 [overflow-wrap:anywhere]">{value}</dd>
        </div>)}</dl>
      </details>
    </div>
  )
}

function supportDetailDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa ghi nhận"
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(parseVietnamDate(value))
}
function ConversationInfo({ ticket, role }: { ticket: SupportTicket; role: SupportRole }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return <>
    <button type="button" aria-label="Thông tin cuộc trò chuyện" title="Thông tin cuộc trò chuyện" onClick={() => dialog.current?.showModal()}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-[#587222] focus-visible:outline-2 focus-visible:outline-[#8aa34d]">
      <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.1" /></svg>
    </button>
    {createPortal(<dialog ref={dialog} aria-label="Thông tin cuộc trò chuyện" className="fixed inset-0 m-auto max-h-[80dvh] w-[min(440px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 text-stone-800 shadow-xl backdrop:bg-black/25"
      onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close() }}>
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3"><h3 className="text-sm font-semibold">Thông tin cuộc trò chuyện</h3><button type="button" aria-label="Đóng thông tin" onClick={() => dialog.current?.close()} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-stone-500 hover:bg-stone-100">×</button></div>
      <div className="p-4"><SupportTicketSummary ticket={ticket} role={role} /></div>
    </dialog>, document.body)}
  </>
}
export default function SupportTicketDetail({
  role,
  id,
  command,
  onFollowUp,
  onUploadBusy,
  conversation = "messages",
  onConversationChange,
  drafts,
  onDraftChange,
  messageFocus,
  chatLayout = false,
  refreshRevision = 0,
}: {
  role: SupportRole
  id: string
  command: ReturnType<typeof useSupportCommand>
  onFollowUp: (parent: SupportTicket) => void
  onUploadBusy?: (busy: boolean) => void
  conversation?: "messages" | "internal"
  onConversationChange?: (tab: "messages" | "internal") => void
  drafts?: Partial<Record<"messages" | "internal", SupportDraft>>
  onDraftChange?: (channel: "messages" | "internal", draft: SupportDraft) => void
  messageFocus?: { channel: "messages" | "internal"; messageId?: string }
  chatLayout?: boolean
  refreshRevision?: number
}) {
  const { manager, copy } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${id}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  const read = useRentalApiResource(identity, () => getSupportTicket(role, id), { retainDataOnRefresh: true })
  const lastRefreshRevision = useRef(refreshRevision)
  useEffect(() => {
    if (lastRefreshRevision.current === refreshRevision) return
    lastRefreshRevision.current = refreshRevision
    read.refresh()
  }, [refreshRevision, read.refresh])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!command.locked && document.visibilityState === "visible") read.refresh()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [command.locked, read.refresh])
  const t = read.data
  const refresh = () => {
    if (!command.locked) read.refresh()
  }
  if (t && (!actor || !supportTicketVisible(actor, role, t)))
    return (
      <p role="alert">
        Bạn không còn quyền với yêu cầu này. Vui lòng quay về danh sách yêu cầu.
      </p>
    )
  return (
    <div className={`${chatLayout ? 'support-chat-detail' : 'space-y-5'} min-w-0`}>
      <SupportReadState {...read} loading={read.loading && !read.data} retry={refresh} />
      {t && (
        <>
          {chatLayout ? <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><h2 className="min-w-0 truncate text-base font-semibold text-stone-900">{role === "customer" ? (t.acceptedAt && t.assignedStaffName?.trim() ? t.assignedStaffName : "Nhân viên hỗ trợ") : t.customerName ?? "Khách hàng"}</h2><ConversationInfo ticket={t} role={role} /></div>{role !== 'staff' && <p className="mt-1 truncate text-xs text-stone-500">{role === "customer" ? t.acceptedAt ? "Nhân viên đã tiếp nhận cuộc trò chuyện" : "Chờ nhân viên tiếp nhận" : supportAssigneeLabel(t, role)}</p>}</div>
            <div className="support-conversation-actions flex flex-wrap items-center gap-3"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{supportStatusLabels[t.status]}</span>
              {role === 'staff' && supportActions(actor, role, t).includes('resolve') && <button type="button" disabled={command.locked || command.conflict}
                onClick={() => void command.run({ kind: 'command', role: 'staff', id: t.id, command: { kind: 'resolve', summary: '', evidenceFileIds: [], statusOnly: true, expectedVersion: t.version! } })}
                className="min-h-8 rounded-full border-0 bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:opacity-50">Đã xử lý</button>}
            </div>
          </header> : <SupportTicketSummary ticket={t} role={role} />}
          {!chatLayout && role === "customer" && <SupportNotificationReceipts key={identity} ticketId={id} locked={command.locked} />}
          <SupportTimeline
            key={identity}
            role={role}
            id={id}
            identity={identity}
            locked={command.locked}
            initialDescription={t.description}
            initialCreatedAt={t.createdAt}
            waitingForStaff={role === "customer" && !t.acceptedAt && t.status === "open"}
            chatLayout={chatLayout}
            refreshRevision={refreshRevision}
            initialTab={role === "manager" ? conversation : "messages"}
            onTabChange={onConversationChange}
            messageFocus={messageFocus}
            composer={role !== "manager" ? <SupportActionForm key={`${id}:message`} role={role} ticket={t} command={command} onUploadBusy={onUploadBusy} mode="message" draft={drafts?.messages} onDraftChange={onDraftChange ? draft => onDraftChange("messages", draft) : undefined} /> : undefined}
            internalComposer={role === "manager" ? <SupportActionForm key={`${id}:internal`} role={role} ticket={t} command={command} onUploadBusy={onUploadBusy} mode="message" internal draft={drafts?.internal} onDraftChange={onDraftChange ? draft => onDraftChange("internal", draft) : undefined} /> : undefined}
          />
          {role !== "manager" && (!chatLayout || supportActions(actor, role, t).some(action => ["accept", "close", "reopen"].includes(action))) && <details className="rounded-lg border border-stone-200 p-3" open={t.status === "resolved" || t.status === "closed"}>
            <summary className="cursor-pointer text-xs font-medium text-stone-600">{role === "customer" ? "Xác nhận kết quả hỗ trợ" : "Thao tác hỗ trợ"}</summary>
            <div className="mt-3"><SupportActionForm
            key={`${id}:${t.version}`}
            role={role}
            ticket={t}
            command={command}
            onUploadBusy={onUploadBusy}
            mode="operations"
          /></div></details>}
          {supportActions(actor, role, t).includes("follow-up") && (
            <Button disabled={command.locked} onClick={() => onFollowUp(t)}>
              Bắt đầu cuộc trò chuyện tiếp theo
            </Button>
          )}
        </>
      )}
    </div>
  )
}
function SupportTimeline({
  role,
  id,
  identity,
  locked,
  initialDescription,
  initialCreatedAt,
  waitingForStaff = false,
  composer,
  internalComposer,
  initialTab,
  onTabChange,
  messageFocus,
  chatLayout = false,
  refreshRevision = 0,
}: {
  role: SupportRole
  id: string
  identity: string
  locked: boolean
  initialDescription: string
  initialCreatedAt: string
  waitingForStaff?: boolean
  composer?: ReactNode
  internalComposer?: ReactNode
  initialTab: "messages" | "internal"
  onTabChange?: (tab: "messages" | "internal") => void
  messageFocus?: { channel: "messages" | "internal"; messageId?: string }
  chatLayout?: boolean
  refreshRevision?: number
}) {
  const [tab, setTab] = useState<"messages" | "internal">(
    initialTab,
  )
  const [page, setPage] = useState(chatLayout || messageFocus?.channel === initialTab ? -1 : 0)
  const scrollArea = useRef<HTMLDivElement>(null)
  const initiallyScrolled = useRef(false)
  const followLatest = useRef(true)
  const previousFocus = useRef(messageFocus)
  const read = useRentalApiResource<SupportPage<SupportMessage>>(
    `${identity}:${tab}:${page}`,
    async () => {
      const visibility = tab === "internal" ? "INTERNAL" : "PUBLIC"
      if (page >= 0) return listSupportMessages(role, id, page, 20, visibility)
      const first = await listSupportMessages(role, id, 0, 20, visibility)
      let result = first
      // Locate the actual sent message even if other replies arrive concurrently.
      for (let next = first.pagination.totalPages - 1; next > 0; next--) {
        result = await listSupportMessages(role, id, next, 20, visibility)
        if (chatLayout || !messageFocus?.messageId || result.data.some(message => message.id === messageFocus.messageId)) return result
      }
      return first
    },
    { retainDataOnRefresh: true },
  )
  const lastRefreshRevision = useRef(refreshRevision)
  useEffect(() => {
    if (lastRefreshRevision.current === refreshRevision) return
    lastRefreshRevision.current = refreshRevision
    read.refresh()
  }, [refreshRevision, read.refresh])
  useEffect(() => {
    if (previousFocus.current === messageFocus) return
    previousFocus.current = messageFocus
    if (messageFocus?.channel !== tab) return
    followLatest.current = true
    setPage(-1)
  }, [messageFocus, tab])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!locked && document.visibilityState === "visible") read.refresh()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [locked, read.refresh])
  useLayoutEffect(() => {
    const area = scrollArea.current
    if (area && read.data && page < 0 && (!initiallyScrolled.current || followLatest.current)) {
      area.scrollTop = area.scrollHeight
      initiallyScrolled.current = true
    }
  }, [read.data, page])
  const tabs = role === "manager" ? ["messages", "internal"] as const : ["messages"] as const
  useSupportMessageReads(role, id, read.data?.data ?? [], tab === 'messages', scrollArea)
  const isRepeatedOpeningMessage = (message: SupportMessage, index: number) =>
    role === "customer" && tab === "messages" && page === 0 && index === 0 &&
    message.authorRole === "CUSTOMER" && message.body.trim() === initialDescription.trim() &&
    Date.parse(message.sentAt) === Date.parse(initialCreatedAt)
  return (
    <Card className={`${chatLayout ? 'support-chat-timeline' : ''} min-w-0 overflow-hidden border-stone-200`}>
      {role === "manager" ? <div className="flex gap-1 border-b border-stone-200 px-2" role="group" aria-label="Đối tượng trao đổi">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            className={`-mb-px whitespace-nowrap rounded-t-md border-b-2 px-4 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 ${tab === t ? "border-amber-500 font-semibold text-stone-900" : "border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-900"}`}
            disabled={locked}
            onClick={() => {
              setTab(t)
              onTabChange?.(t)
              setPage(chatLayout || messageFocus?.channel === t ? -1 : 0)
            }}
          >
            {t === "messages" ? "Khách hàng" : role === "manager" ? "Nhân viên" : "Quản lý"}
          </button>
        ))}
      </div> : role !== "staff" && <h3 className="border-b border-stone-100 px-4 py-3 text-xs font-semibold text-stone-500">Tin nhắn</h3>}
      <SupportReadState {...read} loading={read.loading && !read.data} retry={read.refresh} />
      <div ref={scrollArea} role="log" aria-label={tab === "internal" ? "Tin nhắn nội bộ" : "Tin nhắn hỗ trợ"} aria-live="polite" onScroll={() => {
        const area = scrollArea.current
        if (area) followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 180
      }} className="min-h-[260px] max-h-[50vh] space-y-3 overflow-y-auto bg-stone-50/60 p-4">
      {read.data && (
        <>
          {chatLayout && tab === "messages" && read.data.pagination.page === 0 && !read.data.data.some(m => m.authorRole === "AI_CONTEXT" || m.authorRole === "USER_CONTEXT") && !read.data.data.some(m => m.authorRole === "CUSTOMER" && m.body.trim() === initialDescription.trim() && Date.parse(m.sentAt) === Date.parse(initialCreatedAt)) && <div className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 text-sm ${role === "customer" ? "ml-auto bg-amber-100" : "mr-auto border border-stone-200 bg-white"}`}><p className="mb-1 text-[11px] text-stone-500">{role === "customer" ? "Bạn" : "Khách hàng"}, {supportDetailDate(initialCreatedAt)}</p><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{initialDescription}</p></div>}
          {read.data.data.map((row, index) => {
            const message = row as SupportMessage
            const repeatedOpeningMessage = !chatLayout && isRepeatedOpeningMessage(message, index)
            if (repeatedOpeningMessage && !message.evidenceFileIds?.length && message.evidenceCompleteness !== "UNKNOWN") return null
            return (
            <div
              key={row.id}
              data-support-message-id={row.id}
              className={`support-message-group space-y-2 text-sm ${message.authorRole !== 'AI_CONTEXT' && message.authorId === getAuthenticatedActor()?.id ? "support-message-group--sent" : "support-message-group--received"}`}
            >
              <MessageRow message={message} hideBody={repeatedOpeningMessage} />
            </div>
          )})}
          {chatLayout && waitingForStaff && <p role="status" className="mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-[#f2f0ee] px-3.5 py-2.5 text-sm leading-6 text-stone-700">Yêu cầu đã được gửi đến cơ sở. Bạn vui lòng chờ nhân viên phản hồi; có thể nhắn thêm thông tin ngay bên dưới.</p>}
          {!chatLayout && (read.data.data.length === 0 || (tab === "messages" && read.data.data.length === 1 &&
            isRepeatedOpeningMessage(read.data.data[0] as SupportMessage, 0) &&
            !(read.data.data[0] as SupportMessage).evidenceFileIds?.length &&
            (read.data.data[0] as SupportMessage).evidenceCompleteness !== "UNKNOWN")) && (
            <p className="text-sm text-stone-500">
              Chưa có trao đổi mới.
            </p>
          )}
          {read.data.pagination.totalPages > 1 && <ApiPager
            pagination={read.data.pagination}
            onPage={setPage}
            disabled={locked}
          />}
        </>
      )}
      </div>
      <div className="border-t border-stone-200 bg-white p-3">{tab === "messages" ? composer : internalComposer}</div>
    </Card>
  )
}
function MessageRow({ message: m, hideBody }: { message: SupportMessage; hideBody: boolean }) {

  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span className="font-semibold text-stone-900">{m.authorRole === 'AI_CONTEXT' ? 'Trợ lý AI' : m.authorRole === 'USER_CONTEXT' ? m.authorId === getAuthenticatedActor()?.id ? 'Bạn' : 'Khách hàng' : m.authorId === getAuthenticatedActor()?.id ? "Bạn" : m.authorRole === "MANAGER" ? "Quản lý" : m.authorRole === "STAFF" ? "Nhân viên" : "Khách hàng"}</span>
        <time dateTime={m.sentAt}>{supportDetailDate(m.sentAt)}</time>
      </p>
      {!hideBody && !!m.body.trim() && <div className={`support-bubble ${m.authorRole !== "AI_CONTEXT" && m.authorId === getAuthenticatedActor()?.id ? "support-bubble--sent" : "support-bubble--received"}`}>
      {!hideBody && (m.authorRole === 'AI_CONTEXT' ? <SupportReplyText text={m.body} /> : <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.body}</p>)}
      </div>}
      {(m.evidenceCompleteness === "UNKNOWN" || !!m.evidenceFileIds?.length) && <p className="text-xs text-stone-500">
        {m.evidenceCompleteness === "UNKNOWN" ? "Chưa thể xem tệp đính kèm." : null}
      </p>}
      {m.evidenceCompleteness !== "UNKNOWN" && m.evidenceFileIds?.map((id, index) => <EvidenceDownload key={id} id={id} index={index + 1} asLink chatFile />)}
    </>
  )
}
