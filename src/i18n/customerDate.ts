import { parseVietnamDate, VIETNAM_TIME_ZONE } from '../utils/vietnamTime'

export function formatCustomerDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return 'Chưa có'
  const date = parseVietnamDate(value)
  if (!Number.isFinite(date.getTime())) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: VIETNAM_TIME_ZONE }).format(date)
}

export function formatCustomerDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return 'Chưa có'
  const date = parseVietnamDate(value)
  if (!Number.isFinite(date.getTime())) return 'Chưa có'
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: VIETNAM_TIME_ZONE }).format(date)
  return `${formatCustomerDate(date)} ${time}`
}
