import { describe, expect, it } from 'vitest'
import { formatVnd, formatVndAmount, vndToLegacyBase } from './currency'

describe('VND backend versus legacy demo currency', () => {
  it('does not multiply backend prices or deposits by 26000', () => {
    expect(formatVndAmount(6402000)).toBe('6.402.000 ₫')
    expect(formatVndAmount(5500000)).toBe('5.500.000 ₫')
    expect(formatVndAmount(21505000)).toBe('21.505.000 ₫')
  })
  it('round trips VND through legacy display adapters without changing its amount', () => {
    for (const amount of [0, 6402000, 5500000, 21505000]) {
      expect(formatVnd(vndToLegacyBase(amount))).toBe(formatVndAmount(amount))
    }
  })
})
