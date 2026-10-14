import { describe, expect, it } from 'vitest'
import { calculateRenewalPaymentSplit, RENEWAL_DEPOSIT_RATE, RENEWAL_REMAINING_RATE } from './renewalPricing'

describe('renewal pricing', () => {
  it('treats the full discounted renewal total as payable without a separate deposit', () => {
    expect(RENEWAL_DEPOSIT_RATE).toBe(0)
    expect(RENEWAL_REMAINING_RATE).toBe(1)
    expect(calculateRenewalPaymentSplit(9_500_000)).toEqual({
      depositAmount: 0,
      remainingAmount: 9_500_000,
    })
  })

  it('keeps currency rounding consistent and never returns a negative amount', () => {
    expect(calculateRenewalPaymentSplit(100.01)).toEqual({ depositAmount: 0, remainingAmount: 100.01 })
    expect(calculateRenewalPaymentSplit(-100)).toEqual({ depositAmount: 0, remainingAmount: 0 })
  })
})
