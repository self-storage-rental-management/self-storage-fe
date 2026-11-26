import type { ApiReturn, ReturnRole } from '../services/returnApi'
import { compareWorkQueue, type QueueOrder } from './workQueueSort'

export function returnQueueOrder(record: ApiReturn, role: ReturnRole, now = Date.now()): QueueOrder {
  const a = record.attendance
  const inspection = ['requested', 'scheduled'].includes(record.status)
  const identityReview = inspection && a?.reviewAccepted !== false && !!a?.reviewStartsAt && Date.parse(a.reviewStartsAt) <= now
  const customerAction = ['awaiting_customer_confirmation', 'payment_due'].includes(record.status)
  const managerApproval = record.managerApprovalRequired ?? record.returnType === 'INVENTORY_MISMATCH'
  const managerAction = identityReview || record.status === 'disputed'
    || record.status === 'awaiting_business_review' && managerApproval
  const businessAction = record.status === 'disputed'
    || record.status === 'awaiting_business_review' && !managerApproval
  const actionable = role === 'customer' ? customerAction || inspection
    : role === 'staff' ? inspection && !identityReview || ['refund_pending', 'payment_due', 'recovery_required'].includes(record.status)
    : role === 'manager' ? managerAction || record.status === 'refund_pending'
    : businessAction || record.status === 'refund_pending'
  const dueAt = role === 'customer' && record.status === 'awaiting_customer_confirmation' ? record.customerConfirmationDueAt
    : record.status === 'payment_due' ? record.settlementPaymentDueAt
    : managerAction || businessAction ? record.managerReviewDueAt
    : record.status === 'recovery_required' ? record.recoveryTaskDeadlineAt
    : inspection && !identityReview ? a?.handoverDueAt ?? a?.handoverAppointmentAt ?? record.scheduledDate : null
  return { id: record.id, closed: ['completed', 'withdrawn_for_recovery'].includes(record.status), actionable,
    urgent: role === 'staff' && inspection && !identityReview && !!a?.arrivedAt,
    dueAt, waitingSince: customerAction ? record.settlementPublishedAt ?? record.inspectedAt ?? record.requestedAt : record.requestedAt,
    completedAt: record.completedAt }
}

export function compareReturnQueue(a: ApiReturn, b: ApiReturn, role: ReturnRole, now = Date.now()) {
  return compareWorkQueue(returnQueueOrder(a, role, now), returnQueueOrder(b, role, now), now)
}
