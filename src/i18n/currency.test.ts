import { describe, expect, it } from 'vitest'
import { formatVnd, formatVndAmount } from './currency'
describe('VND throughout the system', () => {
  it.each([0, 25, 1000, 5500000, 9500000, 21505000, 63650000])('formats %s VND without conversion or amount guessing', amount => {
    expect(formatVnd(amount)).toBe(`${Math.round(amount).toLocaleString('vi-VN')} ₫`)
    expect(formatVnd(amount)).toBe(formatVndAmount(amount))
  })
})
