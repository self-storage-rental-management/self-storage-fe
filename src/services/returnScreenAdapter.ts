import type { ReturnCase } from '../types/storageHub'
import { USD_TO_VND_RATE } from '../i18n/currency'
import type { ApiReturn } from './returnApi'

// Existing Manager templates use legacy base units. Convert for display only;
// API commands always use the original VND amounts, never inferred totals.
export function returnScreenRecord(record: ApiReturn): ReturnCase {
  const base = (value: number | null) => value == null ? Number.NaN : value / USD_TO_VND_RATE
  return {
    id: record.id, rentalId: record.rentalId, unitId: record.unitNumber,
    facilityId: record.facilityId, facilityName: record.facilityName,
    customerId: record.customerId, customerName: record.customerName,
    customerEmail: record.customerEmail ?? '', customerPhone: record.customerPhone ?? '',
    requestedAt: record.requestedAt ?? '', scheduledDate: record.scheduledDate, status: record.status,
    initialConditionSnapshot: 'Chưa có thông tin bàn giao trong phản hồi trả kho',
    packageCount: Number.NaN, initialWeightKg: Number.NaN,
    inventoryMatch: record.inventoryMatch ?? undefined, damageClassification: record.damageClassification ?? undefined,
    damageFee: base(record.damageFee), cleaningFee: base(record.cleaningFee),
    lostItemFee: base(record.lostItemFee), overdueFee: base(record.overdueFee), outstandingFee: base(record.outstandingFee),
    depositAmount: base(record.depositAmount), netRefundAmount: base(record.netRefundAmount),
    amountDueFromCustomer: base(record.amountDueFromCustomer),
    staffNotes: record.inspectionNotes ?? undefined, evidence: record.evidencePhotos ?? [],
    customerConfirmed: record.customerConfirmed, customerDecisionNote: record.customerDecisionNote ?? undefined,
    proposedUnitStatus: record.proposedUnitStatus ?? undefined, inspectedAt: record.inspectedAt ?? undefined,
    completedAt: record.completedAt ?? undefined, settlementPaymentId: record.settlementPaymentId ?? undefined,
    settlementPaidAt: record.settlementPaidAt ?? undefined,
    returnedItems: { key: record.returnedKey === true, card: record.returnedCard === true, lock: record.returnedLock === true },
  }
}
