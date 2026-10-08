// Isolated D5 contract fixtures. Never imported by runtime views/services.
import type { ApiActor } from "../src/services/authApi"
import type {
  SupportEscalation,
  SupportEvent,
  SupportMessage,
  SupportPage,
  SupportRole,
  SupportTicket,
} from "../src/types/supportApi"
export const supportIds = {
  ticket: "00000000-0000-0000-0000-000000000001",
  customer: "00000000-0000-0000-0000-000000000002",
  manager: "00000000-0000-0000-0000-000000000003",
  staff: "00000000-0000-0000-0000-000000000004",
  facility: "00000000-0000-0000-0000-000000000005",
  message: "00000000-0000-0000-0000-000000000006",
  escalation: "00000000-0000-0000-0000-000000000007",
  foreign: "00000000-0000-0000-0000-000000000008",
}
export const supportInstant = "2026-10-08T03:00:00Z"
export const supportTicket: SupportTicket = {
  id: supportIds.ticket,
  customerId: supportIds.customer,
  facilityId: supportIds.facility,
  assignedStaffId: null,
  status: "open",
  subject: "Test-only Support",
  description: "H2/FE fixture, not runtime data",
  createdAt: supportInstant,
  version: 0,
  assignmentRevision: 0,
  assignedAt: null,
  acceptedAt: null,
  resolvedAt: null,
  closedAt: null,
  resolvedBy: null,
  parentTicketId: null,
  linkedType: null,
  linkedId: null,
  workflowReady: true,
  slaCompleteness: "UNKNOWN",
  sla: null,
  missingSourceReason: "DEFERRED_SOURCE: shared Support priority/SLA/calendar",
}
export const supportActive: SupportTicket = {
  ...supportTicket,
  status: "in_progress",
  version: 2,
  assignmentRevision: 1,
  assignedStaffId: supportIds.staff,
  assignedAt: supportInstant,
  acceptedAt: supportInstant,
}
export const supportMessage: SupportMessage = {
  id: supportIds.message,
  ticketId: supportIds.ticket,
  authorId: supportIds.customer,
  authorRole: "CUSTOMER",
  visibility: "PUBLIC",
  body: "Test-only message",
  sentAt: supportInstant,
  evidenceCompleteness: "COMPLETE",
  evidenceFileIds: [],
}
export const supportEvent: SupportEvent = {
  id: supportIds.message,
  type: "CREATED",
  actorId: supportIds.customer,
  assignedStaffId: null,
  assignmentRevision: 0,
  reason: "Test-only creation",
  recordedAt: supportInstant,
}
export const supportEscalation: SupportEscalation = {
  id: supportIds.escalation,
  ticketId: supportIds.ticket,
  targetModule: "PAYMENT",
  status: "REQUESTED",
  reason: "Test-only coordination",
  decisionReason: null,
  receiverRef: null,
  receiverStatus: null,
  resultRef: null,
  resultCompleteness: "UNKNOWN",
  requestedAt: supportInstant,
  decidedAt: null,
}
export function supportPage<T>(data: T[], page = 0): SupportPage<T> {
  return {
    data,
    pagination: {
      page,
      pageSize: 20,
      totalItems: data.length,
      totalPages: data.length ? 1 : 0,
      sort: "createdAt,desc",
    },
    correlationId: "test-only",
  }
}
export function supportActor(role: SupportRole): ApiActor {
  return {
    id: supportIds[role],
    email: `${role}@test.invalid`,
    fullName: role,
    phone: null,
    permanentAddress: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    avatarUrl: null,
    status: "ACTIVE",
    roles: [
      role === "customer"
        ? "CUSTOMER"
        : role === "manager"
          ? "MANAGER"
          : "STAFF",
    ],
    facilityScopes:
      role === "customer"
        ? {}
        : { [supportIds.facility]: role === "manager" ? "MANAGE" : "OPERATE" },
    mustChangePassword: false,
    permissions: role === "customer" ? [] : ["view_support", "manage_support"],
  }
}
