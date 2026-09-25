import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { RenewalRecord, RentalRecord, StorageContract, StorageReservation, StorageUnit } from '../../types/storageHub'
import { isManagerFacilityVisible, isManagerRentalOverdue, unitHasAllocationConflict } from '../../domain/managerRules'
import { managerStatusLabel, managerUnitTypeLabel } from './managerI18n'
import ManagerActionNotice from './ManagerActionNotice'

interface Props {
  user: User
  rentals: RentalRecord[]
  contracts: StorageContract[]
  renewals: RenewalRecord[]
  reservations: StorageReservation[]
  units: StorageUnit[]
  assignUnitToHold: (reservationId: string, unitId: string, manager: User) => void
  approveRenewal: (renewalId: string, manager: User) => void
  rejectRenewal: (renewalId: string, manager: User, reason: string) => void
  showToast: (message: string) => void
}

const rentalVariants: Record<string, string> = { active: 'success', return_requested: 'warning', return_inspection: 'warning', closing: 'warning', completed: 'muted' }

export default function ManagerRentalsPanel({ user, rentals, contracts, renewals, reservations, units, assignUnitToHold, approveRenewal, rejectRenewal, showToast }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null)
  const [assignmentReservation, setAssignmentReservation] = useState<StorageReservation | null>(null)
  const [assignmentUnitId, setAssignmentUnitId] = useState('')

  const facilityRentals = useMemo(() => rentals.filter(rental => isManagerFacilityVisible(user, rental.facilityId, rental.facilityName)), [rentals, user])
  const facilityReservations = reservations.filter(reservation => isManagerFacilityVisible(user, reservation.facilityId, reservation.facilityName))
  const activeReservations = facilityReservations.filter(reservation => !['CANCELLED', 'EXPIRED', 'COMPLETED', 'cancelled', 'expired', 'completed'].includes(reservation.status))
  const facilityRenewals = renewals.filter(renewal => facilityRentals.some(rental => rental.id === renewal.rentalId))
  const pendingRenewals = facilityRenewals.filter(renewal => renewal.status === 'pending')
  const visibleRentals = facilityRentals.filter(rental => {
    const normalized = query.trim().toLowerCase()
    return (filter === 'all' || rental.status === filter) && (!normalized || [rental.id, rental.customerName, rental.customerEmail, rental.unitId].some(value => value.toLowerCase().includes(normalized)))
  })

  const assignmentCandidates = assignmentReservation ? units.filter(unit => {
    const reservationType = (assignmentReservation.unitTypeId || assignmentReservation.unitTypeName).toLowerCase().replace(/storage|commercial|[\s_-]/g, '')
    const unitType = unit.type.toLowerCase().replace(/[\s_-]/g, '')
    const normalizedReservationType = reservationType.includes('extralarge') || reservationType.includes('xlarge') ? 'xlarge' : reservationType
    const normalizedUnitType = unitType === 'extralarge' ? 'xlarge' : unitType
    return unit.facilityId === assignmentReservation.facilityId &&
      normalizedReservationType.startsWith(normalizedUnitType) &&
      (unit.id === assignmentReservation.assignedUnitId || unit.status === 'available') &&
      !unitHasAllocationConflict(unit.id, assignmentReservation.startDate, assignmentReservation.endDate, assignmentReservation.id, reservations, rentals)
  }) : []

  const openAssignment = (reservation: StorageReservation) => {
    const candidates = units.filter(unit => {
      const reservationType = (reservation.unitTypeId || reservation.unitTypeName).toLowerCase().replace(/storage|commercial|[\s_-]/g, '')
      const unitType = unit.type.toLowerCase().replace(/[\s_-]/g, '')
      const normalizedReservationType = reservationType.includes('extralarge') || reservationType.includes('xlarge') ? 'xlarge' : reservationType
      const normalizedUnitType = unitType === 'extralarge' ? 'xlarge' : unitType
      return unit.facilityId === reservation.facilityId && normalizedReservationType.startsWith(normalizedUnitType) &&
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
    try {
      if (approved) approveRenewal(renewal.id, user)
      else {
        const reason = window.prompt('Nhập lý do từ chối gia hạn:')
        if (!reason?.trim()) return
        rejectRenewal(renewal.id, user, reason)
      }
      showToast(approved ? ('Đã duyệt yêu cầu gia hạn.') : ('Đã từ chối yêu cầu gia hạn.'))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xử lý gia hạn.')
    }
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Hợp đồng thuê'} title="Hợp đồng & Gia hạn" subtitle={'Theo dõi hợp đồng, thời hạn và phê duyệt gia hạn thuộc cơ sở.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Tổng hồ sơ'} value={facilityRentals.length} icon={Icon.policy} /><StatCard title={'Đang hiệu lực'} value={facilityRentals.filter(rental => rental.status === 'active').length} icon={Icon.check} /><StatCard title={'Sắp hết hạn 30 ngày'} value={facilityRentals.filter(rental => { const days = (new Date(rental.endDate).getTime() - Date.now()) / 86_400_000; return rental.status === 'active' && days >= 0 && days <= 30 }).length} icon={Icon.clock} /><StatCard title={'Chờ duyệt gia hạn'} value={pendingRenewals.length} icon={Icon.refresh} /></div>

    <ManagerActionNotice tone={pendingRenewals.length ? 'warning' : 'info'}>{pendingRenewals.length ? `${pendingRenewals.length} yêu cầu gia hạn đang chờ Manager duyệt hoặc từ chối.` : 'Chưa có yêu cầu gia hạn ở trạng thái chờ duyệt. Manager chỉ thao tác sau khi Customer gửi yêu cầu gia hạn.'}</ManagerActionNotice>

    {pendingRenewals.length > 0 && <Card className="border-amber-200 p-4"><div className="mb-3"><h3 className="font-bold text-stone-900">{'Yêu cầu gia hạn chờ duyệt'}</h3><p className="text-xs text-stone-500">{'Hệ thống sẽ kiểm tra lại xung đột lịch khi quản lý duyệt.'}</p></div><div className="space-y-3">{pendingRenewals.map(renewal => <div key={renewal.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{renewal.customerName} · <span className="font-mono">{renewal.unitId}</span></p><p className="text-xs text-stone-500">{renewal.oldEndDate} → {renewal.newEndDate} · {renewal.renewalMonths} tháng · {formatVnd(renewal.renewalFee)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decideRenewal(renewal, false)}>{'Từ chối'}</Button><Button size="sm" onClick={() => decideRenewal(renewal, true)}>{'Duyệt'}</Button></div></div>)}</div></Card>}

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">Đặt chỗ đang hiệu lực</h3><p className="text-xs text-stone-500">Manager được phân hoặc đổi gian vật lý sau khi khách đã thanh toán cọc; hệ thống vẫn kiểm tra đúng cơ sở, loại kho và xung đột lịch.</p></div><Table><Thead><tr><Th>Mã đặt chỗ</Th><Th>Khách hàng</Th><Th>Loại/Gian</Th><Th>Thời gian</Th><Th>Thanh toán</Th><Th>Trạng thái</Th><Th /></tr></Thead><Tbody>{activeReservations.map(reservation => { const canAssign = reservation.payment.status === 'paid' && ['DEPOSIT_PAID', 'UNIT_RESERVED'].includes(reservation.status); return <Tr key={reservation.id}><Td className="font-mono text-xs font-bold">{reservation.id}</Td><Td><p className="font-semibold">{reservation.customerName}</p><p className="text-xs text-stone-400">{reservation.customerEmail}</p></Td><Td><p>{reservation.unitTypeName}</p><p className="font-mono text-xs text-stone-500">{reservation.assignedUnitId || 'Chưa phân gian vật lý'}</p></Td><Td><p>{reservation.startDate}</p><p className="text-xs text-stone-400">→ {reservation.endDate}</p></Td><Td><Badge variant={reservation.payment.status === 'paid' ? 'success' : 'warning'}>{managerStatusLabel(reservation.payment.status, 'vi')}</Badge></Td><Td><Badge variant="info">{managerStatusLabel(reservation.status, 'vi')}</Badge></Td><Td className="text-right">{canAssign ? <Button size="sm" variant="outline" onClick={() => openAssignment(reservation)}>{reservation.assignedUnitId ? 'Đổi gian' : 'Phân gian'}</Button> : <span className="text-xs text-stone-400">Chưa đủ điều kiện</span>}</Td></Tr> })}{!activeReservations.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">Không có đặt chỗ đang hiệu lực.</td></tr>}</Tbody></Table></Card>

    <div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={'Tìm hợp đồng, khách hàng, email hoặc gian…'} /><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{'Tất cả trạng thái'}</option><option value="active">{'Đang hiệu lực'}</option><option value="return_requested">{'Đã yêu cầu trả kho'}</option><option value="closing">{'Đang tất toán'}</option><option value="completed">{'Đã hoàn tất'}</option></Select></div>
    <Card><Table><Thead><tr><Th>{'Hợp đồng'}</Th><Th>{'Khách hàng'}</Th><Th>{'Gian kho'}</Th><Th>{'Thời hạn'}</Th><Th>{'Đơn giá'}</Th><Th>{'Thanh toán'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>
      {visibleRentals.map(rental => { const paymentStatus = isManagerRentalOverdue(rental) ? 'overdue' : rental.paymentStatus; return <Tr key={rental.id}><Td className="font-mono text-xs font-bold">{rental.id}</Td><Td><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="text-xs text-stone-400">{rental.customerEmail}</p></Td><Td><p className="font-mono font-bold">{rental.unitId}</p><p className="text-xs text-stone-400">{managerUnitTypeLabel(rental.unitType, 'vi')}</p></Td><Td><p>{rental.startDate}</p><p className="text-xs text-stone-400">→ {rental.endDate}</p></Td><Td className="font-mono">{formatVnd(rental.monthlyRate)}/tháng</Td><Td><Badge variant={paymentStatus === 'paid' ? 'success' : paymentStatus === 'overdue' ? 'error' : 'warning'}>{managerStatusLabel(paymentStatus, 'vi')}</Badge></Td><Td><Badge variant={rentalVariants[rental.status] || 'muted'}>{managerStatusLabel(rental.status, 'vi')}</Badge></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedRental(rental)}>{'Chi tiết'}</Button></Td></Tr> })}
      {!visibleRentals.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">{'Không có hợp đồng phù hợp.'}</td></tr>}
    </Tbody></Table></Card>

    <Modal open={Boolean(assignmentReservation)} onClose={() => { setAssignmentReservation(null); setAssignmentUnitId('') }} title="Phân gian kho vật lý">
      {assignmentReservation && <div className="space-y-4">
        <div className="rounded-lg bg-stone-50 p-3 text-sm">
          <p><b>{assignmentReservation.id}</b> · {assignmentReservation.customerName}</p>
          <p className="mt-1 text-stone-500">{assignmentReservation.unitTypeName} · {assignmentReservation.startDate} → {assignmentReservation.endDate}</p>
          {assignmentReservation.assignedUnitId && <p className="mt-1 text-stone-500">Gian hiện tại: <b className="font-mono">{assignmentReservation.assignedUnitId}</b></p>}
        </div>
        {assignmentCandidates.length ? <Select label="Gian kho phù hợp và không xung đột" value={assignmentUnitId} onChange={event => setAssignmentUnitId(event.target.value)}>
          {assignmentCandidates.map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {unit.zone} · Tầng {unit.floor}</option>)}
        </Select> : <ManagerActionNotice tone="warning">Không có gian kho cùng loại, đúng cơ sở và còn trống trong toàn bộ thời gian thuê.</ManagerActionNotice>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setAssignmentReservation(null); setAssignmentUnitId('') }}>Hủy</Button><Button disabled={!assignmentUnitId || assignmentUnitId === assignmentReservation.assignedUnitId} onClick={confirmAssignment}>{assignmentReservation.assignedUnitId ? 'Xác nhận đổi gian' : 'Xác nhận phân gian'}</Button></div>
      </div>}
    </Modal>

    <Modal open={Boolean(selectedRental)} onClose={() => setSelectedRental(null)} title={'Chi tiết hợp đồng thuê'} size="xl">
      {selectedRental && (() => {
        const rentalRenewals = renewals.filter(item => item.rentalId === selectedRental.id)
        const renewalIds = new Set(rentalRenewals.map(item => item.id))
        const rentalContracts = contracts
          .filter(item => item.id === selectedRental.contractId || item.reservationId === selectedRental.holdId || Boolean(item.renewalId && renewalIds.has(item.renewalId)))
          .sort((left, right) => new Date(left.signedAt).getTime() - new Date(right.signedAt).getTime())
        const latestRenewal = [...rentalRenewals].sort((left, right) => (right.requestedAt || '').localeCompare(left.requestedAt || ''))[0]
        const renewalActionReason = !latestRenewal
          ? 'Customer chưa gửi yêu cầu gia hạn nên Manager chưa có thao tác phê duyệt.'
          : latestRenewal.status === 'pending'
            ? 'Yêu cầu đang chờ Manager duyệt hoặc từ chối tại danh sách phía trên.'
            : ['approved', 'deposit_paid', 'payment_processing', 'appointment_scheduled'].includes(latestRenewal.status)
              ? 'Manager đã hoàn tất bước phê duyệt; hiện chờ Customer thanh toán hoặc Staff hoàn tất ký phụ lục.'
              : latestRenewal.status === 'completed'
                ? 'Gia hạn đã hoàn tất, không còn thao tác Manager cho yêu cầu này.'
                : `Yêu cầu đang ở trạng thái ${managerStatusLabel(latestRenewal.status, 'vi')}; Customer cần tạo hoặc tiếp tục luồng phù hợp trước khi Manager có thể xử lý.`
        return <div className="space-y-5 text-sm">
          <div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <p><span className="text-stone-400">Mã hồ sơ thuê</span><br /><b className="font-mono">{selectedRental.id}</b></p>
            <p><span className="text-stone-400">Khách hàng</span><br /><b>{selectedRental.customerName}</b></p>
            <p><span className="text-stone-400">Gian kho</span><br /><b className="font-mono">{selectedRental.unitId}</b></p>
            <p><span className="text-stone-400">Thời hạn</span><br /><b>{selectedRental.startDate} → {selectedRental.endDate}</b></p>
            <p><span className="text-stone-400">Kỳ thu tiếp theo</span><br /><b>{selectedRental.nextDue}</b></p>
            <p><span className="text-stone-400">Tiền đảm bảo kho</span><br /><b>{formatVnd(selectedRental.securityDeposit)}</b></p>
            <p><span className="text-stone-400">Đơn giá hiện tại</span><br /><b>{formatVnd(selectedRental.monthlyRate)}/tháng</b></p>
            <p><span className="text-stone-400">Thanh toán</span><br /><Badge variant={isManagerRentalOverdue(selectedRental) ? 'error' : selectedRental.paymentStatus === 'paid' ? 'success' : 'warning'}>{managerStatusLabel(isManagerRentalOverdue(selectedRental) ? 'overdue' : selectedRental.paymentStatus, 'vi')}</Badge></p>
            <p><span className="text-stone-400">Quyền truy cập</span><br /><b>{selectedRental.overlocked ? 'ĐÃ KHÓA' : selectedRental.gateCode || 'ĐÃ THU HỒI'}</b></p>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><p className="font-semibold text-stone-900">Bản ghi hợp đồng trong database</p><p className="mt-1 text-xs text-stone-500">Đối chiếu theo mã hợp đồng, mã đặt chỗ và các phụ lục gia hạn của hồ sơ thuê.</p></div>
              <Badge variant={rentalContracts.length ? 'success' : 'warning'}>{rentalContracts.length} bản ghi</Badge>
            </div>
            {rentalContracts.length ? <div className="space-y-4">{rentalContracts.map((contract, index) => {
              const fileAvailable = Boolean(contract.scannedFileUrl && !contract.scannedFileUrl.includes('...'))
              const isImage = contract.scannedFileUrl.startsWith('data:image/') || /\.(png|jpe?g|webp)(\?.*)?$/i.test(contract.scannedFileUrl)
              return <details key={contract.id} open={index === 0} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <summary className="cursor-pointer bg-stone-50 px-4 py-3"><span className="font-semibold text-stone-900">{contract.contractNumber}</span><span className="ml-2 text-xs text-stone-500">{contract.contractType === 'RENEWAL' ? 'Phụ lục gia hạn' : 'Hợp đồng ban đầu'} · {contract.status}</span></summary>
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <p><span className="text-stone-400">ID database</span><br /><b className="font-mono">{contract.id}</b></p>
                    <p><span className="text-stone-400">Mã đặt chỗ</span><br /><b className="font-mono">{contract.reservationId}</b></p>
                    <p><span className="text-stone-400">Mã khách hàng</span><br /><b className="font-mono">{contract.customerId}</b></p>
                    <p><span className="text-stone-400">Gian kho</span><br /><b className="font-mono">{contract.unitId || selectedRental.unitId}</b></p>
                    <p><span className="text-stone-400">Ngày ký</span><br /><b>{new Date(contract.signedAt).toLocaleString('vi-VN')}</b></p>
                    <p><span className="text-stone-400">Hiệu lực</span><br /><b>{contract.startDate} → {contract.endDate}</b></p>
                    <p><span className="text-stone-400">Giá thuê trên hợp đồng</span><br /><b>{formatVnd(contract.monthlyRent)}/tháng</b></p>
                    <p><span className="text-stone-400">Tiền đảm bảo</span><br /><b>{formatVnd(contract.securityDeposit)}</b></p>
                    <p><span className="text-stone-400">Tệp đã lưu</span><br /><b>{contract.scannedFileName || 'Chưa có tên tệp'}</b></p>
                    <p><span className="text-stone-400">Người tải lên</span><br /><b>{contract.uploadedBy}</b></p>
                    <p><span className="text-stone-400">Thời điểm tải lên</span><br /><b>{new Date(contract.uploadedAt).toLocaleString('vi-VN')}</b></p>
                    {contract.renewalId && <p><span className="text-stone-400">Mã gia hạn</span><br /><b className="font-mono">{contract.renewalId}</b></p>}
                  </div>
                  {fileAvailable ? <>
                    <div className="flex flex-wrap gap-2"><a href={contract.scannedFileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">Mở bản scan</a><a href={contract.scannedFileUrl} download={contract.scannedFileName} className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black">Tải xuống</a></div>
                    {isImage ? <img src={contract.scannedFileUrl} alt={`Bản scan ${contract.contractNumber}`} className="max-h-[520px] w-full rounded-lg border border-stone-200 object-contain" /> : <iframe title={`Bản scan ${contract.contractNumber}`} src={contract.scannedFileUrl} className="h-[520px] w-full rounded-lg border border-stone-200 bg-stone-50" />}
                  </> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Database có metadata hợp đồng nhưng chưa có nội dung tệp scan hợp lệ để hiển thị. Bản ghi hiện tại chỉ lưu tên hoặc dữ liệu mẫu rút gọn.</div>}
                </div>
              </details>
            })}</div> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">Không tìm thấy bản ghi hợp đồng tương ứng trong database. Hệ thống không tạo hợp đồng giả để thay thế.</div>}
          </div>

          <ManagerActionNotice tone={latestRenewal?.status === 'pending' ? 'warning' : latestRenewal?.status === 'completed' ? 'success' : 'info'}>{renewalActionReason}</ManagerActionNotice>
          <div><p className="mb-2 font-semibold">Lịch sử gia hạn</p>{rentalRenewals.length ? rentalRenewals.map(item => <p key={item.id} className="border-t border-stone-100 py-2">{item.id} · {managerStatusLabel(item.status, 'vi')} · {item.oldEndDate} → {item.newEndDate}</p>) : <p className="text-stone-400">Chưa có yêu cầu gia hạn.</p>}</div>
          <div className="flex justify-end"><Button variant="outline" onClick={() => setSelectedRental(null)}>Đóng</Button></div>
        </div>
      })()}
    </Modal>
  </div>
}
