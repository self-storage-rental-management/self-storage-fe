import type { ReturnCase } from '../types/storageHub'
import type { ApiReturn } from './returnApi'

// Manager screens and API commands both use the original VND amounts.
export function returnScreenRecord(record: ApiReturn): ReturnCase {
  const vnd = (value: number | null) => value == null ? Number.NaN : value
  return {
    id: record.id, rentalId: record.rentalId, unitId: record.unitNumber,
    facilityId: record.facilityId, facilityName: record.facilityName,
    customerId: record.customerId, customerName: record.customerName,
    customerEmail: record.customerEmail ?? '', customerPhone: record.customerPhone ?? '',
    requestedAt: record.requestedAt ?? '', scheduledDate: record.scheduledDate, status: record.status,
    initialConditionSnapshot: 'Chưa có thông tin bàn giao trong phản hồi trả kho',
    packageCount: Number.NaN, initialWeightKg: Number.NaN,
    inventoryMatch: record.inventoryMatch ?? undefined, damageClassification: record.damageClassification ?? undefined,
    damageFee: vnd(record.damageFee), cleaningFee: vnd(record.cleaningFee),
    lostItemFee: vnd(record.lostItemFee), overdueFee: vnd(record.overdueFee), outstandingFee: vnd(record.outstandingFee),
    depositAmount: vnd(record.depositAmount), netRefundAmount: vnd(record.netRefundAmount),
    amountDueFromCustomer: vnd(record.amountDueFromCustomer),
    staffNotes: record.inspectionNotes ?? undefined, evidence: record.evidencePhotos ?? [],
    customerConfirmed: record.customerConfirmed, customerDecisionNote: record.customerDecisionNote ?? undefined,
    proposedUnitStatus: record.proposedUnitStatus ?? undefined, inspectedAt: record.inspectedAt ?? undefined,
    completedAt: record.completedAt ?? undefined, settlementPaymentId: record.settlementPaymentId ?? undefined,
    settlementPaidAt: record.settlementPaidAt ?? undefined,
    returnedItems: { key: record.returnedKey === true, card: record.returnedCard === true, lock: record.returnedLock === true },
  }
}
