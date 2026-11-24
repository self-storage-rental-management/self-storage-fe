/**
 * Turns internal UUIDs into the single human-facing record reference used by
 * the product. Existing business references, especially CSV exports, remain
 * unchanged so they can still be reconciled with external files.
 */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function recordDisplayCode(value: string | null | undefined, fallback = 'Chưa cấp mã') {
  if (!value) return fallback
  if (value.startsWith('CSV-')) return value
  if (!uuidPattern.test(value)) return value
  return `HS-${value.slice(0, 8).toUpperCase()}`
}
