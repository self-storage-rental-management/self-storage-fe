import { describe, expect, it } from 'vitest'
import { withinFacilityHours } from './facilityAppointmentHours'
describe('facility appointment hours', () => {
  it('checks opening and closing boundaries', () => {
    expect(withinFacilityHours('08:30', '09:00 - 16:00 hàng ngày')).toBe(false)
    expect(withinFacilityHours('09:00', '09:00 - 16:00 hàng ngày')).toBe(true)
    expect(withinFacilityHours('16:00', '09:00 - 16:00 hàng ngày')).toBe(false)
  })
  it('rejects malformed times and handles overnight hours', () => {
    expect(withinFacilityHours('25:00', '24/7')).toBe(false)
    expect(withinFacilityHours('23:00', '22:00 - 06:00')).toBe(true)
    expect(withinFacilityHours('12:00', '22:00 - 06:00')).toBe(false)
  })
})
