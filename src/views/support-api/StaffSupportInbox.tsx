import { useEffect, useRef, useState } from 'react'
import type { SupportQueueItem, SupportTicket } from '../../types/supportApi'
import { supportStatusLabels } from './presentation'
import { getAuthenticatedActor } from '../../services/authApi'
import { listStaffSupportInbox } from '../../services/supportApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { useSupportUnread } from '../../hooks/useSupportMessageReads'
import SupportReadState from './SupportReadState'
import ApiPager from '../rental-api/ApiPager'

const customerKey = (ticket: SupportTicket) => `${ticket.customerId}:${ticket.facilityId}`
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function StaffSupportInbox({ locked, onClaim, onOpen, selectedId, refreshRevision = 0 }: {
  locked: boolean; onClaim: (ticket: SupportQueueItem) => Promise<boolean>; onOpen: (id: string) => void
  selectedId?: string; refreshRevision?: number
}) {
  const [view, setView] = useState<'queue' | 'mine'>('mine')
  const [page, setPage] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState<{ key: string; id: string }>()
  const actor = getAuthenticatedActor()
  const read = useRentalApiResource(`${actor?.id}:staff-inbox:${view}:${page}`, () => listStaffSupportInbox(view, page), { retainDataOnRefresh: true })
  const previousRevision = useRef(refreshRevision)
  useEffect(() => {
    if (previousRevision.current === refreshRevision) return
    previousRevision.current = refreshRevision
    read.refresh()
  }, [refreshRevision, read.refresh])
  useEffect(() => {
    if (locked || read.loading) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') read.refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [locked, read.loading, read.refresh])
  useEffect(() => {
    if (page > 0 && read.data && page >= read.data.pagination.totalPages) setPage(Math.max(0, read.data.pagination.totalPages - 1))
  }, [page, read.data])
  const rows = read.data?.data ?? []
  const unread = useSupportUnread('staff', rows.flatMap(row => row.ticket && row.ticket.assignedStaffId === actor?.id ? [row.ticket.id] : []))
  const changeView = (next: 'queue' | 'mine') => { setView(next); setPage(0) }
  const open = (ticket: SupportTicket) => {
    if (locked || ticket.assignedStaffId !== getAuthenticatedActor()?.id) return
    setSelectedGroup({ key: customerKey(ticket), id: ticket.id }); onOpen(ticket.id)
  }
  return <section className="flex min-h-0 flex-1 flex-col bg-white px-4 py-4" aria-label="Hỗ trợ khách hàng">
    <header className="support-staff-inbox__header shrink-0">
      <h2 className="support-staff-inbox__title font-bold tracking-tight text-stone-900">Đoạn chat</h2>
    </header>
    <div role="group" aria-label="Nhóm hội thoại" className="support-staff-inbox__tabs my-4 grid shrink-0 grid-cols-2 gap-1">
      {([['queue', 'Chờ nhận'], ['mine', 'Đang hỗ trợ']] as const).map(([key, label]) => <button key={key} type="button" title={`${label} (${read.data?.counts[key] ?? '…'})`} aria-pressed={view === key} disabled={locked} onClick={() => changeView(key)}
        className={`rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#8aa34d] disabled:opacity-50 ${view === key ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'}`}>{label} ({read.data?.counts[key] ?? '…'})</button>)}
    </div>
    <SupportReadState {...read} loading={read.loading && !read.data} retry={read.refresh} />
    {!!read.error && <button type="button" disabled={locked} onClick={read.refresh} className="min-h-8 text-xs underline">Tải lại</button>}
    <div className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto overscroll-contain">
      {rows.map(row => {
        const ticket = row.ticket
        const queued = row.queued
        const id = ticket?.id ?? queued!.id
        const selected = !!ticket && (selectedId === id || !!selectedId && selectedGroup?.id === selectedId && selectedGroup.key === customerKey(ticket))
        const facilityName = actor?.facilityNames?.[ticket?.facilityId ?? queued?.facilityId ?? '']
        return <div key={id} className={`relative flex items-center gap-3 rounded-xl px-2 py-3.5 transition-colors ${selected ? 'bg-[#e8f0ca]' : ticket ? 'hover:bg-stone-100' : ''}`}>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center text-stone-500"><svg className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="7" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span>
          <button type="button" aria-current={selected ? 'true' : undefined} disabled={locked || !ticket} onClick={() => { if (ticket) open(ticket) }} className="min-w-0 flex-1 rounded-lg py-1 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-2 focus-visible:outline-[#8aa34d] disabled:cursor-default disabled:after:hidden" title={ticket ? 'Mở cuộc trò chuyện' : 'Nhận trò chuyện trước khi mở và gửi tin nhắn'}>
            <div className="flex items-center gap-2"><p className="min-w-0 truncate text-sm font-semibold text-stone-900">{ticket?.customerName?.trim() || queued?.displayCode || (ticket ? 'Khách hàng' : 'Yêu cầu hỗ trợ')}</p>{!!unread.get(id)?.unreadCount && <span aria-label={`${unread.get(id)!.unreadCount} tin chưa đọc`} className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#587222] px-1.5 text-[10px] font-semibold text-white">{Math.min(99, unread.get(id)!.unreadCount)}</span>}</div>
            <p className="mt-1 truncate text-xs leading-5 text-stone-500">{ticket?.subject ?? queued?.subject}</p>
            {facilityName && Object.keys(actor?.facilityScopes ?? {}).length > 1 && <p className="truncate text-[10px] text-stone-400">{facilityName}</p>}
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1.5"><time dateTime={row.lastActivityAt} title={date(row.lastActivityAt)} className="text-xs text-stone-500">{new Date(row.lastActivityAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</time>
            {queued ? <button type="button" disabled={locked} onClick={async () => { if (await onClaim(queued)) { changeView('mine'); read.refresh() } }} className="min-h-7 rounded-full border-0 bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-50">Nhận xử lý</button>
              : <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700">{supportStatusLabels[ticket!.status]}</span>}
          </div>
        </div>
      })}
      {!read.loading && !read.error && !rows.length && <p className="py-8 text-center text-sm text-stone-500">{view === 'queue' ? 'Chưa có yêu cầu chờ tiếp nhận.' : 'Bạn chưa có cuộc trò chuyện đang hỗ trợ.'}</p>}
    </div>
    {read.data && read.data.pagination.totalPages > 1 && <div className="mt-3 shrink-0"><ApiPager pagination={read.data.pagination} disabled={locked} onPage={setPage} /></div>}
  </section>
}
