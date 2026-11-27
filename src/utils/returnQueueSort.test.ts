import { describe, expect, it } from 'vitest'
import { compareReturnQueue } from './returnQueueSort'
import type { ApiReturn } from '../services/returnApi'

const now = Date.parse('2026-11-26T03:00:00Z')
const row = (id: string, props: Partial<ApiReturn>) => ({ id, status: 'scheduled', requestedAt: '2026-11-25T00:00:00Z', scheduledDate: '2026-11-27', ...props }) as ApiReturn
describe('role-specific return work queues', () => {
  it('puts manager decisions ahead of staff appointments and waiting on the customer', () => {
    const rows = [row('appointment', {}), row('customer', { status: 'awaiting_customer_confirmation' }),
      row('review', { status: 'awaiting_business_review', managerApprovalRequired: true, managerReviewDueAt: '2026-11-26T03:30:00Z' })]
    expect(rows.sort((a, b) => compareReturnQueue(a, b, 'manager', now)).map(r => r.id)[0]).toBe('review')
  })
  it('prioritizes a waiting customer without advancing a case blocked by identity review', () => {
    const attendance = { arrivedAt: '2026-11-26T02:55:00Z', evidenceId: null, expiresAt: null, attempts: 1, verifiedAt: null, reviewStartsAt: null, reviewAccepted: null }
    const rows = [row('future', {}), row('blocked', { attendance: { ...attendance, reviewStartsAt: '2026-11-26T02:00:00Z' } }), row('here', { attendance })]
    expect(rows.sort((a, b) => compareReturnQueue(a, b, 'staff', now)).map(r => r.id)).toEqual(['here', 'future', 'blocked'])
  })
  it('orders customer payment by its actual due date and keeps history below open work', () => {
    const rows = [row('history', { status: 'completed' }), row('later', { status: 'payment_due', settlementPaymentDueAt: '2026-11-28T00:00:00Z' }),
      row('due', { status: 'payment_due', settlementPaymentDueAt: '2026-11-26T04:00:00Z' })]
    expect(rows.sort((a, b) => compareReturnQueue(a, b, 'customer', now)).map(r => r.id)).toEqual(['due', 'later', 'history'])
  })
})
