// Generated from backend enums. Run npm run statuses:generate; do not edit manually.

// Backend: src/main/java/com/storagehub/domain/model/PaymentStatus.java
export const paymentStatusValues = ["PENDING","PROCESSING","PAID","NOT_RECEIVED","FAILED","CANCELLED"] as const
export type PaymentStatus = (typeof paymentStatusValues)[number]
export const isPaymentStatus = (value: unknown): value is PaymentStatus => typeof value === 'string' && (paymentStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/domain/model/ReservationStatus.java
export const reservationStatusValues = ["AWAITING_EMAIL","AWAITING_REVIEW","AWAITING_PAYMENT","PAYMENT_GRACE","PAYMENT_REVIEW","CONFIRMED","UNIT_RESERVED","READY_FOR_CHECKIN","AWAITING_CUSTOMER_RECEIPT","COMPLETED","CANCELLED","EXPIRED","REJECTED"] as const
export type ReservationStatus = (typeof reservationStatusValues)[number]
export const isReservationStatus = (value: unknown): value is ReservationStatus => typeof value === 'string' && (reservationStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/domain/model/RentalStatus.java
export const rentalStatusValues = ["setup","active","return_requested","return_inspection","closing","completed"] as const
export type RentalStatus = (typeof rentalStatusValues)[number]
export const isRentalStatus = (value: unknown): value is RentalStatus => typeof value === 'string' && (rentalStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/domain/model/RenewalStatus.java
export const renewalStatusValues = ["pending","accepted","deposit_paid","full_rent_paid","approved","appointment_scheduled","payment_processing","payment_failed","payment_expired","rejected","cancelled","completed"] as const
export type RenewalStatus = (typeof renewalStatusValues)[number]
export const isRenewalStatus = (value: unknown): value is RenewalStatus => typeof value === 'string' && (renewalStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/domain/model/CheckInStatus.java
export const checkInStatusValues = ["scheduled","identity_verified","contract_signed","payment_collected","setup_in_progress","setup_completed","completed","rejected","no_show","cancelled"] as const
export type CheckInStatus = (typeof checkInStatusValues)[number]
export const isCheckInStatus = (value: unknown): value is CheckInStatus => typeof value === 'string' && (checkInStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/api/StatusContract.java
export const invoiceStatusValues = ["NOT_ISSUED","UNPAID","PARTIALLY_PAID","PAID","CANCELLED","UNKNOWN"] as const
export type InvoiceStatus = (typeof invoiceStatusValues)[number]
export const isInvoiceStatus = (value: unknown): value is InvoiceStatus => typeof value === 'string' && (invoiceStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/api/StatusContract.java
export const invoiceRefundStatusValues = ["NONE","PENDING","PARTIALLY_REFUNDED","REFUNDED","UNKNOWN"] as const
export type InvoiceRefundStatus = (typeof invoiceRefundStatusValues)[number]
export const isInvoiceRefundStatus = (value: unknown): value is InvoiceRefundStatus => typeof value === 'string' && (invoiceRefundStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/api/StatusContract.java
export const paymentTransactionStatusValues = ["PENDING","PROCESSING","RECONCILIATION_REQUIRED","SUCCEEDED","FAILED","CANCELLED","EXPIRED","PARTIALLY_REFUNDED","REFUNDED"] as const
export type PaymentTransactionStatus = (typeof paymentTransactionStatusValues)[number]
export const isPaymentTransactionStatus = (value: unknown): value is PaymentTransactionStatus => typeof value === 'string' && (paymentTransactionStatusValues as readonly string[]).includes(value)

// Backend: src/main/java/com/storagehub/api/StatusContract.java
export const renewalWorkflowStatusValues = ["UNDER_REVIEW","AWAITING_PAYMENT","AWAITING_RECONCILIATION","AWAITING_SIGNING","SIGNING_IN_PROGRESS","SIGNING_EXPIRED","PAYMENT_WINDOW_EXPIRED","ON_HOLD","COMPLETED","CANCELLED","REJECTED"] as const
export type RenewalWorkflowStatus = (typeof renewalWorkflowStatusValues)[number]
export const isRenewalWorkflowStatus = (value: unknown): value is RenewalWorkflowStatus => typeof value === 'string' && (renewalWorkflowStatusValues as readonly string[]).includes(value)
