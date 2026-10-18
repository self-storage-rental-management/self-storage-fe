import { describe, expect, it } from 'vitest'
import { isCheckInAppointmentAllowed, plannedCheckInWindow } from './reservationCheckInPolicy'

describe('reservation check in policy', () => {
  it('includes 15 minutes for payment between review and assignment', () => {
    const window = plannedCheckInWindow('2026-10-12T10:30:00+07:00', true)
    expect(window.availableAt.toISOString()).toBe('2026-10-14T04:00:00.000Z')
  })

  it('moves a result at closing time to eight the next morning', () => {
    const window = plannedCheckInWindow('2026-10-12T17:30:00+07:00', true)
    expect(window.availableAt.toISOString()).toBe('2026-10-15T01:00:00.000Z')
  })

  it('accepts the final slot at four thirty and rejects five o clock', () => {
    const window = plannedCheckInWindow('2026-10-12T10:00:00+07:00', false)
    expect(isCheckInAppointmentAllowed(new Date('2026-10-13T16:30:00+07:00'), window)).toBe(true)
    expect(isCheckInAppointmentAllowed(new Date('2026-10-13T17:00:00+07:00'), window)).toBe(false)
  })

  it('counts the seven-day check-in window in working days and skips weekends', () => {
    const window = plannedCheckInWindow('2026-10-12T10:00:00+07:00', false)
    expect(window.availableAt.toISOString()).toBe('2026-10-13T03:30:00.000Z')
    expect(window.deadlineAt.toISOString()).toBe('2026-10-22T03:30:00.000Z')
    expect(isCheckInAppointmentAllowed(new Date('2026-10-17T10:00:00+07:00'), window)).toBe(false)
  })
})
