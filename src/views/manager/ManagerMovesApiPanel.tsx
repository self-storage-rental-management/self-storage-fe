import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { listCheckIns, type CheckInCase } from '../../services/checkInApi'
import { listReturns, type ApiReturn } from '../../services/returnApi'
import { managerStatusLabel } from './managerI18n'
import ManagerAccessCredentialsPanel from './ManagerAccessCredentialsPanel'

type Tab = 'checkins' | 'returns' | 'credentials'

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

function dateOnly(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '—'
}

function statusVariant(status: string | null | undefined) {
  if (['completed', 'setup_completed', 'inspected'].includes(status || '')) return 'success'
  if (['rejected', 'cancelled', 'disputed', 'payment_due'].includes(status || '')) return 'error'
  if (['setup_in_progress', 'awaiting_customer_confirmation', 'refund_pending'].includes(status || '')) return 'warning'
  return 'info'
}

function statusBadge(status: string | null | undefined) {
  return <Badge variant={statusVariant(status)}>{managerStatusLabel(status || '—', 'vi')}</Badge>
}

export default function ManagerMovesApiPanel({ facilityId }: { facilityId?: string }) {
  const [tab, setTab] = useState<Tab>('checkins')
  const [checkIns, setCheckIns] = useState<CheckInCase[]>([])
  const [returns, setReturns] = useState<ApiReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [checkInPage, returnPage] = await Promise.all([
        listCheckIns({ page: 0, pageSize: 100 }),
        listReturns('manager', 0, 100),
      ])
      setCheckIns(checkInPage.data)
      setReturns(returnPage.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu nhận/trả kho từ Backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return <div className="space-y-5">
    <SectionHeader
      title="Nhận kho & Trả kho"
      subtitle="Dữ liệu lấy trực tiếp từ Backend. Manager chỉ theo dõi và giám sát; Staff thực hiện nghiệp vụ tại hiện trường."
      action={<Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>Làm mới</Button>}
    />

    <div className="flex flex-wrap gap-2 border-b border-stone-200">
      <Button variant={tab === 'checkins' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('checkins')}>Nhận kho</Button>
      <Button variant={tab === 'returns' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('returns')}>Trả kho</Button>
      <Button variant={tab === 'credentials' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('credentials')}>Quyền truy cập</Button>
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

    {tab === 'credentials' ? <ManagerAccessCredentialsPanel facilityId={facilityId} /> : tab === 'checkins' ? (
      <Card>
        <Table>
          <Thead><Tr><Th>Khách hàng / Đơn</Th><Th>Gian kho</Th><Th>Trạng thái</Th><Th>Setup</Th><Th>Kiểm kê</Th><Th>Check-in</Th></Tr></Thead>
          <Tbody>
            {!loading && !checkIns.length && <Tr><Td colSpan={6} className="py-8 text-center text-stone-500">Chưa có hồ sơ nhận kho từ Backend.</Td></Tr>}
            {checkIns.map(item => <Tr key={item.checkInId || item.reservationId}>
              <Td><b>{item.customerName}</b><p className="text-xs font-mono text-stone-500">{item.reservationCode}</p></Td>
              <Td><b className="font-mono">{item.storageUnitCode}</b><p className="text-xs text-stone-500">{item.facilityName}</p></Td>
              <Td>{statusBadge(item.checkInStatus)}</Td>
              <Td><p>{item.freeSetupDays} ngày</p><p className="text-xs text-stone-500">Hết: {dateTime(item.setupDueAt)}</p></Td>
              <Td>{item.inventoryPending ? <><Badge variant="warning">Chưa kiểm kê</Badge><p className="mt-1 text-xs text-stone-500">Hạn: {dateTime(item.inventoryDueAt)}</p></> : dateTime(item.inventoryVerifiedAt)}</Td>
              <Td><p>{dateTime(item.checkedInAt)}</p><p className="text-xs text-stone-500">Thu tiền: {dateTime(item.paymentCollectedAt)}</p></Td>
            </Tr>)}
          </Tbody>
        </Table>
      </Card>
    ) : (
      <Card>
        <Table>
          <Thead><Tr><Th>Khách hàng / Hợp đồng</Th><Th>Gian kho</Th><Th>Ngày trả</Th><Th>Trạng thái</Th><Th>Quyết toán</Th><Th>Ghi nhận</Th></Tr></Thead>
          <Tbody>
            {!loading && !returns.length && <Tr><Td colSpan={6} className="py-8 text-center text-stone-500">Chưa có hồ sơ trả kho từ Backend.</Td></Tr>}
            {returns.map(item => <Tr key={item.id}>
              <Td><b>{item.customerName}</b><p className="text-xs font-mono text-stone-500">{item.rentalId}</p></Td>
              <Td className="font-mono">{item.unitNumber}</Td>
              <Td>{dateOnly(item.scheduledDate)}</Td>
              <Td>{statusBadge(item.status)}</Td>
              <Td>{item.netRefundAmount != null ? <p>Hoàn: {item.netRefundAmount.toLocaleString('vi-VN')} đ</p> : <p>Thu thêm: {(item.amountDueFromCustomer ?? 0).toLocaleString('vi-VN')} đ</p>}<p className="text-xs text-stone-500">Khấu trừ: {item.totalDeductions.toLocaleString('vi-VN')} đ</p></Td>
              <Td>{item.inspectedAt ? dateTime(item.inspectedAt) : 'Chưa nghiệm thu'}</Td>
            </Tr>)}
          </Tbody>
        </Table>
      </Card>
    )}
  </div>
}
