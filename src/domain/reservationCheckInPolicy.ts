export const PAYMENT_WINDOW_MINUTES = 15
export const STAFF_REVIEW_HOURS = 6
export const MANAGER_ASSIGNMENT_HOURS = 6
export const CHECK_IN_WINDOW_DAYS = 7
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const POLICY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

// Facility hours are Vietnam wall-clock hours, independent of the browser/CI timezone.
function policyClock(value: Date) {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
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

export function firstCheckInMinute(availableAt: Date) {
  return new Date(Math.ceil(availableAt.getTime() / 60_000) * 60_000)
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
  return value.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: POLICY_TIME_ZONE })
}
