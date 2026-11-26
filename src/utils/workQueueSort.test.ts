import { describe, expect, it } from 'vitest'
import { compareWorkQueue, queueTime, compareQueueTime, type QueueOrder } from './workQueueSort'

const now = Date.parse('2026-11-26T03:00:00Z')
const order = (rows: QueueOrder[]) => [...rows].sort((a, b) => compareWorkQueue(a, b, now)).map(row => row.id)
describe('business work queue ordering', () => {
  it('puts work owned by this role before waiting on someone else, then urgent, overdue, nearest due and oldest waiting', () => {
    expect(order([
      { id: 'waiting', actionable: false, dueAt: '2026-11-20T00:00:00Z' },
      { id: 'missing', waitingSince: '2020-01-01' },
      { id: 'today', dueAt: '2026-11-26' },
      { id: 'overdue', dueAt: '2026-11-25' },
      { id: 'urgent', urgent: true, dueAt: '2026-11-27' },
      { id: 'closed', closed: true },
    ])).toEqual(['urgent', 'overdue', 'today', 'missing', 'waiting', 'closed'])
  })
  it('does not reverse missing dates to the top and has a stable ID tie break', () => {
    expect(compareQueueTime(null, '2026-11-25', true)).toBeGreaterThan(0)
    expect(order([{ id: 'b', dueAt: 'bad' }, { id: 'a', dueAt: null }])).toEqual(['a', 'b'])
    expect(order([{ id: 'b', dueAt: '2026-11-27', waitingSince: '2026-11-24' },
      { id: 'a', dueAt: '2026-11-27', waitingSince: '2026-11-23' }])).toEqual(['a', 'b'])
  })
  it('treats date-only due dates as the end of the Vietnam day', () => {
    expect(queueTime('2026-11-26', true)).toBe(Date.parse('2026-11-26T16:59:59.999Z'))
  })
  it('keeps finished work after open work and orders history by completion', () => {
    expect(order([{ id: 'old', closed: true, completedAt: '2026-11-24' }, { id: 'open' },
      { id: 'new', closed: true, completedAt: '2026-11-25' }])).toEqual(['open', 'new', 'old'])
  })
})
