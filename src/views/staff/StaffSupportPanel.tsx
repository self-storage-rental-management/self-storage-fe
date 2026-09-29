import { useState } from "react"
import {
  Badge,
  Button,
  Card,
  Modal,
  SectionHeader,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "../../components/ui"
import type { User } from "../../types"
import type { TicketItem } from "../../data/demoDatabase"
import StaffPagination, { paginateStaffItems } from "./StaffPagination"

interface Props {
  user: User
  tickets: TicketItem[]
  respondSupportTicket: (
    ticketId: string,
    replyText: string,
    status: TicketItem["status"],
    staffUser: User,
  ) => void
  canManageSupport: boolean
  showToast: (message: string) => void
}

const statusLabel: Record<TicketItem["status"], string> = {
  open: "Chờ xử lý",
  "in-progress": "Đang xử lý",
  resolved: "Đã giải quyết",
}
const priorityLabel: Record<TicketItem["priority"], string> = {
  high: "Khẩn cấp",
  medium: "Trung bình",
  low: "Thông thường",
}
const formatTicketTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN")
}

export default function StaffSupportPanel({
  user,
  tickets,
  respondSupportTicket,
  canManageSupport,
  showToast,
}: Props) {
  const [selected, setSelected] = useState<TicketItem | null>(null)
  const [reply, setReply] = useState("")
  const [nextStatus, setNextStatus] =
    useState<TicketItem["status"]>("in-progress")
  const [page, setPage] = useState(1)
  const sortedTickets = [...tickets].sort(
    (left, right) =>
      new Date(right.updatedAt || right.created).getTime() -
      new Date(left.updatedAt || left.created).getTime(),
  )
  const pagination = paginateStaffItems(sortedTickets, page)

  const openTicket = (ticket: TicketItem) => {
    setSelected(ticket)
    setReply("")
    setNextStatus(ticket.status === "resolved" ? "resolved" : "in-progress")
  }

  const send = () => {
    if (!selected || !reply.trim()) return
    try {
      respondSupportTicket(selected.id, reply, nextStatus, user)
      setSelected(null)
      setReply("")
      showToast("Đã gửi phản hồi và đồng bộ trạng thái với cổng khách hàng.")
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể gửi phản hồi.",
      )
    }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        title="Hỗ trợ khách hàng"
        subtitle="Nội dung khách hàng gửi và phản hồi của nhân viên được đồng bộ trực tiếp giữa hai cổng."
      />
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Mã phiếu</Th>
              <Th>Khách hàng</Th>
              <Th>Tiêu đề</Th>
              <Th>Cơ sở / gian kho</Th>
              <Th>Ưu tiên</Th>
              <Th>Trạng thái</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {pagination.items.map((item) => (
              <Tr key={item.id}>
                <Td className="font-mono">{item.id}</Td>
                <Td>
                  <b>{item.customer}</b>
                  <br />
                  <span className="text-xs text-stone-500">{item.email}</span>
                </Td>
                <Td>
                  <b>{item.subject}</b>
                  <br />
                  <span className="text-xs text-stone-500">
                    {item.category}
                  </span>
                </Td>
                <Td>
                  {item.facility}
                  {item.unit && (
                    <span className="block text-xs text-stone-500">
                      Gian kho {item.unit}
                    </span>
                  )}
                </Td>
                <Td>
                  <Badge variant={item.priority === "high" ? "error" : "info"}>
                    {priorityLabel[item.priority]}
                  </Badge>
                </Td>
                <Td>{statusLabel[item.status]}</Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openTicket(item)}
                  >
                    {item.status === "resolved"
                      ? "Xem trao đổi"
                      : "Xem và phản hồi"}
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {!tickets.length && (
          <div className="p-10 text-center text-sm text-stone-500">
            Không có phiếu hỗ trợ tại cơ sở được phân quyền.
          </div>
        )}
        <StaffPagination
          {...pagination}
          total={tickets.length}
          onPageChange={setPage}
        />
      </Card>

      <Modal
        closeLabel="Đóng hộp thoại"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="xl"
        title={
          selected ? `${selected.id} · ${selected.subject}` : "Phiếu hỗ trợ"
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg bg-stone-50 p-3 text-sm sm:grid-cols-2">
              <p>
                <b>Khách hàng:</b> {selected.customer}
              </p>
              <p>
                <b>Thư điện tử:</b> {selected.email}
              </p>
              <p>
                <b>Cơ sở:</b> {selected.facility}
              </p>
              <p>
                <b>Gian kho:</b> {selected.unit || "Không áp dụng"}
              </p>
              <p>
                <b>Danh mục:</b> {selected.category}
              </p>
              <p>
                <b>Thời điểm gửi:</b> {formatTicketTime(selected.created)}
              </p>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-stone-200 p-3">
              {selected.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg p-3 text-sm ${
                    message.role === "customer"
                      ? "mr-8 bg-blue-50 text-blue-950"
                      : message.role === "staff"
                        ? "ml-8 bg-emerald-50 text-emerald-950"
                        : "bg-stone-100 text-stone-700"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs">
                    <b>
                      {message.role === "customer"
                        ? `Khách hàng · ${message.sender}`
                        : message.role === "staff"
                          ? `Nhân viên · ${message.sender}`
                          : "Hệ thống"}
                    </b>
                    <span>{formatTicketTime(message.time)}</span>
                  </div>
                  <p className="whitespace-pre-line">{message.text}</p>
                </div>
              ))}
            </div>
            {selected.status !== "resolved" && canManageSupport && (
              <>
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="staff-support-reply"
                  >
                    Nội dung phản hồi
                  </label>
                  <textarea
                    id="staff-support-reply"
                    rows={4}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Nhập hướng dẫn hoặc kết quả xử lý gửi cho khách hàng…"
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <Select
                  label="Trạng thái sau khi gửi"
                  value={nextStatus}
                  onChange={(event) =>
                    setNextStatus(event.target.value as TicketItem["status"])
                  }
                >
                  <option value="in-progress">Đang xử lý</option>
                  <option value="resolved">Đã giải quyết</option>
                </Select>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Đóng
              </Button>
              {selected.status !== "resolved" && canManageSupport && (
                <Button disabled={!reply.trim()} onClick={send}>
                  Gửi phản hồi
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
