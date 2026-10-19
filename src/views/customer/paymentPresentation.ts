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
  if (payment.paymentStatus === 'PAID') return 'Thanh toán thành công'
  if (['PENDING', 'PROCESSING', 'NOT_RECEIVED'].includes(payment.paymentStatus)) return 'Chưa ghi nhận tiền'
  return 'Thanh toán thất bại'
}
