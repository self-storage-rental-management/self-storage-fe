import { compareWorkQueue } from './workQueueSort'

export function compareReservationCreatedAt(
  a: { id: string; createdAt?: string | null },
  b: { id: string; createdAt?: string | null },
  order: 'newest' | 'oldest',
) {
  const left = a.createdAt ? Date.parse(a.createdAt) : NaN
  const right = b.createdAt ? Date.parse(b.createdAt) : NaN
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    if (Number.isFinite(left)) return -1
    if (Number.isFinite(right)) return 1
    return a.id.localeCompare(b.id)
  }
  return (order === 'newest' ? right - left : left - right) || a.id.localeCompare(b.id)
}

type ReservationQueueRow = {
  id: string; status: string; createdAt?: string | null; holdExpiresAt?: string | null
  paymentExpiresAt?: string | null; appointmentAt?: string | null; violationRecovery?: boolean
}
export function compareCustomerReservations(a: ReservationQueueRow, b: ReservationQueueRow) {
  const order = (r: ReservationQueueRow) => {
    const closed = r.violationRecovery || ['EXPIRED', 'COMPLETED', 'CANCELLED'].includes(r.status.toUpperCase())
    const payment = ['AWAITING_PAYMENT', 'PAYMENT_GRACE'].includes(r.status)
    const actionable = payment || ['AWAITING_EMAIL', 'AWAITING_CUSTOMER_RECEIPT', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(r.status)
    return { id: r.id, closed, actionable,
      dueAt: payment ? r.paymentExpiresAt ?? r.holdExpiresAt : r.status === 'AWAITING_EMAIL' ? r.holdExpiresAt : r.appointmentAt,
      waitingSince: r.createdAt, completedAt: r.createdAt }
  }
  return compareWorkQueue(order(a), order(b))
}
