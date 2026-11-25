import type { CheckInCase } from '../services/checkInApi'
import { formatCustomerDateTime } from '../i18n/customerDate'
export const PAYMENT_WINDOW_MINUTES = 15
export const STAFF_REVIEW_HOURS = 6
export const MANAGER_ASSIGNMENT_HOURS = 6
export const CHECK_IN_WINDOW_DAYS = 7
export const CHECK_IN_SLOT_MINUTES = 30
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000


// Facility hours are Vietnam wall-clock hours, independent of the browser/CI timezone.
function policyClock(value: Date) {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
}

export function isCheckInHandoverExpired(appointmentAt: string | null | undefined, now = Date.now()) {
  if (!appointmentAt) return false
  const appointmentDay = Math.floor(policyClock(new Date(appointmentAt)).getTime() / DAY_MS)
  const currentDay = Math.floor((now + VIETNAM_OFFSET_MS) / DAY_MS)
  return currentDay - appointmentDay >= CHECK_IN_WINDOW_DAYS
}

type IntakeCase = Pick<CheckInCase, 'intakeAction' | 'checkInStatus' | 'checkInId' | 'appointmentAt' | 'scheduledAt'>

export function staffCheckInActions(item: IntakeCase, now = Date.now()) {
  const status = item.checkInStatus
  const at = item.appointmentAt ?? item.scheduledAt
  const starts = status === null || status === 'scheduled'
  const afterHandover = status === 'handover_pending_receipt' || status === 'setup_in_progress' || status === 'setup_completed'
  const withinWindow = !!at && Number.isFinite(Date.parse(at)) && !isCheckInHandoverExpired(at, now)
  const existingCase = !!item.checkInId
  const canOpen = starts
    ? item.intakeAction === 'START' && withinWindow && (status === null || existingCase)
    : item.intakeAction === 'CONTINUE' && existingCase && (afterHandover || withinWindow)
  const canReject = canOpen && status === 'scheduled'
  return {
    label: starts ? 'Bắt đầu nhận kho' : 'Tiếp tục nhận kho',
    canOpen,
    canReject,
    canMarkAbsent: canReject && !!at && Date.parse(at) <= now,
  }
}

export function plannedCheckInWindow(registeredAt: Date | string | number, reviewRequired: boolean) {
  const registered = new Date(registeredAt)
  const preparationHours = (reviewRequired ? STAFF_REVIEW_HOURS : 0) + MANAGER_ASSIGNMENT_HOURS
  const availableAt = new Date(registered.getTime()
    + preparationHours * 60 * 60 * 1000
    + PAYMENT_WINDOW_MINUTES * 60 * 1000)

  return {
    availableAt,
    deadlineAt: new Date(availableAt.getTime() + CHECK_IN_WINDOW_DAYS * DAY_MS),
  }
}

export function isCheckInAppointmentAllowed(value: Date, window: ReturnType<typeof plannedCheckInWindow>) {
  return !Number.isNaN(value.getTime()) && value >= window.availableAt && value <= window.deadlineAt
}

export function isCheckInDateAllowed(value: Date | string, window: ReturnType<typeof plannedCheckInWindow>) {
  const date = typeof value === 'string' ? value : policyDateInput(value)
  const firstDate = policyDateInput(window.availableAt)
  const lastDate = policyDateInput(window.deadlineAt)
  return Boolean(date) && date >= firstDate && date <= lastDate
}

export function firstCheckInMinute(availableAt: Date) {
  return new Date(Math.ceil(availableAt.getTime() / 60_000) * 60_000)
}

export function firstCheckInSlot(availableAt: Date, slotMinutes = CHECK_IN_SLOT_MINUTES) {
  const slotMs = slotMinutes * 60_000
  return new Date(Math.ceil(availableAt.getTime() / slotMs) * slotMs)
}

// Leave a minute for the create request to reach the server, which checks its own clock.
export function submissionCheckInWindow(now: number, reviewRequired: boolean) {
  const window = plannedCheckInWindow(now, reviewRequired)
  return { ...window, availableAt: new Date(window.availableAt.getTime() + 60_000) }
}

export function firstBookableCheckInMinute(window: ReturnType<typeof plannedCheckInWindow>) {
  const candidate = firstCheckInMinute(window.availableAt)
  return candidate <= window.deadlineAt ? candidate : null
}

export function firstBookableCheckInSlot(
  window: ReturnType<typeof plannedCheckInWindow>,
  slotMinutes = CHECK_IN_SLOT_MINUTES,
) {
  const candidate = firstCheckInSlot(window.availableAt, slotMinutes)
  return candidate <= window.deadlineAt ? candidate : null
}

export function policyDateInput(value: Date) {
  const clock = policyClock(value)
  const year = clock.getUTCFullYear()
  const month = `${clock.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${clock.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function policyTimeInput(value: Date) {
  const clock = policyClock(value)
  return `${`${clock.getUTCHours()}`.padStart(2, '0')}:${`${clock.getUTCMinutes()}`.padStart(2, '0')}`
}

export function policyDateTimeInput(value: Date) {
  return `${policyDateInput(value)}T${policyTimeInput(value)}`
}

export function formatPolicyDateTime(value: Date) {
  return formatCustomerDateTime(value)
}
