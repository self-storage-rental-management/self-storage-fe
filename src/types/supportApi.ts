import type { RentalApiPage } from "./rentalApi"

export const supportStatuses = [
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
] as const
export const supportModules = [
  "PAYMENT",
  "RETURN_SETTLEMENT",
  "MAINTENANCE",
  "HANDOVER",
  "ACCOUNT",
  "RENEWAL",
  "OVERDUE",
] as const
export type SupportRole = "customer" | "manager" | "staff"
export type SupportStatus = typeof supportStatuses[number]
export type SupportModule = typeof supportModules[number]
export type SupportLinkType = "RENTAL" | "RESERVATION" | "PAYMENT" | "STORAGE_UNIT"
export type SupportVisibility = "PUBLIC" | "INTERNAL"
export interface SupportTicket {
  id: string
  customerId: string
  facilityId: string | null
  assignedStaffId: string | null
  status: SupportStatus
  subject: string
  description: string
  createdAt: string
  version: number | null
  assignmentRevision: number | null
  assignedAt: string | null
  acceptedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  resolvedBy: string | null
  parentTicketId: string | null
  linkedType: SupportLinkType | null
  linkedId: string | null
  workflowReady: boolean
  slaCompleteness: "COMPLETE" | "UNKNOWN"
  sla: {
    priority: "HIGH" | "MEDIUM" | "LOW"
    policyRef: string
    policyVersion: string
    firstReplyDueAt: string | null
    nextUpdateDueAt: string | null
    activeWorkPaused: boolean
  } | null
  missingSourceReason: string | null
}
export interface SupportMessage {
  id: string
  ticketId: string
  authorId: string
  authorRole: "CUSTOMER" | "STAFF"
  visibility: SupportVisibility
  body: string
  sentAt: string
  evidenceCompleteness: "COMPLETE" | "UNKNOWN"
  evidenceFileIds: string[] | null
}
export interface SupportEvent {
  id: string
  type: string
  actorId: string | null
  assignedStaffId: string | null
  assignmentRevision: number
  reason: string
  recordedAt: string
}
export interface SupportEscalation {
  id: string
  ticketId: string
  targetModule: SupportModule
  status: "REQUESTED" | "ROUTED" | "REJECTED"
  reason: string
  decisionReason: string | null
  receiverRef: string | null
  receiverStatus: "ACKNOWLEDGED" | "REJECTED" | "COMPLETED" | null
  resultRef: string | null
  resultCompleteness: "COMPLETE" | "UNKNOWN"
  requestedAt: string
  decidedAt: string | null
}
export interface SupportStaffOption {
  id: string
  fullName: string
}
export type SupportPage<T> = RentalApiPage<T>
export interface SupportQuery {
  page?: number
  size?: number
  status?: SupportStatus
  search?: string
  sort?: string
  facilityId?: string
  staffId?: string
}
export interface SupportCreate {
  subject: string
  description: string
  facilityId?: string
  linkedRecord?: {
    type: SupportLinkType
    id: string
  }
  evidenceFileIds?: string[]
}
type Versioned = { expectedVersion: number }
type Evidence = { evidenceFileIds?: string[] }
export type SupportCommand = {
  kind: "assign"
  assignedStaffId: string
  reason: string
} & Versioned | { kind: "accept" } & Versioned | {
  kind: "message"
  body: string
  visibility?: never
  expectedVersion?: number
} & Evidence | {
  kind: "message"
  body: string
  visibility: SupportVisibility
  expectedVersion?: never
} & Evidence | {
  kind: "information"
  message: string
} & Versioned & Evidence | {
  kind: "resolve"
  summary: string
} & Versioned & Evidence | {
  kind: "close"
  feedback?: string
} & Versioned | {
  kind: "reopen"
  reason: string
} & Versioned | {
  kind: "escalate"
  targetModule: SupportModule
  reason: string
} & Versioned & Evidence | {
  kind: "decision"
  escalationId: string
  action: "ROUTE" | "REJECT"
  reason: string
} & Versioned
