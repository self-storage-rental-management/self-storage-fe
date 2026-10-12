import { apiRequest, ApiClientError } from "./apiClient"
import { getAuthenticatedActor } from "./authApi"
import { readRentalPage } from "./rentalApi"
import { listRenewals } from "./renewalApi"
import { listRenewalOperationEvents } from "./renewalOperationsApi"
import {
  listCustomerReservations,
  listReservationPayments,
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
async function allPages<T>(
  load: (
    page: number,
  ) => Promise<{
    data: T[]
    pagination: { totalPages: number }
  }>,
): Promise<T[]> {
  const entries: T[] = []
  let page = 0,
    totalPages = 1
  do {
    const result = await load(page++)
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
  const reservations = await allPages((page) =>
    listCustomerReservations(undefined, page, 50),
  )
  const reservationEntries = (
    await Promise.all(
      reservations.map(async (reservation) => {
        const payments = await listReservationPayments(reservation.id).catch(
          (error) => {
            if (error instanceof ApiClientError && error.status === 404)
              return []
            throw error
          },
        )
        return payments.map(
          (payment) =>
            ({
              id: payment.paymentId,
              reference: reservation.reservationCode,
              category: reservationPaymentCategory(payment),
              amount: payment.amount,
              currency: payment.currency,
              timestamp:
                payment.paidAt ||
                payment.processedAt ||
                payment.createdAt ||
                null,
              status: payment.paymentStatus,
              method: payment.paymentMethod || null,
              reservationPayment: payment,
            }) satisfies HistoryEntry,
        )
      }),
    )
  ).flat()
  const supplemental = await Promise.allSettled([
    (async (): Promise<HistoryEntry[]> => {
      const renewals = await allPages((page) =>
        listRenewals("customer", { page, size: 50 }),
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
    entries: sortPaymentHistory([
      ...new Map(entries.map((entry) => [entry.id, entry])).values(),
    ]),
    warnings,
  }
}
