/** Values emitted by the backend API. Demo/local-store aliases are normalized here. */
export type ApiReservationStatus =
  | 'AWAITING_EMAIL' | 'AWAITING_REVIEW' | 'AWAITING_PAYMENT'
  | 'PAYMENT_GRACE' | 'PAYMENT_REVIEW' | 'CONFIRMED' | 'UNIT_RESERVED'
  | 'READY_FOR_CHECKIN' | 'AWAITING_CUSTOMER_RECEIPT' | 'COMPLETED'
  | 'CANCELLED' | 'EXPIRED' | 'REJECTED'

export type ApiPaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'NOT_RECEIVED' | 'FAILED' | 'CANCELLED'
export type ApiInvoiceStatus = 'DRAFT' | 'PAID' | 'VOID' | 'REFUNDED'
export type ApiRentalStatus = 'setup' | 'active' | 'return_requested' | 'return_inspection' | 'closing' | 'completed'
export type ApiRenewalStatus = 'pending' | 'accepted' | 'deposit_paid' | 'full_rent_paid' | 'approved' | 'appointment_scheduled' | 'payment_processing' | 'payment_failed' | 'payment_expired' | 'rejected' | 'cancelled' | 'completed'
export type ApiReturnStatus = 'requested' | 'scheduled' | 'inspected' | 'awaiting_business_review' | 'awaiting_customer_confirmation' | 'disputed' | 'payment_due' | 'refund_pending' | 'completed'

const reservationAliases: Record<string, ApiReservationStatus> = {
  CREATED: 'AWAITING_PAYMENT',
  awaiting_email: 'AWAITING_EMAIL',
  awaiting_review: 'AWAITING_REVIEW',
  awaiting_payment: 'AWAITING_PAYMENT',
  DEPOSIT_PAID: 'CONFIRMED',
  deposit_paid: 'CONFIRMED',
  UNIT_RESERVED: 'UNIT_RESERVED',
  READY_FOR_CHECKIN: 'READY_FOR_CHECKIN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  cancelled: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  expired: 'EXPIRED',
  REJECTED: 'REJECTED',
  rejected: 'REJECTED',
}

export function normalizeReservationStatus(value: unknown): ApiReservationStatus | null {
  if (typeof value !== 'string') return null
  return reservationAliases[value] ?? (Object.values(reservationAliases).includes(value as ApiReservationStatus)
    ? value as ApiReservationStatus : null)
}

export function normalizePaymentStatus(value: unknown): ApiPaymentStatus | null {
  if (typeof value !== 'string') return null
  const aliases: Record<string, ApiPaymentStatus> = {
    pending: 'PENDING', paid: 'PAID', overdue: 'NOT_RECEIVED', cancelled: 'CANCELLED',
    PENDING: 'PENDING', PROCESSING: 'PROCESSING', PAID: 'PAID', NOT_RECEIVED: 'NOT_RECEIVED',
    FAILED: 'FAILED', CANCELLED: 'CANCELLED',
  }
  return aliases[value] ?? null
}

export function normalizeRentalStatus(value: unknown): ApiRentalStatus | null {
  return typeof value === 'string' && ['setup', 'active', 'return_requested', 'return_inspection', 'closing', 'completed'].includes(value)
    ? value as ApiRentalStatus : null
}
