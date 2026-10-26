import { describe, expect, it } from 'vitest'
import { normalizePaymentStatus, normalizeRentalStatus, normalizeReservationStatus } from './statusContracts'

describe('status contracts', () => {
  it('normalizes legacy reservation and payment aliases to API values', () => {
    expect(normalizeReservationStatus('awaiting_review')).toBe('AWAITING_REVIEW')
    expect(normalizeReservationStatus('DEPOSIT_PAID')).toBe('CONFIRMED')
    expect(normalizePaymentStatus('paid')).toBe('PAID')
    expect(normalizePaymentStatus('overdue')).toBe('NOT_RECEIVED')
  })

  it('keeps rental lifecycle values aligned with the backend contract', () => {
    expect(normalizeRentalStatus('setup')).toBe('setup')
    expect(normalizeRentalStatus('unknown')).toBeNull()
  })
})
