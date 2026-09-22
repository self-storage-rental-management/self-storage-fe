import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { RentalRecord, StorageReservation, StorageUnit } from '../../types/storageHub'
import { checkDateOverlap } from '../../store/StorageHubContext'
import { isFacilityVisible } from '../../domain/managerRules'

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
    const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [selectedReservation, setSelectedReservation] = useState<StorageReservation | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState('')

  const facilityReservations = useMemo(() => storeHolds.filter(reservation =>
    isFacilityVisible(user, reservation.facilityId, reservation.facilityName)
  ), [storeHolds, user])

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
      if (unit.id !== selectedReservation.assignedUnitId && unit.status !== 'available') return false
      if (unit.status === 'maintenance') return false
      const reservationConflict = storeHolds.some(other => other.id !== selectedReservation.id && other.assignedUnitId === unit.id && activeReservationStatuses.includes(other.status) && checkDateOverlap(selectedReservation.startDate, selectedReservation.endDate, other.startDate, other.endDate))
      const rentalConflict = storeRentals.some(rental => rental.unitId === unit.id && rental.status === 'active' && checkDateOverlap(selectedReservation.startDate, selectedReservation.endDate, rental.startDate, rental.endDate))
      return !reservationConflict && !rentalConflict
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
      showToast(`Đã phân gian kho ${unit?.code || selectedUnitId} cho ${selectedReservation.id}.`)
      setSelectedReservation(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể phân kho.')
    }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader eyebrow={'Vận hành đặt chỗ'} title="Reservations & Unit Assignment" subtitle={'Chỉ hiển thị đơn thuộc cơ sở của bạn; mọi phân bổ đều được kiểm tra loại kho, khoảng thuê và xung đột.'} />

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={'Tìm mã đơn, khách hàng, email hoặc gian kho…'} />
        <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option value="active">{'Đang cần xử lý'}</option>
          <option value="all">{'Tất cả trạng thái'}</option>
          <option value="DEPOSIT_PAID">{'Đã cọc, chờ phân kho'}</option>
          <option value="UNIT_RESERVED">{'Đã phân kho'}</option>
          <option value="READY_FOR_CHECKIN">{'Sẵn sàng check-in'}</option>
        </Select>
      </div>

      <Card>
        <Table>
          <Thead><tr><Th>{'Đơn đặt'}</Th><Th>{'Khách hàng'}</Th><Th>{'Loại kho'}</Th><Th>{'Kỳ thuê'}</Th><Th>{'Thanh toán'}</Th><Th>{'Gian đã phân'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead>
          <Tbody>
            {filteredReservations.map(reservation => {
              const assignedUnit = storeUnits.find(unit => unit.id === reservation.assignedUnitId)
              return <Tr key={reservation.id}>
                <Td className="font-mono text-xs font-bold">{reservation.id}</Td>
                <Td><p className="font-semibold text-stone-900">{reservation.customerName}</p><p className="text-xs text-stone-400">{reservation.customerEmail}</p></Td>
                <Td>{reservation.unitTypeName}</Td>
                <Td><p>{reservation.startDate}</p><p className="text-xs text-stone-400">→ {reservation.endDate}</p></Td>
                <Td><Badge variant={reservation.payment.status === 'paid' ? 'success' : 'warning'}>{reservation.payment.status === 'paid' ? ('Đã cọc') : ('Chưa thanh toán')}</Badge>{reservation.remainingAmount > 0 && <p className="mt-1 text-xs text-stone-500">{`Còn ${formatVnd(reservation.remainingAmount)}`}</p>}</Td>
                <Td>{assignedUnit ? <span className="font-mono font-bold">{assignedUnit.code}</span> : <span className="text-stone-400">—</span>}</Td>
                <Td><Badge variant={statusVariant(reservation.status)}>{reservation.status}</Badge></Td>
                <Td className="text-right"><Button size="sm" variant={activeReservationStatuses.includes(reservation.status) && reservation.payment.status === 'paid' ? 'primary' : 'outline'} disabled={!activeReservationStatuses.includes(reservation.status) || reservation.payment.status !== 'paid'} onClick={() => openAssignment(reservation)}>{assignedUnit ? ('Đổi gian') : ('Phân kho')}</Button></Td>
              </Tr>
            })}
            {!filteredReservations.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">{'Không có đơn đặt phù hợp.'}</td></tr>}
          </Tbody>
        </Table>
      </Card>

      <Modal open={Boolean(selectedReservation)} onClose={() => setSelectedReservation(null)} title={'Phân gian kho vật lý'} size="lg">
        {selectedReservation && <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-stone-400">Reservation</p><p className="font-mono font-bold">{selectedReservation.id}</p></div>
            <div><p className="text-xs text-stone-400">Facility</p><p className="font-semibold">{selectedReservation.facilityName}</p></div>
            <div><p className="text-xs text-stone-400">Unit type</p><p className="font-semibold">{selectedReservation.unitTypeName}</p></div>
            <div><p className="text-xs text-stone-400">Period</p><p className="font-semibold">{selectedReservation.startDate} → {selectedReservation.endDate}</p></div>
          </div>
          <Select label={'Gian kho đáp ứng toàn bộ business rule'} value={selectedUnitId} onChange={event => setSelectedUnitId(event.target.value)}>
            <option value="">{candidates.length ? ('Chọn gian kho') : ('Không có gian kho phù hợp')}</option>
            {candidates.map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {unit.type} · {unit.areaM2}m² · {unit.zone}</option>)}
          </Select>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-bold">{'Rule được xác minh lại khi xác nhận'}</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2"><li>✓ Same facility</li><li>✓ Same unit type</li><li>✓ Available for rental period</li><li>✓ No overlapping allocation</li><li>✓ Not maintenance</li><li>✓ Deposit paid & reservation active</li></ul>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedReservation(null)}>{'Hủy'}</Button><Button disabled={!selectedUnitId} onClick={confirmAssignment}>{'Xác nhận phân kho'}</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
