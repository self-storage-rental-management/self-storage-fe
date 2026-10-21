export const PAYMENT_WINDOW_MINUTES = 15
export const STAFF_REVIEW_WORKING_HOURS = 9
export const MANAGER_ASSIGNMENT_WORKING_HOURS = 9
export const CHECK_IN_WINDOW_DAYS = 7
export const CHECK_IN_OPENING_HOUR = 8
export const CHECK_IN_CLOSING_HOUR = 17
export const LAST_CHECK_IN_SLOT_HOUR = 16
export const LAST_CHECK_IN_SLOT_MINUTE = 30

const SLOT_MS = 30 * 60 * 1000
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const POLICY_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const WORKING_DAYS = new Set([0, 1, 2, 3, 4, 5, 6])

// Facility hours are Vietnam wall-clock hours, independent of the browser/CI timezone.
function policyClock(value: Date) {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
}

function minuteOfPolicyDay(value: Date) {
  const clock = policyClock(value)
  return clock.getUTCHours() * 60 + clock.getUTCMinutes()
}

function atPolicyTime(value: Date, hour: number, minute = 0) {
  const clock = policyClock(value)
  clock.setUTCHours(hour, minute, 0, 0)
  return new Date(clock.getTime() - VIETNAM_OFFSET_MS)
}

function isWorkingDay(value: Date) {
  return WORKING_DAYS.has(policyClock(value).getUTCDay())
}

function ceilToAppointmentSlot(value: Date) {
  return new Date(Math.ceil(value.getTime() / SLOT_MS) * SLOT_MS)
}

function startOfNextWorkingDay(value: Date) {
  let next = new Date(value)
  do {
    next = atPolicyTime(new Date(next.getTime() + DAY_MS), CHECK_IN_OPENING_HOUR)
  } while (!isWorkingDay(next))
  return next
}

export function addWorkingDays(value: Date, days: number) {
  let result = new Date(value)
  let remaining = days
  while (remaining > 0) {
    result = new Date(result.getTime() + DAY_MS)
    if (isWorkingDay(result)) remaining -= 1
  }
  return result
}

function endOfWorkingDay(value: Date) {
  return atPolicyTime(value, LAST_CHECK_IN_SLOT_HOUR, LAST_CHECK_IN_SLOT_MINUTE)
}

export function addWorkingHours(value: Date, hours: number) {
  let cursor = new Date(value)
  let remainingMinutes = hours * 60

  while (remainingMinutes > 0) {
    if (!isWorkingDay(cursor)) {
      cursor = startOfNextWorkingDay(cursor)
      continue
    }
    const minuteOfDay = minuteOfPolicyDay(cursor)
    const openingMinute = CHECK_IN_OPENING_HOUR * 60
    const closingMinute = CHECK_IN_CLOSING_HOUR * 60

    if (minuteOfDay < openingMinute) {
      cursor = atPolicyTime(cursor, CHECK_IN_OPENING_HOUR)
    } else if (minuteOfDay >= closingMinute) {
      cursor = startOfNextWorkingDay(cursor)
    }

    const availableMinutes = CHECK_IN_CLOSING_HOUR * 60
      - minuteOfPolicyDay(cursor)
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
  const minuteOfDay = minuteOfPolicyDay(candidate)

  if (minuteOfDay < openingMinute) {
    return atPolicyTime(candidate, CHECK_IN_OPENING_HOUR)
  }

  candidate = ceilToAppointmentSlot(candidate)
  if (minuteOfPolicyDay(candidate) > lastSlotMinute) {
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
    // The availability date is day 1, so move forward only six more operating days.
    deadlineAt: endOfWorkingDay(addWorkingDays(availableAt, CHECK_IN_WINDOW_DAYS - 1)),
  }
}

export function isCheckInAppointmentAllowed(value: Date, window: ReturnType<typeof plannedCheckInWindow>) {
  if (Number.isNaN(value.getTime()) || !isWorkingDay(value) || value < window.availableAt || value > window.deadlineAt) return false
  const minutes = minuteOfPolicyDay(value)
  return minutes >= CHECK_IN_OPENING_HOUR * 60
    && minutes <= LAST_CHECK_IN_SLOT_HOUR * 60 + LAST_CHECK_IN_SLOT_MINUTE
    && minutes % 30 === 0
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
