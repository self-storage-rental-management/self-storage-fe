import { receiptDisplayCode, internalPaymentReference } from '../../utils/recordDisplayCode'
import { displayStatusLabel } from '../../presentation/statusLabels'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { formatVndAmount as formatVnd } from '../../i18n/currency'
import type { ReservationPaymentResult } from '../../services/customerReservationApi'
import { bookingDepositAccepted } from './paymentPresentation'
import { invoiceNumberLabel, paymentCurrencyLabel, paymentMethodLabel } from './paymentLabels'
import PaymentReceiptCard from './PaymentReceiptCard'
import { EvidenceDownload } from '../rental-support-integration/EvidenceControls'
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
    title: isRemainingRental ? 'Phiếu ghi nhận thanh toán khi nhận kho' : accepted ? 'Phiếu xác nhận thanh toán giữ chỗ qua VNPay' : 'Chi tiết giao dịch cần đối soát',
    reference: receiptDisplayCode(payment.receiptCode, payment.transactionReference, payment.paymentId),
    confirmed: accepted || isRemainingRental,
    status: isRemainingRental ? 'Đã ghi nhận thanh toán nhận kho' : accepted ? 'Đơn đã xác nhận cọc (khoản trả trước)' : 'Đơn chưa xác nhận',
    fields: [
      ['Mã phiếu thu', payment.receiptCode || 'Chưa cấp'], [isRemainingRental ? 'Mã tham chiếu thanh toán' : 'Mã tham chiếu VNPay', internalPaymentReference(payment.transactionReference) ? '–' : payment.transactionReference],
      [isRemainingRental ? 'Mã giao dịch thanh toán' : 'Mã giao dịch VNPay', payment.gatewayTransactionNo || '-'], ['Đơn giữ kho', reservationCode],
      [isRemainingRental ? 'Thời điểm ghi nhận tại quầy' : 'Thời điểm VNPay ghi nhận', gatewayPaidAt || (payment.paidAt ? formatCustomerDateTime(new Date(payment.paidAt)) : '-')],
      ['Thời điểm StorageHub xử lý', payment.processedAt ? formatCustomerDateTime(new Date(payment.processedAt)) : '-'],
      ['Phương thức thanh toán', paymentMethodLabel(payment.paymentMethod, !isRemainingRental)],
      ['Người ghi nhận', payment.initiatedByName || '-'],
      ['Nội dung', isRemainingRental ? 'Thanh toán phần còn lại khi nhận kho' : accepted ? 'Thanh toán trước 20% (giữ chỗ) đã được đơn xác nhận' : 'Giao dịch thanh toán trước 20% (giữ chỗ) cần đối soát'], ['Số tiền', formatVnd(payment.amount)], ['Tiền tệ', paymentCurrencyLabel(payment.currency)],
      ['Số hóa đơn', invoiceNumberLabel(payment.invoiceNumber)], ['Trạng thái hóa đơn', displayStatusLabel(payment.invoiceStatus || 'DRAFT')],
      ['Ngày phát hành hóa đơn', payment.invoiceIssuedAt ? formatCustomerDateTime(new Date(payment.invoiceIssuedAt)) : '-'],
    ],
    footer: isRemainingRental || accepted ? 'Phiếu ghi nhận được lưu cùng đơn giữ kho để đối chiếu thanh toán.' : 'Hệ thống đã ghi nhận giao dịch, trạng thái đơn cần được kiểm tra trước khi tính là khoản trả trước được chấp nhận.',
  }
}

export default function ReservationReceipt({ payment, reservationCode }: { payment: ReservationPaymentResult; reservationCode: string }) {
  if (payment.paymentStatus !== 'PAID') return <p className="text-sm text-amber-900">Giao dịch chưa được ghi nhận thành công, chưa có biên lai thanh toán.</p>
  const receipt = reservationPaymentReceiptExport(payment, reservationCode)
  return <div className="space-y-4">
    {payment.receiptFileId
      ? <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Biên lai gốc do nhân viên đính kèm</h3>
        <EvidenceDownload id={payment.receiptFileId} previewLabel="Xem biên lai gốc" label="Tải biên lai gốc" />
      </section>
      : payment.purpose === 'RENTAL_BALANCE' && <p role="status" className="text-sm text-amber-900">Giao dịch này chưa có biên lai gốc đính kèm. Vui lòng liên hệ cơ sở để đối chiếu.</p>}
    <PaymentReceiptCard {...receipt} />
  </div>
}
