import { describe, expect, it } from 'vitest'
import { compareReservationCreatedAt } from './reservationQueueSort'

describe('reservation creation ordering', () => {
  const rows = [
    { id: 'old', createdAt: '2026-11-25T10:00:00Z' },
    { id: 'unknown', createdAt: null },
    { id: 'new', createdAt: '2026-11-27T10:00:00Z' },
    { id: 'invalid', createdAt: 'invalid' },
  ]
  it('sorts newest first and leaves missing dates last', () => {
    expect([...rows].sort((a, b) => compareReservationCreatedAt(a, b, 'newest')).map(r => r.id))
      .toEqual(['new', 'old', 'invalid', 'unknown'])
  })
  it('sorts oldest first and leaves missing dates last', () => {
    expect([...rows].sort((a, b) => compareReservationCreatedAt(a, b, 'oldest')).map(r => r.id))
      .toEqual(['old', 'new', 'invalid', 'unknown'])
  })
  it('uses the actual instant and a stable tie breaker', () => {
    expect(compareReservationCreatedAt(
      { id: 'a', createdAt: '2026-11-27T17:00:00+07:00' },
      { id: 'b', createdAt: '2026-11-27T10:00:00Z' }, 'newest',
    )).toBeLessThan(0)
  })
})
