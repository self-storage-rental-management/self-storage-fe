import type { RentalApiRecord } from "./rentalApi"
import type { ApiRenewalStatus } from './statusContracts'
export type RenewalApiStatus = ApiRenewalStatus
export type RenewalApiAction = "CANCEL" | "ACCEPT_REVISED_QUOTE"
export interface RenewalApiRecord {
  displayCode?: string | null
  id: string
  rentalId: string
  customer: RentalApiRecord["customer"]
  facility: RentalApiRecord["facility"]
  storageUnit: RentalApiRecord["storageUnit"]
  status: RenewalApiStatus
  reviewState: "READY" | "AWAITING_CUSTOMER_CONFIRMATION" | "UNKNOWN"
  oldEndDate: string | null
  newEndDate: string
  amount: number
  currency: string
  createdAt: string
  version: number | null
  requestedBy: string | null
  acceptedQuoteId: string | null
  acceptedRevision: number | null
  reviewerId: string | null
  reviewedAt: string | null
  reviewReason: string | null
  approvedPaymentDeadline: string | null
  extensionHoldRef: string | null
  financialCheck: {
    completeness: string
    checkedAt: string | null
    blockingObligationRefs: string[] | null
    hasUnresolvedDispute: boolean | null
  }
  systemVerification?: {
    status: "VERIFIED" | "BLOCKED" | "INCOMPLETE" | "UNKNOWN"
    checkedAt: string | null
    verifiedChecks: string[]
    blockingReasons: string[]
  } | null
  allowedActions: RenewalApiAction[]
  disabledReasons: string[]
  acceptedTerms?: Omit<RenewalApiQuote, "id" | "rentalId" | "customerId" | "quotedAt" | "expiresAt"> | null
  cancellationReason?: string | null
}
export interface RenewalApiOption {
  pricingPackageCode: string
  pricingPackageName?: string | null
  rentalMonths: number
}
export interface RenewalVnpayPaymentResponse {
  paymentId: string
  renewalId: string
  acceptedRevisionId: string | null
  transactionReference: string
  amount: number
  currency: "VND"
  paymentStatus: "PENDING" | "PROCESSING" | "PAID" | "NOT_RECEIVED" | "FAILED" | "CANCELLED"
  paymentDeadline: string | null
  paidAt: string | null
  reconciliationRequired: boolean
  message: string
  paymentUrl: string | null
  invoiceNumber: string | null
  invoiceStatus: "DRAFT" | "PAID" | "VOID" | "REFUNDED"
  invoiceIssuedAt: string | null
  settlementStage?: "AWAITING_PAYMENT" | "VERIFIED_AWAITING_ALLOCATION" | "ALLOCATED_AWAITING_SIGNING" | "AWAITING_SIGNING" | "COMPLETED" | "RECONCILIATION_REQUIRED"
}
export interface RenewalApiQuote {
  id: string
  rentalId: string
  customerId: string
  quotedAt: string
  expiresAt: string | null
  oldEndDate: string
  endDateConvention?: "INCLUSIVE" | "EXCLUSIVE" | null
  rentalStartDate?: string | null
  extensionStartDate: string
  extensionEndExclusive: string
  newEndDate: string
  unitTypeId: string
  storageUnitId: string
  facilityId: string
  pricingPackageCode: string
  packagePolicyRef: string
  packagePolicyVersion: string
  rentalMonths: number
  monthlyPrice: number
  discountRate: number
  subtotal: number
  discountAmount: number
  totalAfterDiscount: number
  renewalDepositAmount: number
  remainingRentalAmount: number
  currency: string
  renewalPolicyRef: string
  renewalPolicyVersion: string
}
export interface RenewalApiQuery {
  page?: number
  size?: number
  status?: RenewalApiStatus
  rentalId?: string
  sort?: string
  facilityId?: string
  search?: string
}
