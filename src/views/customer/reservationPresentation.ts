import type { ReservationStatus } from '../../services/customerReservationApi'

export function paymentCountdown(deadline: string | null | undefined, now: number) {
  const timestamp = deadline ? Date.parse(deadline) : NaN
  if (!Number.isFinite(timestamp)) return { text: 'Đang tải thời hạn…', expired: true }
  const seconds = Math.max(0, Math.ceil((timestamp - now) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const text = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return { text, expired: seconds === 0 }
}

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  AWAITING_EMAIL: 'Chờ xác minh email', AWAITING_REVIEW: 'Chờ duyệt hàng hóa',
  AWAITING_PAYMENT: 'Chờ thanh toán cọc', PAYMENT_GRACE: 'Gia hạn thanh toán',
  PAYMENT_REVIEW: 'Đang đối soát thanh toán', CONFIRMED: 'Đã xác nhận giữ kho',
  UNIT_RESERVED: 'Đã phân gian kho', READY_FOR_CHECKIN: 'Sẵn sàng nhận kho',
  AWAITING_CUSTOMER_RECEIPT: 'Chờ xác nhận nhận kho', COMPLETED: 'Đã bàn giao',
  CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn', REJECTED: 'Hàng hóa bị từ chối',
}

export function reservationProgress(status: ReservationStatus): number | null {
  switch (status) {
    case 'AWAITING_EMAIL': return 0
    case 'AWAITING_REVIEW': return 1
    case 'AWAITING_PAYMENT': case 'PAYMENT_GRACE': case 'PAYMENT_REVIEW': return 2
    case 'CONFIRMED': return 3
    case 'UNIT_RESERVED': case 'READY_FOR_CHECKIN': return 4
    case 'AWAITING_CUSTOMER_RECEIPT': return 5
    case 'COMPLETED': return 6
    default: return null
  }
}
