export const PAYMENT_WINDOW_HOURS = 6
export const STAFF_REVIEW_HOURS = 24
export const MANAGER_ASSIGNMENT_HOURS = 24
export const CHECK_IN_WINDOW_DAYS = 7
export const CHECK_IN_OPENING_HOUR = 8
export const CHECK_IN_CLOSING_HOUR = 17

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const SLOT_MS = 30 * 60 * 1000

function ceilToAppointmentSlot(value: Date) {
  return new Date(Math.ceil(value.getTime() / SLOT_MS) * SLOT_MS)
}

export function plannedCheckInWindow(registeredAt: Date | string | number, reviewRequired: boolean) {
  const registered = new Date(registeredAt)
  const reviewHours = reviewRequired ? STAFF_REVIEW_HOURS : 0
  let availableAt = new Date(registered.getTime()
    + (reviewHours + PAYMENT_WINDOW_HOURS + MANAGER_ASSIGNMENT_HOURS) * HOUR_MS)

  if (availableAt.getHours() < CHECK_IN_OPENING_HOUR) {
    availableAt.setHours(CHECK_IN_OPENING_HOUR, 0, 0, 0)
  } else {
    availableAt = ceilToAppointmentSlot(availableAt)
    if (availableAt.getHours() * 60 + availableAt.getMinutes() > CHECK_IN_CLOSING_HOUR * 60) {
      availableAt.setDate(availableAt.getDate() + 1)
      availableAt.setHours(CHECK_IN_OPENING_HOUR, 0, 0, 0)
    }
  }

  return {
    availableAt,
    deadlineAt: new Date(availableAt.getTime() + CHECK_IN_WINDOW_DAYS * DAY_MS),
  }
}

export function isCheckInAppointmentAllowed(value: Date, window: ReturnType<typeof plannedCheckInWindow>) {
  if (Number.isNaN(value.getTime()) || value < window.availableAt || value > window.deadlineAt) return false
  const minutes = value.getHours() * 60 + value.getMinutes()
  return minutes >= CHECK_IN_OPENING_HOUR * 60
    && minutes <= CHECK_IN_CLOSING_HOUR * 60
    && value.getMinutes() % 30 === 0
}

export function policyDateInput(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function policyTimeInput(value: Date) {
  return `${`${value.getHours()}`.padStart(2, '0')}:${`${value.getMinutes()}`.padStart(2, '0')}`
}

export function policyDateTimeInput(value: Date) {
  return `${policyDateInput(value)}T${policyTimeInput(value)}`
}

export function formatPolicyDateTime(value: Date) {
  return value.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}
