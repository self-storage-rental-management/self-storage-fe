import { parseVietnamDate } from '../../utils/vietnamTime'
import { useManagerPresentation } from "../manager/managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "../manager/managerFacilityUi"
import { useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor, type ApiActor } from "../../services/authApi"
import { listSupportTickets } from "../../services/supportApi"
import { supportStatuses } from "../../types/supportApi"
import type {
  SupportQuery,
  SupportRole,
  SupportTicket,
} from "../../types/supportApi"
import ApiPager from "../rental-api/ApiPager"
import { rentalDate } from "../rental-api/presentation"
import SupportCreateForm from "./SupportCreateForm"
import SupportReadState from "./SupportReadState"
import SupportTicketDetail from "./SupportTicketDetail"
import StaffSupportInbox from './StaffSupportInbox'
import type { SupportDraft } from "./SupportActionForm"
import { isUuid } from "../../services/renewalOperationsApi"
import {
  canReadSupport,
  supportError,
  supportInputClass,
  supportStatusLabels,
  supportTicketVisible,
} from "./presentation"

function supportStatusClass(status: SupportTicket["status"]) {
  if (status === "open") return "bg-slate-100 text-slate-700 ring-slate-200"
  if (status === "in_progress") return "bg-blue-50 text-blue-700 ring-blue-200"
  if (status === "resolved" || status === "closed") return "bg-green-50 text-green-700 ring-green-200"
  return "bg-amber-50 text-amber-800 ring-amber-200"
}

export default function SupportApiWorkspace({
  role,
  onLocked,
  openTicket,
  onTicketOpened,
}: {
  role: SupportRole
  onLocked?: (locked: boolean) => void
  openTicket?: { id: string; request: number }
  onTicketOpened?: () => void
}) {
  const { manager, copy, errorText } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  if (!canReadSupport(actor, role))
    return (
      <Card className={manager ? "space-y-2 p-5 text-sm leading-relaxed" : "space-y-2 p-5"}>
        <h2 className={manager ? "text-lg font-bold text-stone-900" : "font-semibold"}>Hỗ trợ khách hàng</h2>
        <p role="alert" className={manager ? "break-words text-sm text-stone-700" : undefined}>
          Bạn chưa có quyền truy cập hỗ trợ tại cơ sở này. Vui lòng đăng nhập đúng tài khoản hoặc liên hệ quản lý.</p>
      </Card>
    )
  const identity = `${actor!.id}:${role}:${JSON.stringify(actor!.facilityScopes)}:${JSON.stringify(actor!.permissions)}`
  if (role === "manager" && !singleManagerFacility(actor))
    return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return (
    <SupportSession
      key={identity}
      actor={actor!}
      role={role}
      identity={identity}
      onLocked={onLocked}
      openTicket={openTicket}
      onTicketOpened={onTicketOpened}
    />
  )
}
function SupportSession({
  actor,
  role,
  identity,
  onLocked,
  openTicket,
  onTicketOpened,
}: {
  actor: ApiActor
  role: SupportRole
  identity: string
  onLocked?: (locked: boolean) => void
  openTicket?: { id: string; request: number }
  onTicketOpened?: () => void
}) {
  const { copy, errorText } = useManagerPresentation()

  const facilityId = role === "manager" ? singleManagerFacility(actor) : undefined
  const [query, setQuery] = useState<SupportQuery>({
    page: 0,
    size: role === "manager" ? 10 : 20,
    ...(facilityId ? { facilityId } : {}),
    sort: role === "staff" ? "updatedAt,desc" : "createdAt,desc",
  })
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string>()
  const [creation, setCreation] = useState<{ parent?: SupportTicket }>()
  const [revision, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<"messages" | "internal", SupportDraft>>>>({})
  const [messageFocus, setMessageFocus] = useState<{ ticketId: string; channel: "messages" | "internal"; messageId?: string }>()
  const [conversation, setConversation] = useState<"messages" | "internal">("messages")
  // StaffSupportInbox owns its grouped API; the legacy list is only used by other roles.
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => role === 'staff' ? Promise.resolve({ data: [] as SupportTicket[], pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: 'updatedAt,desc' }, correlationId: null }) : listSupportTickets(role, query),
    { retainDataOnRefresh: true },
  )
  const command = useSupportCommand(`${actor.id}:support:${role}`, (submission, result) => {
    if (submission.kind === "create" && result && typeof result === "object" && "id" in result && isUuid(result.id)) {
      setSelected(result.id)
      setConversation("messages")
    }
    if (submission.kind === "command" && (submission.command.kind === 'message' || submission.command.kind === 'resolve' && !submission.command.statusOnly)) {
      const channel = submission.command.kind === "message" && "visibility" in submission.command && submission.command.visibility === "INTERNAL" ? "internal" : "messages"
      setDrafts(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], [channel]: { body: "", files: [] } } }))
      const messageId = submission.command.kind === "message" && result && typeof result === "object" && "id" in result && isUuid(result.id) ? result.id : undefined
      setMessageFocus({ ticketId: submission.id, channel, messageId })
      setConversation(channel)
    }
    read.refresh()
    setRevision((n) => n + 1)
    setCreation(undefined)
  })
  const [uploading, setUploading] = useState(false)
  const uploadLock = useRef(false)
  const uploadBusy = (busy: boolean) => {
    uploadLock.current = busy
    setUploading(busy)
    if (busy) onLocked?.(true)
  }
  const locked = command.locked || uploading
  useEffect(() => {
    if (role === 'staff') return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || command.locked || uploadLock.current) return
      read.refresh()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [role, command.locked, read.refresh])
  const consumedOpenRequest = useRef<typeof openTicket>(undefined)
  useEffect(() => {
    if (!openTicket || consumedOpenRequest.current === openTicket || locked || !isUuid(openTicket.id)) return
    consumedOpenRequest.current = openTicket
    setCreation(undefined)
    setSelected(openTicket.id)
    setConversation("messages")
    setMessageFocus(undefined)
    setRevision(previous => previous + 1)
    command.clearError()
    onTicketOpened?.()
  }, [openTicket, locked, onTicketOpened])
  const formCommand = { ...command, locked }
  useEffect(() => {
    onLocked?.(locked)
    return () => onLocked?.(false)
  }, [locked, onLocked])
  const reload = () => {
    if (command.locked || uploadLock.current) return
    command.clearError()
    read.refresh()
    setRevision((n) => n + 1)
  }
  const change = (patch: SupportQuery) => {
    if (command.locked || uploadLock.current) return
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
    setSelected(undefined)
  }
  const commandNotice = (
    <>
      {uploading && <p role="status" className="text-sm">Đang lưu tệp. Vui lòng chờ trước khi đóng biểu mẫu.</p>}
      {command.busy && (
        <p role="status" className="text-sm">
          Đang gửi…</p>
      )}
      {command.error && (
        <div
          role="alert"
          className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm"
        >
          <p>{errorText(command.error, supportError)}</p>
        </div>
      )}
      {command.uncertain && (
        <div
          role="alert"
          className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p>
            Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại, không tải lại trang hoặc gửi yêu cầu mới.</p>
          <Button disabled={command.busy} onClick={command.retry}>
            Kiểm tra lại bằng yêu cầu cũ
          </Button>
        </div>
      )}
    </>
  )
  const closeConversation = () => {
    if (!command.locked && !uploadLock.current) { setSelected(undefined); setCreation(undefined) }
  }
  const visibleTickets = read.data?.data.filter(t => supportTicketVisible(actor, role, t)) ?? []
  const invalidScope = read.data && visibleTickets.length !== read.data.data.length
  return (
    <div className={`support-inbox ${role === 'staff' ? 'support-inbox--staff' : ''} min-w-0 space-y-4`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Hỗ trợ khách hàng</h1>
          {role === "customer" && <p className="mt-1 text-sm text-stone-500">Nhắn tin trực tiếp với nhân viên tại cơ sở của bạn.</p>}
        </div>
        {role === "customer" && <Button disabled={locked} onClick={() => { setSelected(undefined); setCreation({}) }}>Cuộc trò chuyện mới</Button>}
      </header>
      {commandNotice}
      <div className="support-inbox-shell grid overflow-hidden rounded-2xl border border-stone-200 bg-white lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`min-w-0 border-stone-200 bg-stone-50/50 lg:border-r ${selected || creation ? "hidden lg:block" : "block"}`} aria-label="Danh sách hội thoại">
          {role === "staff" ? (
    <StaffSupportInbox selectedId={selected} refreshRevision={revision}
      locked={locked || command.conflict} onOpen={id => { setSelected(id); command.clearError() }}
      onClaim={async item => {
        const succeeded = await command.run({ kind: 'command', role: 'staff', id: item.id, command: { kind: 'claim', expectedVersion: item.version } })
        if (succeeded) setSelected(item.id)
        return succeeded
      }} />
          ) : <>
          <div className="space-y-3 border-b border-stone-200 p-4">
            <h2 className="text-xl font-bold tracking-tight text-stone-900">Đoạn chat</h2>
            <h2 className="text-sm font-semibold text-stone-800">Cuộc trò chuyện</h2>
            {role !== "customer" && <details className="group">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-amber-600 [&::-webkit-details-marker]:hidden">
                <svg aria-hidden="true" className="show-icon h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
                <span className="flex-1">Tìm kiếm & lọc</span>
                {(!!query.search || !!query.status || query.sort !== 'createdAt,desc') && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">Đang áp dụng</span>}
                <svg aria-hidden="true" className="show-icon h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <form className="mt-2 space-y-2 border-t border-stone-200/70 pt-3" onSubmit={e => { e.preventDefault(); change({ search: search.trim() }) }}>
              <label className="block text-xs font-medium text-stone-500">Tìm cuộc trò chuyện
                <input className={`${supportInputClass} !mt-1 !min-h-9 !py-1.5 !text-xs`} placeholder="Nội dung hoặc mã hội thoại" value={search} maxLength={200} disabled={locked} onChange={e => setSearch(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {<label className="block text-xs text-stone-500">Trạng thái
                  <select className={`${supportInputClass} !mt-1 !min-h-9 !py-1.5 !text-xs`} value={query.status ?? ""} disabled={locked} onChange={e => change({ status: (e.target.value || undefined) as SupportQuery['status'] })}>
                    <option value="">Tất cả</option>{supportStatuses.map(s => <option key={s} value={s}>{supportStatusLabels[s]}</option>)}
                  </select>
                </label>}
                <label className="block text-xs text-stone-500">Sắp xếp
                  <select className={`${supportInputClass} !mt-1 !min-h-9 !py-1.5 !text-xs`} value={query.sort} disabled={locked} onChange={e => change({ sort: e.target.value })}>
                    <option value="createdAt,desc">Mới nhất</option><option value="createdAt,asc">Cũ nhất</option><option value="updatedAt,desc">Vừa cập nhật</option><option value="subject,asc">Nội dung A-Z</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" type="submit" variant="outline" className="!min-h-8 !px-3 !py-1 !text-xs" disabled={locked}>Áp dụng</Button>
                <Button size="sm" type="button" variant="ghost" className="!min-h-8 !px-3 !py-1 !text-xs" disabled={locked} onClick={() => { setSearch(''); setQuery({ page: 0, size: role === 'manager' ? 10 : 20, ...(facilityId ? { facilityId } : {}), sort: 'createdAt,desc' }) }}>Đặt lại</Button>
              </div>
              </form>
            </details>}
          </div>
          {<>
            <SupportReadState {...read} loading={read.loading && !read.data} retry={reload} />
            {invalidScope ? <p role="alert" className="p-4 text-sm text-red-700">Không thể hiển thị hội thoại ngoài phạm vi truy cập của bạn.</p> : <>
              <div className="max-h-[550px] divide-y divide-stone-100 overflow-y-auto">
                {visibleTickets.map(t => <button key={t.id} type="button" disabled={locked} aria-pressed={selected === t.id} aria-label={`Mở hội thoại: ${t.subject}`} className={`block w-full border-l-4 p-4 text-left transition-colors disabled:opacity-60 ${selected === t.id ? 'border-amber-500 bg-amber-50' : 'border-transparent hover:bg-white'}`} onClick={() => { if (command.locked || uploadLock.current) return; setCreation(undefined); setSelected(t.id); command.clearError() }}>
                  <div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5e3e1] text-sm font-semibold text-[#95575f]">{(role === 'customer' ? 'HT' : t.customerName?.trim().split(/\s+/).slice(-2).map(word => word[0]).join('') || 'KH')}</span><div className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-stone-900">{role === 'customer' ? actor.facilityNames?.[t.facilityId ?? ''] ?? 'Nhân viên hỗ trợ' : t.customerName ?? 'Khách hàng'}</span><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${supportStatusClass(t.status)}`}>{supportStatusLabels[t.status]}</span></div></div>
                  <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-stone-600">{t.subject}</p>
                  <p className="mt-2 flex justify-between gap-2 text-[10px] text-stone-400"><span>{t.displayCode || `#${t.id.slice(0, 8)}`}</span><span>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }).format(parseVietnamDate(t.createdAt))}</span></p>
                </button>)}
                {read.data && !visibleTickets.length && <p className="p-6 text-center text-sm text-stone-500">{'Chưa có cuộc trò chuyện phù hợp.'}</p>}
              </div>
              {read.data && read.data.pagination.totalPages > 1 && <div className="px-3"><ApiPager pagination={read.data.pagination} disabled={locked} onPage={page => setQuery(q => ({ ...q, page }))} /></div>}
            </>}
          </>}
          </>}
        </aside>
        <section className={`support-inbox-conversation min-w-0 ${selected || creation ? 'flex flex-col' : 'hidden lg:flex lg:items-center lg:justify-center'}`} aria-label="Khung chat hỗ trợ">
          {selected || creation ? <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-4 py-2 lg:hidden">
              <p className="text-sm font-semibold text-stone-800">{creation ? 'Bắt đầu cuộc trò chuyện' : 'Trao đổi hỗ trợ'}</p>
              <Button size="sm" variant="ghost" disabled={locked} onClick={closeConversation}>Quay lại danh sách</Button>
            </div>
            <div className={`support-inbox-content ${creation ? 'overflow-y-auto p-4 sm:p-5' : 'min-h-0 flex-1'}`}>
              {creation ? <SupportCreateForm key={revision} command={formCommand} onUploadBusy={uploadBusy} parent={creation.parent} /> : selected && <SupportTicketDetail
                key={`${identity}:${selected}`} role={role} id={selected} command={formCommand} chatLayout refreshRevision={revision}
                conversation={conversation} onConversationChange={setConversation} onUploadBusy={uploadBusy}
                drafts={drafts[selected] ?? { messages: { body: '', files: [] }, internal: { body: '', files: [] } }}
                onDraftChange={(channel, draft) => setDrafts(previous => ({ ...previous, [selected]: { ...previous[selected], [channel]: draft } }))}
                messageFocus={messageFocus?.ticketId === selected ? messageFocus : undefined}
                onFollowUp={parent => { if (command.locked || uploadLock.current) return; setSelected(undefined); setCreation({ parent }) }}
              />}
            </div>
          </> : <div className="max-w-sm p-8 text-center">
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-7 w-7"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2V11.5A8.5 8.5 0 0 1 9.5 3h3a8.5 8.5 0 0 1 8.5 8.5Z" /><path d="M7 10h10M7 14h6" /></svg></span>
            <h2 className="mt-4 text-lg font-semibold text-stone-900">{role === 'customer' ? 'Chúng tôi sẵn sàng hỗ trợ' : 'Chọn một cuộc trò chuyện'}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">{role === 'customer' ? 'Bắt đầu bằng một tin nhắn hoặc chọn cuộc trò chuyện trước đó để tiếp tục.' : 'Chọn hội thoại bên trái để xem và trả lời. Chỉ các cơ sở được phân công mới xuất hiện.'}</p>
            {role === 'customer' && <Button className="mt-4" disabled={locked} onClick={() => setCreation({})}>Bắt đầu chat</Button>}
          </div>}
        </section>
      </div>
    </div>
  )
}
