import { describe, expect, it } from 'vitest'
import { getRentalRenewalEligibility } from '../rental-api/RentalDeadlineNotice'

describe('early customer renewal', () => {
  const rental = { id: 'r1', status: 'active', contractEndDate: '2027-08-20' }
  const today = new Date('2026-11-24T10:00:00+07:00')

  it('allows another request months ahead after the previous renewal completed', () => {
    const previous = [{ rentalId: rental.id, status: 'completed' }]
    expect(getRentalRenewalEligibility(rental, previous, today).canRenew).toBe(true)
  })

  it('blocks another request while an early renewal is pending', () => {
    const pending = [{ rentalId: rental.id, status: 'pending' }]
    expect(getRentalRenewalEligibility(rental, pending, today).canRenew).toBe(false)
  })
})
