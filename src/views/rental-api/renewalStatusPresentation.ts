import type { RenewalApiRecord, RenewalVnpayPaymentResponse } from '../../types/renewalApi'
import { renewalTransactionLabels, renewalWorkflowLabels, type RenewalTransactionStatus } from '../../types/renewalStatus'

export function reconciledRenewalPayment(p: RenewalVnpayPaymentResponse | null | undefined) {
  if (!p || p.paymentStatus !== 'PAID' || p.reconciliationRequired) return false
  if (p.transactionStatus !== undefined) return p.transactionStatus === 'SUCCEEDED' && p.receiptAvailable === true
  return !!p.settlementStage && ['ALLOCATED_AWAITING_SIGNING', 'AWAITING_SIGNING', 'COMPLETED'].includes(p.settlementStage)
}
export function renewalPaymentDisplayStatus(p: RenewalVnpayPaymentResponse): RenewalTransactionStatus {
  if (p.transactionStatus) return p.transactionStatus
  if (p.paymentStatus === 'PAID') return reconciledRenewalPayment(p) ? 'SUCCEEDED' : 'RECONCILIATION_REQUIRED'
  if (p.paymentStatus === 'FAILED') return 'FAILED'
  if (p.paymentStatus === 'CANCELLED') return 'CANCELLED'
  if (p.paymentDeadline && Date.parse(p.paymentDeadline) <= Date.now()) return 'RECONCILIATION_REQUIRED'
  return p.paymentStatus === 'PROCESSING' ? 'PROCESSING' : 'PENDING'
}
export const renewalPaymentDisplayLabel = (p: RenewalVnpayPaymentResponse) => renewalTransactionLabels[renewalPaymentDisplayStatus(p)]

// Legacy workflow codes remain readable without presenting them as an invoice/payment outcome.
export function renewalWorkflowLabel(r: RenewalApiRecord) {
  if (r.statusSummary) return renewalWorkflowLabels[r.statusSummary.workflowStatus]
  return ({ pending: 'Đang kiểm tra', accepted: 'Chờ thanh toán', approved: 'Chờ thanh toán',
    deposit_paid: 'Chờ ký gia hạn', full_rent_paid: 'Chờ ký gia hạn', appointment_scheduled: 'Đã hẹn ký gia hạn',
    payment_processing: 'Chờ kết quả thanh toán', payment_failed: 'Chờ thanh toán lại', payment_expired: 'Hết hạn thanh toán',
    completed: 'Gia hạn hoàn tất', rejected: 'Đã đóng', cancelled: 'Đã hủy' } as const)[r.status]
}

export function renewalProgress(r: RenewalApiRecord, p: RenewalVnpayPaymentResponse | null) {
  const stage = r.statusSummary?.workflowStatus
  if (stage === 'COMPLETED' || r.status === 'completed') return 5
  if (p?.paymentStatus === 'PAID' && !reconciledRenewalPayment(p)) return 2
  if (stage === 'AWAITING_SIGNING' || stage === 'SIGNING_IN_PROGRESS') return 4
  if (stage === 'AWAITING_RECONCILIATION' || stage === 'ON_HOLD') return 2
  if (stage === 'SIGNING_EXPIRED') return 4
  if (reconciledRenewalPayment(p)) return 3
  if (r.status === 'appointment_scheduled') return 4
  if (['deposit_paid', 'full_rent_paid'].includes(r.status)) return 3
  return ['accepted', 'approved', 'payment_processing', 'payment_failed', 'payment_expired'].includes(r.status) ? 2 : 1
}
