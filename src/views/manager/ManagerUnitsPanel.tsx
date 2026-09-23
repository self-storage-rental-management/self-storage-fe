import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { User } from '../../types'
import type { StorageReservation, StorageUnit } from '../../types/storageHub'
import { isFacilityVisible } from '../../domain/managerRules'
import { managerStatusLabel } from './managerI18n'

interface ManagerUnitsPanelProps {
  user: User
  storeHolds: StorageReservation[]
  storeUnits: StorageUnit[]
  approveReservation: (reservationId: string, manager: User) => void
  rejectGoodsReview: (reservationId: string, manager: User, note: string) => void
  showToast: (message: string) => void
}

function reviewStatusLabel(status?: StorageReservation['goodsReviewStatus']) {
  if (status === 'PENDING') return 'Chờ Manager duyệt'
  if (status === 'APPROVED') return 'Đã chấp thuận'
  if (status === 'REJECTED') return 'Đã từ chối'
  return 'Tự động chấp thuận'
}

function statusVariant(status?: StorageReservation['goodsReviewStatus']) {
  if (status === 'PENDING') return 'warning'
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'error'
  return 'muted'
}

export default function ManagerUnitsPanel({ user, storeHolds, storeUnits, approveReservation, rejectGoodsReview, showToast }: ManagerUnitsPanelProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending')
  const [selectedReservation, setSelectedReservation] = useState<StorageReservation | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const facilityReservations = useMemo(() => storeHolds.filter(reservation => isFacilityVisible(user, reservation.facilityId, reservation.facilityName)), [storeHolds, user])
  const filteredReservations = facilityReservations.filter(reservation => {
    const normalized = query.trim().toLowerCase()
    const selectedUnit = storeUnits.find(unit => unit.id === reservation.assignedUnitId)
    const matchesQuery = !normalized || [reservation.id, reservation.customerName, reservation.customerEmail, reservation.unitTypeName, selectedUnit?.code || ''].some(value => value.toLowerCase().includes(normalized))
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'pending' && reservation.goodsReviewStatus === 'PENDING') || (statusFilter === 'approved' && reservation.goodsReviewStatus === 'APPROVED') || (statusFilter === 'rejected' && reservation.goodsReviewStatus === 'REJECTED')
    return matchesQuery && matchesStatus
  })

  const openReview = (reservation: StorageReservation) => { setSelectedReservation(reservation); setRejectNote('') }
  const approve = () => {
    if (!selectedReservation) return
    try { approveReservation(selectedReservation.id, user); showToast(`Đã chấp thuận hồ sơ ${selectedReservation.id}; khách đã được mở bước thanh toán cọc.`); setSelectedReservation(null) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể chấp thuận hồ sơ.') }
  }
  const reject = () => {
    if (!selectedReservation) return
    try { rejectGoodsReview(selectedReservation.id, user, rejectNote.trim() || 'Hàng hóa chưa phù hợp điều kiện tiếp nhận của kho.'); showToast(`Đã từ chối hồ sơ ${selectedReservation.id}; khách sẽ nhận được thông báo và gian kho đã được mở lại.`); setSelectedReservation(null) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể từ chối hồ sơ.') }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader eyebrow="Vận hành đặt chỗ" title="Duyệt hồ sơ hàng hóa" subtitle="Chỉ đơn có hàng hóa “Khác” mới cần Manager duyệt trong 24 giờ. Gian kho khách đã chọn được giữ nguyên trong thời gian chờ." />
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã đơn, khách hàng, email hoặc mã gian kho…" />
        <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="pending">Đang chờ duyệt</option><option value="all">Tất cả hồ sơ</option><option value="approved">Đã chấp thuận</option><option value="rejected">Đã từ chối</option>
        </Select>
      </div>
      <Card>
        <Table>
          <Thead><tr><Th>Đơn đặt</Th><Th>Khách hàng</Th><Th>Gian kho khách chọn</Th><Th>Kỳ thuê</Th><Th>Hạn xử lý</Th><Th>Trạng thái</Th><Th /></tr></Thead>
          <Tbody>
            {filteredReservations.map(reservation => {
              const selectedUnit = storeUnits.find(unit => unit.id === reservation.assignedUnitId)
              return <Tr key={reservation.id}>
                <Td className="font-mono text-xs font-bold">{reservation.id}</Td>
                <Td><p className="font-semibold text-stone-900">{reservation.customerName}</p><p className="text-xs text-stone-400">{reservation.customerEmail}</p></Td>
                <Td><p className="font-mono font-bold">{selectedUnit?.code || reservation.unitId || '—'}</p><p className="text-xs text-stone-500">{reservation.facilityName}</p></Td>
                <Td><p>{reservation.startDate}</p><p className="text-xs text-stone-400">→ {reservation.endDate}</p></Td>
                <Td className="text-xs">{reservation.goodsReviewStatus === 'PENDING' && reservation.goodsReviewDueAt ? new Date(reservation.goodsReviewDueAt).toLocaleString('vi-VN') : '—'}</Td>
                <Td><Badge variant={statusVariant(reservation.goodsReviewStatus)}>{reviewStatusLabel(reservation.goodsReviewStatus)}</Badge><p className="mt-1 text-xs text-stone-500">{managerStatusLabel(reservation.status, 'vi')}</p></Td>
                <Td className="text-right"><Button size="sm" variant={reservation.goodsReviewStatus === 'PENDING' ? 'primary' : 'outline'} onClick={() => openReview(reservation)}>{reservation.goodsReviewStatus === 'PENDING' ? 'Mở hồ sơ' : 'Xem chi tiết'}</Button></Td>
              </Tr>
            })}
            {!filteredReservations.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Không có hồ sơ phù hợp.</td></tr>}
          </Tbody>
        </Table>
      </Card>
      <Modal open={Boolean(selectedReservation)} onClose={() => setSelectedReservation(null)} title="Duyệt hồ sơ hàng hóa" size="lg">
        {selectedReservation && (() => {
          const selectedUnit = storeUnits.find(unit => unit.id === selectedReservation.assignedUnitId)
          const isPending = selectedReservation.goodsReviewStatus === 'PENDING'
          return <div className="space-y-5">
            <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs text-stone-400">Đơn đặt</p><p className="font-mono font-bold">{selectedReservation.id}</p></div>
              <div><p className="text-xs text-stone-400">Cơ sở</p><p className="font-semibold">{selectedReservation.facilityName}</p></div>
              <div><p className="text-xs text-stone-400">Gian kho khách chọn</p><p className="font-mono font-semibold">{selectedUnit?.code || selectedReservation.unitId || '—'}</p></div>
              <div><p className="text-xs text-stone-400">Kỳ thuê</p><p className="font-semibold">{selectedReservation.startDate} → {selectedReservation.endDate}</p></div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-bold">Thông tin hàng hóa</p><p className="mt-2">Loại khai báo: <b>{selectedReservation.goods.category}</b></p><p>Số kiện: <b>{selectedReservation.goods.packageCount}</b> · Khối lượng: <b>{selectedReservation.goods.weightKg} kg</b></p>
              {selectedReservation.goods.notes && <p className="mt-2 whitespace-pre-wrap">Ghi chú: {selectedReservation.goods.notes}</p>}
              {selectedReservation.goods.items?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{selectedReservation.goods.items.map(item => <li key={item.id}>{item.customGoodsName || item.materialName || item.category} · {item.quantity || 1} kiện{item.description ? ` · ${item.description}` : ''}</li>)}</ul> : null}
            </div>
            {isPending && <><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-bold">Các điều kiện được xác minh khi chấp thuận</p><ul className="mt-2 grid gap-1 sm:grid-cols-2"><li>✓ Đúng cơ sở khách đã chọn</li><li>✓ Đúng loại gian kho</li><li>✓ Còn trống trong toàn bộ kỳ thuê</li><li>✓ Không trùng lịch giữ kho</li><li>✓ Không ở trạng thái bảo trì</li><li>✓ Gian kho được giữ trong thời gian duyệt</li></ul></div><label className="block text-sm font-medium text-stone-700">Lý do từ chối (nếu có)<textarea value={rejectNote} onChange={event => setRejectNote(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-stone-300 p-3 text-sm" placeholder="Nêu rõ lý do để khách điều chỉnh hàng hóa…" /></label></>}
            {!isPending && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700"><p>Trạng thái hồ sơ: <b>{reviewStatusLabel(selectedReservation.goodsReviewStatus)}</b></p>{selectedReservation.staffReviewNotes && <p className="mt-1">Ghi chú: {selectedReservation.staffReviewNotes}</p>}</div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedReservation(null)}>Đóng</Button>{isPending && <><Button variant="outline" onClick={reject}>Từ chối</Button><Button onClick={approve}>Chấp thuận</Button></>}</div>
          </div>
        })()}
      </Modal>
    </div>
  )
}
