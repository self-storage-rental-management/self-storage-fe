import { describe, expect, it } from 'vitest'
import { calculateRenewalPaymentSplit, RENEWAL_DEPOSIT_RATE, RENEWAL_REMAINING_RATE } from './renewalPricing'

describe('renewal pricing', () => {
  it('splits the discounted renewal total into a 40% deposit and 60% balance', () => {
    expect(RENEWAL_DEPOSIT_RATE).toBe(0.4)
    expect(RENEWAL_REMAINING_RATE).toBe(0.6)
    expect(calculateRenewalPaymentSplit(9_500_000)).toEqual({
      depositAmount: 3_800_000,
      remainingAmount: 5_700_000,
    })
  })

  it('keeps currency rounding consistent and never returns a negative amount', () => {
    expect(calculateRenewalPaymentSplit(100.01)).toEqual({ depositAmount: 40, remainingAmount: 60.01 })
    expect(calculateRenewalPaymentSplit(-100)).toEqual({ depositAmount: 0, remainingAmount: 0 })
  })
})
