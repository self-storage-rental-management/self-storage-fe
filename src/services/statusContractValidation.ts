import { ApiClientError } from './apiClient'
import { isPaymentStatus, isReservationStatus, isRentalStatus } from '../types/statusContracts'

const invalid = (): never => { throw new ApiClientError('Trạng thái phản hồi không đúng contract FE/BE.', { code: 'INVALID_RESPONSE' }) }
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : invalid()

export function checkedReservation<T>(value: T): T {
  if (!isReservationStatus(record(value).status)) invalid()
  return value
}
export function checkedReservationState<T>(value: T): T {
  if (!isReservationStatus(record(value).reservationStatus)) invalid()
  return value
}
export function checkedPayment<T>(value: T): T {
  checkedReservationState(value)
  if (!isPaymentStatus(record(value).paymentStatus)) invalid()
  return value
}
export function checkedRental<T>(value: T): T {
  if (!isRentalStatus(record(value).status)) invalid()
  return value
}
export function checkedStatusPage<T extends { data: unknown[] }>(page: T, check: (value: unknown) => unknown): T {
  if (!Array.isArray(page?.data)) invalid()
  page.data.forEach(check)
  return page
}
export function checkedReservationDetail<T>(value: T): T {
  const detail = record(value)
  checkedReservation(detail.reservation)
  const payments = detail.payments
  if (!Array.isArray(payments)) return invalid()
  payments.forEach(checkedPayment)
  return value
}
