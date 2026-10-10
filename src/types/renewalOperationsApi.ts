import type { RentalApiPage } from "./rentalApi"

export type RenewalOperationsRole = "customer" | "manager" | "staff"
export type RenewalOperationsPhase = "UNKNOWN" | "AWAITING_DEPOSIT" | "SIGNING" | "SIGNING_EXPIRY_PENDING" | "SIGNING_EXPIRED" | "PAYMENT_EXPIRED" | "COMPLETED"
export interface RenewalOperationState {
  renewalId: string
  expectedVersion: number | null
  phase: RenewalOperationsPhase
  depositPaymentRef: string | null
  depositPaidAt: string | null
  originalSigningDeadline: string | null
  effectiveSigningDeadline: string | null
  recoveryCutoff: string | null
  appointmentRef: string | null
  appointmentStart: string | null
  appointmentEnd: string | null
  arrivalRef: string | null
  confirmedExceptionRef: string | null
  pendingExceptionRef: string | null
  completedBy: string | null
  completedAt: string | null
  missingSources: string[]
}
export interface RenewalOperationEvent {
  id: string
  kind: "DEPOSIT" | "CASH" | "APPOINTMENT" | "ARRIVAL" | "INCIDENT" | "FAULT_REVIEW" | "STAFF_ASSIGNMENT" | "EXCEPTION" | "CONFIRMATION" | "REFUND" | "COMPLETION" | "EXPIRY"
  occurredAt: string
  actorId: string | null
  data: unknown
}
export interface RenewalExceptionProposal {
  renewalId: string
  expectedVersion: number | null
  decisionRef: string | null
  status: "NONE" | "AVAILABLE" | "UNAVAILABLE"
  checkedAt: string
  currentAppointmentStart: string | null
  currentAppointmentEnd: string | null
  currentSigningDeadline: string | null
  proposedAppointmentStart: string | null
  proposedAppointmentEnd: string | null
  proposedSigningDeadline: string | null
  validUntil: string | null
  confirmationAllowed: boolean
  disabledReasons: string[]
}
export interface RenewalOperationResult {
  state: RenewalOperationState
  event: RenewalOperationEvent
}
export interface RenewalPayableStatement {
  reference: string
  renewalId: string
  version: string
  expiresAt: string
  amount: number
  currency: "VND"
  requiredObligations: string[]
}
export type RenewalExceptionAction = "APPROVE_RESCHEDULE_BEFORE_CUTOFF" | "REQUEST_POST_CUTOFF_REVIEW" | "REJECT"
type Version = { expectedVersion: number }
type Evidence = { evidenceFileIds: string[] }
export type RenewalOperationCommand = {
  action: "deposit"
  body: Version
} | {
  action: "appointment" | "reschedule"
  body: Version & {
    appointmentAt: string
    reason?: string
  }
} | {
  action: "confirmation"
  body: Version & { decisionRef: string }
} | {
  action: "arrival"
  body: Version & Evidence & { appointmentRef: string }
} | {
  action: "incident"
  body: Version & Evidence & {
    appointmentRef: string
    reason: string
  }
} | {
  action: "cash"
  body: Version & {
    payableStatementRef: string
    receiptReference: string
    received: true
  }
} | {
  action: "completion"
  body: Version & {
    identityVerified: true
    arrivalRef: string
    signedDocumentFileId: string
    completionNote?: string
  }
} | {
  action: "exception"
  body: Version & Evidence & {
    incidentId: string
    action: RenewalExceptionAction
    appointmentAt?: string
    revisedDeadline?: string
    reason: string
  }
} | {
  action: "refund"
  body: Version & Evidence & {
    incidentId: string
    decision: "APPROVE" | "REJECT"
    reason: string
  }
}
export type RenewalOperationAction = RenewalOperationCommand["action"]
export interface RenewalAppointmentQuery {
  page?: number
  size?: number
  facilityId?: string
  date?: string
  status?: "SIGNING" | "SIGNING_EXPIRED" | "COMPLETED"
}
export type RenewalOperationPage<T> = RentalApiPage<T>
