import { describe, expect, it } from 'vitest'
import { estimatedRentalPeriod } from './rentalTimeline'
describe('paid rental starts after setup', () => {
  it('starts paid rental on 05 November for handover on 30 October and six free days', () => {
    expect(estimatedRentalPeriod('2026-10-30', 6, 3)).toEqual({ startDate: '2026-11-05', endDate: '2027-02-05' })
  })
  it('moves the entire paid period when the planned handover changes', () => {
    expect(estimatedRentalPeriod('2026-11-02', 6, 3)).toEqual({ startDate: '2026-11-08', endDate: '2027-02-08' })
  })
  it('clamps calendar month boundaries like the backend', () => {
    expect(estimatedRentalPeriod('2026-01-25', 6, 1)).toEqual({ startDate: '2026-01-31', endDate: '2026-02-28' })
  })
  it('allows packages without free setup days', () => {
    expect(estimatedRentalPeriod('2026-10-30', 0, 1)?.startDate).toBe('2026-10-30')
  })
})
