import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { BusinessConfig, RentalRecord, StoragePayment } from '../../types/storageHub'
import { billingPeriodsDue, rentalAmountDue } from '../../domain/managerRules'
import { managerPaymentMethodLabel, managerPaymentTypeLabel, managerStatusLabel } from './managerI18n'

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
  const { lang, formatCurrency } = useLanguage()
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY'>('BANK_TRANSFER')
  const [reference, setReference] = useState('')

  const facilityRentals = useMemo(() => rentals.filter(rental => !user.facility || user.facility === 'All facilities' || rental.facilityName === user.facility || rental.facilityId === user.facility), [rentals, user.facility])
  const facilityRentalIds = new Set(facilityRentals.map(rental => rental.id))
  const facilityPayments = payments.filter(payment => payment.rentalId ? facilityRentalIds.has(payment.rentalId) : facilityRentals.some(rental => rental.holdId === payment.reservationId))
  const overdueRentals = facilityRentals.filter(rental => rental.status === 'active' && rental.paymentStatus === 'overdue')
  const collected = facilityPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + payment.amount, 0)
  const outstanding = overdueRentals.reduce((sum, rental) => sum + rentalAmountDue(rental), 0)

  const run = (action: () => void, success: string) => {
    try { action(); showToast(success); return true } catch (error) { showToast(error instanceof Error ? error.message : (lang === 'vi' ? 'Không thể thực hiện thao tác.' : 'Unable to complete the action.')); return false }
  }

  const openPayment = (rental: RentalRecord) => {
    setSelectedRental(rental)
    setPaymentMethod('BANK_TRANSFER')
    setReference(`REC-${Date.now().toString().slice(-8)}`)
  }

  const confirmPayment = () => {
    if (!selectedRental) return
    const amount = rentalAmountDue(selectedRental)
    if (run(() => recordRentalPayment(selectedRental.id, amount, paymentMethod, reference, user), lang === 'vi' ? 'Đã ghi nhận đủ các kỳ thanh toán còn nợ và mở lại quyền truy cập.' : 'All due billing periods were recorded and access was restored.')) setSelectedRental(null)
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={lang === 'vi' ? 'Tài chính cơ sở' : 'Facility finance'} title={lang === 'vi' ? 'Thanh toán & Công nợ' : 'Payments & Delinquency'} subtitle={lang === 'vi' ? 'Thu cước, áp dụng hoặc miễn phí trễ, nhắc nợ và khóa quyền truy cập có lưu nhật ký.' : 'Payments, late fees, reminders and access suspension with audit history.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={lang === 'vi' ? 'Đã thu' : 'Collected'} value={formatCurrency(collected)} icon={Icon.dollar} /><StatCard title={lang === 'vi' ? 'Đang quá hạn' : 'Overdue accounts'} value={overdueRentals.length} icon={Icon.alert} /><StatCard title={lang === 'vi' ? 'Tổng cần thu' : 'Outstanding'} value={formatCurrency(outstanding)} icon={Icon.credit} /><StatCard title={lang === 'vi' ? 'Đang khóa truy cập' : 'Access suspended'} value={overdueRentals.filter(rental => rental.overlocked).length} icon={Icon.key} /></div>

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">{lang === 'vi' ? 'Tài khoản quá hạn' : 'Delinquent accounts'}</h3><p className="text-xs text-stone-500">{lang === 'vi' ? 'Mọi thay đổi cập nhật trực tiếp hợp đồng thuê, quyền truy cập, thanh toán và nhật ký hoạt động.' : 'Actions update rentals, credentials, payments and the audit log.'}</p></div><Table><Thead><tr><Th>{lang === 'vi' ? 'Khách / gian' : 'Customer / unit'}</Th><Th>{lang === 'vi' ? 'Hạn thanh toán' : 'Due date'}</Th><Th>{lang === 'vi' ? 'Quá hạn' : 'Age'}</Th><Th>{lang === 'vi' ? 'Tổng cần thu' : 'Amount due'}</Th><Th>{lang === 'vi' ? 'Phí trễ' : 'Late fee'}</Th><Th>{lang === 'vi' ? 'Truy cập' : 'Access'}</Th><Th>{lang === 'vi' ? 'Nhắc nợ' : 'Reminders'}</Th><Th /></tr></Thead><Tbody>
      {overdueRentals.map(rental => <Tr key={rental.id}><Td><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="font-mono text-xs text-stone-400">{rental.unitId} · {rental.id}</p></Td><Td>{rental.nextDue}<p className="text-xs text-stone-400">{billingPeriodsDue(rental.nextDue)} {lang === 'vi' ? 'kỳ cần thu' : 'period(s) due'}</p></Td><Td><Badge variant="error">{overdueDays(rental.nextDue)} {lang === 'vi' ? 'ngày' : 'days'}</Badge></Td><Td className="font-mono">{formatCurrency(rentalAmountDue(rental))}</Td><Td><span className="font-mono">{formatCurrency(rental.lateFeeAmount || 0)}</span><div className="mt-1 flex gap-1">{!rental.lateFeeProcessedForDueDate && <button className="text-xs font-semibold text-amber-700 underline" onClick={() => run(() => applyRentalLateFee(rental.id, config.lateFeeAmount, user), lang === 'vi' ? 'Đã áp dụng phí trễ.' : 'Late fee applied.')}>+{formatCurrency(config.lateFeeAmount)}</button>}{(rental.lateFeeAmount || 0) > 0 && <button className="text-xs font-semibold text-stone-500 underline" onClick={() => run(() => waiveRentalLateFee(rental.id, user), lang === 'vi' ? 'Đã miễn phí trễ.' : 'Late fee waived.')}>{lang === 'vi' ? 'Miễn phí' : 'Waive'}</button>}{rental.lateFeeProcessedForDueDate && !(rental.lateFeeAmount || 0) && <span className="text-xs text-stone-400">{lang === 'vi' ? 'Đã xử lý kỳ này' : 'Processed for this period'}</span>}</div></Td><Td><Badge variant={rental.overlocked ? 'error' : 'success'}>{managerStatusLabel(rental.overlocked ? 'SUSPENDED' : 'ACTIVE', lang)}</Badge><div className="mt-1"><button className="text-xs font-semibold text-stone-600 underline" onClick={() => run(() => setRentalOverlock(rental.id, !rental.overlocked, user), rental.overlocked ? (lang === 'vi' ? 'Đã mở lại truy cập.' : 'Access restored.') : (lang === 'vi' ? 'Đã khóa truy cập.' : 'Access suspended.'))}>{rental.overlocked ? (lang === 'vi' ? 'Mở khóa' : 'Restore') : (lang === 'vi' ? 'Khóa mã truy cập' : 'Suspend')}</button></div></Td><Td><p>{rental.remindersSent || 0}</p><button className="text-xs font-semibold text-amber-700 underline" onClick={() => run(() => sendDelinquencyReminder(rental.id, user), lang === 'vi' ? 'Đã ghi nhận gửi nhắc nợ.' : 'Reminder logged.')}>{lang === 'vi' ? 'Gửi nhắc' : 'Send'}</button></Td><Td className="text-right"><Button size="sm" onClick={() => openPayment(rental)}>{lang === 'vi' ? 'Thu tiền' : 'Collect'}</Button></Td></Tr>)}
      {!overdueRentals.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">{lang === 'vi' ? 'Không có tài khoản quá hạn.' : 'No delinquent accounts.'}</td></tr>}
    </Tbody></Table></Card>

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold">{lang === 'vi' ? 'Giao dịch gần đây' : 'Recent transactions'}</h3></div><Table><Thead><tr><Th>ID</Th><Th>{lang === 'vi' ? 'Loại' : 'Type'}</Th><Th>{lang === 'vi' ? 'Hợp đồng' : 'Rental'}</Th><Th>{lang === 'vi' ? 'Số tiền' : 'Amount'}</Th><Th>{lang === 'vi' ? 'Phương thức' : 'Method'}</Th><Th>{lang === 'vi' ? 'Trạng thái' : 'Status'}</Th><Th>{lang === 'vi' ? 'Ngày' : 'Date'}</Th></tr></Thead><Tbody>{facilityPayments.slice(0, 12).map(payment => <Tr key={payment.id}><Td className="font-mono text-xs">{payment.id}</Td><Td>{managerPaymentTypeLabel(payment.type, lang)}</Td><Td className="font-mono text-xs">{payment.rentalId || payment.reservationId}</Td><Td className="font-mono font-bold">{formatCurrency(payment.amount)}</Td><Td>{payment.paymentMethod ? managerPaymentMethodLabel(payment.paymentMethod, lang) : '—'}</Td><Td><Badge variant={payment.status === 'PAID' ? 'success' : 'warning'}>{managerStatusLabel(payment.status, lang)}</Badge></Td><Td>{payment.paidAt?.slice(0, 10) || payment.receivedAt?.slice(0, 10) || '—'}</Td></Tr>)}</Tbody></Table></Card>

    <Modal open={Boolean(selectedRental)} onClose={() => setSelectedRental(null)} title={lang === 'vi' ? 'Ghi nhận thu cước' : 'Record rental payment'}>{selectedRental && <div className="space-y-4"><div className="rounded-lg bg-stone-50 p-3 text-sm"><p className="font-semibold">{selectedRental.customerName} · <span className="font-mono">{selectedRental.unitId}</span></p><p className="mt-1 text-stone-500">{lang === 'vi' ? 'Cần thu' : 'Amount due'}: <b>{formatCurrency(rentalAmountDue(selectedRental))}</b> · {billingPeriodsDue(selectedRental.nextDue)} {lang === 'vi' ? 'kỳ' : 'period(s)'}</p></div><label className="block text-sm font-medium text-stone-700">{lang === 'vi' ? 'Phương thức' : 'Method'}<select className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as typeof paymentMethod)}>{(['BANK_TRANSFER', 'CASH', 'ONLINE_GATEWAY'] as const).map(method => <option key={method} value={method}>{managerPaymentMethodLabel(method, lang)}</option>)}</select></label><Input label={lang === 'vi' ? 'Mã giao dịch / phiếu thu' : 'Transaction reference'} value={reference} onChange={event => setReference(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedRental(null)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button disabled={!reference.trim()} onClick={confirmPayment}>{lang === 'vi' ? 'Xác nhận thu' : 'Confirm payment'}</Button></div></div>}</Modal>
  </div>
}
