import type { FacilityTask, RentalRecord, ReturnCase, StorageReservation, StorageUnit } from '../types/storageHub'
import type { User } from '../types'

/** Facility scope is keyed by ID; names remain a legacy fallback for old records. */
export function isFacilityVisible(user: Pick<User, 'facility' | 'facilityId'>, facilityId?: string, facilityName?: string) {
  if (user.facility === 'All facilities') return true
  if (!user.facility && !user.facilityId) return false
  // Stable facilityId wins whenever both sides have one. Names remain a
  // compatibility fallback for legacy records that do not have an ID yet.
  if (user.facilityId && facilityId) return facilityId === user.facilityId
  if (user.facility && facilityId && facilityId === user.facility) return true
  return Boolean(user.facility && facilityName && facilityName === user.facility)
}

/** Managers must always be provisioned with one explicit facility scope. */
export function isManagerFacilityVisible(
  user: Pick<User, 'role' | 'facility' | 'facilityId'>,
  facilityId?: string,
  facilityName?: string
) {
  if (user.role !== 'manager' || (!user.facility && !user.facilityId) || user.facility === 'All facilities') return false
  return Boolean(
    (user.facilityId && facilityId === user.facilityId) ||
    (user.facility && (facilityId === user.facility || facilityName === user.facility))
  )
}

export type ManagerOperation =
  | 'monitor_handover'
  | 'manage_returns'
  | 'manage_inventory'
  | 'manage_rentals'
  | 'manage_payments'
  | 'manage_staff_tasks'
  | 'view_reports'
  | 'assign_unit'
  | 'approve_reservation'
  | 'perform_handover'
  | 'handle_support'
  | 'manage_policies'

const MANAGER_OPERATIONS = new Set<ManagerOperation>([
  'monitor_handover',
  'manage_returns',
  'manage_inventory',
  'manage_rentals',
  'manage_payments',
  'manage_staff_tasks',
  'view_reports',
  'assign_unit'
])

export function isManagerOperationAllowed(operation: ManagerOperation) {
  return MANAGER_OPERATIONS.has(operation)
}

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

export function canApplyManagerLateFee(
  rental: Pick<RentalRecord, 'status' | 'paymentStatus' | 'nextDue' | 'lateFeeProcessedForDueDate' | 'lateFeeAmount'>,
  asOf = new Date().toISOString().slice(0, 10)
) {
  return isManagerRentalOverdue(rental, asOf) &&
    rental.lateFeeProcessedForDueDate !== rental.nextDue &&
    (rental.lateFeeAmount || 0) === 0
}

/** The last payment flag can be stale; the current due date is authoritative. */
export function isManagerRentalOverdue(
  rental: Pick<RentalRecord, 'status' | 'paymentStatus' | 'nextDue'>,
  asOf = new Date().toISOString().slice(0, 10)
) {
  if (rental.status !== 'active') return false
  if (rental.paymentStatus === 'overdue') return true
  return /^\d{4}-\d{2}-\d{2}$/.test(rental.nextDue) && rental.nextDue < asOf
}

/** Supports current ISO audit timestamps and legacy vi-VN timestamps. */
export function parseManagerActivityTimestamp(value: string): number {
  const isoTimestamp = Date.parse(value)
  if (!Number.isNaN(isoTimestamp)) return isoTimestamp
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) return Number.NaN
  const [, day, month, year, hour = '0', minute = '0', second = '0'] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return Number.NaN
  return parsed.getTime()
}

const MANAGER_BLOCKING_RENTAL_STATUSES: RentalRecord['status'][] = [
  'active',
  'return_requested',
  'return_inspection',
  'closing'
]

export function managerUnitHasOperationalLock(
  unitId: string,
  reservations: StorageReservation[],
  rentals: RentalRecord[]
) {
  return reservations.some(
    reservation => reservation.assignedUnitId === unitId && isActiveReservationStatus(reservation.status)
  ) || rentals.some(
    rental => rental.unitId === unitId && MANAGER_BLOCKING_RENTAL_STATUSES.includes(rental.status)
  )
}

export function facilityTaskInitialStatus(assignedStaffId?: string): FacilityTask['status'] {
  void assignedStaffId
  return 'open'
}

export function canManagerAssignStaff(
  manager: Pick<User, 'role' | 'facility' | 'facilityId'>,
  staff: { role: string; facility?: string; facilityId?: string }
) {
  if (manager.role !== 'manager' || staff.role !== 'staff') return false
  if (manager.facilityId) return Boolean(staff.facilityId) && staff.facilityId === manager.facilityId
  return Boolean(manager.facility && manager.facility !== 'All facilities' && staff.facility === manager.facility)
}

export interface ManagerTaskReferenceRecord {
  id: string
  type: FacilityTask['type']
  facilityId?: string
  facilityName?: string
}

export function canManagerLinkTaskReference(
  manager: Pick<User, 'role' | 'facility' | 'facilityId'>,
  taskType: FacilityTask['type'],
  referenceId: string,
  references: ManagerTaskReferenceRecord[]
) {
  if (manager.role !== 'manager' || !referenceId) return false
  const reference = references.find(item => item.id === referenceId)
  if (!reference || (taskType !== 'general' && reference.type !== taskType)) return false
  if (manager.facilityId) return Boolean(reference.facilityId) && reference.facilityId === manager.facilityId
  return Boolean(manager.facility && manager.facility !== 'All facilities' && reference.facilityName === manager.facility)
}

export function canStaffTransitionFacilityTask(
  task: Pick<FacilityTask, 'assignedStaffId' | 'status'>,
  staffId: string,
  nextStatus: Extract<FacilityTask['status'], 'in_progress' | 'completed'>
) {
  if (!task.assignedStaffId || task.assignedStaffId !== staffId) return false
  return (task.status === 'open' && nextStatus === 'in_progress') ||
    (task.status === 'in_progress' && nextStatus === 'completed')
}

export function canManagerCancelFacilityTask(task: Pick<FacilityTask, 'status'>) {
  return task.status === 'open' || task.status === 'in_progress'
}

export function canManagerReassignFacilityTask(task: Pick<FacilityTask, 'status'>) {
  return task.status === 'open' || task.status === 'in_progress'
}

export function canManagerEditFacilityTask(task: Pick<FacilityTask, 'status'>) {
  return task.status !== 'completed' && task.status !== 'cancelled'
}

export function isFacilityTaskOverdue(
  task: Pick<FacilityTask, 'dueAt' | 'status'>,
  asOf = new Date().toISOString().slice(0, 10)
) {
  return task.status !== 'completed' && task.status !== 'cancelled' &&
    /^\d{4}-\d{2}-\d{2}$/.test(task.dueAt) && task.dueAt < asOf
}

export interface ManagerReturnSettlementFees {
  damageFee: number
  cleaningFee: number
  lostItemFee: number
  overdueFee: number
  outstandingFee: number
}

export function calculateManagerReturnSettlement(depositAmount: number, fees: ManagerReturnSettlementFees) {
  const safeDeposit = Number.isFinite(depositAmount) ? Math.max(0, depositAmount) : 0
  const totalDeductions = Math.round(
    Object.values(fees).reduce((sum, value) => sum + (Number.isFinite(value) ? Math.max(0, value) : 0), 0) * 100
  ) / 100
  return {
    totalDeductions,
    netRefundAmount: Math.max(0, Math.round((safeDeposit - totalDeductions) * 100) / 100),
    amountDueFromCustomer: Math.max(0, Math.round((totalDeductions - safeDeposit) * 100) / 100)
  }
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
