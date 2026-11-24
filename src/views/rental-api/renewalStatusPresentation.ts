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
  if (r.status === 'payment_expired' && r.statusSummary?.workflowStatus === 'AWAITING_RECONCILIATION')
    return 'Đã đóng, chờ đối soát VNPay'
  if (r.status === 'accepted' && r.statusSummary?.workflowStatus === 'AWAITING_RECONCILIATION'
      && r.approvedPaymentDeadline && Date.parse(r.approvedPaymentDeadline) <= Date.now())
    return 'Đã hết hạn, đang đối soát VNPay'
  if (r.statusSummary) return renewalWorkflowLabels[r.statusSummary.workflowStatus]
  return ({ pending: 'Đang kiểm tra', accepted: 'Chờ thanh toán', approved: 'Chờ thanh toán',
    deposit_paid: 'Chờ ký gia hạn', full_rent_paid: 'Chờ ký gia hạn', appointment_scheduled: 'Đã hẹn ký gia hạn',
    payment_processing: 'Chờ kết quả thanh toán', payment_failed: 'Chờ thanh toán lại', payment_expired: 'Hết hạn thanh toán',
    completed: 'Gia hạn hoàn tất', rejected: 'Đã đóng', cancelled: 'Đã hủy' } as const)[r.status]
}

export function renewalProgressInterruption(r: RenewalApiRecord, paymentDeadlinePassed: boolean): {
  label: string
  message: string
  stepLabel?: string
} | null {
  const stage = r.statusSummary?.workflowStatus
  if (r.status === 'completed' || stage === 'COMPLETED') return null
  if (r.status === 'rejected' || stage === 'REJECTED') return {
    label: 'Yêu cầu bị từ chối',
    message: r.reviewReason ? 'Xem lý do từ chối bên dưới.' : 'Yêu cầu này đã được đóng.',
  }
  if (r.status === 'cancelled' || stage === 'CANCELLED') return {
    label: 'Yêu cầu đã hủy',
    message: 'Nếu đã thanh toán, hãy xem bảng kê để theo dõi khoản đã thu.',
  }
  if (r.status === 'payment_expired' || stage === 'PAYMENT_WINDOW_EXPIRED' ||
    (paymentDeadlinePassed && (!stage || stage === 'AWAITING_PAYMENT' || stage === 'AWAITING_RECONCILIATION'))) {
    const reconciling = stage === 'AWAITING_RECONCILIATION'
    return {
      label: 'Đã hết hạn thanh toán',
      message: reconciling
        ? 'Cơ sở đang đối soát thanh toán. Bạn chưa thể mở lượt thanh toán mới.'
        : r.status === 'payment_expired'
          ? 'Bạn có thể gửi yêu cầu mới nếu hợp đồng còn đủ điều kiện gia hạn.'
          : 'Bạn chưa thể thanh toán yêu cầu này. Hãy theo dõi trạng thái hồ sơ để biết bước tiếp theo.',
    }
  }
  if (stage === 'NO_SHOW') return {
    label: 'Khách không đến',
    message: 'Cơ sở đã ghi nhận khách không đến. Nếu hồ sơ còn đủ điều kiện đổi lịch, khoản trả trước đã ghi nhận vẫn được giữ để xử lý gia hạn.',
    stepLabel: 'Khách không đến',
  }
  if (stage === 'SIGNING_EXPIRED') return {
    label: 'Đã hết hạn ký',
    message: 'Khoản đã thu được theo dõi riêng để đối soát và xử lý theo chính sách.',
    stepLabel: 'Hết hạn',
  }
  if (stage === 'ON_HOLD') return {
    label: 'Tạm dừng xử lý',
    message: 'Vui lòng kiểm tra điều kiện gia hạn hoặc thông tin thanh toán trước khi tiếp tục.',
    stepLabel: 'Tạm dừng',
  }
  return null
}

export function renewalProgress(r: RenewalApiRecord, p: RenewalVnpayPaymentResponse | null) {
  const stage = r.statusSummary?.workflowStatus
  if (stage === 'COMPLETED' || r.status === 'completed') return 5
  if (stage === 'NO_SHOW' || stage === 'SIGNING_EXPIRED') return 4
  if (p?.paymentStatus === 'PAID' && !reconciledRenewalPayment(p)) return 2
  if (stage === 'AWAITING_SIGNING' || stage === 'SIGNING_IN_PROGRESS') return 4
  if (stage === 'AWAITING_RECONCILIATION') return 2
  if (reconciledRenewalPayment(p)) return 3
  if (r.status === 'appointment_scheduled') return 4
  if (['deposit_paid', 'full_rent_paid'].includes(r.status)) return 3
  return ['accepted', 'approved', 'payment_processing', 'payment_failed', 'payment_expired'].includes(r.status) ? 2 : 1
}
