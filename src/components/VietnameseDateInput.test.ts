import { describe, expect, it } from 'vitest'
import { parseVietnameseDate, vietnameseDate } from './VietnameseDateInput'
describe('Vietnamese dates', () => {
  it('formats and parses without swapping day and month', () => {
    expect(vietnameseDate('2026-10-16')).toBe('16/10/2026')
    expect(parseVietnameseDate('16/10/2026')).toBe('2026-10-16')
    expect(parseVietnameseDate('03/04/2026')).toBe('2026-04-03')
  })
  it('rejects impossible dates', () => {
    expect(parseVietnameseDate('31/02/2026')).toBe('')
    expect(parseVietnameseDate('29/02/2024')).toBe('2024-02-29')
  })
})
