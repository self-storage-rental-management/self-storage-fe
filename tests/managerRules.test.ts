import { describe, expect, it } from 'vitest'
import {
  addMonthsToDate,
  billingPeriodsDue,
  nextDueAfterPayment,
  rentalAmountDue,
  sanitizeOperationalRentals,
  sanitizeOperationalReturns,
  unitStatusFromAllocations,
  unitHasAllocationConflict
} from '../src/domain/managerRules'
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
