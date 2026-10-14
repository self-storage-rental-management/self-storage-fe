import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
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
  RENTAL_BALANCE: 'Thanh toán nhận kho',
  MONTHLY_RENT: 'Tiền thuê',
  RENEWAL: 'Gia hạn',
  DAMAGE_FEE: 'Phí phát sinh',
  OTHER: 'Khoản thu khác',
  RETURN_REFUND: 'Hoàn cọc trả kho',
  RETURN_SETTLEMENT: 'Quyết toán trả kho',
}

const statusLabels: Record<ManagerPaymentHistoryStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PROCESSING: 'Đang xử lý',
  PAID: 'Đã thanh toán',
  NOT_RECEIVED: 'Chưa nhận được tiền',
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

function dateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Chưa ghi nhận thời gian'
    : date.toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
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

  return <div className="mx-auto w-full max-w-[1600px] space-y-6">
    <header className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">Lịch sử thanh toán</h1>
      <p className="text-sm text-stone-500">Các khoản thu, thanh toán gia hạn và hoàn tiền đã được ghi nhận tại cơ sở.</p>
    </header>

    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end" aria-label="Tìm giao dịch thanh toán">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="block text-sm font-semibold text-stone-700">Tìm giao dịch</span>
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-stone-900">Giao dịch</h2>
          <p className="mt-0.5 text-xs text-stone-500">{result.pagination.totalItems.toLocaleString('vi-VN')} giao dịch</p>
        </div>
        {search && <p className="text-xs text-stone-500">Kết quả tìm kiếm: <span className="font-medium text-stone-700">{search}</span></p>}
      </div>

      <Table tableClassName="min-w-[1120px]">
        <Thead><tr>
          <Th>Mã giao dịch</Th>
          <Th>Khách hàng</Th>
          <Th>Loại giao dịch</Th>
          <Th>Phương thức</Th>
          <Th className="text-right">Số tiền</Th>
          <Th className="text-right">Đã hoàn</Th>
          <Th>Trạng thái</Th>
          <Th>Thời gian</Th>
        </tr></Thead>
        <Tbody>
          {result.data.map((item: ManagerPaymentHistoryItem) => <Tr key={item.id}>
            <Td className="max-w-[230px]">
              <code className="block break-all text-xs font-semibold text-stone-800" title={item.transactionReference}>{item.transactionReference}</code>
            </Td>
            <Td className="min-w-[150px] font-medium text-stone-900">{item.customerName}</Td>
            <Td><Badge variant={item.type === 'RETURN_REFUND' ? 'warning' : 'info'}>{typeLabels[item.type]}</Badge></Td>
            <Td className="whitespace-nowrap">{paymentMethodLabel(item.paymentMethod)}</Td>
            <Td className={`whitespace-nowrap text-right font-semibold tabular-nums ${item.type === 'RETURN_REFUND' ? 'text-rose-700' : 'text-stone-900'}`}>
              {item.type === 'RETURN_REFUND' ? `−${money(item.amount, item.currency)}` : money(item.amount, item.currency)}
            </Td>
            <Td className="whitespace-nowrap text-right tabular-nums">
              {item.refundedAmount > 0 ? <span className="font-medium text-emerald-700">{money(item.refundedAmount, item.currency)}</span> : <span className="text-stone-400">-</span>}
            </Td>
            <Td><Badge variant={statusVariants[item.status]}>{statusLabels[item.status]}</Badge></Td>
            <Td className="whitespace-nowrap text-sm text-stone-600">{dateTime(item.occurredAt)}</Td>
          </Tr>)}
          {result.data.length === 0 && <tr>
            <td colSpan={8} className="px-5 py-14 text-center">
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
  </div>
}
