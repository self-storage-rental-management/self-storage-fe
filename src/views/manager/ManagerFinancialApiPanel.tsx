import { invoiceNumberLabel } from '../customer/paymentLabels'
import { useRef, useState, type FormEvent } from 'react'
import { downloadPaymentReceipt } from '../../utils/downloadPaymentReceipt'
import { getRenewalReceipt } from '../../services/renewalReceiptApi'
import { Badge, Button, Card, Modal, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { EvidenceDownload } from '../rental-support-integration/EvidenceControls'
import RenewalReceipt from '../customer/RenewalReceipt'
import PaymentReceiptCard from '../customer/PaymentReceiptCard'
import { getAuthenticatedActor, type ApiActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import type { ManagerPaymentHistoryItem, ManagerPaymentHistoryStatus, ManagerPaymentHistoryType } from '../../types/managerPaymentHistory'
import ApiReadState from '../rental-api/ApiReadState'
import ApiPager from '../rental-api/ApiPager'
import { loadManagerPaymentHistory, managerApiIdentity, requireManagerRead } from './managerD1D5Api'
import { managerDisplayError } from './managerPresentation'
import { singleManagerFacility, managerFacilityNotice } from './managerFacilityUi'
import { ApiClientError } from '../../services/apiClient'

const typeLabels: Record<ManagerPaymentHistoryType, string> = {
  RESERVATION_DEPOSIT: 'Đặt cọc giữ chỗ',
  RENTAL_BALANCE: 'Nhận kho',
  MONTHLY_RENT: 'Tiền thuê',
  RENEWAL: 'Gia hạn',
  RENEWAL_INSTALLMENT: 'Đợt thanh toán gia hạn',
  DAMAGE_FEE: 'Phí phát sinh',
  EARLY_TERMINATION_FEE: 'Phí chấm dứt sớm',
  OTHER: 'Khoản thu khác',
  RETURN_REFUND: 'Hoàn cọc',
  RETURN_SETTLEMENT: 'Quyết toán',
}

const statusLabels: Record<ManagerPaymentHistoryStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PROCESSING: 'Đang xử lý',
  PAID: 'Đã thu',
  NOT_RECEIVED: 'Chưa nhận tiền',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
}

const statusVariants: Record<ManagerPaymentHistoryStatus, string> = {
  PENDING: 'warning',
  PROCESSING: 'warning',
  PAID: 'success',
  NOT_RECEIVED: 'warning',
  FAILED: 'error',
  CANCELLED: 'muted',
  REFUNDED: 'muted',
}

function paymentMethodLabel(method: string | null) {
  if (!method) return 'Chưa ghi nhận'
  const normalized = method.trim().toUpperCase()
  if (normalized === 'VNPAY' || normalized === 'ONLINE_GATEWAY' || normalized === 'NCB' || normalized.startsWith('VNPAY')) return 'VNPay'
  if (normalized === 'CASH' || normalized.includes('TIỀN MẶT')) return 'Tiền mặt'
  if (normalized === 'BANK_TRANSFER' || normalized.includes('CHUYỂN KHOẢN')) return 'Chuyển khoản'
  return method
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toLocaleString('vi-VN')} ${currency}`
  }
}

function PaymentTime({ value }: { value: string }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span className="text-xs text-stone-500">Chưa ghi nhận</span>
  const day = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return <time dateTime={value} className="block whitespace-nowrap text-xs tabular-nums leading-5"><span className="block text-stone-700">{day}</span><span className="block text-[11px] text-stone-500">{time}</span></time>
}

function receiptTitle(item: ManagerPaymentHistoryItem): string {
  switch (item.type) {
    case 'RESERVATION_DEPOSIT':
      return 'Biên lai đặt cọc giữ chỗ'
    case 'RENTAL_BALANCE':
      return 'Biên lai thanh toán phần còn lại khi nhận kho'
    case 'RENEWAL':
    case 'RENEWAL_INSTALLMENT':
      return 'Biên lai tiền thuê gia hạn'
    case 'RETURN_REFUND':
      return 'Biên lai hoàn tiền'
    case 'RETURN_SETTLEMENT':
      return 'Biên lai quyết toán'
    case 'MONTHLY_RENT':
      return 'Biên lai tiền thuê hàng tháng'
    default:
      return 'Biên lai thanh toán'
  }
}

function receiptStatus(item: ManagerPaymentHistoryItem): string {
  if (item.status === 'PAID') {
    switch (item.type) {
      case 'RESERVATION_DEPOSIT':
        return 'Đơn đã xác nhận cọc'
      case 'RENTAL_BALANCE':
        return 'Đã ghi nhận thanh toán nhận kho'
      case 'RENEWAL':
      case 'RENEWAL_INSTALLMENT':
        return 'Khoản thu đã đối soát'
      case 'RETURN_SETTLEMENT':
        return 'Đã thanh toán'
      default:
        return statusLabels[item.status] || 'Đã thu'
    }
  }
  if (item.status === 'REFUNDED') {
    return 'Đã hoàn tiền'
  }
  return statusLabels[item.status] || item.status
}

function receiptFooter(item: ManagerPaymentHistoryItem): string {
  if (item.type === 'RESERVATION_DEPOSIT' || item.type === 'RENTAL_BALANCE') {
    return 'Biên lai được lưu cùng đơn giữ kho để đối chiếu thanh toán.'
  }
  if (item.type === 'RENEWAL' || item.type === 'RENEWAL_INSTALLMENT') {
    return 'Biên lai được lưu cùng yêu cầu gia hạn để đối chiếu thanh toán.'
  }
  if (item.type === 'RETURN_REFUND' || item.type === 'RETURN_SETTLEMENT') {
    return 'Biên lai được lưu cùng hồ sơ trả kho để đối chiếu thanh toán.'
  }
  return 'Thông tin giao dịch đã ghi nhận trong lịch sử thanh toán của cơ sở.'
}

function receiptReference(item: ManagerPaymentHistoryItem): string {
  return item.reservationCode || item.transactionReference || item.id
}

function receiptFields(item: ManagerPaymentHistoryItem): [string, string][] {
  const isVnpay = item.paymentMethod?.toUpperCase().includes('VNPAY') || item.paymentMethod?.toUpperCase() === 'ONLINE_GATEWAY' || item.paymentMethod?.toUpperCase() === 'NCB'
  const isRemainingRental = item.type === 'RENTAL_BALANCE'
  const isDeposit = item.type === 'RESERVATION_DEPOSIT'

  const content = isDeposit
    ? 'Đặt cọc giữ chỗ đã được đơn xác nhận'
    : isRemainingRental
      ? 'Thanh toán phần còn lại khi nhận kho'
      : typeLabels[item.type] || 'Thanh toán'

  const date = new Date(item.occurredAt)
  const formattedDate = Number.isNaN(date.getTime())
    ? '-'
    : new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(date)

  const fields: [string, string][] = [
    ['Mã giao dịch StorageHub', item.id],
    [isRemainingRental ? 'Mã tham chiếu thanh toán' : isVnpay ? 'Mã tham chiếu VNPay' : 'Mã tham chiếu giao dịch', item.transactionReference || '-'],
    [isRemainingRental ? 'Mã phiếu thu hoặc giao dịch' : isVnpay ? 'Mã giao dịch VNPay' : 'Mã giao dịch', item.gatewayTransactionNo || item.transactionReference || '-'],
  ]

  if (item.reservationCode) {
    fields.push([isDeposit || isRemainingRental ? 'Đơn giữ kho' : 'Mã hồ sơ', item.reservationCode])
  }

  fields.push(
    [isRemainingRental ? 'Thời điểm ghi nhận tại quầy' : isVnpay ? 'Thời điểm VNPay ghi nhận' : 'Thời điểm ghi nhận', formattedDate],
    ['Thời điểm StorageHub xử lý', formattedDate],
    ['Phương thức thanh toán', paymentMethodLabel(item.paymentMethod)],
    ['Người ghi nhận', item.customerName || '-'],
    ['Nội dung', content],
    ['Số tiền', money(item.amount, item.currency)],
    ['Tiền tệ', item.currency || 'VND'],
    ['Số hóa đơn', invoiceNumberLabel(item.invoiceNumber)],
    ['Trạng thái hóa đơn', item.invoiceStatus || 'DRAFT'],
    ['Ngày phát hành hóa đơn', item.invoiceIssuedAt ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.invoiceIssuedAt)) : '-']
  )

  return fields
}

function canReadReceipt(item: ManagerPaymentHistoryItem) {
  const metadata = item as ManagerPaymentHistoryItem & {
    transactionStatus?: string
    receiptAvailable?: boolean
  }
  if (metadata.receiptAvailable === false || needsReconciliation(item)) return false
  return item.status === 'PAID' || item.status === 'REFUNDED'
}

function needsReconciliation(item: ManagerPaymentHistoryItem) {
  return item.reconciliationRequired === true || item.transactionStatus === 'RECONCILIATION_REQUIRED'
}

function paymentDisplayLabel(item: ManagerPaymentHistoryItem) {
  return needsReconciliation(item) ? 'Chờ đối soát' : statusLabels[item.status]
}

const receiptActionClass = 'h-9 w-[108px] whitespace-nowrap !bg-amber-100 !px-2 !font-semibold !text-amber-900 hover:!bg-amber-200 hover:!text-amber-950 active:!bg-amber-300'

export default function ManagerFinancialApiPanel() {
  let actor: ApiActor
  try { actor = requireManagerRead(getAuthenticatedActor(), 'payments:read') }
  catch (error) { return <Card className="p-5" role="alert">{managerDisplayError(error)}</Card> }
  const facilityId = singleManagerFacility(actor)
  if (!facilityId) return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return <ManagerPaymentHistorySession key={managerApiIdentity(actor)} actor={actor} facilityId={facilityId} />
}

function ManagerPaymentHistorySession({ actor, facilityId }: { actor: ApiActor; facilityId: string }) {
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [receipt, setReceipt] = useState<ManagerPaymentHistoryItem>()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<unknown>(null)
  const identity = managerApiIdentity(actor)
  const read = useRentalApiResource(`${identity}:payment-history:${facilityId}:${page}:${search}`, () =>
    loadManagerPaymentHistory(actor, { facilityId, page, size: 10, search }))
  const result = !read.loading && !read.error ? read.data : undefined

  function submit(event: FormEvent) {
    event.preventDefault()
    setPage(0)
    setSearch(draft.trim())
  }

  function clearSearch() {
    setDraft('')
    setSearch('')
    setPage(0)
  }

  async function downloadReceipt(item: ManagerPaymentHistoryItem) {
    setDownloading(item.id)
    setDownloadError(null)
    try {
      if (item.renewalId) await getRenewalReceipt('manager', item.renewalId, item.id)
      downloadPaymentReceipt({
        title: receiptTitle(item),
        reference: receiptReference(item),
        status: receiptStatus(item),
        fields: receiptFields(item),
        footer: receiptFooter(item),
      })
    } catch (error) {
      setDownloadError(error)
    } finally {
      setDownloading(null)
    }
  }

  return <div className="mx-auto w-full max-w-[1600px] space-y-4">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-stone-900">Lịch sử thanh toán</h1>
      <p className="text-sm text-stone-500">Các khoản thu, thanh toán gia hạn và hoàn tiền đã được ghi nhận tại cơ sở.</p>
    </header>

    <Card className="p-3 sm:px-4">
      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-end" aria-label="Tìm giao dịch thanh toán">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="block text-xs font-medium text-stone-600">Tìm giao dịch</span>
          <input
            className="h-9 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 transition focus:border-amber-600"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            maxLength={200}
            placeholder="Mã giao dịch hoặc tên khách hàng"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-9 whitespace-nowrap" disabled={read.loading}>Tìm kiếm</Button>
          {(draft || search) && <Button type="button" size="sm" className="h-9 whitespace-nowrap" variant="ghost" onClick={clearSearch}>Xóa tìm kiếm</Button>}
        </div>
      </form>
    </Card>

    <ApiReadState loading={read.loading} error={read.error} retry={read.refresh} />
    {!!downloadError && <p role="alert" className="text-sm text-red-800">{managerDisplayError(downloadError)}</p>}

    {result && <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-stone-900">Giao dịch</h2>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-stone-600">{result.pagination.totalItems.toLocaleString('vi-VN')} giao dịch</span>
        </div>
        {search && <p className="text-xs text-stone-500">Kết quả tìm kiếm: <span className="font-medium text-stone-700">{search}</span></p>}
      </div>

      <Table tableClassName="min-w-[1008px] table-fixed [&_th]:bg-stone-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:normal-case [&_th]:tracking-normal [&_th]:whitespace-nowrap [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-middle [&_.ui-badge]:border-0">
        <colgroup>
          <col className="w-64" /><col className="w-28" /><col className="w-32" />
          <col className="w-44" /><col className="w-24" /><col className="w-60" />
        </colgroup>
        <Thead><tr>
          <Th>Khách hàng / Mã giao dịch</Th>
          <Th className="!pr-1">Nội dung</Th>
          <Th className="!pl-1 !pr-2 text-right">Số tiền</Th>
          <Th className="text-center">Trạng thái</Th>
          <Th className="!pl-2 !pr-1">Thời gian</Th>
          <Th className="!px-2 text-center">Biên lai</Th>
        </tr></Thead>
        <Tbody>
          {result.data.map((item: ManagerPaymentHistoryItem) => <Tr key={item.id} className="transition-colors hover:bg-stone-50 focus-within:bg-stone-50">
            <Td>
              <p className="truncate text-sm font-medium leading-5 text-stone-900" title={item.customerName}>{item.customerName}</p>
              <code className="mt-0.5 block max-w-[30ch] truncate text-[11px] leading-4 text-stone-500" title={item.transactionReference}>{item.transactionReference}</code>
            </Td>
            <Td className="!pr-1">
              <span className="block truncate text-sm leading-5 text-stone-700" title={typeLabels[item.type]}>{typeLabels[item.type]}</span>
              <p className="mt-0.5 truncate text-xs text-stone-500" title={paymentMethodLabel(item.paymentMethod)}>{paymentMethodLabel(item.paymentMethod)}</p>
            </Td>
            <Td className="!pl-1 !pr-2 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-stone-900">
              {item.type === 'RETURN_REFUND' ? `-${money(item.amount, item.currency)}` : money(item.amount, item.currency)}
            </Td>
            <Td className="text-center"><span className="inline-flex whitespace-nowrap"><Badge variant={needsReconciliation(item) ? 'warning' : statusVariants[item.status]}>{paymentDisplayLabel(item)}</Badge></span></Td>
            <Td><PaymentTime value={item.occurredAt} /></Td>
            <Td className="!px-2 text-center">
              {canReadReceipt(item) && item.receiptFileId
                ? <div className="flex items-center justify-center"><EvidenceDownload id={item.receiptFileId} previewLabel="Xem trước" label="Tải xuống" compact /></div>
                : canReadReceipt(item)
                  ? <div className="flex items-center justify-center gap-1">
                    <Button type="button" size="sm" variant="ghost" className={receiptActionClass} aria-label={`Xem biên lai ${item.transactionReference}`} onClick={() => setReceipt(item)}>Xem trước</Button>
                    <Button type="button" size="sm" variant="ghost" className={receiptActionClass} aria-label={`Tải biên lai ${item.transactionReference}`} disabled={!!downloading} onClick={() => void downloadReceipt(item)}>{downloading === item.id ? 'Đang tải…' : 'Tải xuống'}</Button>
                  </div>
                  : <span className="text-xs text-stone-400">Chưa có</span>}
            </Td>
          </Tr>)}
          {result.data.length === 0 && <tr>
            <td colSpan={6} className="px-5 py-14 text-center">
              <p className="font-medium text-stone-700">Không tìm thấy giao dịch phù hợp</p>
              <p className="mt-1 text-sm text-stone-500">Thử mã giao dịch hoặc tên khách hàng khác.</p>
            </td>
          </tr>}
        </Tbody>
      </Table>
      <div className="border-t border-stone-200 px-5 py-2">
        <ApiPager pagination={result.pagination} onPage={setPage} disabled={read.loading} />
      </div>
    </Card>}
    {receipt && <Modal open title="Chi tiết giao dịch" size="2xl" onClose={() => setReceipt(undefined)}>
      {receipt.renewalId
        ? <RenewalReceipt id={receipt.renewalId} paymentId={receipt.id} role="manager" />
        : <PaymentReceiptCard title={receiptTitle(receipt)} reference={receiptReference(receipt)}
            status={receiptStatus(receipt)} confirmed={receipt.status === 'PAID' || receipt.status === 'REFUNDED'}
            fields={receiptFields(receipt)} footer={receiptFooter(receipt)} />}
    </Modal>}
  </div>
}
