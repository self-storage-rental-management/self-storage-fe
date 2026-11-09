import { describe, expect, it } from 'vitest'
import { checkedReservationDetail, checkedStatusPage, checkedReservation } from '../services/statusContractValidation'
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
  it.each([
    'AWAITING_EMAIL', 'AWAITING_REVIEW', 'AWAITING_PAYMENT',
    'PAYMENT_GRACE', 'PAYMENT_REVIEW', 'CONFIRMED', 'UNIT_RESERVED',
    'READY_FOR_CHECKIN', 'AWAITING_CUSTOMER_RECEIPT', 'COMPLETED',
    'CANCELLED', 'EXPIRED', 'REJECTED',
  ])('accepts backend reservation status %s', (status) => {
    expect(normalizeReservationStatus(status)).toBe(status)
    expect(isReservationStatus(status)).toBe(true)
  })

  it('loads the reservation page and payment details while awaiting customer receipt', () => {
    const reservation = { id: 'reservation-1', status: 'AWAITING_CUSTOMER_RECEIPT' }
    const page = { data: [reservation] }
    const detail = {
      reservation,
      payments: [{ reservationStatus: reservation.status, paymentStatus: 'PAID' }],
    }
    expect(checkedStatusPage(page, checkedReservation)).toBe(page)
    expect(checkedReservationDetail(detail)).toBe(detail)
  })

  it.each(['unknown', '', null, undefined, 123])('rejects invalid reservation status %s', (status) => {
    expect(normalizeReservationStatus(status)).toBeNull()
    expect(isReservationStatus(status)).toBe(false)
    expect(() => checkedReservation({ status })).toThrow('Trạng thái phản hồi không đúng contract FE/BE.')
  })

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
