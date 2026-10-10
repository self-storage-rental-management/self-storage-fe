import { apiDownload, apiRequest, ApiClientError } from "./apiClient"
import { getAuthenticatedActor } from "./authApi"
import { readRentalEnvelope } from "./rentalApi"
import {
  isUuid,
  isInstant,
  isVersion,
  isOperationState,
  isOperationEvent,
  validateMutation,
  validateEvidence,
  validateText,
} from "./renewalOperationsApi"
import type { RenewalOperationResult } from "../types/renewalOperationsApi"

type RecordValue = Record<string, unknown>
const object = (v: unknown): v is RecordValue =>
  !!v && typeof v === "object" && !Array.isArray(v)
const money = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim()
const nullable = (v: unknown, check: (v: unknown) => boolean) =>
  v === null || check(v)
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
const positive = (v: unknown): v is number => isVersion(v) && v > 0
const time = (v: unknown) =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v)
function requireId(id: string) {
  if (!isUuid(id)) throw new Error("Mã hồ sơ không hợp lệ.")
}
function fields(value: object, allowed: string[]) {
  if (!Object.keys(value).every((k) => allowed.includes(k)))
    throw new Error("Yêu cầu chứa trường không được hỗ trợ.")
}

export type LedgerRole = "customer" | "manager" | "business"
export interface LedgerView {
  rentalId: string
  completeness: "UNKNOWN" | "PARTIAL"
  currency: "VND"
  revision: number | null
  reason: string
  obligations: {
    id: string
    renewalId: string | null
    kind: "RENT" | "SECURITY_DEPOSIT" | "RENEWAL_DEPOSIT" | "RENEWAL_REMAINDER"
    amount: number
    dueAt: string
    outstanding: number
  }[] | null
  receipts: {
    id: string
    method: "CASH" | "VERIFIED_BANK" | "SIMULATED"
    amount: number
    receivedAt: string
    simulated: boolean
  }[] | null
  refunds: {
    id: string
    amount: number
    status: "RESERVED" | "EXECUTED"
  }[] | null
}
export function isLedgerView(v: unknown): v is LedgerView {
  if (
    !object(v) ||
    !isUuid(v.rentalId) ||
    v.currency !== "VND" ||
    !text(v.reason)
  )
    return false
  if (v.completeness === "UNKNOWN")
    return (
      v.revision === null &&
      v.obligations === null &&
      v.receipts === null &&
      v.refunds === null
    )
  return (
    v.completeness === "PARTIAL" &&
    isVersion(v.revision) &&
    Array.isArray(v.obligations) &&
    Array.isArray(v.receipts) &&
    Array.isArray(v.refunds) &&
    v.obligations.every(
      (o) =>
        object(o) &&
        isUuid(o.id) &&
        nullable(o.renewalId, isUuid) &&
        [
          "RENT",
          "SECURITY_DEPOSIT",
          "RENEWAL_DEPOSIT",
          "RENEWAL_REMAINDER",
        ].includes(String(o.kind)) &&
        money(o.amount) &&
        money(o.outstanding) &&
        o.outstanding <= o.amount &&
        isInstant(o.dueAt),
    ) &&
    v.receipts.every(
      (p) =>
        object(p) &&
        isUuid(p.id) &&
        ["CASH", "VERIFIED_BANK", "SIMULATED"].includes(String(p.method)) &&
        money(p.amount) &&
        p.amount > 0 &&
        isInstant(p.receivedAt) &&
        p.simulated === (p.method === "SIMULATED"),
    ) &&
    v.refunds.every(
      (f) =>
        object(f) &&
        isUuid(f.id) &&
        money(f.amount) &&
        f.amount > 0 &&
        ["RESERVED", "EXECUTED"].includes(String(f.status)),
    )
  )
}
export async function getRentalLedger(role: LedgerRole, id: string) {
  requireId(id)
  if (!["customer", "manager", "business"].includes(role))
    throw new Error("Vai trò không được hỗ trợ.")
  return readRentalEnvelope<LedgerView>(
    await apiRequest(`/api/${role}/rentals/${id}/ledger`),
    (v) => isLedgerView(v) && v.rentalId === id,
  )
}

export interface NotificationReceipt {
  notificationId: string
  status: "ACKNOWLEDGED"
  receivedAt: string
}
export interface NotificationAcknowledgementState {
  notificationId: string
  status: "AVAILABLE" | "ACKNOWLEDGED" | "UNTRACKED"
  acknowledgementAllowed: boolean
  receivedAt: string | null
}
export async function getNotificationAcknowledgement(id: string) {
  requireId(id)
  return readRentalEnvelope<NotificationAcknowledgementState>(
    await apiRequest(`/api/customer/notifications/${id}/acknowledgement`),
    (v) =>
      object(v) && v.notificationId === id && (
        (v.status === "AVAILABLE" && v.acknowledgementAllowed === true && v.receivedAt === null) ||
        (v.status === "ACKNOWLEDGED" && v.acknowledgementAllowed === false && isInstant(v.receivedAt)) ||
        (v.status === "UNTRACKED" && v.acknowledgementAllowed === false && v.receivedAt === null)
      ),
  )
}
export async function acknowledgeNotification(id: string) {
  requireId(id)
  return readRentalEnvelope<NotificationReceipt>(
    await apiRequest(`/api/customer/notifications/${id}/acknowledgement`, {
      method: "POST",
    }),
    (v) =>
      object(v) &&
      v.notificationId === id &&
      v.status === "ACKNOWLEDGED" &&
      isInstant(v.receivedAt),
  )
}
export type RenewalCoordination = {
  kind: "assignment"
  assignedStaffId: string
  reason: string
  expectedVersion: number
} | {
  kind: "fault"
  incidentId: string
  facilityFault: boolean
  reason: string
  evidenceFileIds: string[]
  expectedVersion: number
}
export async function coordinateRenewal(
  id: string,
  command: RenewalCoordination,
  key: string,
) {
  requireId(id)
  validateMutation(command.expectedVersion, key)
  validateText(command.reason)
  if (command.kind !== "assignment" && command.kind !== "fault")
    throw new Error("Thao tác không được hỗ trợ.")
  fields(
    command,
    command.kind === "assignment"
      ? ["kind", "assignedStaffId", "reason", "expectedVersion"]
      : [
          "kind",
          "incidentId",
          "facilityFault",
          "reason",
          "evidenceFileIds",
          "expectedVersion",
        ],
  )
  if (command.kind === "assignment") requireId(command.assignedStaffId)
  else {
    requireId(command.incidentId)
    validateEvidence(command.evidenceFileIds)
    if (typeof command.facilityFault !== "boolean")
      throw new Error("Cần chọn kết luận xác minh.")
  }
  const { kind, ...body } = command
  const result = readRentalEnvelope<RenewalOperationResult>(
    await apiRequest(
      `/api/manager/renewals/${id}/${
        kind === "assignment" ? "staff-assignment" : "facility-fault-reviews"
      }`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
    (v) => {
      if (
        !object(v) ||
        !isOperationState(v.state) ||
        v.state.renewalId !== id ||
        !isOperationEvent(v.event) ||
        v.event.kind !==
          (kind === "assignment" ? "STAFF_ASSIGNMENT" : "FAULT_REVIEW")
      )
        return false
      const d = v.event.data as RecordValue
      return command.kind === "assignment"
        ? d.renewalId === id && d.staffId === command.assignedStaffId
        : d.incidentId === command.incidentId &&
            d.facilityFault === command.facilityFault
    },
  )
  if (
    !isVersion(result.state.expectedVersion) ||
    result.state.expectedVersion <= command.expectedVersion
  )
    throw new ApiClientError("Phản hồi chưa xác nhận thay đổi hồ sơ.", {
      code: "INVALID_RESPONSE",
    })
  return result
}

export interface RenewalPolicyInput {
  expectedRevision: number
  effectiveFrom: string
  effectiveTo: string | null
  quoteTtlMinutes: number
  paymentWindowHours: number
  requestWindowDays: number
  depositRate: number
  eligiblePackageIds: string[]
  signing: {
    signingWindowMinutes: number
    exceptionExtensionLimitMinutes: number
  } | null
  term: {
    calendar: "CALENDAR_DAYS"
    timezone: "Asia/Ho_Chi_Minh"
    warningThroughDay: number
    seriousThroughDay: number
    urgentThroughDay: number
    recoveryFromDay: number
    recoveryCutoffTime: string
    recoveryStartTime: string
  } | null
}
export interface CommunicationPolicyInput {
  expectedRevision: number
  effectiveFrom: string
  effectiveTo: string | null
  reminderCooldownMinutes: number | null
  supportReviewDays: number | null
  customerMayClose: boolean | null
}
type PolicyMetadata = {
  facilityId: string
  revision: number
  version: string
  publishedBy: string
  publishedAt: string
}
export type RenewalPolicy = Omit<RenewalPolicyInput, "expectedRevision"> & PolicyMetadata & {
  schema: "RENEWAL_POLICY_V1"
}
export type CommunicationPolicy = Omit<CommunicationPolicyInput, "expectedRevision"> & PolicyMetadata
export type PolicyKind = "renewal" | "communication"
export function validPolicyInput(kind: PolicyKind, v: unknown): boolean {
  if (!["renewal", "communication"].includes(kind)) return false
  if (
    !object(v) ||
    !isVersion(v.expectedRevision) ||
    !date(v.effectiveFrom) ||
    !nullable(v.effectiveTo, date) ||
    (typeof v.effectiveTo === "string" && v.effectiveTo < v.effectiveFrom)
  )
    return false
  if (kind === "communication")
    return (
      nullable(v.reminderCooldownMinutes, (x) => positive(x) && x <= 525600) &&
      nullable(v.supportReviewDays, (x) => positive(x) && x >= 7 && x <= 365) &&
      nullable(v.customerMayClose, (x) => typeof x === "boolean") &&
      (v.supportReviewDays === null) === (v.customerMayClose === null)
    )
  if (
    !positive(v.quoteTtlMinutes) ||
    !positive(v.paymentWindowHours) ||
    !isVersion(v.requestWindowDays) ||
    typeof v.depositRate !== "number" ||
    !Number.isFinite(v.depositRate) ||
    v.depositRate < 0 ||
    v.depositRate > 1 ||
    !Array.isArray(v.eligiblePackageIds) ||
    v.eligiblePackageIds.length > 20 ||
    !v.eligiblePackageIds.every(isUuid) ||
    new Set(v.eligiblePackageIds).size !== v.eligiblePackageIds.length
  )
    return false
  if (
    v.signing !== null &&
    (!object(v.signing) ||
      !positive(v.signing.signingWindowMinutes) ||
      !positive(v.signing.exceptionExtensionLimitMinutes))
  )
    return false
  const t = v.term
  return (
    t === null ||
    (object(t) &&
      t.calendar === "CALENDAR_DAYS" &&
      t.timezone === "Asia/Ho_Chi_Minh" &&
      positive(t.warningThroughDay) &&
      positive(t.seriousThroughDay) &&
      t.seriousThroughDay > t.warningThroughDay &&
      positive(t.urgentThroughDay) &&
      t.urgentThroughDay > t.seriousThroughDay &&
      t.recoveryFromDay === t.urgentThroughDay + 1 &&
      time(t.recoveryCutoffTime) &&
      time(t.recoveryStartTime))
  )
}
function policyValid(kind: PolicyKind, v: unknown, facility: string) {
  return (
    object(v) &&
    v.facilityId === facility &&
    positive(v.revision) &&
    text(v.version) &&
    isUuid(v.publishedBy) &&
    isInstant(v.publishedAt) &&
    (kind !== "renewal" || v.schema === "RENEWAL_POLICY_V1") &&
    validPolicyInput(kind, { ...v, expectedRevision: v.revision })
  )
}
export async function getIntegrationPolicy(kind: PolicyKind, facility: string) {
  requireId(facility)
  if (!["renewal", "communication"].includes(kind))
    throw new Error("Loại chính sách không hợp lệ.")
  return readRentalEnvelope<RenewalPolicy | CommunicationPolicy>(
    await apiRequest(`/api/business/facilities/${facility}/${kind}-policy`),
    (v) => policyValid(kind, v, facility),
  )
}
// Management/readback is deliberately separate from effective-policy consumers.
export async function getStoredIntegrationPolicy(kind: PolicyKind, facility: string, revision?: number) {
  requireId(facility)
  if (!["renewal", "communication"].includes(kind) ||
      (revision !== undefined && !positive(revision)))
    throw new Error("Thông tin đối chiếu chính sách không hợp lệ.")
  return readRentalEnvelope<RenewalPolicy | CommunicationPolicy>(
    await apiRequest(`/api/business/facilities/${facility}/${kind}-policy/stored${revision === undefined ? "" : `?revision=${revision}`}`),
    (v) => policyValid(kind, v, facility) &&
      (revision === undefined || (object(v) && v.revision === revision)),
  )
}

export interface RenewalAssignmentView {
  renewalId: string
  expectedVersion: number | null
  status: "ASSIGNED" | "UNASSIGNED" | "UNAVAILABLE" | "INELIGIBLE"
  staffId: string | null
  staffName: string | null
}
export async function getRenewalAssignment(id: string) {
  requireId(id)
  return readRentalEnvelope<RenewalAssignmentView>(
    await apiRequest(`/api/manager/renewals/${id}/staff-assignment`),
    (v) => object(v) && v.renewalId === id && nullable(v.expectedVersion, isVersion) &&
      (["ASSIGNED", "INELIGIBLE"].includes(String(v.status))
        ? isUuid(v.staffId) && nullable(v.staffName, text)
        : ["UNASSIGNED", "UNAVAILABLE"].includes(String(v.status)) && v.staffId === null && v.staffName === null),
  )
}
export async function publishIntegrationPolicy(
  kind: PolicyKind,
  facility: string,
  input: RenewalPolicyInput | CommunicationPolicyInput,
) {
  requireId(facility)
  if (!validPolicyInput(kind, input))
    throw new Error("Thông tin chính sách chưa đầy đủ hoặc không hợp lệ.")
  const common = ["expectedRevision", "effectiveFrom", "effectiveTo"]
  fields(input, [
    ...common,
    ...(kind === "renewal"
      ? [
          "quoteTtlMinutes",
          "paymentWindowHours",
          "requestWindowDays",
          "depositRate",
          "eligiblePackageIds",
          "signing",
          "term",
        ]
      : ["reminderCooldownMinutes", "supportReviewDays", "customerMayClose"]),
  ])
  if (kind === "renewal" && "signing" in input) {
    if (input.signing)
      fields(input.signing, [
        "signingWindowMinutes",
        "exceptionExtensionLimitMinutes",
      ])
    if (input.term)
      fields(input.term, [
        "calendar",
        "timezone",
        "warningThroughDay",
        "seriousThroughDay",
        "urgentThroughDay",
        "recoveryFromDay",
        "recoveryCutoffTime",
        "recoveryStartTime",
      ])
  }
  return readRentalEnvelope<RenewalPolicy | CommunicationPolicy>(
    await apiRequest(`/api/business/facilities/${facility}/${kind}-policy`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
    (v) =>
      policyValid(kind, v, facility) &&
      object(v) &&
      v.revision === input.expectedRevision + 1,
  )
}

export interface DuongFile {
  id: string
  originalName: string
  entityType: string
  entityId: string
  status: "ACTIVE"
}
export async function uploadDuongEvidence(
  file: File,
  entityType: string,
  entityId?: string,
) {
  if (
    !/^DUONG_(SUPPORT_(PUBLIC|INTERNAL)|RENEWAL_(ARRIVAL|INCIDENT|SIGNED_CONTRACT|EXCEPTION|FAULT_REVIEW|REFUND))$/.test(
      entityType,
    )
  )
    throw new Error("Loại tệp không được hỗ trợ.")
  if (entityId) requireId(entityId)
  if (!entityId && entityType !== "DUONG_SUPPORT_PUBLIC")
    throw new Error("Cần hồ sơ liên kết cho tệp.")
  const actor = getAuthenticatedActor()
  if (
    !entityId &&
    (!actor || actor.status !== "ACTIVE" || !actor.roles.includes("CUSTOMER"))
  )
    throw new Error(
      "Cần tài khoản khách hàng đang hoạt động để lưu tệp cho yêu cầu mới.",
    )
  const body = new FormData()
  body.append("file", file)
  body.append("entityType", entityType)
  if (entityId) body.append("entityId", entityId)
  return readRentalEnvelope<DuongFile>(
    await apiRequest("/api/files", { method: "POST", body }),
    (v) =>
      object(v) &&
      isUuid(v.id) &&
      text(v.originalName) &&
      v.status === "ACTIVE" &&
      (entityId
        ? v.entityType === entityType && v.entityId === entityId
        : v.entityType === "DUONG_SUPPORT_UPLOAD" && v.entityId === actor?.id),
  )
}
export function downloadDuongEvidence(id: string) {
  requireId(id)
  return apiDownload(`/api/files/${id}`)
}
export function integrationError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 403)
      return "Bạn không có quyền thực hiện thao tác này."
    if (error.status === 404)
      return "Chưa có dữ liệu, chức năng chưa được bật hoặc hồ sơ không thuộc quyền truy cập."
    if (error.status === 409)
      return "Dữ liệu đã thay đổi hoặc chưa đủ điều kiện xử lý. Kiểm tra lại hồ sơ trước khi tiếp tục."
    if (error.status === null || error.status >= 500)
      return "Chưa xác định được kết quả. Hãy thử lại cùng nội dung, không tạo yêu cầu khác."
  }
  return "Không thể xử lý yêu cầu. Vui lòng kiểm tra thông tin và thử lại."
}
