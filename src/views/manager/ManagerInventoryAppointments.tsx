import { useEffect, useState } from 'react'
import { Button, Card, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { userFacingError } from '../../presentation/userFacingError'
import { listCheckIns } from '../../services/checkInApi'
import { formatManagerDateTime } from './managerList'

export default function ManagerInventoryAppointments({ onCountChange }: { onCountChange?: (count: number | null) => void } = {}) {
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<Awaited<ReturnType<typeof listCheckIns>>>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void listCheckIns({ group: 'ONGOING', status: 'setup_completed', page, pageSize: 20 })
      .then(value => { if (active) { setResult(value); onCountChange?.(value.pagination.totalItems) } })
      .catch(error => { if (active) { setError(userFacingError(error, 'Không tải được lịch kiểm kê.')); onCountChange?.(null) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, onCountChange])

  return <Card className="space-y-3 p-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold">Lịch kiểm kê đầu vào</h3>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Tải lại</Button>
    </div>
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p>
      : loading ? <p role="status" className="text-sm text-stone-600">Đang tải lịch kiểm kê…</p>
      : !result?.data.length ? <p className="text-sm text-stone-600">Chưa có hồ sơ chờ kiểm kê.</p>
      : <Table>
        <Thead><Tr><Th>Đơn đặt kho</Th><Th>Lịch hẹn</Th><Th>Mốc nhắc và hạn kiểm kê</Th><Th>Tiến độ</Th></Tr></Thead>
        <Tbody>{result.data.map(item => {
          const visit = item.inventoryVisit
          const pendingResult = item.inventoryResolutionStatus === 'PENDING_CUSTOMER'
            || item.inventoryResolutionStatus === 'PARTIAL_ACCEPTED'
            || item.inventoryResolutionStatus === 'RETURN_REQUESTED'
          const expired = Boolean(item.inventoryFinalDeadlineAt && Date.parse(item.inventoryFinalDeadlineAt) <= Date.now())
          const state = pendingResult ? 'Đang xử lý kết quả'
            : expired ? 'Đã quá hạn' : visit?.identityVerifiedAt ? 'Đã xác minh, chờ kiểm kê'
              : visit?.arrivedAt ? 'Khách đã đến, chờ xác minh' : visit?.appointmentAt ? 'Đã đặt lịch' : 'Chờ khách chọn lịch'
          return <Tr key={item.reservationId}>
            <Td><strong>{item.reservationCode}</strong><p>{item.customerName}</p>
              {item.setupCompletedAt && <p className="text-xs text-stone-600">Báo chuẩn bị xong {formatManagerDateTime(item.setupCompletedAt)}</p>}</Td>
            <Td>{visit?.appointmentAt ? formatManagerDateTime(visit.appointmentAt) : 'Chưa đặt lịch'}</Td>
            <Td>{item.inventoryDueAt && <p>Nhắc {formatManagerDateTime(item.inventoryDueAt)}</p>}
              {item.inventoryFinalDeadlineAt && <p>Hạn {formatManagerDateTime(item.inventoryFinalDeadlineAt)}</p>}</Td>
            <Td><strong>{state}</strong>
              {visit?.arrivedAt && <p>Đến {formatManagerDateTime(visit.arrivedAt)}</p>}
              {visit?.identityVerifiedAt && <p>Xác minh {formatManagerDateTime(visit.identityVerifiedAt)}{visit.verifiedByName ? ` · ${visit.verifiedByName}` : ''}</p>}
            </Td>
          </Tr>
        })}</Tbody>
      </Table>}
    {result && result.pagination.totalPages > 1 && <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</Button>
      <Button size="sm" variant="outline" disabled={loading || page + 1 >= result.pagination.totalPages}
        onClick={() => setPage(value => value + 1)}>Trang sau</Button>
    </div>}
  </Card>
}
