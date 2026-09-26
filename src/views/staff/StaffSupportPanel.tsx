import { useState, useRef, useEffect } from 'react'
import { Badge, Button, Card, SectionHeader, Modal, Avatar } from '../../components/ui'
import type { User } from '../../types'
import type { TicketItem, StaffRosterMember } from '../../data/demoDatabase'
import { STAFF_ROSTER } from '../../data/demoDatabase'
import { useStorageHub } from '../../store/StorageHubContext'
import { getBotFeedbackStats } from '../../services/supportBotService'
import { isFacilityVisible } from '../../domain/managerRules'

interface Props {
  user: User
  tickets?: TicketItem[]
  respondSupportTicket?: (ticketId: string, replyText: string, status: TicketItem['status'], staffUser: User) => void
  canManageSupport?: boolean
  showToast: (message: string) => void
}

export default function StaffSupportPanel({
  user,
  tickets: propTickets,
  respondSupportTicket: propRespond,
  canManageSupport = true,
  showToast
}: Props) {
  const hub = useStorageHub()
  const allTickets = propTickets || hub.tickets
  const respond = propRespond || hub.respondSupportTicket

  // A Staff account without a facility scope must not see support tickets.
  // Managers/Admins may use the broader visibility rule by design.
  const hasFacilityScope = user.role !== 'staff' || Boolean(
    (user.facilityId && user.facilityId !== 'ALL') ||
    (user.facility && user.facility !== 'All facilities')
  )
  const facilityTickets = hasFacilityScope
    ? allTickets.filter(t => isFacilityVisible(user, t.facilityId, t.facility))
    : []

  // State
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [replyText, setReplyText] = useState('')
  const [ticketStatus, setTicketStatus] = useState<TicketItem['status']>('in-progress')
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in-progress' | 'waiting-customer' | 'resolved' | 'urgent'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false)

  // Local demo control for previewing assignment and outside-hours states.
  const [roster, setRoster] = useState<StaffRosterMember[]>(STAFF_ROSTER)
  const scopedRoster = roster.filter(staff =>
    user.role !== 'staff' || staff.facilityId === user.facilityId || staff.facility === user.facility
  )

  const toggleStaffOnline = (staffId: string) => {
    setRoster(prev => prev.map(s => s.id === staffId ? { ...s, online: !s.online } : s))
    showToast('Đã cập nhật trạng thái trực tuyến của nhân viên.')
  }

  const toggleAllStaffOffline = () => {
    const allAreOff = scopedRoster.filter(s => s.role === 'staff').every(s => !s.online)
    setRoster(prev => prev.map(s => scopedRoster.some(item => item.id === s.id) && s.role === 'staff' ? { ...s, online: allAreOff } : s))
    showToast(allAreOff ? 'Đã bật lại trạng thái trực cho đội ngũ mô phỏng.' : 'Đã chuyển đội ngũ mô phỏng sang ngoài giờ trực.')
  }

  // Quick reply templates
  const quickTemplates = [
    'Chào anh/chị, tôi đã tiếp nhận yêu cầu và đang kiểm tra thông tin gian kho thuộc cơ sở này.',
    'Nhân viên cơ sở sẽ kiểm tra trực tiếp tại gian kho. Chúng tôi sẽ cập nhật kết quả trong phiếu này.',
    'Hệ thống đã ghi nhận yêu cầu của anh/chị. Vui lòng bổ sung ảnh hoặc thời điểm xảy ra sự cố nếu có.',
    'Yêu cầu gia hạn đã được ghi nhận. Nhân viên cơ sở sẽ đối chiếu hợp đồng và phản hồi trong phiếu.',
    'Chúng tôi đã ghi nhận hiện trạng. Nhân viên sẽ lập biên bản xử lý và cập nhật các bước tiếp theo tại đây.'
  ]

  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectedTicket) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedTicket])

  // Metrics
  const openCount = facilityTickets.filter(t => t.status === 'open').length
  const inProgressCount = facilityTickets.filter(t => t.status === 'in-progress').length
  const waitingCustomerCount = facilityTickets.filter(t => t.status === 'waiting-customer').length
  const resolvedCount = facilityTickets.filter(t => t.status === 'resolved').length
  const aiEscalatedCount = facilityTickets.filter(t => t.source === 'ai_assistant').length
  const botStats = getBotFeedbackStats()

  // Filtered tickets
  const displayedTickets = facilityTickets.filter(t => {
    if (activeTab === 'open' && t.status !== 'open') return false
    if (activeTab === 'in-progress' && t.status !== 'in-progress') return false
    if (activeTab === 'waiting-customer' && t.status !== 'waiting-customer') return false
    if (activeTab === 'resolved' && t.status !== 'resolved') return false
    if (activeTab === 'urgent' && t.priority !== 'high') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.facility.toLowerCase().includes(q) ||
        t.unit.toLowerCase().includes(q)
      )
    }

    return true
  }).sort((a, b) => {
    // Urgent tickets first
    if (a.priority === 'high' && b.priority !== 'high' && a.status !== 'resolved') return -1
    if (b.priority === 'high' && a.priority !== 'high' && b.status !== 'resolved') return 1
    return new Date(b.updatedAt || b.created).getTime() - new Date(a.updatedAt || a.created).getTime()
  })

  const handleOpenTicket = (ticket: TicketItem) => {
    setSelectedTicket(ticket)
    setTicketStatus(ticket.status === 'open' ? 'in-progress' : ticket.status)
    setReplyText('')
    setIsQuestionExpanded(false)
  }

  const getStaffInitials = (name: string) => {
    if (!name) return 'DS'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const handleSendReply = () => {
    if (!selectedTicket || !replyText.trim()) return
    try {
      respond(selectedTicket.id, replyText.trim(), ticketStatus, user)
      showToast(`Đã gửi phản hồi và cập nhật phiếu ${selectedTicket.id}.`)
      setSelectedTicket(null)
      setReplyText('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể gửi phản hồi.')
    }
  }

  const formatDateTime = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
  }

  return (
    <div className="fade-in space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-[#191b20] tracking-tight">
            Hỗ trợ khách hàng
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Tiếp nhận và giải quyết yêu cầu hỗ trợ — bao gồm các yêu cầu do trợ lý AI phân loại và chuyển sang.
          </p>
        </div>

        {/* Live Staff Roster Status Pill */}
        <div className="flex flex-wrap items-center gap-2 bg-[#efece3] p-1.5 rounded-xl border border-stone-300">
          <span className="text-[11px] font-bold text-stone-600 px-2">Trạng thái trực (mô phỏng):</span>
          {scopedRoster.filter(s => s.role === 'staff').map(staff => (
            <button
              key={staff.id}
              type="button"
              onClick={() => toggleStaffOnline(staff.id)}
              title={`${staff.name}: Bấm để chuyển ${staff.online ? 'Offline' : 'Online'}`}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                staff.online
                  ? 'bg-white text-stone-800 border-stone-300 shadow-2xs'
                  : 'bg-stone-200/70 text-stone-400 border-dashed border-stone-300 line-through'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${staff.online ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span>{staff.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={toggleAllStaffOffline}
            className="text-[10.5px] font-bold text-amber-800 underline hover:text-amber-950 px-1"
          >
            Đổi tất cả
          </button>
        </div>
      </div>

      {!hasFacilityScope && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
          <b>Tài khoản chưa được gán cơ sở.</b> Vì lý do bảo mật, Staff không thể xem hoặc xử lý phiếu hỗ trợ cho đến khi có facility scope.
        </div>
      )}

      {hasFacilityScope && (
        <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs">
          <div>
            <span className="font-semibold text-stone-500">Phạm vi xử lý</span>
            <p className="mt-0.5 font-bold text-stone-900">{user.facility || 'Tất cả cơ sở'}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Chỉ ticket thuộc cơ sở này</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 shadow-xs">
          <span className="text-xs font-semibold text-amber-800">Chờ phản hồi</span>
          <b className="mt-1 block text-2xl font-black text-amber-900">{openCount}</b>
          <span className="text-[11px] font-bold text-red-600">
            {openCount > 0 ? '↓ Cần xử lý gấp' : '✓ Đã giải quyết hết'}
          </span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <span className="text-xs font-semibold text-blue-800">Đang xử lý</span>
          <b className="mt-1 block text-2xl font-black text-blue-900">{inProgressCount}</b>
          <span className="text-[11px] text-blue-600">Chờ khách: {waitingCustomerCount}</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800">Đã giải quyết</span>
          <b className="mt-1 block text-2xl font-black text-emerald-700">{resolvedCount}</b>
          <span className="text-[11px] text-emerald-600">Hoàn tất thành công</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-stone-500">Từ trợ lý AI</span>
          <b className="mt-1 block text-2xl font-black text-[#e0680f]">{aiEscalatedCount}</b>
          <span className="text-[11px] text-stone-500">Tự động gán thông minh</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-[#faf8f4] p-4 shadow-xs">
          <span className="text-xs font-semibold text-stone-500">Độ hài lòng bot AI</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <b className="text-2xl font-black text-amber-800">{botStats.total > 0 ? `${botStats.satisfactionRate}%` : '—'}</b>
            <span className="text-[11px] text-stone-500">{botStats.total > 0 ? `(${botStats.total} lượt đánh giá)` : 'Chưa có đánh giá'}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">{botStats.total > 0 ? `${botStats.helpful} 👍 đánh giá hữu ích` : 'Sẽ cập nhật sau khi khách đánh giá'}</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'open', label: 'Mở mới', count: openCount },
            { id: 'in-progress', label: 'Đang xử lý', count: inProgressCount },
            { id: 'waiting-customer', label: 'Chờ khách hàng', count: waitingCustomerCount },
            { id: 'resolved', label: 'Đã giải quyết', count: resolvedCount },
            { id: 'urgent', label: 'Khẩn cấp / Sự cố' }
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'border-[#181b22] bg-[#181b22] text-white shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`rounded-full px-1.5 py-0.2 text-[10.5px] ${isActive ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Tìm theo mã, tên, kho..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Staff Support Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-[#faf8f4] font-semibold text-stone-600 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Mã phiếu</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Nội dung &amp; Nguồn</th>
                <th className="py-3 px-4">Mức độ</th>
                <th className="py-3 px-4">Thời gian mở</th>
                <th className="py-3 px-4">Nhân viên phụ trách</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {displayedTickets.map(ticket => {
                const isAI = ticket.source === 'ai_assistant'
                const isEmergency = ticket.emergencyEscalation || ticket.priority === 'high'

                return (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-stone-50/80 transition ${
                      isEmergency && ticket.status !== 'resolved' ? 'bg-red-50/20' : ''
                    }`}
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-800">
                      {ticket.id}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={ticket.customer} size="sm" />
                        <div>
                          <span className="font-bold text-stone-900 block">{ticket.customer}</span>
                          <span className="text-[11px] text-stone-400">{ticket.email}</span>
                          {ticket.phone && <span className="text-[10px] text-stone-500 block">{ticket.phone}</span>}
                        </div>
                      </div>
                    </td>

                    {/* Subject, facility, unit & AI source badge */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-bold text-stone-900 line-clamp-1">{ticket.subject}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {ticket.facility} · Gian kho: <b className="text-stone-800">{ticket.unit}</b>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isAI && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#fdece0] px-1.5 py-0.5 text-[10.5px] font-bold text-[#b8540c]">
                            🤖 Chuyển từ trợ lý AI
                          </span>
                        )}
                        {ticket.emergencyEscalation && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700 animate-pulse">
                            🚨 Trực ca khẩn cấp
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          ticket.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : ticket.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {ticket.priority === 'high' ? 'Khẩn cấp' : ticket.priority === 'medium' ? 'Trung bình' : 'Tiêu chuẩn'}
                      </span>
                    </td>

                    {/* Date & ETA */}
                    <td className="py-3.5 px-4 text-[11px] text-stone-600">
                      <div>{formatDateTime(ticket.created)}</div>
                      {ticket.estimatedWaitTime && ticket.status !== 'resolved' && (
                        <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                          ⏱️ {ticket.estimatedWaitTime}
                        </div>
                      )}
                    </td>

                    {/* Assigned staff */}
                    <td className="py-3.5 px-4">
                      {ticket.assignedStaff ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#181b22] text-[10px] font-bold text-white">
                            {ticket.assignedStaffInitials || ticket.assignedStaff.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-stone-800 text-[11.5px]">
                            {ticket.assignedStaff}
                          </span>
                        </div>
                      ) : (
                        <span className="italic text-stone-400">Chưa gán</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                          ticket.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ticket.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-800'
                            : ticket.status === 'waiting-customer'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-[#efece3] text-stone-800'
                        }`}
                      >
                        {ticket.status === 'resolved'
                          ? 'Đã giải quyết'
                          : ticket.status === 'in-progress'
                          ? 'Đang xử lý'
                          : ticket.status === 'waiting-customer'
                          ? 'Chờ khách hàng'
                          : 'Chờ xử lý'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenTicket(ticket)}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-50 hover:border-amber-600 hover:text-amber-800 transition"
                      >
                        Mở phiếu ({ticket.messages.length})
                      </button>
                    </td>
                  </tr>
                )
              })}

              {displayedTickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400 text-xs">
                    Chưa có phiếu hỗ trợ nào trong danh mục này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Ticket Handling Dialog — Redesigned according to StorageHub Design Tokens */}
      <Modal
        open={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        size="xl"
        className="!p-0 overflow-hidden bg-[#f4f1ea] border border-[#e7e2d8]"
        contentClassName="p-5 sm:p-6 bg-[#f4f1ea] space-y-4"
        customHeader={
          /* 1. Header modal */
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#e7e2d8] sticky top-0 z-20">
            <h2
              id="modal-title"
              className="text-[15px] font-semibold text-[#191b20]"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Phiếu hỗ trợ
            </h2>
            <button
              type="button"
              aria-label="Đóng"
              className="text-[#767268] hover:text-[#191b20] hover:bg-[#f4f1ea] p-1.5 rounded-lg transition flex items-center justify-center cursor-pointer"
              onClick={() => setSelectedTicket(null)}
            >
              <svg className="w-5 h-5 show-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        }
      >
        {selectedTicket && (() => {
          const originalCustomerQuestion =
            selectedTicket.messages.find(m => m.role === 'customer')?.text ||
            selectedTicket.aiSummary ||
            ''

          return (
            <div className="space-y-4">
              {/* 2. Card thông tin ticket */}
              <div className="rounded-[10px] border border-[#e7e2d8] bg-white p-5 sm:p-6 shadow-2xs">
                {/* Dòng 1: 2 tag nhỏ cạnh nhau: mã ticket và trạng thái hiện tại */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded font-mono font-bold tracking-wide text-[11.5px]"
                    style={{ background: '#efece3', color: 'var(--ink)' }}
                  >
                    {selectedTicket.id}
                  </span>
                  {selectedTicket.status === 'resolved' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#edf7f0] text-[#2f9e5c] border border-[#bfe7ce]">
                      Đã giải quyết
                    </span>
                  ) : selectedTicket.status === 'in-progress' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#fef3eb] text-[#e0680f] border border-[#fcd9bd]">
                      Đang xử lý
                    </span>
                  ) : selectedTicket.status === 'waiting-customer' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#efece3] text-[#767268] border border-[#deddd2]">
                      Chờ khách hàng
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11.5px] font-bold bg-[#efece3] text-[#767268] border border-[#deddd2]">
                      Chờ xử lý
                    </span>
                  )}
                </div>

                {/* Dòng 2: Tiêu đề vấn đề — Inter, 18-20px, bold, --ink */}
                <h3
                  className="mt-3 text-[19px] font-bold leading-snug text-[#191b20]"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {selectedTicket.subject}
                </h3>

                {/* Dòng 3 & Dòng 4: Dòng 3 meta nhỏ bên trái, Dòng 4 bên phải (xuống dòng ở mobile) */}
                <div className="mt-3 pt-3 border-t border-[#e7e2d8]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13px] text-[#767268]">
                  <div>
                    <span>{selectedTicket.customer}</span>
                    <span className="mx-1.5">·</span>
                    <span>{selectedTicket.email}</span>
                    {selectedTicket.phone && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{selectedTicket.phone}</span>
                      </>
                    )}
                  </div>
                  <div className="font-medium text-[#191b20] sm:text-right">
                    <span>{selectedTicket.facility}</span>
                    <span className="mx-1.5">·</span>
                    <span>Gian kho <b className="font-bold text-[#191b20]">{selectedTicket.unit}</b></span>
                  </div>
                </div>
              </div>

              {/* 3. Khối tóm tắt hội thoại AI */}
              {(selectedTicket.aiSummary || selectedTicket.source === 'ai_assistant') && (
                <div className="rounded-[10px] border border-dashed border-[#e7e2d8] bg-[#faf8f4] p-4 text-xs text-[#191b20]">
                  {/* Header: 1 icon SVG outline nhỏ ở đầu tiêu đề khối, không emoji */}
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-4 h-4 text-[#e0680f] show-icon flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                      />
                    </svg>
                    <span
                      className="font-oswald text-[12px] font-semibold tracking-wider uppercase text-[#191b20]"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      Tóm tắt từ trợ lý AI
                    </span>
                  </div>

                  {/* Key–value layout */}
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 items-baseline">
                      <span className="text-[#767268] font-medium">Phân loại</span>
                      <span className="font-semibold text-[#191b20]">
                        {selectedTicket.category || 'Access & Entry'} · Mức độ: {selectedTicket.priority === 'high' ? 'Cao' : selectedTicket.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 items-baseline">
                      <span className="text-[#767268] font-medium">Đã điều phối</span>
                      <span className="font-semibold text-[#191b20]">
                        {selectedTicket.assignedStaff || 'Chưa gán'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 items-baseline">
                      <span className="text-[#767268] font-medium">Cam kết phản hồi</span>
                      <span className="font-semibold text-[#191b20]">
                        {selectedTicket.estimatedWaitTime || (selectedTicket.priority === 'high' ? '5–8 phút (ưu tiên khẩn cấp)' : '15–30 phút')}
                      </span>
                    </div>

                    {/* Câu hỏi gốc khách gửi cho bot */}
                    {originalCustomerQuestion && (
                      <div className="mt-3 pt-2.5 border-t border-[#e7e2d8]/70">
                        <span className="text-[#767268] font-medium block mb-1.5">
                          Câu hỏi gốc khách gửi cho bot:
                        </span>
                        <div className="rounded-lg bg-white/90 p-2.5 border border-[#e7e2d8]/80 text-xs italic text-[#191b20] leading-relaxed">
                          <p className={isQuestionExpanded ? '' : 'line-clamp-2'}>
                            "{originalCustomerQuestion}"
                          </p>
                          {originalCustomerQuestion.length > 110 && (
                            <button
                              type="button"
                              onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
                              className="mt-1 text-[11px] font-semibold text-[#e0680f] hover:text-[#b8540c] hover:underline cursor-pointer not-italic inline-block"
                            >
                              {isQuestionExpanded ? 'Thu gọn' : 'Xem thêm'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emergency alert banner if applicable */}
              {selectedTicket.emergencyEscalation && (
                <div className="rounded-[10px] border border-[#d64545]/30 bg-[#fdf2f2] p-3 text-xs text-[#d64545] font-medium flex items-center gap-2.5">
                  <svg className="w-4 h-4 flex-shrink-0 text-[#d64545] show-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    Phiếu này được đánh dấu khẩn cấp khi ngoài giờ trực ca. Quản lý cần ưu tiên phân công và cập nhật hướng xử lý trong phiếu.
                  </span>
                </div>
              )}

              {/* 4. Timeline hội thoại (chat giữa khách và staff) */}
              <div className="max-h-72 overflow-y-auto rounded-[10px] border border-[#e7e2d8] bg-[#faf8f4] p-4 space-y-3.5">
                {selectedTicket.messages.map(msg => {
                  const isStaff = msg.role === 'staff'
                  const isCustomer = msg.role === 'customer'

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                    >
                      {/* Meta row: Tên · Vai trò · timestamp, 11px, --ink-soft */}
                      <div className="mb-1 px-1 flex items-center gap-1.5 text-[11px] text-[#767268]">
                        <span className="font-semibold text-[#191b20]">{msg.sender}</span>
                        <span>·</span>
                        <span>{isStaff ? 'Nhân viên hỗ trợ' : isCustomer ? 'Khách hàng' : 'Hệ thống'}</span>
                        <span>·</span>
                        <span>{formatDateTime(msg.time)}</span>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[75%] rounded-[10px] px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                          isStaff
                            ? 'bg-[#fdece0] text-[#191b20] rounded-br-[3px] border border-[#fcd9bd]/60'
                            : 'bg-white text-[#191b20] border border-[#e7e2d8] rounded-bl-[3px]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed break-words">{msg.text}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* 5. "Mẫu phản hồi nhanh" */}
              <div>
                <p
                  className="font-oswald text-[11px] font-semibold text-[#767268] mb-2 uppercase tracking-wider"
                  style={{ letterSpacing: '0.08em' }}
                >
                  Mẫu phản hồi nhanh
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {quickTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReplyText(tpl)}
                      className="group w-full flex items-center justify-between px-3 py-2 rounded-[8px] bg-[#faf8f4] border border-[#e7e2d8]/40 hover:bg-[#f1eee7] transition cursor-pointer text-left"
                    >
                      <span className="text-xs text-[#191b20] font-normal leading-relaxed line-clamp-1 pr-2">
                        {tpl}
                      </span>
                      <svg
                        className="w-3.5 h-3.5 text-[#e0680f] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 show-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Khối "Cập nhật trạng thái" + "Người phụ trách" (Gộp 1 hàng ngang duy nhất) */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-[#e7e2d8]">
                {/* Trạng thái: [dropdown] */}
                <div className="flex items-center gap-2">
                  <label htmlFor="ticket-status-select" className="text-xs font-semibold text-[#191b20] whitespace-nowrap">
                    Trạng thái:
                  </label>
                  <select
                    id="ticket-status-select"
                    value={ticketStatus}
                    onChange={e => setTicketStatus(e.target.value as TicketItem['status'])}
                    className="rounded-[6px] border border-[#e7e2d8] bg-white px-3 py-1.5 text-xs text-[#191b20] font-medium focus:outline-none focus:ring-2 focus:ring-[#e0680f] cursor-pointer"
                  >
                    <option value="in-progress">Đang xử lý</option>
                    <option value="waiting-customer">Chờ khách hàng phản hồi</option>
                    <option value="resolved">Đã giải quyết xong</option>
                    <option value="open">Mở mới / Chờ xử lý</option>
                  </select>
                </div>

                {/* Phụ trách: [avatar tròn cam] Demo Staff */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#191b20] whitespace-nowrap">
                    Phụ trách:
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e0680f] text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                      {selectedTicket.assignedStaffInitials || getStaffInitials(selectedTicket.assignedStaff || user.name || 'Demo Staff')}
                    </div>
                    <span className="text-xs font-bold text-[#191b20]">
                      {selectedTicket.assignedStaff || user.name || 'Demo Staff'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 7. Textarea "Nội dung phản hồi chính thức" */}
              <div>
                <label htmlFor="ticket-reply-textarea" className="block text-xs font-semibold text-[#191b20] mb-1.5">
                  Nội dung phản hồi chính thức *
                </label>
                <textarea
                  id="ticket-reply-textarea"
                  rows={3}
                  placeholder="Nhập nội dung phản hồi, hướng dẫn hoặc giải pháp xử lý..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="w-full rounded-[6px] border border-[#e7e2d8] bg-white px-3 py-2 text-xs text-[#191b20] placeholder:text-[#767268]/60 focus:outline-none focus:ring-2 focus:ring-[#e0680f] focus:border-[#e0680f] transition resize-none leading-relaxed"
                />
              </div>

              {/* 8. Footer nút hành động */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e7e2d8]">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="rounded-[6px] border border-[#e7e2d8] bg-white px-4 py-2 text-xs font-semibold text-[#191b20] hover:bg-[#faf8f4] transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={!replyText.trim() || !canManageSupport}
                  onClick={handleSendReply}
                  className={`rounded-[6px] px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    !replyText.trim() || !canManageSupport
                      ? 'bg-[#d8d4c9] text-[#767268] cursor-not-allowed border-none'
                      : 'bg-[#e0680f] text-white hover:bg-[#b8540c] shadow-sm cursor-pointer border-none'
                  }`}
                >
                  Gửi phản hồi &amp; Cập nhật
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
