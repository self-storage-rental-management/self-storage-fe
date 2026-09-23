import React, { useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Select, Avatar, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { TicketItem } from '../../data/demoDatabase'
import { isFacilityVisible } from '../../domain/managerRules'

interface ManagerSupportPanelProps {
  user: User
  showToast: (msg: string) => void
  sb: (v: string) => React.ReactNode
}

export default function ManagerSupportPanel({ user, showToast, sb }: ManagerSupportPanelProps) {
    const { tickets: storeTickets, respondSupportTicket } = useStorageHub()

  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [newStatus, setNewStatus] = useState<TicketItem['status']>('in-progress')

  // Filter tickets by facility
  const facilityTickets = storeTickets.filter(t => isFacilityVisible(user, t.facilityId, t.facility))

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
    if (p === 'high') return <Badge variant="error">{'Khẩn cấp'}</Badge>
    if (p === 'medium') return <Badge variant="warning">{'Trung bình'}</Badge>
    return <Badge variant="info">{'Bình thường'}</Badge>
  }

  const handleSendReply = () => {
    if (!selectedTicket) return
    if (!replyText.trim()) {
      showToast('Vui lòng nhập nội dung phản hồi.')
      return
    }

    try {
      respondSupportTicket(selectedTicket.id, replyText.trim(), newStatus, user)
      showToast(
        `Đã gửi phản hồi hỗ trợ cho ${selectedTicket.customer}!`
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
        title={'Hỗ Trợ Khách Hàng & Xử Lý Sự Cố Kho'}
        subtitle={
          'Tiếp nhận yêu cầu kỹ thuật, giải đáp thắc mắc mã khóa cổng và xử lý khiếu nại chất lượng dịch vụ'
        }
      />

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={'Tổng yêu cầu hỗ trợ'}
          value={facilityTickets.length}
          icon={Icon.support}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={'Yêu cầu mở mới'}
          value={openCount}
          delta={openCount > 0 ? ('Chưa phản hồi') : undefined}
          deltaPositive={openCount === 0}
          icon={Icon.alert}
          iconBg={openCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={'Sự cố khẩn cấp'}
          value={highPriorityCount}
          delta={highPriorityCount > 0 ? ('Cần xử lý ngay') : undefined}
          deltaPositive={highPriorityCount === 0}
          icon={Icon.key}
          iconBg={highPriorityCount > 0 ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={'Đã giải quyết xong'}
          value={resolvedCount}
          icon={Icon.check}
          iconBg="bg-emerald-50 text-emerald-700"
        />
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={
            ['Tất cả', 'Chờ xử lý', 'Đang xử lý', 'Khẩn cấp', 'Đã xong']
          }
          active={
            tab === 'All' ? 'Tất cả' :
            tab === 'open' ? 'Chờ xử lý' :
            tab === 'in-progress' ? 'Đang xử lý' :
            tab === 'high' ? 'Khẩn cấp' :
            tab === 'resolved' ? 'Đã xong' : tab
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
            placeholder={'Tìm theo mã, khách, tiêu đề, kho...'}
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
              <Th>{'Mã Yêu Cầu'}</Th>
              <Th>{'Khách Hàng'}</Th>
              <Th>{'Chủ Đề & Phân Loại'}</Th>
              <Th>{'Gian Kho'}</Th>
              <Th>{'Mức Độ'}</Th>
              <Th>{'Thời Gian Tạo'}</Th>
              <Th>{'Trạng Thái'}</Th>
              <Th className="text-right">{'Hành Động'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {'Không tìm thấy yêu cầu hỗ trợ nào theo bộ lọc.'}
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
                      {'Xem & Phản hồi'}
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
        title={'Chi Tiết Yêu Cầu & Phản Hồi Khách Hàng'}
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
                    {`Gian kho liên quan: ${selectedTicket.unit || 'Không xác định'}`}
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
                  {'Chưa có trao đổi nào trong ticket này.'}
                </p>
              )}
            </div>

            {/* Reply Composer Box */}
            <div className="space-y-3 pt-2 border-t border-stone-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <label className="text-xs font-bold text-stone-800">
                  {'Nội dung phản hồi từ quản lý cơ sở:'}
                </label>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-stone-500">{'Cập nhật trạng thái:'}</span>
                  <div className="w-40">
                    <Select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as TicketItem['status'])}
                    >
                      <option value="in-progress">{'Đang xử lý'}</option>
                      <option value="resolved">{'Đã giải quyết'}</option>
                      <option value="open">{'Mở lại ticket'}</option>
                    </Select>
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={
                  'Nhập giải đáp chi tiết cho khách hàng (ví dụ: Ban quản lý đã kiểm tra mã PIN và cấu hình lại chốt từ...)'
                }
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
              />

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setTicketModalOpen(false)}>
                  {'Đóng'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                >
                  {'Gửi phản hồi & Cập nhật'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
