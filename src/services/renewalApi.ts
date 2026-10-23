import { apiRequest } from "./apiClient"
import { readRentalEnvelope, readRentalPage, rentalQuery } from "./rentalApi"
import type { RentalApiRole } from "../types/rentalApi"
import type {
  RenewalApiOption,
  RenewalApiQuery,
  RenewalApiQuote,
  RenewalApiRecord,
  RenewalVnpayPaymentResponse,
} from "../types/renewalApi"

type AcceptedTerms = NonNullable<RenewalApiRecord["acceptedTerms"]>
function validPeriodMetadata(t: AcceptedTerms): boolean {
  if (t.endDateConvention == null && t.rentalStartDate == null) return true // Readable legacy snapshot, not permission to execute.
  if (!["INCLUSIVE", "EXCLUSIVE"].includes(t.endDateConvention ?? "") || typeof t.rentalStartDate !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(t.rentalStartDate) || !Number.isFinite(Date.parse(t.rentalStartDate))
    || new Date(t.rentalStartDate).toISOString().slice(0, 10) !== t.rentalStartDate) return false
  const rawEnd = Date.parse(t.oldEndDate), extension = Date.parse(t.extensionStartDate)
  return Date.parse(t.rentalStartDate) < extension
    && extension - rawEnd === (t.endDateConvention === "EXCLUSIVE" ? 0 : 86400000)
}
function isAcceptedTerms(value: unknown): value is AcceptedTerms {
  if (!value || typeof value !== "object") return false
  const t = value as AcceptedTerms
  const money = [t.monthlyPrice, t.subtotal, t.discountAmount, t.totalAfterDiscount,
    t.renewalDepositAmount, t.remainingRentalAmount]
  return validPeriodMetadata(t) && money.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0) &&
    typeof t.discountRate === "number" && Number.isFinite(t.discountRate) && t.discountRate >= 0 && t.discountRate <= 1 &&
    Number.isInteger(t.rentalMonths) && t.rentalMonths > 0 &&
    [t.unitTypeId, t.storageUnitId, t.facilityId, t.pricingPackageCode, t.packagePolicyRef,
      t.packagePolicyVersion, t.renewalPolicyRef, t.renewalPolicyVersion, t.currency]
      .every(s => typeof s === "string" && s.trim().length > 0) &&
    [t.oldEndDate, t.extensionStartDate, t.extensionEndExclusive, t.newEndDate]
      .every(d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)))
}

export function isRenewalRecord(value: unknown): boolean {
  const r = value as RenewalApiRecord | null
  return (
    !!r &&
    (r.displayCode == null || (typeof r.displayCode === "string" && /^(?:SH-\d{6}|GH-\d{4}-\d{6})$/.test(r.displayCode))) &&
    typeof r.id === "string" &&
    typeof r.rentalId === "string" &&
    !!r.facility?.id &&
    !!r.customer?.id &&
    !!r.storageUnit?.id &&
    [
      "pending",
      "accepted",
      "deposit_paid",
      "full_rent_paid",
      "approved",
      "appointment_scheduled",
      "payment_processing",
      "payment_failed",
      "payment_expired",
      "rejected",
      "cancelled",
      "completed",
    ].includes(r.status) &&
    ["READY", "AWAITING_CUSTOMER_CONFIRMATION", "UNKNOWN"].includes(
      r.reviewState,
    ) &&
    Array.isArray(r.allowedActions) &&
    r.allowedActions.every((a) =>
      ["CANCEL", "ACCEPT_REVISED_QUOTE"].includes(a),
    ) &&
    Array.isArray(r.disabledReasons) &&
    r.disabledReasons.every((reason) => typeof reason === "string") &&
    (r.systemVerification == null || (
      ["VERIFIED", "BLOCKED", "INCOMPLETE", "UNKNOWN"].includes(r.systemVerification.status) &&
      Array.isArray(r.systemVerification.verifiedChecks) &&
      r.systemVerification.verifiedChecks.every((check) => typeof check === "string") &&
      Array.isArray(r.systemVerification.blockingReasons) &&
      r.systemVerification.blockingReasons.every((reason) => typeof reason === "string")
    )) &&
    !!r.financialCheck &&
    typeof r.financialCheck.completeness === "string" &&
    (r.financialCheck.blockingObligationRefs === null ||
      (Array.isArray(r.financialCheck.blockingObligationRefs) &&
        r.financialCheck.blockingObligationRefs.every(
          (ref) => typeof ref === "string",
        ))) &&
    (r.financialCheck.hasUnresolvedDispute === null ||
      typeof r.financialCheck.hasUnresolvedDispute === "boolean") &&
    (r.version === null ||
      (Number.isInteger(r.version) && Number(r.version) >= 0)) &&
    Number.isFinite(r.amount) && r.amount >= 0 &&
    r.currency === "VND" &&
    (r.cancellationReason == null || typeof r.cancellationReason === "string") &&
    (r.acceptedTerms == null ||
      (isAcceptedTerms(r.acceptedTerms) && r.acceptedTerms.facilityId === r.facility.id &&
        r.acceptedTerms.storageUnitId === r.storageUnit.id &&
        r.acceptedTerms.oldEndDate === r.oldEndDate && r.acceptedTerms.newEndDate === r.newEndDate &&
        r.acceptedTerms.totalAfterDiscount === r.amount && r.acceptedTerms.currency === r.currency))
  )
}
export async function listRenewals(
  role: RentalApiRole,
  query: RenewalApiQuery = {},
) {
  const suffix = rentalQuery(
    query,
    [
      "page",
      "size",
      "status",
      "rentalId",
      "sort",
      ...(role === "manager" ? ["facilityId", "search"] : []),
    ],
    ["createdAt", "newEndDate", "amount", "id"],
  )
  return readRentalPage<RenewalApiRecord>(
    await apiRequest(`/api/${role}/renewals${suffix}`),
    isRenewalRecord,
    query.page ?? 0,
  )
}
export async function getRenewal(role: RentalApiRole, id: string) {
  return readRentalEnvelope<RenewalApiRecord>(
    await apiRequest(`/api/${role}/renewals/${encodeURIComponent(id)}`),
    (value) => isRenewalRecord(value) && (value as RenewalApiRecord).id === id,
  )
}
export async function getRenewalOptions(rentalId: string) {
  return readRentalEnvelope<RenewalApiOption[]>(
    await apiRequest(
      `/api/customer/rentals/${encodeURIComponent(rentalId)}/renewal-options`,
    ),
    (data) =>
      Array.isArray(data) &&
      data.every(
        (o) =>
          typeof o?.pricingPackageCode === "string" &&
            (o.pricingPackageName === undefined || o.pricingPackageName === null || typeof o.pricingPackageName === "string") &&
          Number.isInteger(o.rentalMonths) &&
          o.rentalMonths > 0,
      ),
  )
}
export async function quoteRenewal(
  rentalId: string,
  pricingPackageCode: string,
) {
  return readRentalEnvelope<RenewalApiQuote>(
    await apiRequest(
      `/api/customer/rentals/${encodeURIComponent(rentalId)}/renewal-quote`,
      { method: "POST", body: JSON.stringify({ pricingPackageCode }) },
    ),
    (data) => {
      const q = data as RenewalApiQuote | null
      return (
        !!q &&
        typeof q.id === "string" &&
        q.rentalId === rentalId &&
        isAcceptedTerms(q) &&
        (q.expiresAt == null || Number.isFinite(Date.parse(q.expiresAt))) &&
        [
          "monthlyPrice",
          "subtotal",
          "discountAmount",
          "totalAfterDiscount",
          "renewalDepositAmount",
          "remainingRentalAmount",
        ].every((key) => Number.isFinite(q[(key as keyof RenewalApiQuote)]))
      )
    },
  )
}
async function command(
  path: string,
  method: string,
  body: object,
  key: string,
  matches: (record: RenewalApiRecord) => boolean,
) {
  if (!key || new TextEncoder().encode(key).length > 100)
    throw new Error("Idempotency-Key không hợp lệ.")
  return readRentalEnvelope<RenewalApiRecord>(
    await apiRequest(path, {
      method,
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": key },
    }),
    (value) => isRenewalRecord(value) && matches(value as RenewalApiRecord),
  )
}
function version(value: number) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error("Thiếu phiên bản workflow hợp lệ.")
}
function text(value: string, required = false) {
  if (value.length > 2000 || (required && !value.trim()))
    throw new Error("Lý do bắt buộc, tối đa 2000 ký tự.")
}
export function submitRenewal(
  rentalId: string,
  renewalQuoteId: string,
  note: string,
  key: string,
) {
  text(note)
  return command(
    `/api/customer/rentals/${encodeURIComponent(rentalId)}/renewal-requests`,
    "POST",
    { renewalQuoteId, note },
    key,
    record => record.rentalId === rentalId,
  )
}
export function reviseRenewal(
  id: string,
  renewalQuoteId: string,
  note: string,
  expectedVersion: number,
  key: string,
) {
  version(expectedVersion)
  text(note)
  return command(
    `/api/customer/renewals/${encodeURIComponent(id)}`,
    "PATCH",
    { renewalQuoteId, note, expectedVersion },
    key,
    record => record.id === id,
  )
}
export function cancelRenewal(
  id: string,
  reason: string,
  expectedVersion: number,
  key: string,
) {
  version(expectedVersion)
  text(reason, true)
  return command(
    `/api/customer/renewals/${encodeURIComponent(id)}/cancel`,
    "POST",
    { reason, expectedVersion },
    key,
    record => record.id === id,
  )
}

function isRenewalPaymentResponse(value: unknown,renewalId: string): value is RenewalVnpayPaymentResponse {
  const result=value as RenewalVnpayPaymentResponse|null
  return !!result&&typeof result.paymentId==="string"&&result.renewalId===renewalId
    &&(result.acceptedRevisionId===null||typeof result.acceptedRevisionId==="string")
    &&typeof result.transactionReference==="string"&&Number.isFinite(result.amount)&&result.amount>0
    &&result.currency==="VND"
    &&["PENDING","PROCESSING","PAID","NOT_RECEIVED","FAILED","CANCELLED"].includes(result.paymentStatus)
    &&(result.paymentDeadline===null||Number.isFinite(Date.parse(result.paymentDeadline)))
    &&(result.paidAt===null||Number.isFinite(Date.parse(result.paidAt)))
    &&typeof result.reconciliationRequired==="boolean"&&typeof result.message==="string"
    &&(result.paymentUrl===null||typeof result.paymentUrl==="string")
    &&(result.settlementStage===undefined||["AWAITING_PAYMENT","VERIFIED_AWAITING_ALLOCATION","ALLOCATED_AWAITING_SIGNING","AWAITING_SIGNING","COMPLETED","RECONCILIATION_REQUIRED"].includes(result.settlementStage))
}

export function renewalPaymentRedirectUrl(payment: RenewalVnpayPaymentResponse): string {
  if(!payment.paymentUrl)throw new Error("Backend chưa trả về đường dẫn thanh toán. Vui lòng thử lại hoặc liên hệ hỗ trợ.")
  let url: URL
  try { url=new URL(payment.paymentUrl) } catch { throw new Error("Đường dẫn thanh toán VNPay không hợp lệ.") }
  if(url.protocol!=="https:"||!["sandbox.vnpayment.vn","pay.vnpay.vn"].includes(url.hostname)
    ||url.port||url.username||url.password||url.pathname!=="/paymentv2/vpcpay.html"
    ||url.searchParams.get("vnp_TxnRef")!==payment.transactionReference
    ||url.searchParams.get("vnp_Amount")!==String(Math.round(payment.amount*100)))
    throw new Error("Đường dẫn thanh toán không khớp giao dịch VNPay. Vui lòng liên hệ hỗ trợ.")
  return url.href
}

export async function createRenewalVnpayPaymentIntent(renewalId:string,idempotencyKey:string) {
  if(!idempotencyKey||new TextEncoder().encode(idempotencyKey).length>100)
    throw new Error("Idempotency-Key thanh toán gia hạn không hợp lệ.")
  return readRentalEnvelope<RenewalVnpayPaymentResponse>(
    await apiRequest(`/api/customer/renewals/${encodeURIComponent(renewalId)}/payment-intents`,{
      method:"POST",headers:{"Idempotency-Key":idempotencyKey},
    }),
    value=>isRenewalPaymentResponse(value,renewalId),
  )
}

export async function getRenewalVnpayPayment(renewalId:string) {
  return readRentalEnvelope<RenewalVnpayPaymentResponse>(
    await apiRequest(`/api/customer/renewals/${encodeURIComponent(renewalId)}/payment`),
    value=>isRenewalPaymentResponse(value,renewalId),
  )
}
