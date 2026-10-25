import type { RenewalTransactionStatus } from './renewalStatus'
export type ManagerPaymentHistoryStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "NOT_RECEIVED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"

export type ManagerPaymentHistoryType =
  | "RESERVATION_DEPOSIT"
  | "RENTAL_BALANCE"
  | "MONTHLY_RENT"
  | "RENEWAL"
  | "DAMAGE_FEE"
  | "OTHER"
  | "RETURN_REFUND"
  | "RETURN_SETTLEMENT"

export interface ManagerPaymentHistoryItem {
  id: string
  transactionReference: string
  customerName: string
  type: ManagerPaymentHistoryType
  status: ManagerPaymentHistoryStatus
  amount: number
  currency: string
  refundedAmount: number
  paymentMethod: string | null
  occurredAt: string
  renewalId?: string | null
  receiptFileId?: string | null
  transactionStatus?: RenewalTransactionStatus | null
  receiptAvailable?: boolean | null
}

export interface ManagerPaymentHistoryPage {
  data: ManagerPaymentHistoryItem[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string | null
}

export interface ManagerPaymentHistoryQuery {
  facilityId: string
  page: number
  size: number
  search?: string
}
