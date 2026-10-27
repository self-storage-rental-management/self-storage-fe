import type { RentalBookingEvidence } from "../types/rentalApi"
import { isPaymentStatus } from '../types/statusContracts'

export const bookingPaymentPurposes: Record<RentalBookingEvidence["payments"][number]["purpose"], string> = {
  RESERVATION_DEPOSIT: "Tiền đặt chỗ", RENTAL_BALANCE: "Tiền thuê còn lại",
  MONTHLY_RENT: "Tiền thuê tháng", RENEWAL: "Tiền gia hạn", DAMAGE_FEE: "Phí hư hỏng", OTHER: "Khoản thanh toán khác",
}
export const bookingPaymentStatuses: Record<RentalBookingEvidence["payments"][number]["status"], string> = {
  PENDING: "Chờ xử lý", PROCESSING: "Đang xử lý", PAID: "Ghi nhận thành công",
  NOT_RECEIVED: "Chưa nhận tiền", FAILED: "Không thành công", CANCELLED: "Đã hủy",
}
export const bookingPaymentVerification: Record<RentalBookingEvidence["payments"][number]["verification"], string> = {
  SIMULATED: "Thanh toán thử nghiệm - không thu tiền thật",
  SANDBOX: "Giao dịch cổng thanh toán thử nghiệm - không xác nhận thu tiền thật",
  VERIFIED: "Giao dịch đã được cổng thanh toán xác thực, chưa xác nhận đầy đủ tài chính hồ sơ thuê",
  DISPUTED: "Giao dịch đang có khiếu nại chưa được giải quyết",
  ATTEMPT: "Đang chờ kết quả xác thực từ cổng thanh toán",
  UNVERIFIED: "Chưa có bằng chứng xác minh tiền thực nhận",
}
export function isRentalBookingEvidence(value: unknown, rentalId: string, reservationId: string | null): boolean {
  // Payment evidence is accepted only when its invoice metadata follows the
  // same contract as the reservation/payment endpoints.
  if (value == null) return true
  const e = value as RentalBookingEvidence
  const money = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0
  const equal = (a: number, b: number) => Math.abs(a - b) <= 0.005
  if (e.rentalId !== rentalId || !reservationId || e.reservationId !== reservationId || e.currency !== "VND" ||
    typeof e.paymentsTruncated !== "boolean" || !Array.isArray(e.payments) || e.payments.length > 20 ||
    (e.paymentsTruncated && e.payments.length !== 20)) return false
  if (e.agreedAmounts !== null) {
    const a = e.agreedAmounts
    if (!a || ![a.netRentalAmount, a.reservationDepositAmount, a.securityDepositAmount,
      a.remainingRentalAmount, a.dueAtCheckIn, a.totalInitialObligation].every(money) ||
      !equal(a.reservationDepositAmount + a.remainingRentalAmount, a.netRentalAmount) ||
      !equal(a.remainingRentalAmount + a.securityDepositAmount, a.dueAtCheckIn) ||
      !equal(a.netRentalAmount + a.securityDepositAmount, a.totalInitialObligation)) return false
  }
  const ids = new Set<string>()
  return e.payments.every(p => {
    if (!p || typeof p.id !== "string" || !p.id.trim() || ids.has(p.id) || !money(p.amount) ||
      typeof p.purpose !== "string" || typeof p.status !== "string" ||
      !Object.prototype.hasOwnProperty.call(bookingPaymentPurposes, p.purpose) ||
      !isPaymentStatus(p.status) ||
      !Object.prototype.hasOwnProperty.call(bookingPaymentVerification, p.verification) ||
      !(p.processedAt === null || (typeof p.processedAt === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(p.processedAt) && Number.isFinite(Date.parse(p.processedAt)))) ||
      (p.invoiceNumber !== null && typeof p.invoiceNumber !== "string") ||
      !["DRAFT", "PAID", "VOID", "REFUNDED"].includes(p.invoiceStatus) ||
      !(p.invoiceIssuedAt === null || (typeof p.invoiceIssuedAt === "string" && Number.isFinite(Date.parse(p.invoiceIssuedAt))))) return false
    ids.add(p.id)
    if (p.projectRecognition != null) {
      const r = p.projectRecognition
      if (typeof r.environment !== "string" || typeof r.enabled !== "boolean" ||
        typeof r.eligibleForReconciliation !== "boolean" || typeof r.reason !== "string" ||
        (r.eligibleForReconciliation && (!r.enabled || r.environment !== "VNPAY_SANDBOX" || p.verification !== "SANDBOX"))) return false
    }
    return true
  })
}
