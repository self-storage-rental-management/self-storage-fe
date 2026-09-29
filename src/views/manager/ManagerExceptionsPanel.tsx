import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import { isManagerFacilityVisible, isManagerRentalOverdue } from '../../domain/managerRules'
import { managerStatusLabel } from './managerI18n'

type ExceptionKind = 'return' | 'checkin' | 'reservation' | 'maintenance' | 'payment'

interface ExceptionItem {
  id: string
  kind: ExceptionKind
  title: string
  subject: string
  reason: string
  status: string
  date: string
  evidenceCount: number
  destination: 'move-ins' | 'move-outs' | 'inventory' | 'payments'
}

const kindLabels: Record<ExceptionKind, string> = {
  return: 'Trả kho',
  checkin: 'Nhận kho',
  reservation: 'Đặt chỗ',
  maintenance: 'Bảo trì',
  payment: 'Công nợ'
}

const exceptionReasonLabels: Record<string, string> = {
  OVERSIZED_DIM: 'Kích thước hàng vượt chuẩn',
  OVERWEIGHT_LIMIT: 'Khối lượng hàng vượt giới hạn',
  RESTRICTED_ITEMS: 'Có hàng hóa cần kiểm tra hạn chế',
  SPECIAL_REQUEST: 'Có yêu cầu đặc biệt',
  NEAR_CAPACITY: 'Dung lượng gần giới hạn',
  OTHER: 'Ngoại lệ khác'
}

const damageLabels: Record<string, string> = {
  minor_damage: 'Hư hỏng nhẹ',
  major_damage: 'Hư hỏng nghiêm trọng',
  abandoned_goods: 'Có hàng hóa bị bỏ lại'
}

const inventoryLabels: Record<string, string> = { missing: 'Thiếu hàng hóa', excess: 'Thừa hàng hóa' }

const formatDateTime = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN')
}

export default function ManagerExceptionsPanel({ user, onOpen }: { user: User; onOpen: (destination: ExceptionItem['destination']) => void }) {
  const hub = useStorageHub()
  const [kind, setKind] = useState<'all' | ExceptionKind>('all')
  const [query, setQuery] = useState('')

  const exceptions = useMemo<ExceptionItem[]>(() => {
    const holds = hub.holds.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName))
    const rentals = hub.rentals.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName))
    const rentalIds = new Set(rentals.map(item => item.id))
    const unitIds = new Set(hub.units.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName)).flatMap(item => [item.id, item.code]))
    const items: ExceptionItem[] = []

    hub.returns
      .filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName) && item.status !== 'completed')
      .forEach(item => {
        const reasons = [
          item.status === 'disputed' ? `Khách hàng không đồng ý quyết toán${item.customerDecisionNote ? `: ${item.customerDecisionNote}` : ''}` : '',
          item.status === 'payment_due' ? 'Tiền đảm bảo không đủ, còn khoản khách hàng phải thanh toán' : '',
          item.damageClassification && item.damageClassification !== 'no_damage' ? damageLabels[item.damageClassification] || item.damageClassification : '',
          item.inventoryMatch && item.inventoryMatch !== 'match' ? inventoryLabels[item.inventoryMatch] || item.inventoryMatch : ''
        ].filter(Boolean)
        if (!reasons.length) return
        items.push({ id: item.id, kind: 'return', title: `Hồ sơ trả kho ${item.id}`, subject: `${item.customerName} · ${item.unitId}`, reason: reasons.join(' · '), status: item.status, date: item.customerConfirmedAt || item.inspectedAt || item.requestedAt, evidenceCount: item.evidence.length, destination: 'move-outs' })
      })

    hub.checkins
      .filter(item => unitIds.has(item.unitId) && item.status === 'completed' && !item.actualMeasurements.varianceAccepted)
      .forEach(item => items.push({ id: item.id, kind: 'checkin', title: `Biên bản nhận kho ${item.id}`, subject: `${item.customerName} · ${item.unitId}`, reason: item.actualMeasurements.varianceNotes || 'Sai lệch đo đạc chưa được xác nhận chấp nhận', status: item.status, date: item.completedAt || item.scheduledDate, evidenceCount: item.evidencePhotos.length, destination: 'move-ins' }))

    holds
      .filter(item => !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(item.status) && (item.exceptionReason || ['PENDING', 'REJECTED'].includes(item.goodsReviewStatus || '')))
      .forEach(item => {
        const reasons = [
          item.exceptionReason ? exceptionReasonLabels[item.exceptionReason] || item.exceptionReason : '',
          item.goodsReviewStatus === 'PENDING' ? 'Hàng hóa đang chờ Staff kiểm tra' : '',
          item.goodsReviewStatus === 'REJECTED' ? 'Hàng hóa đã bị Staff từ chối' : '',
          item.exceptionDetails || ''
        ].filter(Boolean)
        const goodsImages = item.goods.items?.flatMap(goodsItem => goodsItem.images || []) || []
        items.push({ id: item.id, kind: 'reservation', title: `Đặt chỗ ${item.id}`, subject: `${item.customerName} · ${item.unitTypeName}`, reason: reasons.join(' · '), status: item.status, date: item.goodsReviewSubmittedAt || item.createdAt, evidenceCount: item.evidence.length + goodsImages.length, destination: 'move-ins' })
      })

    const facilityReturns = hub.returns.filter(item => isManagerFacilityVisible(user, item.facilityId, item.facilityName))
    hub.maintenanceTasks
      .filter(item => item.status !== 'completed' && isManagerFacilityVisible(user, item.facilityId))
      .forEach(item => items.push({ id: item.id, kind: 'maintenance', title: `Bảo trì ${item.id}`, subject: item.unitId, reason: item.reason, status: item.status, date: item.createdAt, evidenceCount: facilityReturns.filter(returnCase => returnCase.unitId === item.unitId).flatMap(returnCase => returnCase.evidence).length, destination: 'inventory' }))

    rentals
      .filter(item => isManagerRentalOverdue(item))
      .forEach(item => items.push({ id: item.id, kind: 'payment', title: `Công nợ ${item.id}`, subject: `${item.customerName} · ${item.unitId}`, reason: `Quá hạn kỳ thanh toán ${item.nextDue}`, status: 'overdue', date: item.nextDue, evidenceCount: hub.payments.filter(payment => payment.rentalId === item.id && Boolean(payment.proofImage)).length, destination: 'payments' }))

    return items.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
  }, [hub.holds, hub.rentals, hub.units, hub.returns, hub.checkins, hub.maintenanceTasks, hub.payments, user])

  const visible = exceptions.filter(item => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN')
    return (kind === 'all' || item.kind === kind) && (!normalized || [item.id, item.title, item.subject, item.reason].some(value => value.toLocaleLowerCase('vi-VN').includes(normalized)))
  })

  return <div className="space-y-5">
    <SectionHeader eyebrow="Giám sát ngoại lệ" title="Ngoại lệ vận hành của cơ sở" subtitle="Tổng hợp trực tiếp từ đặt chỗ, nhận/trả kho, bảo trì và công nợ. Mỗi hồ sơ vẫn được xử lý tại đúng luồng nghiệp vụ nguồn." />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {(['return', 'checkin', 'reservation', 'maintenance', 'payment'] as ExceptionKind[]).map(item => <StatCard key={item} title={kindLabels[item]} value={exceptions.filter(exception => exception.kind === item).length} icon={item === 'payment' ? Icon.dollar : item === 'maintenance' ? Icon.tasks : Icon.alert} />)}
    </div>
    <Card>
      <div className="grid gap-3 border-b border-stone-200 p-4 md:grid-cols-[1fr_220px]"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã hồ sơ, khách hàng, gian kho hoặc lý do…" /><Select value={kind} onChange={event => setKind(event.target.value as 'all' | ExceptionKind)}><option value="all">Tất cả loại ngoại lệ</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
      <Table><Thead><tr><Th>Hồ sơ</Th><Th>Loại</Th><Th>Đối tượng</Th><Th>Lý do cần chú ý</Th><Th>Trạng thái</Th><Th>Bằng chứng</Th><Th /></tr></Thead><Tbody>
        {visible.map(item => <Tr key={`${item.kind}-${item.id}`}><Td><p className="font-semibold text-stone-900">{item.title}</p><p className="mt-1 text-xs text-stone-500">{formatDateTime(item.date)}</p></Td><Td>{kindLabels[item.kind]}</Td><Td>{item.subject}</Td><Td className="max-w-md text-sm text-stone-600">{item.reason}</Td><Td><Badge variant={item.status === 'disputed' || item.status === 'overdue' || item.status === 'REJECTED' ? 'error' : 'warning'}>{managerStatusLabel(item.status, 'vi')}</Badge></Td><Td>{item.evidenceCount ? `${item.evidenceCount} tệp/ảnh` : 'Chưa có'}</Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => onOpen(item.destination)}>Mở luồng xử lý</Button></Td></Tr>)}
        {!visible.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Không có ngoại lệ phù hợp với bộ lọc.</td></tr>}
      </Tbody></Table>
    </Card>
    <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Phân quyền:</b> các ngoại lệ hàng hóa của đặt chỗ chỉ được Manager theo dõi; quyết định kiểm tra hàng và nhận kho vẫn thuộc Staff. Manager xử lý tranh chấp trả kho, công nợ, trạng thái gian và điều phối nhiệm vụ đúng theo từng màn hình nguồn.</Card>
  </div>
}
