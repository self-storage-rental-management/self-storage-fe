import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SectionHeader,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import {
  getUnitReleaseCase,
  listUnitReleaseCases,
  releaseAssignedUnit,
  type UnitReleaseCase,
  type UnitReleaseDisposition,
} from '../../services/unitReleaseApi'
import { formatStaffDateTime, staffErrorMessage, staffStorageUnitStatusLabel } from './staffPresentation'

export default function StaffUnitReleasePanel({ showToast }: { showToast: (message: string) => void }) {
  const [cases, setCases] = useState<UnitReleaseCase[]>([])
  const [blockedFilter, setBlockedFilter] = useState<'ready' | 'blocked'>('ready')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<UnitReleaseCase | null>(null)
  const [disposition, setDisposition] = useState<UnitReleaseDisposition>('AVAILABLE')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    void listUnitReleaseCases({
      page: 0,
      pageSize: 50,
      blocked: blockedFilter === 'blocked',
      q: query.trim() || undefined,
    })
      .then((response) => setCases(response.data))
      .catch((err) => setError(staffErrorMessage(err, 'Không thể tải danh sách giải phóng kho từ đơn đã hủy.')))
      .finally(() => setLoading(false))
  }, [blockedFilter, query])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openCase = async (item: UnitReleaseCase) => {
    setError(null)
    setDisposition('AVAILABLE')
    setReason('')
    try {
      const detail = await getUnitReleaseCase(item.reservationId)
      setSelected(detail)
    } catch {
      setSelected(item)
    }
  }

  const submitRelease = async () => {
    if (!selected || !reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await releaseAssignedUnit(
        selected.reservationId,
        {
          assignmentId: selected.assignment.assignmentId,
          disposition,
          reason: reason.trim(),
        },
        crypto.randomUUID(),
      )
      showToast(`Đã giải phóng kho ${result.storageUnitCode} (${staffStorageUnitStatusLabel(result.storageUnitStatus)}).`)
      setSelected(null)
      refresh()
    } catch (err) {
      setError(staffErrorMessage(err, 'Không thể giải phóng đơn vị kho này.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        eyebrow="CỔNG NHÂN VIÊN · GIẢI PHÓNG KHO HỦY"
        title="Giải phóng kho từ đơn đã hủy"
        subtitle="Kiểm tra và đưa các ô kho còn giữ gán từ đơn đặt kho đã hủy về trạng thái Sẵn sàng hoặc Bảo trì."
        action={<Button variant="outline" size="sm" onClick={refresh} disabled={loading}>Làm mới</Button>}
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Tìm kiếm mã đơn / mã kho"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ví dụ: RSV-... hoặc A-101"
          />
          <Select
            label="Phân loại"
            value={blockedFilter}
            onChange={(event) => setBlockedFilter(event.target.value === 'blocked' ? 'blocked' : 'ready')}
          >
            <option value="ready">Đủ điều kiện giải phóng</option>
            <option value="blocked">Đang bị chặn</option>
          </Select>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Mã đơn</Th>
              <Th>Cơ sở & Ô kho</Th>
              <Th>Hủy lúc</Th>
              <Th>Điều kiện giải phóng</Th>
              <Th className="text-right">Thao tác</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={5} className="text-center text-sm text-stone-500 py-8">
                  Đang tải danh sách đơn đã hủy còn gán kho…
                </Td>
              </Tr>
            )}
            {!loading && cases.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-center text-sm text-stone-500 py-8">
                  {blockedFilter === 'ready'
                    ? 'Không có ô kho nào từ đơn đã hủy cần giải phóng.'
                    : 'Không có trường hợp nào đang bị chặn giải phóng.'}
                </Td>
              </Tr>
            )}
            {!loading && cases.map((item) => (
              <Tr key={item.reservationId}>
                <Td>
                  <p className="font-mono font-bold text-stone-900">{item.reservationCode}</p>
                  <p className="text-xs text-stone-500">{item.cancelReason || 'Không có lý do hủy'}</p>
                </Td>
                <Td>
                  <p className="font-semibold text-stone-900">{item.assignment.storageUnitCode}</p>
                  <p className="text-xs text-stone-500">
                    {item.facilityName} · {staffStorageUnitStatusLabel(item.assignment.storageUnitStatus)}
                  </p>
                </Td>
                <Td className="text-xs text-stone-600">
                  {item.cancelledAt ? formatStaffDateTime(item.cancelledAt) : '—'}
                </Td>
                <Td>
                  {item.eligibility.releasable ? (
                    <Badge variant="success">Sẵn sàng giải phóng</Badge>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="warning">Đang bị chặn</Badge>
                      {item.eligibility.blockingReasons.slice(0, 2).map((msg, idx) => (
                        <p key={idx} className="text-xs text-amber-800">{msg}</p>
                      ))}
                    </div>
                  )}
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant={item.eligibility.releasable ? 'primary' : 'outline'}
                    onClick={() => void openCase(item)}
                  >
                    {item.eligibility.releasable ? 'Giải phóng kho' : 'Xem chi tiết'}
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      {selected && (
        <Modal
          open
          title={`Giải phóng kho ${selected.assignment.storageUnitCode} · ${selected.reservationCode}`}
          onClose={() => !submitting && setSelected(null)}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm space-y-1">
              <p><b>Cơ sở:</b> {selected.facilityName}</p>
              <p><b>Trạng thái ô kho hiện tại:</b> {staffStorageUnitStatusLabel(selected.assignment.storageUnitStatus)}</p>
              <p><b>Thời điểm gán kho:</b> {formatStaffDateTime(selected.assignment.assignedAt)}</p>
              {selected.cancelReason && <p><b>Lý do hủy đơn:</b> {selected.cancelReason}</p>}
            </div>

            {!selected.eligibility.releasable ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
                <p className="font-semibold">Không thể giải phóng lúc này:</p>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {selected.eligibility.blockingReasons.map((msg, idx) => <li key={idx}>{msg}</li>)}
                </ul>
              </div>
            ) : (
              <>
                <Select
                  label="Trạng thái sau khi giải phóng *"
                  value={disposition}
                  onChange={(event) => setDisposition(event.target.value as UnitReleaseDisposition)}
                >
                  <option value="AVAILABLE">Đưa về Sẵn sàng (AVAILABLE)</option>
                  <option value="MAINTENANCE">Chuyển sang Bảo trì (MAINTENANCE)</option>
                </Select>
                <Input
                  label="Lý do / ghi chú bàn giao lại kho *"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: Đơn hủy trước nhận kho, kho sạch và khóa an toàn."
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>
                Đóng
              </Button>
              {selected.eligibility.releasable && (
                <Button onClick={() => void submitRelease()} disabled={submitting || !reason.trim()}>
                  {submitting ? 'Đang xử lý…' : 'Xác nhận giải phóng kho'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
