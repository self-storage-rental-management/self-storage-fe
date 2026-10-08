import type { RentalApiPage } from "./rentalApi"

export interface OverdueCase {
  caseRef: string
  rentalId: string
  facilityId: string
  customerId: string
  customerName: string
  storageUnitCode: string
  kind: "RENTAL_TERM" | "PAYMENT_DUE"
  overdueDays: number
  priority: "WARNING" | "SERIOUS" | "URGENT" | "RECOVERY" | "PAYMENT_DUE"
  obligationRef: string | null
  dueAt: string | null
  outstanding: number | null
  currency: string | null
  policyRef: string | null
  policyVersion: string | null
  recoveryCutoff: string | null
  recoveryEligible: boolean
  followUpVersion: number
}
export interface OverduePage extends RentalApiPage<OverdueCase> {
  asOf: string
  completeness: "COMPLETE" | "PARTIAL"
  missingSources: string[]
}
export interface OverdueFollowUp {
  id: string
  caseRef: string
  type: "NOTE" | "REMINDER" | "RECOVERY_HANDOFF"
  content: string
  actorId: string
  recordedAt: string
  externalRef: string | null
  policyRef: string | null
  policyVersion: string | null
  followUpVersion: number
}
export interface OverdueQuery {
  page?: number
  size?: number
  facilityId?: string
  kind?: "ALL" | "PAYMENT_DUE" | "RENTAL_TERM"
  search?: string
  sort?: string
}
