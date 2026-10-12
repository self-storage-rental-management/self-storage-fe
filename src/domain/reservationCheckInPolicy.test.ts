import { describe, expect, it } from 'vitest'
import { isCheckInAppointmentAllowed, plannedCheckInWindow } from './reservationCheckInPolicy'

describe('reservation check in policy', () => {
  it('uses one working day for review and one working day for assignment', () => {
    const window = plannedCheckInWindow('2026-10-12T10:30:00+07:00', true)
    expect(window.availableAt.toISOString()).toBe('2026-10-14T09:30:00.000Z')
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
})
