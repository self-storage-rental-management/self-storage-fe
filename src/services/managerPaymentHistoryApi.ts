import { ApiClientError, apiRequest } from "./apiClient"
import { isUuid } from "./renewalOperationsApi"
import type {
  ManagerPaymentHistoryItem,
  ManagerPaymentHistoryPage,
  ManagerPaymentHistoryQuery,
  ManagerPaymentHistoryStatus,
  ManagerPaymentHistoryType,
} from "../types/managerPaymentHistory"

const statuses: ManagerPaymentHistoryStatus[] = [
  "PENDING", "PROCESSING", "PAID", "NOT_RECEIVED", "FAILED", "CANCELLED", "REFUNDED",
]
const types: ManagerPaymentHistoryType[] = [
  "RESERVATION_DEPOSIT", "RENTAL_BALANCE", "MONTHLY_RENT", "RENEWAL", "RENEWAL_INSTALLMENT",
  "DAMAGE_FEE", "EARLY_TERMINATION_FEE", "OTHER", "RETURN_REFUND", "RETURN_SETTLEMENT",
]

function invalidResponse(): never {
  throw new ApiClientError("Phản hồi lịch sử thanh toán không đúng contract.", {
    code: "INVALID_RESPONSE",
  })
}

function isPaymentHistoryItem(value: unknown): value is ManagerPaymentHistoryItem {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return typeof row.id === "string" && row.id.length > 0
    && typeof row.transactionReference === "string" && row.transactionReference.length > 0
    && typeof row.customerName === "string" && row.customerName.length > 0
    && typeof row.type === "string" && types.includes(row.type as ManagerPaymentHistoryType)
    && typeof row.status === "string" && statuses.includes(row.status as ManagerPaymentHistoryStatus)
    && typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount >= 0
    && typeof row.currency === "string" && row.currency.length === 3
    && typeof row.refundedAmount === "number" && Number.isFinite(row.refundedAmount) && row.refundedAmount >= 0
    && (row.paymentMethod === null || typeof row.paymentMethod === "string")
    && typeof row.occurredAt === "string" && Number.isFinite(Date.parse(row.occurredAt))
    && (row.renewalId == null || isUuid(row.renewalId))
    && (row.receiptFileId == null || isUuid(row.receiptFileId))
    && (row.invoiceNumber == null || typeof row.invoiceNumber === "string")
    && (row.invoiceStatus == null || ["DRAFT", "PAID", "VOID", "REFUNDED"].includes(row.invoiceStatus as string))
    && (row.invoiceIssuedAt == null || (typeof row.invoiceIssuedAt === "string" && Number.isFinite(Date.parse(row.invoiceIssuedAt))))
}

export async function listManagerPaymentHistory(
  query: ManagerPaymentHistoryQuery,
): Promise<ManagerPaymentHistoryPage> {
  if (!query.facilityId || !Number.isInteger(query.page) || query.page < 0
    || !Number.isInteger(query.size) || query.size < 1 || query.size > 100
    || (query.search?.length ?? 0) > 200) {
    throw new ApiClientError("Bộ lọc lịch sử thanh toán không hợp lệ.", { code: "INVALID_QUERY" })
  }

  const params = new URLSearchParams({
    facilityId: query.facilityId,
    page: String(query.page),
    size: String(query.size),
  })
  const search = query.search?.trim()
  if (search) params.set("search", search)
  const result = await apiRequest<unknown>(`/api/manager/payment-history?${params.toString()}`)

  if (!result || typeof result !== "object") return invalidResponse()
  const page = result as Partial<ManagerPaymentHistoryPage>
  const pagination = page.pagination
  if (!Array.isArray(page.data) || !page.data.every(isPaymentHistoryItem)
    || !pagination || pagination.page !== query.page
    || pagination.pageSize !== query.size
    || !Number.isSafeInteger(pagination.totalItems) || pagination.totalItems < 0
    || !Number.isSafeInteger(pagination.totalPages)
    || pagination.totalPages !== Math.ceil(pagination.totalItems / pagination.pageSize)
    || page.data.length > pagination.pageSize
    || typeof pagination.sort !== "string"
    || !(page.correlationId === null || typeof page.correlationId === "string")) {
    return invalidResponse()
  }
  return page as ManagerPaymentHistoryPage
}
