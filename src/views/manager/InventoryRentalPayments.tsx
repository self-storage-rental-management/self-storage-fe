import { useState } from 'react'
import { Badge, Button } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { listRentalPayments, type RentalPaymentReceipt } from '../../services/rentalPaymentsApi'
import { formatVndAmount } from '../../i18n/currency'
import { rentalDate, rentalError } from '../rental-api/presentation'
import PaymentReceiptCard from '../customer/PaymentReceiptCard'
import { paymentCurrencyLabel, paymentMethodLabel } from '../customer/paymentLabels'

const statuses = { PENDING: 'Chờ thanh toán', PROCESSING: 'Đang xử lý', PAID: 'Đã thanh toán', NOT_RECEIVED: 'Chưa nhận tiền', FAILED: 'Không thành công', CANCELLED: 'Đã hủy', REFUNDED: 'Đã hoàn tiền' }
const purpose = (p: RentalPaymentReceipt) => p.purpose==='RENEWAL' ? 'Thanh toán gia hạn' : p.purpose==='RENTAL_BALANCE' ? p.renewalId ? 'Thanh toán khi ký gia hạn' : 'Thanh toán khi nhận kho' : p.purpose==='MONTHLY_RENT' ? 'Tiền thuê tháng' : 'Phí giữ chỗ'
function Receipt({ payment: p }: { payment: RentalPaymentReceipt }) {
  const verified = ['VERIFIED','SANDBOX'].includes(p.verification)
  return <PaymentReceiptCard title="Biên lai thanh toán" reference={p.renewalId || p.rentalId}
    confirmed={verified} status={p.verification==='SIMULATED' ? 'Giao dịch mô phỏng' : verified ? 'Đã xác nhận' : 'Cần đối soát'}
    fields={[
      ['Mã giao dịch StorageHub',p.paymentId],['Mã tham chiếu thanh toán',p.transactionReference || '-'],
      ['Mã phiếu thu hoặc giao dịch VNPay',p.gatewayTransactionNo || '-'],['Hồ sơ thuê',p.rentalId],
      ['Thời điểm ghi nhận thanh toán',rentalDate(p.paidAt)],['Thời điểm StorageHub xử lý',rentalDate(p.processedAt)],
      ['Phương thức thanh toán',paymentMethodLabel(p.paymentMethod)],['Người ghi nhận',p.initiatedByName],
      ['Nội dung',purpose(p)],['Số tiền',formatVndAmount(p.amount)],['Tiền tệ',paymentCurrencyLabel(p.currency)],
      ...(p.refundedAmount>0 ? [['Đã hoàn',formatVndAmount(p.refundedAmount)] as [string,string]] : []),
    ]} footer={p.verification==='SIMULATED' ? 'Giao dịch mô phỏng, không xác nhận thu tiền thật.' : p.verification==='SANDBOX' ? 'Giao dịch VNPay Sandbox, không xác nhận thu tiền thật.' : verified ? 'Biên lai được lưu để đối chiếu thanh toán của hồ sơ thuê.' : 'Khoản thanh toán chưa có đủ bằng chứng đối soát.'} />
}
export default function InventoryRentalPayments({ id }: { id: string }) {
  const actor=getAuthenticatedActor()
  const identity=`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:rental-payments:${id}`
  const read=useRentalApiResource(identity,()=>listRentalPayments(id))
  const [selected,setSelected]=useState<string>()
  const payment=read.data?.find(p=>p.paymentId===selected && p.status==='PAID')
  return <section className="space-y-3 rounded-lg border border-stone-200 p-4">
    <h4 className="font-semibold">Trạng thái thanh toán</h4>
    {read.loading && <p role="status" className="text-sm text-stone-500">Đang tải thanh toán...</p>}
    {Boolean(read.error) && <p role="status" className="text-sm text-stone-500">{rentalError(read.error)}</p>}
    {!read.loading && !read.error && !read.data?.length && <p className="text-sm text-stone-500">Không có dữ liệu</p>}
    <ul className="divide-y divide-stone-100">{read.data?.map(p=><li key={p.paymentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="font-medium">{purpose(p)}</p><p className="mt-1 text-sm text-stone-500">{formatVndAmount(p.amount)} · {rentalDate(p.paidAt || p.createdAt)}</p></div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant={p.status==='PAID' ? 'success' : ['FAILED','CANCELLED'].includes(p.status) ? 'error' : 'warning'}>{p.status==='PAID' && p.verification==='SIMULATED' ? 'Giao dịch mô phỏng' : p.status==='PAID' && p.verification==='SANDBOX' ? 'Đã thanh toán (Sandbox)' : statuses[p.status]}</Badge>
        {p.status==='PAID' && <Button size="sm" variant="outline" onClick={()=>setSelected(selected===p.paymentId ? undefined : p.paymentId)}>{selected===p.paymentId ? 'Đóng biên lai' : 'Xem biên lai'}</Button>}
      </div>
    </li>)}</ul>
    {payment && <Receipt payment={payment} />}
  </section>
}
