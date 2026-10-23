import { useState, type FormEvent } from 'react'
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

const typeLabels: Record<ManagerPaymentHistoryType, string> = {
  RESERVATION_DEPOSIT: 'Cọc giữ chỗ',
  RENTAL_BALANCE: 'Nhận kho',
  MONTHLY_RENT: 'Tiền thuê',
  RENEWAL: 'Gia hạn',
  DAMAGE_FEE: 'Phí phát sinh',
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
  PROCESSING: 'info',
  PAID: 'success',
  NOT_RECEIVED: 'warning',
  FAILED: 'error',
  CANCELLED: 'muted',
  REFUNDED: 'purple',
}

function paymentMethodLabel(method: string | null) {
  if (!method) return 'Chưa ghi nhận'
  const normalized = method.toUpperCase()
  if (normalized === 'VNPAY') return 'VNPay'
  if (normalized === 'CASH') return 'Tiền mặt'
  if (normalized === 'BANK_TRANSFER') return 'Chuyển khoản'
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
  return <time dateTime={value} className="block whitespace-nowrap text-xs tabular-nums leading-5"><span className="block font-medium text-stone-700">{day}</span><span className="block text-stone-400">{time}</span></time>
}

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

  return <div className="mx-auto w-full max-w-[1600px] space-y-4">
    <header className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">Lịch sử thanh toán</h1>
      <p className="text-sm text-stone-500">Các khoản thu, thanh toán gia hạn và hoàn tiền đã được ghi nhận tại cơ sở.</p>
    </header>

    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-end" aria-label="Tìm giao dịch thanh toán">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="block text-xs font-semibold text-stone-600">Tìm giao dịch</span>
          <input
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            maxLength={200}
            placeholder="Mã giao dịch hoặc tên khách hàng"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={read.loading}>Tìm kiếm</Button>
          {(draft || search) && <Button type="button" variant="outline" onClick={clearSearch}>Xóa tìm kiếm</Button>}
        </div>
      </form>
    </Card>

    <ApiReadState loading={read.loading} error={read.error} retry={read.refresh} />

    {result && <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-stone-900">Giao dịch</h2>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-stone-600">{result.pagination.totalItems.toLocaleString('vi-VN')} giao dịch</span>
        </div>
        {search && <p className="text-xs text-stone-500">Kết quả tìm kiếm: <span className="font-medium text-stone-700">{search}</span></p>}
      </div>

      <Table tableClassName="min-w-[960px] table-fixed [&_th]:bg-stone-50 [&_th]:px-4 [&_th]:py-3 [&_th]:normal-case [&_th]:tracking-normal [&_th]:whitespace-nowrap [&_td]:px-4 [&_td]:py-4 [&_td]:align-middle">
        <colgroup>
          <col className="w-[27%]" /><col className="w-[17%]" /><col className="w-[18%]" />
          <col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[12%]" />
        </colgroup>
        <Thead><tr>
          <Th>Khách hàng / Mã giao dịch</Th>
          <Th>Nội dung</Th>
          <Th className="text-right">Số tiền</Th>
          <Th className="text-center">Trạng thái</Th>
          <Th>Thời gian</Th>
          <Th className="text-center">Biên lai</Th>
        </tr></Thead>
        <Tbody>
          {result.data.map((item: ManagerPaymentHistoryItem) => <Tr key={item.id} className="transition-colors hover:bg-amber-50/40 focus-within:bg-amber-50/40">
            <Td>
              <p className="break-words text-sm font-semibold leading-5 text-stone-900">{item.customerName}</p>
              <code className="mt-1 block break-all text-[11px] leading-4 text-stone-500">{item.transactionReference}</code>
            </Td>
            <Td>
              <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${item.type === 'RENEWAL' ? 'bg-amber-50 text-amber-800' : item.type === 'RETURN_REFUND' ? 'bg-rose-50 text-rose-700' : 'bg-stone-100 text-stone-700'}`}>{typeLabels[item.type]}</span>
              <p className={`mt-1.5 text-xs ${item.paymentMethod ? 'text-stone-500' : 'text-stone-400'}`}>{paymentMethodLabel(item.paymentMethod)}</p>
            </Td>
            <Td className={`whitespace-nowrap text-right text-base font-bold tabular-nums ${item.type === 'RETURN_REFUND' ? 'text-rose-700' : 'text-stone-900'}`}>
              {item.type === 'RETURN_REFUND' ? `−${money(item.amount, item.currency)}` : money(item.amount, item.currency)}
            </Td>
            <Td className="text-center"><span className="inline-flex whitespace-nowrap"><Badge variant={statusVariants[item.status]}>{statusLabels[item.status]}</Badge></span></Td>
            <Td><PaymentTime value={item.occurredAt} /></Td>
            <Td className="text-center">
              {item.receiptFileId
                ? <EvidenceDownload id={item.receiptFileId} previewLabel="Xem trước" previewOnly />
                : ['PAID', 'REFUNDED'].includes(item.status)
                  ? <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" aria-label={`Xem biên lai ${item.transactionReference}`} onClick={() => setReceipt(item)}>Xem trước</Button>
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
    {receipt && <Modal open title="Biên lai thanh toán" size="lg" onClose={() => setReceipt(undefined)}>
      {receipt.renewalId
        ? <RenewalReceipt id={receipt.renewalId} paymentId={receipt.id} role="manager" />
        : <PaymentReceiptCard title={receipt.type === 'RETURN_REFUND' ? 'Biên lai hoàn tiền' : 'Biên lai thanh toán'} reference={receipt.id}
            status={statusLabels[receipt.status]} confirmed={receipt.status === 'PAID' || receipt.status === 'REFUNDED'}
            fields={[
              ['Mã giao dịch', receipt.transactionReference], ['Khách hàng', receipt.customerName],
              ['Nội dung', typeLabels[receipt.type]], ['Phương thức thanh toán', paymentMethodLabel(receipt.paymentMethod)],
              ['Số tiền', money(receipt.amount, receipt.currency)], ['Tiền tệ', receipt.currency],
              ['Thời điểm ghi nhận', new Date(receipt.occurredAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })],
            ]} footer="Thông tin giao dịch đã ghi nhận trong lịch sử thanh toán của cơ sở." />}
    </Modal>}
  </div>
}
