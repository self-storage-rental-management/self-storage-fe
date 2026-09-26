import { useState } from 'react'
import type { User } from '../../types'
import type { TicketItem } from '../../data/demoDatabase'
import { Badge, Button, Card, SectionHeader, Input, Modal, Select } from '../../components/ui'
import { getBotFeedbackStats } from '../../services/supportBotService'

interface CustomerSupportSectionProps {
  user: User
  tickets: TicketItem[]
  onOpenChatbot: () => void
  onOpenCreateModal: () => void
  onOpenConversation: (ticket: TicketItem) => void
  onDeleteResolved: (ticket: TicketItem) => void
}

export default function CustomerSupportSection({
  user,
  tickets,
  onOpenChatbot,
  onOpenCreateModal,
  onOpenConversation,
  onDeleteResolved
}: CustomerSupportSectionProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in-progress' | 'resolved' | 'ai'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter tickets belonging to this customer
  const myTickets = tickets.filter(
    t => t.email?.toLowerCase() === user.email?.toLowerCase() ||
         t.customer?.toLowerCase() === user.name?.toLowerCase()
  )

  const botStats = getBotFeedbackStats()

  const openCount = myTickets.filter(t => t.status === 'open').length
  const inProgressCount = myTickets.filter(t => t.status === 'in-progress' || t.status === 'waiting-customer').length
  const pendingCount = openCount + inProgressCount
  const resolvedCount = myTickets.filter(t => t.status === 'resolved').length
  const aiCount = myTickets.filter(t => t.source === 'ai_assistant').length

  const filteredTickets = myTickets.filter(t => {
    if (activeTab === 'open' && t.status !== 'open') return false
    if (activeTab === 'in-progress' && t.status !== 'in-progress' && t.status !== 'waiting-customer') return false
    if (activeTab === 'resolved' && t.status !== 'resolved') return false
    if (activeTab === 'ai' && t.source !== 'ai_assistant') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.facility.toLowerCase().includes(q) ||
        t.unit.toLowerCase().includes(q)
      )
    }

    return true
  }).sort((a, b) => new Date(b.updatedAt || b.created).getTime() - new Date(a.updatedAt || a.created).getTime())

  const formatTicketTime = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
  }

  return (
    <div className="fade-in space-y-6">
      {/* Page Head */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#191b20] tracking-tight">
            Tổng đài hỗ trợ khách hàng
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Hỏi trợ lý StorageHub trước — nếu cần, yêu cầu sẽ tự động chuyển cho nhân viên kèm lịch sử trao đổi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onOpenCreateModal}
            className="text-xs font-bold"
          >
            Tạo phiếu truyền thống
          </Button>
          <button
            type="button"
            onClick={onOpenChatbot}
            className="inline-flex items-center gap-2 rounded-lg bg-[#e0680f] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#b8540c] transition"
          >
            <span>🤖</span>
            <span>Hỏi trợ lý AI / Tạo yêu cầu</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-[#faf8f4] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-stone-700">
          <span className="font-bold text-stone-900">Phiếu được chuyển theo cơ sở của gian kho.</span>{' '}
          Nhân viên ngoài cơ sở này không nhìn thấy nội dung trao đổi.
        </p>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-semibold text-stone-600">
          Bảo mật theo facility
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-stone-500">Tổng yêu cầu</span>
          <b className="mt-1 block text-2xl font-black text-[#191b20]">{myTickets.length}</b>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <span className="text-xs font-medium text-amber-800">Đang cần xử lý</span>
          <b className="mt-1 block text-2xl font-black text-amber-900">{pendingCount}</b>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <span className="text-xs font-medium text-emerald-800">Đã giải quyết</span>
          <b className="mt-1 block text-2xl font-black text-emerald-700">{resolvedCount}</b>
        </div>
        <div className="rounded-xl border border-stone-200 bg-[#faf8f4] p-4 shadow-xs">
          <span className="text-xs font-medium text-stone-500">Hài lòng trợ lý AI</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <b className="text-2xl font-black text-amber-800">{botStats.total > 0 ? `${botStats.satisfactionRate}%` : '—'}</b>
            <span className="text-[11px] text-stone-500">{botStats.total > 0 ? `(${botStats.helpful} 👍)` : 'Chưa có đánh giá'}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'Tất cả', count: myTickets.length },
            { id: 'open', label: 'Chờ tiếp nhận', count: openCount },
            { id: 'in-progress', label: 'Đang xử lý', count: inProgressCount },
            { id: 'resolved', label: 'Đã giải quyết', count: resolvedCount },
            { id: 'ai', label: 'Từ trợ lý AI', count: aiCount }
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'border-[#e0680f] bg-[#e0680f] text-white shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10.5px] ${isActive ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-600'}`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Tìm mã phiếu, nội dung..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3.5">
        {filteredTickets.map(ticket => {
          const isAI = ticket.source === 'ai_assistant'
          const latestMessage = ticket.messages[ticket.messages.length - 1]
          const isEmergency = ticket.emergencyEscalation || (ticket.priority === 'high' && ticket.status !== 'resolved')

          return (
            <div
              key={ticket.id}
              className={`rounded-xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                isEmergency ? 'border-red-300 bg-red-50/20' : 'border-stone-200'
              }`}
            >
              {/* Ticket Top Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#efece3] px-2.5 py-0.5 font-mono text-xs font-bold text-stone-800">
                  {ticket.id}
                </span>
                <span
                  className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                    ticket.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : ticket.status === 'in-progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-[#20242d] text-white'
                  }`}
                >
                  {ticket.status === 'resolved'
                    ? 'Đã giải quyết'
                    : ticket.status === 'in-progress'
                    ? 'Nhân viên đang xử lý'
                    : ticket.status === 'waiting-customer'
                    ? 'Chờ bạn phản hồi'
                    : 'Chờ nhân viên tiếp nhận'}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                    ticket.priority === 'high'
                      ? 'bg-[#fbe3e3] text-red-700'
                      : ticket.priority === 'medium'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {ticket.priority === 'high' ? 'Khẩn cấp / Ảnh hưởng cao' : ticket.priority === 'medium' ? 'Ảnh hưởng vừa' : 'Thông thường'}
                </span>
                {isAI && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fdece0] px-2 py-0.5 text-xs font-bold text-[#b8540c]">
                    <span>🤖</span> Được trợ lý AI chuyển tiếp
                  </span>
                )}
                {ticket.estimatedWaitTime && ticket.status !== 'resolved' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                    <span>⏱️</span> {ticket.estimatedWaitTime}
                  </span>
                )}
              </div>

              {/* Title & Metadata */}
              <h3 className="mt-2.5 text-base font-bold text-[#191b20]">
                {ticket.subject}
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                {ticket.category} · <span className="font-semibold text-stone-800">{ticket.facility}</span>
                {ticket.unit && ticket.unit !== '—' && (
                  <span> · Gian kho: <span className="font-semibold text-stone-900">{ticket.unit}</span></span>
                )}
                {' · '}{formatTicketTime(ticket.updatedAt || ticket.created)}
              </p>

              {/* AI Transcript Box */}
              {isAI && ticket.aiSummary && (
                <div className="mt-3 rounded-lg border border-dashed border-amber-300 bg-[#faf8f4] p-3 text-xs text-stone-700">
                  <b className="text-amber-900">Tóm tắt hội thoại với trợ lý: </b>
                  <span>{ticket.aiSummary}</span>
                </div>
              )}

              {/* Emergency Banner if applicable */}
              {ticket.emergencyEscalation && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚨</span>
                    <span>
                      <b>Ưu tiên khẩn cấp:</b> Phiếu đã được đánh dấu để Quản lý ca trực tiếp nhận. Bạn tiếp tục theo dõi và bổ sung thông tin ngay trong phiếu này.
                    </span>
                  </div>
                </div>
              )}

              {/* Latest message preview */}
              {latestMessage && (
                <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-700 border border-stone-200">
                  <b>{latestMessage.role === 'staff' ? `${ticket.assignedStaff || 'Staff'} phản hồi:` : 'Bạn:'} </b>
                  <span className="text-stone-600 line-clamp-2">{latestMessage.text}</span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  {ticket.assignedStaff ? (
                    <span>
                      Nhân viên phụ trách: <b className="text-stone-800">{ticket.assignedStaff}</b>
                    </span>
                  ) : (
                    <span className="italic text-stone-400">Đang xếp vào hàng đợi trực ban</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenConversation(ticket)}
                  >
                    Mở trao đổi ({ticket.messages.length})
                  </Button>
                  {ticket.status === 'resolved' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => onDeleteResolved(ticket)}
                    >
                      Xóa phiếu
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filteredTickets.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
            <div className="text-3xl mb-2">📋</div>
            <p className="font-bold text-stone-700">Chưa có yêu cầu hỗ trợ nào trong mục này</p>
            <p className="mt-1 text-xs text-stone-500">
              Bạn có thể bấm "Hỏi trợ lý AI / Tạo yêu cầu" ở trên để được giải đáp hoặc tạo phiếu mới.
            </p>
            <button
              type="button"
              onClick={onOpenChatbot}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#e0680f] px-4 py-2 text-xs font-bold text-white hover:bg-[#b8540c] transition"
            >
              🤖 Mở Trợ lý StorageHub
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
