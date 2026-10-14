// Renewal has no separate deposit. New requests are paid as one full-period amount.
export const RENEWAL_DEPOSIT_RATE = 0
export const RENEWAL_REMAINING_RATE = 1

const money = (amount: number): number => Math.round(amount * 100) / 100

export function calculateRenewalPaymentSplit(totalAmount: number): {
  depositAmount: number
  remainingAmount: number
} {
  const normalizedTotal = money(Math.max(0, totalAmount))
  const depositAmount = money(normalizedTotal * RENEWAL_DEPOSIT_RATE)
  return {
    depositAmount,
    remainingAmount: money(normalizedTotal - depositAmount),
  }
}
