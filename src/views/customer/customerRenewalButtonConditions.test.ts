import { describe, expect, it } from 'vitest'

describe('Customer Renewal Button 7-day rule & duplicate request guards', () => {
  function parseCustomerDate(value?: string): Date | null {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Logic mirror of CustomerApp.tsx:3073-3078
  function checkRenewalEligibility(
    rental: { id?: string; endDate: string; status: string },
    renewals: Array<{ rentalId: string; status: string }>,
    now: Date
  ) {
    if (rental.status !== 'active') {
      return { canRenew: false, reason: 'Chỉ áp dụng cho hợp đồng active' }
    }
    const end = parseCustomerDate(rental.endDate)
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const remainingDays = end ? Math.round((end.getTime() - today.getTime()) / 86_400_000) : Infinity
    const isWithin7Days = Number.isFinite(remainingDays) && remainingDays === 7
    const hasOpenRenewal = renewals.some(
      item => item.rentalId === rental.id && !['cancelled', 'rejected', 'completed', 'payment_expired'].includes(item.status)
    )
    const canRenew = isWithin7Days && !hasOpenRenewal

    return {
      remainingDays,
      isWithin7Days,
      hasOpenRenewal,
      canRenew,
    }
  }

  const now = new Date('2026-11-23T10:00:00Z')

  it('enables renewal button ONLY when exactly 7 days remaining', () => {
    // 7 days ahead = 2026-11-30
    const res7 = checkRenewalEligibility({ id: 'r1', endDate: '2026-11-30', status: 'active' }, [], now)
    expect(res7.remainingDays).toBe(7)
    expect(res7.isWithin7Days).toBe(true)
    expect(res7.canRenew).toBe(true)
  })

  it('disables renewal button when remaining days are 8, 6, 0, or negative', () => {
    // 8 days ahead = 2026-12-01
    const res8 = checkRenewalEligibility({ id: 'r1', endDate: '2026-12-01', status: 'active' }, [], now)
    expect(res8.remainingDays).toBe(8)
    expect(res8.isWithin7Days).toBe(false)
    expect(res8.canRenew).toBe(false)

    // 6 days ahead = 2026-11-29
    const res6 = checkRenewalEligibility({ id: 'r1', endDate: '2026-11-29', status: 'active' }, [], now)
    expect(res6.remainingDays).toBe(6)
    expect(res6.isWithin7Days).toBe(false)
    expect(res6.canRenew).toBe(false)

    // 0 days ahead (today) = 2026-11-23
    const res0 = checkRenewalEligibility({ id: 'r1', endDate: '2026-11-23', status: 'active' }, [], now)
    expect(res0.remainingDays).toBe(0)
    expect(res0.isWithin7Days).toBe(false)
    expect(res0.canRenew).toBe(false)

    // Overdue / negative days = 2026-11-20
    const resNeg = checkRenewalEligibility({ id: 'r1', endDate: '2026-11-20', status: 'active' }, [], now)
    expect(resNeg.remainingDays).toBeLessThan(0)
    expect(resNeg.isWithin7Days).toBe(false)
    expect(resNeg.canRenew).toBe(false)
  })

  it('disables renewal button when there is an active/open renewal even if remaining days === 7', () => {
    const rental = { id: 'rent-1', endDate: '2026-11-30', status: 'active' }
    const openRenewals = [{ rentalId: 'rent-1', status: 'pending' }]
    const res = checkRenewalEligibility(rental, openRenewals, now)
    expect(res.remainingDays).toBe(7)
    expect(res.isWithin7Days).toBe(true)
    expect(res.hasOpenRenewal).toBe(true)
    expect(res.canRenew).toBe(false)
  })

  it('allows renewal button if previous renewals are in terminal states (cancelled, rejected, completed, payment_expired)', () => {
    const rental = { id: 'rent-1', endDate: '2026-11-30', status: 'active' }
    const terminalRenewals = [
      { rentalId: 'rent-1', status: 'cancelled' },
      { rentalId: 'rent-1', status: 'rejected' },
      { rentalId: 'rent-1', status: 'completed' },
      { rentalId: 'rent-1', status: 'payment_expired' },
    ]
    const res = checkRenewalEligibility(rental, terminalRenewals, now)
    expect(res.remainingDays).toBe(7)
    expect(res.hasOpenRenewal).toBe(false)
    expect(res.canRenew).toBe(true)
  })
})
