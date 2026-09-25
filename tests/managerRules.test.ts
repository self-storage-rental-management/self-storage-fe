import { describe, expect, it } from 'vitest'
import {
  addMonthsToDate,
  billingPeriodsDue,
  calculateManagerReturnSettlement,
  canManagerAssignStaff,
  canManagerCompleteFacilityTask,
  canManagerEditFacilityTask,
  canApplyManagerLateFee,
  facilityTaskInitialStatus,
  isManagerFacilityVisible,
  isManagerOperationAllowed,
  isManagerRentalOverdue,
  managerUnitHasOperationalLock,
  nextDueAfterPayment,
  rentalAmountDue,
  parseManagerActivityTimestamp,
  sanitizeOperationalRentals,
  sanitizeOperationalReturns,
  unitStatusFromAllocations,
  unitHasAllocationConflict
} from '../src/domain/managerRules'
import { normalizeRolePermissions } from '../src/auth/rbac'
import type { RentalRecord, ReturnCase, StorageReservation, StorageUnit } from '../src/types/storageHub'

const rental = (overrides: Partial<RentalRecord> = {}): RentalRecord => ({
  id: 'R-1', holdId: 'H-1', unitId: 'U-1', facilityId: 'F-1', facilityName: 'Facility', customerId: 'C-1', customerName: 'Customer', customerEmail: 'c@example.com', customerPhone: '0', unitType: 'Small', areaM2: 2, startDate: '2026-01-01', endDate: '2027-01-01', nextDue: '2026-06-15', monthlyRate: 100, deposit: 100, securityDeposit: 100, status: 'active', paymentStatus: 'overdue', autoRenew: false, gateCode: '1234#', initialCondition: '', evidencePhotos: [], ...overrides
})

const reservation = (overrides: Partial<StorageReservation> = {}): StorageReservation => ({
  id: 'H-1', customerId: 'C-1', customerName: 'Customer', customerEmail: 'c@example.com', customerPhone: '0', identityId: 'ID', facilityId: 'F-1', facilityName: 'Facility', unitId: 'small', unitTypeId: 'small', unitTypeName: 'Small Storage', rentalMonths: 1, startDate: '2026-10-01', endDate: '2026-11-01', moveInDate: '2026-10-01', status: 'UNIT_RESERVED', reservationDepositAmount: 20, securityDepositAmount: 100, remainingAmount: 180, goods: { category: 'boxes', packageCount: 1, lengthCm: 10, widthCm: 10, heightCm: 10, weightKg: 1, dimWeightKg: 1, material: 'paper', condition: 'good', fragile: false }, quote: { quoteId: 'Q', unitId: 'small', facilityId: 'F-1', baseMonthlyPrice: 100, depositAmount: 20, dimSurcharge: 0, totalFirstPayment: 20, dimWeightKg: 1, actualWeightKg: 1, billableWeightKg: 1, dimDivisor: 5000, quotedAt: '', expiresAt: '' }, payment: { amount: 20, status: 'paid' }, expiresAt: '', evidence: [], createdAt: '', ...overrides
})

describe('Facility Manager business rules', () => {
  it('clamps calendar month additions at month end', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('collects every overdue billing period', () => {
    expect(billingPeriodsDue('2026-06-15', '2026-09-21')).toBe(4)
    expect(rentalAmountDue(rental(), '2026-09-21')).toBe(400)
    expect(nextDueAfterPayment('2026-06-15', '2026-09-21')).toBe('2026-10-15')
  })

  it('denies facility access when a manager has no facility scope', () => {
    expect(isManagerFacilityVisible({ role: 'manager' }, 'F-1', 'Facility')).toBe(false)
    expect(isManagerFacilityVisible({ role: 'manager', facility: 'All facilities' }, 'F-1', 'Facility')).toBe(false)
    expect(isManagerFacilityVisible({ role: 'manager', facilityId: 'F-1' }, 'F-1', 'Facility')).toBe(true)
    expect(isManagerFacilityVisible({ role: 'manager', facilityId: 'F-1' }, 'F-2', 'Other')).toBe(false)
  })

  it('allows physical unit assignment while keeping Staff and Business operations outside Manager', () => {
    expect(isManagerOperationAllowed('monitor_handover')).toBe(true)
    expect(isManagerOperationAllowed('manage_returns')).toBe(true)
    expect(isManagerOperationAllowed('assign_unit')).toBe(true)
    expect(isManagerOperationAllowed('approve_reservation')).toBe(false)
    expect(isManagerOperationAllowed('perform_handover')).toBe(false)
    expect(isManagerOperationAllowed('handle_support')).toBe(false)
    expect(isManagerOperationAllowed('manage_policies')).toBe(false)
  })

  it('applies a late fee at most once for the current due date', () => {
    expect(canApplyManagerLateFee(rental(), '2026-09-21')).toBe(true)
    expect(canApplyManagerLateFee(rental({ lateFeeProcessedForDueDate: '2026-06-15' }), '2026-09-21')).toBe(false)
    expect(canApplyManagerLateFee(rental({ lateFeeAmount: 25 }), '2026-09-21')).toBe(false)
    expect(canApplyManagerLateFee(rental({ paymentStatus: 'paid' }), '2026-09-21')).toBe(true)
  })

  it('derives overdue state from the next due date instead of a stale payment flag', () => {
    expect(isManagerRentalOverdue(rental({ paymentStatus: 'paid' }), '2026-09-21')).toBe(true)
    expect(isManagerRentalOverdue(rental({ paymentStatus: 'paid', nextDue: '2026-10-15' }), '2026-09-21')).toBe(false)
    expect(isManagerRentalOverdue(rental({ status: 'completed' }), '2026-09-21')).toBe(false)
  })

  it('parses ISO and legacy vi-VN activity timestamps consistently', () => {
    expect(Number.isNaN(parseManagerActivityTimestamp('2026-09-25T09:30:00.000Z'))).toBe(false)
    expect(Number.isNaN(parseManagerActivityTimestamp('25/09/2026, 09:30:00'))).toBe(false)
    expect(Number.isNaN(parseManagerActivityTimestamp('31/02/2026, 09:30:00'))).toBe(true)
  })

  it('removes Staff and Business actions from persisted Manager permissions', () => {
    const permissions = normalizeRolePermissions({ manager: {
      approve_reservations: true,
      assign_units: false,
      perform_checkin: true,
      manage_support: true,
      manage_policies: true
    } })
    expect(permissions.manager.approve_reservations).toBe(false)
    expect(permissions.manager.assign_units).toBe(false)
    expect(normalizeRolePermissions(undefined).manager.assign_units).toBe(true)
    expect(permissions.manager.perform_checkin).toBe(false)
    expect(permissions.manager.manage_support).toBe(false)
    expect(permissions.manager.manage_policies).toBe(false)
  })

  it('keeps a unit locked throughout the return workflow', () => {
    const unitRentals = [
      rental({ status: 'return_requested' }),
      rental({ id: 'R-2', status: 'return_inspection' }),
      rental({ id: 'R-3', status: 'closing' })
    ]
    expect(managerUnitHasOperationalLock('U-1', [], unitRentals)).toBe(true)
    expect(managerUnitHasOperationalLock('U-1', [reservation({ assignedUnitId: 'U-1' })], [])).toBe(true)
    expect(managerUnitHasOperationalLock('U-2', [], unitRentals)).toBe(false)
  })

  it('starts an assigned facility task in progress', () => {
    expect(facilityTaskInitialStatus()).toBe('open')
    expect(facilityTaskInitialStatus('staff-1')).toBe('in_progress')
  })

  it('only assigns and completes facility tasks within the manager facility', () => {
    const manager = { role: 'manager' as const, facilityId: 'F-1' }
    expect(canManagerAssignStaff(manager, { role: 'staff', facilityId: 'F-1' })).toBe(true)
    expect(canManagerAssignStaff(manager, { role: 'staff', facilityId: 'F-2' })).toBe(false)
    expect(canManagerAssignStaff(manager, { role: 'customer', facilityId: 'F-1' })).toBe(false)
    expect(canManagerCompleteFacilityTask({ assignedStaffId: 'staff-1', status: 'in_progress' })).toBe(true)
    expect(canManagerCompleteFacilityTask({ status: 'open' })).toBe(false)
    expect(canManagerEditFacilityTask({ status: 'completed' })).toBe(false)
    expect(canManagerEditFacilityTask({ status: 'in_progress' })).toBe(true)
  })

  it('recalculates a disputed return settlement without negative values', () => {
    expect(calculateManagerReturnSettlement(1_000, {
      damageFee: 200,
      cleaningFee: 100,
      lostItemFee: 0,
      overdueFee: 50,
      outstandingFee: 150
    })).toEqual({ totalDeductions: 500, netRefundAmount: 500, amountDueFromCustomer: 0 })
    expect(calculateManagerReturnSettlement(300, {
      damageFee: 400,
      cleaningFee: 100,
      lostItemFee: 0,
      overdueFee: 0,
      outstandingFee: 0
    })).toEqual({ totalDeductions: 500, netRefundAmount: 0, amountDueFromCustomer: 200 })
  })

  it('allows non-overlapping future reservations on the same unit', () => {
    const existing = reservation({ id: 'H-OLD', assignedUnitId: 'U-1', startDate: '2026-10-01', endDate: '2026-11-01' })
    expect(unitHasAllocationConflict('U-1', '2026-11-02', '2026-12-01', 'H-NEW', [existing], [])).toBe(false)
    expect(unitHasAllocationConflict('U-1', '2026-10-15', '2026-11-15', 'H-NEW', [existing], [])).toBe(true)
  })

  it('removes test and orphan rentals from runtime data', () => {
    const units = [{ id: 'U-1', facilityId: 'F-1' }] as StorageUnit[]
    expect(sanitizeOperationalRentals([rental(), rental({ id: 'RNT-TEST-1' }), rental({ id: 'R-ORPHAN', unitId: 'U-404' })], units).map(item => item.id)).toEqual(['R-1'])
  })

  it('keeps a unit reserved when another current reservation remains', () => {
    const unit = { id: 'U-1', facilityId: 'F-1', status: 'reserved' } as StorageUnit
    const remaining = reservation({ id: 'H-REMAINING', assignedUnitId: 'U-1', startDate: '2026-09-01', endDate: '2026-10-01' })
    expect(unitStatusFromAllocations(unit, [remaining], [], '2026-09-21')).toEqual({ status: 'reserved', currentRentalId: undefined, nextAvailableDate: '2026-10-01' })
  })

  it('removes test and orphan return cases from runtime data', () => {
    const valid = { id: 'RET-1', rentalId: 'R-1' } as ReturnCase
    const test = { id: 'RET-TEST-1', rentalId: 'R-1' } as ReturnCase
    const orphan = { id: 'RET-ORPHAN', rentalId: 'R-404' } as ReturnCase
    expect(sanitizeOperationalReturns([valid, test, orphan], [rental()]).map(item => item.id)).toEqual(['RET-1'])
  })
})
