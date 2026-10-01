import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
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
import ManagerPagination from './ManagerPagination'
import { formatManagerDate, managerDateValue, matchesManagerSearch, normalizeManagerMoney, paginateManagerItems } from './managerList'
import useManagerSoftDelete from './useManagerSoftDelete'

interface Props {
  user: User
  rentals: RentalRecord[]
  payments: StoragePayment[]
  config: BusinessConfig
  applyRentalLateFee: (rentalId: string, amount: number, manager: User) => void
  setRentalOverlock: (rentalId: string, overlocked: boolean, manager: User) => void
  sendDelinquencyReminder: (rentalId: string, manager: User) => void
  showToast: (message: string) => void
}

function overdueDays(date: string) {
  const due = new Date(date)
  if (Number.isNaN(due.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86_400_000))
}

export default function ManagerPaymentsPanel({ user, rentals, payments, config, applyRentalLateFee, setRentalOverlock, sendDelinquencyReminder, showToast }: Props) {
  const [query, setQuery] = useState('')
  const [lockFilter, setLockFilter] = useState('all')
  const [overdueSort, setOverdueSort] = useState('days-desc')
  const [overduePage, setOverduePage] = useState(1)
  const [overduePageSize, setOverduePageSize] = useState(10)
  const [transactionType, setTransactionType] = useState('all')
  const [transactionMethod, setTransactionMethod] = useState('all')
  const [transactionStatus, setTransactionStatus] = useState('all')
  const [transactionFrom, setTransactionFrom] = useState('')
  const [transactionTo, setTransactionTo] = useState('')
  const [transactionSort, setTransactionSort] = useState('newest')
  const [transactionPage, setTransactionPage] = useState(1)
  const [transactionPageSize, setTransactionPageSize] = useState(10)
  const [deleteTarget, setDeleteTarget] = useState<StoragePayment | null>(null)
  const paymentHistory = useManagerSoftDelete(`storagehub:manager:${user.id}:hidden-payments`)

  const facilityRentals = useMemo(() => rentals.filter(rental => isManagerFacilityVisible(user, rental.facilityId, rental.facilityName)), [rentals, user])
  const facilityRentalIds = new Set(facilityRentals.map(rental => rental.id))
  const facilityPayments = payments.filter(payment => payment.rentalId ? facilityRentalIds.has(payment.rentalId) : facilityRentals.some(rental => rental.holdId === payment.reservationId))
  const displayedPayments = facilityPayments.filter(payment => !paymentHistory.isHidden(payment.id))
  const hiddenPaymentCount = facilityPayments.length - displayedPayments.length
  const overdueRentals = facilityRentals.filter(rental => isManagerRentalOverdue(rental))
  const moneyValue = (value?: number) => normalizeManagerMoney(value) ?? 0
  const normalizedRentalAmountDue = (rental: RentalRecord) => rentalAmountDue({
    ...rental,
    monthlyRate: moneyValue(rental.monthlyRate),
    lateFeeAmount: moneyValue(rental.lateFeeAmount)
  })
  const collected = facilityPayments.filter(payment => payment.status === 'PAID' && payment.type !== 'REFUND').reduce((sum, payment) => sum + moneyValue(payment.amount), 0)
  const outstanding = overdueRentals.reduce((sum, rental) => sum + normalizedRentalAmountDue(rental), 0)
  const visibleOverdue = overdueRentals.filter(rental =>
    (lockFilter === 'all' || (lockFilter === 'locked' ? rental.overlocked : !rental.overlocked)) &&
    matchesManagerSearch(query, [rental.id, rental.customerId, rental.customerName, rental.customerEmail, rental.customerPhone, rental.unitId])
  ).sort((left, right) => {
    if (overdueSort === 'amount-desc') return normalizedRentalAmountDue(right) - normalizedRentalAmountDue(left)
    if (overdueSort === 'customer') return left.customerName.localeCompare(right.customerName, 'vi')
    return overdueDays(right.nextDue) - overdueDays(left.nextDue) || normalizedRentalAmountDue(right) - normalizedRentalAmountDue(left)
  })
  const overduePagination = paginateManagerItems(visibleOverdue, overduePage, overduePageSize)
  const visiblePayments = displayedPayments.filter(payment => {
    const rental = facilityRentals.find(item => item.id === payment.rentalId || item.holdId === payment.reservationId)
    const date = (payment.paidAt || payment.receivedAt || '').slice(0, 10)
    return (transactionType === 'all' || payment.type === transactionType) &&
      (transactionMethod === 'all' || payment.paymentMethod === transactionMethod) &&
      (transactionStatus === 'all' || payment.status === transactionStatus) &&
      (!transactionFrom || date >= transactionFrom) && (!transactionTo || date <= transactionTo) &&
      matchesManagerSearch(query, [payment.id, payment.rentalId, payment.reservationId, payment.transactionReference, payment.invoiceNumber, rental?.customerName, rental?.unitId])
  }).sort((left, right) => {
    if (transactionSort === 'oldest') return managerDateValue(left.paidAt || left.receivedAt) - managerDateValue(right.paidAt || right.receivedAt)
    if (transactionSort === 'amount-desc') return moneyValue(right.amount) - moneyValue(left.amount)
    const pendingDifference = Number(right.status === 'PENDING') - Number(left.status === 'PENDING')
    return pendingDifference || managerDateValue(right.paidAt || right.receivedAt) - managerDateValue(left.paidAt || left.receivedAt)
  })
  const paymentPagination = paginateManagerItems(visiblePayments, transactionPage, transactionPageSize)

  useEffect(() => setOverduePage(1), [query, lockFilter, overdueSort, overduePageSize])
  useEffect(() => setTransactionPage(1), [query, transactionType, transactionMethod, transactionStatus, transactionFrom, transactionTo, transactionSort, transactionPageSize])

  const run = (action: () => void, success: string) => {
    try { action(); showToast(success); return true } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.'); return false }
  }

  return <div className="fade-in space-y-5">
    <SectionHeader eyebrow={'Tài chính cơ sở'} title="Lịch sử thanh toán & Công nợ" subtitle={'Theo dõi thanh toán và xử lý hồ sơ quá hạn trong phạm vi chính sách hiện hành.'} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Đã thu'} value={formatVnd(collected)} icon={Icon.dollar} /><StatCard title={'Đang quá hạn'} value={overdueRentals.length} icon={Icon.alert} /><StatCard title={'Tổng cần thu'} value={formatVnd(outstanding)} icon={Icon.credit} /><StatCard title={'Đang khóa truy cập'} value={overdueRentals.filter(rental => rental.overlocked).length} icon={Icon.key} /></div>

    <ManagerActionNotice tone={overdueRentals.length ? 'warning' : 'success'}>{overdueRentals.length ? `${overdueRentals.length} hồ sơ thuê đang quá hạn; Manager có thể áp dụng mức phí đã cấu hình, nhắc nợ và khóa quyền truy cập. Việc thu tiền và miễn phí thuộc luồng có thẩm quyền riêng.` : 'Không có hồ sơ thuê đang hiệu lực ở trạng thái quá hạn. Các khoản đã thanh toán chỉ được hiển thị để theo dõi.'}</ManagerActionNotice>

    <Card className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm khách hàng, hồ sơ thuê, gian kho hoặc giao dịch…" /><Select value={lockFilter} onChange={event => setLockFilter(event.target.value)}><option value="all">Mọi trạng thái truy cập</option><option value="locked">Đang khóa truy cập</option><option value="unlocked">Chưa khóa truy cập</option></Select><Select value={overdueSort} onChange={event => setOverdueSort(event.target.value)}><option value="days-desc">Quá hạn lâu nhất</option><option value="amount-desc">Cần thu nhiều nhất</option><option value="customer">Tên khách hàng</option></Select><div className="flex items-center text-xs text-stone-500">Tìm kiếm áp dụng cho cả công nợ và giao dịch.</div></div></Card>

    <Card><div className="border-b border-stone-200 p-4"><h3 className="font-bold text-stone-900">{'Tài khoản quá hạn'}</h3><p className="text-xs text-stone-500">{'Manager theo dõi công nợ và thực hiện biện pháp vận hành; không trực tiếp thu tiền hoặc miễn phí.'}</p></div><Table><Thead><tr><Th>{'Khách / gian'}</Th><Th>{'Hạn thanh toán'}</Th><Th>{'Quá hạn'}</Th><Th>{'Tiền thuê'}</Th><Th>{'Phí trễ'}</Th><Th>{'Truy cập'}</Th><Th>{'Nhắc nợ'}</Th></tr></Thead><Tbody>
      {overduePagination.items.map(rental => <Tr key={rental.id}><Td><p className="font-semibold text-stone-900">{rental.customerName}</p><p className="font-mono text-xs text-stone-400">{rental.unitId} · {rental.id}</p></Td><Td>{formatManagerDate(rental.nextDue)}</Td><Td><Badge variant="error">{overdueDays(rental.nextDue)} {'ngày'}</Badge></Td><Td className="font-mono"><p>{formatVnd(moneyValue(rental.monthlyRate))}</p><p className="text-xs text-stone-500">{billingPeriodsDue(rental.nextDue)} kỳ · {formatVnd(rentalAmountDue({ ...rental, monthlyRate: moneyValue(rental.monthlyRate), lateFeeAmount: 0 }))}</p></Td><Td><span className="font-mono">{formatVnd(moneyValue(rental.lateFeeAmount))}</span><div className="mt-1 flex gap-1">{canApplyManagerLateFee(rental) ? <button className="text-xs font-semibold text-amber-700 underline" onClick={() => run(() => applyRentalLateFee(rental.id, config.lateFeeAmount, user), 'Đã áp dụng mức phí trễ theo cấu hình hiện hành.')}>+{formatVnd(config.lateFeeAmount)}</button> : <span className="text-xs text-stone-400">Đã xử lý kỳ này</span>}</div></Td><Td><Badge variant={rental.overlocked ? 'error' : 'success'}>{managerStatusLabel(rental.overlocked ? 'SUSPENDED' : 'ACTIVE', 'vi')}</Badge><div className="mt-1"><button className="text-xs font-semibold text-stone-600 underline" onClick={() => run(() => setRentalOverlock(rental.id, !rental.overlocked, user), rental.overlocked ? ('Đã mở lại truy cập.') : ('Đã khóa truy cập.'))}>{rental.overlocked ? ('Mở khóa') : ('Khóa truy cập')}</button></div></Td><Td><p>{rental.remindersSent || 0}</p><button className="text-xs font-semibold text-amber-700 underline" onClick={() => run(() => sendDelinquencyReminder(rental.id, user), 'Đã ghi nhận gửi nhắc nợ.')}>{'Gửi nhắc'}</button></Td></Tr>)}
      {!visibleOverdue.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500"><b>Không có tài khoản quá hạn phù hợp.</b><p className="mt-1">Hãy thay đổi từ khóa hoặc bộ lọc truy cập.</p></td></tr>}
    </Tbody></Table><ManagerPagination {...overduePagination} pageSize={overduePageSize} onPageChange={setOverduePage} onPageSizeChange={setOverduePageSize} /></Card>

    <Card><div className="border-b border-stone-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">{'Lịch sử giao dịch'}</h3>{hiddenPaymentCount > 0 && <p className="mt-1 text-xs text-stone-500">{hiddenPaymentCount} giao dịch đã được soft-delete khỏi danh sách; số liệu tổng hợp vẫn giữ nguyên.</p>}</div>{hiddenPaymentCount > 0 && <Button size="sm" variant="outline" onClick={() => paymentHistory.restoreAll()}>Khôi phục tất cả</Button>}</div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6"><Select value={transactionType} onChange={event => setTransactionType(event.target.value)}><option value="all">Tất cả loại</option>{Array.from(new Set(facilityPayments.map(item => item.type))).map(type => <option key={type} value={type}>{managerPaymentTypeLabel(type, 'vi')}</option>)}</Select><Select value={transactionMethod} onChange={event => setTransactionMethod(event.target.value)}><option value="all">Tất cả phương thức</option><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option><option value="ONLINE_GATEWAY">Cổng thanh toán</option></Select><Select value={transactionStatus} onChange={event => setTransactionStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="PAID">Đã thanh toán</option><option value="PENDING">Đang chờ</option></Select><Input aria-label="Giao dịch từ ngày" type="date" value={transactionFrom} onChange={event => setTransactionFrom(event.target.value)} /><Input aria-label="Giao dịch đến ngày" type="date" value={transactionTo} onChange={event => setTransactionTo(event.target.value)} /><Select value={transactionSort} onChange={event => setTransactionSort(event.target.value)}><option value="newest">Chờ xử lý / mới nhất</option><option value="oldest">Cũ nhất</option><option value="amount-desc">Số tiền lớn nhất</option></Select></div></div><Table><Thead><tr><Th>ID</Th><Th>{'Loại'}</Th><Th>{'Hồ sơ thuê'}</Th><Th>{'Số tiền'}</Th><Th>{'Phương thức'}</Th><Th>{'Trạng thái'}</Th><Th>{'Ngày'}</Th><Th /></tr></Thead><Tbody>{paymentPagination.items.map(payment => <Tr key={payment.id}><Td className="font-mono text-xs">{payment.id}</Td><Td>{managerPaymentTypeLabel(payment.type, 'vi')}</Td><Td className="font-mono text-xs">{payment.rentalId || payment.reservationId}</Td><Td className="font-mono font-bold">{formatVnd(moneyValue(payment.amount))}</Td><Td>{managerPaymentMethodLabel(payment.paymentMethod || '', 'vi') || '—'}</Td><Td><Badge variant={payment.status === 'PAID' ? 'success' : 'warning'}>{managerStatusLabel(payment.status, 'vi')}</Badge></Td><Td>{formatManagerDate(payment.paidAt || payment.receivedAt)}</Td><Td className="text-right">{payment.status === 'PAID' && <Button size="sm" variant="danger" onClick={() => setDeleteTarget(payment)}>Xóa</Button>}</Td></Tr>)}{!visiblePayments.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">Không có giao dịch phù hợp bộ lọc.</td></tr>}</Tbody></Table><ManagerPagination {...paymentPagination} pageSize={transactionPageSize} onPageChange={setTransactionPage} onPageSizeChange={setTransactionPageSize} /></Card>
    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Soft-delete giao dịch lịch sử">{deleteTarget && <div className="space-y-4"><ManagerActionNotice tone="warning">Giao dịch {deleteTarget.id} chỉ bị ẩn khỏi danh sách của Manager. Dữ liệu thanh toán, hóa đơn và số liệu báo cáo vẫn giữ nguyên.</ManagerActionNotice><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button><Button variant="danger" onClick={() => { paymentHistory.hide(deleteTarget.id); setDeleteTarget(null); showToast(`Đã ẩn giao dịch ${deleteTarget.id} khỏi lịch sử Manager.`) }}>Xóa khỏi lịch sử</Button></div></div>}</Modal>
  </div>
}
