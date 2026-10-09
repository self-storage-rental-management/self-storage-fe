import type { ApiActor } from "../src/services/authApi"
import type {
  RenewalOperationEvent,
  RenewalOperationState,
  RenewalPayableStatement,
} from "../src/types/renewalOperationsApi"
import type {
  OverdueCase,
  OverdueFollowUp,
  OverduePage,
} from "../src/types/overdueApi"

// Isolated transport fixtures; never inserted into shared store/localStorage/DB.
export const ids = {
  renewal: "11111111-1111-1111-1111-111111111111",
  rental: "22222222-2222-2222-2222-222222222222",
  facility: "33333333-3333-3333-3333-333333333333",
  customer: "44444444-4444-4444-4444-444444444444",
  staff: "55555555-5555-5555-5555-555555555555",
  manager: "66666666-6666-6666-6666-666666666666",
  event: "77777777-7777-7777-7777-777777777777",
  file: "88888888-8888-8888-8888-888888888888",
  statement: "99999999-9999-9999-9999-999999999999",
  obligation: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
}
export const instant = "2026-10-08T03:00:00Z"
export const operationState: RenewalOperationState = {
  renewalId: ids.renewal,
  expectedVersion: 4,
  phase: "AWAITING_DEPOSIT",
  depositPaymentRef: null,
  depositPaidAt: null,
  originalSigningDeadline: null,
  effectiveSigningDeadline: null,
  recoveryCutoff: null,
  appointmentRef: null,
  appointmentStart: null,
  appointmentEnd: null,
  arrivalRef: null,
  confirmedExceptionRef: null,
  pendingExceptionRef: null,
  completedBy: null,
  completedAt: null,
  missingSources: [],
}
export const signingState: RenewalOperationState = {
  ...operationState,
  phase: "SIGNING",
  depositPaymentRef: ids.event,
  depositPaidAt: instant,
  originalSigningDeadline: "2026-10-11T03:00:00Z",
  effectiveSigningDeadline: "2026-10-11T03:00:00Z",
  recoveryCutoff: "2026-10-12T03:00:00Z",
  appointmentRef: ids.event,
  appointmentStart: "2026-10-09T03:00:00Z",
  appointmentEnd: "2026-10-09T04:00:00Z",
}
export const operationEvent: RenewalOperationEvent = {
  id: ids.event,
  kind: "DEPOSIT",
  occurredAt: instant,
  actorId: ids.customer,
  data: {
    paymentRef: ids.event,
    renewalId: ids.renewal,
    outcome: "SUCCESS",
    amount: 3201000,
    currency: "VND",
    paidAt: instant,
  },
}
export const payableStatement: RenewalPayableStatement = {
  reference: ids.statement,
  renewalId: ids.renewal,
  version: "financial-v1",
  expiresAt: "2026-10-10T03:00:00Z",
  amount: 12804000,
  currency: "VND",
  requiredObligations: [ids.obligation],
}
export const termCase: OverdueCase = {
  caseRef: `RENTAL_TERM:${ids.rental}`,
  rentalId: ids.rental,
  facilityId: ids.facility,
  customerId: ids.customer,
  customerName: "Customer fixture",
  storageUnitCode: "A-01",
  kind: "RENTAL_TERM",
  overdueDays: 9,
  priority: "RECOVERY",
  obligationRef: null,
  dueAt: null,
  outstanding: null,
  currency: null,
  policyRef: "term-policy",
  policyVersion: "v1",
  recoveryCutoff: instant,
  recoveryEligible: true,
  followUpVersion: 2,
}
export const debtCase: OverdueCase = {
  ...termCase,
  caseRef: `PAYMENT_DUE:${ids.rental}:${ids.obligation}`,
  kind: "PAYMENT_DUE",
  priority: "PAYMENT_DUE",
  obligationRef: ids.obligation,
  dueAt: instant,
  outstanding: 5500000,
  currency: "VND",
  policyRef: null,
  policyVersion: null,
  recoveryCutoff: null,
  recoveryEligible: false,
}
export const followUp: OverdueFollowUp = {
  id: ids.event,
  caseRef: termCase.caseRef,
  type: "NOTE",
  content: "Theo dõi hồ sơ",
  actorId: ids.manager,
  recordedAt: instant,
  externalRef: null,
  policyRef: null,
  policyVersion: null,
  followUpVersion: 3,
}
export const apiPage = <T>(data: T[]) => ({
  data,
  pagination: {
    page: 0,
    pageSize: 20,
    totalItems: data.length,
    totalPages: data.length ? 1 : 0,
    sort: "id,asc",
  },
  correlationId: "test-correlation",
})
export const overduePage: OverduePage = {
  ...apiPage([termCase, debtCase]),
  asOf: instant,
  completeness: "COMPLETE",
  missingSources: [],
}
export function operationsActor(
  role: "customer" | "manager" | "staff",
): ApiActor {
  return {
    id: ids[role],
    email: `${role}@example.test`,
    fullName: "Actor fixture",
    phone: null,
    permanentAddress: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    avatarUrl: null,
    status: "ACTIVE",
    roles: [role.toUpperCase() as "CUSTOMER" | "MANAGER" | "STAFF"],
    facilityScopes: {
      [ids.facility]: role === "manager" ? "MANAGE" : "OPERATE",
    },
    mustChangePassword: false,
    permissions: ["rentals:read", "rentals:update"],
  }
}
