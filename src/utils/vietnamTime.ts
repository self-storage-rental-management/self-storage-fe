/** Business calendar and wall-clock values always use Vietnam, regardless of the host timezone. */
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const OFFSET_MS = 7 * 60 * 60 * 1000

// Vietnam uses UTC+7 without daylight saving for the dates supported by this application.
function wallTime(value: Date) {
  return new Date(value.getTime() + OFFSET_MS)
}

/** ISO timestamps keep their offset; date-only and offset-free ISO input mean Vietnam local time. */
export function parseVietnamDate(value: string | number | Date): Date {
  if (typeof value !== 'string') return new Date(value)
  const text = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00+07:00`)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) {
    return new Date(`${text.replace(' ', 'T')}+07:00`)
  }
  const legacy = /^(?:(\d{1,2}):(\d{2})(?::(\d{2}))?[, ]+)?(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text)
  if (legacy) {
    const [, prefixHour, prefixMinute, prefixSecond, day, month, year, suffixHour, suffixMinute, suffixSecond] = legacy
    const hour = Number(prefixHour ?? suffixHour ?? 0)
    const minute = Number(prefixMinute ?? suffixMinute ?? 0)
    const second = Number(prefixSecond ?? suffixSecond ?? 0)
    const result = vietnamDateFromParts(Number(year), Number(month) - 1, Number(day), hour, minute, second)
    const local = wallTime(result)
    return local.getUTCFullYear() === Number(year) && local.getUTCMonth() === Number(month) - 1
      && local.getUTCDate() === Number(day) && hour < 24 && minute < 60 && second < 60
      ? result : new Date(NaN)
  }
  return new Date(text)
}

/** Equivalent to the component Date constructor, with components in Vietnam local time. */
export function vietnamDateFromParts(year: number, month: number, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond) - OFFSET_MS)
}

export function vietnamDateInput(value: string | number | Date = Date.now()) {
  const local = wallTime(parseVietnamDate(value))
  return Number.isFinite(local.getTime()) ? local.toISOString().slice(0, 10) : ''
}

export function vietnamDateTimeInput(value: string | number | Date = Date.now()) {
  const local = wallTime(parseVietnamDate(value))
  return Number.isFinite(local.getTime()) ? local.toISOString().slice(0, 16) : ''
}

function update(value: Date, method: 'setUTCDate' | 'setUTCMonth' | 'setUTCFullYear' | 'setUTCHours' | 'setUTCMinutes' | 'setUTCSeconds' | 'setUTCMilliseconds', args: number[]) {
  const local = wallTime(value)
  const timestamp = (local[method] as (...values: number[]) => number).apply(local, args)
  return value.setTime(timestamp - OFFSET_MS)
}

/** Date-compatible calendar accessors. Setters mutate the supplied instant and return epoch milliseconds. */
export const vietnamDate = {
  getFullYear: (value: Date) => wallTime(value).getUTCFullYear(),
  getMonth: (value: Date) => wallTime(value).getUTCMonth(),
  getDate: (value: Date) => wallTime(value).getUTCDate(),
  getDay: (value: Date) => wallTime(value).getUTCDay(),
  getHours: (value: Date) => wallTime(value).getUTCHours(),
  getMinutes: (value: Date) => wallTime(value).getUTCMinutes(),
  getSeconds: (value: Date) => wallTime(value).getUTCSeconds(),
  getMilliseconds: (value: Date) => wallTime(value).getUTCMilliseconds(),
  setFullYear: (value: Date, ...args: Parameters<Date['setFullYear']>) => update(value, 'setUTCFullYear', args as number[]),
  setMonth: (value: Date, ...args: Parameters<Date['setMonth']>) => update(value, 'setUTCMonth', args as number[]),
  setDate: (value: Date, ...args: Parameters<Date['setDate']>) => update(value, 'setUTCDate', args),
  setHours: (value: Date, ...args: Parameters<Date['setHours']>) => update(value, 'setUTCHours', args as number[]),
  setMinutes: (value: Date, ...args: Parameters<Date['setMinutes']>) => update(value, 'setUTCMinutes', args as number[]),
  setSeconds: (value: Date, ...args: Parameters<Date['setSeconds']>) => update(value, 'setUTCSeconds', args as number[]),
  setMilliseconds: (value: Date, ...args: Parameters<Date['setMilliseconds']>) => update(value, 'setUTCMilliseconds', args),
}
