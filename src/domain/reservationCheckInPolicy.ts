export const PAYMENT_WINDOW_MINUTES = 15
export const STAFF_REVIEW_WORKING_HOURS = 9
export const MANAGER_ASSIGNMENT_WORKING_HOURS = 9
export const CHECK_IN_WINDOW_DAYS = 7
export const CHECK_IN_OPENING_HOUR = 8
export const CHECK_IN_CLOSING_HOUR = 17
export const LAST_CHECK_IN_SLOT_HOUR = 16
export const LAST_CHECK_IN_SLOT_MINUTE = 30

const SLOT_MS = 30 * 60 * 1000

function isWorkingDay(value: Date) {
  const day = value.getDay()
  return day >= 1 && day <= 5
}

function ceilToAppointmentSlot(value: Date) {
  return new Date(Math.ceil(value.getTime() / SLOT_MS) * SLOT_MS)
}

function startOfNextWorkingDay(value: Date) {
  const next = new Date(value)
  do {
    next.setDate(next.getDate() + 1)
    next.setHours(CHECK_IN_OPENING_HOUR, 0, 0, 0)
  } while (!isWorkingDay(next))
  return next
}

export function addWorkingDays(value: Date, days: number) {
  const result = new Date(value)
  let remaining = days
  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    if (isWorkingDay(result)) remaining -= 1
  }
  return result
}

export function addWorkingHours(value: Date, hours: number) {
  let cursor = new Date(value)
  let remainingMinutes = hours * 60

  while (remainingMinutes > 0) {
    if (!isWorkingDay(cursor)) {
      cursor = startOfNextWorkingDay(cursor)
      continue
    }
    const minuteOfDay = cursor.getHours() * 60 + cursor.getMinutes()
    const openingMinute = CHECK_IN_OPENING_HOUR * 60
    const closingMinute = CHECK_IN_CLOSING_HOUR * 60

    if (minuteOfDay < openingMinute) {
      cursor.setHours(CHECK_IN_OPENING_HOUR, 0, 0, 0)
    } else if (minuteOfDay >= closingMinute) {
      cursor = startOfNextWorkingDay(cursor)
    }

    const availableMinutes = CHECK_IN_CLOSING_HOUR * 60
      - (cursor.getHours() * 60 + cursor.getMinutes())
    const consumedMinutes = Math.min(remainingMinutes, availableMinutes)
    cursor = new Date(cursor.getTime() + consumedMinutes * 60_000)
    remainingMinutes -= consumedMinutes
  }

  return cursor
}

function normalizeCheckInSlot(value: Date) {
  let candidate = new Date(value)
  if (!isWorkingDay(candidate)) return startOfNextWorkingDay(candidate)
  const openingMinute = CHECK_IN_OPENING_HOUR * 60
  const lastSlotMinute = LAST_CHECK_IN_SLOT_HOUR * 60 + LAST_CHECK_IN_SLOT_MINUTE
  const minuteOfDay = candidate.getHours() * 60 + candidate.getMinutes()

  if (minuteOfDay < openingMinute) {
    candidate.setHours(CHECK_IN_OPENING_HOUR, 0, 0, 0)
    return candidate
  }

  candidate = ceilToAppointmentSlot(candidate)
  if (candidate.getHours() * 60 + candidate.getMinutes() > lastSlotMinute) {
    return startOfNextWorkingDay(candidate)
  }
  return candidate
}

export function plannedCheckInWindow(registeredAt: Date | string | number, reviewRequired: boolean) {
  let candidate = new Date(registeredAt)
  if (reviewRequired) candidate = addWorkingHours(candidate, STAFF_REVIEW_WORKING_HOURS)
  candidate = new Date(candidate.getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000)
  candidate = addWorkingHours(candidate, MANAGER_ASSIGNMENT_WORKING_HOURS)
  const availableAt = normalizeCheckInSlot(candidate)

  return {
    availableAt,
    deadlineAt: addWorkingDays(availableAt, CHECK_IN_WINDOW_DAYS),
  }
}

export function isCheckInAppointmentAllowed(value: Date, window: ReturnType<typeof plannedCheckInWindow>) {
  if (Number.isNaN(value.getTime()) || !isWorkingDay(value) || value < window.availableAt || value > window.deadlineAt) return false
  const minutes = value.getHours() * 60 + value.getMinutes()
  return minutes >= CHECK_IN_OPENING_HOUR * 60
    && minutes <= LAST_CHECK_IN_SLOT_HOUR * 60 + LAST_CHECK_IN_SLOT_MINUTE
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
