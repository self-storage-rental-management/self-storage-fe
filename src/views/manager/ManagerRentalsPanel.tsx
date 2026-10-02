import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { RenewalRecord, RentalRecord, StorageReservation, StorageUnit, UnitType } from '../../types/storageHub'
import { isManagerFacilityVisible, isManagerRentalOverdue, rentalAmountDue, unitHasAllocationConflict } from '../../domain/managerRules'
import { managerStatusLabel, managerUnitTypeLabel } from './managerI18n'
import ManagerActionNotice from './ManagerActionNotice'
import ManagerPagination from './ManagerPagination'
import { formatManagerDate, managerDateValue, matchesManagerSearch, normalizeManagerMoney, paginateManagerItems } from './managerList'

interface Props {
  user: User
  rentals: RentalRecord[]
  renewals: RenewalRecord[]
  reservations: StorageReservation[]
  units: StorageUnit[]
  unitTypes: UnitType[]
  assignUnitToHold: (reservationId: string, unitId: string, manager: User) => void
  approveRenewal: (renewalId: string, manager: User) => void
  rejectRenewal: (renewalId: string, manager: User, reason: string) => void
  showToast: (message: string) => void
}

const rentalVariants: Record<string, string> = { active: 'success', return_requested: 'warning', return_inspection: 'warning', closing: 'warning', completed: 'muted' }

const formatKnownMoney = (value?: number) => value === undefined ? 'Chưa xác định' : formatVnd(value)

const normalizeTypeKey = (value?: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/storage|commercial|kho|[()\s_-]/g, '')

const unitTypeKey = (value?: string) => {
  const key = normalizeTypeKey(value)
  if (key === 'xl' || key.includes('xlarge') || key.includes('extralarge') || key.includes('ratlon')) return 'xlarge'
  if (key === 's' || key.includes('small') || key.includes('nho')) return 'small'
  if (key === 'm' || key.includes('medium') || key.includes('trung') || key.includes('vua')) return 'medium'
  if (key === 'l' || key.includes('large') || key.includes('lon')) return 'large'
  return key
}

const billingStatusFor = (rental: RentalRecord) => {
  if (isManagerRentalOverdue(rental)) return { key: 'overdue', label: 'Đang quá hạn', variant: 'error' }
  if (rental.paymentStatus === 'paid') return { key: 'paid', label: 'Kỳ hiện tại đã thanh toán', variant: 'success' }
  if (rental.paymentStatus === 'pending') return { key: 'pending', label: 'Kỳ hiện tại đang chờ thanh toán', variant: 'warning' }
  return { key: rental.paymentStatus, label: managerStatusLabel(rental.paymentStatus, 'vi'), variant: 'muted' }
}

const normalizeRentalMessage = (message: string) => message.replace(/hợp đồng/gi, 'hồ sơ thuê')

export default function ManagerRentalsPanel({ user, rentals, renewals, reservations, units, unitTypes, assignUnitToHold, approveRenewal, rejectRenewal, showToast }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  const [attentionFilter, setAttentionFilter] = useState('all')
  const [rentalSort, setRentalSort] = useState('priority')
  const [rentalPage, setRentalPage] = useState(1)
  const [rentalPageSize, setRentalPageSize] = useState(10)
  const [reservationQuery, setReservationQuery] = useState('')
  const [reservationPage, setReservationPage] = useState(1)
  const [reservationPageSize, setReservationPageSize] = useState(10)
  const [renewalQuery, setRenewalQuery] = useState('')
  const [renewalPage, setRenewalPage] = useState(1)
  const [renewalPageSize, setRenewalPageSize] = useState(10)
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null)
  const [assignmentReservation, setAssignmentReservation] = useState<StorageReservation | null>(null)
  const [assignmentUnitId, setAssignmentUnitId] = useState('')

  const facilityRentals = useMemo(() => rentals.filter(rental => isManagerFacilityVisible(user, rental.facilityId, rental.facilityName)), [rentals, user])
  const facilityReservations = reservations.filter(reservation => isManagerFacilityVisible(user, reservation.facilityId, reservation.facilityName))
  const physicalUnitFor = (rental: RentalRecord) => units.find(unit => unit.id === rental.unitId || unit.code === rental.unitId)
  const unitTypeFor = (rental: RentalRecord) => {
    const unit = physicalUnitFor(rental)
    const reservation = facilityReservations.find(item => item.id === rental.holdId)
    const physicalTypeKey = unitTypeKey(unit?.type)
    const reservationTypeKey = unitTypeKey(reservation?.unitTypeId || reservation?.unitTypeName)
    return unitTypes.find(definition => (
      unitTypeKey(definition.id) === physicalTypeKey ||
      unitTypeKey(definition.name) === physicalTypeKey ||
      unitTypeKey(definition.id) === reservationTypeKey ||
      unitTypeKey(definition.name) === reservationTypeKey
    ))
  }
  const appliedRateFor = (rental: RentalRecord) => normalizeManagerMoney(rental.monthlyRate) ?? unitTypeFor(rental)?.monthlyPrice ?? physicalUnitFor(rental)?.price
  const depositFor = (rental: RentalRecord) => {
    const reservation = facilityReservations.find(item => item.id === rental.holdId)
    return normalizeManagerMoney(reservation?.securityDepositAmount ?? rental.securityDeposit ?? rental.deposit)
  }
  const unitTypeNameFor = (rental: RentalRecord) => unitTypeFor(rental)?.name || (physicalUnitFor(rental) ? managerUnitTypeLabel(physicalUnitFor(rental)!.type, 'vi') : 'Chưa xác định')
  const waitingAssignmentReservations = facilityReservations
    .filter(reservation => !reservation.assignedUnitId && reservation.payment.status === 'paid' && ['DEPOSIT_PAID', 'UNIT_RESERVED'].includes(reservation.status))
    .filter(reservation => matchesManagerSearch(reservationQuery, [reservation.id, reservation.customerId, reservation.customerName, reservation.customerEmail, reservation.assignedUnitId, reservation.unitTypeName]))
    .sort((left, right) => {
      const canAssign = (item: StorageReservation) => item.payment.status === 'paid' && ['DEPOSIT_PAID', 'UNIT_RESERVED'].includes(item.status)
      const unassignedDifference = Number(canAssign(right) && !right.assignedUnitId) - Number(canAssign(left) && !left.assignedUnitId)
      return unassignedDifference || managerDateValue(left.moveInDate || left.startDate) - managerDateValue(right.moveInDate || right.startDate)
    })
  const facilityRenewals = renewals.filter(renewal => facilityRentals.some(rental => rental.id === renewal.rentalId))
  const allPendingRenewals = facilityRenewals.filter(renewal => renewal.status === 'pending')
  const pendingRenewals = allPendingRenewals.filter(renewal => matchesManagerSearch(renewalQuery, [renewal.id, renewal.rentalId, renewal.customerId, renewal.customerName, renewal.unitId]))
    .sort((left, right) => managerDateValue(left.requestedAt) - managerDateValue(right.requestedAt))
  const renewalApprovalBlock = (renewal: RenewalRecord) => {
    const rental = facilityRentals.find(item => item.id === renewal.rentalId)
    if (!rental) return 'Không tìm thấy hồ sơ thuê tương ứng.'
    if (rental.status !== 'active') {
      return ['return_requested', 'return_inspection', 'closing'].includes(rental.status)
        ? 'Hồ sơ thuê đang có yêu cầu trả kho hoặc đang tất toán; không thể duyệt gia hạn.'
        : 'Hồ sơ thuê không còn hiệu lực để gia hạn.'
    }
    if (isManagerRentalOverdue(rental)) return 'Hồ sơ thuê đang có khoản quá hạn; cần xử lý công nợ trước khi duyệt gia hạn.'
    if (renewal.oldEndDate !== rental.endDate) return 'Thời hạn hồ sơ thuê đã thay đổi; Customer cần cập nhật lại yêu cầu.'
    if (managerDateValue(renewal.newEndDate) <= managerDateValue(renewal.oldEndDate)) return 'Ngày kết thúc mới không hợp lệ.'
    const conflicted = unitHasAllocationConflict(renewal.unitId, renewal.oldEndDate, renewal.newEndDate, renewal.id, reservations, rentals.filter(item => item.id !== rental.id))
    return conflicted ? 'Gian kho đã có lịch sử dụng khác trong khoảng thời gian gia hạn.' : ''
  }
  const now = Date.now()
  const visibleRentals = facilityRentals.filter(rental => {
    const daysToExpiry = (managerDateValue(rental.endDate) - now) / 86_400_000
    const paymentStatus = isManagerRentalOverdue(rental) ? 'overdue' : rental.paymentStatus
    const matchExpiry = expiryFilter === 'all' || (expiryFilter === '30' ? rental.status === 'active' && daysToExpiry >= 0 && daysToExpiry <= 30 : expiryFilter === 'expired' ? daysToExpiry < 0 : daysToExpiry > 30)
    const needsAttention = paymentStatus === 'overdue' ||
      ['return_requested', 'return_inspection', 'closing'].includes(rental.status) ||
      allPendingRenewals.some(renewal => renewal.rentalId === rental.id) ||
      (rental.status === 'active' && daysToExpiry >= 0 && daysToExpiry <= 30) ||
      !physicalUnitFor(rental)
    return (filter === 'all' || rental.status === filter) &&
      (paymentFilter === 'all' || paymentStatus === paymentFilter) && matchExpiry &&
      (attentionFilter === 'all' || needsAttention) &&
      matchesManagerSearch(query, [rental.id, rental.holdId, rental.contractId, rental.customerId, rental.customerName, rental.customerEmail, rental.customerPhone, rental.unitId])
  }).sort((left, right) => {
    if (rentalSort === 'end-asc') return managerDateValue(left.endDate) - managerDateValue(right.endDate)
    if (rentalSort === 'end-desc') return managerDateValue(right.endDate) - managerDateValue(left.endDate)
    if (rentalSort === 'customer') return left.customerName.localeCompare(right.customerName, 'vi')
    const priority = (item: RentalRecord) => isManagerRentalOverdue(item) ? 0 : item.status === 'return_requested' || item.status === 'return_inspection' || item.status === 'closing' ? 1 : item.status === 'active' && managerDateValue(item.endDate) - now <= 30 * 86_400_000 ? 2 : item.status === 'active' ? 3 : 4
    return priority(left) - priority(right) || managerDateValue(left.endDate) - managerDateValue(right.endDate)
  })
  const renewalPagination = paginateManagerItems(pendingRenewals, renewalPage, renewalPageSize)
  const reservationPagination = paginateManagerItems(waitingAssignmentReservations, reservationPage, reservationPageSize)
  const rentalPagination = paginateManagerItems(visibleRentals, rentalPage, rentalPageSize)

  useEffect(() => setRenewalPage(1), [renewalQuery, renewalPageSize])
  useEffect(() => setReservationPage(1), [reservationQuery, reservationPageSize])
  useEffect(() => setRentalPage(1), [query, filter, paymentFilter, expiryFilter, attentionFilter, rentalSort, rentalPageSize])

  const assignmentCandidates = assignmentReservation ? units.filter(unit => {
    const normalizedReservationType = unitTypeKey(assignmentReservation.unitTypeId || assignmentReservation.unitTypeName)
    const normalizedUnitType = unitTypeKey(unit.type)
    return unit.facilityId === assignmentReservation.facilityId &&
      normalizedReservationType === normalizedUnitType &&
      (unit.id === assignmentReservation.assignedUnitId || unit.status === 'available') &&
      !unitHasAllocationConflict(unit.id, assignmentReservation.startDate, assignmentReservation.endDate, assignmentReservation.id, reservations, rentals)
  }) : []

  const openAssignment = (reservation: StorageReservation) => {
    const candidates = units.filter(unit => {
      const normalizedReservationType = unitTypeKey(reservation.unitTypeId || reservation.unitTypeName)
      const normalizedUnitType = unitTypeKey(unit.type)
      return unit.facilityId === reservation.facilityId && normalizedReservationType === normalizedUnitType &&
        (unit.id === reservation.assignedUnitId || unit.status === 'available') &&
        !unitHasAllocationConflict(unit.id, reservation.startDate, reservation.endDate, reservation.id, reservations, rentals)
    })
    setAssignmentReservation(reservation)
    setAssignmentUnitId(reservation.assignedUnitId && candidates.some(unit => unit.id === reservation.assignedUnitId) ? reservation.assignedUnitId : candidates[0]?.id || '')
  }

  const confirmAssignment = () => {
    if (!assignmentReservation || !assignmentUnitId) return
    try {
      assignUnitToHold(assignmentReservation.id, assignmentUnitId, user)
      showToast(`Đã phân gian kho ${assignmentUnitId} cho đơn ${assignmentReservation.id}.`)
      setAssignmentReservation(null)
      setAssignmentUnitId('')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể phân gian kho.')
    }
  }

  const decideRenewal = (renewal: RenewalRecord, approved: boolean) => {
    if (approved) {
      const blockedReason = renewalApprovalBlock(renewal)
      if (blockedReason) return showToast(blockedReason)
    }
    try {
      if (approved) approveRenewal(renewal.id, user)
      else {
        const reason = window.prompt('Nhập lý do từ chối gia hạn:')
        if (!reason?.trim()) return
        rejectRenewal(renewal.id, user, reason)
      }
      showToast(approved ? ('Đã duyệt yêu cầu gia hạn.') : ('Đã từ chối yêu cầu gia hạn.'))
    } catch (error) {
      showToast(error instanceof Error ? normalizeRentalMessage(error.message) : 'Không thể xử lý gia hạn.')
    }
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow="Vận hành thuê kho" title="Hồ sơ thuê & Gia hạn" subtitle="Theo dõi hồ sơ thuê, thời hạn, thanh toán và xử lý yêu cầu gia hạn tại cơ sở." />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Tổng hồ sơ'} value={facilityRentals.length} icon={Icon.policy} /><StatCard title={'Đang hiệu lực'} value={facilityRentals.filter(rental => rental.status === 'active').length} icon={Icon.check} /><StatCard title={'Sắp hết hạn 30 ngày'} value={facilityRentals.filter(rental => { const days = (managerDateValue(rental.endDate) - Date.now()) / 86_400_000; return rental.status === 'active' && days >= 0 && days <= 30 }).length} icon={Icon.clock} /><StatCard title={'Chờ duyệt gia hạn'} value={allPendingRenewals.length} icon={Icon.refresh} /></div>

    <ManagerActionNotice tone={allPendingRenewals.length ? 'warning' : 'info'}>{allPendingRenewals.length ? `${allPendingRenewals.length} yêu cầu gia hạn đang chờ Manager duyệt hoặc từ chối.` : 'Chưa có yêu cầu gia hạn ở trạng thái chờ duyệt. Manager chỉ thao tác sau khi Customer gửi yêu cầu gia hạn.'}</ManagerActionNotice>

    {allPendingRenewals.length > 0 && <Card className="border-amber-200"><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">Yêu cầu gia hạn chờ duyệt</h3><p className="text-xs text-stone-500">Yêu cầu chờ lâu nhất được đưa lên trước. Duyệt chỉ mở bước thanh toán; chưa kéo dài thời hạn thuê ngay.</p><div className="mt-3"><Input value={renewalQuery} onChange={event => setRenewalQuery(event.target.value)} placeholder="Tìm mã gia hạn, hồ sơ thuê, khách hàng hoặc gian kho…" /></div></div><div className="space-y-3 p-4">{renewalPagination.items.map(renewal => {
      const blockedReason = renewalApprovalBlock(renewal)
      return <div key={renewal.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{renewal.customerName} · <span className="font-mono">{renewal.unitId}</span></p><p className="text-xs text-stone-500">{formatManagerDate(renewal.oldEndDate)} → {formatManagerDate(renewal.newEndDate)} · {renewal.renewalMonths} tháng · {formatKnownMoney(normalizeManagerMoney(renewal.renewalFee))}</p>{blockedReason && <p className="mt-1 text-xs font-medium text-red-700">{blockedReason}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decideRenewal(renewal, false)}>Từ chối</Button><Button size="sm" disabled={Boolean(blockedReason)} onClick={() => decideRenewal(renewal, true)}>Duyệt</Button></div></div>
    })}{!pendingRenewals.length && <p className="py-6 text-center text-sm text-stone-500">Không có yêu cầu gia hạn phù hợp từ khóa.</p>}</div><ManagerPagination {...renewalPagination} pageSize={renewalPageSize} onPageChange={setRenewalPage} onPageSizeChange={setRenewalPageSize} /></Card>}

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">Đặt chỗ chờ phân gian</h3><p className="text-xs text-stone-500">Các đặt chỗ đã xác nhận nhưng chưa được phân gian kho vật lý.</p><div className="mt-3"><Input value={reservationQuery} onChange={event => setReservationQuery(event.target.value)} placeholder="Tìm mã đặt chỗ, khách hàng hoặc loại gian…" /></div></div><Table><Thead><tr><Th>Mã đặt chỗ</Th><Th>Khách hàng</Th><Th>Loại gian</Th><Th>Thời gian</Th><Th>Thanh toán</Th><Th>Trạng thái</Th><Th /></tr></Thead><Tbody>{reservationPagination.items.map(reservation => <Tr key={reservation.id}><Td className="font-mono text-xs font-bold">{reservation.id}</Td><Td><p className="font-semibold">{reservation.customerName}</p><p className="text-xs text-stone-400">{reservation.customerEmail}</p></Td><Td><p>{reservation.unitTypeName}</p><p className="text-xs text-stone-500">Chưa phân gian vật lý</p></Td><Td><p>{formatManagerDate(reservation.startDate)}</p><p className="text-xs text-stone-400">→ {formatManagerDate(reservation.endDate)}</p></Td><Td><Badge variant="success">{managerStatusLabel(reservation.payment.status, 'vi')}</Badge></Td><Td><Badge variant="info">{managerStatusLabel(reservation.status, 'vi')}</Badge></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => openAssignment(reservation)}>Phân gian</Button></Td></Tr>)}{!waitingAssignmentReservations.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">Không có đặt chỗ đang chờ phân gian.</td></tr>}</Tbody></Table><ManagerPagination {...reservationPagination} pageSize={reservationPageSize} onPageChange={setReservationPage} onPageSizeChange={setReservationPageSize} /></Card>

    <Card className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm hồ sơ thuê, khách hàng, email hoặc gian…" /><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Đang hiệu lực</option><option value="return_requested">Đã yêu cầu trả kho</option><option value="return_inspection">Đang kiểm tra trả kho</option><option value="closing">Đang tất toán</option><option value="completed">Đã hoàn tất</option></Select><Select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}><option value="all">Mọi trạng thái thanh toán</option><option value="overdue">Quá hạn</option><option value="paid">Kỳ hiện tại đã thanh toán</option><option value="pending">Kỳ hiện tại đang chờ</option></Select><Select value={expiryFilter} onChange={event => setExpiryFilter(event.target.value)}><option value="all">Mọi thời hạn</option><option value="30">Hết hạn trong 30 ngày</option><option value="later">Còn trên 30 ngày</option><option value="expired">Đã qua ngày kết thúc</option></Select><Select value={attentionFilter} onChange={event => setAttentionFilter(event.target.value)}><option value="all">Mọi mức độ xử lý</option><option value="attention">Cần xử lý</option></Select><Select value={rentalSort} onChange={event => setRentalSort(event.target.value)}><option value="priority">Cần xử lý trước</option><option value="end-asc">Hết hạn sớm nhất</option><option value="end-desc">Hết hạn xa nhất</option><option value="customer">Tên khách hàng</option></Select></div></Card>
    <Card><Table><Thead><tr><Th>Hồ sơ thuê</Th><Th>Khách hàng</Th><Th>Gian kho</Th><Th>Thời hạn</Th><Th>Giá áp dụng</Th><Th>Kỳ thanh toán</Th><Th>Trạng thái</Th><Th /></tr></Thead><Tbody>
      {rentalPagination.items.map(rental => { const billing = billingStatusFor(rental); const appliedRate = appliedRateFor(rental); return <Tr key={rental.id}><Td className="font-mono text-xs font-bold">{rental.id}</Td><Td><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="text-xs text-stone-400">{rental.customerEmail}</p></Td><Td><p className="font-mono font-bold">{rental.unitId}</p><p className="text-xs text-stone-400">{unitTypeNameFor(rental)}</p></Td><Td><p>{formatManagerDate(rental.startDate)}</p><p className="text-xs text-stone-400">→ {formatManagerDate(rental.endDate)}</p></Td><Td className="font-mono">{formatKnownMoney(appliedRate)}{appliedRate !== undefined && '/tháng'}</Td><Td><Badge variant={billing.variant}>{billing.label}</Badge></Td><Td><Badge variant={rentalVariants[rental.status] || 'muted'}>{managerStatusLabel(rental.status, 'vi')}</Badge></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedRental(rental)}>Chi tiết</Button></Td></Tr> })}
      {!visibleRentals.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">Không có hồ sơ thuê phù hợp.</td></tr>}
    </Tbody></Table><ManagerPagination {...rentalPagination} pageSize={rentalPageSize} onPageChange={setRentalPage} onPageSizeChange={setRentalPageSize} /></Card>

    <Modal open={Boolean(assignmentReservation)} onClose={() => { setAssignmentReservation(null); setAssignmentUnitId('') }} title="Phân gian kho vật lý">
      {assignmentReservation && <div className="space-y-4">
        <div className="rounded-lg bg-stone-50 p-3 text-sm">
          <p><b>{assignmentReservation.id}</b> · {assignmentReservation.customerName}</p>
          <p className="mt-1 text-stone-500">{assignmentReservation.unitTypeName} · {formatManagerDate(assignmentReservation.startDate)} → {formatManagerDate(assignmentReservation.endDate)}</p>
          {assignmentReservation.assignedUnitId && <p className="mt-1 text-stone-500">Gian hiện tại: <b className="font-mono">{assignmentReservation.assignedUnitId}</b></p>}
        </div>
        {assignmentCandidates.length ? <Select label="Gian kho phù hợp và không xung đột" value={assignmentUnitId} onChange={event => setAssignmentUnitId(event.target.value)}>
          {assignmentCandidates.map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {unit.zone} · Tầng {unit.floor}</option>)}
        </Select> : <ManagerActionNotice tone="warning">Không có gian kho cùng loại, đúng cơ sở và còn trống trong toàn bộ thời gian thuê.</ManagerActionNotice>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setAssignmentReservation(null); setAssignmentUnitId('') }}>Hủy</Button><Button disabled={!assignmentUnitId || assignmentUnitId === assignmentReservation.assignedUnitId} onClick={confirmAssignment}>{assignmentReservation.assignedUnitId ? 'Xác nhận đổi gian' : 'Xác nhận phân gian'}</Button></div>
      </div>}
    </Modal>

    <Modal open={Boolean(selectedRental)} onClose={() => setSelectedRental(null)} title="Chi tiết hồ sơ thuê" size="xl">
      {selectedRental && (() => {
        const rentalRenewals = renewals.filter(item => item.rentalId === selectedRental.id)
        const latestRenewal = [...rentalRenewals].sort((left, right) => (right.requestedAt || '').localeCompare(left.requestedAt || ''))[0]
        const billing = billingStatusFor(selectedRental)
        const appliedRate = appliedRateFor(selectedRental)
        const deposit = depositFor(selectedRental)
        const physicalUnit = physicalUnitFor(selectedRental)
        const unitType = unitTypeFor(selectedRental)
        const referenceRate = normalizeManagerMoney(unitType?.monthlyPrice ?? physicalUnit?.price)
        const rateDiffersFromReference = appliedRate !== undefined && referenceRate !== undefined && Math.abs(appliedRate - referenceRate) > 0.01
        const overdueAmount = billing.key === 'overdue' && appliedRate !== undefined
          ? rentalAmountDue({ ...selectedRental, monthlyRate: appliedRate })
          : undefined
        const hasActiveCredential = selectedRental.accessCredentials?.some(item => item.status === 'ACTIVE')
        const accessStatus = selectedRental.overlocked
          ? 'Đã khóa'
          : selectedRental.accessRevokedAt || selectedRental.status === 'completed'
            ? 'Đã thu hồi'
            : hasActiveCredential || selectedRental.gateCode
              ? 'Đang hoạt động'
              : 'Chưa xác định'
        const renewalBlock = latestRenewal?.status === 'pending' ? renewalApprovalBlock(latestRenewal) : ''
        const renewalActionReason = !latestRenewal
          ? 'Customer chưa gửi yêu cầu gia hạn. Không có thao tác duyệt hoặc từ chối.'
          : latestRenewal.status === 'pending' && renewalBlock
            ? renewalBlock
            : latestRenewal.status === 'pending'
              ? 'Yêu cầu đang chờ Manager duyệt hoặc từ chối tại danh sách phía trên. Duyệt không tự động kéo dài thời hạn thuê.'
              : ['approved', 'deposit_paid', 'payment_processing', 'appointment_scheduled'].includes(latestRenewal.status)
                ? 'Manager đã duyệt; thời hạn chỉ được cập nhật sau khi Customer hoàn tất nghĩa vụ thanh toán của luồng gia hạn.'
                : latestRenewal.status === 'completed'
                  ? 'Gia hạn đã hoàn tất và thời hạn thuê đã được cập nhật.'
                  : `Yêu cầu đang ở trạng thái ${managerStatusLabel(latestRenewal.status, 'vi')}; Manager không có thao tác tiếp theo ở trạng thái này.`

        return <div className="space-y-5 text-sm">
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Hồ sơ</p>
            <div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <p><span className="text-stone-400">Mã hồ sơ thuê</span><br /><b className="font-mono">{selectedRental.id}</b></p>
              <p><span className="text-stone-400">Khách hàng</span><br /><b>{selectedRental.customerName}</b><br /><span className="text-xs text-stone-500">{selectedRental.customerEmail}</span></p>
              <p><span className="text-stone-400">Gian kho</span><br /><b className="font-mono">{selectedRental.unitId || 'Chưa phân gian'}</b></p>
              <p><span className="text-stone-400">Loại gian</span><br /><b>{unitTypeNameFor(selectedRental)}</b></p>
              <p><span className="text-stone-400">Trạng thái thuê</span><br /><Badge variant={rentalVariants[selectedRental.status] || 'muted'}>{managerStatusLabel(selectedRental.status, 'vi')}</Badge></p>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Thời hạn</p>
            <div className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-3">
              <p><span className="text-stone-400">Ngày bắt đầu</span><br /><b>{formatManagerDate(selectedRental.startDate)}</b></p>
              <p><span className="text-stone-400">Ngày kết thúc</span><br /><b>{formatManagerDate(selectedRental.endDate)}</b></p>
              <p><span className="text-stone-400">Kỳ thu tiếp theo</span><br /><b>{formatManagerDate(selectedRental.nextDue)}</b></p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-stone-200 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">Thanh toán</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <p><span className="text-stone-400">Giá áp dụng</span><br /><b>{formatKnownMoney(appliedRate)}{appliedRate !== undefined && '/tháng'}</b></p>
                <p><span className="text-stone-400">Tiền đảm bảo đã ghi nhận</span><br /><b>{formatKnownMoney(deposit)}</b></p>
                <p><span className="text-stone-400">Kỳ hiện tại</span><br /><Badge variant={billing.variant}>{billing.label}</Badge></p>
                {overdueAmount !== undefined && <p><span className="text-stone-400">Khoản đang quá hạn</span><br /><b className="text-red-700">{formatKnownMoney(overdueAmount)}</b></p>}
              </div>
              {rateDiffersFromReference && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Giá tham chiếu hiện tại của loại gian là {formatKnownMoney(referenceRate)}/tháng; hồ sơ đang hiển thị giá áp dụng đã được ghi nhận tại thời điểm thuê.</p>}
            </section>

            <section className="rounded-xl border border-stone-200 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">Truy cập</p>
              <p><span className="text-stone-400">Trạng thái truy cập</span><br /><Badge variant={accessStatus === 'Đang hoạt động' ? 'success' : accessStatus === 'Đã khóa' ? 'error' : 'muted'}>{accessStatus}</Badge></p>
              <p className="mt-3 text-xs text-stone-500">Mã truy cập không được hiển thị trên giao diện Manager.</p>
            </section>
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-stone-500">Gia hạn</p>{latestRenewal && <Badge variant={latestRenewal.status === 'pending' ? 'warning' : latestRenewal.status === 'completed' ? 'success' : 'info'}>{managerStatusLabel(latestRenewal.status, 'vi')}</Badge>}</div>
            <ManagerActionNotice tone={renewalBlock ? 'warning' : latestRenewal?.status === 'completed' ? 'success' : 'info'}>{renewalActionReason}</ManagerActionNotice>
            <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
              {rentalRenewals.length ? rentalRenewals.map(item => <div key={item.id} className="grid gap-2 border-b border-stone-100 p-3 last:border-b-0 sm:grid-cols-4">
                <p><span className="text-xs text-stone-400">Mã yêu cầu</span><br /><b className="font-mono">{item.id}</b></p>
                <p><span className="text-xs text-stone-400">Thời hạn yêu cầu</span><br /><b>{formatManagerDate(item.oldEndDate)} → {formatManagerDate(item.newEndDate)}</b></p>
                <p><span className="text-xs text-stone-400">Thời gian gia hạn</span><br /><b>{item.renewalMonths} tháng</b></p>
                <p><span className="text-xs text-stone-400">Phí ghi nhận</span><br /><b>{formatKnownMoney(normalizeManagerMoney(item.renewalFee))}</b></p>
              </div>) : <p className="p-4 text-stone-500">Chưa có yêu cầu gia hạn.</p>}
            </div>
          </section>

          <div className="flex justify-end"><Button variant="outline" onClick={() => setSelectedRental(null)}>Đóng</Button></div>
        </div>
      })()}
    </Modal>
  </div>
}
