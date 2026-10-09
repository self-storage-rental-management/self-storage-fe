import type { RentalApiRecord } from "./rentalApi"
export type RenewalApiStatus = "pending" | "deposit_paid" | "approved" | "appointment_scheduled" | "payment_processing" | "payment_failed" | "payment_expired" | "rejected" | "cancelled" | "completed"
export type RenewalApiAction = "CANCEL" | "ACCEPT_REVISED_QUOTE" | "APPROVE" | "REJECT"
export interface RenewalApiRecord {
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
  allowedActions: RenewalApiAction[]
  disabledReasons: string[]
  acceptedTerms?: Omit<RenewalApiQuote, "id" | "rentalId" | "customerId" | "quotedAt" | "expiresAt"> | null
  cancellationReason?: string | null
}
export interface RenewalApiOption {
  pricingPackageCode: string
  rentalMonths: number
}
export interface RenewalApiQuote {
  id: string
  rentalId: string
  customerId: string
  quotedAt: string
  expiresAt: string
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
