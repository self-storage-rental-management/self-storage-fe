import { describe, expect, it } from 'vitest'
import { transitionReservation } from './reservationFlow'

describe('reservation lifecycle', () => {
  it('requires email verification, approval and payment in order', () => {
    expect(transitionReservation('awaiting_email', 'VERIFY_EMAIL')).toBe('awaiting_review')
    expect(transitionReservation('awaiting_review', 'APPROVE')).toBe('awaiting_payment')
    expect(transitionReservation('awaiting_payment', 'PAY_DEPOSIT')).toBe('DEPOSIT_PAID')
    expect(transitionReservation('DEPOSIT_PAID', 'ASSIGN_UNIT')).toBe('UNIT_RESERVED')
    expect(transitionReservation('READY_FOR_CHECKIN', 'COMPLETE_CHECKIN')).toBe('COMPLETED')
  })

  it('rejects payment before approval', () => {
    expect(() => transitionReservation('awaiting_email', 'PAY_DEPOSIT')).toThrow('Invalid reservation transition')
    expect(() => transitionReservation('awaiting_review', 'PAY_DEPOSIT')).toThrow('Invalid reservation transition')
  })

  it('rejects unit assignment before deposit payment', () => {
    expect(() => transitionReservation('awaiting_payment', 'ASSIGN_UNIT')).toThrow('Invalid reservation transition')
  })
})
