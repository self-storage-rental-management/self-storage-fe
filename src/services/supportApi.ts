import { ApiClientError, apiRequest } from "./apiClient"
import { isInstant, isUuid, isVersion } from "./renewalOperationsApi"
import { supportModules, supportStatuses } from "../types/supportApi"
import type {
  SupportCommand,
  SupportCreate,
  SupportEscalation,
  SupportEvent,
  SupportMessage,
  SupportPage,
  SupportQuery,
  SupportQueueItem,
  SupportRole,
  SupportStaffOption,
  SupportTicket,
  StaffSupportInboxView,
  StaffSupportInboxRow,
  StaffSupportInboxPage,
} from "../types/supportApi"

const links = ["RENTAL", "RESERVATION", "PAYMENT", "STORAGE_UNIT"]
const nullable = (v: unknown, valid: (value: unknown) => boolean) =>
  v === null || valid(v)
const string = (v: unknown): v is string => typeof v === "string"
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)
const inList = (v: unknown, list: readonly string[]) =>
  string(v) && list.includes(v)
function invalid(): never {
  throw new ApiClientError("Phản hồi Hỗ trợ không đúng API contract D5.", {
    code: "INVALID_RESPONSE",
  })
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new ApiClientError(message, {
      status: 400,
      code: "CLIENT_VALIDATION",
    })
}
function strictKeys(value: object, keys: string[]) {
  check(
    Object.keys(value).every((k) => keys.includes(k)),
    "Trường yêu cầu Hỗ trợ không được hỗ trợ.",
  )
}
function text(value: unknown, limit: number) {
  check(
    string(value) && !!value.trim() && value.length <= limit,
    `Nội dung phải có từ 1 đến ${limit} ký tự.`,
  )
}
function files(value: unknown) {
  check(
    value === undefined ||
      (Array.isArray(value) &&
        value.length <= 10 &&
        value.every(isUuid) &&
        new Set(value).size === value.length),
    "Minh chứng phải là tối đa 10 mã file riêng biệt.",
  )
}
function keyValid(key: string) {
  text(key, 100)
}
function rolePath(role: SupportRole) {
  check(
    inList(role, ["customer", "manager", "staff"]),
    "Role Hỗ trợ không hợp lệ.",
  )
  // The shared Customer/Staff ticket APIs have different DTOs and command rules.
  // Keep D5 transport separate; never fall back to those endpoints on an error.
  return role === "manager"
    ? "/api/manager/support-tickets"
    : `/api/${role}/support-workflows`
}
export async function hideCustomerSupportHistory(id: string) {
  check(isUuid(id), 'Mã hội thoại không hợp lệ.')
  return envelope(await apiRequest(`${rolePath('customer')}/${id}/history`, { method: 'DELETE' }),
    (value): value is { ticketId: string; hidden: true } => {
      const result = value as { ticketId?: unknown; hidden?: unknown } | null
      return !!result && result.ticketId === id && result.hidden === true
    })
}
function path(role: SupportRole, id: string) {
  check(isUuid(id), "Mã yêu cầu Hỗ trợ không hợp lệ.")
  return `${rolePath(role)}/${encodeURIComponent(id)}`
}

export function isSupportTicket(value: unknown): value is SupportTicket {
  const r = value as SupportTicket | null
  if (
    !r ||
    !(r.displayCode == null || (typeof r.displayCode === "string" && /^SH-\d{6}$/.test(r.displayCode))) ||
    !isUuid(r.id) ||
    !isUuid(r.customerId) ||
    !(r.customerName === undefined || nullable(r.customerName, string)) ||
    !nullable(r.facilityId, isUuid) ||
    !nullable(r.assignedStaffId, isUuid) ||
    !(r.assignedStaffName === undefined || nullable(r.assignedStaffName, string)) ||
    !inList(r.status, supportStatuses) ||
    !string(r.subject) ||
    !string(r.description) ||
    !isInstant(r.createdAt) ||
    typeof r.workflowReady !== "boolean"
  )
    return false
  if (
    ![r.version, r.assignmentRevision].every((v) => nullable(v, isVersion)) ||
    ![r.assignedAt, r.acceptedAt, r.resolvedAt, r.closedAt].every((v) =>
      nullable(v, isInstant),
    ) ||
    ![r.resolvedBy, r.parentTicketId, r.linkedId].every((v) =>
      nullable(v, isUuid),
    ) ||
    !nullable(r.linkedType, (v) => inList(v, links)) ||
    !nullable(r.missingSourceReason, string)
  )
    return false
  if (
    (r.linkedId === null) !== (r.linkedType === null) ||
    (r.workflowReady &&
      (!isVersion(r.version) || !isVersion(r.assignmentRevision))) ||
    (!r.workflowReady && (r.version !== null || r.assignmentRevision !== null))
  )
    return false
  if (r.slaCompleteness === "UNKNOWN")
    return (
      r.sla === null && string(r.missingSourceReason) && !!r.missingSourceReason
    )
  const s = r.sla
  return (
    r.slaCompleteness === "COMPLETE" &&
    !!s &&
    inList(s.priority, ["HIGH", "MEDIUM", "LOW"]) &&
    string(s.policyRef) &&
    !!s.policyRef &&
    string(s.policyVersion) &&
    !!s.policyVersion &&
    nullable(s.firstReplyDueAt, isInstant) &&
    nullable(s.nextUpdateDueAt, isInstant) &&
    s.activeWorkPaused === (r.status === "waiting_customer")
  )
}
export function isSupportMessage(value: unknown): value is SupportMessage {
  const m = value as SupportMessage | null
  return (
    !!m &&
    [m.id, m.ticketId, m.authorId].every(isUuid) &&
    inList(m.authorRole, ["CUSTOMER", "STAFF", "MANAGER", "AI_CONTEXT", "USER_CONTEXT"]) &&
    inList(m.visibility, ["PUBLIC", "INTERNAL"]) &&
    string(m.body) &&
    isInstant(m.sentAt) &&
    (m.evidenceCompleteness === "UNKNOWN"
      ? m.evidenceFileIds === null
      : m.evidenceCompleteness === "COMPLETE" &&
        Array.isArray(m.evidenceFileIds) &&
        m.evidenceFileIds.length <= 10 &&
        m.evidenceFileIds.every(isUuid) &&
        new Set(m.evidenceFileIds).size === m.evidenceFileIds.length)
  )
}
export function isSupportEvent(value: unknown): value is SupportEvent {
  const e = value as SupportEvent | null
  return (
    !!e &&
    isUuid(e.id) &&
    string(e.type) &&
    !!e.type &&
    nullable(e.actorId, isUuid) &&
    nullable(e.assignedStaffId, isUuid) &&
    isVersion(e.assignmentRevision) &&
    string(e.reason) &&
    isInstant(e.recordedAt)
  )
}
export function isSupportEscalation(
  value: unknown,
): value is SupportEscalation {
  const e = value as SupportEscalation | null
  return (
    !!e &&
    isUuid(e.id) &&
    isUuid(e.ticketId) &&
    inList(e.targetModule, supportModules) &&
    inList(e.status, ["REQUESTED", "ROUTED", "REJECTED"]) &&
    string(e.reason) &&
    nullable(e.decisionReason, string) &&
    nullable(e.receiverRef, isUuid) &&
    nullable(e.receiverStatus, (v) =>
      inList(v, ["ACKNOWLEDGED", "REJECTED", "COMPLETED"]),
    ) &&
    nullable(e.resultRef, isUuid) &&
    inList(e.resultCompleteness, ["COMPLETE", "UNKNOWN"]) &&
    isInstant(e.requestedAt) &&
    nullable(e.decidedAt, isInstant) &&
    (e.receiverStatus !== "COMPLETED" || isUuid(e.resultRef)) &&
    (e.receiverStatus === null || isUuid(e.receiverRef))
  )
}
function envelope<T>(value: unknown, validate: (v: unknown) => v is T): T {
  if (!record(value) || !validate(value.data)) return invalid()
  return value.data
}
function page<T>(
  value: unknown,
  validate: (v: unknown) => boolean,
  expected = 0,
): SupportPage<T> {
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    !value.data.every(validate) ||
    !record(value.pagination)
  )
    return invalid()
  const p = value.pagination
  if (
    ![p.page, p.totalItems, p.totalPages].every(isVersion) ||
    !isVersion(p.pageSize) ||
    p.pageSize < 1 ||
    p.pageSize > 100 ||
    p.page !== expected ||
    p.totalPages !== Math.ceil(Number(p.totalItems) / p.pageSize) ||
    value.data.length > p.pageSize ||
    value.data.length > Number(p.totalItems) ||
    !string(p.sort)
  )
    return invalid()
  return value as unknown as SupportPage<T>
}
function queryString(query: SupportQuery, manager = false, timeline = false, customerList = false) {
  const allowed = timeline
    ? ["page", "size"]
    : [
        "page",
        "size",
        "status",
        "search",
        "sort",
        ...(customerList ? ["facilityId"] : []),
        ...(manager ? ["facilityId", "staffId"] : []),
      ]
  strictKeys(query, allowed)
  const p = query.page ?? 0,
    size = query.size ?? 20
  check(
    isVersion(p) &&
      isVersion(size) &&
      size >= 1 &&
      size <= 100 &&
      p * size <= 2147483647,
    "Phân trang không hợp lệ.",
  )
  if (query.status !== undefined)
    check(
      inList(query.status, supportStatuses),
      "Trạng thái Hỗ trợ không hợp lệ.",
    )
  if (query.search !== undefined)
    check(
      string(query.search) && query.search.trim().length <= 200,
      "Tìm kiếm tối đa 200 ký tự.",
    )
  for (const id of [query.facilityId, query.staffId])
    if (id !== undefined) check(isUuid(id), "Mã bộ lọc không hợp lệ.")
  if (query.sort !== undefined)
    check(
      /^(createdAt|updatedAt|id|subject),(asc|desc)$/.test(query.sort),
      "Sắp xếp không hợp lệ.",
    )
  const params = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v).trim())
  })
  return params.size ? `?${params}` : ""
}
export async function listSupportTickets(
  role: SupportRole,
  query: SupportQuery = {},
) {
  return page<SupportTicket>(
    await apiRequest(
      `${rolePath(role)}${queryString(query, role === "manager", false, role === "customer")}`,
    ),
    isSupportTicket,
    query.page ?? 0,
  )
}
function isSupportQueueItem(v: unknown) {
  return record(v) && isUuid(v.id) && isUuid(v.facilityId) &&
      string(v.subject) && isInstant(v.createdAt) && isVersion(v.version) &&
      (v.displayCode == null || (string(v.displayCode) && /^SH-\d{6}$/.test(v.displayCode))) &&
      Object.keys(v).every((key) => ["id", "facilityId", "subject", "createdAt", "version", "displayCode"].includes(key))
}
export async function listSupportQueue(query: SupportQuery = {}) {
  const value = await apiRequest(`${rolePath("staff")}/queue${queryString(query)}`)
  return page<SupportQueueItem>(value, isSupportQueueItem,
    query.page ?? 0,
  )
}
export async function listStaffSupportInbox(view: StaffSupportInboxView, currentPage = 0): Promise<StaffSupportInboxPage> {
  check(['queue', 'mine', 'all', 'history'].includes(view), 'Nhóm hội thoại không hợp lệ.')
  const paging = queryString({ page: currentPage, size: 20 }, false, true)
  const value = await apiRequest<unknown>(`${rolePath('staff')}/inbox${paging}&view=${view}`)
  const result = page<StaffSupportInboxRow>(value, row => record(row) && isVersion(row.historyCount) && isInstant(row.lastActivityAt) &&
    ((row.queued === null && isSupportTicket(row.ticket)) || (row.ticket === null && isSupportQueueItem(row.queued))), currentPage)
  if (!record(value) || !record(value.counts) || !['queue', 'mine', 'all', 'history'].every(key => isVersion((value.counts as Record<string, unknown>)[key]))) return invalid()
  return { ...result, counts: value.counts as StaffSupportInboxPage['counts'] }
}
export async function listRelatedStaffConversations(id: string, currentPage = 0) {
  return page<SupportTicket>(await apiRequest(`${path('staff', id)}/related${queryString({ page: currentPage, size: 20 }, false, true)}`), isSupportTicket, currentPage)
}
export async function getSupportSummary(facilityId: string) {
  check(isUuid(facilityId), "Cơ sở không hợp lệ.")
  return envelope(await apiRequest(`${rolePath("manager")}/summary?facilityId=${encodeURIComponent(facilityId)}`),
    (v): v is { counts: Record<string, number>; unassignedOpen: number } =>
      record(v) && record(v.counts) && supportStatuses.every((status) => isVersion((v.counts as Record<string, unknown>)[status])) &&
      isVersion(v.unassignedOpen))
}
export async function getSupportTicket(role: SupportRole, id: string) {
  return envelope(
    await apiRequest(path(role, id)),
    (v): v is SupportTicket => isSupportTicket(v) && v.id === id,
  )
}
export async function listSupportMessages(
  role: SupportRole,
  id: string,
  p = 0,
  size = 20,
  visibility?: "PUBLIC" | "INTERNAL",
) {
  check(role !== "customer" || visibility !== "INTERNAL", "Trao đổi nội bộ chỉ dành cho nhân viên và quản lý.")
  const route = role !== "customer" && visibility ? visibility === "INTERNAL" ? "internal-messages" : "public-messages" : "messages"
  return page<SupportMessage>(
    await apiRequest(
      `${path(role, id)}/${route}${queryString({ page: p, size }, false, true)}`,
    ),
    (v) =>
      isSupportMessage(v) &&
      v.ticketId === id &&
      (role !== "customer" || v.visibility === "PUBLIC") && (!visibility || v.visibility === visibility),
    p,
  )
}
export async function listSupportEvents(
  role: SupportRole,
  id: string,
  p = 0,
  size = 20,
) {
  check(role !== "customer", "Customer không được đọc lịch sử nội bộ.")
  return page<SupportEvent>(
    await apiRequest(
      `${path(role, id)}/events${queryString({ page: p, size }, false, true)}`,
    ),
    isSupportEvent,
    p,
  )
}
export async function listSupportEscalations(
  role: SupportRole,
  id: string,
  p = 0,
  size = 20,
) {
  check(role !== "customer", "Customer không được đọc escalation nội bộ.")
  return page<SupportEscalation>(
    await apiRequest(
      `${path(role, id)}/escalations${queryString({ page: p, size }, false, true)}`,
    ),
    (v) => isSupportEscalation(v) && v.ticketId === id,
    p,
  )
}
export async function listSupportStaff(facilityId: string, p = 0, size = 20) {
  check(isUuid(facilityId), "Cơ sở không hợp lệ.")
  const q = new URLSearchParams(
    queryString({ page: p, size }, false, true).slice(1),
  )
  q.set("facilityId", facilityId)
  return page<SupportStaffOption>(
    await apiRequest(`${rolePath("manager")}/staff-options?${q}`),
    (v) => record(v) && isUuid(v.id) && string(v.fullName),
    p,
  )
}
export async function createSupportTicket(
  body: SupportCreate,
  key: string,
  parentId?: string,
) {
  strictKeys(body, [
    "subject",
    "description",
    "facilityId",
    "linkedRecord",
    "evidenceFileIds",
    "handoffMessages",
  ])
  text(body.subject, 200)
  text(body.description, 4000)
  if (body.handoffMessages !== undefined) {
    check(Array.isArray(body.handoffMessages) && body.handoffMessages.length <= 200, "Lịch sử chuyển tiếp vượt giới hạn 200 tin nhắn.")
    for (const message of body.handoffMessages) {
      strictKeys(message, ['role', 'body'])
      check(inList(message.role, ['CUSTOMER', 'ASSISTANT']), 'Vai trò trong lịch sử không hợp lệ.')
      text(message.body, 4000)
    }
    check(body.handoffMessages.reduce((total, message) => total + message.body.length, 0) <= 200000, 'Lịch sử chuyển tiếp vượt giới hạn cho phép.')
  }
  keyValid(key)
  files(body.evidenceFileIds)
  if (body.facilityId !== undefined)
    check(isUuid(body.facilityId), "Cơ sở không hợp lệ.")
  if (body.linkedRecord) {
    strictKeys(body.linkedRecord, ["type", "id"])
    check(
      inList(body.linkedRecord.type, links) && isUuid(body.linkedRecord.id),
      "Hồ sơ liên kết không hợp lệ.",
    )
  }
  check(
    parentId || body.facilityId || body.linkedRecord,
    "Cần chọn cơ sở hoặc hồ sơ thuộc tài khoản.",
  )
  const url = parentId
    ? `${path("customer", parentId)}/follow-ups`
    : rolePath("customer")
  return envelope(
    await apiRequest(url, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
    (v): v is SupportTicket =>
      isSupportTicket(v) &&
      (parentId === undefined || v.parentTicketId === parentId),
  )
}
export async function sendSupportCommand(
  role: SupportRole,
  id: string,
  command: SupportCommand,
  key: string,
) {
  const base = path(role, id)
  keyValid(key)
  const allowed: Record<SupportRole, string[]> = {
    customer: ["message", "close", "reopen"],
    manager: ["assign", "decision", "message"],
    staff: ["claim", "accept", "message", "information", "resolve", "escalate"],
  }
  check(allowed[role].includes(command.kind), "Thao tác không thuộc role này.")
  const routes = {
    assign: "assignment",
    claim: "claim",
    accept: "accept",
    message: "messages",
    information: "request-information",
    resolve: "resolution",
    close: "close",
    reopen: "reopen",
    escalate: "escalations",
    decision: "decision",
  }
  const fields: Record<SupportCommand["kind"], string[]> = {
    assign: ["assignedStaffId", "reason", "expectedVersion"],
    claim: ["expectedVersion"],
    accept: ["expectedVersion"],
    message: [
      "body",
      "evidenceFileIds",
      ...(role !== "customer" ? ["visibility"] : ["expectedVersion"]),
    ],
    information: ["message", "evidenceFileIds", "expectedVersion"],
    resolve: ["summary", "evidenceFileIds", "expectedVersion", "statusOnly"],
    close: ["feedback", "expectedVersion"],
    reopen: ["reason", "expectedVersion"],
    escalate: ["targetModule", "reason", "evidenceFileIds", "expectedVersion"],
    decision: ["escalationId", "action", "reason", "expectedVersion"],
  }
  strictKeys(command, ["kind", ...fields[command.kind]])
  const { kind, ...payload } = command
  if (kind !== "message")
    check(
      "expectedVersion" in payload && isVersion(payload.expectedVersion),
      "Cần phiên bản hồ sơ mới nhất.",
    )
  if ("expectedVersion" in payload && payload.expectedVersion !== undefined)
    check(isVersion(payload.expectedVersion), "Phiên bản không hợp lệ.")
  if ("evidenceFileIds" in payload) files(payload.evidenceFileIds)
  if ("reason" in payload) text(payload.reason, 2000)
  if ("body" in payload) {
    const hasFiles = "evidenceFileIds" in payload && Array.isArray(payload.evidenceFileIds) && payload.evidenceFileIds.length > 0
    if (!(kind === 'message' && string(payload.body) && payload.body.length <= 4000 && !payload.body.trim() && hasFiles)) text(payload.body, 4000)
  }
  if ("message" in payload) text(payload.message, 4000)
  if (kind === "resolve") {
    const statusOnly = "statusOnly" in payload ? payload.statusOnly : undefined
    check(
      "summary" in payload && string(payload.summary) && payload.summary.length <= 4000 &&
        (statusOnly === true ? !payload.summary.trim() && (!payload.evidenceFileIds || Array.isArray(payload.evidenceFileIds) && payload.evidenceFileIds.length === 0) :
          (statusOnly === undefined || statusOnly === false) && (!!payload.summary.trim() || ("evidenceFileIds" in payload && Array.isArray(payload.evidenceFileIds) && payload.evidenceFileIds.length > 0))),
      "Cần nhập mô tả xử lý hoặc đính kèm minh chứng để gửi cho khách hàng.",
    )
  }
  if ("feedback" in payload && payload.feedback !== undefined)
    check(
      string(payload.feedback) && payload.feedback.length <= 2000,
      "Phản hồi tối đa 2000 ký tự.",
    )
  if (kind === "message" && role !== "customer")
    check(
      "visibility" in payload &&
        inList(payload.visibility, ["PUBLIC", "INTERNAL"]),
      "Cần chọn công khai hoặc nội bộ.",
    )
  if (kind === "message" && role === "manager")
    check("visibility" in payload && payload.visibility === "INTERNAL", "Manager chỉ được gửi trao đổi nội bộ.")
  if (kind === "assign")
    check(
      "assignedStaffId" in payload && isUuid(payload.assignedStaffId),
      "Bắt buộc chọn Staff theo mã.",
    )
  if (kind === "escalate")
    check(
      "targetModule" in payload && inList(payload.targetModule, supportModules),
      "Module không hợp lệ.",
    )
  let route: string = routes[kind]
  if (command.kind === "decision") {
    check(
      isUuid(command.escalationId) &&
        inList(command.action, ["ROUTE", "REJECT"]),
      "Quyết định escalation không hợp lệ.",
    )
    route = `escalations/${encodeURIComponent(command.escalationId)}/decision`
    delete (payload as Record<string, unknown>).escalationId
  }
  // Never forward the transport discriminant or UI-only fields to strict BE DTOs.
  const value = await apiRequest(`${base}/${route}`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(payload),
  })
  if (kind === "message")
    return envelope(
      value,
      (v): v is SupportMessage =>
        isSupportMessage(v) &&
        v.ticketId === id &&
        (role !== "customer" || v.visibility === "PUBLIC"),
    )
  if (kind === "escalate" || kind === "decision")
    return envelope(
      value,
      (v): v is SupportEscalation =>
        isSupportEscalation(v) &&
        v.ticketId === id &&
        (command.kind !== "decision" || v.id === command.escalationId),
    )
  return envelope(
    value,
    (v): v is SupportTicket => isSupportTicket(v) && v.id === id,
  )
}
