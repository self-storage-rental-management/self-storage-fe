import { displayStatusLabel } from '../../presentation/statusLabels'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import type { ReservationPaymentResult } from '../../services/customerReservationApi'
import { bookingDepositAccepted } from './paymentPresentation'
import { invoiceNumberLabel, paymentCurrencyLabel, paymentMethodLabel } from './paymentLabels'
import PaymentReceiptCard from './PaymentReceiptCard'
import type { PaymentReceiptExport } from '../../utils/downloadPaymentReceipt'

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

export function reservationPaymentReceiptExport(payment: ReservationPaymentResult, reservationCode: string): PaymentReceiptExport & { confirmed: boolean } {
  const accepted = bookingDepositAccepted(payment)
  const isRemainingRental = payment.purpose === 'RENTAL_BALANCE'
  const gatewayPaidAt = formatGatewayPayDate(payment.gatewayPayDate)
  return {
    title: isRemainingRental ? 'Biên lai thanh toán phần còn lại khi nhận kho' : accepted ? 'Biên lai đặt cọc giữ chỗ (thanh toán trước 20%)' : 'Chi tiết giao dịch cần đối soát',
    reference: reservationCode,
    confirmed: accepted || isRemainingRental,
    status: isRemainingRental ? 'Đã ghi nhận thanh toán nhận kho' : accepted ? 'Đơn đã xác nhận cọc (khoản trả trước)' : 'Đơn chưa xác nhận',
    fields: [
      ['Mã phiếu thu', payment.receiptCode || 'Chưa cấp'], ['Mã giao dịch StorageHub', payment.paymentId], [isRemainingRental ? 'Mã tham chiếu thanh toán' : 'Mã tham chiếu VNPay', payment.transactionReference],
      [isRemainingRental ? 'Mã giao dịch thanh toán' : 'Mã giao dịch VNPay', payment.gatewayTransactionNo || '-'], ['Đơn giữ kho', reservationCode],
      [isRemainingRental ? 'Thời điểm ghi nhận tại quầy' : 'Thời điểm VNPay ghi nhận', gatewayPaidAt || (payment.paidAt ? formatCustomerDateTime(new Date(payment.paidAt)) : '-')],
      ['Thời điểm StorageHub xử lý', payment.processedAt ? formatCustomerDateTime(new Date(payment.processedAt)) : '-'],
      ['Phương thức thanh toán', paymentMethodLabel(payment.paymentMethod, !isRemainingRental)],
      ['Người ghi nhận', payment.initiatedByName || '-'],
      ['Nội dung', isRemainingRental ? 'Thanh toán phần còn lại khi nhận kho' : accepted ? 'Thanh toán trước 20% (giữ chỗ) đã được đơn xác nhận' : 'Giao dịch thanh toán trước 20% (giữ chỗ) cần đối soát'], ['Số tiền', formatVnd(payment.amount)], ['Tiền tệ', paymentCurrencyLabel(payment.currency)],
      ['Số hóa đơn', invoiceNumberLabel(payment.invoiceNumber)], ['Trạng thái hóa đơn', displayStatusLabel(payment.invoiceStatus || 'DRAFT')],
      ['Ngày phát hành hóa đơn', payment.invoiceIssuedAt ? formatCustomerDateTime(new Date(payment.invoiceIssuedAt)) : '-'],
    ],
    footer: isRemainingRental || accepted ? 'Biên lai được lưu cùng đơn giữ kho để đối chiếu thanh toán.' : 'Hệ thống đã ghi nhận giao dịch, trạng thái đơn cần được kiểm tra trước khi tính là khoản trả trước được chấp nhận.',
  }
}

export default function ReservationReceipt({ payment, reservationCode }: { payment: ReservationPaymentResult; reservationCode: string }) {
  if (payment.paymentStatus !== 'PAID') return <p className="text-sm text-amber-900">Giao dịch chưa được ghi nhận thành công, chưa có biên lai thanh toán.</p>
  const receipt = reservationPaymentReceiptExport(payment, reservationCode)
  return <PaymentReceiptCard {...receipt} />
}
