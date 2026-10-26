import type { CustomerReservation, ReservationQuote } from './customerReservationApi'

export const MISSING_RESERVATION_SNAPSHOT = 'Thiếu dữ liệu lịch sử, cần đối soát. Không dùng giá hoặc chính sách hiện tại để thay thế thông tin của đơn đã đặt.'

/** Project stored fields only. Never reconstruct a historical quote from dates or live catalog prices. */
export function savedReservationQuote(r: CustomerReservation): ReservationQuote | null {
  const amounts = [r.monthlyPrice, r.grossRentalAmount, r.discountRate, r.discountAmount, r.voucherDiscountAmount,
    r.totalRentalAmount, r.reservationDepositAmount, r.securityDepositAmount, r.remainingRentalAmount, r.dueAtCheckIn, r.totalInitialObligation]
  if (r.pricingSnapshotStatus !== 'COMPLETE' || !r.pricingPolicyVersion?.trim() || !r.quoteId
    || !Number.isInteger(r.rentalMonths) || r.rentalMonths! < 1 || !Number.isInteger(r.freeSetupDays) || r.freeSetupDays! < 0
    || !amounts.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) || r.discountRate! > 1
    || !r.pricingQuotedAt || !Number.isFinite(Date.parse(r.pricingQuotedAt))
    || !r.pricingExpiresAt || !Number.isFinite(Date.parse(r.pricingExpiresAt))) return null
  return {
    quoteId: r.quoteId, facilityId: r.facilityId, unitTypeId: r.unitTypeId,
    unitTypeName: r.unitTypeName, startDate: r.startDate, endDate: r.endDate,
    rentalMonths: r.rentalMonths!, freeSetupDays: r.freeSetupDays!, monthlyPrice: r.monthlyPrice!,
    subtotal: r.grossRentalAmount!, discountRate: r.discountRate!, discountAmount: r.discountAmount!,
    totalAfterDiscount: r.totalRentalAmount!, reservationDepositAmount: r.reservationDepositAmount!,
    securityDepositAmount: r.securityDepositAmount!, remainingRentalAmount: r.remainingRentalAmount!,
    dueAtCheckIn: r.dueAtCheckIn!, totalInitialObligation: r.totalInitialObligation!,
    policyVersion: r.pricingPolicyVersion, voucherCode: r.voucherCode, voucherDiscountAmount: r.voucherDiscountAmount,
    quotedAt: r.pricingQuotedAt, expiresAt: r.pricingExpiresAt,
    setupEarlyExitPolicyVersion: r.setupEarlyExitPolicyVersion, setupEarlyExitFee: r.setupEarlyExitFee,
  }
}
