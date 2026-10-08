import { apiRequest } from "./apiClient"
import {
  invalidRentalResponse,
  readRentalEnvelope,
  readRentalPage,
  rentalQuery,
} from "./rentalApi"
import type {
  RenewalAppointmentQuery,
  RenewalOperationCommand,
  RenewalOperationEvent,
  RenewalOperationResult,
  RenewalOperationsRole,
  RenewalOperationState,
  RenewalPayableStatement,
} from "../types/renewalOperationsApi"

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
export const isInstant = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v))
export const isVersion = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0
const nullable = (v: unknown, check: (v: unknown) => boolean) =>
  v === null || check(v)
export function isOperationState(
  value: unknown,
): value is RenewalOperationState {
  const r = value as RenewalOperationState | null
  return (
    !!r &&
    isUuid(r.renewalId) &&
    nullable(r.expectedVersion, isVersion) &&
    [
      "UNKNOWN",
      "AWAITING_DEPOSIT",
      "SIGNING",
      "SIGNING_EXPIRY_PENDING",
      "SIGNING_EXPIRED",
      "PAYMENT_EXPIRED",
      "COMPLETED",
    ].includes(r.phase) &&
    [
      r.depositPaymentRef,
      r.appointmentRef,
      r.arrivalRef,
      r.confirmedExceptionRef,
      r.pendingExceptionRef,
      r.completedBy,
    ].every((v) => nullable(v, isUuid)) &&
    [
      r.depositPaidAt,
      r.originalSigningDeadline,
      r.effectiveSigningDeadline,
      r.recoveryCutoff,
      r.appointmentStart,
      r.appointmentEnd,
      r.completedAt,
    ].every((v) => nullable(v, isInstant)) &&
    Array.isArray(r.missingSources) &&
    r.missingSources.every((v) => typeof v === "string" && !!v) &&
    (r.appointmentRef === null
      ? r.appointmentStart === null && r.appointmentEnd === null
      : isInstant(r.appointmentStart) &&
        isInstant(r.appointmentEnd) &&
        Date.parse(r.appointmentStart) < Date.parse(r.appointmentEnd)) &&
    (![
      "SIGNING",
      "SIGNING_EXPIRY_PENDING",
      "SIGNING_EXPIRED",
      "COMPLETED",
    ].includes(r.phase) ||
      (isVersion(r.expectedVersion) &&
        isUuid(r.depositPaymentRef) &&
        isInstant(r.depositPaidAt) &&
        isInstant(r.originalSigningDeadline) &&
        isInstant(r.effectiveSigningDeadline) &&
        isInstant(r.recoveryCutoff))) &&
    (r.phase !== "COMPLETED" ||
      (isUuid(r.completedBy) &&
        isInstant(r.completedAt) &&
        isUuid(r.arrivalRef)))
  )
}
export function isOperationEvent(
  value: unknown,
): value is RenewalOperationEvent {
  const e = value as RenewalOperationEvent | null
  if (
    !(
      !!e &&
      isUuid(e.id) &&
      isInstant(e.occurredAt) &&
      nullable(e.actorId, isUuid) &&
      [
        "DEPOSIT",
        "CASH",
        "APPOINTMENT",
        "ARRIVAL",
        "INCIDENT",
        "EXCEPTION",
        "CONFIRMATION",
        "REFUND",
        "COMPLETION",
        "EXPIRY",
      ].includes(e.kind) &&
      e.data !== undefined &&
      e.data !== null &&
      typeof e.data === "object" &&
      !Array.isArray(e.data)
    )
  )
    return false
  const d = e.data as Record<string, unknown>
  const money = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
  if (e.kind === "DEPOSIT")
    return (
      isUuid(d.paymentRef) &&
      isUuid(d.renewalId) &&
      ["SUCCESS", "FAILED", "NOT_RECEIVED"].includes(String(d.outcome)) &&
      (d.outcome === "SUCCESS"
        ? money(d.amount) && d.currency === "VND" && isInstant(d.paidAt)
        : nullable(d.amount, money) &&
          nullable(d.currency, (v) => typeof v === "string") &&
          nullable(d.paidAt, isInstant))
    )
  if (e.kind === "CASH")
    return (
      isUuid(d.reference) &&
      isUuid(d.renewalId) &&
      isUuid(d.statementRef) &&
      money(d.amount) &&
      d.currency === "VND" &&
      isInstant(d.receivedAt)
    )
  if (e.kind === "REFUND") {
    if (d.status === "REJECTED") return true
    if (
      d.status !== "APPROVED_AWAITING_EXECUTION" ||
      !d.reservation ||
      typeof d.reservation !== "object"
    )
      return false
    const r = d.reservation as Record<string, unknown>
    return (
      isUuid(r.reference) &&
      isUuid(r.renewalId) &&
      money(r.amount) &&
      Number(r.amount) > 0 &&
      r.currency === "VND" &&
      isInstant(r.reviewDueAt) &&
      isInstant(r.executionDueAt)
    )
  }
  return true
}
const path = (role: RenewalOperationsRole, id: string) => {
  if (!isUuid(id)) throw new Error("Mã gia hạn phải là UUID từ API.")
  return `/api/${role}/renewals/${encodeURIComponent(id)}`
}
export async function getRenewalOperations(
  role: RenewalOperationsRole,
  id: string,
) {
  return readRentalEnvelope<RenewalOperationState>(
    await apiRequest(
      `${path(role, id)}${role === "staff" ? "" : "/operations"}`,
    ),
    (v) => isOperationState(v) && v.renewalId === id,
  )
}
export async function listRenewalAppointments(
  query: RenewalAppointmentQuery = {},
) {
  if (
    query.status &&
    !["SIGNING", "SIGNING_EXPIRED", "COMPLETED"].includes(query.status)
  )
    throw new Error("Trạng thái lịch ký không hợp lệ.")
  if (query.date && !/^\d{4}-\d{2}-\d{2}$/.test(query.date))
    throw new Error("Ngày lọc phải có định dạng YYYY-MM-DD.")
  if (query.facilityId && !isUuid(query.facilityId))
    throw new Error("Mã cơ sở không hợp lệ.")
  const suffix = rentalQuery(
    query,
    ["page", "size", "facilityId", "date", "status"],
    [],
  )
  return readRentalPage<RenewalOperationState>(
    await apiRequest(`/api/staff/renewal-appointments${suffix}`),
    isOperationState,
  )
}
export async function listRenewalOperationEvents(
  role: RenewalOperationsRole,
  id: string,
  category: "payments" | "refunds" | "facility-incidents",
  page = 0,
  size = 20,
) {
  if (
    (category === "refunds" && role === "staff") ||
    (category === "facility-incidents" && role !== "manager")
  )
    throw new Error("Vai trò không có API lịch sử này.")
  const suffix = rentalQuery({ page, size }, ["page", "size"], [])
  const allowed =
    category === "payments"
      ? ["DEPOSIT", "CASH"]
      : category === "refunds"
        ? ["REFUND"]
        : ["INCIDENT", "EXCEPTION"]
  return readRentalPage<RenewalOperationEvent>(
    await apiRequest(`${path(role, id)}/${category}${suffix}`),
    (v) =>
      isOperationEvent(v) && allowed.includes(v.kind) && linkedEvent(v, id),
  )
}
function linkedEvent(event: RenewalOperationEvent, id: string) {
  const d = event.data as Record<string, unknown>
  if (["DEPOSIT", "CASH"].includes(event.kind)) return d.renewalId === id
  if (event.kind === "REFUND" && d.reservation)
    return (d.reservation as Record<string, unknown>).renewalId === id
  return true
}
export async function getRenewalPayableStatement(id: string) {
  return readRentalEnvelope<RenewalPayableStatement>(
    await apiRequest(`${path("staff", id)}/payable-statement`),
    (v) => {
      const s = v as RenewalPayableStatement | null
      return (
        !!s &&
        isUuid(s.reference) &&
        s.renewalId === id &&
        typeof s.version === "string" &&
        !!s.version &&
        isInstant(s.expiresAt) &&
        typeof s.amount === "number" &&
        Number.isFinite(s.amount) &&
        s.amount >= 0 &&
        s.currency === "VND" &&
        Array.isArray(s.requiredObligations) &&
        s.requiredObligations.length > 0 &&
        s.requiredObligations.every(isUuid) &&
        new Set(s.requiredObligations).size === s.requiredObligations.length
      )
    },
  )
}
export function validateMutation(version: number, key: string) {
  if (!isVersion(version)) throw new Error("Thiếu phiên bản workflow xác thực.")
  if (!key.trim() || key.length > 100)
    throw new Error("Idempotency-Key không hợp lệ.")
}
export function validateText(value: string, required = true, max = 2000) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error(
      `Nội dung ${required ? "bắt buộc, " : ""}tối đa ${max} ký tự.`,
    )
}
export function validateEvidence(ids: string[]) {
  if (
    !Array.isArray(ids) ||
    ids.length > 10 ||
    !ids.every(isUuid) ||
    new Set(ids).size !== ids.length
  )
    throw new Error(
      "Minh chứng cần tối đa 10 FileAsset UUID khác nhau, đã liên kết với hồ sơ.",
    )
}
const routes = {
  deposit: ["customer", "POST", "simulated-payment"],
  appointment: ["customer", "POST", "appointment"],
  reschedule: ["customer", "PATCH", "appointment"],
  confirmation: ["customer", "POST", "exception-confirmations"],
  arrival: ["staff", "POST", "arrival"],
  incident: ["staff", "POST", "facility-incidents"],
  cash: ["staff", "POST", "cash-receipts"],
  completion: ["staff", "POST", "completion"],
  exception: ["manager", "POST", "exception-decisions"],
  refund: ["manager", "POST", "refund-decisions"],
} as const
const eventKinds = {
  deposit: "DEPOSIT",
  appointment: "APPOINTMENT",
  reschedule: "APPOINTMENT",
  confirmation: "CONFIRMATION",
  arrival: "ARRIVAL",
  incident: "INCIDENT",
  cash: "CASH",
  completion: "COMPLETION",
  exception: "EXCEPTION",
  refund: "REFUND",
} as const
export async function sendRenewalOperation(
  id: string,
  command: RenewalOperationCommand,
  key: string,
) {
  const b = command.body
  validateMutation(b.expectedVersion, key)
  if ("evidenceFileIds" in b) validateEvidence(b.evidenceFileIds)
  for (const field of [
    "appointmentRef",
    "arrivalRef",
    "decisionRef",
    "incidentId",
    "payableStatementRef",
    "signedDocumentFileId",
  ] as const) {
    if (field in b && !isUuid(b[(field as keyof typeof b)]))
      throw new Error("Tham chiếu hồ sơ/minh chứng không hợp lệ.")
  }
  if ("reason" in b)
    validateText(b.reason ?? "", !["appointment"].includes(command.action))
  if ("completionNote" in b) validateText(b.completionNote ?? "", false)
  if (command.action === "reschedule") validateText(command.body.reason ?? "")
  if ("appointmentAt" in b && !isInstant(b.appointmentAt))
    throw new Error("Thời điểm hẹn cần ISO instant.")
  if (command.action === "exception") {
    const d = command.body
    if (
      ![
        "APPROVE_RESCHEDULE_BEFORE_CUTOFF",
        "REQUEST_POST_CUTOFF_REVIEW",
        "REJECT",
      ].includes(d.action)
    )
      throw new Error("Quyết định ngoại lệ không hợp lệ.")
    if (
      d.action === "APPROVE_RESCHEDULE_BEFORE_CUTOFF"
        ? !isInstant(d.appointmentAt) || !isInstant(d.revisedDeadline)
        : d.appointmentAt !== undefined || d.revisedDeadline !== undefined
    )
      throw new Error("Chỉ đề xuất đổi lịch nhận lịch/hạn mới hợp lệ.")
  }
  if (
    command.action === "refund" &&
    !["APPROVE", "REJECT"].includes(command.body.decision)
  )
    throw new Error("Quyết định hoàn tiền không hợp lệ.")
  if (command.action === "cash") {
    validateText(command.body.receiptReference, true, 100)
    if (command.body.received !== true)
      throw new Error("Cần xác nhận đã nhận tiền thật.")
  }
  if (command.action === "completion" && command.body.identityVerified !== true)
    throw new Error("Cần xác minh danh tính.")
  const [role, method, route] = routes[command.action]
  const result = readRentalEnvelope<RenewalOperationResult>(
    await apiRequest(`${path(role, id)}/${route}`, {
      method,
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(b),
    }),
    (v) => {
      const r = v as RenewalOperationResult | null
      return (
        !!r &&
        isOperationState(r.state) &&
        r.state.renewalId === id &&
        isOperationEvent(r.event) &&
        r.event.kind === eventKinds[command.action] &&
        linkedEvent(r.event, id)
      )
    },
  )
  if (
    result.state.expectedVersion === null ||
    result.state.expectedVersion <= b.expectedVersion
  )
    return invalidRentalResponse()
  return result
}
