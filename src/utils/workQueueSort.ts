import { parseVietnamDate } from './vietnamTime'

/** Missing/invalid deadlines are always last. Date-only deadlines include the whole Vietnam day. */
export function queueTime(value?: string | null, endOfDay = false): number {
  if (!value) return Infinity
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00` : value
  const time = parseVietnamDate(date).getTime()
  return Number.isFinite(time) ? time : Infinity
}

export function compareQueueTime(a?: string | null, b?: string | null, descending = false, endOfDay = false): number {
  const left = queueTime(a, endOfDay), right = queueTime(b, endOfDay)
  if (left === right) return 0
  if (!Number.isFinite(left)) return 1
  if (!Number.isFinite(right)) return -1
  return descending ? right - left : left - right
}

export type QueueOrder = {
  id: string
  closed?: boolean
  urgent?: boolean
  actionable?: boolean
  dueAt?: string | null
  waitingSince?: string | null
  completedAt?: string | null
}

/** Actionability is role-specific. Callers supply persisted step dates, never updatedAt. */
export function compareWorkQueue(a: QueueOrder, b: QueueOrder, now = Date.now()): number {
  if (!!a.closed !== !!b.closed) return a.closed ? 1 : -1
  if (a.closed && b.closed) return compareQueueTime(a.completedAt, b.completedAt, true) || a.id.localeCompare(b.id)
  if ((a.actionable !== false) !== (b.actionable !== false)) return a.actionable === false ? 1 : -1
  if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1
  const overdue = (row: QueueOrder) => queueTime(row.dueAt, true) <= now
  if (overdue(a) !== overdue(b)) return overdue(a) ? -1 : 1
  return compareQueueTime(a.dueAt, b.dueAt, false, true)
    || compareQueueTime(a.waitingSince, b.waitingSince) || a.id.localeCompare(b.id)
}
