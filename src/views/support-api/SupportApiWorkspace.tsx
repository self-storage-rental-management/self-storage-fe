import { parseVietnamDate } from '../../utils/vietnamTime'
import { useManagerPresentation } from "../manager/managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "../manager/managerFacilityUi"
import { useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor, type ApiActor } from "../../services/authApi"
import { listSupportQueue, listSupportTickets } from "../../services/supportApi"
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
    sort: "createdAt,desc",
  })
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string>()
  const [creation, setCreation] = useState<{ parent?: SupportTicket }>()
  const [revision, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<"messages" | "internal", SupportDraft>>>>({})
  const [messageFocus, setMessageFocus] = useState<{ ticketId: string; channel: "messages" | "internal"; messageId?: string }>()
  const [conversation, setConversation] = useState<"messages" | "internal">("messages")
  const [staffView, setStaffView] = useState<"queue" | "assigned">("assigned")
  const [queuePage, setQueuePage] = useState(0)
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listSupportTickets(role, query),
    { retainDataOnRefresh: true },
  )
  const queueQuery: SupportQuery = { page: queuePage, size: query.size, search: query.search, sort: query.sort }
  const queueRead = useRentalApiResource(
    `${identity}:queue:${JSON.stringify(queueQuery)}`,
    () => role === "staff" ? listSupportQueue(queueQuery) : Promise.resolve({
      data: [], pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: "createdAt,desc" }, correlationId: null,
    }),
    { retainDataOnRefresh: true },
  )
  const command = useSupportCommand(`${actor.id}:support:${role}`, (submission, result) => {
    if (submission.kind === "create" && result && typeof result === "object" && "id" in result && isUuid(result.id)) {
      setSelected(result.id)
      setConversation("messages")
    }
    if (submission.kind === "command" && ["message", "resolve"].includes(submission.command.kind)) {
      const channel = submission.command.kind === "message" && "visibility" in submission.command && submission.command.visibility === "INTERNAL" ? "internal" : "messages"
      setDrafts(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], [channel]: { body: "", files: [] } } }))
      const messageId = submission.command.kind === "message" && result && typeof result === "object" && "id" in result && isUuid(result.id) ? result.id : undefined
      setMessageFocus({ ticketId: submission.id, channel, messageId })
      setConversation(channel)
    }
    read.refresh()
    queueRead.refresh()
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
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || command.locked || uploadLock.current) return
      read.refresh()
      if (role === "staff") queueRead.refresh()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [role, command.locked, read.refresh, queueRead.refresh])
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
    queueRead.refresh()
    setRevision((n) => n + 1)
  }
  const change = (patch: SupportQuery) => {
    if (command.locked || uploadLock.current) return
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
    setQueuePage(0)
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
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Hỗ trợ khách hàng</h1>
          <p className="mt-1 text-sm text-stone-500">{role === "customer" ? "Nhắn tin trực tiếp với nhân viên tại cơ sở của bạn." : "Tiếp nhận và trao đổi với khách hàng trong cùng một cuộc trò chuyện."}</p>
        </div>
        {role === "customer" && <Button disabled={locked} onClick={() => { setSelected(undefined); setCreation({}) }}>Cuộc trò chuyện mới</Button>}
      </header>
      {commandNotice}
      <div className="grid min-h-[600px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`min-w-0 border-stone-200 bg-stone-50/50 lg:border-r ${selected || creation ? "hidden lg:block" : "block"}`} aria-label="Danh sách hội thoại">
          <div className="space-y-3 border-b border-stone-200 p-4">
            {role === "staff" ? <div className="flex gap-2" role="group" aria-label="Danh sách hỗ trợ">
              {([['assigned', 'Đang phụ trách'], ['queue', 'Chờ tiếp nhận']] as const).map(([view, label]) => <Button key={view} size="sm" variant={staffView === view ? "primary" : "outline"} aria-pressed={staffView === view} disabled={locked} onClick={() => {
                if (command.locked || uploadLock.current || staffView === view) return
                setStaffView(view); setSelected(undefined); setCreation(undefined); setQuery(q => ({ ...q, page: 0 })); setQueuePage(0); command.clearError()
                if (view === "queue") queueRead.refresh(); else read.refresh()
              }}>{label}</Button>)}
            </div> : <h2 className="text-sm font-semibold text-stone-800">Cuộc trò chuyện</h2>}
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); change({ search: search.trim() }) }}>
              <label className="block text-xs font-medium text-stone-500">Tìm cuộc trò chuyện
                <input className={supportInputClass} placeholder="Tìm nội dung hoặc mã hội thoại" value={search} maxLength={200} disabled={locked} onChange={e => setSearch(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(role !== "staff" || staffView === "assigned") && <label className="block text-xs text-stone-500">Trạng thái
                  <select className={supportInputClass} value={query.status ?? ""} disabled={locked} onChange={e => change({ status: (e.target.value || undefined) as SupportQuery['status'] })}>
                    <option value="">Tất cả</option>{supportStatuses.map(s => <option key={s} value={s}>{supportStatusLabels[s]}</option>)}
                  </select>
                </label>}
                <label className="block text-xs text-stone-500">Sắp xếp
                  <select className={supportInputClass} value={query.sort} disabled={locked} onChange={e => change({ sort: e.target.value })}>
                    <option value="createdAt,desc">Mới nhất</option><option value="createdAt,asc">Cũ nhất</option><option value="updatedAt,desc">Vừa cập nhật</option><option value="subject,asc">Nội dung A-Z</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" type="submit" variant="outline" disabled={locked}>Tìm kiếm</Button>
                <Button size="sm" type="button" variant="ghost" disabled={locked} onClick={() => { setSearch(''); setQuery({ page: 0, size: role === 'manager' ? 10 : 20, ...(facilityId ? { facilityId } : {}), sort: 'createdAt,desc' }); setQueuePage(0) }}>Xóa bộ lọc</Button>
              </div>
            </form>
          </div>
          {role === "staff" && staffView === "queue" ? <>
            <SupportReadState {...queueRead} loading={queueRead.loading && !queueRead.data} retry={reload} />
            {queueRead.data && <>
              <div className="max-h-[550px] divide-y divide-stone-100 overflow-y-auto">
                {queueRead.data.data.map(item => <article key={item.id} className="space-y-2 bg-white p-4">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-stone-800">{item.subject}</p>
                  <p className="text-xs text-stone-500">{actor.facilityNames?.[item.facilityId] ?? 'Cơ sở phụ trách'}</p>
                  <p className="text-[11px] text-stone-400">{rentalDate(item.createdAt)}</p>
                  <Button size="sm" disabled={locked || command.conflict} onClick={async () => {
                    const succeeded = await command.run({ kind: 'command', role: 'staff', id: item.id, command: { kind: 'claim', expectedVersion: item.version } })
                    if (succeeded) { setStaffView('assigned'); setSelected(item.id) }
                  }}>Nhận trò chuyện</Button>
                </article>)}
                {!queueRead.data.data.length && <p className="p-6 text-center text-sm text-stone-500">Chưa có cuộc trò chuyện chờ tiếp nhận tại cơ sở được phân công.</p>}
              </div>
              {queueRead.data.pagination.totalPages > 1 && <div className="px-3"><ApiPager pagination={queueRead.data.pagination} disabled={locked} onPage={setQueuePage} /></div>}
            </>}
          </> : <>
            <SupportReadState {...read} loading={read.loading && !read.data} retry={reload} />
            {invalidScope ? <p role="alert" className="p-4 text-sm text-red-700">Không thể hiển thị hội thoại ngoài phạm vi truy cập của bạn.</p> : <>
              <div className="max-h-[550px] divide-y divide-stone-100 overflow-y-auto">
                {visibleTickets.map(t => <button key={t.id} type="button" disabled={locked} aria-pressed={selected === t.id} aria-label={`Mở hội thoại: ${t.subject}`} className={`block w-full border-l-4 p-4 text-left transition-colors disabled:opacity-60 ${selected === t.id ? 'border-amber-500 bg-amber-50' : 'border-transparent hover:bg-white'}`} onClick={() => { if (command.locked || uploadLock.current) return; setCreation(undefined); setSelected(t.id); command.clearError() }}>
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-stone-900">{role === 'customer' ? actor.facilityNames?.[t.facilityId ?? ''] ?? 'Nhân viên hỗ trợ' : t.customerName ?? 'Khách hàng'}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${supportStatusClass(t.status)}`}>{supportStatusLabels[t.status]}</span></div>
                  <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-stone-600">{t.subject}</p>
                  <p className="mt-2 flex justify-between gap-2 text-[10px] text-stone-400"><span>{t.displayCode || `#${t.id.slice(0, 8)}`}</span><span>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }).format(parseVietnamDate(t.createdAt))}</span></p>
                </button>)}
                {read.data && !visibleTickets.length && <p className="p-6 text-center text-sm text-stone-500">{role === 'staff' ? 'Chưa có cuộc trò chuyện đang phụ trách. Chọn Chờ tiếp nhận để bắt đầu.' : 'Chưa có cuộc trò chuyện phù hợp.'}</p>}
              </div>
              {read.data && read.data.pagination.totalPages > 1 && <div className="px-3"><ApiPager pagination={read.data.pagination} disabled={locked} onPage={page => setQuery(q => ({ ...q, page }))} /></div>}
            </>}
          </>}
        </aside>
        <section className={`min-w-0 ${selected || creation ? 'block' : 'hidden lg:flex lg:items-center lg:justify-center'}`} aria-label="Khung chat hỗ trợ">
          {selected || creation ? <>
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
              <p className="text-sm font-semibold text-stone-800">{creation ? 'Bắt đầu cuộc trò chuyện' : 'Trao đổi hỗ trợ'}</p>
              <Button size="sm" variant="ghost" disabled={locked} onClick={closeConversation}>Quay lại danh sách</Button>
            </div>
            <div className="p-4 sm:p-5">
              {creation ? <SupportCreateForm key={revision} command={formCommand} onUploadBusy={uploadBusy} parent={creation.parent} /> : selected && <SupportTicketDetail
                key={`${identity}:${selected}:${revision}`} role={role} id={selected} command={formCommand} chatLayout
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
