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

export const invoiceStatusValues = ['NOT_ISSUED', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'UNKNOWN'] as const
export type InvoiceStatus = (typeof invoiceStatusValues)[number]

export const invoiceRefundStatusValues = ['NONE', 'PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'UNKNOWN'] as const
export type InvoiceRefundStatus = (typeof invoiceRefundStatusValues)[number]

export const paymentTransactionStatusValues = [
  'PENDING', 'PROCESSING', 'RECONCILIATION_REQUIRED', 'SUCCEEDED', 'FAILED',
  'CANCELLED', 'EXPIRED', 'PARTIALLY_REFUNDED', 'REFUNDED',
] as const
export type PaymentTransactionStatus = (typeof paymentTransactionStatusValues)[number]

export const renewalWorkflowStatusValues = [
  'UNDER_REVIEW', 'AWAITING_PAYMENT', 'AWAITING_RECONCILIATION', 'AWAITING_SIGNING',
  'SIGNING_IN_PROGRESS', 'SIGNING_EXPIRED', 'PAYMENT_WINDOW_EXPIRED', 'ON_HOLD',
  'COMPLETED', 'CANCELLED', 'REJECTED',
] as const
export type RenewalWorkflowStatus = (typeof renewalWorkflowStatusValues)[number]

/** Workflow values emitted by the backend check-in API. */
export type CheckInStatus =
  | 'scheduled' | 'identity_verified' | 'contract_signed' | 'payment_collected'
  | 'setup_in_progress' | 'setup_completed' | 'completed' | 'rejected'
  | 'no_show' | 'cancelled'

/** Compatibility aliases used by the check-in service layer. */
export type ReservationStatus = ApiReservationStatus
export type PaymentStatus = ApiPaymentStatus

const checkInStatusValues: readonly CheckInStatus[] = [
  'scheduled', 'identity_verified', 'contract_signed', 'payment_collected',
  'setup_in_progress', 'setup_completed', 'completed', 'rejected', 'no_show', 'cancelled',
]

const renewalStatusValues: readonly ApiRenewalStatus[] = [
  'pending', 'accepted', 'deposit_paid', 'full_rent_paid', 'approved',
  'appointment_scheduled', 'payment_processing', 'payment_failed', 'payment_expired',
  'rejected', 'cancelled', 'completed',
]

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

export function isReservationStatus(value: unknown): value is ApiReservationStatus {
  return normalizeReservationStatus(value) !== null
}

export function isPaymentStatus(value: unknown): value is ApiPaymentStatus {
  return normalizePaymentStatus(value) !== null
}

export function isRentalStatus(value: unknown): value is ApiRentalStatus {
  return normalizeRentalStatus(value) !== null
}

export function isCheckInStatus(value: unknown): value is CheckInStatus {
  return typeof value === 'string' && checkInStatusValues.includes(value as CheckInStatus)
}

export const isInvoiceStatus = (value: unknown): value is InvoiceStatus =>
  typeof value === 'string' && invoiceStatusValues.includes(value as InvoiceStatus)

export const isInvoiceRefundStatus = (value: unknown): value is InvoiceRefundStatus =>
  typeof value === 'string' && invoiceRefundStatusValues.includes(value as InvoiceRefundStatus)

export const isPaymentTransactionStatus = (value: unknown): value is PaymentTransactionStatus =>
  typeof value === 'string' && paymentTransactionStatusValues.includes(value as PaymentTransactionStatus)

export const isRenewalWorkflowStatus = (value: unknown): value is RenewalWorkflowStatus =>
  typeof value === 'string' && renewalWorkflowStatusValues.includes(value as RenewalWorkflowStatus)

export function isRenewalStatus(value: unknown): value is ApiRenewalStatus {
  return typeof value === 'string' && renewalStatusValues.includes(value as ApiRenewalStatus)
}
