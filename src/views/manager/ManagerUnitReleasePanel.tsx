import { managerDisplayError } from './managerPresentation'
import { useEffect, useState } from 'react'
import { managerDisplayText } from './managerPresentation'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import {
  listUnitReleaseCases,
  releaseAssignedUnit,
  type UnitReleaseCase,
  type UnitReleaseDisposition,
} from '../../services/unitReleaseApi'

const blockerLabels: Record<string, string> = {
  RESERVATION_NOT_CANCELLED: "đặt chỗ chưa hủy",
  ACTIVE_ASSIGNMENT_NOT_FOUND: "Không còn phân gian hiện hành",
  CHECKIN_ALREADY_COMPLETED: 'Nhận kho đã hoàn tất',
  ACTIVE_RENTAL_EXISTS: "Đang có hồ sơ thuê hoạt động",
  UNIT_ASSIGNMENT_MISMATCH: 'Thông tin phân gian không khớp với gian kho',
  UNIT_STATE_NOT_RELEASABLE: 'Trạng thái gian kho không cho phép giải phóng',
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `unit-release-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function ManagerUnitReleasePanel({ showToast }: { showToast: (message: string) => void }) {
  const [items, setItems] = useState<UnitReleaseCase[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected, setSelected] = useState<UnitReleaseCase | null>(null)
  const [disposition, setDisposition] = useState<UnitReleaseDisposition>('AVAILABLE')
  const [reason, setReason] = useState("đặt chỗ đã hủy trước nhận kho")
  const [submitting, setSubmitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void listUnitReleaseCases({ page, pageSize: 20, q: query, blocked: false })
      .then(response => {
        if (!active) return
        setItems(response.data)
        setTotalItems(response.pagination.totalItems)
        setTotalPages(response.pagination.totalPages)
      })
      .catch(reasonValue => {
        if (!active) return
        setError(managerDisplayError(reasonValue))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page, query, refreshKey])

  const openRelease = (item: UnitReleaseCase) => {
    setSelected(item)
    setDisposition('AVAILABLE')
    setReason("đặt chỗ đã hủy trước nhận kho")
    setIdempotencyKey(createIdempotencyKey())
  }

  const closeRelease = () => {
    if (submitting) return
    setSelected(null)
    setIdempotencyKey('')
  }

  const submitRelease = async () => {
    if (!selected || !reason.trim() || !idempotencyKey) return
    setSubmitting(true)
    try {
      const result = await releaseAssignedUnit(
        selected.reservationId,
        {
          assignmentId: selected.assignment.assignmentId,
          disposition,
          reason: reason.trim(),
        },
        idempotencyKey,
      )
      showToast(
        result.storageUnitStatus === 'maintenance'
          ? `Đã hủy phân gian và chuyển ${result.storageUnitCode} sang chờ bảo trì.`
          : `Đã hủy phân gian và trả ${result.storageUnitCode} về trạng thái sẵn sàng.`,
      )
      setSelected(null)
      setRefreshKey(value => value + 1)
    } catch (reasonValue) {
      showToast(managerDisplayError(reasonValue))
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="space-y-5">
    <SectionHeader
      eyebrow="Quản lý gian kho"
      title="Giải phóng kho của đặt chỗ đã hủy"
      subtitle="Kiểm tra hồ sơ nhận kho và thuê kho trước khi giải phóng gian đã phân."

    />

    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label="Tìm đặt chỗ hoặc gian kho"
            value={queryInput}
            onChange={event => setQueryInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                setPage(0)
                setQuery(queryInput.trim())
              }
            }}
            placeholder="Mã đặt chỗ, khách hàng hoặc mã gian kho"
          />
        </div>
        <Button onClick={() => { setPage(0); setQuery(queryInput.trim()) }}>Tìm kiếm</Button>
      </div>
    </Card>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {loading && <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải dữ liệu từ hệ thống…</div>}

    <Card>
      <Table>
        <Thead><tr><Th>đặt chỗ</Th><Th>Gian kho</Th><Th>Cơ sở</Th><Th>Thời điểm hủy</Th><Th>Điều kiện</Th><Th className="text-right">Thao tác</Th></tr></Thead>
        <Tbody>
          {items.map(item => <Tr key={item.assignment.assignmentId}>
            <Td><p className="font-semibold text-stone-900">{item.reservationCode}</p><p className="mt-1 text-xs text-stone-500">{item.cancelReason || 'Không có lý do'}</p></Td>
            <Td><p className="font-semibold">{item.assignment.storageUnitCode}</p><Badge variant="purple">{managerDisplayText(item.assignment.storageUnitStatus)}</Badge></Td>
            <Td>{item.facilityName}</Td>
            <Td className="text-xs">{formatDateTime(item.cancelledAt)}</Td>
            <Td>{item.eligibility.releasable
              ? <Badge variant="success">Có thể giải phóng</Badge>
              : <div className="space-y-1">{item.eligibility.blockingReasons.map(blocker => <p key={blocker} className="text-xs text-red-700">{blockerLabels[blocker] || 'Chưa đủ điều kiện giải phóng gian kho'}</p>)}</div>}
            </Td>
            <Td className="text-right"><Button size="sm" disabled={!item.eligibility.releasable} onClick={() => openRelease(item)}>Xử lý</Button></Td>
          </Tr>)}
          {!loading && !items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">Không có đặt chỗ đã hủy đang chờ giải phóng kho.</td></tr>}
        </Tbody>
      </Table>
      {totalPages > 1 && <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4 text-sm text-stone-500">
        <span>{totalItems} hồ sơ · Trang {page + 1}/{totalPages}</span>
        <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))}>Trước</Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Sau</Button>
      </div>}
    </Card>

    <Modal open={Boolean(selected)} onClose={closeRelease} title="Xử lý kho sau khi đặt chỗ bị hủy">
      {selected && <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <p><b>đặt chỗ:</b> {selected.reservationCode}</p>
          <p><b>Gian kho:</b> {selected.assignment.storageUnitCode}</p>
          <p><b>Mã phân gian:</b> {selected.assignment.assignmentId}</p>
        </div>
        <Select label="Trạng thái đích" value={disposition} onChange={event => setDisposition(event.target.value as UnitReleaseDisposition)}>
          <option value="AVAILABLE">Còn trống - Không cần xử lý thêm</option>
          <option value="MAINTENANCE">Đang bảo trì - Cần kiểm tra, vệ sinh hoặc sửa chữa</option>
        </Select>
        <Input label="Lý do" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} />
        {disposition === "MAINTENANCE" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Gian kho sẽ chuyển sang trạng thái đang bảo trì. Công việc kiểm tra, vệ sinh hoặc sửa chữa được xử lý riêng tại mục bảo trì.</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={closeRelease}>Đóng</Button>
          <Button disabled={submitting || !reason.trim()} onClick={() => void submitRelease()}>{submitting ? 'Đang xử lý…' : 'Xác nhận giải phóng'}</Button>
        </div>
      </div>}
    </Modal>
  </div>
}
