export function withinFacilityHours(time: string, accessHours?: string | null): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false
  if (/24\s*\/\s*7|24\s*giờ/i.test(accessHours || '')) return true
  const matches = [...(accessHours || '').matchAll(/([01]?\d|2[0-3]):([0-5]\d)/g)]
  if (matches.length < 2) return true // The existing check-in policy still applies.
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  const start = Number(matches[0][1]) * 60 + Number(matches[0][2])
  const end = Number(matches[1][1]) * 60 + Number(matches[1][2])
  const selected = minutes(time)
  return start <= end ? selected >= start && selected < end : selected >= start || selected < end
}
