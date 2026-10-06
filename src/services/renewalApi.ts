import { apiRequest } from "./apiClient"
import { readRentalEnvelope, readRentalPage, rentalQuery } from "./rentalApi"
import type { RentalApiRole } from "../types/rentalApi"
import type {
  RenewalApiOption,
  RenewalApiQuery,
  RenewalApiQuote,
  RenewalApiRecord,
} from "../types/renewalApi"

export function isRenewalRecord(value: unknown): boolean {
  const r = value as RenewalApiRecord | null
  return (
    !!r &&
    typeof r.id === "string" &&
    typeof r.rentalId === "string" &&
    !!r.facility?.id &&
    !!r.customer?.id &&
    !!r.storageUnit?.id &&
    [
      "pending",
      "deposit_paid",
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
      ["CANCEL", "ACCEPT_REVISED_QUOTE", "APPROVE", "REJECT"].includes(a),
    ) &&
    Array.isArray(r.disabledReasons) &&
    r.disabledReasons.every((reason) => typeof reason === "string") &&
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
    Number.isFinite(r.amount) &&
    typeof r.currency === "string"
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
  )
}
export async function getRenewal(role: RentalApiRole, id: string) {
  return readRentalEnvelope<RenewalApiRecord>(
    await apiRequest(`/api/${role}/renewals/${encodeURIComponent(id)}`),
    isRenewalRecord,
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
        typeof q.pricingPackageCode === "string" &&
        Number.isFinite(Date.parse(q.expiresAt)) &&
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
) {
  if (!key || new TextEncoder().encode(key).length > 100)
    throw new Error("Idempotency-Key không hợp lệ.")
  return readRentalEnvelope<RenewalApiRecord>(
    await apiRequest(path, {
      method,
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": key },
    }),
    isRenewalRecord,
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
  )
}
export function decideRenewal(
  id: string,
  decision: "APPROVE" | "REJECT",
  reason: string,
  expectedVersion: number,
  key: string,
) {
  version(expectedVersion)
  text(reason, decision === "REJECT")
  return command(
    `/api/manager/renewals/${encodeURIComponent(id)}/decision`,
    "POST",
    { decision, reason, expectedVersion },
    key,
  )
}
