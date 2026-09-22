import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { RenewalRecord, RentalRecord, StorageContract } from '../../types/storageHub'
import { isFacilityVisible } from '../../domain/managerRules'

interface Props {
  user: User
  rentals: RentalRecord[]
  contracts: StorageContract[]
  renewals: RenewalRecord[]
  approveRenewal: (renewalId: string, manager: User) => void
  rejectRenewal: (renewalId: string, manager: User, reason: string) => void
  showToast: (message: string) => void
}

const rentalVariants: Record<string, string> = { active: 'success', return_requested: 'warning', return_inspection: 'warning', closing: 'warning', completed: 'muted' }

export default function ManagerRentalsPanel({ user, rentals, contracts, renewals, approveRenewal, rejectRenewal, showToast }: Props) {
    const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null)

  const facilityRentals = useMemo(() => rentals.filter(rental => isFacilityVisible(user, rental.facilityId, rental.facilityName)), [rentals, user])
  const facilityRenewals = renewals.filter(renewal => facilityRentals.some(rental => rental.id === renewal.rentalId))
  const visibleRentals = facilityRentals.filter(rental => {
    const normalized = query.trim().toLowerCase()
    return (filter === 'all' || rental.status === filter) && (!normalized || [rental.id, rental.customerName, rental.customerEmail, rental.unitId].some(value => value.toLowerCase().includes(normalized)))
  })

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
    <SectionHeader eyebrow={'Hợp đồng thuê'} title="Rentals" subtitle={'Theo dõi hợp đồng, thời hạn và phê duyệt gia hạn thuộc cơ sở.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Tổng hồ sơ'} value={facilityRentals.length} icon={Icon.policy} /><StatCard title={'Đang hiệu lực'} value={facilityRentals.filter(rental => rental.status === 'active').length} icon={Icon.check} /><StatCard title={'Sắp hết hạn 30 ngày'} value={facilityRentals.filter(rental => { const days = (new Date(rental.endDate).getTime() - Date.now()) / 86_400_000; return rental.status === 'active' && days >= 0 && days <= 30 }).length} icon={Icon.clock} /><StatCard title={'Chờ duyệt gia hạn'} value={facilityRenewals.filter(renewal => renewal.status === 'pending').length} icon={Icon.refresh} /></div>

    {facilityRenewals.some(renewal => renewal.status === 'pending') && <Card className="border-amber-200 p-4"><div className="mb-3"><h3 className="font-bold text-stone-900">{'Yêu cầu gia hạn chờ duyệt'}</h3><p className="text-xs text-stone-500">{'Store kiểm tra xung đột lịch lại khi Manager duyệt.'}</p></div><div className="space-y-3">{facilityRenewals.filter(renewal => renewal.status === 'pending').map(renewal => <div key={renewal.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{renewal.customerName} · <span className="font-mono">{renewal.unitId}</span></p><p className="text-xs text-stone-500">{renewal.oldEndDate} → {renewal.newEndDate} · {renewal.renewalMonths} tháng · {formatVnd(renewal.renewalFee)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decideRenewal(renewal, false)}>{'Từ chối'}</Button><Button size="sm" onClick={() => decideRenewal(renewal, true)}>{'Duyệt'}</Button></div></div>)}</div></Card>}

    <div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={'Tìm hợp đồng, khách hàng, email hoặc gian…'} /><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{'Tất cả trạng thái'}</option><option value="active">Active</option><option value="return_requested">Return requested</option><option value="closing">Closing</option><option value="completed">Completed</option></Select></div>
    <Card><Table><Thead><tr><Th>{'Hợp đồng'}</Th><Th>{'Khách hàng'}</Th><Th>{'Gian kho'}</Th><Th>{'Thời hạn'}</Th><Th>{'Đơn giá'}</Th><Th>{'Thanh toán'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>
      {visibleRentals.map(rental => <Tr key={rental.id}><Td className="font-mono text-xs font-bold">{rental.id}</Td><Td><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="text-xs text-stone-400">{rental.customerEmail}</p></Td><Td><p className="font-mono font-bold">{rental.unitId}</p><p className="text-xs text-stone-400">{rental.unitType}</p></Td><Td><p>{rental.startDate}</p><p className="text-xs text-stone-400">→ {rental.endDate}</p></Td><Td className="font-mono">{formatVnd(rental.monthlyRate)}/tháng</Td><Td><Badge variant={rental.paymentStatus === 'paid' ? 'success' : rental.paymentStatus === 'overdue' ? 'error' : 'warning'}>{rental.paymentStatus}</Badge></Td><Td><Badge variant={rentalVariants[rental.status] || 'muted'}>{rental.status}</Badge></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedRental(rental)}>{'Chi tiết'}</Button></Td></Tr>)}
      {!visibleRentals.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">{'Không có hợp đồng phù hợp.'}</td></tr>}
    </Tbody></Table></Card>

    <Modal open={Boolean(selectedRental)} onClose={() => setSelectedRental(null)} title={'Chi tiết hợp đồng thuê'} size="lg">{selectedRental && (() => { const contract = contracts.find(item => item.id === selectedRental.contractId || item.reservationId === selectedRental.holdId); const rentalRenewals = renewals.filter(item => item.rentalId === selectedRental.id); return <div className="space-y-4 text-sm"><div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2"><p><span className="text-stone-400">Khách hàng</span><br /><b>{selectedRental.customerName}</b></p><p><span className="text-stone-400">Gian kho</span><br /><b className="font-mono">{selectedRental.unitId}</b></p><p><span className="text-stone-400">Thời hạn</span><br /><b>{selectedRental.startDate} → {selectedRental.endDate}</b></p><p><span className="text-stone-400">Kỳ thu tiếp theo</span><br /><b>{selectedRental.nextDue}</b></p><p><span className="text-stone-400">Tiền đảm bảo kho</span><br /><b>{formatVnd(selectedRental.securityDeposit)}</b></p><p><span className="text-stone-400">Quyền truy cập</span><br /><b>{selectedRental.overlocked ? 'ĐÃ KHÓA' : selectedRental.gateCode || 'ĐÃ THU HỒI'}</b></p></div>{contract && <div className="rounded-lg border border-stone-200 p-3"><p className="font-semibold">{contract.contractNumber}</p><p className="text-xs text-stone-500">Đã ký {contract.signedAt} · {contract.scannedFileName}</p></div>}<div><p className="mb-2 font-semibold">{'Lịch sử gia hạn'}</p>{rentalRenewals.length ? rentalRenewals.map(item => <p key={item.id} className="border-t border-stone-100 py-2">{item.id} · {item.status} · {item.oldEndDate} → {item.newEndDate}</p>) : <p className="text-stone-400">{'Chưa có yêu cầu gia hạn.'}</p>}</div><div className="flex justify-end"><Button variant="outline" onClick={() => setSelectedRental(null)}>{'Đóng'}</Button></div></div> })()}</Modal>
  </div>
}
