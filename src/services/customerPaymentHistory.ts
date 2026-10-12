import { apiRequest } from "./apiClient"
import { getAuthenticatedActor } from "./authApi"
import { readRentalPage } from "./rentalApi"
import { listRenewals } from "./renewalApi"
import { listRenewalOperationEvents } from "./renewalOperationsApi"
import {
  listCustomerPaymentHistory,
  type ReservationPaymentResult,
} from "./customerReservationApi"

export const paymentCategories = {
  deposit: "Thanh toán cọc giữ chỗ",
  renewal: "Thanh toán cọc gia hạn",
  damage: "Thanh toán bổ sung khi trả kho",
  checkin: "Thanh toán tại chỗ khi nhận kho",
  renewalSigning: "Thanh toán tại chỗ khi ký gia hạn",
  other: "Thanh toán khác",
} as const
export type PaymentCategory = keyof typeof paymentCategories
export interface HistoryEntry {
  id: string
  reference: string
  category: PaymentCategory
  amount: number | null
  currency: string
  timestamp: string | null
  updatedAt?: string | null
  status: string
  method: string | null
  reservationPayment?: ReservationPaymentResult
}
export function reservationPaymentCategory(
  payment: ReservationPaymentResult,
): PaymentCategory {
  switch (payment.purpose) {
    case undefined:
    case "RESERVATION_DEPOSIT":
      return "deposit"
    case "RENTAL_BALANCE":
      return "checkin"
    case "RENEWAL":
      return "renewal"
    case "DAMAGE_FEE":
      return "damage"
    default:
      return "other"
  }
}
export function sortPaymentHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const time = (value: string | null) =>
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  return [...entries].sort(
    (a, b) => time(b.timestamp) - time(a.timestamp) || a.id.localeCompare(b.id),
  )
}
export function latestPaymentRecords(entries: HistoryEntry[]): HistoryEntry[] {
  const latest = new Map<string, HistoryEntry>()
  const updateTime = (entry: HistoryEntry) => {
    const value = entry.updatedAt || entry.timestamp
    return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  }
  for (const entry of entries) {
    const existing = latest.get(entry.id)
    if (!existing || updateTime(entry) > updateTime(existing)) latest.set(entry.id, entry)
  }
  return sortPaymentHistory([...latest.values()])
}
async function allPages<T>(
  load: (
    page: number,
  ) => Promise<{
    data: T[]
    pagination: { totalPages: number }
  }>,
  onError?: () => void,
): Promise<T[]> {
  const entries: T[] = []
  let page = 0,
    totalPages = 1
  do {
    let result
    try {
      result = await load(page++)
    } catch (error) {
      if (!onError) throw error
      onError()
      break
    }
    entries.push(...result.data)
    totalPages = result.pagination.totalPages
  } while (page < totalPages)
  return entries
}
interface ReturnPayment {
  id: string
  customerId: string
  unitNumber: string
  settlementPaymentId: string | null
  settlementPaidAt: string | null
  amountDueFromCustomer: number | null
}
function isReturnPayment(value: unknown): value is ReturnPayment {
  if (!value || typeof value !== "object") return false
  const r = value as ReturnPayment
  return (
    typeof r.id === "string" &&
    r.customerId === getAuthenticatedActor()?.id &&
    typeof r.unitNumber === "string" &&
    (r.settlementPaymentId === null ||
      typeof r.settlementPaymentId === "string") &&
    (r.settlementPaidAt === null ||
      (typeof r.settlementPaidAt === "string" &&
        Number.isFinite(Date.parse(r.settlementPaidAt)))) &&
    (r.amountDueFromCustomer === null ||
      (typeof r.amountDueFromCustomer === "number" &&
        Number.isFinite(r.amountDueFromCustomer) &&
        r.amountDueFromCustomer >= 0))
  )
}
export async function loadCustomerPaymentHistory(): Promise<{
  entries: HistoryEntry[]
  warnings: string[]
}> {
  const warnings: string[] = []
  const payments = await allPages(
    page => listCustomerPaymentHistory(page, 50),
    () => warnings.push("Chưa tải được đầy đủ lịch sử thanh toán đơn giữ kho."),
  )
  const reservationEntries: HistoryEntry[] = payments.map(payment => ({
    id: payment.paymentId,
    reference: payment.reservationCode || payment.reservationId,
    category: reservationPaymentCategory(payment), amount: payment.amount, currency: payment.currency,
    timestamp: payment.paidAt || payment.processedAt || payment.createdAt || null,
    updatedAt: payment.processedAt || payment.createdAt || null,
    status: payment.paymentStatus, method: payment.paymentMethod || null, reservationPayment: payment,
  }))
  const supplemental = await Promise.allSettled([
    (async (): Promise<HistoryEntry[]> => {
      const renewals = await allPages((page) =>
        listRenewals("customer", { page, size: 50 }),
        () => warnings.push("Chưa tải được đầy đủ danh sách gia hạn."),
      )
      return (
        await Promise.all(
          renewals.map(async (renewal) => {
            const events = await allPages((page) =>
              listRenewalOperationEvents(
                "customer",
                renewal.id,
                "payments",
                page,
                50,
              ),
              () => warnings.push(`Chưa tải được đầy đủ thanh toán của đơn gia hạn ${renewal.id}.`),
            )
            return events.map((event) => {
              const data = event.data as Record<string, unknown>,
                cash = event.kind === "CASH"
              return {
                id: String(cash ? data.reference : data.paymentRef),
                reference: `Gia hạn ${renewal.id}`,
                category: cash ? "renewalSigning" : "renewal",
                amount: typeof data.amount === "number" ? data.amount : null,
                currency: "VND",
                timestamp: String(
                  cash ? data.receivedAt : data.paidAt || event.occurredAt,
                ),
                updatedAt: event.occurredAt,
                status:
                  cash || data.outcome === "SUCCESS"
                    ? "PAID"
                    : String(data.outcome),
                method: cash ? "Tiền mặt tại cơ sở" : null,
              } satisfies HistoryEntry
            })
          }),
        )
      ).flat()
    })(),
    (async (): Promise<HistoryEntry[]> => {
      const returns = await allPages((page) =>
        apiRequest(`/api/customer/returns?page=${page}&pageSize=50`).then(
          (result) =>
            readRentalPage<ReturnPayment>(result, isReturnPayment, page),
        ),
        () => warnings.push("Chưa tải được đầy đủ lịch sử thanh toán bổ sung khi trả kho."),
      )
      return returns
        .filter(
          (r) =>
            r.settlementPaymentId &&
            r.settlementPaidAt &&
            r.amountDueFromCustomer !== null,
        )
        .map((r) => ({
          id: r.settlementPaymentId!,
          reference: `Trả kho ${r.unitNumber}`,
          category: "damage",
          amount: r.amountDueFromCustomer!,
          currency: "VND",
          timestamp: r.settlementPaidAt,
          status: "PAID",
          method: null,
        }))
    })(),
  ])
  const entries: HistoryEntry[] = [...reservationEntries]
  supplemental.forEach((result, index) => {
    if (result.status === "fulfilled") entries.push(...result.value)
    else
      warnings.push(
        index === 0
          ? "Chưa tải được lịch sử thanh toán gia hạn."
          : "Chưa tải được lịch sử thanh toán bổ sung khi trả kho.",
      )
  })
  return {
    entries: latestPaymentRecords(entries),
    warnings,
  }
}
