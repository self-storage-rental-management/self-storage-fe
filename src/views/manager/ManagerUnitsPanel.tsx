import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { RentalRecord, StorageReservation, StorageUnit } from '../../types/storageHub'
import { unitHasAllocationConflict } from '../../domain/managerRules'
import { managerStatusLabel, managerUnitTypeLabel } from './managerI18n'

interface ManagerUnitsPanelProps {
  user: User
  storeHolds: StorageReservation[]
  storeUnits: StorageUnit[]
  storeRentals: RentalRecord[]
  assignUnitToHold: (reservationId: string, unitId: string, manager: User) => void
  showToast: (message: string) => void
}

const activeReservationStatuses = ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN']

function matchesType(unit: StorageUnit, reservation: StorageReservation) {
  const expected = reservation.unitTypeId.toLowerCase().replace('xlarge', 'extra large')
  const actual = unit.type.toLowerCase()
  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual)
}

function statusVariant(status: string) {
  if (status === 'READY_FOR_CHECKIN') return 'success'
  if (status === 'UNIT_RESERVED') return 'purple'
  if (status === 'DEPOSIT_PAID') return 'info'
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'error'
  return 'muted'
}

export default function ManagerUnitsPanel({ user, storeHolds, storeUnits, storeRentals, assignUnitToHold, showToast }: ManagerUnitsPanelProps) {
  const { lang, formatCurrency } = useLanguage()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [selectedReservation, setSelectedReservation] = useState<StorageReservation | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState('')

  const facilityReservations = useMemo(() => storeHolds.filter(reservation =>
    !user.facility || user.facility === 'All facilities' || reservation.facilityName === user.facility || reservation.facilityId === user.facility
  ), [storeHolds, user.facility])

  const filteredReservations = facilityReservations.filter(reservation => {
    const normalized = query.trim().toLowerCase()
    const matchesQuery = !normalized || [reservation.id, reservation.customerName, reservation.customerEmail, reservation.unitTypeName, reservation.assignedUnitId || ''].some(value => value.toLowerCase().includes(normalized))
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && activeReservationStatuses.includes(reservation.status)) || reservation.status === statusFilter
    return matchesQuery && matchesStatus
  })

  const candidates = useMemo(() => {
    if (!selectedReservation) return []
    return storeUnits.filter(unit => {
      if (unit.facilityId !== selectedReservation.facilityId) return false
      if (!matchesType(unit, selectedReservation)) return false
      if (unit.status === 'maintenance') return false
      return !unitHasAllocationConflict(unit.id, selectedReservation.startDate, selectedReservation.endDate, selectedReservation.id, storeHolds, storeRentals)
    })
  }, [selectedReservation, storeHolds, storeRentals, storeUnits])

  const openAssignment = (reservation: StorageReservation) => {
    setSelectedReservation(reservation)
    setSelectedUnitId(reservation.assignedUnitId || '')
  }

  const confirmAssignment = () => {
    if (!selectedReservation || !selectedUnitId) return
    try {
      assignUnitToHold(selectedReservation.id, selectedUnitId, user)
      const unit = storeUnits.find(item => item.id === selectedUnitId)
      showToast(lang === 'vi' ? `Đã phân gian kho ${unit?.code || selectedUnitId} cho ${selectedReservation.id}.` : `Unit ${unit?.code || selectedUnitId} assigned to ${selectedReservation.id}.`)
      setSelectedReservation(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể phân kho.')
    }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader eyebrow={lang === 'vi' ? 'Vận hành đặt chỗ' : 'Reservation operations'} title={lang === 'vi' ? 'Đặt chỗ & Phân kho' : 'Reservations & Unit Assignment'} subtitle={lang === 'vi' ? 'Chỉ hiển thị đơn thuộc cơ sở của bạn; mọi phân bổ đều được kiểm tra loại kho, khoảng thuê và xung đột.' : 'Facility-scoped reservations with type, date-range and conflict validation.'} />

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'vi' ? 'Tìm mã đơn, khách hàng, email hoặc gian kho…' : 'Search reservation, customer, email or unit…'} />
        <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option value="active">{lang === 'vi' ? 'Đang cần xử lý' : 'Actionable'}</option>
          <option value="all">{lang === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
          <option value="DEPOSIT_PAID">{lang === 'vi' ? 'Đã cọc, chờ phân kho' : 'Deposit paid'}</option>
          <option value="UNIT_RESERVED">{lang === 'vi' ? 'Đã phân kho' : 'Unit reserved'}</option>
          <option value="READY_FOR_CHECKIN">{lang === 'vi' ? 'Sẵn sàng nhận kho' : 'Ready for move-in'}</option>
        </Select>
      </div>

      <Card>
        <Table>
          <Thead><tr><Th>{lang === 'vi' ? 'Đơn đặt' : 'Reservation'}</Th><Th>{lang === 'vi' ? 'Khách hàng' : 'Customer'}</Th><Th>{lang === 'vi' ? 'Loại kho' : 'Unit type'}</Th><Th>{lang === 'vi' ? 'Kỳ thuê' : 'Rental period'}</Th><Th>{lang === 'vi' ? 'Thanh toán' : 'Payment'}</Th><Th>{lang === 'vi' ? 'Gian đã phân' : 'Assigned unit'}</Th><Th>{lang === 'vi' ? 'Trạng thái' : 'Status'}</Th><Th /></tr></Thead>
          <Tbody>
            {filteredReservations.map(reservation => {
              const assignedUnit = storeUnits.find(unit => unit.id === reservation.assignedUnitId)
              return <Tr key={reservation.id}>
                <Td className="font-mono text-xs font-bold">{reservation.id}</Td>
                <Td><p className="font-semibold text-stone-900">{reservation.customerName}</p><p className="text-xs text-stone-400">{reservation.customerEmail}</p></Td>
                <Td>{managerUnitTypeLabel(reservation.unitTypeName, lang)}</Td>
                <Td><p>{reservation.startDate}</p><p className="text-xs text-stone-400">→ {reservation.endDate}</p></Td>
                <Td><Badge variant={reservation.payment.status === 'paid' ? 'success' : 'warning'}>{reservation.payment.status === 'paid' ? (lang === 'vi' ? 'Đã cọc' : 'Deposit paid') : (lang === 'vi' ? 'Chưa thanh toán' : 'Unpaid')}</Badge>{reservation.remainingAmount > 0 && <p className="mt-1 text-xs text-stone-500">{lang === 'vi' ? `Còn ${formatCurrency(reservation.remainingAmount)}` : `${formatCurrency(reservation.remainingAmount)} remaining`}</p>}</Td>
                <Td>{assignedUnit ? <span className="font-mono font-bold">{assignedUnit.code}</span> : <span className="text-stone-400">—</span>}</Td>
                <Td><Badge variant={statusVariant(reservation.status)}>{managerStatusLabel(reservation.status, lang)}</Badge></Td>
                <Td className="text-right"><Button size="sm" variant={activeReservationStatuses.includes(reservation.status) && reservation.payment.status === 'paid' ? 'primary' : 'outline'} disabled={!activeReservationStatuses.includes(reservation.status) || reservation.payment.status !== 'paid'} onClick={() => openAssignment(reservation)}>{assignedUnit ? (lang === 'vi' ? 'Đổi gian' : 'Reassign') : (lang === 'vi' ? 'Phân kho' : 'Assign')}</Button></Td>
              </Tr>
            })}
            {!filteredReservations.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">{lang === 'vi' ? 'Không có đơn đặt phù hợp.' : 'No matching reservations.'}</td></tr>}
          </Tbody>
        </Table>
      </Card>

      <Modal open={Boolean(selectedReservation)} onClose={() => setSelectedReservation(null)} title={lang === 'vi' ? 'Phân gian kho vật lý' : 'Assign physical unit'} size="lg">
        {selectedReservation && <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-stone-400">{lang === 'vi' ? 'Đơn đặt' : 'Reservation'}</p><p className="font-mono font-bold">{selectedReservation.id}</p></div>
            <div><p className="text-xs text-stone-400">{lang === 'vi' ? 'Cơ sở' : 'Facility'}</p><p className="font-semibold">{selectedReservation.facilityName}</p></div>
            <div><p className="text-xs text-stone-400">{lang === 'vi' ? 'Loại gian kho' : 'Unit type'}</p><p className="font-semibold">{managerUnitTypeLabel(selectedReservation.unitTypeName, lang)}</p></div>
            <div><p className="text-xs text-stone-400">{lang === 'vi' ? 'Thời hạn' : 'Period'}</p><p className="font-semibold">{selectedReservation.startDate} → {selectedReservation.endDate}</p></div>
          </div>
          <Select label={lang === 'vi' ? 'Gian kho đáp ứng toàn bộ quy tắc nghiệp vụ' : 'Eligible physical unit'} value={selectedUnitId} onChange={event => setSelectedUnitId(event.target.value)}>
            <option value="">{candidates.length ? (lang === 'vi' ? 'Chọn gian kho' : 'Select a unit') : (lang === 'vi' ? 'Không có gian kho phù hợp' : 'No eligible unit')}</option>
            {candidates.map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {managerUnitTypeLabel(unit.type, lang)} · {unit.areaM2}m² · {unit.zone}</option>)}
          </Select>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-bold">{lang === 'vi' ? 'Quy tắc được xác minh lại khi xác nhận' : 'Rules revalidated on confirmation'}</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">{(lang === 'vi'
              ? ['Cùng cơ sở', 'Đúng loại gian kho', 'Khả dụng trong kỳ thuê', 'Không trùng lịch phân bổ', 'Không trong bảo trì', 'Đã cọc và đơn còn hiệu lực']
              : ['Same facility', 'Same unit type', 'Available for rental period', 'No overlapping allocation', 'Not under maintenance', 'Deposit paid and reservation active']
            ).map(rule => <li key={rule}>✓ {rule}</li>)}</ul>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedReservation(null)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button disabled={!selectedUnitId} onClick={confirmAssignment}>{lang === 'vi' ? 'Xác nhận phân kho' : 'Confirm assignment'}</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
