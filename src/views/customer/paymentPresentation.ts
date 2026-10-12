import type { ReservationPaymentResult } from '../../services/customerReservationApi'

// Booking acceptance comes from the Reservation lifecycle, not PaymentStatus.PAID alone.
const acceptedReservationStatuses = new Set([
  'CONFIRMED', 'UNIT_RESERVED', 'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED',
])

export function bookingDepositAccepted(payment: ReservationPaymentResult): boolean {
  const isDeposit = payment.purpose === undefined || payment.purpose === 'RESERVATION_DEPOSIT'
  return isDeposit && payment.paymentStatus === 'PAID' && acceptedReservationStatuses.has(payment.reservationStatus)
}

export function paymentRecordLabel(payment: ReservationPaymentResult): string {
  if (bookingDepositAccepted(payment)) return 'Cọc đã được đơn xác nhận'
  if (payment.paymentStatus === 'PAID') return ['CANCELLED', 'REJECTED'].includes(payment.reservationStatus)
    ? 'Giao dịch đã ghi nhận; kiểm tra trạng thái đơn'
    : 'Giao dịch đã ghi nhận; đơn chưa xác nhận, cần đối soát'
  if (['PENDING', 'PROCESSING', 'NOT_RECEIVED'].includes(payment.paymentStatus)) return 'Chưa ghi nhận tiền'
  return 'Thanh toán thất bại'
}
