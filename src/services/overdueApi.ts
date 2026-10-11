import { apiRequest } from "./apiClient"
import {
  invalidRentalResponse,
  readRentalEnvelope,
  readRentalPage,
  rentalQuery,
} from "./rentalApi"
import {
  isInstant,
  isUuid,
  isVersion,
  validateMutation,
  validateText,
} from "./renewalOperationsApi"
import type {
  OverdueCase,
  OverdueFollowUp,
  OverduePage,
  OverdueQuery,
} from "../types/overdueApi"

export function validOverdueRef(ref: unknown): ref is string {
  if (typeof ref !== "string") return false
  const parts = ref.split(":")
  return (
    ((parts[0] === "RENTAL_TERM" && parts.length === 2) ||
      (parts[0] === "PAYMENT_DUE" && parts.length === 3)) &&
    parts.slice(1).every((v) => isUuid(v) && v === v.toLowerCase())
  )
}
export function isOverdueCase(value: unknown): value is OverdueCase {
  const r = value as OverdueCase | null
  if (
    !r ||
    !validOverdueRef(r.caseRef) ||
    ![r.rentalId, r.facilityId, r.customerId].every(isUuid) ||
    r.caseRef.split(":")[1] !== r.rentalId ||
    typeof r.customerName !== "string" ||
    typeof r.storageUnitCode !== "string" ||
    !isVersion(r.overdueDays) ||
    !isVersion(r.followUpVersion) ||
    typeof r.recoveryEligible !== "boolean"
  )
    return false
  if (r.kind === "PAYMENT_DUE")
    return (
      r.priority === "PAYMENT_DUE" &&
      isUuid(r.obligationRef) &&
      r.caseRef === `PAYMENT_DUE:${r.rentalId}:${r.obligationRef}` &&
      isInstant(r.dueAt) &&
      typeof r.outstanding === "number" &&
      Number.isFinite(r.outstanding) &&
      r.outstanding > 0 &&
      r.currency === "VND" &&
      !r.recoveryEligible &&
      r.policyRef === null &&
      r.policyVersion === null &&
      r.recoveryCutoff === null
    )
  return (
    r.kind === "RENTAL_TERM" &&
    r.caseRef === `RENTAL_TERM:${r.rentalId}` &&
    r.overdueDays > 0 &&
    ["WARNING", "SERIOUS", "URGENT", "RECOVERY"].includes(r.priority) &&
    r.obligationRef === null &&
    r.dueAt === null &&
    r.outstanding === null &&
    r.currency === null &&
    typeof r.policyRef === "string" &&
    !!r.policyRef &&
    typeof r.policyVersion === "string" &&
    !!r.policyVersion &&
    isInstant(r.recoveryCutoff) &&
    (!r.recoveryEligible || r.priority === "RECOVERY")
  )
}
export function isOverdueFollowUp(value: unknown): value is OverdueFollowUp {
  const f = value as OverdueFollowUp | null
  return (
    !!f &&
    isUuid(f.id) &&
    validOverdueRef(f.caseRef) &&
    ["NOTE", "REMINDER", "RECOVERY_HANDOFF"].includes(f.type) &&
    typeof f.content === "string" &&
    isUuid(f.actorId) &&
    isInstant(f.recordedAt) &&
    isVersion(f.followUpVersion) &&
    (f.externalRef === null || isUuid(f.externalRef)) &&
    (f.type === "NOTE" || isUuid(f.externalRef)) &&
    (f.policyRef === null || typeof f.policyRef === "string") &&
    (f.policyVersion === null || typeof f.policyVersion === "string")
  )
}
const casePath = (ref: string) => {
  if (!validOverdueRef(ref)) throw new Error("Mã quá hạn không đúng contract.")
  return `/api/manager/overdue-cases/${encodeURIComponent(ref)}`
}
export async function listOverdueCases(query: OverdueQuery = {}) {
  if (query.kind && !["ALL", "PAYMENT_DUE", "RENTAL_TERM"].includes(query.kind))
    throw new Error("Loại quá hạn không hợp lệ.")
  if (query.facilityId && !isUuid(query.facilityId))
    throw new Error("Mã cơ sở không hợp lệ.")
  const value = await apiRequest<unknown>(
    `/api/manager/overdue-cases${rentalQuery(query, ["page", "size", "facilityId", "kind", "search", "sort"], ["priority", "overdueDays", "caseRef"])}`,
  )
  readRentalPage<OverdueCase>(value, isOverdueCase)
  const p = value as OverduePage
  if (
    !isInstant(p.asOf) ||
    !["COMPLETE", "PARTIAL"].includes(p.completeness) ||
    !Array.isArray(p.missingSources) ||
    !p.missingSources.every((s) => typeof s === "string" && !!s) ||
    (p.completeness === "COMPLETE" && p.missingSources.length > 0) ||
    (p.completeness === "PARTIAL" && p.missingSources.length === 0)
  )
    return invalidRentalResponse()
  return p
}
export async function getOverdueCase(ref: string) {
  return readRentalEnvelope<OverdueCase>(
    await apiRequest(casePath(ref)),
    (v) => isOverdueCase(v) && v.caseRef === ref,
  )
}
export async function listOverdueFollowUps(ref: string, page = 0, size = 20) {
  return readRentalPage<OverdueFollowUp>(
    await apiRequest(
      `${casePath(ref)}/follow-ups${rentalQuery({ page, size }, ["page", "size"], [])}`,
    ),
    (v) => isOverdueFollowUp(v) && v.caseRef === ref,
  )
}
export async function sendOverdueFollowUp(
  ref: string,
  type: "NOTE" | "REMINDER" | "RECOVERY_HANDOFF",
  content: string,
  expectedVersion: number,
  key: string,
) {
  validateMutation(expectedVersion, key)
  validateText(content)
  if (!["NOTE", "REMINDER", "RECOVERY_HANDOFF"].includes(type))
    throw new Error("Thao tác quá hạn không hợp lệ.")
  const recovery = type === "RECOVERY_HANDOFF"
  return readRentalEnvelope<OverdueFollowUp>(
    await apiRequest(
      `${casePath(ref)}/${recovery ? "recovery-handoffs" : "follow-ups"}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(
          recovery
            ? { reason: content, expectedVersion }
            : { type, content, expectedVersion },
        ),
      },
    ),
    (v) => isOverdueFollowUp(v) && v.caseRef === ref && v.type === type,
  )
}
