import { describe, expect, it } from 'vitest'
import { staffCheckInActions, firstBookableCheckInMinute, firstBookableCheckInSlot, firstCheckInMinute, firstCheckInSlot, submissionCheckInWindow, isCheckInAppointmentAllowed, isCheckInHandoverExpired, plannedCheckInWindow, policyDateInput, policyTimeInput } from './reservationCheckInPolicy'

it('expires handover at midnight in Vietnam on the eighth calendar day', () => {
  const appointment = '2026-11-21T15:00:00+07:00'
  expect(isCheckInHandoverExpired(appointment, Date.parse('2026-11-27T16:59:59.999Z'))).toBe(false)
  expect(isCheckInHandoverExpired(appointment, Date.parse('2026-11-27T17:30:00Z'))).toBe(false)
  expect(isCheckInHandoverExpired(appointment, Date.parse('2026-11-27T17:30:00.001Z'))).toBe(true)
  expect(isCheckInHandoverExpired(null)).toBe(false)
})

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

describe('staff intake actions', () => {
  const appointmentAt = '2026-11-22T10:00:00+07:00'
  const at = Date.parse(appointmentAt)
  const scheduled = { intakeAction: 'START', checkInStatus: 'scheduled', checkInId: 'id', appointmentAt,
    scheduledAt: '2026-11-21T10:00:00+07:00' } as const

  it('allows opening intake and only enables rejection after arrival is recorded', () => {
    expect(staffCheckInActions(scheduled, at - 1)).toEqual({
      label: 'Bắt đầu nhận kho', canOpen: true, canReject: false,
    })
    expect(staffCheckInActions(scheduled, at).canReject).toBe(false)
    const arrived = { ...scheduled, attendance: { deadline: null, arrivedAt: appointmentAt } }
    const comparing = { ...arrived, attendance: { ...arrived.attendance, completionDeadline: new Date(at + 72 * 3600000).toISOString() } }
    expect(staffCheckInActions(comparing, at + 72 * 3600000).canOpen).toBe(true)
    expect(staffCheckInActions(comparing, at + 72 * 3600000 + 1).canOpen).toBe(false)
    expect(staffCheckInActions(arrived, at + 8 * 86400_000)).toMatchObject({ canOpen: true, canReject: true })
  })

  it('blocks actions for missing appointments, elapsed deadlines and API-ineligible cases', () => {
    for (const actions of [
      staffCheckInActions({ ...scheduled, appointmentAt: null, scheduledAt: null }, at),
      staffCheckInActions(scheduled, at + 7 * 86400_000),
      staffCheckInActions({ ...scheduled, intakeAction: 'NONE' }, at),
    ]) expect(actions).toMatchObject({ canOpen: false, canReject: false })
  })

  it('offers only the primary action before scheduling or after identity verification', () => {
    expect(staffCheckInActions({ ...scheduled, checkInStatus: null, checkInId: null }, at))
      .toMatchObject({ label: 'Bắt đầu nhận kho', canOpen: true, canReject: false })
    expect(staffCheckInActions({ ...scheduled, checkInStatus: 'identity_verified', intakeAction: 'CONTINUE' }, at))
      .toEqual({ label: 'Tiếp tục nhận kho', canOpen: true, canReject: false })
  })

  it('keeps post-handover follow-up available past the intake deadline', () => {
    expect(staffCheckInActions({ ...scheduled, checkInStatus: 'setup_completed', intakeAction: 'CONTINUE' },
      at + 10 * 86400_000)).toMatchObject({ canOpen: true, canReject: false })
  })
})

it('rounds check-in slot up to the next 30-minute boundary', () => {
  const window = plannedCheckInWindow('2026-10-30T14:00:00+07:00', false) // availableAt = 20:15
  const slot = firstCheckInSlot(window.availableAt)
  expect(policyTimeInput(slot)).toBe('20:30')
  expect(isCheckInAppointmentAllowed(slot, window)).toBe(true)

  const exact = new Date('2026-10-30T20:00:00+07:00')
  expect(policyTimeInput(firstCheckInSlot(exact))).toBe('20:00')

  const subWindow = submissionCheckInWindow(Date.parse('2026-10-30T14:00:00+07:00'), false)
  expect(policyTimeInput(firstBookableCheckInSlot(subWindow)!)).toBe('20:30')
})
