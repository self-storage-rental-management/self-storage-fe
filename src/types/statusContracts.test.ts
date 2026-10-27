import { describe, expect, it } from 'vitest'
import {
  isCheckInStatus,
  isInvoiceRefundStatus,
  isInvoiceStatus,
  isPaymentStatus,
  isPaymentTransactionStatus,
  isRentalStatus,
  isRenewalStatus,
  isRenewalWorkflowStatus,
  isReservationStatus,
  normalizePaymentStatus,
  normalizeRentalStatus,
  normalizeReservationStatus,
} from './statusContracts'

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

  it('exposes runtime guards for API status validation', () => {
    expect(isPaymentStatus('PAID')).toBe(true)
    expect(isPaymentStatus('unknown')).toBe(false)
    expect(isReservationStatus('CONFIRMED')).toBe(true)
    expect(isRentalStatus('active')).toBe(true)
    expect(isCheckInStatus('setup_completed')).toBe(true)
    expect(isCheckInStatus('unknown')).toBe(false)
    expect(isInvoiceStatus('PAID')).toBe(true)
    expect(isInvoiceRefundStatus('REFUNDED')).toBe(true)
    expect(isPaymentTransactionStatus('RECONCILIATION_REQUIRED')).toBe(true)
    expect(isRenewalWorkflowStatus('AWAITING_PAYMENT')).toBe(true)
    expect(isRenewalStatus('completed')).toBe(true)
  })
})
