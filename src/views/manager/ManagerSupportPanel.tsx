import React, { useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Select, Avatar, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { TicketItem } from '../../data/demoDatabase'

interface ManagerSupportPanelProps {
  user: User
  showToast: (msg: string) => void
  sb: (v: string) => React.ReactNode
}

export default function ManagerSupportPanel({ user, showToast, sb }: ManagerSupportPanelProps) {
  const { lang } = useLanguage()
  const { tickets: storeTickets, respondSupportTicket } = useStorageHub()

  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [newStatus, setNewStatus] = useState<TicketItem['status']>('in-progress')

  // Filter tickets by facility
  const facilityTickets = storeTickets.filter(
    t => !user.facility || user.facility === 'All facilities' || t.facility === user.facility
  )

  const openCount = facilityTickets.filter(t => t.status === 'open').length
  const inProgressCount = facilityTickets.filter(t => t.status === 'in-progress').length
  const resolvedCount = facilityTickets.filter(t => t.status === 'resolved').length
  const highPriorityCount = facilityTickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length

  const filteredTickets = facilityTickets.filter(t => {
    const matchTab =
      tab === 'All' ||
      tab === 'Tất cả' ||
      (tab === 'open' && t.status === 'open') ||
      (tab === 'in-progress' && t.status === 'in-progress') ||
      (tab === 'resolved' && t.status === 'resolved') ||
      (tab === 'high' && t.priority === 'high')

    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      t.id.toLowerCase().includes(q) ||
      t.customer.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.unit && t.unit.toLowerCase().includes(q))

    return matchTab && matchSearch
  })

  const getPriorityBadge = (p: TicketItem['priority']) => {
    if (p === 'high') return <Badge variant="error">{lang === 'vi' ? 'Khẩn cấp' : 'High'}</Badge>
    if (p === 'medium') return <Badge variant="warning">{lang === 'vi' ? 'Trung bình' : 'Medium'}</Badge>
    return <Badge variant="info">{lang === 'vi' ? 'Bình thường' : 'Low'}</Badge>
  }

  const handleSendReply = () => {
    if (!selectedTicket) return
    if (!replyText.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập nội dung phản hồi.' : 'Please write a reply message.')
      return
    }

    try {
      respondSupportTicket(selectedTicket.id, replyText.trim(), newStatus, user)
      showToast(
        lang === 'vi'
          ? `Đã gửi phản hồi hỗ trợ cho ${selectedTicket.customer}!`
          : `Reply sent to ${selectedTicket.customer} successfully!`
      )
      setReplyText('')
      setTicketModalOpen(false)
      setSelectedTicket(null)
    } catch (err: any) {
      showToast(err?.message || 'Error sending ticket response')
    }
  }

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        title={lang === 'vi' ? 'Hỗ Trợ Khách Hàng & Xử Lý Sự Cố Kho' : 'Support Tickets & Facility Incidents'}
        subtitle={
          lang === 'vi'
            ? 'Tiếp nhận yêu cầu kỹ thuật, giải đáp thắc mắc mã khóa cổng và xử lý khiếu nại chất lượng dịch vụ'
            : 'Track technical help requests, resolve gate access issues, and address tenant inquiries'
        }
      />

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={lang === 'vi' ? 'Tổng yêu cầu hỗ trợ' : 'Total Tickets'}
          value={facilityTickets.length}
          icon={Icon.support}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={lang === 'vi' ? 'Yêu cầu mở mới' : 'Open Tickets'}
          value={openCount}
          delta={openCount > 0 ? (lang === 'vi' ? 'Chưa phản hồi' : 'Awaiting response') : undefined}
          deltaPositive={openCount === 0}
          icon={Icon.alert}
          iconBg={openCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={lang === 'vi' ? 'Sự cố khẩn cấp' : 'High Priority'}
          value={highPriorityCount}
          delta={highPriorityCount > 0 ? (lang === 'vi' ? 'Cần xử lý ngay' : 'Urgent attention') : undefined}
          deltaPositive={highPriorityCount === 0}
          icon={Icon.key}
          iconBg={highPriorityCount > 0 ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={lang === 'vi' ? 'Đã giải quyết xong' : 'Resolved'}
          value={resolvedCount}
          icon={Icon.check}
          iconBg="bg-emerald-50 text-emerald-700"
        />
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={
            lang === 'vi'
              ? ['Tất cả', 'Chờ xử lý', 'Đang xử lý', 'Khẩn cấp', 'Đã xong']
              : ['All', 'open', 'in-progress', 'high', 'resolved']
          }
          active={
            tab === 'All' && lang === 'vi' ? 'Tất cả' :
            tab === 'open' && lang === 'vi' ? 'Chờ xử lý' :
            tab === 'in-progress' && lang === 'vi' ? 'Đang xử lý' :
            tab === 'high' && lang === 'vi' ? 'Khẩn cấp' :
            tab === 'resolved' && lang === 'vi' ? 'Đã xong' : tab
          }
          onChange={val => {
            if (val === 'Tất cả') setTab('All')
            else if (val === 'Chờ xử lý') setTab('open')
            else if (val === 'Đang xử lý') setTab('in-progress')
            else if (val === 'Khẩn cấp') setTab('high')
            else if (val === 'Đã xong') setTab('resolved')
            else setTab(val)
          }}
        />
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder={lang === 'vi' ? 'Tìm theo mã, khách, tiêu đề, kho...' : 'Search ID, tenant, subject, unit...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>
      </div>

      {/* Tickets Table */}
      <Card className="overflow-hidden border border-stone-200/80 shadow-sm">
        <Table>
          <Thead>
            <tr>
              <Th>{lang === 'vi' ? 'Mã Yêu Cầu' : 'Ticket ID'}</Th>
              <Th>{lang === 'vi' ? 'Khách Hàng' : 'Customer'}</Th>
              <Th>{lang === 'vi' ? 'Chủ Đề & Phân Loại' : 'Subject & Category'}</Th>
              <Th>{lang === 'vi' ? 'Gian Kho' : 'Unit'}</Th>
              <Th>{lang === 'vi' ? 'Mức Độ' : 'Priority'}</Th>
              <Th>{lang === 'vi' ? 'Thời Gian Tạo' : 'Created'}</Th>
              <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
              <Th className="text-right">{lang === 'vi' ? 'Hành Động' : 'Action'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {lang === 'vi'
                    ? 'Không tìm thấy yêu cầu hỗ trợ nào theo bộ lọc.'
                    : 'No support tickets found.'}
                </td>
              </tr>
            ) : (
              filteredTickets.map(tkt => (
                <Tr
                  key={tkt.id}
                  className={
                    tkt.priority === 'high' && tkt.status !== 'resolved'
                      ? 'border-l-4 border-l-rose-500 bg-rose-50/20'
                      : undefined
                  }
                >
                  <Td>
                    <span className="font-mono text-xs font-bold text-stone-800">{tkt.id}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={tkt.customer} size="sm" />
                      <div>
                        <p className="font-medium text-sm text-stone-900">{tkt.customer}</p>
                        <p className="text-xs text-stone-400">{tkt.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="max-w-xs">
                      <p className="font-medium text-sm text-stone-900 truncate">{tkt.subject}</p>
                      <span className="inline-block mt-0.5 text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                        {tkt.category}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded text-xs">
                      {tkt.unit || 'N/A'}
                    </span>
                  </Td>
                  <Td>{getPriorityBadge(tkt.priority)}</Td>
                  <Td>
                    <span className="text-xs text-stone-500">{tkt.created}</span>
                  </Td>
                  <Td>{sb(tkt.status)}</Td>
                  <Td className="text-right">
                    <Button
                      variant={tkt.status === 'open' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedTicket(tkt)
                        setNewStatus(tkt.status === 'open' ? 'in-progress' : tkt.status)
                        setReplyText('')
                        setTicketModalOpen(true)
                      }}
                    >
                      {lang === 'vi' ? 'Xem & Phản hồi' : 'View & Reply'}
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>

      {/* Ticket Conversation & Response Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title={lang === 'vi' ? 'Chi Tiết Yêu Cầu & Phản Hồi Khách Hàng' : 'Support Ticket Conversation'}
      >
        {selectedTicket && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-slate-900 text-white shadow-inner">
              <div className="flex justify-between items-center text-xs font-mono text-amber-400">
                <span>{selectedTicket.id}</span>
                <span>{selectedTicket.category}</span>
              </div>
              <h3 className="text-base font-bold text-white mt-1.5">{selectedTicket.subject}</h3>
              <div className="mt-2 flex justify-between items-end text-xs text-slate-300">
                <div>
                  <p className="font-medium text-slate-200">
                    {selectedTicket.customer} ({selectedTicket.email})
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'vi' ? `Gian kho liên quan: ${selectedTicket.unit || 'Không xác định'}` : `Associated Unit: ${selectedTicket.unit || 'N/A'}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(selectedTicket.priority)}
                  {sb(selectedTicket.status)}
                </div>
              </div>
            </div>

            {/* Conversation Messages Thread */}
            <div className="space-y-3 max-h-72 overflow-y-auto p-3 bg-stone-50 rounded-xl border border-stone-200">
              {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                selectedTicket.messages.map((m, idx) => {
                  const isStaffOrManager = (m.role as string) !== 'customer'
                  return (
                    <div
                      key={m.id || idx}
                      className={`flex flex-col ${isStaffOrManager ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 text-[11px] text-stone-500">
                        <span className="font-semibold text-stone-800">{m.sender}</span>
                        <span className="text-stone-400">· {m.time}</span>
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs max-w-[85%] shadow-sm ${
                          isStaffOrManager
                            ? 'bg-amber-600 text-white rounded-tr-none'
                            : 'bg-white text-stone-900 border border-stone-200 rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-center py-6 text-xs text-stone-400">
                  {lang === 'vi' ? 'Chưa có trao đổi nào trong ticket này.' : 'No messages yet.'}
                </p>
              )}
            </div>

            {/* Reply Composer Box */}
            <div className="space-y-3 pt-2 border-t border-stone-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <label className="text-xs font-bold text-stone-800">
                  {lang === 'vi' ? 'Nội dung phản hồi từ Facility Manager:' : 'Manager Response Message:'}
                </label>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-stone-500">{lang === 'vi' ? 'Cập nhật trạng thái:' : 'Set Status:'}</span>
                  <div className="w-40">
                    <Select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as TicketItem['status'])}
                    >
                      <option value="in-progress">{lang === 'vi' ? 'Đang xử lý' : 'In Progress'}</option>
                      <option value="resolved">{lang === 'vi' ? 'Đã giải quyết' : 'Resolved'}</option>
                      <option value="open">{lang === 'vi' ? 'Mở lại ticket' : 'Open'}</option>
                    </Select>
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={
                  lang === 'vi'
                    ? 'Nhập giải đáp chi tiết cho khách hàng (ví dụ: Ban quản lý đã kiểm tra mã PIN và cấu hình lại chốt từ...)'
                    : 'Enter helpful response for the tenant...'
                }
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
              />

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setTicketModalOpen(false)}>
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                >
                  {lang === 'vi' ? 'Gửi phản hồi & Cập nhật' : 'Send Reply & Update'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
