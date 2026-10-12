import { formatVndAmount as formatVnd } from '../../i18n/currency'
import type { ReservationPaymentResult } from '../../services/customerReservationApi'
import { bookingDepositAccepted } from './paymentPresentation'
import { paymentCurrencyLabel, paymentMethodLabel } from './paymentLabels'

function formatGatewayPayDate(value: string | null) {
  if (!value || !/^\d{14}$/.test(value)) return null
  const year = value.slice(0, 4)
  const month = value.slice(4, 6)
  const day = value.slice(6, 8)
  const hour = value.slice(8, 10)
  const minute = value.slice(10, 12)
  const second = value.slice(12, 14)
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`
}

export default function ReservationReceipt({ payment, reservationCode }: { payment: ReservationPaymentResult; reservationCode: string }) {
  if (payment.paymentStatus !== 'PAID') return <p className="text-sm text-amber-900">Giao dịch chưa được ghi nhận thành công, chưa có biên lai thanh toán.</p>
  const accepted = bookingDepositAccepted(payment)
  const isRemainingRental = payment.purpose === 'RENTAL_BALANCE'
  const gatewayPaidAt = formatGatewayPayDate(payment.gatewayPayDate)
  const paymentMethod = isRemainingRental
    ? payment.paymentMethod || 'Chưa có thông tin'
    : payment.paymentMethod && payment.paymentMethod !== 'VNPAY'
      ? `VNPay (${payment.paymentMethod})`
      : 'VNPay'
  return <article className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3"><div><p className="text-xs font-bold text-stone-500">{isRemainingRental ? 'Biên lai thanh toán phần còn lại khi nhận kho' : accepted ? 'Biên lai cọc giữ chỗ' : 'Chi tiết giao dịch cần đối soát'}</p><p className="mt-1 text-sm font-bold">{reservationCode}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${accepted || isRemainingRental ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{isRemainingRental ? 'Đã ghi nhận thanh toán nhận kho' : accepted ? 'Đơn đã xác nhận cọc' : 'Đơn chưa xác nhận'}</span></div>
    <dl className="grid gap-px bg-stone-200 sm:grid-cols-2">{[
      ['Mã giao dịch StorageHub', payment.paymentId], [isRemainingRental ? 'Mã tham chiếu thanh toán' : 'Mã tham chiếu VNPay', payment.transactionReference],
      [isRemainingRental ? 'Mã phiếu thu hoặc giao dịch' : 'Mã giao dịch VNPay', payment.gatewayTransactionNo || '—'], ['Đơn giữ kho', reservationCode],
      [isRemainingRental ? 'Thời điểm ghi nhận tại quầy' : 'Thời điểm VNPay ghi nhận', gatewayPaidAt || (payment.paidAt ? new Date(payment.paidAt).toLocaleString('vi-VN') : '—')],
      ['Thời điểm StorageHub xử lý', payment.processedAt ? new Date(payment.processedAt).toLocaleString('vi-VN') : '—'],
      ['Phương thức thanh toán', paymentMethodLabel(payment.paymentMethod)],
      ['Người ghi nhận', payment.initiatedByName || '—'],
      ['Nội dung', isRemainingRental ? 'Thanh toán phần còn lại khi nhận kho' : accepted ? 'Cọc giữ chỗ đã được đơn xác nhận' : 'Giao dịch cọc giữ chỗ cần đối soát'], ['Số tiền', formatVnd(payment.amount)], ['Tiền tệ', paymentCurrencyLabel(payment.currency)],
    ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-all text-sm font-bold text-stone-900">{value}</dd></div>)}</dl>
    <p className="border-t border-stone-200 px-5 py-4 text-xs text-stone-600">{isRemainingRental || accepted ? 'Biên lai được lưu cùng đơn giữ kho để đối chiếu thanh toán.' : 'Hệ thống đã ghi nhận giao dịch, trạng thái đơn cần được kiểm tra trước khi tính là cọc được chấp nhận.'}</p>
  </article>
}
