import { describe, expect, it } from 'vitest'
import { isCheckInAppointmentAllowed, plannedCheckInWindow, policyDateInput, policyTimeInput } from './reservationCheckInPolicy'

describe('reservation check in policy', () => {
  it('formats appointment inputs in Vietnam time across the UTC date boundary', () => {
    const instant = new Date('2026-10-19T18:30:00Z')
    expect(policyDateInput(instant)).toBe('2026-10-20')
    expect(policyTimeInput(instant)).toBe('01:30')
  })
  it('includes 15 minutes for payment between review and assignment', () => {
    const window = plannedCheckInWindow('2026-10-12T10:30:00+07:00', true)
    expect(window.availableAt.toISOString()).toBe('2026-10-12T15:45:00.000Z')
  })

  it('keeps elapsed deadlines through the night', () => {
    const window = plannedCheckInWindow('2026-10-12T17:30:00+07:00', true)
    expect(window.availableAt.toISOString()).toBe('2026-10-12T22:45:00.000Z')
  })

  it('accepts odd minutes and every hour inside the window', () => {
    const window = plannedCheckInWindow('2026-10-12T10:00:00+07:00', false)
    expect(isCheckInAppointmentAllowed(new Date('2026-10-12T22:17:00+07:00'), window)).toBe(true)
    expect(isCheckInAppointmentAllowed(new Date('2026-10-13T03:43:00+07:00'), window)).toBe(true)
  })

  it('keeps a continuous seven-day appointment window', () => {
    const window = plannedCheckInWindow('2026-10-12T10:00:00+07:00', false)
    expect(window.availableAt.toISOString()).toBe('2026-10-12T09:15:00.000Z')
    expect(window.deadlineAt.toISOString()).toBe('2026-10-19T09:15:00.000Z')
    expect(isCheckInAppointmentAllowed(new Date('2026-10-17T10:00:00+07:00'), window)).toBe(true)
    expect(isCheckInAppointmentAllowed(new Date('2026-10-19T16:15:00+07:00'), window)).toBe(true)
    expect(isCheckInAppointmentAllowed(new Date('2026-10-19T16:16:00+07:00'), window)).toBe(false)
  })
})
