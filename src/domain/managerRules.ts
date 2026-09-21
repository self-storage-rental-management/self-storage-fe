import type { RentalRecord, ReturnCase, StorageReservation, StorageUnit } from '../types/storageHub'

export const ACTIVE_RESERVATION_STATUSES = ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'] as const

export function isActiveReservationStatus(status: string) {
  return ACTIVE_RESERVATION_STATUSES.includes(status as (typeof ACTIVE_RESERVATION_STATUSES)[number])
}

export function addMonthsToDate(value: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid date: ${value}`)
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const targetFirstDay = new Date(Date.UTC(year, month + months, 1))
  const targetYear = targetFirstDay.getUTCFullYear()
  const targetMonth = targetFirstDay.getUTCMonth()
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function billingPeriodsDue(nextDue: string, asOf = new Date().toISOString().slice(0, 10)): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDue) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return 1
  if (nextDue > asOf) return 1
  let periods = 0
  let cursor = nextDue
  while (cursor <= asOf && periods < 120) {
    periods += 1
    cursor = addMonthsToDate(cursor, 1)
  }
  return Math.max(1, periods)
}

export function rentalAmountDue(rental: Pick<RentalRecord, 'monthlyRate' | 'lateFeeAmount' | 'nextDue'>, asOf?: string) {
  return Math.round((rental.monthlyRate * billingPeriodsDue(rental.nextDue, asOf) + (rental.lateFeeAmount || 0)) * 100) / 100
}

export function nextDueAfterPayment(nextDue: string, asOf?: string) {
  return addMonthsToDate(nextDue, billingPeriodsDue(nextDue, asOf))
}

export function unitHasAllocationConflict(
  unitId: string,
  startDate: string,
  endDate: string,
  reservationId: string,
  reservations: StorageReservation[],
  rentals: RentalRecord[]
) {
  const overlaps = (startA: string, endA: string, startB: string, endB: string) => {
    if (!startA || !endA || !startB || !endB) return false
    return new Date(startA).getTime() < new Date(endB).getTime() && new Date(endA).getTime() > new Date(startB).getTime()
  }
  return reservations.some(item => item.id !== reservationId && item.assignedUnitId === unitId && isActiveReservationStatus(item.status) && overlaps(startDate, endDate, item.startDate, item.endDate)) ||
    rentals.some(item => item.unitId === unitId && item.status === 'active' && overlaps(startDate, endDate, item.startDate, item.endDate))
}

export function unitStatusFromAllocations(
  unit: StorageUnit,
  reservations: StorageReservation[],
  rentals: RentalRecord[],
  asOf = new Date().toISOString().slice(0, 10)
): Pick<StorageUnit, 'status' | 'currentRentalId' | 'nextAvailableDate'> {
  if (unit.status === 'maintenance') return { status: 'maintenance', currentRentalId: undefined, nextAvailableDate: undefined }
  const activeRental = rentals.find(item => item.unitId === unit.id && item.status === 'active')
  if (activeRental) return { status: 'occupied', currentRentalId: activeRental.id, nextAvailableDate: activeRental.endDate }
  const currentReservation = reservations
    .filter(item => item.assignedUnitId === unit.id && isActiveReservationStatus(item.status) && item.startDate <= asOf && item.endDate >= asOf)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0]
  if (currentReservation) return { status: 'reserved', currentRentalId: undefined, nextAvailableDate: currentReservation.endDate }
  return { status: 'available', currentRentalId: undefined, nextAvailableDate: undefined }
}

export function sanitizeOperationalRentals(rentals: RentalRecord[], units: StorageUnit[]) {
  const validUnits = new Set(units.map(unit => `${unit.facilityId}:${unit.id}`))
  return rentals.filter(rental => !rental.id.startsWith('RNT-TEST-') && validUnits.has(`${rental.facilityId}:${rental.unitId}`))
}

export function sanitizeOperationalReturns(returns: ReturnCase[], rentals: RentalRecord[]) {
  const rentalIds = new Set(rentals.map(rental => rental.id))
  return returns.filter(item => !item.id.startsWith('RET-TEST-') && rentalIds.has(item.rentalId))
}
