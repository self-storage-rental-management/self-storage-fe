import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVnd } from '../../i18n/currency'
import type { User } from '../../types'
import type { BusinessConfig, RentalRecord, StoragePayment } from '../../types/storageHub'
import {
  billingPeriodsDue,
  canApplyManagerLateFee,
  isManagerFacilityVisible,
  isManagerRentalOverdue,
  rentalAmountDue
} from '../../domain/managerRules'
import { managerPaymentMethodLabel, managerPaymentTypeLabel, managerStatusLabel } from './managerI18n'
import ManagerActionNotice from './ManagerActionNotice'

interface Props {
  user: User
  rentals: RentalRecord[]
  payments: StoragePayment[]
  config: BusinessConfig
  recordRentalPayment: (rentalId: string, amount: number, method: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY', reference: string, manager: User) => void
  applyRentalLateFee: (rentalId: string, amount: number, manager: User) => void
  waiveRentalLateFee: (rentalId: string, manager: User) => void
  setRentalOverlock: (rentalId: string, overlocked: boolean, manager: User) => void
  sendDelinquencyReminder: (rentalId: string, manager: User) => void
  showToast: (message: string) => void
}

function overdueDays(date: string) {
  const due = new Date(date)
  if (Number.isNaN(due.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86_400_000))
}

export default function ManagerPaymentsPanel({ user, rentals, payments, config, recordRentalPayment, applyRentalLateFee, waiveRentalLateFee, setRentalOverlock, sendDelinquencyReminder, showToast }: Props) {
    const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY'>('BANK_TRANSFER')
  const [reference, setReference] = useState('')

  const facilityRentals = useMemo(() => rentals.filter(rental => isManagerFacilityVisible(user, rental.facilityId, rental.facilityName)), [rentals, user])
  const facilityRentalIds = new Set(facilityRentals.map(rental => rental.id))
  const facilityPayments = payments.filter(payment => payment.rentalId ? facilityRentalIds.has(payment.rentalId) : facilityRentals.some(rental => rental.holdId === payment.reservationId))
  const overdueRentals = facilityRentals.filter(rental => isManagerRentalOverdue(rental))
  const collected = facilityPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
  const outstanding = overdueRentals.reduce((sum, rental) => sum + rentalAmountDue(rental), 0)

  const run = (action: () => void, success: string) => {
    try { action(); showToast(success); return true } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.'); return false }
  }

  const openPayment = (rental: RentalRecord) => {
    setSelectedRental(rental)
    setPaymentMethod('BANK_TRANSFER')
    setReference('')
  }

  const confirmPayment = () => {
    if (!selectedRental) return
    const amount = rentalAmountDue(selectedRental)
    if (run(() => recordRentalPayment(selectedRental.id, amount, paymentMethod, reference, user), 'Đã ghi nhận thanh toán và mở lại quyền truy cập.')) {
      setSelectedRental(null)
    }
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Tài chính cơ sở'} title="Lịch sử thanh toán & Công nợ" subtitle={'Thu cước, áp dụng/miễn phí trễ, nhắc nợ và khóa quyền truy cập có lưu nhật ký.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Đã thu'} value={formatVnd(collected)} icon={Icon.dollar} /><StatCard title={'Đang quá hạn'} value={overdueRentals.length} icon={Icon.alert} /><StatCard title={'Tổng cần thu'} value={formatVnd(outstanding)} icon={Icon.credit} /><StatCard title={'Đang khóa truy cập'} value={overdueRentals.filter(rental => rental.overlocked).length} icon={Icon.key} /></div>

    <ManagerActionNotice tone={overdueRentals.length ? 'warning' : 'success'}>{overdueRentals.length ? `${overdueRentals.length} hợp đồng đang quá hạn; Manager có thể áp dụng phí, nhắc nợ, khóa truy cập hoặc ghi nhận thu tiền.` : 'Không có hợp đồng đang hiệu lực ở trạng thái quá hạn. Các hợp đồng đã thanh toán đúng hạn chỉ được hiển thị trong lịch sử và chưa cần Manager thao tác.'}</ManagerActionNotice>

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">{'Tài khoản quá hạn'}</h3><p className="text-xs text-stone-500">{'Mọi thay đổi cập nhật trực tiếp hợp đồng thuê, quyền truy cập, thanh toán và nhật ký hoạt động.'}</p></div><Table><Thead><tr><Th>{'Khách / gian'}</Th><Th>{'Hạn thanh toán'}</Th><Th>{'Quá hạn'}</Th><Th>{'Tiền thuê'}</Th><Th>{'Phí trễ'}</Th><Th>{'Truy cập'}</Th><Th>{'Nhắc nợ'}</Th><Th /></tr></Thead><Tbody>
      {overdueRentals.map(rental => <Tr key={rental.id}><Td><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="font-mono text-xs text-stone-400">{rental.unitId} · {rental.id}</p></Td><Td>{rental.nextDue}</Td><Td><Badge variant="error">{overdueDays(rental.nextDue)} {'ngày'}</Badge></Td><Td className="font-mono"><p>{formatVnd(rental.monthlyRate)}</p><p className="text-xs text-stone-500">{billingPeriodsDue(rental.nextDue)} kỳ · {formatVnd(rentalAmountDue({ ...rental, lateFeeAmount: 0 }))}</p></Td><Td><span className="font-mono">{formatVnd(rental.lateFeeAmount || 0)}</span><div className="mt-1 flex gap-1">{canApplyManagerLateFee(rental) ? <button className="text-xs font-semibold text-amber-700 underline" onClick={() => run(() => applyRentalLateFee(rental.id, config.lateFeeAmount, user), 'Đã áp dụng phí trễ.')}>+{formatVnd(config.lateFeeAmount)}</button> : <span className="text-xs text-stone-400">Đã xử lý kỳ này</span>}{(rental.lateFeeAmount || 0) > 0 && <button className="text-xs font-semibold text-stone-500 underline" onClick={() => run(() => waiveRentalLateFee(rental.id, user), 'Đã miễn phí trễ.')}>{'Miễn phí'}</button>}</div></Td><Td><Badge variant={rental.overlocked ? 'error' : 'success'}>{managerStatusLabel(rental.overlocked ? 'SUSPENDED' : 'ACTIVE', 'vi')}</Badge><div className="mt-1"><button className="text-xs font-semibold text-stone-600 underline" onClick={() => run(() => setRentalOverlock(rental.id, !rental.overlocked, user), rental.overlocked ? ('Đã mở lại truy cập.') : ('Đã khóa truy cập.'))}>{rental.overlocked ? ('Mở khóa') : ('Khóa PIN')}</button></div></Td><Td><p>{rental.remindersSent || 0}</p><button className="text-xs font-semibold text-amber-700 underline" onClick={() => run(() => sendDelinquencyReminder(rental.id, user), 'Đã ghi nhận gửi nhắc nợ.')}>{'Gửi nhắc'}</button></Td><Td className="text-right"><Button size="sm" onClick={() => openPayment(rental)}>{'Thu tiền'}</Button></Td></Tr>)}
      {!overdueRentals.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500"><b>Không có tài khoản quá hạn.</b><p className="mt-1">Thao tác thu nợ, phí trễ và khóa PIN chỉ xuất hiện khi hợp đồng đang hiệu lực có trạng thái thanh toán quá hạn.</p></td></tr>}
    </Tbody></Table></Card>

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold">{'Giao dịch gần đây'}</h3></div><Table><Thead><tr><Th>ID</Th><Th>{'Loại'}</Th><Th>{'Hợp đồng'}</Th><Th>{'Số tiền'}</Th><Th>{'Phương thức'}</Th><Th>{'Trạng thái'}</Th><Th>{'Ngày'}</Th></tr></Thead><Tbody>{facilityPayments.slice(0, 12).map(payment => <Tr key={payment.id}><Td className="font-mono text-xs">{payment.id}</Td><Td>{managerPaymentTypeLabel(payment.type, 'vi')}</Td><Td className="font-mono text-xs">{payment.rentalId || payment.reservationId}</Td><Td className="font-mono font-bold">{formatVnd(payment.amount)}</Td><Td>{managerPaymentMethodLabel(payment.paymentMethod || '', 'vi') || '—'}</Td><Td><Badge variant={payment.status === 'PAID' ? 'success' : 'warning'}>{managerStatusLabel(payment.status, 'vi')}</Badge></Td><Td>{payment.paidAt?.slice(0, 10) || payment.receivedAt?.slice(0, 10) || '—'}</Td></Tr>)}</Tbody></Table></Card>

    <Modal open={Boolean(selectedRental)} onClose={() => setSelectedRental(null)} title={'Ghi nhận thu cước'}>{selectedRental && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><p className="font-semibold">{selectedRental.customerName} · <span className="font-mono">{selectedRental.unitId}</span></p><p className="mt-1 text-stone-500">Số kỳ cần thu: <b>{billingPeriodsDue(selectedRental.nextDue)}</b></p><p className="mt-1 text-stone-500">{'Cần thu'}: <b>{formatVnd(rentalAmountDue(selectedRental))}</b></p></div><label className="block text-sm font-medium text-stone-700">{'Phương thức'}<select className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="BANK_TRANSFER">Chuyển khoản</option><option value="CASH">Tiền mặt</option><option value="ONLINE_GATEWAY">Cổng thanh toán</option></select></label><Input label={'Mã giao dịch / phiếu thu'} value={reference} onChange={event => setReference(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedRental(null)}>{'Hủy'}</Button><Button disabled={!reference.trim()} onClick={confirmPayment}>{'Xác nhận thu'}</Button></div></div>}</Modal>
  </div>
}
