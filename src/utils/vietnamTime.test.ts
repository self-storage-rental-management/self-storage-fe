import { describe, expect, it } from 'vitest'
import { parseVietnamDate, vietnamDate, vietnamDateFromParts, vietnamDateInput, vietnamDateTimeInput } from './vietnamTime'
import { rentalDate } from '../views/rental-api/presentation'
import { vietnamLocalInstant } from '../views/rental-api/operationsPresentation'
import { signingLocalInput } from '../views/rental-api/RenewalAppointmentPicker'

describe('Vietnam business time independent of the host timezone', () => {
  it('uses the new Vietnam day, month and year before UTC midnight', () => {
    const instant = '2026-12-31T17:15:00Z'
    expect(vietnamDateInput(instant)).toBe('2027-01-01')
    expect(vietnamDateTimeInput(instant)).toBe('2027-01-01T00:15')
    expect(vietnamDate.getFullYear(new Date(instant))).toBe(2027)
    expect(vietnamDate.getDay(new Date(instant))).toBe(5)
  })

  it('interprets calendar dates and offset-free form values in Vietnam', () => {
    expect(parseVietnamDate('2026-10-09').toISOString()).toBe('2026-10-08T17:00:00.000Z')
    expect(parseVietnamDate('2026-10-09T08:30').toISOString()).toBe('2026-10-09T01:30:00.000Z')
    expect(parseVietnamDate('2026-10-09 08:30:00').toISOString()).toBe('2026-10-09T01:30:00.000Z')
    expect(vietnamDateFromParts(2026, 9, 9, 8, 30).toISOString()).toBe('2026-10-09T01:30:00.000Z')
  })

  it('preserves explicit offsets and copies Date values without mutation', () => {
    const value = new Date('2026-10-09T08:30:00-04:00')
    const copy = parseVietnamDate(value)
    expect(copy).not.toBe(value)
    expect(copy.toISOString()).toBe('2026-10-09T12:30:00.000Z')
    expect(parseVietnamDate('invalid').getTime()).toBeNaN()
    expect(vietnamDateInput('invalid')).toBe('')
    expect(vietnamDateTimeInput('')).toBe('')
  })

  it('reads legacy Vietnamese timestamps without interpreting the month as the day', () => {
    expect(parseVietnamDate('09/10/2026, 08:30:00').toISOString()).toBe('2026-10-09T01:30:00.000Z')
    expect(parseVietnamDate('08:30:00 09/10/2026').toISOString()).toBe('2026-10-09T01:30:00.000Z')
    expect(parseVietnamDate('31/02/2026').getTime()).toBeNaN()
  })

  it('uses Vietnam midnight and handles month rollover when changing calendar components', () => {
    const day = new Date('2026-10-31T18:45:12Z')
    expect(vietnamDate.setHours(day, 0, 0, 0, 0)).toBe(Date.parse('2026-10-31T17:00:00Z'))
    vietnamDate.setDate(day, vietnamDate.getDate(day) + 1)
    expect(day.toISOString()).toBe('2026-11-01T17:00:00.000Z')
    expect(vietnamDateInput(day)).toBe('2026-11-02')
  })

  it('keeps Vietnam dates and renewal appointment inputs consistent', () => {
    const instant = '2026-10-08T17:00:00Z'
    expect(rentalDate('2026-10-09')).toBe('09/10/2026')
    const input = signingLocalInput(instant)
    expect(input).toBe('2026-10-09T00:00')
    expect(vietnamLocalInstant(input)).toBe('2026-10-08T17:00:00.000Z')
  })
})
