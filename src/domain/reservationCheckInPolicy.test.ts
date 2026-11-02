import { describe, expect, it } from 'vitest'
import { firstBookableCheckInMinute, firstCheckInMinute, submissionCheckInWindow, isCheckInAppointmentAllowed, plannedCheckInWindow, policyDateInput, policyTimeInput } from './reservationCheckInPolicy'

describe('reservation check in policy', () => {
  it.each([false, true])('rechecks an appointment after time spent filling the form, review=%s', reviewRequired => {
    const openedAt = Date.parse('2026-10-30T10:00:00+07:00')
    const previousSelection = firstCheckInMinute(plannedCheckInWindow(openedAt, reviewRequired).availableAt)
    const submittedAt = openedAt + 5 * 60_000
    const window = submissionCheckInWindow(submittedAt, reviewRequired)
    expect(isCheckInAppointmentAllowed(previousSelection, window)).toBe(false)
    const suggested = firstBookableCheckInMinute(window)!
    // Still valid after the server receives the request 30 seconds later.
    expect(isCheckInAppointmentAllowed(suggested, plannedCheckInWindow(submittedAt + 30_000, reviewRequired))).toBe(true)
    expect(isCheckInAppointmentAllowed(new Date('2026-11-02T10:00:00+07:00'), window)).toBe(true)
  })

  it('allows the earliest appointment at night without shifting to facility opening hours', () => {
    const window = submissionCheckInWindow(Date.parse('2026-10-30T13:07:00+07:00'), false)
    const suggested = firstBookableCheckInMinute(window)!
    expect(policyDateInput(suggested)).toBe('2026-10-30')
    expect(policyTimeInput(suggested)).toBe('19:23')
  })

  it('does not extend the seven-day deadline when allowing for request transit', () => {
    const now = Date.parse('2026-10-30T10:00:00+07:00')
    const window = submissionCheckInWindow(now, false)
    expect(window.deadlineAt).toEqual(plannedCheckInWindow(now, false).deadlineAt)
    expect(firstBookableCheckInMinute({ ...window, availableAt: new Date(window.deadlineAt.getTime() + 1) })).toBeNull()
  })
  it('chooses a selectable minute inside the allowed window including midnight rollover', () => {
    const window = plannedCheckInWindow('2026-10-27T17:44:23.456+07:00', false)
    const first = firstCheckInMinute(window.availableAt)
    expect(policyDateInput(first)).toBe('2026-10-28')
    expect(policyTimeInput(first)).toBe('00:00')
    expect(isCheckInAppointmentAllowed(first, window)).toBe(true)
    expect(firstCheckInMinute(first)).toEqual(first)
  })
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
