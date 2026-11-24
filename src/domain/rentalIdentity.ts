import { normalizeCccd, validateCccd } from './cccd'

export function normalizeRentalIdentity(raw: string) {
  return /[a-z]/i.test(raw) ? raw.replace(/\s/g, '').toUpperCase() : normalizeCccd(raw)
}

export function validateRentalIdentity(raw: string): ReturnType<typeof validateCccd> {
  const value = normalizeRentalIdentity(raw)
  if (/^\d{9}$/.test(value) || /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6,20}$/.test(value)) return { ok: true }
  return /[a-z]/i.test(value) ? { ok: false, error: 'Nhập số hộ chiếu hợp lệ.' } : validateCccd(value)
}
