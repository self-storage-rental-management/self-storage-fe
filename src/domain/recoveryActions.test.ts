import { describe, expect, it } from 'vitest'
import { isManagerOverdueRecovery, visibleRecoveryActions } from './recoveryActions'

describe('automatic recovery actions', () => {
  it('hides retired gates even if an older server sends them', () => {
    expect(visibleRecoveryActions(['NOTICE', 'ACCEPT', 'DECLINE', 'CONFIRM_VIOLATION', 'APPROVE', 'RESCHEDULE', 'START', 'BLOCK'], 'AWAITING_ATTENDANCE', null))
      .toEqual(['START', 'BLOCK'])
  })
  it('lets the customer make all three choices during the six-hour response window', () => {
    const choices = ['WILL_ATTEND', 'CANNOT_ATTEND', 'DISPUTE']
    const due = '2026-11-27T06:00:00Z'
    expect(visibleRecoveryActions(choices, 'AWAITING_ASSIGNMENT', due, Date.parse(due) - 1)).toEqual(choices)
    expect(visibleRecoveryActions(choices, 'AWAITING_ASSIGNMENT', due, Date.parse(due))).toEqual([])
  })
  it('keeps complaints after completion available separately from the attendance response', () => {
    expect(visibleRecoveryActions(['DISPUTE', 'REQUEST_FINANCE'], 'COMPLETED', '2026-11-26T00:00:00Z'))
      .toEqual(['DISPUTE', 'REQUEST_FINANCE'])
  })
})

describe('business recovery queue', () => {
  it('shows only overdue Manager assignment or review work', () => {
    const entries = [
      { id: 'on-time', stage: 'AWAITING_ASSIGNMENT', escalated: false },
      { id: 'overdue-assignment', stage: 'AWAITING_ASSIGNMENT', escalated: true },
      { id: 'overdue-review', stage: 'BLOCKED', escalated: true },
      { id: 'staff-working', stage: 'IN_PROGRESS', escalated: true },
      { id: 'assigned', stage: 'AWAITING_ATTENDANCE', escalated: true },
      { id: 'completed', stage: 'COMPLETED', escalated: true },
      { id: 'cancelled', stage: 'CANCELLED', escalated: true },
    ]
    expect(entries.filter(isManagerOverdueRecovery).map(entry => entry.id))
      .toEqual(['overdue-assignment', 'overdue-review'])
  })
  it('removes a case when assignment or resumption clears its escalation', () => {
    expect(isManagerOverdueRecovery({ stage: 'AWAITING_ATTENDANCE', escalated: false })).toBe(false)
    expect(isManagerOverdueRecovery({ stage: 'BLOCKED', escalated: false })).toBe(false)
    expect(isManagerOverdueRecovery({ stage: 'AWAITING_ASSIGNMENT' })).toBe(false)
  })
})
