import type { ReservationStatus } from '../types/storageHub'

export type ReservationEvent =
  | 'VERIFY_EMAIL'
  | 'APPROVE'
  | 'PAY_DEPOSIT'
  | 'ASSIGN_UNIT'
  | 'READY_FOR_CHECKIN'
  | 'COMPLETE_CHECKIN'

const transitions: Partial<Record<ReservationStatus, Partial<Record<ReservationEvent, ReservationStatus>>>> = {
  awaiting_email: { VERIFY_EMAIL: 'awaiting_review' },
  awaiting_review: { APPROVE: 'awaiting_payment' },
  awaiting_payment: { PAY_DEPOSIT: 'DEPOSIT_PAID' },
  DEPOSIT_PAID: { ASSIGN_UNIT: 'UNIT_RESERVED' },
  UNIT_RESERVED: { READY_FOR_CHECKIN: 'READY_FOR_CHECKIN' },
  READY_FOR_CHECKIN: { COMPLETE_CHECKIN: 'COMPLETED' },
}

export function transitionReservation(status: ReservationStatus, event: ReservationEvent): ReservationStatus {
  const next = transitions[status]?.[event]
  if (!next) throw new Error(`Invalid reservation transition: ${status} -> ${event}`)
  return next
}
