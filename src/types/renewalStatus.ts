export const renewalWorkflowLabels = {
  UNDER_REVIEW: 'Đang kiểm tra', AWAITING_PAYMENT: 'Chờ thanh toán',
  AWAITING_RECONCILIATION: 'Chờ đối soát', AWAITING_SIGNING: 'Chờ ký gia hạn',
  SIGNING_IN_PROGRESS: 'Đang hoàn tất ký', SIGNING_EXPIRED: 'Hết hạn ký',
  PAYMENT_WINDOW_EXPIRED: 'Hết hạn thanh toán', ON_HOLD: 'Tạm dừng xử lý',
  COMPLETED: 'Gia hạn hoàn tất', CANCELLED: 'Đã hủy', REJECTED: 'Đã đóng',
} as const
export const renewalInvoiceLabels = {
  NOT_ISSUED: 'Chưa phát sinh khoản phải thu', UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Đã thanh toán một phần', PAID: 'Đã thanh toán đủ',
  CANCELLED: 'Đã đóng khoản phải thu', UNKNOWN: 'Chưa xác minh khoản phải thu',
} as const
export const renewalTransactionLabels = {
  PENDING: 'Chờ thanh toán', PROCESSING: 'Đang xử lý', RECONCILIATION_REQUIRED: 'Chờ đối soát',
  SUCCEEDED: 'Thanh toán thành công', FAILED: 'Thanh toán thất bại', CANCELLED: 'Giao dịch đã hủy',
  EXPIRED: 'Phiên thanh toán hết hạn', PARTIALLY_REFUNDED: 'Đã hoàn tiền một phần', REFUNDED: 'Đã hoàn tiền toàn bộ',
} as const
export const renewalRefundLabels = {
  NONE: 'Không có khoản hoàn', PENDING: 'Chờ thực hiện hoàn tiền',
  PARTIALLY_REFUNDED: 'Đã hoàn tiền một phần', REFUNDED: 'Đã hoàn tiền toàn bộ', UNKNOWN: 'Chưa xác minh hoàn tiền',
} as const
export type RenewalTransactionStatus = keyof typeof renewalTransactionLabels
export interface RenewalTransaction {
  paymentId: string; reference: string | null; purpose: string; status: RenewalTransactionStatus
  amount: number; refundedAmount: number; currency: string; paymentDeadline: string | null
  deadlineExpired: boolean; receiptAvailable: boolean; paidAt: string | null
}
export interface RenewalStatusSummary {
  workflowStatus: keyof typeof renewalWorkflowLabels
  invoice: {
    status: keyof typeof renewalInvoiceLabels; refundStatus: keyof typeof renewalRefundLabels
    totalBeforeAdjustments: number | null; discountAmount: number | null; adjustmentAmount: number | null
    totalAfterAdjustments: number | null; paidAmount: number | null; outstandingAmount: number | null
    dueNowAmount: number | null; overdueAmount: number | null; refundedAmount: number | null
    currency: string; reason: string | null
  }
  transactions: RenewalTransaction[]; checkedAt: string
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const key = (v: unknown, labels: object) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(labels, v)
export function isRenewalTransactionStatus(v: unknown): v is RenewalTransactionStatus {
  return key(v, renewalTransactionLabels)
}
export function isRenewalStatusSummary(v: unknown): v is RenewalStatusSummary {
  if (!object(v) || !key(v.workflowStatus, renewalWorkflowLabels) || !date(v.checkedAt) || !object(v.invoice) || !Array.isArray(v.transactions)) return false
  const i = v.invoice
  const amounts = [i.totalBeforeAdjustments, i.discountAmount, i.adjustmentAmount, i.totalAfterAdjustments, i.paidAmount,
    i.outstandingAmount, i.dueNowAmount, i.overdueAmount, i.refundedAmount]
  if (!key(i.status, renewalInvoiceLabels) || !key(i.refundStatus, renewalRefundLabels) || i.currency !== 'VND' ||
    !(i.reason === null || typeof i.reason === 'string')) return false
  if (['UNKNOWN', 'NOT_ISSUED'].includes(String(i.status))) {
    if (!amounts.every(n => n === null)) return false
  } else {
    if (!amounts.every(money)) return false
    if (Math.abs(Number(i.totalAfterAdjustments) - Number(i.paidAmount) - Number(i.outstandingAmount)) > 0.01 ||
      Math.abs(Number(i.totalBeforeAdjustments) - Number(i.discountAmount) - Number(i.adjustmentAmount) - Number(i.totalAfterAdjustments)) > 0.01 ||
      Number(i.overdueAmount) > Number(i.dueNowAmount) || Number(i.dueNowAmount) > Number(i.outstandingAmount)) return false
  }
  const ids = new Set<string>()
  return v.transactions.every(t => {
    if (!object(t) || typeof t.paymentId !== 'string' || !t.paymentId || ids.has(t.paymentId) || !isRenewalTransactionStatus(t.status) ||
      !money(t.amount) || !money(t.refundedAmount) || t.refundedAmount > t.amount || t.currency !== 'VND' ||
      !(t.reference === null || typeof t.reference === 'string') || !['RENEWAL', 'RENTAL_BALANCE'].includes(String(t.purpose)) ||
      typeof t.deadlineExpired !== 'boolean' || typeof t.receiptAvailable !== 'boolean' ||
      !(t.paymentDeadline === null || date(t.paymentDeadline)) || !(t.paidAt === null || date(t.paidAt))) return false
    if (t.receiptAvailable && !['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(t.status)) return false
    ids.add(t.paymentId); return true
  })
}
